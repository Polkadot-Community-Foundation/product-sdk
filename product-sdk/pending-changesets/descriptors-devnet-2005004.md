---
"@parity/product-sdk-descriptors": minor
"@parity/product-sdk": minor
---

**Re-pin `devnet-asset-hub`, `devnet-individuality` and `devnet-bulletin` on spec 2005004.**

The products devnet moved to spec 2005004 on all three chains, so the descriptors addressed
runtimes that no longer run. They now match the live chains:

| Chain | Old pin | New spec | `codeHash` |
| --- | --- | --- | --- |
| `devnet-asset-hub` (Asset Hub 1000) | `2005002` (tx 18) | `2005004` (tx 19) | `0xd85bfdb1…` |
| `devnet-individuality` (People 1004) | `2005002` (tx 3) | `2005004` (tx 3) | `0x35364c0a…` |
| `devnet-bulletin` (Bulletin 1010) | pinned with the devnet environment | `2005004` (tx 1) | `0xa9cbaf8f…` |

Genesis is unchanged on all three; only the metadata and `codeHash` moved. The other eight
chains are untouched.

**Minor rather than patch, because surface is removed.** Check this before upgrading; a
green `pnpm typecheck` here does not clear consumers.

| Chain | Removed | Added |
| --- | --- | --- |
| `devnet-asset-hub` | nothing | pallets `Scarcity`, `Psm`, `NftClaims`; transaction extension `AsScarcity` in slot 1, so the pipeline goes from 17 to 18 |
| `devnet-individuality` | nothing | pallets `NftCredits`, `PeopleAirdrops`; the pipeline is unchanged |
| `devnet-bulletin` | `TransactionStorage.{renew, force_renew, enable_auto_renew, disable_auto_renew}`, storage `TransactionStorage.{AutoRenewals, PendingAutoRenewals, PermanentStorageUsed}`, extension `ValidateStorageCalls` | pallet `DataRenewal` with those calls and storage, `HopPromotion.promote_v2`, extension `ValidateAuthorizedCalls` |

**Devnet now carries the NFT surface.** The umbrella's nfts contract test asserted devnet
negatively as the live state of a network without `Scarcity` and `NftClaims`. Devnet now
satisfies `NftsChain`, `NftsCreditsChain` and `NftsInstancesChain`, and the negative
control moves to Polkadot Asset Hub, which carries neither pallet.
