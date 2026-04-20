import type { HexString, PolkadotClient } from "polkadot-api";
import type { InkSdk } from "@polkadot-api/sdk-ink";
import { wrapContract } from "./wrap.js";
import { ContractNotFoundError } from "./errors.js";
import type {
    AbiEntry,
    CdmJson,
    CdmJsonContract,
    Contract,
    ContractDef,
    ContractDefaults,
    ContractManagerOptions,
    ContractOptions,
    Contracts,
} from "./types.js";

/**
 * Manages typed contract interactions backed by a `cdm.json` manifest.
 *
 * Pass a `signerManager` (e.g. a `SignerManager` from `@parity/product-sdk-signer`)
 * so the currently logged-in account is used automatically — no manual
 * signer/origin wiring needed.
 *
 * @example
 * ```ts
 * import { createChainClient } from "@parity/product-sdk-chain-client";
 * import { createInkSdk } from "@polkadot-api/sdk-ink";
 * import { paseo_asset_hub } from "@parity/product-sdk-descriptors/paseo-asset-hub";
 * import { ContractManager } from "@parity/product-sdk-contracts";
 * import cdmJson from "./cdm.json";
 *
 * const client = await createChainClient({
 *     chains: { assetHub: paseo_asset_hub },
 *     rpcs: { assetHub: ["wss://sys.ibp.network/asset-hub-paseo"] },
 * });
 * const inkSdk = createInkSdk(client.raw.assetHub, { atBest: true });
 * const manager = new ContractManager(cdmJson, inkSdk, {
 *     signerManager: signerManager, // from @parity/product-sdk-signer
 * });
 *
 * // Uses the host's logged-in account automatically
 * const counter = manager.getContract("@example/counter");
 * const { value } = await counter.getCount.query();
 * await counter.increment.tx();
 * ```
 */
export class ContractManager {
    private cdmJson: CdmJson;
    private targetHash: string;
    private inkSdk: InkSdk;
    private defaults: ContractDefaults;

    constructor(cdmJson: CdmJson, inkSdk: InkSdk, options?: ContractManagerOptions) {
        this.cdmJson = cdmJson;
        this.inkSdk = inkSdk;

        if (options?.targetHash) {
            this.targetHash = options.targetHash;
        } else {
            const targets = Object.keys(cdmJson.targets);
            if (targets.length === 0) throw new Error("No targets found in cdm.json");
            this.targetHash = targets[0];
        }

        this.defaults = {
            signerManager: options?.signerManager,
            origin: options?.defaultOrigin,
            signer: options?.defaultSigner,
        };
    }

    /** Update the default origin, signer, or signerManager used by all contract handles. */
    setDefaults(defaults: ContractDefaults): void {
        if (defaults.signerManager !== undefined)
            this.defaults.signerManager = defaults.signerManager;
        if (defaults.origin !== undefined) this.defaults.origin = defaults.origin;
        if (defaults.signer !== undefined) this.defaults.signer = defaults.signer;
    }

    /**
     * Create a ContractManager from a raw `PolkadotClient`.
     *
     * Convenience factory that creates the InkSdk internally via dynamic import
     * of `@polkadot-api/sdk-ink`. The ~4 MB sdk-ink metadata is loaded lazily
     * only when this method is called.
     *
     * For size-sensitive apps, prefer the constructor with a pre-created `InkSdk`
     * to control exactly when `@polkadot-api/sdk-ink` is loaded.
     *
     * @param cdmJson - The CDM manifest.
     * @param client - A `PolkadotClient` for the chain where contracts are deployed (e.g., `client.raw.assetHub`).
     * @param options - Optional configuration (signerManager, defaults).
     *
     * @example
     * ```ts
     * import { createChainClient } from "@parity/product-sdk-chain-client";
     * import { paseo_asset_hub } from "@parity/product-sdk-descriptors/paseo-asset-hub";
     * import { ContractManager } from "@parity/product-sdk-contracts";
     *
     * const client = await createChainClient({
     *     chains: { assetHub: paseo_asset_hub },
     *     rpcs: { assetHub: ["wss://sys.ibp.network/asset-hub-paseo"] },
     * });
     * const manager = await ContractManager.fromClient(cdmJson, client.raw.assetHub, {
     *     signerManager,
     * });
     * ```
     */
    static async fromClient(
        cdmJson: CdmJson,
        client: PolkadotClient,
        options?: ContractManagerOptions,
    ): Promise<ContractManager> {
        const { createInkSdk } = await import("@polkadot-api/sdk-ink");
        const inkSdk = createInkSdk(client, { atBest: true });
        return new ContractManager(cdmJson, inkSdk, options);
    }

    private getContractData(library: string): CdmJsonContract {
        const contractsForTarget = this.cdmJson.contracts?.[this.targetHash];
        if (!contractsForTarget || !(library in contractsForTarget)) {
            throw new ContractNotFoundError(library, this.targetHash);
        }
        return contractsForTarget[library];
    }

    /**
     * Get a typed contract handle.
     *
     * Each method on the returned object has `.query()` for read-only calls
     * and `.tx()` for signed transactions. When codegen augments
     * {@link Contracts}, passing a known library name returns a fully-typed
     * handle. Without codegen the generic overload still works — methods are
     * accessible but untyped.
     */
    getContract<K extends string & keyof Contracts>(library: K): Contract<Contracts[K]>;
    getContract(library: string): Contract<ContractDef>;
    getContract(library: string): Contract<ContractDef> {
        const data = this.getContractData(library);
        const descriptor = { abi: data.abi };
        const inkContract = this.inkSdk.getContract(descriptor as any, data.address);
        return wrapContract(inkContract, data.abi, this.defaults);
    }

    /** Get the on-chain address of an installed contract. */
    getAddress(library: string): HexString {
        return this.getContractData(library).address;
    }
}

/**
 * Create a contract handle from a raw address and ABI — no `cdm.json` needed.
 *
 * @example
 * ```ts
 * import { createInkSdk } from "@polkadot-api/sdk-ink";
 *
 * const inkSdk = createInkSdk(client.raw.assetHub, { atBest: true });
 * const counter = createContract(inkSdk, "0xC472...", abi, {
 *     signerManager: signerManager,
 * });
 * await counter.getCount.query();
 * await counter.increment.tx();
 * ```
 */
export function createContract(
    inkSdk: InkSdk,
    address: HexString,
    abi: AbiEntry[],
    options?: ContractOptions,
): Contract<ContractDef> {
    const inkContract = inkSdk.getContract({ abi } as any, address);
    const defaults: ContractDefaults = {
        signerManager: options?.signerManager,
        origin: options?.defaultOrigin,
        signer: options?.defaultSigner,
    };
    return wrapContract(inkContract, abi, defaults);
}

/**
 * Create a contract handle from a raw `PolkadotClient`, address, and ABI.
 *
 * Convenience wrapper that creates the InkSdk internally via dynamic import.
 * For size-sensitive apps, use {@link createContract} with a pre-created `InkSdk`.
 *
 * @example
 * ```ts
 * const counter = await createContractFromClient(client.raw.assetHub, "0xC472...", abi);
 * const { value } = await counter.getCount.query();
 * ```
 */
export async function createContractFromClient(
    client: PolkadotClient,
    address: HexString,
    abi: AbiEntry[],
    options?: ContractOptions,
): Promise<Contract<ContractDef>> {
    const { createInkSdk } = await import("@polkadot-api/sdk-ink");
    const inkSdk = createInkSdk(client, { atBest: true });
    return createContract(inkSdk, address, abi, options);
}
