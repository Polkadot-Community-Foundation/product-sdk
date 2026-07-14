---
"@parity/product-sdk-descriptors": minor
"@parity/product-sdk-host": minor
"@parity/product-sdk-chain-client": minor
"@parity/product-sdk": minor
---

**Add a `devnet` environment for the public PCF products devnet (standard Paseo).**

`getChainAPI("devnet")` now resolves the Asset Hub (1000), People/individuality
(1004), and Bulletin (1010) chains of the public products devnet:

- `@parity/product-sdk-descriptors` ships three new chain descriptors —
  `devnet-asset-hub`, `devnet-bulletin`, `devnet-individuality` — generated from
  live metadata, with genesis hashes `0xd6eec261…`, `0xe101f0fa…`, and
  `0xe6c30d6e…` respectively.
- `@parity/product-sdk-chain-client` adds `"devnet"` to the `Environment` union
  and to the set of available environments, so `getChainAPI("devnet")` no longer
  throws.
- `@parity/product-sdk-host` adds a `devnet` entry to `BULLETIN_RPCS`.

Consumers resolving chains through product-sdk (dotns UI,
playground-constellation, and apps using `getChainAPI`) can now target the PCF
devnet by passing `"devnet"`.
