/**
 * Hashing utilities
 *
 * Credit: Patterns extracted from polkadot-apps and multiple Parity products:
 * - bulletin-deploy: Blake2b-256 for CIDs
 * - mark3t: Blake2b-256 for CIDs
 * - sourc3s: SHA-256 for nullifiers
 * - linktr33: SHA-256 for profile signing
 * - sh33ts: Blake2b-256 for content hashing
 */

import { sha256 } from '@noble/hashes/sha256';
import { blake2b } from '@noble/hashes/blake2b';
import type { HashAlgorithm } from './types.js';

/**
 * Hash data using the specified algorithm
 *
 * @param data - Data to hash (string or bytes)
 * @param algorithm - Hash algorithm to use
 * @returns Hash digest as Uint8Array
 *
 * @example
 * ```ts
 * const hash = hash('hello world', 'sha-256');
 * const cidHash = hash(fileBytes, 'blake2b-256');
 * ```
 */
export function hash(
  data: string | Uint8Array,
  algorithm: HashAlgorithm = 'sha-256'
): Uint8Array {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;

  switch (algorithm) {
    case 'sha-256':
      return sha256(bytes);
    case 'blake2b-256':
      return blake2b(bytes, { dkLen: 32 });
    case 'blake2b-512':
      return blake2b(bytes, { dkLen: 64 });
    default:
      throw new Error(`Unsupported hash algorithm: ${algorithm}`);
  }
}

/**
 * Hash multiple buffers concatenated together
 * Useful for deterministic hashing of multiple values
 *
 * @param algorithm - Hash algorithm to use
 * @param buffers - Buffers to concatenate and hash
 * @returns Hash digest
 *
 * @example
 * ```ts
 * // Nullifier = SHA256(secret || publicKey)
 * const nullifier = hashConcat('sha-256', secret, publicKey);
 * ```
 */
export function hashConcat(
  algorithm: HashAlgorithm,
  ...buffers: Uint8Array[]
): Uint8Array {
  const totalLength = buffers.reduce((acc, buf) => acc + buf.length, 0);
  const combined = new Uint8Array(totalLength);

  let offset = 0;
  for (const buf of buffers) {
    combined.set(buf, offset);
    offset += buf.length;
  }

  return hash(combined, algorithm);
}

/**
 * Hash to hex string
 *
 * @param data - Data to hash
 * @param algorithm - Hash algorithm
 * @returns Hex-encoded hash
 */
export function hashToHex(
  data: string | Uint8Array,
  algorithm: HashAlgorithm = 'sha-256'
): string {
  return toHex(hash(data, algorithm));
}

/**
 * Convert bytes to hex string
 */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex string to bytes
 */
export function fromHex(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
