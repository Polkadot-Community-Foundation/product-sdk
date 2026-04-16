/**
 * Wallet module types
 *
 * Credit: Based on polkadot-apps/packages/signer
 */

import type { PolkadotSigner } from 'polkadot-api';

/** Connection status for wallet */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

/** Source of an account */
export type ProviderType = 'host' | 'extension' | 'dev';

/**
 * A signing-capable account
 */
export interface WalletAccount {
  /** SS58 address (generic prefix 42 by default) */
  address: string;
  /** H160 EVM address derived from the public key (optional) */
  h160Address?: `0x${string}`;
  /** Raw public key (32 bytes) (optional) */
  publicKey?: Uint8Array;
  /** Human-readable name if available */
  name: string | null;
  /** Which provider supplied this account */
  source: ProviderType;
  /** Get the PolkadotSigner for this account (optional - not available for all providers) */
  getSigner?: () => PolkadotSigner;
}

/**
 * Full wallet state snapshot
 */
export interface WalletState {
  /** Current connection status */
  status: ConnectionStatus;
  /** All available accounts */
  accounts: readonly WalletAccount[];
  /** Currently selected account */
  selectedAccount: WalletAccount | null;
  /** Which provider is active */
  activeProvider: ProviderType | null;
  /** Last error */
  error: WalletError | null;
}

/**
 * Wallet error types
 */
export type WalletErrorType =
  | 'HOST_UNAVAILABLE'
  | 'HOST_REJECTED'
  | 'HOST_DISCONNECTED'
  | 'EXTENSION_NOT_FOUND'
  | 'EXTENSION_REJECTED'
  | 'SIGNING_FAILED'
  | 'NO_ACCOUNTS'
  | 'TIMEOUT'
  | 'ACCOUNT_NOT_FOUND'
  | 'DESTROYED';

/**
 * Wallet error
 */
export interface WalletError {
  type: WalletErrorType;
  message: string;
  cause?: unknown;
}

/**
 * Options for wallet initialization
 */
export interface WalletOptions {
  /** SS58 prefix for address encoding (default: 42) */
  ss58Prefix?: number;
  /** App name for storage namespacing */
  appName?: string;
  /** Timeout for host connection in ms (default: 10000) */
  hostTimeout?: number;
  /** Timeout for extension injection in ms (default: 1000) */
  extensionTimeout?: number;
}

/**
 * Product account info (container mode only)
 */
export interface ProductAccount {
  /** SS58 address */
  address: string;
  /** Ring VRF anonymous alias */
  anonymousAlias: string | null;
  /** Ring location for proof generation */
  ringLocation: RingLocation | null;
}

/**
 * Ring VRF location for proof generation
 */
export interface RingLocation {
  /** Ring index */
  ringIndex: number;
  /** Member index within ring */
  memberIndex: number;
}
