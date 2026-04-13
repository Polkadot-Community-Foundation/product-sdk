/**
 * @parity/product-sdk/chain
 *
 * Chain interaction utilities built on PAPI.
 * Provides typed chain descriptors, TruAPI provider, and client access.
 *
 * Credit: Based on polkadot-apps/packages/chain-client
 */

// Chain descriptors
export { assetHub, bulletin, people, chains } from './chains.js';

// TruAPI provider
export { createTruApiProvider } from './truapi-provider.js';
export type { TruApiProviderOptions } from './truapi-provider.js';

// Container detection
export {
  isInsideContainer,
  isInsideContainerSync,
  loadProductSdk,
  getHostLocalStorage,
  getSandboxProvider,
  getAccountsProvider,
} from './container.js';
export type {
  ProductSdkModule,
  SandboxProvider,
  HostLocalStorage,
  AccountsProvider,
  TruApiAccount,
  JsonRpcProvider,
} from './container.js';

// Types
export type {
  Environment,
  ConnectionMode,
  ChainMeta,
  ChainDescriptor,
  ChainApiResult,
} from './types.js';
