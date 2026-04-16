/**
 * useChain hook
 */

import { useMemo } from 'react';
import { useProductSDK } from './context.js';
import type { ChainDescriptor } from '../core/types.js';

/**
 * Hook to get a typed chain client
 *
 * @param chain - Chain descriptor (from chains.assetHub, chains.bulletin, etc.)
 *
 * @example
 * ```tsx
 * import { chains } from '@parity/product-sdk';
 * import { useChain } from '@parity/product-sdk/react';
 *
 * function AssetHubBalance() {
 *   const assetHub = useChain(chains.assetHub);
 *
 *   // assetHub is typed for Asset Hub queries
 *   const balance = await assetHub.query.System.Account.getValue(address);
 * }
 * ```
 */
export function useChain<T>(chain: ChainDescriptor<T>): T {
  const app = useProductSDK();

  return useMemo(() => {
    return app.chain.getClient(chain);
  }, [app, chain]);
}
