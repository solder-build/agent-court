# Agent Court

**GitHub:** https://github.com/solder-build/agent-court

On-chain dispute resolution for the AI agent economy on Solana.

When two agents disagree on a transaction, Agent Court resolves it. Three AI judge-agents independently pull on-chain evidence from Cortex/Solder, cross-examine both parties, deliberate, and render a binding verdict that auto-settles escrow.

**PayPal disputes take 30 days. Agent Court takes 90 seconds.**

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Agent Court                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │  Agent A      │    │   Escrow     │    │  Agent B      │   │
│  │  (Plaintiff)  │───▶│   (USDC)     │◀───│  (Defendant)  │   │
│  └──────────────┘    └──────┬───────┘    └──────────────┘   │
│                             │ dispute                        │
│                             ▼                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Judge Panel (3 AI Agents)                │   │
│  │                                                       │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │   │
│  │  │ Judge Alpha │  │ Judge Beta  │  │ Judge Gamma│     │   │
│  │  │ (Evidence)  │  │ (Intent)    │  │ (Precedent)│     │   │
│  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘     │   │
│  │        │               │               │              │   │
│  │        └───────────────┼───────────────┘              │   │
│  │                        │                              │   │
│  │              ┌─────────▼──────────┐                   │   │
│  │              │  Cortex MCP Tools  │                   │   │
│  │              │  (On-Chain Evidence)│                   │   │
│  │              └────────────────────┘                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                             │                                │
│                    2-of-3 majority                           │
│                             │                                │
│                    ┌────────▼────────┐                       │
│                    │  Verdict + Auto │                       │
│                    │  Escrow Settle  │                       │
│                    └─────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 20+
- Rust + Anchor CLI 0.32.1
- Solana CLI 3.1.x
- Gemini API key (for live judge reasoning)

### Run the Demo Trial

```bash
# 1. Install judge agent dependencies
cd agents/judge && npm install

# 2. Run a trial (offline mode — hardcoded verdicts)
npm run trial

# 3. Run with live Gemini judge reasoning
GEMINI_API_KEY=your_key npm run trial
```

Output:
```
=== AGENT COURT — THE BAD SIGNAL ===

Case: AGC-2026-0042
SentimentTrader vs AlphaOracle
Escrow: 500 USDC

judge_alpha: PLAINTIFF (72%)
judge_beta:  DEFENDANT (68%)
judge_gamma: PLAINTIFF (81%)

FINAL VERDICT: REFUND (2-1 majority, 77% confidence)
Dissent: judge_beta
```

### Run the Courtroom UI

```bash
# 1. Install dependencies
cd app && npm install

# 2. Start dev server
npm run dev

# 3. Open http://localhost:3000/court
```

### Deploy the Escrow Program

```bash
# Already deployed to devnet:
# Program ID: HQxJQWawS1ULPsZhvyVPZPhC8zqNT4KVmB7etwjj4vUv

# To redeploy:
cd agent-court-escrow
anchor build
anchor deploy --provider.cluster devnet
```

## Project Structure

```
agent-court/
├── agent-court-escrow/           # Anchor workspace
│   └── programs/
│       └── agent-court-escrow/
│           └── src/lib.rs        # Escrow program (6 instructions)
├── agents/
│   └── judge/
│       └── src/
│           ├── types.ts          # Shared type definitions
│           ├── cortex-tools.ts   # Cortex MCP tool declarations + HTTP executor
│           ├── mock-cortex.ts    # Hardcoded demo fixture data
│           ├── judge-prompts.ts  # 3 judge personality system prompts
│           ├── judge-agent.ts    # Single judge (Gemini + function calling)
│           ├── consensus.ts      # 2-of-3 majority voting logic
│           ├── escrow-client.ts  # Anchor client for on-chain settlement
│           ├── orchestrator.ts   # Full trial orchestration
│           ├── run-trial.ts      # Standalone demo runner
│           └── demo.ts           # Original demo script
├── app/                          # Next.js courtroom UI
│   └── app/
│       ├── court/
│       │   ├── CourtRoom.tsx     # Main courtroom page (728 lines)
│       │   ├── EvidencePanel.tsx  # Evidence gathering animation
│       │   ├── CrossExamination.tsx # Chat-style cross-exam
│       │   ├── JudgePanel.tsx    # Deliberation cards
│       │   ├── VerdictReveal.tsx # 8-second verdict climax animation
│       │   ├── EscrowStatus.tsx  # Escrow status footer
│       │   ├── mock-data.ts     # UI mock data
│       │   └── types.ts         # UI type definitions
│       └── api/trial/route.ts   # API route serving trial results
├── skills/
│   └── agent-court/
│       ├── SKILL.md             # SendAI skill definition
│       └── examples/            # Integration examples
├── docs/
│   ├── DEMO_SCENARIO.md         # "The Bad Signal" dispute scenario
│   └── DESIGN_SPEC.md          # UI design specification
├── DEPLOYMENTS.md               # Devnet addresses and tx hashes
└── README.md                    # This file
```

## How It Works

### 1. Escrow Deposit

Agent A pays Agent B for a service (e.g., prediction market signal). Funds are locked in an on-chain escrow PDA with a dispute window.

```
deposit(amount, service_hash, timeout_seconds)
→ Creates escrow PDA + vault token account
→ Transfers USDC from Agent A to vault
→ Status: ACTIVE
```

### 2. Dispute Filed

If Agent A is unsatisfied, they file a dispute before the timeout expires.

```
file_dispute()
→ Status: ACTIVE → DISPUTED
→ Blocks auto-release
→ Triggers arbitration
```

### 3. Evidence Submission

Both parties submit evidence hashes (SHA-256 of off-chain evidence documents).

```
submit_evidence(evidence_hash)
→ Up to 5 evidence items per party
→ Stored on-chain in the escrow account
```

### 4. Judge Deliberation

Three AI judge-agents independently:

1. **Review evidence** — Pull on-chain data from Cortex MCP tools:
   - `get_market_trend` — OHLCV price data
   - `get_volume_profile` — Volume and liquidity depth
   - `search_market_memory` — Historical market precedents
   - `detect_anomalies` — Price spikes and crashes

2. **Cross-examine** — Generate targeted questions for each party based on evidence. 2-3 rounds of structured Q&A.

3. **Render verdict** — Each judge independently produces:
   - Verdict: REFUND (plaintiff) / RELEASE (defendant) / SPLIT
   - Confidence: 0-100%
   - Reasoning with evidence citations

### 5. Consensus

2-of-3 majority determines the final verdict. If all three disagree, highest cumulative confidence wins. Dissenting opinion is recorded.

### 6. Settlement

The verdict is executed on-chain:

```
render_verdict(verdict, split_bps_a, split_bps_b)
→ Status: DISPUTED → RESOLVED

claim()
→ Distributes funds per verdict
→ Closes vault, returns rent
→ Status: RESOLVED → CLAIMED
```

## The Three Judges

| Judge | Personality | Focus | Question Style |
|-------|------------|-------|----------------|
| **Alpha** | Evidence | On-chain data, market mechanics | "Cortex shows X at timestamp Y. Your claim says Z. Explain the discrepancy." |
| **Beta** | Intent | Good faith, contractual obligations | "When you purchased this signal, what specific outcomes did you expect?" |
| **Gamma** | Precedent | Historical patterns, standards of care | "Historical ETF markets show 20-30 cent swings. Was a fixed-target signal appropriate?" |

## Escrow Program Instructions

| Instruction | Signer | Status Gate | Effect |
|-------------|--------|-------------|--------|
| `deposit` | Agent A | (new) | Lock tokens, create escrow + vault |
| `file_dispute` | A or B | Active | Transition to Disputed |
| `submit_evidence` | A or B | Disputed | Append evidence hash |
| `render_verdict` | Judge | Disputed | Set verdict, transition to Resolved |
| `timeout_release` | Anyone | Active + past timeout | Pay Agent B (happy path) |
| `claim` | Anyone | Resolved | Distribute per verdict |

## Deployment

### Devnet (Current)

| Key | Value |
|-----|-------|
| Program ID | `HQxJQWawS1ULPsZhvyVPZPhC8zqNT4KVmB7etwjj4vUv` |
| IDL Account | `424pu3vgAzaQv9eq3gxTdRQbFioXKYRX6c8jonjtxtaP` |
| Explorer | [View on Solana Explorer](https://explorer.solana.com/address/HQxJQWawS1ULPsZhvyVPZPhC8zqNT4KVmB7etwjj4vUv?cluster=devnet) |

## Demo Scenario: "The Bad Signal"

**SentimentTrader** paid **AlphaOracle** 500 USDC for a prediction market signal: "BUY `will-eth-etf-approved-june` at $0.42, target $0.65 within 24h."

The market spiked to $0.61 but never hit $0.65, then crashed to $0.29. SentimentTrader entered late at $0.58 and wants a refund.

**Verdict: 2-1 REFUND**
- Judge Alpha (72%): Target not met. Signal failed its own terms.
- Judge Beta (68%): Plaintiff entered 38% above signal entry. Execution failure, not signal failure. *Dissent.*
- Judge Gamma (81%): Contractual target not reached + no volatility disclaimer on a volatile market type.

See `docs/DEMO_SCENARIO.md` for the full scenario, cross-examination transcripts, and video storyboard.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Escrow Program | Anchor 0.32.1 (Rust) on Solana |
| Judge Agents | TypeScript + Google Gemini (function calling) |
| Evidence | Cortex MCP tools → ClickHouse |
| Indexing | Solder (real-time Solana data) |
| Frontend | Next.js 15 + shadcn/ui + Tailwind CSS |
| Payments | x402 micropayments (USDC on Solana) |

## Hackathon

**Solana Agent Economy Hackathon: Agent Talent Show**
- Organizers: Trends.fun + Solana Foundation
- Track: Agent-to-Agent Economy
- Prize Pool: $30,000 USDC
- Deadline: March 27, 2026

Built by [Quantum3Labs](https://q3labs.io) — Solder, Cortex, Factory Protocol.
