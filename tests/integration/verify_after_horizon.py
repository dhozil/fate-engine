"""Completes the verify() SUCCESS path on studionet after the 24h horizon opens.

Loads the state saved by security_audit_studionet.py (contract + throwaway
oracle account + prediction). Tests, against the REAL network/GENVM:

  T-A  verify with a wrong evidence hash        -> revert "Evidence hash mismatch"
  T-B  verify with too-short evidence           -> revert "Evidence required for this outcome"
  T-C  verify with valid evidence + hash        -> success (AI verifier must accept)
  T-D  re-verify                                -> revert "Prediction already verified"
  T-E  get_oracle counters                      -> confirmed/verified >= 1
  T-F  get_leaderboard                          -> oracle is ranked

Usage:
    python tests/integration/verify_after_horizon.py
"""

import hashlib
import json
import time
import os

from eth_account import Account
from genlayer_py import create_client
from genlayer_py.chains import studionet
from genlayer_py.abi import calldata
from genlayer_py.abi.transactions import serialize
from genlayer_py.contracts.utils import make_calldata_object
from genlayer_py.contracts.actions import _encode_add_transaction_data, _prepare_transaction
from genlayer_py.transactions.actions import TRANSACTION_STATUS_NUMBER_TO_NAME

ENDPOINT = "https://studio.genlayer.com/api"
STATE_PATH = os.path.join(os.path.dirname(__file__), ".audit_state.json")
HORIZON_HOURS = 24

FAILURES = []


def report(step, ok, detail=""):
    print(f"[{'PASS' if ok else 'FAIL'}] {step} {detail}", flush=True)
    if not ok:
        FAILURES.append(f"{step}: {detail}")


def call_with_rate_retry(fn, *args, retries=6, wait=65, **kwargs):
    for attempt in range(retries):
        try:
            return fn(*args, **kwargs)
        except Exception as e:
            if "Rate limit" in str(e) and attempt < retries - 1:
                print(f"  rate-limited; sleeping {wait}s", flush=True)
                time.sleep(wait)
                continue
            raise


def wait_decided(client, tx_hash, timeout=480):
    deadline = time.time() + timeout
    last_name = "UNKNOWN"
    while time.time() < deadline:
        try:
            t = call_with_rate_retry(client.get_transaction, tx_hash)
        except Exception as e:
            print(f"  poll err: {str(e)[:100]}", flush=True)
            t = None
        if t:
            last_name = TRANSACTION_STATUS_NUMBER_TO_NAME.get(str(t.get("status")), str(t.get("status")))
            if last_name == "FINALIZED":
                return t
        time.sleep(10)
    raise TimeoutError(f"tx {tx_hash} not FINALIZED (last {last_name})")


def revert_payload(tx) -> str:
    try:
        r = tx["consensus_data"]["leader_receipt"][0]["result"]
        if isinstance(r, dict) and r.get("status") == "rollback":
            return str(r.get("payload", ""))
    except Exception:
        pass
    return ""


def send_and_wait(client, account, address, method, args, timeout=480):
    data = [calldata.encode(make_calldata_object(method=method, args=args, kwargs={})), False]
    encoded = _encode_add_transaction_data(
        client,
        sender_account=account,
        recipient=address,
        consensus_max_rotations=client.chain.default_consensus_max_rotations,
        data=serialize(data),
    )
    tx = call_with_rate_retry(
        _prepare_transaction,
        client,
        sender=account.address,
        recipient=client.chain.consensus_main_contract["address"],
        data=encoded,
        value=0,
    )
    raw = client.w3.to_hex(account.sign_transaction(tx).raw_transaction)
    tx_hash = call_with_rate_retry(client.provider.make_request, "eth_sendRawTransaction", params=[raw])["result"]
    return wait_decided(client, tx_hash, timeout)


def expect_revert(client, account, address, method, args, contains, timeout=480):
    try:
        tx = send_and_wait(client, account, address, method, args, timeout)
    except Exception as e:
        return False, f"send/poll failed: {str(e)[:200]}"
    payload = revert_payload(tx)
    return (contains in payload), f"(reverted: {payload!r})"


def main():
    with open(STATE_PATH, encoding="utf-8") as f:
        state = json.load(f)
    contract = state["contract"]
    oracle_addr = state["oracle_address"]
    pid = state["prediction_id"]
    evidence = state["evidence"]
    ev_hash = state["evidence_hash"]
    created_ts = state.get("created_ts")

    account = Account.from_key(bytes.fromhex(state["oracle_private_key"]))
    client = create_client(chain=studionet, account=account, endpoint=ENDPOINT)

    print(f"contract: {contract}", flush=True)
    print(f"oracle  : {oracle_addr}", flush=True)
    print(f"prediction: {pid} created_ts={created_ts}", flush=True)

    now = int(time.time())
    open_ts = (created_ts or 0) + HORIZON_HOURS * 3600
    if now < open_ts:
        hours_left = (open_ts - now) / 3600
        print(f"\nWindow not open yet: {hours_left:.1f}h remaining. Try again later.", flush=True)
        return

    # T-A wrong hash must be rejected
    print("\n=== T-A wrong evidence hash ===", flush=True)
    ok, d = expect_revert(client, account, contract, "verify_prediction", [pid, "confirmed", "0" * 64, evidence], "Evidence hash mismatch")
    report("T-A hash mismatch rejected", ok, d)
    time.sleep(5)

    # T-B short evidence must be rejected
    print("\n=== T-B evidence too short ===", flush=True)
    ok, d = expect_revert(client, account, contract, "verify_prediction", [pid, "confirmed", hashlib.sha256(b"short").hexdigest(), "short"], "Evidence required for this outcome")
    report("T-B short evidence rejected", ok, d)
    time.sleep(5)

    # T-C valid evidence -> success (AI verifier must accept)
    print("\n=== T-C valid evidence -> commit (AI verifier) ===", flush=True)
    try:
        tx = send_and_wait(client, account, contract, "verify_prediction", [pid, "confirmed", ev_hash, evidence], timeout=600)
        payload = revert_payload(tx)
        report("T-C committed without rollback", payload == "", f"payload={payload!r}")
    except Exception as e:
        report("T-C commit tx", False, str(e)[:200])
    time.sleep(10)

    # T-D re-verify must be rejected
    print("\n=== T-D double verify ===", flush=True)
    ok, d = expect_revert(client, account, contract, "verify_prediction", [pid, "missed", ev_hash, evidence], "Prediction already verified")
    report("T-D double verify rejected", ok, d)
    time.sleep(5)

    # T-E oracle counters
    print("\n=== T-E get_oracle ===", flush=True)
    try:
        oracle = call_with_rate_retry(client.read_contract, address=contract, function_name="get_oracle", args=[oracle_addr])
        rec = (oracle.get("records") or {}).get(pid) or {}
        report("T-E result committed", rec.get("result") == "confirmed", str(rec.get("result")))
        report("T-E evidence_hash set", rec.get("evidence_hash") == ev_hash, str(rec.get("evidence_hash")))
        report("T-E verified counter", int(oracle.get("verified", 0)) >= 1, f"verified={oracle.get('verified')}")
    except Exception as e:
        report("T-E oracle read", False, str(e)[:150])

    # T-F leaderboard ranking
    print("\n=== T-F leaderboard ===", flush=True)
    try:
        rows = call_with_rate_retry(client.read_contract, address=contract, function_name="get_leaderboard", args=[])
        row = next((r for r in rows if str(r.get("address", "")).lower() == oracle_addr.lower()), None)
        report("T-F oracle ranked", row is not None, str(rows)[:200])
        if row:
            report("T-F accuracy>0", int(row.get("accuracy_bps", 0)) > 0, f"accuracy_bps={row.get('accuracy_bps')}")
    except Exception as e:
        report("T-F leaderboard read", False, str(e)[:150])

    print("\n===============================================", flush=True)
    print(f"RESULT: {len(FAILURES)} failures", flush=True)
    for f in FAILURES:
        print("  -", f, flush=True)


if __name__ == "__main__":
    main()
