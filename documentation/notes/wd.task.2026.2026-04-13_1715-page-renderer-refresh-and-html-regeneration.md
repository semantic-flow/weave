---
id: y7q4m2k8n6v1p3r5t9x4c2b
title: 2026 04 13_1715 Page Renderer Refresh And HTML Regeneration
desc: ''
created: 1776129300000
---

## Goals

- Improve the current generated-page renderer so imported and authored Markdown content looks intentionally rendered rather than raw-ish.
- Define a shared styling direction for generated pages so root and identifier pages do not feel like unrelated one-off surfaces.
- Clarify how HTML regeneration should work when renderer behavior changes, without pretending that a renderer refresh is a new semantic lifecycle transition on the carried fixture ladder.

## Summary

The root page now looks deliberate because:

- `home.md` was authored to fit the current simple renderer
- root has explicit `_knop/_assets/site.css`
- root page layout uses separate `main` and `sidebar` regions

Bob looks rough for a different reason:

- `bob/index.html` is rendering imported Markdown through a deliberately shallow renderer
- the imported file includes YAML frontmatter, reference-style links, emphasis, and `*` bullets that the current renderer does not handle well

So the next renderer-facing step should be treated as a page-renderer refresh and HTML regeneration task, not as another semantic page-source ladder step like `20/21` or `24/25`.

## Discussion

### Why this should not become another carried semantic branch

The carried ladder is currently doing a good job of showing semantic state transitions:

- new support artifacts
- new histories and states
- repointed page sources
- imported-source boundaries
- root lifecycle

A renderer refresh is different.

If we improve Markdown rendering or start injecting a shared stylesheet into all generated pages, we are changing derived HTML output for already-settled branch states. That is more like a regeneration pass than a new semantic lifecycle event.

So the right framing is:

- improve renderer behavior
- define any shared CSS injection or page-shell changes
- regenerate the affected HTML surfaces
- decide how carried fixtures and manifests should be refreshed to match the new generated output

That is a valid task. It is just not the same kind of task as `14/15` or `20/21`.

### Immediate renderer shortcomings

The current renderer should improve at least these cases:

- strip or ignore YAML frontmatter at the top of Markdown files
- support emphasis such as `*italic*` and `**bold**`
- support `*` bullet lists as well as `-` bullet lists
- support reference-style links such as `[Wikipedia][1]` with later link definitions
- keep fail-closed behavior reasonable when malformed link references appear

The current Bob page is a good forcing case because it already exposes all of those shortcomings in one small example.

### Shared stylesheet direction

We should likely introduce a shared generated-page stylesheet for renderer-owned chrome and typography.

The most natural home is probably mesh-scoped rather than root-Knop-scoped, because this is about common generated-page presentation rather than root-page-only customization.

The likely direction is something like:

- `_mesh/_assets/site.css`

Then:

- generic identifier pages can link it
- page-definition-driven pages can link it
- root pages can still layer their own `_knop/_assets/site.css` or similar on top when needed

That is cleaner than treating the root page's current stylesheet as if it were already the global shared stylesheet.

### Relationship to `bob/page-main/index.html`

`bob/page-main/index.html` is still absent today because `20/21` intentionally leave `bob/page-main` itself unwoven.

That is not a renderer bug.

It means:

- Bob's page definition follows `bob/page-main`
- but `bob/page-main` has not itself been woven into a public artifact page yet

If we want `bob/page-main/index.html`, that is a separate weave/generate question for the artifact itself.

### Relationship to `generate`

There is probably a real `generate`/regenerate seam here:

- re-render current HTML surfaces from already-settled artifact/page-definition state
- avoid pretending that regeneration itself is a new artifact-history event
- make it possible to refresh carried fixture HTML output after renderer changes

That may become the first concrete surface where a renderer refresh is exercised across the whole mesh.

## Open Issues

- Whether shared page CSS should be a generated mesh-level asset, a checked-in mesh asset, or a runtime-bundled asset.
- Whether reference-style links should be fully supported or normalized during import instead.
- How broad the first renderer improvement should be before we risk re-implementing a full Markdown engine ad hoc.
- Whether the first regeneration pass should be a dedicated `generate` command story, or whether it should remain internal to `weave` until the seams are cleaner.
- How Accord acceptance should compare regenerated HTML when the semantic state is unchanged but the renderer changed.

## Decisions

- Renderer refresh should be tracked as its own task rather than being hidden inside the Bob import or page-source tasks.
- A renderer refresh should not automatically be treated as a new semantic ladder branch.
- Bob's current raw-ish page output is a renderer limitation, not evidence that `20/21` targeted the wrong artifact.
- Shared generated-page styling should be explored as a mesh-level concern before we try to force root-specific CSS into every page.

## Contract Changes

- Define the next intended Markdown-rendering subset for generated pages.
- Define how shared generated-page styling is injected.
- Define how regeneration of derived HTML should relate to already-settled carried fixture states.

## Testing

- Add focused renderer tests for frontmatter stripping, emphasis, `*` list handling, and reference-style links.
- Add Bob-focused integration coverage that proves imported Markdown renders cleanly without literal frontmatter blocks.
- Add coverage for shared stylesheet injection on both generic and page-definition-driven pages if that behavior lands.

## Non-Goals

- Replacing the page renderer with a full Markdown engine immediately.
- Turning the carried fixture ladder into a stream of renderer-only semantic branches.
- Solving imported RDF-to-page-content transformation in this same task.

## Implementation Plan

### Phase 0: Define The Refresh Boundary

- [ ] Decide what should count as renderer-owned derived HTML refresh versus semantic artifact-state change.
- [ ] Decide where a shared generated-page stylesheet should live.

### Phase 1: Improve The Markdown Subset

- [ ] Strip or ignore YAML frontmatter before block rendering.
- [ ] Support emphasis, `*` list bullets, and reference-style links.
- [ ] Keep the renderer small and predictable rather than quietly broadening into a general-purpose Markdown engine.

### Phase 2: Shared Page Styling

- [ ] Define the first shared generated-page stylesheet shape and injection rules.
- [ ] Decide how page-definition-driven custom CSS layers on top of the shared stylesheet.

### Phase 3: Regeneration Surface

- [ ] Decide whether the first regeneration pass should ride on `generate`, `weave`, or an internal refresh helper.
- [ ] Refresh carried HTML outputs and acceptance expectations after the renderer contract is settled.
