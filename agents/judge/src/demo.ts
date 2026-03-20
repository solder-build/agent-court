// =============================================================================
// Agent Court — Demo: Whale Alert Dispute
// =============================================================================
//
// Scenario: Agent A paid Agent B for whale alert data via x402.
// Agent B claims it delivered. Agent A says the data was garbage.
// Three AI judges investigate using Cortex and render a verdict.
//
// Run: npx tsx src/demo.ts
// =============================================================================

import { AgentCourtOrchestrator, type Dispute, type TrialEvent } from "./index.js";

// --- Dispute Definition ---

const dispute: Dispute = {
  id: "DISPUTE-2026-0317-001",
  escrow_address: "EsCr0w111111111111111111111111111111111111111",
  escrow_amount_lamports: 500_000_000n, // 0.5 SOL
  plaintiff: {
    agent_id: "whale-watcher-buyer-agent",
    wallet: "BuyR111111111111111111111111111111111111111111",
    role: "plaintiff",
    claim:
      "I paid 0.5 SOL for 24 hours of real-time whale alerts on prediction markets. " +
      "I received 3 alerts total, all for sub-$100 trades. No actual whale movements were flagged. " +
      "Meanwhile, Cortex shows multiple large anomalies during the delivery window that were never reported.",
    evidence: [
      "x402 payment tx: 5xPay...abc (0.5 SOL, timestamp 1742169600)",
      "Service agreement: 'Real-time whale alerts for prediction markets, minimum $10K movements'",
      "Received alerts log: 3 alerts, largest was $87 trade on 'will-eth-hit-5000'",
      "Cortex detect_anomalies shows 5 events with >3 std dev during delivery window",
    ],
  },
  defendant: {
    agent_id: "alpha-data-provider-agent",
    wallet: "SeLr111111111111111111111111111111111111111111",
    role: "defendant",
    claim:
      "I delivered all whale alerts that my detection system identified. " +
      "The 3 alerts I sent were legitimate market movements. The prediction markets were " +
      "in a low-volatility period — there simply weren't many whale-sized movements. " +
      "My system worked as designed; the buyer's expectations were unrealistic for that market window.",
    evidence: [
      "Delivery receipts: 3 alerts sent via webhook at timestamps 1742180000, 1742205000, 1742230000",
      "System logs showing monitoring was active for full 24h window",
      "Historical baseline: average whale alerts per 24h for this market category is 2-4",
    ],
  },
  service_description:
    "24-hour real-time whale alert service for Solana prediction markets. " +
    "Provider monitors on-chain activity and sends alerts when trade volume exceeds " +
    "$10,000 in a single transaction or aggregated within a 5-minute window. " +
    "Alerts include: market slug, trade size, direction, timestamp.",
  delivery_window_start: 1742169600, // 2025-03-17 00:00:00 UTC (example)
  delivery_window_end: 1742256000, // 2025-03-18 00:00:00 UTC
  filed_at: Date.now(),
  status: "pending",
};

// --- Progress Logger ---

function logProgress(event: TrialEvent): void {
  const ts = new Date().toISOString().slice(11, 19);

  switch (event.type) {
    case "trial_started":
      console.log(`\n[$ts] === TRIAL STARTED: ${event.dispute_id} ===\n`);
      break;
    case "judge_started":
      console.log(
        `[${ts}] Judge ${event.judge_id} (${event.personality}) entering courtroom`,
      );
      break;
    case "cross_exam_round":
      console.log(
        `[${ts}] Judge ${event.judge_id} — cross-exam round ${event.round} (${event.question_count} questions)`,
      );
      break;
    case "verdict_rendered":
      console.log(
        `[${ts}] Judge ${event.judge_id} verdict: ${event.verdict.verdict} ` +
          `(confidence: ${event.verdict.confidence})`,
      );
      console.log(`        Reasoning: ${event.verdict.reasoning.slice(0, 120)}...`);
      break;
    case "consensus_reached":
      console.log(`\n[${ts}] === CONSENSUS REACHED ===`);
      console.log(`  Outcome: ${event.final_verdict.outcome}`);
      console.log(
        `  Majority: ${event.final_verdict.majority_judges.join(", ")}`,
      );
      if (event.final_verdict.dissenting_judge) {
        console.log(`  Dissent: ${event.final_verdict.dissenting_judge}`);
      }
      console.log(
        `  Confidence: ${event.final_verdict.average_confidence}`,
      );
      if (event.final_verdict.split_ratio) {
        console.log(
          `  Split: ${event.final_verdict.split_ratio[0] * 100}% / ${event.final_verdict.split_ratio[1] * 100}%`,
        );
      }
      break;
    case "verdict_executed":
      console.log(`\n[${ts}] Verdict executed on-chain: ${event.tx_signature}`);
      break;
    case "error":
      console.error(
        `[${ts}] ERROR${event.judge_id ? ` (${event.judge_id})` : ""}: ${event.error}`,
      );
      break;
  }
}

// --- Main ---

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Set GEMINI_API_KEY environment variable");
    process.exit(1);
  }

  const cortexUrl = process.env.CORTEX_MCP_URL ?? "http://localhost:3001";

  const court = new AgentCourtOrchestrator({
    gemini_api_key: apiKey,
    gemini_model: "gemini-2.5-flash",
    cortex: {
      base_url: cortexUrl,
    },
    // No escrow config — demo mode, no on-chain execution
    on_progress: logProgress,
  });

  console.log("Agent Court — Dispute Resolution Demo");
  console.log("======================================");
  console.log(`Dispute: ${dispute.id}`);
  console.log(`Escrow: ${dispute.escrow_amount_lamports.toString()} lamports`);
  console.log(`Plaintiff: ${dispute.plaintiff.agent_id}`);
  console.log(`Defendant: ${dispute.defendant.agent_id}`);
  console.log(`Service: ${dispute.service_description.slice(0, 80)}...`);
  console.log();

  try {
    const verdict = await court.resolvDispute(dispute);

    console.log("\n======================================");
    console.log("FINAL VERDICT (Full JSON):");
    console.log("======================================");
    console.log(
      JSON.stringify(
        verdict,
        (key, value) =>
          typeof value === "bigint" ? value.toString() : value,
        2,
      ),
    );
  } catch (err) {
    console.error("Trial failed:", err);
    process.exit(1);
  }
}

main();
