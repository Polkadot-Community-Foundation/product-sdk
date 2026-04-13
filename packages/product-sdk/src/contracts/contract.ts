/**
 * Contract interaction
 *
 * Provides type-safe interaction with ink! contracts on Asset Hub
 */

import { createLogger } from '../core/logger.js';
import type {
  ContractMetadata,
  CallOptions,
  CallResult,
  DryRunResult,
  ContractEvent,
} from './types.js';

const log = createLogger('contracts');

/**
 * Contract instance for interacting with a deployed ink! contract
 *
 * @example
 * ```ts
 * import { Contract } from '@parity/product-sdk/contracts';
 *
 * const contract = new Contract({
 *   address: '5Grw...',
 *   metadata: contractMetadata,
 * });
 *
 * // Read-only call
 * const balance = await contract.query.balanceOf(address);
 *
 * // State-mutating call
 * const result = await contract.tx.transfer(to, amount);
 * ```
 */
export class Contract {
  /** Contract address (SS58) */
  readonly address: string;
  /** Contract metadata */
  readonly metadata: ContractMetadata;

  constructor(options: { address: string; metadata: ContractMetadata }) {
    this.address = options.address;
    this.metadata = options.metadata;
    log.debug('Contract initialized', { address: this.address, name: this.metadata.name });
  }

  /**
   * Query a contract message (read-only, no state change)
   *
   * @param message - Message name
   * @param args - Message arguments
   * @returns Call result with decoded value
   */
  async query<T = unknown>(
    message: string,
    ...args: unknown[]
  ): Promise<CallResult<T>> {
    log.debug('Querying contract', { address: this.address, message, args });

    // TODO: Implement via PAPI
    throw new Error(
      'Contract.query() is not yet implemented. ' +
        'This is a skeleton for the Product SDK structure.'
    );
  }

  /**
   * Call a contract message (state-mutating)
   *
   * @param message - Message name
   * @param options - Call options (gas, value, etc.)
   * @param args - Message arguments
   * @returns Call result
   */
  async call<T = unknown>(
    message: string,
    options: CallOptions,
    ...args: unknown[]
  ): Promise<CallResult<T>> {
    log.debug('Calling contract', { address: this.address, message, options, args });

    // TODO: Implement via PAPI
    throw new Error(
      'Contract.call() is not yet implemented. ' +
        'This is a skeleton for the Product SDK structure.'
    );
  }

  /**
   * Dry run a contract message to estimate gas
   *
   * @param message - Message name
   * @param options - Call options
   * @param args - Message arguments
   * @returns Dry run result with gas estimate
   */
  async dryRun<T = unknown>(
    message: string,
    options: CallOptions,
    ...args: unknown[]
  ): Promise<DryRunResult<T>> {
    log.debug('Dry running contract', { address: this.address, message, options, args });

    // TODO: Implement via PAPI
    throw new Error(
      'Contract.dryRun() is not yet implemented. ' +
        'This is a skeleton for the Product SDK structure.'
    );
  }

  /**
   * Subscribe to contract events
   *
   * @param eventName - Event name to filter (or '*' for all)
   * @param callback - Event callback
   * @returns Unsubscribe function
   */
  subscribeEvents(
    eventName: string,
    callback: (event: ContractEvent) => void
  ): () => void {
    log.debug('Subscribing to contract events', { address: this.address, eventName });

    // TODO: Implement via PAPI
    throw new Error(
      'Contract.subscribeEvents() is not yet implemented. ' +
        'This is a skeleton for the Product SDK structure.'
    );
  }

  /**
   * Get message definition from metadata
   */
  getMessage(name: string) {
    return this.metadata.messages.find((m) => m.name === name);
  }

  /**
   * Get all message names
   */
  getMessageNames(): string[] {
    return this.metadata.messages.map((m) => m.name);
  }
}
