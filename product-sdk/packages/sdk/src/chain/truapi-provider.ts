/**
 * TruAPI Provider
 *
 * Creates a PAPI-compatible JsonRpcProvider that routes through TruAPI
 * when running inside a host container.
 *
 * Credit: Based on polkadot-apps/packages/chain-client
 */

import { createLogger } from "../core/logger.js";
import {
    isInsideContainer,
    loadProductSdk,
    type JsonRpcProvider,
    type ProductSdkModule,
} from "./container.js";

const log = createLogger("truapi");

/** Options for creating a TruAPI provider */
export interface TruApiProviderOptions {
    /** Genesis hash of the chain to connect to */
    genesisHash: string;
    /** Fallback provider for standalone mode */
    fallback?: JsonRpcProvider;
    /** Custom SDK loader (for testing) */
    loadSdk?: () => Promise<ProductSdkModule>;
    /** Timeout for SDK loading in ms (default: 10000) */
    timeout?: number;
}

/**
 * Create a JsonRpcProvider that routes through TruAPI when in container mode,
 * or falls back to a direct provider in standalone mode.
 *
 * @param options - Provider options
 * @returns JsonRpcProvider compatible with polkadot-api
 *
 * @example
 * ```ts
 * import { createClient } from 'polkadot-api';
 * import { createTruApiProvider } from '@parity/product-sdk/chain';
 *
 * const provider = await createTruApiProvider({
 *   genesisHash: '0x...',
 *   fallback: getWsProvider('wss://rpc.polkadot.io'),
 * });
 *
 * const client = createClient(provider);
 * ```
 */
export async function createTruApiProvider(
    options: TruApiProviderOptions,
): Promise<JsonRpcProvider> {
    const { genesisHash, fallback, loadSdk = loadProductSdk, timeout = 10_000 } = options;

    // Check if we're in a container
    const inContainer = await isInsideContainer();

    if (!inContainer) {
        log.debug("Not in container, using fallback provider");
        if (!fallback) {
            throw new Error(
                "No fallback provider specified and not running in container mode. " +
                    "Either run inside a host container or provide a fallback WebSocket provider.",
            );
        }
        return fallback;
    }

    // Load the product SDK with timeout
    let sdk: ProductSdkModule;
    try {
        sdk = await withTimeout(loadSdk(), timeout, "Product SDK load timed out");
        log.info("Using TruAPI provider for chain", { genesisHash });
    } catch (e) {
        log.warn("Failed to load product SDK, falling back", { error: e });
        if (!fallback) {
            throw new Error(
                `Failed to load product SDK: ${e instanceof Error ? e.message : String(e)}. No fallback provider available.`,
            );
        }
        return fallback;
    }

    // Use the SDK's createPapiProvider which handles the TruAPI bridge
    if (sdk.createPapiProvider) {
        return sdk.createPapiProvider(genesisHash as `0x${string}`, fallback);
    }

    // Fallback: Create our own bridge if createPapiProvider not available
    log.debug("createPapiProvider not available, creating manual bridge");
    return createManualTruApiBridge(sdk, genesisHash, fallback);
}

/**
 * Create a manual TruAPI bridge when createPapiProvider is not available.
 * This implements the JsonRpcProvider interface by mapping JSON-RPC methods
 * to TruAPI calls.
 */
function createManualTruApiBridge(
    sdk: ProductSdkModule,
    genesisHash: string,
    fallback?: JsonRpcProvider,
): JsonRpcProvider {
    const { sandboxProvider } = sdk;

    if (!sandboxProvider) {
        log.warn("No sandboxProvider available, using fallback");
        if (!fallback) {
            throw new Error("No sandboxProvider and no fallback available");
        }
        return fallback;
    }

    return (onMessage) => {
        const subscriptions = new Map<string, () => void>();
        let messageId = 0;
        let disconnected = false;

        // Helper to send JSON-RPC response
        const sendResponse = (id: number | string, result: unknown, error?: unknown) => {
            if (disconnected) return;

            const response = error
                ? { jsonrpc: "2.0", id, error: { code: -32000, message: String(error) } }
                : { jsonrpc: "2.0", id, result };

            onMessage(JSON.stringify(response));
        };

        // Helper to send JSON-RPC notification
        const sendNotification = (method: string, params: unknown) => {
            if (disconnected) return;

            const notification = { jsonrpc: "2.0", method, params };
            onMessage(JSON.stringify(notification));
        };

        return {
            send(message: string) {
                if (disconnected) return;

                let request: { id: number | string; method: string; params?: unknown[] };
                try {
                    request = JSON.parse(message);
                } catch (e) {
                    log.warn("Invalid JSON-RPC message", { message, error: e });
                    return;
                }

                const { id, method, params = [] } = request;

                log.debug("TruAPI request", { method, id });

                // Map JSON-RPC methods to TruAPI calls
                switch (method) {
                    case "chainHead_v1_follow": {
                        const withRuntime = (params[0] as boolean) ?? false;
                        const subId = `sub_${++messageId}`;

                        const unsubscribe = sandboxProvider.remote_chain_head_follow(
                            genesisHash,
                            withRuntime,
                            (event) => {
                                sendNotification("chainHead_v1_followEvent", {
                                    subscription: subId,
                                    event,
                                });
                            },
                        );

                        subscriptions.set(subId, unsubscribe);
                        sendResponse(id, subId);
                        break;
                    }

                    case "chainHead_v1_unfollow": {
                        const subId = params[0] as string;
                        const unsubscribe = subscriptions.get(subId);
                        if (unsubscribe) {
                            unsubscribe();
                            subscriptions.delete(subId);
                        }
                        sendResponse(id, null);
                        break;
                    }

                    case "chainHead_v1_header": {
                        const [_subId, hash] = params as [string, string];
                        sandboxProvider.remote_chain_head_header(genesisHash, hash, (header) => {
                            sendResponse(id, header);
                        });
                        break;
                    }

                    case "chainHead_v1_storage": {
                        const [_subId, hash, items, childTrie] = params as [
                            string,
                            string,
                            Array<{ key: string; type: string }>,
                            string | null,
                        ];

                        const operationId = `op_${++messageId}`;

                        const unsubscribe = sandboxProvider.remote_chain_head_storage(
                            genesisHash,
                            hash,
                            items,
                            childTrie,
                            (result) => {
                                sendNotification("chainHead_v1_storageEvent", {
                                    operationId,
                                    result,
                                });
                            },
                        );

                        // Store for potential cancellation
                        subscriptions.set(operationId, unsubscribe);
                        sendResponse(id, { operationId });
                        break;
                    }

                    case "chainHead_v1_call": {
                        const [_subId, hash, fnName, callParams] = params as [
                            string,
                            string,
                            string,
                            string,
                        ];

                        const operationId = `op_${++messageId}`;

                        sandboxProvider.remote_chain_head_call(
                            genesisHash,
                            hash,
                            fnName,
                            callParams,
                            (result) => {
                                sendNotification("chainHead_v1_callEvent", {
                                    operationId,
                                    result,
                                });
                            },
                        );

                        sendResponse(id, { operationId });
                        break;
                    }

                    case "transaction_v1_broadcast": {
                        const [transaction] = params as [string];

                        const operationId = `tx_${++messageId}`;

                        const unsubscribe = sandboxProvider.remote_chain_transaction_broadcast(
                            genesisHash,
                            transaction,
                            (result) => {
                                sendNotification("transaction_v1_broadcastEvent", {
                                    operationId,
                                    result,
                                });
                            },
                        );

                        subscriptions.set(operationId, unsubscribe);
                        sendResponse(id, operationId);
                        break;
                    }

                    case "transaction_v1_stop": {
                        const opId = params[0] as string;
                        const unsubscribe = subscriptions.get(opId);
                        if (unsubscribe) {
                            unsubscribe();
                            subscriptions.delete(opId);
                        }
                        sendResponse(id, null);
                        break;
                    }

                    default:
                        log.warn("Unsupported JSON-RPC method", { method });
                        sendResponse(id, null, `Unsupported method: ${method}`);
                }
            },

            disconnect() {
                disconnected = true;
                // Cleanup all subscriptions
                for (const unsubscribe of subscriptions.values()) {
                    try {
                        unsubscribe();
                    } catch (e) {
                        log.debug("Error unsubscribing", { error: e });
                    }
                }
                subscriptions.clear();
                log.debug("TruAPI provider disconnected");
            },
        };
    };
}

/**
 * Helper to add timeout to a promise
 */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(message)), ms);
        promise
            .then((result) => {
                clearTimeout(timeout);
                resolve(result);
            })
            .catch((error) => {
                clearTimeout(timeout);
                reject(error);
            });
    });
}
