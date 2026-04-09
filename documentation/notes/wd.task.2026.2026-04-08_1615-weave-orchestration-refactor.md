---
id: m4v8q2x7p1c5z9r6n3b7k2d
title: 2026 04 08_1615 Weave Orchestration Refactor
desc: ''
created: 1775715234850
---

## Goals

- Refactor `src/runtime/weave/weave.ts` so request preparation, target-resolution policy, and phase orchestration are explicit seams instead of one large correctness-sensitive flow.
- Unify weave target preparation across `validate`, `version`, `generate`, and `executeWeave`.
- Move requested-target coverage policy and exact-versus-recursive asymmetry into a shared targeting seam rather than leaving it as runtime-local orchestration logic.
- Reduce the chance that future target-shape expansion changes one phase of `weave` without changing the others.

## Summary

`executeWeave(...)` currently composes `validate`, `version`, and `generate` as separate public operations. That decomposition is useful, but it still leaves multiple target-normalization and selection seams in play:

- `validate` prepares shared targets
- `version` prepares version targets
- `generate` prepares shared targets again
- `executeWeave` bridges them with its own normalization/adaptation logic

The current behavior is mostly right, but the architecture is still too easy to drift. If a future target field or target-resolution rule lands in one phase before the others, `weave` can start validating target set A, versioning target set B, and generating target set C.

This task should make `weave` prepare its request once, apply requested-target coverage rules once, and then pass a canonical prepared execution object through the downstream phases.

## Discussion

The current runtime file is carrying several distinct concerns:

- public API normalization and error mapping
- target adaptation between shared and version-oriented requests
- current mesh loading
- initial candidate loading
- requested-target coverage checks
- iterative planning/orchestration
- logging

That is too much policy in one place.

The exact-versus-recursive target rule is a good example. Today the behavior is intentional:

- an exact requested target must itself currently be weaveable
- a recursive requested target may succeed when at least one descendant is weaveable even if the ancestor is not

That asymmetry is correct, but it is subtle enough that a future "cleanup" could easily simplify it back into a bug. The rule should become shared targeting behavior, not just a runtime loop detail.

The refactor should probably introduce a prepared request/execution seam with responsibilities such as:

- canonical request-shape validation
- normalized target preparation
- requested-target coverage enforcement
- target-to-phase adaptation where needed
- staged mesh/candidate loading inputs

Once that seam exists, `executeWeave` can become simpler orchestration over already-prepared inputs instead of owning multiple normalization paths itself.

This is also the right time to keep the refactor boundary sharp:

- do not silently expand behavior
- preserve payload history/state naming support for `weave`
- keep `validate`, `version`, and `generate` as distinct operations
- avoid bundling page-model redesign into the orchestration refactor itself

## Open Issues

- The exact split between `runtime/weave/weave.ts` and `core/targeting.ts` is still open.
- The name of the prepared execution object is still open.
- Some candidate loading may later need performance-aware caching, but correctness boundaries matter more than micro-optimization in the first refactor.
- The final seam between orchestration refactor work and page-model refactor work should stay explicit.

## Decisions

- `executeWeave` should prepare and validate its target semantics once before dispatching phase operations.
- Requested-target coverage rules should live in a shared targeting seam rather than being runtime-only incidental logic.
- The exact-versus-recursive asymmetry is intentional and should be documented and tested as a contract.
- Future target-shape additions should have one canonical normalization path.
- This refactor should preserve current external behavior unless a deliberate follow-up task changes it.
- Payload history/state naming remains supported for `weave`; the refactor is not a reason to narrow that contract.

## Contract Changes

- Introduce a shared prepared-weave-request seam for runtime orchestration.
- Centralize requested-target coverage checks.
- Reduce `executeWeave(...)` to orchestration over prepared inputs and phase calls.
- Keep downstream `validate`, `version`, and `generate` APIs coherent with the shared prepared-target model.

## Testing

- Preserve all current `weave`, `validate`, `version`, and `generate` behavior tests.
- Add focused unit coverage for the requested-target coverage rules, especially the exact-versus-recursive asymmetry.
- Add focused runtime coverage proving `executeWeave` forwards one coherent prepared target set through all three phases.
- Add regression coverage for future target-shape validation so malformed additions fail closed.

## Non-Goals

- Redesigning generated page visuals.
- Replacing the current planner with a generic workflow engine.
- Taking on the full page-definition/content-model task in the same slice.
- Pursuing performance-only caching changes without a clear correctness benefit.

## Implementation Plan

- [ ] Identify the current request-normalization and target-adaptation seams inside `src/runtime/weave/weave.ts`.
- [ ] Define a prepared execution object for `executeWeave`.
- [ ] Move requested-target coverage and exact-versus-recursive policy into a shared targeting seam.
- [ ] Refactor `executeWeave` to consume the prepared execution object rather than re-normalizing per phase.
- [ ] Add focused unit and runtime tests that pin the shared target-preparation contract.
- [ ] Update [[wd.codebase-overview]] when the new seams land.
