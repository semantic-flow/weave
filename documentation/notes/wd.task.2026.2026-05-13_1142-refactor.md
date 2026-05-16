---
id: jd5zknfphxed645cfk8u1x8
title: 2026 05 13_1142 Refactor
desc: ''
updated: 1778697781645
created: 1778697752752
---

## Goals

- some files, like weave.ts have gotten extremely long. Let's refactor to more-manageable files.

## Summary

- Started the `src/core/weave/weave.ts` split by moving mesh support ResourcePage planning into `src/core/weave/mesh_support_pages.ts`.
- Pulled `WeaveInputError` and `VersionPlan` into small shared modules so the public `./weave.ts` API can continue re-exporting the same names while extracted planners avoid circular imports.

## Discussion

- This is intentionally a narrow first extraction. The moved planner keeps private Turtle-block helpers for now instead of introducing a broad helper module taxonomy while config synthesis is still in motion.

## Open Issues

- Several older fixture-backed tests still fail after the canonical namespace/config-default changes. This refactor preserves the focused mesh support ResourcePage behavior, but the broader fixture ladder still needs regeneration or targeted updates.

## Decisions

- Keep `src/core/weave/weave.ts` as the public façade for existing imports.
- Move mesh support ResourcePage planning to a dedicated core module first because it is a current config-synthesis seam and has focused test coverage.
- Keep `VersionPlan` in a shared module so `planVersion` and extracted version-style planners can share the same structural result type without importing through the façade.

## Contract Changes

- No CLI/runtime contract change intended.
- Existing imports from `src/core/weave/weave.ts` for `WeaveInputError`, `VersionPlan`, `MeshSupportHistoryPolicies`, and `planMeshSupportResourcePages` remain valid through re-exports.

## Testing

- `deno test --allow-read --allow-env src/core/weave/weave_test.ts --filter planMeshSupportResourcePages` passes.
- `deno test --allow-read --allow-write --allow-env tests/integration/weave_test.ts --filter "executeWeave materializes current support ResourcePages"` passes.
- `deno task lint` passes.
- `deno task check` passes.
- `deno task test` currently fails broadly: 157 passed, 145 failed. Failures match the active fixture/config drift around canonical `sflo` namespace, retired config names, and older generated mesh shapes rather than this extraction's focused behavior.

## Non-Goals

- Do not split every `weave.ts` concern in this pass.
- Do not regenerate the fixture ladder in this pass.

## Implementation Plan

- [x] Extract mesh support ResourcePage planning from `src/core/weave/weave.ts`.
- [x] Preserve the public `./weave.ts` export surface.
- [x] Run focused support-page tests.
- [x] Run lint and type checks.
- [ ] Regenerate or update the broader fixture ladder after config synthesis settles.
