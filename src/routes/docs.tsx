import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/fate/PageShell";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Docs — Fate Engine" },
      {
        name: "description",
        content:
          "Concepts, data model and consensus rules behind Fate Engine, the decentralized AI prediction game on GenLayer.",
      },
      { property: "og:title", content: "Docs — Fate Engine" },
      { property: "og:description", content: "Concepts, data model and consensus rules." },
    ],
  }),
  component: Docs,
});

const sections = [
  [
    "Chronicle schema",
    "Each entry stores narrative text, action tags, primary and secondary emotion, intensity, mood, good and negative actions, decisions with importance/risk/confidence, intent, event significance, unexpected events and important people. It lives off-chain in browser storage, keyed by wallet address.",
  ],
  [
    "Fate Signal",
    "The chronicle is normalized into a structured signal: emotional state (positive/negative/mixed/neutral), social energy, decision pressure, risk level, positive momentum, unresolved issues and event significance.",
  ],
  [
    "AI agents",
    "Four independent agents read the same context from different perspectives: Behavioral (habits and decisions), Emotional (intensity and mood), Social (relationships and communication) and Risk & Opportunity (decisions and consequences).",
  ],
  [
    "Consensus rules",
    "Agents produce independent interpretations (category, statement, probability, confidence, impact, signals). GenLayer validators re-run the LLM independently and compare the settled category (Partial Field Matching). The consensus layer then takes the majority category, a confidence-weighted probability, and measures agreement across all 4 agents.",
  ],
  [
    "Prediction object",
    "prediction, probability, confidence, category, impact, time horizon (24h), signals and agent agreement. Committed on-chain via the GenLayer contract.",
  ],
  [
    "Verification",
    "The next day you record the actual outcome (confirmed / partial / missed / not sure). The system scores the prediction and updates accuracy, calibration, streak, Fate Score and oracle reputation.",
  ],
  [
    "GenLayer AI Consensus",
    "The contract contracts/fate_engine.py runs 4 independent AI agents (Behavioral, Emotional, Social, Risk & Opportunity) on the derived Fate Signal via gl.nondet.exec_prompt. Validators re-run the LLM and compare the settled category before consensus is reached with gl.vm.run_nondet_unsafe. The settled prediction is read back and displayed. Raw journal, personal notes and free-form content stay off-chain. Set VITE_GENLAYER_CHAIN, VITE_GENLAYER_CONTRACT and VITE_GENLAYER_RPC to enable on-chain mode.",
  ],
  [
    "Disclaimer",
    "Fate Engine is a probabilistic simulation and prediction game. It is entertainment and self-reflection, not deterministic fortune telling or advice.",
  ],
];

function Docs() {
  return (
    <PageShell
      eyebrow="Reference"
      title="Documentation"
      intro="Everything the engine reads, how it reaches consensus, and how results are scored."
    >
      <div className="space-y-5">
        {sections.map(([title, body]) => (
          <section key={title} className="panel-fate rounded-2xl p-8">
            <h2 className="font-display text-2xl text-gold">{title}</h2>
            <p className="mt-3 max-w-3xl text-[14px] leading-7 text-muted-foreground">{body}</p>
          </section>
        ))}
      </div>
    </PageShell>
  );
}
