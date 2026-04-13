# Product SDK

This repository contains the `@parity/product-sdk` — a unified library for building products on the Polkadot ecosystem.

## Overview

The Product SDK reduces code duplication across Parity's product portfolio by providing:

- **Chain Access** — TruAPI provider for container mode, PAPI integration
- **Wallet** — Unified wallet connection (container + browser extensions)
- **Storage** — Key-value storage with automatic backend detection
- **Bulletin** — Decentralized file storage via Bulletin Chain
- **Crypto** — Encryption, hashing, key derivation
- **Address** — SS58/H160/bytes32 conversion utilities
- **React Bindings** — Hooks and providers for React apps

## Repository Structure

```
product-sdk-docs/
├── packages/
│   └── product-sdk/           # @parity/product-sdk
│       └── src/
│           ├── core/          # createApp, logger, types
│           ├── chain/         # TruAPI provider, chain descriptors
│           ├── wallet/        # Wallet connection
│           ├── storage/       # Key-value storage
│           ├── bulletin/      # Bulletin Chain client
│           ├── crypto/        # Encryption utilities
│           ├── address/       # Address conversion
│           ├── contracts/     # Contract interaction
│           ├── identity/      # DotNS, product accounts
│           └── react/         # React hooks and providers
│
└── repos/                     # Product repos (git submodules)
    ├── ja3x/
    ├── linktr33/
    ├── mark3t/
    ├── polkadot-web/
    ├── r3lay/
    ├── s3al/
    ├── sh33ts/
    ├── sourc3s/
    ├── t3ams/
    ├── t3rminal/
    └── w3s-conference-app/
```

## Quick Start

### Install

```bash
pnpm install
pnpm build
```

### Basic Usage

```typescript
import { createApp, chains } from '@parity/product-sdk';

const app = await createApp({ name: 'my-app' });

// Connect wallet
const { accounts } = await app.wallet.connect();

// Use storage
await app.storage.set('theme', 'dark');

// Get chain client
const client = app.chain.getClient(chains.assetHub);
```

### React Usage

```tsx
import { ProductSDKProvider, useWallet, useStorage } from '@parity/product-sdk/react';

function App() {
  return (
    <ProductSDKProvider name="my-app">
      <MyApp />
    </ProductSDKProvider>
  );
}

function MyApp() {
  const { accounts, connect } = useWallet();
  const [theme, setTheme] = useStorage('theme', 'light');
  // ...
}
```

## Container vs Standalone Mode

The SDK automatically detects the runtime environment:

| Mode | Description | Storage | Wallet |
|------|-------------|---------|--------|
| **Container** | Running inside polkadot-web host | Host localStorage via TruAPI | Host accounts via TruAPI |
| **Standalone** | Direct browser access | Browser localStorage | Browser wallet extensions |

```typescript
import { isInsideContainer } from '@parity/product-sdk/chain';

const inContainer = await isInsideContainer();
```

## Local Development

```bash
# Link SDK for local development
cd packages/product-sdk
pnpm link --global

# In your product repo
pnpm link --global @parity/product-sdk
```

## Working with Submodules

```bash
# Clone with submodules
git clone --recurse-submodules <repo-url>

# Or initialize after clone
git submodule update --init --recursive

# Update all submodules
git submodule update --remote --merge
```
