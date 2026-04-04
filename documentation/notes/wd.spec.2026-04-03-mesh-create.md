---
id: s2n1wdqg8mzz9xg1k4xw3cb
title: 2026 04 03 Mesh Create
desc: ''
updated: 1775277600000
created: 1775277600000
---

## Purpose

This note captures the current expected behavior of the first `mesh create` slice for Weave.

It is an implementation-facing behavior spec for the first local or in-process bootstrap path, not a final public API contract.

## Status

This is the current bootstrap target.

The first acceptance target is the settled `mesh-alice-bio` transition from `01-source-only` to `02-mesh-created`.

## Inputs

- `meshBase` is required.
- `meshBase` must be an absolute IRI and must end with a trailing `/`.
- the target workspace may already contain non-mesh files such as a source RDF document

## What Mesh Create Does

`mesh create` establishes the first mesh-managed support surface for a workspace.

In the current bootstrap slice, that means creating:

- `_mesh/_meta/meta.ttl`
- `_mesh/_inventory/inventory.ttl`

The created RDF should establish at least:

- the `SemanticMesh` resource at `_mesh`
- the `meshBase`
- the `MeshMetadata` artifact
- the `MeshInventory` artifact
- working located-file links for the metadata and inventory Turtle files in inventory

## What Mesh Create Does Not Do

In this first slice, `mesh create` does not:

- create any `Knop`
- create payload history
- generate `ResourcePage` HTML
- run full `weave`
- introduce daemon behavior

## Invariants

- existing non-mesh workspace files remain unchanged
- the first carried Alice Bio path should leave `alice-bio.ttl` byte-identical to the `01-source-only` state
- the created mesh support files should match the current intended `02-mesh-created` fixture state for Alice Bio
- if target support-artifact files already exist, the operation should fail closed rather than silently overwrite them

## Acceptance Reference

The first behavior-level comparison target is:

- fixture repo: `dependencies/github.com/semantic-flow/mesh-alice-bio`
- from ref: `01-source-only`
- to ref: `02-mesh-created`
- manifest: `dependencies/github.com/semantic-flow/semantic-flow-framework/examples/alice-bio/conformance/02-mesh-created.jsonld`
