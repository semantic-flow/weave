---
id: s7q2k3n4v5b6m8c1x9z4p6r
title: 2026 04 08_1545 Resource Page Definition And Sources
desc: ''
created: 1775715234849
---

## Goals

- Define a knop-owned page-definition bundle under `_knop/_page` so an identifier such as `alice/` can own a customized `alice/index.html` without becoming a payload-bearing artifact itself.
- Define the runtime-facing consequences of the page-definition ontology/config model without trying to invent that vocabulary ad hoc inside implementation code.
- Separate page control metadata from page content so the model can use local bundle files, in-mesh artifacts, and explicit external sources without collapsing them into one RDF blob.
- Attach source selection policy to each page source or region, not only to the page as a whole.
- Keep local `_page/_assets` ahistorical and bundle-oriented while making reusable or versioned assets first-class DigitalArtifacts elsewhere in the mesh.
- Define the first safe resolution boundary for in-mesh and extra-mesh page sources.

## Summary

Current Weave generation can produce `alice/index.html`, but the model has no clean way to say "this identifier page is custom" without turning `alice` into a payload file or hard-coding special behavior in `weave.ts`.

The intended direction is:

- `alice/_knop/_page/` is the local authoritative definition bundle for `alice/index.html`
- a small RDF manifest in `_page/` describes page regions, source bindings, chrome preferences, and resolution policy
- the ontology/config vocabulary for that manifest should be defined before runtime implementation broadens
- substantial authored content usually lives in sibling files under `_page/` or in referenced DigitalArtifacts rather than inside long RDF literals
- each `resourcePageSource` can independently choose a source artifact, an optional requested state, and a mode/fallback policy

That makes `_knop/_page` the control plane while keeping content and versioned source artifacts first-class.

## Discussion

This is not just a template question.

We need to support several distinct things without conflating them:

- identifier-page customization
- local bundle content such as Markdown, HTML fragments, and images
- bundle-level metadata about local assets without pretending every bundled file is a first-class governed artifact
- reuse of independently versioned in-mesh content artifacts
- explicitly allowed external source artifacts
- template/chrome selection

The current design pressure suggests a structure more like:

- `_knop/_page/page.ttl`
- `_knop/_page/intro.md`
- `_knop/_page/sidebar.html`
- `_knop/_page/_assets/...`

where `page.ttl` references those local files or other artifact identifiers.

Each page region may need a different source artifact and therefore a different selection policy. A page-level single "source state" is too coarse if, for example, the main body follows one artifact history while a sidebar points at another current artifact.

The working naming direction should therefore be per-source fields such as:

- `resourcePageSource`
- `resourcePageSourceState`
- `resourcePageSourceMode`
- `resourcePageSourceFallback`

The conversation also surfaced a useful terminology refinement: `accept` is better working language than `prefer`, because the model is really about allowable fallback policy, not ranking arbitrary candidates. Even so, `accept` alone is still underspecified; it needs an explicit fallback boundary such as "same history only" rather than a package-manager-like global solver.

For standards reuse, the likely best move is conceptual reuse rather than searching for one ontology that already solves this exact problem:

- current SFLO artifact/state/history modeling should remain the primary in-mesh vocabulary
- DCAT is relevant for the "where do the bytes come from" side of the model, especially `dcat:Distribution`, `dcat:accessURL`, and `dcat:downloadURL`
- PROV and Dublin Core are relevant for revision and version identity relations, especially `prov:wasRevisionOf`, `dcterms:hasVersion`, and `dcterms:isVersionOf`
- there does not appear to be a clean existing RDF standard for this exact per-source state-selection mode, so a small local vocabulary will probably still be needed

This also points toward a sequencing constraint: ontology/config work should come before the runtime/model implementation. We already have useful historical ideas in the old template/config discussions, but they need to be distilled into a current vocabulary instead of being copied wholesale.

The old config work is still useful in two ways:

- keep the distinction between content composition and template/chrome policy
- keep first-class references to templates/stylesheets or other sources rather than reducing everything to raw URL strings

But we should not revive the older brittle parts uncritically:

- regex-heavy matching as the primary selection mechanism
- monolithic template-mapping sets with weak merge semantics
- a model that makes templates responsible for runtime information architecture

The renderer/template boundary also matters. Templates should stay relatively dumb. Breadcrumbs, nav slices, and any later search index hooks should be computed in runtime code and passed as structured inputs rather than making templates responsible for information architecture.

## Open Issues

- Final class/property names are still open; likely candidates include `ResourcePageDefinition`, `ResourcePageRegion`, and the `resourcePageSource*` family.
- The bundle-metadata resource name is still open; `AssetFolder` is workable but probably too generic, and something like `PageAssetBundle` or `ResourcePageAssetFolder` may better reflect the intended boundary.
- The mode vocabulary is not settled. `exact | accept | current` currently looks better than `prefer`, but `required | accept | current` may prove clearer.
- The fallback vocabulary is not settled. The safest first pass may be same-history-only fallback rather than arbitrary lower/higher or cross-history search.
- The exact manifest shape for local relative bundle files is still open.
- The first-pass external-source policy should probably be narrower than the long-term model.

## Decisions

- `_knop/_page` should be the local authoritative page-definition bundle for a resource page.
- The ontology/config vocabulary for `_knop/_page` should be defined before broad runtime implementation begins.
- `_knop/_page` should not itself become a separate nested knop.
- Each page source or region should carry its own source, requested state, mode, and fallback policy rather than forcing one page-global setting.
- `accept` is better working language than `prefer`, but it still requires explicit fallback semantics.
- `_knop/_page/_assets` should be a local ahistorical bundle area only.
- `_knop/_page/_assets` may still need a bundle-level metadata resource in ontology/config, but that must not imply "inventory every child file".
- If an asset needs independent history, publication, or reuse, it should be modeled as a separate DigitalArtifact and referenced from the page definition.
- In-mesh artifact references should be first-class page sources.
- Extra-mesh sources may be allowed, but only with explicit opt-in policy and fail-closed behavior.
- Template/chrome selection is adjacent to page definition but should remain a separate concern from content composition.
- Runtime code should compute nav/breadcrumb/search structures; templates should render structured inputs rather than own the information architecture logic.

## Contract Changes

- Introduce a knop-owned page-definition bundle at `_knop/_page`.
- Introduce ontology/config vocabulary for the page-definition bundle before the runtime contract broadens.
- Define a manifest artifact in that bundle that can reference:
  - local relative bundle files
  - in-mesh DigitalArtifact identifiers
  - explicit external IRIs
- Define per-source selection fields for state, mode, and fallback policy.
- Define `_knop/_page/_assets` as the relative-path base for local bundled static assets.
- Define a bundle-level resource for `_knop/_page/_assets` metadata without promoting every bundled file into KnopInventory by default.
- Keep `index.html` as generated public output rather than the canonical editable page source.

## Testing

- Write a behavior spec for customizable identifier pages before the implementation broadens.
- Add integration coverage for local bundle sources, in-mesh artifact sources, and fail-closed external-source cases.
- Add coverage proving different page regions can resolve different source artifacts and states independently.
- Add Accord acceptance coverage through new fixture transitions such as `14-alice-page-customized` and `15-alice-page-customized-woven`.
- Add a separate early-root fixture path if root-page customization needs isolated coverage rather than late-ladder coupling.

## Non-Goals

- Turning identifier pages into a generic CMS.
- Making identifiers themselves payload-bearing just to support custom pages.
- Building a full SPA/runtime framework for resource pages.
- Introducing a package-manager-like dependency resolver for page sources.
- Solving all mesh-level theming and inheritable config in the first pass.

## Implementation Plan

- [ ] Coordinate with [[wd.task.2026.2026-04-08_1735-page-definition-ontology-and-config]] so the runtime shape follows an explicit ontology/config model.
- [ ] Draft the minimal `_knop/_page` bundle layout and manifest shape.
- [ ] Decide the first-pass per-source mode and fallback vocabulary.
- [ ] Define the local relative bundle-file semantics for `_knop/_page`.
- [ ] Define the first-pass in-mesh source resolution behavior.
- [ ] Define the first-pass extra-mesh source policy and failure modes.
- [ ] Split page-content composition from template/chrome policy.
- [ ] Add a behavior spec and fixture plan before implementing the runtime/model changes.
