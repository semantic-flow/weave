---
id: v6m1s9q2l4c8k7r3p0n5twd
title: 2026 04 04 Alice Bio Referenced
desc: ''
updated: 1775368800000
created: 1775368800000
---

## Goals

- Carry the next real local semantic slice after the completed `06-alice-bio-integrated` -> `07-alice-bio-integrated-woven` payload weave.
- Implement the first local or in-process path for creating a Knop-owned `ReferenceCatalog` and `ReferenceLink` over shared `core` and `runtime`.
- Reuse the same spec, test, and acceptance pattern already used for earlier carried slices.
- Keep this first reference-catalog implementation narrow enough to prove managed reference behavior without absorbing woven catalog history or later referenced-resource extraction.

## Summary

This task should pick up after the carried local `06-alice-bio-integrated` -> `07-alice-bio-integrated-woven` `weave` slice.

The next carried slice should target the settled Alice Bio transition from `07-alice-bio-integrated-woven` to `08-alice-bio-referenced`.

The target behavior is deliberately narrow:

- update `alice/_knop/_inventory/inventory.ttl` so the `alice` Knop has `hasReferenceCatalog <alice/_knop/_references>`
- create `alice/_knop/_references/references.ttl`
- create one canonical `ReferenceLink` rooted at `<alice/_knop/_references#reference001>`
- make that link be about `<alice>` and target `<alice/bio>`
- leave `_mesh/_inventory`, `alice/bio` payload state, histories, and generated pages unchanged

This task should prove the first real non-woven managed-reference path without absorbing `09` weaving behavior, richer catalog page generation, or `bob` extraction.

## Discussion

### Why this is the next slice

The settled fixture ladder already makes the next carried sequence clear:

- semantic change
- weave

After `07-alice-bio-integrated-woven`, the next missing implementation-bearing step is the first non-woven reference-catalog change, not another weave-only slice and not a cross-cutting cleanup task.

Jumping ahead would leave a real gap:

- payload weaving would exist
- but the first managed `ReferenceCatalog` / `ReferenceLink` semantic change would still be unimplemented

### Why this slice should stay narrow

The settled `08` fixture is specific enough to carry a real slice without opening the whole reference-management family.

For `08-alice-bio-referenced`, the current expected behavior is:

- `_mesh/_inventory/inventory.ttl` stays unchanged
- `alice/_knop/_meta/meta.ttl` stays unchanged
- `alice/_knop/_inventory/inventory.ttl` gains `hasReferenceCatalog <alice/_knop/_references>`
- `alice/_knop/_references/references.ttl` appears as the first working catalog surface
- the `ReferenceLink` is attached to `<alice>`, not to `<alice/_knop>` or `<alice/bio/_knop>`
- no new history or page generation appears yet

That is enough to prove:

- first Knop-owned `ReferenceCatalog` creation
- first stable catalog-fragment `ReferenceLink` identity
- the distinction between a semantic catalog change and later `09` weave behavior

### Existing spec posture

This task should add a dedicated `wd.spec.*` note before implementation.

Unlike the carried `weave` slices, there is no existing broad behavior note that already covers the first non-woven reference-catalog operation. The task should use [[ont.reference-links]] as the detailed ontology companion, but it should still define a narrow Weave-facing behavior spec for the first local or in-process path.

### Why not make RDF parsing the next carried task

The existing [[wd.task.2026.2026-04-04_0952-rdf-parsing]] note is legitimate, but it is a cross-cutting cleanup task rather than the next semantic slice.

It should not block the next carried fixture transition unless this reference-catalog work directly exposes a specific parsing failure that must be addressed immediately.

### One fixture diff should not be treated as intended behavior

The settled `07` -> `08` fixture diff includes a whitespace-only change in `alice/_knop/_meta/_history001/_s0001/meta-ttl/meta.ttl`.

That should be treated as incidental fixture noise rather than intended semantic behavior for this task. The meaningful behavior in this slice is the Knop inventory update plus the new references catalog file.

## Open Issues

- What should the exact first local CLI surface be for this operation?
- Should the first slice expose `referenceRole` as an input, or hard-code the carried fixture role to `Canonical`?
- Should shared `core` identify the subject referent implicitly from the target Knop, or explicitly in the request shape even though the carried fixture only needs the Knop-owned case?

## Decisions

- Treat `07-alice-bio-integrated-woven` -> `08-alice-bio-referenced` as the next carried implementation slice.
- Add a dedicated reference-behavior `wd.spec.*` note before implementation.
- Keep the first implementation local or in-process over shared `core` and `runtime`.
- Use the settled Alice Bio `08-alice-bio-referenced` manifest and fixture as the first acceptance target.
- Scope the first slice to the existing `alice` Knop-owned case with one canonical `ReferenceLink` targeting `alice/bio`.
- Keep the semantic subject of the link as `<alice>` rather than drifting into Knop-about-Knop semantics.
- Leave `09` weave behavior, catalog history, dereferenceable current catalog pages, and retired-link handling for the following woven slice.
- Keep the broader RDF-parsing cleanup task separate unless this slice reveals a direct blocker.

## Contract Changes

- This task may introduce the first thin public request/result examples for `knop.addReference` or equivalent reference-catalog creation behavior in `semantic-flow-framework`.
- This task should not attempt to finalize the full contract for multi-link updates, role selection, `referenceTargetState`, or mesh-owned catalogs.

## Testing

- Follow [[wd.testing]].
- Add failing unit tests for the next narrow planning logic where practical, especially stable link identity and inventory updates.
- Add integration tests for local filesystem results against the settled `08-alice-bio-referenced` fixture target.
- Add a black-box CLI acceptance test scoped by the settled `08-alice-bio-referenced` Accord manifest.
- Keep the comparison black-box and fixture-oriented rather than coupling tests to helper internals.

## Non-Goals

- implementing `09-alice-bio-referenced-woven`
- implementing current or historical catalog page generation
- implementing retired-link anchor preservation
- implementing multiple-link batch edits
- implementing `referenceTargetState`
- auto-creating `bob` or other referenced-resource Knops
- addressing the full RDF-parsing cleanup task

## Implementation Plan

- [ ] Decide whether the first reference-catalog slice needs a dedicated `wd.spec.*` note before implementation.
- [ ] Define the first local request/result shapes in shared `core` and `runtime` for adding a single Knop-owned reference.
- [ ] Define the exact first local CLI surface for the carried reference-catalog operation.
- [ ] Add failing unit and integration tests for the `08` reference-catalog behavior.
- [ ] Implement the next local or in-process reference-catalog path over shared `core` and `runtime`.
- [ ] Add a black-box CLI acceptance test scoped by the settled `08-alice-bio-referenced` Accord manifest.
- [ ] Draft or refine the thin public API example or contract fragment in `semantic-flow-framework` if this slice sharpens the public contract.
- [ ] Update relevant overview/spec/framework notes as the slice settles.
