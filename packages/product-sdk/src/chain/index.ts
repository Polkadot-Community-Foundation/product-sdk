/**
 * @parity/product-sdk/chain
 *
 * Chain interaction utilities built on PAPI.
 * Provides typed chain descriptors and client access.
 *
 * Credit: Based on polkadot-apps/packages/chain-client
 */

// Chain descriptors
export { assetHub, bulletin, people, chains } from './chains.js';

// Types
export type {
  Environment,
  ConnectionMode,
  ChainMeta,
  ChainDescriptor,
  ChainApiResult,
} from './types.js';

// TODO: Implement chain client utilities
// - getChainAPI(env) - Get typed API for an environment
// - getClient(descriptor) - Get raw PolkadotClient
// - isConnected(descriptor) - Check connection status
// - destroyAll() - Cleanup all connections
// - TruAPI provider for container mode
