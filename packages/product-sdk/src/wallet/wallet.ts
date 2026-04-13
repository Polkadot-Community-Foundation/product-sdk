/**
 * Wallet implementation
 *
 * Credit: Based on polkadot-apps/packages/signer
 */

import { createLogger } from '../core/logger.js';
import type {
  WalletState,
  WalletAccount,
  WalletOptions,
  ConnectionStatus,
  ProductAccount,
} from './types.js';

const log = createLogger('wallet');

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

  constructor(options?: WalletOptions) {
    this.options = {
      ss58Prefix: options?.ss58Prefix ?? 42,
      appName: options?.appName ?? 'polkadot-app',
      hostTimeout: options?.hostTimeout ?? 10_000,
      extensionTimeout: options?.extensionTimeout ?? 1_000,
    };

    this.state = {
      status: 'disconnected',
      accounts: [],
      selectedAccount: null,
      activeProvider: null,
      error: null,
    };

    log.debug('WalletManager initialized', { options: this.options });
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
        log.warn('Subscriber threw', { error: e });
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
    log.info('Connecting to wallet providers');
    this.setState({ status: 'connecting', error: null });

    // TODO: Implement provider detection and connection
    // 1. Check if inside container (TruAPI available)
    // 2. If yes, connect to host provider
    // 3. If no, connect to browser extension

    throw new Error(
      'WalletManager.connect() is not yet implemented. ' +
        'This is a skeleton for the Product SDK structure.'
    );
  }

  /**
   * Disconnect from wallet
   */
  async disconnect(): Promise<void> {
    log.info('Disconnecting from wallet');
    this.setState({
      status: 'disconnected',
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
      log.warn('Account not found', { address });
      return;
    }
    log.info('Account selected', { address });
    this.setState({ selectedAccount: account });
  }

  /**
   * Sign an arbitrary message
   */
  async signMessage(message: string | Uint8Array): Promise<Uint8Array> {
    const account = this.state.selectedAccount;
    if (!account) {
      throw new Error('No account selected');
    }

    log.debug('Signing message', { address: account.address });

    // TODO: Implement message signing via the signer
    throw new Error(
      'WalletManager.signMessage() is not yet implemented. ' +
        'This is a skeleton for the Product SDK structure.'
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
      'WalletManager.createProof() is not yet implemented. ' +
        'This requires container mode with Ring VRF support.'
    );
  }

  /**
   * Destroy the wallet manager and cleanup resources
   */
  destroy(): void {
    log.debug('Destroying WalletManager');
    this.subscribers.clear();
    this.setState({
      status: 'disconnected',
      accounts: [],
      selectedAccount: null,
      activeProvider: null,
    });
  }
}
