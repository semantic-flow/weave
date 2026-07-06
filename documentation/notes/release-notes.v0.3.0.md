---
id: f520462880584382b658d0952082620b
title: 'release notes v0.3.0'
desc: ''
updated: 1783310543118
created: 1783310543118
---

## Summary

`v0.3.0` is a planner-generalization release driven by Stagecraft, Weave's first application-shaped consumer. Later-payload advancement is now derived from current RDF facts instead of carried fixture shapes, so application meshes can advance `_s0003` and later payload states with current-only support artifacts. The release adds deterministic multi-target payload batches with pre-write input snapshot verification, a `--generated-at` flag for pinned ResourcePage timestamps, and service-integration documentation for applications that drive Weave programmatically.

The changes were verified against the real Stagecraft temporal-vocabulary fixture ladder: the previously failing three-designator rung now weaves cleanly, with all prior historical state files checksum-verified byte-identical and the result accepted by Accord transition checks.

## Highlights

- Later-payload weave planning now derives current history, latest state, next state ordinal, support-artifact policy, and KnopInventory progression from current RDF facts through a dedicated read model, so any coherent later ordinal can advance — not only the carried second-payload fixture shape. Later-ordinal payloads with intentionally current-only support artifacts classify without hints.
- "The current local weave slice only supports the settled second payload weave shape..." failures are gone from the payload path. Planner diagnostics now name the specific missing or conflicting fact, such as a missing `sflo:latestHistoricalState` or conflicting `sflo:nextStateOrdinal` values. The unused second-payload shape assertion was removed and the generalized symbols renamed to later-payload terminology.
- Repeated exact `--target` flags on `weave` and `weave version` now plan multiple payload advancements as one deterministic batch: canonical designator-path order, one merged support-artifact progression for shared support files (a shared MeshInventory advances once per batch), whole-plan refusal before any write when a requested target is malformed, and no-op convergence when re-running an already-applied batch.
- Explicit payload batches get input snapshot verification: Weave hashes the requested targets' current working payload files before batch content capture and verifies them after capture, refusing the whole batch before writing anything if a working payload changed mid-capture. Changes after capture are ignored by design; the batch derives from captured content.
- `--generated-at <iso-8601>` on full `weave` and `weave generate` pins the single timestamp used in generated ResourcePage footers, canonicalized to UTC `toISOString()` form. Supplying the flag converges existing pages to the requested timestamp; omitting it keeps the sample-once-now default and timestamp-only skip behavior. Services can stamp pages with event time, and page regeneration becomes byte-reproducible.
- The `weave` CLI reference now includes service-integration guidance: the application owns coherent serialization and retry orchestration, Weave owes fail-closed whole-plan validation and deterministic output, and refusal plus rerun-no-op semantics make retry loops safe.
- The fixture-ladder conformance flow, CLI reference, and repository options documentation were expanded, and CLI subprocess tests now share a Deno cache for faster, more reliable CI runs.

## Breaking Or Changed Behavior

- This is still pre-1.0 software, and no compatibility shims are promised for stale pre-v1 fixture or inventory shapes.
- Planner error text changed on the payload path: tooling that matched "settled second payload weave shape" (or the related settled-shape phrasing) must move to the new condition-specific diagnostics, which name the invalid state instead of the implementation slice.
- Multiple exact payload `--target` flags on `weave` and `weave version` are now planned together as a batch in canonical designator-path order instead of being limited to one payload candidate per invocation. Recursive and mixed-slice target sets keep the existing deterministic sequential planner.
- When batch members share support artifacts, the batch writes one merged progression (for example, one new MeshInventory state for the whole batch) rather than one progression per target. Sequential single-target invocations remain available where per-target progression is intended.
- Explicit payload batches can now fail pre-write with an input snapshot diagnostic if a requested working payload changes during batch capture. Nothing is written in that case; re-invoking after re-serialization is the intended recovery.
- Re-running an already-applied exact payload batch no-ops already-current payload targets instead of erroring or minting duplicate identical states. A caller that wants a new state must change the payload or request a new explicit state segment.
- Generalized later-payload inventory rendering preserves established state/manifestation block ordering and trims excess blank lines; existing single-payload fixture outputs remain byte-identical except where that normalization applies on the generalized path.
- When `--generated-at` is supplied, footer-only page differences are written so existing pages converge to the requested timestamp; the timestamp-only skip optimization applies only when the flag is omitted.

## Artifacts

- Git tag: `v0.3.0`
- GitHub Release: `v0.3.0`
- Native binary archives for Linux x64, Windows x64, macOS x64, and macOS arm64
- Matching `.sha256` checksum files
- npm packages for `@semantic-flow/weave` and supported platform packages

## Validation

- Source quality gate for release preparation: `deno task ci`, covering fmt check, lint, type check, coverage test run, and LCOV generation. The latest full local gate passed with 664 tests.
- Real-fixture replay evidence: the Stagecraft `test-inn-ambush` temporal-vocabulary rung (`a.11-temporal-vocabulary-records` to `a.12-temporal-vocabulary-woven`) was replayed with sequential single-target and batch invocations. 72 pre-existing `_history*/_s*` payload state files were verified byte-identical by `sha256sum -c`, the staged replay produced the same 21 path changes as the woven branch, and batch runs are byte-identical to equivalent sequential runs for the rung.
- Accord acceptance: `accord validate` reports the rung's focused scenario index conformant, and `accord check-scenario` passes with one step wrapping 33 passing checks.
- Batch coverage includes shared-inventory merging, whole-plan refusal with nothing written, capture-window mutation refusal, post-capture mutation tolerance, rerun no-op convergence, and byte-identical determinism with a pinned `--generated-at`.
- Release workflow rehearsal should use the `Release Manual` workflow with `npm_publish_mode: dry-run` and `github_release_mode: draft` before publishing npm packages or the GitHub Release.
- Native binary smoke path: each built executable should run `weave --version`, and npm smoke install should verify the wrapper package resolves the matching platform package.

## Known Limitations

- Multi-target batching covers explicit exact payload targets whose target-scoped planning policies are consistent. Recursive targets, mixed-slice target sets, and untargeted multi-candidate planning keep the existing sequential behavior.
- Input snapshot verification hashes the requested targets' working payload files only. Hashing every plan-read support/config input is deferred until candidate loading exposes a clean pre-capture read set.
- Several non-payload planner paths still carry fixture-shaped "only supports the settled ... shape" gates, including extracted-knop, page-definition, and reference-catalog assertions. The remaining first-payload blockers are tracked separately.
- The full Stagecraft scenario index is not yet green; Accord acceptance coverage for this release is per-rung. Unrelated later-rung conformance expectations remain follow-up work.
- Append-onlyish inventory behavior remains partial: batches use the append/no-op/conflict planner portion needed for merged rendering and reruns, but broad inventory-writer migration is still open.
- A shared batch timestamp is a human-readable signal only. There is no grouped-provenance or batch-citation vocabulary in the data; if the game+session workload proves that need, it becomes its own model task.

## Next

- Sweep the remaining fixture-shaped planner gates: list every "only supports the settled ... shape" assertion, classify each as a true invariant, a malformed-state diagnostic, or implementation debt, and replace the debt with fact-driven read models.
- Extend input snapshot verification to all plan-read inputs once the loader can enumerate its read set before capture.
- Integrate the new Accord v0.1.0 capabilities into Weave's fixture-ladder workflow: run `accord validate` over live Semantic Flow manifests in CI, convert the full-corpus rerun to a scenario index driven by `accord check-scenario`, use `accord draft-manifest` when regenerating ladder rungs, and pin the CI accord checkout to the `v0.1.0` tag.
- Dogfood the game+session history mesh as the next application workload, including service-driven batch weaves with `--generated-at`, and revisit grouped provenance only if that workload proves the need.
- Continue append-onlyish inventory migration toward append/no-op/fail-closed semantics for the remaining inventory writers.
