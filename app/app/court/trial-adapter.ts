// Agent Court — Adapter: real trial-result.json → UI types
// The real API response (source: "live") has a different shape than the UI
// expects. This module converts it, falling back to mock data for fields that
// are not present in the real output (evidence, cross-examination, settlement).

import type {
  CaseData,
  EvidenceItem,
  ChatMessage,
  JudgeDeliberation,
  Verdict,
  Settlement,
  JudgeId,
  VoteTarget,
} from "./types";
import {
  MOCK_CASE,
  MOCK_EVIDENCE,
  MOCK_CROSS_EXAMINATION,
  MOCK_VERDICT,
  MOCK_SETTLEMENT,
} from "./mock-data";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** "judge_alpha" → "alpha" */
function stripJudgePrefix(raw: string): JudgeId {
  const id = raw.replace(/^judge_/, "");
  if (id === "alpha" || id === "beta" || id === "gamma") return id;
  // Unexpected value — return alpha as safe default
  return "alpha";
}

/** "REFUND" → "plaintiff", "RELEASE" → "defendant" */
function mapVerdict(raw: string): VoteTarget {
  return raw.toUpperCase() === "REFUND" ? "plaintiff" : "defendant";
}

// ---------------------------------------------------------------------------
// API response type (loose, only what we care about)
// ---------------------------------------------------------------------------

interface RealDisputeParty {
  agent_id: string;
  wallet: string;
  role: string;
  claim?: string;
  evidence?: string[];
}

interface RealDispute {
  id: string;
  escrow_address: string;
  escrow_amount_lamports: string;
  token_mint?: string;
  plaintiff: RealDisputeParty;
  defendant: RealDisputeParty;
  service_description?: string;
  filed_at?: number;
  delivery_window_start?: number;
  delivery_window_end?: number;
}

interface RealJudgeVerdict {
  judge_id: string;
  verdict: string;
  confidence: number;
  reasoning: string;
  evidence_cited?: string[];
}

interface RealFinalVerdict {
  dispute_id: string;
  outcome: string;
  majority_judges: string[];
  dissenting_judge: string;
  individual_verdicts: RealJudgeVerdict[];
  average_confidence: number;
  timestamp: number;
  execution_tx: string | null;
}

export interface RealTrialResult {
  source: "live" | "mock";
  case_id?: string;
  dispute?: RealDispute;
  verdicts?: RealJudgeVerdict[];
  final_verdict?: RealFinalVerdict;
  generated_at?: string;
}

// ---------------------------------------------------------------------------
// Public adapter
// ---------------------------------------------------------------------------

export interface AdaptedTrialData {
  caseData: CaseData;
  evidence: EvidenceItem[];
  crossExamination: ChatMessage[];
  deliberations: JudgeDeliberation[];
  verdict: Verdict;
  settlement: Settlement;
}

export function adaptTrialResult(raw: RealTrialResult): AdaptedTrialData {
  // If source is mock or required fields are missing, return mock data as-is
  if (
    raw.source !== "live" ||
    !raw.dispute ||
    !raw.final_verdict ||
    !raw.verdicts
  ) {
    return {
      caseData: MOCK_CASE,
      evidence: MOCK_EVIDENCE,
      crossExamination: MOCK_CROSS_EXAMINATION,
      deliberations: MOCK_VERDICT.deliberations,
      verdict: MOCK_VERDICT,
      settlement: MOCK_SETTLEMENT,
    };
  }

  const d = raw.dispute;
  const fv = raw.final_verdict;

  // --- CaseData ---
  const escrowLamports = parseInt(d.escrow_amount_lamports ?? "0", 10);
  // Lamports to USDC: assume token is USDC (6 decimals) unless we detect SOL
  const isUsdc =
    !d.token_mint ||
    d.token_mint === "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  const escrowAmount = isUsdc ? escrowLamports / 1_000_000 : escrowLamports / 1e9;
  const escrowToken = isUsdc ? "USDC" : "SOL";

  const caseData: CaseData = {
    id: d.id ?? raw.case_id ?? MOCK_CASE.id,
    title: d.service_description ?? MOCK_CASE.title,
    summary:
      [d.plaintiff.claim, d.defendant.claim].filter(Boolean).join(" | ") ||
      MOCK_CASE.summary,
    plaintiff: {
      role: "plaintiff",
      agentName: d.plaintiff.agent_id,
      wallet: d.plaintiff.wallet,
    },
    defendant: {
      role: "defendant",
      agentName: d.defendant.agent_id,
      wallet: d.defendant.wallet,
    },
    escrow: {
      amount: escrowAmount,
      token: escrowToken,
      lockedAt: d.delivery_window_start
        ? new Date(d.delivery_window_start).toISOString()
        : MOCK_CASE.escrow.lockedAt,
      programId: d.escrow_address,
    },
    serviceContract: d.service_description ?? MOCK_CASE.serviceContract,
    filedAt: d.filed_at
      ? new Date(d.filed_at).toISOString()
      : MOCK_CASE.filedAt,
  };

  // --- Deliberations (from individual_verdicts) ---
  const deliberations: JudgeDeliberation[] = fv.individual_verdicts.map(
    (v) => ({
      judgeId: stripJudgePrefix(v.judge_id),
      analysis: v.reasoning,
      vote: mapVerdict(v.verdict),
      confidence: Math.round(v.confidence * 100),
      reasoning: (v.evidence_cited ?? []).join("; ") || v.reasoning,
    })
  );

  // --- Verdict ---
  const majorityJudges = fv.majority_judges.map(stripJudgePrefix);
  const dissentingJudge = stripJudgePrefix(fv.dissenting_judge);
  const dissentVerdict = fv.individual_verdicts.find(
    (v) => stripJudgePrefix(v.judge_id) === dissentingJudge
  );

  const verdict: Verdict = {
    majority: mapVerdict(fv.outcome),
    majorityJudges,
    dissentingJudge,
    dissentReasoning: dissentVerdict?.reasoning ?? MOCK_VERDICT.dissentReasoning,
    overallConfidence: Math.round(fv.average_confidence * 100),
    deliberations,
  };

  // --- Settlement: build from real data where possible ---
  const winnerParty =
    verdict.majority === "plaintiff" ? caseData.plaintiff : caseData.defendant;
  const settlement: Settlement = {
    txSignature: fv.execution_tx ?? MOCK_SETTLEMENT.txSignature,
    block: MOCK_SETTLEMENT.block,
    timestamp: fv.timestamp
      ? new Date(fv.timestamp).toISOString()
      : MOCK_SETTLEMENT.timestamp,
    recipient: winnerParty,
    amount: escrowAmount,
    token: escrowToken,
  };

  // --- Evidence: derived from each judge's evidence_cited array ---
  const evidence: EvidenceItem[] = [];
  const judgeLetterMap: Record<string, string> = {
    alpha: "a",
    beta: "b",
    gamma: "g",
  };
  // Base timestamps spaced 6 seconds apart starting from a fixed review time
  const evidenceBaseMs = new Date("2026-03-20T15:00:00Z").getTime();
  let evidenceSeq = 0;

  for (const jv of fv.individual_verdicts) {
    const judgeId = stripJudgePrefix(jv.judge_id);
    const letter = judgeLetterMap[judgeId] ?? judgeId[0];
    let itemIdx = 1;

    for (const cited of jv.evidence_cited ?? []) {
      const colonPos = cited.indexOf(":");
      let cortexFunction: string;
      let resultDesc: string;

      if (colonPos !== -1) {
        // e.g. "get_market_trend: 1h OHLCV shows price already rising before signal"
        cortexFunction = cited.slice(0, colonPos).trim().replace(/\s+\S+$/, "");
        // Strip any trailing qualifiers in the function name (e.g. "get_market_trend 4h")
        cortexFunction = cortexFunction.split(/\s/)[0];
        resultDesc = cited.slice(colonPos + 1).trim();
      } else {
        // No colon — plain observation (e.g. "OHLCV peak at $0.61 — below $0.65 target")
        cortexFunction = "observation";
        resultDesc = cited.trim();
      }

      // Build minimal params from the raw string where recognisable
      const params: Record<string, string | number> = {};
      if (cited.toLowerCase().includes("will-eth-etf")) {
        params.slug = "will-eth-etf-approved-june";
      } else if (cited.toLowerCase().includes("will-eth-etf-approved-may")) {
        params.slug = "will-eth-etf-approved-may";
      }
      if (cited.includes("1h")) params.interval = "1h";
      else if (cited.includes("4h")) params.interval = "4h";

      const ts = new Date(evidenceBaseMs + evidenceSeq * 6000).toISOString();
      evidence.push({
        id: `ev-${letter}${itemIdx}`,
        judgeId,
        cortexFunction,
        params,
        result: resultDesc,
        timestamp: ts,
      });

      itemIdx++;
      evidenceSeq++;
    }
  }

  // --- Cross-examination: 3-round dialogue grounded in real claim/evidence text ---
  const plaintiffName = d.plaintiff.agent_id;  // "SentimentTrader"
  const defendantName = d.defendant.agent_id;  // "AlphaOracle"
  const plaintiffEvidence = d.plaintiff.evidence ?? [];
  const defendantEvidence = d.defendant.evidence ?? [];

  const crossExamination: ChatMessage[] = [
    // ── Round 1: Judge Alpha questions both parties ──────────────────────────
    {
      id: "cx-1",
      speaker: "alpha",
      speakerName: "Judge Alpha",
      text: `${plaintiffName}, your claim states the signal was issued after the price move had already started. Walk me through what you observed at the time of signal receipt.`,
      round: 1,
    },
    {
      id: "cx-2",
      speaker: "plaintiff",
      speakerName: plaintiffName,
      text: `${plaintiffEvidence[0] ?? ""}. ${plaintiffEvidence[2] ?? ""}. The 1h OHLCV data confirms the market was already moving when the signal arrived — entering at $0.58 instead of the stated $0.42 was a direct consequence of that delay.`,
      round: 1,
    },
    {
      id: "cx-3",
      speaker: "alpha",
      speakerName: "Judge Alpha",
      text: `${defendantName}, the market trend data shows price was already rising before your signal was issued. How do you explain the timing?`,
      round: 1,
    },
    {
      id: "cx-4",
      speaker: "defendant",
      speakerName: defendantName,
      text: `${defendantEvidence[0] ?? ""}. ${defendantEvidence[1] ?? ""}. The anomaly detector confirms the first irregularity appeared at 14:22 UTC — 22 minutes after my signal. The signal preceded the spike.`,
      round: 1,
    },

    // ── Round 2: Judge Beta questions on entry price deviation ───────────────
    {
      id: "cx-5",
      speaker: "beta",
      speakerName: "Judge Beta",
      text: `${defendantName}, the signal specified entry at $0.42. ${plaintiffName} entered at $0.58 — a 38% deviation. Did your service include any mechanism to warn buyers when the entry price was no longer valid?`,
      round: 2,
    },
    {
      id: "cx-6",
      speaker: "defendant",
      speakerName: defendantName,
      text: `${defendantEvidence[2] ?? ""}. My service delivers the signal; execution timing is the buyer's responsibility. There is no industry standard requiring a signal provider to gate entry after price has moved.`,
      round: 2,
    },
    {
      id: "cx-7",
      speaker: "beta",
      speakerName: "Judge Beta",
      text: `${plaintiffName}, did you have any safeguard in place to reject or flag the trade when the live price deviated significantly from the signal's stated entry?`,
      round: 2,
    },
    {
      id: "cx-8",
      speaker: "plaintiff",
      speakerName: plaintiffName,
      text: `${plaintiffEvidence[3] ?? ""}. I did not have a price-deviation safeguard at the time. However, the service was sold as a complete signal — entry, target, and timeframe. If the entry was no longer actionable, that constitutes a failure of the signal itself.`,
      round: 2,
    },

    // ── Round 3: Judge Gamma questions on ETF market precedent ───────────────
    {
      id: "cx-9",
      speaker: "gamma",
      speakerName: "Judge Gamma",
      text: `${defendantName}, historical data shows ETF approval prediction markets exhibit 20–30 cent swings in their final weeks. You issued a fixed-target 24-hour signal on this market type with no volatility disclaimer. Are you aware of the precedent regarding standard of care for paid signal services?`,
      round: 3,
    },
    {
      id: "cx-10",
      speaker: "defendant",
      speakerName: defendantName,
      text: `The reversal was caused by an external news event 12 hours after the signal — unforeseeable by any analytical model. ${defendantEvidence[3] ?? ""}. My signal's directional call was correct; the market moved exactly as predicted before the external shock.`,
      round: 3,
    },
    {
      id: "cx-11",
      speaker: "gamma",
      speakerName: "Judge Gamma",
      text: `${plaintiffName}, the search_market_memory tool retrieved three historical ETF markets — all showed 20–30 cent swings as a normal feature of the market type. Does that historical volatility change your assessment of the risk you accepted?`,
      round: 3,
    },
    {
      id: "cx-12",
      speaker: "plaintiff",
      speakerName: plaintiffName,
      text: `${plaintiffEvidence[1] ?? ""}. The service agreement defines success as the target being reached within the stated window. The target of $0.65 was not reached. Structural volatility in this market type is precisely why a paid signal service has a higher duty of care — not a lower one.`,
      round: 3,
    },
  ];

  return {
    caseData,
    evidence,
    crossExamination,
    deliberations,
    verdict,
    settlement,
  };
}
