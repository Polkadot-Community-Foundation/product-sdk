---
"@parity/product-sdk-descriptors": minor
"@parity/product-sdk": minor
---

**Re-pin `devnet-asset-hub`, `devnet-individuality` and `devnet-bulletin` on the versioned-extensions runtimes.**

The products devnet enacted the versioned transaction extensions runtime, so the descriptors addressed
runtimes that no longer run. They now match the live chains:

| Chain | Old pin | New spec | `codeHash` |
| --- | --- | --- | --- |
| `devnet-asset-hub` (Asset Hub 1000) | `2005004` (tx 19) | `2005006` (tx 22) | `0x2283196e…` |
| `devnet-individuality` (People 1004) | `2005004` (tx 3) | `2005005` (tx 4) | `0xffc75685…` |
| `devnet-bulletin` (Bulletin 1010) | `2005004` (tx 1) | `2005005` (tx 1) | `0x51067dd7…` |

Genesis is unchanged on all three; only the metadata and `codeHash` moved. The other eight
chains are untouched.

**Minor rather than patch, because surface is removed.**

| Chain | Removed | Added |
| --- | --- | --- |
| `devnet-asset-hub` | constant `MembersSubscriber.MaxGapScanPerBatch`; `UnitTransactionExtension`, `AsScarcity`, `AsPgas`, `AsDotnsGateway` and `RestrictOrigins` leave pipeline 0 (18 to 13 extensions) | pallet `VerifySignature`; pipeline 1 (19 extensions: the previous set plus `VerifyMultiSignature`) |
| `devnet-individuality` | pallet `SkipFeelessPayment`; 12 individuality and origin extensions leave pipeline 0 (23 to 11) | pipeline 1 (the previous 23 extensions) |
| `devnet-bulletin` | nothing | pallet `AccumulateForward`; the pipeline is unchanged |

On Asset Hub and People the calls that wrap a `RuntimeCall` (`Utility`, `Proxy`, `Multisig`, `Sudo`, plus
`Scheduler` and `Whitelist` on Asset Hub and `People.under_alias` / `PeopleLite.dispatch_as_signer` on People) change
type shape. On all three chains so do `System.Events`, the events that carry a `DispatchError`, and the
`BlockBuilder.apply_extrinsic` and `DryRunApi` runtime calls. On Asset Hub also `Balances.Holds`, `AssetsHolder`,
`MembersSubscriber` and the `ReviveApi` runtime calls; on People the `Airdrop` and `PeopleAirdrops` calls.
