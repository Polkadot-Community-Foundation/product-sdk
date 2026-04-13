/**
 * Chain descriptors for the Polkadot ecosystem
 *
 * Provides typed chain objects for use with app.chain.getClient()
 *
 * @example
 * ```ts
 * import { chains } from '@parity/product-sdk';
 *
 * const client = app.chain.getClient(chains.assetHub);
 * // client is typed for Asset Hub
 * ```
 */

import type { ChainDescriptor } from './types.js';

/**
 * Asset Hub chain descriptor
 * Main chain for assets and contracts on Polkadot
 */
export const assetHub: ChainDescriptor = {
  id: 'asset-hub',
  name: 'Asset Hub',
  genesis: '0x68d56f15f85d3136970ec16946040bc1752654e906147f7e43e9d539d7c3de2f', // Polkadot Asset Hub
  endpoints: [
    'wss://polkadot-asset-hub-rpc.polkadot.io',
    'wss://sys.ibp.network/asset-hub-polkadot',
  ],
};

/**
 * Bulletin Chain descriptor
 * Decentralized storage chain for Polkadot ecosystem
 */
export const bulletin: ChainDescriptor = {
  id: 'bulletin',
  name: 'Bulletin Chain',
  genesis: '0x...', // TODO: Add bulletin genesis
  endpoints: ['wss://paseo-bulletin-rpc.polkadot.io'],
};

/**
 * People Chain (Individuality) descriptor
 * Identity chain for the Polkadot ecosystem
 */
export const people: ChainDescriptor = {
  id: 'people',
  name: 'People Chain',
  genesis: '0x...', // TODO: Add people chain genesis
  endpoints: ['wss://pop3-testnet.parity-lab.parity.io/people'],
};

/**
 * All available chain descriptors
 */
export const chains = {
  assetHub,
  bulletin,
  people,
} as const;
