---
id: p7ki0tm5ullthfp7xdxbu0q
title: 2026 05 04 All Terms Extraction
desc: ''
updated: 1777913083201
created: 1777913083201
---

## Goals

- Add a batch extraction mode for RDF term surfaces without requiring one `weave extract` command per term.
- Define `--all-terms` as "all scoped terms" from a selected woven RDF source artifact, not as every named node regardless of namespace or every graph node including blank nodes.
- Preserve the existing source/target distinction from [[wd.task.2026.2026-05-03-term-extraction]]: the extracted term's public designator may differ from the source artifact designator that contains the describing triples.
- Keep the Fantasy Rules sidecar fixture as-is for now; its `08-ontology-and-shacl-terms-extracted` branch remains the explicit five-term extraction slice.
- Capture enough CLI and behavior contract detail that implementation can be tackled later without reopening the basic semantics.

## Summary

The current `weave extract` command extracts one target designator at a time from an existing woven payload source. That was enough for Alice Bio's Bob extraction and for the first Fantasy Rules sidecar term slice, but it is not ergonomic once an ontology or SHACL document contains many mesh-scoped terms that should be dereferenceable.

This task defines a future `--all-terms` mode. In this mode, the operator selects a woven RDF source artifact, and Weave extracts every named scoped term in that source whose IRI belongs to the mesh's base IRI space. "Scoped term" includes terms written as absolute IRIs, as `<>` or relative IRIs resolved against the document base, or as prefixed names, after RDF parsing and IRI expansion. The test is against the expanded IRI, not the lexical spelling in the Turtle source.

For example, in the Fantasy Rules sidecar the SHACL source may use the `fant:` prefix to describe `https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/ontology/CharacterShape`. That term is still in mesh scope even though its describing triples live in the `shacl` source artifact and its extracted public surface belongs under `ontology/CharacterShape`.

## Discussion

The existing command shape is:

```sh
weave extract <targetDesignatorPath> [--mesh-root <meshRoot>] [--source-designator-path <sourceDesignatorPath>]
```

`<targetDesignatorPath>` is the resource, term, or Knop surface being created. `--source-designator-path` selects the already woven payload artifact whose RDF describes that target. The source option is not the term being extracted.

The proposed batch shape is:

```sh
weave extract --all-terms --mesh-root <meshRoot> --source-designator-path <sourceDesignatorPath>
```

For `--all-terms`, the selected source artifact must resolve to a woven RDF payload artifact. Weave parses the source RDF, expands every named RDF node IRI appearing in subject, predicate, or object position, filters to IRIs within the mesh's base IRI space, converts each scoped IRI to the corresponding mesh designator path, and creates the same minimal extracted Knop support surface that one-by-one extraction would create for that term.

The source and target namespaces must remain independent. `--source-designator-path shacl` may extract terms whose target designator paths are under `ontology/` when the SHACL graph describes ontology namespace terms. Likewise, `--source-designator-path ontology` may extract class, property, or controlled-value terms from the ontology source when their expanded IRIs are in the mesh scope.

This should not scan arbitrary latest source files. It should behave like current extraction: the source binding is to a woven payload state already present in the mesh, and each extracted term records an inventory-carried `sfc:ExtractionSource` pointing back to the source artifact and requested source state.

The command should fail closed before writing if any selected scoped term cannot be converted to a safe designator path or if any selected term would overwrite an existing non-matching Knop support surface. The implementation can later decide whether an already existing extracted term with an equivalent `sfc:ExtractionSource` should be skipped, reported as already present, or require an explicit idempotency flag.

## Open Issues

- Should source documents ever opt out of extracting an otherwise in-scope named node, or should `--all-terms` remain strictly all mesh-scoped named nodes?
- Should the command later support narrowing flags for named terms with vocabulary-like signals such as `rdf:type owl:Class`, `rdf:type rdf:Property`, `rdf:type sh:NodeShape`, `rdf:type sh:PropertyShape`, `rdf:type skos:Concept`, or explicit `rdfs:label` / `rdfs:comment`?
- How should blank-node-backed SHACL property shapes be treated when they belong structurally to a named node shape but do not have their own mesh-scoped IRI?
- What should the exact idempotency policy be when some terms are already extracted and some are new?
- Should term discovery ignore source-document support artifacts and generated page RDF if the source payload graph references them, or is the mesh-base IRI filter alone sufficient?

## Decisions

- `--all-terms` means all named scoped terms appearing in the selected source RDF artifact whose expanded IRIs match the mesh base IRI.
- The mesh scope test happens after RDF parsing and IRI expansion, so absolute IRIs, `<>` / relative-base IRIs, and prefixed names are equivalent when they expand to the same IRI.
- The selected source artifact and extracted target namespace are independent. A `shacl` source can extract `ontology/...` targets when the expanded term IRIs are in the ontology namespace under the same mesh base.
- The first Fantasy Rules sidecar extraction branch remains explicit and narrow; do not rewrite it to use `--all-terms`.
- `--all-terms` is future CLI behavior and should not be documented as currently implemented in user-facing command examples until the implementation lands.

## Contract Changes

- Extend `weave extract` with a planned `--all-terms` option that makes the positional `<targetDesignatorPath>` optional only when `--all-terms` is present.
- Require `--source-designator-path` for `--all-terms`; batch extraction must be source-scoped instead of searching all woven payloads opportunistically.
- Define scoped terms by expanded IRI membership in the mesh base IRI space.
- Create the same extracted Knop support shape as single-target extraction, including inventory-carried `sfc:ExtractionSource`.
- Preserve all-or-fail behavior for unsafe target paths and conflicting existing surfaces unless an explicit later idempotency policy changes that contract.

## Testing

- Add CLI validation coverage that rejects `weave extract --all-terms` without `--source-designator-path`.
- Add CLI validation coverage that rejects combining `--all-terms` with a positional `<targetDesignatorPath>` unless an implementation deliberately chooses a mixed mode.
- Add RDF expansion coverage showing that absolute IRIs, relative/base IRIs, and prefixed names are discovered as the same scoped terms.
- Add sidecar-style coverage where `--source-designator-path shacl` extracts a term under `ontology/...` because the SHACL graph uses a prefix for a mesh-scoped ontology term.
- Add fail-closed coverage for an out-of-scope IRI appearing in the selected source graph.
- Add fail-closed coverage for a scoped term whose expanded IRI cannot be converted to a safe designator path.
- Add conflict coverage for pre-existing Knop support surfaces.
- Add at least one fixture or integration test that compares a `--all-terms` run against an equivalent set of explicit single-target extractions for a small RDF source.

## Non-Goals

- Reworking the already-settled Fantasy Rules `08-ontology-and-shacl-terms-extracted` branch.
- Extracting blank nodes as independent public term surfaces.
- Splitting a source RDF payload into one payload artifact per term.
- Inferring terms from every RDF document in a mesh without an explicit source selector.
- Implementing paging or renderer changes for long term lists.
- Settling controlled-value filtering or term-kind filtering beyond the base scoped-term rule.

## Implementation Plan

- [ ] Update CLI parsing so `weave extract` accepts `--all-terms` without a positional target.
- [ ] Require `--source-designator-path` when `--all-terms` is present.
- [ ] Add RDF term discovery that expands IRIs and filters named RDF nodes by mesh base IRI.
- [ ] Convert discovered scoped IRIs to mesh designator paths.
- [ ] Reuse the single-target extraction planner/materializer for each discovered term.
- [ ] Define and implement conflict/idempotency behavior.
- [ ] Add CLI, runtime, and fixture-level tests for source-scoped all-terms extraction.
- [ ] Update [[wu.cli-reference]] after the flag is implemented.
