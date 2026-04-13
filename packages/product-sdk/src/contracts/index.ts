/**
 * @parity/product-sdk/contracts
 *
 * Smart contract interaction utilities.
 * Supports ink! contracts on Asset Hub and other parachains.
 */

export { Contract } from './contract.js';
export type {
  ContractMetadata,
  ContractMessage,
  ContractConstructor,
  ContractEventDef,
  ContractArg,
  ContractType,
  CallOptions,
  CallResult,
  DryRunResult,
  ContractEvent,
  DeployResult,
} from './types.js';
