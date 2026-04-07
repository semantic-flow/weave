---
id: etbr2n7qf5s5m1sm451z44od
title: 2026 04 05 0903 Weave Alice Bio V2 Woven
desc: ''
updated: 1775405054301
created: 1775405054301
---

## Goals

- Carry the next real local `weave` slice after [[wd.completed.2026.2026-04-04_2019-update-alice-bio-payload]].
- Implement the first local or in-process `weave` path for an already woven payload artifact receiving a second historical state.
- Reuse the same spec, test, and acceptance pattern already used for the earlier carried slices.
- Keep this `weave` implementation narrow enough to prove second-state payload weaving and the required ResourcePage materialization without absorbing Bob extraction or a broad renderer redesign.

## Summary

This task should pick up after the completed local `09-alice-bio-referenced-woven` -> `10-alice-bio-updated` `payload.update` slice.

The next carried slice should be the next local payload-oriented `weave` implementation, targeting the settled Alice Bio transition from `10-alice-bio-updated` to `11-alice-bio-v2-woven`.

The target behavior is deliberately narrow:

- version the updated `alice/bio` payload artifact into `alice/bio/_history001/_s0002/...`
- advance `alice/bio/_knop/_inventory` from `_s0001` to `_s0002`
- keep `alice-bio.ttl` as the current working payload file while making it byte-identical to the new `_s0002` payload snapshot
- keep `_mesh/_inventory/inventory.ttl`, `alice/_knop/_inventory/inventory.ttl`, `alice/_knop/_references/references.ttl`, and `alice/bio/_knop/_meta/meta.ttl` unchanged
- regenerate the affected current and history-facing ResourcePages, including `alice/index.html`, `alice/bio/index.html`, `alice/bio/_history001/...`, and `alice/bio/_knop/_inventory/...`
- keep `_mesh/_inventory` unchanged even though multiple HTML pages are regenerated

This task should prove the first real "next payload state" `version + validate + generate` path for an already managed payload artifact without absorbing `12-bob-extracted`, generic RDF cleanup, or a final linked-page system.

## Discussion

### Why this is the next slice

The settled fixture ladder still makes the next carried sequence clear:

- semantic change
- weave

After `10-alice-bio-updated`, the next missing implementation-bearing step is weaving that updated payload into the second explicit `alice/bio` historical state.

Jumping ahead would leave a real gap:

- `payload.update` would exist as a current-surface mutation
- but the next-state payload history, advanced payload KnopInventory state, and regenerated linked HTML surface would still be unimplemented

### Why this slice should stay narrow

The settled `11` fixture is specific enough to carry a real slice without reopening the full later roadmap.

For `11-alice-bio-v2-woven`, the current expected behavior is:

- `alice/bio/_history001/_s0002/...` appears as the next payload snapshot
- `alice/bio/_knop/_inventory/inventory.ttl` advances to `_s0002`
- `alice-bio.ttl` remains the current working file and matches the latest snapshot exactly after weave
- `_mesh/_inventory/inventory.ttl` stays unchanged because the second payload state does not widen the public current-surface membership
- multiple current and historical HTML pages are regenerated because the settled `11` fixture expects those ResourcePages to exist at the updated paths

That is enough to prove:

- the first carried second-state weave for a payload artifact with existing history
- the rule that payload history advancement can leave `_mesh/_inventory` unchanged
- the first carried page-regeneration path where unchanged Turtle resources still require updated or newly materialized ResourcePages

### Page-regeneration posture

This slice is the first carried implementation where the generated page surface broadens beyond the immediately versioned Turtle files.

The settled `11` manifest expects updates not only to `alice/bio` current and history pages, but also to existing history landing pages such as:

- `_mesh/_meta/_history001/index.html`
- `_mesh/_inventory/_history001/index.html`
- `alice/_knop/_meta/_history001/index.html`
- `alice/_knop/_inventory/_history001/index.html`
- `alice/_knop/_references/_history001/index.html`

That means this task should explicitly treat page generation as creation or regeneration of the required ResourcePage files, not as a prompt to invest in richer page wording or browsing behavior.

At the same time, the slice should stay fixture-first:

- prove the current and historical ResourcePage files required by `11`
- keep the content ambition low; for now the important thing is that the required pages exist at the expected locations
- do not pretend that later Bob extraction or a complete browsing UX is already solved

### Existing spec posture

This task should reuse [[wd.spec.2026-04-03-weave-behavior]] rather than creating another broad `weave` spec note immediately.

If the carried `11` slice exposes a missing or ambiguous page-regeneration or payload-history rule not already captured there, update the existing weave behavior note rather than spawning overlapping prose.

### Validation posture

The local runtime validation floor should remain narrow for this slice.

The carried implementation should keep the current posture:

- changed RDF parses cleanly
- planned historical-state relationships remain internally coherent
- generated outputs stay consistent with the current carried fixture target

Broader merged-graph or SHACL validation is still a later concern.

## Resolved Issues

- The existing `weave` request shape should stay narrow for this slice; weaving `alice/bio` into `_s0002` still fits the current top-level target-designator model.
- The existing shared runtime page-rendering seam should be extended rather than replaced; `11` is the next carried ResourcePage-materialization step, not a reason to fork a second renderer family.
- `_mesh/_inventory` should remain unchanged for this slice because the second payload state changes the current content and linked view of `alice/bio`, not the public membership of the mesh surface.

## Decisions

- Treat `10-alice-bio-updated` -> `11-alice-bio-v2-woven` as the next carried implementation slice.
- Reuse [[wd.spec.2026-04-03-weave-behavior]] as the current behavior spec for this slice.
- Keep the next `weave` implementation local or in-process over shared `core` and `runtime`.
- Keep bare top-level `weave` as the local CLI surface for this slice rather than introducing a new `weave weave` spelling.
- Use the settled Alice Bio `11-alice-bio-v2-woven` manifest and fixture as the first acceptance target.
- Version `alice/bio` into `_history001/_s0002` and keep the working `alice-bio.ttl` file byte-identical to that latest historical snapshot after weave.
- Advance `alice/bio/_knop/_inventory` to `_s0002` while keeping `_mesh/_inventory/inventory.ttl` unchanged.
- Regenerate the affected current and historical ResourcePages through the existing shared runtime page-rendering seam.
- Keep the current `11` page output fixture-first and minimal; for now prioritize presence at the expected paths over richer page content, and defer Bob extraction, broader cross-resource navigation ambitions, and richer browsing UX to later slices.
- Keep current local `weave` runtime validation at generated-RDF parse validation plus internal state consistency for this slice.
- Do not absorb `12-bob-extracted`, daemon work, or the broader RDF cleanup task into this note.

## Contract Changes

- No public `weave` contract change should be required for this slice; the existing thin request/result shape should still fit the second payload-state weave case.
- This task should not attempt to finalize the full `weave` contract for later extraction behavior, broad graph validation, or every future page-linking rule.

## Testing

- Follow [[wd.testing]].
- Add failing unit tests for the next narrow weave planning or page-generation logic where practical.
- Start with failing integration and black-box CLI tests against the settled `11-alice-bio-v2-woven` fixture target.
- Add integration tests for local filesystem results against the settled `11-alice-bio-v2-woven` fixture target, with strong checks that `_mesh/_inventory/inventory.ttl` remains unchanged while `alice/bio` history and payload KnopInventory advance.
- Add coverage that the current and historical `alice/bio` ResourcePages required by the `11` manifest are materialized, including the new `_s0002` pages.
- Add a black-box CLI acceptance test scoped by the settled `11-alice-bio-v2-woven` Accord manifest.
- Keep the comparison black-box and fixture-oriented rather than coupling tests to internal helper structure.

## Non-Goals

- implementing `12-bob-extracted`
- widening `_mesh/_inventory` for this second payload-state weave
- extracting `bob` into a managed Knop or splitting payload bytes
- introducing a broad or final HTML renderer system
- addressing the broader RDF-parsing cleanup task in this slice
- implementing daemon endpoints

## Implementation Plan

- [x] Confirm that [[wd.spec.2026-04-03-weave-behavior]] is sufficient as the current behavior spec for the `11` slice.
- [x] Add failing unit and integration tests for the `11` second-payload-state weave behavior and the required page regeneration.
- [x] Extend the current `weave` planning and classification seams to support the next historical state for an already woven payload artifact.
- [x] Implement `alice/bio/_history001/_s0002/...` creation and keep `alice-bio.ttl` byte-identical to the latest historical snapshot after weave.
- [x] Implement `alice/bio/_knop/_inventory` advancement to `_s0002` while keeping `_mesh/_inventory/inventory.ttl` unchanged.
- [x] Extend the shared runtime page-rendering seam enough to materialize the new `_s0002` ResourcePages required by the settled `11` fixture.
- [x] Add a black-box CLI acceptance test scoped by the settled `11-alice-bio-v2-woven` Accord manifest.
- [x] Update relevant overview/spec/framework notes as the slice settles.

## Outcome

The carried `10-alice-bio-updated` -> `11-alice-bio-v2-woven` slice is now implemented locally.

- shared `core` now recognizes and plans a narrow second payload-state `weave` slice for an already woven payload artifact whose working payload bytes have diverged from the latest historical snapshot
- local `runtime` now discovers that second payload-state weave candidate by comparing the current working payload file with the latest historical snapshot rather than treating any already-versioned payload as immediately settled
- the carried implementation creates `alice/bio/_history001/_s0002/alice-bio-ttl/alice-bio.ttl`, advances `alice/bio/_knop/_inventory` to `_s0002`, and keeps `_mesh/_inventory/inventory.ttl` unchanged
- the current local page-materialization boundary stays narrow for this slice: the new `_s0002` ResourcePages are created at the expected paths, while black-box CLI coverage intentionally treats current HTML content as lower priority than page-path presence
- focused unit, integration, and manifest-scoped black-box CLI coverage now lock the carried `11` slice against the settled Alice Bio fixture
