/**
 * createApp - Main entry point for the Product SDK
 *
 * Creates an App instance with wallet, storage, chain, and bulletin APIs.
 */

import type { App, AppConfig } from './types.js';

/**
 * Create a new Product SDK app instance
 *
 * @param config - Application configuration
 * @returns App instance with all APIs
 *
 * @example
 * ```ts
 * import { createApp } from '@parity/product-sdk';
 *
 * const app = createApp({
 *   name: 'my-app',
 *   logLevel: 'info',
 * });
 *
 * // Connect wallet
 * const { accounts } = await app.wallet.connect();
 *
 * // Use storage
 * await app.storage.set('key', 'value');
 *
 * // Get chain client
 * const client = app.chain.getClient(chains.assetHub);
 * ```
 */
export function createApp(config: AppConfig): App {
  // TODO: Implement runtime detection and API initialization
  // - Detect if running in container mode (@novasamatech/product-sdk available)
  // - Or standalone mode (direct browser APIs)
  // - Initialize appropriate implementations

  throw new Error(
    'createApp is not yet implemented. This is a skeleton for the Product SDK structure.'
  );
}
