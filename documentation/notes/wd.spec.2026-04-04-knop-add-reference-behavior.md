---
id: n4p7r2k8m1x6c3v9t0b5wda
title: 2026 04 04 Knop Add Reference Behavior
desc: ''
updated: 1775368800000
created: 1775368800000
---

## Purpose

This note captures the current expected behavior of the first `knop add-reference` slice for Weave.

It is an implementation-facing behavior spec for the first local or in-process path, not a final public API contract.

## Status

This is the current next carried slice after the first completed local payload-oriented `weave` implementation.

The first acceptance target is the settled `mesh-alice-bio` transition from `07-alice-bio-integrated-woven` to `08-alice-bio-referenced`.

## Inputs

- the machine-facing job kind and manifest `operationId` stay `knop.addReference`
- the first local CLI surface should be `weave knop add-reference <designatorPath> --reference-target-designator-path <referenceTargetDesignatorPath> --reference-role <referenceRole>`
- `designatorPath` is required and identifies the target Knop that owns the `ReferenceCatalog`, while that Knop's referent is the subject of the `ReferenceLink`
- `referenceTargetDesignatorPath` is required in the first slice and is resolved against the existing `meshBase` to form `referenceTarget`
- `referenceRole` is required in this first carried local slice and should map to one ontology `ReferenceRole` IRI for the created link
- the target workspace must already contain `_mesh/_meta/meta.ttl`, `_mesh/_inventory/inventory.ttl`, and the target Knop support surface
- the carried `08` slice assumes the referenced target designator already exists as a mesh resource; this first slice does not auto-create referenced-resource Knops
- `meshBase` is resolved from the existing mesh metadata rather than being repeated on the CLI
- shared `core` and `runtime` should use a narrow local request shape: target `designatorPath`, `referenceTargetDesignatorPath`, and `referenceRole`, with result reporting the created `referenceCatalogIri`, `referenceLinkIri`, and created or updated paths
- shared `core` planning should derive `referenceLinkFor` implicitly from the targeted Knop's `designatorPath` rather than accepting a separate subject IRI input
- the settled `08` acceptance target uses `ReferenceRole/Canonical`; the later Bob extraction path is the first natural carried `ReferenceRole/Supplemental` case
- this first local slice should not silently default an omitted role to `Supplemental`; omission is a broader policy question and is not covered by the current carried fixture

## What Knop Add Reference Does

`knop add-reference` establishes the first Knop-owned `ReferenceCatalog` surface for a designator in an existing mesh.

In the current first slice, that means:

- updating `D/_knop/_inventory/inventory.ttl` so the target Knop has `hasReferenceCatalog <D/_knop/_references>`
- creating `D/_knop/_references/references.ttl`
- registering `<D/_knop/_references>` as a `ReferenceCatalog`, `DigitalArtifact`, and `RdfDocument` with `hasWorkingLocatedFile <D/_knop/_references/references.ttl>`
- creating one stable `ReferenceLink` rooted at `<D/_knop/_references#reference001>`
- recording that link as about `<D>` with `referenceLinkFor <D>`, `hasReferenceRole <R>`, and `referenceTarget <T>`

## What Knop Add Reference Does Not Do

In this first slice, `knop add-reference` does not:

- accept an explicit `referenceLinkFor` or subject-IRI override
- accept multiple roles in one request
- silently default an omitted local `referenceRole` to `Supplemental`
- create more than one `ReferenceLink`
- set `referenceTargetState`
- auto-create a Knop for the referenced target
- create explicit history or generated pages for `D/_knop/_references`
- run `weave`, `version`, `validate`, or `generate`
- introduce daemon behavior

## Invariants

- the `ReferenceLink` identity should be a stable fragment IRI rooted at the catalog resource, not a snapshot-local fragment
- `referenceLinkFor` points to the actual subject resource `D`, not to `D/_knop`
- the carried `08` Alice Bio acceptance path should produce `hasReferenceRole <.../ReferenceRole/Canonical>`
- the carried Alice Bio path should leave `_mesh/_inventory/inventory.ttl`, `alice-bio.ttl`, `alice/_knop/_meta/meta.ttl`, and `alice/bio/_knop/_inventory/inventory.ttl` unchanged
- the created and updated files should match the current intended `08-alice-bio-referenced` fixture state for Alice Bio
- if the target reference-catalog working file already exists, the operation should fail closed rather than silently overwrite it
- runtime-local `.weave/logs` output is not part of the semantic mesh surface

## Acceptance Reference

The first behavior-level comparison target is:

- fixture repo: `dependencies/github.com/semantic-flow/mesh-alice-bio`
- from ref: `07-alice-bio-integrated-woven`
- to ref: `08-alice-bio-referenced`
- manifest: `dependencies/github.com/semantic-flow/semantic-flow-framework/examples/alice-bio/conformance/08-alice-bio-referenced.jsonld`
- local CLI execution should match that manifest-scoped result
