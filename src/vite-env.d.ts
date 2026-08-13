/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GENLAYER_CHAIN?: string;
  readonly VITE_GENLAYER_CONTRACT?: string;
  readonly VITE_GENLAYER_RPC?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
