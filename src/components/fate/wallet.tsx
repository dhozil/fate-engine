import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Wallet } from "lucide-react";

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: never[]) => void) => void;
  removeListener?: (event: string, handler: (...args: never[]) => void) => void;
};

function getProvider(): Eip1193 | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { ethereum?: Eip1193 }).ethereum;
}

type WalletState = {
  address: string | null;
  chainId: string | null;
  connecting: boolean;
  error: string | null;
  hasProvider: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
};

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasProvider, setHasProvider] = useState(false);

  useEffect(() => {
    const provider = getProvider();
    setHasProvider(Boolean(provider));
    if (!provider) return;

    void provider
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        const list = accounts as string[];
        if (list?.length) setAddress(list[0] ?? null);
      })
      .catch(() => undefined);

    void provider
      .request({ method: "eth_chainId" })
      .then((id) => setChainId(id as string))
      .catch(() => undefined);

    const onAccounts = (...args: never[]) => {
      const list = args[0] as unknown as string[];
      setAddress(list?.length ? (list[0] ?? null) : null);
    };
    const onChain = (...args: never[]) => setChainId(args[0] as unknown as string);

    provider.on?.("accountsChanged", onAccounts);
    provider.on?.("chainChanged", onChain);
    return () => {
      provider.removeListener?.("accountsChanged", onAccounts);
      provider.removeListener?.("chainChanged", onChain);
    };
  }, []);

  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) {
      setError("No EVM wallet detected. Install MetaMask or another EVM-compatible wallet.");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      setAddress(accounts?.[0] ?? null);
      const id = (await provider.request({ method: "eth_chainId" })) as string;
      setChainId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wallet connection rejected.");
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setError(null);
  }, []);

  return (
    <WalletContext.Provider
      value={{ address, chainId, connecting, error, hasProvider, connect, disconnect }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}

export function shortAddress(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function ConnectWalletButton({ className = "" }: { className?: string }) {
  const { address, connect, disconnect, connecting } = useWallet();

  if (address) {
    return (
      <button
        type="button"
        onClick={disconnect}
        title="Disconnect wallet"
        className={`inline-flex items-center gap-2 rounded-md border border-gold/50 bg-background/50 px-5 py-3 text-[12px] tracking-[0.16em] text-gold uppercase transition-colors hover:bg-primary/20 ${className}`}
      >
        <Wallet className="h-4 w-4" strokeWidth={1.4} />
        {shortAddress(address)}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void connect()}
      disabled={connecting}
      className={`inline-flex items-center gap-2 rounded-md border border-gold/50 bg-[image:var(--gradient-hero)] px-5 py-3 text-[12px] tracking-[0.16em] text-primary-foreground uppercase shadow-[var(--shadow-glow)] transition-transform hover:-translate-y-0.5 disabled:opacity-60 ${className}`}
    >
      <Wallet className="h-4 w-4" strokeWidth={1.4} />
      {connecting ? "Connecting…" : "Connect Wallet"}
    </button>
  );
}

export function WalletGate({ children }: { children: ReactNode }) {
  const { address, error, hasProvider } = useWallet();

  if (address) return <>{children}</>;

  return (
    <div className="panel-fate mx-auto max-w-xl rounded-2xl p-10 text-center">
      <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-gold/40 text-gold">
        <Wallet className="h-6 w-6" strokeWidth={1.3} />
      </span>
      <h2 className="font-display text-3xl">Connect an EVM Wallet</h2>
      <p className="mt-4 text-[14px] leading-7 text-muted-foreground">
        The Fate Engine records every chronicle against your on-chain identity. Connect an
        EVM-compatible wallet (MetaMask, Rabby, GenLayer Studio wallet) to begin.
      </p>
      <div className="mt-8 flex justify-center">
        <ConnectWalletButton />
      </div>
      {!hasProvider && (
        <p className="mt-5 text-[12px] text-muted-foreground">
          No wallet extension detected in this browser.
        </p>
      )}
      {error && <p className="mt-4 text-[12px] text-destructive">{error}</p>}
    </div>
  );
}
