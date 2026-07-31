---
id: relnotesv060draft20260731
title: 'release notes v0.6.0'
desc: 'DRAFT — boarded 2026-07-31, unreleased; headline: programmatic validateMesh'
updated: 1785527000000
created: 1785527000000
---

> **DRAFT — boarding stub (2026-07-31), not yet released.** Content lands from `lane/validate-mesh-api` and `lane/validate-memory-baseline` (see the landing plan in archive note `wa.task.2026.2026-07-29_1219-programmatic-validate-mesh-api`). Finalize wording, artifacts, and any late riders at release time.

## Summary

`v0.6.0` delivers programmatic mesh validation: `validateMesh` in `@semantic-flow/weave-lib` (and the pinned-source root) returns structured findings with stable machine codes instead of formatted CLI text — the adoption-deciding ask from the Stagecraft consumer reviews ([[wd.consumer-feedback-0.5.1]] §8, re-raised in the 2026-07-29 follow-up). The consumption model for `weave` vs `weave-lib` is now documented contract, and the CLI and API consume one findings pipeline so they cannot drift.

It also ships the validate memory-diagnosis tooling that turned the reported whole-mesh 4 GiB heap exhaustion from an anecdote into a reproducible, mechanistically attributed benchmark (the bounded-memory fix itself is tracked separately and may ride a later release).

## Highlights

- **`validateMesh(request)`** — read-only, lock-free, exact-shape request/result per the normative contract [[wd.programmatic-validate-api]]: a 14-code stable finding registry (`severity`/`code`/`message` + `path`/`designatorPath` attribution), explicit planner-coverage counts (`knownDesignatorPathCount`, `plannedDesignatorPathCount`), and `meshBase` absent exactly when mesh metadata is unresolvable. Mesh invalidity is result data; thrown `WeaveApiError` is reserved for cannot-validate.
- **Validator inversion, honestly scoped:** malformed mesh content (inventory, config, metadata) becomes findings rather than exceptions; coverage is documented as planner/preflight + publication-readiness, not whole-mesh integrity traversal; fail-fast planning semantics are preserved and stated (at most one mesh finding per run in v1).
- **New `read-failure` error code** (load stage, additive to the shared `WeaveApiErrorCode` union) for I/O-environment failures — `io-failure` remains write-stage-only.
- **Typed capability limitation for floating repository sources:** `validateMesh` refuses meshes whose pending candidates need git-backed checkout identification with `unsupported-source`, replacing the misleading missing-working-payload degradation under Node. The capability-injected seam that would lift this is sketched as future work.
- **Consumption-model ruling documented** ([[wu.api-reference]]): `weave-lib` sits alongside the CLI, never replaces it; the CLI is not becoming a wrapper; one version line, released together.
- **Validate memory instrumentation** (opt-in `WEAVE_MEMORY_STATS=1`): retained-bytes accounting by role, loop iteration counts, peak RSS, and V8 heap statistics including post-GC discrimination under `--v8-flags=--expose-gc`; plus `scripts/generate-pending-heavy-mesh.ts`, a policy- and content-parameterized pending-heavy mesh generator. Together they reproduce the reported untargeted-validate heap exhaustion at srd scale and attribute it (per-candidate full-source duplication; parse churn).
- The off-tree Node contract smoke gains settled and seeded-defect `validateMesh` legs; the npm-lib README/description now cover both APIs.

## Breaking Or Changed Behavior

- **CLI validate: strict improvement, named per the behavioral-changelog rule.** Malformed inventory Turtle and config-resolution failures now surface as validate findings (exit 1 with a message, as other findings do) instead of escaping as uncaught crashes. Output text for previously-working cases and all exit-code semantics are unchanged (byte-covered by tests).
- `WeaveApiErrorCode` gains `read-failure` (additive; `versionPayloads` never emits it). No existing code, stage, or field changes meaning.
- New public API surface only; CLI routing, binaries, packaging, `./src/mod.ts` imports, and `versionPayloads` behavior are unchanged.

## Artifacts (to confirm at release)

- npm: `@semantic-flow/weave`, four platform packages, `@semantic-flow/weave-lib`, all at `0.6.0`; tag `v0.6.0`; GitHub Release. Release mechanics per [[wd.release-runbook]] (dry-run + draft rehearsal first).
