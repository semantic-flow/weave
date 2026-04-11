---
id: 4yb6bmtj3yq4xq0d9h8s2pe
title: 2026 04 11 Identifier Page Customization And Root Lifecycle
desc: ''
updated: 1775902232359
created: 1775902232359
---

## Purpose

This note captures the current intended behavior for customized current identifier pages driven by a knop-owned `_knop/_page` bundle.

It is an implementation-facing behavior spec for the first customizable identifier-page slice, not a final public API contract or a full template-system design.

## Status

The ontology/config direction from [[wd.task.2026.2026-04-08_1735-page-definition-ontology-and-config]] is now settled enough to write the runtime contract.

The first implementation-bearing acceptance targets proposed here are:

- `mesh-alice-bio` late-ladder transitions for non-root customized pages
- a separate root-focused fixture series for root lifecycle and root page customization

This split is intentional. Root behavior starts near mesh creation and root Knop creation, so burying it behind the late Alice/Bob extraction ladder would make the acceptance story harder to read and easier to get wrong.

## Scope

This note covers only the current public identifier page for a resource such as `alice/index.html`, `alice/bio/index.html`, or root `index.html`.

In this first slice, it does not redefine or replace generic generation for:

- `_mesh/index.html`
- Knop support-artifact pages such as `D/_knop/_meta/index.html`
- history landing pages
- state pages
- manifestation pages

Template/chrome selection remains adjacent but separate through config vocabulary such as `ResourcePagePresentationConfig`.

## Discovery And Authority

### `_knop/_page` is the only local authority for customized identifier pages

For an identifier `D`, the only local authoritative customization surface for the current identifier page is the owning Knop bundle at `D/_knop/_page`.

For the root identifier, the same rule applies with root-relative paths:

- root Knop: `_knop`
- root page bundle: `_knop/_page`
- root public identifier page: `index.html`

No sibling directory, descendant Knop, mesh-level support artifact, or generic renderer heuristic may override a discovered valid `_knop/_page` definition for that identifier.

### The first-pass discovery convention is filesystem-local and Knop-owned

The first-pass local convention should be:

- `D/_knop/_page/page.ttl` is the current working file for the `ResourcePageDefinition`
- sibling files under `D/_knop/_page/` are the local `ResourcePageBundle` content space
- `D/_knop/_page/_assets/` is the local `ResourcePageAssetBundle`

Runtime discovery should stay anchored to the owning Knop and this bundle boundary. It should not scan arbitrary directories for page manifests.

### Customized page definitions take precedence over generic identifier-page generation

If `D/_knop/_page` is absent, `weave` should continue to generate the current identifier page using the existing generic rules.

If `D/_knop/_page` is present and resolves successfully, that bundle is authoritative for `D/index.html` and should replace generic current identifier-page composition for that identifier only.

If `D/_knop/_page` is present but malformed, unresolved, or otherwise invalid, `weave` must fail closed. It must not silently ignore the bundle and fall back to the generic identifier page.

That pushback matters. Silent fallback would make customization look optional when it is actually a declared source of truth for the public page.

## Source Kinds And Resolution

A `ResourcePageRegion` may resolve content from exactly one first-pass `ResourcePageSource`. Multiple ordered sources per region can wait until real composition pressure appears.

The first-pass source kinds are:

- local bundle files inside `_knop/_page`
- in-mesh governed artifacts
- imported in-tree artifacts whose bytes originated outside the tree or outside the mesh

### Local bundle files

Local authored bundle files are resolved through `ResourcePageBundleFile` plus `pageBundleRelativePath`.

Behavioral consequences:

- relative paths are resolved only against the owning `_knop/_page` bundle
- ordinary Markdown is the default authored text format for `.md` bundle files
- Dendron semantics are not implied by `.md` alone and should activate only under a later explicit interpretation profile
- local bundle files are current-working bundle inputs, not separately governed artifacts by default

### In-mesh artifact sources

A page source may point at an in-mesh governed artifact through the current core vocabulary such as `hasSourceArtifact`, `hasRequestedSourceState`, `hasResourcePageSourceMode`, and `hasResourcePageSourceFallbackPolicy`.

Behavioral consequences:

- the source target is a governed in-mesh artifact, not an arbitrary path string
- `Current` mode follows the source artifact's current `hasWorkingLocatedFile`
- `Pinned` mode follows the requested historical state rather than the working file
- fallback policy constrains what may happen if the requested state cannot be used as requested

### Imported outside content

Outside-the-tree or extra-mesh content is not a first-pass direct page source.

The allowed first-pass path is:

- import the outside content into a governed in-tree artifact
- let that imported artifact expose its current `WorkingLocatedFile`
- have the page definition point at that imported in-tree artifact

At weave time, generation follows the imported in-tree artifact's current `WorkingLocatedFile`, not the outside origin directly.

This keeps page generation reproducible from the current workspace and mesh state instead of turning `weave` into a live fetcher.

## Per-Source Mode And Fallback Semantics

Per-source state, mode, and fallback policy belong to the individual `ResourcePageSource`, not to the page as a whole.

That is a real contract requirement, not just a modeling preference. Different page regions may legitimately follow different artifacts and different state policies.

### Mode

The first-pass source mode contract is:

- `Pinned`: resolve the source against the requested historical state
- `Current`: resolve the source against the artifact's current working file

`Pinned` and `Current` are separate from fallback policy. They should not be collapsed into one enum or one boolean.

### Fallback Policy

The first-pass fallback policy contract is:

- `ExactOnly`: if the requested pinned source cannot be resolved exactly as requested, fail the page resolution
- `AcceptLatestInRequestedHistory`: if the requested pinned state cannot be used as requested, the runtime may fall forward only to the latest available state in the same requested history

`AcceptLatestInRequestedHistory` is a bounded relaxation, not a license to search the whole mesh for something “close enough”.

In particular it must not:

- jump to a different history
- jump from a pinned request to an unrelated working file
- jump to an outside origin
- silently choose a sibling artifact

For local bundle-file sources, mode and fallback do not broaden resolution. The resolved source is the named local bundle file or the operation fails.

## `_knop/_page/_assets` Behavior

`_knop/_page/_assets` is a page-local static asset bundle, not a governed artifact set.

First-pass consequences:

- files under `_knop/_page/_assets` are local current-bundle inputs only
- they do not become `KnopInventory` entries by default
- they do not gain independent history or publication identity by default
- if an asset needs independent reuse, publication identity, or history, it should be promoted to a separate governed artifact and referenced as such

The public identifier page should not expose `_knop/_page/_assets` directly. The first-pass materialization contract should publish those bundled assets into the identifier page's public current surface under `_assets/` relative to the identifier root.

Examples:

- `alice/_knop/_page/_assets/portrait.jpg` materializes publicly as `alice/_assets/portrait.jpg`
- root `_knop/_page/_assets/site.css` materializes publicly as `_assets/site.css`

That public copy/mirroring behavior belongs to current page generation only. It does not make `_assets` a separately governed semantic surface.

## Fail-Closed Behavior

Custom identifier-page handling should fail closed in the first pass.

That includes at least these cases:

- `_knop/_page/page.ttl` is missing after `_knop/_page` has been declared or discovered as present
- the page definition cannot be parsed or validated well enough to resolve regions and sources
- a local bundle file source points outside the bundle boundary
- a pinned in-mesh source cannot be resolved under `ExactOnly`
- an imported-source artifact lacks the in-tree governed artifact or current `WorkingLocatedFile` that generation is supposed to follow
- a page definition attempts to point directly at outside-the-tree or extra-mesh live content instead of an imported in-tree artifact
- a required bundled asset is missing

Fail closed here means:

- do not silently omit the broken region
- do not silently fall back to generic identifier-page generation
- do not fetch live network content during `weave`
- surface the error as a page-generation failure for the operation

## Root Lifecycle Behavior

### Root is a real resource, not `_mesh`

This note inherits the root designator contract from [[wd.completed.2026.2026-04-08_1133-root-designator-path-support]].

The root identifier is the mesh-base resource itself, spelled as `/` on CLI surfaces and normalized to `""` internally. It is not the same thing as `_mesh`.

Consequences for page generation:

- root current identifier page: `index.html`
- root Knop support surface: `_knop/...`
- mesh support surface: `_mesh/...`
- mesh support pages such as `_mesh/index.html` remain separate from root identifier-page behavior

### Root customization uses the same authority boundary

If a root Knop exists at `_knop` and no `_knop/_page` bundle exists, generic current identifier-page generation should produce root `index.html`.

If `_knop/_page` exists and resolves successfully, it is authoritative for root `index.html` just as `alice/_knop/_page` is authoritative for `alice/index.html`.

If the root page bundle is malformed or unresolved, `weave` must fail closed rather than silently generating a generic root page.

### Root lifecycle should stay separate from the late Alice ladder

Root page customization should not be the next branch in the late `13-bob-extracted-woven` continuation.

The root lifecycle starts much earlier:

- a mesh may exist before any root Knop exists
- a root Knop may exist before any root page customization exists
- root `index.html` path rules differ from non-root pages because they must stay slashless and coexist with `_mesh`

Those are enough differences that a separate root-focused fixture series is the cleaner acceptance shape.

## Invariants

- A customized identifier page does not make the identifier itself a payload-bearing artifact.
- `index.html` remains generated public output, not the canonical authored source.
- `_knop/_page` customizes only the current identifier page for its owning resource in this first slice.
- Generic generation remains authoritative for support-artifact pages, history pages, state pages, and manifestation pages unless a later spec says otherwise.
- Outside content must cross an explicit import boundary before it can contribute to page generation.
- The imported in-tree artifact's current `WorkingLocatedFile` is what generation follows.
- Root `index.html` and `_mesh/index.html` remain distinct pages with distinct ownership.
- `_knop/_page/_assets` remains local and ahistorical by default.

## Proposed Acceptance Plan

### Main `mesh-alice-bio` ladder

The first non-root fixture steps should stay on the existing `mesh-alice-bio` ladder.

Proposed next transitions:

- `13-bob-extracted-woven` -> `14-alice-page-customized`
- `14-alice-page-customized` -> `15-alice-page-customized-woven`

Proposed Accord manifests:

- `examples/alice-bio/conformance/14-alice-page-customized.jsonld`
- `examples/alice-bio/conformance/15-alice-page-customized-woven.jsonld`

What `14` should prove:

- Alice gains a knop-owned `_knop/_page` bundle
- the definition uses ordinary Markdown bundle content, not Dendron-only semantics
- at least one region resolves from a local bundle file
- at least one second region or source binding proves per-source independence, ideally using an in-mesh artifact source
- bundled `_assets` content appears only as local page-bundle input, not as new inventory entries

What `15` should prove:

- `alice/index.html` now follows the customized definition rather than the generic identifier renderer
- bundled `_assets` are materialized into `alice/_assets/...`
- Alice support-artifact pages remain under generic generation unless separately specified
- malformed or unresolved bundle inputs would have failed the operation instead of falling back silently

### Follow-on non-root coverage

The next likely non-root transitions after `15` should cover import-boundary behavior rather than jump straight into a bigger templating story.

Proposed names:

- `16-alice-page-imported-source`
- `17-alice-page-imported-source-woven`

Proposed Accord manifests:

- `examples/alice-bio/conformance/16-alice-page-imported-source.jsonld`
- `examples/alice-bio/conformance/17-alice-page-imported-source-woven.jsonld`

Those should prove:

- an outside-origin content path must first land in a governed in-tree artifact
- page generation follows that imported artifact's current `WorkingLocatedFile`
- a direct live outside-source attempt fails closed

### Separate root-focused fixture series

Root-page customization belongs in a separate fixture ladder or branch family, even if it stays in the same repository.

Proposed root-focused steps:

- `root-01-root-knop-created`
- `root-02-root-knop-created-woven`
- `root-03-root-page-customized`
- `root-04-root-page-customized-woven`

Proposed Accord manifests:

- `examples/alice-bio/conformance/root-01-root-knop-created.jsonld`
- `examples/alice-bio/conformance/root-02-root-knop-created-woven.jsonld`
- `examples/alice-bio/conformance/root-03-root-page-customized.jsonld`
- `examples/alice-bio/conformance/root-04-root-page-customized-woven.jsonld`

What the root series should prove:

- root `index.html` exists only when a root Knop exists
- root `_knop/_page` customizes `index.html`, not `_mesh/index.html`
- root bundled assets materialize at `_assets/...` without leading slashes
- root current-page discovery and authority follow the same `_knop/_page` rules as non-root pages
- root-specific path layout remains slashless and coexists correctly with `_mesh/...`

## Non-Goals

This note does not specify:

- the full config ontology for templates and chrome
- multiple ordered sources per region
- a generic CMS or live remote-content pipeline
- historical page-definition versioning policy in detail
- support-artifact page customization beyond the current identifier page
