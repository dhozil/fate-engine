# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from dataclasses import dataclass
from genlayer import *

VALID_CATEGORIES = ("relationship", "finance", "career", "personal", "event")
VALID_RESULTS = ("confirmed", "partial", "missed", "not_sure")
VALID_CONFIDENCE = ("low", "medium", "high")
VALID_IMPACT = ("low", "medium", "high")
VALID_HORIZONS = ("24h", "3d", "7d", "30d")

AGENTS = (
    ("behavioral", "Behavioral Analyst", "action patterns, habits and decisions"),
    ("emotional", "Emotional Analyst", "emotions, intensity and mood shifts"),
    ("social", "Social Analyst", "interpersonal events, communication and relationships"),
    ("risk", "Risk & Opportunity Analyst", "risk, opportunities, decisions and consequences"),
)

# Confidence weights in basis points of weight (100 = 1.0)
CONFIDENCE_WEIGHT_BPS = {"high": 100, "medium": 66, "low": 33}


def validate_readings(readings) -> bool:
    """Structural validation of agent readings. Module-level so it can run
    inside the non-deterministic block without pickling the storage class
    (avoids 'Detected pickling storage class' warnings)."""
    if not isinstance(readings, list) or len(readings) != len(AGENTS):
        return False
    for r in readings:
        if not isinstance(r, dict):
            return False
        if r.get("agent_id") not in [a[0] for a in AGENTS]:
            return False
        if r.get("category") not in VALID_CATEGORIES:
            return False
        if not isinstance(r.get("statement"), str) or len(r["statement"]) < 5:
            return False
        statement = r["statement"].lower()
        if not any(
            w in statement
            for w in (
                "may",
                "likely",
                "could",
                "might",
                "probab",
                "trajectory",
                "suggest",
                "possibly",
                "tends",
            )
        ):
            return False
        prob_bps = r.get("probability_bps")
        if not isinstance(prob_bps, int):
            return False
        if not (0 <= prob_bps <= 10000):
            return False
        if r.get("confidence") not in VALID_CONFIDENCE:
            return False
        if r.get("impact") not in VALID_IMPACT:
            return False
        if not isinstance(r.get("signals"), list):
            return False
    return True


@allow_storage
@dataclass
class AgentReading:
    agent_id: str
    agent_name: str
    category: str
    statement: str
    probability_bps: u32  # 0..10000
    confidence: str
    impact: str
    signals: DynArray[str]


@allow_storage
@dataclass
class PredictionRecord:
    id: str
    date: str
    category: str
    statement: str
    probability_bps: u32  # 0..10000
    confidence: str
    impact: str
    time_horizon: str
    agent_agreement_bps: u32  # 0..10000
    status: str  # "active" | "verified"
    result: str  # one of VALID_RESULTS or ""
    created_at: str
    verified_at: str
    readings: DynArray[AgentReading]


class FateEngine(gl.Contract):
    predictions: TreeMap[Address, TreeMap[str, PredictionRecord]]
    counters: TreeMap[Address, TreeMap[str, u256]]

    def __init__(self):
        pass

    # ------------------------------------------------------------------
    # On-chain AI Consensus
    # ------------------------------------------------------------------

    @gl.public.write
    def request_prediction(self, prediction_id: str, signal: dict) -> str:
        """Runs 4 independent AI agents on the derived Fate Signal and reaches
        consensus. The raw journal never reaches the contract — only the
        normalized signal (privacy-first, spec section 22)."""
        sender = gl.message.sender_address
        preds = self.predictions.get_or_insert_default(sender)
        if prediction_id in preds:
            raise gl.vm.UserError("Prediction already committed")

        signal_json = json.dumps(signal, sort_keys=True)

        # Extract the compact history block (if the caller provided it) so the
        # agents can weigh recent momentum alongside today's signal.
        history_keys = {
            "history_avg_emotional",
            "history_positive_trend",
            "history_risk",
            "history_productivity",
        }
        history_block = {k: signal[k] for k in history_keys if k in signal}
        history_json = json.dumps(history_block, sort_keys=True) if history_block else "none"

        def leader_fn():
            readings = []
            for agent_id, agent_name, focus in AGENTS:
                prompt = f"""
You are {agent_name}, an independent AI oracle focused on {focus}.

A user recorded a daily chronicle that was normalized into this structured signal:
{signal_json}

The user's RECENT 7-DAY CONTEXT (aggregated, privacy-safe):
- days recorded: {history_json}
- emotional trend, risk tendency, productivity and social energy are provided when available.

The 'actions' / 'good_actions' / 'negative_action_tags' lists reflect what THIS user
actually did today. Do NOT assume the user works, deals with money, or socializes —
only the actions present in the signal are relevant. If a domain is absent from the
user's actions, that domain should not drive the prediction.

Your task:
1. Reason from the evidence above, not from generalities.
2. Choose the category with the STRONGEST evidence FOR THIS USER, using ONLY the
   domains the user actually engaged with:
   - relationship: ONLY if the user has social signals (socializing, meeting new people,
     arguing, helped someone, important person present).
   - finance: ONLY if the user has money signals (spent money, wasted money, financial
     decision, regret about money).
   - career: ONLY if the user has work/study signals (worked, studied, started/finished
     a task, responsibility decision).
   - event: ONLY if unexpected signals exist (unexpected event, life-changing significance,
     sudden opportunity, change in routine).
   - personal: the default when the day is about general mood, motivation, well-being,
     productivity, or self-growth and no domain above is clearly dominant.
3. Write a short probabilistic prediction (5-25 words). Use calibrated language:
   "may", "likely", "higher probability", "current trajectory suggests". DO NOT invent
   specific details absent from the signal (no invented names, events, places, or exact
   outcomes). Name the KIND of outcome only, e.g. "a new work opportunity may arise",
   "a meaningful social interaction is likely". Keep it testable and non-certain.
4. Set probability_bps (0..10000; 10000 = 100%). Use a wide honest range; be
   conservative when evidence is weak (near 5000) and more confident only when
   the signals genuinely agree.
5. List 2-4 concrete signals that support your reading.

Respond ONLY with JSON:
{{
    "category": "relationship" | "finance" | "career" | "personal" | "event",
    "statement": "a short probabilistic prediction sentence (5-25 words)",
    "probability_bps": integer between 0 and 10000,
    "confidence": "low" | "medium" | "high",
    "impact": "low" | "medium" | "high",
    "signals": ["short signal string", "..."]
}}
                """
                reading = gl.nondet.exec_prompt(prompt, response_format="json")
                readings.append(
                    {
                        "agent_id": agent_id,
                        "agent_name": agent_name,
                        "category": reading["category"],
                        "statement": reading["statement"],
                        "probability_bps": int(reading["probability_bps"]),
                        "confidence": reading["confidence"],
                        "impact": reading["impact"],
                        "signals": list(reading["signals"]),
                    }
                )
            return json.dumps(readings, sort_keys=True)

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            try:
                leader_readings = json.loads(leader_result.calldata)
            except Exception:
                return False
            # Pre-filter: the leader's output must be structurally valid.
            if not validate_readings(leader_readings):
                return False
            # Pattern 1 (Partial Field Matching): re-run the same task
            # independently, then compare the DECISION field (category).
            # Two LLMs produce different text but should agree on the category.
            try:
                my_json = leader_fn()
                my_readings = json.loads(my_json)
            except Exception:
                return False
            if not validate_readings(my_readings):
                return False

            matches = 0
            total = min(len(leader_readings), len(my_readings))
            for i in range(total):
                if leader_readings[i].get("agent_id") == my_readings[i].get("agent_id") and leader_readings[i].get(
                    "category"
                ) == my_readings[i].get("category"):
                    matches += 1
            # Majority of agents must agree on the category between the two
            # independent executions.
            return total > 0 and matches * 2 > total

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        readings_raw = json.loads(result)

        # Deterministic consensus — runs OUTSIDE the nondet block, then writes storage.
        category, probability_bps, confidence, impact, agreement_bps, statement, signals = (
            self._compute_consensus(readings_raw)
        )

        readings = []
        for r in readings_raw:
            sig = [str(s) for s in r.get("signals", [])]
            readings.append(
                AgentReading(
                    agent_id=r["agent_id"],
                    agent_name=r["agent_name"],
                    category=r["category"],
                    statement=r["statement"],
                    probability_bps=int(r["probability_bps"]),
                    confidence=r["confidence"],
                    impact=r["impact"],
                    signals=sig,
                )
            )

        created_at = str(gl.message_raw["datetime"])
        record = PredictionRecord(
            id=prediction_id,
            date=str(signal.get("date", "")),
            category=category,
            statement=statement,
            probability_bps=probability_bps,
            confidence=confidence,
            impact=impact,
            time_horizon="24h",
            agent_agreement_bps=agreement_bps,
            status="active",
            result="",
            created_at=created_at,
            verified_at="",
            readings=readings,
        )
        self.predictions.get_or_insert_default(sender)[prediction_id] = record
        self._bump(sender, "predictions")
        return prediction_id

    # ------------------------------------------------------------------
    # Verification
    # ------------------------------------------------------------------

    @gl.public.write
    def verify_prediction(self, prediction_id: str, result: str) -> None:
        if result not in VALID_RESULTS:
            raise gl.vm.UserError("Invalid verification result")
        sender = gl.message.sender_address
        preds = self.predictions.get_or_insert_default(sender)
        if prediction_id not in preds:
            raise gl.vm.UserError("Prediction not found")
        pred = preds[prediction_id]
        if pred.status == "verified":
            raise gl.vm.UserError("Prediction already verified")

        pred.status = "verified"
        pred.result = result
        pred.verified_at = str(gl.message_raw["datetime"])
        self._bump(sender, result)
        self._bump(sender, "verified")

    # ------------------------------------------------------------------
    # Views
    # ------------------------------------------------------------------

    @gl.public.view
    def get_prediction(self, oracle_address: str, prediction_id: str) -> dict:
        addr = Address(oracle_address)
        pred = self.predictions.get(addr, {}).get(prediction_id)
        if pred is None:
            raise gl.vm.UserError("Prediction not found")
        return self._record_to_dict(pred)

    @gl.public.view
    def get_oracle(self, oracle_address: str) -> dict:
        addr = Address(oracle_address)
        counters = self.counters.get(addr, TreeMap[str, u256]())
        preds = self.predictions.get(addr, TreeMap[str, PredictionRecord]())
        return {
            "address": addr.as_hex,
            "predictions": int(counters.get("predictions", 0)),
            "confirmed": int(counters.get("confirmed", 0)),
            "partial": int(counters.get("partial", 0)),
            "missed": int(counters.get("missed", 0)),
            "not_sure": int(counters.get("not_sure", 0)),
            "verified": int(counters.get("verified", 0)),
            "records": {k: self._record_to_dict(v) for k, v in preds.items()},
        }

    @gl.public.view
    def get_leaderboard(self) -> list:
        rows = []
        for addr, counters in self.counters.items():
            if int(counters.get("predictions", 0)) == 0:
                continue
            rows.append(
                {
                    "address": addr.as_hex,
                    "predictions": int(counters.get("predictions", 0)),
                    "confirmed": int(counters.get("confirmed", 0)),
                    "accuracy_bps": self._accuracy_bps(counters),
                }
            )
        return sorted(rows, key=lambda r: r["accuracy_bps"], reverse=True)

    # ------------------------------------------------------------------
    # Helpers (deterministic, integer-only)
    # ------------------------------------------------------------------

    def _compute_consensus(self, readings: list) -> tuple:
        cat_votes = {}
        for r in readings:
            cat_votes[r["category"]] = cat_votes.get(r["category"], 0) + 1
        majority_cat = max(cat_votes, key=cat_votes.get)
        agreement_bps = self._div_round(cat_votes[majority_cat] * 10000, len(readings))

        total_w = 0
        prob_sum = 0
        for r in readings:
            w = CONFIDENCE_WEIGHT_BPS.get(r["confidence"], 50)
            total_w += w
            prob_sum += int(r["probability_bps"]) * w
        probability_bps = self._div_round(prob_sum, total_w) if total_w > 0 else 5000

        score = probability_bps * 6 + agreement_bps * 4  # /100 in spirit
        confidence = "high" if score >= 7000 else "medium" if score >= 5500 else "low"

        imp_votes = {}
        for r in readings:
            imp_votes[r["impact"]] = imp_votes.get(r["impact"], 0) + 1
        impact = max(imp_votes, key=imp_votes.get)

        statement = ""
        signals = []
        for r in readings:
            if r["category"] == majority_cat:
                if not statement:
                    statement = r["statement"]
                signals.extend(r.get("signals", []))
        if not statement:
            statement = "A notable shift may occur in the near future."

        return (
            majority_cat,
            probability_bps,
            confidence,
            impact,
            agreement_bps,
            statement,
            signals,
        )

    def _record_to_dict(self, pred: PredictionRecord) -> dict:
        return {
            "id": pred.id,
            "date": pred.date,
            "category": pred.category,
            "statement": pred.statement,
            "probability_bps": int(pred.probability_bps),
            "confidence": pred.confidence,
            "impact": pred.impact,
            "time_horizon": pred.time_horizon,
            "agent_agreement_bps": int(pred.agent_agreement_bps),
            "status": pred.status,
            "result": pred.result,
            "created_at": pred.created_at,
            "verified_at": pred.verified_at,
            "readings": [self._reading_to_dict(r) for r in pred.readings],
        }

    def _reading_to_dict(self, r: AgentReading) -> dict:
        return {
            "agent_id": r.agent_id,
            "agent_name": r.agent_name,
            "category": r.category,
            "statement": r.statement,
            "probability_bps": int(r.probability_bps),
            "confidence": r.confidence,
            "impact": r.impact,
            "signals": [s for s in r.signals],
        }

    def _accuracy_bps(self, counters: TreeMap[str, u256]) -> int:
        predictions = int(counters.get("predictions", 0))
        if predictions == 0:
            return 0
        confirmed = int(counters.get("confirmed", 0))
        partial = int(counters.get("partial", 0))
        # (confirmed + 0.5 * partial) / predictions, in bps — integer division only.
        return self._div_round(confirmed * 10000 + partial * 5000, predictions)

    def _div_round(self, num: int, den: int) -> int:
        """Integer division with rounding to nearest, avoiding float division
        which is prohibited in GenVM (can crash VM execution)."""
        if den == 0:
            return 0
        return (num + den // 2) // den

    def _bump(self, sender: Address, key: str) -> None:
        counters = self.counters.get_or_insert_default(sender)
        counters[key] = counters.get(key, 0) + 1
