import { getChronicles, getPredictions, getProfile, getVerifications } from "./store";
import type {
  DailyChronicle,
  Prediction,
  UserProfile,
  Verification,
  VerificationResult,
} from "./types";

export interface PerformanceStats {
  predictionCount: number;
  confirmedCount: number;
  partialCount: number;
  missedCount: number;
  notSureCount: number;
  accuracy: number;
  calibration: number;
  streak: number;
  bestStreak: number;
  challengeCount: number;
  challengeWins: number;
}

export function scoreResult(result: VerificationResult): number {
  switch (result) {
    case "confirmed":
      return 1;
    case "partial":
      return 0.5;
    case "missed":
      return 0;
    case "not_sure":
      return 0;
  }
}

export function computeAccuracy(vs: Verification[]): number {
  if (vs.length === 0) return 0;
  const weighted = vs.reduce((sum, v) => sum + scoreResult(v.result), 0);
  return Math.round((weighted / vs.length) * 1000) / 10;
}

export function computeCalibration(vs: Verification[], preds: Prediction[]): number {
  if (vs.length < 3) return 0;
  let scoreSum = 0;
  let count = 0;
  vs.forEach((v) => {
    const p = preds.find((x) => x.id === v.predictionId);
    if (!p) return;
    const actual = scoreResult(v.result);
    // Brier-style: better when predicted probability matches outcome.
    const brier = Math.pow(actual - p.probability, 2);
    scoreSum += 1 - brier;
    count += 1;
  });
  if (count === 0) return 0;
  return Math.round((scoreSum / count) * 100);
}

export function computeStreak(chronicles: DailyChronicle[], today = new Date()): number {
  const dates = new Set(chronicles.map((c) => c.date));
  let streak = 0;
  const cursor = new Date(today);
  // Only count if today's chronicle exists (or yesterday's, for partial day).
  while (dates.has(toKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function bestStreak(chronicles: DailyChronicle[]): number {
  const dates = new Set(chronicles.map((c) => c.date));
  const sorted = [...dates].sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  sorted.forEach((d) => {
    const cur = new Date(`${d}T00:00:00`);
    if (prev && cur.getTime() - prev.getTime() === 86400000) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > best) best = run;
    prev = cur;
  });
  return best;
}

function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function computePerformance(wallet: string): PerformanceStats {
  const predictions = getPredictions(wallet);
  const verifications = getVerifications(wallet);
  const chronicles = getChronicles(wallet);

  const confirmedCount = verifications.filter((v) => v.result === "confirmed").length;
  const partialCount = verifications.filter((v) => v.result === "partial").length;
  const missedCount = verifications.filter((v) => v.result === "missed").length;
  const notSureCount = verifications.filter((v) => v.result === "not_sure").length;

  const challengeCount = predictions.filter((p) => p.challenge === "challenged").length;
  const challengeWins = verifications.filter(
    (v) =>
      (v.result === "confirmed" || v.result === "partial") &&
      predictions.find((p) => p.id === v.predictionId)?.challenge === "challenged",
  ).length;

  return {
    predictionCount: predictions.length,
    confirmedCount,
    partialCount,
    missedCount,
    notSureCount,
    accuracy: computeAccuracy(verifications),
    calibration: computeCalibration(verifications, predictions),
    streak: computeStreak(chronicles),
    bestStreak: bestStreak(chronicles),
    challengeCount,
    challengeWins,
  };
}

export function computeFateScore(perf: PerformanceStats): number {
  let score = 0;
  score += perf.accuracy * 10; // accuracy weight
  score += perf.confirmedCount * 25;
  score += perf.partialCount * 10;
  score += perf.challengeWins * 40;
  score += Math.min(perf.streak, 30) * 15;
  score += Math.min(perf.predictionCount, 100);
  return Math.round(score);
}

export function computeProfileSignals(wallet: string): UserProfile["profileSignals"] {
  const chronicles = getChronicles(wallet);
  const predictions = getPredictions(wallet);

  const n = chronicles.length || 1;

  const decisionStyle = Math.min(
    100,
    Math.round(
      (predictions.reduce(
        (s, p) => s + (p.confidence === "high" ? 1 : p.confidence === "medium" ? 0.5 : 0.25),
        0,
      ) /
        Math.max(1, predictions.length)) *
        100,
    ),
  );

  const riskTendency = Math.min(
    100,
    Math.round(
      chronicles.reduce((s, c) => {
        const avgRisk =
          c.decisions.reduce((a, d) => a + d.risk, 0) / Math.max(1, c.decisions.length);
        const risk = (avgRisk / 10) * 0.7 + (c.actions.includes("Took a risk") ? 0.3 : 0);
        return s + risk * 100;
      }, 0) / n,
    ),
  );

  const positiveActions = Math.min(
    100,
    Math.round(
      chronicles.reduce((s, c) => {
        const good = c.goodActions.length;
        const bad = c.negativeActions.length;
        const balance = (good - bad + 4) / 8;
        return s + Math.max(0, Math.min(1, balance)) * 100;
      }, 0) / n,
    ),
  );

  const impulsiveness = Math.min(
    100,
    Math.round(
      chronicles.reduce((s, c) => {
        const imp =
          (c.emotionIntensity / 10) * 0.5 +
          (c.negativeActions.includes("Made an impulsive decision") ? 0.3 : 0) +
          (c.actions.includes("Took a risk") ? 0.2 : 0);
        return s + Math.min(1, imp) * 100;
      }, 0) / n,
    ),
  );

  const consistency = Math.min(100, Math.round((n / 30) * 100));
  const socialEnergy = Math.min(
    100,
    Math.round(
      chronicles.reduce((s, c) => {
        const social =
          (c.actions.filter((a) => ["Socialized", "Met someone new", "Helped someone"].includes(a))
            .length /
            3) *
            0.6 +
          (c.importantPersonCategory ? 0.4 : 0);
        return s + Math.min(1, social) * 100;
      }, 0) / n,
    ),
  );

  return {
    decisionStyle,
    socialEnergy,
    riskTendency,
    positiveActions,
    impulsiveness,
    consistency,
  };
}

export function buildProfile(wallet: string): UserProfile {
  const perf = computePerformance(wallet);
  const signals = computeProfileSignals(wallet);
  const existing = getProfile(wallet);
  const now = new Date().toISOString();

  return {
    userId: wallet,
    fateScore: computeFateScore(perf),
    predictionCount: perf.predictionCount,
    confirmedCount: perf.confirmedCount,
    partialCount: perf.partialCount,
    missedCount: perf.missedCount,
    notSureCount: perf.notSureCount,
    accuracy: perf.accuracy,
    calibration: perf.calibration,
    streak: perf.streak,
    bestStreak: perf.bestStreak,
    chronicleCount: getChronicles(wallet).length,
    challengeCount: perf.challengeCount,
    challengeWins: perf.challengeWins,
    profileSignals: signals,
    badges: computeBadges(perf),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export function computeBadges(perf: PerformanceStats): string[] {
  const badges: string[] = [];
  if (perf.predictionCount >= 1) badges.push("FIRST READING");
  if (perf.confirmedCount >= 10) badges.push("SEER");
  if (perf.streak >= 7) badges.push("CONSISTENT");
  if (perf.accuracy >= 70) badges.push("CALIBRATED");
  if (perf.confirmedCount >= 100) badges.push("ORACLE");
  return badges;
}

export function clampProb(p: number, min = 0.05, max = 0.95): number {
  return Math.min(max, Math.max(min, p));
}

/**
 * Probability recalibration (spec 12).
 *
 * Uses the user's verified history to nudge the raw consensus probability toward
 * their personal base rate, so the engine becomes better calibrated over time.
 *
 * - With little data (< 4 verified), the raw value is kept (avoid overfitting).
 * - If the user's outcomes consistently beat the predicted probability, the
 *   estimate is nudged up; if they consistently miss, it is pulled down.
 */
export function recalibrateProbability(
  wallet: string,
  rawProbability: number,
  weight = 0.25,
): number {
  const verifications = getVerifications(wallet);
  if (verifications.length < 4) return clampProb(rawProbability);

  const predictions = getPredictions(wallet);
  const resolved: number[] = [];
  verifications.forEach((v) => {
    if (v.result === "not_sure") return;
    const p = predictions.find((x) => x.id === v.predictionId);
    if (!p) return;
    resolved.push(scoreResult(v.result) - p.probability);
  });
  if (resolved.length < 4) return clampProb(rawProbability);

  // Mean residual = average(actual - predicted). Positive => underconfident.
  const meanResidual = resolved.reduce((a, b) => a + b, 0) / resolved.length;
  const adjusted = rawProbability + meanResidual * weight;
  return clampProb(Math.round(adjusted * 100) / 100);
}
