---
id: z7k3v1m8p4x9q2n5c6t0wda
title: 2026 04 04 1553 Weave Alice Bio Referenced Woven
desc: ''
updated: 1775368800000
created: 1775371980000
---

## Goals

- Carry the next real local `weave` slice after the first completed local `knop.addReference` implementation.
- Implement the next local or in-process `weave` path over shared `core` and `runtime`.
- Reuse the same spec, test, and acceptance pattern already used for the earlier carried slices.
- Keep this `weave` implementation narrow enough to prove reference-catalog weaving behavior without absorbing Bob extraction or later richer retired-link handling.

## Summary

This task should pick up after the completed local `07-alice-bio-integrated-woven` -> `08-alice-bio-referenced` `knop.addReference` slice.

The next carried slice should be the first local reference-catalog-oriented `weave` implementation, targeting the settled Alice Bio transition from `08-alice-bio-referenced` to `09-alice-bio-referenced-woven`.

The target behavior is deliberately narrow:

- version the new `alice/_knop/_references` artifact into its first explicit history
- advance `alice/_knop/_inventory` from `_s0001` to `_s0002`
- generate `alice/_knop/_references/index.html`
- generate the first `alice/_knop/_references/_history001/...` ResourcePages
- keep `_mesh/_inventory/inventory.ttl` unchanged because the new reference surface remains Knop-internal
- keep `alice/_knop/_references/references.ttl` as the working current file while making it match the latest catalog-history snapshot exactly

This task should prove the first real `version + validate + generate` path for a Knop-owned `ReferenceCatalog` without absorbing later Bob extraction, multi-link updates, or richer retired-link rendering work.

## Discussion

### Why this is the next slice

The settled fixture ladder already makes the next carried sequence clear:

- semantic change
- weave

After `08-alice-bio-referenced`, the next missing implementation-bearing step is the woven reference-catalog case, not the cross-cutting RDF-parsing cleanup task.

Jumping ahead would leave a real gap:

- non-woven managed references would exist
- but the first explicit `ReferenceCatalog` history, KnopInventory advancement for that catalog, and catalog-facing page-generation path would still be unimplemented

### Why this slice should stay narrow

The settled `09` fixture is specific enough to carry a real slice without reopening the whole weave family.

For `09-alice-bio-referenced-woven`, the current expected behavior is:

- `_mesh/_meta/meta.ttl` stays unchanged
- `_mesh/_inventory/inventory.ttl` stays unchanged
- `alice/_knop/_meta/meta.ttl` stays unchanged
- `alice/_knop/_inventory/inventory.ttl` advances to `_s0002`
- `alice/_knop/_references/_history001/_s0001/...` appears as the first explicit catalog history
- `alice/_knop/_references/index.html` and the first catalog-history pages appear

That is enough to prove:

- first `ReferenceCatalog` history creation
- later-state advancement for an already-versioned Knop-owned support artifact
- the rule that weaving a Knop-internal reference surface does not widen `_mesh/_inventory`
- first current-page dereference support for a fragment-identified `ReferenceLink`

### Existing spec posture

This task should reuse [[wd.spec.2026-04-03-weave-behavior]] rather than creating another broad weave spec note immediately.

If this reference-catalog-oriented `weave` slice exposes a missing or ambiguous behavior boundary not already captured there, update the existing weave behavior note rather than spawning overlapping prose.

### ReferenceCatalog page behavior

This slice is the first carried implementation that must make the current catalog page act as the dereference target for the catalog-rooted fragment link.

For the settled `09` Alice Bio case, there is only one current link and no retired links yet, so the implementation should stay narrow:

- render the current `#reference001` anchor on `alice/_knop/_references/index.html`
- materialize the first catalog history pages and snapshot
- structure the runtime so later retired-link recovery from history can extend this path rather than replace it

That means the task should prove the first history-aware catalog page shape without pretending the richer retired-link case is already solved.

## Resolved Issues

- The existing weave request shape stayed narrow for this slice; reference-catalog weaving still fits the current local `weave` targeting model.
- The existing shared runtime page-rendering seam should be extended rather than replaced; `09` is the next carried page family on that seam, not a reason to fork a separate generator path.
- `_mesh/_inventory` should remain unchanged for this slice because the woven change is Knop-internal support-artifact state, not a new public current-surface mesh member.

## Decisions

- Treat `08-alice-bio-referenced` -> `09-alice-bio-referenced-woven` as the next carried implementation slice.
- Reuse [[wd.spec.2026-04-03-weave-behavior]] as the current behavior spec for this slice.
- Keep the next `weave` implementation local or in-process over shared `core` and `runtime`.
- Keep bare top-level `weave` as the local CLI surface for this slice rather than introducing a new `weave weave` spelling.
- Use the settled Alice Bio `09-alice-bio-referenced-woven` manifest and fixture as the first acceptance target.
- Keep `_mesh/_inventory/inventory.ttl` unchanged while advancing `alice/_knop/_inventory` to `_s0002`.
- Version `alice/_knop/_references` into its first explicit history and keep the working `references.ttl` file byte-identical to the latest historical snapshot after weave.
- Extend the existing shared runtime page-rendering seam to cover current and historical `ReferenceCatalog` pages for this slice.
- Keep the current `09` catalog page output fixture-first and minimal; defer richer retired-link recovery and multi-link rendering rules to later slices.
- Keep current local `weave` runtime validation at generated-RDF parse validation for this slice.
- Do not absorb Bob extraction, multi-link updates, daemon work, or broader rendering ambitions into this task.

## Contract Changes

- No public `weave` contract change should be required for this slice; the existing thin request/result shape should still fit the reference-catalog weave case.
- This task should not attempt to finalize the full `weave` contract for every future support-artifact type, retired-link behavior, or target-selection mode.

## Testing

- Follow [[wd.testing]].
- Add failing unit tests for the next narrow weave planning or rendering logic where practical.
- Add integration tests for local filesystem results against the settled `09-alice-bio-referenced-woven` fixture target.
- Add a black-box CLI acceptance test scoped by the settled `09-alice-bio-referenced-woven` Accord manifest.
- Keep the comparison black-box and fixture-oriented rather than coupling tests to internal helper structure.

## Non-Goals

- implementing `10-alice-bio-updated`
- implementing Bob extraction or `12-bob-extracted`
- implementing richer retired-link anchor recovery beyond the current one-link fixture
- implementing multi-link catalogs or batch updates
- changing the current root working payload file placement
- implementing daemon endpoints
- implementing a broad or final HTML renderer system
- addressing the broader RDF-parsing cleanup task in this slice

## Implementation Plan

- [x] Confirm that [[wd.spec.2026-04-03-weave-behavior]] is sufficient as the current behavior spec for the `09` slice.
- [x] Confirm that the existing thin local `weave` request/result shape stays narrow for this slice and does not require a new artifact-target model.
- [ ] Add failing unit and integration tests for the `09` reference-catalog-weave behavior.
- [ ] Extend the existing shared runtime page-rendering seam to cover current and historical `ReferenceCatalog` pages without introducing a separate renderer path.
- [ ] Implement the first-history `alice/_knop/_references` weave path and keep the working `references.ttl` file byte-identical to the latest historical snapshot after weave.
- [ ] Implement `alice/_knop/_inventory` advancement to `_s0002` while keeping `_mesh/_inventory/inventory.ttl` unchanged.
- [ ] Add a black-box CLI acceptance test scoped by the settled `09-alice-bio-referenced-woven` Accord manifest.
- [ ] Update relevant overview/spec/framework notes as the slice settles.
