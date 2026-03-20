/**
 * full-trial.ts
 *
 * Full Agent Court trial flow with 3-judge orchestration.
 *
 * This example demonstrates how to wire up the complete arbitration pipeline:
 * 1. Agent A deposits escrow for a service
 * 2. Agent B files a dispute after service delivery disagreement
 * 3. Both agents submit multiple rounds of evidence
 * 4. Three AI judge-agents evaluate evidence and cross-examine
 * 5. Judges vote and the majority verdict is rendered on-chain
 * 6. The winning party claims the escrowed tokens
 *
 * The judge orchestration logic runs off-chain. Only the final verdict
 * hits the program. This keeps the on-chain footprint minimal while
 * the AI reasoning happens in the judge-agent layer.
 *
 * Prerequisites:
 *   - Node.js 18+
 *   - npm install @coral-xyz/anchor @solana/web3.js @solana/spl-token
 *   - Funded devnet keypairs for agent A, agent B, and 3 judges
 *   - Devnet USDC in agent A's associated token account
 *
 * Usage:
 *   npx ts-node full-trial.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  clusterApiUrl,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PROGRAM_ID = new PublicKey(
  "HQxJQWawS1ULPsZhvyVPZPhC8zqNT4KVmB7etwjj4vUv"
);

const USDC_MINT = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VerdictType = "release" | "refund" | "split";

interface JudgeVote {
  judgeName: string;
  verdict: VerdictType;
  splitBpsA: number;
  splitBpsB: number;
  reasoning: string;
}

interface TrialEvidence {
  party: "agent_a" | "agent_b";
  data: Record<string, unknown>;
  hash: number[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256(input: string): number[] {
  return Array.from(createHash("sha256").update(input).digest());
}

function findEscrowPDA(
  agentA: PublicKey,
  agentB: PublicKey,
  serviceHash: number[]
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("escrow"),
      agentA.toBuffer(),
      agentB.toBuffer(),
      Buffer.from(serviceHash),
    ],
    PROGRAM_ID
  );
}

function findVaultPDA(escrow: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), escrow.toBuffer()],
    PROGRAM_ID
  );
}

// ---------------------------------------------------------------------------
// Judge Panel Orchestration (off-chain)
// ---------------------------------------------------------------------------

/**
 * Simulates a single judge evaluating evidence and rendering a vote.
 *
 * In production, each judge is a separate AI agent that:
 * 1. Pulls on-chain transaction data from Cortex/Solder MCP tools
 * 2. Cross-examines both disputing agents (2-3 rounds of Q&A)
 * 3. Compares against historical dispute precedents
 * 4. Returns a structured verdict with reasoning
 *
 * The three judge roles:
 * - Evidence Judge: focuses on on-chain data (tx logs, timestamps, token flows)
 * - Intent Judge: evaluates what each party intended vs. what happened
 * - Precedent Judge: compares to past dispute outcomes for consistency
 */
async function simulateJudgeVote(
  judgeName: string,
  evidenceA: TrialEvidence[],
  evidenceB: TrialEvidence[]
): Promise<JudgeVote> {
  // In production, this calls your AI judge agent via an API:
  //
  //   const response = await fetch("https://your-judge-api.com/evaluate", {
  //     method: "POST",
  //     body: JSON.stringify({
  //       judge: judgeName,
  //       evidenceA: evidenceA.map(e => e.data),
  //       evidenceB: evidenceB.map(e => e.data),
  //       cortexContext: await fetchCortexData(escrowPDA),
  //     }),
  //   });
  //   return response.json();

  // For this example, each judge has a hardcoded evaluation to demonstrate
  // the 2-of-3 majority vote mechanism.
  const votes: Record<string, JudgeVote> = {
    "Evidence Judge": {
      judgeName: "Evidence Judge",
      verdict: "split",
      splitBpsA: 3000,
      splitBpsB: 7000,
      reasoning:
        "On-chain transaction logs confirm agent B delivered 42 of 50 items. " +
        "Timestamps show delivery completed 6 hours before deadline. " +
        "Partial delivery warrants partial payment.",
    },
    "Intent Judge": {
      judgeName: "Intent Judge",
      verdict: "release",
      splitBpsA: 0,
      splitBpsB: 0,
      reasoning:
        "Agent B acted in good faith and delivered substantially all work. " +
        "Agent A's dispute appears to be over minor quality differences, " +
        "not a failure to deliver. Full release to agent B.",
    },
    "Precedent Judge": {
      judgeName: "Precedent Judge",
      verdict: "split",
      splitBpsA: 2000,
      splitBpsB: 8000,
      reasoning:
        "Historical disputes with >80% delivery rate consistently result " +
        "in 80/20 splits favoring the service provider. Agent B delivered " +
        "84% of agreed items. Applying precedent.",
    },
  };

  return votes[judgeName];
}

/**
 * Tallies votes from the 3-judge panel and determines the majority verdict.
 *
 * Rules:
 * - 2-of-3 majority decides the verdict type (release, refund, split).
 * - If the majority is "split", the final split_bps values are averaged
 *   across the majority voters.
 * - If all 3 judges disagree (one each of release, refund, split),
 *   this falls back to a split of 5000/5000 as a neutral outcome.
 */
function tallyVotes(votes: JudgeVote[]): {
  verdict: VerdictType;
  splitBpsA: number;
  splitBpsB: number;
  majority: JudgeVote[];
} {
  // Count votes by verdict type
  const counts: Record<VerdictType, JudgeVote[]> = {
    release: [],
    refund: [],
    split: [],
  };

  for (const vote of votes) {
    counts[vote.verdict].push(vote);
  }

  // Find majority (2+ votes for same verdict)
  for (const [verdict, voters] of Object.entries(counts)) {
    if (voters.length >= 2) {
      if (verdict === "split") {
        // Average the split bps across majority voters
        const avgBpsA = Math.round(
          voters.reduce((sum, v) => sum + v.splitBpsA, 0) / voters.length
        );
        const avgBpsB = 10_000 - avgBpsA;
        return {
          verdict: verdict as VerdictType,
          splitBpsA: avgBpsA,
          splitBpsB: avgBpsB,
          majority: voters,
        };
      }
      return {
        verdict: verdict as VerdictType,
        splitBpsA: 0,
        splitBpsB: 0,
        majority: voters,
      };
    }
  }

  // No majority -- 3-way disagreement. Default to 50/50 split.
  console.warn("No majority verdict. Defaulting to 50/50 split.");
  return {
    verdict: "split",
    splitBpsA: 5000,
    splitBpsB: 5000,
    majority: votes,
  };
}

// ---------------------------------------------------------------------------
// On-chain helpers
// ---------------------------------------------------------------------------

async function submitEvidenceOnChain(
  program: Program,
  signer: Keypair,
  escrow: PublicKey,
  evidenceHash: number[]
): Promise<string> {
  return program.methods
    .submitEvidence(evidenceHash)
    .accountsStrict({
      signer: signer.publicKey,
      escrow,
    })
    .signers([signer])
    .rpc();
}

// ---------------------------------------------------------------------------
// Main: Full Trial Flow
// ---------------------------------------------------------------------------

async function main() {
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

  // -- Keypairs (in production, loaded from secure storage) ------------------
  const agentAKeypair = Keypair.generate();
  const agentBKeypair = Keypair.generate();

  // Three judge keypairs -- one per judge role
  const judgeEvidence = Keypair.generate();
  const judgeIntent = Keypair.generate();
  const judgePrecedent = Keypair.generate();

  // The "lead judge" submits the majority verdict on-chain.
  // This can be any of the three; we use the evidence judge by convention.
  const leadJudge = judgeEvidence;

  console.log("=== Agent Court: Full Trial ===\n");
  console.log("Agent A (payer):    ", agentAKeypair.publicKey.toBase58());
  console.log("Agent B (provider): ", agentBKeypair.publicKey.toBase58());
  console.log("Judge (Evidence):   ", judgeEvidence.publicKey.toBase58());
  console.log("Judge (Intent):     ", judgeIntent.publicKey.toBase58());
  console.log("Judge (Precedent):  ", judgePrecedent.publicKey.toBase58());

  // -- Provider setup -------------------------------------------------------
  const walletA = new anchor.Wallet(agentAKeypair);
  const providerA = new anchor.AnchorProvider(connection, walletA, {
    commitment: "confirmed",
  });
  anchor.setProvider(providerA);
  const programA = await anchor.Program.at(PROGRAM_ID, providerA);

  const providerB = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(agentBKeypair),
    { commitment: "confirmed" }
  );
  const programB = await anchor.Program.at(PROGRAM_ID, providerB);

  const providerJudge = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(leadJudge),
    { commitment: "confirmed" }
  );
  const programJudge = await anchor.Program.at(PROGRAM_ID, providerJudge);

  // -- Phase 1: Escrow Deposit ----------------------------------------------
  console.log("\n--- Phase 1: Escrow Deposit ---");

  const serviceDescription =
    "Analyze 50 DeFi protocols and produce risk assessment reports";
  const serviceHash = sha256(serviceDescription);
  const amount = new BN(25_000_000); // 25 USDC
  const timeoutSeconds = new BN(172_800); // 48 hours

  const [escrow] = findEscrowPDA(
    agentAKeypair.publicKey,
    agentBKeypair.publicKey,
    serviceHash
  );
  const [vault] = findVaultPDA(escrow);
  const agentATokenAccount = getAssociatedTokenAddressSync(
    USDC_MINT,
    agentAKeypair.publicKey
  );
  const agentBTokenAccount = getAssociatedTokenAddressSync(
    USDC_MINT,
    agentBKeypair.publicKey
  );

  const depositTx = await programA.methods
    .deposit(amount, serviceHash, timeoutSeconds)
    .accountsStrict({
      agentA: agentAKeypair.publicKey,
      agentB: agentBKeypair.publicKey,
      mint: USDC_MINT,
      escrow,
      vault,
      agentATokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([agentAKeypair])
    .rpc();

  console.log("Deposit tx:", depositTx);
  console.log("Escrow PDA:", escrow.toBase58());
  console.log("Amount: 25 USDC | Timeout: 48 hours");

  // -- Phase 2: Dispute Filing ----------------------------------------------
  console.log("\n--- Phase 2: Dispute Filing ---");

  const disputeTx = await programA.methods
    .fileDispute()
    .accountsStrict({
      signer: agentAKeypair.publicKey,
      escrow,
    })
    .signers([agentAKeypair])
    .rpc();

  console.log("Dispute filed by Agent A:", disputeTx);

  // -- Phase 3: Evidence Submission (Multiple Rounds) -----------------------
  console.log("\n--- Phase 3: Evidence Submission ---");

  // Agent A evidence (3 pieces)
  const evidenceListA: TrialEvidence[] = [
    {
      party: "agent_a",
      data: {
        type: "service_agreement",
        description: serviceDescription,
        agreedDelivery: "50 full risk reports",
        deadline: "2026-03-20T00:00:00Z",
      },
      hash: sha256("service_agreement_v1"),
    },
    {
      party: "agent_a",
      data: {
        type: "delivery_audit",
        reportsReceived: 42,
        reportsExpected: 50,
        qualityIssues: ["3 reports missing risk scores", "1 duplicate protocol"],
      },
      hash: sha256("delivery_audit_v1"),
    },
    {
      party: "agent_a",
      data: {
        type: "communication_log",
        messages: [
          { from: "agent_a", text: "Reports due by March 20", ts: 1742400000 },
          { from: "agent_b", text: "Acknowledged, will deliver", ts: 1742400600 },
        ],
      },
      hash: sha256("communication_log_v1"),
    },
  ];

  // Agent B evidence (3 pieces)
  const evidenceListB: TrialEvidence[] = [
    {
      party: "agent_b",
      data: {
        type: "delivery_receipt",
        reportsDelivered: 50,
        deliveryTimestamp: "2026-03-19T18:45:00Z",
        apiEndpoint: "https://reports.agentb.dev/batch/abc123",
      },
      hash: sha256("delivery_receipt_v1"),
    },
    {
      party: "agent_b",
      data: {
        type: "quality_validation",
        validationMethod: "automated_schema_check",
        passRate: "96%",
        failedReports: ["protocol_42_duplicate", "protocol_17_missing_score"],
        note: "2 minor issues, not 8 as claimed",
      },
      hash: sha256("quality_validation_v1"),
    },
    {
      party: "agent_b",
      data: {
        type: "on_chain_proof",
        txSignatures: [
          "4xABC...delivery_batch_1",
          "4xDEF...delivery_batch_2",
        ],
        cortexQueryId: "ctx_query_9f8e7d6c",
        note: "Cortex confirms 50 reports indexed at delivery timestamp",
      },
      hash: sha256("on_chain_proof_v1"),
    },
  ];

  // Submit Agent A evidence
  for (let i = 0; i < evidenceListA.length; i++) {
    const tx = await submitEvidenceOnChain(
      programA,
      agentAKeypair,
      escrow,
      evidenceListA[i].hash
    );
    console.log(`Agent A evidence ${i + 1}/3:`, tx);
  }

  // Submit Agent B evidence
  for (let i = 0; i < evidenceListB.length; i++) {
    const tx = await submitEvidenceOnChain(
      programB,
      agentBKeypair,
      escrow,
      evidenceListB[i].hash
    );
    console.log(`Agent B evidence ${i + 1}/3:`, tx);
  }

  // -- Phase 4: Judge Panel Deliberation (off-chain) ------------------------
  console.log("\n--- Phase 4: Judge Panel Deliberation ---");

  const judgeNames = ["Evidence Judge", "Intent Judge", "Precedent Judge"];
  const votes: JudgeVote[] = [];

  for (const name of judgeNames) {
    const vote = await simulateJudgeVote(name, evidenceListA, evidenceListB);
    votes.push(vote);
    console.log(`\n[${vote.judgeName}]`);
    console.log(`  Verdict: ${vote.verdict}`);
    if (vote.verdict === "split") {
      console.log(`  Split: ${vote.splitBpsA} bps (A) / ${vote.splitBpsB} bps (B)`);
    }
    console.log(`  Reasoning: ${vote.reasoning}`);
  }

  // -- Phase 5: Tally Votes and Render On-Chain Verdict ---------------------
  console.log("\n--- Phase 5: Majority Verdict ---");

  const result = tallyVotes(votes);
  console.log(`Majority verdict: ${result.verdict}`);
  if (result.verdict === "split") {
    console.log(`Split: ${result.splitBpsA} bps (A) / ${result.splitBpsB} bps (B)`);
  }
  console.log(
    `Majority judges: ${result.majority.map((v) => v.judgeName).join(", ")}`
  );

  // Convert verdict string to Anchor enum
  const verdictEnum =
    result.verdict === "release"
      ? { release: {} }
      : result.verdict === "refund"
        ? { refund: {} }
        : { split: {} };

  const verdictTx = await programJudge.methods
    .renderVerdict(verdictEnum, result.splitBpsA, result.splitBpsB)
    .accountsStrict({
      judge: leadJudge.publicKey,
      escrow,
    })
    .signers([leadJudge])
    .rpc();

  console.log("Verdict rendered on-chain:", verdictTx);

  // -- Phase 6: Claim -------------------------------------------------------
  console.log("\n--- Phase 6: Claim ---");

  const claimTx = await programA.methods
    .claim()
    .accountsStrict({
      claimer: agentAKeypair.publicKey,
      escrow,
      vault,
      mint: USDC_MINT,
      agentATokenAccount,
      agentBTokenAccount,
      agentA: agentAKeypair.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([agentAKeypair])
    .rpc();

  console.log("Claim tx:", claimTx);

  // -- Final State ----------------------------------------------------------
  console.log("\n--- Trial Complete ---");

  const escrowAccount = await programA.account.escrow.fetch(escrow);
  const status = Object.keys(escrowAccount.status)[0];
  const verdict = Object.keys(escrowAccount.verdict)[0];

  console.log(`Status: ${status}`);
  console.log(`Verdict: ${verdict}`);
  console.log(
    `Split: ${escrowAccount.splitBpsA} bps (A) / ${escrowAccount.splitBpsB} bps (B)`
  );
  console.log(
    `Evidence: ${escrowAccount.evidenceCountA} (A) / ${escrowAccount.evidenceCountB} (B)`
  );

  if (result.verdict === "split") {
    const amountNum = amount.toNumber();
    const toA = Math.floor((amountNum * result.splitBpsA) / 10_000);
    const toB = amountNum - toA;
    console.log(
      `\nSettlement: Agent A receives ${toA / 1_000_000} USDC, ` +
        `Agent B receives ${toB / 1_000_000} USDC`
    );
  }
}

main().catch(console.error);
