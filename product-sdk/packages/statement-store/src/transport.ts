import { createLogger } from "@parity/product-sdk-logger";
import { DEFAULT_BULLETIN_ENDPOINT } from "@parity/product-sdk-host";
import type { HostStatementStore } from "@parity/product-sdk-host";

import { StatementConnectionError, StatementSubscriptionError } from "./errors.js";
import type { ConnectionCredentials, StatementTransport, Unsubscribable } from "./types.js";

import type { Statement, TopicFilter as SdkTopicFilter } from "@novasamatech/sdk-statement";

// Type-only imports for the host↔sdk bridge (erased at compile time, zero bundle cost).
// product-sdk's SCALE-decoded types use Uint8Array + { tag } enums;
// sdk-statement's types use hex strings + { type } enums.
import type {
    Statement as HostStatement,
    SignedStatement as HostSignedStatement,
} from "@novasamatech/product-sdk";

const log = createLogger("statement-store:transport");

// ============================================================================
// Host Transport — uses the Host API's native binary protocol
// ============================================================================

/**
 * Statement transport that uses the Host API inside containers.
 *
 * Communicates through the host's native `remote_statement_store_*` protocol
 * which bypasses JSON-RPC entirely. Subscriptions, proof creation, and submission
 * all go through typed binary messages over the host transport.
 */
class HostTransport implements StatementTransport {
    private readonly store: HostStatementStore;

    constructor(store: HostStatementStore) {
        this.store = store;
    }

    subscribe(
        filter: SdkTopicFilter,
        onStatements: (statements: Statement[]) => void,
        onError: (error: Error) => void,
    ): Unsubscribable {
        const topics = extractTopicBytes(filter);

        try {
            const sub = this.store.subscribe(topics, (statements) => {
                // product-sdk delivers HostSignedStatement[] (Uint8Array fields, { tag } enums).
                // sdk-statement expects Statement (hex string fields, { type } enums).
                const converted = statements.map(hostSignedStatementToSdk);
                onStatements(converted);
            });

            log.info("Host subscription active");

            return {
                unsubscribe: () => sub.unsubscribe(),
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            log.warn("Host subscription failed", { error: msg });
            onError(new StatementSubscriptionError(msg));
            return { unsubscribe: () => {} };
        }
    }

    async signAndSubmit(statement: Statement, credentials: ConnectionCredentials): Promise<void> {
        if (credentials.mode !== "host") {
            throw new StatementConnectionError(
                "HostTransport requires host credentials. Use { mode: 'host', accountId } to connect.",
            );
        }

        // Convert sdk-statement format (hex strings) → product-sdk format (Uint8Array)
        // so the host's SCALE codec can encode it correctly.
        const hostStatement = sdkStatementToHost(statement);
        const proof = await this.store.createProof(credentials.accountId, hostStatement);
        const signedStatement: HostSignedStatement = { ...hostStatement, proof };
        await this.store.submit(signedStatement);

        log.debug("Statement submitted via host");
    }

    destroy(): void {
        // Host owns the transport — nothing to clean up
    }
}

// ============================================================================
// RPC Transport — uses substrate-client + sdk-statement
// ============================================================================

/**
 * Statement transport using JSON-RPC over WebSocket.
 *
 * Uses `@polkadot-api/substrate-client` (routes subscriptions by ID, not method name)
 * with `@novasamatech/sdk-statement` for statement SCALE encoding/decoding.
 *
 * This is the fallback transport for outside-container usage (development, testing).
 */
class RpcTransport implements StatementTransport {
    private readonly sdk: ReturnType<
        typeof import("@novasamatech/sdk-statement").createStatementSdk
    >;
    private readonly destroyClient: () => void;

    private constructor(sdk: RpcTransport["sdk"], destroyClient: () => void) {
        this.sdk = sdk;
        this.destroyClient = destroyClient;
    }

    static async create(endpoint: string): Promise<RpcTransport> {
        // Resolve all dynamic imports before allocating any resources.
        // This way, if a module is missing we fail fast with no cleanup needed.
        const [wsMod, substrateMod, sdkMod] = await Promise.all([
            import("polkadot-api/ws-provider/web"),
            import("@polkadot-api/substrate-client"),
            import("@novasamatech/sdk-statement"),
        ]);
        const { getWsProvider } = wsMod;
        const { createClient: createSubstrateClient } = substrateMod;
        const { createStatementSdk } = sdkMod;

        // Now allocate the WebSocket + client. Any failure from here on
        // must call client.destroy() to avoid leaking the socket.
        const provider = getWsProvider(endpoint);
        const client = createSubstrateClient(provider);

        try {
            // Build request/subscribe functions from the substrate client
            // following the lazyClient pattern from triangle-js-sdks
            const requestFn = <Reply>(method: string, params: unknown[]) =>
                new Promise<Reply>((resolve, reject) => {
                    client._request<Reply, unknown>(method, params, {
                        onSuccess: (result) => resolve(result),
                        onError: (e) => reject(e),
                    });
                });

            const subscribeFn = <T>(
                method: string,
                params: unknown[],
                onMessage: (message: T) => void,
                onError: (error: Error) => void,
            ) => {
                return client._request<string, T>(method, params, {
                    onSuccess: (subscriptionId, followSubscription) => {
                        followSubscription(subscriptionId, { next: onMessage, error: onError });
                    },
                    onError,
                });
            };

            const sdk = createStatementSdk(requestFn, subscribeFn);

            // Warm up the WebSocket connection — substrate-client's _request throws
            // synchronously if the WS isn't ready, unlike request() which queues.
            try {
                await requestFn("system_name", []);
            } catch {
                // Non-fatal — connection may still be usable
            }

            log.info("Connected via direct RPC", { endpoint });
            return new RpcTransport(sdk, () => client.destroy());
        } catch (error) {
            // Any failure during setup — destroy the client to avoid leaking the WS
            client.destroy();
            throw error;
        }
    }

    subscribe(
        filter: SdkTopicFilter,
        onStatements: (statements: Statement[]) => void,
        onError: (error: Error) => void,
    ): Unsubscribable {
        try {
            const unsub = this.sdk.subscribeStatements(
                filter,
                (statement) => {
                    // sdk-statement delivers one statement at a time — batch it
                    onStatements([statement]);
                },
                (error) => {
                    log.warn("RPC subscription error", { error: error.message });
                    onError(new StatementSubscriptionError(error.message, { cause: error }));
                },
            );

            log.info("RPC subscription active");

            return {
                unsubscribe: () => {
                    unsub();
                },
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            log.warn("Failed to start RPC subscription", { error: msg });
            onError(new StatementSubscriptionError(msg));
            return { unsubscribe: () => {} };
        }
    }

    async signAndSubmit(statement: Statement, credentials: ConnectionCredentials): Promise<void> {
        if (credentials.mode !== "local") {
            throw new StatementConnectionError(
                "RpcTransport requires local credentials. Use { mode: 'local', signer } to connect.",
            );
        }

        const { getStatementSigner } = await import("@novasamatech/sdk-statement");

        const signer = getStatementSigner(credentials.signer.publicKey, "sr25519", (data) =>
            credentials.signer.sign(data),
        );

        const signed = await signer.sign(statement);
        const result = await this.sdk.submit(signed);

        if (result.status === "new" || result.status === "known") {
            log.debug("Statement submitted via RPC", { status: result.status });
            return;
        }

        throw new Error(
            `Statement submission failed: ${result.status}${
                "reason" in result ? ` (${(result as { reason: string }).reason})` : ""
            }`,
        );
    }

    async query(filter: SdkTopicFilter): Promise<Statement[]> {
        return this.sdk.getStatements(filter);
    }

    destroy(): void {
        this.destroyClient();
    }
}

// ============================================================================
// Transport Factory
// ============================================================================

/**
 * Create a statement store transport.
 *
 * Strategy (Host API first):
 * 1. Try the Host API via `@parity/product-sdk-host` — uses the container's native
 *    statement store protocol (binary, not JSON-RPC). This is the production path.
 * 2. If the host is unavailable (not inside a container, product-sdk not installed),
 *    fall back to a direct WebSocket connection using `@polkadot-api/substrate-client`
 *    with `@novasamatech/sdk-statement`.
 *
 * @param config - Configuration with an optional fallback `endpoint`.
 * @returns A configured {@link StatementTransport}.
 * @throws {StatementConnectionError} If no connection method is available.
 */
export async function createTransport(config: {
    endpoint?: string;
}): Promise<StatementTransport> {
    // 1. Try Host API first (inside container)
    try {
        const { getStatementStore } = await import("@parity/product-sdk-host");
        const store = await getStatementStore();
        if (store) {
            log.info("Using host API statement store transport");
            return new HostTransport(store);
        }
    } catch (error) {
        log.debug("Host API unavailable", {
            error: error instanceof Error ? error.message : String(error),
        });
    }

    // 2. Fall back to direct RPC
    const endpoint = config.endpoint ?? DEFAULT_BULLETIN_ENDPOINT;
    if (endpoint) {
        try {
            return await RpcTransport.create(endpoint);
        } catch (error) {
            throw new StatementConnectionError(
                `Failed to connect to ${endpoint}: ${error instanceof Error ? error.message : String(error)}`,
                { cause: error instanceof Error ? error : undefined },
            );
        }
    }

    throw new StatementConnectionError(
        "No connection method available. Run inside a container or provide an explicit endpoint.",
    );
}

// ============================================================================
// Internal Helpers
// ============================================================================

// ============================================================================
// Host ↔ SDK Type Bridge
//
// product-sdk types (SCALE-decoded): Uint8Array fields, { tag: "Sr25519" } enums
// sdk-statement types:               hex string fields, { type: "sr25519" } enums
//
// Both represent the same on-chain statement data but with different runtime
// shapes. These converters bridge between the two so HostTransport can speak
// both languages correctly.
// ============================================================================

/** Convert a product-sdk SignedStatement (Uint8Array fields) → sdk-statement Statement (hex strings). */
function hostSignedStatementToSdk(hostStmt: HostSignedStatement): Statement {
    const result: Partial<Statement> = {};

    // data: Uint8Array → Uint8Array (same in both formats)
    if (hostStmt.data) result.data = hostStmt.data;

    // expiry: bigint → bigint (same in both formats)
    if (hostStmt.expiry !== undefined) result.expiry = hostStmt.expiry;

    // topics: Uint8Array[] → hex string[]
    if (hostStmt.topics) {
        result.topics = hostStmt.topics.map(bytesToHex) as Statement["topics"];
    }

    // channel: Uint8Array → hex string
    if (hostStmt.channel) {
        result.channel = bytesToHex(hostStmt.channel) as Statement["channel"];
    }

    // decryptionKey: Uint8Array → hex string
    if (hostStmt.decryptionKey) {
        result.decryptionKey = bytesToHex(hostStmt.decryptionKey) as Statement["decryptionKey"];
    }

    // proof: { tag: "Sr25519", value: { signature: Uint8Array, signer: Uint8Array } }
    //      → { type: "sr25519", value: { signature: hexString, signer: hexString } }
    if (hostStmt.proof) {
        const tag = hostStmt.proof.tag;
        const value = hostStmt.proof.value;
        const sdkType = tag.charAt(0).toLowerCase() + tag.slice(1);

        if ("signature" in value && "signer" in value) {
            result.proof = {
                type: sdkType,
                value: {
                    signature: bytesToHex(value.signature),
                    signer: bytesToHex(value.signer),
                },
            } as Statement["proof"];
        }
    }

    return result as Statement;
}

/** Convert an sdk-statement Statement (hex strings) → product-sdk HostStatement (Uint8Array). */
function sdkStatementToHost(stmt: Statement): HostStatement {
    const result: Partial<HostStatement> = {};

    // data: Uint8Array → Uint8Array (same)
    if (stmt.data) result.data = stmt.data;

    // expiry: bigint → bigint (same)
    if (stmt.expiry !== undefined) result.expiry = stmt.expiry;

    // topics: hex string[] → Uint8Array[]
    if (stmt.topics) {
        result.topics = stmt.topics.map(hexToBytes);
    }

    // channel: hex string → Uint8Array
    if (stmt.channel) {
        result.channel = hexToBytes(stmt.channel);
    }

    // decryptionKey: hex string → Uint8Array
    if (stmt.decryptionKey) {
        result.decryptionKey = hexToBytes(stmt.decryptionKey);
    }

    return result as HostStatement;
}

/** Extract topic Uint8Arrays from an sdk-statement TopicFilter for the host API. */
function extractTopicBytes(filter: SdkTopicFilter): Uint8Array[] {
    if (filter === "any") return [];
    if ("matchAll" in filter) {
        return filter.matchAll.map(hexToBytes);
    }
    if ("matchAny" in filter) {
        return filter.matchAny.map(hexToBytes);
    }
    return [];
}

/** Convert a 0x-prefixed hex string to Uint8Array. */
function hexToBytes(hex: string): Uint8Array {
    const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}

/** Convert Uint8Array to 0x-prefixed hex string. */
function bytesToHex(bytes: Uint8Array): string {
    let hex = "0x";
    for (let i = 0; i < bytes.length; i++) {
        hex += bytes[i].toString(16).padStart(2, "0");
    }
    return hex;
}
