"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { EvidenceItem, JudgeConfig } from "./types";

// ---------------------------------------------------------------------------
// Accent color map — resolves Tailwind classes from judge accent string.
// We use a static map because Tailwind purges dynamic class names.
// ---------------------------------------------------------------------------
const ACCENT = {
  blue: {
    border: "border-blue-500",
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    glow: "shadow-blue-500/20",
    dot: "bg-blue-400",
    badge: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  },
  amber: {
    border: "border-amber-500",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    glow: "shadow-amber-500/20",
    dot: "bg-amber-400",
    badge: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  },
  violet: {
    border: "border-violet-500",
    bg: "bg-violet-500/10",
    text: "text-violet-400",
    glow: "shadow-violet-500/20",
    dot: "bg-violet-400",
    badge: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  },
} as const;

// ---------------------------------------------------------------------------
// Pulsing dots — typing/loading indicator
// ---------------------------------------------------------------------------
function PulsingDots({ color }: { color: string }) {
  return (
    <span className="inline-flex items-center gap-1 ml-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn("h-1.5 w-1.5 rounded-full", color)}
          style={{
            animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Single evidence item card
// ---------------------------------------------------------------------------
function EvidenceCard({
  item,
  accent,
  index,
}: {
  item: EvidenceItem;
  accent: (typeof ACCENT)[keyof typeof ACCENT];
  index: number;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), index * 800);
    return () => clearTimeout(timer);
  }, [index]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-all duration-500",
        "bg-slate-800/60 border-slate-700/50",
        "opacity-0 translate-y-3",
        visible && "opacity-100 translate-y-0"
      )}
      style={{
        animation: "fade-up 0.5s ease-out forwards",
      }}
    >
      {/* Function call header */}
      <div className="flex items-center gap-2 mb-2">
        <Badge
          variant="outline"
          className={cn("font-mono text-xs", accent.badge)}
        >
          {item.cortexFunction}
        </Badge>
        <span className="text-xs text-slate-500 font-mono">
          {new Date(item.timestamp).toLocaleTimeString()}
        </span>
      </div>

      {/* Parameters */}
      <div className="mb-2">
        <span className="text-xs uppercase tracking-wider text-slate-500">
          params
        </span>
        <pre className="text-xs font-mono text-slate-400 mt-1">
          {Object.entries(item.params)
            .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
            .join("\n")}
        </pre>
      </div>

      {/* Result */}
      <div>
        <span className="text-xs uppercase tracking-wider text-slate-500">
          result
        </span>
        <ScrollArea className="max-h-40 mt-1">
          <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap leading-relaxed">
            {item.result}
          </pre>
        </ScrollArea>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EvidencePanel — one judge's complete evidence feed
// ---------------------------------------------------------------------------
interface EvidencePanelProps {
  judge: JudgeConfig;
  evidence: EvidenceItem[];
  isActive: boolean;
}

export function EvidencePanel({
  judge,
  evidence,
  isActive,
}: EvidencePanelProps) {
  const accent = ACCENT[judge.accent as keyof typeof ACCENT];
  const [queryingIndex, setQueryingIndex] = useState(0);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setQueryingIndex((prev) => {
        if (prev >= evidence.length) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 1500);
    return () => clearInterval(interval);
  }, [isActive, evidence.length]);

  return (
    <Card
      className={cn(
        "bg-slate-900/80 border-slate-700/50 backdrop-blur-sm",
        "transition-all duration-300",
        isActive && `border-l-2 ${accent.border}`
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Judge avatar dot */}
            <div
              className={cn("h-3 w-3 rounded-full", accent.dot)}
              style={{
                boxShadow: `0 0 8px ${judge.accentHex}`,
              }}
            />
            <div>
              <CardTitle className={cn("text-sm font-semibold", accent.text)}>
                {judge.name}
              </CardTitle>
              <p className="text-xs text-slate-500">{judge.role}</p>
            </div>
          </div>
          {isActive && queryingIndex < evidence.length && (
            <div className="flex items-center">
              <span className="text-xs text-slate-400">Querying Cortex</span>
              <PulsingDots color={accent.dot} />
            </div>
          )}
          {isActive && queryingIndex >= evidence.length && (
            <Badge
              variant="outline"
              className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs"
            >
              Complete
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[420px] pr-2">
          <div className="space-y-3">
            {evidence.map((item, i) => (
              <EvidenceCard
                key={item.id}
                item={item}
                accent={accent}
                index={i}
              />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default EvidencePanel;
