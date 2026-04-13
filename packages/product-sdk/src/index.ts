/**
 * @parity/product-sdk
 *
 * Unified SDK for building products on the Polkadot ecosystem.
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
 * ```
 *
 * @packageDocumentation
 */

// Core exports
export { createApp } from './core/createApp.js';
export type {
  App,
  AppConfig,
  LogLevel,
  WalletApi,
  StorageApi,
  ChainApi,
  BulletinApi,
  Account,
  ChainDescriptor,
} from './core/types.js';
