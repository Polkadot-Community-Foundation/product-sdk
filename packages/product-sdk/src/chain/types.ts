/**
 * Chain module types
 *
 * Credit: Based on polkadot-apps/packages/chain-client
 */

import type { ChainDefinition, PolkadotClient, TypedApi } from 'polkadot-api';

/** Supported network environments */
export type Environment = 'polkadot' | 'kusama' | 'paseo';

/** Connection mode for fallback strategy */
export type ConnectionMode = 'rpc' | 'lightclient';

/** Chain metadata including RPC endpoints */
export interface ChainMeta {
  /** RPC WebSocket endpoints */
  rpcs?: readonly string[];
  /** Relay chain spec for light client */
  relayChainSpec?: string;
  /** Parachain spec for light client */
  paraChainSpec?: string;
  /** Preferred connection mode */
  mode?: ConnectionMode;
}

/** Chain descriptor with type information */
export interface ChainDescriptor<T = unknown> {
  /** Chain identifier */
  id: string;
  /** Human-readable chain name */
  name: string;
  /** Genesis hash */
  genesis: string;
  /** RPC endpoints */
  endpoints: string[];
  /** Type marker for inference */
  _type?: T;
}

/** Chain API interface returned by getChainAPI */
export interface ChainApiResult<E extends Environment> {
  /** Asset Hub typed API */
  assetHub: TypedApi<ChainDefinition>;
  /** Bulletin Chain typed API */
  bulletin: TypedApi<ChainDefinition>;
  /** Individuality/People chain typed API */
  individuality: TypedApi<ChainDefinition>;
  /** Destroy all connections for this environment */
  destroy: () => void;
}
