# @parity/product-sdk-crypto

Unified cryptographic utilities for the Polkadot Product SDK. Extracted from patterns found in 8 product repositories, replacing fragmented usage of `tweetnacl`, `@noble/ciphers`, `@noble/hashes`, and Web Crypto API.

## Installation

```bash
pnpm add @parity/product-sdk-crypto
```

## Features

| Feature | Algorithms | Used By |
|---------|-----------|---------|
| **Encryption** | AES-256-GCM, XChaCha20-Poly1305 | s3al, sourc3s, mark3t, linktr33, ja3x, sh33ts |
| **Key Exchange** | X25519 (ECDH) | s3al, sourc3s, sh33ts |
| **Hashing** | SHA-256, Blake2b-256/512 | All products (CID calculation) |
| **Key Derivation** | PBKDF2, HKDF, Scrypt | s3al, sourc3s, ja3x, sh33ts, t3ams |

## Usage

### Symmetric Encryption

```typescript
import { encrypt, decrypt, generateKey } from '@parity/product-sdk-crypto';

// Generate a random 256-bit key
const key = generateKey();

// Encrypt data (returns { ciphertext, nonce })
const data = new TextEncoder().encode('secret message');
const encrypted = encrypt(data, key);

// Decrypt
const decrypted = decrypt(encrypted, key);
```

### Encrypt to Buffer (for storage)

```typescript
import { encryptToBuffer, decryptFromBuffer, generateKey } from '@parity/product-sdk-crypto';

const key = generateKey();

// Encrypt to single buffer: nonce || ciphertext
const encrypted = encryptToBuffer(data, key);

// Store encrypted buffer...
localStorage.setItem('data', btoa(String.fromCharCode(...encrypted)));

// Later: decrypt from buffer
const decrypted = decryptFromBuffer(encrypted, key);
```

### Asymmetric Encryption (X25519)

```typescript
import { generateKeyPair, encryptForRecipient, decryptFromSender } from '@parity/product-sdk-crypto';

// Recipient generates key pair
const recipient = await generateKeyPair();

// Sender encrypts for recipient (uses ephemeral keys for forward secrecy)
const encrypted = await encryptForRecipient(data, recipient.publicKey);

// Recipient decrypts
const decrypted = await decryptFromSender(encrypted, recipient.privateKey);
```

### Hashing

```typescript
import { hash, hashToHex } from '@parity/product-sdk-crypto/hashing';

// SHA-256 (default)
const sha256 = hash(data);
const sha256Hex = hashToHex(data);

// Blake2b (for CID calculation)
const blake2b256 = hash(data, 'blake2b-256');
const blake2b512 = hash(data, 'blake2b-512');

// Hash from string
const textHash = hashToHex('hello world', 'blake2b-256');
```

### Key Derivation

```typescript
import { deriveKey, generateSalt, deriveKeyWithSalt } from '@parity/product-sdk-crypto/kdf';

// PBKDF2 (password-based encryption)
const salt = generateSalt();
const key = deriveKey('user password', salt, {
  algorithm: 'pbkdf2',
  iterations: 600_000  // OWASP 2023 recommendation (default)
});

// Or generate salt automatically
const { key, salt } = deriveKeyWithSalt('password', { algorithm: 'pbkdf2' });

// HKDF (derive multiple keys from master)
const masterKey = getSharedSecret(); // from X25519
const encKey = deriveKey(masterKey, salt, {
  algorithm: 'hkdf',
  info: 'encryption-key-v1'
});

// Scrypt (memory-hard, high security)
const scryptKey = deriveKey('password', salt, {
  algorithm: 'scrypt',
  N: 16384,  // CPU/memory cost
  r: 8,      // Block size
  p: 1       // Parallelization
});
```

### Derive Multiple Keys

```typescript
import { deriveMultipleKeys } from '@parity/product-sdk-crypto/kdf';

// Derive encryption, MAC, and IV keys from a single master
const [encKey, macKey, ivKey] = deriveMultipleKeys(
  sharedSecret,
  salt,
  ['encryption', 'authentication', 'initialization']
);
```

### String Convenience Methods

```typescript
import { encryptString, decryptString, generateKey } from '@parity/product-sdk-crypto';

const key = generateKey();
const encrypted = encryptString('hello world', key);
const decrypted = decryptString(encrypted, key); // 'hello world'
```

## Algorithm Selection Guide

| Use Case | Recommended Algorithm |
|----------|----------------------|
| General file encryption | `aes-256-gcm` (default) |
| Large files, streaming | `xchacha20-poly1305` |
| Password → encryption key | `pbkdf2` or `scrypt` |
| Master key → derived keys | `hkdf` |
| Content addressing (CIDs) | `blake2b-256` |
| General hashing | `sha-256` |

## API Reference

### Encryption (`@parity/product-sdk-crypto`)

- `generateKey(length?: number): Uint8Array` - Generate random encryption key
- `generateKeyPair(): Promise<KeyPair>` - Generate X25519 key pair
- `encrypt(plaintext, key, algorithm?): EncryptedData` - Encrypt with symmetric key
- `decrypt(encrypted, key, algorithm?): Uint8Array` - Decrypt with symmetric key
- `encryptToBuffer(plaintext, key, algorithm?): Uint8Array` - Encrypt to single buffer
- `decryptFromBuffer(buffer, key, algorithm?): Uint8Array` - Decrypt from buffer
- `encryptForRecipient(plaintext, publicKey, algorithm?): Promise<Uint8Array>` - Asymmetric encrypt
- `decryptFromSender(buffer, privateKey, algorithm?): Promise<Uint8Array>` - Asymmetric decrypt
- `encryptString(plaintext, key, algorithm?): Uint8Array` - Encrypt string
- `decryptString(buffer, key, algorithm?): string` - Decrypt to string

### Hashing (`@parity/product-sdk-crypto/hashing`)

- `hash(data, algorithm?): Uint8Array` - Hash data
- `hashToHex(data, algorithm?): string` - Hash to hex string
- `hashConcat(algorithm, ...buffers): Uint8Array` - Hash concatenated buffers
- `toHex(bytes): string` - Convert bytes to hex
- `fromHex(hex): Uint8Array` - Convert hex to bytes

### Key Derivation (`@parity/product-sdk-crypto/kdf`)

- `generateSalt(length?: number): Uint8Array` - Generate random salt
- `deriveKey(password, salt, options, keyLength?): Uint8Array` - Derive key
- `deriveKeyWithSalt(password, options, keyLength?): { key, salt }` - Derive with auto salt
- `deriveMultipleKeys(masterKey, salt, contexts, keyLength?): Uint8Array[]` - Derive multiple keys
