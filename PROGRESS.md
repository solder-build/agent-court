# Agent Court — Build Progress

**Hackathon:** Solana Agent Economy Hackathon: Agent Talent Show
**Deadline:** March 27, 2026 14:00 UTC
**Started:** March 17, 2026

---

## Day 1 — March 17, 2026

### Strategy & Research
- Fetched hackathon tweets via FxTwitter API (built `tools/fetch_tweet.py`)
- Ran 9 Agency agents for brainstorming, competitive analysis, judge profiling
- Rejected 3-submission strategy (Solder MCP, Bitget trading agent, Vending MVP) — too safe for a talent show
- Rejected "Agent Darwinism" — COLONYS already shipped it, Vending Protocol has zero code
- **Selected Agent Court** — on-chain dispute resolution for agent-to-agent transactions
  - No competitor on Solana (x402r is Base-only with human arbiters)
  - Validates judges' thesis: agent economy needs governance
  - Demo is inherently dramatic (courtroom trial in 90 seconds)

### Code Built
- **Anchor escrow program** (Rust, ~700 lines)
  - 6 instructions: deposit, file_dispute, submit_evidence, render_verdict, timeout_release, claim
  - SPL token interface (USDC + Token-2022 compatible)
  - PDA-based escrow + vault, clean state machine (Active → Disputed → Resolved → Claimed)
  - Compiles clean on Anchor 0.32.1
  - **Deployed to Solana devnet**: `HQxJQWawS1ULPsZhvyVPZPhC8zqNT4KVmB7etwjj4vUv`

- **Judge orchestration system** (TypeScript, ~1,925 lines)
  - 3 judge personalities: Alpha (Evidence), Beta (Intent), Gamma (Precedent)
  - Gemini function calling integration for LLM reasoning
  - Cortex MCP tool bridge (get_market_trend, get_volume_profile, search_market_memory, detect_anomalies)
  - Cross-examination protocol (2-3 rounds per judge)
  - 2-of-3 majority consensus with dissent tracking
  - Escrow client for on-chain verdict execution
  - Compiles clean

- **Courtroom UI** (React/Next.js, ~2,830 lines)
  - 6 components: CourtRoom, EvidencePanel, CrossExamination, JudgePanel, VerdictReveal, EscrowStatus
  - 8-second choreographed verdict animation (blackout → slam → vote cards → glow → settlement)
  - Dark theme, judge accent colors (blue/amber/violet)
  - shadcn/ui primitives, Tailwind CSS
  - Next.js 15 app builds clean, `/court` route

### Strategy Docs
- X Article drafts (3 versions) — recommended: Version C article + Version B Quote RT
- BD playbook — 10 judges profiled, 8-day engagement calendar
- Demo scenario ("The Bad Signal") — prediction market signal dispute, 2-1 split verdict
- SendAI Skill (SKILL.md + 2 examples) — ready for PR to sendaifun/skills
- Design specification — full color system, layout specs, animation choreography

### Toolchain
- Solana CLI v3.1.11 installed
- Anchor v0.32.1 installed via AVM
- Devnet keypair: `47Fg5JqMsCeuRyDsFtD7Ra7YTdzVmTr2mZ1R2dUkZyfS`
- X scraping: `twikit`, `ntscraper`, `fetch_tweet.py` (FxTwitter API)

### Agency Agents Used (9)
Backend Architect, AI Engineer, UI Designer, Frontend Developer, Content Creator, Developer Advocate, Explore, Narrative Designer, Technical Writer

---

## Day 2 — March 19, 2026

### Code Built
- **Mock Cortex executor** (`mock-cortex.ts`)
  - Full "Bad Signal" fixture data for all 4 Cortex tools
  - Realistic OHLCV data, volume profiles, anomaly detections, historical market search
  - Drop-in replacement for live CortexToolExecutor

- **Trial runner script** (`run-trial.ts`)
  - Standalone script: hardcodes "Bad Signal" dispute
  - Runs 3 judges in parallel via Gemini (or falls back to hardcoded verdicts)
  - Computes 2-of-3 consensus
  - Outputs JSON to `output/trial-result.json` for UI consumption
  - **End-to-end trial runs successfully**:
    ```
    judge_alpha: PLAINTIFF (72%)
    judge_beta:  DEFENDANT (68%)
    judge_gamma: PLAINTIFF (81%)
    FINAL VERDICT: REFUND (2-1 majority, 77% confidence)
    ```

- **API route** (`app/api/trial/route.ts`)
  - GET endpoint reads `trial-result.json`
  - Falls back to mock data if file doesn't exist
  - Next.js builds clean with new route

### Infrastructure
- **Cortex MVP deployed** at `cortex.solder.build`
  - New `analyze_market` tool added to Cortex MCP (high-level orchestration: search → trend + volume → synthesize)
  - API key auth active (403 without key)
  - **Blocker:** Need API key to wire live Cortex into Agent Court judges

- Comprehensive README.md written for the repo

### Agency Agents Used (3 launched, work done directly due to permission issues)
Backend Architect, Senior Developer, Frontend Developer

---

## Current Status

### Completed
| Component | Status | Location |
|-----------|--------|----------|
| Escrow program | **Deployed to devnet** | `agent-court-escrow/programs/` |
| Judge orchestration | **Compiles, runs** | `agents/judge/src/` |
| Mock Cortex data | **Working** | `agents/judge/src/mock-cortex.ts` |
| Trial runner | **End-to-end working** | `agents/judge/src/run-trial.ts` |
| Courtroom UI | **Builds clean** | `app/app/court/` |
| API route | **Builds clean** | `app/app/api/trial/route.ts` |
| SendAI Skill | **Written** | `skills/agent-court/` |
| X Article drafts | **3 versions** | hackathon docs |
| BD playbook | **Complete** | hackathon docs |
| Demo scenario | **Complete** | `docs/DEMO_SCENARIO.md` |

### Remaining
| Task | Blocker | Owner |
|------|---------|-------|
| Wire live Cortex into judges | Need Cortex API key | Rick |
| Run trial with live Gemini | Need to verify GEMINI_API_KEY works | Claude |
| Record demo video | Needs working UI + trial | Rick |
| Finalize X Article | Needs demo links | Rick + Claude |
| Publish X Article + Quote RT | Must be from team's X account | Rick |
| Submit SendAI Skill PR | Optional but impresses judge @yashhsm | Rick |

### Timeline
- **Days 1-2 (Mar 17-19):** Done. Escrow deployed, judges working, UI builds, trial runs end-to-end.
- **Days 3-6 (Mar 20-23):** Wire live Cortex, run live trial with Gemini, polish UI with real data.
- **Days 7-8 (Mar 24-25):** Record demo video, finalize X Article.
- **Day 9 (Mar 26):** Publish submission (X Article + Quote RT).
- **Day 10 (Mar 27):** Deadline 14:00 UTC. Engagement blitz.

**We are ~3 days ahead of the original 10-day plan.**

---

## Deployments

| Component | URL / Address |
|-----------|--------------|
| Escrow Program (devnet) | `HQxJQWawS1ULPsZhvyVPZPhC8zqNT4KVmB7etwjj4vUv` |
| IDL Account | `424pu3vgAzaQv9eq3gxTdRQbFioXKYRX6c8jonjtxtaP` |
| Cortex MVP | `https://cortex.solder.build` (API key required) |
| Explorer | [Solana Explorer](https://explorer.solana.com/address/HQxJQWawS1ULPsZhvyVPZPhC8zqNT4KVmB7etwjj4vUv?cluster=devnet) |

---

## Key Technical Decisions

1. **Single submission > 3 mediocre ones** — Talent show rewards one jaw-dropping demo
2. **Agent Court over Agent Darwinism** — COLONYS already shipped Darwinism; Court has no competitor on Solana
3. **Mock Cortex first, swap live later** — Unblocked development without waiting for Cortex deployment
4. **Hardcoded fallback verdicts** — Trial runs even without Gemini API key (offline mode)
5. **Escrow judge authority is open** — Any signer can render verdict (hackathon shortcut; production needs governance PDA)
6. **TypeScript cast for MockCortexToolExecutor** — Same interface as CortexToolExecutor, `as any` cast to satisfy type checker
