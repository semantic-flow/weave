---
id: 5bq0l4m1zgkr9v7x2n8p3dt
title: 2026 04 03 Knop Create
desc: ''
updated: 1775275200000
created: 1775275200000
---

## Goals

- Carry the next real Weave semantic slice after `mesh create`.
- Implement the first local or in-process `knop create` path over shared `core` and `runtime`.
- Reuse the same spec, test, and acceptance pattern established by the bootstrap `mesh create` slice.
- Keep the public Semantic Flow API thin and update framework examples only where this slice actually sharpens the contract.

## Summary

This task picks up where the bootstrap `mesh create` task left off.

The next carried slice is `knop create`.

The target behavior is the settled Alice Bio transition from `03-mesh-created-woven` to `04-alice-knop-created`, starting with creation of the minimal non-payload `alice` Knop.

This task should deliberately reuse the approach that worked for `mesh create`:

- behavior/spec clarity first
- failing tests where practical
- local shared `core` and `runtime` implementation
- thin CLI surface
- black-box acceptance against the settled fixture/manifests

## Discussion

### Why this is a new task

The implementation pattern is intentionally similar to the bootstrap `mesh create` slice, but the semantic operation is different.

`knop create` introduces new behavior:

- a target `designatorPath`
- new Knop support artifacts
- mesh inventory updates
- the first explicit Knop-level current-surface state

That makes it a better fit for a new task note than for continuing to append to the bootstrap note.

### First target

The first target should be the minimal `alice` Knop created in the settled fixture:

- `alice/_knop/_meta/meta.ttl`
- `alice/_knop/_inventory/inventory.ttl`

and the required `_mesh/_inventory/inventory.ttl` update that registers the new Knop.

This first slice should not absorb payload integration, reference creation, or weave/version/generate behavior.

## Open Issues

- Do we want a dedicated `wd.spec.*` note for `knop create` immediately, or should the first implementation be driven by the settled `04-alice-knop-created` fixture/manifests first and promote a spec note only if the behavior needs more prose?
- How thin should the first public `knop.create` example be in `semantic-flow-framework`?
- Should the first CLI surface require explicit `designatorPath` only, or also offer the first interactive prompt path in the same task?

## Decisions

- Treat `knop create` as the next task after the bootstrap `mesh create` slice.
- Use the settled Alice Bio `03-mesh-created-woven` -> `04-alice-knop-created` transition as the first acceptance target.
- Keep the first slice local or in-process over shared `core` and `runtime`.
- Add a dedicated `wd.spec.*` note for `knop create` so the first slice does not leave behavior implicit in fixture files alone.
- Make the first CLI surface require explicit `designatorPath` only and resolve `meshBase` from the existing workspace mesh support artifacts.
- Do not absorb payload integration, reference links, daemon work, or weave behavior into this task.

## Contract Changes

- This task may introduce the first thin public request/result examples for `knop.create` in `semantic-flow-framework`.
- This task should not broaden the public API beyond what the first `knop create` slice actually proves.

## Testing

- Follow [[wd.testing]].
- Add failing unit tests for narrow `knop create` planning logic where practical.
- Add integration tests for local filesystem results against the settled fixture target.
- Add a black-box CLI acceptance test scoped by the settled `04-alice-knop-created` Accord manifest.
- If the behavior needs more prose than the manifest and tests provide, add a concise `wd.spec.*` note rather than letting expectations stay implicit.

## Non-Goals

- implementing weave/version/generate behavior for the new Knop
- integrating a payload artifact
- creating reference links or reference catalogs
- implementing daemon endpoints
- broadening the RDF config/logging story beyond what this slice directly needs

## Implementation Plan

- [x] Decide whether `knop create` needs a dedicated `wd.spec.*` note before implementation.
- [x] Define the first local request/result shapes for `knop create` in shared `core` and `runtime`.
- [x] Add failing unit and integration tests for the first `knop create` behavior.
- [x] Implement local or in-process `knop create` over shared `core` and `runtime`.
- [x] Add the first thin CLI command surface for `knop create`.
- [x] Add a black-box CLI acceptance test scoped by the settled `04-alice-knop-created` Accord manifest.
- [x] Draft the first thin public API example or contract fragment for `knop.create` in `semantic-flow-framework` if this slice sharpens the public contract.
- [x] Update relevant overview/spec/framework notes as the slice settles.
