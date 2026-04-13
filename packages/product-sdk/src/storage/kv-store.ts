/**
 * Key-value store implementation
 *
 * Credit: Based on polkadot-apps/packages/storage
 */

import { createLogger } from '../core/logger.js';
import type { KvStore, KvStoreOptions, HostLocalStorage } from './types.js';

const log = createLogger('storage');

function prefixer(prefix?: string): (key: string) => string {
  return prefix ? (key) => `${prefix}:${key}` : (key) => key;
}

function createLocalStorageBackend(applyPrefix: (key: string) => string): KvStore {
  const available = typeof globalThis.localStorage !== 'undefined';

  if (!available) {
    log.debug('No localStorage available (SSR/Node)');
  }

  return {
    async get(key) {
      if (!available) return null;
      try {
        return globalThis.localStorage.getItem(applyPrefix(key));
      } catch (e) {
        log.warn('localStorage.getItem failed', { key, error: e });
        return null;
      }
    },

    async set(key, value) {
      if (!available) return;
      try {
        globalThis.localStorage.setItem(applyPrefix(key), value);
      } catch (e) {
        log.warn('localStorage.setItem failed', { key, error: e });
      }
    },

    async remove(key) {
      if (!available) return;
      try {
        globalThis.localStorage.removeItem(applyPrefix(key));
      } catch (e) {
        log.warn('localStorage.removeItem failed', { key, error: e });
      }
    },

    async getJSON<T>(key: string): Promise<T | null> {
      const raw = await this.get(key);
      if (raw === null) return null;
      try {
        return JSON.parse(raw) as T;
      } catch (e) {
        log.warn('JSON parse failed for key', { key, error: e });
        return null;
      }
    },

    async setJSON(key, value) {
      await this.set(key, JSON.stringify(value));
    },

    async clear() {
      if (!available) return;
      try {
        // Clear only keys with our prefix
        const prefix = applyPrefix('');
        const keysToRemove: string[] = [];
        for (let i = 0; i < globalThis.localStorage.length; i++) {
          const key = globalThis.localStorage.key(i);
          if (key && key.startsWith(prefix)) {
            keysToRemove.push(key);
          }
        }
        for (const key of keysToRemove) {
          globalThis.localStorage.removeItem(key);
        }
      } catch (e) {
        log.warn('localStorage.clear failed', { error: e });
      }
    },
  };
}

function createHostBackend(
  hostStorage: HostLocalStorage,
  applyPrefix: (key: string) => string
): KvStore {
  return {
    async get(key) {
      try {
        const value = await hostStorage.readString(applyPrefix(key));
        // product-sdk decodes missing keys as "" — normalize to null
        return value || null;
      } catch (e) {
        log.warn('Host readString failed', { key, error: e });
        return null;
      }
    },

    async set(key, value) {
      try {
        await hostStorage.writeString(applyPrefix(key), value);
      } catch (e) {
        log.warn('Host writeString failed', { key, error: e });
      }
    },

    async remove(key) {
      try {
        await hostStorage.clear(applyPrefix(key));
      } catch (e) {
        log.warn('Host clear failed', { key, error: e });
      }
    },

    async getJSON<T>(key: string): Promise<T | null> {
      try {
        const value = await hostStorage.readJSON(applyPrefix(key));
        return (value ?? null) as T | null;
      } catch (e) {
        log.warn('Host readJSON failed', { key, error: e });
        return null;
      }
    },

    async setJSON(key, value) {
      try {
        await hostStorage.writeJSON(applyPrefix(key), value);
      } catch (e) {
        log.warn('Host writeJSON failed', { key, error: e });
      }
    },

    async clear() {
      // Host storage doesn't have a "clear all" - this is a no-op
      // Individual keys should be removed with remove()
      log.debug('clear() is not supported in host storage mode');
    },
  };
}

/**
 * Create a key-value store
 *
 * Automatically detects the environment:
 * - In container mode: uses TruAPI host localStorage
 * - In standalone mode: uses browser localStorage
 *
 * @param options - Store configuration
 * @returns KvStore instance
 *
 * @example
 * ```ts
 * const store = await createKvStore({ prefix: 'myapp' });
 * await store.set('theme', 'dark');
 * const theme = await store.get('theme');
 * ```
 */
export async function createKvStore(options?: KvStoreOptions): Promise<KvStore> {
  const applyPrefix = prefixer(options?.prefix);

  // Explicit host storage takes precedence
  if (options?.hostLocalStorage) {
    return createHostBackend(options.hostLocalStorage, applyPrefix);
  }

  // TODO: Auto-detect container environment when TruAPI is implemented
  // if (await isInsideContainer()) {
  //   const hostStorage = await getHostLocalStorage();
  //   if (hostStorage) {
  //     return createHostBackend(hostStorage, applyPrefix);
  //   }
  // }

  return createLocalStorageBackend(applyPrefix);
}
