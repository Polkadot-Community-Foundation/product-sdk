/**
 * Contracts module types
 *
 * Types for ink! smart contract interaction on Asset Hub
 */

/** Contract deployment result */
export interface DeployResult {
    /** Contract address */
    address: string;
    /** H160 EVM address */
    h160Address: `0x${string}`;
    /** Block hash where contract was deployed */
    blockHash: string;
}

/** Contract call options */
export interface CallOptions {
    /** Gas limit (default: auto-estimate) */
    gasLimit?: bigint;
    /** Storage deposit limit */
    storageDepositLimit?: bigint;
    /** Value to transfer with call */
    value?: bigint;
}

/** Contract call result */
export interface CallResult<T = unknown> {
    /** Decoded return value */
    value: T;
    /** Gas consumed */
    gasConsumed: bigint;
    /** Storage deposit */
    storageDeposit: bigint;
}

/** Dry run result for estimating gas */
export interface DryRunResult<T = unknown> {
    /** Whether call would succeed */
    success: boolean;
    /** Decoded return value (if success) */
    value?: T;
    /** Error message (if failed) */
    error?: string;
    /** Estimated gas required */
    gasRequired: bigint;
    /** Storage deposit required */
    storageDeposit: bigint;
}

/** Contract event */
export interface ContractEvent {
    /** Event name */
    name: string;
    /** Event arguments */
    args: Record<string, unknown>;
    /** Block hash */
    blockHash: string;
    /** Event index in block */
    eventIndex: number;
}

/** Contract metadata (from .contract or .json file) */
export interface ContractMetadata {
    /** Contract name */
    name: string;
    /** Contract version */
    version: string;
    /** ABI spec version */
    specVersion: string;
    /** Contract messages (methods) */
    messages: ContractMessage[];
    /** Contract constructors */
    constructors: ContractConstructor[];
    /** Contract events */
    events: ContractEventDef[];
}

/** Contract message definition */
export interface ContractMessage {
    /** Message name */
    name: string;
    /** Message selector */
    selector: string;
    /** Whether message mutates state */
    mutates: boolean;
    /** Whether message is payable */
    payable: boolean;
    /** Argument definitions */
    args: ContractArg[];
    /** Return type */
    returnType?: ContractType;
}

/** Contract constructor definition */
export interface ContractConstructor {
    /** Constructor name */
    name: string;
    /** Constructor selector */
    selector: string;
    /** Whether constructor is payable */
    payable: boolean;
    /** Argument definitions */
    args: ContractArg[];
}

/** Contract event definition */
export interface ContractEventDef {
    /** Event name */
    name: string;
    /** Event arguments */
    args: ContractArg[];
}

/** Contract argument */
export interface ContractArg {
    /** Argument name */
    name: string;
    /** Argument type */
    type: ContractType;
}

/** Contract type */
export interface ContractType {
    /** Type name */
    name: string;
    /** Type parameters (for generics) */
    params?: ContractType[];
}
