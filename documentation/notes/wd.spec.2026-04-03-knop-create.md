---
id: 90x5w7k1m2n4p6q8r3s9t0u
title: 2026 04 03 Knop Create
desc: ''
updated: 1775277600000
created: 1775277600000
---

## Purpose

This note captures the current expected behavior of the first `knop create` slice for Weave.

It is an implementation-facing behavior spec for the first local or in-process path, not a final public API contract.

## Status

This is the current next carried slice after `mesh create`.

The first acceptance target is the settled `mesh-alice-bio` transition from `03-mesh-created-woven` to `04-alice-knop-created`.

## Inputs

- `designatorPath` is required.
- the first CLI surface requires an explicit `designatorPath`.
- the target workspace must already contain `_mesh/_meta/meta.ttl` and `_mesh/_inventory/inventory.ttl`.
- `meshBase` is resolved from the existing mesh metadata rather than being repeated on the CLI.

## What Knop Create Does

`knop create` establishes the first Knop-managed support surface for a designator in an existing mesh.

In the current first slice, that means:

- creating `D/_knop/_meta/meta.ttl`
- creating `D/_knop/_inventory/inventory.ttl`
- updating `_mesh/_inventory/inventory.ttl` so the mesh registers `D/_knop` and points at its working Knop inventory file

## What Knop Create Does Not Do

In this first slice, `knop create` does not:

- create a payload artifact
- create a `ReferenceCatalog` or `ReferenceLink`
- run `weave`, `version`, `validate`, or `generate`
- introduce daemon behavior
- prompt interactively for mesh identity

## Invariants

- existing non-mesh workspace files remain unchanged
- the first carried Alice Bio path should leave `alice-bio.ttl` and `_mesh/_meta/meta.ttl` byte-identical to the `03-mesh-created-woven` state
- the created and updated Knop-support files should match the current intended `04-alice-knop-created` fixture state for Alice Bio
- if target Knop support-artifact files already exist, the operation should fail closed rather than silently overwrite them
- runtime-local `.weave/logs` output is not part of the semantic mesh surface

## Acceptance Reference

The first behavior-level comparison target is:

- fixture repo: `dependencies/github.com/semantic-flow/mesh-alice-bio`
- from ref: `03-mesh-created-woven`
- to ref: `04-alice-knop-created`
- manifest: `dependencies/github.com/semantic-flow/semantic-flow-framework/examples/alice-bio/conformance/04-alice-knop-created.jsonld`
- local CLI execution should match that manifest-scoped result
