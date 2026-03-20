// =============================================================================
// Agent Court — Type Definitions
// =============================================================================

// --- Verdict Types ---

export type VerdictOutcome = "REFUND" | "RELEASE" | "SPLIT";

export interface JudgeVerdict {
  judge_id: string;
  verdict: VerdictOutcome;
  confidence: number; // 0.0 - 1.0
  reasoning: string;
  evidence_cited: string[];
  split_ratio?: [number, number]; // [plaintiff_share, defendant_share] — only if SPLIT
}

export interface FinalVerdict {
  dispute_id: string;
  outcome: VerdictOutcome;
  majority_judges: string[];
  dissenting_judge: string | null;
  individual_verdicts: JudgeVerdict[];
  average_confidence: number;
  split_ratio?: [number, number];
  timestamp: number;
  execution_tx?: string; // Solana transaction signature
}

// --- Dispute Types ---

export interface DisputeParty {
  agent_id: string;
  wallet: string;
  role: "plaintiff" | "defendant"; // plaintiff = buyer, defendant = seller
  claim: string;
  evidence: string[];
}

export interface Dispute {
  id: string;
  escrow_address: string;
  escrow_amount_lamports: bigint;
  token_mint?: string; // SPL token mint if not SOL
  plaintiff: DisputeParty; // agent that paid
  defendant: DisputeParty; // agent that was supposed to deliver
  service_description: string;
  delivery_window_start: number; // unix timestamp
  delivery_window_end: number;
  filed_at: number;
  status: "pending" | "in_trial" | "verdict_rendered" | "executed";
}

// --- Cross-Examination Types ---

export interface CrossExamQuestion {
  judge_id: string;
  round: number;
  target: "plaintiff" | "defendant";
  question: string;
  evidence_reference?: string; // Cortex data backing the question
}

export interface CrossExamAnswer {
  agent_id: string;
  round: number;
  judge_id: string;
  answer: string;
}

export interface CrossExamRound {
  round: number;
  questions: CrossExamQuestion[];
  answers: CrossExamAnswer[];
}

// --- Cortex Tool Types ---

export interface MarketTrendResult {
  slug: string;
  interval: string;
  trend_direction: string;
  ohlcv: Array<{
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    timestamp: number;
  }>;
}

export interface VolumeProfileResult {
  slug: string;
  volume_24h: number;
  volume_7d: number;
  trade_count_24h: number;
  liquidity_depth: number;
}

export interface MarketMemoryResult {
  markets: Array<{
    slug: string;
    title: string;
    description: string;
    category: string;
    status: string;
  }>;
}

export interface AnomalyResult {
  slug: string;
  anomalies: Array<{
    timestamp: number;
    price: number;
    deviation: number;
    direction: "spike" | "crash";
  }>;
}

// --- Gemini Function Calling Types ---

export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required: string[];
  };
}

export interface FunctionCall {
  name: string;
  args: Record<string, unknown>;
}

export interface FunctionResponse {
  name: string;
  response: Record<string, unknown>;
}

// --- Judge Personality ---

export type JudgePersonality = "evidence" | "intent" | "precedent";

export interface JudgeConfig {
  id: string;
  personality: JudgePersonality;
  system_prompt: string;
  model: string; // e.g., "gemini-2.5-flash"
}

// --- Escrow Interaction ---

export interface EscrowAction {
  type: "refund" | "release" | "split";
  escrow_address: string;
  plaintiff_wallet: string;
  defendant_wallet: string;
  amount_lamports: bigint;
  split_ratio?: [number, number];
}
