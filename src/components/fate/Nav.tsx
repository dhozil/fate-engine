import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ConnectWalletButton, useWallet } from "./wallet";
import { getPredictionsFor } from "@/lib/fate/engine";

const links = [
  { label: "Home", to: "/" },
  { label: "How It Works", to: "/how-it-works" },
  { label: "Chronicle", to: "/chronicle" },
  { label: "History", to: "/history" },
  { label: "Fate Profile", to: "/fate-profile" },
  { label: "Leaderboard", to: "/leaderboard" },
  { label: "Docs", to: "/docs" },
] as const;

export function Nav() {
  const { address } = useWallet();

  const pendingCount = useMemo(
    () => (address ? getPredictionsFor(address).filter((p) => p.status === "active").length : 0),
    [address],
  );

  return (
    <header className="relative z-30 mx-auto flex w-full max-w-[1500px] flex-wrap items-center justify-between gap-4 px-6 py-6">
      <Link to="/" className="flex items-center gap-3">
        <span className="text-3xl text-gold">✦</span>
        <span className="leading-tight">
          <span className="block font-display text-2xl tracking-[0.18em] text-gold uppercase">
            Fate Engine
          </span>
          <span className="block text-[11px] tracking-[0.12em] text-muted-foreground">
            AI Consensus Prediction Game
          </span>
        </span>
      </Link>

      <nav className="hidden items-center gap-8 lg:flex">
        {links.map((l) => (
          <Link
            key={l.label}
            to={l.to}
            className="text-[13px] tracking-[0.14em] text-muted-foreground uppercase transition-colors hover:text-gold"
            activeProps={{ className: "text-gold" }}
            activeOptions={{ exact: l.to === "/" }}
          >
            {l.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        {pendingCount > 0 && (
          <Link
            to="/history"
            className="hidden items-center gap-2 rounded-full border border-gold/50 bg-gold/10 px-4 py-2 text-[11px] tracking-[0.14em] text-gold uppercase sm:flex"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />
            {pendingCount} pending
          </Link>
        )}
        <ConnectWalletButton />
        <Link
          to="/chronicle"
          className="rounded-md border border-primary/60 bg-primary/15 px-6 py-3 text-[12px] tracking-[0.2em] uppercase shadow-[var(--shadow-glow)] transition-colors hover:bg-primary/30"
        >
          {address ? "Play Now" : "Enter Game"}
        </Link>
      </div>
    </header>
  );
}
