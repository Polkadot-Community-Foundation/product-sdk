/**
 * Storage module types
 *
 * Credit: Based on polkadot-apps/packages/storage
 */

/** Key-value store interface */
export interface KvStore {
  /** Get a string value by key */
  get(key: string): Promise<string | null>;
  /** Set a string value by key */
  set(key: string, value: string): Promise<void>;
  /** Remove a value by key */
  remove(key: string): Promise<void>;
  /** Get a JSON value by key */
  getJSON<T>(key: string): Promise<T | null>;
  /** Set a JSON value by key */
  setJSON(key: string, value: unknown): Promise<void>;
  /** Clear all values (with optional prefix filter) */
  clear(): Promise<void>;
}

/** Options for creating a KV store */
export interface KvStoreOptions {
  /** Key prefix to namespace storage keys (e.g. "myapp" → keys become "myapp:theme"). */
  prefix?: string;
  /** Override auto-detection with explicit host storage interface */
  hostLocalStorage?: HostLocalStorage;
}

/**
 * Host localStorage interface (TruAPI)
 * This is injected by the host container environment
 */
export interface HostLocalStorage {
  readString(key: string): Promise<string>;
  writeString(key: string, value: string): Promise<void>;
  readJSON(key: string): Promise<unknown>;
  writeJSON(key: string, value: unknown): Promise<void>;
  clear(key: string): Promise<void>;
}
