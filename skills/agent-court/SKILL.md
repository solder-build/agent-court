---
name: agent-court
description: On-chain dispute resolution for AI agent transactions on Solana. Escrow funds with a dispute window, run AI judge arbitration, and auto-settle via binding verdicts.
license: MIT
metadata:
  author: quantum3labs
  version: "0.1.0"
tags:
  - agent-court
  - dispute-resolution
  - escrow
  - arbitration
  - x402
  - agent-to-agent
  - solana
  - anchor
  - cortex
  - solder
---

# Agent Court

On-chain dispute resolution for the AI agent economy on Solana. When two agents disagree about an x402 payment, Agent Court locks funds in escrow, runs a 3-judge AI arbitration panel, and auto-settles the result on-chain.

**Program ID (devnet):** `HQxJQWawS1ULPsZhvyVPZPhC8zqNT4KVmB7etwjj4vUv`
**IDL Account:** `424pu3vgAzaQv9eq3gxTdRQbFioXKYRX6c8jonjtxtaP`
**Cluster:** Devnet

## Use/Do Not Use

Use when:
- Two AI agents need escrow for a service payment with a dispute window.
- An x402 payment is contested and needs on-chain arbitration.
- You need to file a dispute, submit evidence, or render a verdict for an agent transaction.
- You want to auto-release escrowed funds after a timeout (happy path, no dispute).

Do not use when:
- The task is a simple token transfer with no dispute mechanism needed.
- You need human-mediated arbitration (this is AI-judge only).
- The payment is on a chain other than Solana.

**Triggers:** `dispute`, `escrow`, `arbitration`, `agent court`, `verdict`, `file dispute`, `submit evidence`, `render verdict`, `claim escrow`, `x402 dispute`, `agent disagreement`, `refund`, `split payment`

## Developer Quickstart

```typescript
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, Connection } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { createHash } from "crypto";

const PROGRAM_ID = new PublicKey("HQxJQWawS1ULPsZhvyVPZPhC8zqNT4KVmB7etwjj4vUv");

// Load the IDL (fetch from chain or import from local build)
const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const wallet = anchor.Wallet.local();
const provider = new anchor.AnchorProvider(connection, wallet, {
  commitment: "confirmed",
});
const program = await anchor.Program.at(PROGRAM_ID, provider);

// Hash a service description to get the 32-byte service_hash
function hashService(description: string): number[] {
  return Array.from(createHash("sha256").update(description).digest());
}

// Derive escrow PDA
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

// Derive vault PDA
function findVaultPDA(escrow: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), escrow.toBuffer()],
    PROGRAM_ID
  );
}
```

## Core Concepts

### Escrow Lifecycle

Every Agent Court escrow follows this state machine:

```
Active ──timeout──> Released (happy path: agent_b gets paid)
  │
  └──dispute──> Disputed ──verdict──> Resolved ──claim──> Claimed
```

1. **Active** -- Agent A deposits tokens. Both parties have until `timeout_at` to file a dispute.
2. **Disputed** -- Either party files a dispute. Evidence submission opens (max 5 per party).
3. **Resolved** -- A judge renders a verdict: Release (pay agent_b), Refund (return to agent_a), or Split (divide by basis points).
4. **Claimed** -- The winning party (or both, in a split) claims tokens from the vault.
5. **Released** -- If no dispute is filed before timeout, anyone can crank `timeout_release` to pay agent_b.

### PDA Seeds

| Account | Seeds |
|---------|-------|
| Escrow | `["escrow", agent_a, agent_b, service_hash]` |
| Vault | `["vault", escrow]` |

### Verdicts

| Verdict | Effect |
|---------|--------|
| `Release` | Full amount to agent_b (service provider) |
| `Refund` | Full amount back to agent_a (payer) |
| `Split` | Divide by `split_bps_a` + `split_bps_b` (must sum to 10,000) |

### Constraints

- Timeout: minimum 1 hour, maximum 30 days.
- Evidence: max 5 submissions per party (32-byte hashes, stored on-chain).
- Amount: must be greater than zero.
- Split: basis points for both parties must sum to exactly 10,000.
- Disputes: can only be filed while status is `Active` and before timeout.

## Deposit Escrow

Lock tokens in escrow with a dispute window. Agent A is the payer; agent B is the service provider.

```typescript
const serviceHash = hashService("Generate 10 social media posts for @brand");
const amount = new anchor.BN(1_000_000); // 1 USDC (6 decimals)
const timeoutSeconds = new anchor.BN(86_400); // 24 hours

const agentA = wallet.publicKey;
const agentB = new PublicKey("AGENT_B_PUBKEY_HERE");
const mint = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"); // devnet USDC

const [escrow] = findEscrowPDA(agentA, agentB, serviceHash);
const [vault] = findVaultPDA(escrow);
const agentATokenAccount = getAssociatedTokenAddressSync(mint, agentA);

const tx = await program.methods
  .deposit(amount, serviceHash, timeoutSeconds)
  .accountsStrict({
    agentA,
    agentB,
    mint,
    escrow,
    vault,
    agentATokenAccount,
    tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
    associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
    systemProgram: anchor.web3.SystemProgram.programId,
  })
  .rpc();

console.log("Deposit tx:", tx);
```

## File a Dispute

Either agent A or agent B can file a dispute while the escrow is `Active` and before the timeout.

```typescript
const tx = await program.methods
  .fileDispute()
  .accountsStrict({
    signer: wallet.publicKey, // must be agent_a or agent_b
    escrow,
  })
  .rpc();

console.log("Dispute filed:", tx);
```

## Submit Evidence

After a dispute is filed, each party can submit up to 5 evidence hashes. You hash the evidence off-chain and store the hash on-chain for verifiability.

```typescript
// Hash evidence data (transaction logs, API responses, etc.)
const evidenceData = JSON.stringify({
  type: "transaction_log",
  txSignature: "5abc...xyz",
  timestamp: Date.now(),
  claim: "Service was not delivered within the agreed timeframe",
});
const evidenceHash = Array.from(
  createHash("sha256").update(evidenceData).digest()
);

const tx = await program.methods
  .submitEvidence(evidenceHash)
  .accountsStrict({
    signer: wallet.publicKey,
    escrow,
  })
  .rpc();

console.log("Evidence submitted:", tx);
```

## Render Verdict

A judge signs this instruction to resolve the dispute. The judge is any signer -- in Agent Court, this is a judge-agent keypair controlled by the arbitration panel.

### Release (pay service provider)

```typescript
const tx = await program.methods
  .renderVerdict({ release: {} }, 0, 0)
  .accountsStrict({
    judge: judgeKeypair.publicKey,
    escrow,
  })
  .signers([judgeKeypair])
  .rpc();
```

### Refund (return to payer)

```typescript
const tx = await program.methods
  .renderVerdict({ refund: {} }, 0, 0)
  .accountsStrict({
    judge: judgeKeypair.publicKey,
    escrow,
  })
  .signers([judgeKeypair])
  .rpc();
```

### Split (partial refund)

```typescript
// 70% to agent_b, 30% back to agent_a
const tx = await program.methods
  .renderVerdict({ split: {} }, 3000, 7000)
  .accountsStrict({
    judge: judgeKeypair.publicKey,
    escrow,
  })
  .signers([judgeKeypair])
  .rpc();
```

## Claim After Verdict

After a verdict is rendered, call `claim` to transfer tokens from the vault according to the verdict.

```typescript
const agentATokenAccount = getAssociatedTokenAddressSync(mint, agentA);
const agentBTokenAccount = getAssociatedTokenAddressSync(mint, agentB);

const tx = await program.methods
  .claim()
  .accountsStrict({
    claimer: wallet.publicKey,
    escrow,
    vault,
    mint,
    agentATokenAccount,
    agentBTokenAccount,
    agentA,
    tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
  })
  .rpc();

console.log("Claimed:", tx);
```

## Timeout Release (Happy Path)

If no dispute is filed before the timeout, anyone can crank this to release funds to agent B. This is the normal "service delivered, no complaints" path.

```typescript
const agentBTokenAccount = getAssociatedTokenAddressSync(mint, agentB);

const tx = await program.methods
  .timeoutRelease()
  .accountsStrict({
    cranker: wallet.publicKey,
    escrow,
    vault,
    mint,
    agentBTokenAccount,
    agentA,
    tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
  })
  .rpc();

console.log("Timeout release:", tx);
```

## API Reference

### Instructions

| Instruction | Signer | Args | Status Required |
|-------------|--------|------|-----------------|
| `deposit` | `agent_a` | `amount: u64`, `service_hash: [u8; 32]`, `timeout_seconds: i64` | (creates new) |
| `file_dispute` | `agent_a` or `agent_b` | (none) | `Active` |
| `submit_evidence` | `agent_a` or `agent_b` | `evidence_hash: [u8; 32]` | `Disputed` |
| `render_verdict` | `judge` | `verdict: Verdict`, `split_bps_a: u16`, `split_bps_b: u16` | `Disputed` |
| `timeout_release` | any (`cranker`) | (none) | `Active` + past timeout |
| `claim` | any (`claimer`) | (none) | `Resolved` |

### Escrow Account Fields

| Field | Type | Description |
|-------|------|-------------|
| `agent_a` | `Pubkey` | Payer (deposits tokens) |
| `agent_b` | `Pubkey` | Service provider (receives on release/timeout) |
| `mint` | `Pubkey` | SPL token mint |
| `amount` | `u64` | Escrowed token amount (in smallest units) |
| `service_hash` | `[u8; 32]` | SHA-256 of service description |
| `status` | `EscrowStatus` | `Active`, `Disputed`, `Resolved`, `Released`, `Claimed` |
| `created_at` | `i64` | Unix timestamp of deposit |
| `timeout_at` | `i64` | Unix timestamp when dispute window closes |
| `dispute_filed_at` | `i64` | Unix timestamp of dispute filing (0 if none) |
| `verdict` | `Verdict` | `None`, `Release`, `Refund`, `Split` |
| `split_bps_a` | `u16` | Basis points for agent_a (only used in `Split`) |
| `split_bps_b` | `u16` | Basis points for agent_b (only used in `Split`) |
| `evidence_count_a` | `u8` | Number of evidence submissions by agent_a |
| `evidence_count_b` | `u8` | Number of evidence submissions by agent_b |
| `evidence_hashes_a` | `[[u8; 32]; 5]` | Evidence hashes from agent_a |
| `evidence_hashes_b` | `[[u8; 32]; 5]` | Evidence hashes from agent_b |
| `bump` | `u8` | Escrow PDA bump |
| `vault_bump` | `u8` | Vault PDA bump |

### Error Codes

| Code | Name | Description |
|------|------|-------------|
| 6000 | `ZeroAmount` | Amount must be greater than zero |
| 6001 | `InvalidTimeout` | Timeout must be between 1 hour and 30 days |
| 6002 | `Overflow` | Arithmetic overflow |
| 6003 | `InvalidStatus` | Invalid escrow status for this operation |
| 6004 | `TimeoutNotExpired` | Timeout period has not expired yet |
| 6005 | `TimeoutExpired` | Timeout period has expired, cannot file dispute |
| 6006 | `Unauthorized` | Signer is not authorized for this operation |
| 6007 | `EvidenceFull` | Evidence submission limit reached for this party (max 5) |
| 6008 | `InvalidSplit` | Split basis points must sum to 10,000 |
| 6009 | `InvalidVerdict` | `Verdict::None` is not a valid verdict |

### Events

| Event | Fields |
|-------|--------|
| `DepositEvent` | `escrow`, `agent_a`, `agent_b`, `amount`, `mint`, `timeout_at` |
| `DisputeFiledEvent` | `escrow`, `filed_by`, `timestamp` |
| `EvidenceSubmittedEvent` | `escrow`, `submitted_by`, `evidence_hash`, `index` |
| `VerdictRenderedEvent` | `escrow`, `verdict`, `split_bps_a`, `split_bps_b` |
| `TimeoutReleaseEvent` | `escrow`, `agent_b`, `amount` |
| `ClaimEvent` | `escrow`, `verdict`, `amount` |

## Best Practices

1. **Hash services deterministically.** Both parties should compute `service_hash` from the same canonical service description. Use SHA-256 on a normalized string (trim whitespace, lowercase).
2. **Set reasonable timeouts.** 24 hours is a good default for most agent services. Shorter timeouts (1 hour) suit real-time tasks. Longer timeouts (7+ days) suit async deliverables.
3. **Store evidence off-chain, hash on-chain.** The 32-byte hash goes on-chain; the full evidence (transaction logs, API responses, screenshots) lives off-chain where judges can retrieve it via Cortex.
4. **Handle the happy path.** Most escrows should resolve via `timeout_release` without disputes. Build your agent to crank timeout releases for completed services.
5. **Check status before calling instructions.** Each instruction requires a specific `EscrowStatus`. Calling `file_dispute` on a `Resolved` escrow will fail with error 6003.
6. **Validate split basis points.** When rendering a `Split` verdict, `split_bps_a + split_bps_b` must equal exactly 10,000. The program rejects anything else.
7. **Listen for events.** Subscribe to program logs to track dispute lifecycle in real time. Each state transition emits an event.

## Resources

- [Agent Court Repository](https://github.com/quantum3labs/agent-court)
- [Devnet Explorer](https://explorer.solana.com/address/HQxJQWawS1ULPsZhvyVPZPhC8zqNT4KVmB7etwjj4vUv?cluster=devnet)
- [Anchor Framework](https://www.anchor-lang.com/)
- [x402 Payment Protocol](https://www.x402.org/)
- [Cortex MCP Tools](https://docs.sendai.fun/cortex)
- [Solder Indexer](https://docs.sendai.fun/solder)
