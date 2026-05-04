---
id: 348segdrcq0dsum9ygzu4dg
title: 2026 05 03 Resource Page Renderer Refresh
desc: ''
updated: 1777877898292
created: 1777859406686
---

## Goals

- Make Weave's generic generated ResourcePages substantially more presentable without requiring per-resource `_knop/_page` definitions.
- Add raw RDF panels to generated `RdfDocument` ResourcePages when Weave can resolve local current or historical bytes.
- Establish a small internal theme seam so the default look and feel is implementation-owned now, but can later be selected by mesh or local config.
- Keep page-content composition, presentation config, and runtime information architecture separate.

## Summary

This task refreshes Weave's built-in ResourcePage renderer. The immediate deliverable is an attractive, functional default page baseline for generated mesh, Knop, artifact, history, state, manifestation, located-file, inventory, meta, config, and support-artifact pages. The sidecar fantasy-rules fixture should be the first proving ground, especially ontology and SHACL `RdfDocument` pages.

The first implementation slice should not build a full portable theme package system. Instead, Weave should gain a clear internal `ResourcePageTheme` or equivalent renderer abstraction, register a compiled-in default theme, and render richer structured page inputs through it. Later config work can expose theme selection through mesh-carried or local operational config.

For `RdfDocument` pages, generated HTML should expose the actual RDF source bytes inline when those bytes are locally available. The raw file link should remain available for tools, downloads, copy workflows, and RDF processors.

## Discussion

The existing `_knop/_page` model is a content/composition override, not the generic theming mechanism. `D/_knop/_page/page.ttl` is authoritative for the current identifier page at `D/index.html` when it exists and resolves successfully, but most resources should not need to carry a `_page` support artifact merely to receive good default presentation.

The relevant prior design notes already separate these concerns:

- [[wd.task.2026.2026-04-08_1545-resource-page-definition-and-sources]] defines `_knop/_page` as the local authoritative page-definition support artifact and says template/chrome policy should remain adjacent to content composition.
- [[wd.task.2026.2026-04-08_1735-page-definition-ontology-and-config]] captures the modernized config direction, including `ResourcePagePresentationConfig`, first-class template/style resources, and a rejection of regex-heavy template mapping as the first boundary.
- [[sf.spec.2026-04-11-identifier-page-customization-and-root-lifecycle]] specifies that `_knop/_page` customizes one current identifier page and does not replace generic generation for mesh, support-artifact, history, state, or manifestation pages.
- [[wd.task.2026.2026-05-02-fantasy-rules-sidecar]] identifies the fantasy-rules sidecar fixture as the current pressure point for better ontology/SHACL pages and inline raw RDF rendering.

The clean mechanism is effective presentation config resolution. The intended precedence is:

1. page-specific presentation config attached to a `ResourcePageDefinition`
2. future resource- or Knop-specific presentation defaults
3. mesh-carried default ResourcePage presentation config
4. Weave local or operational default theme
5. Weave compiled-in fallback theme

Only the last layer needs to be implemented in the first renderer-refresh slice. The internal seams should avoid blocking later config support, but they should not pretend to solve external theme distribution before the default renderer has a concrete shape.

Runtime code should continue to compute page data such as resource identity, labels, descriptions, classes, breadcrumbs, navigation targets, support-artifact links, current/historical file links, and resolved raw byte panels. Templates or theme functions should render structured inputs; they should not own RDF discovery, local path policy, navigation computation, or history/state interpretation.

Raw RDF panels should start simple: escaped text in a readable source panel, preferably with a clear raw-file link and provenance label such as current working bytes, historical located file bytes, or manifestation bytes. Syntax highlighting and client-side enhancements can be added later if the static HTML remains useful without JavaScript.

Knop pages should show the artifacts managed by the Knop rather than the artifact-history tree for those artifacts. The current default presentation should separate governed artifacts, such as payload artifacts, from supporting artifacts, such as Knop metadata, Knop inventory, reference catalogs, page definitions, and asset bundles.

History sections can grow long as named histories and semver states accumulate. The default renderer should keep long repeated lists readable with a generic truncation rule: if a repeated History-section list has more than 10 items, show the first 2 and last 7 with a vertical ellipsis gap marker. Paging or dynamic loading can come later.

## Open Issues

- What conservative byte-size limit should Weave use before omitting or collapsing an inline raw-source panel?
- Should raw RDF panels be expanded by default, collapsed by default, or expanded only for small documents?
- Should the initial default theme emit embedded CSS in every generated page, or write a shared generated asset under the mesh root?
- What exact ontology/config terms should later express mesh-level default ResourcePage presentation config, for example `sfcfg:hasDefaultResourcePagePresentationConfig` and `sfcfg:ResourcePageTheme`?
- Should generated page URLs eventually polish trailing-slash display with `history.replaceState`, or should that stay outside this renderer-refresh slice?

## Decisions

- The first implementation should improve Weave's compiled-in generic ResourcePage renderer, not require mesh-carried theme artifacts.
- `_knop/_page` remains a per-resource page-content/composition override and is not required for default themed ResourcePages.
- The first theme seam should be internal to Weave, with a single built-in default theme.
- Mesh-level and local theme selection should be documented as future config layers, not implemented before the default renderer is useful.
- Raw RDF rendering belongs to generic `RdfDocument` ResourcePages when local bytes are available, not to fixture-specific page HTML.
- Raw RDF source links should remain available even when inline panels are rendered.
- Presentation code may improve layout, typography, navigation, and source panels, but runtime code remains responsible for resolving RDF facts and local bytes.
- Inline raw-source panels should be omitted above 1 MiB, while preserving the raw file link and reporting the omitted byte count.
- Raw-source panels are expanded by default in this slice. Future composition-rich pages may choose to collapse source panels when additional imported page content is present.
- The initial built-in theme emits embedded CSS in each generated generic ResourcePage. A shared generated asset can be revisited when there is enough theme/config machinery to manage cache and path behavior cleanly.
- Recommended future config vocabulary terms are `sfcfg:hasDefaultResourcePagePresentationConfig` for mesh/default attachment, `sfcfg:ResourcePagePresentationConfig` for the config node, and `sfcfg:ResourcePageTheme` for the selected theme resource/class.
- This slice includes minimal trailing-slash browser polish with `history.replaceState` while keeping canonical links authoritative.
- Knop pages should show governed and supporting artifacts, not the History-section tree for those artifacts.
- Long History-section lists should use the generic first-2/last-7 truncation rule with a vertical ellipsis gap marker.

## Contract Changes

- Generated `RdfDocument` ResourcePages should include an inline raw RDF panel when the relevant current working file, historical located file, or manifestation bytes are locally resolvable under policy.
- Generated ResourcePages should expose clearer structured navigation among the resource, its Knop where applicable, support artifacts, histories, states, manifestations, located files, and raw source files.
- Generated Knop ResourcePages should expose governed artifacts and supporting artifacts without rendering the generic History section for the Knop page itself.
- Generated History sections should truncate repeated lists longer than 10 items by rendering the first 2 and last 7 items with an explicit vertical ellipsis gap marker.
- Weave should have a compiled-in ResourcePage presentation fallback that applies when no more specific presentation config is available.
- Future config work should be able to layer page-specific, mesh-level, local, and implementation fallback presentation choices without changing `_knop/_page` semantics.

## Testing

- Add HTML-level tests for `RdfDocument` pages proving raw Turtle is escaped and rendered from the correct local bytes.
- Add tests for current working RDF bytes and historical/manifestation RDF bytes if both are available in the current fixture surface.
- Add tests proving raw RDF rendering preserves links to the raw file.
- Add tests proving generic pages still render when no `_knop/_page` definition exists.
- Add tests proving generated Knop pages show governed/supporting artifacts and omit the generic History section.
- Add tests proving long History-section repeated lists use the first-2/last-7 truncation rule with a visible gap marker.
- Add regression tests for existing `_knop/_page` precedence so the default theme does not override explicit page definitions.
- Add sidecar fixture coverage once the ontology-integrated woven branch is generated, using the ontology page as the first concrete proof.
- Add browser-oriented or snapshot-style checks only if the renderer change becomes large enough that DOM structure and responsive layout need protection.

## Non-Goals

- Building a full portable theme package system in this slice.
- Loading external theme artifacts by URL or package reference.
- Defining the complete ontology/config vocabulary for theme selection.
- Implementing selector-based template assignment by RDF class, path, filename, media type, or artifact kind.
- Replacing `_knop/_page` with a generic theme mechanism.
- Making templates responsible for RDF discovery, local path policy, breadcrumbs, navigation, history/state interpretation, or byte resolution.
- Adding JavaScript-only behavior that makes generated pages unusable without client-side execution.

## Implementation Plan

- [x] Audit the current ResourcePage generation code and identify the smallest internal renderer/theme seam that keeps page data assembly separate from HTML presentation.
- [x] Define a structured render input for generic ResourcePages, including identity, labels, descriptions, RDF classes, page kind, navigation links, support links, raw file links, and optional raw source panels.
- [x] Implement a built-in Weave default theme for generic generated ResourcePages.
- [x] Add raw RDF panel support for locally resolvable `RdfDocument` current and historical bytes.
- [x] Render Knop pages as governed/supporting artifact summaries instead of generic History-section pages.
- [ ] Add generic first-2/last-7 truncation for long cake-section repeated lists (in supporting files only).
- [x] Preserve existing `_knop/_page` behavior and ensure explicit page definitions still take precedence over generic generation for their owning identifier page.
- [x] Update or add tests for generic page rendering, raw RDF panels, and `_knop/_page` precedence.
- [d] Weave the sidecar fantasy-rules ontology branch and verify the ontology ResourcePage is readable, useful, and includes raw Turtle. Deferred until the human is ready to advance the fantasy-rules fixture.
- [x] Update related documentation notes if implementation decisions settle the embedded-CSS/shared-asset or raw-panel expansion questions.
