/**
 * @parity/product-sdk/bulletin
 *
 * Bulletin Chain integration for decentralized data storage.
 * Provides CID computation, data upload, and fetch functionality.
 *
 * Credit: Based on polkadot-apps/packages/bulletin
 */

// Client
export { BulletinClient, getGateway, gatewayUrl } from './client.js';

// CID utilities
export { computeCid, cidToPreimageKey, computeCidFromString } from './cid.js';

// Types
export type {
  Environment,
  UploadOptions,
  UploadResult,
  UploadProgress,
  FetchOptions,
  BatchUploadItem,
  BatchUploadResult,
  BatchUploadOptions,
} from './types.js';
