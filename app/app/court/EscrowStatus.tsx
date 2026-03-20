"use client";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { CaseData, Settlement, TrialPhase } from "./types";

// ---------------------------------------------------------------------------
// EscrowStatus — persistent footer bar showing escrow state
// ---------------------------------------------------------------------------
interface EscrowStatusProps {
  caseData: CaseData;
  currentPhase: TrialPhase;
  settlement?: Settlement;
}

export function EscrowStatus({
  caseData,
  currentPhase,
  settlement,
}: EscrowStatusProps) {
  const isSettled = currentPhase === "settlement" && settlement;

  return (
    <div
      className={cn(
        "border-t border-slate-800 bg-slate-950/95 backdrop-blur-sm",
        "px-6 py-3 flex items-center justify-between gap-4",
        "transition-all duration-500",
        isSettled && "border-emerald-500/30"
      )}
    >
      {/* Left: Escrow info */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "h-2 w-2 rounded-full",
              isSettled ? "bg-emerald-400" : "bg-amber-400 animate-pulse"
            )}
          />
          <span className="text-xs uppercase tracking-wider text-slate-500">
            Escrow
          </span>
        </div>

        <span className="font-mono text-sm text-slate-200 font-semibold">
          {caseData.escrow.amount.toLocaleString()} {caseData.escrow.token}
        </span>

        <Separator orientation="vertical" className="h-4 bg-slate-700" />

        <Badge
          variant="outline"
          className={cn(
            "text-xs",
            isSettled
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
              : "bg-amber-500/10 text-amber-400 border-amber-500/30"
          )}
        >
          {isSettled ? "RELEASED" : "LOCKED"}
        </Badge>
      </div>

      {/* Center: Parties */}
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span className="text-emerald-400 font-medium">
          {caseData.plaintiff.agentName}
        </span>
        <span className="text-slate-600">vs</span>
        <span className="text-rose-400 font-medium">
          {caseData.defendant.agentName}
        </span>
      </div>

      {/* Right: Program ID or TX */}
      <div className="flex items-center gap-3">
        {isSettled && settlement ? (
          <a
            href={`https://solscan.io/tx/${settlement.txSignature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-sky-400 hover:text-sky-300 transition-colors underline underline-offset-2"
          >
            {settlement.txSignature.slice(0, 8)}...
            {settlement.txSignature.slice(-4)}
          </a>
        ) : (
          <span className="text-xs font-mono text-slate-500">
            {caseData.escrow.programId.slice(0, 8)}...
            {caseData.escrow.programId.slice(-4)}
          </span>
        )}
      </div>
    </div>
  );
}

export default EscrowStatus;
