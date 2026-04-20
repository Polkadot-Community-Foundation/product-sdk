/**
 * Bulletin Chain client
 *
 * Credit: Based on polkadot-apps/packages/bulletin
 */

import { createLogger } from "../core/logger.js";
import { computeCid } from "./cid.js";
import type {
    Environment,
    UploadOptions,
    UploadResult,
    FetchOptions,
    BatchUploadItem,
    BatchUploadResult,
    BatchUploadOptions,
} from "./types.js";

const log = createLogger("bulletin");

/** Default IPFS gateways per environment */
const GATEWAYS: Record<Environment, string> = {
    polkadot: "https://ipfs.io/ipfs",
    kusama: "https://ipfs.io/ipfs",
    paseo: "https://ipfs.io/ipfs",
};

/**
 * Get the default gateway URL for an environment
 */
export function getGateway(env: Environment): string {
    return GATEWAYS[env];
}

/**
 * Construct a gateway URL for a CID
 */
export function gatewayUrl(gateway: string, cid: string): string {
    return `${gateway}/${cid}`;
}

/**
 * Bulletin Chain client for uploading and fetching data
 *
 * @example
 * ```ts
 * const bulletin = new BulletinClient({ environment: 'paseo' });
 *
 * // Upload data
 * const result = await bulletin.upload(data);
 * console.log('CID:', result.cid);
 *
 * // Fetch data
 * const fetched = await bulletin.fetch(result.cid);
 * ```
 */
export class BulletinClient {
    private environment: Environment;
    private gateway: string;

    constructor(options: { environment: Environment; gateway?: string }) {
        this.environment = options.environment;
        this.gateway = options.gateway ?? getGateway(options.environment);
        log.debug("BulletinClient initialized", { environment: this.environment });
    }

    /**
     * Upload data to Bulletin Chain
     *
     * @param data - Data to upload (string or bytes)
     * @param options - Upload options
     * @returns Upload result with CID
     */
    async upload(data: string | Uint8Array, options?: UploadOptions): Promise<UploadResult> {
        const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
        const cid = computeCid(bytes);

        log.info("Uploading to Bulletin Chain", { cid, size: bytes.length });

        options?.onProgress?.({ stage: "preparing", percent: 0 });

        // TODO: Implement actual upload via:
        // 1. In container mode: use TruAPI preimage API
        // 2. In standalone mode: submit TransactionStorage.store extrinsic

        throw new Error(
            "BulletinClient.upload() is not yet implemented. " +
                "This is a skeleton for the Product SDK structure.",
        );
    }

    /**
     * Fetch data by CID
     *
     * @param cid - Content identifier
     * @param options - Fetch options
     * @returns Fetched data as bytes
     */
    async fetch(cid: string, options?: FetchOptions): Promise<Uint8Array> {
        log.debug("Fetching from Bulletin Chain", { cid });

        const timeoutMs = options?.timeoutMs ?? 30_000;
        const url = gatewayUrl(this.gateway, cid);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) {
                throw new Error(`Gateway fetch failed: ${response.status} ${response.statusText}`);
            }
            const buffer = await response.arrayBuffer();
            return new Uint8Array(buffer);
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Compute CID for data without uploading
     *
     * @param data - Data to compute CID for
     * @returns CIDv1 string
     */
    computeCid(data: string | Uint8Array): string {
        const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
        return computeCid(bytes);
    }

    /**
     * Upload multiple items in batch
     *
     * @param items - Items to upload
     * @param options - Batch upload options
     * @returns Results for each item
     */
    async batchUpload(
        items: BatchUploadItem[],
        options?: BatchUploadOptions,
    ): Promise<BatchUploadResult[]> {
        const results: BatchUploadResult[] = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            try {
                const result = await this.upload(item.data, options);
                const batchResult: BatchUploadResult = {
                    label: item.label,
                    cid: result.cid,
                    success: true,
                    gatewayUrl: result.gatewayUrl,
                };
                results.push(batchResult);
                options?.onItemComplete?.(i + 1, items.length, batchResult);
            } catch (e) {
                const batchResult: BatchUploadResult = {
                    label: item.label,
                    cid: computeCid(item.data),
                    success: false,
                    error: e instanceof Error ? e.message : String(e),
                };
                results.push(batchResult);
                options?.onItemComplete?.(i + 1, items.length, batchResult);
            }
        }

        return results;
    }

    /**
     * Check if data exists on the gateway
     *
     * @param cid - Content identifier
     * @returns True if data exists
     */
    async exists(cid: string): Promise<boolean> {
        const url = gatewayUrl(this.gateway, cid);
        try {
            const response = await fetch(url, { method: "HEAD" });
            return response.ok;
        } catch {
            return false;
        }
    }
}
