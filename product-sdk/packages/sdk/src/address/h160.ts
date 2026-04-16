/**
 * H160 (EVM) address utilities
 *
 * Credit: Based on polkadot-apps/packages/address
 */

import { AccountId } from '@polkadot-api/substrate-bindings';
import { keccak_256 } from '@noble/hashes/sha3';
import type { H160Address } from './types.js';

const EVM_DERIVED_MARKER = 0xee;
const H160_BYTE_LEN = 20;
const ACCOUNTID_BYTE_LEN = 32;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Derive the H160 EVM address from a 32-byte Substrate public key.
 *
 * Asset Hub pallet-revive uses these derivation rules:
 * - If the account was originally EVM-derived (last 12 bytes are all 0xEE):
 *   strip the padding to recover the original H160 address.
 * - If native Substrate account (sr25519/ed25519):
 *   keccak256(publicKey), take last 20 bytes. One-way mapping.
 */
export function deriveH160(publicKey: Uint8Array): H160Address {
  if (publicKey.length !== ACCOUNTID_BYTE_LEN) {
    throw new Error(
      `Expected ${ACCOUNTID_BYTE_LEN}-byte public key, got ${publicKey.length} bytes`
    );
  }

  const isEvmDerived = publicKey.slice(H160_BYTE_LEN).every((b) => b === EVM_DERIVED_MARKER);

  if (isEvmDerived) {
    return `0x${bytesToHex(publicKey.slice(0, H160_BYTE_LEN))}`;
  }

  const hash = keccak_256(publicKey);
  return `0x${bytesToHex(hash.slice(ACCOUNTID_BYTE_LEN - H160_BYTE_LEN, ACCOUNTID_BYTE_LEN))}`;
}

/**
 * Convert an SS58 address to its H160 EVM address.
 *
 * Handles both native Substrate accounts (keccak256 path) and
 * EVM-derived accounts (0xEE padding strip).
 */
export function ss58ToH160(address: string): H160Address {
  const publicKey = AccountId().enc(address);
  return deriveH160(publicKey);
}

/**
 * Convert an H160 EVM address to its corresponding SS58 address.
 *
 * Constructs an "EVM-derived" AccountId32 by padding the H160 with 0xEE bytes.
 * These accounts are implicitly mapped in pallet-revive.
 */
export function h160ToSs58(evmAddress: string, prefix: number = 42): string {
  const hex = evmAddress.startsWith('0x') ? evmAddress.slice(2) : evmAddress;
  if (hex.length !== H160_BYTE_LEN * 2 || !/^[a-fA-F0-9]+$/.test(hex)) {
    throw new Error(`Invalid H160 address: ${evmAddress}`);
  }

  const padded = new Uint8Array(ACCOUNTID_BYTE_LEN);
  padded.set(hexToBytes(hex), 0);
  for (let i = H160_BYTE_LEN; i < ACCOUNTID_BYTE_LEN; i++) {
    padded[i] = EVM_DERIVED_MARKER;
  }
  return AccountId(prefix).dec(padded);
}

/**
 * Convert any address (SS58 or H160) to an H160 EVM address.
 * If already H160 format (0x-prefixed, 42 chars), returns as-is preserving original casing.
 */
export function toH160(address: string): H160Address {
  if (address.startsWith('0x') && address.length === 42) {
    return address as H160Address;
  }
  return ss58ToH160(address);
}

/**
 * Validate whether a string is a valid H160 (20-byte hex) address.
 */
export function isValidH160(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}
