/**
 * @parity/product-sdk/wallet
 *
 * Wallet connection and signing utilities.
 * Supports both container mode (TruAPI) and standalone mode (browser extensions).
 *
 * Credit: Based on polkadot-apps/packages/signer
 */

export { WalletManager } from "./wallet.js";
export type { WalletSubscriber, Unsubscribe } from "./wallet.js";
export type {
    ConnectionStatus,
    ProviderType,
    WalletAccount,
    WalletState,
    WalletError,
    WalletErrorType,
    WalletOptions,
    ProductAccount,
    RingLocation,
} from "./types.js";
