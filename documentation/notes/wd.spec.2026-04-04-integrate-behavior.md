---
id: 7w9q2m4p6x1k8r3t5v0n2hb
title: 2026 04 04 Integrate Behavior
desc: ''
updated: 1775365200000
created: 1775365200000
---

## Purpose

This note captures the current expected behavior of the first `integrate` slice for Weave.

It is an implementation-facing behavior spec for the first local or in-process path, not a final public API contract.

## Status

This is the current next carried slice after the first completed local `weave` implementation.

The first acceptance target is the settled `mesh-alice-bio` transition from `05-alice-knop-created-woven` to `06-alice-bio-integrated`.

## Inputs

- `designatorPath` is required.
- the first local CLI surface requires an explicit `designatorPath` together with an explicit `--source`
- the target workspace must already contain `_mesh/_meta/meta.ttl` and `_mesh/_inventory/inventory.ttl`
- `meshBase` is resolved from the existing mesh metadata rather than being repeated on the CLI
- the current local runtime slice accepts only an existing local source file in the workspace, addressed either by path or equivalent `file:` URL
- shared `core` planning should operate on the resulting mesh-relative working file path rather than on a host filesystem path

## What Integrate Does

`integrate` establishes the first payload-artifact surface for a designator in an existing mesh.

In the current first slice, that means:

- creating `D/_knop/_meta/meta.ttl`
- creating `D/_knop/_inventory/inventory.ttl`
- updating `_mesh/_inventory/inventory.ttl` so the mesh registers `D/_knop`
- updating `_mesh/_inventory/inventory.ttl` so the payload artifact `D` is a `PayloadArtifact` with `hasWorkingLocatedFile` pointing at the existing working file
- keeping the working payload bytes at the existing `alice-bio.ttl` path for the carried Alice Bio slice rather than relocating them during `integrate`

## What Integrate Does Not Do

In this first slice, `integrate` does not:

- create explicit artifact history
- create `alice/bio/index.html` or any Knop support-artifact pages
- run `weave`, `version`, `validate`, or `generate`
- auto-create referenced-resource Knops such as `bob`
- copy, relocate, or rewrite the working payload bytes
- fetch remote sources or introduce daemon behavior

## Invariants

- the source payload bytes remain unchanged by the operation
- `_mesh/_meta/meta.ttl` and previously woven pages such as `alice/index.html` remain unchanged
- the created and updated files should match the current intended `06-alice-bio-integrated` fixture state for Alice Bio
- if the target payload-Knop support-artifact files already exist, the operation should fail closed rather than silently overwrite them
- runtime-local `.weave/logs` output is not part of the semantic mesh surface

## Acceptance Reference

The first behavior-level comparison target is:

- fixture repo: `dependencies/github.com/semantic-flow/mesh-alice-bio`
- from ref: `05-alice-knop-created-woven`
- to ref: `06-alice-bio-integrated`
- manifest: `dependencies/github.com/semantic-flow/semantic-flow-framework/examples/alice-bio/conformance/06-alice-bio-integrated.jsonld`
- local CLI execution should match that manifest-scoped result
