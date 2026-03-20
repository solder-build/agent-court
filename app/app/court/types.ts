// Agent Court — Shared Types

export type TrialPhase =
  | "filing"
  | "evidence"
  | "cross-examination"
  | "deliberation"
  | "verdict"
  | "settlement";

export type JudgeId = "alpha" | "beta" | "gamma";

export type PartyRole = "plaintiff" | "defendant";

export type VoteTarget = "plaintiff" | "defendant";

export interface JudgeConfig {
  id: JudgeId;
  name: string;
  role: string;
  accent: string; // tailwind color prefix e.g. "blue", "amber", "violet"
  accentHex: string;
}

export interface Party {
  role: PartyRole;
  agentName: string;
  wallet: string;
  version?: string;
}

export interface CaseData {
  id: string;
  title: string;
  summary: string;
  plaintiff: Party;
  defendant: Party;
  escrow: {
    amount: number;
    token: string;
    lockedAt: string;
    programId: string;
  };
  serviceContract: string;
  filedAt: string;
}

export interface EvidenceItem {
  id: string;
  judgeId: JudgeId;
  cortexFunction: string;
  params: Record<string, string | number>;
  result: string;
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  speaker: JudgeId | "plaintiff" | "defendant";
  speakerName: string;
  text: string;
  round: number;
}

export interface JudgeDeliberation {
  judgeId: JudgeId;
  analysis: string;
  vote: VoteTarget;
  confidence: number;
  reasoning: string;
}

export interface Verdict {
  majority: VoteTarget;
  majorityJudges: JudgeId[];
  dissentingJudge: JudgeId;
  dissentReasoning: string;
  overallConfidence: number;
  deliberations: JudgeDeliberation[];
}

export interface Settlement {
  txSignature: string;
  block: number;
  timestamp: string;
  recipient: Party;
  amount: number;
  token: string;
}

export const JUDGES: Record<JudgeId, JudgeConfig> = {
  alpha: {
    id: "alpha",
    name: "Judge Alpha",
    role: "Market Analysis",
    accent: "blue",
    accentHex: "#60a5fa",
  },
  beta: {
    id: "beta",
    name: "Judge Beta",
    role: "Risk Assessment",
    accent: "amber",
    accentHex: "#fbbf24",
  },
  gamma: {
    id: "gamma",
    name: "Judge Gamma",
    role: "Precedent Review",
    accent: "violet",
    accentHex: "#a78bfa",
  },
};
