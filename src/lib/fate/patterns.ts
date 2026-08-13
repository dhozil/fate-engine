import { getChronicles, getPatterns, savePatterns } from "./store";
import type { DailyChronicle, Pattern } from "./types";

function daysBetween(a: string, b: string): number {
  return (
    Math.abs(new Date(`${a}T00:00:00`).getTime() - new Date(`${b}T00:00:00`).getTime()) / 86400000
  );
}

export function detectPatterns(wallet: string): Pattern[] {
  const chronicles = getChronicles(wallet);
  const sorted = [...chronicles].sort((a, b) => a.date.localeCompare(b.date));
  const existing = getPatterns(wallet);
  const now = new Date().toISOString();

  const patterns: Pattern[] = [];

  const recurring = (
    type: Pattern["type"],
    label: string,
    description: string,
    check: (c: DailyChronicle) => boolean,
  ) => {
    const hits = sorted.filter(check);
    const occurrences = hits.length;
    if (occurrences < 2) return;

    const firstSeen = hits[0]?.date ?? sorted[0]?.date ?? "";
    const lastSeen = hits[hits.length - 1]?.date ?? firstSeen;
    const span = daysBetween(firstSeen, lastSeen);
    const strength = span > 0 ? Math.min(1, (occurrences - 1) / Math.max(1, span / 3)) : 0;

    const prior = existing.find((p) => p.type === type);
    patterns.push({
      id: prior?.id ?? `pat_${type}_${Date.now()}`,
      userId: wallet,
      type,
      label,
      description,
      strength: Math.round(strength * 100),
      firstSeen,
      lastSeen,
      occurrences,
      createdAt: prior?.createdAt ?? now,
    });
  };

  recurring(
    "recurring_social_conflict",
    "Recurring social conflict",
    "Similar interpersonal conflicts have appeared repeatedly within your recent timeline.",
    (c) => c.actions.includes("Argued with someone") || c.negativeActions.includes("Argued"),
  );

  recurring(
    "repeated_spending",
    "Repeated spending",
    "Money-related decisions keep recurring in your chronicle.",
    (c) => c.actions.includes("Spent money") || c.negativeActions.includes("Wasted money"),
  );

  recurring(
    "repeated_procrastination",
    "Repeated procrastination",
    "Avoidance and delay patterns keep appearing.",
    (c) => c.negativeActions.includes("Procrastinated") || c.actions.includes("Avoided a problem"),
  );

  recurring(
    "positive_productivity_streak",
    "Positive productivity streak",
    "You keep completing and starting new things — a productive trajectory is building.",
    (c) => c.actions.includes("Finished something") || c.actions.includes("Started something new"),
  );

  recurring(
    "recurring_emotional_state",
    "Recurring emotional state",
    "The same dominant emotional tone keeps returning across your timeline.",
    (c) => c.primaryEmotion !== "Neutral",
  );

  recurring(
    "repeated_risk_taking",
    "Repeated risk-taking",
    "High-risk decisions appear repeatedly in your chronicle.",
    (c) => c.actions.includes("Took a risk") || c.decisions.some((d) => d.risk >= 7),
  );

  recurring(
    "repeated_opportunity",
    "Repeated opportunity",
    "New beginnings and chance events keep showing up in your timeline.",
    (c) => c.actions.includes("Started something new") || c.unexpectedEvent.occurred,
  );

  if (patterns.length > 0) savePatterns(wallet, patterns);
  return patterns;
}

export function getPatternsFor(wallet: string): Pattern[] {
  return getPatterns(wallet);
}
