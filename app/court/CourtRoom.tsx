"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import type { TrialPhase, JudgeId, CaseData, EvidenceItem, ChatMessage, JudgeDeliberation, Verdict, Settlement } from "./types";
import { JUDGES } from "./types";
import {
  MOCK_CASE,
  MOCK_EVIDENCE,
  MOCK_CROSS_EXAMINATION,
  MOCK_DELIBERATIONS,
  MOCK_VERDICT,
  MOCK_SETTLEMENT,
} from "./mock-data";
import { adaptTrialResult } from "./trial-adapter";
import type { RealTrialResult } from "./trial-adapter";

import { EvidencePanel } from "./EvidencePanel";
import { CrossExamination } from "./CrossExamination";
import { JudgePanel } from "./JudgePanel";
import { VerdictReveal } from "./VerdictReveal";
import { EscrowStatus } from "./EscrowStatus";

// ---------------------------------------------------------------------------
// Phase configuration
// ---------------------------------------------------------------------------
const PHASES: { id: TrialPhase; label: string; step: number }[] = [
  { id: "filing", label: "Case Filing", step: 1 },
  { id: "evidence", label: "Evidence", step: 2 },
  { id: "cross-examination", label: "Cross-Exam", step: 3 },
  { id: "deliberation", label: "Deliberation", step: 4 },
  { id: "verdict", label: "Verdict", step: 5 },
  { id: "settlement", label: "Settlement", step: 6 },
];

// ---------------------------------------------------------------------------
// PhaseTimeline — horizontal stepper
// ---------------------------------------------------------------------------
function PhaseTimeline({
  currentPhase,
  onPhaseClick,
}: {
  currentPhase: TrialPhase;
  onPhaseClick: (phase: TrialPhase) => void;
}) {
  const currentIndex = PHASES.findIndex((p) => p.id === currentPhase);

  return (
    <div className="flex items-center gap-1 w-full">
      {PHASES.map((phase, i) => {
        const isCompleted = i < currentIndex;
        const isCurrent = i === currentIndex;

        return (
          <div key={phase.id} className="flex items-center flex-1">
            {/* Step indicator */}
            <button
              onClick={() => onPhaseClick(phase.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-300 w-full",
                "text-xs font-medium whitespace-nowrap",
                isCurrent &&
                  "bg-slate-800 text-slate-100 shadow-lg shadow-slate-900/50",
                isCompleted && "text-emerald-400 hover:bg-slate-800/50 cursor-pointer",
                !isCurrent &&
                  !isCompleted &&
                  "text-slate-600 cursor-default"
              )}
            >
              {/* Step number / check */}
              <span
                className={cn(
                  "flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold shrink-0",
                  isCurrent && "bg-slate-100 text-slate-900",
                  isCompleted && "bg-emerald-500/20 text-emerald-400",
                  !isCurrent && !isCompleted && "bg-slate-800 text-slate-600"
                )}
              >
                {isCompleted ? (
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  phase.step
                )}
              </span>
              <span className="hidden lg:inline">{phase.label}</span>
            </button>

            {/* Connector line */}
            {i < PHASES.length - 1 && (
              <div
                className={cn(
                  "h-px flex-1 min-w-4 mx-1",
                  i < currentIndex ? "bg-emerald-500/40" : "bg-slate-800"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CaseFiling — Phase 1
// ---------------------------------------------------------------------------
function CaseFilingPhase({ caseData }: { caseData: CaseData }) {
  const c = caseData;

  return (
    <div className="grid grid-cols-5 gap-6">
      {/* Left: Case details */}
      <div className="col-span-3 space-y-6">
        <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <Badge
                variant="outline"
                className="bg-rose-500/10 text-rose-400 border-rose-500/30 text-xs font-mono"
              >
                DISPUTED
              </Badge>
              <span className="text-xs font-mono text-slate-500">{c.id}</span>
            </div>
            <CardTitle className="text-xl text-slate-100 leading-tight">
              {c.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Parties */}
            <div className="grid grid-cols-2 gap-4">
              {/* Plaintiff */}
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2">
                <span className="text-xs uppercase tracking-wider text-emerald-500/70">
                  Plaintiff
                </span>
                <p className="text-sm font-semibold text-emerald-400">
                  {c.plaintiff.agentName}
                </p>
                <p className="text-xs font-mono text-slate-500">
                  {c.plaintiff.wallet}
                </p>
              </div>
              {/* Defendant */}
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-4 space-y-2">
                <span className="text-xs uppercase tracking-wider text-rose-500/70">
                  Defendant
                </span>
                <p className="text-sm font-semibold text-rose-400">
                  {c.defendant.agentName}
                </p>
                <p className="text-xs font-mono text-slate-500">
                  {c.defendant.wallet}
                </p>
              </div>
            </div>

            <Separator className="bg-slate-700/50" />

            {/* Dispute summary */}
            <div className="space-y-2">
              <span className="text-xs uppercase tracking-wider text-slate-500">
                Dispute Summary
              </span>
              <p className="text-sm text-slate-300 leading-relaxed">
                {c.summary}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right: Escrow + Contract */}
      <div className="col-span-2 space-y-6">
        {/* Escrow card */}
        <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm border-l-2 border-l-amber-500">
          <CardHeader className="pb-2">
            <span className="text-xs uppercase tracking-wider text-slate-500">
              Escrow Details
            </span>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-3xl font-mono font-bold text-slate-100">
                {c.escrow.amount.toLocaleString()}
              </span>
              <span className="text-lg text-amber-400 ml-2 font-semibold">
                {c.escrow.token}
              </span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Locked</span>
                <span className="font-mono text-slate-300">
                  {new Date(c.escrow.lockedAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Program</span>
                <span className="font-mono text-slate-400">
                  {c.escrow.programId.slice(0, 12)}...
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Filed</span>
                <span className="font-mono text-slate-300">
                  {new Date(c.filedAt).toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service contract card */}
        <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <span className="text-xs uppercase tracking-wider text-slate-500">
              Service Contract
            </span>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-300 leading-relaxed font-mono">
              {c.serviceContract}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Evidence Phase — Phase 2
// ---------------------------------------------------------------------------
function EvidencePhase({ isActive, evidence }: { isActive: boolean; evidence: EvidenceItem[] }) {
  const judgeIds: JudgeId[] = ["alpha", "beta", "gamma"];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <h3 className="text-lg font-semibold text-slate-100">
          Evidence Gathering
        </h3>
        <Badge
          variant="outline"
          className="bg-sky-500/10 text-sky-400 border-sky-500/30 text-xs"
        >
          Querying Cortex Prediction Markets
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {judgeIds.map((id) => (
          <EvidencePanel
            key={id}
            judge={JUDGES[id]}
            evidence={evidence.filter((e) => e.judgeId === id)}
            isActive={isActive}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Deliberation Phase — Phase 4
// ---------------------------------------------------------------------------
function DeliberationPhase({ isActive, deliberations }: { isActive: boolean; deliberations: JudgeDeliberation[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <h3 className="text-lg font-semibold text-slate-100">
          Judicial Deliberation
        </h3>
        <Badge
          variant="outline"
          className="bg-violet-500/10 text-violet-400 border-violet-500/30 text-xs"
        >
          Independent Analysis
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {deliberations.map((delib, i) => (
          <JudgePanel
            key={delib.judgeId}
            deliberation={delib}
            isActive={isActive}
            delay={i * 1200}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settlement Phase — Phase 6
// ---------------------------------------------------------------------------
function SettlementPhase({ settlement }: { settlement: Settlement }) {
  const s = settlement;

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card
        className={cn(
          "bg-slate-900/80 border-emerald-500/40 backdrop-blur-sm max-w-lg w-full",
          "shadow-[0_0_40px_rgba(16,185,129,0.15)]"
        )}
        style={{ animation: "fade-up 0.6s ease-out forwards" }}
      >
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-3">
            <div className="h-12 w-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <svg
                className="h-6 w-6 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>
          <CardTitle className="text-2xl text-emerald-400">
            Settlement Executed
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Amount */}
          <div className="text-center py-3 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
            <span className="text-3xl font-mono font-bold text-slate-100">
              {s.amount.toLocaleString()}
            </span>
            <span className="text-lg text-emerald-400 ml-2 font-semibold">
              {s.token}
            </span>
            <p className="text-xs text-slate-400 mt-1">
              Released to {s.recipient.agentName}
            </p>
          </div>

          <Separator className="bg-slate-700/50" />

          {/* Transaction details */}
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Transaction</span>
              <a
                href={`https://solscan.io/tx/${s.txSignature}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sky-400 hover:text-sky-300 transition-colors underline underline-offset-2"
              >
                {s.txSignature.slice(0, 16)}...{s.txSignature.slice(-8)}
              </a>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Block</span>
              <span className="font-mono text-slate-300">
                {s.block.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Timestamp</span>
              <span className="font-mono text-slate-300">
                {new Date(s.timestamp).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Recipient</span>
              <span className="font-mono text-slate-400">
                {s.recipient.wallet.slice(0, 12)}...
              </span>
            </div>
          </div>

          <Separator className="bg-slate-700/50" />

          {/* Solana Explorer link */}
          <div className="flex justify-center">
            <a
              href={`https://solscan.io/tx/${s.txSignature}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-sky-500/10 text-sky-400 border border-sky-500/30",
                "hover:bg-sky-500/20 transition-colors text-sm font-medium"
              )}
            >
              View on Solana Explorer
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CourtRoom — main page component
// ---------------------------------------------------------------------------
export default function CourtRoom() {
  const [currentPhase, setCurrentPhase] = useState<TrialPhase>("filing");
  const [phaseHistory, setPhaseHistory] = useState<TrialPhase[]>(["filing"]);

  // Trial data — populated from API on mount, falls back to mock constants
  const [trialCase, setTrialCase] = useState<CaseData>(MOCK_CASE);
  const [trialEvidence, setTrialEvidence] = useState<EvidenceItem[]>(MOCK_EVIDENCE);
  const [trialCrossExam, setTrialCrossExam] = useState<ChatMessage[]>(MOCK_CROSS_EXAMINATION);
  const [trialDeliberations, setTrialDeliberations] = useState<JudgeDeliberation[]>(MOCK_DELIBERATIONS);
  const [trialVerdict, setTrialVerdict] = useState<Verdict>(MOCK_VERDICT);
  const [trialSettlement, setTrialSettlement] = useState<Settlement>(MOCK_SETTLEMENT);

  useEffect(() => {
    fetch("/api/trial")
      .then((res) => res.json())
      .then((raw: RealTrialResult) => {
        if (raw.source !== "live") return; // keep mock state
        const adapted = adaptTrialResult(raw);
        setTrialCase(adapted.caseData);
        setTrialEvidence(adapted.evidence);
        setTrialCrossExam(adapted.crossExamination);
        setTrialDeliberations(adapted.deliberations);
        setTrialVerdict(adapted.verdict);
        setTrialSettlement(adapted.settlement);
      })
      .catch(() => {
        // Network error — mock state already set, nothing to do
      });
  }, []);

  const advancePhase = useCallback(() => {
    const currentIndex = PHASES.findIndex((p) => p.id === currentPhase);
    if (currentIndex < PHASES.length - 1) {
      const nextPhase = PHASES[currentIndex + 1].id;
      setCurrentPhase(nextPhase);
      setPhaseHistory((prev) =>
        prev.includes(nextPhase) ? prev : [...prev, nextPhase]
      );
    }
  }, [currentPhase]);

  const goToPhase = useCallback(
    (phase: TrialPhase) => {
      // Only allow jumping to phases that have been visited
      if (phaseHistory.includes(phase)) {
        setCurrentPhase(phase);
      }
    },
    [phaseHistory]
  );

  const handleSettle = useCallback(() => {
    setCurrentPhase("settlement");
    setPhaseHistory((prev) =>
      prev.includes("settlement") ? prev : [...prev, "settlement"]
    );
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* ===== HEADER ===== */}
      <header className="border-b border-slate-800 bg-slate-950/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            {/* Logo / Title */}
            <div className="flex items-center gap-3">
              {/* Gavel icon */}
              <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center">
                <svg
                  className="h-4 w-4 text-slate-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-slate-100">
                  Agent Court
                </h1>
                <p className="text-xs text-slate-500">
                  On-Chain Dispute Resolution Protocol
                </p>
              </div>
            </div>

            {/* Case ID */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-slate-500">
                {trialCase.id}
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  currentPhase === "settlement"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                )}
              >
                {currentPhase === "settlement" ? "RESOLVED" : "IN SESSION"}
              </Badge>
            </div>
          </div>

          {/* Phase timeline */}
          <PhaseTimeline currentPhase={currentPhase} onPhaseClick={goToPhase} />
        </div>
      </header>

      {/* ===== MAIN CONTENT ===== */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        {/* Phase 1: Case Filing */}
        {currentPhase === "filing" && (
          <div className="space-y-6">
            <CaseFilingPhase caseData={trialCase} />
            <div className="flex justify-end">
              <Button
                onClick={advancePhase}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-6"
              >
                Begin Evidence Gathering
                <svg
                  className="h-4 w-4 ml-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Button>
            </div>
          </div>
        )}

        {/* Phase 2: Evidence Gathering */}
        {currentPhase === "evidence" && (
          <div className="space-y-6">
            <EvidencePhase isActive={true} evidence={trialEvidence} />
            <div className="flex justify-end">
              <Button
                onClick={advancePhase}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-6"
              >
                Proceed to Cross-Examination
                <svg
                  className="h-4 w-4 ml-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Button>
            </div>
          </div>
        )}

        {/* Phase 3: Cross-Examination */}
        {currentPhase === "cross-examination" && (
          <div className="space-y-6">
            <CrossExamination
              messages={trialCrossExam}
              isActive={true}
            />
            <div className="flex justify-end">
              <Button
                onClick={advancePhase}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-6"
              >
                Enter Deliberation
                <svg
                  className="h-4 w-4 ml-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Button>
            </div>
          </div>
        )}

        {/* Phase 4: Deliberation */}
        {currentPhase === "deliberation" && (
          <div className="space-y-6">
            <DeliberationPhase isActive={true} deliberations={trialDeliberations} />
            <div className="flex justify-end">
              <Button
                onClick={advancePhase}
                className="bg-slate-100 hover:bg-white text-slate-900 font-semibold px-6"
              >
                Deliver Verdict
                <svg
                  className="h-4 w-4 ml-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Button>
            </div>
          </div>
        )}

        {/* Phase 5: Verdict */}
        {currentPhase === "verdict" && (
          <VerdictReveal
            verdict={trialVerdict}
            isActive={true}
            onSettle={handleSettle}
          />
        )}

        {/* Phase 6: Settlement */}
        {currentPhase === "settlement" && <SettlementPhase settlement={trialSettlement} />}
      </main>

      {/* ===== FOOTER: Escrow Status ===== */}
      <footer className="sticky bottom-0 z-50">
        <EscrowStatus
          caseData={trialCase}
          currentPhase={currentPhase}
          settlement={
            currentPhase === "settlement" ? trialSettlement : undefined
          }
        />
      </footer>

      {/* ===== Global animation keyframes ===== */}
      <style jsx global>{`
        @keyframes fade-up {
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes scale-x {
          0% {
            transform: scaleX(0);
          }
          100% {
            transform: scaleX(1);
          }
        }

        @keyframes verdict-slam {
          0% {
            opacity: 0;
            transform: scale(1.3);
          }
          50% {
            opacity: 1;
            transform: scale(0.95);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes glow-pulse {
          0%,
          100% {
            box-shadow: 0 0 15px 0 var(--glow-color, rgba(96, 165, 250, 0.2));
          }
          50% {
            box-shadow: 0 0 30px 5px var(--glow-color, rgba(96, 165, 250, 0.3));
          }
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 0.3;
            transform: scale(0.8);
          }
          50% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
