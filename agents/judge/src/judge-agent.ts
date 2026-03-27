// =============================================================================
// Agent Court — Judge Agent (Single Judge Instance)
// =============================================================================
//
// Each JudgeAgent wraps a Gemini conversation with function calling enabled.
// It manages the multi-turn conversation: evidence review -> cross-examination
// rounds -> verdict. Cortex and Covalent tool calls are intercepted and routed
// to their respective executors.
// =============================================================================

import { GoogleGenAI, type Content, type Part, type Tool } from "@google/genai";
import { CORTEX_TOOL_DECLARATIONS, CortexToolExecutor } from "./cortex-tools.js";
import { COVALENT_TOOL_DECLARATIONS, CovalentToolExecutor, isCovalentTool } from "./covalent-tools.js";
import {
  buildEvidenceReviewPrompt,
  buildFollowUpPrompt,
  buildVerdictPrompt,
} from "./judge-prompts.js";
import type {
  JudgeConfig,
  JudgeVerdict,
  Dispute,
  CrossExamQuestion,
  FunctionCall,
} from "./types.js";

// --- Constants ---

const MAX_TOOL_CALL_ROUNDS = 5; // Max tool calls per turn before forcing text
const MAX_CROSS_EXAM_ROUNDS = 3;

// --- Judge Agent ---

export class JudgeAgent {
  private config: JudgeConfig;
  private genai: GoogleGenAI;
  private cortex: CortexToolExecutor;
  private covalent?: CovalentToolExecutor;
  private conversationHistory: Content[] = [];
  private toolCallLog: Array<{ call: FunctionCall; result: Record<string, unknown> }> = [];

  constructor(
    config: JudgeConfig,
    geminiApiKey: string,
    cortex: CortexToolExecutor,
    covalent?: CovalentToolExecutor,
  ) {
    this.config = config;
    this.genai = new GoogleGenAI({ apiKey: geminiApiKey });
    this.cortex = cortex;
    this.covalent = covalent;
  }

  get judgeId(): string {
    return this.config.id;
  }

  get personality(): string {
    return this.config.personality;
  }

  /**
   * Run the full trial for this judge: evidence review, cross-examination, verdict.
   * Returns the structured verdict and the questions generated at each round.
   *
   * The `answerProvider` callback simulates/routes cross-exam answers from
   * the disputing agents. For the hackathon demo, this can be another LLM
   * pretending to be the disputing agent. In production, it routes to the
   * actual agent's response endpoint.
   */
  async runTrial(
    dispute: Dispute,
    answerProvider: (questions: CrossExamQuestion[]) => Promise<Map<string, string[]>>,
  ): Promise<{
    verdict: JudgeVerdict;
    cross_exam_log: Array<{
      round: number;
      questions: CrossExamQuestion[];
      answers: Map<string, string[]>;
    }>;
    tool_calls: Array<{ call: FunctionCall; result: Record<string, unknown> }>;
  }> {
    const crossExamLog: Array<{
      round: number;
      questions: CrossExamQuestion[];
      answers: Map<string, string[]>;
    }> = [];

    // --- Phase 1: Evidence Review ---
    const evidencePrompt = buildEvidenceReviewPrompt({
      id: dispute.id,
      service_description: dispute.service_description,
      plaintiff: dispute.plaintiff,
      defendant: dispute.defendant,
      delivery_window_start: dispute.delivery_window_start,
      delivery_window_end: dispute.delivery_window_end,
      escrow_amount_lamports: dispute.escrow_amount_lamports,
    });

    const initialResponse = await this.chat(evidencePrompt);
    let questions = this.parseQuestions(initialResponse, 1);

    // --- Phase 2: Cross-Examination Rounds ---
    for (let round = 1; round <= MAX_CROSS_EXAM_ROUNDS; round++) {
      if (questions.length === 0) break;

      // Get answers from disputing agents
      const answers = await answerProvider(questions);

      crossExamLog.push({ round, questions, answers });

      // Build follow-up prompt with answers
      const plaintiffAnswers = answers.get("plaintiff") ?? [];
      const defendantAnswers = answers.get("defendant") ?? [];

      const followUpPrompt = buildFollowUpPrompt(round, {
        plaintiff_answers: plaintiffAnswers,
        defendant_answers: defendantAnswers,
      });

      const followUpResponse = await this.chat(followUpPrompt);

      // Check if judge is ready to render verdict
      const parsed = this.tryParseJson(followUpResponse);
      if (parsed?.ready_for_verdict === true || round === MAX_CROSS_EXAM_ROUNDS) {
        // Check if this response already contains a verdict
        const verdict = this.tryParseVerdict(followUpResponse);
        if (verdict) {
          return { verdict, cross_exam_log: crossExamLog, tool_calls: this.toolCallLog };
        }
        break;
      }

      // Parse new questions for next round
      questions = this.parseQuestions(followUpResponse, round + 1);
    }

    // --- Phase 3: Force Verdict ---
    const verdictResponse = await this.chat(buildVerdictPrompt());
    const verdict = this.tryParseVerdict(verdictResponse);

    if (!verdict) {
      // Fallback: if the model refuses to produce valid JSON, create a low-confidence abstention
      return {
        verdict: {
          judge_id: this.config.id,
          verdict: "SPLIT",
          confidence: 0.3,
          reasoning: `Judge ${this.config.id} failed to produce a structured verdict. Raw response: ${verdictResponse.slice(0, 500)}`,
          evidence_cited: [],
          split_ratio: [0.5, 0.5],
        },
        cross_exam_log: crossExamLog,
        tool_calls: this.toolCallLog,
      };
    }

    return { verdict, cross_exam_log: crossExamLog, tool_calls: this.toolCallLog };
  }

  // --- Gemini Chat with Function Calling Loop ---

  private async chat(userMessage: string): Promise<string> {
    this.conversationHistory.push({
      role: "user",
      parts: [{ text: userMessage }],
    });

    let toolCallRounds = 0;

    while (toolCallRounds < MAX_TOOL_CALL_ROUNDS) {
      const response = await this.genai.models.generateContent({
        model: this.config.model,
        contents: this.conversationHistory,
        config: {
          systemInstruction: this.config.system_prompt,
          tools: [
            {
              functionDeclarations: [
                ...CORTEX_TOOL_DECLARATIONS,
                ...COVALENT_TOOL_DECLARATIONS,
              ],
            },
          ] as Tool[],
        },
      });

      const candidate = response.candidates?.[0];
      if (!candidate?.content?.parts) {
        throw new Error(`Empty response from Gemini for judge ${this.config.id}`);
      }

      const parts = candidate.content.parts;

      // Check for function calls
      const functionCalls = parts.filter(
        (p): p is Part & { functionCall: { name: string; args: Record<string, unknown> } } =>
          p.functionCall !== undefined,
      );

      if (functionCalls.length > 0) {
        // Add model's response (with function calls) to history
        this.conversationHistory.push({
          role: "model",
          parts,
        });

        // Execute each function call and build response parts
        const responseParts: Part[] = [];
        for (const fc of functionCalls) {
          const call: FunctionCall = {
            name: fc.functionCall.name,
            args: fc.functionCall.args,
          };

          let result: Record<string, unknown>;
          if (isCovalentTool(call.name)) {
            result = this.covalent
              ? await this.covalent.execute(call)
              : { error: "Covalent not configured" };
          } else {
            result = await this.cortex.execute(call);
          }
          this.toolCallLog.push({ call, result });

          responseParts.push({
            functionResponse: {
              name: call.name,
              response: result,
            },
          });
        }

        // Add function responses to history
        this.conversationHistory.push({
          role: "user",
          parts: responseParts,
        });

        toolCallRounds++;
        continue;
      }

      // No function calls — extract text response
      const textParts = parts.filter((p) => p.text !== undefined);
      const responseText = textParts.map((p) => p.text).join("");

      this.conversationHistory.push({
        role: "model",
        parts: [{ text: responseText }],
      });

      return responseText;
    }

    // Exceeded tool call rounds — force text response by removing tools
    const response = await this.genai.models.generateContent({
      model: this.config.model,
      contents: this.conversationHistory,
      config: {
        systemInstruction:
          this.config.system_prompt +
          "\n\nYou have used all available tool calls. Respond with text only based on the evidence you have gathered.",
      },
    });

    const text =
      response.candidates?.[0]?.content?.parts
        ?.filter((p) => p.text !== undefined)
        .map((p) => p.text)
        .join("") ?? "";

    this.conversationHistory.push({
      role: "model",
      parts: [{ text }],
    });

    return text;
  }

  // --- Parsers ---

  private parseQuestions(response: string, round: number): CrossExamQuestion[] {
    const parsed = this.tryParseJson(response);
    if (!parsed) return [];

    const questions: CrossExamQuestion[] = [];

    const plaintiffQs = (parsed.plaintiff_questions as string[]) ?? [];
    const defendantQs = (parsed.defendant_questions as string[]) ?? [];

    for (const q of plaintiffQs) {
      questions.push({
        judge_id: this.config.id,
        round,
        target: "plaintiff",
        question: q,
      });
    }

    for (const q of defendantQs) {
      questions.push({
        judge_id: this.config.id,
        round,
        target: "defendant",
        question: q,
      });
    }

    return questions;
  }

  private tryParseVerdict(response: string): JudgeVerdict | null {
    const parsed = this.tryParseJson(response);
    if (!parsed) return null;

    // Validate required fields
    if (
      !parsed.judge_id ||
      !parsed.verdict ||
      parsed.confidence === undefined ||
      !parsed.reasoning
    ) {
      return null;
    }

    const verdict = parsed.verdict as string;
    if (!["REFUND", "RELEASE", "SPLIT"].includes(verdict)) {
      return null;
    }

    return {
      judge_id: this.config.id, // Override with our ID, not the model's
      verdict: verdict as "REFUND" | "RELEASE" | "SPLIT",
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence))),
      reasoning: String(parsed.reasoning),
      evidence_cited: Array.isArray(parsed.evidence_cited)
        ? (parsed.evidence_cited as string[])
        : [],
      ...(verdict === "SPLIT" && Array.isArray(parsed.split_ratio)
        ? { split_ratio: parsed.split_ratio as [number, number] }
        : {}),
    };
  }

  private tryParseJson(text: string): Record<string, unknown> | null {
    // Try to extract JSON from the response (model may wrap it in markdown)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    try {
      return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}
