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
- `workspace` identifies the local workspace root, is resolved from the command working directory, and defaults to `.`
- `meshRoot` identifies the mesh root path, is resolved from the command working directory, must stay inside `workspace`, and defaults to `.`
- `.nojekyll` is created by default when `meshBase` is a GitHub Pages URL, unless the caller opts out
- the target workspace may already contain non-mesh files such as a source RDF document

## What Mesh Create Does

`mesh create` establishes the first mesh-managed support surface for a workspace. For a whole-workspace mesh, the mesh root is the workspace root. For a sidecar mesh, the workspace root is the containing project and the mesh root is a child path such as `docs/`.

In the current bootstrap slice, that means creating:

- `_mesh/_meta/meta.ttl`
- `_mesh/_inventory/inventory.ttl`
- `_mesh/_config/config.ttl`, only when the mesh root differs from the workspace root

Those paths are relative to the mesh root. With `--workspace . --mesh-root docs`, the created support files include `docs/_mesh/_meta/meta.ttl`, `docs/_mesh/_inventory/inventory.ttl`, and `docs/_mesh/_config/config.ttl`.

For a sidecar mesh root such as `docs/`, `mesh create` also creates `docs/_mesh/_config/config.ttl`. The config is an `sfcfg:MeshConfig` and records the portable workspace relationship with `sfcfg:workspaceRootRelativeToMeshRoot "../"`. Whole-workspace meshes do not get a config file solely to record `"."`.

For GitHub Pages mesh bases, `mesh create` also creates `.nojekyll` at the mesh root by default. This file is a static publishing guard rather than an RDF support artifact, so it is not listed in mesh inventory.

The created RDF should establish at least:

- the `SemanticMesh` resource at `_mesh`
- the `meshBase`
- the `MeshMetadata` artifact
- the `MeshInventory` artifact
- working located-file links for the metadata and inventory Turtle files in inventory
- for sidecar meshes, a mesh-owned config artifact recording the workspace root relative to the mesh root

## What Mesh Create Does Not Do

In this first slice, `mesh create` does not:

- create any `Knop`
- create payload history
- generate `ResourcePage` HTML
- add local path access grants
- run full `weave`
- introduce daemon behavior

## Invariants

- existing non-mesh workspace files remain unchanged
- the first carried Alice Bio path should leave `alice-bio.ttl` byte-identical to the `01-source-only` state
- the created mesh support files should match the current intended `02-mesh-created` fixture state for Alice Bio
- `meshRoot` must stay inside the workspace root
- whole-root meshes do not create `_mesh/_config/config.ttl` solely for the workspace relationship
- sidecar mesh config records a portable relative path and no extra-mesh access grants
- `.nojekyll` is empty when created by `mesh create`
- if target support-artifact files already exist, the operation should fail closed rather than silently overwrite them
- runtime-local `.weave/logs` output is not part of the semantic mesh surface

## Acceptance Reference

The first behavior-level comparison target is:

- fixture repo: `dependencies/github.com/semantic-flow/mesh-alice-bio`
- from ref: `01-source-only`
- to ref: `02-mesh-created`
- manifest: `dependencies/github.com/semantic-flow/semantic-flow-framework/examples/alice-bio/conformance/02-mesh-created.jsonld`
- local CLI execution should match that manifest-scoped result
