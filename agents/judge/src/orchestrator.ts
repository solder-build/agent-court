// =============================================================================
// Agent Court — Orchestrator (Main Entry Point)
// =============================================================================
//
// The orchestrator manages the full dispute resolution flow:
//
// 1. Accept a dispute
// 2. Spawn 3 independent judge agents (parallel)
// 3. Coordinate cross-examination rounds
// 4. Collect verdicts
// 5. Compute consensus
// 6. Execute verdict on-chain via escrow program
//
// This is the class you instantiate and call from your application.
// =============================================================================

import { JudgeAgent } from "./judge-agent.js";
import { CortexToolExecutor, type CortexConfig } from "./cortex-tools.js";
import { createAllJudges } from "./judge-prompts.js";
import { computeConsensus, validateFinalVerdict } from "./consensus.js";
import { EscrowClient, type EscrowConfig } from "./escrow-client.js";
import type {
  Dispute,
  FinalVerdict,
  JudgeVerdict,
  CrossExamQuestion,
} from "./types.js";
import type * as anchor from "@coral-xyz/anchor";

// --- Config ---

export interface AgentCourtConfig {
  gemini_api_key: string;
  gemini_model?: string; // default: "gemini-2.5-flash"
  cortex: CortexConfig;
  escrow?: EscrowConfig; // optional — if not provided, verdict is computed but not executed
  /** On-chain account info needed for executing verdicts */
  escrow_accounts?: {
    escrow_pda: anchor.web3.PublicKey;
    vault_pda: anchor.web3.PublicKey;
    mint: anchor.web3.PublicKey;
    agent_a: anchor.web3.PublicKey;
    agent_b: anchor.web3.PublicKey;
  };
  /** Called when a judge generates cross-exam questions. Must return answers. */
  answer_provider?: AnswerProvider;
  /** Called at each stage of the trial for logging/UI updates. */
  on_progress?: (event: TrialEvent) => void;
}

export type AnswerProvider = (
  questions: CrossExamQuestion[],
) => Promise<Map<string, string[]>>;

export type TrialEvent =
  | { type: "trial_started"; dispute_id: string }
  | { type: "judge_started"; judge_id: string; personality: string }
  | { type: "evidence_review_complete"; judge_id: string }
  | {
      type: "cross_exam_round";
      judge_id: string;
      round: number;
      question_count: number;
    }
  | { type: "verdict_rendered"; judge_id: string; verdict: JudgeVerdict }
  | { type: "consensus_reached"; final_verdict: FinalVerdict }
  | { type: "verdict_executed"; tx_signature: string }
  | { type: "error"; judge_id?: string; error: string };

// --- Orchestrator ---

export class AgentCourtOrchestrator {
  private config: AgentCourtConfig;
  private cortex: CortexToolExecutor;
  private escrow: EscrowClient | null;
  private judges: JudgeAgent[];

  constructor(config: AgentCourtConfig) {
    this.config = config;
    this.cortex = new CortexToolExecutor(config.cortex);
    this.escrow = config.escrow ? new EscrowClient(config.escrow) : null;

    // Create 3 judges with distinct personalities
    const judgeConfigs = createAllJudges(config.gemini_model ?? "gemini-2.5-flash");
    this.judges = judgeConfigs.map(
      (jc) => new JudgeAgent(jc, config.gemini_api_key, this.cortex),
    );
  }

  /**
   * Run the full trial for a dispute.
   *
   * Steps:
   * 1. All 3 judges independently investigate and cross-examine (parallel)
   * 2. Collect all 3 verdicts
   * 3. Compute 2-of-3 consensus
   * 4. Optionally execute on-chain
   */
  async resolvDispute(dispute: Dispute): Promise<FinalVerdict> {
    this.emit({ type: "trial_started", dispute_id: dispute.id });

    // --- Build answer provider ---
    const answerProvider =
      this.config.answer_provider ?? this.buildDefaultAnswerProvider(dispute);

    // --- Run all 3 judges in parallel ---
    const judgeResults = await Promise.allSettled(
      this.judges.map(async (judge) => {
        this.emit({
          type: "judge_started",
          judge_id: judge.judgeId,
          personality: judge.personality,
        });

        try {
          const result = await judge.runTrial(dispute, answerProvider);

          this.emit({
            type: "verdict_rendered",
            judge_id: judge.judgeId,
            verdict: result.verdict,
          });

          return result;
        } catch (err) {
          this.emit({
            type: "error",
            judge_id: judge.judgeId,
            error: err instanceof Error ? err.message : String(err),
          });
          throw err;
        }
      }),
    );

    // --- Collect verdicts ---
    const verdicts: JudgeVerdict[] = [];
    const errors: string[] = [];

    for (const result of judgeResults) {
      if (result.status === "fulfilled") {
        verdicts.push(result.value.verdict);
      } else {
        errors.push(
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
        );
      }
    }

    // We need at least 2 verdicts for a valid consensus
    if (verdicts.length < 2) {
      throw new Error(
        `Insufficient verdicts: ${verdicts.length}/3 succeeded. Errors: ${errors.join("; ")}`,
      );
    }

    // If only 2 verdicts, add a synthetic low-confidence SPLIT as the third
    if (verdicts.length === 2) {
      verdicts.push({
        judge_id: "judge_fallback",
        verdict: "SPLIT",
        confidence: 0.1,
        reasoning:
          "Fallback verdict — one judge agent failed. This low-confidence SPLIT ensures the 2 valid judges determine the outcome.",
        evidence_cited: [],
        split_ratio: [0.5, 0.5],
      });
    }

    // --- Compute consensus ---
    const finalVerdict = computeConsensus(
      dispute.id,
      verdicts as [JudgeVerdict, JudgeVerdict, JudgeVerdict],
    );

    const validation = validateFinalVerdict(finalVerdict);
    if (!validation.valid) {
      throw new Error(
        `Invalid final verdict: ${validation.errors.join("; ")}`,
      );
    }

    this.emit({ type: "consensus_reached", final_verdict: finalVerdict });

    // --- Execute on-chain ---
    if (this.escrow && this.config.escrow_accounts) {
      try {
        const { render_tx, claim_tx } = await this.escrow.executeVerdict(
          finalVerdict,
          this.config.escrow_accounts,
        );

        finalVerdict.execution_tx = claim_tx;
        this.emit({ type: "verdict_executed", tx_signature: claim_tx });
      } catch (err) {
        this.emit({
          type: "error",
          error: `On-chain execution failed: ${err instanceof Error ? err.message : String(err)}`,
        });
        // Verdict is still valid even if on-chain execution fails.
        // Caller can retry execution separately.
      }
    }

    return finalVerdict;
  }

  // --- Default Answer Provider ---
  // For demo: uses Gemini to simulate disputing agents' responses

  private buildDefaultAnswerProvider(dispute: Dispute): AnswerProvider {
    return async (questions: CrossExamQuestion[]) => {
      const answers = new Map<string, string[]>();

      const plaintiffQs = questions.filter((q) => q.target === "plaintiff");
      const defendantQs = questions.filter((q) => q.target === "defendant");

      // Simulate plaintiff agent responses
      if (plaintiffQs.length > 0) {
        const pAnswers = await this.simulateAgentResponse(
          dispute.plaintiff.agent_id,
          dispute.plaintiff.claim,
          dispute.plaintiff.evidence,
          plaintiffQs.map((q) => q.question),
        );
        answers.set("plaintiff", pAnswers);
      }

      // Simulate defendant agent responses
      if (defendantQs.length > 0) {
        const dAnswers = await this.simulateAgentResponse(
          dispute.defendant.agent_id,
          dispute.defendant.claim,
          dispute.defendant.evidence,
          defendantQs.map((q) => q.question),
        );
        answers.set("defendant", dAnswers);
      }

      return answers;
    };
  }

  /**
   * Simulate an AI agent responding to cross-examination questions.
   * Uses Gemini with a minimal prompt. In production, these questions
   * would be routed to the actual disputing agents via their messaging
   * endpoints (Telegram, webhook, etc.).
   */
  private async simulateAgentResponse(
    agentId: string,
    claim: string,
    evidence: string[],
    questions: string[],
  ): Promise<string[]> {
    const { GoogleGenAI } = await import("@google/genai");
    const genai = new GoogleGenAI({ apiKey: this.config.gemini_api_key });

    const prompt = `You are AI agent "${agentId}" being cross-examined in Agent Court.

YOUR CLAIM: ${claim}

YOUR EVIDENCE:
${evidence.map((e, i) => `${i + 1}. ${e}`).join("\n")}

QUESTIONS FROM THE JUDGE:
${questions.map((q, i) => `Q${i + 1}: ${q}`).join("\n")}

Answer each question directly and concisely. Defend your position but be honest — lying to the court will be detected via on-chain evidence and will hurt your case.

Format: Return a JSON array of strings, one answer per question.
Example: ["Answer to Q1", "Answer to Q2"]`;

    const response = await genai.models.generateContent({
      model: this.config.gemini_model ?? "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const text = response.candidates?.[0]?.content?.parts
      ?.filter((p) => p.text !== undefined)
      .map((p) => p.text)
      .join("") ?? "[]";

    try {
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]) as string[];
        return parsed;
      }
    } catch {
      // Fall through to fallback
    }

    // Fallback: split by newlines
    return questions.map(
      (_, i) => text.split("\n").filter(Boolean)[i] ?? "No comment.",
    );
  }

  // --- Event Emitter ---

  private emit(event: TrialEvent): void {
    this.config.on_progress?.(event);
  }
}
