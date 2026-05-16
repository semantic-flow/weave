---
id: resource-page-properties-references-20260516
title: Resource Page Properties References
desc: ''
created: 1778943660000
---

## Goals

Add ontology-centric ResourcePage panels that expose subject triples and managed reference links without mixing SHACL shapes into ordinary child individuals.

## Summary

ResourcePages should render a closeable Properties panel for triples about the page resource, and a References panel grouped by canonical, supplemental, and deprecated reference roles. Canonical references should also make their target RDF data available when rendering extracted payload reference pages.

## Discussion

The Properties panel should be sourced from RDF triples in the working/source file where the ResourcePage referent is the subject. Predicate labels should use known prefixes when possible, while values that are IRIs or URL-like literals should be rendered as links.

The References panel should use managed `ReferenceLink` data from the resource's reference catalog, grouped by role. The displayed link text and href should be the full target IRI or URL.

## Open Issues

- [x] Confirm whether Properties and References panels should default open or closed after trying the generated page.

## Decisions

- [x] Keep this as a task note because the change spans model, runtime data collection, page rendering, and tests.
- [x] Interpret the requested "subject value" table column as the object value for triples whose subject is the ResourcePage referent.
- [x] Properties and References use closed outer panels by default; References opens its non-empty role subpanels once expanded.

## Contract Changes

- [x] ResourcePage render input includes property rows and reference groups.

## Testing

- [x] Add focused ResourcePage renderer tests for Properties and References panels.
- [x] Run targeted tests, type checks, lint, and formatting checks.

## Non-Goals

- [x] Do not infer SHACL shapes from names.
- [x] Do not use reference catalogs as a general descriptive RDF store for referents.

## Implementation Plan

- [x] Parse subject triples into ResourcePage property rows.
- [x] Parse managed reference catalog links into grouped ResourcePage reference rows.
- [x] Render closeable Properties and References sections with stable table/list layout.
- [x] Use canonical reference target source data when available for extracted payload reference pages.
