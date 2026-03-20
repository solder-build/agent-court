/**
 * basic-escrow.ts
 *
 * Demonstrates the core Agent Court escrow lifecycle on devnet:
 * 1. Create an escrow (deposit tokens)
 * 2. File a dispute
 * 3. Submit evidence from both parties
 * 4. Render a verdict
 * 5. Claim the escrowed tokens
 *
 * Prerequisites:
 *   - Node.js 18+
 *   - npm install @coral-xyz/anchor @solana/web3.js @solana/spl-token
 *   - Two funded devnet keypairs (agent A and agent B)
 *   - A judge keypair
 *   - Devnet USDC in agent A's associated token account
 *
 * Usage:
 *   npx ts-node basic-escrow.ts
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

// Devnet USDC mint (Circle's devnet faucet mint)
const USDC_MINT = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashService(description: string): number[] {
  return Array.from(createHash("sha256").update(description).digest());
}

function hashEvidence(data: string): number[] {
  return Array.from(createHash("sha256").update(data).digest());
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
// Main
// ---------------------------------------------------------------------------

async function main() {
  // -- Setup provider -------------------------------------------------------

  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

  // In production these come from secure key management. For this example,
  // generate fresh keypairs or load from files.
  const agentAKeypair = Keypair.generate();
  const agentBKeypair = Keypair.generate();
  const judgeKeypair = Keypair.generate();

  console.log("Agent A:", agentAKeypair.publicKey.toBase58());
  console.log("Agent B:", agentBKeypair.publicKey.toBase58());
  console.log("Judge:  ", judgeKeypair.publicKey.toBase58());

  // Fund agent A with SOL for transaction fees (use `solana airdrop` on devnet)
  // Fund agent A's USDC ATA with devnet USDC (use Circle's devnet faucet)

  const wallet = new anchor.Wallet(agentAKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const program = await anchor.Program.at(PROGRAM_ID, provider);

  // -- Step 1: Deposit ------------------------------------------------------

  const serviceDescription = "Summarize 50 research papers on quantum computing";
  const serviceHash = hashService(serviceDescription);
  const amount = new BN(5_000_000); // 5 USDC
  const timeoutSeconds = new BN(86_400); // 24 hours

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

  console.log("\n--- Step 1: Deposit escrow ---");
  const depositTx = await program.methods
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

  // -- Step 2: File dispute -------------------------------------------------

  console.log("\n--- Step 2: File dispute ---");

  // Switch provider to agent B for this call
  const providerB = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(agentBKeypair),
    { commitment: "confirmed" }
  );
  const programB = await anchor.Program.at(PROGRAM_ID, providerB);

  const disputeTx = await programB.methods
    .fileDispute()
    .accountsStrict({
      signer: agentBKeypair.publicKey,
      escrow,
    })
    .signers([agentBKeypair])
    .rpc();

  console.log("Dispute filed tx:", disputeTx);

  // -- Step 3: Submit evidence (both parties) --------------------------------

  console.log("\n--- Step 3: Submit evidence ---");

  // Agent A submits evidence
  const evidenceA = hashEvidence(
    JSON.stringify({
      type: "service_agreement",
      description: serviceDescription,
      agreedDeadline: "2026-03-20T00:00:00Z",
      claim: "Agent B delivered only 12 of 50 papers",
    })
  );

  const evidenceATx = await program.methods
    .submitEvidence(evidenceA)
    .accountsStrict({
      signer: agentAKeypair.publicKey,
      escrow,
    })
    .signers([agentAKeypair])
    .rpc();

  console.log("Evidence (Agent A) tx:", evidenceATx);

  // Agent B submits evidence
  const evidenceB = hashEvidence(
    JSON.stringify({
      type: "delivery_proof",
      deliveredCount: 50,
      completionTimestamp: "2026-03-19T14:30:00Z",
      claim: "All 50 papers were delivered on time via the agreed API",
    })
  );

  const evidenceBTx = await programB.methods
    .submitEvidence(evidenceB)
    .accountsStrict({
      signer: agentBKeypair.publicKey,
      escrow,
    })
    .signers([agentBKeypair])
    .rpc();

  console.log("Evidence (Agent B) tx:", evidenceBTx);

  // -- Step 4: Render verdict -----------------------------------------------

  console.log("\n--- Step 4: Render verdict ---");

  // Judge decides: partial delivery warrants a 60/40 split favoring agent B
  const providerJudge = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(judgeKeypair),
    { commitment: "confirmed" }
  );
  const programJudge = await anchor.Program.at(PROGRAM_ID, providerJudge);

  const verdictTx = await programJudge.methods
    .renderVerdict(
      { split: {} }, // Verdict::Split
      4000, // 40% to agent A (partial refund)
      6000 // 60% to agent B (partial payment)
    )
    .accountsStrict({
      judge: judgeKeypair.publicKey,
      escrow,
    })
    .signers([judgeKeypair])
    .rpc();

  console.log("Verdict tx:", verdictTx);

  // -- Step 5: Claim --------------------------------------------------------

  console.log("\n--- Step 5: Claim ---");

  const agentBTokenAccount = getAssociatedTokenAddressSync(
    USDC_MINT,
    agentBKeypair.publicKey
  );

  const claimTx = await program.methods
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

  // -- Verify final state ---------------------------------------------------

  const escrowAccount = await program.account.escrow.fetch(escrow);
  console.log("\n--- Final escrow state ---");
  console.log("Status:", Object.keys(escrowAccount.status)[0]);
  console.log("Verdict:", Object.keys(escrowAccount.verdict)[0]);
  console.log("Split: Agent A =", escrowAccount.splitBpsA, "bps, Agent B =", escrowAccount.splitBpsB, "bps");
  console.log("Evidence count: Agent A =", escrowAccount.evidenceCountA, ", Agent B =", escrowAccount.evidenceCountB);
}

main().catch(console.error);
