/** Subset of product-sdk's hostLocalStorage that the KV store uses. */
export interface HostLocalStorage {
    readString(key: string): Promise<string | null>;
    writeString(key: string, value: string): Promise<void>;
    readJSON<T>(key: string): Promise<T | null>;
    writeJSON<T>(key: string, value: T): Promise<void>;
    clear(): Promise<void>;
}

/** The statement store interface provided by the host API via product-sdk. */
export interface HostStatementStore {
    subscribe(callback: (data: unknown) => void): () => void;
    createProof(data: unknown): Promise<unknown>;
    submit(proof: unknown): Promise<void>;
}
