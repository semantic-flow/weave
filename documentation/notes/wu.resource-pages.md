---
id: rpg3j6z0ts9n4e2xw8q1c5v
title: ResourcePages
desc: 'what ResourcePages are for and how they are composed'
created: 1779598296119
---

## Purpose

ResourcePages are the generated HTML pages that make Semantic Flow identifiers inspectable in a browser. They are meant to be stable, dereferenceable views over a mesh: useful to humans, linked from RDF resources, and reproducible from the settled mesh state.

ResourcePages help readers answer a few practical questions:

- What resource does this identifier name?
- What RDF classes, properties, references, children, and history are known for it?
- What source or governed artifact produced this page?
- Where can I inspect the current or historical source material?

## Page Types

Weave generates ResourcePages for identifier resources, payload and support artifacts, Knops, ReferenceCatalogs, mesh support resources, and explicit custom identifier pages.

Most pages are default generated pages. Weave synthesizes their page data from the current mesh inventory, Knop inventories, artifact histories, RDF content, references, and configured ResourcePage presentation policy.

Custom identifier pages are backed by an authored `ResourcePageDefinition`, conventionally at `_knop/_page/page.ttl`. They are useful when an identifier needs authored explanatory content in addition to, or instead of, the default generated panels.

## Composition

A ResourcePage is assembled from three layers:

- Document data: title, canonical IRI, breadcrumbs, classes, summary, metadata, selected stylesheets, and ordered panels.
- Panels: structured sections such as children, RDF properties, blank nodes, references, histories, raw source, current links, Knop artifacts, authored Markdown regions, and optional Semantic Flow metadata.
- Presentation: a `ResourcePagePresentationConfig` selects the shell, body layout, stylesheets, generated panels, panel order, targeting rules, and inclusion policy.

Runtime code owns graph discovery and source resolution. Templates and stylesheets should arrange already-resolved document and panel data; they should not read RDF graphs, local files, remote URLs, mesh inventories, or config sources themselves.

## Customization

Use an authored `ResourcePageDefinition` when an identifier needs custom content. A page definition can bind authored regions to Markdown sources, and those regions render as authored-content panels.

To keep the built-in Semantic Site chrome on a custom page, set `sfcfg:hasResourcePagePresentationConfig` on the authored `ResourcePageDefinition` to the supported default presentation config. A custom page only receives generated panels when it explicitly opts into them with `sfcfg:hasGeneratedResourcePagePanelSelection`; generated panels are not appended automatically.

When authored regions and generated panels are both present and no explicit custom order is supplied, authored regions appear before generated panels.

For normal regeneration, use [[wu.cli-reference.generate]]. For the full validate/version/generate flow, use [[wu.cli-reference.weave]].
