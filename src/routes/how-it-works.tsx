import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/fate/PageShell";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How It Works — Fate Engine" },
      {
        name: "description",
        content:
          "From Daily Chronicle to GenLayer AI Consensus and on-chain verification: the full Fate Engine game loop, step by step.",
      },
      { property: "og:title", content: "How It Works — Fate Engine" },
      {
        property: "og:description",
        content: "The Fate Engine daily loop: chronicle, consensus, prediction, verification.",
      },
    ],
  }),
  component: HowItWorks,
});

const steps = [
  ["01", "Write your chronicle", "Tell the engine what happened, what you did, and how you felt."],
  ["02", "Structured context", "Free text plus emotions, intensity, intent, decisions and risk."],
  ["03", "Multi-agent interpretation", "Several AI agents read your day independently."],
  ["04", "GenLayer AI Consensus", "Agents converge into one validated interpretation on-chain."],
  ["05", "Probabilistic prediction", "Category, probability, confidence, impact and reasoning."],
  ["06", "Verification & reputation", "Report the actual outcome, earn accuracy and Fate Score."],
];

function HowItWorks() {
  return (
    <PageShell
      eyebrow="The Loop"
      title="How Fate Engine Works"
      intro="Fate Engine does not claim to know the future. It turns your lived context into probabilities, interpreted by multiple AI agents and settled through consensus."
    >
      <ol className="grid gap-5 md:grid-cols-2">
        {steps.map(([n, title, body]) => (
          <li key={n} className="panel-fate rounded-2xl p-8">
            <span className="font-display text-4xl text-gold">{n}</span>
            <h2 className="mt-4 text-lg text-violet-glow">{title}</h2>
            <p className="mt-2 text-[14px] leading-7 text-muted-foreground">{body}</p>
          </li>
        ))}
      </ol>
    </PageShell>
  );
}
