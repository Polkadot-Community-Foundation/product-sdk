/**
 * Bulletin module types
 *
 * Credit: Based on polkadot-apps/packages/bulletin
 */

/** Network environment */
export type Environment = 'polkadot' | 'kusama' | 'paseo';

/** Options for upload operations */
export interface UploadOptions {
  /** IPFS gateway base URL for constructing URLs */
  gateway?: string;
  /** Timeout in ms (default: 300000 = 5 min) */
  timeoutMs?: number;
  /** Progress callback */
  onProgress?: (progress: UploadProgress) => void;
}

/** Upload progress information */
export interface UploadProgress {
  /** Current stage */
  stage: 'preparing' | 'uploading' | 'confirming' | 'complete';
  /** Progress percentage (0-100) */
  percent: number;
}

/** Result of a successful upload */
export interface UploadResult {
  /** CIDv1 string (blake2b-256, raw codec) */
  cid: string;
  /** Gateway URL if gateway was provided */
  gatewayUrl?: string;
  /** Block hash where data was stored */
  blockHash?: string;
}

/** Options for fetch operations */
export interface FetchOptions {
  /** Timeout in ms (default: 30000) */
  timeoutMs?: number;
}

/** Batch upload item */
export interface BatchUploadItem {
  /** Raw bytes to upload */
  data: Uint8Array;
  /** Label for progress tracking */
  label: string;
}

/** Batch upload result */
export interface BatchUploadResult {
  /** Item label */
  label: string;
  /** CID of uploaded data */
  cid: string;
  /** Whether upload succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Gateway URL if available */
  gatewayUrl?: string;
}

/** Batch upload options */
export interface BatchUploadOptions extends UploadOptions {
  /** Called after each item completes */
  onItemComplete?: (completed: number, total: number, result: BatchUploadResult) => void;
}
