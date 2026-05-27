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

Most pages are default-generated pages. Weave synthesizes their page data from the current mesh inventory, Knop inventories, artifact histories, RDF content, references, and configured ResourcePage presentation policy.

Custom identifier pages are backed by an authored `ResourcePageDefinition`, conventionally at `_knop/_page/page.ttl`. They are useful when an identifier needs authored explanatory content in addition to, or instead of, the default generated panels.

## Composition

A ResourcePage is assembled from three layers:

- Document data: title, canonical IRI, breadcrumbs, classes, summary, metadata, selected stylesheets, and ordered panels.
- Panels: structured sections such as children, RDF properties, blank nodes, references, histories, raw source, current links, Knop artifacts, authored Markdown regions, and optional Semantic Flow metadata.
- Presentation: the resolved `ResourcePagePresentationPolicy` selects the shell, body layout, stylesheets, generated panels, panel order, targeting rules, and inclusion policy.

Runtime code owns graph discovery and source resolution. Templates and stylesheets should arrange already-resolved document and panel data; they should not read RDF graphs, local files, remote URLs, mesh inventories, or config sources themselves.

## Built-In Panels

The default Semantic Site presentation currently supports these generated panels:

- `children`: child identifier groups.
- `properties`: direct RDF properties for the page resource.
- `blankNodes`: nested blank-node RDF values.
- `references`: ReferenceCatalog links.
- `currentLinks`: current ReferenceCatalog entries.
- `knopArtifacts`: governed and supporting artifacts for a Knop.
- `factSections`: derived fact sections such as extraction-source details.
- `rawSource`: syntax-highlighted source panels.
- `history`: artifact history and state links.
- `semanticFlowMetadata`: Semantic Flow support metadata such as the associated Knop, page definition, working source, and extraction source links.

Title extraction prefers `dcterms:title`, then `schema:characterName`, `schema:name`, and `foaf:name` before falling back to the identifier path.

## Customization

Use an authored `ResourcePageDefinition` when an identifier needs custom content. A page definition can bind authored regions to Markdown sources, and those regions render as authored-content panels.

Custom pages use the resolved ResourcePage presentation policy for the active config scope. To keep the built-in Semantic Site chrome, bind a `sfcfg:ResourcePagePresentationPolicy` through config rather than putting presentation config directly on the authored `ResourcePageDefinition`. A custom page only receives generated panels when it explicitly opts into them with `sfcfg:hasGeneratedResourcePagePanelSelection`; generated panels are not appended automatically.

The exception is `semanticFlowMetadata`: when page generation is run with `--include-semantic-flow-metadata`, Weave applies the built-in all-panels presentation policy for that generation pass.

When authored regions and generated panels are both present and no explicit custom order is supplied, authored regions appear before generated panels.

For normal regeneration, use [[wu.cli-reference.generate]]. For the full validate/version/generate flow, use [[wu.cli-reference.weave]].
