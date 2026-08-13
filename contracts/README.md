# Fate Engine — GenLayer Intelligent Contract

This Intelligent Contract implements the **core loop** of Fate Engine on-chain:
`chronicle → consensus → prediction → verification`. It follows the thesis in
section 38 of the spec: GenLayer is not just a database — it *is* the consensus
mechanism.

## How it works

1. The frontend normalizes the user's chronicle into a **Fate Signal** (derived,
   privacy-safe — the raw journal never leaves the browser, spec section 22).
2. `request_prediction(prediction_id, signal)` is called on-chain.
3. The contract runs **4 independent AI agents** (Behavioral, Emotional, Social,
   Risk & Opportunity) via `gl.nondet.exec_prompt`, each producing a category,
   statement, probability, confidence, impact and signals.
4. `gl.vm.run_nondet_unsafe` reaches GenLayer consensus — validators must agree
   the agent readings are valid, structured interpretations.
5. The contract computes the consensus result deterministically (majority
   category, confidence-weighted probability, agreement score) and stores it.
6. The next day the user calls `verify_prediction(prediction_id, result)`; the
   contract records the outcome and updates on-chain oracle counters.

## Contract functions

| Function | Type | Description |
| --- | --- | --- |
| `request_prediction(prediction_id, signal)` | write | Runs the 4-agent AI consensus and stores the settled prediction. Returns the prediction id. |
| `verify_prediction(prediction_id, result)` | write | Records `confirmed` / `partial` / `missed` / `not_sure`. |
| `get_prediction(oracle, prediction_id)` | view | Returns a single prediction record with all agent readings. |
| `get_oracle(oracle)` | view | Returns oracle summary + all records. |
| `get_leaderboard()` | view | Returns addresses sorted by accuracy (bps). |

## Consensus schema

The settled prediction matches the spec's Consensus Result Schema (section 24).
GenVM calldata cannot encode floats, so probabilities and agreement are stored as
**basis points (bps)** — integer between 0 and 10000 (10000 = 100%).

```json
{
  "category": "social",
  "statement": "A meaningful social interaction may occur.",
  "probability_bps": 7400,
  "confidence": "high",
  "impact": "medium",
  "time_horizon": "24h",
  "agent_agreement_bps": 8200,
  "readings": [ { "agent_id": "...", "agent_name": "...", "category": "...", "statement": "...", "probability_bps": 7000, "confidence": "high", "impact": "medium", "signals": ["..."] } ]
}
```

The frontend adapter (`src/lib/fate/genlayer.ts`) converts `probability_bps` and
`agent_agreement_bps` back to 0..1 floats when reading the settled record.

## Privacy boundary

- **On-chain:** Fate Signal, prediction commitment, verification result, oracle counters.
- **Off-chain (browser localStorage):** raw journal, personal notes, free-form content.

## Configure the frontend

```bash
# .env.local
VITE_GENLAYER_CHAIN=studionet          # localnet | studionet | testnetBradbury
VITE_GENLAYER_CONTRACT=0xYourDeployedContract
VITE_GENLAYER_RPC=https://your-rpc-url
```

When `VITE_GENLAYER_CONTRACT` is unset, the engine runs in `mode: "local"` —
the full game loop still works (local heuristic agents), it simply skips the
on-chain LLM consensus.

## Deployment

Requires the GenLayer CLI and a running simulator or network:

```bash
genlayer up            # start local simulator (Docker)
genlayer account       # create/get an account
genlayer deploy --contract contracts/fate_engine.py
```

```bash
# on a testnet
genlayer deploy --contract contracts/fate_engine.py --rpc <rpc-url>
```

### Verified on GenLayer Studio (studionet)

This contract was deployed and **all 5 integration tests passed** against the
hosted Studio network (`https://studio.genlayer.com/api`, chain id 61999):

- `request_prediction` + `get_prediction` + `verify_prediction` + `get_oracle`
  + `get_leaderboard` — verified working.
- `request_prediction` — verified running the **full on-chain multi-agent AI
  consensus**: the 4 LLM agents produced independent readings and the consensus
  layer settled on a category, weighted probability and agreement score.

Run the integration suite (deploys a fresh contract):

```bash
gltest tests/integration/test_fate_engine_studionet.py -v -s --network studionet
# or, against an already deployed contract:
FATE_CONTRACT=0x... gltest tests/integration/test_fate_engine_studionet.py -v -s --network studionet
```

> **Note:** the hosted Studio network rate limits to **500 requests/hour/IP**
> and **30 requests/minute**. The test suite paces between cases and reads the
> slow AI-consensus prediction with long sleeps instead of aggressive receipt
> polling. `gltest`'s `ContractFactory` needs a schema endpoint that Studio does
> not expose, so the integration tests call the deployed contract directly via
> `genlayer_py`.

Contract source reference: [GenLayer docs](https://docs.genlayer.com).
