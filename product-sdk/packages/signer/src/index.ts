// Types
export type {
    AccountPersistence,
    ConnectionStatus,
    ProviderFactory,
    ProviderType,
    Result,
    SignerAccount,
    SignerManagerOptions,
    SignerState,
} from "./types.js";
export { err, ok } from "./types.js";

// Errors
export {
    SignerError,
    HostUnavailableError,
    HostRejectedError,
    HostDisconnectedError,
    ExtensionNotFoundError,
    ExtensionRejectedError,
    SigningFailedError,
    NoAccountsError,
    TimeoutError,
    AccountNotFoundError,
    DestroyedError,
    isHostError,
    isExtensionError,
} from "./errors.js";

// Provider interface (for custom implementations)
export type { SignerProvider, Unsubscribe } from "./providers/types.js";

// Note: Full SignerManager and provider implementations will be ported in a future update.
// The core types and error classes are available for dependent packages.
