---
id: ar5um7avia6hg8524xjrgpo
title: 2026 03 25 Mesh Alice Bio
desc: ''
updated: 1774452551412
created: 1774446399214
---

## Goals

- Create a small standalone `mesh-alice-bio` example repo that can serve as a living golden example for Semantic Flow evolution.
- Represent the example as a sequence of explicit scenario branches that show the manual evolution from plain RDF source into a mesh-managed layout.
- Use the repo as a comparison target for future Weave API and CLI operations.

## Summary

This task is about creating a concrete Alice Bio example repository that starts from a plain RDF file and then evolves through manually created mesh states.

The repo is currently checked out at:

- `/home/djradon/hub/semantic-flow/weave/dependencies/github.com/semantic-flow/mesh-alice-bio`

The intended branch ladder is:

- `source-only`
- `mesh-created`
- `alice-knop-created`
- `alice-bio-integrated`

The comparison standard for “API/CLI matches the manual branch” is:

- same filesystem layout
- RDF graphs that are equivalent after canonicalization
- explicit allowances for volatile values such as timestamps and other runtime-generated identifiers if needed

`rdf-canonize` or an equivalent RDF canonicalization step should be used for graph comparison.

## Discussion

### Repo role

The example repo should be treated as a staged fixture, not just a demo. It should be usable for:

- ontology discussion
- CLI/API comparison
- manual inspection of filesystem layout
- future documentation examples

### Initial source content

The initial `alice-bio.ttl` in the `source-only` branch should stay intentionally simple and use ordinary RDF vocabularies rather than Semantic Flow terms.

The seed data should describe:

- Alice's name
- Alice's birthday
- employee ID `1001`
- that Alice `foaf:knows` Bob

The source should use standard vocabularies such as FOAF and DCTERMS wherever practical.

### Mesh base

The default `meshBase` for the example should be:

- `https://semantic-flow.github.io/mesh-alice-bio/`

The trailing slash is important in the current model, because the Semantic Flow identifier is formed as `meshBase + designatorPath`, and the normal designator paths should remain slashless.

### Branch semantics

- `source-only`
  - contains just the plain source RDF and no Semantic Flow mesh structure
- `mesh-created`
  - contains the manual equivalent of `mesh create`, including `_mesh`, mesh metadata, and mesh inventory
- `alice-knop-created`
  - contains the manual equivalent of creating a Knop for the non-payload referent `alice`
- `alice-bio-integrated`
  - contains the manual equivalent of integrating the source artifact into the mesh as the payload artifact for `alice/bio`
- `alice-bio-referenced`
  - Add a ReferenceLink for `alice` to the `alice/bio` <RdfDocument>
- `alice-bio-v2`
  - a post-weave version with updated ResourcePages

Using `alice-bio-integrated` is preferable to `alice-bio-knop-created`, because the main action for the payload artifact case is integration rather than merely minting a non-payload Knop.

### File layout

The current working layout conventions look good and should be kept unless implementation pressure proves otherwise:

- `_mesh/_meta/meta.ttl`
- `_mesh/_inventory/inventory.ttl`
- `alice/_knop/_meta/meta.ttl`
- `alice/_knop/_inventory/inventory.ttl`
- `alice/bio/_knop/_meta/meta.ttl`
- `alice/bio/_knop/_inventory/inventory.ttl`
- `alice/bio/_knop/_history/v1/...`

### Referenced-resource creation

Part of integration will eventually need to address referenced IRIs found in integrated RDF, such as auto-creating a Knop for `alice` when `alice-bio.ttl` mentions Alice.

That behavior should be treated as a later scenario, controlled by config or command-line behavior such as `autoCreateResources`, rather than being folded into the first baseline integration branch by default.

## Open Issues

- Which exact properties should be used in the seed file for birthday and employee ID if FOAF alone is awkward for those fields?
- Should the example repo use tags in addition to branches for especially important baseline comparison points?
- What is the exact tolerance policy for canonized graph comparison when generated runtime metadata appears?
- When we later model automatic referenced-resource creation, what should the first comparison branch for that behavior be named?

## Decisions

- Create a new dedicated `mesh-alice-bio` repo rather than burying the example inside an existing codebase.
- Use scenario branches rather than only immutable milestones.
- Use `alice-bio-integrated` as the payload-artifact milestone name.
- Treat branch-to-API/CLI comparison as filesystem-layout equality plus canonized RDF equivalence, with allowances for volatile timestamps.
- Use `https://semantic-flow.github.io/mesh-alice-bio/` as the default example `meshBase`.

## Contract Changes

- No public API contract changes are required by this task.
- This task should produce concrete fixtures that can later be used to test or refine the CLI and API contracts.

## Testing

- Compare manual branch output against Weave CLI/API output using:
  - filesystem layout inspection
  - RDF canonicalization and graph comparison
- Keep timestamps and similar generated fields out of strict equivalence checks where necessary.

## Non-Goals

- fully solving integration-template modeling
- fully solving config inheritance
- deciding the final long-term vocabulary for auto-created referenced-resource behavior
- locking every future Alice Bio scenario before the repo exists

## Implementation Plan

- [ ] Create the `mesh-alice-bio` repo with a short README explaining its role as a staged Semantic Flow example and comparison fixture.
- [ ] Create the `source-only` branch with a minimal `alice-bio.ttl` describing Alice and Bob using ordinary RDF vocabularies.
- [ ] Create the `mesh-created` branch with the manual equivalent of `mesh create`.
- [ ] Create the `alice-knop-created` branch with the manual equivalent of creating the `alice` Knop and its support artifacts.
- [ ] Create the `alice-bio-integrated` branch with the manual equivalent of integrating `alice-bio.ttl` as the payload artifact for `alice/bio`.
- [ ] Create the `alice-bio--v2` branch with the manual equivalent of weaving the whole mesh with an updated `alice-bio.ttl`
- [ ] Record the intended meaning of each branch in the repo README so later comparisons stay understandable.
- [ ] Decide the exact RDF comparison workflow, including canonicalization tooling and exclusions for volatile values.
