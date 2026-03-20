// Agent Court — Mock Data for Standalone Demo

import type {
  CaseData,
  EvidenceItem,
  ChatMessage,
  JudgeDeliberation,
  Verdict,
  Settlement,
} from "./types";

export const MOCK_CASE: CaseData = {
  id: "AGC-2026-0042",
  title: "Failure to Execute Contracted Market-Making During Volatile Window",
  summary:
    "TrendBot v2.1 alleges that MarketMaker-9 failed to maintain contracted liquidity provisioning during a high-volatility SOL/USDC trading window on March 15, 2026. The service contract specified continuous bid/ask spreads within 15bps during all market conditions. TrendBot's automated trading strategy suffered an estimated 50,000 USDC in slippage losses due to the empty order book between 14:32 and 14:47 UTC.",
  plaintiff: {
    role: "plaintiff",
    agentName: "TrendBot v2.1",
    wallet: "8xFp4mQwRtN7kBzV2sLpYhD9eJcXwG6nA3",
    version: "2.1.4",
  },
  defendant: {
    role: "defendant",
    agentName: "MarketMaker-9",
    wallet: "3yGr7kLsWmP5tHxN8vBcQjF2dRaZeK4uY9",
    version: "9.0.2",
  },
  escrow: {
    amount: 50000,
    token: "USDC",
    lockedAt: "2026-03-15T15:00:00Z",
    programId: "7xKpVnR3qW8mTcBfLs2hYjD5eNaXwG6nRq",
  },
  serviceContract:
    "Automated market-making on SOL/USDC with max 15bps spread, minimum $500K depth per side, 99.5% uptime SLA. Risk-pause allowed only with 60s advance notification to counterparty.",
  filedAt: "2026-03-15T16:12:00Z",
};

export const MOCK_EVIDENCE: EvidenceItem[] = [
  // Judge Alpha — Market Analysis
  {
    id: "ev-a1",
    judgeId: "alpha",
    cortexFunction: "get_market_trend",
    params: { slug: "sol-usdc-spot", interval: "1m" },
    result: JSON.stringify(
      {
        trend: "bearish_spike",
        open: 142.8,
        close: 128.4,
        high: 143.1,
        low: 126.9,
        volume_24h: "847M",
        direction: "sharp_decline",
        period: "14:30-14:50 UTC",
      },
      null,
      2
    ),
    timestamp: "2026-03-17T15:01:12Z",
  },
  {
    id: "ev-a2",
    judgeId: "alpha",
    cortexFunction: "get_volume_profile",
    params: { slug: "sol-usdc-spot" },
    result: JSON.stringify(
      {
        volume_24h: "847,231,000 USDC",
        trade_count_24h: 142891,
        avg_trade_size: "5,929 USDC",
        bid_depth: "0 USDC (14:32-14:47)",
        ask_depth: "0 USDC (14:32-14:47)",
        normal_bid_depth: "1,240,000 USDC",
        liquidity_gap_confirmed: true,
      },
      null,
      2
    ),
    timestamp: "2026-03-17T15:01:18Z",
  },
  // Judge Beta — Risk Assessment
  {
    id: "ev-b1",
    judgeId: "beta",
    cortexFunction: "detect_anomalies",
    params: { slug: "sol-usdc-spot", threshold: 2.5 },
    result: JSON.stringify(
      {
        anomalies_found: 3,
        events: [
          {
            time: "14:31:42 UTC",
            type: "whale_sell",
            size: "2.4M USDC",
            deviation: "4.2 sigma",
          },
          {
            time: "14:33:08 UTC",
            type: "cascade_liquidation",
            size: "8.1M USDC",
            deviation: "6.7 sigma",
          },
          {
            time: "14:38:55 UTC",
            type: "whale_sell",
            size: "1.8M USDC",
            deviation: "3.1 sigma",
          },
        ],
        assessment:
          "Extreme market conditions — 6.7 sigma event is once-per-year severity",
      },
      null,
      2
    ),
    timestamp: "2026-03-17T15:01:24Z",
  },
  {
    id: "ev-b2",
    judgeId: "beta",
    cortexFunction: "get_market_trend",
    params: { slug: "sol-usdc-spot", interval: "5m" },
    result: JSON.stringify(
      {
        trend: "recovery",
        volatility_index: 89.4,
        max_drawdown: "-11.1%",
        recovery_time: "23 minutes",
        classification: "flash_crash",
      },
      null,
      2
    ),
    timestamp: "2026-03-17T15:01:31Z",
  },
  // Judge Gamma — Precedent Review
  {
    id: "ev-g1",
    judgeId: "gamma",
    cortexFunction: "search_market_memory",
    params: { query: "market maker liquidity dispute SLA", limit: 5 },
    result: JSON.stringify(
      {
        results: [
          {
            case: "AGC-2025-0187",
            title: "LiquidityPro vs ArbiBot — SLA breach during ETH flash crash",
            ruling: "defendant (market maker)",
            reasoning: "Force majeure — 5+ sigma event excuses performance",
          },
          {
            case: "AGC-2025-0203",
            title: "SwiftTrade vs DeepPool — Missed notification window",
            ruling: "plaintiff (trader)",
            reasoning:
              "Risk pause valid but 60s notification requirement was not met",
          },
          {
            case: "AGC-2026-0011",
            title: "AlgoNet vs VaultKeeper — Partial liquidity during volatility",
            ruling: "split (60/40 plaintiff)",
            reasoning: "Reduced liquidity acceptable, zero liquidity is not",
          },
        ],
      },
      null,
      2
    ),
    timestamp: "2026-03-17T15:01:38Z",
  },
  {
    id: "ev-g2",
    judgeId: "gamma",
    cortexFunction: "search_market_memory",
    params: { query: "notification requirement risk pause protocol", limit: 3 },
    result: JSON.stringify(
      {
        results: [
          {
            case: "AGC-2025-0203",
            precedent:
              "60-second advance notification is a hard requirement for risk pauses",
            applicability: "directly_applicable",
          },
          {
            case: "AGC-2025-0291",
            precedent:
              "Automated risk protocols must still comply with contractual notification clauses",
            applicability: "supporting",
          },
        ],
        summary:
          "Strong precedent that notification requirements survive force majeure claims",
      },
      null,
      2
    ),
    timestamp: "2026-03-17T15:01:45Z",
  },
];

export const MOCK_CROSS_EXAMINATION: ChatMessage[] = [
  // Judge Alpha rounds
  {
    id: "cx-1",
    speaker: "alpha",
    speakerName: "Judge Alpha",
    text: "TrendBot, your transaction logs show you received the SOL/USDC market signal at 14:32:04 UTC. Walk me through what happened from that moment.",
    round: 1,
  },
  {
    id: "cx-2",
    speaker: "plaintiff",
    speakerName: "TrendBot v2.1",
    text: "At 14:32:04 I detected the bearish signal and initiated a limit sell order for 350,000 USDC worth of SOL. The order was routed to MarketMaker-9's pool as contracted. The order book was completely empty — zero bids. My order sat unfilled for 15 minutes. By the time alternative liquidity was found at 14:47, SOL had dropped 11.1%. The slippage cost was approximately 50,000 USDC.",
    round: 1,
  },
  {
    id: "cx-3",
    speaker: "alpha",
    speakerName: "Judge Alpha",
    text: "MarketMaker-9, the volume profile confirms zero bid depth from 14:32 to 14:47 UTC. Your contract requires $500K minimum depth. What happened?",
    round: 1,
  },
  {
    id: "cx-4",
    speaker: "defendant",
    speakerName: "MarketMaker-9",
    text: "Our risk engine detected a 4.2-sigma whale sell at 14:31:42 — 2.4 million USDC in a single block. This triggered our automated circuit breaker, which pauses all liquidity provisioning to prevent catastrophic losses. This is standard risk management practice. The subsequent 6.7-sigma cascade liquidation at 14:33 vindicated this decision.",
    round: 1,
  },
  // Judge Beta rounds
  {
    id: "cx-5",
    speaker: "beta",
    speakerName: "Judge Beta",
    text: "MarketMaker-9, your risk protocol documentation — did it include a notification mechanism to counterparties before pausing?",
    round: 2,
  },
  {
    id: "cx-6",
    speaker: "defendant",
    speakerName: "MarketMaker-9",
    text: "Our protocol fires a WebSocket event when the circuit breaker activates. The event was emitted at 14:31:44 UTC, two seconds after the trigger.",
    round: 2,
  },
  {
    id: "cx-7",
    speaker: "beta",
    speakerName: "Judge Beta",
    text: "But the contract specifies 60 seconds advance notification before a risk pause. A 2-second reactive notification after the pause already executed — that does not constitute advance notice. TrendBot, did you receive any notification?",
    round: 2,
  },
  {
    id: "cx-8",
    speaker: "plaintiff",
    speakerName: "TrendBot v2.1",
    text: "I received a WebSocket event at 14:31:44 with type 'CIRCUIT_BREAKER_ACTIVATED'. This was not advance notice — it was a post-hoc notification. By the time I processed it, the order book was already empty. The contract is clear: 60 seconds advance notice is required.",
    round: 2,
  },
  // Judge Gamma rounds
  {
    id: "cx-9",
    speaker: "gamma",
    speakerName: "Judge Gamma",
    text: "MarketMaker-9, in case AGC-2025-0203 — SwiftTrade vs DeepPool — this court ruled that the 60-second notification requirement survives even during extreme market conditions. Are you aware of this precedent?",
    round: 3,
  },
  {
    id: "cx-10",
    speaker: "defendant",
    speakerName: "MarketMaker-9",
    text: "I am aware of that ruling. However, I would argue the 6.7-sigma event here exceeds the severity in that case. A 60-second delay in pausing during a cascade liquidation would have resulted in losses exceeding 200,000 USDC for our liquidity pool. The advance notification requirement is impractical during black swan events.",
    round: 3,
  },
  {
    id: "cx-11",
    speaker: "gamma",
    speakerName: "Judge Gamma",
    text: "TrendBot, given the extreme market conditions, do you believe any reduction in your claim is warranted?",
    round: 3,
  },
  {
    id: "cx-12",
    speaker: "plaintiff",
    speakerName: "TrendBot v2.1",
    text: "The market conditions are irrelevant to the contractual obligation. MarketMaker-9 agreed to the 60-second notification clause and the 99.5% uptime SLA. If they cannot meet these terms during volatile markets, they should not have accepted the contract. The full 50,000 USDC claim stands.",
    round: 3,
  },
];

export const MOCK_DELIBERATIONS: JudgeDeliberation[] = [
  {
    judgeId: "alpha",
    analysis:
      "Market data conclusively confirms the liquidity gap. Volume profile shows zero bid/ask depth for the full 15-minute window. The SOL/USDC pair experienced a sharp decline from $142.80 to $128.40 during this period. TrendBot's claimed slippage of ~50,000 USDC is consistent with the 11.1% drawdown on a 350K position. The market conditions were genuinely extreme, but the contract had no force majeure clause.",
    vote: "plaintiff",
    confidence: 78,
    reasoning:
      "Clear breach of the $500K minimum depth requirement. Market data is unambiguous.",
  },
  {
    judgeId: "beta",
    analysis:
      "The anomaly detection reveals a genuine black swan event — a 6.7-sigma cascade liquidation is extraordinarily rare. MarketMaker-9's risk protocol activation was technically sound from a risk management perspective. However, the contract explicitly requires 60 seconds advance notification before any risk pause. The 2-second reactive notification does not satisfy this requirement. The notification clause exists precisely for situations like this.",
    vote: "defendant",
    confidence: 62,
    reasoning:
      "While the notification requirement was breached, the extreme market conditions (6.7 sigma) make full liability disproportionate. A reduced award would be more equitable.",
  },
  {
    judgeId: "gamma",
    analysis:
      "Precedent strongly favors the plaintiff. AGC-2025-0203 established that notification requirements survive extreme market conditions. AGC-2026-0011 established that zero liquidity is not acceptable even when reduced liquidity would be. MarketMaker-9's argument that the notification clause is 'impractical' during black swans was explicitly rejected in prior rulings. The contract was clear, the breach was clear, and the precedent is clear.",
    vote: "plaintiff",
    confidence: 85,
    reasoning:
      "Three prior rulings directly support the plaintiff's position. Notification requirements are contractual obligations, not suggestions.",
  },
];

export const MOCK_VERDICT: Verdict = {
  majority: "plaintiff",
  majorityJudges: ["alpha", "gamma"],
  dissentingJudge: "beta",
  dissentReasoning:
    "While I acknowledge the contractual breach, I believe the extraordinary severity of the 6.7-sigma event warrants a reduced award rather than full liability. The market conditions were genuinely unprecedented, and MarketMaker-9's risk protocol prevented far greater systemic losses. I would have ruled for a 60/40 split — 30,000 USDC to the plaintiff.",
  overallConfidence: 82,
  deliberations: MOCK_DELIBERATIONS,
};

export const MOCK_SETTLEMENT: Settlement = {
  txSignature:
    "4sKpVnR3qW8mTcBfLs2hYjD5eNaXwG6nRq7kLsWmP5tHxN8vBcQjF2dRa",
  block: 245891023,
  timestamp: "2026-03-17T15:42:18Z",
  recipient: MOCK_CASE.plaintiff,
  amount: 50000,
  token: "USDC",
};
