/**
 * SS58 address utilities
 *
 * Credit: Based on polkadot-apps/packages/address
 */

import {
    AccountId,
    fromBufferToBase58,
    getSs58AddressInfo,
    type SS58String,
} from "@polkadot-api/substrate-bindings";

const GENERIC_PREFIX = 42;
const POLKADOT_PREFIX = 0;

/**
 * Validate whether a string is a valid SS58 address.
 */
export function isValidSs58(address: string): boolean {
    try {
        const info = getSs58AddressInfo(address as SS58String);
        return info.isValid;
    } catch {
        return false;
    }
}

/**
 * Decode an SS58 address into its raw public key bytes and network prefix.
 */
export function ss58Decode(address: string): { publicKey: Uint8Array; prefix: number } {
    const info = getSs58AddressInfo(address as SS58String);
    if (!info.isValid) {
        throw new Error(`Invalid SS58 address: ${address}`);
    }
    return { publicKey: info.publicKey, prefix: info.ss58Format };
}

/**
 * Encode raw public key bytes into an SS58 address with the given prefix.
 * Defaults to prefix 42 (generic Substrate).
 */
export function ss58Encode(publicKey: Uint8Array, prefix: number = GENERIC_PREFIX): string {
    return fromBufferToBase58(prefix)(publicKey);
}

/**
 * Re-encode an SS58 address with a different network prefix.
 * Returns null if the input is not a valid SS58 address.
 */
export function normalizeSs58(address: string, prefix: number = GENERIC_PREFIX): string | null {
    try {
        const { publicKey } = ss58Decode(address);
        return ss58Encode(publicKey, prefix);
    } catch {
        return null;
    }
}

/**
 * Convert any SS58 address to generic Substrate format (prefix 42).
 * Returns null if the input is invalid.
 */
export function toGenericSs58(address: string): string | null {
    return normalizeSs58(address, GENERIC_PREFIX);
}

/**
 * Convert any SS58 address to Polkadot format (prefix 0).
 * Returns null if the input is invalid.
 */
export function toPolkadotSs58(address: string): string | null {
    return normalizeSs58(address, POLKADOT_PREFIX);
}

/**
 * Encode an SS58 address from a 32-byte public key using polkadot-api's AccountId codec.
 * This is the inverse of `accountIdBytes()`.
 */
export function accountIdFromBytes(publicKey: Uint8Array, prefix: number = GENERIC_PREFIX): string {
    return AccountId(prefix).dec(publicKey);
}

/**
 * Decode an SS58 address to its 32-byte AccountId using polkadot-api's AccountId codec.
 * This is the inverse of `accountIdFromBytes()`.
 */
export function accountIdBytes(address: string): Uint8Array {
    return AccountId().enc(address);
}
