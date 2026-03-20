// =============================================================================
// Agent Court — Consensus & Voting Logic
// =============================================================================
//
// Implements 2-of-3 majority voting. Handles edge cases:
// - All three agree: unanimous verdict
// - Two agree, one dissents: majority verdict
// - All three disagree (REFUND/RELEASE/SPLIT): weighted by confidence score
// - Split ratio averaging when multiple judges vote SPLIT
// =============================================================================

import type { JudgeVerdict, FinalVerdict, VerdictOutcome } from "./types.js";

/**
 * Compute the final verdict from 3 independent judge verdicts using 2-of-3 majority.
 *
 * Tiebreaking rules (all 3 different verdicts):
 * 1. Sum confidence scores by verdict type
 * 2. Highest cumulative confidence wins
 * 3. If still tied (extremely unlikely): SPLIT 50/50 as the safest default
 */
export function computeConsensus(
  disputeId: string,
  verdicts: [JudgeVerdict, JudgeVerdict, JudgeVerdict],
): FinalVerdict {
  if (verdicts.length !== 3) {
    throw new Error(`Expected exactly 3 verdicts, got ${verdicts.length}`);
  }

  // Count votes by outcome
  const voteCounts = new Map<VerdictOutcome, JudgeVerdict[]>();
  for (const v of verdicts) {
    const existing = voteCounts.get(v.verdict) ?? [];
    existing.push(v);
    voteCounts.set(v.verdict, existing);
  }

  let winningOutcome: VerdictOutcome;
  let majorityJudges: string[];
  let dissentingJudge: string | null;

  // --- Case 1: Unanimous (3-0) ---
  if (voteCounts.size === 1) {
    winningOutcome = verdicts[0].verdict;
    majorityJudges = verdicts.map((v) => v.judge_id);
    dissentingJudge = null;
  }
  // --- Case 2: Clear majority (2-1) ---
  else if (voteCounts.size === 2) {
    // Find the verdict with 2+ votes
    let majorityVerdict: VerdictOutcome | null = null;
    let majorityVerdicts: JudgeVerdict[] = [];
    let dissentVerdict: JudgeVerdict | null = null;

    for (const [outcome, judges] of voteCounts) {
      if (judges.length >= 2) {
        majorityVerdict = outcome;
        majorityVerdicts = judges;
      } else {
        dissentVerdict = judges[0];
      }
    }

    winningOutcome = majorityVerdict!;
    majorityJudges = majorityVerdicts.map((v) => v.judge_id);
    dissentingJudge = dissentVerdict?.judge_id ?? null;
  }
  // --- Case 3: Three-way split (1-1-1) — tiebreak by confidence ---
  else {
    const confidenceByOutcome = new Map<VerdictOutcome, number>();
    for (const v of verdicts) {
      confidenceByOutcome.set(
        v.verdict,
        (confidenceByOutcome.get(v.verdict) ?? 0) + v.confidence,
      );
    }

    // Sort by confidence, highest first
    const sorted = [...confidenceByOutcome.entries()].sort(
      (a, b) => b[1] - a[1],
    );

    if (sorted[0][1] === sorted[1][1]) {
      // Tied confidence — default to SPLIT as safest option
      winningOutcome = "SPLIT";
    } else {
      winningOutcome = sorted[0][0];
    }

    // In a 3-way split, the "majority" is just the winner; the other two dissent
    const winner = verdicts.find((v) => v.verdict === winningOutcome);
    majorityJudges = winner ? [winner.judge_id] : [];
    dissentingJudge = null; // Multiple dissenters, not a single one
  }

  // --- Compute split ratio ---
  let splitRatio: [number, number] | undefined;
  if (winningOutcome === "SPLIT") {
    splitRatio = computeSplitRatio(verdicts, winningOutcome);
  }

  // --- Compute average confidence ---
  const majorityVerdicts = verdicts.filter((v) => v.verdict === winningOutcome);
  const averageConfidence =
    majorityVerdicts.length > 0
      ? majorityVerdicts.reduce((sum, v) => sum + v.confidence, 0) /
        majorityVerdicts.length
      : verdicts.reduce((sum, v) => sum + v.confidence, 0) / verdicts.length;

  return {
    dispute_id: disputeId,
    outcome: winningOutcome,
    majority_judges: majorityJudges,
    dissenting_judge: dissentingJudge,
    individual_verdicts: verdicts,
    average_confidence: Math.round(averageConfidence * 1000) / 1000,
    ...(splitRatio ? { split_ratio: splitRatio } : {}),
    timestamp: Date.now(),
  };
}

/**
 * Compute the final split ratio by confidence-weighted averaging of all
 * judges who voted SPLIT. If no judges voted SPLIT (3-way tiebreak defaulted
 * to SPLIT), use 50/50.
 */
function computeSplitRatio(
  verdicts: JudgeVerdict[],
  _outcome: VerdictOutcome,
): [number, number] {
  const splitVerdicts = verdicts.filter(
    (v) => v.verdict === "SPLIT" && v.split_ratio,
  );

  if (splitVerdicts.length === 0) {
    return [0.5, 0.5];
  }

  // Confidence-weighted average
  let totalWeight = 0;
  let weightedPlaintiff = 0;

  for (const v of splitVerdicts) {
    const [pShare] = v.split_ratio!;
    weightedPlaintiff += pShare * v.confidence;
    totalWeight += v.confidence;
  }

  if (totalWeight === 0) {
    return [0.5, 0.5];
  }

  const plaintiffShare =
    Math.round((weightedPlaintiff / totalWeight) * 100) / 100;
  const defendantShare = Math.round((1 - plaintiffShare) * 100) / 100;

  return [plaintiffShare, defendantShare];
}

/**
 * Validate that a final verdict is self-consistent.
 * Used as a sanity check before executing on-chain.
 */
export function validateFinalVerdict(verdict: FinalVerdict): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!["REFUND", "RELEASE", "SPLIT"].includes(verdict.outcome)) {
    errors.push(`Invalid outcome: ${verdict.outcome}`);
  }

  if (verdict.individual_verdicts.length !== 3) {
    errors.push(
      `Expected 3 individual verdicts, got ${verdict.individual_verdicts.length}`,
    );
  }

  if (verdict.average_confidence < 0 || verdict.average_confidence > 1) {
    errors.push(
      `Confidence out of range: ${verdict.average_confidence}`,
    );
  }

  if (verdict.outcome === "SPLIT") {
    if (!verdict.split_ratio) {
      errors.push("SPLIT verdict missing split_ratio");
    } else {
      const [a, b] = verdict.split_ratio;
      const sum = Math.round((a + b) * 100) / 100;
      if (sum !== 1) {
        errors.push(`Split ratio doesn't sum to 1: ${a} + ${b} = ${sum}`);
      }
      if (a < 0 || a > 1 || b < 0 || b > 1) {
        errors.push(`Split ratio values out of [0,1] range: [${a}, ${b}]`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
