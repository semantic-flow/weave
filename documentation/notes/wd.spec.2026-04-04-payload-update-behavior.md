---
id: s2q3n6p4c8v1k7m5d9r0wya
title: 2026 04 04 Payload Update Behavior
desc: ''
updated: 1775359260000
created: 1775359260000
---

## Purpose

This note captures the current expected behavior of the first `payload.update` slice for Weave.

It is an implementation-facing behavior spec for the first local or in-process path, not a final public API contract.

## Status

This is the current next carried slice after the completed local `08-alice-bio-referenced` -> `09-alice-bio-referenced-woven` `weave` implementation.

The first acceptance target is the settled `mesh-alice-bio` transition from `09-alice-bio-referenced-woven` to `10-alice-bio-updated`.

## Inputs

- `designatorPath` is required.
- the first local CLI surface should be `weave payload update <source> [designatorPath]`, with `--designator-path` as the explicit option form
- the target workspace must already contain `_mesh/_meta/meta.ttl` and the woven payload surface for the targeted payload artifact
- the target `designatorPath` must already resolve to an existing integrated payload artifact with a current `hasWorkingLocatedFile`
- `meshBase` and the existing working payload file path should be resolved from the workspace rather than repeated on the CLI
- shared `core` planning should operate on the target `designatorPath`, the already-known working payload file path, and the replacement payload bytes rather than on a host filesystem path
- the first local runtime slice may stage replacement bytes from an existing local path or `file:` URL outside the workspace, because the replacement source is runtime-local staging rather than a new mesh working file

## What Payload Update Does

`payload.update` replaces the working bytes of an already managed payload artifact without weaving that change yet.

In the current first slice, that means:

- resolving the existing working payload file for `D` from the current payload artifact surface
- replacing the bytes of that working file in place
- leaving current inventories, historical payload snapshots, and generated pages unchanged
- validating that the resulting working payload Turtle parses cleanly before commit

## What Payload Update Does Not Do

In this first slice, `payload.update` does not:

- create a new payload historical state
- update `_mesh/_inventory/inventory.ttl` or any Knop inventory
- regenerate `alice/bio/index.html`, `alice/_knop/_references/index.html`, or any other ResourcePage
- create `bob/_knop` or perform extraction
- introduce a generic RDF diff, patch, or merge language
- change the existing working payload file placement
- run the later `11` weave responsibilities

## Invariants

- in the settled `09` -> `10` fixture, `alice-bio.ttl` is the only changed workspace file
- `alice/bio/_history001/_s0001/alice-bio-ttl/alice-bio.ttl` remains unchanged until the later woven step
- `_mesh/_inventory/inventory.ttl` remains unchanged
- `alice/_knop/_inventory/inventory.ttl` remains unchanged
- `alice/_knop/_references/references.ttl` and `alice/_knop/_references/index.html` remain unchanged
- `alice/bio/_knop/_inventory/inventory.ttl` remains unchanged
- runtime-local `.weave/logs` output is not part of the semantic mesh surface

## Acceptance Reference

The first behavior-level comparison target is:

- fixture repo: `dependencies/github.com/semantic-flow/mesh-alice-bio`
- from ref: `09-alice-bio-referenced-woven`
- to ref: `10-alice-bio-updated`
- manifest: `dependencies/github.com/semantic-flow/semantic-flow-framework/examples/alice-bio/conformance/10-alice-bio-updated.jsonld`
- local CLI execution should match that manifest-scoped result
