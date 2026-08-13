import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/fate/PageShell";
import { WalletGate, useWallet } from "@/components/fate/wallet";
import { CATEGORIES } from "@/lib/fate";
import { getPredictionsFor, verifyPrediction } from "@/lib/fate/engine";
import { buildProfile, computePerformance } from "@/lib/fate/metrics";
import { saveProfile } from "@/lib/fate/store";
import type { VerificationResult } from "@/lib/fate/types";

export const Route = createFileRoute("/verify/$predictionId")({
  head: () => ({
    meta: [
      { title: "Verification — Fate Engine" },
      { name: "description", content: "Report what actually happened and update your accuracy." },
    ],
  }),
  component: VerifyPage,
});

const RESULTS: { value: VerificationResult; label: string; hint: string }[] = [
  { value: "confirmed", label: "Confirmed", hint: "The prediction happened." },
  { value: "partial", label: "Partially correct", hint: "Part of it happened." },
  { value: "missed", label: "Missed", hint: "It did not happen." },
  { value: "not_sure", label: "Not sure", hint: "Not enough information." },
];

function VerifyPage() {
  const { predictionId } = Route.useParams();
  const { address } = useWallet();

  const prediction = address
    ? getPredictionsFor(address).find((p) => p.id === predictionId)
    : undefined;

  const [result, setResult] = useState<VerificationResult | null>(null);
  const [outcome, setOutcome] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!prediction) {
    return (
      <PageShell
        eyebrow="Verification"
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

  const alreadyVerified = prediction.status === "verified";
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !result) return;
    if (submitting) return; // guard: prevent double-submit double tx
    setSubmitting(true);
    setError(null);
    try {
      await verifyPrediction(address, prediction.id, result, outcome.trim());
      if (address) saveProfile(address, buildProfile(address));
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell
      eyebrow="Step Three"
      title="What Actually Happened?"
      intro="Reality gets the final vote. Report the outcome honestly — the engine learns from your accuracy."
    >
      <WalletGate>
        <div className="mx-auto max-w-3xl">
          <div className="panel-fate rounded-2xl p-7">
            <div className="text-[11px] tracking-[0.2em] text-gold uppercase">
              Prediction · {CATEGORIES[prediction.category]} ·{" "}
              {Math.round(prediction.probability * 100)}% probability
            </div>
            <p className="mt-3 text-[15px] leading-7 text-foreground">{prediction.prediction}</p>
          </div>

          {alreadyVerified ? (
            <div className="mt-8 rounded-xl border border-gold/40 bg-gold/10 px-6 py-5 text-[14px] text-gold">
              This prediction has already been verified. Accuracy and Fate Score are updated.
              <Link
                to="/fate-profile"
                className="mt-3 block text-[12px] tracking-[0.16em] uppercase underline"
              >
                View Fate Profile
              </Link>
            </div>
          ) : done ? (
            <div className="mt-8 rounded-xl border border-gold/40 bg-gold/10 px-6 py-6 text-center">
              <div className="font-display text-2xl text-gold">Prediction Verified</div>
              <p className="mt-2 text-[13px] text-muted-foreground">
                Accuracy updated. Fate Score updated. Pattern history updated.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                  to="/chronicle"
                  className="rounded-md border border-gold/50 px-5 py-3 text-[12px] tracking-[0.16em] uppercase"
                >
                  Tomorrow's Chronicle
                </Link>
                <Link
                  to="/fate-profile"
                  className="rounded-md border border-gold/50 bg-[image:var(--gradient-hero)] px-5 py-3 text-[12px] tracking-[0.16em] text-primary-foreground uppercase"
                >
                  Fate Profile
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleVerify} className="mt-8 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {RESULTS.map((r) => (
                  <button
                    type="button"
                    key={r.value}
                    onClick={() => setResult(r.value)}
                    className={`rounded-xl border px-5 py-4 text-left transition-colors ${
                      result === r.value
                        ? "border-gold bg-primary/25"
                        : "border-border hover:border-primary"
                    }`}
                  >
                    <div className="text-[14px] text-foreground">{r.label}</div>
                    <div className="mt-1 text-[12px] text-muted-foreground">{r.hint}</div>
                  </button>
                ))}
              </div>

              <div>
                <label className="mb-2 block text-[12px] text-muted-foreground">
                  What actually happened? (optional)
                </label>
                <textarea
                  rows={4}
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background/60 px-4 py-3 text-[14px] outline-none focus:border-primary"
                  placeholder="Describe the real outcome…"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-5 py-4 text-left">
                  <p className="text-[12px] tracking-[0.16em] text-destructive uppercase">
                    On-chain verification failed
                  </p>
                  <p className="mt-1 text-[13px] leading-6 text-foreground/90">{error}</p>
                  <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
                    The outcome was not recorded on-chain. Check your wallet, network, and GEN
                    balance, then try again.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={!result || submitting}
                className="rounded-md border border-gold/50 bg-[image:var(--gradient-hero)] px-8 py-3 text-[12px] tracking-[0.2em] text-primary-foreground uppercase shadow-[var(--shadow-glow)] disabled:opacity-60"
              >
                {submitting ? "Recording…" : "Verify Outcome"}
              </button>
            </form>
          )}
        </div>
      </WalletGate>
    </PageShell>
  );
}
