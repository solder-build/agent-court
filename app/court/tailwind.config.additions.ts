// ---------------------------------------------------------------------------
// Agent Court — Tailwind CSS config additions
// Merge these into your existing tailwind.config.ts under theme.extend
// ---------------------------------------------------------------------------

const agentCourtTailwindExtensions = {
  colors: {
    court: {
      bg: "#020617", // slate-950
      bench: "#0f172a", // slate-900
      dock: "#1e293b", // slate-800
    },
    judge: {
      alpha: "#60a5fa", // blue-400
      beta: "#fbbf24", // amber-400
      gamma: "#a78bfa", // violet-400
    },
  },
  fontFamily: {
    mono: ["JetBrains Mono", "Fira Code", "monospace"],
    sans: ["Inter", "system-ui", "sans-serif"],
  },
  keyframes: {
    "fade-up": {
      "0%": { opacity: "0", transform: "translateY(20px)" },
      "100%": { opacity: "1", transform: "translateY(0)" },
    },
    "scale-x": {
      "0%": { transform: "scaleX(0)" },
      "100%": { transform: "scaleX(1)" },
    },
    "glow-pulse": {
      "0%, 100%": {
        boxShadow: "0 0 15px 0 var(--glow-color, rgba(96, 165, 250, 0.2))",
      },
      "50%": {
        boxShadow: "0 0 30px 5px var(--glow-color, rgba(96, 165, 250, 0.3))",
      },
    },
    "verdict-slam": {
      "0%": { opacity: "0", transform: "scale(1.3)" },
      "50%": { opacity: "1", transform: "scale(0.95)" },
      "100%": { opacity: "1", transform: "scale(1)" },
    },
  },
  animation: {
    "fade-up": "fade-up 0.5s ease-out forwards",
    "scale-x": "scale-x 0.6s ease-out forwards",
    "glow-pulse": "glow-pulse 2s ease-in-out infinite",
    "verdict-slam": "verdict-slam 0.4s ease-out forwards",
  },
};

export default agentCourtTailwindExtensions;
