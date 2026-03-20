// =============================================================================
// Agent Court — Public API
// =============================================================================

export { AgentCourtOrchestrator } from "./orchestrator.js";
export type { AgentCourtConfig, AnswerProvider, TrialEvent } from "./orchestrator.js";

export { JudgeAgent } from "./judge-agent.js";
export { CortexToolExecutor } from "./cortex-tools.js";
export type { CortexConfig } from "./cortex-tools.js";
export { CORTEX_TOOL_DECLARATIONS } from "./cortex-tools.js";

export { computeConsensus, validateFinalVerdict } from "./consensus.js";
export { createAllJudges, createJudgeConfig } from "./judge-prompts.js";
export { EscrowClient } from "./escrow-client.js";
export type { EscrowConfig } from "./escrow-client.js";

export type {
  Dispute,
  DisputeParty,
  JudgeVerdict,
  FinalVerdict,
  VerdictOutcome,
  CrossExamQuestion,
  CrossExamAnswer,
  CrossExamRound,
  JudgeConfig,
  JudgePersonality,
  EscrowAction,
} from "./types.js";
