---
id: 3m3w2gj2q3b0u9t8e1r4h7k
title: 2026 04 13_1245 Bob Import Boundary For Page Source
desc: ''
created: 1776109500000
---

## Goals

- Define the first real `import`-boundary slice needed to carry `20/21` for Bob page customization.
- Keep the import story honest: outside-origin bytes should cross an explicit governed in-tree boundary before page generation follows them.
- Pick a first narrow outside-origin source shape that the current Markdown-oriented page renderer can actually consume.

## Summary

Alice page customization has now progressed through:

- `16/17`: governed Markdown source artifact introduced and woven
- `18/19`: Alice page definition repointed to that governed artifact and woven

The next planned pair, `20/21`, is materially different. It is not just another page-definition variation. It is the first slice that needs an explicit outside-origin import boundary.

Today, Weave does not yet have:

- an `import` planner/runtime/CLI surface
- settled import-facing ontology vocabulary for current outside-origin associations
- a carried fixture pair proving imported Markdown content flows through a governed in-tree artifact into page generation

So the next productive step is to define that slice concretely before trying to carry or implement it.

## Discussion

Bob is a better place than Alice to prove the import boundary because:

- Alice already has a coherent direct-local and artifact-backed page-source progression through `19`
- Bob already has a woven identifier page from extraction, so a Bob-specific customization step does not overwrite the meaning of the Alice ladder
- the user-facing effect is easy to understand: Bob's generic extracted page becomes a customized page that follows imported Markdown content

The key distinction to preserve is:

- `integrate` associates local bytes with a governed artifact
- `import` should establish a governed local artifact boundary for bytes that originated outside the mesh tree or outside the repo

For the first Bob slice, the outside-origin source should be:

- directly fetchable through a stable URL
- Markdown or similarly plain authored text
- small enough to keep the carried fixture understandable
- usable without content negotiation tricks such as custom `Accept` headers

The first slice should not imply:

- remote RDF dataset rendering as page content
- live `targetAccessUrl` page sourcing
- remote `workingAccessUrl` current-byte following during page generation

Instead, it should prove a narrower sequence:

1. fetch or otherwise import outside-origin Markdown
2. store it as the working bytes of a governed in-tree Bob artifact
3. point Bob's `ResourcePageDefinition` at that governed artifact
4. weave Bob so the imported content shows up in `bob/index.html`

For the first carried example, the chosen outside-origin Markdown source is:

- `https://raw.githubusercontent.com/djradon/public-notes/refs/heads/main/user.bob-newhart.md`

This does introduce one deliberate semantic asymmetry: the imported page content is explicitly about Bob Newhart, while the currently extracted Bob graph in `mesh-alice-bio` remains a much thinner generic `schema:Person` description. That is acceptable for this slice because `20/21` are proving the import boundary and page-source flow, not RDF reconciliation between extracted local triples and imported authored page copy.

## Open Issues

- Should the first runtime import slice fetch directly from URL, or should it accept a pre-fetched imported file plus explicit origin metadata and leave network fetch for a follow-on?
- How much additional import/provenance metadata is needed beyond the first-pass `core:workingAccessUrl` marker on the governed artifact?
- How much of the import slice belongs in core ontology versus config or later provenance work?

## Decisions

- The first carried Bob import slice should use authored text that the current page renderer can consume directly.
- The first carried Bob import slice should avoid RDF dataset content and HTTP content negotiation.
- Direct live remote page-source resolution remains out of scope; import must establish the governed in-tree boundary first.
- This task should stay distinct from [[wd.task.2026.2026-04-11_1723-operational-config-for-runtime-resolution]]. Operational policy may later govern remote fetch, but that task is not a substitute for an import boundary.
- The first carried Bob import slice should use `https://raw.githubusercontent.com/djradon/public-notes/refs/heads/main/user.bob-newhart.md` as the outside-origin Markdown source.
- The first carried Bob import slice should introduce governed artifact `bob/page-main` with local working file `bob-page-main.md`.
- The first carried Bob import slice should record the chosen outside-origin URL on the governed artifact through `core:workingAccessUrl` while page generation still follows the local `hasWorkingLocatedFile` boundary rather than the remote URL directly.
- The first carried Bob import slice is allowed to use authored page content that is semantically richer than the current extracted Bob triples; RDF reconciliation is explicitly outside this slice.

## Contract Changes

- Introduce a first implementation-facing `import` contract for outside-origin content that becomes governed local artifact state.
- Clarify how imported current bytes relate to existing `workingFilePath`, `workingAccessUrl`, and page-source artifact resolution semantics.
- Potentially introduce first-pass import metadata expectations in ontology/config notes if implementation requires them.

## Testing

- Draft `20-bob-page-imported-source.jsonld` and `21-bob-page-imported-source-woven.jsonld` once the first import-facing artifact shape is settled.
- Add integration coverage for:
  - explicit outside-origin import into a governed Bob artifact
  - Bob page generation following that governed artifact
  - fail-closed behavior when imported-source metadata exists but the governed local working surface does not
- Keep direct-live remote rejection in focused runtime/integration tests rather than encoding it as a successful Accord transition.

## Non-Goals

- General remote target fetching for `targetAccessUrl`
- General remote current-byte following for `workingAccessUrl`
- RDF-dataset-to-Markdown transformation
- Content-negotiated RDF fetch with custom `Accept` headers in the first carried import slice

## Implementation Plan

### Phase 0: Define The Bob Import Shape

- [x] Decide the first carried imported Bob artifact identity and working file naming.
- [x] Decide the minimum import-facing metadata required for the first carried slice.
- [x] Choose a stable direct URL for imported Markdown content.

### Phase 1: Align Specs And Acceptance Drafts

- [x] Update [[wd.task.2026.2026-04-08_1545-resource-page-definition-and-sources]] so `20/21` are described as the first true import-boundary pair now that `16-19` are real.
- [x] Update [[wd.spec.2026-04-11-identifier-page-customization-and-root-lifecycle]] with the first concrete Bob import-boundary shape.
- [x] Draft `20-bob-page-imported-source.jsonld` and `21-bob-page-imported-source-woven.jsonld`.

### Phase 2: Implement The First Import Surface

- [ ] Add the first runtime/core import slice needed to materialize imported Markdown into a governed Bob artifact.
- [ ] Keep the first import implementation fail-closed and narrow.
- [ ] Avoid broadening page generation to live remote sources as part of this slice.

### Phase 3: Carry The Fixture Pair

- [ ] Create `20-bob-page-imported-source` in `mesh-alice-bio`.
- [ ] Weave it into `21-bob-page-imported-source-woven`.
- [ ] Publish the pair only after the manifests and runtime behavior agree.
