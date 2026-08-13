import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PageShell } from "@/components/fate/PageShell";
import { WalletGate, useWallet } from "@/components/fate/wallet";
import { CATEGORIES } from "@/lib/fate";
import { commitChallenge, getPredictionsFor } from "@/lib/fate/engine";
import type { AgentId } from "@/lib/fate/types";

export const Route = createFileRoute("/result/$predictionId")({
  head: () => ({
    meta: [
      { title: "Prediction — Fate Engine" },
      { name: "description", content: "Your consensus prediction, agents and reasoning." },
    ],
  }),
  component: ResultPage,
});

const AGENT_META: Record<AgentId, string> = {
  behavioral: "Behavioral Analyst",
  emotional: "Emotional Analyst",
  social: "Social Analyst",
  risk: "Risk & Opportunity Analyst",
};

function ResultPage() {
  const { predictionId } = Route.useParams();
  const { address } = useWallet();
  const navigate = useNavigate();

  const prediction = address
    ? getPredictionsFor(address).find((p) => p.id === predictionId)
    : undefined;
  const [choice, setChoice] = useState<"accepted" | "challenged" | null>(
    prediction?.challenge ?? null,
  );
  const [resolved, setResolved] = useState(false);

  if (!prediction) {
    return (
      <PageShell
        eyebrow="No Result"
        title="Prediction not found"
        intro="This prediction could not be found for your wallet."
      >
        <Link
          to="/chronicle"
          className="mt-6 inline-block rounded-md border border-gold/50 px-6 py-3 text-[12px] tracking-[0.2em] uppercase"
        >
          Back to Chronicle
        </Link>
      </PageShell>
    );
  }

  const handleChallenge = (c: "accepted" | "challenged") => {
    if (!address) return;
    commitChallenge(address, prediction.id, c);
    setChoice(c);
    setResolved(true);
  };

  const deadlineLabel = new Date(prediction.horizonDeadline).toLocaleDateString();

  return (
    <PageShell
      eyebrow="Step Two"
      title="Your Prediction"
      intro="A consensus reading of your signals. It is a probability, not a promise."
    >
      <WalletGate>
        <div className="mx-auto max-w-3xl">
          <div className="panel-fate rounded-3xl p-8 md:p-10">
            <div className="text-[11px] tracking-[0.22em] text-gold uppercase">
              Tomorrow's Fate · {CATEGORIES[prediction.category]}
            </div>
            <h2 className="mt-5 font-display text-3xl md:text-4xl">{prediction.prediction}</h2>

            <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4">
              <Stat label="Probability" value={`${Math.round(prediction.probability * 100)}%`} />
              <Stat label="Confidence" value={cap(prediction.confidence)} />
              <Stat label="Impact" value={cap(prediction.impact)} />
              <Stat label="Horizon" value={deadlineLabel} />
            </div>

            <div className="mt-8 rounded-xl border border-border bg-background/40 p-5">
              <div className="text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
                Why?
              </div>
              <p className="mt-2 text-[14px] leading-7 text-muted-foreground">
                {prediction.signals.length > 0
                  ? "Signals the agents detected in your chronicle:"
                  : "No strong signal detected — this reading is deliberately cautious."}
              </p>
              {prediction.signals.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {prediction.signals.map((s) => (
                    <li key={s} className="flex items-center gap-2 text-[13px]">
                      <span className="text-gold">+</span> {s}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 text-[12px] text-muted-foreground">
                Agent agreement: {Math.round(prediction.agentAgreement * 100)}% across 4 independent
                interpretations.
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-border bg-background/40 p-5">
              <div className="text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
                Independent agent readings
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {prediction.interpretations.map((i) => (
                  <div
                    key={i.agentId}
                    className="rounded-lg border border-border/60 bg-background/30 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] tracking-[0.12em] text-gold uppercase">
                        {AGENT_META[i.agentId]}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {Math.round(i.probability * 100)}%
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {CATEGORIES[i.category]} · {cap(i.confidence)} · {cap(i.impact)} impact
                    </div>
                    <p className="mt-2 text-[13px] leading-6 text-foreground/85">{i.statement}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 text-[12px] text-gold">
              Consensus settled on-chain ({prediction.onchain.chain ?? "genlayer"}) · tx{" "}
              {prediction.onchain.txHash}
            </div>

            <div className="mt-8 border-t border-border/60 pt-7">
              <div className="text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
                Do you believe this prediction?
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => handleChallenge("accepted")}
                  disabled={Boolean(resolved && choice === "accepted")}
                  className={`rounded-md border px-6 py-3 text-[12px] tracking-[0.18em] uppercase transition-colors ${
                    choice === "accepted"
                      ? "border-gold bg-primary/25 text-gold"
                      : "border-gold/50 hover:border-gold"
                  }`}
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => handleChallenge("challenged")}
                  disabled={Boolean(resolved && choice === "challenged")}
                  className={`rounded-md border px-6 py-3 text-[12px] tracking-[0.18em] uppercase transition-colors ${
                    choice === "challenged"
                      ? "border-gold bg-primary/25 text-gold"
                      : "border-border hover:border-gold"
                  }`}
                >
                  Challenge
                </button>
              </div>
              {resolved && (
                <p className="mt-4 text-[13px] text-gold">
                  {choice === "challenged"
                    ? "Challenge locked. Come back tomorrow to see if reality agrees with the consensus."
                    : "Accepted. Come back tomorrow to verify what actually happened."}
                </p>
              )}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <div className="text-[12px] text-muted-foreground">
              Consensus from 4 independent AI agents.
            </div>
            <div className="flex gap-3">
              <Link
                to="/chronicle"
                className="rounded-md border border-border px-5 py-3 text-[12px] tracking-[0.16em] uppercase hover:border-gold"
              >
                New Chronicle
              </Link>
              <Link
                to="/verify/$predictionId"
                params={{ predictionId: prediction.id }}
                className="rounded-md border border-gold/50 bg-[image:var(--gradient-hero)] px-5 py-3 text-[12px] tracking-[0.16em] text-primary-foreground uppercase"
              >
                Verify Tomorrow
              </Link>
            </div>
          </div>
        </div>
      </WalletGate>
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">{label}</div>
      <div className="mt-1 font-display text-2xl text-gold">{value}</div>
    </div>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
