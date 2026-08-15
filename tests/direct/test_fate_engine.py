"""Direct-mode tests for the Fate Engine contract.

Runs in-memory (no network). Because request_prediction / verify_prediction use
gl.nondet.exec_prompt, the LLM calls are mocked via direct_vm.mock_llm.
"""

import hashlib
import json
from datetime import datetime, timedelta, timezone

import pytest


SIGNAL = {
    "date": "2026-08-12",
    "emotional_state": "positive",
    "emotional_score": 78,
    "primary_emotion": "happy",
    "secondary_emotion": "excited",
    "emotional_intensity": 8,
    "mood": "Positive",
    "social_energy": "high",
    "decision_pressure": "medium",
    "risk_level": "low",
    "positive_momentum": "strong",
    "positive_actions": 2,
    "negative_actions": 0,
    "regret_level": 0,
    "positive_action_importance": 6,
    "unresolved_issues": 0,
    "event_significance": "Major",
    "actions": ["Worked", "Finished something"],
    "good_actions": ["Finished an important task"],
    "negative_action_tags": [],
    "has_decisions": True,
    "unexpected_occurred": False,
}

BASE_DT = datetime(2026, 8, 10, tzinfo=timezone.utc)

# The verifier prompt used by verify_prediction.
VERIFIER_RE = r"(?s)You are an impartial outcome verifier.*"

VALID_EVIDENCE = "The promotion interview happened and the offer arrived as predicted."
VALID_VERDICT = {"valid": True, "reason": "evidence supports the claimed outcome"}
INVALID_VERDICT = {"valid": False, "reason": "evidence is vague and contradicts the claim"}


def _iso_after(hours):
    return (BASE_DT + timedelta(hours=hours)).isoformat().replace("+00:00", "Z")


def _sha256(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _agent_reading(agent_id, category="career", statement="A work opportunity may appear soon."):
    # Simulates the RAW LLM output. GenVM calldata cannot encode floats, so the
    # contract instructs agents to return probability in basis points (int).
    by_id = {
        "behavioral": {
            "agent_id": "behavioral",
            "agent_name": "Behavioral Analyst",
            "category": category,
            "statement": statement,
            "probability_bps": 7400,
            "confidence": "high",
            "impact": "medium",
            "signals": ["finished an important task", "started something new"],
        },
        "emotional": {
            "agent_id": "emotional",
            "agent_name": "Emotional Analyst",
            "category": category,
            "statement": statement,
            "probability_bps": 7000,
            "confidence": "medium",
            "impact": "medium",
            "signals": ["happy mood", "high intensity"],
        },
        "social": {
            "agent_id": "social",
            "agent_name": "Social Analyst",
            "category": category,
            "statement": statement,
            "probability_bps": 7200,
            "confidence": "medium",
            "impact": "low",
            "signals": ["socialized", "met someone new"],
        },
        "risk": {
            "agent_id": "risk",
            "agent_name": "Risk & Opportunity Analyst",
            "category": category,
            "statement": statement,
            "probability_bps": 8000,
            "confidence": "high",
            "impact": "high",
            "signals": ["new beginning detected"],
        },
    }
    return by_id[agent_id]


def _mock_all_agents(direct_vm):
    # Each exec_prompt call must return a single dict (one agent reading).
    # Match per-agent by the agent name embedded in the prompt.
    for agent_id in ("behavioral", "emotional", "social", "risk"):
        reading = _agent_reading(agent_id)
        direct_vm.mock_llm(
            rf"(?s)You are {reading['agent_name']}.*",
            json.dumps(reading),
        )


def _make_prediction(direct_vm, contract, sender, pid, category="career"):
    """Create a prediction via the on-chain AI consensus path with mocked LLM."""
    for agent_id in ("behavioral", "emotional", "social", "risk"):
        reading = _agent_reading(agent_id, category=category)
        direct_vm.mock_llm(
            rf"(?s)You are {reading['agent_name']}.*",
            json.dumps(reading),
        )
    direct_vm.sender = sender
    contract.request_prediction(pid, SIGNAL)


def _create_at(direct_vm, contract, sender, pid, hour=0, category="career"):
    """Create a prediction with the VM clock pinned to BASE_DT + hour."""
    direct_vm.warp(_iso_after(hour))
    _make_prediction(direct_vm, contract, sender, pid, category=category)


def _verify_at(
    direct_vm,
    contract,
    sender,
    pid,
    create_hour,
    result="confirmed",
    evidence=VALID_EVIDENCE,
    verdict=True,
    hash_override=None,
):
    """Verify a prediction 25h after creation (inside the 24h-horizon window)."""
    direct_vm.warp(_iso_after(create_hour + 25))
    direct_vm.mock_llm(
        VERIFIER_RE,
        json.dumps(VALID_VERDICT if verdict else INVALID_VERDICT),
    )
    direct_vm.sender = sender
    contract.verify_prediction(
        pid, result, hash_override or _sha256(evidence), evidence
    )


def test_request_prediction_ai_consensus(direct_vm, direct_deploy, direct_alice):
    _mock_all_agents(direct_vm)
    contract = direct_deploy("contracts/fate_engine.py")
    direct_vm.sender = direct_alice

    pid = contract.request_prediction("pred_1", SIGNAL)
    assert pid == "pred_1"

    pred = contract.get_prediction(direct_alice, "pred_1")
    assert pred["status"] == "active"
    assert pred["category"] == "career"
    assert 5000 <= pred["probability_bps"] <= 10000
    assert pred["agent_agreement_bps"] == 10000
    assert len(pred["readings"]) == 4
    assert pred["time_horizon"] == "24h"
    assert pred["evidence_hash"] == ""
    assert pred["created_ts"] > 0
    assert pred["verify_deadline_ts"] == pred["created_ts"] + (24 + 168) * 3600

    oracle = contract.get_oracle(direct_alice)
    assert oracle["predictions"] == 1


def test_request_prediction_consensus_majority(direct_vm, direct_deploy, direct_alice):
    # 3 agents pick relationship, 1 picks career -> consensus category relationship
    for agent_id in ("behavioral", "emotional", "social"):
        reading = _agent_reading(agent_id, category="relationship")
        direct_vm.mock_llm(
            rf"(?s)You are {reading['agent_name']}.*",
            json.dumps(reading),
        )
    risk = _agent_reading("risk")  # career
    direct_vm.mock_llm(rf"(?s)You are {risk['agent_name']}.*", json.dumps(risk))
    contract = direct_deploy("contracts/fate_engine.py")
    direct_vm.sender = direct_alice

    contract.request_prediction("pred_1", SIGNAL)
    pred = contract.get_prediction(direct_alice, "pred_1")
    assert pred["category"] == "relationship"
    assert pred["agent_agreement_bps"] == 7500


def test_request_prediction_duplicate_reverts(direct_vm, direct_deploy, direct_alice):
    _mock_all_agents(direct_vm)
    contract = direct_deploy("contracts/fate_engine.py")
    direct_vm.sender = direct_alice

    contract.request_prediction("pred_1", SIGNAL)
    with direct_vm.expect_revert("Prediction already committed"):
        contract.request_prediction("pred_1", SIGNAL)


def test_request_prediction_invalid_horizon(direct_vm, direct_deploy, direct_alice):
    _mock_all_agents(direct_vm)
    contract = direct_deploy("contracts/fate_engine.py")
    direct_vm.sender = direct_alice

    with direct_vm.expect_revert("Invalid time horizon"):
        contract.request_prediction("pred_1", SIGNAL, "12h")


def test_request_prediction_rejects_invalid_signal(direct_vm, direct_deploy, direct_alice):
    """The untrusted signal is validated before reaching the agent prompts."""
    contract = direct_deploy("contracts/fate_engine.py")
    direct_vm.sender = direct_alice

    # Nested structures are not part of the flat signal schema.
    with direct_vm.expect_revert("Invalid signal"):
        contract.request_prediction("pred_1", {"nested": {"evil": ["x" * 500]}}, "24h")

    # Oversized string fields must be rejected (prompt/gas bloat, injection).
    with direct_vm.expect_revert("Invalid signal"):
        contract.request_prediction(
            "pred_2", {"emotional_state": "positive", "primary_emotion": "x" * 5000}, "24h"
        )

    # Forged out-of-range history context must be rejected.
    bad_history = dict(SIGNAL)
    bad_history["history_avg_emotional"] = 999999
    with direct_vm.expect_revert("Invalid signal"):
        contract.request_prediction("pred_3", bad_history, "24h")

    with direct_vm.expect_revert("Invalid signal"):
        contract.request_prediction("pred_4", "not-a-dict", "24h")


def test_verify_prediction_flow(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/fate_engine.py")
    _create_at(direct_vm, contract, direct_alice, "pred_1")

    _verify_at(direct_vm, contract, direct_alice, "pred_1", create_hour=0)

    pred = contract.get_prediction(direct_alice, "pred_1")
    assert pred["status"] == "verified"
    assert pred["result"] == "confirmed"
    assert pred["evidence_hash"] == _sha256(VALID_EVIDENCE)
    assert pred["verified_at"] != ""

    oracle = contract.get_oracle(direct_alice)
    assert oracle["confirmed"] == 1
    assert oracle["verified"] == 1

    with direct_vm.expect_revert("Prediction already verified"):
        contract.verify_prediction("pred_1", "missed", _sha256("x" * 20), "x" * 20)

    with direct_vm.expect_revert("Invalid verification result"):
        contract.verify_prediction("pred_2", "maybe", _sha256(""), "")

    with direct_vm.expect_revert("Prediction not found"):
        contract.verify_prediction("does_not_exist", "confirmed", _sha256(""), "")


def test_verify_window_not_open_yet(direct_vm, direct_deploy, direct_alice):
    """Instant self-confirmation must be impossible: no warp = same block time."""
    contract = direct_deploy("contracts/fate_engine.py")
    _create_at(direct_vm, contract, direct_alice, "pred_1", hour=0)

    # Same timestamp as creation (before horizon): must revert.
    with direct_vm.expect_revert("Verification window not open yet"):
        contract.verify_prediction("pred_1", "confirmed", _sha256(VALID_EVIDENCE), VALID_EVIDENCE)

    # A few minutes after creation but still before the 24h horizon: must revert.
    direct_vm.warp(_iso_after(23))
    with direct_vm.expect_revert("Verification window not open yet"):
        contract.verify_prediction("pred_1", "confirmed", _sha256(VALID_EVIDENCE), VALID_EVIDENCE)


def test_verify_window_closed(direct_vm, direct_deploy, direct_alice):
    """Verification past the grace deadline (created + 24h + 168h) must revert."""
    contract = direct_deploy("contracts/fate_engine.py")
    _create_at(direct_vm, contract, direct_alice, "pred_1", hour=0)

    _verify_at(direct_vm, contract, direct_alice, "pred_1", create_hour=0)

    _create_at(direct_vm, contract, direct_alice, "pred_2", hour=24 * 24)
    direct_vm.warp(_iso_after(24 * 24 + 193))
    direct_vm.mock_llm(VERIFIER_RE, json.dumps(VALID_VERDICT))
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Verification window closed"):
        contract.verify_prediction("pred_2", "confirmed", _sha256(VALID_EVIDENCE), VALID_EVIDENCE)


def test_verify_evidence_required(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/fate_engine.py")
    _create_at(direct_vm, contract, direct_alice, "pred_1", hour=0)

    direct_vm.warp(_iso_after(25))
    direct_vm.mock_llm(VERIFIER_RE, json.dumps(VALID_VERDICT))
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Evidence required for this outcome"):
        contract.verify_prediction("pred_1", "confirmed", _sha256("short"), "short")


def test_verify_evidence_hash_mismatch(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/fate_engine.py")
    _create_at(direct_vm, contract, direct_alice, "pred_1", hour=0)

    direct_vm.warp(_iso_after(25))
    direct_vm.mock_llm(VERIFIER_RE, json.dumps(VALID_VERDICT))
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Evidence hash mismatch"):
        contract.verify_prediction("pred_1", "confirmed", _sha256("different evidence"), VALID_EVIDENCE)


def test_verify_verifier_rejects_evidence(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/fate_engine.py")
    _create_at(direct_vm, contract, direct_alice, "pred_1", hour=0)

    direct_vm.warp(_iso_after(25))
    direct_vm.mock_llm(VERIFIER_RE, json.dumps(INVALID_VERDICT))
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Evidence does not support the claimed outcome"):
        contract.verify_prediction("pred_1", "confirmed", _sha256(VALID_EVIDENCE), VALID_EVIDENCE)

    # Nothing may be committed when the verifier rejects.
    pred = contract.get_prediction(direct_alice, "pred_1")
    assert pred["status"] == "active"
    assert contract.get_oracle(direct_alice)["verified"] == 0


def test_verify_not_sure_skips_evidence_and_verifier(direct_vm, direct_deploy, direct_alice):
    """not_sure has no accuracy benefit, so it needs no evidence or AI verdict."""
    contract = direct_deploy("contracts/fate_engine.py")
    _create_at(direct_vm, contract, direct_alice, "pred_1", hour=0)

    direct_vm.warp(_iso_after(25))
    direct_vm.sender = direct_alice
    contract.verify_prediction("pred_1", "not_sure", _sha256(""), "")

    pred = contract.get_prediction(direct_alice, "pred_1")
    assert pred["status"] == "verified"
    assert pred["result"] == "not_sure"
    assert contract.get_oracle(direct_alice)["not_sure"] == 1


def test_validator_rejects_divergent_rerun(direct_vm, direct_deploy, direct_alice):
    """Two independent verifier executions must agree; a divergent one fails."""
    contract = direct_deploy("contracts/fate_engine.py")
    _create_at(direct_vm, contract, direct_alice, "pred_1", hour=0)
    _verify_at(direct_vm, contract, direct_alice, "pred_1", create_hour=0)

    # The validator re-executes independently; make it diverge (valid=False).
    direct_vm.clear_mocks()
    direct_vm.mock_llm(VERIFIER_RE, json.dumps(INVALID_VERDICT))
    accepted = direct_vm.run_validator(index=-1)
    assert accepted is False


def test_leaderboard_requires_min_verified(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/fate_engine.py")

    # Alice: 3 confirmed (accuracy 10000 bps) -> ranked.
    _create_at(direct_vm, contract, direct_alice, "a1", hour=0)
    _verify_at(direct_vm, contract, direct_alice, "a1", create_hour=0)
    _create_at(direct_vm, contract, direct_alice, "a2", hour=25)
    _verify_at(direct_vm, contract, direct_alice, "a2", create_hour=25)
    _create_at(direct_vm, contract, direct_alice, "a3", hour=50)
    _verify_at(direct_vm, contract, direct_alice, "a3", create_hour=50)

    # Bob: 3 missed (accuracy 0 bps) -> ranked, below Alice.
    _create_at(direct_vm, contract, direct_bob, "b1", hour=0)
    _verify_at(direct_vm, contract, direct_bob, "b1", create_hour=0, result="missed")
    _create_at(direct_vm, contract, direct_bob, "b2", hour=25)
    _verify_at(direct_vm, contract, direct_bob, "b2", create_hour=25, result="missed")
    _create_at(direct_vm, contract, direct_bob, "b3", hour=50)
    _verify_at(direct_vm, contract, direct_bob, "b3", create_hour=50, result="missed")

    rows = contract.get_leaderboard()
    assert len(rows) == 2
    assert rows[0]["accuracy_bps"] >= rows[1]["accuracy_bps"]
    assert rows[0]["accuracy_bps"] == 10000
    assert rows[0]["confirmed"] == 3


def test_leaderboard_excludes_unverified(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/fate_engine.py")
    _create_at(direct_vm, contract, direct_alice, "a1", hour=0)
    _create_at(direct_vm, contract, direct_alice, "a2", hour=25)
    _create_at(direct_vm, contract, direct_alice, "a3", hour=50)
    # Zero verified predictions -> must not appear.
    assert contract.get_leaderboard() == []


def test_wallet_isolation(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/fate_engine.py")

    _create_at(direct_vm, contract, direct_alice, "only_alice", hour=0)

    # View methods accept any oracle address, so reading alice's record is fine.
    assert contract.get_prediction(direct_alice, "only_alice")["status"] == "active"

    # But bob cannot verify (or write) alice's prediction: writes key by sender.
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Prediction not found"):
        contract.verify_prediction("only_alice", "confirmed", _sha256(VALID_EVIDENCE), VALID_EVIDENCE)

    # Bob's oracle counters remain empty.
    assert contract.get_oracle(direct_bob)["predictions"] == 0


def test_verification_correlates_to_correct_record(direct_vm, direct_deploy, direct_alice):
    """Re-verification must target the exact prediction id, never another record
    from the same oracle (adversarial: concurrent submissions)."""
    contract = direct_deploy("contracts/fate_engine.py")

    _create_at(direct_vm, contract, direct_alice, "pred_a", hour=0, category="finance")
    _create_at(direct_vm, contract, direct_alice, "pred_b", hour=25, category="career")

    _verify_at(direct_vm, contract, direct_alice, "pred_a", create_hour=0, result="missed")

    a = contract.get_prediction(direct_alice, "pred_a")
    b = contract.get_prediction(direct_alice, "pred_b")
    assert a["status"] == "verified"
    assert a["result"] == "missed"
    # pred_b must be untouched.
    assert b["status"] == "active"
    assert b["result"] == ""

    # Re-verifying pred_b (still active, window open) is allowed.
    _verify_at(direct_vm, contract, direct_alice, "pred_b", create_hour=25, result="confirmed")
    b = contract.get_prediction(direct_alice, "pred_b")
    assert b["result"] == "confirmed"
    with direct_vm.expect_revert("Prediction already verified"):
        contract.verify_prediction("pred_a", "confirmed", _sha256("x" * 20), "x" * 20)

    oracle = contract.get_oracle(direct_alice)
    assert oracle["missed"] == 1
    assert oracle["confirmed"] == 1
