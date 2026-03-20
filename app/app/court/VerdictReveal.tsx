"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Verdict, JudgeId } from "./types";
import { JUDGES } from "./types";

// ---------------------------------------------------------------------------
// Accent map
// ---------------------------------------------------------------------------
const ACCENT = {
  blue: {
    border: "border-blue-500",
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    glow: "shadow-[0_0_30px_rgba(96,165,250,0.3)]",
    glowStrong: "shadow-[0_0_50px_rgba(96,165,250,0.4)]",
  },
  amber: {
    border: "border-amber-500",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    glow: "shadow-[0_0_30px_rgba(251,191,36,0.3)]",
    glowStrong: "shadow-[0_0_50px_rgba(251,191,36,0.4)]",
  },
  violet: {
    border: "border-violet-500",
    bg: "bg-violet-500/10",
    text: "text-violet-400",
    glow: "shadow-[0_0_30px_rgba(167,139,250,0.3)]",
    glowStrong: "shadow-[0_0_50px_rgba(167,139,250,0.4)]",
  },
} as const;

// ---------------------------------------------------------------------------
// Verdict sequence phases
// ---------------------------------------------------------------------------
type RevealPhase =
  | "blackout"
  | "title"
  | "cards"
  | "majority"
  | "banner"
  | "dissent"
  | "settle";

// ---------------------------------------------------------------------------
// VerdictReveal — the climax of the demo
// ---------------------------------------------------------------------------
interface VerdictRevealProps {
  verdict: Verdict;
  isActive: boolean;
  onSettle: () => void;
}

export function VerdictReveal({
  verdict,
  isActive,
  onSettle,
}: VerdictRevealProps) {
  const [phase, setPhase] = useState<RevealPhase>("blackout");

  useEffect(() => {
    if (!isActive) return;

    const schedule: [RevealPhase, number][] = [
      ["blackout", 0],
      ["title", 500],
      ["cards", 1500],
      ["majority", 3500],
      ["banner", 5000],
      ["dissent", 6500],
      ["settle", 8000],
    ];

    const timers = schedule.map(([p, delay]) =>
      setTimeout(() => setPhase(p), delay)
    );

    return () => timers.forEach(clearTimeout);
  }, [isActive]);

  const phaseIndex = [
    "blackout",
    "title",
    "cards",
    "majority",
    "banner",
    "dissent",
    "settle",
  ].indexOf(phase);

  const favoredPlaintiff = verdict.majority === "plaintiff";

  return (
    <div className="relative min-h-[600px] flex flex-col items-center justify-center">
      {/* Overlay / blackout background */}
      <div
        className={cn(
          "absolute inset-0 bg-slate-950/90 backdrop-blur-md transition-opacity duration-500 rounded-xl",
          phaseIndex >= 0 ? "opacity-100" : "opacity-0"
        )}
      />

      {/* Content layer */}
      <div className="relative z-10 w-full max-w-4xl mx-auto px-6 space-y-8">
        {/* --- VERDICT TITLE --- */}
        {phaseIndex >= 1 && (
          <div
            className="text-center space-y-4"
            style={{ animation: "verdict-slam 0.4s ease-out forwards" }}
          >
            <h2 className="text-5xl font-bold tracking-[0.2em] text-slate-100 uppercase">
              Verdict
            </h2>
            {/* Expanding horizontal line */}
            <div className="flex justify-center">
              <div
                className="h-px bg-gradient-to-r from-transparent via-slate-400 to-transparent"
                style={{
                  width: "100%",
                  maxWidth: "400px",
                  animation: "scale-x 0.6s ease-out 0.2s forwards",
                  transformOrigin: "center",
                  transform: "scaleX(0)",
                }}
              />
            </div>
          </div>
        )}

        {/* --- JUDGE VOTE CARDS --- */}
        {phaseIndex >= 2 && (
          <div className="grid grid-cols-3 gap-4">
            {verdict.deliberations.map((delib, i) => {
              const judge = JUDGES[delib.judgeId];
              const accent = ACCENT[judge.accent as keyof typeof ACCENT];
              const isMajority = verdict.majorityJudges.includes(delib.judgeId);
              const showMajorityGlow = phaseIndex >= 3;

              return (
                <Card
                  key={delib.judgeId}
                  className={cn(
                    "bg-slate-900/90 backdrop-blur-sm transition-all duration-700",
                    `border-l-4 ${accent.border}`,
                    showMajorityGlow && isMajority && accent.glowStrong,
                    showMajorityGlow && !isMajority && "opacity-50"
                  )}
                  style={{
                    animation: `fade-up 0.5s ease-out ${i * 200}ms forwards`,
                    opacity: 0,
                  }}
                >
                  <CardContent className="pt-5 pb-4 space-y-3">
                    {/* Judge name */}
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "h-2.5 w-2.5 rounded-full",
                          `bg-${judge.accent}-400`
                        )}
                        style={{ boxShadow: `0 0 8px ${judge.accentHex}` }}
                      />
                      <span className={cn("text-sm font-semibold", accent.text)}>
                        {judge.name}
                      </span>
                    </div>

                    {/* Vote */}
                    <div className="text-center py-2">
                      <Badge
                        className={cn(
                          "text-sm font-bold px-4 py-1",
                          delib.vote === "plaintiff"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                        )}
                        variant="outline"
                      >
                        {delib.vote === "plaintiff"
                          ? "PLAINTIFF"
                          : "DEFENDANT"}
                      </Badge>
                    </div>

                    {/* Confidence */}
                    <div className="text-center">
                      <span className="text-3xl font-mono font-bold text-slate-100">
                        {delib.confidence}
                        <span className="text-lg text-slate-400">%</span>
                      </span>
                      <p className="text-xs text-slate-500 mt-1">confidence</p>
                    </div>

                    {/* Majority/Dissent label */}
                    {showMajorityGlow && (
                      <div className="text-center pt-1">
                        <span
                          className={cn(
                            "text-xs uppercase tracking-wider font-semibold",
                            isMajority ? "text-emerald-400" : "text-slate-500"
                          )}
                        >
                          {isMajority ? "Majority" : "Dissent"}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* --- MAJORITY BADGE --- */}
        {phaseIndex >= 3 && (
          <div
            className="flex justify-center"
            style={{ animation: "fade-up 0.4s ease-out forwards" }}
          >
            <Badge
              variant="outline"
              className="text-sm px-4 py-1.5 bg-slate-800/80 text-slate-300 border-slate-600"
            >
              MAJORITY: 2&ndash;1
            </Badge>
          </div>
        )}

        {/* --- FINAL VERDICT BANNER --- */}
        {phaseIndex >= 4 && (
          <div
            className={cn(
              "rounded-xl border-2 p-8 text-center space-y-3 backdrop-blur-sm",
              favoredPlaintiff
                ? "border-emerald-500/60 bg-emerald-500/5 shadow-[0_0_40px_rgba(16,185,129,0.15)]"
                : "border-rose-500/60 bg-rose-500/5 shadow-[0_0_40px_rgba(239,68,68,0.15)]"
            )}
            style={{
              animation: "fade-up 0.6s ease-out forwards",
            }}
          >
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Final Ruling
            </p>
            <h3 className="text-3xl font-bold text-slate-100">
              IN FAVOR OF{" "}
              <span
                className={
                  favoredPlaintiff ? "text-emerald-400" : "text-rose-400"
                }
              >
                {favoredPlaintiff ? "PLAINTIFF" : "DEFENDANT"}
              </span>
            </h3>
            <div className="flex items-center justify-center gap-6 pt-2">
              <div>
                <span className="text-4xl font-mono font-bold text-slate-100">
                  {verdict.overallConfidence}%
                </span>
                <p className="text-xs text-slate-500 mt-1">
                  aggregate confidence
                </p>
              </div>
            </div>
          </div>
        )}

        {/* --- DISSENTING OPINION --- */}
        {phaseIndex >= 5 && (
          <div
            className="max-w-2xl mx-auto"
            style={{ animation: "fade-up 0.5s ease-out forwards" }}
          >
            <Separator className="bg-slate-700/50 mb-4" />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider text-slate-500">
                  Dissenting Opinion
                </span>
                <span
                  className={cn(
                    "text-xs font-semibold",
                    ACCENT[
                      JUDGES[verdict.dissentingJudge].accent as keyof typeof ACCENT
                    ].text
                  )}
                >
                  {JUDGES[verdict.dissentingJudge].name}
                </span>
              </div>
              <p className="text-sm text-slate-400 italic leading-relaxed">
                &ldquo;{verdict.dissentReasoning}&rdquo;
              </p>
            </div>
          </div>
        )}

        {/* --- SETTLE BUTTON --- */}
        {phaseIndex >= 6 && (
          <div
            className="flex justify-center pt-4"
            style={{ animation: "fade-up 0.5s ease-out forwards" }}
          >
            <Button
              onClick={onSettle}
              size="lg"
              className={cn(
                "bg-emerald-600 hover:bg-emerald-500 text-white font-semibold",
                "px-8 py-6 text-base rounded-xl",
                "shadow-[0_0_30px_rgba(16,185,129,0.3)]",
                "hover:shadow-[0_0_40px_rgba(16,185,129,0.4)]",
                "transition-all duration-300"
              )}
            >
              Execute Settlement on Solana
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default VerdictReveal;
