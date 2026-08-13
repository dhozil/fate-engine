import { buildFateSignal } from "./signal";
import { getChronicles } from "./store";
import type { DailyChronicle, HistoryContext } from "./types";

const EMOTION_WEIGHT: Record<string, number> = {
  Happy: 1,
  Calm: 0.8,
  Excited: 1,
  Confident: 0.9,
  Curious: 0.7,
  Grateful: 0.9,
  Hopeful: 0.8,
  Proud: 1,
  Motivated: 1,
  Neutral: 0.5,
  Confused: 0.4,
  Tired: 0.3,
  Sad: 0.1,
  Angry: 0.1,
  Anxious: 0.2,
  Disappointed: 0.15,
  Afraid: 0.1,
  Frustrated: 0.2,
  Lonely: 0.15,
  Overwhelmed: 0.2,
};

function levelFrom(score: number): "low" | "medium" | "high" {
  if (score >= 0.66) return "high";
  if (score >= 0.34) return "medium";
  return "low";
}

/**
 * Builds a compact, privacy-safe summary of the user's recent history (last 7
 * days by default). Only derived aggregates leave the browser — never raw
 * journal text (spec 19 & 22).
 */
export function buildHistoryContext(wallet: string, days = 7): HistoryContext {
  const all = getChronicles(wallet);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const recent = all
    .filter((c) => new Date(`${c.date}T00:00:00`) >= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (recent.length === 0) {
    return {
      recentDays: days,
      avgEmotionalScore: 50,
      dominantEmotion: "",
      recurringCategories: [],
      positiveTrend: false,
      riskTendency: "medium",
      socialEnergy: "medium",
      recentProductivity: "medium",
      count: 0,
    };
  }

  let scoreSum = 0;
  const emotionCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  let riskSum = 0;
  let socialSum = 0;
  let productivitySum = 0;
  let scoreTrend = 0;

  recent.forEach((c, i) => {
    const signal = buildFateSignal(c, new Date(`${c.date}T12:00:00`));
    scoreSum += signal.emotionalScore;
    emotionCounts.set(signal.primaryEmotion, (emotionCounts.get(signal.primaryEmotion) ?? 0) + 1);

    categoryCounts.set(c.actions[0] ?? "event", 1);

    riskSum += signal.riskLevel === "high" ? 1 : signal.riskLevel === "medium" ? 0.5 : 0.15;
    socialSum += signal.socialEnergy === "high" ? 1 : signal.socialEnergy === "medium" ? 0.5 : 0.2;
    productivitySum +=
      c.actions.includes("Finished something") || c.actions.includes("Started something new")
        ? 1
        : 0.3;

    if (i > 0) {
      const prev = buildFateSignal(recent[i - 1]!, new Date(`${recent[i - 1]!.date}T12:00:00`));
      scoreTrend += signal.emotionalScore - prev.emotionalScore;
    }
  });

  const n = recent.length;
  const avgEmotionalScore = Math.round(scoreSum / n);
  const dominantEmotion =
    Array.from(emotionCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  const recurringCategories = Array.from(categoryCounts.entries())
    .filter(([, v]) => v >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);

  return {
    recentDays: days,
    avgEmotionalScore,
    dominantEmotion,
    recurringCategories,
    positiveTrend: scoreTrend >= 0,
    riskTendency: levelFrom(riskSum / n),
    socialEnergy: levelFrom(socialSum / n),
    recentProductivity: levelFrom(productivitySum / n),
    count: n,
  };
}

export function emotionTone(e: string): number {
  return EMOTION_WEIGHT[e] ?? 0.5;
}
