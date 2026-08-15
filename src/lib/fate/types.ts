export type Emotion =
  | "Happy"
  | "Calm"
  | "Excited"
  | "Confident"
  | "Neutral"
  | "Confused"
  | "Sad"
  | "Angry"
  | "Anxious"
  | "Disappointed"
  | "Tired"
  | "Afraid"
  | "Curious"
  | "Grateful"
  | "Hopeful"
  | "Frustrated"
  | "Proud"
  | "Lonely"
  | "Motivated"
  | "Overwhelmed";

export type ActionTag =
  | "Worked"
  | "Studied"
  | "Socialized"
  | "Helped someone"
  | "Made an important decision"
  | "Took a risk"
  | "Rested"
  | "Argued with someone"
  | "Spent money"
  | "Started something new"
  | "Finished something"
  | "Exercised"
  | "Traveled"
  | "Met someone new"
  | "Solved a problem"
  | "Avoided a problem"
  | "Other";

export type Mood =
  | "Very Negative"
  | "Negative"
  | "Slightly Negative"
  | "Neutral"
  | "Slightly Positive"
  | "Positive"
  | "Very Positive";

export type GoodAction =
  | "Helped someone"
  | "Donated"
  | "Apologized"
  | "Kept a promise"
  | "Helped family"
  | "Supported a friend"
  | "Finished an important task"
  | "Was honest"
  | "Did something kind"
  | "Other";

export type NegativeAction =
  | "Lied"
  | "Argued"
  | "Broke a promise"
  | "Wasted money"
  | "Procrastinated"
  | "Hurt someone"
  | "Took unnecessary risk"
  | "Avoided responsibility"
  | "Made an impulsive decision"
  | "Other";

export type Intent =
  | "For myself"
  | "To help someone"
  | "Because I had to"
  | "Because I was angry"
  | "Because I was afraid"
  | "Because I wanted something"
  | "Because it felt right"
  | "Because of pressure"
  | "I don't know"
  | "Other";

export type Significance = "Minor" | "Moderate" | "Major" | "Life-changing";

export type ImportantPersonCategory =
  | "Family"
  | "Friend"
  | "Partner"
  | "Coworker"
  | "Stranger"
  | "New person"
  | "Someone from the past"
  | "Other";

export type PredictionCategory = "relationship" | "finance" | "career" | "personal" | "event";

export type Confidence = "low" | "medium" | "high";
export type Impact = "low" | "medium" | "high";
export type TimeHorizon = "24h" | "3d" | "7d" | "30d";
export type Level = "low" | "medium" | "high";

export type AgentId = "behavioral" | "emotional" | "social" | "risk";

export type VerificationResult = "confirmed" | "partial" | "missed" | "not_sure";

export type PredictionStatus = "active" | "challenged" | "verified" | "expired";

export type ChallengeChoice = "accepted" | "challenged";

export interface Decision {
  description: string;
  importance: number;
  risk: number;
  confidence: number;
}

export interface DailyChronicle {
  id: string;
  userId: string;
  date: string;
  events: string;
  actions: ActionTag[];
  primaryEmotion: Emotion;
  secondaryEmotion?: Emotion;
  emotionIntensity: number;
  mood: Mood;
  goodActions: GoodAction[];
  positiveActionImportance: number;
  negativeActions: NegativeAction[];
  regretLevel: number;
  decisions: Decision[];
  intent: Intent;
  eventSignificance: Significance;
  unexpectedEvent: { occurred: boolean; description?: string };
  importantPersonCategory?: ImportantPersonCategory;
  createdAt: string;
}

export interface FateSignal {
  emotionalState: "positive" | "negative" | "mixed" | "neutral";
  emotionalScore: number;
  primaryEmotion: Emotion;
  secondaryEmotion?: Emotion;
  emotionalIntensity: number;
  mood: Mood;
  socialEnergy: Level;
  decisionPressure: Level;
  riskLevel: Level;
  positiveMomentum: "weak" | "moderate" | "strong";
  positiveActions: number;
  negativeActions: number;
  regretLevel: number;
  positiveActionImportance: number;
  unresolvedIssues: number;
  eventSignificance: Significance;
  generatedAt: string;
}

/** Compact, privacy-safe historical context passed to the agents (spec 19). */
export interface HistoryContext {
  recentDays: number;
  avgEmotionalScore: number;
  dominantEmotion: string;
  recurringCategories: string[];
  positiveTrend: boolean;
  riskTendency: "low" | "medium" | "high";
  socialEnergy: "low" | "medium" | "high";
  recentProductivity: "low" | "medium" | "high";
  count: number;
}

export interface AgentInterpretation {
  agentId: AgentId;
  agentName: string;
  category: PredictionCategory;
  statement: string;
  probability: number;
  confidence: Confidence;
  timeHorizon: TimeHorizon;
  impact: Impact;
  signals: string[];
  reasoning: string;
}

export interface OnchainCommit {
  mode: "local" | "genlayer";
  chain?: string;
  contractAddress?: string;
  txHash?: string;
  committedAt?: string;
}

export interface ConsensusResult {
  category: PredictionCategory;
  prediction: string;
  probability: number;
  confidence: Confidence;
  impact: Impact;
  timeHorizon: TimeHorizon;
  signals: string[];
  agentAgreement: number;
  consensusNote: string;
  interpretations: AgentInterpretation[];
  onchain: OnchainCommit;
}

export interface Prediction {
  id: string;
  userId: string;
  chronicleId: string;
  date: string;
  category: PredictionCategory;
  prediction: string;
  probability: number;
  confidence: Confidence;
  impact: Impact;
  timeHorizon: TimeHorizon;
  signals: string[];
  consensusScore: number;
  agentAgreement: number;
  horizonDeadline: string;
  status: PredictionStatus;
  challenge?: ChallengeChoice;
  onchain: OnchainCommit;
  signal: FateSignal;
  interpretations: AgentInterpretation[];
  createdAt: string;
}

export interface Verification {
  id: string;
  predictionId: string;
  result: VerificationResult;
  actualOutcome: string;
  userCommentary: string;
  evidenceHash: string;
  verifiedAt: string;
}

export interface Pattern {
  id: string;
  userId: string;
  type:
    | "recurring_social_conflict"
    | "repeated_spending"
    | "repeated_procrastination"
    | "positive_productivity_streak"
    | "recurring_emotional_state"
    | "repeated_risk_taking"
    | "repeated_opportunity";
  label: string;
  description: string;
  strength: number;
  firstSeen: string;
  lastSeen: string;
  occurrences: number;
  createdAt: string;
}

export interface UserProfile {
  userId: string;
  fateScore: number;
  predictionCount: number;
  confirmedCount: number;
  partialCount: number;
  missedCount: number;
  notSureCount: number;
  accuracy: number;
  calibration: number;
  streak: number;
  bestStreak: number;
  chronicleCount: number;
  challengeCount: number;
  challengeWins: number;
  profileSignals: {
    decisionStyle: number;
    socialEnergy: number;
    riskTendency: number;
    positiveActions: number;
    impulsiveness: number;
    consistency: number;
  };
  badges: string[];
  createdAt: string;
  updatedAt: string;
}
