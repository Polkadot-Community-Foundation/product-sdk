---
"@parity/product-sdk-descriptors": minor
"@parity/product-sdk": minor
---

**Re-pin `devnet-individuality` and `devnet-asset-hub` on Paseo v2.5.2.**

Both devnet descriptors were pinned before the Paseo v2.5 line enacted on the products
devnet, so they addressed runtimes that no longer run. They now match the live chains:

| Chain | Old spec | New spec | `codeHash` |
| --- | --- | --- | --- |
| `devnet-individuality` (People 1004) | `2004003` (tx 1) | `2005002` (tx 3) | `0xd0f3191c…` |
| `devnet-asset-hub` (Asset Hub 1000) | `2004002` (tx 16) | `2005002` (tx 18) | `0x3d399dc2…` |

Genesis is unchanged on both; only the metadata and `codeHash` moved. The other nine
chains are untouched.

**Minor rather than patch, because surface is removed.** Check this before upgrading; a
green `pnpm typecheck` here does not clear consumers.

| Chain | Removed | Added |
| --- | --- | --- |
| `devnet-individuality` | `AuthorizeValueTransfer` transaction extension | pallets `RelayRandomness`, `AssetConversion`, `PoolAssets`, `Parameters`, `NetworkSuffix` |
| `devnet-asset-hub` | `AuthorizeValueTransfer` and `AsRingAlias` transaction extensions | pallet `NetworkSuffix` |

Slot 0 of the origin-modifier pipeline is `UnitTransactionExtension` on both chains now.
People stays at 23 extensions, so nothing that reads its pipeline from metadata moves;
Asset Hub goes from 18 to 17, since the old pin also predated `AsRingAlias` leaving. A plain
signed origin can move the protected asset and coinage on both chains; nothing product-side
needs a bundled W3S key any more.

**Devnet now carries the same individuality surface as paseo and previewnet.** The
umbrella's contract test asserted the old devnet negatively as the prompt to flip on a
re-pin, and this is that flip: devnet satisfies `GameChain`, `PrizeStatusChain`,
`LiteSignUpChain`, `NetworkSuffixChain` and the sign-up read, and `Game.sign_up_with_account`
takes `airdrops` rather than the singular `airdrop`. `@parity/product-sdk-individuality`
takes no version bump: its published output is unchanged, only its in-source tests lost the
devnet blob as a pre-revision `PeopleLiteAuth` negative and gained it as a third chain that
encodes identically, plus a byte-for-byte lite-alias bind on its one-slot-longer pipeline.
