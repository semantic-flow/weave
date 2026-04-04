---
id: 8n0e0cny1m6f3x8c4q2v7ra
title: 2026 04 03 Weave Bootstrap Mesh Create
desc: ''
updated: 1775269706811
created: 1775269706811
---

## Goals

- Bootstrap the first real Weave implementation under the current `src/` boundaries.
- Carry `mesh create` through the first complete implementation slice.
- Keep the public Semantic Flow API thin and co-developed with this first slice.
- Establish the first practical testing and spec workflow for implementation work.
- Reuse Kato logging where it is already a good fit, without dragging in unnecessary observability scope.

## Summary

This task turns the current planning work into the first implementation-bearing Weave task.

The first carried slice is `mesh create`.

That slice should be implemented first in local or in-process form over shared `core` and `runtime` logic, with tests and behavior notes written in a TDD-friendly way. Once that slice is clear locally, it should also drive the first thin HTTP-facing API example and request or result shapes in the framework repo.

This task is intentionally not “build the whole daemon” and not “write the whole OpenAPI”. It is about proving the first Weave vertical slice with the current architecture:

- `core`
- `runtime`
- `cli`
- later daemon-facing API wiring over the same semantics

## Discussion

### Why `mesh create` first

`mesh create` is the cleanest first slice because it is:

- foundational
- semantically important
- relatively self-contained
- a good fit for local execution first
- a natural first place to establish working-file, metadata, inventory, and generated-surface conventions

It also gives Weave a meaningful first runnable command and the first durable filesystem result to compare and test.

### What this task should produce

At the end of this task, Weave should have:

- an initial Deno project scaffold under the current repo
- a first-pass runtime logging layer, preferably extracted or adapted from Kato where that reuse stays narrow and coherent
- a `mesh create` behavior spec note or equivalent current behavior note if one does not already exist
- failing tests written before implementation where practical
- a working local or in-process `mesh create`
- a thin first pass at the corresponding public API slice in `semantic-flow-framework`

### What this task should not absorb

This task should not turn into:

- full daemon implementation
- full OpenAPI authoring
- full page-generation implementation for every future operation
- full observability or OpenTelemetry work
- TUI work
- a broad monorepo/package refactor before code exists

## Open Issues

- How narrowly can the Kato logging extraction stay while still preserving the useful operational/audit split and JSONL behavior?
- Should the first `mesh create` slice include only local execution plus framework examples, or also a minimal daemon endpoint in the same task?
- How much of the generated current surface should `mesh create` itself produce before the separate `weave` operation is implemented?
- Which fixture or acceptance comparison should be treated as authoritative for the first `mesh create` slice before a broader ladder exists?

## Decisions

- Use `mesh create` as the first carried implementation slice.
- Keep the public API thin and co-developed with this slice rather than trying to finish it first.
- Treat this as an implementation-bearing bootstrap task, not as another architecture-planning note.
- Prefer TDD where practical, with `wd.spec.*` notes driving higher-level tests when the behavior is externally visible or cross-cutting.
- Reuse Kato logging where it fits cleanly, but do not let logging extraction sprawl into a full observability project.

## Contract Changes

- This task may introduce the first thin public request or result shapes and examples for `mesh create` in `semantic-flow-framework`.
- This task should not attempt to finalize the whole public API contract.
- If the implementation exposes a missing or ambiguous contract boundary, record it explicitly in framework notes rather than hiding it in code.

## Testing

- Follow the testing posture in [[wd.testing]].
- Prefer a failing test before implementation where practical.
- Add unit tests for narrow `mesh create` logic.
- Add integration tests for local or in-process `mesh create` across real filesystem and RDF behavior.
- Add or refine a `wd.spec.*` note when the intended behavior is easier to state as observable results and invariants than as local helper logic.
- If a useful acceptance comparison emerges for this slice, keep it black-box and integration-style rather than coupling it to implementation internals.

## Non-Goals

- implementing the full daemon
- implementing the full browser client
- implementing TUI support
- designing the entire renderer/template system
- finishing every future Semantic Flow operation
- full observability or OpenTelemetry rollout
- splitting the repo into multiple apps/packages before the first slice exists

## Implementation Plan

- [ ] Create the initial Deno project scaffold for Weave:
  - `deno.json`
  - `src/core`
  - `src/runtime`
  - `src/daemon`
  - `src/cli`
  - `src/web`
  - `tests/integration`
  - `tests/e2e`
  - `tests/support`
  - `tests/fixtures`
- [ ] Define the first-pass logging extraction plan from Kato:
  - identify the smallest reusable subset
  - preserve operational vs audit separation
  - preserve local-first JSONL behavior if that still fits
  - avoid pulling in broader observability scope
- [ ] Implement the first Deno-native runtime logging layer for Weave.
- [ ] Write a current `wd.spec.*` note for `mesh create` if the behavior is not already specified clearly enough elsewhere.
- [ ] Define the local request/result shapes for `mesh create` in shared `core` and `runtime`.
- [ ] Add failing unit and integration tests for the first `mesh create` behavior.
- [ ] Implement local or in-process `mesh create` over shared `core` and `runtime`.
- [ ] Add the first thin CLI command surface for `mesh create`, including `--interactive` support where it is already useful.
- [ ] Draft the first thin public API example or contract fragment for `mesh create` in `semantic-flow-framework`.
- [ ] Update [[wd.codebase-overview]], relevant `wd.spec.*` notes, and the framework notes as the slice solidifies.
