# Product SDK Prototype

This repository contains prototypes for the Polkadot Product SDK, along with submodule references to all product repositories for testing and validation.

## Background

The Product SDK is a proposed unified library to reduce code duplication and improve developer experience across Parity's product portfolio. This prototype repository serves as:

1. **A testing ground** for SDK package implementations
2. **A validation environment** to test SDK integration across all 14 product repos
3. **A collaboration space** for the team to iterate on API design

See [PRODUCT_SDK_PROPOSAL.md](./PRODUCT_SDK_PROPOSAL.md) for the full analysis of 15 repositories and detailed feature specifications.

## Repository Structure

```
product-sdk-prototype/
├── packages/                    # SDK packages (prototypes)
│   └── crypto/                  # @parity/product-sdk-crypto - Encryption, hashing, KDF
│       ├── src/
│       │   ├── index.ts         # Main exports (re-exports all modules)
│       │   ├── types.ts         # TypeScript interfaces and types
│       │   ├── encryption.ts    # AES-GCM, XChaCha20, X25519 key exchange
│       │   ├── hashing.ts       # SHA-256, Blake2b with hex utilities
│       │   └── kdf.ts           # PBKDF2, HKDF, Scrypt key derivation
│       ├── package.json
│       └── tsconfig.json
│
├── repos/                       # Product repos (git submodules)
│   ├── bulletin-deploy/         # Bulletin Chain deployment tools
│   ├── ja3x/                    # JAM Explorer
│   ├── linktr33/                # Decentralized link aggregator
│   ├── mark3t/                  # NFT marketplace
│   ├── polkadot-web/            # Polkadot web interface
│   ├── r3lay/                   # Cross-chain relay
│   ├── s3al/                    # Decentralized messaging (Seal)
│   ├── sh33ts/                  # Encrypted spreadsheets
│   ├── sourc3s/                 # Decentralized Git hosting
│   ├── t3ams/                   # Team collaboration
│   ├── t3rminal/                # Developer terminal
│   ├── triangle-js-sdks/        # Triangle SDK collection
│   └── w3s-conference-app/      # Web3 Summit conference app
│
├── PRODUCT_SDK_PROPOSAL.md      # Full SDK proposal document
├── package.json                 # Monorepo root (npm workspaces)
└── .gitignore
```

## Getting Started

### Clone with submodules

```bash
git clone --recurse-submodules <repo-url>
cd product-sdk-prototype
```

### If already cloned without submodules

```bash
git submodule update --init --recursive
```

### Install dependencies

```bash
pnpm install
```

### Build packages

```bash
pnpm build
```

## Working with Submodules

Each product repo in `repos/` is a git submodule pointing to the original repository. This allows us to:

- Work on SDK integration branches in each product
- Keep product repos in sync with upstream changes
- Test SDK changes across multiple products simultaneously

### Making changes to a product repo

```bash
# 1. Navigate to the product repo
cd repos/mark3t

# 2. Create a feature branch
git checkout -b feature/use-crypto-sdk

# 3. Make your changes to use @parity/product-sdk-crypto
# ... edit files ...

# 4. Commit and push to the product repo
git add .
git commit -m "Refactor: use @parity/product-sdk-crypto for encryption"
git push origin feature/use-crypto-sdk

# 5. Update the parent repo to track the new commit
cd ../..
git add repos/mark3t
git commit -m "Update mark3t submodule to crypto-sdk branch"
```

### Pulling latest changes from upstream

```bash
# Update a single repo
cd repos/mark3t
git fetch origin
git checkout main
git pull origin main

# Or update all repos at once
git submodule update --remote --merge
```

### Switching a submodule to a different branch

```bash
cd repos/sourc3s
git fetch origin
git checkout feature/some-branch

# Update parent to track this
cd ../..
git add repos/sourc3s
git commit -m "Track sourc3s feature branch"
```

## Packages

### @parity/product-sdk-crypto

Unified cryptographic utilities extracted from patterns found in 8 product repositories. Replaces fragmented usage of `tweetnacl`, `@noble/ciphers`, `@noble/hashes`, and Web Crypto API.

#### Installation (in product repos)

```bash
pnpm add @parity/product-sdk-crypto
```

#### Features

| Feature | Algorithms | Used By |
|---------|-----------|---------|
| **Encryption** | AES-256-GCM, XChaCha20-Poly1305 | s3al, sourc3s, mark3t, linktr33, ja3x, sh33ts |
| **Key Exchange** | X25519 (ECDH) | s3al, sourc3s, sh33ts |
| **Hashing** | SHA-256, Blake2b-256/512 | All products (CID calculation) |
| **Key Derivation** | PBKDF2, HKDF, Scrypt | s3al, sourc3s, ja3x, sh33ts, t3ams |

#### Usage Examples

**Symmetric Encryption**

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

**Encrypt to Buffer (for storage)**

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

**Asymmetric Encryption (X25519)**

```typescript
import { generateKeyPair, encryptForRecipient, decryptFromSender } from '@parity/product-sdk-crypto';

// Recipient generates key pair
const recipient = await generateKeyPair();

// Sender encrypts for recipient (uses ephemeral keys for forward secrecy)
const encrypted = await encryptForRecipient(data, recipient.publicKey);

// Recipient decrypts
const decrypted = await decryptFromSender(encrypted, recipient.privateKey);
```

**Hashing**

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

**Key Derivation**

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

**Derive Multiple Keys**

```typescript
import { deriveMultipleKeys } from '@parity/product-sdk-crypto/kdf';

// Derive encryption, MAC, and IV keys from a single master
const [encKey, macKey, ivKey] = deriveMultipleKeys(
  sharedSecret,
  salt,
  ['encryption', 'authentication', 'initialization']
);
```

**String Convenience Methods**

```typescript
import { encryptString, decryptString, generateKey } from '@parity/product-sdk-crypto';

const key = generateKey();
const encrypted = encryptString('hello world', key);
const decrypted = decryptString(encrypted, key); // 'hello world'
```

#### Algorithm Selection Guide

| Use Case | Recommended Algorithm |
|----------|----------------------|
| General file encryption | `aes-256-gcm` (default) |
| Large files, streaming | `xchacha20-poly1305` |
| Password → encryption key | `pbkdf2` or `scrypt` |
| Master key → derived keys | `hkdf` |
| Content addressing (CIDs) | `blake2b-256` |
| General hashing | `sha-256` |

## Development Workflow

### Adding a new SDK package

1. Create the package directory:
   ```bash
   mkdir -p packages/new-package/src
   ```

2. Add `package.json` with workspace configuration:
   ```json
   {
     "name": "@parity/product-sdk-new-package",
     "version": "0.0.1",
     "type": "module",
     "exports": {
       ".": {
         "import": "./dist/index.js",
         "types": "./dist/index.d.ts"
       }
     }
   }
   ```

3. Implement the package following patterns from existing products

4. Test integration across product repos

### Testing SDK changes in a product

```bash
# Link the local SDK package
cd repos/mark3t
pnpm link ../../packages/crypto

# Run product tests
pnpm test

# When done, unlink
pnpm unlink @parity/product-sdk-crypto
```

## Documentation

- [PRODUCT_SDK_PROPOSAL.md](./PRODUCT_SDK_PROPOSAL.md) - Full SDK proposal with:
  - Analysis of 15 product repositories (~155,000+ lines of code)
  - Pain points and code duplication metrics
  - 12 feature specifications with before/after examples
  - Build order and architectural dependencies

