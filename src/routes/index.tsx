import { createFileRoute, Link } from "@tanstack/react-router";
import heroOrb from "@/assets/hero-orb.jpg";
import { Nav } from "@/components/fate/Nav";
import { Footer } from "@/components/fate/Footer";
import {
  BookOpen,
  BrainCircuit,
  Network,
  Orbit,
  ShieldCheck,
  Feather,
  Smile,
  Target,
  Sparkles,
  BarChart3,
  BadgeCheck,
  Clock,
  CalendarDays,
  Compass,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fate Engine — AI Consensus Prediction Game on GenLayer" },
      {
        name: "description",
        content:
          "Share your day, emotions, and decisions. Multiple AI agents reach consensus on GenLayer to reveal your probable future — verified on-chain.",
      },
      { property: "og:title", content: "Fate Engine — AI Consensus Prediction Game" },
      {
        property: "og:description",
        content:
          "Turn your daily chronicle into verifiable probabilistic forecasts through multi-agent AI consensus.",
      },
    ],
  }),
  component: Index,
});

const stats = [
  { value: "4", label: "AI Agents" },
  { value: "1", label: "Consensus Layer" },
  { value: "24H", label: "Core Horizon" },
  { value: "5", label: "Categories" },
];

const pillars = [
  {
    icon: Feather,
    title: "Daily Chronicle",
    body: "Share your daily events, actions, emotions, and decisions.",
  },
  {
    icon: Smile,
    title: "Emotions & Intensity",
    body: "Choose how you feel and how strong that feeling is.",
  },
  {
    icon: Target,
    title: "AI Consensus",
    body: "Multiple AI agents analyze and reach a decentralized consensus.",
  },
  {
    icon: Orbit,
    title: "Future Prediction",
    body: "Get a probabilistic forecast for the next 24 hours.",
  },
  {
    icon: BadgeCheck,
    title: "Verify & Earn",
    body: "Verify the result tomorrow and earn Fate Score.",
  },
  {
    icon: BarChart3,
    title: "Fate Profile",
    body: "Discover your patterns, tendencies, and life trajectory.",
  },
];

const horizons = [
  { icon: Clock, value: "24H", label: "Tomorrow Prediction" },
  { icon: Target, value: "4", label: "AI Agents" },
  { icon: ShieldCheck, value: "5", label: "Categories" },
  { icon: BadgeCheck, value: "100%", label: "On-chain" },
];

const orbitals = [
  { icon: BookOpen, label: "Your Story", pos: "left-[8%] top-[14%]" },
  { icon: BrainCircuit, label: "AI Consensus", pos: "left-1/2 top-0 -translate-x-1/2" },
  { icon: Network, label: "Multi AI Agents", pos: "right-[8%] top-[14%]" },
  { icon: Orbit, label: "Future Prediction", pos: "left-[4%] bottom-[10%]" },
  { icon: ShieldCheck, label: "On-chain Verification", pos: "right-[4%] bottom-[10%]" },
];

const stars = Array.from({ length: 46 }, (_, i) => ({
  x: (i * 37.5) % 100,
  y: (i * 61.3) % 100,
  size: 1 + ((i * 7) % 3),
  delay: ((i * 13) % 40) / 10,
}));

function Index() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[900px] bg-[radial-gradient(80%_60%_at_60%_10%,color-mix(in_oklab,var(--primary)_28%,transparent),transparent_70%)]" />

      <Nav />

      <main className="relative z-10 mx-auto max-w-[1500px] px-6 pb-20">
        {/* HERO */}
        <section className="grid items-center gap-10 py-6 lg:grid-cols-[1fr_1.15fr]">
          <div>
            <h1 className="font-display text-6xl leading-[1.05] tracking-tight md:text-7xl">
              Your Actions Today,
              <br />
              Your <span className="text-gradient-fate italic">Future</span> Tomorrow.
            </h1>

            <div className="mt-8 flex items-center gap-3">
              <span className="text-gold">✦</span>
              <span className="h-px w-24 bg-gradient-to-r from-gold to-transparent" />
            </div>

            <p className="mt-8 max-w-md text-[15px] leading-8 text-muted-foreground">
              Fate Engine is a decentralized AI prediction game. Share your day, emotions, and
              decisions. Our AI Consensus will reveal the possibilities that await you.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                to="/chronicle"
                className="rounded-md border border-gold/50 bg-[image:var(--gradient-hero)] px-8 py-4 text-[12px] font-medium tracking-[0.2em] text-primary-foreground uppercase shadow-[var(--shadow-glow)] transition-transform hover:-translate-y-0.5"
              >
                Start Your Chronicle
              </Link>
              <Link
                to="/features"
                className="inline-flex items-center gap-3 rounded-md border border-border px-8 py-4 text-[12px] tracking-[0.2em] uppercase transition-colors hover:border-gold hover:text-gold"
              >
                Explore Features <span>→</span>
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="relative overflow-hidden rounded-2xl">
              {/* twinkling starfield */}
              <div className="pointer-events-none absolute inset-0 z-10">
                {stars.map((s, i) => (
                  <span
                    key={i}
                    className="animate-twinkle absolute rounded-full bg-gold"
                    style={{
                      left: `${s.x}%`,
                      top: `${s.y}%`,
                      width: s.size,
                      height: s.size,
                      animationDelay: `${s.delay}s`,
                    }}
                  />
                ))}
              </div>

              <div className="animate-orb-float relative">
                <img
                  src={heroOrb}
                  alt="Cosmic crystal ball surrounded by constellation rings representing the Fate Engine AI consensus"
                  width={1280}
                  height={1024}
                  className="w-full opacity-95"
                />
                {/* rotating orbital rings around the universe center */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="animate-orb-pulse absolute h-[34%] w-[34%] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--violet-glow)_55%,transparent),transparent_70%)] blur-xl" />
                  <span className="animate-orb-spin absolute h-[46%] w-[46%] rounded-full border border-gold/30 [transform:rotateX(72deg)]" />
                  <span className="animate-orb-spin-rev absolute h-[62%] w-[62%] rounded-full border border-primary/30 [transform:rotateX(66deg)_rotateZ(24deg)]" />
                  <span className="animate-orb-spin absolute h-[78%] w-[78%] rounded-full border border-gold/15 [transform:rotateX(78deg)_rotateZ(-18deg)]" />
                </div>
              </div>

              <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_50%,transparent,var(--background))]" />

              {orbitals.map((o, i) => (
                <div
                  key={o.label}
                  className={`animate-orbital-drift absolute hidden flex-col items-center gap-2 text-center md:flex ${o.pos}`}
                  style={{ animationDelay: `${i * 0.8}s` }}
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-full border border-gold/40 bg-background/60 text-gold backdrop-blur-sm">
                    <o.icon className="h-6 w-6" strokeWidth={1.3} />
                  </span>
                  <span className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                    {o.label}
                  </span>
                </div>
              ))}
            </div>

            <div className="panel-fate mt-6 grid grid-cols-2 gap-5 rounded-xl p-6 lg:absolute lg:top-1/2 lg:-right-4 lg:mt-0 lg:w-56 lg:-translate-y-1/2 lg:grid-cols-1">
              {stats.map((s) => (
                <div key={s.label} className="flex items-center gap-3">
                  <span className="text-gold">✧</span>
                  <div>
                    <div className="font-display text-2xl text-gold">{s.value}</div>
                    <div className="text-[11px] text-muted-foreground">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PILLARS */}
        <section className="panel-fate mt-16 grid divide-border rounded-2xl md:grid-cols-3 md:divide-x lg:grid-cols-6">
          {pillars.map((p) => (
            <article key={p.title} className="px-6 py-10 text-center">
              <p.icon className="mx-auto mb-4 h-7 w-7 text-violet-glow" strokeWidth={1.3} />
              <h2 className="mb-3 text-[15px] text-violet-glow">{p.title}</h2>
              <p className="text-[13px] leading-6 text-muted-foreground">{p.body}</p>
            </article>
          ))}
        </section>

        {/* QUOTE + HORIZONS */}
        <section className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="panel-fate grid gap-8 rounded-2xl p-8 md:grid-cols-[1fr_1.3fr] md:items-center">
            <blockquote className="text-[15px] leading-7">
              <span className="mr-2 font-display text-3xl text-gold">“</span>
              It's not magic.
              <br />
              It's the power of your choices,
              <br />
              analyzed by decentralized intelligence.
              <footer className="mt-3 text-[12px] tracking-[0.16em] text-muted-foreground uppercase">
                — Fate Engine
              </footer>
            </blockquote>

            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              {horizons.map((h) => (
                <div key={h.value} className="text-center">
                  <h.icon className="mx-auto mb-1 h-5 w-5 text-gold" strokeWidth={1.3} />
                  <div className="font-display text-2xl text-gold">{h.value}</div>
                  <div className="text-[11px] text-muted-foreground">{h.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel-fate flex items-center gap-5 rounded-2xl p-8">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-gold/40 text-2xl text-gold">
              ✦
            </span>
            <p className="text-[14px] leading-7 text-muted-foreground">
              Every choice creates a signal. Every signal shapes your fate. Every day brings you
              closer to understanding your future.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
