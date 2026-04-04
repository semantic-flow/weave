---
id: m3gu8prfjajglvn2r12u34i
title: 2026 04 03 Weave Behavior
desc: ''
updated: 1775230930110
created: 1775230930110
---

## Purpose

This note captures the current expected behavior of the `weave` operation as learned from the settled `mesh-alice-bio` fixture ladder in [[wd.completed.2026.2026-03-25-mesh-alice-bio]].

It is meant to be the high-level operational spec for Weave behavior, not a replay of every branch detail and not a CLI design note.

## Status

This is a current behavior spec, not a frozen final standard.

The rules below are the best current synthesis of:

- the `mesh-alice-bio` branch ladder
- the corresponding Accord conformance manifests
- the current Semantic Flow ontology direction

The first carried local implementation of this behavior is the settled Alice Bio `04-alice-knop-created` -> `05-alice-knop-created-woven` slice.

If future fixture work contradicts this note, the contradiction should be treated as a real design issue and resolved explicitly rather than silently drifting.

## Core View

`weave` is currently best understood as:

- `version`
- `validate`
- `generate`

It is not currently the operation that performs semantic changes such as:

- creating a mesh
- creating a Knop
- integrating a payload artifact
- introducing a new reference
- extracting a newly managed resource from referenced data

Those semantic changes happen in the non-woven branch state first. The woven branch then versions, validates, and renders the resulting current surface.

## Branch Semantics

The fixture ladder established a useful distinction:

- non-woven branches represent the direct semantic result of an operation
- `*-woven` branches represent the result of running `weave` over that state

That distinction should remain explicit in future examples and in the eventual CLI/API behavior.

In particular:

- a non-woven operation may update the current working `inventory.ttl`
- but only `weave` should materialize a new historical state for that inventory

This is why `12-bob-extracted` could update the working mesh inventory surface to register `bob/_knop`, while `13-bob-extracted-woven` is the step that actually advanced `_mesh/_inventory/_history001` to `_s0004`.

## What Weave Does

For each relevant changed artifact, `weave` currently does four main things.

### 1. Materialize explicit history/state structure

The current direction is to use explicit:

- `ArtifactHistory`
- `HistoricalState`
- `ArtifactManifestation`
- `LocatedFile`

with generated paths of the form:

- `_historyNNN/_sNNNN`

not old `vN` path tokens.

When `weave` versions an artifact, it should:

- create the first or next `ArtifactHistory` / `HistoricalState` path as needed
- maintain `historyOrdinal`, `nextStateOrdinal`, `stateOrdinal`, and `latestHistoricalState` coherently
- preserve the working file as the current surface while also materializing the corresponding historical snapshot

### 2. Keep working files aligned with the latest historical snapshot

The fixture ladder converged on a strong invariant:

- after a successful weave, the current working Turtle file should be byte-identical to the latest historical-state copy

This applies to woven support artifacts such as:

- `_mesh/_meta/meta.ttl`
- `_mesh/_inventory/inventory.ttl`
- `D/_knop/_meta/meta.ttl`
- `D/_knop/_inventory/inventory.ttl`
- `D/_knop/_references/references.ttl`

and to woven payload artifacts such as:

- `alice-bio.ttl` matching `alice/bio/_history001/_s0002/alice-bio-ttl/alice-bio.ttl`

This equality is one of the most important operational expectations to preserve.

### 3. Validate the resulting state

The fixture work treated validation as part of weave even when performed manually.

At minimum, the current expectation is:

- changed RDF files parse cleanly
- current merged graphs for the affected resource surface satisfy the relevant ontology/SHACL expectations
- generated outputs are internally consistent with the current current-surface model

The exact validator stack may evolve, but validation is part of the operation, not an optional afterthought.

### 4. Generate current and historical ResourcePages

`weave` is the step that materializes the human-facing HTML surface.

That includes:

- current identifier pages such as `alice/index.html`, `alice/bio/index.html`, and `bob/index.html`
- support-artifact landing pages such as `D/_knop/_meta/index.html`
- history landing pages such as `D/_knop/_inventory/_history001/index.html`
- state pages such as `.../_s0001/index.html`
- manifestation pages such as `.../inventory-ttl/index.html`

## What Weave Does Not Do

The fixture ladder also clarified several important non-behaviors.

### Weave does not perform semantic integration

`06-alice-bio-integrated` created the semantic payload association.

`07-alice-bio-integrated-woven` only versioned and rendered that state.

The same pattern held for:

- `04` then `05` for Knop creation
- `08` then `09` for ReferenceCatalog introduction
- `12` then `13` for Bob extraction

### Weave does not automatically widen mesh inventory for every internal change

Mesh inventory should reflect the public current-surface map of the mesh, not every internal support-artifact detail.

This means:

- advancing `_mesh/_inventory` was correct when Alice or Bob public pages became part of the mesh surface
- not advancing `_mesh/_inventory` was correct when only `alice/_knop/_references` was woven in `09`
- not advancing `_mesh/_inventory` was also correct when `alice/bio` got a second payload state in `11`

This distinction matters. Otherwise mesh inventory drifts into cataloging Knop-internal details that belong in Knop inventory instead.

### Weave should not normally rewrite historical pages

A current page may be regenerated repeatedly.

A historical page should normally be treated as frozen output of that historical state. Earlier fixture work sometimes rewrote old historical pages while the conventions were still changing, but that should be treated as corrective retconning, not normal behavior.

## Artifact Placement Rules

The fixture work clarified the filesystem placement model.

### Support artifacts live under the owning support surface

For a Knop-owned support artifact:

- `D/_knop/_meta/...`
- `D/_knop/_inventory/...`
- `D/_knop/_references/...`

For a mesh-owned support artifact:

- `_mesh/_meta/...`
- `_mesh/_inventory/...`
- optionally `_mesh/_references/...` if a mesh-level `ReferenceCatalog` exists

### Payload artifact history lives under the payload artifact, not under `_knop`

This was an important clarification.

Payload history should be attached to the payload artifact path itself:

- `alice/bio/_history001/_s0001/...`

not moved under:

- `alice/bio/_knop/_payload/...`

The payload artifact is the substantive artifact the Knop points at, not just another support artifact of the Knop.

## Metadata vs Inventory

The fixture work also sharpened the split between metadata and inventory.

### Metadata stays owner-level and light

For meshes and Knops, metadata should focus on owner-level facts such as:

- mesh base
- designator path
- direct current-file shortcuts such as `hasWorkingMeshInventoryFile` and `hasWorkingKnopInventoryFile`

### Inventory is the canonical current-surface map

Inventory is where the current structural facts belong, including:

- support-artifact identity
- support-artifact typing
- current artifact/history/state pointers
- current ResourcePage surface

This means metadata should not redundantly restate what inventory already carries structurally.

## ResourcePage Generation Rules

The ladder uncovered useful current rules for generated pages.

### Identifier pages should say what the identifier denotes

The page for a Semantic Flow identifier should not speak vaguely about a “referent” when the denoted thing is actually known.

Examples:

- `alice` denotes a `schema:Person`
- `alice/bio` denotes an `sflo:RdfDocument`

The page should say that directly.

### Use support-artifact language rather than vague “mesh links”

`Supporting Semantic Flow Resources` is better than a generic section title like `Mesh Links` when the page is primarily linking to:

- KnopMetadata
- KnopInventory
- ReferenceCatalog
- payload/history surfaces

### History landing pages should list all states

A history page such as `.../_history001/index.html` should list every known state in that history, with the latest state clearly indicated where helpful.

### Public current pages should be navigable

Current pages should include meaningful links to the live mesh surface rather than acting as dead-end stubs.

The evolved fixture pages now do a better job of this by including:

- links to current working files
- links to current histories
- links between related Semantic Flow resources
- structured tables for properties where useful

## ReferenceCatalog-Specific Behavior

Detailed serialization rules for `ReferenceCatalog` and `ReferenceLink` are already captured in [[ont.reference-links]].

The main weave-behavior consequences are:

- a `ReferenceCatalog` is a support artifact and lives under `D/_knop/_references`
- a woven `ReferenceCatalog` gets explicit history and state structure like other support artifacts
- `ReferenceLink` identities are stable fragment IRIs rooted at the catalog resource
- the current catalog page is the dereference target for both current and retired links
- current catalog page generation must therefore consult both the current working catalog and catalog history

That history-aware dereferenceability requirement is unusual enough that it should remain explicit in future implementations.

## Comparison and Conformance

The fixture ladder also clarified how Weave behavior should be compared against expected results.

The right comparison unit is a transition, not an isolated branch. That is why the Accord manifests in `semantic-flow-framework/examples/alice-bio/conformance/` are one manifest per transition.

The comparison standard is currently:

- same filesystem layout
- RDF graphs equivalent after canonicalization
- explicit exclusions for volatile fields such as timestamps where needed

This is one reason a thin deterministic conformance checker is preferable to a prompt-only review workflow. Prompts are useful for explanation, but the manifests need a deterministic executor if they are to remain normative.

## Open Questions

- How strict should weave-time validation be for partial current-surface documents versus whole merged graphs?
- When a generated HTML page evolves, which changes should count as material behavior changes versus cosmetic template changes?
- Should the first real Weave implementation treat HTML generation as fully deterministic output that participates in strict text comparison, or should some normalization layer be introduced?
- How should multi-artifact operations report partial success if versioning succeeds but generation or validation fails?

## Non-Goals

This note does not specify:

- the public Weave API
- CLI flag design
- Accord CLI design in detail
- low-level RDF canonicalization algorithms
- every future Semantic Flow operation beyond the current fixture-derived behavior

## Related Notes

- [[wd.completed.2026.2026-03-25-mesh-alice-bio]]
- [[ont.reference-links]]
