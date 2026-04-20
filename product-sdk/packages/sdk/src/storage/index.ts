/**
 * @parity/product-sdk/storage
 *
 * Key-value storage utilities.
 * Uses localStorage in standalone mode, TruAPI hostLocalStorage in container mode.
 *
 * Credit: Based on polkadot-apps/packages/storage
 */

export { createKvStore } from "./kv-store.js";
export type { KvStore, KvStoreOptions, HostLocalStorage } from "./types.js";
