---
id: n2fj8u6h1prx3m0q4stya7b
title: 2026 04 07_1852 Payload Version Naming
desc: ''
updated: 1775887627419
created: 1775613150562
---

## Goals

- Make `historySegment` and `stateSegment` real for payload artifact versioning rather than merely accepted by version-oriented request types.
- Keep version-only naming out of the shared targeting model and out of the shared `weave --target` CLI surface.
- Preserve the current `_history001` and `_sNNNN` defaults when custom naming is omitted.
- Fail closed when requested naming conflicts with the settled current payload history shape.

## Summary

The current code accepts `historySegment` and `stateSegment` on `VersionTargetSpec`, but the payload version planner still hardcodes `_history001` and `_s0001` or derived `_sNNNN` paths. That means the request contract currently over-promises: version-oriented naming fields exist in types and request validation, but they do not yet change the materialized history/state paths.

This task should make that contract truthful by implementing payload history/state naming end-to-end in `core` and `runtime` for `version` and composed `weave`.

The first pass should stay narrow:

- apply custom naming only to payload artifact histories and payload historical states
- keep mesh and Knop support-artifact history naming system-controlled
- keep `validate` and `generate` free of version-only naming fields
- keep the shared `weave --target` CLI limited to shared target fields such as `designatorPath` and `recursive`, even if the root `weave` CLI later accepts separate version-oriented naming options

This task follows the contract boundary already established in [[wd.completed.2026.2026-04-07_0820-validate-version-generate]] and the shared-targeting decision recorded in [[wd.completed.2026.2026-04-07_0020-targeting]].

## Discussion

There are two honest ways to resolve the current mismatch:

- remove `historySegment` and `stateSegment` from the version-oriented request contract until they are implemented
- implement the naming behavior those fields already imply

The better move is to implement them, but only at the payload-artifact boundary that [[wd.completed.2026.2026-04-07_0820-validate-version-generate]] already scoped.

In this task, `historySegment` and `stateSegment` should be treated as path segment names for the payload artifact's history and new historical state. They are not human-facing labels, and they should not replace the numeric `historyOrdinal`, `stateOrdinal`, or `nextStateOrdinal` bookkeeping already carried in RDF. A payload state may therefore live at a path such as `alice/bio/releases/v0.0.1/...` while still carrying numeric ordinals in the semantic model.

The first-pass behavior should be:

- if both naming fields are omitted, preserve the current default behavior
- if a payload artifact has no current history yet, `historySegment` names the first payload history path when provided, otherwise use `_history001`
- if a payload artifact has no current history yet, `stateSegment` names the first payload state path when provided, otherwise use `_s0001`
- if a payload artifact already has a current history, a provided `historySegment` must match that existing payload history segment or the request should fail closed
- if a payload artifact already has a current history, a provided `stateSegment` names only the newly created next state; existing states keep their current paths
- any requested naming that collides with an existing incompatible path should fail before writes

This task should not broaden naming to every woven artifact. Support-artifact histories are bookkeeping consequences of versioning a resource surface, and letting callers rename `_mesh/_inventory`, `alice/_knop/_meta`, or `alice/_knop/_inventory` histories here would turn a narrow payload-publication feature into a wider artifact-layout redesign.

CLI exposure should also stay narrow. The root `weave --target` syntax just settled as the shared-target surface, so it should not absorb version-only naming keys. If the root `weave` CLI accepts payload history/state naming in this task, those should be separate version-oriented inputs that pass through only to `version`, not additions to shared target parsing.

## Open Issues

- None currently blocking the first implementation pass.

## Decisions

- `historySegment` and `stateSegment` should be implemented, not removed, but only for payload artifact versioning in the first pass.
- Omitted naming fields preserve the current `_history001` and `_sNNNN` defaults.
- A provided `historySegment` on an already-versioned payload must match the existing current payload history segment; this task does not move a payload artifact between histories.
- A provided `stateSegment` names only the new payload historical state being created in the current versioning step.
- Numeric RDF ordinals remain authoritative bookkeeping and must stay independent of custom path segment names.
- Mesh and Knop support-artifact histories remain system-named in this task.
- `validate` and `generate` remain free of version-only naming fields.
- The shared `weave --target` CLI remains shared-target-only; do not add `historySegment` or `stateSegment` there in this task.
- The root `weave` CLI may accept payload history/state naming as separate version-oriented inputs, but those inputs must pass through only to `version`.
- Root `weave` CLI payload naming inputs should require exactly one `--target` so the version-only naming stays attached to a specific target spec.
- `executeVersion(...)` and programmatic `executeWeave(...)` requests may continue to carry version-oriented naming fields through `VersionTargetSpec`.

## Contract Changes

- `VersionTargetSpec.historySegment` and `VersionTargetSpec.stateSegment` become semantically effective rather than merely validated.
- Payload version planning should derive payload history/state paths from requested naming fields when present.
- When a payload artifact already has a current history, planning should resolve and validate the existing payload history segment before accepting a requested `historySegment`.
- Materialized RDF, filesystem paths, and generated ResourcePage paths for payload histories/states should reflect the requested payload naming segments.
- `ValidateRequest`, `GenerateRequest`, and shared `TargetSpec` remain unchanged.
- The shared `weave` CLI target parser remains unchanged and should continue rejecting version-only naming fields.
- If root `weave` CLI naming inputs are added in this task, they should be modeled separately from shared target parsing and forwarded only to `version`.

## Testing

- Add core coverage proving first payload weave uses requested payload `historySegment` and `stateSegment` when creating the first payload history/state.
- Add core coverage proving second payload weave uses a requested next `stateSegment` while preserving numeric ordinal progression.
- Add core coverage proving a mismatched requested `historySegment` on an already-versioned payload fails closed.
- Add runtime coverage proving `executeVersion(...)` materializes payload files and pages under requested history/state segments.
- Add runtime coverage proving programmatic `executeWeave(...)` honors requested payload naming while still composing `validate + version + generate`.
- Keep or extend coverage proving `validate`, `generate`, and the shared `weave --target` CLI reject version-only naming fields.
- Add CLI coverage proving any root `weave` payload naming inputs are passed only to `version`.
- Keep all existing default-path tests green when naming fields are omitted.

## Non-Goals

- Naming mesh or Knop support-artifact histories/states in this task.
- Exposing `historySegment` or `stateSegment` on the shared root `weave --target` CLI.
- Designing the standalone `version` CLI surface in this task.
- Renaming or migrating already-materialized histories/states in an existing workspace.
- Solving generic multi-target naming policy across mixed artifact kinds in one pass.

## Implementation Plan

- [x] Refine payload history/state naming semantics against the current carried first- and second-payload weave slices.
- [x] Identify every hardcoded payload `_history001` and `_sNNNN` path assumption in `core/weave` and `runtime/weave`.
- [x] Make `historySegment` and `stateSegment` effective in payload version planning while preserving current defaults when omitted.
- [x] Fail closed when a requested payload `historySegment` conflicts with an already-settled current payload history path.
- [x] Keep support-artifact history/state naming system-controlled in the first pass.
- [x] Keep the shared `weave --target` CLI shared-target-only and reject version-only naming keys there.
- [x] Decide the narrow root `weave` CLI pass-through for payload `historySegment` / `stateSegment` without widening shared target parsing.
- [x] Add core and runtime tests for custom payload naming, mismatched-history rejection, and default-path preservation.
