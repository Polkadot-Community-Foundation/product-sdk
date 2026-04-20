/**
 * CID computation utilities
 *
 * Credit: Based on polkadot-apps/packages/bulletin
 */

import { blake2b } from "@noble/hashes/blake2b";
import { bytesToHex } from "@noble/hashes/utils";

// Blake2b-256 multicodec
const BLAKE2B_256 = 0xb220;

// CIDv1 with raw codec
const CIDV1_RAW = 0x55;

/**
 * Compute the CIDv1 (blake2b-256, raw codec) for arbitrary data.
 * Deterministic: same input always produces the same CID.
 *
 * @param data - Data to compute CID for
 * @returns CIDv1 string in base32lower encoding
 *
 * @example
 * ```ts
 * const cid = computeCid(new TextEncoder().encode('hello'));
 * // Returns: bafk2bzace...
 * ```
 */
export function computeCid(data: Uint8Array): string {
    const hash = blake2b(data, { dkLen: 32 });

    // Build CIDv1 manually: version (1) + codec (raw) + multihash
    // Multihash: hash code (blake2b-256) + length (32) + digest
    const multihash = new Uint8Array(2 + 1 + 32);
    // Blake2b-256 code as varint (0xb220 = 0xa0 0x64 in varint)
    multihash[0] = 0xa0;
    multihash[1] = 0x64;
    // Length
    multihash[2] = 32;
    // Digest
    multihash.set(hash, 3);

    // CIDv1: version (0x01) + codec (raw = 0x55) + multihash
    const cidBytes = new Uint8Array(1 + 1 + multihash.length);
    cidBytes[0] = 0x01; // CIDv1
    cidBytes[1] = CIDV1_RAW;
    cidBytes.set(multihash, 2);

    // Encode as base32lower with 'b' prefix (multibase)
    return "b" + base32Encode(cidBytes);
}

/**
 * Extract the blake2b-256 digest from a CID and return as hex.
 * This is the preimage key format used by the host API.
 *
 * @param cid - CIDv1 string
 * @returns 0x-prefixed hex string of the 32-byte digest
 */
export function cidToPreimageKey(cid: string): `0x${string}` {
    if (!cid.startsWith("b")) {
        throw new Error('Expected base32lower CID (starting with "b")');
    }

    const bytes = base32Decode(cid.slice(1));

    // Verify CIDv1
    if (bytes[0] !== 0x01) {
        throw new Error(`Expected CIDv1, got version ${bytes[0]}`);
    }

    // Skip version (1) and codec (1), get multihash
    // Multihash: code (2 bytes varint for blake2b-256) + length (1) + digest (32)
    const hashCode = (bytes[2] & 0x7f) | ((bytes[3] & 0x7f) << 7);
    if (hashCode !== BLAKE2B_256) {
        throw new Error(`Expected blake2b-256 (0xb220), got 0x${hashCode.toString(16)}`);
    }

    // Extract 32-byte digest (starts at offset 5: version + codec + hash code + length)
    const digest = bytes.slice(5, 37);
    return `0x${bytesToHex(digest)}`;
}

/**
 * Compute CID for string data
 */
export function computeCidFromString(data: string): string {
    return computeCid(new TextEncoder().encode(data));
}

// RFC 4648 base32 (lowercase)
const BASE32_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

function base32Encode(data: Uint8Array): string {
    let result = "";
    let bits = 0;
    let value = 0;

    for (const byte of data) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            bits -= 5;
            result += BASE32_ALPHABET[(value >> bits) & 0x1f];
        }
    }

    if (bits > 0) {
        result += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
    }

    return result;
}

function base32Decode(str: string): Uint8Array {
    const result: number[] = [];
    let bits = 0;
    let value = 0;

    for (const char of str.toLowerCase()) {
        const idx = BASE32_ALPHABET.indexOf(char);
        if (idx === -1) continue;
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            bits -= 8;
            result.push((value >> bits) & 0xff);
        }
    }

    return new Uint8Array(result);
}
