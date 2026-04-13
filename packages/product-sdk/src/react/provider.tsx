/**
 * ProductSDKProvider component
 */

import React, { useMemo, type ReactNode } from 'react';
import { ProductSDKContext } from './context.js';
import { createApp } from '../core/createApp.js';
import type { LogLevel } from '../core/types.js';

/** Props for ProductSDKProvider */
export interface ProductSDKProviderProps {
  /** Application name - used for storage namespacing and product account derivation */
  name: string;
  /** Log level (default: 'info') */
  logLevel?: LogLevel;
  /** Child components */
  children: ReactNode;
}

/**
 * Provider component that initializes the Product SDK
 *
 * @example
 * ```tsx
 * import { ProductSDKProvider } from '@parity/product-sdk/react';
 *
 * function App() {
 *   return (
 *     <ProductSDKProvider name="my-app">
 *       <MyApp />
 *     </ProductSDKProvider>
 *   );
 * }
 * ```
 */
export function ProductSDKProvider({
  name,
  logLevel = 'info',
  children,
}: ProductSDKProviderProps) {
  const app = useMemo(() => {
    return createApp({ name, logLevel });
  }, [name, logLevel]);

  return (
    <ProductSDKContext.Provider value={app}>
      {children}
    </ProductSDKContext.Provider>
  );
}
