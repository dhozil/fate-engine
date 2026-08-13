import { runAllAgents, type AgentContext } from "./agents";
import type {
  AgentInterpretation,
  ConsensusResult,
  Confidence,
  Impact,
  PredictionCategory,
} from "./types";

function confidenceWeight(conf: Confidence): number {
  return conf === "high" ? 1 : conf === "medium" ? 0.66 : 0.33;
}

/** Deterministic category selection. Ties are broken by weighted support
 * (sum of confidence weights among agents backing each category), then
 * deterministically by lexicographic order — no randomness. */
function selectCategory(interpretations: AgentInterpretation[]): {
  category: PredictionCategory;
  agreement: number;
} {
  const votes = new Map<PredictionCategory, number>();
  const support = new Map<PredictionCategory, number>();
  interpretations.forEach((i) => {
    votes.set(i.category, (votes.get(i.category) ?? 0) + 1);
    support.set(i.category, (support.get(i.category) ?? 0) + confidenceWeight(i.confidence));
  });

  let best: PredictionCategory = "event";
  let bestVotes = -1;
  let bestSupport = -1;
  (Array.from(votes.keys()) as PredictionCategory[]).sort().forEach((cat) => {
    const v = votes.get(cat) ?? 0;
    const s = support.get(cat) ?? 0;
    // Primary: vote count. Tie-break: weighted support. Final: lexicographic.
    if (v > bestVotes || (v === bestVotes && s > bestSupport)) {
      bestVotes = v;
      bestSupport = s;
      best = cat;
    }
  });

  const agreement =
    interpretations.filter((i) => i.category === best).length / interpretations.length;
  return { category: best, agreement };
}

/** Probability weighted only by the agents aligned with the consensus category,
 * so dissenting opinions do not dilute the majority's estimate. */
function alignedProbability(
  category: PredictionCategory,
  interpretations: AgentInterpretation[],
): number {
  const aligned = interpretations.filter((i) => i.category === category);
  const pool = aligned.length > 0 ? aligned : interpretations;
  const totalWeight = pool.reduce((s, i) => s + confidenceWeight(i.confidence), 0);
  if (totalWeight === 0) return 0.5;
  const sum = pool.reduce((s, i) => s + i.probability * confidenceWeight(i.confidence), 0);
  return Math.round((sum / totalWeight) * 100) / 100;
}

function consensusConfidence(probability: number, agreement: number): Confidence {
  const score = probability * 0.55 + agreement * 0.45;
  if (score >= 0.72) return "high";
  if (score >= 0.58) return "medium";
  return "low";
}

function consensusImpact(interpretations: AgentInterpretation[]): Impact {
  const scores: number[] = interpretations.map((i) =>
    i.impact === "high" ? 1 : i.impact === "medium" ? 0.5 : 0,
  );
  const avg = scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length);
  if (avg >= 0.7) return "high";
  if (avg >= 0.4) return "medium";
  return "low";
}

/** Pick the most confident statement from the winning category — deterministic. */
function pickStatement(
  category: PredictionCategory,
  interpretations: AgentInterpretation[],
): string {
  const aligned = interpretations
    .filter((i) => i.category === category)
    .sort((a, b) => b.probability - a.probability || b.confidence.localeCompare(a.confidence));
  const best = aligned[0] ?? interpretations[0];
  return best?.statement ?? "A notable shift may occur in the near future.";
}

export function runConsensus(ctx: AgentContext): ConsensusResult {
  const interpretations = runAllAgents(ctx);
  const { category, agreement } = selectCategory(interpretations);
  const probability = alignedProbability(category, interpretations);
  const confidence = consensusConfidence(probability, agreement);
  const impact = consensusImpact(interpretations);
  const statement = pickStatement(category, interpretations);

  const signals: string[] = [];
  interpretations
    .filter((i) => i.category === category)
    .forEach((i) => {
      i.signals.forEach((s) => {
        if (!signals.includes(s)) signals.push(s);
      });
    });

  const note =
    agreement >= 0.75
      ? `${interpretations.length} independent interpretations converged on a ${category} signal.`
      : agreement >= 0.5
        ? `A ${category} signal received majority support among ${interpretations.length} interpretations.`
        : `Interpretations were divided; the ${category} signal was selected as the strongest common thread.`;

  return {
    category,
    prediction: statement,
    probability,
    confidence,
    impact,
    timeHorizon: "24h",
    signals,
    agentAgreement: Math.round(agreement * 100) / 100,
    consensusNote: note,
    interpretations,
    onchain: { mode: "local" },
  };
}
