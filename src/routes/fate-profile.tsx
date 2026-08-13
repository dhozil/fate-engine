import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/fate/PageShell";
import { WalletGate, useWallet } from "@/components/fate/wallet";
import { buildProfile } from "@/lib/fate/metrics";

export const Route = createFileRoute("/fate-profile")({
  head: () => ({
    meta: [
      { title: "Fate Profile — Fate Engine" },
      {
        name: "description",
        content:
          "Your Fate Score, accuracy, streaks, dominant emotions and behavioural tendencies, derived from every chronicle you write.",
      },
      { property: "og:title", content: "Fate Profile — Fate Engine" },
      {
        property: "og:description",
        content: "Patterns, tendencies and life trajectory from your prediction history.",
      },
    ],
  }),
  component: FateProfile,
});

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel-fate rounded-2xl p-7 text-center">
      <div className="font-display text-4xl text-gold">{value}</div>
      <div className="mt-2 text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
        {label}
      </div>
    </div>
  );
}

function FateProfile() {
  const { address } = useWallet();

  const profile = useMemo(() => {
    if (!address) return null;
    return buildProfile(address);
  }, [address]);

  return (
    <PageShell
      eyebrow="Your Oracle"
      title="Fate Profile"
      intro="A living portrait built from your chronicles: how you feel, how you decide, and how accurately the consensus reads you."
    >
      <WalletGate>
        {!profile || profile.chronicleCount === 0 ? (
          <div className="panel-fate rounded-2xl p-10 text-center">
            <p className="text-[14px] leading-7 text-muted-foreground">
              No data yet. Write your first chronicle to build your Fate Profile.
            </p>
            <Link
              to="/chronicle"
              className="mt-5 inline-block rounded-md border border-gold/50 px-6 py-3 text-[12px] tracking-[0.18em] uppercase"
            >
              Start Chronicle
            </Link>
          </div>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Fate Score" value={profile.fateScore.toLocaleString()} />
              <MetricCard label="Accuracy" value={`${profile.accuracy}%`} />
              <MetricCard label="Current Streak" value={`${profile.streak} days`} />
              <MetricCard label="Chronicles" value={String(profile.chronicleCount)} />
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div className="panel-fate rounded-2xl p-7">
                <h2 className="font-display text-2xl">Oracle performance</h2>
                <div className="mt-5 grid grid-cols-2 gap-4 text-[13px]">
                  <PerfLine label="Predictions" value={profile.predictionCount} />
                  <PerfLine label="Confirmed" value={profile.confirmedCount} />
                  <PerfLine label="Partial" value={profile.partialCount} />
                  <PerfLine label="Missed" value={profile.missedCount} />
                  <PerfLine label="Calibration" value={`${profile.calibration}%`} />
                  <PerfLine label="Best streak" value={`${profile.bestStreak}d`} />
                </div>
              </div>

              <div className="panel-fate rounded-2xl p-7">
                <h2 className="font-display text-2xl">Badges</h2>
                {profile.badges.length === 0 ? (
                  <p className="mt-5 text-[13px] text-muted-foreground">
                    No badges yet. Keep recording and verifying to earn your first one.
                  </p>
                ) : (
                  <ul className="mt-5 flex flex-wrap gap-2">
                    {profile.badges.map((b) => (
                      <li
                        key={b}
                        className="rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-[11px] tracking-[0.14em] text-gold uppercase"
                      >
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="panel-fate mt-6 rounded-2xl p-8">
              <h2 className="font-display text-2xl">Behavioural tendencies</h2>
              <p className="mt-2 text-[12px] text-muted-foreground">
                Pattern signals, not psychological diagnosis.
              </p>
              <div className="mt-7 grid gap-x-10 gap-y-6 md:grid-cols-2">
                <Tendency label="Decision style" value={profile.profileSignals.decisionStyle} />
                <Tendency label="Social energy" value={profile.profileSignals.socialEnergy} />
                <Tendency label="Risk tendency" value={profile.profileSignals.riskTendency} />
                <Tendency label="Positive actions" value={profile.profileSignals.positiveActions} />
                <Tendency label="Impulsiveness" value={profile.profileSignals.impulsiveness} />
                <Tendency label="Consistency" value={profile.profileSignals.consistency} />
              </div>
            </div>
          </>
        )}
      </WalletGate>
    </PageShell>
  );
}

function PerfLine({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border/40 pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-gold">{value}</span>
    </div>
  );
}

function Tendency({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-gold">{value}%</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-muted">
        <div
          className="h-1.5 rounded-full bg-[image:var(--gradient-hero)]"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
