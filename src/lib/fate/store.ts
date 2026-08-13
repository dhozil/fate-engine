import type { DailyChronicle, Pattern, Prediction, UserProfile, Verification } from "./types";

const PREFIX = "fate-engine:";

type StoreKey = "chronicles" | "predictions" | "verifications" | "patterns" | "profile";

const listeners = new Map<string, Set<() => void>>();

function notify(key: string) {
  listeners.get(key)?.forEach((l) => l());
}

export function subscribe(key: string, fn: () => void): () => void {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(fn);
  return () => listeners.get(key)?.delete(fn);
}

export function storageKey(wallet: string, key: StoreKey): string {
  return `${PREFIX}${wallet.toLowerCase()}:${key}`;
}

export function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
  notify(key);
}

export function getChronicles(wallet: string): DailyChronicle[] {
  return readJson<DailyChronicle[]>(storageKey(wallet, "chronicles"), []);
}

export function addChronicle(wallet: string, chronicle: DailyChronicle): DailyChronicle[] {
  const list = getChronicles(wallet);
  const next = [chronicle, ...list.filter((c) => c.date !== chronicle.date)].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  writeJson(storageKey(wallet, "chronicles"), next);
  return next;
}

export function getPredictions(wallet: string): Prediction[] {
  return readJson<Prediction[]>(storageKey(wallet, "predictions"), []);
}

export function addPrediction(wallet: string, prediction: Prediction): Prediction[] {
  const list = getPredictions(wallet);
  const next = [prediction, ...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  writeJson(storageKey(wallet, "predictions"), next);
  return next;
}

export function updatePrediction(
  wallet: string,
  id: string,
  patch: Partial<Prediction>,
): Prediction[] {
  const list = getPredictions(wallet).map((p) => (p.id === id ? { ...p, ...patch } : p));
  writeJson(storageKey(wallet, "predictions"), list);
  return list;
}

export function getVerifications(wallet: string): Verification[] {
  return readJson<Verification[]>(storageKey(wallet, "verifications"), []);
}

export function addVerification(wallet: string, v: Verification): Verification[] {
  const list = getVerifications(wallet);
  const next = [v, ...list].sort((a, b) => b.verifiedAt.localeCompare(a.verifiedAt));
  writeJson(storageKey(wallet, "verifications"), next);
  return next;
}

export function getPatterns(wallet: string): Pattern[] {
  return readJson<Pattern[]>(storageKey(wallet, "patterns"), []);
}

export function savePatterns(wallet: string, patterns: Pattern[]) {
  writeJson(storageKey(wallet, "patterns"), patterns);
}

export function getProfile(wallet: string): UserProfile | null {
  return readJson<UserProfile | null>(storageKey(wallet, "profile"), null);
}

export function saveProfile(wallet: string, profile: UserProfile) {
  writeJson(storageKey(wallet, "profile"), profile);
}

export function resetAll(wallet: string) {
  if (typeof window === "undefined") return;
  (["chronicles", "predictions", "verifications", "patterns", "profile"] as StoreKey[]).forEach(
    (k) => {
      window.localStorage.removeItem(storageKey(wallet, k));
      notify(storageKey(wallet, k));
    },
  );
}

export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
