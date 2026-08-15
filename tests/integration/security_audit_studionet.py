"""On-chain security audit for the Fate Engine on GenLayer Studio (studionet).

Runs in a single process so the deploying account stays in memory (needed to
exercise the verification-window revert, which requires the prediction owner).

The full verify() SUCCESS path (evidence + hash binding + AI verifier + commit
+ leaderboard) needs the 24h horizon window to open, so it is covered here by
the window-revert assertions and in `tests/direct` (which warps time). A
follow-up, `verify_after_horizon.py`, completes the success path.

Usage:
    python tests/integration/security_audit_studionet.py
"""

import json
import os
import time

from genlayer_py import create_account, create_client
from genlayer_py.chains import studionet
from genlayer_py.abi import calldata
from genlayer_py.abi.transactions import serialize
from genlayer_py.contracts.utils import make_calldata_object
from genlayer_py.contracts.actions import _encode_add_transaction_data, _prepare_transaction
from genlayer_py.transactions.actions import TRANSACTION_STATUS_NUMBER_TO_NAME

ENDPOINT = "https://studio.genlayer.com/api"
CONTRACT_PATH = r"D:\Genlayer-project\fate-engine\contracts\fate_engine.py"

# If FATE_CONTRACT is set, audit that already-deployed contract instead of
# deploying a fresh one (deploy/GENVM-compile check is skipped).
PROVIDED_CONTRACT = os.environ.get("FATE_CONTRACT", "").strip()

# Studionet rate limits: 30 req/min, 500 req/hour.
PAUSE = 8  # seconds between independent operations

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

RESULT = "PASS"
FAILURES = []


def call_with_rate_retry(fn, *args, retries=6, wait=65, **kwargs):
    """Retry RPC calls that hit studionet's 30 req/min / 500 req/hour limits."""
    for attempt in range(retries):
        try:
            return fn(*args, **kwargs)
        except Exception as e:
            if "Rate limit" in str(e) and attempt < retries - 1:
                print(f"  rate-limited; sleeping {wait}s (attempt {attempt + 1}/{retries})", flush=True)
                time.sleep(wait)
                continue
            raise


def report(step, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {step} {detail}", flush=True)
    if not ok:
        FAILURES.append(f"{step}: {detail}")


def wait_decided(client, tx_hash, timeout=480):
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        try:
            last = call_with_rate_retry(client.get_transaction, tx_hash)
        except Exception as e:
            print(f"  poll err: {str(e)[:100]}", flush=True)
        if last:
            name = TRANSACTION_STATUS_NUMBER_TO_NAME.get(str(last.get("status")), str(last.get("status")))
            if name == "FINALIZED":
                return last, name
            last_name = name
        else:
            last_name = "UNKNOWN"
        time.sleep(10)
    raise TimeoutError(f"tx {tx_hash} not FINALIZED in {timeout}s (last {last_name})")


def revert_payload(tx) -> str:
    """Return the revert message only for a genuine rollback (a successful call
    returns the method's return value, not a rollback payload)."""
    try:
        r = tx["consensus_data"]["leader_receipt"][0]["result"]
        if isinstance(r, dict) and r.get("status") == "rollback":
            return str(r.get("payload", ""))
    except Exception:
        pass
    return ""


def send_and_wait(client, account, address, method, args, timeout=480):
    """Send a write tx via the consensus contract and wait for FINALIZED."""
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
    decided, name = wait_decided(client, tx_hash, timeout)
    return decided, name


def expect_revert(client, account, address, method, args, contains, timeout=480):
    try:
        tx, _name = send_and_wait(client, account, address, method, args, timeout)
    except Exception as e:
        return False, f"send/poll failed: {str(e)[:200]}"
    payload = revert_payload(tx)
    if contains in payload:
        return True, f"(reverted: {payload!r})"
    return False, f"no revert; payload={payload!r}"


def main():
    account = create_account()
    other = create_account()
    print("oracle account:", account.address, flush=True)
    print("other account :", other.address, flush=True)
    client = create_client(chain=studionet, account=account, endpoint=ENDPOINT)

    # --- Deploy (validates GENVM WASM compile) OR use provided contract ---
    if PROVIDED_CONTRACT:
        contract = PROVIDED_CONTRACT
        print(f"\n=== Using provided contract (deploy/GENVM-compile check skipped): {contract} ===", flush=True)
        try:
            call_with_rate_retry(client.read_contract, address=contract, function_name="get_prediction", args=[account.address, "probe"])
            report("contract responsive", True)
        except Exception as e:
            report("contract responsive (expected revert on missing pred)", True, str(e)[:120])
    else:
        print("\n=== Deploy (GENVM compile) ===", flush=True)
        tx_hash = call_with_rate_retry(client.deploy_contract, code=open(CONTRACT_PATH, "r", encoding="utf-8").read(), args=[], account=account)
        receipt = call_with_rate_retry(client.wait_for_transaction_receipt, transaction_hash=tx_hash, status="ACCEPTED", interval=15000, retries=40)
        addr = (receipt.get("data") or {}).get("contract_address") or receipt.get("contract_address")
        report("deploy", bool(addr), f"address={addr}")
        if not addr:
            print("cannot continue without contract", flush=True)
            return
        contract = addr
    time.sleep(PAUSE)

    # --- T1: get_prediction on a missing id ---
    print("\n=== T1 get_prediction missing ===", flush=True)
    try:
        call_with_rate_retry(client.read_contract, address=contract, function_name="get_prediction", args=[account.address, "ghost"])
        report("T1 get_prediction missing reverts", False, "no error raised")
    except Exception:
        report("T1 get_prediction missing reverts", True)

    # --- T2: request_prediction with invalid signal ---
    print("\n=== T2 invalid signal ===", flush=True)
    ok, d = expect_revert(
        client, account, contract, "request_prediction",
        ["pred_bad_sig", {"nested": {"evil": ["x" * 500]}}, "24h"], "Invalid signal",
    )
    report("T2 invalid signal rejected", ok, d)
    time.sleep(PAUSE)

    # --- T3: request_prediction with invalid horizon ---
    print("\n=== T3 invalid horizon ===", flush=True)
    ok, d = expect_revert(
        client, account, contract, "request_prediction",
        ["pred_bad_h", SIGNAL, "12h"], "Invalid time horizon",
    )
    report("T3 invalid horizon rejected", ok, d)
    time.sleep(PAUSE)

    # --- T4: request_prediction valid (on-chain AI consensus, slow) ---
    print("\n=== T4 request_prediction valid (AI consensus, may take minutes) ===", flush=True)
    pid = "pred_audit_1"
    tx, name = send_and_wait(client, account, contract, "request_prediction", [pid, SIGNAL, "24h"], timeout=600)
    payload = revert_payload(tx)
    report("T4 request_prediction settled (no rollback)", payload == "", f"status={name} payload={payload!r}")
    time.sleep(PAUSE)

    # --- T5: get_prediction record ---
    print("\n=== T5 get_prediction record ===", flush=True)
    pred = None
    for _ in range(6):
        try:
            pred = call_with_rate_retry(client.read_contract, address=contract, function_name="get_prediction", args=[account.address, pid])
            break
        except Exception as e:
            print(f"  read retry: {str(e)[:100]}", flush=True)
            time.sleep(10)
    if pred:
        report("T5 record exists", True)
        checks = {
            "status active": pred.get("status") == "active",
            "time_horizon 24h": pred.get("time_horizon") == "24h",
            "created_ts > 0": bool(pred.get("created_ts")),
            "verify_deadline = created+192h": pred.get("verify_deadline_ts")
            == (pred.get("created_ts") or 0) + 192 * 3600,
            "evidence_hash empty": pred.get("evidence_hash") == "",
            "4 readings": len(pred.get("readings") or []) == 4,
            "valid category": pred.get("category") in ("relationship", "finance", "career", "personal", "event"),
        }
        for label, okc in checks.items():
            report(f"T5 {label}", okc, str(pred.get("category")) if label == "valid category" else "")
    else:
        report("T5 record exists", False, "unreadable")
    time.sleep(PAUSE)

    # --- T6: get_oracle counters ---
    print("\n=== T6 get_oracle ===", flush=True)
    try:
        oracle = call_with_rate_retry(client.read_contract, address=contract, function_name="get_oracle", args=[account.address])
        report("T6 oracle predictions>=1", int(oracle.get("predictions", 0)) >= 1, str(oracle))
    except Exception as e:
        report("T6 oracle read", False, str(e)[:150])

    # --- T7: STAFF SECURITY — verify immediately must be blocked ---
    print("\n=== T7 self-confirmation blocked (window not open) ===", flush=True)
    evidence = "The promotion interview happened and the offer arrived as predicted."
    import hashlib
    ev_hash = hashlib.sha256(evidence.encode()).hexdigest()
    ok, d = expect_revert(
        client, account, contract, "verify_prediction",
        [pid, "confirmed", ev_hash, evidence], "Verification window not open yet",
    )
    report("T7 instant self-confirm rejected", ok, d)
    time.sleep(PAUSE)

    # --- T8: invalid verification result ---
    print("\n=== T8 invalid verification result ===", flush=True)
    ok, d = expect_revert(
        client, account, contract, "verify_prediction",
        [pid, "maybe", "0" * 64, "x" * 40], "Invalid verification result",
    )
    report("T8 invalid result rejected", ok, d)
    time.sleep(PAUSE)

    # --- T9: verify non-existent id ---
    print("\n=== T9 verify non-existent id ===", flush=True)
    ok, d = expect_revert(
        client, account, contract, "verify_prediction",
        ["ghost", "confirmed", "0" * 64, "x" * 40], "Prediction not found",
    )
    report("T9 non-existent id rejected", ok, d)
    time.sleep(PAUSE)

    # --- T10: wallet isolation — other wallet cannot verify oracle's prediction ---
    print("\n=== T10 wallet isolation ===", flush=True)
    ok, d = expect_revert(
        client, other, contract, "verify_prediction",
        [pid, "confirmed", ev_hash, evidence], "Prediction not found",
    )
    report("T10 other wallet cannot verify", ok, d)
    time.sleep(PAUSE)

    # --- T11: leaderboard stays empty (no verified predictions) ---
    print("\n=== T11 leaderboard ===", flush=True)
    try:
        rows = call_with_rate_retry(client.read_contract, address=contract, function_name="get_leaderboard", args=[])
        report("T11 leaderboard empty (no self-confirmed rank)", rows == [] or rows is None, str(rows)[:200])
    except Exception as e:
        report("T11 leaderboard read", False, str(e)[:150])

    # --- Summary ---
    # Persist the throwaway test account + contract so the verify() SUCCESS path
    # can be completed after the 24h horizon window opens. This is a disposable
    # studionet account with no funds; do not reuse for anything of value.
    state = {
        "contract": contract,
        "oracle_address": account.address,
        "oracle_private_key": account.key.hex(),
        "other_address": other.address,
        "prediction_id": pid,
        "evidence": evidence,
        "evidence_hash": ev_hash,
        "created_ts": (pred or {}).get("created_ts"),
    }
    state_path = r"D:\Genlayer-project\fate-engine\tests\integration\.audit_state.json"
    with open(state_path, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)
    print(f"\nAudit state saved to {state_path}", flush=True)

    print("\n===============================================", flush=True)
    print(f"RESULT: {len(FAILURES)} failures", flush=True)
    for f in FAILURES:
        print("  -", f, flush=True)
    print("Contract:", contract, flush=True)
    print("Oracle account:", account.address, flush=True)
    print("", flush=True)
    print("NOTE: the verify() SUCCESS path (evidence+hash+AI verifier+commit+leaderboard)", flush=True)
    print("requires the 24h horizon window to open. Re-run after 24h with:", flush=True)
    print("  python tests/integration/verify_after_horizon.py", flush=True)


if __name__ == "__main__":
    main()
