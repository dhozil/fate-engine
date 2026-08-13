import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/fate/PageShell";
import { WalletGate, useWallet } from "@/components/fate/wallet";
import { buildProfile } from "@/lib/fate/metrics";
import { shortAddress } from "@/components/fate/wallet";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — Fate Engine" },
      {
        name: "description",
        content:
          "The highest ranked oracles by Fate Score, prediction accuracy and verification streak.",
      },
      { property: "og:title", content: "Leaderboard — Fate Engine" },
      { property: "og:description", content: "Top oracles ranked by accuracy and Fate Score." },
    ],
  }),
  component: Leaderboard,
});

function Leaderboard() {
  const { address } = useWallet();

  const me = useMemo(() => (address ? buildProfile(address) : null), [address]);

  const accuracySort = (
    a: { name: string; score: number; acc: number; streak: number },
    b: typeof a,
  ) => b.acc - a.acc || b.score - a.score;

  const rows = useMemo(() => {
    const mine = me
      ? [
          {
            name: `${shortAddress(me.userId)} (you)`,
            score: me.fateScore,
            acc: me.accuracy,
            streak: me.streak,
            you: true,
          },
        ]
      : [];
    return mine.sort(accuracySort);
  }, [me]);

  return (
    <PageShell
      eyebrow="Ranking"
      title="Leaderboard"
      intro="Reputation is earned by being right about your own life — verified, not claimed."
    >
      <WalletGate>
        <div className="panel-fate rounded-2xl p-7">
          <h2 className="font-display text-2xl">Your standing</h2>
          {rows.length === 0 ? (
            <p className="mt-3 text-[13px] text-muted-foreground">
              No verified performance yet. Write a chronicle and verify tomorrow to enter the
              rankings.
            </p>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left text-[14px]">
                <thead>
                  <tr className="border-b border-border text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
                    <th className="px-4 py-4">#</th>
                    <th className="px-4 py-4">Oracle</th>
                    <th className="px-4 py-4">Fate Score</th>
                    <th className="px-4 py-4">Accuracy</th>
                    <th className="px-4 py-4">Streak</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.name} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-5 font-display text-xl text-gold">{i + 1}</td>
                      <td className="px-4 py-5">{r.name}</td>
                      <td className="px-4 py-5 text-violet-glow">{r.score}</td>
                      <td className="px-4 py-5">{r.acc}%</td>
                      <td className="px-4 py-5 text-muted-foreground">{r.streak} days</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-6 rounded-lg border border-border bg-background/30 px-4 py-3 text-[12px] leading-6 text-muted-foreground">
            The global leaderboard unlocks once predictions and verifications are committed
            on-chain. Configure <code className="text-gold">VITE_GENLAYER_CONTRACT</code> and deploy
            the Intelligent Contract to enable cross-wallet rankings.
          </div>
        </div>
      </WalletGate>
    </PageShell>
  );
}
