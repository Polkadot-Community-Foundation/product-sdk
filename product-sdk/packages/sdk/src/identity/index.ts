/**
 * @parity/product-sdk/identity
 *
 * Identity utilities including DotNS name resolution,
 * product account derivation, and Ring VRF anonymous aliases.
 */

// DotNS utilities
export {
    isValidDotNsName,
    normalizeDotNsName,
    resolveDotNs,
    reverseDotNs,
    isDotNsAvailable,
} from "./dotns.js";

// Product account utilities
export {
    deriveProductAccount,
    verifyProductAccount,
    deriveAnonymousAlias,
    createRingProof,
    verifyRingProof,
} from "./product-account.js";

// Types
export type {
    DotNsRecord,
    ProductAccountInfo,
    AnonymousAliasInfo,
    RingLocation,
    VerificationResult,
    OnChainIdentity,
} from "./types.js";
