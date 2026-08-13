import { buildFateSignal } from "./signal";
import { buildHistoryContext } from "./history";
import { runConsensus } from "./consensus";
import { recalibrateProbability } from "./metrics";
import { requestPredictionOnchain, verifyPredictionOnchain } from "./genlayer";
import {
  addChronicle,
  addPrediction,
  addVerification,
  updatePrediction,
  storageKey,
} from "./store";
import type { DailyChronicle, Prediction, Verification, VerificationResult } from "./types";

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createId(prefix: string): string {
  return `${prefix}_${uuid()}`;
}

export async function generatePrediction(
  wallet: string,
  chronicle: DailyChronicle,
): Promise<{ prediction: Prediction; consensus: ReturnType<typeof runConsensus> }> {
  const signal = buildFateSignal(chronicle);
  const history = buildHistoryContext(wallet, 7);
  const consensus = runConsensus({ chronicle, signal, history });

  const horizonHours = 24;
  const deadline = new Date(Date.now() + horizonHours * 60 * 60 * 1000);

  // Local heuristic is used only as a transient draft for the transaction. The
  // settled on-chain consensus always supersedes it; if on-chain fails we throw
  // and never persist anything (no local/mock fallback).
  const draft: Prediction = {
    id: createId("pred"),
    userId: wallet,
    chronicleId: chronicle.id,
    date: chronicle.date,
    category: consensus.category,
    prediction: consensus.prediction,
    probability: consensus.probability,
    confidence: consensus.confidence,
    impact: consensus.impact,
    timeHorizon: consensus.timeHorizon,
    signals: consensus.signals,
    consensusScore: consensus.agentAgreement,
    agentAgreement: consensus.agentAgreement,
    horizonDeadline: deadline.toISOString(),
    status: "active",
    onchain: { mode: "genlayer" },
    signal,
    interpretations: consensus.interpretations,
    createdAt: new Date().toISOString(),
  };

  const chain = await requestPredictionOnchain(
    wallet,
    draft,
    signalToCalldata(signal, chronicle, history),
  );

  const settled = chain.consensus;
  const prediction: Prediction = {
    ...draft,
    category: (settled.category as Prediction["category"]) ?? draft.category,
    prediction: settled.prediction ?? draft.prediction,
    probability: settled.probability ?? draft.probability,
    confidence: (settled.confidence as Prediction["confidence"]) ?? draft.confidence,
    impact: (settled.impact as Prediction["impact"]) ?? draft.impact,
    agentAgreement: settled.agentAgreement ?? draft.agentAgreement,
    consensusScore: settled.agentAgreement ?? draft.agentAgreement,
    onchain: chain.onchain,
  };

  // Personal calibration: nudge the settled probability toward the user's base
  // rate so predictions become better calibrated over time.
  prediction.probability = recalibrateProbability(wallet, prediction.probability);

  addChronicle(wallet, chronicle);
  addPrediction(wallet, prediction);
  return { prediction, consensus };
}

function signalToCalldata(
  signal: Prediction["signal"],
  chronicle: DailyChronicle,
  history?: ReturnType<typeof buildHistoryContext>,
): Record<string, unknown> {
  return {
    date: signal.generatedAt.slice(0, 10),
    emotional_state: signal.emotionalState,
    emotional_score: signal.emotionalScore,
    primary_emotion: signal.primaryEmotion,
    secondary_emotion: signal.secondaryEmotion ?? "",
    emotional_intensity: signal.emotionalIntensity,
    mood: signal.mood,
    social_energy: signal.socialEnergy,
    decision_pressure: signal.decisionPressure,
    risk_level: signal.riskLevel,
    positive_momentum: signal.positiveMomentum,
    positive_actions: signal.positiveActions,
    negative_actions: signal.negativeActions,
    regret_level: signal.regretLevel,
    positive_action_importance: signal.positiveActionImportance,
    unresolved_issues: signal.unresolvedIssues,
    event_significance: signal.eventSignificance,
    actions: chronicle.actions,
    good_actions: chronicle.goodActions,
    negative_action_tags: chronicle.negativeActions,
    has_decisions: chronicle.decisions.length > 0,
    unexpected_occurred: chronicle.unexpectedEvent.occurred,
    ...(history && history.count > 0
      ? {
          history_avg_emotional: history.avgEmotionalScore,
          history_positive_trend: history.positiveTrend,
          history_risk: history.riskTendency,
          history_productivity: history.recentProductivity,
        }
      : {}),
  };
}

export function commitChallenge(
  wallet: string,
  predictionId: string,
  choice: "accepted" | "challenged",
): Prediction | undefined {
  const list = getPredictionsFor(wallet);
  const target = list.find((p) => p.id === predictionId);
  if (!target) return undefined;
  if (target.status !== "active") return undefined; // cannot challenge settled predictions
  updatePrediction(wallet, predictionId, { challenge: choice });
  return { ...target, challenge: choice };
}

export async function verifyPrediction(
  wallet: string,
  predictionId: string,
  result: VerificationResult,
  actualOutcome: string,
  userCommentary = "",
): Promise<{ verification: Verification; prediction: Prediction }> {
  const verification: Verification = {
    id: createId("ver"),
    predictionId,
    result,
    actualOutcome,
    userCommentary,
    verifiedAt: new Date().toISOString(),
  };

  const list = getPredictionsFor(wallet);
  const prediction = list.find((p) => p.id === predictionId);
  if (!prediction) throw new Error("Prediction not found");
  if (prediction.status === "verified") {
    throw new Error("This prediction is already verified on-chain.");
  }

  // Real on-chain only: throw if the transaction fails. The prediction is only
  // marked verified after the on-chain verification succeeds.
  const commit = await verifyPredictionOnchain(wallet, prediction, verification);
  const updated = updatePrediction(wallet, predictionId, {
    status: "verified",
    onchain: { ...prediction.onchain, ...commit.onchain },
  }).find((p) => p.id === predictionId)!;

  addVerification(wallet, verification);
  return { verification, prediction: updated };
}

export function getPredictionsFor(wallet: string): Prediction[] {
  if (typeof window === "undefined") return [];
  return readStore(wallet, "predictions") as Prediction[];
}

function readStore(wallet: string, key: string) {
  const raw = window.localStorage.getItem(storageKey(wallet, key as "predictions"));
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
