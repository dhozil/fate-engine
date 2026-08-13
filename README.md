<div align="center">

# ✦ FATE ENGINE ✦

**Decentralized AI Future Prediction Game on GenLayer**

> *"Your actions create patterns. Patterns create probabilities. Consensus interprets the path ahead."*

[![GenLayer](https://img.shields.io/badge/Built%20on-GenLayer-8A2BE2?style=for-the-badge&logo=blockchain&logoColor=white)](https://genlayer.com)
[![AI Consensus](https://img.shields.io/badge/Powered%20by-AI%20Consensus-FFD700?style=for-the-badge)](https://genlayer.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-React-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](#)
[![Contract](https://img.shields.io/badge/Intelligent%20Contract-Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](#)

</div>

---

## 🌌 What is Fate Engine?

Fate Engine transforms **your daily life** into a **verifiable future forecast**. You record what happened — your actions, emotions, and decisions — and **4 independent AI agents** read your context. Through **GenLayer's AI consensus**, they settle on the most probable outcome for the next 24 hours.

The next day, **reality gets the final vote**: you verify what actually happened, and your accuracy becomes on-chain reputation.

> 🧿 **Not fortune telling.** It's a probabilistic simulation — a game of patterns, consensus, and calibration.

---

## 🔄 The Core Loop

```
 LIVE → RECORD → INTERPRET → CONSENSUS → PREDICT → EXPERIENCE → VERIFY → LEARN
```

```
        ┌─────────────────────────────────────────────────────────────┐
        │                                                             │
        ▼                                                             │
  ┌───────────┐    ┌───────────────┐    ┌────────────────────────┐    │
  │  DAILY    │ →  │  FATE SIGNAL  │ →  │  4 INDEPENDENT AGENTS  │    │
  │ CHRONICLE │    │ (structured)  │    │ Behavioral · Emotional │    │
  └───────────┘    └───────────────┘    │ Social · Risk          │    │
                                        └────────────┬───────────┘    │
                                                     ▼                │
  ┌───────────┐    ┌───────────────┐    ┌────────────────────────┐    │
  │  NEXT DAY │ ←  │  PREDICTION   │ ←  │  GENLAYER CONSENSUS    │    │
  │ VERIFY    │    │ + probability │    │  (validators re-run    │    │
  │ outcome   │    │ + confidence  │    │  & compare category)   │    │
  └───────────┘    └───────────────┘    └────────────────────────┘    │
        │                                                             │
        └───────────── accuracy · reputation · patterns ──────────────┘
```

---

## 🤖 The 4 AI Agents

Each agent reads the **same signal** through a different lens — and validators **re-run the LLM independently** to make sure they genuinely agree.

| Agent | Focus |
| :--- | :--- |
| **Behavioral Analyst** | Action patterns, habits & decisions |
| **Emotional Analyst** | Emotions, intensity & mood shifts |
| **Social Analyst** | Interpersonal events & relationships |
| **Risk & Opportunity Analyst** | Risk, decisions & consequences |

> 🔒 **Privacy-first:** only the *derived signal* goes on-chain — your raw journal never leaves the browser.

---

## 🧱 Smart Contract

### `contracts/fate_engine.py` — an Intelligent Contract for GenLayer

**Deployed on GenLayer Studio (studionet):**

```
📦 0x4C964C4288555E0b026e0656D17C8B0050803147
```

### Contract Methods

| Method | Type | Description |
| :--- | :---: | :--- |
| `request_prediction(prediction_id, signal)` | ✍️ write | Runs the 4-agent AI consensus and stores the settled prediction |
| `verify_prediction(prediction_id, result)` | ✍️ write | Records `confirmed` / `partial` / `missed` / `not_sure` |
| `get_prediction(oracle, prediction_id)` | 👁️ view | Reads a prediction with all agent readings |
| `get_oracle(oracle)` | 👁️ view | Oracle summary + all records |
| `get_leaderboard()` | 👁️ view | Oracles sorted by on-chain accuracy |

### Consensus Output

```json
{
  "category": "relationship",
  "statement": "A meaningful social interaction is likely to occur in the coming days.",
  "probability_bps": 7500,
  "confidence": "high",
  "impact": "medium",
  "time_horizon": "24h",
  "agent_agreement_bps": 10000,
  "readings": [ { "agent_id": "social", "agent_name": "Social Analyst", "...": "..." } ]
}
```

> ℹ️ Probabilities are stored as **basis points** (`10000` = 100%) because GenVM cannot encode floats.

---

## 🛡️ Security & Correctness

- **No mock fallback** — every prediction & verification is a real on-chain transaction; failures surface as clear errors.
- **Double-submit guarded** — UI locks during submission *and* the contract rejects duplicate IDs / re-verification.
- **Validator independence** — validators re-run the LLM and compare the settled category (not just structure).
- **Integer-only math** — no float division (GenVM-safe).
- **Adaptive categories** — agents only consider domains the user actually engaged with (no assumptions about work/money/socializing).

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 18 & npm
- A GenLayer wallet with GEN on studionet

### Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### Connect On-Chain

```bash
cp .env.example .env.local
```

```env
VITE_GENLAYER_CHAIN=studionet
VITE_GENLAYER_CONTRACT=0x4C964C4288555E0b026e0656D17C8B0050803147
VITE_GENLAYER_RPC=https://studio.genlayer.com/api
```

---

## 🧪 Testing

```bash
# Contract direct tests (mock LLM, no network needed)
pytest tests/direct/

# Contract integration tests on studionet
gltest tests/integration/ -v -s --network studionet

# Frontend checks
npm run lint
npm run build
```

---

## 📁 Project Structure

```
fate-engine/
├── contracts/
│   ├── fate_engine.py        # GenLayer Intelligent Contract
│   └── README.md             # Deployment guide
├── src/
│   ├── lib/fate/             # Game engine (signal, agents, consensus, metrics)
│   ├── components/fate/      # UI components
│   └── routes/               # Pages
├── tests/
│   ├── direct/               # In-memory contract tests
│   └── integration/          # Studionet on-chain tests
└── .env.local                # Your contract address (not committed)
```

---

## 🧿 Core Philosophy

> **AI makes the prediction. Consensus makes it trustworthy. Reality makes it accountable.**

Fate Engine is a **probabilistic simulation and prediction game** — entertainment and self-reflection, not deterministic fortune telling or advice.

---

<div align="center">

✦ **Built on GenLayer AI Consensus** ✦

*Your Actions Today. Your Future Tomorrow.*

</div>
