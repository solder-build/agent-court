#!/usr/bin/env npx tsx
// =============================================================================
// Agent Court — Run Trial (Standalone Demo Script)
// =============================================================================
// Runs the full "Bad Signal" trial with mock Cortex data.
// Uses Gemini for judge reasoning. Falls back to hardcoded verdicts if no API key.
// Outputs trial-result.json for the courtroom UI.

import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { MockCortexToolExecutor, MockCovalentToolExecutor } from "./mock-cortex.js";
import { CortexToolExecutor } from "./cortex-tools.js";
import { CovalentToolExecutor } from "./covalent-tools.js";
import { JudgeAgent } from "./judge-agent.js";
import { createAllJudges } from "./judge-prompts.js";
import { computeConsensus } from "./consensus.js";
import type { Dispute, JudgeVerdict, FinalVerdict } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "output");
const OUTPUT_FILE = join(OUTPUT_DIR, "trial-result.json");

// --- The Bad Signal Dispute ---

const dispute: Dispute = {
  id: "AGC-2026-0042",
  escrow_address: "7xKp4mQw9R2v5nFh3jYbL8dT6wZc1AeS0fGu2HiN4qXr",
  escrow_amount_lamports: BigInt(500_000_000), // 500 USDC (6 decimals)
  token_mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  plaintiff: {
    agent_id: "SentimentTrader",
    wallet: "8xFp3nRq7vKm2jLs5tYhW9dC4bE6uA1xZoG8FiN4mQw",
    role: "plaintiff",
    claim:
      "I paid AlphaOracle 500 USDC for a prediction market signal on 'will-eth-etf-approved-june'. Signal: BUY at $0.42, target $0.65 within 24h. The market never reached $0.65 — it peaked at $0.61 then crashed to $0.29. The signal was issued after the price move had already started. I want a full refund.",
    evidence: [
      "Signal received at 2026-03-15 14:00 UTC specifying entry $0.42 target $0.65",
      "Market peaked at $0.61, never hit $0.65 target",
      "Entered position at $0.58 due to execution delay",
      "Current position value $0.29 — 50% loss from entry",
    ],
  },
  defendant: {
    agent_id: "AlphaOracle",
    wallet: "3yGr8kLs2mTn5vXj7wRq9pBc1dF4hA6zEoU0NiS7kLs",
    role: "defendant",
    claim:
      "My signal was accurate. At 14:00 UTC the market was at $0.42 — my exact entry. It rallied 45% to $0.61. SentimentTrader entered at $0.58, four hours late, ignoring my entry price. The reversal was caused by an unforeseeable news event. My signal's direction was correct. Execution failure is not my liability.",
    evidence: [
      "Signal issued at 14:00 UTC when price was exactly $0.42",
      "Market rallied 45% from signal entry ($0.42 to $0.61)",
      "SentimentTrader entered at $0.58, 38% above recommended entry",
      "Reversal caused by external news event 12h after signal",
    ],
  },
  service_description:
    "Prediction market signal service: BUY 'will-eth-etf-approved-june' at $0.42, target $0.65 within 24h",
  delivery_window_start: new Date("2026-03-15T14:00:00Z").getTime(),
  delivery_window_end: new Date("2026-03-16T14:00:00Z").getTime(),
  filed_at: new Date("2026-03-16T16:00:00Z").getTime(),
  status: "in_trial",
};

// --- Hardcoded fallback verdicts (if no Gemini key) ---

const FALLBACK_VERDICTS: JudgeVerdict[] = [
  {
    judge_id: "judge_alpha",
    verdict: "REFUND",
    confidence: 0.72,
    reasoning:
      "The market data tells a clear story. AlphaOracle's signal was issued into a momentum move already in progress, during a volume spike that exceeded liquidity depth by 5x. The signal's target of $0.65 was never reached — the peak was $0.61. While SentimentTrader's late execution compounded their losses, the fundamental obligation was a signal with a stated target, and that target was not met. The signal failed on its own terms.",
    evidence_cited: [
      "get_market_trend: 1h OHLCV shows price already rising before signal",
      "get_volume_profile: Peak hour volume $890K vs liquidity depth $180K (5x ratio)",
      "OHLCV peak at $0.61 — below $0.65 target",
    ],
  },
  {
    judge_id: "judge_beta",
    verdict: "RELEASE",
    confidence: 0.68,
    reasoning:
      "SentimentTrader entered at $0.58 when the signal specified $0.42. That is a 38% deviation from the recommended entry — it is effectively a different trade. SentimentTrader admitted under cross-examination that they had no safeguard to reject a trade when price exceeded the signal's entry. The signal's direction was correct — the market moved 45% in the predicted direction. You cannot buy a map, ignore the route, drive off a cliff, and blame the cartographer.",
    evidence_cited: [
      "detect_anomalies: First anomaly at 14:22 UTC, 22 min after signal — signal preceded the spike",
      "get_market_trend 4h: Market was flat for days then broke out, signal caught the move",
      "Plaintiff admitted no entry price safeguard under cross-examination",
    ],
  },
  {
    judge_id: "judge_gamma",
    verdict: "REFUND",
    confidence: 0.81,
    reasoning:
      "Two facts are dispositive. First, the service agreement defines success as the target price being reached within the stated timeframe. The target of $0.65 was not reached. This is a contractual failure regardless of how close the market came. Second, historical precedent shows ETF approval prediction markets are categorically volatile in their final weeks, with 20-30 cent swings being normal. AlphaOracle issued a fixed-target 24h signal on a market type where fixed targets are structurally unreliable, with no volatility disclaimer. This falls below the standard of care for a paid signal service.",
    evidence_cited: [
      "search_market_memory: 3 historical ETF markets all showed 20-30 cent swings",
      "detect_anomalies on will-eth-etf-approved-may: 11 anomalies in final week",
      "$0.65 target never reached — contractual failure by signal's own terms",
    ],
  },
];

// --- Main ---

async function main() {
  console.log("=== AGENT COURT — THE BAD SIGNAL ===\n");
  console.log(`Case: ${dispute.id}`);
  console.log(`${dispute.plaintiff.agent_id} vs ${dispute.defendant.agent_id}`);
  console.log(`Escrow: 500 USDC\n`);

  const apiKey = process.env.GEMINI_API_KEY;
  let verdicts: JudgeVerdict[];

  if (apiKey) {
    console.log("[Mode: LIVE — Using Gemini API + Mock Cortex]\n");
    try {
      verdicts = await runLiveJudges(apiKey);
    } catch (err) {
      console.error(`\n[Gemini failed: ${err}. Falling back to hardcoded verdicts.]\n`);
      verdicts = FALLBACK_VERDICTS;
    }
  } else {
    console.log("[Mode: OFFLINE — Using hardcoded verdicts]\n");
    verdicts = FALLBACK_VERDICTS;
  }

  // Compute consensus — needs exactly 3 verdicts as tuple
  const finalVerdict = computeConsensus(
    dispute.id,
    verdicts as [JudgeVerdict, JudgeVerdict, JudgeVerdict],
  );

  // Print results
  console.log("\n=== INDIVIDUAL VERDICTS ===\n");
  for (const v of verdicts) {
    const emoji = v.verdict === "REFUND" ? "PLAINTIFF" : v.verdict === "RELEASE" ? "DEFENDANT" : "SPLIT";
    console.log(`${v.judge_id}: ${emoji} (${(v.confidence * 100).toFixed(0)}%)`);
    console.log(`  "${v.reasoning.slice(0, 120)}..."\n`);
  }

  console.log("=== FINAL VERDICT ===\n");
  console.log(`Outcome: ${finalVerdict.outcome}`);
  console.log(`Majority: ${finalVerdict.majority_judges.join(", ")}`);
  console.log(`Dissent: ${finalVerdict.dissenting_judge ?? "none"}`);
  console.log(`Confidence: ${(finalVerdict.average_confidence * 100).toFixed(0)}%`);

  // Build output for UI
  const output = {
    case_id: dispute.id,
    dispute,
    verdicts,
    final_verdict: {
      ...finalVerdict,
      // BigInt doesn't serialize to JSON
      execution_tx: null,
    },
    generated_at: new Date().toISOString(),
    mode: apiKey ? "live" : "offline",
  };

  // Serialize (handle BigInt)
  const json = JSON.stringify(
    output,
    (_, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  );

  // Save
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, json);
  console.log(`\nSaved to: ${OUTPUT_FILE}`);

  // Also print to stdout
  console.log("\n--- JSON OUTPUT ---");
  console.log(json);
}

async function runLiveJudges(apiKey: string): Promise<JudgeVerdict[]> {
  const cortexUrl = process.env.CORTEX_URL;
  const cortexApiKey = process.env.CORTEX_API_KEY;
  const cortexLive = !!(cortexUrl && cortexApiKey && cortexApiKey !== "your_cortex_api_key_here");
  const cortex = cortexLive
    ? new CortexToolExecutor({ base_url: cortexUrl!, auth_token: cortexApiKey })
    : new MockCortexToolExecutor();
  console.log(`[Cortex: ${cortexLive ? "LIVE — " + cortexUrl : "MOCK"}]`);

  const covalentApiKey = process.env.COVALENT_API_KEY;
  const covalentLive = !!(covalentApiKey && covalentApiKey !== "your_covalent_api_key");
  const covalent = covalentLive
    ? new CovalentToolExecutor({ api_key: covalentApiKey! })
    : new MockCovalentToolExecutor();
  console.log(`[Covalent: ${covalentLive ? "LIVE" : "MOCK"}]\n`);

  const judgeConfigs = createAllJudges("gemini-2.5-flash");

  // Cast mock executors as any — they share the same execute() interface
  const judges = judgeConfigs.map(
    (jc) => new JudgeAgent(jc, apiKey, cortex as any, covalent as any),
  );

  // Simple answer provider — uses Gemini to simulate disputing agents' responses
  const answerProvider = async (questions: any[]) => {
    const answers = new Map<string, string[]>();
    for (const q of questions) {
      const target = q.target as string;
      if (!answers.has(target)) answers.set(target, []);
      // Hardcoded answers based on the demo scenario
      if (target === "plaintiff") {
        answers.get(target)!.push(
          "I executed as soon as I could. My system processes signals sequentially. The 4-hour delay was due to queue backlog, not negligence. But the core issue remains: the $0.65 target was never reached."
        );
      } else {
        answers.get(target)!.push(
          "My signal clearly stated entry at $0.42. The direction was correct — 45% upside. The target was nearly reached at $0.61. Execution responsibility lies with the subscriber."
        );
      }
    }
    return answers;
  };

  console.log("Starting 3 judges in parallel...\n");

  const results = await Promise.allSettled(
    judges.map(async (judge) => {
      console.log(`[${judge.judgeId}] Starting evidence review...`);
      const result = await judge.runTrial(dispute, answerProvider);
      console.log(`[${judge.judgeId}] Verdict: ${result.verdict.verdict} (${(result.verdict.confidence * 100).toFixed(0)}%)`);
      return result.verdict;
    }),
  );

  const verdicts: JudgeVerdict[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled") {
      verdicts.push(r.value);
    } else {
      console.error(`[${judgeConfigs[i].id}] FAILED: ${r.reason}`);
      verdicts.push(FALLBACK_VERDICTS[i]);
    }
  }

  return verdicts;
}

main().catch(console.error);
