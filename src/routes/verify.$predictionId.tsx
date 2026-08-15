import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/fate/PageShell";
import { WalletGate, useWallet } from "@/components/fate/wallet";
import { CATEGORIES } from "@/lib/fate";
import { getPredictionsFor, verifyPrediction } from "@/lib/fate/engine";
import { buildProfile } from "@/lib/fate/metrics";
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

const GRACE_MS = 7 * 24 * 60 * 60 * 1000; // matches VERIFY_GRACE_HOURS (168h) in the contract
const MIN_EVIDENCE_LENGTH = 20;

function Countdown({ target }: { target: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = Math.max(0, target - now);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return (
    <span className="font-display text-gold">
      {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}

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
  const deadline = new Date(prediction.horizonDeadline).getTime();
  const windowOpened = Date.now() >= deadline;
  const windowClosed = Date.now() >= deadline + GRACE_MS;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !result) return;
    if (submitting) return; // guard: prevent double-submit double tx

    const evidence = outcome.trim();
    if (result !== "not_sure" && evidence.length < MIN_EVIDENCE_LENGTH) {
      setError(
        `Please describe what actually happened (at least ${MIN_EVIDENCE_LENGTH} characters) so the verifier can check the outcome.`,
      );
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await verifyPrediction(address, prediction.id, result, evidence);
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
      intro="Reality gets the final vote. Verification opens only after the outcome window closes, and an AI verifier checks your evidence before it affects your accuracy."
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
          ) : !windowOpened ? (
            <div className="mt-8 rounded-xl border border-border bg-background/40 px-6 py-6 text-center">
              <div className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
                Verification window locked
              </div>
              <p className="mx-auto mt-3 max-w-md text-[13px] leading-6 text-muted-foreground">
                Outcomes cannot be self-confirmed before the forecast horizon ends. Verification
                opens on{" "}
                <span className="text-foreground">
                  {new Date(prediction.horizonDeadline).toLocaleString()}
                </span>{" "}
                — in <Countdown target={deadline} />.
              </p>
              <Link
                to="/chronicle"
                className="mt-6 inline-block rounded-md border border-gold/50 px-5 py-3 text-[12px] tracking-[0.16em] uppercase"
              >
                Back to Chronicle
              </Link>
            </div>
          ) : windowClosed ? (
            <div className="mt-8 rounded-xl border border-border bg-background/40 px-6 py-6 text-center">
              <div className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
                Verification window closed
              </div>
              <p className="mx-auto mt-3 max-w-md text-[13px] leading-6 text-muted-foreground">
                This prediction could not be verified in time, so it no longer affects your
                accuracy. The on-chain verifier only accepts outcomes submitted within the window.
              </p>
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
                  What actually happened? Evidence of the outcome
                  {result === "not_sure" ? " (optional)" : " (required)"}
                </label>
                <textarea
                  rows={4}
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background/60 px-4 py-3 text-[14px] outline-none focus:border-primary"
                  placeholder="Describe the real outcome — specific details, what you saw or did…"
                />
                {result && result !== "not_sure" && (
                  <p
                    className={`mt-1 text-[11px] ${
                      outcome.trim().length < MIN_EVIDENCE_LENGTH
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }`}
                  >
                    {outcome.trim().length < MIN_EVIDENCE_LENGTH
                      ? `At least ${MIN_EVIDENCE_LENGTH} characters required so the verifier can judge the outcome.`
                      : "Your evidence is hashed on-chain and checked by the AI verifier; the raw text is never stored."}
                  </p>
                )}
              </div>

              {error && (
                <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-5 py-4 text-left">
                  <p className="text-[12px] tracking-[0.16em] text-destructive uppercase">
                    On-chain verification failed
                  </p>
                  <p className="mt-1 text-[13px] leading-6 text-foreground/90">{error}</p>
                  <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
                    The outcome was not recorded on-chain. Make sure the evidence supports your
                    reported result, then check your wallet, network, and GEN balance and try again.
                  </p>
                </div>
              )}

              <div className="rounded-lg border border-border bg-background/30 px-4 py-3 text-[12px] leading-6 text-muted-foreground">
                Your outcome only affects your accuracy if an independent AI verifier confirms the
                evidence supports the result you claim. The evidence text is passed to the verifier
                on-chain (never stored) and committed as a sha256 hash.
              </div>

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
