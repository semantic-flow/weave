---
id: 4yb6bmtj3yq4xq0d9h8s2pe
title: 2026 04 11 Identifier Page Customization And Root Lifecycle
desc: ''
updated: 1775902232359
created: 1775902232359
---

## Purpose

This note captures the current intended behavior for identifier-page customization driven by a knop-owned `_knop/_page` support artifact.

It is an implementation-facing behavior spec for the first identifier-page customization slice, not a final public API contract or a full template-system design.

## Status

The ontology/config direction from [[wd.task.2026.2026-04-08_1735-page-definition-ontology-and-config]] is now settled enough to write the runtime contract.

The first implementation-bearing acceptance targets proposed here are:

- `mesh-alice-bio` late-ladder transitions for non-root identifier-page customization
- later `mesh-alice-bio` continuation steps for root lifecycle and root page customization

Adding a root later in the mesh lifecycle is a normal case, so root coverage does not need its own separate fixture series by default.

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

### `_knop/_page` is the only local authority for identifier-page customization

For an identifier `D`, the only local authoritative customization surface for the current identifier page is the owning Knop support artifact at `D/_knop/_page`.

For the root identifier, the same rule applies with root-relative paths:

- root Knop: `_knop`
- root page definition artifact: `_knop/_page`
- root public identifier page: `index.html`

No sibling directory, descendant Knop, mesh-level support artifact, or generic renderer heuristic may override a discovered valid `_knop/_page` definition for that identifier.

### The first-pass discovery convention is filesystem-local and Knop-owned

The first-pass local convention should be:

- `D/_knop/_page/page.ttl` is the current working file for the `ResourcePageDefinition`
- `D/_knop/_page` is a normal support-artifact surface and should not become a general container for auxiliary authored files
- when local filesystem-authored page inputs are used, they live on the owning `D/_knop/...` surface outside `_page`
- `D/_knop/_assets/` is the local Knop-owned asset area for page support files referenced by the definition

Runtime discovery should stay anchored to the owning Knop and the `_knop/_page/page.ttl` working file. It should not scan arbitrary directories for page manifests.

### Customized page definitions take precedence over generic identifier-page generation

If `D/_knop/_page` is absent, `weave` should continue to generate the current identifier page using the existing generic rules.

If `D/_knop/_page` is present and resolves successfully, that definition is authoritative for `D/index.html` and should replace generic current identifier-page composition for that identifier only.

If `D/_knop/_page` is present but malformed, unresolved, or otherwise invalid, `weave` must fail closed. It must not silently ignore the definition and fall back to the generic identifier page.

That pushback matters. Silent fallback would make customization look optional when it is actually a declared source of truth for the public page.

## `ResourcePageDefinition` History And State Behavior

The `ResourcePageDefinition` at `D/_knop/_page` is a normal support artifact and should participate in history/state materialization the same way other support artifacts do.

Behavioral consequences:

- the working definition file remains `D/_knop/_page/page.ttl`
- when explicit histories are materialized for the page-definition artifact, they should follow the same support-artifact history/state conventions used elsewhere in the mesh
- a change to the `ResourcePageDefinition` should be versioned as a change to that support artifact, not treated as an untracked local-only helper-file mutation
- generic support-artifact generation should remain responsible for any `_knop/_page` artifact landing pages, history landing pages, state pages, and manifestation pages unless a later spec says otherwise

This does not imply recursive history for the surrounding local support inputs:

- mesh-local authored files referenced by `page.ttl` do not become separate governed artifacts by default
- `_knop/_assets` remains local and ahistorical by default
- those helper files participate through the current state of the `ResourcePageDefinition` artifact and its working file, not by each gaining their own independent support-artifact histories automatically

## Source Kinds And Resolution

A `ResourcePageRegion` may resolve content from exactly one first-pass `ResourcePageSource`. Multiple ordered sources per region can wait until real composition pressure appears.

The first-pass source kinds are:

- mesh-local files referenced by `page.ttl`
- in-mesh governed artifacts
- imported in-tree artifacts whose bytes originated outside the tree or outside the mesh

### Mesh-local files

Local authored files are resolved through `targetMeshPath` directly on the `ResourcePageSource`.

Behavioral consequences:

- the path stays relative to the mesh root rather than becoming an absolute filesystem path
- the path may point at a natural mesh location such as `alice/alice.md` or a shared helper file such as `mesh-content/sidebar.md`; Knop-local placement is allowed but not required
- a later operational profile may allow `../` traversal beyond the mesh root, but only within an explicitly configured allowed local-directory boundary
- ordinary Markdown is the default authored text format for `.md` helper files
- Dendron semantics are not implied by `.md` alone and should activate only under a later explicit interpretation profile
- mesh-local path inputs are current-working local inputs, not separately governed artifacts by default

### In-mesh artifact sources

A page source may point at an in-mesh governed artifact through the generic `ArtifactResolutionTarget` fields such as `hasTargetArtifact`, `hasRequestedTargetState`, `hasArtifactResolutionMode`, and `hasArtifactResolutionFallbackPolicy`, used directly on `ResourcePageSource`.

Behavioral consequences:

- the source target is a governed in-mesh artifact, not an arbitrary path string
- `Current` mode follows the source artifact's `workingFilePath` when present, otherwise its `workingAccessUrl` when an operational profile explicitly allows remote current-byte access, otherwise its current `hasWorkingLocatedFile`
- `Pinned` mode follows the requested historical state rather than the working file
- fallback policy constrains what may happen if the requested state cannot be used as requested

For this first page-generation slice, a governed source artifact that resolves only through `workingAccessUrl` should still be treated as out of bounds unless a later spec explicitly widens page generation to permit remote current-byte access. The broader artifact model may name that current surface now without requiring `weave` to follow it yet.

### Direct access-URL targets

The broader `ArtifactResolutionTarget` model may also name target bytes directly through `targetAccessUrl`.

Behavioral consequences:

- `targetAccessUrl` is the direct remote/external counterpart to `targetMeshPath`
- it names target bytes without requiring an intermediate governed artifact or `LocatedFile`
- using it remains subject to explicit operational network policy

For this first page-generation slice, direct `targetAccessUrl` on `ResourcePageSource` should still be treated as out of bounds unless a later spec explicitly widens page generation to permit remote target access.

### Working-Path Precedence And Consistency

For governed artifacts, `workingFilePath` and `hasWorkingLocatedFile` do different jobs.

- `workingFilePath` is the operational local-path hook that runtime should use to find the current working bytes
- `workingAccessUrl` is the operational remote/external current-byte hook when a runtime is explicitly allowed to fetch or stream current bytes from outside the local filesystem
- `hasWorkingLocatedFile` remains the semantic `LocatedFile` relation when the current working bytes are also modeled as a mesh-addressable file resource
- if multiple current-byte locators are present and denote the same current working surface, they should agree
- if multiple current-byte locators are present and disagree about the current working bytes, the runtime should fail closed rather than silently picking one
- if `workingFilePath` points outside the mesh tree under an allowed local-directory policy, `hasWorkingLocatedFile` may be absent
- if only `workingAccessUrl` is present, a runtime that does not explicitly allow remote current-byte access should fail closed rather than silently fetching

### Operational Boundary For Local Paths

Allowed local-path boundaries for `targetMeshPath` and `workingFilePath`, and network-use policy for `targetAccessUrl` and `workingAccessUrl`, belong to operational configuration, not to page-definition RDF itself.

First-pass implications:

- core ontology should carry the relative path values, not absolute host paths
- runtime configuration should define which directories are allowed when local paths use `../`
- runtime configuration should define whether direct remote target access through `targetAccessUrl` is allowed at all, and if so under which origin/scheme constraints
- runtime configuration should define whether remote current-byte access through `workingAccessUrl` is allowed at all, and if so under which origin/scheme constraints
- earlier host-config work such as `dependencies/github.com/semantic-flow/ontology/old/sflo-host-ontology.jsonld` is relevant precedent, but the exact config vocabulary can remain separate from this page-definition contract

### Imported outside content

Outside-the-tree or extra-mesh content is not a first-pass direct page source.

The allowed first-pass path is:

- import the outside content into a governed in-tree artifact
- let that imported artifact expose its current `WorkingLocatedFile`
- have the page definition point at that imported in-tree artifact

At weave time, generation follows the imported in-tree artifact's current `WorkingLocatedFile`, not the outside origin directly.

This keeps page generation reproducible from the current mesh state instead of turning `weave` into a live fetcher.

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

For direct local file sources, mode and fallback do not broaden resolution. The resolved source is the named local file or the operation fails.

## `_knop/_assets` Behavior

`_knop/_assets` is the Knop-owned local static asset area used by identifier-page customization, not a governed artifact set.

First-pass consequences:

- files under `_knop/_assets` are local current support inputs only
- they do not become `KnopInventory` entries by default
- they do not gain independent history or publication identity by default
- if an asset needs independent reuse, publication identity, or history, it should be promoted to a separate governed artifact and referenced as such

The public identifier page may reference `_knop/_assets/...` directly. `weave` should not copy or mirror those files into `alice/_assets/...` or root `_assets/...` as a separate generated current surface.

Examples:

- `alice/_knop/_assets/portrait.jpg` remains `alice/_knop/_assets/portrait.jpg`
- root `_knop/_assets/site.css` remains `_knop/_assets/site.css`

That direct-reference behavior does not make `_knop/_assets` a separately governed semantic surface.

## Fail-Closed Behavior

Custom identifier-page handling should fail closed in the first pass.

That includes at least these cases:

- `_knop/_page/page.ttl` is missing after `_knop/_page` has been declared or discovered as present
- the page definition cannot be parsed or validated well enough to resolve regions and sources
- a `targetMeshPath` source is malformed, missing, or escapes the currently allowed local-directory boundary
- a `targetAccessUrl` source is present, but the active operational profile does not allow remote target access
- a governed source artifact has inconsistent `workingFilePath` and `hasWorkingLocatedFile` assertions for the same current working surface
- a governed source artifact resolves only through `workingAccessUrl`, but the active operational profile does not allow remote current-byte access
- a pinned in-mesh source cannot be resolved under `ExactOnly`
- an imported-source artifact lacks the in-tree governed artifact or current `WorkingLocatedFile` that generation is supposed to follow
- a page definition attempts to point directly at outside-the-tree or extra-mesh live content instead of an imported in-tree artifact
- a required `_knop/_assets` file is missing

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

If a root Knop exists at `_knop` and no `_knop/_page` definition exists, generic current identifier-page generation should produce root `index.html`.

If `_knop/_page` exists and resolves successfully, it is authoritative for root `index.html` just as `alice/_knop/_page` is authoritative for `alice/index.html`.

If the root page definition is malformed or unresolved, `weave` must fail closed rather than silently generating a generic root page.

### Root lifecycle can continue on the same ladder

The root lifecycle starts much earlier:

- a mesh may exist before any root Knop exists
- a root Knop may exist before any root page customization exists
- root `index.html` path rules differ from non-root pages because they must stay slashless and coexist with `_mesh`

Those differences still matter, but they do not require a separate fixture series. Adding a root later on the carried `mesh-alice-bio` ladder is a legitimate lifecycle case and should remain a normal acceptance path.

## Invariants

- Identifier-page customization does not make the identifier itself a payload-bearing artifact.
- `index.html` remains generated public output, not the canonical authored source.
- `_knop/_page` customizes only the current identifier page for its owning resource in this first slice.
- Generic generation remains authoritative for support-artifact pages, history pages, state pages, and manifestation pages unless a later spec says otherwise.
- Outside content must cross an explicit import boundary before it can contribute to page generation.
- The imported in-tree artifact's current `WorkingLocatedFile` is what generation follows.
- Root `index.html` and `_mesh/index.html` remain distinct pages with distinct ownership.
- `_knop/_assets` remains local and ahistorical by default.

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

- Alice gains a knop-owned `_knop/_page` support artifact plus mesh-local authored inputs at natural repository paths
- the definition uses ordinary Markdown local content, not Dendron-only semantics
- at least one region resolves from a mesh-local file outside `_knop/_page`
- at least one second local region proves multi-region composition without yet requiring in-mesh or imported source support
- `_knop/_assets` content appears only as Knop-local support input, not as new inventory entries

What `15` should prove:

- `alice/index.html` now follows the customized definition rather than the generic identifier renderer
- `alice/index.html` may reference `alice/_knop/_assets/...` directly, without a copied `alice/_assets/...` surface
- Alice support-artifact pages remain under generic generation unless separately specified
- malformed or unresolved `targetMeshPath` inputs would have failed the operation instead of falling back silently

### Follow-on non-root coverage

The next likely non-root transitions after `15` should first introduce and weave the governed Markdown artifact that later page sourcing will reference, then catch the carried fixture ladder up to the artifact-backed behavior already implemented in runtime, and only then move to import-boundary behavior.

Proposed names:

- `16-alice-page-main-integrated`
- `17-alice-page-main-integrated-woven`
- `18-alice-page-artifact-source`
- `19-alice-page-artifact-source-woven`
- `20-bob-page-imported-source`
- `21-bob-page-imported-source-woven`

Proposed Accord manifests:

- `examples/alice-bio/conformance/16-alice-page-main-integrated.jsonld`
- `examples/alice-bio/conformance/17-alice-page-main-integrated-woven.jsonld`
- `examples/alice-bio/conformance/18-alice-page-artifact-source.jsonld`
- `examples/alice-bio/conformance/19-alice-page-artifact-source-woven.jsonld`
- `examples/alice-bio/conformance/20-bob-page-imported-source.jsonld`
- `examples/alice-bio/conformance/21-bob-page-imported-source-woven.jsonld`

`16/17` should prove:

- a governed in-mesh Markdown-bearing artifact such as `alice/page-main` can be integrated and woven before any page-definition repoint happens
- the ladder treats that step as ordinary in-mesh artifact integration, not as import from an outside origin
- Alice's existing page definition and public `alice/index.html` stay unchanged while that governed source artifact is prepared

`18/19` should prove:

- one Alice page region now targets a governed in-mesh Markdown-bearing artifact such as `alice/page-main` rather than an RDF dataset artifact
- page generation follows that artifact's current working surface rather than a direct `targetMeshPath`
- the carried fixture pair stays narrow at default / `Current` behavior and does not yet require pinned-state or fallback semantics

`20/21` should prove:

- Bob page customization can be introduced through an outside-origin import without immediately overwriting Alice's settled local and artifact-backed customization steps
- an outside-origin content path must first land in a governed in-tree artifact
- page generation follows that imported artifact's current `WorkingLocatedFile`
- the first carried import-boundary pair should use imported Markdown or similarly plain authored text that the current page renderer can consume directly
- importing an RDF dataset as page content should remain a later transformation/extraction concern rather than an implied capability of the first import-boundary fixture pair
- the first carried remote-import example should prefer a direct file/export URL rather than an endpoint that only becomes usable through HTTP request-shaping such as custom `Accept` headers

The corresponding fail-closed direct-outside-source rejection should be covered in focused runtime/integration tests rather than forced into a successful fixture transition. Support for remote RDF sites that require content negotiation or custom request headers should stay a follow-on operational/import feature rather than a prerequisite for the first carried import-boundary pair.

### Root-focused continuation on the same ladder

Root-page customization should continue on the same carried `mesh-alice-bio` ladder rather than being split into a separate fixture family by default.

Proposed root-focused continuation steps:

- `22-root-knop-created`
- `23-root-knop-created-woven`
- `24-root-page-customized`
- `25-root-page-customized-woven`

Proposed Accord manifests:

- `examples/alice-bio/conformance/22-root-knop-created.jsonld`
- `examples/alice-bio/conformance/23-root-knop-created-woven.jsonld`
- `examples/alice-bio/conformance/24-root-page-customized.jsonld`
- `examples/alice-bio/conformance/25-root-page-customized-woven.jsonld`

What the root continuation should prove:

- root `index.html` exists only when a root Knop exists
- root `_knop/_page` customizes `index.html`, not `_mesh/index.html`
- root Knop-owned assets remain at `_knop/_assets/...` without leading slashes
- root current-page discovery and authority follow the same `_knop/_page` rules as non-root pages
- root-specific path layout remains slashless and coexists correctly with `_mesh/...`

## Non-Goals

This note does not specify:

- the full config ontology for templates and chrome
- multiple ordered sources per region
- a generic CMS or live remote-content pipeline
- historical page-definition versioning policy in detail
- support-artifact page customization beyond the current identifier page
