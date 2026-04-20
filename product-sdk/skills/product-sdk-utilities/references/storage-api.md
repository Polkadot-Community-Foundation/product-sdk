# Storage API Reference

Package: `@parity/product-sdk-storage`

## createKvStore

```ts
function createKvStore(options?: KvStoreOptions): Promise<KvStore>
```

Create a key-value store with automatic backend detection.

**Backend selection:**
1. If `options.hostLocalStorage` provided → host backend
2. If inside container → try host storage, fallback to localStorage
3. Otherwise → browser localStorage

## KvStore Interface

```ts
interface KvStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  getJSON<T>(key: string): Promise<T | null>;
  setJSON(key: string, value: unknown): Promise<void>;
}
```

## KvStoreOptions

```ts
interface KvStoreOptions {
  prefix?: string;                    // Key prefix namespace
  hostLocalStorage?: HostLocalStorage; // Override auto-detection
}
```

## Re-exports

```ts
export type { HostLocalStorage } from "@parity/product-sdk-host";
export { default as Dexie, type Table } from "dexie";
```
