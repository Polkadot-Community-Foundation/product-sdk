/**
 * Address type definitions
 *
 * Credit: Based on polkadot-apps/packages/address
 */

export type { SS58String, HexString } from "@polkadot-api/substrate-bindings";

/** H160 EVM address (20-byte hex string with 0x prefix) */
export type H160Address = `0x${string}`;

/** SS58 or H160 address */
export type Address = string;
