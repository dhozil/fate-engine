import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/fate/PageShell";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — Fate Engine" },
      {
        name: "description",
        content:
          "Daily Chronicle, emotional intensity, multi-agent consensus, 24H–30D horizons, verification, Fate Score and alternate timelines.",
      },
      { property: "og:title", content: "Features — Fate Engine" },
      {
        property: "og:description",
        content: "Everything inside the Fate Engine prediction game.",
      },
    ],
  }),
  component: Features,
});

const features = [
  ["✧", "Daily Chronicle", "Free-form narrative combined with structured behavioural fields."],
  ["☺", "Emotion Engine", "Primary and secondary emotion, intensity 0–10, and mood of the day."],
  ["◎", "Multi Agent Consensus", "Independent AI readings validated through GenLayer consensus."],
  ["◍", "Four Horizons", "24 hours, 3 days, 7 days and 30 days of probabilistic outlook."],
  [
    "✔",
    "Prediction Verification",
    "Report real outcomes and grow accuracy, streaks and reputation.",
  ],
  ["▦", "Fate Profile", "Behavioural patterns, tendencies and long-term life trajectory."],
  ["⟲", "What-If Timeline", "Explore an alternate branch of the decision you almost made."],
  ["◆", "On-chain Record", "Every prediction is recorded before the outcome is known."],
];

function Features() {
  return (
    <PageShell
      eyebrow="Capabilities"
      title="Features"
      intro="Rich context in, verifiable probability out. Each feature exists to make the consensus sharper and the game more honest."
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {features.map(([icon, title, body]) => (
          <article key={title} className="panel-fate rounded-2xl p-7">
            <div className="text-2xl text-violet-glow">{icon}</div>
            <h2 className="mt-4 text-[15px] text-gold">{title}</h2>
            <p className="mt-2 text-[13px] leading-6 text-muted-foreground">{body}</p>
          </article>
        ))}
      </div>
    </PageShell>
  );
}
