import { useMemo, useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { PageShell } from "@/components/fate/PageShell";
import { WalletGate, useWallet } from "@/components/fate/wallet";
import { CATEGORIES } from "@/lib/fate";
import { getPredictionsFor } from "@/lib/fate/engine";
import { detectPatterns, getPatternsFor } from "@/lib/fate/patterns";
import { getChronicles, getVerifications } from "@/lib/fate/store";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "History & Patterns — Fate Engine" },
      {
        name: "description",
        content:
          "Your chronicle timeline, prediction history and detected recurring behavioral patterns.",
      },
    ],
  }),
  component: HistoryPage,
});

const VERIFY_LABEL: Record<string, string> = {
  confirmed: "Confirmed",
  partial: "Partial",
  missed: "Missed",
  not_sure: "Not sure",
};

function HistoryPage() {
  const { address } = useWallet();
  const router = useRouter();
  const [tab, setTab] = useState<"chronicles" | "predictions" | "patterns">("chronicles");

  const chronicles = useMemo(() => (address ? getChronicles(address) : []), [address]);
  const predictions = useMemo(() => (address ? getPredictionsFor(address) : []), [address]);
  const verifications = useMemo(() => (address ? getVerifications(address) : []), [address]);
  const patterns = useMemo(() => (address ? detectPatterns(address) : []), [address]);

  const verifiedMap = useMemo(
    () => new Map(verifications.map((v) => [v.predictionId, v.result])),
    [verifications],
  );

  return (
    <PageShell
      eyebrow="Your Timeline"
      title="History & Patterns"
      intro="Every chronicle adds a branch to your timeline. Patterns emerge the longer you record."
    >
      <WalletGate>
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => router.history.back()}
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-[12px] tracking-[0.14em] text-muted-foreground uppercase transition-colors hover:border-gold hover:text-gold"
          >
            ← Back
          </button>
          {tab !== "chronicles" && (
            <button
              type="button"
              onClick={() => setTab("chronicles")}
              className="rounded-md border border-gold/50 px-4 py-2 text-[12px] tracking-[0.14em] text-gold uppercase transition-colors hover:bg-primary/20"
            >
              ← Back to Stories
            </button>
          )}
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {(
            [
              ["chronicles", `Chronicles (${chronicles.length})`],
              ["predictions", `Predictions (${predictions.length})`],
              ["patterns", `Patterns (${patterns.length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-full border px-5 py-2 text-[12px] tracking-[0.14em] uppercase transition-colors ${
                tab === key
                  ? "border-gold bg-primary/25 text-gold"
                  : "border-border text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "chronicles" &&
          (chronicles.length === 0 ? (
            <EmptyState
              text="No chronicles yet. Write your first daily chronicle to start your timeline."
              href="/chronicle"
              cta="Start Chronicle"
            />
          ) : (
            <ol className="relative space-y-4 border-l border-border/60 pl-8">
              {chronicles.map((c) => (
                <li key={c.id} className="relative">
                  <span className="absolute top-2 -left-[37px] h-3 w-3 rounded-full border-2 border-gold bg-background" />
                  <div className="panel-fate rounded-2xl p-6">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-[12px] tracking-[0.16em] text-gold uppercase">
                        {c.date}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {c.primaryEmotion} · {c.eventSignificance}
                      </span>
                    </div>
                    {c.events && (
                      <p className="mt-3 text-[14px] leading-7 text-foreground/90">{c.events}</p>
                    )}
                    {c.actions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {c.actions.map((a) => (
                          <span
                            key={a}
                            className="rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          ))}

        {tab === "predictions" &&
          (predictions.length === 0 ? (
            <EmptyState text="No predictions yet." href="/chronicle" cta="Generate One" />
          ) : (
            <div className="space-y-4">
              {predictions.map((p) => {
                const v = verifiedMap.get(p.id);
                return (
                  <Link
                    key={p.id}
                    to="/result/$predictionId"
                    params={{ predictionId: p.id }}
                    className="panel-fate block rounded-2xl p-6 transition-colors hover:border-gold/60"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-[11px] tracking-[0.16em] text-gold uppercase">
                        {CATEGORIES[p.category]} · {p.date}
                      </span>
                      <div className="flex gap-2">
                        <span className="rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground">
                          {Math.round(p.probability * 100)}%
                        </span>
                        {v ? (
                          <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[11px] text-gold">
                            {VERIFY_LABEL[v]}
                          </span>
                        ) : (
                          <span className="rounded-full border border-primary/40 px-3 py-1 text-[11px] text-violet-glow">
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="mt-3 text-[14px] leading-7">{p.prediction}</p>
                    {!v && (
                      <span className="mt-3 inline-block text-[12px] tracking-[0.14em] text-violet-glow uppercase">
                        Verify now →
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}

        {tab === "patterns" &&
          (patterns.length === 0 ? (
            <EmptyState
              text="No patterns detected yet. Patterns need at least 2 matching chronicles."
              href="/chronicle"
              cta="Add a Chronicle"
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {patterns.map((p) => (
                <div key={p.id} className="panel-fate rounded-2xl p-6">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] tracking-[0.16em] text-gold uppercase">
                      Pattern
                    </span>
                    <span className="text-[11px] text-muted-foreground">{p.occurrences}×</span>
                  </div>
                  <h3 className="mt-3 font-display text-xl">{p.label}</h3>
                  <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
                    {p.description}
                  </p>
                  <div className="mt-4 h-1.5 rounded-full bg-muted">
                    <div
                      className="h-1.5 rounded-full bg-[image:var(--gradient-hero)]"
                      style={{ width: `${p.strength}%` }}
                    />
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    Strength {p.strength}% · {p.firstSeen} → {p.lastSeen}
                  </div>
                </div>
              ))}
            </div>
          ))}
      </WalletGate>
    </PageShell>
  );
}

function EmptyState({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <div className="panel-fate rounded-2xl p-10 text-center">
      <p className="text-[14px] leading-7 text-muted-foreground">{text}</p>
      <Link
        to={href as never}
        className="mt-5 inline-block rounded-md border border-gold/50 px-6 py-3 text-[12px] tracking-[0.18em] uppercase"
      >
        {cta}
      </Link>
    </div>
  );
}
