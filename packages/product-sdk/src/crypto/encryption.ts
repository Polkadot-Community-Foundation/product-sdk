/**
 * Encryption utilities
 *
 * Credit: Patterns extracted from polkadot-apps and multiple Parity products:
 * - s3al: X25519 + XSalsa20-Poly1305 (TweetNaCl)
 * - sourc3s: X25519 + AES-GCM (Web Crypto)
 * - mark3t: AES-256-GCM (Web Crypto)
 * - linktr33: AES-256-GCM (@noble/ciphers)
 * - ja3x: Scrypt + AES-GCM (@noble/ciphers)
 * - sh33ts: Mixed (Skiff + TweetNaCl)
 *
 * This module provides a unified API using @noble/ciphers
 */

import { gcm } from '@noble/ciphers/aes';
import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { x25519 } from '@noble/ciphers/webcrypto';
import { randomBytes } from '@noble/ciphers/webcrypto';
import type {
  EncryptedData,
  EncryptedBuffer,
  SymmetricAlgorithm,
  KeyPair,
} from './types.js';

// Nonce sizes
const AES_GCM_NONCE_SIZE = 12;
const XCHACHA_NONCE_SIZE = 24;

/**
 * Generate a random encryption key
 *
 * @param length - Key length in bytes (default: 32 for AES-256)
 * @returns Random key bytes
 */
export function generateKey(length: number = 32): Uint8Array {
  return randomBytes(length);
}

/**
 * Generate an X25519 key pair for asymmetric encryption
 *
 * @returns Key pair with public and private keys
 */
export async function generateKeyPair(): Promise<KeyPair> {
  const privateKey = randomBytes(32);
  const publicKey = await x25519.getPublicKey(privateKey);
  return { publicKey, privateKey };
}

/**
 * Encrypt data with a symmetric key
 *
 * @param plaintext - Data to encrypt
 * @param key - 32-byte encryption key
 * @param algorithm - Encryption algorithm (default: aes-256-gcm)
 * @returns Encrypted data with nonce
 *
 * @example
 * ```ts
 * const key = generateKey();
 * const encrypted = encrypt(data, key);
 * ```
 */
export function encrypt(
  plaintext: Uint8Array,
  key: Uint8Array,
  algorithm: SymmetricAlgorithm = 'aes-256-gcm'
): EncryptedData {
  if (key.length !== 32) {
    throw new Error('Key must be 32 bytes');
  }

  switch (algorithm) {
    case 'aes-256-gcm': {
      const nonce = randomBytes(AES_GCM_NONCE_SIZE);
      const cipher = gcm(key, nonce);
      const ciphertext = cipher.encrypt(plaintext);
      return { ciphertext, nonce };
    }
    case 'xchacha20-poly1305': {
      const nonce = randomBytes(XCHACHA_NONCE_SIZE);
      const cipher = xchacha20poly1305(key, nonce);
      const ciphertext = cipher.encrypt(plaintext);
      return { ciphertext, nonce };
    }
    default:
      throw new Error(`Unsupported algorithm: ${algorithm}`);
  }
}

/**
 * Decrypt data with a symmetric key
 *
 * @param encrypted - Encrypted data with nonce
 * @param key - 32-byte encryption key
 * @param algorithm - Encryption algorithm (default: aes-256-gcm)
 * @returns Decrypted plaintext
 */
export function decrypt(
  encrypted: EncryptedData,
  key: Uint8Array,
  algorithm: SymmetricAlgorithm = 'aes-256-gcm'
): Uint8Array {
  if (key.length !== 32) {
    throw new Error('Key must be 32 bytes');
  }

  switch (algorithm) {
    case 'aes-256-gcm': {
      const cipher = gcm(key, encrypted.nonce);
      return cipher.decrypt(encrypted.ciphertext);
    }
    case 'xchacha20-poly1305': {
      const cipher = xchacha20poly1305(key, encrypted.nonce);
      return cipher.decrypt(encrypted.ciphertext);
    }
    default:
      throw new Error(`Unsupported algorithm: ${algorithm}`);
  }
}

/**
 * Encrypt data and serialize to a single buffer: nonce || ciphertext
 * This is the format used by most products for storage
 *
 * @param plaintext - Data to encrypt
 * @param key - 32-byte encryption key
 * @param algorithm - Encryption algorithm
 * @returns Single buffer containing nonce and ciphertext
 */
export function encryptToBuffer(
  plaintext: Uint8Array,
  key: Uint8Array,
  algorithm: SymmetricAlgorithm = 'aes-256-gcm'
): EncryptedBuffer {
  const { nonce, ciphertext } = encrypt(plaintext, key, algorithm);
  const result = new Uint8Array(nonce.length + ciphertext.length);
  result.set(nonce, 0);
  result.set(ciphertext, nonce.length);
  return result;
}

/**
 * Decrypt data from a serialized buffer: nonce || ciphertext
 *
 * @param buffer - Buffer containing nonce and ciphertext
 * @param key - 32-byte encryption key
 * @param algorithm - Encryption algorithm
 * @returns Decrypted plaintext
 */
export function decryptFromBuffer(
  buffer: EncryptedBuffer,
  key: Uint8Array,
  algorithm: SymmetricAlgorithm = 'aes-256-gcm'
): Uint8Array {
  const nonceSize =
    algorithm === 'xchacha20-poly1305' ? XCHACHA_NONCE_SIZE : AES_GCM_NONCE_SIZE;

  const nonce = buffer.slice(0, nonceSize);
  const ciphertext = buffer.slice(nonceSize);

  return decrypt({ nonce, ciphertext }, key, algorithm);
}

/**
 * Encrypt data for a recipient using X25519 key exchange
 * Generates an ephemeral key pair for forward secrecy
 *
 * @param plaintext - Data to encrypt
 * @param recipientPublicKey - Recipient's X25519 public key
 * @param algorithm - Symmetric algorithm for payload encryption
 * @returns Encrypted buffer: ephemeralPublicKey || nonce || ciphertext
 *
 * @example
 * ```ts
 * // Sender
 * const encrypted = await encryptForRecipient(data, recipientPublicKey);
 *
 * // Recipient
 * const decrypted = await decryptFromSender(encrypted, recipientPrivateKey);
 * ```
 */
export async function encryptForRecipient(
  plaintext: Uint8Array,
  recipientPublicKey: Uint8Array,
  algorithm: SymmetricAlgorithm = 'aes-256-gcm'
): Promise<EncryptedBuffer> {
  // Generate ephemeral key pair
  const ephemeral = await generateKeyPair();

  // Derive shared secret via X25519
  const sharedSecret = await x25519.getSharedSecret(
    ephemeral.privateKey,
    recipientPublicKey
  );

  // Encrypt with shared secret
  const { nonce, ciphertext } = encrypt(plaintext, sharedSecret, algorithm);

  // Pack: ephemeralPublicKey (32) || nonce || ciphertext
  const result = new Uint8Array(32 + nonce.length + ciphertext.length);
  result.set(ephemeral.publicKey, 0);
  result.set(nonce, 32);
  result.set(ciphertext, 32 + nonce.length);

  return result;
}

/**
 * Decrypt data from a sender using X25519 key exchange
 *
 * @param buffer - Encrypted buffer from encryptForRecipient
 * @param recipientPrivateKey - Recipient's X25519 private key
 * @param algorithm - Symmetric algorithm used for encryption
 * @returns Decrypted plaintext
 */
export async function decryptFromSender(
  buffer: EncryptedBuffer,
  recipientPrivateKey: Uint8Array,
  algorithm: SymmetricAlgorithm = 'aes-256-gcm'
): Promise<Uint8Array> {
  const nonceSize =
    algorithm === 'xchacha20-poly1305' ? XCHACHA_NONCE_SIZE : AES_GCM_NONCE_SIZE;

  // Unpack: ephemeralPublicKey (32) || nonce || ciphertext
  const ephemeralPublicKey = buffer.slice(0, 32);
  const nonce = buffer.slice(32, 32 + nonceSize);
  const ciphertext = buffer.slice(32 + nonceSize);

  // Derive shared secret
  const sharedSecret = await x25519.getSharedSecret(
    recipientPrivateKey,
    ephemeralPublicKey
  );

  // Decrypt
  return decrypt({ nonce, ciphertext }, sharedSecret, algorithm);
}

/**
 * Encrypt a string (convenience wrapper)
 */
export function encryptString(
  plaintext: string,
  key: Uint8Array,
  algorithm: SymmetricAlgorithm = 'aes-256-gcm'
): EncryptedBuffer {
  return encryptToBuffer(new TextEncoder().encode(plaintext), key, algorithm);
}

/**
 * Decrypt to a string (convenience wrapper)
 */
export function decryptString(
  buffer: EncryptedBuffer,
  key: Uint8Array,
  algorithm: SymmetricAlgorithm = 'aes-256-gcm'
): string {
  return new TextDecoder().decode(decryptFromBuffer(buffer, key, algorithm));
}
