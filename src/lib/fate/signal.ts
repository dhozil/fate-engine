import type { DailyChronicle, FateSignal, Level, Significance } from "./types";

const POSITIVE_EMOTIONS = new Set([
  "Happy",
  "Calm",
  "Excited",
  "Confident",
  "Curious",
  "Grateful",
  "Hopeful",
  "Proud",
  "Motivated",
]);

const NEGATIVE_EMOTIONS = new Set([
  "Sad",
  "Angry",
  "Anxious",
  "Disappointed",
  "Afraid",
  "Frustrated",
  "Lonely",
  "Overwhelmed",
]);

const SOCIAL_ACTIONS = new Set([
  "Socialized",
  "Helped someone",
  "Met someone new",
  "Argued with someone",
]);

const SOCIAL_GOOD = new Set([
  "Helped someone",
  "Donated",
  "Apologized",
  "Kept a promise",
  "Helped family",
  "Supported a friend",
  "Was honest",
  "Did something kind",
]);

function clamp(n: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, n));
}

function levelFromScore(score: number): Level {
  if (score >= 0.66) return "high";
  if (score >= 0.34) return "medium";
  return "low";
}

function significanceWeight(s: Significance): number {
  switch (s) {
    case "Minor":
      return 0.25;
    case "Moderate":
      return 0.5;
    case "Major":
      return 0.8;
    case "Life-changing":
      return 1;
  }
}

export function buildFateSignal(c: DailyChronicle, now = new Date()): FateSignal {
  const intensityFactor = c.emotionIntensity / 10;

  let emotionalScore = 0.5;
  if (POSITIVE_EMOTIONS.has(c.primaryEmotion)) emotionalScore += 0.2 + 0.15 * intensityFactor;
  if (NEGATIVE_EMOTIONS.has(c.primaryEmotion)) emotionalScore -= 0.2 + 0.15 * intensityFactor;
  if (c.secondaryEmotion && POSITIVE_EMOTIONS.has(c.secondaryEmotion)) emotionalScore += 0.08;
  if (c.secondaryEmotion && NEGATIVE_EMOTIONS.has(c.secondaryEmotion)) emotionalScore -= 0.08;
  if (c.secondaryEmotion && c.primaryEmotion !== c.secondaryEmotion) emotionalScore += 0.05;
  emotionalScore = clamp(emotionalScore);

  const emotionalState: FateSignal["emotionalState"] =
    emotionalScore >= 0.62
      ? "positive"
      : emotionalScore <= 0.38
        ? "negative"
        : emotionalScore >= 0.45
          ? "mixed"
          : "neutral";

  const socialEnergyScore = clamp(
    c.actions.filter((a) => SOCIAL_ACTIONS.has(a)).length / 3 +
      c.goodActions.filter((a) => SOCIAL_GOOD.has(a)).length / 5,
  );

  const decisionPressureScore = clamp(
    (c.decisions.length > 0 ? 0.4 : 0) +
      (c.intent === "Because of pressure" || c.intent === "Because I had to" ? 0.35 : 0) +
      significanceWeight(c.eventSignificance) * 0.3 +
      (c.emotionIntensity >= 7 ? 0.15 : 0),
  );

  const riskScore = clamp(
    c.decisions.reduce((sum, d) => sum + d.risk / 10, 0) / Math.max(1, c.decisions.length) +
      (c.actions.includes("Took a risk") ? 0.2 : 0) +
      (c.negativeActions.includes("Took unnecessary risk") ? 0.15 : 0),
  );

  const positiveActionsCount = c.goodActions.length;
  const negativeActionsCount = c.negativeActions.length;
  const momentumScore = clamp(
    (positiveActionsCount * 0.2 - negativeActionsCount * 0.2 + 0.5 + (emotionalScore - 0.5) * 0.6) *
      0.9,
  );
  const positiveMomentum: FateSignal["positiveMomentum"] =
    momentumScore >= 0.66 ? "strong" : momentumScore >= 0.4 ? "moderate" : "weak";

  const unresolvedIssues = c.negativeActions.filter((n) =>
    [
      "Procrastinated",
      "Avoided responsibility",
      "Lied",
      "Hurt someone",
      "Broke a promise",
    ].includes(n),
  ).length;

  return {
    emotionalState,
    emotionalScore: Math.round(emotionalScore * 100),
    primaryEmotion: c.primaryEmotion,
    ...(c.secondaryEmotion ? { secondaryEmotion: c.secondaryEmotion } : {}),
    emotionalIntensity: c.emotionIntensity,
    mood: c.mood,
    socialEnergy: levelFromScore(socialEnergyScore),
    decisionPressure: levelFromScore(decisionPressureScore),
    riskLevel: levelFromScore(riskScore),
    positiveMomentum,
    positiveActions: positiveActionsCount,
    negativeActions: negativeActionsCount,
    regretLevel: c.regretLevel,
    positiveActionImportance: c.positiveActionImportance,
    unresolvedIssues,
    eventSignificance: c.eventSignificance,
    generatedAt: now.toISOString(),
  };
}
