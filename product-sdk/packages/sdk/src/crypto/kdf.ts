/**
 * Key Derivation Functions
 *
 * Credit: Patterns extracted from polkadot-apps and multiple Parity products:
 * - s3al: PBKDF2 for passphrase protection
 * - sourc3s: HKDF for context-specific keys
 * - ja3x: Scrypt + HKDF for key derivation
 * - sh33ts: PBKDF2 for wallet-derived keys
 * - t3ams: HKDF for channel keys
 */

import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { hkdf } from '@noble/hashes/hkdf';
import { scrypt } from '@noble/hashes/scrypt';
import { sha256 } from '@noble/hashes/sha256';
import { sha512 } from '@noble/hashes/sha512';
import { randomBytes } from '@noble/ciphers/webcrypto';
import type { KdfOptions, Pbkdf2Options, HkdfOptions, ScryptOptions } from './types.js';

// Default iterations for PBKDF2 (OWASP 2023 recommendation)
const DEFAULT_PBKDF2_ITERATIONS = 600_000;

// Default scrypt parameters (reasonable security/performance balance)
const DEFAULT_SCRYPT_N = 16384;
const DEFAULT_SCRYPT_R = 8;
const DEFAULT_SCRYPT_P = 1;

/**
 * Generate a random salt
 *
 * @param length - Salt length in bytes (default: 16)
 * @returns Random salt
 */
export function generateSalt(length: number = 16): Uint8Array {
  return randomBytes(length);
}

/**
 * Derive a key from a password/passphrase
 *
 * @param password - Password or passphrase
 * @param salt - Random salt (use generateSalt())
 * @param options - KDF algorithm and parameters
 * @param keyLength - Desired key length in bytes (default: 32)
 * @returns Derived key
 *
 * @example
 * ```ts
 * // PBKDF2 (for password-based encryption)
 * const salt = generateSalt();
 * const key = deriveKey('my password', salt, { algorithm: 'pbkdf2' });
 *
 * // HKDF (for deriving multiple keys from a master)
 * const masterKey = getSharedSecret(...);
 * const encKey = deriveKey(masterKey, salt, {
 *   algorithm: 'hkdf',
 *   info: 'encryption-key-v1'
 * });
 *
 * // Scrypt (for high-security password hashing)
 * const key = deriveKey('password', salt, { algorithm: 'scrypt' });
 * ```
 */
export function deriveKey(
  password: string | Uint8Array,
  salt: Uint8Array,
  options: KdfOptions,
  keyLength: number = 32
): Uint8Array {
  const passwordBytes =
    typeof password === 'string' ? new TextEncoder().encode(password) : password;

  switch (options.algorithm) {
    case 'pbkdf2':
      return derivePbkdf2(passwordBytes, salt, options, keyLength);
    case 'hkdf':
      return deriveHkdf(passwordBytes, salt, options, keyLength);
    case 'scrypt':
      return deriveScrypt(passwordBytes, salt, options, keyLength);
    default:
      throw new Error(`Unsupported KDF algorithm: ${(options as KdfOptions).algorithm}`);
  }
}

/**
 * PBKDF2 key derivation
 * Best for: Password-based encryption where password is low-entropy
 */
function derivePbkdf2(
  password: Uint8Array,
  salt: Uint8Array,
  options: Pbkdf2Options,
  keyLength: number
): Uint8Array {
  const iterations = options.iterations ?? DEFAULT_PBKDF2_ITERATIONS;
  const hashFn = options.hash === 'sha-512' ? sha512 : sha256;

  return pbkdf2(hashFn, password, salt, {
    c: iterations,
    dkLen: keyLength,
  });
}

/**
 * HKDF key derivation
 * Best for: Deriving multiple keys from a high-entropy master key
 */
function deriveHkdf(
  ikm: Uint8Array,
  salt: Uint8Array,
  options: HkdfOptions,
  keyLength: number
): Uint8Array {
  const hashFn = options.hash === 'sha-512' ? sha512 : sha256;
  const info =
    typeof options.info === 'string'
      ? new TextEncoder().encode(options.info)
      : options.info ?? new Uint8Array(0);

  return hkdf(hashFn, ikm, salt, info, keyLength);
}

/**
 * Scrypt key derivation
 * Best for: High-security password hashing (memory-hard)
 */
function deriveScrypt(
  password: Uint8Array,
  salt: Uint8Array,
  options: ScryptOptions,
  keyLength: number
): Uint8Array {
  return scrypt(password, salt, {
    N: options.N ?? DEFAULT_SCRYPT_N,
    r: options.r ?? DEFAULT_SCRYPT_R,
    p: options.p ?? DEFAULT_SCRYPT_P,
    dkLen: keyLength,
  });
}

/**
 * Derive multiple keys from a single master key using HKDF
 * Useful for deriving separate encryption and authentication keys
 *
 * @param masterKey - Master key material
 * @param salt - Salt for derivation
 * @param contexts - Array of context strings for each derived key
 * @param keyLength - Length of each derived key
 * @returns Array of derived keys
 *
 * @example
 * ```ts
 * const [encKey, macKey, ivKey] = deriveMultipleKeys(
 *   sharedSecret,
 *   salt,
 *   ['encryption', 'authentication', 'iv']
 * );
 * ```
 */
export function deriveMultipleKeys(
  masterKey: Uint8Array,
  salt: Uint8Array,
  contexts: string[],
  keyLength: number = 32
): Uint8Array[] {
  return contexts.map((context) =>
    deriveKey(masterKey, salt, { algorithm: 'hkdf', info: context }, keyLength)
  );
}

/**
 * Derive a key from a password with auto-generated salt
 * Returns both the key and salt (salt must be stored for later decryption)
 *
 * @param password - Password or passphrase
 * @param options - KDF algorithm and parameters
 * @param keyLength - Desired key length
 * @returns Object with derived key and salt
 */
export function deriveKeyWithSalt(
  password: string,
  options: KdfOptions,
  keyLength: number = 32
): { key: Uint8Array; salt: Uint8Array } {
  const salt = generateSalt();
  const key = deriveKey(password, salt, options, keyLength);
  return { key, salt };
}
