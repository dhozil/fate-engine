import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/fate/PageShell";
import { WalletGate, useWallet } from "@/components/fate/wallet";
import { readLeaderboardOnchain, type OnchainLeaderboardRow } from "@/lib/fate/genlayer";
import { shortAddress } from "@/components/fate/wallet";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — Fate Engine" },
      {
        name: "description",
        content:
          "The highest ranked oracles by on-chain prediction accuracy, confirmed outcomes and Fate Score.",
      },
      { property: "og:title", content: "Leaderboard — Fate Engine" },
      { property: "og:description", content: "Top oracles ranked by on-chain accuracy." },
    ],
  }),
  component: Leaderboard,
});

function accuracyPct(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}

function Leaderboard() {
  const { address } = useWallet();
  const [rows, setRows] = useState<OnchainLeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    readLeaderboardOnchain()
      .then((data) => {
        if (!alive) return;
        if (data && data.length > 0) {
          setRows(data);
        } else {
          setRows([]);
        }
        setError(null);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load leaderboard.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [address]);

  const meHighlighted = useMemo(
    () => rows.findIndex((r) => r.address.toLowerCase() === address?.toLowerCase()),
    [rows, address],
  );

  return (
    <PageShell
      eyebrow="Ranking"
      title="Leaderboard"
      intro="Reputation is earned by being right about your own life — verified on-chain, not claimed."
    >
      <WalletGate>
        <div className="panel-fate rounded-2xl p-7">
          <h2 className="font-display text-2xl">Oracle ranking</h2>
          {loading ? (
            <p className="mt-4 text-[13px] text-muted-foreground">Reading on-chain leaderboard…</p>
          ) : rows.length === 0 ? (
            <div>
              <p className="mt-4 text-[13px] text-muted-foreground">
                No oracles ranked yet. Write a chronicle and verify tomorrow to enter the on-chain
                leaderboard.
              </p>
              {error && <p className="mt-2 text-[12px] text-destructive">{error}</p>}
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left text-[14px]">
                <thead>
                  <tr className="border-b border-border text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
                    <th className="px-4 py-4">#</th>
                    <th className="px-4 py-4">Oracle</th>
                    <th className="px-4 py-4">Predictions</th>
                    <th className="px-4 py-4">Confirmed</th>
                    <th className="px-4 py-4">Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const isMe = r.address.toLowerCase() === address?.toLowerCase();
                    return (
                      <tr
                        key={r.address}
                        className={`border-b border-border/50 last:border-0 ${
                          isMe ? "bg-gold/5" : ""
                        }`}
                      >
                        <td className="px-4 py-5 font-display text-xl text-gold">{i + 1}</td>
                        <td className="px-4 py-5">
                          {shortAddress(r.address)}
                          {isMe ? (
                            <span className="ml-2 rounded-full border border-gold/50 bg-gold/10 px-2 py-0.5 text-[10px] tracking-wide text-gold uppercase">
                              you
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-5">{r.predictions}</td>
                        <td className="px-4 py-5 text-violet-glow">{r.confirmed}</td>
                        <td className="px-4 py-5">{accuracyPct(r.accuracy_bps)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {meHighlighted === -1 && !loading && rows.length > 0 && (
            <div className="mt-4 rounded-lg border border-border bg-background/30 px-4 py-3 text-[12px] leading-6 text-muted-foreground">
              Your address is not ranked yet. Complete a prediction and verify it to appear here.
            </div>
          )}
        </div>
      </WalletGate>
    </PageShell>
  );
}
