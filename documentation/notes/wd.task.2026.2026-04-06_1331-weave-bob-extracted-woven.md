---
id: 7g06mwqnhzrxnjf8mvvc3fl4
title: 2026 04 06 1331 Weave Bob Extracted Woven
desc: ''
updated: 1775507494416
created: 1775507494416
---

## Goals

- Carry the next real local `weave` slice after [[wd.task.2026.2026-04-05_1004-extract-bob]].
- Implement the first local or in-process `weave` path for an extracted resource that already has a non-woven Knop-managed current surface.
- Reuse the same spec, test, and acceptance pattern already used for the earlier carried `weave` slices.
- Keep this `weave` implementation narrow enough to prove Bob support-artifact history creation and Bob-facing ResourcePage materialization without absorbing payload splitting, a broader renderer redesign, or a generic extracted-resource framework.

## Summary

This task should pick up after the completed local `11-alice-bio-v2-woven` -> `12-bob-extracted` `extract` slice.

The next carried slice should be the next local `weave` implementation, targeting the settled Alice Bio transition from `12-bob-extracted` to `13-bob-extracted-woven`.

The target behavior is deliberately narrow:

- version `bob/_knop/_meta` into `bob/_knop/_meta/_history001/_s0001/...`
- version `bob/_knop/_inventory` into `bob/_knop/_inventory/_history001/_s0001/...`
- version `bob/_knop/_references` into `bob/_knop/_references/_history001/_s0001/...`
- advance `_mesh/_inventory` from `_s0003` to `_s0004`
- keep `bob/_knop/_meta/meta.ttl`, `bob/_knop/_references/references.ttl`, and their new `_s0001` historical snapshots byte-identical
- update `bob/_knop/_inventory/inventory.ttl` into its woven current form and keep it byte-identical to the new `_s0001` inventory snapshot after weave
- generate the required Bob-facing current and history-facing ResourcePages, including `bob/index.html`, `bob/_knop/index.html`, `bob/_knop/_meta/...`, `bob/_knop/_inventory/...`, and `bob/_knop/_references/...`
- regenerate `_mesh/_inventory/_history001/index.html` and create the new `_s0004` mesh inventory pages
- update `alice/index.html` so the current `foaf:knows` value links to Bob as a live mesh resource rather than describing Bob as not yet extracted
- keep `alice-bio.ttl` unchanged

This task should prove the first real `version + validate + generate` path for an extracted referenced resource without absorbing post-`13` browsing ambitions, payload-byte splitting, or broad HTML redesign work.

## Discussion

### Why this is the next slice

The settled fixture ladder still makes the next carried sequence clear:

- semantic change
- weave

After `12-bob-extracted`, the next missing implementation-bearing step is weaving the newly extracted Bob support surface into explicit histories and generated pages.

Jumping ahead would leave a real gap:

- `extract` would exist as a current-surface semantic mutation
- but Bob would still have no histories, no Bob-facing pages, and no woven mesh inventory state that exposes Bob's public current surface

### Why this slice should stay narrow

The settled `13` fixture is a meaningful but bounded weave step.

For `13-bob-extracted-woven`, the current expected behavior is:

- Bob support-artifact histories appear for `_meta`, `_inventory`, and `_references`
- `_mesh/_inventory` advances because Bob's public current pages now become part of the woven current mesh surface
- Bob current and historical ResourcePages appear at the expected paths
- `alice/index.html` changes because one current page that already existed now links to Bob's live page surface
- `alice-bio.ttl` stays unchanged because this step is still weave, not semantic extraction or payload rewriting

That is enough to prove:

- the first carried weave over an extracted resource
- the rule that mesh inventory should advance when a newly public current page surface appears
- the first carried page-generation case where one existing non-Bob current page also changes because the public link target becomes live

### Mesh inventory advancement posture

This slice should treat `_mesh/_inventory` advancement as part of the carried `13` behavior, not as optional cleanup.

The distinction from `12` matters:

- `12-bob-extracted` registered Bob's Knop as a current mesh member without creating Bob pages
- `13-bob-extracted-woven` is the step where Bob's current public pages and the corresponding woven mesh inventory state are actually materialized

That means `_mesh/_inventory/_history001` should advance from `_s0003` to `_s0004` in this slice.

### Page-generation posture

This slice should stay fixture-first and minimal.

The settled `13` manifest expects:

- Bob current pages
- Bob support-artifact landing pages
- Bob support-artifact history landing pages
- Bob `_s0001` state pages
- Bob manifestation pages
- updated mesh inventory history landing pages
- a changed `alice/index.html`

That is enough to justify extending the existing shared runtime page-rendering seam, but not enough to justify a broad renderer rewrite or richer browsing model.

### Existing spec posture

This task should reuse [[wd.spec.2026-04-03-weave-behavior]] rather than creating another broad `weave` spec note immediately.

If the carried `13` slice exposes a real missing or ambiguous weave rule, update the existing weave behavior note rather than creating overlapping prose.

### Validation posture

The local runtime validation floor should remain narrow for this slice.

The carried implementation should keep the current posture:

- changed RDF parses cleanly
- planned historical-state relationships remain internally coherent
- generated outputs stay consistent with the current carried fixture target

Broader merged-graph or SHACL validation is still a later concern.

### Acceptance-boundary posture

The `13` fixture repo also changes `README.md`, but that remains fixture-ladder narration rather than semantic operation output.

The black-box CLI acceptance for this slice should stay manifest-scoped and file-expectation-driven rather than treating unrelated fixture-documentation churn as part of `weave` behavior.

## Resolved Issues

- The existing `weave` request shape should stay narrow for this slice; targeting `bob` still fits the current top-level designator-path model.
- The existing shared runtime page-rendering seam should be extended rather than replaced; `13` is the next carried ResourcePage-materialization step, not a reason to fork a second renderer family.
- `_mesh/_inventory` should advance in this slice because Bob's public current pages become part of the woven current mesh surface here, not in `12`.
- The `alice/index.html` change should be treated as part of the carried `13` behavior because an existing current page now gains a live Bob link once Bob's public page exists.

## Decisions

- Treat `12-bob-extracted` -> `13-bob-extracted-woven` as the next carried implementation slice.
- Reuse [[wd.spec.2026-04-03-weave-behavior]] as the current behavior spec for this slice.
- Keep the next `weave` implementation local or in-process over shared `core` and `runtime`.
- Keep bare top-level `weave` as the local CLI surface for this slice rather than introducing a new `weave weave` spelling.
- Use the settled Alice Bio `13-bob-extracted-woven` manifest and fixture as the first acceptance target.
- Version Bob `_meta`, `_inventory`, and `_references`, create the corresponding `_s0001` historical snapshots, and keep the current Bob Turtle working files aligned with those snapshots after weave.
- Advance `_mesh/_inventory` to `_s0004` and materialize the corresponding current and historical page surface.
- Regenerate the affected Bob-facing and mesh-facing ResourcePages through the existing shared runtime page-rendering seam.
- Keep the current `13` page output fixture-first and minimal; for now prioritize presence and settled text at the expected paths over richer navigation or broader browsing UX.
- Keep current local `weave` runtime validation at generated-RDF parse validation plus internal state consistency for this slice.
- Do not absorb post-`13` browsing ambitions, payload splitting, daemon work, or the broader RDF cleanup task into this note.

## Contract Changes

- No public `weave` contract change should be required for this slice; the existing thin request/result shape should still fit the Bob weave case.
- This task should not attempt to finalize the full `weave` contract for later extracted-resource rendering, broader graph validation, or every future page-linking rule.

## Testing

- Follow [[wd.testing]].
- Add failing unit tests for the next narrow weave planning or page-generation seam where practical.
- Start with failing integration and black-box CLI tests against the settled `13-bob-extracted-woven` fixture target.
- Add integration tests for local filesystem results against the settled `13-bob-extracted-woven` fixture target, with strong checks that Bob support-artifact histories and Bob page paths are materialized while `alice-bio.ttl` remains unchanged.
- Add coverage that `_mesh/_inventory` advances to `_s0004` and that the required mesh-inventory `_s0004` pages are created.
- Add coverage that `alice/index.html` changes in the expected carried way once Bob's current page is live.
- Add a black-box CLI acceptance test scoped by the settled `13-bob-extracted-woven` Accord manifest.
- Keep the comparison black-box and fixture-oriented rather than coupling tests to internal helper structure.

## Non-Goals

- implementing later post-`13` Bob browsing or richer cross-page navigation
- changing the semantic result of `12-bob-extracted`
- splitting `bob` into a separate payload artifact
- changing `alice-bio.ttl`
- introducing a broad or final HTML renderer system
- implementing daemon endpoints
- treating unrelated fixture `README.md` churn as part of operation output

## Implementation Plan

- [ ] Confirm that [[wd.spec.2026-04-03-weave-behavior]] is sufficient as the current behavior spec for the `13` slice.
- [ ] Add failing unit and integration tests for the Bob woven-history and page-materialization behavior required by `13`.
- [ ] Extend the current `weave` planning and classification seams to recognize the first weave over an extracted Knop support surface.
- [ ] Implement Bob `_meta`, `_inventory`, and `_references` `_history001/_s0001/...` creation and keep the current Bob Turtle working files aligned with those snapshots after weave.
- [ ] Implement `_mesh/_inventory` advancement to `_s0004` and materialize the corresponding `_s0004` mesh inventory pages.
- [ ] Extend the shared runtime page-rendering seam enough to materialize the Bob-facing current and history pages required by the settled `13` fixture, including the carried `alice/index.html` change.
- [ ] Add a black-box CLI acceptance test scoped by the settled `13-bob-extracted-woven` Accord manifest.
- [ ] Update relevant overview/spec/framework notes as the slice settles.
