/**
 * Container detection utilities
 *
 * Detects whether the app is running inside a host container (TruAPI available)
 * or in standalone mode (direct browser APIs).
 *
 * Credit: Based on polkadot-apps/packages/host and polkadot-apps/packages/signer
 */

import { createLogger } from '../core/logger.js';

const log = createLogger('container');

/**
 * Synchronous check for container environment markers.
 * Use this as a quick pre-filter before attempting async SDK loads.
 */
export function isInsideContainerSync(): boolean {
  if (typeof globalThis.window === 'undefined') return false;

  const win = globalThis.window as unknown as Record<string, unknown>;

  // Check markers injected by host
  if (win.__HOST_WEBVIEW_MARK__ === true) return true;
  if (win.__HOST_API_PORT__ != null) return true;

  // Check iframe status
  try {
    if (globalThis.window !== globalThis.window.top) return true;
  } catch {
    // Cross-origin iframe - likely container
    return true;
  }

  return false;
}

/**
 * Async check that verifies the product-sdk is available and functional.
 * This is the authoritative check for container mode.
 */
export async function isInsideContainer(): Promise<boolean> {
  // Quick sync check first
  if (!isInsideContainerSync()) {
    return false;
  }

  try {
    const sdk = await loadProductSdk();
    const result = sdk.sandboxProvider?.isCorrectEnvironment?.() ?? false;
    log.debug('Container detection result', { isContainer: result });
    return result;
  } catch (e) {
    log.debug('Product SDK not available, not in container', { error: e });
    return false;
  }
}

/**
 * Product SDK module interface
 * This is what @novasamatech/product-sdk exports when injected by the host
 */
export interface ProductSdkModule {
  sandboxProvider: SandboxProvider;
  hostLocalStorage: HostLocalStorage;
  createAccountsProvider: () => AccountsProvider;
  createPapiProvider: (
    genesisHash: `0x${string}`,
    fallback?: JsonRpcProvider
  ) => JsonRpcProvider;
  injectSpektrExtension?: () => Promise<boolean>;
}

/**
 * Sandbox provider for TruAPI chain operations
 */
export interface SandboxProvider {
  isCorrectEnvironment(): boolean;
  // Chain head subscription
  remote_chain_head_follow(
    genesisHash: string,
    withRuntime: boolean,
    callback: (event: unknown) => void
  ): () => void;
  // Get block header
  remote_chain_head_header(
    genesisHash: string,
    hash: string,
    callback: (header: unknown) => void
  ): void;
  // Storage queries
  remote_chain_head_storage(
    genesisHash: string,
    hash: string,
    items: Array<{ key: string; type: string }>,
    childTrie: string | null,
    callback: (result: unknown) => void
  ): () => void;
  // Transaction broadcast
  remote_chain_transaction_broadcast(
    genesisHash: string,
    transaction: string,
    callback: (result: unknown) => void
  ): () => void;
  // Call runtime API
  remote_chain_head_call(
    genesisHash: string,
    hash: string,
    method: string,
    params: string,
    callback: (result: unknown) => void
  ): void;
}

/**
 * Host localStorage interface for TruAPI
 */
export interface HostLocalStorage {
  readString(key: string): Promise<string>;
  writeString(key: string, value: string): Promise<void>;
  readJSON<T = unknown>(key: string): Promise<T | null>;
  writeJSON<T = unknown>(key: string, value: T): Promise<void>;
  clear(key: string): Promise<void>;
}

/**
 * Accounts provider for TruAPI
 */
export interface AccountsProvider {
  getAccounts(): Promise<TruApiAccount[]>;
  onAccountsChange(callback: (accounts: TruApiAccount[]) => void): () => void;
  sign(address: string, message: Uint8Array): Promise<Uint8Array>;
}

/**
 * Account from TruAPI
 */
export interface TruApiAccount {
  address: string;
  name?: string;
  publicKey: Uint8Array;
}

/**
 * JSON-RPC provider interface (from polkadot-api)
 */
export type JsonRpcProvider = (
  onMessage: (message: string) => void
) => {
  send: (message: string) => void;
  disconnect: () => void;
};

// Cached SDK instance
let cachedSdk: ProductSdkModule | null = null;

/**
 * Load the product SDK module.
 * Returns cached instance if already loaded.
 *
 * @throws If SDK is not available (not in container)
 */
export async function loadProductSdk(): Promise<ProductSdkModule> {
  if (cachedSdk) return cachedSdk;

  try {
    // Dynamic import of the optional peer dependency
    // Using Function constructor to avoid TypeScript module resolution
    // This module is only available at runtime when injected by the host
    const importFn = new Function(
      'specifier',
      'return import(specifier)'
    ) as (specifier: string) => Promise<unknown>;

    const sdk = (await importFn('@novasamatech/product-sdk')) as ProductSdkModule;
    cachedSdk = sdk;
    log.info('Product SDK loaded successfully');
    return sdk;
  } catch (e) {
    log.debug('Failed to load product SDK', { error: e });
    throw new Error(
      'Product SDK (@novasamatech/product-sdk) is not available. ' +
        'This SDK is only available when running inside a host container.'
    );
  }
}

/**
 * Get the host localStorage if available.
 * Returns null if not in container mode.
 */
export async function getHostLocalStorage(): Promise<HostLocalStorage | null> {
  try {
    const sdk = await loadProductSdk();
    return sdk.hostLocalStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Get the sandbox provider if available.
 * Returns null if not in container mode.
 */
export async function getSandboxProvider(): Promise<SandboxProvider | null> {
  try {
    const sdk = await loadProductSdk();
    return sdk.sandboxProvider ?? null;
  } catch {
    return null;
  }
}

/**
 * Get the accounts provider if available.
 * Returns null if not in container mode.
 */
export async function getAccountsProvider(): Promise<AccountsProvider | null> {
  try {
    const sdk = await loadProductSdk();
    return sdk.createAccountsProvider?.() ?? null;
  } catch {
    return null;
  }
}
