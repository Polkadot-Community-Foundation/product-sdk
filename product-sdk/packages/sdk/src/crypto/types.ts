/**
 * Types for @parity/product-sdk/crypto
 *
 * Credit: Based on patterns from polkadot-apps and analysis of 8+ Parity products
 */

/** Encrypted data with nonce/IV prepended */
export interface EncryptedData {
    /** The ciphertext with authentication tag */
    ciphertext: Uint8Array;
    /** The nonce/IV used for encryption */
    nonce: Uint8Array;
}

/** Encrypted data serialized as a single buffer: nonce || ciphertext */
export type EncryptedBuffer = Uint8Array;

/** Supported symmetric encryption algorithms */
export type SymmetricAlgorithm = "aes-256-gcm" | "xchacha20-poly1305";

/** Supported asymmetric encryption schemes */
export type AsymmetricScheme = "x25519-aes-gcm" | "x25519-xchacha20";

/** Supported hash algorithms */
export type HashAlgorithm = "sha-256" | "blake2b-256" | "blake2b-512";

/** Supported key derivation functions */
export type KdfAlgorithm = "pbkdf2" | "hkdf" | "scrypt";

/** Key pair for asymmetric operations */
export interface KeyPair {
    publicKey: Uint8Array;
    privateKey: Uint8Array;
}

/** Options for PBKDF2 key derivation */
export interface Pbkdf2Options {
    algorithm: "pbkdf2";
    iterations?: number; // default: 600_000
    hash?: "sha-256" | "sha-512"; // default: sha-256
}

/** Options for HKDF key derivation */
export interface HkdfOptions {
    algorithm: "hkdf";
    hash?: "sha-256" | "sha-512"; // default: sha-256
    info?: string | Uint8Array;
}

/** Options for scrypt key derivation */
export interface ScryptOptions {
    algorithm: "scrypt";
    N?: number; // default: 16384
    r?: number; // default: 8
    p?: number; // default: 1
}

export type KdfOptions = Pbkdf2Options | HkdfOptions | ScryptOptions;
