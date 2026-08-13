import type {
  AgentId,
  AgentInterpretation,
  DailyChronicle,
  FateSignal,
  HistoryContext,
  Impact,
  PredictionCategory,
} from "./types";

export interface AgentContext {
  chronicle: DailyChronicle;
  signal: FateSignal;
  history?: HistoryContext;
}

export interface AgentDef {
  id: AgentId;
  name: string;
  focus: string;
  interpret: (ctx: AgentContext) => AgentInterpretation;
}

function clamp(n: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, n));
}

function levelProb(base: number): number {
  return Math.round(clamp(base, 0.5, 0.9) * 100) / 100;
}

function confidenceFrom(prob: number, evidence: number): AgentInterpretation["confidence"] {
  const score = prob * 0.7 + Math.min(1, evidence / 4) * 0.3;
  if (score >= 0.72) return "high";
  if (score >= 0.6) return "medium";
  return "low";
}

function impactFrom(signal: FateSignal, extra = 0): Impact {
  const base =
    (signal.eventSignificance === "Life-changing"
      ? 1
      : signal.eventSignificance === "Major"
        ? 0.7
        : signal.eventSignificance === "Moderate"
          ? 0.4
          : 0.15) +
    signal.emotionalIntensity / 20;
  const score = clamp(base + extra);
  if (score >= 0.7) return "high";
  if (score >= 0.4) return "medium";
  return "low";
}

function categoryWeights(c: DailyChronicle): Record<PredictionCategory, number> {
  const w: Record<PredictionCategory, number> = {
    relationship: 0.2,
    finance: 0.2,
    career: 0.2,
    personal: 0.2,
    event: 0.2,
  };

  if (c.actions.includes("Socialized")) w.relationship += 0.2;
  if (c.actions.includes("Met someone new")) w.relationship += 0.3;
  if (c.actions.includes("Argued with someone")) w.relationship += 0.25;
  if (c.actions.includes("Helped someone")) w.relationship += 0.15;
  if (c.importantPersonCategory) w.relationship += 0.15;

  if (c.actions.includes("Spent money")) w.finance += 0.35;
  if (c.negativeActions.includes("Wasted money")) w.finance += 0.3;

  if (c.actions.includes("Worked")) w.career += 0.25;
  if (c.actions.includes("Studied")) w.career += 0.2;
  if (c.actions.includes("Started something new")) w.career += 0.15;
  if (c.actions.includes("Finished something")) w.career += 0.2;
  if (c.decisions.length > 0 && c.decisions.some((d) => d.importance >= 6)) w.career += 0.2;

  if (c.actions.includes("Exercised")) w.personal += 0.2;
  if (c.actions.includes("Rested")) w.personal += 0.15;
  if (c.actions.includes("Solved a problem")) w.personal += 0.15;
  if (c.actions.includes("Avoided a problem")) w.personal += 0.1;
  if (c.negativeActions.includes("Procrastinated")) w.personal += 0.2;
  if (c.goodActions.length > 0) w.personal += 0.1;

  if (c.unexpectedEvent.occurred) w.event += 0.4;
  if (c.eventSignificance === "Major" || c.eventSignificance === "Life-changing") w.event += 0.2;
  if (c.decisions.length > 0) w.event += 0.1;

  return w;
}

function pickCategory(w: Record<PredictionCategory, number>): PredictionCategory {
  let best: PredictionCategory = "event";
  let bestScore = -1;
  (Object.keys(w) as PredictionCategory[]).forEach((k) => {
    if (w[k] > bestScore) {
      bestScore = w[k];
      best = k;
    }
  });
  return best;
}

const STATEMENTS: Record<PredictionCategory, string[]> = {
  relationship: [
    "A meaningful social interaction may occur within the coming period.",
    "An important conversation with someone close to you is likely.",
    "A new connection or renewed contact may enter your immediate circle.",
    "An existing relationship may shift tone, prompting a decision.",
  ],
  finance: [
    "A financial decision or unexpected expense may arise soon.",
    "A small opportunity to improve your financial position may appear.",
    "Money-related pressure may surface and ask for attention.",
    "A spending or saving choice may have a visible consequence.",
  ],
  career: [
    "A work-related opportunity or recognition may cross your path.",
    "A decision about your responsibilities may need to be made.",
    "Progress on an ongoing task or project is likely to become visible.",
    "A new responsibility may be offered or requested of you.",
  ],
  personal: [
    "Your current momentum may carry into a productive personal shift.",
    "A habit or routine may change based on how you feel today.",
    "You may gain a clearer sense of what you want next.",
    "A moment of self-reflection may reframe your day's events.",
  ],
  event: [
    "An unexpected event may interrupt your planned routine.",
    "A chance occurrence may redirect part of your near future.",
    "Something you did not foresee may require a quick decision.",
    "A notable but unpredicted event may shift your week.",
  ],
};

function makeInterpretation(
  agentId: AgentId,
  agentName: string,
  c: DailyChronicle,
  s: FateSignal,
  probBase: number,
  categoryBias: Partial<Record<PredictionCategory, number>> = {},
  signalLines: string[] = [],
  history?: HistoryContext,
): AgentInterpretation {
  const w = categoryWeights(c);
  (Object.keys(categoryBias) as PredictionCategory[]).forEach((k) => {
    w[k] += categoryBias[k] ?? 0;
  });
  // Historical momentum tilts the category weights deterministically.
  if (history) {
    if (history.recurringCategories.includes("career")) w.career += 0.08;
    if (history.recurringCategories.includes("relationship")) w.relationship += 0.08;
    if (history.recurringCategories.includes("finance")) w.finance += 0.08;
    if (history.positiveTrend) {
      w.career += 0.05;
      w.personal += 0.05;
    }
  }
  const category = pickCategory(w);

  const statements = STATEMENTS[category];
  const idx = (c.events.length + c.emotionIntensity + c.decisions.length) % statements.length;
  const statement = statements[idx] ?? statements[0]!;

  // History-adjusted base probability: recurring positive momentum raises the
  // estimate slightly; a negative trend pulls it down (mean reversion guard).
  let adjusted = probBase;
  if (history && history.count >= 2) {
    const histDelta = ((history.avgEmotionalScore - 50) / 50) * 0.06;
    adjusted += histDelta;
    if (history.positiveTrend) adjusted += 0.03;
    if (history.riskTendency === "high") adjusted -= 0.03;
  }
  const probability = levelProb(adjusted);
  const confidence = confidenceFrom(probability, signalLines.length + c.decisions.length);
  const impact = impactFrom(s);

  const reasoning = [
    `${agentName} focused on ${agentId} patterns in today's context.`,
    `Primary signal: ${s.primaryEmotion} (${s.emotionalIntensity}/10 intensity), ${s.eventSignificance.toLowerCase()} significance.`,
    `Detected ${s.positiveActions} positive and ${s.negativeActions} negative action signals.`,
    ...(history && history.count > 0
      ? [
          `Recent ${history.count}-day trend: avg emotional ${history.avgEmotionalScore}, ${history.positiveTrend ? "improving" : "declining"}, risk ${history.riskTendency}.`,
        ]
      : []),
  ].join(" ");

  return {
    agentId,
    agentName,
    category,
    statement,
    probability,
    confidence,
    timeHorizon: "24h",
    impact,
    signals: signalLines,
    reasoning,
  };
}

export const AGENT_A_BEHAVIORAL: AgentDef = {
  id: "behavioral",
  name: "Behavioral Analyst",
  focus: "Action patterns, habits and decisions.",
  interpret: (ctx) => {
    const { chronicle: c, signal: s, history } = ctx;
    const lines: string[] = [];
    if (c.actions.length > 0) lines.push(`${c.actions.length} recorded actions today`);
    if (c.decisions.length > 0) lines.push(`${c.decisions.length} important decision(s) made`);
    if (c.actions.includes("Started something new")) lines.push("new beginning detected");
    if (c.actions.includes("Finished something")) lines.push("a task was completed");
    if (c.negativeActions.includes("Procrastinated")) lines.push("procrastination signal present");
    if (history && history.recentProductivity === "high") lines.push("recent productivity high");

    const base =
      0.5 +
      (c.actions.includes("Started something new") || c.actions.includes("Finished something")
        ? 0.12
        : 0) +
      (s.positiveMomentum === "strong" ? 0.12 : s.positiveMomentum === "moderate" ? 0.05 : -0.05) +
      (c.decisions.length > 0 ? 0.1 : 0);

    return makeInterpretation(
      "behavioral",
      "Behavioral Analyst",
      c,
      s,
      base,
      { personal: 0.1, career: 0.1 },
      lines,
      history,
    );
  },
};

export const AGENT_B_EMOTIONAL: AgentDef = {
  id: "emotional",
  name: "Emotional Analyst",
  focus: "Emotions, intensity and mood shifts.",
  interpret: (ctx) => {
    const { chronicle: c, signal: s, history } = ctx;
    const lines: string[] = [
      `dominant emotion ${s.primaryEmotion.toLowerCase()}`,
      `intensity ${s.emotionalIntensity}/10`,
    ];
    if (c.secondaryEmotion) lines.push(`secondary ${c.secondaryEmotion.toLowerCase()}`);
    if (c.negativeActions.includes("Argued") || c.actions.includes("Argued with someone"))
      lines.push("conflict-adjacent emotion detected");
    if (history && history.dominantEmotion)
      lines.push(`recent dominant ${history.dominantEmotion.toLowerCase()}`);

    const base =
      0.5 +
      (s.emotionalScore - 50) / 250 +
      (s.emotionalIntensity >= 7 ? 0.08 : s.emotionalIntensity <= 3 ? -0.08 : 0) +
      (c.secondaryEmotion ? 0.05 : 0);

    return makeInterpretation(
      "emotional",
      "Emotional Analyst",
      c,
      s,
      base,
      { personal: 0.15 },
      lines,
      history,
    );
  },
};

export const AGENT_C_SOCIAL: AgentDef = {
  id: "social",
  name: "Social Analyst",
  focus: "Interpersonal events, communication and relationships.",
  interpret: (ctx) => {
    const { chronicle: c, signal: s, history } = ctx;
    const lines: string[] = [];
    if (c.actions.includes("Socialized")) lines.push("active socializing");
    if (c.actions.includes("Met someone new")) lines.push("new person encountered");
    if (c.actions.includes("Argued with someone")) lines.push("interpersonal friction");
    if (c.importantPersonCategory)
      lines.push(`significant person: ${c.importantPersonCategory.toLowerCase()}`);
    if (c.goodActions.includes("Supported a friend") || c.goodActions.includes("Helped family"))
      lines.push("supportive social action");
    if (history && history.socialEnergy === "high") lines.push("recent social energy high");

    const socialWeight =
      c.actions.filter((a) => ["Socialized", "Met someone new", "Helped someone"].includes(a))
        .length / 3;
    const base =
      0.5 +
      socialWeight * 0.18 +
      (s.socialEnergy === "high" ? 0.1 : 0) +
      (c.actions.includes("Argued with someone") ? 0.06 : 0);

    return makeInterpretation(
      "social",
      "Social Analyst",
      c,
      s,
      base,
      { relationship: 0.25 },
      lines,
      history,
    );
  },
};

export const AGENT_D_RISK: AgentDef = {
  id: "risk",
  name: "Risk & Opportunity Analyst",
  focus: "Risk, opportunities, decisions and consequences.",
  interpret: (ctx) => {
    const { chronicle: c, signal: s, history } = ctx;
    const lines: string[] = [];
    if (c.decisions.length > 0) {
      const avgRisk = c.decisions.reduce((sum, d) => sum + d.risk, 0) / c.decisions.length;
      lines.push(`average decision risk ${Math.round(avgRisk)}/10`);
    }
    if (c.actions.includes("Took a risk")) lines.push("explicit risk taken");
    if (c.negativeActions.includes("Took unnecessary risk")) lines.push("unnecessary risk flagged");
    if (c.actions.includes("Started something new")) lines.push("opportunity-oriented action");
    if (history && history.riskTendency === "high") lines.push("recent high risk-taking");

    const base =
      0.5 +
      (c.actions.includes("Took a risk") ? 0.12 : 0) +
      (c.decisions.some((d) => d.importance >= 7) ? 0.1 : 0) +
      (s.riskLevel === "high" ? 0.08 : s.riskLevel === "low" ? -0.05 : 0) +
      (s.positiveMomentum === "strong" ? 0.08 : 0);

    return makeInterpretation(
      "risk",
      "Risk & Opportunity Analyst",
      c,
      s,
      base,
      { finance: 0.1, career: 0.1 },
      lines,
      history,
    );
  },
};

export const ALL_AGENTS: AgentDef[] = [
  AGENT_A_BEHAVIORAL,
  AGENT_B_EMOTIONAL,
  AGENT_C_SOCIAL,
  AGENT_D_RISK,
];

export function runAllAgents(ctx: AgentContext): AgentInterpretation[] {
  return ALL_AGENTS.map((a) => a.interpret(ctx));
}
