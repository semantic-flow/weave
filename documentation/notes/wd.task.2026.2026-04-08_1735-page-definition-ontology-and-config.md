---
id: p6m3x8r2v1k7z4c9q5b2n6d
title: 2026 04 08_1735 Page Definition Ontology And Config
desc: ''
created: 1775715975066
---

## Goals

- Define the ontology and config vocabulary needed for customizable identifier pages before runtime implementation broadens.
- Carry forward the strongest ideas from the earlier template/config work without reintroducing its brittle pieces.
- Introduce a bounded helper resource for `_knop/_assets` without turning KnopInventory into a manifest of every supporting file.
- Clarify how outside-the-tree or extra-mesh content enters page composition through an explicit import boundary rather than as a direct live current page source.
- Clarify which concepts belong in core ontology, which belong in config ontology, and which should remain implementation-only.

## Summary

The page-definition work now has enough architectural pressure that ontology/config modeling should move ahead of runtime implementation.

We need current vocabulary for things like:

- `ResourcePageDefinition`
- page regions or slots
- `resourcePageSource`
- per-source requested state
- per-source mode and fallback policy
- page-local asset helper metadata for `_knop/_assets`
- template/chrome preferences that are adjacent to, but distinct from, page-content composition

Without that vocabulary, runtime work will end up inventing semantics ad hoc in TypeScript and then freezing them accidentally.

## Discussion

This is a real modeling task, not just implementation cleanup.

The older config/template work still contains useful pressure:

- template/style references should be first-class resources, not only raw URL literals
- content composition and template/chrome policy are related but should not collapse into one mechanism
- generated page systems get brittle if matching and override semantics are implicit

But we should not copy the older model directly:

- regex-heavy target matching is too brittle for the first pass
- monolithic mapping-set objects have weak merge algebra
- path literals with implicit or serialization-dependent base semantics are a trap

### Proposed keep/defer/reject list from `dependencies/github.com/semantic-flow/ontology/old/sflo-config-ontology.jsonld`

#### Keep

- The generic config substrate is still worth preserving in some form: `Config`, `ConfigArtifact`, `hasConfig`, and `configFor`.
- `hasEffectiveConfig` is still a useful concept for runtime/debug views as long as it stays explicitly non-authoritative.
- The old insistence that templates and stylesheets be first-class artifacts, not raw URL strings, is still the right pressure.
- The old `InnerTemplate`, `OuterTemplate`, and `Stylesheet` concepts should probably survive in renamed page-scoped form such as `InnerResourcePageTemplate`, `OuterResourcePageTemplate`, and maybe `ResourcePageStylesheet`.

#### Defer

- Specialized attachment properties such as `hasMeshConfig`, `hasKnopConfig`, and `hasAbstractArtifactConfig` are plausible, but they are broader than the immediate `_knop/_page` slice and do not need to be settled before first-pass page-definition modeling lands.
- Broad runtime booleans such as `generateResourcePages` and `createHistoricalStatesOnWeave` belong to the wider config story more than to the immediate `_knop/_page` vocabulary, so they should not drive the first pass here.
- Any bulk template-assignment mechanism should be deferred until real pressure appears. If that pressure does show up later, the next thing to try should be constrained selectors such as target class, source-interpretation profile, or designator-path prefix before jumping straight to full regex.
- Relative path literals are acceptable when the model makes their base explicit. In the current direction that means `targetMeshPath` on `ArtifactResolutionTarget`, not helper pseudo-files with ambiguous runtime anchoring.

#### Reject

- `TemplateMappingSet` and `TemplateMapping` should not be transplanted into the first-pass page-definition/config model.
- `mappingPriority` and the implied conflict-resolution algebra should not come along either.
- `mappingTargetClassRegex` and `mappingTargetSlugRegex` should not be transplanted into the first-pass page-definition/config model, even if some constrained selector or regex mechanism is revisited later.
- A config shape that decides page presentation primarily by pattern-matching over filenames, slugs, or path strings is the wrong first boundary for `_knop/_page`.
- A template/config model that makes template selection responsible for navigation, breadcrumb, or other information-architecture logic should remain rejected; runtime should compute those structures and templates should render them.

The `_knop/_assets` question is a good example of why ontology work matters first. We probably do want some metadata about the local asset area, but that does not mean:

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

The outside-source boundary should stay sharp here too. If content originates outside the tree or outside the mesh, the page model should describe how it was imported into a governed in-tree artifact; it should not make the outside origin the direct live page source that "current" rendering follows.

## First-Pass Recommendation

The first pass should treat the `_knop/_page` manifest as a knop-owned support artifact in core ontology, while regions, sources, and the `_knop` / `_knop/_assets` helper boundaries remain bounded helper resources described by that artifact rather than separate governed artifacts.

### Core ontology

- `ResourcePageDefinition`
  - artifact-level support resource for the `_knop/_page` manifest
  - should subclass `DigitalArtifact`, `RdfDocument`, and `SemanticFlowResource`
- `ArtifactResolutionTarget`
  - generic policy-bearing relator for resolving bytes from either a `DigitalArtifact`, a direct mesh-local path string, a direct access URL, a direct `LocatedFile`, or another packaged target
  - should carry requested history/state plus mode/fallback policy
- `workingFilePath`
  - operational local-path hook on `DigitalArtifact` for current working bytes
  - should stay distinct from `hasWorkingLocatedFile`, which remains the semantic `LocatedFile` facet relation when one exists
  - should allow `../` segments only subject to host/runtime operational configuration
- `workingAccessUrl`
  - operational remote/external current-byte hook on `DigitalArtifact`
  - should stay distinct from both `workingFilePath` and `hasWorkingLocatedFile`
  - should not by itself imply that any runtime may fetch it without explicit operational policy
- `ResourcePageRegion`
  - structural content region for authored page composition
  - use `Region`, not `Slot`, because template slots belong in presentation config rather than in the content model
- `ResourcePageSource`
  - page-specific subclass of `ArtifactResolutionTarget` used for per-region source binding
  - keeps page-composition queries and future page-specific constraints readable even though the resolution pattern is generic
- `KnopAssetBundle`
  - bounded local helper boundary for `_knop/_assets`
  - should not imply that every file under `_assets` becomes a governed artifact or a `KnopInventory` entry

Recommended core properties:

- `hasResourcePageDefinition`
- `hasKnopAssetBundle`
- `hasPageRegion`
- `regionKey`
- `regionOrder`
- `hasResourcePageSource`
- `sourceOrder`
- `targetMeshPath`
- `targetAccessUrl`
- `workingFilePath`
- `workingAccessUrl`
- `hasTargetArtifact`
- `hasTargetLocatedFile`
- `hasTargetDistribution`
- `hasRequestedTargetHistory`
- `hasRequestedTargetState`
- `hasArtifactResolutionMode`
- `hasArtifactResolutionFallbackPolicy`

Recommended controlled vocabularies:

- `ArtifactResolutionMode/Pinned`
- `ArtifactResolutionMode/Current`
- `ArtifactResolutionFallbackPolicy/ExactOnly`
- `ArtifactResolutionFallbackPolicy/AcceptLatestInRequestedHistory`

Naming pushback:

- Do not introduce page-specific alias properties such as `hasRequestedSourceState` when the generic `ArtifactResolutionTarget` properties already say the right thing.
- Do not put `accept` into the mode enum alongside `exact` and `current`. `accept` belongs to fallback policy, not to the separate question of whether the source is pinned versus current-following.
- Do not make an artifact target mandatory when `targetMeshPath` or a direct `LocatedFile` is sufficient. `ArtifactResolutionTarget` should support either shape.
- Do not make an artifact target mandatory when `targetMeshPath`, `targetAccessUrl`, or a direct `LocatedFile` is sufficient. `ArtifactResolutionTarget` should support either shape.
- Do not collapse `ResourcePageSource` away into a fully generic relator. The page-specific subtype is still useful even though the resolution pattern is shared.
- Do not rename `ResourcePageSource` just to echo its superclass. The region-to-source relation is already clear, and the class's target semantics come from `ArtifactResolutionTarget`.
- Do not use a generic name such as `AssetFolder`. `KnopAssetBundle` is explicit about scope and avoids implying a general filesystem-artifact ontology.
- Do not revive page-bundle helper classes just to avoid relative path literals. `targetMeshPath` already gives a cleaner explicit base for mesh-local source resolution.
- Do not collapse `targetAccessUrl` into `hasTargetArtifact` or `hasTargetLocatedFile`. It is the operational remote/external direct-target locator.
- Do not collapse `workingFilePath` into `hasWorkingLocatedFile`. One is an operational local path hook; the other is a semantic `LocatedFile` relation.
- Do not collapse `workingAccessUrl` into `workingFilePath` or `hasWorkingLocatedFile`. It is an operational remote/external locator, not a local path and not a semantic file facet.
- When multiple current-byte locators are present for the same working surface, they should identify the same current bytes and mismatch should fail closed.

### Config ontology

- `ResourcePagePresentationConfig`
  - presentation- and chrome-level preferences attached adjacent to a `ResourcePageDefinition`
- `hasResourcePagePresentationConfig`
- template resources, stylesheet references, and later mesh-level defaults should live here rather than in the core page-composition model
- if the older template lineage is kept, prefer explicit ResourcePage-scoped names such as `InnerResourcePageTemplate` and `OuterResourcePageTemplate`

### Implementation only

- concrete helper file names such as `_knop/_page/page.ttl`
- the fixed serialization convention that maps `KnopAssetBundle` to `_knop/_assets`
- the allowed-directories policy that decides whether `targetMeshPath` or `workingFilePath` may use `../` outside the mesh root
- the network-use policy that decides whether `targetAccessUrl` may be followed at all, and under which origin/scheme constraints
- the network-use policy that decides whether `workingAccessUrl` may be followed at all, and under which origin/scheme constraints
- the concrete host/runtime config vocabulary for that policy; previous `sflo-host` work in `dependencies/github.com/semantic-flow/ontology/old/sflo-host-ontology.jsonld` is relevant precedent, but the active follow-on is now [[wd.task.2026.2026-04-11_1723-operational-config-for-runtime-resolution]]
- runtime-computed breadcrumb, navigation, and search inputs
- template-specific slot wiring and render-context assembly

### Minimal example RDF shape

```turtle
@prefix : <#> .
@prefix sflo: <https://semantic-flow.github.io/ontology/core/> .

<https://example.org/alice/_knop> sflo:hasResourcePageDefinition :pageDefinition ;
  sflo:hasKnopAssetBundle :pageAssets .

:pageDefinition a sflo:ResourcePageDefinition ;
  sflo:hasPageRegion :mainRegion, :sidebarRegion .

:mainRegion a sflo:ResourcePageRegion ;
  sflo:regionKey "main" ;
  sflo:hasResourcePageSource :mainSource .

:mainSource a sflo:ResourcePageSource ;
  sflo:hasTargetArtifact <https://example.org/alice/bio/_knop/payload> ;
  sflo:hasRequestedTargetHistory <https://example.org/alice/bio/_history001> ;
  sflo:hasRequestedTargetState <https://example.org/alice/bio/_history001/_s0003> ;
  sflo:hasArtifactResolutionMode sflo:ArtifactResolutionMode/Pinned ;
  sflo:hasArtifactResolutionFallbackPolicy sflo:ArtifactResolutionFallbackPolicy/AcceptLatestInRequestedHistory .

:sidebarRegion a sflo:ResourcePageRegion ;
  sflo:regionKey "sidebar" ;
  sflo:hasResourcePageSource :sidebarSource .

:sidebarSource a sflo:ResourcePageSource ;
  sflo:targetMeshPath "alice/_knop/sidebar.md" .

:pageAssets a sflo:KnopAssetBundle .
```

## Open Issues

- Whether `ResourcePagePresentationConfig` should live in a page-specific config module or in the broader modernized config ontology from [[ont.task.2026.2026-03-23-config-modernization]].
- Whether later profiles should add a controlled region-role vocabulary beyond the first-pass `regionKey` string.
- Whether `KnopAssetBundle` should remain the right helper abstraction permanently or later generalize into a wider asset-bundle concept.
- How much template/chrome policy should be formalized in this slice versus deferred.
- Whether first-pass import metadata for outside-the-tree content should be limited to explicit distributions only, or may also point at broader external artifact IRIs as import origins.
- Which operational config vocabulary should carry allowed-directory rules for `targetMeshPath` and `workingFilePath`; see [[wd.task.2026.2026-04-11_1723-operational-config-for-runtime-resolution]].
- Which operational config vocabulary should carry remote target-access policy for `targetAccessUrl`; see [[wd.task.2026.2026-04-11_1723-operational-config-for-runtime-resolution]].
- Which operational config vocabulary should carry remote-current-byte policy for `workingAccessUrl`; see [[wd.task.2026.2026-04-11_1723-operational-config-for-runtime-resolution]].

## Decisions

- Ontology/config modeling should precede broad runtime implementation for `_knop/_page`.
- The asset-helper concept should be modeled, but bounded tightly enough that it does not imply recursive inventory capture.
- Older template/config ideas should be reused selectively, not transplanted wholesale.
- Content composition and template/chrome policy should remain distinct layers even if both are expressed in RDF.
- KnopInventory should remain about governed artifact surfaces, not every local support file under `_knop`.
- The first-pass core content model should use `ResourcePageRegion`, not `ResourcePageSlot`.
- `ResourcePageSource` should remain as a page-specific subclass of a generic `ArtifactResolutionTarget`.
- Per-source state selection and fallback should be modeled as separate axes using the generic artifact-resolution pattern directly, without duplicating page-specific alias properties.
- Local mesh/helper sources should be modeled by `targetMeshPath` directly on `ArtifactResolutionTarget`, not by helper pseudo-files.
- `targetAccessUrl` should be added as the operational remote/external direct-target hook on `ArtifactResolutionTarget`.
- `workingFilePath` should be added as the operational local-path hook for a `DigitalArtifact`, distinct from `hasWorkingLocatedFile`.
- `workingAccessUrl` should be added as the operational remote/external current-byte hook for a `DigitalArtifact`, distinct from both `workingFilePath` and `hasWorkingLocatedFile`.
- `hasWorkingLocatedFile` should remain the semantic `LocatedFile` relation; when multiple current-byte locators are present for the same current working surface, they should agree.
- Outside-the-tree or extra-mesh content should enter page composition through an explicit import boundary rather than as a direct live page source.
- The imported in-tree artifact and its current `WorkingLocatedFile` should be the source that page resolution follows.
- `KnopAssetBundle` should be used only for the bounded `_knop/_assets` helper area, not as a signal that every asset file becomes governed.
- Allowed-directory policy for `targetMeshPath` and `workingFilePath` belongs in host/runtime operational config, not in the core ontology.
- Remote-use policy for `targetAccessUrl` also belongs in host/runtime operational config, not in the core ontology.
- Remote-use policy for `workingAccessUrl` also belongs in host/runtime operational config, not in the core ontology.

## Contract Changes

- Introduce vocabulary for page-definition resources, generic artifact-resolution targets, and page-specific sources.
- Introduce vocabulary for per-source history/state, mode, and fallback policy.
- Introduce `targetMeshPath` for mesh-local direct source bindings.
- Introduce `targetAccessUrl` for remote/external direct target bindings.
- Introduce `workingFilePath` for artifact-level operational local current-byte paths.
- Introduce `workingAccessUrl` for artifact-level operational remote/external current-byte URLs.
- Introduce a bounded helper resource for `_knop/_assets`.
- Represent outside-the-tree origin data as import-facing metadata rather than as a direct current-following page-source contract.
- Clarify the config vocabulary surface for template/chrome preferences and defaults.
- Represent local Knop-owned helper files through explicit `targetMeshPath` values so mesh-root-relative semantics stay clear.
- Define consistency and precedence rules between `workingFilePath` and `hasWorkingLocatedFile`.
- Define consistency and precedence rules across `workingFilePath`, `workingAccessUrl`, and `hasWorkingLocatedFile`.
- Defer the exact allowed-directories vocabulary to host/runtime operational config rather than hard-coding it into core ontology.
- Defer the exact remote target-access policy vocabulary to host/runtime operational config rather than hard-coding it into core ontology.
- Defer the exact remote-current-byte policy vocabulary to host/runtime operational config rather than hard-coding it into core ontology.

## Testing

- Write or update behavior notes before implementation locks in semantics accidentally.
- Add ontology/config examples that demonstrate:
  - local Knop-owned helper files
  - in-mesh source artifacts
  - import-oriented external origin references
  - `_knop/_assets` helper metadata without per-file inventory capture
- Later runtime tests should use those modeled examples rather than inventing new shapes ad hoc.

## Non-Goals

- Implementing the runtime page-definition feature in this task.
- Designing a full generic component framework for pages.
- Making every local asset file into a governed mesh artifact.
- Solving all future theming, inheritance, or publication profiles in one pass.

## Implementation Plan

- [x] Review the old template/config ontology and conversation notes for reusable ideas and traps.
- [x] Decide which page-definition concepts belong in core ontology and which in config ontology.
- [x] Draft the first-pass vocabulary for page definitions, regions, sources, and source policy.
- [x] Draft the first-pass asset-helper metadata concept for `_knop/_assets`.
- [x] Record example RDF shapes that the runtime page-definition task can later implement.
- [ ] Update related roadmap/task/spec notes once the vocabulary direction is settled.
