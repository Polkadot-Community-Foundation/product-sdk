/**
 * @parity/product-sdk/address
 *
 * Address utilities for the Polkadot ecosystem.
 * Includes SS58 encoding/decoding, H160 conversion, validation, and display utilities.
 *
 * Credit: Based on patterns from polkadot-apps/packages/address
 */

// SS58 utilities
export {
    isValidSs58,
    ss58Decode,
    ss58Encode,
    normalizeSs58,
    toGenericSs58,
    toPolkadotSs58,
    accountIdFromBytes,
    accountIdBytes,
} from "./ss58.js";

// H160 (EVM) utilities
export { deriveH160, ss58ToH160, h160ToSs58, toH160, isValidH160 } from "./h160.js";

// Display utilities
export { truncateAddress, addressesEqual } from "./display.js";

// Types
export type { SS58String, HexString, H160Address, Address } from "./types.js";
