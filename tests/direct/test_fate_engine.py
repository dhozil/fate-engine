"""Direct-mode tests for the Fate Engine contract.

Runs in-memory (no network). Because request_prediction uses gl.nondet.exec_prompt,
the LLM calls are mocked via direct_vm.mock_llm.
"""

import json

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


def test_verify_prediction_flow(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/fate_engine.py")
    _make_prediction(direct_vm, contract, direct_alice, "pred_1")

    contract.verify_prediction("pred_1", "confirmed")

    pred = contract.get_prediction(direct_alice, "pred_1")
    assert pred["status"] == "verified"
    assert pred["result"] == "confirmed"

    oracle = contract.get_oracle(direct_alice)
    assert oracle["confirmed"] == 1

    with direct_vm.expect_revert("Prediction already verified"):
        contract.verify_prediction("pred_1", "missed")

    with direct_vm.expect_revert("Invalid verification result"):
        contract.verify_prediction("pred_2", "maybe")

    with direct_vm.expect_revert("Prediction not found"):
        contract.verify_prediction("does_not_exist", "confirmed")


def test_leaderboard_accuracy(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/fate_engine.py")

    _make_prediction(direct_vm, contract, direct_alice, "alice_1")
    contract.verify_prediction("alice_1", "confirmed")

    _make_prediction(direct_vm, contract, direct_bob, "bob_1")
    contract.verify_prediction("bob_1", "missed")

    rows = contract.get_leaderboard()
    assert len(rows) == 2
    assert rows[0]["accuracy_bps"] >= rows[1]["accuracy_bps"]
    assert rows[0]["accuracy_bps"] == 10000


def test_wallet_isolation(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/fate_engine.py")

    _make_prediction(direct_vm, contract, direct_alice, "only_alice")

    # View methods accept any oracle address, so reading alice's record is fine.
    assert contract.get_prediction(direct_alice, "only_alice")["status"] == "active"

    # But bob cannot verify (or write) alice's prediction: writes key by sender.
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Prediction not found"):
        contract.verify_prediction("only_alice", "confirmed")

    # Bob's oracle counters remain empty.
    assert contract.get_oracle(direct_bob)["predictions"] == 0


def test_verification_correlates_to_correct_record(
    direct_vm, direct_deploy, direct_alice
):
    """Re-verification must target the exact prediction id, never another record
    from the same oracle (adversarial: concurrent submissions)."""
    contract = direct_deploy("contracts/fate_engine.py")

    # Two predictions from the same wallet.
    _make_prediction(direct_vm, contract, direct_alice, "pred_a", category="finance")
    _make_prediction(direct_vm, contract, direct_alice, "pred_b", category="career")

    contract.verify_prediction("pred_a", "missed")

    a = contract.get_prediction(direct_alice, "pred_a")
    b = contract.get_prediction(direct_alice, "pred_b")
    assert a["status"] == "verified"
    assert a["result"] == "missed"
    # pred_b must be untouched.
    assert b["status"] == "active"
    assert b["result"] == ""

    # Re-verifying pred_b (still active) is allowed; re-verifying pred_a is not.
    contract.verify_prediction("pred_b", "confirmed")
    b = contract.get_prediction(direct_alice, "pred_b")
    assert b["result"] == "confirmed"
    with direct_vm.expect_revert("Prediction already verified"):
        contract.verify_prediction("pred_a", "confirmed")

    oracle = contract.get_oracle(direct_alice)
    assert oracle["missed"] == 1
    assert oracle["confirmed"] == 1
