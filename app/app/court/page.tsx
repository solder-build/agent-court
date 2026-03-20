// ---------------------------------------------------------------------------
// Agent Court — Next.js 15 Page Entry Point
// Place this at: app/court/page.tsx (or app/page.tsx for standalone)
// ---------------------------------------------------------------------------

import CourtRoom from "./CourtRoom";

export const metadata = {
  title: "Agent Court | On-Chain Dispute Resolution",
  description:
    "AI-powered dispute resolution protocol for autonomous agents on Solana. Watch three judge-agents examine evidence, cross-examine parties, and deliver binding verdicts with on-chain settlement.",
};

export default function CourtPage() {
  return <CourtRoom />;
}
