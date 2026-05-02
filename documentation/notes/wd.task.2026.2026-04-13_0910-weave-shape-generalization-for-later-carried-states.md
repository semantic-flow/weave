---
id: 6ux1f4m7n2q9k3r8t5v0p1c
title: 2026 04 13_0910 Weave Shape Generalization For Later Carried States
desc: ''
created: 1776096600000
---

## Goals

- Record the remaining shape-specific `core/weave` assumptions that are likely to fail as the carried fixture ladder grows beyond the original early `mesh-alice-bio` slices.
- Separate urgent acceptance blockers from generalization work that can safely wait.
- Capture the reusable progression pattern introduced for later first-payload weaves so future follow-on slices can reuse it instead of accreting new one-off checks.

## Summary

We generalized the first-payload weave slice enough to carry `16-alice-page-main-integrated` to `17-alice-page-main-integrated-woven` in a later mesh state, rather than only supporting the original `06 -> 07` `alice/bio` progression.

We have now also generalized the page-definition weave seam enough to support later `alice/_knop/_page` revisions, so the next Alice artifact-backed page-source pair no longer needs a one-off `secondPageDefinitionWeave` branch in the planner.

That fix exposed a broader pattern in `src/core/weave/weave.ts`: several weave slices still encode one exact carried-state shape instead of deriving inventory/history progression from the current RDF state.

This is real technical debt, but it is not automatically the next runtime priority. The right posture is:

- track it explicitly now
- pull individual generalizations forward only when the next carried acceptance step actually needs them
- avoid broad speculative refactors that are not yet tied to a concrete ladder step

## Discussion

The old first-payload code path assumed the current mesh inventory was always at `_mesh/_inventory/_history001/_s0002` and that the next weave would always create `_s0003`. That assumption was sufficient for the original early carried fixture, but it broke as soon as we introduced a new payload artifact later in the ladder.

The fix for that slice established a more durable pattern:

- parse the current inventory progression from RDF rather than from a hardcoded carried branch number
- distinguish between mesh-wide progression and artifact-local first-weave progression
- preserve the old early fixture ordering when the earlier carried state is still the input
- keep the widening as narrow as possible so existing fixtures do not drift

Other slices still appear to encode the same earlier assumption, although with different concrete state numbers.

The main risk is not just dead helpers; it is planner or renderer logic that still assumes one exact current latest state, one exact next ordinal, or one exact subject-block anchor order.

The first-payload generalization should therefore be treated as the prototype for a later family of small, slice-specific generalizations rather than a signal to immediately refactor the entire weave planner.

## Open Issues

- Whether we want an explicit shared helper for mesh-inventory progression parsing, or whether each slice should keep a small local resolver until multiple slices truly converge.
- Whether KnopInventory progression should get the same treatment as MeshInventory progression now, or only when a concrete later carried slice requires it.
- Whether the extracted-knop slice should be generalized before the artifact-backed page ladder continues, or only when the Bob/import path becomes active again.
- Whether second-payload weave should be generalized proactively, or only if later carried payload revisions stop matching the original `10 -> 11` assumptions.

## Decisions

- The remaining generalization work should be tracked as explicit follow-on technical debt rather than folded silently into unrelated acceptance work.
- Broad planner refactoring is not justified yet; only concrete blocker-driven generalization should move into the critical path.
- The first-payload weave generalization is the model to follow: derive progression from current RDF state, keep widening narrow, and preserve earlier fixture behavior.
- `firstKnopWeave` on a brand-new mesh is intentionally special and does not currently need the same treatment.

## Contract Changes

- No immediate user-facing or carried-fixture contract change is introduced by this task note itself.
- The likely future contract effect is broader support for later carried states of already-supported weave slices, without changing the semantics of the slices themselves.

## Testing

- Add or update focused unit coverage whenever one of the remaining shape-specific slices is generalized.
- Prefer tests that mirror a real later carried fixture state rather than synthetic shapes with no planned acceptance use.
- When a slice is generalized because of a carried ladder step, add or update the corresponding Accord manifest expectations at the same time.

## Non-Goals

- Refactoring all of `src/core/weave/weave.ts` into a fully generic history/state engine in one pass.
- Re-sequencing the carried fixture ladder solely to exercise generalization work.
- Reopening the page-definition ontology/config decisions already settled elsewhere.

## Implementation Plan

### Phase 0: Inventory The Known Narrow Seams

- [x] Record that later first-payload weave progression was generalized successfully for the `16 -> 17` `alice/page-main` slice.
- [ ] Keep the remaining hotspots explicit in this note:
  - `assertCurrentMeshInventoryShapeForFirstReferenceCatalogWeave`
  - `planFirstExtractedKnopWeave` plus `renderFirstExtractedKnopWovenMeshInventoryTurtle`
  - `assertCurrentMeshInventoryShapeForSecondPayloadWeave`
  - later first-page-definition shapes that still assume the original early KnopInventory progression rather than deriving it from current RDF
  - later KnopInventory progression assumptions in the first reference-catalog and first page-definition slices

### Phase 1: Generalize Only When The Carried Ladder Demands It

- [x] If `18/19` or later Alice artifact-backed page-source work trips another shape-specific assumption, generalize only that exact seam.
- [ ] If the Bob/import ladder resumes and hits the extracted-knop path, use the first-payload progression approach rather than adding new one-off branch-number assumptions.
- [ ] If later payload revisions hit second-payload weave rigidity, derive mesh progression from current inventory RDF instead of hardcoding `_s0003 -> _s0004`.

### Phase 2: Consolidate Reusable Progression Helpers Only After Repetition Is Real

- [ ] Revisit whether mesh-inventory progression parsing should become a shared helper if at least two or three slices now use the same pattern.
- [ ] Revisit whether KnopInventory progression deserves the same abstraction once later first-reference-catalog or first-page-definition shapes require it.
- [ ] Keep helper extraction subordinate to readability; do not replace one clear slice-specific function with an over-general planner abstraction prematurely.

### Phase 3: Align Acceptance And Documentation When Each Slice Lands

- [x] Update the relevant `wd.task.*` or `wd.spec.*` note when one of the tracked narrow seams is actually generalized.
- [ ] Update any drafted Accord manifest expectations that still encode obsolete state numbers once the corresponding slice becomes real.
- [ ] Keep the roadmap honest about which generalizations are real, which are pending, and which remain speculative.
