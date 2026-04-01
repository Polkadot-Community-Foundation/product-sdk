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
│   └── crypto/                  # @parity/product-sdk-crypto
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
├── package.json                 # Monorepo root
└── pnpm-workspace.yaml          # pnpm workspace config
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

## Packages

| Package | Description |
|---------|-------------|
| [@parity/product-sdk-crypto](./packages/crypto) | Encryption, hashing, and key derivation |

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
