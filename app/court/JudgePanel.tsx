"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { JudgeDeliberation, JudgeConfig } from "./types";
import { JUDGES } from "./types";

// ---------------------------------------------------------------------------
// Static accent map
// ---------------------------------------------------------------------------
const ACCENT = {
  blue: {
    border: "border-blue-500",
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    dot: "bg-blue-400",
    progress: "[&>div]:bg-blue-500",
    glow: "shadow-[0_0_20px_rgba(96,165,250,0.15)]",
  },
  amber: {
    border: "border-amber-500",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    dot: "bg-amber-400",
    progress: "[&>div]:bg-amber-500",
    glow: "shadow-[0_0_20px_rgba(251,191,36,0.15)]",
  },
  violet: {
    border: "border-violet-500",
    bg: "bg-violet-500/10",
    text: "text-violet-400",
    dot: "bg-violet-400",
    progress: "[&>div]:bg-violet-500",
    glow: "shadow-[0_0_20px_rgba(167,139,250,0.15)]",
  },
} as const;

// ---------------------------------------------------------------------------
// Typewriter effect hook
// ---------------------------------------------------------------------------
function useTypewriter(text: string, speed: number, enabled: boolean) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    setDisplayed("");
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed, enabled]);

  return { displayed, done };
}

// ---------------------------------------------------------------------------
// JudgePanel — single judge's deliberation card
// ---------------------------------------------------------------------------
interface JudgePanelProps {
  deliberation: JudgeDeliberation;
  isActive: boolean;
  /** Stagger delay in ms before this judge starts analyzing */
  delay?: number;
}

export function JudgePanel({
  deliberation,
  isActive,
  delay = 0,
}: JudgePanelProps) {
  const judge = JUDGES[deliberation.judgeId];
  const accent = ACCENT[judge.accent as keyof typeof ACCENT];

  const [phase, setPhase] = useState<
    "waiting" | "analyzing" | "typing" | "verdict"
  >("waiting");
  const [progressValue, setProgressValue] = useState(0);

  // Phase transitions with delays
  useEffect(() => {
    if (!isActive) return;

    const timers: NodeJS.Timeout[] = [];

    // Start analyzing after stagger delay
    timers.push(
      setTimeout(() => {
        setPhase("analyzing");
      }, delay)
    );

    // Progress bar animation
    timers.push(
      setTimeout(() => {
        const interval = setInterval(() => {
          setProgressValue((prev) => {
            if (prev >= 100) {
              clearInterval(interval);
              return 100;
            }
            return prev + 2;
          });
        }, 40);
        timers.push(interval as unknown as NodeJS.Timeout);
      }, delay)
    );

    // Start typing analysis
    timers.push(
      setTimeout(() => {
        setPhase("typing");
      }, delay + 2200)
    );

    // Show verdict
    timers.push(
      setTimeout(() => {
        setPhase("verdict");
      }, delay + 2200 + deliberation.analysis.length * 12 + 500)
    );

    return () => timers.forEach(clearTimeout);
  }, [isActive, delay, deliberation.analysis.length]);

  const { displayed: analysisText, done: analysisDone } = useTypewriter(
    deliberation.analysis,
    10,
    phase === "typing" || phase === "verdict"
  );

  const votedPlaintiff = deliberation.vote === "plaintiff";

  return (
    <Card
      className={cn(
        "bg-slate-900/80 border-slate-700/50 backdrop-blur-sm transition-all duration-500",
        phase !== "waiting" && `border-l-2 ${accent.border}`,
        phase === "verdict" && accent.glow
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "h-3 w-3 rounded-full transition-all duration-300",
                accent.dot,
                phase === "analyzing" && "animate-pulse"
              )}
              style={{ boxShadow: `0 0 8px ${judge.accentHex}` }}
            />
            <div>
              <CardTitle className={cn("text-sm font-semibold", accent.text)}>
                {judge.name}
              </CardTitle>
              <p className="text-xs text-slate-500">{judge.role}</p>
            </div>
          </div>

          {/* Status badge */}
          {phase === "waiting" && (
            <Badge
              variant="outline"
              className="text-xs bg-slate-500/10 text-slate-400 border-slate-500/30"
            >
              Pending
            </Badge>
          )}
          {phase === "analyzing" && (
            <Badge
              variant="outline"
              className={cn("text-xs", accent.bg, accent.text, accent.border)}
            >
              Analyzing...
            </Badge>
          )}
          {phase === "typing" && (
            <Badge
              variant="outline"
              className={cn("text-xs", accent.bg, accent.text, accent.border)}
            >
              Writing Opinion
            </Badge>
          )}
          {phase === "verdict" && (
            <Badge
              variant="outline"
              className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
            >
              Complete
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress bar — visible during analyzing phase */}
        {(phase === "analyzing" || phase === "typing") && (
          <Progress
            value={progressValue}
            className={cn("h-1 bg-slate-800", accent.progress)}
          />
        )}

        {/* Analysis text */}
        {(phase === "typing" || phase === "verdict") && (
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-wider text-slate-500">
              Analysis
            </span>
            <p className="text-sm text-slate-300 leading-relaxed">
              {phase === "verdict" ? deliberation.analysis : analysisText}
              {phase === "typing" && !analysisDone && (
                <span className="inline-block w-0.5 h-4 bg-slate-300 ml-0.5 animate-pulse" />
              )}
            </p>
          </div>
        )}

        {/* Preliminary verdict */}
        {phase === "verdict" && (
          <div
            className="mt-4 pt-4 border-t border-slate-700/50 space-y-3"
            style={{ animation: "fade-up 0.4s ease-out forwards" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-slate-500">
                Preliminary Ruling
              </span>
              <Badge
                className={cn(
                  "text-xs font-semibold px-3",
                  votedPlaintiff
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                )}
                variant="outline"
              >
                {votedPlaintiff ? "PLAINTIFF FAVORED" : "DEFENDANT FAVORED"}
              </Badge>
            </div>

            {/* Confidence score */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Confidence</span>
                <span className={cn("text-sm font-mono font-bold", accent.text)}>
                  {deliberation.confidence}%
                </span>
              </div>
              <Progress
                value={deliberation.confidence}
                className={cn("h-2 bg-slate-800", accent.progress)}
              />
            </div>

            {/* Short reasoning */}
            <p className="text-xs text-slate-400 italic leading-relaxed">
              &ldquo;{deliberation.reasoning}&rdquo;
            </p>
          </div>
        )}

        {/* Placeholder while waiting */}
        {phase === "waiting" && (
          <div className="h-32 flex items-center justify-center">
            <p className="text-sm text-slate-600">Awaiting turn...</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default JudgePanel;
