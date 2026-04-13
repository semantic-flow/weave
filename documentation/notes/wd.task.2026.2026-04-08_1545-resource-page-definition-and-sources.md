---
id: s7q2k3n4v5b6m8c1x9z4p6r
title: 2026 04 08_1545 Resource Page Definition And Sources
desc: ''
created: 1775715234849
---

## Goals

- Define a knop-owned page-definition support artifact at `_knop/_page/page.ttl` so an identifier such as `alice/` can own a customized `alice/index.html` without becoming a payload-bearing artifact itself.
- Keep ordinary Markdown as the baseline authored source format for mesh-local page content, while treating Dendron compatibility as an optional interpretation profile rather than the default required mode.
- Define the runtime-facing consequences of the page-definition ontology/config model without trying to invent that vocabulary ad hoc inside implementation code.
- Separate page control metadata from page content so the model can use mesh-local files, in-mesh artifacts, and imported outside content without collapsing them into one RDF blob.
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
- substantial authored content usually lives in natural mesh locations outside `_page`, such as `alice/alice.md` or `mesh-content/sidebar.md`, or in referenced DigitalArtifacts rather than inside long RDF literals
- ordinary Markdown should be the default authored local-content format; richer Dendron conventions should only activate under an explicit source-interpretation profile
- each `resourcePageSource` can independently choose a source artifact, an optional requested state, and a mode/fallback policy
- outside-the-tree or extra-mesh content should enter page generation through an explicit import step, not as a direct live "latest" source

That makes `_knop/_page` the control plane while keeping content and versioned source artifacts first-class, without overloading the support-artifact directory itself.

## Discussion

This is not just a template question.

We need to support several distinct things without conflating them:

- identifier-page customization
- mesh-local support content such as Markdown, HTML fragments, and images
- helper metadata about local support assets without pretending every supporting file is a first-class governed artifact
- reuse of independently versioned in-mesh content artifacts
- explicitly allowed import inputs for content that originates outside the tree or outside the mesh
- template/chrome selection

The current design pressure suggests a structure more like:

- `_knop/_page/page.ttl`
- `alice/alice.md`
- `mesh-content/sidebar.md`
- `_knop/_assets/...`

where `page.ttl` references those mesh-local files or other artifact identifiers.

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
- local mesh helper files should resolve through `targetMeshPath` directly on the `ArtifactResolutionTarget`, not through ad hoc fake file resources
- direct remote/external targets may be represented through `targetAccessUrl` on `ArtifactResolutionTarget`, but page-generation use should remain policy-gated and out of first pass unless explicitly widened later
- governed artifact current-byte lookup should use `workingFilePath` when present, with `workingAccessUrl` reserved as the broader-model remote/external current-byte hook and `hasWorkingLocatedFile` remaining the semantic `LocatedFile` hook when the working bytes are also modeled as a mesh-addressable file
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
  sflo:hasTargetArtifact <https://example.org/alice/bio/_knop/payload> ;
  sflo:hasRequestedTargetState <https://example.org/alice/bio/_history001/_s0003> ;
  sflo:hasArtifactResolutionMode sflo:ArtifactResolutionMode/Pinned ;
  sflo:hasArtifactResolutionFallbackPolicy sflo:ArtifactResolutionFallbackPolicy/AcceptLatestInRequestedHistory .
```

## Open Issues

- Whether first-pass runtime support should allow multiple ordered sources per region immediately, or start with one source per region and add `sourceOrder` only when composition pressure appears in real examples.
- Whether first-pass import metadata for outside-the-tree content should be limited to explicitly described distributions.
- Whether first-pass fallback should stop at `AcceptLatestInRequestedHistory` or also allow an explicit current-history fallback policy later.
- Whether local `targetMeshPath` helper sources should also carry media-type hints, or whether extension-driven/runtime inference is sufficient initially.
- Which operational config vocabulary should carry allowed-directory rules for `targetMeshPath` and `workingFilePath`; see [[wd.task.2026.2026-04-11_1723-operational-config-for-runtime-resolution]].
- The current operational-config direction is to keep that vocabulary in the config ontology line under a broad `OperationalConfig`, with a repo-traveling access layer kept distinct from machine-local trust policy and a first-pass `LocalPathAccessRule` / `RemoteAccessRule` allowlist model for boundary checks; see [[wd.task.2026.2026-04-11_1723-operational-config-for-runtime-resolution]].
- Which operational config vocabulary should carry remote target-access policy for `targetAccessUrl`; see [[wd.task.2026.2026-04-11_1723-operational-config-for-runtime-resolution]].
- Which operational config vocabulary should carry remote-current-byte policy for `workingAccessUrl`; see [[wd.task.2026.2026-04-11_1723-operational-config-for-runtime-resolution]].

## Decisions

- `_knop/_page` should be the local authoritative page-definition support artifact for a resource page.
- Ordinary Markdown should remain the default authored content format for local mesh page files; Dendron compatibility, if added, should be an optional source-interpretation profile layered on top rather than the default required mode.
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
- `ResourcePageSource` should remain as a page-specific subclass of a generic `ArtifactResolutionTarget`.
- `ResourcePageSource` should keep its current class name. Renaming it to `ResourcePageSourceTarget` would mostly repeat what the superclass already says while adding churn to an otherwise readable region-to-source relation.
- Direct `targetMeshPath` bindings should be valid source bindings even when there is no artifact-level target to resolve.
- `targetAccessUrl` should be introduced as the operational remote/external direct-target hook on `ArtifactResolutionTarget`, distinct from both `targetMeshPath` and artifact-targeted resolution.
- `workingFilePath` should be introduced as the operational local-path hook for a `DigitalArtifact`, distinct from `hasWorkingLocatedFile`.
- `workingAccessUrl` should be introduced as the operational remote/external current-byte hook for a `DigitalArtifact`, distinct from both `workingFilePath` and `hasWorkingLocatedFile`.
- `hasWorkingLocatedFile` should remain the semantic `LocatedFile` relation; when multiple current-byte locators are present for the same current working surface, they should agree and mismatch should fail closed.
- `KnopAssetBundle` is clearer than `AssetFolder` or `PageAssetFolder`, but it should not be read as a requirement that every page support file live under `_knop/_assets`.
- `accept` should describe fallback policy, not replace the separate pinned-vs-current source mode axis.
- Allowed-directory policy for `targetMeshPath` and `workingFilePath` belongs in host/runtime operational config, not in the core page-definition vocabulary.
- Remote-use policy for `targetAccessUrl` belongs in host/runtime operational config, not in the core page-definition vocabulary.
- Remote-use policy for `workingAccessUrl` also belongs in host/runtime operational config, not in the core page-definition vocabulary.

## Contract Changes

- Introduce a knop-owned page-definition support artifact at `_knop/_page`.
- Introduce ontology/config vocabulary for that page-definition artifact, generic artifact-resolution targets, mesh-local path bindings, and Knop asset boundaries before the runtime contract broadens.
- Introduce `workingFilePath` as the operational local current-byte path for artifacts, with explicit precedence/consistency rules relative to `hasWorkingLocatedFile`.
- Introduce `targetAccessUrl` as the operational remote/external direct-target URL for `ArtifactResolutionTarget`.
- Introduce `workingAccessUrl` as the operational remote/external current-byte URL for artifacts, with explicit precedence/consistency rules relative to `workingFilePath` and `hasWorkingLocatedFile`.
- Define a manifest artifact in that support surface that can reference:
  - local mesh-relative helper paths
  - in-mesh DigitalArtifact identifiers
  - imported in-tree artifacts whose current `WorkingLocatedFile` came from an outside-the-tree or extra-mesh origin
- Define per-source selection fields for state, mode, and fallback policy.
- Define an explicit import boundary for outside-the-tree content rather than direct live external-latest page resolution.
- Define `_knop/_assets` as the fixed location for local static assets referenced by page definitions.
- Define any helper resource for local page files and assets so its relative-path semantics are explicit rather than buried in ad hoc string fields.
- Define the allowed-directories boundary for `targetMeshPath` and `workingFilePath` in operational config rather than persisting absolute host roots in RDF.
- Define direct remote-target policy for `targetAccessUrl` in operational config rather than implying network access from core RDF alone.
- Define remote-current-byte policy for `workingAccessUrl` in operational config rather than implying network access from core RDF alone.
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

- [x] Treat [[wd.task.2026.2026-04-08_1735-page-definition-ontology-and-config]] and [[wd.spec.2026-04-11-identifier-page-customization-and-root-lifecycle]] as the contract source, so this task implements settled `ResourcePageDefinition` / `ArtifactResolutionTarget` / `ResourcePageSource` behavior rather than reopening ontology decisions in runtime code.
- [x] Add a behavior spec and fixture plan before implementing the runtime/model changes. See [[wd.spec.2026-04-11-identifier-page-customization-and-root-lifecycle]].
- [x] Keep the first implementation-bearing slice narrower than the whole future model: local mesh-path sources, authority/precedence, fail-closed behavior, and `_knop/_assets` handling should land before broader in-mesh/import source support unless the code shape makes those cheap and coherent to include.

### Phase 1: Acceptance-First Fixture And Manifest Scaffolding

- [x] Extend `mesh-alice-bio` with the first carried non-root customization transition pair, `14-alice-page-customized` and `15-alice-page-customized-woven`, early enough that they can drive the runtime slice rather than merely validate it afterward.
- [x] Draft the matching Accord manifests early, including the exact transition boundaries, expected file additions/changes, and any explicit exclusions needed for deterministic comparison.
- [x] Keep the first carried fixture scope narrow: prove authority/precedence, local mesh-path sources, and `_knop/_assets` handling before broadening into in-mesh or import-oriented source behavior.
- [x] Use the staged `14/15` fixture pair as the primary acceptance target while implementing the first runtime slice, updating the runtime toward the fixture rather than inventing runtime behavior first and backfilling fixtures later.
- [x] Leave the carried follow-on ladder in the near-term plan, but do not let it block the first settled `14/15` slice: `16/17` should introduce and weave the governed Markdown artifact used for later page sourcing, `18/19` should prove Alice artifact-backed page sources, `20/21` should cover Bob imported-source behavior from a genuine outside-origin URL, and `22-25` should carry root continuation.

#### Proposed Ladder Sketch

`14-alice-page-customized`

- Add `alice/_knop/_page/page.ttl` as the first `ResourcePageDefinition` working file for Alice.
- Add initial mesh-local content files such as `alice/alice.md` and `mesh-content/sidebar.md`, plus the Knop-local stylesheet `alice/_knop/_assets/alice.css`.
- Update `alice/_knop/_inventory/inventory.ttl` to register the new page-definition support surface and its current working file.
- Keep the fixture narrow and local-only: both initial page regions should resolve from `targetMeshPath` values rather than from in-mesh or imported artifacts.
- Do not weave histories or generate new pages yet; `alice/index.html` should remain the previously generated generic page in this non-woven state.
- Do not advance `_mesh/_inventory`; the page-definition support artifact is Knop-internal and the public current resource map has not widened yet.

`15-alice-page-customized-woven`

- Weave `14` so the `ResourcePageDefinition` behaves like a normal support artifact with its own first history/state materialization.
- Generate Alice page-definition support-artifact pages under `alice/_knop/_page/...` using the ordinary support-artifact page machinery rather than a custom `_page`-specific renderer.
- Update `alice/index.html` so it is now driven by `alice/_knop/_page/page.ttl` and its mesh-local sources instead of the generic identifier-page path.
- Keep referenced support assets at `alice/_knop/_assets/...`; do not introduce a copied `alice/_assets/...` surface.
- Advance `alice/_knop/_inventory` to reflect the new support-artifact current state, but keep `_mesh/_inventory` unchanged unless implementation uncovers a real current-surface-map reason to move it.

`16-alice-page-main-integrated`

- Introduce a governed in-mesh Markdown-bearing artifact such as `alice/page-main` without yet repointing Alice's page definition away from its current direct `targetMeshPath` source.
- Keep the carried example narrow and concrete: the new artifact should have a normal payload/Knop shape and a current Markdown working file such as `alice-page-main.md`.
- This is an integration step, not an import step. The source bytes are still in the whole-repo mesh rather than crossing an outside-origin boundary.
- Keep Alice's existing page definition and public `alice/index.html` unchanged until the later artifact-backed page-source pair.

`17-alice-page-main-integrated-woven`

- Weave `16` so the governed Markdown artifact behaves like a normal woven payload artifact with its own history, pages, and advanced mesh inventory state.
- Keep Alice's existing page definition and public `alice/index.html` unchanged; this pair is only about preparing the governed source artifact that the next pair will reference.

`18-alice-page-artifact-source`

- Repoint one Alice page region from a direct `targetMeshPath` source to the already-woven governed Markdown artifact `alice/page-main`.
- Keep the carried example narrow and concrete: the page source should target the governed artifact identity, while current-byte resolution follows that artifact's current `workingFilePath` / `hasWorkingLocatedFile`.
- Keep this slice at `Current` behavior only; do not introduce `Pinned` or fallback semantics into the carried fixture pair yet.

`19-alice-page-artifact-source-woven`

- Weave `18` so the artifact-backed page definition is versioned and rendered.
- Prove that `alice/index.html` now follows the governed Markdown source artifact's current working surface rather than a direct local `targetMeshPath`.
- Keep this pair focused on `Current` artifact-backed behavior; `Pinned` and fallback remain follow-on runtime/fixture work.

`20-bob-page-imported-source`

- Add a governed in-tree artifact for Bob whose current `WorkingLocatedFile` is sourced through an explicit outside-origin import.
- Add Bob page customization in a way that keeps Alice's settled `18/19` artifact-backed page state intact rather than overwriting it immediately with a different import-oriented concern.
- Keep the outside-origin boundary explicit in data and files; do not let the page definition point directly at a live outside location.
- Keep the first carried import pair aligned with the current renderer: import Markdown or similarly plain authored text that the page-definition runtime can render as Markdown today.
- Do not use the first carried import pair to imply RDF-dataset-to-page rendering; if the imported source is Turtle or another structured dataset, a later transformation/extraction layer would still be needed before it becomes good page-region content.
- Prefer a direct file/export URL for the first carried fixture rather than an HTTP content-negotiation flow that requires custom request headers.

`21-bob-page-imported-source-woven`

- Weave `20` so the imported-source-backed page definition is versioned and rendered.
- Prove that `bob/index.html` now follows the imported in-tree artifact's current `WorkingLocatedFile`, not a direct outside-source location.
- Keep direct-live outside-source rejection in focused runtime/integration tests rather than trying to encode that failure case as a successful Accord transition.
- Keep HTTP request shaping such as custom `Accept` headers out of the first carried import fixture unless no reasonable direct file/export URL exists; that broader remote-fetch feature should remain a follow-on operational/import concern.
- Keep the woven acceptance focused on imported page-content bytes that the current Markdown-oriented renderer can consume directly, rather than on remote RDF dataset handling.

`22-root-knop-created`

- Add the root Knop support surface at `_knop` in a later mesh lifecycle step, not as a special early bootstrap-only case.
- Keep root `index.html` generic at this stage; this branch should establish the root support surface before root page customization.

`23-root-knop-created-woven`

- Weave the root Knop creation so root support-artifact histories/pages exist and root `index.html` is present as the generic identifier page.
- Keep `_mesh/index.html` distinct and unchanged in ownership semantics.

`24-root-page-customized`

- Add `_knop/_page/page.ttl` plus minimal root mesh-local content files and `_knop/_assets/...`.
- Update root Knop inventory to register the root `ResourcePageDefinition` support artifact.
- Keep this branch non-woven: `index.html` should still be the previous generic root page until weave runs.

`25-root-page-customized-woven`

- Weave `22` so root `_knop/_page` gets normal support-artifact history/state materialization and support-artifact pages.
- Update root `index.html` to follow root `_knop/_page/page.ttl` and its mesh-local sources.
- Keep root support assets at `_knop/_assets/...` rather than materializing a copied `_assets/...` surface.

#### Accord Shape For `14` And `15`

The first real Accord manifests now exist at:

- `dependencies/github.com/semantic-flow/semantic-flow-framework/examples/alice-bio/conformance/14-alice-page-customized.jsonld`
- `dependencies/github.com/semantic-flow/semantic-flow-framework/examples/alice-bio/conformance/15-alice-page-customized-woven.jsonld`

These manifests are now the authoritative acceptance draft for the first carried page-customization slice. The remaining draft aspects are narrow and explicit:

The next drafted governed-artifact and artifact-backed manifests now also exist at:

- `dependencies/github.com/semantic-flow/semantic-flow-framework/examples/alice-bio/conformance/16-alice-page-main-integrated.jsonld`
- `dependencies/github.com/semantic-flow/semantic-flow-framework/examples/alice-bio/conformance/17-alice-page-main-integrated-woven.jsonld`
- `dependencies/github.com/semantic-flow/semantic-flow-framework/examples/alice-bio/conformance/18-alice-page-artifact-source.jsonld`
- `dependencies/github.com/semantic-flow/semantic-flow-framework/examples/alice-bio/conformance/19-alice-page-artifact-source-woven.jsonld`

These `16/17` manifests introduce and weave the governed Markdown-bearing payload artifact `alice/page-main` with working file `alice-page-main.md` without yet changing Alice's page definition. The drafted `18/19` manifests then repoint Alice's `main` region to that governed artifact while keeping the shared `sidebar` region on `mesh-content/sidebar.md`. Both `16/17` and `18/19` are now real carried fixture pairs. The next unfinished ladder step is the Bob import-boundary pair tracked in [[wd.task.2026.2026-04-13_1245-bob-import-boundary-for-page-source]].

- `14` still uses provisional `operationId: "resourcePage.define"` until the concrete API/job naming settles.
- the first support-artifact manifestation token remains `page-ttl`
- the fixture inventory files still mix existing `sflo` history/page vocabulary with the newer core page-definition vocabulary because the carried fixture repo has not been broadly migrated yet
- the carried `15` branch's public `alice/index.html` snapshot predates the latest `alice/alice.md` wording, so runtime integration coverage now treats the live mesh-local Markdown as authoritative for public-page text while still using the fixture branch for inventory and support-artifact expectations

Current `14-alice-page-customized` manifest shape:

- transition: `13-bob-extracted-woven` -> `14-alice-page-customized`
- target: `alice`
- added files:
  - `alice/_knop/_page/page.ttl`
  - `alice/alice.md`
  - `mesh-content/sidebar.md`
  - `alice/_knop/_assets/alice.css`
- updated files:
  - `alice/_knop/_inventory/inventory.ttl`
- unchanged files:
  - `_mesh/_inventory/inventory.ttl`
  - `alice/index.html`
- absent files:
  - `alice/_knop/_page/index.html`
  - `alice/_assets/alice.css`
  - `alice/_knop/_page/_assets/alice.css`
- RDF assertions prove:
  - `alice/_knop/_page` is a `ResourcePageDefinition`
  - the definition has `main` and `sidebar` regions
  - both initial `ResourcePageSource` nodes resolve by `targetMeshPath` to `alice/alice.md` and `mesh-content/sidebar.md`
  - `alice/_knop/_inventory/inventory.ttl` registers both `hasResourcePageDefinition` and `hasKnopAssetBundle`
  - the non-woven state still has no `_page` artifact history yet

Current `15-alice-page-customized-woven` manifest shape:

- transition: `14-alice-page-customized` -> `15-alice-page-customized-woven`
- target: `alice`
- unchanged authored inputs:
  - `alice/_knop/_page/page.ttl`
  - `alice/alice.md`
  - `mesh-content/sidebar.md`
  - `alice/_knop/_assets/alice.css`
- added `_page` support-artifact outputs:
  - `alice/_knop/_page/index.html`
  - `alice/_knop/_page/_history001/index.html`
  - `alice/_knop/_page/_history001/_s0001/index.html`
  - `alice/_knop/_page/_history001/_s0001/page-ttl/index.html`
  - `alice/_knop/_page/_history001/_s0001/page-ttl/page.ttl`
- added Alice inventory state outputs:
  - `alice/_knop/_inventory/_history001/_s0003/index.html`
  - `alice/_knop/_inventory/_history001/_s0003/inventory-ttl/index.html`
  - `alice/_knop/_inventory/_history001/_s0003/inventory-ttl/inventory.ttl`
- updated files:
  - `alice/_knop/_inventory/inventory.ttl`
  - `alice/_knop/_inventory/_history001/index.html`
  - `alice/index.html`
- unchanged files:
  - `_mesh/_inventory/inventory.ttl`
- absent files:
  - `alice/_assets/alice.css`
  - `alice/_knop/_page/_assets/alice.css`
- RDF assertions prove:
  - `alice/_knop/_page` now has a normal support-artifact history at `_history001`
  - `_history001/_s0001` is the latest page-definition state and materializes `page-ttl/page.ttl`
  - `alice/_knop/_page` now has its own generated support-artifact resource page
  - `alice/_knop/_inventory/_history001` now advances to `_s0003`
  - `_mesh/_inventory` stays unchanged across the weave step

Current `16-alice-page-main-integrated` manifest shape:

- transition: `15-alice-page-customized-woven` -> `16-alice-page-main-integrated`
- target: `alice`
- added files:
  - `alice-page-main.md`
  - `alice/page-main/_knop/_meta/meta.ttl`
  - `alice/page-main/_knop/_inventory/inventory.ttl`
- updated files:
  - `_mesh/_inventory/inventory.ttl`
- unchanged files:
  - `alice/_knop/_page/page.ttl`
  - `alice/alice.md`
  - `mesh-content/sidebar.md`
  - `alice/_knop/_assets/alice.css`
  - `alice/_knop/_inventory/inventory.ttl`
  - `alice/index.html`
- absent files:
  - `alice/page-main/index.html`
  - `alice/page-main/_knop/index.html`
- RDF assertions prove:
  - `_mesh/_inventory/inventory.ttl` now registers the new `alice/page-main` payload artifact and its Knop
  - the new governed source artifact currently uses `alice-page-main.md` as its working file but still has no explicit history before weave
  - `alice/_knop/_page#main-source` still points directly to `targetMeshPath "alice/alice.md"`
  - Alice's page definition has not yet been repointed to `alice/page-main`

Current `17-alice-page-main-integrated-woven` manifest shape:

- transition: `16-alice-page-main-integrated` -> `17-alice-page-main-integrated-woven`
- target: `alice/page-main`
- unchanged authored/source files:
  - `alice-page-main.md`
  - `alice/_knop/_page/page.ttl`
  - `alice/alice.md`
  - `mesh-content/sidebar.md`
- added payload-artifact outputs:
  - `alice/page-main/index.html`
  - `alice/page-main/_history001/index.html`
  - `alice/page-main/_history001/_s0001/index.html`
  - `alice/page-main/_history001/_s0001/alice-page-main-md/index.html`
  - `alice/page-main/_history001/_s0001/alice-page-main-md/alice-page-main.md`
  - `alice/page-main/_knop/index.html`
  - `alice/page-main/_knop/_inventory/index.html`
  - `alice/page-main/_knop/_inventory/_history001/index.html`
  - `alice/page-main/_knop/_inventory/_history001/_s0001/index.html`
  - `alice/page-main/_knop/_inventory/_history001/_s0001/inventory-ttl/index.html`
  - `alice/page-main/_knop/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl`
- added mesh inventory state outputs:
  - `_mesh/_inventory/_history001/_s0005/index.html`
  - `_mesh/_inventory/_history001/_s0005/inventory-ttl/index.html`
  - `_mesh/_inventory/_history001/_s0005/inventory-ttl/inventory.ttl`
- updated files:
  - `_mesh/_inventory/inventory.ttl`
  - `_mesh/_inventory/_history001/index.html`
  - `alice/page-main/_knop/_inventory/inventory.ttl`
- unchanged files:
  - `alice/_knop/_page/index.html`
  - `alice/_knop/_page/_history001/_s0001/page-ttl/page.ttl`
  - `alice/_knop/_inventory/inventory.ttl`
  - `alice/index.html`
- RDF assertions prove:
  - the new `alice/page-main` payload artifact now has `_history001/_s0001` and a public `alice/page-main/index.html`
  - `_mesh/_inventory/_history001` now advances to `_s0005` to register the new woven `alice/page-main` current surface
  - `alice/_knop/_page#main-source` still resolves through `targetMeshPath "alice/alice.md"`
  - Alice's public page has not changed yet

Current `18-alice-page-artifact-source` manifest shape:

- transition: `17-alice-page-main-integrated-woven` -> `18-alice-page-artifact-source`
- target: `alice`
- updated files:
  - `alice/_knop/_page/page.ttl`
- unchanged files:
  - `alice-page-main.md`
  - `alice/alice.md`
  - `mesh-content/sidebar.md`
  - `_mesh/_inventory/inventory.ttl`
  - `alice/page-main/_knop/_inventory/inventory.ttl`
  - `alice/_knop/_page/index.html`
  - `alice/_knop/_page/_history001/_s0001/page-ttl/page.ttl`
  - `alice/_knop/_inventory/inventory.ttl`
  - `alice/index.html`
- RDF assertions prove:
  - `alice/_knop/_page#main-source` now points to the governed artifact `alice/page-main`
  - that main source explicitly requests `ArtifactResolutionMode/Current`
  - `alice/_knop/_page#sidebar-source` still points to `mesh-content/sidebar.md`
  - the old direct `targetMeshPath "alice/alice.md"` is no longer used by the main source
  - the already-woven `alice/page-main` payload artifact is now the page's governed source
  - `alice/_knop/_page/_history001` still stops at `_s0001`
  - `alice/_knop/_inventory/_history001` still stops at `_s0003`

Current `19-alice-page-artifact-source-woven` manifest shape:

- transition: `18-alice-page-artifact-source` -> `19-alice-page-artifact-source-woven`
- target: `alice`
- unchanged authored/source files:
  - `alice/_knop/_page/page.ttl`
  - `alice-page-main.md`
  - `alice/page-main/index.html`
- added `_page` support-artifact outputs:
  - `alice/_knop/_page/_history001/_s0002/index.html`
  - `alice/_knop/_page/_history001/_s0002/page-ttl/index.html`
  - `alice/_knop/_page/_history001/_s0002/page-ttl/page.ttl`
- added Alice inventory state outputs:
  - `alice/_knop/_inventory/_history001/_s0004/index.html`
  - `alice/_knop/_inventory/_history001/_s0004/inventory-ttl/index.html`
  - `alice/_knop/_inventory/_history001/_s0004/inventory-ttl/inventory.ttl`
- updated files:
  - `alice/_knop/_page/index.html`
  - `alice/_knop/_page/_history001/index.html`
  - `alice/_knop/_inventory/inventory.ttl`
  - `alice/_knop/_inventory/_history001/index.html`
  - `alice/index.html`
- unchanged files:
  - `_mesh/_inventory/inventory.ttl`
  - `alice/_knop/_page/_history001/_s0001/page-ttl/page.ttl`
- RDF assertions prove:
  - the second page-definition state `_s0002` carries the same `alice/page-main`-backed main source and mesh-local sidebar source as the working `page.ttl`
  - `alice/_knop/_page/_history001` now advances to `_s0002`, with `_s0002` pointing back to `_s0001`
  - `alice/_knop/_inventory/_history001` now advances to `_s0004`
  - `_mesh/_inventory` stays unchanged because the governed source artifact was already integrated and woven in `16/17`
  - `alice/index.html` is what updates to follow that governed Markdown-backed source

### Phase 2: Discovery, Authority, And Runtime Loading

- [ ] Add a `_knop/_page` discovery seam anchored only to the owning Knop, including the root case at `_knop/_page/page.ttl`.
- [x] Make `D/_knop/_page/page.ttl` the only local authoritative working file for identifier-page customization of `D/index.html`.
- [x] Ensure that a discovered valid `_knop/_page` definition takes precedence over generic identifier-page generation for that identifier only.
- [x] Ensure that a discovered but malformed or unresolved `_knop/_page` definition fails closed rather than silently falling back to the generic identifier page.
- [x] Introduce a runtime loader that parses the `ResourcePageDefinition`, resolves any mesh-local helper resources it references, and returns a page-definition read model separate from the existing generic identifier-page model.
- [x] Keep `_knop/_page` history/state behavior aligned with other support artifacts: changes to `page.ttl` should version as `ResourcePageDefinition` changes, while referenced mesh-local helper files stay non-governance-bearing by default.

### Phase 3: Local Mesh-Path Sources And Knop Asset Handling

- [x] Implement local `targetMeshPath` source resolution for `ResourcePageSource`, with rejection of malformed or escaping mesh-relative paths.
- [x] Treat ordinary Markdown as the default authored local format for `.md` files in the first pass, without implying Dendron semantics.
- [x] Support one `ResourcePageSource` per `ResourcePageRegion` in the first implementation slice; if a definition requests broader ordered composition before that lands, fail closed rather than inventing ad hoc merge rules.
- [x] Extend the page-rendering seam so identifier pages can render resolved region content instead of only the current generic identifier-page text.
- [x] Keep page-local assets at `_knop/_assets/...` and let generated identifier pages reference those paths directly rather than copying them into a separate public `_assets/...` surface.
- [x] Keep `_knop/_assets` out of recursive `KnopInventory` capture and out of separate history/state creation by default.

### Phase 4: Generic-Page Interop And Planning Seams

- [x] Keep generic generation authoritative for `_mesh`, Knop support-artifact, history, state, and manifestation pages unless a later spec explicitly expands `_knop/_page` to those surfaces.
- [ ] Refactor the current identifier-page planning seam so `core/weave` can choose between a generic identifier-page model and a page-definition-driven model without hard-coding special cases in one large branch.
- [ ] Keep page-content composition separate from template/chrome policy, so `ResourcePagePresentationConfig` stays adjacent and optional rather than becoming a prerequisite for first-pass page-definition support.
- [ ] Preserve root behavior: `_mesh/index.html` remains mesh support, while root `index.html` is the identifier page customized by root `_knop/_page` when present.

### Phase 5: Artifact Resolution And Import-Oriented Source Support

- [x] Add first-pass in-mesh artifact source resolution through `hasTargetArtifact` directly on `ResourcePageSource`, with default/`Current` current-byte loading from the governed artifact's current working surface and fail-closed rejection of `Pinned`, requested history/state, fallback policy, direct located-file/distribution, and remote target forms until later slices land.
- [ ] Add `targetAccessUrl` handling to `ArtifactResolutionTarget` only behind explicit operational policy, with fail-closed behavior when remote target access is disallowed. See [[wd.task.2026.2026-04-11_1723-operational-config-for-runtime-resolution]].
- [ ] Decide whether first-pass page generation should ever follow `targetAccessUrl` directly, or continue requiring import or governed-artifact indirection for remote-origin content even if the broader artifact-resolution model permits direct external targets.
- [x] Add `workingFilePath` support to governed-artifact current resolution, with fail-closed mismatch handling against `hasWorkingLocatedFile`.
- [ ] Add `workingAccessUrl` handling to governed-artifact current resolution only behind explicit operational policy, with fail-closed behavior when remote current-byte access is disallowed. See [[wd.task.2026.2026-04-11_1723-operational-config-for-runtime-resolution]].
- [ ] Decide whether first-pass page generation should ever follow `workingAccessUrl` directly, or continue requiring imported in-tree artifacts for remote-origin content even if the broader artifact model permits external current-byte locators.
- [ ] Implement `Pinned` versus `Current` as separate source-mode behavior rather than collapsing them into fallback or “prefer” booleans.
- [ ] Implement first-pass fallback policy behavior for `ExactOnly` and `AcceptLatestInRequestedHistory`, with explicit rejection of cross-history, cross-artifact, or unrelated-working-file fallback.
- [ ] Add import-oriented source handling for outside-the-tree or extra-mesh content only after it crosses an explicit in-tree governed-artifact boundary.
- [ ] Fail closed on direct live outside-source usage instead of letting `weave` fetch or follow arbitrary current external content.
- [x] Broaden local path handling so `targetMeshPath` and `workingFilePath` may use `../` only within host/runtime-configured allowed directories rather than the current mesh-root-only boundary. See [[wd.task.2026.2026-04-11_1723-operational-config-for-runtime-resolution]].

### Phase 6: Tests, Follow-On Fixtures, And Documentation

- [ ] Add focused unit/runtime coverage for discovery and authority, including root `_knop/_page` handling and fail-closed malformed-definition behavior.
- [x] Add focused coverage for `targetMeshPath` resolution, path-escape rejection, and direct `_knop/_assets` use without copied public asset materialization.
- [x] Add focused coverage for `ResourcePageDefinition` history/state behavior as a normal support artifact while keeping referenced mesh-local helper files non-recursive.
- [x] Add integration coverage proving a valid `_knop/_page` overrides generic identifier-page generation for the owning identifier only.
- [x] Add integration coverage for local mesh-path page sources and first-pass in-mesh artifact-backed page sources.
- [x] Add focused coverage for later page-definition revisions that version a second `_page` state and later Alice KnopInventory state without widening mesh inventory.
- [ ] Add integration coverage for import-boundary behavior.
- [ ] Continue the Accord fixture ladder after the now-real `16-19` slices: `20/21` for Bob imported-source behavior and `22-25` for root lifecycle continuation.
- [ ] Update [[wd.codebase-overview]] once the runtime seams and carried slice are real.
