/**
 * createApp - Main entry point for the Product SDK
 *
 * Creates an App instance with wallet, storage, chain, and bulletin APIs.
 */

import type {
    App,
    AppConfig,
    WalletApi,
    StorageApi,
    ChainApi,
    BulletinApi,
    Account,
    ChainDescriptor,
} from "./types.js";
import { createLogger, configure } from "./logger.js";
import { createKvStore } from "../storage/kv-store.js";
import { WalletManager } from "../wallet/wallet.js";
import { BulletinClient } from "../bulletin/client.js";
import {
    isInsideContainer,
    getHostLocalStorage,
    getAccountsProvider,
    type AccountsProvider,
    type HostLocalStorage,
} from "../chain/container.js";
import type { WalletAccount } from "../wallet/types.js";

const log = createLogger("app");

/**
 * Create a new Product SDK app instance
 *
 * @param config - Application configuration
 * @returns App instance with all APIs
 *
 * @example
 * ```ts
 * import { createApp } from '@parity/product-sdk';
 *
 * const app = await createApp({
 *   name: 'my-app',
 *   logLevel: 'info',
 * });
 *
 * // Connect wallet
 * const { accounts } = await app.wallet.connect();
 *
 * // Use storage
 * await app.storage.set('key', 'value');
 *
 * // Get chain client
 * const client = app.chain.getClient(chains.assetHub);
 * ```
 */
export async function createApp(config: AppConfig): Promise<App> {
    // Set log level if specified
    if (config.logLevel) {
        configure({ level: config.logLevel });
    }

    log.info("Creating Product SDK app", { name: config.name });

    // Detect runtime environment
    const inContainer = await isInsideContainer();
    log.debug("Environment detection", { inContainer });

    // Initialize storage
    const hostLocalStorage = inContainer ? await getHostLocalStorage() : null;
    const kvStore = await createKvStore({
        prefix: config.name,
        hostLocalStorage: hostLocalStorage ?? undefined,
    });

    // Initialize wallet manager
    const walletManager = new WalletManager({ appName: config.name });

    // Get accounts provider for container mode
    const accountsProvider = inContainer ? await getAccountsProvider() : null;

    // Initialize bulletin client (default to paseo for now)
    const bulletinClient = new BulletinClient({ environment: "paseo" });

    // Create storage API adapter
    const storageApi: StorageApi = {
        get: (key) => kvStore.get(key),
        set: (key, value) => kvStore.set(key, value),
        getJSON: <T>(key: string) => kvStore.getJSON<T>(key),
        setJSON: <T>(key: string, value: T) => kvStore.setJSON(key, value),
        remove: (key) => kvStore.remove(key),
        clear: () => kvStore.clear(),
    };

    // Create wallet API adapter
    const walletApi = createWalletApi(walletManager, accountsProvider);

    // Create chain API
    const chainApi: ChainApi = {
        getClient<T>(chain: ChainDescriptor<T>): T {
            // TODO: Implement actual PAPI client creation
            // For now, return a placeholder that will be replaced with real implementation
            log.debug("getClient called", { chain: chain.id });
            throw new Error(
                `Chain client for ${chain.id} not yet implemented. PAPI integration requires additional setup.`,
            );
        },
    };

    // Create bulletin API adapter
    const bulletinApi: BulletinApi = {
        upload: async (data) => {
            const result = await bulletinClient.upload(data);
            return result.cid;
        },
        fetch: (cid) => bulletinClient.fetch(cid),
        computeCid: (data) => bulletinClient.computeCid(data),
    };

    log.info("Product SDK app created", {
        name: config.name,
        mode: inContainer ? "container" : "standalone",
    });

    return {
        wallet: walletApi,
        storage: storageApi,
        chain: chainApi,
        bulletin: bulletinApi,
        getAppInfo: () => ({ ...config }),
    };
}

/**
 * Create wallet API adapter that handles both container and standalone modes
 */
function createWalletApi(
    walletManager: WalletManager,
    accountsProvider: AccountsProvider | null,
): WalletApi {
    // Track account change subscribers
    const accountChangeSubscribers = new Set<(account: Account | null) => void>();

    // Subscribe to wallet manager state changes
    walletManager.subscribe((state) => {
        const account = state.selectedAccount ? toAccount(state.selectedAccount) : null;
        for (const callback of accountChangeSubscribers) {
            try {
                callback(account);
            } catch (e) {
                log.warn("Account change callback threw", { error: e });
            }
        }
    });

    return {
        async connect(): Promise<{ accounts: Account[] }> {
            // If we have an accounts provider (container mode), use it
            if (accountsProvider) {
                const truApiAccounts = await accountsProvider.getAccounts();
                const accounts = truApiAccounts.map((a) => ({
                    address: a.address,
                    name: a.name,
                    source: "host",
                }));
                return { accounts };
            }

            // Otherwise, use the wallet manager for extension-based connection
            const result = await walletManager.connect();
            return { accounts: result.accounts.map(toAccount) };
        },

        async disconnect(): Promise<void> {
            await walletManager.disconnect();
        },

        getAccounts(): Account[] {
            return walletManager.getAccounts().map(toAccount);
        },

        getSelectedAccount(): Account | null {
            const selected = walletManager.getSelectedAccount();
            return selected ? toAccount(selected) : null;
        },

        selectAccount(address: string): void {
            walletManager.selectAccount(address);
        },

        async signMessage(message: string | Uint8Array): Promise<Uint8Array> {
            const bytes = typeof message === "string" ? new TextEncoder().encode(message) : message;

            // If we have an accounts provider (container mode), use it for signing
            if (accountsProvider) {
                const selected = walletManager.getSelectedAccount();
                if (!selected) {
                    throw new Error("No account selected");
                }
                return accountsProvider.sign(selected.address, bytes);
            }

            // Otherwise, use wallet manager
            return walletManager.signMessage(bytes);
        },

        onAccountChange(callback: (account: Account | null) => void): () => void {
            accountChangeSubscribers.add(callback);
            return () => accountChangeSubscribers.delete(callback);
        },

        getProductAccount(): Account | null {
            const productAccount = walletManager.getProductAccount();
            if (!productAccount) return null;
            return {
                address: productAccount.address,
                source: "product",
            };
        },

        getAnonymousAlias(): string | null {
            return walletManager.getAnonymousAlias();
        },

        async createProof(message: Uint8Array): Promise<Uint8Array> {
            return walletManager.createProof(message);
        },
    };
}

/**
 * Convert WalletAccount to Account
 */
function toAccount(wa: WalletAccount): Account {
    return {
        address: wa.address,
        name: wa.name ?? undefined,
        source: wa.source,
    };
}
