---
id: s7k2v9n4m1q8x5b3c6d0fya
title: 2026 04 04 Weave Alice Knop Created Woven
desc: ''
updated: 1775361600000
created: 1775361600000
---

## Goals

- Carry the first real local `weave` slice after `mesh create` and `knop create`.
- Implement the first local or in-process `weave` path over shared `core` and `runtime`.
- Reuse the same spec, test, and acceptance pattern already used for the first two carried slices.
- Keep the first `weave` implementation narrow enough to prove the behavior without pretending to solve every later weave case.

## Summary

This task picked up where the first local `knop create` slice left off.

This task carries the first local `weave` implementation, targeting the settled Alice Bio transition from `04-alice-knop-created` to `05-alice-knop-created-woven`.

The target behavior is deliberately narrow:

- version `alice/_knop/_meta`
- version `alice/_knop/_inventory`
- advance `_mesh/_inventory` to a new historical state
- generate the first `alice` and Knop-facing ResourcePages

This task should prove the first real `version + validate + generate` path without absorbing payload integration, reference catalogs, or later richer page generation.

The carried implementation is now in place as a narrow local slice over shared `core` and `runtime`, with the top-level `weave` CLI action performing the default local weave behavior against a workspace.

## Discussion

### Why this is the next slice

The settled fixture ladder already made the intended execution order clear:

- `mesh create`
- `weave`
- `knop create`
- `weave`

After `04-alice-knop-created`, the next missing implementation-bearing step is the first Knop weave case, not payload integration.

If Weave jumps straight to `integrate`, it leaves a real hole in the carried sequence:

- non-woven Knop creation would exist
- but the first explicit Knop history/state/page generation path would still be unimplemented

### Why this slice should stay narrow

`weave` is a broad operation family, but the first carried implementation does not need to solve every form of weaving.

For `05-alice-knop-created-woven`, the settled behavior is already specific enough:

- `_mesh/_meta/meta.ttl` stays unchanged
- `_mesh/_inventory/inventory.ttl` advances from `_s0001` to `_s0002`
- `alice/_knop/_meta` gets its first explicit history
- `alice/_knop/_inventory` gets its first explicit history
- `alice/index.html` and the first Knop-facing HTML pages appear

That is enough to prove:

- first history creation for Knop-owned support artifacts
- later-state advancement for an already-versioned mesh-owned support artifact
- first minimal HTML generation over the resulting current surface

### Existing spec posture

This task should reuse [[wd.spec.2026-04-03-weave-behavior]] rather than creating another broad weave spec note immediately.

If this first local weave implementation exposes a missing or ambiguous behavior boundary not already captured there, update the existing weave behavior note rather than spawning overlapping prose.

## Open Issues

- How much of the later richer page-generation surface should stay out of the next carried `weave` slices until there is a real rendering system?
- When there are multiple weaveable local candidates, should the default local `weave` action process the whole workspace or require an explicit selector?

## Decisions

- Treat `04-alice-knop-created` -> `05-alice-knop-created-woven` as the next carried implementation slice.
- Reuse [[wd.spec.2026-04-03-weave-behavior]] as the current behavior spec for this slice.
- Keep the first `weave` implementation local or in-process over shared `core` and `runtime`.
- Use bare top-level `weave` as the first local CLI surface rather than introducing a `weave weave` subcommand spelling.
- Let the first local CLI slice target the current workspace by default, while keeping optional `designatorPaths` in shared request shapes for later narrowing.
- Do not absorb payload integration, reference-catalog weaving, daemon work, or broader rendering ambitions into this task.

## Contract Changes

- This task introduced the first thin public request/result examples for the generic `weave` operation in `semantic-flow-framework`.
- This task should not attempt to finalize the full `weave` contract across every future artifact type and scope mode.

## Testing

- Follow [[wd.testing]].
- Add failing unit tests for the first narrow weave planning or rendering logic where practical.
- Add integration tests for local filesystem results against the settled `05-alice-knop-created-woven` fixture target.
- Add a black-box CLI acceptance test scoped by the settled `05-alice-knop-created-woven` Accord manifest.
- Keep the comparison black-box and fixture-oriented rather than coupling tests to internal helper structure.

## Non-Goals

- implementing payload integration
- implementing payload artifact weaving
- implementing reference-catalog weaving
- implementing daemon endpoints
- implementing a broad or final HTML renderer system
- solving every future `weave` target-selection mode in the first slice

## Implementation Plan

- [x] Define the exact first local CLI surface for the carried `weave` operation.
- [x] Confirm whether the existing weave behavior spec is sufficient as-is for the `05` slice.
- [x] Define the first local request/result shapes for `weave` in shared `core` and `runtime`.
- [x] Add failing unit and integration tests for the first `weave` behavior.
- [x] Implement the first local or in-process `weave` path over shared `core` and `runtime`.
- [x] Add a black-box CLI acceptance test scoped by the settled `05-alice-knop-created-woven` Accord manifest.
- [x] Draft the first thin public API example or contract fragment for `weave` in `semantic-flow-framework` if this slice sharpens the public contract.
- [x] Update relevant overview/spec/framework notes as the slice settles.
