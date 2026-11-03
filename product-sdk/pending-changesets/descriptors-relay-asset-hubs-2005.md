---
"@parity/product-sdk-descriptors": minor
"@parity/product-sdk": minor
---

**Re-pin `polkadot-asset-hub` and `kusama-asset-hub` on the live runtimes.**

Both descriptors addressed runtimes that no longer run. They now match the live chains:

| Chain | Old pin | New spec | `codeHash` |
| --- | --- | --- | --- |
| `polkadot-asset-hub` | `2004000` | `2005002` | `0xd9f622db…` |
| `kusama-asset-hub` | `2003002` | `2005001` | `0xf760c1f2…` |

Genesis is unchanged on both. The other nine chains are untouched.

**Minor rather than patch, because surface is removed.**

| Chain | Removed | Added |
| --- | --- | --- |
| `polkadot-asset-hub` | pallet `StateTrieMigration` | pallets `VerifySignature`, `AssetsFreezer`, `AssetsHolder`, `MembersSubscriber`, `AliasAccounts`, `Pgas`, `PgasAllowance`, `DotnsGateway`, `OriginRestriction`, `NetworkSuffix`; a version 1 extension pipeline (18 extensions, adding `UnitTransactionExtension`, `VerifyMultiSignature`, `AsPgas`, `AsDotnsGateway` and `RestrictOrigins`) next to the unchanged version 0 pipeline |
| `kusama-asset-hub` | pallet `StateTrieMigration` | nothing |

On both chains the calls that wrap a `RuntimeCall` (`Utility`, `Proxy`, `Multisig`) and the `ReviveApi` runtime calls change type shape.
