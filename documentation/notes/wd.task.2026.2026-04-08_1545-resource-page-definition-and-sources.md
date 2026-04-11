---
id: s7q2k3n4v5b6m8c1x9z4p6r
title: 2026 04 08_1545 Resource Page Definition And Sources
desc: ''
created: 1775715234849
---

## Goals

- Define a knop-owned page-definition support artifact at `_knop/_page/page.ttl` so an identifier such as `alice/` can own a customized `alice/index.html` without becoming a payload-bearing artifact itself.
- Keep ordinary Markdown as the baseline authored source format for workspace-local page content, while treating Dendron compatibility as an optional interpretation profile rather than the default required mode.
- Define the runtime-facing consequences of the page-definition ontology/config model without trying to invent that vocabulary ad hoc inside implementation code.
- Separate page control metadata from page content so the model can use workspace-local files, in-mesh artifacts, and imported outside content without collapsing them into one RDF blob.
- Attach source selection policy to each page source or region, not only to the page as a whole.
- Keep local `_knop/_assets` ahistorical and support-oriented while making reusable or versioned assets first-class DigitalArtifacts elsewhere in the mesh.
- Define the first safe resolution boundary for in-mesh page sources and import-oriented handling of outside-the-tree or extra-mesh content.

## Summary

Current Weave generation can produce `alice/index.html`, but the model has no clean way to say "this identifier page is custom" without turning `alice` into a payload file or hard-coding special behavior in `weave.ts`.

The intended direction is:

- `alice/_knop/_page/page.ttl` is the local authoritative definition file for `alice/index.html`
- `_page` stays a normal support-artifact surface rather than becoming a little subtree of authored content
- a small RDF manifest in `page.ttl` describes page regions, source bindings, chrome preferences, and resolution policy
- the ontology/config vocabulary for that manifest should be defined before runtime implementation broadens
- substantial authored content usually lives in workspace-local files outside `_page` or in referenced DigitalArtifacts rather than inside long RDF literals
- ordinary Markdown should be the default authored local-content format; richer Dendron conventions should only activate under an explicit source-interpretation profile
- each `resourcePageSource` can independently choose a source artifact, an optional requested state, and a mode/fallback policy
- outside-the-tree or extra-mesh content should enter page generation through an explicit import step, not as a direct live "latest" source

That makes `_knop/_page` the control plane while keeping content and versioned source artifacts first-class, without overloading the support-artifact directory itself.

## Discussion

This is not just a template question.

We need to support several distinct things without conflating them:

- identifier-page customization
- workspace-local support content such as Markdown, HTML fragments, and images
- helper metadata about local support assets without pretending every supporting file is a first-class governed artifact
- reuse of independently versioned in-mesh content artifacts
- explicitly allowed import inputs for content that originates outside the tree or outside the mesh
- template/chrome selection

The current design pressure suggests a structure more like:

- `_knop/_page/page.ttl`
- `_knop/main.md`
- `_knop/sidebar.md`
- `_knop/_assets/...`

where `page.ttl` references those workspace-local files or other artifact identifiers.

The tricky case is outside-the-tree content. Letting an identifier page follow a direct external or host-local "latest" source is the wrong boundary, because the resulting current public state is no longer guaranteed to be locally dereferenceable or reproducible from the mesh alone.

The safer first-pass model is explicit import:

- copy the outside content into the tree
- let that imported copy become the `WorkingLocatedFile` for a governed in-tree artifact
- have the page definition point at that local/imported artifact rather than the outside origin directly

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

## First-Pass Alignment

The current recommendation from [[wd.task.2026.2026-04-08_1735-page-definition-ontology-and-config]] is:

- `_knop/_page/page.ttl` should be modeled as a `ResourcePageDefinition` support artifact attached to the owning `Knop` with `hasResourcePageDefinition`.
- `ResourcePageSource` should remain the page-specific source relator, but it should now specialize a generic `ArtifactResolutionTarget`
- authored content composition should use `ResourcePageRegion` plus `hasResourcePageSource`, not a `Slot` vocabulary in core
- local workspace/helper files should resolve through a direct `LocatedFile` target, typically `WorkspaceRelativeFile` plus `workspaceRelativePath`, not raw path strings directly on a source node
- `_knop/_assets` should be the local asset area; any helper concept for it should be `KnopAssetBundle`, not a nested page-bundle vocabulary
- page-source selection should separate:
  - requested source target or state
  - source mode (`Pinned` vs `Current`)
  - fallback policy (`ExactOnly` vs `AcceptLatestInRequestedHistory`)
- template/chrome policy should move to config vocabulary such as `ResourcePagePresentationConfig`, not into the core content-source model

Minimal shape:

```turtle
@prefix : <#> .
@prefix sflo: <https://semantic-flow.github.io/ontology/core/> .

:aliceKnop sflo:hasResourcePageDefinition :pageDefinition ;
  sflo:hasKnopAssetBundle :pageAssets .

:pageDefinition a sflo:ResourcePageDefinition ;
  sflo:hasPageRegion :mainRegion .

:pageAssets a sflo:KnopAssetBundle .

:mainRegion a sflo:ResourcePageRegion ;
  sflo:regionKey "main" ;
  sflo:hasResourcePageSource :mainSource .

:mainSource a sflo:ResourcePageSource ;
  sflo:hasSourceArtifact <https://example.org/alice/bio/_knop/payload> ;
  sflo:hasRequestedSourceState <https://example.org/alice/bio/_history001/_s0003> ;
  sflo:hasResourcePageSourceMode sflo:ArtifactResolutionMode/Pinned ;
  sflo:hasResourcePageSourceFallbackPolicy sflo:ArtifactResolutionFallbackPolicy/AcceptLatestInRequestedHistory .
```

## Open Issues

- Whether first-pass runtime support should allow multiple ordered sources per region immediately, or start with one source per region and add `sourceOrder` only when composition pressure appears in real examples.
- Whether first-pass import metadata for outside-the-tree content should be limited to explicitly described distributions.
- Whether first-pass fallback should stop at `AcceptLatestInRequestedHistory` or also allow an explicit current-history fallback policy later.
- Whether local workspace-relative helper sources should also carry media-type hints, or whether extension-driven/runtime inference is sufficient initially.

## Decisions

- `_knop/_page` should be the local authoritative page-definition support artifact for a resource page.
- Ordinary Markdown should remain the default authored content format for local workspace page files; Dendron compatibility, if added, should be an optional source-interpretation profile layered on top rather than the default required mode.
- The ontology/config vocabulary for `_knop/_page` should be defined before broad runtime implementation begins.
- `_knop/_page` should not itself become a separate nested knop.
- Each page source or region should carry its own source, requested state, mode, and fallback policy rather than forcing one page-global setting.
- `accept` is better working language than `prefer`, but it still requires explicit fallback semantics.
- `_knop/_assets` should be a local ahistorical support area only.
- `_knop/_assets` may still need a bounded helper resource in ontology/config, but that must not imply "inventory every child file".
- If an asset needs independent history, publication, or reuse, it should be modeled as a separate DigitalArtifact and referenced from the page definition.
- In-mesh artifact references should be first-class page sources.
- Outside-the-tree or extra-mesh content should not be used as a direct live latest-following page source in the first pass.
- If page content originates outside the tree/mesh, it should first be imported into a governed in-tree artifact, and that imported artifact's current `WorkingLocatedFile` should become the page source that generation follows.
- Extra-mesh origins may be allowed, but only as explicit import inputs with fail-closed behavior.
- Template/chrome selection is adjacent to page definition but should remain a separate concern from content composition.
- Runtime code should compute nav/breadcrumb/search structures; templates should render structured inputs rather than own the information architecture logic.
- `ResourcePageRegion` is the better first-pass core term; reserve `slot` language for template/render configuration if it is needed later.
- `hasRequestedSourceState` is clearer than `resourcePageSourceState`.
- `ResourcePageSource` should remain as a page-specific subclass of a generic `ArtifactResolutionTarget`.
- Direct `LocatedFile` targets, especially `WorkspaceRelativeFile`, should be valid source bindings even when there is no artifact-level target to resolve.
- `KnopAssetBundle` is clearer than `AssetFolder` or `PageAssetFolder`, but it should not be read as a requirement that every page support file live under `_knop/_assets`.
- `accept` should describe fallback policy, not replace the separate pinned-vs-current source mode axis.

## Contract Changes

- Introduce a knop-owned page-definition support artifact at `_knop/_page`.
- Introduce ontology/config vocabulary for that page-definition artifact, generic artifact-resolution targets, workspace-relative helper files, and Knop asset boundaries before the runtime contract broadens.
- Define a manifest artifact in that support surface that can reference:
  - local workspace-relative helper files
  - in-mesh DigitalArtifact identifiers
  - imported in-tree artifacts whose current `WorkingLocatedFile` came from an outside-the-tree or extra-mesh origin
- Define per-source selection fields for state, mode, and fallback policy.
- Define an explicit import boundary for outside-the-tree content rather than direct live external-latest page resolution.
- Define `_knop/_assets` as the fixed location for local static assets referenced by page definitions.
- Define any helper resource for local page files and assets so its relative-path semantics are explicit rather than buried in ad hoc string fields.
- Keep `index.html` as generated public output rather than the canonical editable page source.
- Keep `_page` itself limited to the `ResourcePageDefinition` working file and its normal support-artifact histories/pages.

## Testing

- Write a behavior spec for customizable identifier pages before the implementation broadens. See [[wd.spec.2026-04-11-identifier-page-customization-and-root-lifecycle]].
- Stage the first carried `mesh-alice-bio` transitions and Accord manifests early enough to act as acceptance-first targets for the runtime slice, rather than treating fixture work as end-of-task polish.
- Add integration coverage for local Knop-owned file sources, in-mesh artifact sources, import-based outside-the-tree sources, and fail-closed direct external-latest cases.
- Add coverage proving different page regions can resolve different source artifacts and states independently.
- Add Accord acceptance coverage through new fixture transitions such as `14-alice-page-customized` and `15-alice-page-customized-woven`.
- Add root-focused acceptance coverage on the carried fixture ladder; only split it into a separate path later if the shared ladder stops being readable.

## Non-Goals

- Turning identifier pages into a generic CMS.
- Making identifiers themselves payload-bearing just to support custom pages.
- Building a full SPA/runtime framework for resource pages.
- Introducing a package-manager-like dependency resolver for page sources.
- Solving all mesh-level theming and inheritable config in the first pass.

## Implementation Plan

### Phase 0: Lock The Runtime Slice To The Settled Model

- [ ] Treat [[wd.task.2026.2026-04-08_1735-page-definition-ontology-and-config]] and [[wd.spec.2026-04-11-identifier-page-customization-and-root-lifecycle]] as the contract source, so this task implements settled `ResourcePageDefinition` / `ArtifactResolutionTarget` / `ResourcePageSource` behavior rather than reopening ontology decisions in runtime code.
- [x] Add a behavior spec and fixture plan before implementing the runtime/model changes. See [[wd.spec.2026-04-11-identifier-page-customization-and-root-lifecycle]].
- [ ] Keep the first implementation-bearing slice narrower than the whole future model: local workspace-file sources, authority/precedence, fail-closed behavior, and `_knop/_assets` handling should land before broader in-mesh/import source support unless the code shape makes those cheap and coherent to include.

### Phase 1: Acceptance-First Fixture And Manifest Scaffolding

- [ ] Extend `mesh-alice-bio` with the first carried non-root customization transition pair, `14-alice-page-customized` and `15-alice-page-customized-woven`, early enough that they can drive the runtime slice rather than merely validate it afterward.
- [ ] Draft the matching Accord manifests early, including the exact transition boundaries, expected file additions/changes, and any explicit exclusions needed for deterministic comparison.
- [ ] Keep the first carried fixture scope narrow: prove authority/precedence, local workspace-file sources, and `_knop/_assets` handling before broadening into in-mesh or import-oriented source behavior.
- [ ] Use the staged `14/15` fixture pair as the primary acceptance target while implementing the first runtime slice, updating the runtime toward the fixture rather than inventing runtime behavior first and backfilling fixtures later.
- [ ] Leave `16/17` imported-source behavior and `18-21` root continuation in the near-term plan, but do not let them block the first carried local-Knop slice.

#### Proposed Ladder Sketch

`14-alice-page-customized`

- Add `alice/_knop/_page/page.ttl` as the first `ResourcePageDefinition` working file for Alice.
- Add minimal Knop-local support files such as `alice/_knop/main.md`, `alice/_knop/sidebar.md`, and `alice/_knop/_assets/alice.css`.
- Update `alice/_knop/_inventory/inventory.ttl` to register the new page-definition support surface and its current working file.
- Keep the fixture narrow and local-only: both initial page regions should resolve from Knop-local files rather than from in-mesh or imported artifacts.
- Do not weave histories or generate new pages yet; `alice/index.html` should remain the previously generated generic page in this non-woven state.
- Do not advance `_mesh/_inventory`; the page-definition support artifact is Knop-internal and the public current resource map has not widened yet.

`15-alice-page-customized-woven`

- Weave `14` so the `ResourcePageDefinition` behaves like a normal support artifact with its own first history/state materialization.
- Generate Alice page-definition support-artifact pages under `alice/_knop/_page/...` using the ordinary support-artifact page machinery rather than a custom `_page`-specific renderer.
- Update `alice/index.html` so it is now driven by `alice/_knop/_page/page.ttl` and its Knop-local sources instead of the generic identifier-page path.
- Keep referenced support assets at `alice/_knop/_assets/...`; do not introduce a copied `alice/_assets/...` surface.
- Advance `alice/_knop/_inventory` to reflect the new support-artifact current state, but keep `_mesh/_inventory` unchanged unless implementation uncovers a real current-surface-map reason to move it.

`16-alice-page-imported-source`

- Add a governed in-tree artifact whose current `WorkingLocatedFile` is the imported source the page will follow.
- Repoint one Alice page region from a local Knop file to that imported in-tree artifact while leaving the rest of the page-definition structure intact.
- Keep the outside-origin boundary explicit in data and files; do not let the page definition point directly at a live outside location.

`17-alice-page-imported-source-woven`

- Weave `16` so the imported-source-backed page definition is versioned and rendered.
- Prove that `alice/index.html` now follows the imported in-tree artifact's current `WorkingLocatedFile`, not a direct outside-source location.
- Keep direct-live outside-source rejection in focused runtime/integration tests rather than trying to encode that failure case as a successful Accord transition.

`18-root-knop-created`

- Add the root Knop support surface at `_knop` in a later mesh lifecycle step, not as a special early bootstrap-only case.
- Keep root `index.html` generic at this stage; this branch should establish the root support surface before root page customization.

`19-root-knop-created-woven`

- Weave the root Knop creation so root support-artifact histories/pages exist and root `index.html` is present as the generic identifier page.
- Keep `_mesh/index.html` distinct and unchanged in ownership semantics.

`20-root-page-customized`

- Add `_knop/_page/page.ttl` plus minimal root Knop-local support files and `_knop/_assets/...`.
- Update root Knop inventory to register the root `ResourcePageDefinition` support artifact.
- Keep this branch non-woven: `index.html` should still be the previous generic root page until weave runs.

`21-root-page-customized-woven`

- Weave `20` so root `_knop/_page` gets normal support-artifact history/state materialization and support-artifact pages.
- Update root `index.html` to follow root `_knop/_page/page.ttl` and its Knop-local sources.
- Keep root support assets at `_knop/_assets/...` rather than materializing a copied `_assets/...` surface.

#### Draft Accord Shape For `14` And `15`

These are draft manifest sketches, not authoritative manifests yet. They are concrete enough to drive fixture authoring and runtime work, but they still assume:

- the eventual non-woven page-definition authoring operation name is still open, so `14` uses a provisional `operationId`
- the final support-artifact manifestation token for `page.ttl` is likely `page-ttl`, but that should be treated as a draft naming expectation until the fixture lands
- the exact first-pass naming convention for Knop-local authored content files is still draft; this sketch uses `main.md` and `sidebar.md` directly under `_knop`

Proposed `14-alice-page-customized.jsonld` shape:

```json
{
  "@context": {
    "@vocab": "https://spectacular-voyage.github.io/accord/ns#",
    "dcterms": "http://purl.org/dc/terms/",
    "id": "@id",
    "type": "@type",
    "changeType": {
      "@type": "@vocab"
    },
    "compareMode": {
      "@type": "@vocab"
    },
    "targetsFileExpectation": {
      "@type": "@id"
    },
    "ignorePredicate": {
      "@type": "@id"
    }
  },
  "type": "Manifest",
  "id": "urn:accord:semantic-flow:alice-bio:14-alice-page-customized",
  "dcterms:title": "Alice Bio 14 alice page customized",
  "dcterms:description": "Checks the non-woven step that adds Alice's knop-owned _knop/_page definition artifact, keeps the first slice local-Knop-only, updates Alice Knop inventory, and leaves generated public output unchanged until weave.",
  "hasCase": [
    {
      "type": "TransitionCase",
      "id": "#define-alice-page",
      "dcterms:title": "Add Alice page-definition artifact without weaving",
      "dcterms:description": "Adds alice/_knop/_page/page.ttl, Knop-local authored support files, and Knop-local assets under alice/_knop/_assets, updates alice/_knop/_inventory to register the new ResourcePageDefinition support artifact, and leaves alice/index.html unchanged until the next weave.",
      "fixtureRepo": "github.com/semantic-flow/mesh-alice-bio",
      "operationId": "resourcePage.define",
      "fromRef": "13-bob-extracted-woven",
      "toRef": "14-alice-page-customized",
      "targetDesignatorPath": "alice",
      "hasFileExpectation": [
        {
          "id": "#alice-knop-page-definition-ttl",
          "type": "FileExpectation",
          "path": "alice/_knop/_page/page.ttl",
          "changeType": "added",
          "compareMode": "rdfCanonical"
        },
        {
          "id": "#alice-knop-page-main-md",
          "type": "FileExpectation",
          "path": "alice/_knop/main.md",
          "changeType": "added",
          "compareMode": "text"
        },
        {
          "id": "#alice-knop-page-sidebar-md",
          "type": "FileExpectation",
          "path": "alice/_knop/sidebar.md",
          "changeType": "added",
          "compareMode": "text"
        },
        {
          "id": "#alice-knop-page-css",
          "type": "FileExpectation",
          "path": "alice/_knop/_assets/alice.css",
          "changeType": "added",
          "compareMode": "text"
        },
        {
          "id": "#alice-knop-inventory-ttl",
          "type": "FileExpectation",
          "path": "alice/_knop/_inventory/inventory.ttl",
          "changeType": "updated",
          "compareMode": "rdfCanonical"
        },
        {
          "id": "#mesh-inventory-ttl",
          "type": "FileExpectation",
          "path": "_mesh/_inventory/inventory.ttl",
          "changeType": "unchanged",
          "compareMode": "rdfCanonical"
        },
        {
          "id": "#alice-page",
          "type": "FileExpectation",
          "path": "alice/index.html",
          "changeType": "unchanged",
          "compareMode": "text"
        },
        {
          "id": "#alice-public-css",
          "type": "FileExpectation",
          "path": "alice/_assets/alice.css",
          "changeType": "absent"
        },
        {
          "id": "#alice-page-subtree-main-md",
          "type": "FileExpectation",
          "path": "alice/_knop/_page/main.md",
          "changeType": "absent"
        },
        {
          "id": "#alice-page-subtree-css",
          "type": "FileExpectation",
          "path": "alice/_knop/_page/_assets/alice.css",
          "changeType": "absent"
        },
        {
          "id": "#alice-knop-page-definition-page",
          "type": "FileExpectation",
          "path": "alice/_knop/_page/index.html",
          "changeType": "absent"
        }
      ],
      "hasRdfExpectation": [
        {
          "id": "#alice-knop-page-definition-rdf",
          "type": "RdfExpectation",
          "targetsFileExpectation": "#alice-knop-page-definition-ttl",
          "hasAskAssertion": [
            {
              "type": "SparqlAskAssertion",
              "query": "ASK { ?pageDefinition a <https://semantic-flow.github.io/ontology/core/ResourcePageDefinition> ; <https://semantic-flow.github.io/ontology/core/hasPageRegion> ?mainRegion, ?sidebarRegion . ?mainRegion <https://semantic-flow.github.io/ontology/core/regionKey> \"main\" . ?sidebarRegion <https://semantic-flow.github.io/ontology/core/regionKey> \"sidebar\" . }",
              "expectedBoolean": true
            },
            {
              "type": "SparqlAskAssertion",
              "query": "ASK { ?mainSource <https://semantic-flow.github.io/ontology/core/hasSourceLocatedFile> ?mainFile . ?mainFile a <https://semantic-flow.github.io/ontology/core/WorkspaceRelativeFile> ; <https://semantic-flow.github.io/ontology/core/workspaceRelativePath> \"alice/_knop/main.md\" . ?sidebarSource <https://semantic-flow.github.io/ontology/core/hasSourceLocatedFile> ?sidebarFile . ?sidebarFile a <https://semantic-flow.github.io/ontology/core/WorkspaceRelativeFile> ; <https://semantic-flow.github.io/ontology/core/workspaceRelativePath> \"alice/_knop/sidebar.md\" . }",
              "expectedBoolean": true
            },
            {
              "type": "SparqlAskAssertion",
              "query": "ASK { <https://semantic-flow.github.io/mesh-alice-bio/alice/_knop> <https://semantic-flow.github.io/ontology/core/hasKnopAssetBundle> ?assetBundle . ?assetBundle a <https://semantic-flow.github.io/ontology/core/KnopAssetBundle> . }",
              "expectedBoolean": true
            }
          ]
        },
        {
          "id": "#alice-knop-inventory-rdf",
          "type": "RdfExpectation",
          "targetsFileExpectation": "#alice-knop-inventory-ttl",
          "ignorePredicate": [
            "http://purl.org/dc/terms/created",
            "http://purl.org/dc/terms/updated"
          ],
          "hasAskAssertion": [
            {
              "type": "SparqlAskAssertion",
              "query": "ASK { <https://semantic-flow.github.io/mesh-alice-bio/alice/_knop> <https://semantic-flow.github.io/ontology/core/hasResourcePageDefinition> <https://semantic-flow.github.io/mesh-alice-bio/alice/_knop/_page> . <https://semantic-flow.github.io/mesh-alice-bio/alice/_knop/_page> a <https://semantic-flow.github.io/ontology/core/ResourcePageDefinition> ; <https://semantic-flow.github.io/ontology/core/hasWorkingLocatedFile> <https://semantic-flow.github.io/mesh-alice-bio/alice/_knop/_page/page.ttl> . }",
              "expectedBoolean": true
            },
            {
              "type": "SparqlAskAssertion",
              "query": "ASK { <https://semantic-flow.github.io/mesh-alice-bio/alice/_knop> <https://semantic-flow.github.io/ontology/core/hasKnopAssetBundle> ?assetBundle . ?assetBundle a <https://semantic-flow.github.io/ontology/core/KnopAssetBundle> . }",
              "expectedBoolean": true
            }
          ]
        }
      ]
    }
  ]
}
```

Proposed `15-alice-page-customized-woven.jsonld` shape:

```json
{
  "@context": {
    "@vocab": "https://spectacular-voyage.github.io/accord/ns#",
    "dcterms": "http://purl.org/dc/terms/",
    "id": "@id",
    "type": "@type",
    "changeType": {
      "@type": "@vocab"
    },
    "compareMode": {
      "@type": "@vocab"
    },
    "targetsFileExpectation": {
      "@type": "@id"
    },
    "ignorePredicate": {
      "@type": "@id"
    }
  },
  "type": "Manifest",
  "id": "urn:accord:semantic-flow:alice-bio:15-alice-page-customized-woven",
  "dcterms:title": "Alice Bio 15 alice page customized woven",
  "dcterms:description": "Checks the weave over Alice's page-definition support artifact, including first history/state materialization for the ResourcePageDefinition, updated Knop inventory, updated Alice identifier page output, and direct use of Knop-owned _knop/_assets paths without widening mesh inventory.",
  "hasCase": [
    {
      "type": "TransitionCase",
      "id": "#weave-alice-page-definition",
      "dcterms:title": "Weave Alice page-definition support artifact",
      "dcterms:description": "Versions alice/_knop/_page as a normal support artifact, generates Alice's page-definition support-artifact pages, updates alice/index.html to follow page.ttl and its Knop-local sources, keeps alice/_knop/_assets/alice.css in place, and advances alice/_knop/_inventory without advancing _mesh/_inventory.",
      "fixtureRepo": "github.com/semantic-flow/mesh-alice-bio",
      "operationId": "weave",
      "fromRef": "14-alice-page-customized",
      "toRef": "15-alice-page-customized-woven",
      "targetDesignatorPath": "alice",
      "hasFileExpectation": [
        {
          "id": "#alice-knop-page-definition-ttl",
          "type": "FileExpectation",
          "path": "alice/_knop/_page/page.ttl",
          "changeType": "unchanged",
          "compareMode": "rdfCanonical"
        },
        {
          "id": "#alice-knop-page-main-md",
          "type": "FileExpectation",
          "path": "alice/_knop/main.md",
          "changeType": "unchanged",
          "compareMode": "text"
        },
        {
          "id": "#alice-knop-page-sidebar-md",
          "type": "FileExpectation",
          "path": "alice/_knop/sidebar.md",
          "changeType": "unchanged",
          "compareMode": "text"
        },
        {
          "id": "#alice-knop-page-css",
          "type": "FileExpectation",
          "path": "alice/_knop/_assets/alice.css",
          "changeType": "unchanged",
          "compareMode": "text"
        },
        {
          "id": "#alice-knop-page-definition-s1-ttl",
          "type": "FileExpectation",
          "path": "alice/_knop/_page/_history001/_s0001/page-ttl/page.ttl",
          "changeType": "added",
          "compareMode": "rdfCanonical"
        },
        {
          "id": "#alice-knop-page-definition-page",
          "type": "FileExpectation",
          "path": "alice/_knop/_page/index.html",
          "changeType": "added",
          "compareMode": "text"
        },
        {
          "id": "#alice-knop-page-definition-history-page",
          "type": "FileExpectation",
          "path": "alice/_knop/_page/_history001/index.html",
          "changeType": "added",
          "compareMode": "text"
        },
        {
          "id": "#alice-knop-page-definition-s1-page",
          "type": "FileExpectation",
          "path": "alice/_knop/_page/_history001/_s0001/index.html",
          "changeType": "added",
          "compareMode": "text"
        },
        {
          "id": "#alice-knop-page-definition-s1-manifestation-page",
          "type": "FileExpectation",
          "path": "alice/_knop/_page/_history001/_s0001/page-ttl/index.html",
          "changeType": "added",
          "compareMode": "text"
        },
        {
          "id": "#alice-knop-inventory-ttl",
          "type": "FileExpectation",
          "path": "alice/_knop/_inventory/inventory.ttl",
          "changeType": "updated",
          "compareMode": "rdfCanonical"
        },
        {
          "id": "#alice-page",
          "type": "FileExpectation",
          "path": "alice/index.html",
          "changeType": "updated",
          "compareMode": "text"
        },
        {
          "id": "#alice-public-css",
          "type": "FileExpectation",
          "path": "alice/_assets/alice.css",
          "changeType": "absent"
        },
        {
          "id": "#alice-page-subtree-css",
          "type": "FileExpectation",
          "path": "alice/_knop/_page/_assets/alice.css",
          "changeType": "absent"
        },
        {
          "id": "#mesh-inventory-ttl",
          "type": "FileExpectation",
          "path": "_mesh/_inventory/inventory.ttl",
          "changeType": "unchanged",
          "compareMode": "rdfCanonical"
        }
      ],
      "hasRdfExpectation": [
        {
          "id": "#alice-knop-page-definition-rdf",
          "type": "RdfExpectation",
          "targetsFileExpectation": "#alice-knop-page-definition-ttl",
          "hasAskAssertion": [
            {
              "type": "SparqlAskAssertion",
              "query": "ASK { ?pageDefinition a <https://semantic-flow.github.io/ontology/core/ResourcePageDefinition> ; <https://semantic-flow.github.io/ontology/core/hasPageRegion> ?mainRegion, ?sidebarRegion . ?mainRegion <https://semantic-flow.github.io/ontology/core/regionKey> \"main\" . ?sidebarRegion <https://semantic-flow.github.io/ontology/core/regionKey> \"sidebar\" . }",
              "expectedBoolean": true
            }
          ]
        },
        {
          "id": "#alice-knop-page-definition-s1-rdf",
          "type": "RdfExpectation",
          "targetsFileExpectation": "#alice-knop-page-definition-s1-ttl",
          "hasAskAssertion": [
            {
              "type": "SparqlAskAssertion",
              "query": "ASK { ?pageDefinition a <https://semantic-flow.github.io/ontology/core/ResourcePageDefinition> . }",
              "expectedBoolean": true
            }
          ]
        },
        {
          "id": "#alice-knop-inventory-rdf",
          "type": "RdfExpectation",
          "targetsFileExpectation": "#alice-knop-inventory-ttl",
          "ignorePredicate": [
            "http://purl.org/dc/terms/created",
            "http://purl.org/dc/terms/updated"
          ],
          "hasAskAssertion": [
            {
              "type": "SparqlAskAssertion",
              "query": "ASK { <https://semantic-flow.github.io/mesh-alice-bio/alice/_knop> <https://semantic-flow.github.io/ontology/core/hasResourcePageDefinition> <https://semantic-flow.github.io/mesh-alice-bio/alice/_knop/_page> . <https://semantic-flow.github.io/mesh-alice-bio/alice/_knop/_page> <https://semantic-flow.github.io/ontology/core/currentArtifactHistory> <https://semantic-flow.github.io/mesh-alice-bio/alice/_knop/_page/_history001> . <https://semantic-flow.github.io/mesh-alice-bio/alice/_knop/_page/_history001> <https://semantic-flow.github.io/ontology/core/latestHistoricalState> <https://semantic-flow.github.io/mesh-alice-bio/alice/_knop/_page/_history001/_s0001> . }",
              "expectedBoolean": true
            },
            {
              "type": "SparqlAskAssertion",
              "query": "ASK { <https://semantic-flow.github.io/mesh-alice-bio/alice/_knop/_page> <https://semantic-flow.github.io/ontology/core/hasResourcePage> <https://semantic-flow.github.io/mesh-alice-bio/alice/_knop/_page/index.html> . }",
              "expectedBoolean": true
            },
            {
              "type": "SparqlAskAssertion",
              "query": "ASK { <https://semantic-flow.github.io/mesh-alice-bio/alice/_knop> <https://semantic-flow.github.io/ontology/core/hasKnopAssetBundle> ?assetBundle . ?assetBundle a <https://semantic-flow.github.io/ontology/core/KnopAssetBundle> . }",
              "expectedBoolean": true
            }
          ]
        },
        {
          "id": "#mesh-inventory-rdf",
          "type": "RdfExpectation",
          "targetsFileExpectation": "#mesh-inventory-ttl",
          "ignorePredicate": [
            "http://purl.org/dc/terms/created",
            "http://purl.org/dc/terms/updated"
          ],
          "hasAskAssertion": [
            {
              "type": "SparqlAskAssertion",
              "query": "ASK { <https://semantic-flow.github.io/mesh-alice-bio/_mesh/_inventory/_history001> <https://semantic-flow.github.io/ontology/core/latestHistoricalState> <https://semantic-flow.github.io/mesh-alice-bio/_mesh/_inventory/_history001/_s0004> . }",
              "expectedBoolean": true
            }
          ]
        }
      ]
    }
  ]
}
```

### Phase 2: Discovery, Authority, And Runtime Loading

- [ ] Add a `_knop/_page` discovery seam anchored only to the owning Knop, including the root case at `_knop/_page/page.ttl`.
- [ ] Make `D/_knop/_page/page.ttl` the only local authoritative working file for identifier-page customization of `D/index.html`.
- [ ] Ensure that a discovered valid `_knop/_page` definition takes precedence over generic identifier-page generation for that identifier only.
- [ ] Ensure that a discovered but malformed or unresolved `_knop/_page` definition fails closed rather than silently falling back to the generic identifier page.
- [ ] Introduce a runtime loader that parses the `ResourcePageDefinition`, resolves any workspace-local helper resources it references, and returns a page-definition read model separate from the existing generic identifier-page model.
- [ ] Keep `_knop/_page` history/state behavior aligned with other support artifacts: changes to `page.ttl` should version as `ResourcePageDefinition` changes, while referenced workspace-local helper files stay non-governance-bearing by default.

### Phase 3: Local Workspace Sources And Knop Asset Handling

- [ ] Implement local `LocatedFile` source resolution for `ResourcePageSource`, with first-pass support for `WorkspaceRelativeFile` and rejection of malformed or escaping relative paths.
- [ ] Treat ordinary Markdown as the default authored local format for `.md` files in the first pass, without implying Dendron semantics.
- [ ] Support one `ResourcePageSource` per `ResourcePageRegion` in the first implementation slice; if a definition requests broader ordered composition before that lands, fail closed rather than inventing ad hoc merge rules.
- [ ] Extend the page-rendering seam so identifier pages can render resolved region content instead of only the current generic identifier-page text.
- [ ] Keep page-local assets at `_knop/_assets/...` and let generated identifier pages reference those paths directly rather than copying them into a separate public `_assets/...` surface.
- [ ] Keep `_knop/_assets` out of recursive `KnopInventory` capture and out of separate history/state creation by default.

### Phase 4: Generic-Page Interop And Planning Seams

- [ ] Keep generic generation authoritative for `_mesh`, Knop support-artifact, history, state, and manifestation pages unless a later spec explicitly expands `_knop/_page` to those surfaces.
- [ ] Refactor the current identifier-page planning seam so `core/weave` can choose between a generic identifier-page model and a page-definition-driven model without hard-coding special cases in one large branch.
- [ ] Keep page-content composition separate from template/chrome policy, so `ResourcePagePresentationConfig` stays adjacent and optional rather than becoming a prerequisite for first-pass page-definition support.
- [ ] Preserve root behavior: `_mesh/index.html` remains mesh support, while root `index.html` is the identifier page customized by root `_knop/_page` when present.

### Phase 5: Artifact Resolution And Import-Oriented Source Support

- [ ] Add first-pass in-mesh artifact source resolution through the generic artifact-resolution pattern (`hasTargetArtifact`, requested history/state, mode, and fallback) together with the existing `ResourcePageSource` aliases such as `hasSourceArtifact` and `hasRequestedSourceState`.
- [ ] Implement `Pinned` versus `Current` as separate source-mode behavior rather than collapsing them into fallback or “prefer” booleans.
- [ ] Implement first-pass fallback policy behavior for `ExactOnly` and `AcceptLatestInRequestedHistory`, with explicit rejection of cross-history, cross-artifact, or unrelated-working-file fallback.
- [ ] Add import-oriented source handling for outside-the-tree or extra-mesh content only after it crosses an explicit in-tree governed-artifact boundary.
- [ ] Fail closed on direct live outside-source usage instead of letting `weave` fetch or follow arbitrary current external content.

### Phase 6: Tests, Follow-On Fixtures, And Documentation

- [ ] Add focused unit/runtime coverage for discovery and authority, including root `_knop/_page` handling and fail-closed malformed-definition behavior.
- [ ] Add focused coverage for workspace-relative file resolution, path-escape rejection, and direct `_knop/_assets` use without copied public asset materialization.
- [ ] Add focused coverage for `ResourcePageDefinition` history/state behavior as a normal support artifact while keeping referenced workspace-local helper files non-recursive.
- [ ] Add integration coverage proving a valid `_knop/_page` overrides generic identifier-page generation for the owning identifier only.
- [ ] Add integration coverage for local Knop-owned file sources first, then in-mesh artifact sources, then import-boundary behavior.
- [ ] Continue the Accord fixture ladder after the first carried slice is stable: `16/17` for imported-source behavior and `18-21` for root lifecycle continuation.
- [ ] Update [[wd.codebase-overview]] once the runtime seams and carried slice are real.
