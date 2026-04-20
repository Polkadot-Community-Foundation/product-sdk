/**
 * Wallet implementation
 *
 * Credit: Based on polkadot-apps/packages/signer
 */

import { createLogger } from "../core/logger.js";
import {
    isInsideContainer,
    getAccountsProvider,
    type AccountsProvider,
    type TruApiAccount,
} from "../chain/container.js";
import type {
    WalletState,
    WalletAccount,
    WalletOptions,
    ConnectionStatus,
    ProductAccount,
} from "./types.js";

const log = createLogger("wallet");

/** Callback for state changes */
export type WalletSubscriber = (state: WalletState) => void;

/** Unsubscribe function */
export type Unsubscribe = () => void;

/**
 * Wallet manager for connecting to signing providers
 *
 * @example
 * ```ts
 * const wallet = new WalletManager({ appName: 'my-app' });
 *
 * // Subscribe to state changes
 * wallet.subscribe((state) => {
 *   console.log('Accounts:', state.accounts);
 * });
 *
 * // Connect to wallet
 * await wallet.connect();
 *
 * // Select an account
 * wallet.selectAccount(accounts[0].address);
 *
 * // Sign a message
 * const signature = await wallet.signMessage('Hello');
 * ```
 */
export class WalletManager {
    private state: WalletState;
    private subscribers = new Set<WalletSubscriber>();
    private options: Required<WalletOptions>;
    private accountsProvider: AccountsProvider | null = null;
    private accountsUnsubscribe: (() => void) | null = null;

    constructor(options?: WalletOptions) {
        this.options = {
            ss58Prefix: options?.ss58Prefix ?? 42,
            appName: options?.appName ?? "polkadot-app",
            hostTimeout: options?.hostTimeout ?? 10_000,
            extensionTimeout: options?.extensionTimeout ?? 1_000,
        };

        this.state = {
            status: "disconnected",
            accounts: [],
            selectedAccount: null,
            activeProvider: null,
            error: null,
        };

        log.debug("WalletManager initialized", { options: this.options });
    }

    /**
     * Get current wallet state
     */
    getState(): WalletState {
        return this.state;
    }

    /**
     * Subscribe to state changes
     */
    subscribe(callback: WalletSubscriber): Unsubscribe {
        this.subscribers.add(callback);
        // Emit current state immediately
        callback(this.state);
        return () => this.subscribers.delete(callback);
    }

    private emit(): void {
        for (const subscriber of this.subscribers) {
            try {
                subscriber(this.state);
            } catch (e) {
                log.warn("Subscriber threw", { error: e });
            }
        }
    }

    private setState(partial: Partial<WalletState>): void {
        this.state = { ...this.state, ...partial };
        this.emit();
    }

    /**
     * Connect to available wallet providers
     */
    async connect(): Promise<{ accounts: WalletAccount[] }> {
        log.info("Connecting to wallet providers");
        this.setState({ status: "connecting", error: null });

        try {
            // Check if inside container (TruAPI available)
            const inContainer = await isInsideContainer();

            if (inContainer) {
                log.debug("Container mode detected, using host accounts provider");
                return await this.connectToHost();
            }

            // In standalone mode, connect to browser extension
            log.debug("Standalone mode, connecting to browser extension");
            return await this.connectToExtension();
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            log.error("Failed to connect to wallet", { error: errorMessage });
            this.setState({
                status: "disconnected",
                error: {
                    type: "EXTENSION_NOT_FOUND",
                    message: errorMessage,
                    cause: e,
                },
            });
            throw e;
        }
    }

    /**
     * Connect to host accounts provider (container mode)
     */
    private async connectToHost(): Promise<{ accounts: WalletAccount[] }> {
        const provider = await getAccountsProvider();
        if (!provider) {
            throw new Error("Host accounts provider not available");
        }

        this.accountsProvider = provider;

        // Get initial accounts
        const truApiAccounts = await provider.getAccounts();
        const accounts = this.truApiAccountsToWallet(truApiAccounts);

        // Subscribe to account changes
        this.accountsUnsubscribe = provider.onAccountsChange((newAccounts) => {
            const walletAccounts = this.truApiAccountsToWallet(newAccounts);
            log.debug("Host accounts changed", { count: walletAccounts.length });
            this.setState({ accounts: walletAccounts });

            // Update selected account if it's no longer available
            if (this.state.selectedAccount) {
                const stillExists = walletAccounts.some(
                    (a) => a.address === this.state.selectedAccount?.address,
                );
                if (!stillExists) {
                    this.setState({ selectedAccount: walletAccounts[0] ?? null });
                }
            }
        });

        log.info("Connected to host accounts provider", { count: accounts.length });
        this.setState({
            status: "connected",
            accounts,
            activeProvider: "host",
            selectedAccount: accounts[0] ?? null,
        });

        return { accounts };
    }

    /**
     * Connect to browser extension (standalone mode)
     */
    private async connectToExtension(): Promise<{ accounts: WalletAccount[] }> {
        // Check for injected web3 providers
        const win = globalThis.window as unknown as Record<string, unknown>;
        const injectedWeb3 = win?.injectedWeb3 as
            | Record<string, { enable?: (appName: string) => Promise<unknown> }>
            | undefined;

        if (!injectedWeb3) {
            throw new Error(
                "No wallet extension detected. Please install a Polkadot-compatible wallet extension.",
            );
        }

        const extensionNames = Object.keys(injectedWeb3);
        if (extensionNames.length === 0) {
            throw new Error("No wallet extensions available");
        }

        log.debug("Found wallet extensions", { extensions: extensionNames });

        // Try to enable the first available extension
        const allAccounts: WalletAccount[] = [];

        for (const name of extensionNames) {
            const extension = injectedWeb3[name];
            if (!extension?.enable) continue;

            try {
                const enabled = (await Promise.race([
                    extension.enable(this.options.appName),
                    new Promise((_, reject) =>
                        setTimeout(
                            () => reject(new Error("Extension timeout")),
                            this.options.extensionTimeout,
                        ),
                    ),
                ])) as { accounts?: { get?: () => Promise<unknown[]> } };

                if (enabled?.accounts?.get) {
                    const extensionAccounts = (await enabled.accounts.get()) as Array<{
                        address: string;
                        name?: string;
                    }>;

                    for (const acc of extensionAccounts) {
                        allAccounts.push({
                            address: acc.address,
                            name: acc.name ?? null,
                            source: "extension" as const,
                        });
                    }
                    log.debug("Enabled extension", { name, accounts: extensionAccounts.length });
                }
            } catch (e) {
                log.warn("Failed to enable extension", { name, error: e });
            }
        }

        if (allAccounts.length === 0) {
            throw new Error("No accounts available from wallet extensions");
        }

        log.info("Connected to browser extension", { count: allAccounts.length });
        this.setState({
            status: "connected",
            accounts: allAccounts,
            activeProvider: "extension",
            selectedAccount: allAccounts[0] ?? null,
        });

        return { accounts: allAccounts };
    }

    /**
     * Convert TruAPI accounts to WalletAccount format
     */
    private truApiAccountsToWallet(accounts: TruApiAccount[]): WalletAccount[] {
        return accounts.map((a) => ({
            address: a.address,
            name: a.name ?? null,
            publicKey: a.publicKey,
            source: "host" as const,
        }));
    }

    /**
     * Disconnect from wallet
     */
    async disconnect(): Promise<void> {
        log.info("Disconnecting from wallet");

        // Clean up accounts provider subscription
        if (this.accountsUnsubscribe) {
            this.accountsUnsubscribe();
            this.accountsUnsubscribe = null;
        }
        this.accountsProvider = null;

        this.setState({
            status: "disconnected",
            accounts: [],
            selectedAccount: null,
            activeProvider: null,
        });
    }

    /**
     * Get all available accounts
     */
    getAccounts(): WalletAccount[] {
        return [...this.state.accounts];
    }

    /**
     * Get currently selected account
     */
    getSelectedAccount(): WalletAccount | null {
        return this.state.selectedAccount;
    }

    /**
     * Select an account by address
     */
    selectAccount(address: string): void {
        const account = this.state.accounts.find((a) => a.address === address);
        if (!account) {
            log.warn("Account not found", { address });
            return;
        }
        log.info("Account selected", { address });
        this.setState({ selectedAccount: account });
    }

    /**
     * Sign an arbitrary message
     */
    async signMessage(message: string | Uint8Array): Promise<Uint8Array> {
        const account = this.state.selectedAccount;
        if (!account) {
            throw new Error("No account selected");
        }

        const bytes = typeof message === "string" ? new TextEncoder().encode(message) : message;
        log.debug("Signing message", { address: account.address, size: bytes.length });

        // In container mode, use the host accounts provider
        if (this.accountsProvider) {
            return this.accountsProvider.sign(account.address, bytes);
        }

        // In standalone mode, use extension signing
        // This requires the signer to be available from the extension
        throw new Error(
            "Extension-based signing not yet implemented. " +
                "This requires additional integration with the wallet extension signer.",
        );
    }

    /**
     * Get product-scoped account (container mode only)
     */
    getProductAccount(): ProductAccount | null {
        // TODO: Implement when TruAPI is available
        return null;
    }

    /**
     * Get anonymous alias via Ring VRF (container mode only)
     */
    getAnonymousAlias(): string | null {
        const productAccount = this.getProductAccount();
        return productAccount?.anonymousAlias ?? null;
    }

    /**
     * Create Ring VRF proof (container mode only)
     */
    async createProof(_message: Uint8Array): Promise<Uint8Array> {
        // TODO: Implement when TruAPI is available
        throw new Error(
            "WalletManager.createProof() is not yet implemented. " +
                "This requires container mode with Ring VRF support.",
        );
    }

    /**
     * Destroy the wallet manager and cleanup resources
     */
    destroy(): void {
        log.debug("Destroying WalletManager");

        // Clean up accounts provider subscription
        if (this.accountsUnsubscribe) {
            this.accountsUnsubscribe();
            this.accountsUnsubscribe = null;
        }
        this.accountsProvider = null;

        this.subscribers.clear();
        this.setState({
            status: "disconnected",
            accounts: [],
            selectedAccount: null,
            activeProvider: null,
        });
    }
}
