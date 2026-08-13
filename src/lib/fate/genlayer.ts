import { createClient } from "genlayer-js";
import { localnet, studionet, testnetBradbury } from "genlayer-js/chains";
import type { OnchainCommit, Prediction, Verification } from "./types";

type ClientConfigType = NonNullable<Parameters<typeof createClient>[0]>;
type GenLayerChainConfig = Exclude<ClientConfigType["chain"], undefined>;

/**
 * GenLayer adapter.
 *
 * On-chain commitment follows the thesis in section 22 of the spec:
 *   - prediction commitment + verification result are consensus-relevant and go on-chain
 *   - the raw journal never leaves the browser (localStorage, off-chain)
 *
 * Configure via env:
 *   VITE_GENLAYER_CHAIN  = "localnet" | "studionet" | "testnetBradbury"
 *   VITE_GENLAYER_CONTRACT = deployed Intelligent Contract address
 *   VITE_GENLAYER_RPC     = optional custom RPC endpoint
 *
 * Without configuration the engine transparently falls back to mode "local",
 * which still works end-to-end but records the commitment off-chain.
 */
type EnvMap = Record<string, string | undefined>;

const env = (): EnvMap =>
  typeof import.meta !== "undefined" ? ((import.meta as { env?: EnvMap }).env ?? {}) : {};

const getEnv = (key: string): string | undefined => env()[key];

const chainFromEnv = (): GenLayerChainConfig => {
  switch (getEnv("VITE_GENLAYER_CHAIN")) {
    case "studionet":
      return studionet as GenLayerChainConfig;
    case "testnetBradbury":
      return testnetBradbury as GenLayerChainConfig;
    case "localnet":
    default:
      return localnet as GenLayerChainConfig;
  }
};

function clientConfig(): ClientConfigType {
  const endpoint = getEnv("VITE_GENLAYER_RPC");
  return {
    chain: chainFromEnv(),
    ...(endpoint ? { endpoint } : {}),
  };
}

export function isGenLayerConfigured(): boolean {
  return Boolean(getEnv("VITE_GENLAYER_CONTRACT"));
}

export function createReadClient() {
  return createClient(clientConfig());
}

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: never[]) => void) => void;
  removeListener?: (event: string, handler: (...args: never[]) => void) => void;
};

function getBrowserProvider(): EthereumProvider | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { ethereum?: EthereumProvider }).ethereum;
}

/**
 * Write client signed by the connected browser wallet (MetaMask / GenLayer
 * wallet), mirroring the official genlayer-js browser pattern. Falls back to a
 * raw address account only when no injected provider exists.
 */
function createWriteClient(wallet: string) {
  const provider = getBrowserProvider();
  if (provider) {
    return createClient({
      ...clientConfig(),
      account: wallet as `0x${string}`,
      provider: provider as never,
    });
  }
  return createClient({
    ...clientConfig(),
    account: wallet as `0x${string}`,
  });
}

/** Switches the connected wallet to the configured GenLayer network. */
export async function connectWalletToChain(): Promise<void> {
  const provider = getBrowserProvider();
  if (!provider || typeof window === "undefined") return;
  const chainName = (getEnv("VITE_GENLAYER_CHAIN") ?? "localnet") as
    "localnet" | "studionet" | "testnetAsimov" | "testnetBradbury" | "mainnet";
  try {
    // Use the write client (which carries the injected provider) so the wallet
    // knows which account/network to switch. This mirrors the SDK browser flow.
    const client = createClient({
      ...clientConfig(),
      provider: provider as never,
    });
    await client.connect(chainName);
  } catch {
    // Wallet/network switch failure is non-fatal; transactions will surface it.
  }
}

function contractAddress(): string {
  return getEnv("VITE_GENLAYER_CONTRACT") ?? "";
}

export type CommitResult = {
  onchain: OnchainCommit;
  error?: string;
};

type CalldataValue = string | number | boolean | Array<string | number | boolean>;

function toDict(obj: Record<string, unknown>): Record<string, CalldataValue> {
  const out: Record<string, CalldataValue> = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
    } else if (Array.isArray(v)) {
      out[k] = v.map((x) => {
        if (typeof x === "string" || typeof x === "number" || typeof x === "boolean") return x;
        return String(x);
      });
    }
  });
  return out;
}

/** Pause helper (resolves after ms). */
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs the on-chain multi-agent AI consensus. The signal (derived, not the raw
 * journal) is sent to the Intelligent Contract, which executes 4 independent
 * LLM agents and reaches consensus, then reads the settled prediction back.
 *
 * STRICT MODE: this throws on any failure (not configured, tx rejected, or the
 * settled record cannot be read). No local/mock fallback is returned — the UI
 * surfaces the error instead of silently showing heuristic data.
 *
 * We deliberately do NOT wait on the raw transaction status: studionet's RPC is
 * flaky ("Failed to fetch") even though the tx is accepted and COMMITTING in the
 * explorer. Instead we poll the prediction record itself until it settles.
 */
export async function requestPredictionOnchain(
  wallet: string,
  prediction: Prediction,
  signal: Record<string, unknown>,
): Promise<{ onchain: OnchainCommit; consensus: ConsensusPatch }> {
  if (!isGenLayerConfigured()) {
    throw new Error(
      "GenLayer on-chain is not configured. Set VITE_GENLAYER_CONTRACT to use real consensus.",
    );
  }

  try {
    await connectWalletToChain();
    const client = createWriteClient(wallet);
    const txHash = await client.writeContract({
      address: contractAddress() as `0x${string}`,
      functionName: "request_prediction",
      args: [prediction.id, toDict(signal)],
      value: BigInt(0),
    });

    const result = await pollPrediction(wallet, prediction.id);
    if (!result) {
      throw new Error("On-chain prediction record could not be read after the transaction.");
    }
    return {
      onchain: {
        mode: "genlayer",
        chain: getEnv("VITE_GENLAYER_CHAIN") ?? "localnet",
        contractAddress: contractAddress(),
        txHash: String(txHash),
        committedAt: new Date().toISOString(),
      },
      consensus: result,
    };
  } catch (e) {
    if (e instanceof Error && e.message.includes("not configured")) throw e;
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(`On-chain prediction failed: ${detail}`);
  }
}

/** Polls get_prediction until a settled record exists, tolerating flaky RPC. */
async function pollPrediction(
  wallet: string,
  predictionId: string,
): Promise<ConsensusPatch | undefined> {
  const deadline = Date.now() + 10 * 60 * 1000;
  const interval = 15000;
  for (;;) {
    const result = await readPredictionOnchain(wallet, predictionId);
    if (result && result.prediction) return result;
    if (Date.now() > deadline) return undefined;
    await sleep(interval);
  }
}

export type ConsensusPatch = {
  category?: string;
  prediction?: string;
  probability?: number;
  confidence?: string;
  impact?: string;
  agentAgreement?: number;
  interpretations?: OnchainAgentReading[];
  status?: string;
  result?: string;
};

/** An agent reading as returned by the contract's get_prediction. */
export type OnchainAgentReading = {
  agent_id: string;
  agent_name: string;
  category: string;
  statement: string;
  probability_bps: number;
  confidence: string;
  impact: string;
  signals: string[];
};

/** Reads a settled prediction record back from the Intelligent Contract. */
export async function readPredictionOnchain(
  wallet: string,
  predictionId: string,
): Promise<ConsensusPatch | undefined> {
  if (!isGenLayerConfigured()) return undefined;
  try {
    const client = createReadClient();
    const res = (await client.readContract({
      address: contractAddress() as `0x${string}`,
      functionName: "get_prediction",
      args: [wallet, predictionId],
    })) as Record<string, unknown>;
    if (!res || typeof res !== "object") return undefined;

    const patch: ConsensusPatch = {};
    if (typeof res["category"] === "string") patch.category = res["category"];
    if (typeof res["statement"] === "string") patch.prediction = res["statement"];
    if (typeof res["probability_bps"] === "number") {
      patch.probability = Number(res["probability_bps"]) / 10000;
    }
    if (typeof res["confidence"] === "string") patch.confidence = res["confidence"];
    if (typeof res["impact"] === "string") patch.impact = res["impact"];
    if (typeof res["agent_agreement_bps"] === "number") {
      patch.agentAgreement = Number(res["agent_agreement_bps"]) / 10000;
    }
    if (typeof res["status"] === "string") patch.status = res["status"];
    if (typeof res["result"] === "string") patch.result = res["result"];
    if (Array.isArray(res["readings"])) {
      patch.interpretations = (res["readings"] as Record<string, unknown>[]).map(
        (r): OnchainAgentReading => ({
          agent_id: String(r["agent_id"] ?? ""),
          agent_name: String(r["agent_name"] ?? ""),
          category: String(r["category"] ?? ""),
          statement: String(r["statement"] ?? ""),
          probability_bps: Number(r["probability_bps"] ?? 0),
          confidence: String(r["confidence"] ?? ""),
          impact: String(r["impact"] ?? ""),
          signals: Array.isArray(r["signals"]) ? (r["signals"] as string[]) : [],
        }),
      );
    }
    return patch;
  } catch {
    return undefined;
  }
}

/** Reads the oracle summary for an address (used by leaderboards). */
export async function readOracleOnchain(
  oracleAddress: string,
): Promise<Record<string, unknown> | undefined> {
  if (!isGenLayerConfigured()) return undefined;
  try {
    const client = createReadClient();
    return (await client.readContract({
      address: contractAddress() as `0x${string}`,
      functionName: "get_oracle",
      args: [oracleAddress],
    })) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export type OnchainLeaderboardRow = {
  address: string;
  predictions: number;
  confirmed: number;
  accuracy_bps: number;
};

/** Reads the on-chain leaderboard (addresses sorted by accuracy). */
export async function readLeaderboardOnchain(): Promise<OnchainLeaderboardRow[] | undefined> {
  if (!isGenLayerConfigured()) return undefined;
  try {
    const client = createReadClient();
    const res = (await client.readContract({
      address: contractAddress() as `0x${string}`,
      functionName: "get_leaderboard",
      args: [],
    })) as Record<string, unknown>[];
    if (!Array.isArray(res)) return undefined;
    return res.map((r) => ({
      address: String(r["address"] ?? ""),
      predictions: Number(r["predictions"] ?? 0),
      confirmed: Number(r["confirmed"] ?? 0),
      accuracy_bps: Number(r["accuracy_bps"] ?? 0),
    }));
  } catch {
    return undefined;
  }
}
/**
 * Records the verification result on-chain. STRICT MODE: throws on failure
 * (not configured, tx rejected, or execution error). No local fallback — the
 * prediction is only marked verified after the on-chain transaction succeeds.
 */
export async function verifyPredictionOnchain(
  wallet: string,
  prediction: Prediction,
  verification: Verification,
): Promise<CommitResult> {
  if (!isGenLayerConfigured()) {
    throw new Error(
      "GenLayer on-chain is not configured. Set VITE_GENLAYER_CONTRACT to use real consensus.",
    );
  }

  try {
    await connectWalletToChain();
    const client = createWriteClient(wallet);
    const txHash = await client.writeContract({
      address: contractAddress() as `0x${string}`,
      functionName: "verify_prediction",
      args: [prediction.id, verification.result],
      value: BigInt(0),
    });
    // Wait for the verification to settle on-chain by polling the record until
    // it is actually verified — tolerates studionet's flaky RPC instead of
    // relying on raw transaction status polling.
    const settled = await pollVerified(wallet, prediction.id);
    if (!settled) {
      throw new Error("Verification transaction did not settle on-chain.");
    }
    return {
      onchain: {
        mode: "genlayer",
        chain: getEnv("VITE_GENLAYER_CHAIN") ?? "localnet",
        contractAddress: contractAddress(),
        txHash: String(txHash),
        committedAt: new Date().toISOString(),
      },
    };
  } catch (e) {
    if (e instanceof Error && e.message.includes("not configured")) throw e;
    if (e instanceof Error && e.message.includes("did not settle on-chain")) throw e;
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(`On-chain verification failed: ${detail}`);
  }
}

/** Polls get_prediction until the record is marked verified on-chain. */
async function pollVerified(wallet: string, predictionId: string): Promise<boolean> {
  const deadline = Date.now() + 5 * 60 * 1000;
  const interval = 12000;
  for (;;) {
    const result = await readPredictionOnchain(wallet, predictionId);
    if (result && result.status === "verified") return true;
    if (Date.now() > deadline) return false;
    await sleep(interval);
  }
}
