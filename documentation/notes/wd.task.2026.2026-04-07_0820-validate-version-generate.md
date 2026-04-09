---
id: ye7zvfv5bsir96u99azdypd
title: 2026 04 07_0820 Validate Version Generate
desc: ''
updated: 1775575539129
created: 1775575235918
---

## Goals

- Decompose the current local `weave` behavior into separate `validate`, `version`, and `generate` operations.
- Treat `weave` as a convenience chain over those three operations rather than as the only place where versioning, validation, and page generation exist.
- Clarify which request fields belong to shared targeting and which belong only to versioning.
- Keep the first scope resource-oriented: target designator-root resources first, not support artifacts directly.

## Summary

Today, local `weave` already does a small amount of validation, performs history/version mutations, renders ResourcePages, and validates the RDF syntax of planned writes before touching the workspace.

That bundling was fine for the carried Alice and Bob slices, but it is now getting in the way of the targeting work. A shared `targets` model should not be forced to carry version-only fields such as payload `historySegment` and `stateSegment`, and it should not imply that support artifacts are independent versioning targets.

This task should define the first clean decomposition:

- shared targeting selects logical resources by `designatorPath`
- `validate` checks the current local state for those targets
- `version` versions those targets and updates whatever support artifacts and inventories the operation owns
- `generate` renders current ResourcePages from the settled current state
- `weave` remains as the composed local operation that chains those steps

The first pass should stay narrow:

- no support-artifact-only scopes
- payload `historySegment` / `stateSegment` are version-specific options, not generic target fields
- the root `weave` CLI may accept payload history/state naming as version-oriented inputs, but shared `--target` syntax should remain limited to shared targeting fields
- no attempt yet at full semantic validation or SHACL-driven validation
- no immediate requirement to expose polished standalone CLI ergonomics before the internal seams are coherent
- no standalone `version` success path that intentionally leaves current ResourcePages stale in the first pass

## Discussion

The current runtime `weave` flow already exposes the rough decomposition as local runtime operations:

- candidate loading and precondition checks happen before planning
- `planWeave(...)` performs the version/history mutation planning in `core`
- `renderResourcePages(...)` is already a separate runtime page-rendering seam
- `validateRdfFiles(...)` already performs a narrow output validation pass before writing files

The current root `weave` CLI now also exposes the shared targeting surface through repeatable `--target <key=value,...>` parsing, but that targeting surface is intentionally shared-target-only. Version-specific payload naming should be treated differently: the root `weave` CLI may accept it as version-oriented input, but it should pass those fields only to `version` inside the composed `weave` flow rather than widening shared `TargetSpec`.

So the question is not whether there are separable concerns. The question is whether Weave should keep hiding them behind one verb.

I think the answer is no, but the split needs to happen at the right boundary.

Why not split `weave` into three new commands immediately and be done with it?

- Because the current `weave` planner is still slice-shaped and single-candidate in important places.
- Because naive splitting would produce three thin wrappers over tangled shared logic, not three coherent operations.
- Because the targeting task needs a stable shared target model first, and that model should not be polluted with version-only fields.

So the right move is:

- define the three operation contracts now
- extract the internal seams in code so those contracts can become real
- keep `weave` as the composed operation while the standalone operations are introduced

Support-artifact-only scopes should stay out of the first pass.

For `version`, targeting only `alice/bio/_knop/_inventory` or only `_mesh/_inventory` does not make much sense as an externally visible operation. Inventory bumps are bookkeeping consequences of versioning a resource surface; they are not usually the semantic thing the caller is trying to version.

For `validate` and `generate`, narrower support-artifact scopes may eventually make sense, but starting there would blur the model before the resource-oriented path is solid.

That means the shared target model should remain resource-root based:

- `alice`
- `alice/bio`
- `ontology`
- `ontology/shacl`

and operations should derive owned support-artifact work from those roots.

## Open Issues

- The first standalone CLI surface now exists as `weave validate`, `weave version`, and `weave generate`, but broader ergonomics such as aliases, richer finding presentation, and command-surface polishing remain open follow-up work rather than part of this task.

## Decisions

- Shared targeting should remain resource-oriented in the first pass; no support-artifact-only scopes.
- `designatorPath` and `recursive` are shared targeting fields.
- `historySegment` and `stateSegment` are version-specific fields, not generic targeting fields.
- Those naming fields apply only to payload artifact versioning in the first pass.
- `validate` and `generate` should not accept payload history/state naming fields.
- The root `weave` CLI may accept payload history/state naming fields as version-oriented inputs, but those fields should bypass shared `--target` parsing and pass through only to `version`.
- `version` owns history creation, current-artifact updates, and whatever support-artifact and inventory updates are required by the targeted resource surface.
- `generate` is derivative-only and should not mutate histories or current RDF artifacts.
- The first standalone `validate` scope should stay narrow and local, matching current shape and RDF-syntax checks rather than inventing a full semantic validation framework.
- The first standalone `validate` output should be structured findings rather than pass/fail only.
- In the first pass, standalone `generate` should operate only from the already-settled current workspace state, not from in-memory planned version outputs.
- In the first pass, standalone `version` should not be a supported success path without `generate`; current ResourcePages stay coupled to the composed `weave` flow for now.
- A later feature may allow ResourcePages to be turned off entirely, in which case generation would stop and existing `ResourcePage` state might need to be removed explicitly rather than left stale.
- Recursive `version` should batch matching targets into one planning pass rather than treating them as independent best-effort operations.
- Best-effort partial recursive versioning is the wrong default because it can leave a mesh semantically inconsistent halfway through a publication run.
- `weave` should remain as a convenience chain over `validate`, `version`, and `generate` even after those operations exist separately.
- The first implementation should prioritize coherent shared seams in `core` and `runtime` before broader CLI ergonomics.
- Recursive `version` batching should stage the full write set against a virtual current workspace state before touching the real workspace.
- Early mesh-inventory renders that advance `_mesh/_inventory` should preserve unrelated current mesh entries when the current inventory already materializes them, rather than regenerating a single-designator snapshot.

## Contract Changes

- Introduce a shared `TargetSpec` shape for resource-oriented targeting, likely:
  - `designatorPath`
  - optional `recursive`
- Define `VersionTargetSpec` as a version-oriented extension of that target shape, likely:
  - shared target fields
  - optional `historySegment`
  - optional `stateSegment`
- `ValidateRequest` should use shared resource targets only.
- `GenerateRequest` should use shared resource targets only.
- `VersionRequest` should use version-oriented targets so payload naming options live only there.
- `WeaveRequest` should be expressed in terms of the same decomposed contracts rather than inventing a separate parallel targeting model.
- The root `weave` CLI may expose version-only payload naming inputs, but they are not part of shared `TargetSpec` and should not be added to shared `--target` syntax.
- In the first pass, support-artifact-only paths such as `_mesh/_inventory`, `alice/_knop/_meta`, or `alice/_knop/_references` should be rejected as explicit top-level targets.
- Recursive targeting, if enabled for a request, should still resolve to matching resource-root targets; derived support-artifact work remains operation-owned.
- `ValidateResult` should carry structured findings even when the first validator scope remains narrow and local.
- In the first pass, `GenerateRequest` should read from settled workspace state only.
- Recursive `VersionRequest` should be planned as a batch before writes begin, not as a best-effort stream of independent per-target mutations.

## Testing

- Keep all current `weave` tests green while the internal decomposition is introduced.
- Add focused core tests around the extracted seams for validation, version planning, and generation planning/rendering.
- Add coverage proving shared resource targets select logical resource roots rather than support-artifact paths.
- Add coverage proving support-artifact-only targets are rejected in the first pass.
- Add coverage proving payload `historySegment` / `stateSegment` are accepted for `version`/`weave` and rejected for `validate`/`generate`.
- Add coverage proving root `weave` CLI payload naming inputs, once exposed, are forwarded only to `version` and do not widen shared target parsing.
- Add coverage proving `generate` does not change RDF/history artifacts.
- Add coverage proving standalone `generate` reads only from settled workspace state in the first pass.
- Add coverage proving `version` performs the expected support-artifact and inventory updates for the targeted resource surface.
- Add coverage proving recursive `version` fails the batch before writes when one targeted resource cannot be versioned cleanly.
- Add coverage proving `weave` as `validate + version + generate` still reproduces the current carried Alice/Bob results.
- Add runtime and CLI coverage only after the core/runtime seams are stable enough to avoid duplicating transition churn.

## Non-Goals

- Full SHACL validation or a broad semantic validation framework in this task.
- Support-artifact-only targeting in the first pass.
- Redesigning page templates or the visual presentation of generated pages.
- Immediately removing `weave` as a top-level command.
- Solving all multi-target orchestration details before the single-target decomposition is coherent.

## Implementation Plan

- [x] Refine this task note into a concrete decomposition boundary between shared targeting and version-specific options.
- [x] Define the shared target model separately from version-specific payload naming fields.
- [x] Identify and extract the current internal `weave` seams for target resolution, validation, version planning, and page generation.
- [x] Define standalone `ValidateRequest`, `VersionRequest`, and `GenerateRequest` contracts for local workspace mode.
- [x] Define `ValidateResult` around structured findings rather than pass/fail only.
- [x] Re-express `WeaveRequest` and `executeWeave(...)` as orchestration over those same seams rather than a separate parallel contract.
- [x] Keep the first implementation resource-root targeted and fail closed on support-artifact-only explicit targets.
- [x] Keep standalone `generate` settled-state-only in the first pass.
- [x] Decide and implement the version-oriented root `weave` CLI pass-through for payload `historySegment` / `stateSegment` without widening shared `--target`.
- [x] Batch recursive `version` planning before writes rather than using best-effort per-target mutation.
- [x] Add core and runtime tests proving the decomposed seams still preserve current carried `weave` behavior.
- [x] Expose standalone CLI commands once the internal seams settle enough to support them coherently.
