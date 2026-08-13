import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/fate/PageShell";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — Fate Engine" },
      {
        name: "description",
        content:
          "Daily Chronicle, emotional intensity, multi-agent AI consensus, probabilistic prediction, verification, accuracy, Fate Profile and on-chain reputation.",
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
  [
    "◎",
    "Multi Agent AI Consensus",
    "Four independent AI agents read your day; GenLayer validators re-run and compare before settling.",
  ],
  [
    "◍",
    "Probabilistic Forecast",
    "A calibrated 24-hour prediction with probability and confidence.",
  ],
  [
    "✔",
    "Prediction Verification",
    "Report the real outcome tomorrow and grow accuracy, streaks and reputation.",
  ],
  ["▦", "Fate Profile", "Behavioural tendencies, patterns and accuracy derived from your history."],
  [
    "◆",
    "On-chain Record",
    "Every prediction and verification is committed on-chain — no mock fallback.",
  ],
  [
    "☯",
    "Adaptive Signals",
    "Predictions follow the actions you actually took — never assumptions.",
  ],
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
