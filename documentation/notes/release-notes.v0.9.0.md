---
id: 8401bfabf7d343c0ba90c4d19c2e9785
title: 'release notes v0.9.0'
desc: 'Additive Knop creation and bounded FoundingReferentData initialization, settlement, correction, and library parity'
created: 1787505800000
---

## Summary

`v0.9.0` is the Stagecraft identifier-initialization release. It makes `knop.create` preserve and append to carried MeshInventory state through the shared append/no-op/conflict planner, adds optional exact-byte FoundingReferentData during Knop creation, and gives that support artifact a no-page initial-settlement and later-correction lifecycle through both the CLI and programmatic API.

This is a minor release because it adds new CLI flags and a new version target, publishes `versionFoundingReferentData` from `@semantic-flow/weave-lib`, writes the SFLO v0.5.0 founding vocabulary into governed inventories, and adds consumer-visible validation findings. Existing creation without founding input remains supported, but some malformed or conflict-bearing carried inventories now refuse earlier and more specifically.

## Highlights

- **Knop creation is additive and review-safe.** First and later `knop.create` operations prepare current MeshInventory bytes and quads together, build indexed membership/type views, request only the missing settled facts, no-op exact semantic duplicates, and fail before writes on conflicts. Unknown carried facts and bytes remain an unchanged prefix.
- **Optional bounded founding data.** `weave knop create <D> --founding-data <path>` validates and admission-copies exact Turtle bytes into `D/_knop/_founding/data.ttl`, creates the `FoundingReferentData` discovery subgraph atomically with the Knop, and creates no history, payload, references, sources, pages, or network traffic.
- **Initial settlement and post-publication correction.** `weave version <D> --artifact-role founding-referent-data` snapshots current founding bytes as state 1. Supplying `--source <path>` validates and commits a working update plus the next immutable state as one rollback-capable plan. Earlier settled states are never rewritten.
- **Programmatic and packaged parity.** `versionFoundingReferentData({ meshRoot, designatorPath, bytes? })` is exported from the source API and `@semantic-flow/weave-lib`. The release gate packs and installs the dnt artifact off-tree under Node, settles and corrects founding data, and requires returned results and every mesh byte to match the Deno source import.
- **Publication and integrity validation.** Publication validation reports `unsettled-founding-referent-data` until working bytes match the latest immutable state, verifies exact snapshot digests, and fails closed if a registered KnopInventory is missing or malformed. Ordinary authoring validation treats changed working bytes as pending rather than corrupt.
- **Silent ResourcePage fact deletion is removed.** Restrictive page-generation policy now suppresses HTML generation without deleting settled `hasResourcePage` or page-subject inventory facts. Explicit repair/retraction remains the proper mutation boundary.

## Breaking Or Changed Behavior

- **New create input.** `--founding-data` resolves from the command working directory under the existing operational local-path policy. Source/target collision, workspace escape, missing/non-file sources, root founding input, malformed content, and occupied targets refuse before adoption.
- **The founding document profile is deliberately narrow.** Input must be non-empty UTF-8 Turtle of at most 64 KiB and 256 triples; `@base`/SPARQL `BASE`, blank nodes, named graphs, RDF-star/generalized RDF, relative IRIs, non-`D` subjects, fragments, SFLO/SFCFG predicates, and SFLO/SFCFG `rdf:type` objects are refused. Absolute IRI objects and ordinary literals remain valid.
- **Exact bytes are authoritative.** BOM and CRLF bytes are preserved in working files and immutable snapshots; digests are computed from those bytes, not a parsed/re-serialized graph. Mutable working files carry no standing digest.
- **New version target.** The positional `weave version` command accepts `--artifact-role founding-referent-data [--source <path>]`. `versionPayloads` remains payload-only and no standalone founding update command exists.
- **New public API.** `versionFoundingReferentData`, `VersionFoundingReferentDataRequest`, and `VersionFoundingReferentDataResult` ship from `src/mod.ts` and `@semantic-flow/weave-lib`. Every public failure remains a `WeaveApiError` with stable `code`/`stage` discriminants.
- **Atomicity is bounded and explicit.** Founding creation/correction preflights every path and rolls back completed creates, operation-created empty directories, and completed updates after a caught write failure. Cross-file crash atomicity and concurrent-writer coordination are not claimed.
- **Registered-inventory validation fails closed.** Publication validation now emits `missing-artifact` or `malformed-inventory` instead of silently skipping an unreadable KnopInventory.
- **Testing hooks are not public.** Atomic failure-injection seams remain direct-module test helpers and are withheld from documented public barrels.
- **ResourcePage policy no longer mutates settled inventory.** A page excluded by current generation policy may leave a retained settled link until an explicit repair/retraction operation is performed; routine generation no longer deletes RDF or rewrites unrelated carried facts.

## Performance Receipt

The ruled Stagecraft-shaped probe ran 552 real singular creates on Linux with Deno 2.9.2:

| Observation | Wall | Create loop | Settlement | Peak RSS | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| migrated create, no founding | 2.59 s | 2,392.355 ms | — | 230,216 KiB | 552/552 creates |
| founding create + state 1 | 4.62 s | 2,141.542 ms | 2,300.591 ms | 246,144 KiB | 552/552 creates and digests |

The founding workflow added 2.03 seconds wall and 15,928 KiB peak RSS in those same-session observations, produced zero founding pages, and ran without network permission. These are descriptive single-host receipts, not stable performance guarantees. Dave accepted the singular path for this release; no batch initializer ships in v0.9.0.

## Upgrade From v0.8.0

- Pin SFLO v0.5.0 when validating or interpreting the new `FoundingReferentData` and `hasFoundingReferentData` facts. The v0.5.0 source tag and Pages payloads were published before this release.
- Existing `knop.create` callers need no new argument. If a caller supplies founding data, it must settle that data before publishing the press.
- A correction after publication must create a later state/new press. Reset-and-replay is only a pre-landing repair window.
- Do not treat `D/_knop/_meta/meta.ttl` as referent description. It remains machinery-only; founding assertions live in their explicit artifact.
- Consumers importing `@semantic-flow/weave-lib` remain ESM-only and should import `versionFoundingReferentData` by name.

## Artifacts

- Git tag and GitHub Release: `v0.9.0`.
- npm wrapper: `@semantic-flow/weave@0.9.0`.
- npm native packages: `@semantic-flow/weave-linux-x64`, `@semantic-flow/weave-windows-x64`, `@semantic-flow/weave-macos-x64`, and `@semantic-flow/weave-macos-arm64`, all at `0.9.0`.
- npm library: `@semantic-flow/weave-lib@0.9.0` (ESM-only).
- GitHub Release archives and matching `.sha256` files for all four supported platforms.

## Validation

- Source implementation gate: full `deno task ci`, 887 passed / 0 failed with formatting, lint, type checks, coverage tests, and LCOV generation green.
- Final implementation review: Claude Opus committed-state GO with no blocker or major after the five bounded hardening fixes.
- Executable Accord sequence against an isolated fixture: founding-created 16/16, founding-versioned 9/9, founding-corrected 11/11.
- `@semantic-flow/weave-lib` candidate: dnt build, exact named exports, npm pack/install outside the repository, two-payload version parity, founding state-1/correction parity, complete byte-identical mesh trees, and settled/defect validation under Node.
- SFLO v0.5.0 source/Pages dogfood: 374 Knops, 1,506 Turtle files, byte-identical live release payloads, zero mesh/publication findings, and three new canonical vocabulary/shape pages.
- All-platform Release Manual rehearsal, npm dry-runs, native installation smokes, draft asset inspection, publication, and post-publish checks are recorded in [[release-receipt.v0.9.0]].

## Known Limitations

- Founding data has no generated ResourcePage, remote-fetch path, root-designator support, adoption/retraction operation, or standalone update command.
- The first profile supports one flat public-subject document. Blank-node subgraphs and structured datasets remain out of scope.
- Singular create still parses and physically replaces a growing MeshInventory, so aggregate byte work remains quadratic across a large press. The N=552 receipt did not justify a batch carve.
- Founding history progression currently expects the compact `sflo:` spelling produced by Weave and fails closed on foreign-but-equivalent serialization. Representation-independent progression is boarded separately.
- Retained `hasResourcePage` facts can point at HTML no longer generated by current policy until an explicit repair/retraction surface exists.
- Stagecraft requested and reviewed the contract but its current application checkout has not yet wired the new API; this release claims direct Weave CLI/API and packed-library receipts, not an unavailable downstream founding press.

## Next

- Stagecraft can pin `@semantic-flow/weave`/`weave-lib` 0.9.0 and wire its identifier press to the published founding surface.
- A future batch initializer requires an explicit consumer budget or a larger committed workload and a new task.
- Replace compact-spelling founding progression with representation-independent subject-block/progression machinery.
