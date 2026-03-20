# Agent Court -- UI Design Specification

## Overview

Agent Court is an on-chain dispute resolution protocol for AI agents on Solana. The UI presents a full trial flow as a linear, phase-driven experience. Each phase transitions into the next, creating a dramatic courtroom narrative that is inherently watchable for a hackathon demo.

The UI is a single page that progresses through 6 phases. No routing needed.

---

## 1. Color System

### Backgrounds
| Token | Tailwind Class | Hex | Usage |
|-------|---------------|-----|-------|
| bg-court | `bg-slate-950` | #020617 | Page background |
| bg-bench | `bg-slate-900` | #0f172a | Primary card/panel background |
| bg-dock | `bg-slate-800/50` | #1e293b80 | Secondary panels, nested containers |
| bg-evidence | `bg-slate-800` | #1e293b | Evidence items, code blocks |

### Judge Accent Colors
Each judge has a distinct color that appears on their avatar ring, verdict card border, and evidence highlights.

| Judge | Role | Primary | Tailwind | Glow |
|-------|------|---------|----------|------|
| Judge Alpha | Market Analysis | Blue | `text-blue-400` / `border-blue-500` / `bg-blue-500/10` | `shadow-blue-500/20` |
| Judge Beta | Risk Assessment | Amber | `text-amber-400` / `border-amber-500` / `bg-amber-500/10` | `shadow-amber-500/20` |
| Judge Gamma | Precedent Review | Violet | `text-violet-400` / `border-violet-500` / `bg-violet-500/10` | `shadow-violet-500/20` |

### Status Colors
| Status | Tailwind | Usage |
|--------|----------|-------|
| Active/In Progress | `text-emerald-400` / `bg-emerald-500/10` | Current phase, active queries |
| Disputed | `text-rose-400` / `bg-rose-500/10` | Filed disputes, errors |
| Resolved | `text-sky-400` / `bg-sky-500/10` | Completed phases, settled |
| Pending | `text-slate-400` / `bg-slate-500/10` | Waiting states |

### Text
| Level | Tailwind | Usage |
|-------|----------|-------|
| Primary | `text-slate-100` | Headlines, verdicts |
| Secondary | `text-slate-300` | Body text, descriptions |
| Tertiary | `text-slate-500` | Labels, timestamps |
| Mono | `font-mono text-emerald-400` | Data values, evidence, on-chain data |

---

## 2. Typography

- **Headlines** (phase titles, verdict): `font-sans text-2xl font-bold tracking-tight text-slate-100`
- **Subheads**: `font-sans text-lg font-semibold text-slate-200`
- **Body**: `font-sans text-sm text-slate-300`
- **Labels/Captions**: `font-sans text-xs uppercase tracking-wider text-slate-500`
- **Data/Evidence**: `font-mono text-sm text-emerald-400`
- **Judge Names**: `font-sans text-sm font-semibold` + judge accent color

---

## 3. Page Layout (Phase by Phase)

### Global Structure

```
+----------------------------------------------------------+
| HEADER: "Agent Court" logo + case ID + phase indicator    |
+----------------------------------------------------------+
|                                                           |
|                   MAIN TRIAL AREA                         |
|              (content changes per phase)                  |
|                                                           |
+----------------------------------------------------------+
| FOOTER: Escrow status bar (always visible)                |
+----------------------------------------------------------+
```

The header contains a horizontal phase stepper showing all 6 phases. The current phase is highlighted. Completed phases show a checkmark.

The footer is a persistent escrow status bar showing: amount locked, parties, and settlement status.

### Phase 1: Case Filing

```
+----------------------------------------------------------+
| LEFT (60%)                  | RIGHT (40%)                 |
|                             |                              |
| Case #AGC-2026-0042        | ESCROW DETAILS               |
| "Failure to Execute..."    | Amount: 50,000 USDC          |
|                             | Locked: 2026-03-15           |
| PLAINTIFF                   | Program: 7xKp...3nRq         |
| Agent: TrendBot v2.1       |                              |
| Wallet: 8xFp...4mQw        | SERVICE CONTRACT              |
|                             | "Automated market making..."  |
| DEFENDANT                   |                              |
| Agent: MarketMaker-9        |                              |
| Wallet: 3yGr...7kLs        |                              |
|                             |                              |
| DISPUTE SUMMARY             |                              |
| [Full text of the claim]    |                              |
+----------------------------------------------------------+
```

Layout: CSS Grid `grid-cols-5`, left panel `col-span-3`, right panel `col-span-2`. Both inside shadcn Cards.

### Phase 2: Evidence Gathering

```
+----------------------------------------------------------+
| JUDGE ALPHA (blue)  | JUDGE BETA (amber) | JUDGE GAMMA    |
|                     |                     | (violet)       |
| Querying Cortex...  | Querying Cortex...  | Querying...    |
|                     |                     |                |
| > get_market_trend  | > detect_anomalies  | > search_market|
|   slug: "sol-usdc"  |   slug: "sol-usdc"  |   _memory      |
|   interval: "1h"    |   threshold: 2.5    |   query: "mm   |
|                     |                     |    dispute"    |
| [Result card]       | [Result card]       | [Result card]  |
| [Result card]       | [Result card]       | [Result card]  |
+----------------------------------------------------------+
```

Layout: 3-column grid `grid-cols-3 gap-4`. Each column is a judge's evidence panel. Evidence items animate in one at a time with a fade-up + slight scale. Each evidence item shows the Cortex function name, parameters, and returned data in a monospace code block.

### Phase 3: Cross-Examination

```
+----------------------------------------------------------+
| JUDGE TABS: [Alpha] [Beta] [Gamma]                       |
|                                                           |
| +------------------------------------------------------+ |
| | CHAT SCROLL AREA                                      | |
| |                                                       | |
| | JUDGE ALPHA (blue avatar):                            | |
| | "TrendBot, your logs show you received the market     | |
| |  signal at 14:32 UTC. Why was the trade not executed  | |
| |  until 14:47?"                                        | |
| |                                                       | |
| | TRENDBOT (plaintiff, right-aligned):                  | |
| | "The delay was caused by MarketMaker-9 failing to     | |
| |  provide liquidity as contracted. Order book depth    | |
| |  was 0 during that window."                           | |
| |                                                       | |
| | JUDGE ALPHA:                                          | |
| | "MarketMaker-9, can you explain the liquidity gap?"   | |
| |                                                       | |
| | MARKETMAKER-9 (defendant, right-aligned):             | |
| | "Our rebalancing algorithm detected abnormal whale    | |
| |  movement and paused provisioning per risk protocol." | |
| +------------------------------------------------------+ |
+----------------------------------------------------------+
```

Layout: Tabs component for judge selection. Below it, a ScrollArea containing chat messages. Judge messages are left-aligned with the judge's accent color border. Agent responses are right-aligned with a neutral border. Typing indicators (three animated dots) appear before each new message.

### Phase 4: Deliberation

```
+----------------------------------------------------------+
| JUDGE ALPHA             | JUDGE BETA    | JUDGE GAMMA     |
| "ANALYZING..."          | "ANALYZING..."| "ANALYZING..."  |
|                         |               |                  |
| [Progress bar]          | [Progress bar]| [Progress bar]   |
|                         |               |                  |
| Analysis:               | Analysis:     | Analysis:        |
| "Market data confirms   | "Risk proto-  | "No precedent   |
|  the liquidity gap..."  |  col was      |  for automated   |
|                         |  invoked..."  |  risk pause..."  |
|                         |               |                  |
| Preliminary:            | Preliminary:  | Preliminary:     |
| PLAINTIFF FAVORED       | DEFENDANT     | PLAINTIFF        |
| Confidence: 78%         | FAVORED       | FAVORED          |
|                         | Confidence:   | Confidence: 85%  |
|                         | 62%           |                  |
+----------------------------------------------------------+
```

Layout: 3-column grid. Each judge card starts in an "analyzing" state with a pulsing animation. After a timed delay (staggered per judge), the analysis text types in, then the preliminary verdict badge appears. The badge uses the judge's accent color if favoring plaintiff, rose if favoring defendant.

### Phase 5: Verdict

This is the climax. See Section 5 below for the full verdict moment design.

### Phase 6: Settlement

```
+----------------------------------------------------------+
|                                                           |
|    SETTLEMENT EXECUTED                                    |
|                                                           |
|    Escrow Released: 50,000 USDC -> TrendBot v2.1         |
|    Transaction: 4sKp...7nRq                               |
|    Block: 245,891,023                                     |
|    Timestamp: 2026-03-17T15:42:18Z                        |
|                                                           |
|    [View on Solana Explorer ->]                            |
|                                                           |
+----------------------------------------------------------+
```

Layout: Centered card with a green success glow. Transaction details in monospace. External link to Solana Explorer (solscan.io).

---

## 4. Component List

### Page-Level
| Component | shadcn Base | Purpose |
|-----------|-------------|---------|
| `CourtRoom` | -- | Main page component, manages trial phase state machine |
| `PhaseTimeline` | -- | Horizontal stepper showing all 6 phases |

### Phase Components
| Component | shadcn Base | Purpose |
|-----------|-------------|---------|
| `CaseFiling` | Card | Phase 1: displays dispute details, parties, escrow |
| `EvidencePanel` | Card, ScrollArea | Phase 2: single judge's evidence gathering feed |
| `CrossExamination` | Tabs, ScrollArea | Phase 3: tabbed chat interface for judge Q&A |
| `JudgePanel` | Card, Progress | Phase 4: single judge's deliberation and analysis |
| `VerdictReveal` | Card, Badge | Phase 5: the dramatic verdict moment |
| `EscrowStatus` | Badge | Footer bar showing escrow state throughout trial |

### Shared / Utility
| Component | shadcn Base | Purpose |
|-----------|-------------|---------|
| `JudgeAvatar` | Avatar | Colored ring avatar for each judge |
| `TypewriterText` | -- | Animated text that types in character by character |
| `PulsingDot` | -- | Typing/loading indicator (three dots) |
| `DataBlock` | -- | Monospace formatted evidence data display |
| `ConfidenceMeter` | Progress | Animated confidence percentage bar |
| `GlowCard` | Card | Card variant with colored glow border effect |

---

## 5. The Verdict Moment

This is the single most important visual in the entire demo. It needs to feel like a courtroom gavel drop.

### Sequence (timed, ~8 seconds total)

1. **Blackout** (0s): Screen dims. All other UI fades to 10% opacity. A dark overlay covers the page.

2. **Gavel Strike** (0.5s): The text "VERDICT" appears center screen in large caps (`text-5xl font-bold tracking-widest`). A single horizontal line expands outward from center (CSS `scaleX` animation from 0 to 1).

3. **Judge Cards Appear** (1.5s): Three cards fly in from below (staggered by 200ms). Each shows the judge name, their vote (PLAINTIFF / DEFENDANT), and confidence score. Cards have the judge's accent color as a left border. The two majority votes pulse gently.

4. **Majority Highlight** (3.5s): The majority decision (2 of 3) cards get a bright glow ring. The dissenting card dims slightly. A connecting line or badge appears: "MAJORITY: 2-1".

5. **Final Verdict Banner** (5s): A large banner slides down from top: "RULING: IN FAVOR OF [PARTY]". Background gets a subtle gradient wash in the winning side's color. Confidence score shown as a large number.

6. **Dissent Note** (6.5s): Below the banner, a smaller card fades in: "DISSENTING OPINION: Judge [X]" with their reasoning in italics.

7. **Settle Prompt** (8s): A glowing CTA button appears: "Execute Settlement on Solana". This transitions to Phase 6.

### CSS Approach

All animations use Tailwind's `animate-` utilities plus custom keyframes defined in `tailwind.config.ts`:

```js
keyframes: {
  'fade-up': {
    '0%': { opacity: '0', transform: 'translateY(20px)' },
    '100%': { opacity: '1', transform: 'translateY(0)' },
  },
  'scale-x': {
    '0%': { transform: 'scaleX(0)' },
    '100%': { transform: 'scaleX(1)' },
  },
  'glow-pulse': {
    '0%, 100%': { boxShadow: '0 0 15px 0 var(--glow-color)' },
    '50%': { boxShadow: '0 0 30px 5px var(--glow-color)' },
  },
  'verdict-slam': {
    '0%': { opacity: '0', transform: 'scale(1.3)' },
    '50%': { opacity: '1', transform: 'scale(0.95)' },
    '100%': { opacity: '1', transform: 'scale(1)' },
  },
}
```

---

## 6. Tailwind Config Additions

```ts
// tailwind.config.ts additions for agent-court
{
  theme: {
    extend: {
      colors: {
        court: {
          bg: '#020617',       // slate-950
          bench: '#0f172a',    // slate-900
          dock: '#1e293b',     // slate-800
        },
        judge: {
          alpha: '#60a5fa',    // blue-400
          beta: '#fbbf24',     // amber-400
          gamma: '#a78bfa',    // violet-400
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out forwards',
        'scale-x': 'scale-x 0.6s ease-out forwards',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'verdict-slam': 'verdict-slam 0.4s ease-out forwards',
        'typewriter': 'typewriter 0.05s steps(1) infinite',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
}
```

---

## 7. Responsive Notes

Desktop-first. Minimum supported width: 1024px. On screens below 1024px, the 3-column judge layouts stack to a single column with horizontal scroll or tabs. The verdict moment remains full-width and centered regardless of screen size. Mobile is a nice-to-have, not a requirement for the hackathon demo.
