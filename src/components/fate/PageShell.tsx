import type { ReactNode } from "react";
import { Nav } from "./Nav";
import { Footer } from "./Footer";

export function PageShell({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[700px] bg-[radial-gradient(70%_60%_at_50%_0%,color-mix(in_oklab,var(--primary)_24%,transparent),transparent_70%)]" />
      <Nav />
      <main className="relative z-10 mx-auto max-w-[1200px] px-6 pt-10 pb-24">
        <p className="text-[11px] tracking-[0.24em] text-gold uppercase">{eyebrow}</p>
        <h1 className="mt-4 font-display text-5xl md:text-6xl">{title}</h1>
        <p className="mt-5 max-w-2xl text-[15px] leading-8 text-muted-foreground">{intro}</p>
        <div className="mt-14">{children}</div>
      </main>
      <Footer />
    </div>
  );
}
