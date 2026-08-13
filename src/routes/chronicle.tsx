import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageShell } from "@/components/fate/PageShell";
import { WalletGate, useWallet } from "@/components/fate/wallet";
import {
  ACTIONS,
  EMOTIONS,
  GOOD_ACTIONS,
  IMPORTANT_PEOPLE,
  INTENTS,
  MOODS,
  NEGATIVE_ACTIONS,
  SIGNIFICANCE,
  type ActionTag,
  type DailyChronicle,
  type Emotion,
  type GoodAction,
  type ImportantPersonCategory,
  type Intent,
  type Mood,
  type NegativeAction,
  type Significance,
} from "@/lib/fate";
import { buildFateSignal } from "@/lib/fate/signal";
import { createId, generatePrediction } from "@/lib/fate/engine";
import { dateKey, getChronicles } from "@/lib/fate/store";
import type { Decision, FateSignal } from "@/lib/fate/types";

export const Route = createFileRoute("/chronicle")({
  head: () => ({
    meta: [
      { title: "Daily Chronicle — Fate Engine" },
      {
        name: "description",
        content:
          "Record today's events, actions, emotions and decisions, then send them to the GenLayer AI Consensus for a probabilistic forecast.",
      },
      { property: "og:title", content: "Daily Chronicle — Fate Engine" },
      {
        property: "og:description",
        content: "Write your day and let multi-agent consensus read your probable future.",
      },
    ],
  }),
  component: Chronicle,
});

const fieldClass =
  "w-full rounded-lg border border-input bg-background/60 px-4 py-3 text-[14px] outline-none transition-colors focus:border-primary";

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-[13px] transition-colors ${
        active
          ? "border-gold bg-primary/25 text-gold"
          : "border-border text-muted-foreground hover:border-primary"
      }`}
    >
      {children}
    </button>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel-fate rounded-2xl p-7">
      <h2 className="mb-5 text-[12px] tracking-[0.18em] text-gold uppercase">{title}</h2>
      {children}
    </section>
  );
}

function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-[13px] text-muted-foreground">
      {label} — <span className="text-gold">{value}/10</span>
      <input
        type="range"
        min={0}
        max={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 w-full accent-[var(--primary)]"
      />
    </label>
  );
}

function Select<T extends string>({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly T[];
  placeholder?: string;
}) {
  return (
    <select className={fieldClass} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function levelLabel(level: string): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

function SignalRow({ label, value, pct }: { label: string; value: string; pct: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-gold">{value}</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-muted">
        <div
          className="h-1.5 rounded-full bg-[image:var(--gradient-hero)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function SummaryPanel({ signal, chronicle }: { signal: FateSignal; chronicle: DailyChronicle }) {
  const posPct = Math.min(100, Math.max(0, signal.emotionalScore));
  return (
    <section className="panel-fate rounded-3xl p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] tracking-[0.22em] text-gold uppercase">Your Day, Summarized</p>
          <h2 className="mt-2 font-display text-3xl">Today's Fate Signal</h2>
        </div>
        <span
          className={`rounded-full border px-4 py-2 text-[11px] tracking-[0.16em] uppercase ${
            signal.emotionalState === "positive"
              ? "border-gold/50 bg-gold/10 text-gold"
              : signal.emotionalState === "negative"
                ? "border-destructive/50 bg-destructive/10 text-destructive"
                : "border-border text-muted-foreground"
          }`}
        >
          {signal.emotionalState} day
        </span>
      </div>

      <div className="mt-7 grid gap-8 md:grid-cols-2">
        <div>
          <div className="mb-4 flex items-baseline justify-between text-[13px]">
            <span className="text-muted-foreground">Emotional state</span>
            <span className="text-gold">{signal.emotionalScore}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-[image:var(--gradient-hero)]"
              style={{ width: `${posPct}%` }}
            />
          </div>
          <p className="mt-2 text-[12px] text-muted-foreground">
            {signal.primaryEmotion}
            {signal.secondaryEmotion ? ` + ${signal.secondaryEmotion}` : ""} · intensity{" "}
            {signal.emotionalIntensity}/10
          </p>

          <div className="mt-6 grid gap-4">
            <SignalRow
              label="Social energy"
              value={levelLabel(signal.socialEnergy)}
              pct={signal.socialEnergy === "high" ? 85 : signal.socialEnergy === "medium" ? 55 : 25}
            />
            <SignalRow
              label="Decision pressure"
              value={levelLabel(signal.decisionPressure)}
              pct={
                signal.decisionPressure === "high"
                  ? 85
                  : signal.decisionPressure === "medium"
                    ? 55
                    : 25
              }
            />
            <SignalRow
              label="Risk level"
              value={levelLabel(signal.riskLevel)}
              pct={signal.riskLevel === "high" ? 85 : signal.riskLevel === "medium" ? 55 : 25}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-background/40 p-6">
          <p className="text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
            What the engine noticed
          </p>
          <ul className="mt-4 space-y-2.5 text-[13px] leading-6">
            <li className="flex gap-2">
              <span className="text-gold">+</span> Positive momentum:{" "}
              <span className="text-foreground/90">{levelLabel(signal.positiveMomentum)}</span>
            </li>
            <li className="flex gap-2">
              <span className="text-gold">+</span> {signal.positiveActions} positive action
              {signal.positiveActions === 1 ? "" : "s"} detected
            </li>
            <li className="flex gap-2">
              <span className="text-gold">+</span> {signal.negativeActions} negative action
              {signal.negativeActions === 1 ? "" : "s"} detected
            </li>
            <li className="flex gap-2">
              <span className="text-gold">+</span> {signal.unresolvedIssues} unresolved issue
              {signal.unresolvedIssues === 1 ? "" : "s"}
            </li>
            <li className="flex gap-2">
              <span className="text-gold">+</span> Significance:{" "}
              <span className="text-foreground/90">{signal.eventSignificance}</span>
            </li>
            <li className="flex gap-2">
              <span className="text-gold">+</span> Day recorded: {chronicle.date}
            </li>
          </ul>
          <p className="mt-6 border-t border-border/60 pt-4 text-[12px] leading-6 text-muted-foreground">
            This is a structured summary of your input — not yet a prediction. Ready when you are to
            ask the agents what tomorrow may hold.
          </p>
        </div>
      </div>
    </section>
  );
}

function Chronicle() {
  const navigate = useNavigate();
  const { address } = useWallet();

  const today = dateKey(new Date());
  const existing = useMemo(
    () => (address ? getChronicles(address).find((c) => c.date === today) : undefined),
    [address, today],
  );

  const [events, setEvents] = useState(existing?.events ?? "");
  const [actions, setActions] = useState<string[]>(existing?.actions ?? []);
  const [primaryEmotion, setPrimaryEmotion] = useState(existing?.primaryEmotion ?? "Neutral");
  const [secondaryEmotion, setSecondaryEmotion] = useState(existing?.secondaryEmotion ?? "");
  const [intensity, setIntensity] = useState(existing?.emotionIntensity ?? 5);
  const [mood, setMood] = useState(existing?.mood ?? "Neutral");
  const [goodActions, setGoodActions] = useState<string[]>(existing?.goodActions ?? []);
  const [positiveImportance, setPositiveImportance] = useState(
    existing?.positiveActionImportance ?? 5,
  );
  const [negativeActions, setNegativeActions] = useState<string[]>(existing?.negativeActions ?? []);
  const [regretLevel, setRegretLevel] = useState(existing?.regretLevel ?? 0);
  const [decisions, setDecisions] = useState<Decision[]>(existing?.decisions ?? []);
  const [intent, setIntent] = useState(existing?.intent ?? "");
  const [significance, setSignificance] = useState(existing?.eventSignificance ?? "Moderate");
  const [unexpected, setUnexpected] = useState(existing?.unexpectedEvent.occurred ?? false);
  const [unexpectedText, setUnexpectedText] = useState(existing?.unexpectedEvent.description ?? "");
  const [importantPerson, setImportantPerson] = useState(existing?.importantPersonCategory ?? "");

  const [decisionText, setDecisionText] = useState("");
  const [decisionImportance, setDecisionImportance] = useState(5);
  const [decisionRisk, setDecisionRisk] = useState(3);
  const [decisionConfidence, setDecisionConfidence] = useState(5);

  const [submitting, setSubmitting] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summarized, setSummarized] = useState<DailyChronicle | null>(null);
  const [signal, setSignal] = useState<FateSignal | null>(null);

  const toggle = (list: string[], setList: (v: string[]) => void, item: string) =>
    setList(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  const addDecision = () => {
    if (!decisionText.trim()) return;
    setDecisions([
      ...decisions,
      {
        description: decisionText.trim(),
        importance: decisionImportance,
        risk: decisionRisk,
        confidence: decisionConfidence,
      },
    ]);
    setDecisionText("");
    setDecisionImportance(5);
    setDecisionRisk(3);
    setDecisionConfidence(5);
  };

  const buildChronicle = (): DailyChronicle | null => {
    if (!address) return null;
    return {
      id: createId("chr"),
      userId: address,
      date: today,
      events,
      actions: actions as ActionTag[],
      primaryEmotion: primaryEmotion as Emotion,
      ...(secondaryEmotion ? { secondaryEmotion: secondaryEmotion as Emotion } : {}),
      emotionIntensity: intensity,
      mood: mood as Mood,
      goodActions: goodActions as GoodAction[],
      positiveActionImportance: positiveImportance,
      negativeActions: negativeActions as NegativeAction[],
      regretLevel,
      decisions,
      intent: intent as Intent,
      eventSignificance: significance as Significance,
      unexpectedEvent: {
        occurred: unexpected,
        ...(unexpectedText ? { description: unexpectedText } : {}),
      },
      ...(importantPerson
        ? { importantPersonCategory: importantPerson as ImportantPersonCategory }
        : {}),
      createdAt: new Date().toISOString(),
    };
  };

  const handleSummarize = (e: React.FormEvent) => {
    e.preventDefault();
    if (!intent) {
      setError("Please tell the engine why you did what you did (intent).");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const chronicle = buildChronicle();
      if (!chronicle) return;
      setSummarized(chronicle);
      setSignal(buildFateSignal(chronicle));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePredict = async () => {
    if (!address || !summarized) return;
    if (predicting) return; // guard: prevent double-submit double tx
    setPredicting(true);
    setError(null);
    try {
      const { prediction } = await generatePrediction(address, summarized);
      navigate({ to: "/result/$predictionId", params: { predictionId: prediction.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Prediction generation failed.");
      setPredicting(false);
    }
  };

  return (
    <PageShell
      eyebrow="Step One"
      title="Daily Chronicle"
      intro="The more honest the context, the sharper the consensus. Nothing here is judged — every field is only a signal."
    >
      <WalletGate>
        {existing && (
          <div className="mb-6 rounded-xl border border-gold/40 bg-gold/10 px-5 py-4 text-[13px] text-gold">
            A chronicle for {today} already exists. Editing it will generate a fresh prediction.
          </div>
        )}
        <form className="grid gap-5 lg:grid-cols-2" onSubmit={handleSummarize}>
          <div className="lg:col-span-2">
            <Block title="4.1 What happened today?">
              <textarea
                rows={5}
                className={fieldClass}
                value={events}
                onChange={(e) => setEvents(e.target.value)}
                placeholder="Tell the engine about your day…"
                required
              />
            </Block>
          </div>

          <div className="lg:col-span-2">
            <Block title="4.2 What did you do today?">
              <div className="flex flex-wrap gap-2">
                {ACTIONS.map((a) => (
                  <Chip
                    key={a}
                    active={actions.includes(a)}
                    onClick={() => toggle(actions, setActions, a)}
                  >
                    {a}
                  </Chip>
                ))}
              </div>
            </Block>
          </div>

          <Block title="4.3 – 4.6 Emotion & mood">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-[12px] text-muted-foreground">
                  Primary emotion
                </label>
                <Select
                  value={primaryEmotion}
                  onChange={(v) => setPrimaryEmotion(v)}
                  options={EMOTIONS}
                />
              </div>
              <div>
                <label className="mb-2 block text-[12px] text-muted-foreground">
                  Secondary emotion (optional)
                </label>
                <Select
                  value={secondaryEmotion}
                  onChange={(v) => setSecondaryEmotion(v)}
                  options={["", ...EMOTIONS]}
                  placeholder="None"
                />
              </div>
            </div>
            <Slider label="Emotional intensity" value={intensity} onChange={setIntensity} />
            <div className="mt-5">
              <label className="mb-2 block text-[12px] text-muted-foreground">
                Mood of the day
              </label>
              <Select value={mood} onChange={(v) => setMood(v)} options={MOODS} />
            </div>
          </Block>

          <Block title="4.7 Good actions">
            <div className="flex flex-wrap gap-2">
              {GOOD_ACTIONS.map((a) => (
                <Chip
                  key={a}
                  active={goodActions.includes(a)}
                  onClick={() => toggle(goodActions, setGoodActions, a)}
                >
                  {a}
                </Chip>
              ))}
            </div>
            <div className="mt-6">
              <Slider
                label="Positive action importance"
                value={positiveImportance}
                onChange={setPositiveImportance}
              />
            </div>
          </Block>

          <Block title="4.8 Negative actions">
            <div className="flex flex-wrap gap-2">
              {NEGATIVE_ACTIONS.map((a) => (
                <Chip
                  key={a}
                  active={negativeActions.includes(a)}
                  onClick={() => toggle(negativeActions, setNegativeActions, a)}
                >
                  {a}
                </Chip>
              ))}
            </div>
            <div className="mt-6">
              <Slider label="Regret level" value={regretLevel} onChange={setRegretLevel} />
            </div>
          </Block>

          <Block title="4.9 – 4.10 Decision & intent">
            <label className="mb-2 block text-[12px] text-muted-foreground">
              Important decision you made today
            </label>
            <div className="flex gap-2">
              <input
                className={fieldClass}
                value={decisionText}
                onChange={(e) => setDecisionText(e.target.value)}
                placeholder="e.g. accepted a new job"
              />
              <button
                type="button"
                onClick={addDecision}
                className="shrink-0 rounded-lg border border-gold/50 px-4 text-[12px] tracking-[0.15em] text-gold uppercase"
              >
                Add
              </button>
            </div>
            {decisions.length > 0 && (
              <ul className="mt-4 space-y-2">
                {decisions.map((d, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 px-4 py-2 text-[13px]"
                  >
                    <span>{d.description}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      risk {d.risk}/10 · conf {d.confidence}/10
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-6 grid gap-5 sm:grid-cols-3">
              <Slider
                label="Decision importance"
                value={decisionImportance}
                onChange={setDecisionImportance}
              />
              <Slider label="Decision risk" value={decisionRisk} onChange={setDecisionRisk} />
              <Slider
                label="Decision confidence"
                value={decisionConfidence}
                onChange={setDecisionConfidence}
              />
            </div>
            <div className="mt-6">
              <label className="mb-2 block text-[12px] text-muted-foreground">
                Why did you do it?
              </label>
              <Select
                value={intent}
                onChange={setIntent}
                options={INTENTS}
                placeholder="Select intent"
              />
            </div>
          </Block>

          <Block title="4.11 – 4.13 Significance & people">
            <label className="mb-2 block text-[12px] text-muted-foreground">
              How important was today?
            </label>
            <Select
              value={significance}
              onChange={(v) => setSignificance(v)}
              options={SIGNIFICANCE}
            />

            <div className="mt-6">
              <div className="mb-3 flex items-center gap-4 text-[13px]">
                <span className="text-muted-foreground">4.12 Something unexpected?</span>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={unexpected}
                    onChange={(e) => setUnexpected(e.target.checked)}
                    className="accent-[var(--primary)]"
                  />
                  Yes
                </label>
              </div>
              {unexpected && (
                <input
                  className={fieldClass}
                  value={unexpectedText}
                  onChange={(e) => setUnexpectedText(e.target.value)}
                  placeholder="What did you not expect?"
                />
              )}
            </div>

            <div className="mt-6">
              <label className="mb-2 block text-[12px] text-muted-foreground">
                4.13 Important person today (optional)
              </label>
              <Select
                value={importantPerson}
                onChange={setImportantPerson}
                options={["", ...IMPORTANT_PEOPLE]}
                placeholder="None"
              />
            </div>
          </Block>

          <div className="lg:col-span-2 flex flex-wrap items-center gap-5">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md border border-gold/50 bg-[image:var(--gradient-hero)] px-9 py-4 text-[12px] tracking-[0.2em] text-primary-foreground uppercase shadow-[var(--shadow-glow)] transition-transform hover:-translate-y-0.5 disabled:opacity-60"
            >
              {submitting ? "Reading your day…" : "Summarize My Day"}
            </button>
            {error && <p className="text-[13px] text-destructive">{error}</p>}
          </div>
        </form>

        {summarized && signal && (
          <div className="mt-10">
            <SummaryPanel signal={signal} chronicle={summarized} />
            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={() => void handlePredict()}
                disabled={predicting}
                className="rounded-md border border-gold/50 bg-[image:var(--gradient-hero)] px-10 py-5 text-[13px] tracking-[0.24em] text-primary-foreground uppercase shadow-[var(--shadow-glow)] transition-transform hover:-translate-y-0.5 disabled:opacity-60"
              >
                {predicting ? "The agents are consulting…" : "Predict Tomorrow"}
              </button>
              {predicting && (
                <p className="mt-4 text-[13px] text-muted-foreground">
                  4 AI agents are reading your day independently. Consensus forming…
                </p>
              )}
              {error && (
                <div className="mx-auto mt-6 max-w-xl rounded-xl border border-destructive/50 bg-destructive/10 px-5 py-4 text-left">
                  <p className="text-[12px] tracking-[0.16em] text-destructive uppercase">
                    On-chain transaction failed
                  </p>
                  <p className="mt-1 text-[13px] leading-6 text-foreground/90">{error}</p>
                  <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
                    The prediction was not recorded. Check your wallet connection, network, and GEN
                    balance, then try again.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </WalletGate>
    </PageShell>
  );
}
