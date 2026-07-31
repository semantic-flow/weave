---
id: relnotesv060draft20260731
title: 'release notes v0.6.0'
desc: 'v0.6.0: programmatic validateMesh with structured findings; whole-mesh validate memory exhaustion fixed'
updated: 1785527000000
created: 1785527000000
---

## Summary

`v0.6.0` delivers programmatic mesh validation: `validateMesh` in `@semantic-flow/weave-lib` (and the pinned-source root) returns structured findings with stable machine codes instead of formatted CLI text — the adoption-deciding ask from the Stagecraft consumer reviews ([[wd.consumer-feedback-0.5.1]] §8, re-raised in the 2026-07-29 follow-up). The consumption model for `weave` vs `weave-lib` is now documented contract, and the CLI and API consume one findings pipeline so they cannot drift.

It also resolves the reported whole-mesh validate memory exhaustion end to end: the ~4 GiB heap ceiling hit on a ~6,900-file pending-heavy mesh was reproduced as a benchmark, attributed to per-candidate duplication of source payload text, and fixed — untargeted validation of a 1,700-pending-Knop mesh with realistic content goes from a 14-second out-of-memory crash to clean completion at ~550 MiB peak RSS. The diagnosis tooling (opt-in memory statistics and a pending-heavy mesh generator) ships with the release.

## Highlights

- **`validateMesh(request)`** — read-only, lock-free, exact-shape request/result per the normative contract [[wd.programmatic-validate-api]]: a 14-code stable finding registry (`severity`/`code`/`message` + `path`/`designatorPath` attribution), explicit planner-coverage counts (`knownDesignatorPathCount`, `plannedDesignatorPathCount`), and `meshBase` absent exactly when mesh metadata is unresolvable. Mesh invalidity is result data; thrown `WeaveApiError` is reserved for cannot-validate.
- **Validator inversion, honestly scoped:** malformed mesh content (inventory, config, metadata) becomes findings rather than exceptions; coverage is documented as planner/preflight + publication-readiness, not whole-mesh integrity traversal; fail-fast planning semantics are preserved and stated (at most one mesh finding per run in v1).
- **New `read-failure` error code** (load stage, additive to the shared `WeaveApiErrorCode` union) for I/O-environment failures — `io-failure` remains write-stage-only.
- **Typed capability limitation for floating repository sources:** `validateMesh` refuses meshes whose pending candidates need git-backed checkout identification with `unsupported-source`, replacing the misleading missing-working-payload degradation under Node. The capability-injected seam that would lift this is sketched as future work.
- **Consumption-model ruling documented** ([[wu.api-reference]]): `weave-lib` sits alongside the CLI, never replaces it; the CLI is not becoming a wrapper; one version line, released together.
- **Whole-mesh validate memory exhaustion fixed.** Pending extracted-term candidates previously each minted their own copies of the full source payload text (twice per candidate); at ~1,700 pending Knops with realistic content that exhausted V8's default ~4 GiB heap in 14 seconds. Payload and snapshot text reads now share one immutable string per distinct path through the command-scoped read cache. Measured at the reported scale: N=1,700 @ 1 KB/term goes from out-of-memory to clean completion at ~554 MiB peak RSS; the same-cardinality no-content run drops from ~1.96 GiB to ~485 MiB peak with no wall-time regression.
- **Validate memory instrumentation** (opt-in `WEAVE_MEMORY_STATS=1`): retained-bytes accounting by role (including an identity-deduplicated candidate live-set counter), loop iteration counts, peak RSS, and V8 heap statistics including post-GC discrimination under `--v8-flags=--expose-gc`; plus `scripts/generate-pending-heavy-mesh.ts`, a policy- and content-parameterized pending-heavy mesh generator — the tooling that reproduced, attributed, and now regression-guards the exhaustion.
- The off-tree Node contract smoke gains settled and seeded-defect `validateMesh` legs; the npm-lib README/description now cover both APIs.

## Breaking Or Changed Behavior

- **CLI validate: strict improvement, named per the behavioral-changelog rule.** Malformed inventory Turtle and config-resolution failures now surface as validate findings (exit 1 with a message, as other findings do) instead of escaping as uncaught crashes. Output text for previously-working cases and all exit-code semantics are unchanged (byte-covered by tests).
- `WeaveApiErrorCode` gains `read-failure` (additive; `versionPayloads` never emits it). No existing code, stage, or field changes meaning.
- Validate memory behavior improves substantially on pending-heavy meshes (see Highlights); findings, output text, and write-path behavior are byte-covered unchanged.
- New public API surface only; CLI routing, binaries, packaging, `./src/mod.ts` imports, and `versionPayloads` behavior are unchanged.

## Artifacts

- npm: `@semantic-flow/weave`, four platform packages, `@semantic-flow/weave-lib`, all at `0.6.0`; tag `v0.6.0`; GitHub Release.
