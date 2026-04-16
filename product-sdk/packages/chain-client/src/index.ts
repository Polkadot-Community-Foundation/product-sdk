// Core BYOD API — zero descriptor overhead
export { createChainClient, destroyAll, getClient, isConnected } from "./clients.js";

// Types
export type { ChainClient, ChainClientConfig, ChainMeta, ConnectionMode, ChainEntry, Environment } from "./types.js";

// Re-export from host
export { isInsideContainer, isInsideContainerSync } from "@parity/product-sdk-host";
