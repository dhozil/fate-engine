"""Integration tests for the Fate Engine contract on GenLayer Studio (studionet).

gltest's ContractFactory needs a local schema endpoint that studionet does not
expose, so these tests call the deployed contract directly through genlayer_py.

To run against your own deployment:
    FATE_CONTRACT=<address> gltest tests/integration/ -v -s --network studionet

The tests below deploy a fresh contract first, so they are self-contained.
"""

import os
import time

import pytest

from genlayer_py import create_account, create_client
from genlayer_py.chains import studionet

ENDPOINT = "https://studio.genlayer.com/api"
CONTRACT = os.environ.get("FATE_CONTRACT")

# studionet rate limits: 30 req/min, 500 req/hour. Each transaction poll burns
# requests, so we pace between tests and read the slow AI-consensus transaction
# with a long sleep instead of aggressive receipt polling.
PAUSE_BETWEEN_TESTS = float(os.environ.get("FATE_PAUSE", "25"))


SIGNAL = {
    "date": "2026-08-12",
    "emotional_state": "positive",
    "emotional_score": 78,
    "primary_emotion": "happy",
    "secondary_emotion": "excited",
    "emotional_intensity": 8,
    "social_energy": "high",
    "decision_pressure": "medium",
    "risk_level": "low",
    "positive_momentum": "strong",
    "positive_actions": 2,
    "negative_actions": 0,
    "unresolved_issues": 0,
    "event_significance": "Major",
}


@pytest.fixture(scope="module")
def account():
    return create_account()


@pytest.fixture(scope="module")
def client(account):
    return create_client(chain=studionet, account=account, endpoint=ENDPOINT)


@pytest.fixture(scope="module")
def contract_address(client, account):
    if CONTRACT:
        return CONTRACT
    tx_hash = client.deploy_contract(
        code=open("contracts/fate_engine.py").read(),
        args=[],
        account=account,
    )
    receipt = client.wait_for_transaction_receipt(
        transaction_hash=tx_hash, status="ACCEPTED", interval=15000, retries=20
    )
    address = receipt.get("contract_address")
    if not address and "data" in receipt:
        address = receipt["data"].get("contract_address")
    assert address, f"deploy receipt has no contract_address: {list(receipt.keys())}"
    return address


@pytest.fixture(autouse=True)
def _pace_tests():
    """Pause between tests to stay under studionet's 30 req/min limit."""
    yield
    time.sleep(PAUSE_BETWEEN_TESTS)


def test_get_prediction_missing_reverts(client, contract_address, account):
    with pytest.raises(Exception):
        client.read_contract(
            address=contract_address,
            function_name="get_prediction",
            args=[account.address, "nope"],
        )


def test_commit_prediction(client, contract_address, account):
    tx_hash = client.write_contract(
        address=contract_address,
        function_name="commit_prediction",
        args=["pred_int_1", "2026-08-12", "finance", "An expense may arise.", 7400],
        value=0,
    )
    receipt = client.wait_for_transaction_receipt(
        transaction_hash=tx_hash, status="ACCEPTED", interval=15000, retries=20
    )
    assert receipt["status"] >= 1

    pred = client.read_contract(
        address=contract_address,
        function_name="get_prediction",
        args=[account.address, "pred_int_1"],
    )
    assert pred["status"] == "active"
    assert pred["category"] == "finance"
    assert pred["probability_bps"] == 7400


def test_verify_prediction(client, contract_address, account):
    tx_hash = client.write_contract(
        address=contract_address,
        function_name="verify_prediction",
        args=["pred_int_1", "confirmed"],
        value=0,
    )
    receipt = client.wait_for_transaction_receipt(
        transaction_hash=tx_hash, status="ACCEPTED", interval=15000, retries=20
    )
    assert receipt["status"] >= 1

    pred = client.read_contract(
        address=contract_address,
        function_name="get_prediction",
        args=[account.address, "pred_int_1"],
    )
    assert pred["status"] == "verified"
    assert pred["result"] == "confirmed"


def test_get_oracle(client, contract_address, account):
    oracle = client.read_contract(
        address=contract_address,
        function_name="get_oracle",
        args=[account.address],
    )
    assert oracle["predictions"] >= 1
    assert oracle["confirmed"] >= 1
    assert "records" in oracle


def test_request_prediction_ai_consensus(client, contract_address, account):
    """Core loop: on-chain multi-agent AI consensus (4 LLM agents + GenLayer validators).

    The AI-consensus transaction runs 4 LLM agents and is slow. Instead of
    polling the receipt aggressively (which burns studionet's 30 req/min), we
    submit, sleep, and read the settled prediction with a slow retry loop.
    """
    tx_hash = client.write_contract(
        address=contract_address,
        function_name="request_prediction",
        args=["pred_ai_1", SIGNAL],
        value=0,
    )
    print(f"request_prediction tx: {tx_hash}", flush=True)

    pred = None
    for attempt in range(6):
        time.sleep(60)
        try:
            pred = client.read_contract(
                address=contract_address,
                function_name="get_prediction",
                args=[account.address, "pred_ai_1"],
            )
            if pred.get("status") == "active":
                break
        except Exception as e:
            print(f"attempt {attempt}: not settled yet ({str(e)[:80]})", flush=True)

    assert pred, "request_prediction never settled"
    assert pred["category"] in ("relationship", "finance", "career", "personal", "event")
    assert 5000 <= pred["probability_bps"] <= 9000
    assert len(pred["readings"]) == 4
    assert pred["agent_agreement_bps"] >= 5000
