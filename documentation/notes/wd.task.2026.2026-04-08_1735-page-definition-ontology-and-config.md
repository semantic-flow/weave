---
id: p6m3x8r2v1k7z4c9q5b2n6d
title: 2026 04 08_1735 Page Definition Ontology And Config
desc: ''
created: 1775715975066
---

## Goals

- Define the ontology and config vocabulary needed for customizable identifier pages before runtime implementation broadens.
- Carry forward the strongest ideas from the earlier template/config work without reintroducing its brittle pieces.
- Introduce a bundle-level metadata resource for `_knop/_page/_assets` without turning KnopInventory into a manifest of every bundled file.
- Clarify which concepts belong in core ontology, which belong in config ontology, and which should remain implementation-only.

## Summary

The page-definition work now has enough architectural pressure that ontology/config modeling should move ahead of runtime implementation.

We need current vocabulary for things like:

- `ResourcePageDefinition`
- page regions or slots
- `resourcePageSource`
- per-source requested state
- per-source mode and fallback policy
- page-local asset bundle metadata for `_knop/_page/_assets`
- template/chrome preferences that are adjacent to, but distinct from, page-content composition

Without that vocabulary, runtime work will end up inventing semantics ad hoc in TypeScript and then freezing them accidentally.

## Discussion

This is a real modeling task, not just implementation cleanup.

The older config/template work still contains useful pressure:

- template/style references should be first-class resources, not only raw URL literals
- content composition and template/chrome policy are related but should not collapse into one mechanism
- generated page systems get brittle if matching and override semantics are implicit

But we should not copy the older model directly:

- regex-heavy target matching is too brittle
- monolithic mapping-set objects have weak merge algebra
- path literals with unclear base semantics are a trap

The `_knop/_page/_assets` question is a good example of why ontology work matters first. We probably do want some metadata about the local asset bundle, but that does not mean:

- every asset file should become a first-class governed artifact
- every asset file should be listed in KnopInventory
- `_assets` should gain history/version semantics by default

So the ontology/config model likely needs a bounded concept such as:

- `PageAssetBundle`
- or `ResourcePageAssetFolder`
- or, if kept generic, `AssetFolder`

The generic name is slightly risky because it can imply a broader filesystem artifact model than we may actually want. A page-scoped name is probably safer unless a wider asset-bundle concept is already clearly emerging elsewhere.

The split I would currently aim for is:

- core ontology:
  - page-definition and source concepts that affect mesh/resource semantics
  - artifact/history/state/distribution reuse
- config ontology:
  - template/chrome preferences
  - optional page-rendering preferences
  - maybe mesh-level or inheritable defaults
- implementation:
  - concrete renderer behavior
  - file-layout conventions that do not need ontology-level commitment

## Open Issues

- Which page-definition concepts belong in core ontology versus config ontology.
- Final naming for the asset-bundle resource.
- Whether page regions should themselves be first-class resources or blank-node-like structural descriptions in the first pass.
- How much template/chrome policy should be formalized in this slice versus deferred.
- Whether page-source mode/fallback vocabulary should live in core ontology or config ontology.

## Decisions

- Ontology/config modeling should precede broad runtime implementation for `_knop/_page`.
- The asset-bundle concept should be modeled, but bounded tightly enough that it does not imply recursive inventory capture.
- Older template/config ideas should be reused selectively, not transplanted wholesale.
- Content composition and template/chrome policy should remain distinct layers even if both are expressed in RDF.
- KnopInventory should remain about governed artifact surfaces, not every local support file under `_knop`.

## Contract Changes

- Introduce vocabulary for page-definition resources and page sources.
- Introduce vocabulary for per-source state, mode, and fallback policy.
- Introduce a bundle-level metadata resource for `_knop/_page/_assets`.
- Clarify the config vocabulary surface for template/chrome preferences and defaults.

## Testing

- Write or update behavior notes before implementation locks in semantics accidentally.
- Add ontology/config examples that demonstrate:
  - local bundle files
  - in-mesh source artifacts
  - external source references
  - bundle-level `_assets` metadata without per-file inventory capture
- Later runtime tests should use those modeled examples rather than inventing new shapes ad hoc.

## Non-Goals

- Implementing the runtime page-definition feature in this task.
- Designing a full generic component framework for pages.
- Making every local asset file into a governed mesh artifact.
- Solving all future theming, inheritance, or publication profiles in one pass.

## Implementation Plan

- [ ] Review the old template/config ontology and conversation notes for reusable ideas and traps.
- [ ] Decide which page-definition concepts belong in core ontology and which in config ontology.
- [ ] Draft the first-pass vocabulary for page definitions, regions, sources, and source policy.
- [ ] Draft the first-pass asset-bundle metadata concept for `_knop/_page/_assets`.
- [ ] Record example RDF shapes that the runtime page-definition task can later implement.
- [ ] Update related roadmap/task/spec notes once the vocabulary direction is settled.
