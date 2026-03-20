"use client";

import { useState, useEffect, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { ChatMessage, JudgeConfig, JudgeId } from "./types";
import { JUDGES } from "./types";

// ---------------------------------------------------------------------------
// Accent color classes — static map for Tailwind purge safety
// ---------------------------------------------------------------------------
const ACCENT_CLASSES = {
  blue: {
    border: "border-blue-500/40",
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    avatar: "bg-blue-500/20 text-blue-300",
    tab: "data-[state=active]:text-blue-400 data-[state=active]:border-blue-400",
  },
  amber: {
    border: "border-amber-500/40",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    avatar: "bg-amber-500/20 text-amber-300",
    tab: "data-[state=active]:text-amber-400 data-[state=active]:border-amber-400",
  },
  violet: {
    border: "border-violet-500/40",
    bg: "bg-violet-500/10",
    text: "text-violet-400",
    avatar: "bg-violet-500/20 text-violet-300",
    tab: "data-[state=active]:text-violet-400 data-[state=active]:border-violet-400",
  },
} as const;

// ---------------------------------------------------------------------------
// Typing indicator
// ---------------------------------------------------------------------------
function TypingIndicator({ name, color }: { name: string; color: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className={cn("text-sm", color)}>{name}</span>
      <span className="inline-flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-slate-400"
            style={{
              animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single chat message bubble
// ---------------------------------------------------------------------------
function ChatBubble({
  message,
  isJudge,
  accent,
}: {
  message: ChatMessage;
  isJudge: boolean;
  accent: (typeof ACCENT_CLASSES)[keyof typeof ACCENT_CLASSES] | null;
}) {
  const isPlaintiff = message.speaker === "plaintiff";

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3",
        !isJudge && "flex-row-reverse text-right"
      )}
    >
      {/* Avatar */}
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback
          className={cn(
            "text-xs font-bold",
            isJudge && accent
              ? accent.avatar
              : isPlaintiff
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-rose-500/20 text-rose-300"
          )}
        >
          {isJudge
            ? (message.speaker as string).charAt(0).toUpperCase()
            : isPlaintiff
              ? "P"
              : "D"}
        </AvatarFallback>
      </Avatar>

      {/* Message content */}
      <div className={cn("max-w-[80%] space-y-1", !isJudge && "items-end")}>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-xs font-semibold",
              isJudge && accent
                ? accent.text
                : isPlaintiff
                  ? "text-emerald-400"
                  : "text-rose-400"
            )}
          >
            {message.speakerName}
          </span>
          <span className="text-xs text-slate-600">Round {message.round}</span>
        </div>
        <div
          className={cn(
            "rounded-lg border px-3 py-2 text-sm text-slate-200 leading-relaxed",
            isJudge && accent
              ? cn(accent.border, accent.bg)
              : isPlaintiff
                ? "border-emerald-500/20 bg-emerald-500/5"
                : "border-rose-500/20 bg-rose-500/5"
          )}
        >
          {message.text}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CrossExamination — tabbed chat interface
// ---------------------------------------------------------------------------
interface CrossExaminationProps {
  messages: ChatMessage[];
  isActive: boolean;
}

export function CrossExamination({
  messages,
  isActive,
}: CrossExaminationProps) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [showTyping, setShowTyping] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("round-1");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Group messages by round
  const rounds = messages.reduce(
    (acc, msg) => {
      const key = `round-${msg.round}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(msg);
      return acc;
    },
    {} as Record<string, ChatMessage[]>
  );

  // Animate messages appearing one by one
  useEffect(() => {
    if (!isActive) return;
    if (visibleCount >= messages.length) {
      setShowTyping(false);
      return;
    }

    setShowTyping(true);
    const timer = setTimeout(() => {
      setShowTyping(false);
      setVisibleCount((prev) => prev + 1);

      // Auto-switch tabs when a new round starts
      const nextMsg = messages[visibleCount];
      if (nextMsg) {
        setActiveTab(`round-${nextMsg.round}`);
      }
    }, 1800);

    return () => clearTimeout(timer);
  }, [isActive, visibleCount, messages.length]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleCount, showTyping]);

  // Get judge for a round (first judge message in that round)
  const getJudgeForRound = (
    roundMessages: ChatMessage[]
  ): JudgeConfig | null => {
    const judgeMsg = roundMessages.find(
      (m) => m.speaker !== "plaintiff" && m.speaker !== "defendant"
    );
    if (judgeMsg) return JUDGES[judgeMsg.speaker as JudgeId];
    return null;
  };

  return (
    <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-700/50">
        <h3 className="text-lg font-semibold text-slate-100">
          Cross-Examination
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          {visibleCount} of {messages.length} exchanges completed
        </p>
      </div>

      {/* Tabs for rounds */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="px-6 pt-3 border-b border-slate-800">
          <TabsList className="bg-transparent gap-2 h-auto p-0">
            {Object.entries(rounds).map(([key, roundMsgs]) => {
              const judge = getJudgeForRound(roundMsgs);
              const accentKey = judge?.accent as keyof typeof ACCENT_CLASSES;
              const accent = accentKey ? ACCENT_CLASSES[accentKey] : null;

              return (
                <TabsTrigger
                  key={key}
                  value={key}
                  className={cn(
                    "rounded-none border-b-2 border-transparent px-4 pb-2 pt-1",
                    "bg-transparent text-slate-400 text-sm",
                    "data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                    accent?.tab
                  )}
                >
                  {judge?.name ?? key}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* Chat content per round */}
        {Object.entries(rounds).map(([key, roundMsgs]) => {
          const judge = getJudgeForRound(roundMsgs);
          const accentKey = judge?.accent as keyof typeof ACCENT_CLASSES;
          const accent = accentKey ? ACCENT_CLASSES[accentKey] : null;

          // Determine which messages in this round are visible
          const roundStartIndex = messages.indexOf(roundMsgs[0]);
          const visibleInRound = roundMsgs.filter(
            (_, i) => roundStartIndex + i < visibleCount
          );

          // Is typing happening in this round?
          const isTypingInRound =
            showTyping &&
            visibleCount >= roundStartIndex &&
            visibleCount < roundStartIndex + roundMsgs.length;

          // Who is typing?
          const typingMessage = isTypingInRound
            ? roundMsgs[visibleCount - roundStartIndex]
            : null;

          return (
            <TabsContent key={key} value={key} className="mt-0">
              <ScrollArea className="h-[460px]">
                <div className="py-3 space-y-1" ref={scrollRef}>
                  {visibleInRound.map((msg) => {
                    const isJudge =
                      msg.speaker !== "plaintiff" &&
                      msg.speaker !== "defendant";
                    return (
                      <ChatBubble
                        key={msg.id}
                        message={msg}
                        isJudge={isJudge}
                        accent={isJudge ? accent : null}
                      />
                    );
                  })}

                  {/* Typing indicator */}
                  {isTypingInRound && typingMessage && (
                    <TypingIndicator
                      name={typingMessage.speakerName}
                      color={
                        typingMessage.speaker !== "plaintiff" &&
                        typingMessage.speaker !== "defendant"
                          ? accent?.text ?? "text-slate-400"
                          : typingMessage.speaker === "plaintiff"
                            ? "text-emerald-400"
                            : "text-rose-400"
                      }
                    />
                  )}

                  {/* Round complete badge */}
                  {visibleInRound.length === roundMsgs.length &&
                    !isTypingInRound && (
                      <div className="flex justify-center py-3">
                        <span className="text-xs text-slate-600 border border-slate-700/50 rounded-full px-3 py-1">
                          Examination complete
                        </span>
                      </div>
                    )}
                </div>
              </ScrollArea>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

export default CrossExamination;
