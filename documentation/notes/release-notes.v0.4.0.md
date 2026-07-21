---
id: a820bd611f904e0d9697ba78ede51a52
title: 'release notes v0.4.0'
desc: ''
updated: 1784669088271
created: 1784669088271
---

## Summary

`v0.4.0` adds Weave's stable source-level programmatic payload version API. Consumers with a full-commit-pinned Weave checkout can import `versionPayloads` and its public types from `./src/mod.ts`, pass copied `Uint8Array` payloads plus exact designator paths, and record one coherent batch without spawning the CLI or staging caller-owned temporary files.

The API plans from an authoritative in-memory text overlay, preflights working updates and version outputs together before mutation, preserves coherent-batch no-op semantics at cardinality one, and returns typed per-target outcomes and staged errors. Existing CLI routing and behavior are unchanged.

## Highlights

- Added the explicit root exports `versionPayloads`, `VersionPayloadsRequest`, `VersionPayloadsResult`, `PayloadVersionOutcome`, `WeaveApiError`, `WeaveApiErrorCode`, and `WeaveApiErrorStage`.
- Added strict admission for absolute mesh roots, non-empty exact target batches, normalized duplicate refusal, single-item-only overwrite, copied byte views, and fatal UTF-8 decoding.
- Added an API-only prepared coherent-batch runtime entry and a core `planCoherentPayloadBatchVersion` wrapper so one-item requests inherit the explicit batch planner's `alreadyCurrent` behavior without changing `planWeave`, CLI predicates, or `executeVersion`.
- Added combined preflight across caller-supplied working updates and generated version outputs. Admission, load, and plan refusals leave the mesh untouched; sequential write failures report completed and possibly touched paths.
- Added real-filesystem coverage for applied/no-op retries, coherent refusal, overwrite, source/content fences, cardinality-one equivalence, single and multi CLI/API byte equivalence, the authoritative overlay boundary, and every governed write phase.

## Breaking Or Changed Behavior

- This is a new stable pre-1.0 source API. Consumers import the repository source root from a pinned checkout; the native npm wrapper is not yet a library package, and no JSR export is defined.
- `versionPayloads` accepts existing mesh-local UTF-8 text/RDF payloads only. Invalid UTF-8, empty content, non-text working paths, repository/floating sources, recursive targets, and payload-IRI input refuse with typed errors.
- Every request is a coherent batch, including cardinality one. `overwriteExistingState` is limited to one item with explicit history and state segments.
- The caller remains responsible for single-writer serialization. Weave adds no lock, rollback, journal, or filesystem transaction.
- Completed and pre-write-refused calls have deterministic retry behavior. A write-stage failure can leave disclosed partial output and may require explicit repair before retry.
- No CLI command, option, predicate, or default candidate-loader behavior changed.

## Artifacts

- Git tag and GitHub Release: `v0.4.0` when the separate release runbook is executed.
- Native binaries and npm CLI-wrapper packages remain release-runbook outputs; they do not yet expose this source API as a packaged library.

## Validation

- Source quality gate: `deno task fmt` and `deno task ci` before close; exact implementation receipts are recorded in [[wa.task.2026.2026-07-21_1322-programmatic-version-api]].
- Focused equivalence evidence compares every API-created/updated output path byte-for-byte against the CLI `payload update` plus `version` workflow for both single and multi-item requests.
- Failure injection covers working update, text create, binary create accounting, and support update, including completed-path details and the narrowed retry boundary.

## Known Limitations

- Binary payload recording is intentionally excluded. The later-binary decoded-text defect identified by the programmatic API spec review is tracked in [[wd.todo]].
- `snapshot-conflict` is reserved and is not raised in v1; admitted byte copies are authoritative, and configuration/support inputs are outside the payload capture boundary.
- Partial write failures are non-transactional. In particular, a created historical snapshot followed by a failed support update can require caller-directed repair before the same request can be retried.
- Library packaging through npm/JSR exports is a separate [[wd.todo]] item.

## Next

- Add npm and/or JSR library exports with downstream contract smoke tests while keeping the pinned-checkout root import stable.
- Own binary working updates and first/later historical advancement as one exact-byte task before broadening the API content class.
- Consider a reusable acceptance manifest for the portable behavior in [[sf.spec.2026-07-21-programmatic-version-api]] once the fixture estate has an appropriate transition rung.
