import type {
  ActionTag,
  Emotion,
  GoodAction,
  Intent,
  Mood,
  NegativeAction,
  PredictionCategory,
  Significance,
} from "./types";

export const EMOTIONS: Emotion[] = [
  "Happy",
  "Calm",
  "Excited",
  "Confident",
  "Neutral",
  "Confused",
  "Sad",
  "Angry",
  "Anxious",
  "Disappointed",
  "Tired",
  "Afraid",
  "Curious",
  "Grateful",
  "Hopeful",
  "Frustrated",
  "Proud",
  "Lonely",
  "Motivated",
  "Overwhelmed",
];

export const ACTIONS: ActionTag[] = [
  "Worked",
  "Studied",
  "Socialized",
  "Helped someone",
  "Made an important decision",
  "Took a risk",
  "Rested",
  "Argued with someone",
  "Spent money",
  "Started something new",
  "Finished something",
  "Exercised",
  "Traveled",
  "Met someone new",
  "Solved a problem",
  "Avoided a problem",
  "Other",
];

export const MOODS: Mood[] = [
  "Very Negative",
  "Negative",
  "Slightly Negative",
  "Neutral",
  "Slightly Positive",
  "Positive",
  "Very Positive",
];

export const GOOD_ACTIONS: GoodAction[] = [
  "Helped someone",
  "Donated",
  "Apologized",
  "Kept a promise",
  "Helped family",
  "Supported a friend",
  "Finished an important task",
  "Was honest",
  "Did something kind",
  "Other",
];

export const NEGATIVE_ACTIONS: NegativeAction[] = [
  "Lied",
  "Argued",
  "Broke a promise",
  "Wasted money",
  "Procrastinated",
  "Hurt someone",
  "Took unnecessary risk",
  "Avoided responsibility",
  "Made an impulsive decision",
  "Other",
];

export const INTENTS: Intent[] = [
  "For myself",
  "To help someone",
  "Because I had to",
  "Because I was angry",
  "Because I was afraid",
  "Because I wanted something",
  "Because it felt right",
  "Because of pressure",
  "I don't know",
  "Other",
];

export const SIGNIFICANCE: Significance[] = ["Minor", "Moderate", "Major", "Life-changing"];

export const IMPORTANT_PEOPLE = [
  "Family",
  "Friend",
  "Partner",
  "Coworker",
  "Stranger",
  "New person",
  "Someone from the past",
  "Other",
] as const;

export const CATEGORIES: Record<PredictionCategory, string> = {
  relationship: "Relationship",
  finance: "Finance",
  career: "Career",
  personal: "Personal",
  event: "Event",
};

export const HORIZONS = [
  { value: "24h", label: "24 Hours" },
  { value: "3d", label: "3 Days" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
] as const;
