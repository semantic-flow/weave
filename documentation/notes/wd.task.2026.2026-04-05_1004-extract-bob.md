---
id: d01dnm6aodsshhffzapy23ag
title: 2026 04 05 1004 Extract Bob
desc: ''
updated: 1775408650000
created: 1775408650000
---

## Goals

- Carry the next real local semantic slice after [[wd.task.2026.2026-04-05_0903-weave-alice-bio-v2-woven]].
- Implement the first local or in-process `extract` path over shared `core` and `runtime`.
- Add a dedicated behavior spec note for `extract` rather than leaving the new operation implicit in fixture diffs alone.
- Keep this first extraction implementation narrow enough to prove referenced-resource extraction behavior without absorbing Bob weaving, payload splitting, or a generic graph-refactoring system.

## Summary

This task should follow the carried local `10-alice-bio-updated` -> `11-alice-bio-v2-woven` `weave` slice.

The next carried slice should target the settled Alice Bio transition from `11-alice-bio-v2-woven` to `12-bob-extracted`.

The target behavior is deliberately narrow:

- update `_mesh/_inventory/inventory.ttl` to register `bob/_knop` as a new current mesh member
- create `bob/_knop/_meta/meta.ttl`
- create `bob/_knop/_inventory/inventory.ttl`
- create `bob/_knop/_references/references.ttl`
- create a single `ReferenceLink` rooted at `bob/_knop/_references#reference001` with `ReferenceRole/Supplemental`
- point that new Supplemental link at `alice/bio` and explicitly at `alice/bio/_history001/_s0002`
- leave `alice-bio.ttl`, `alice/_knop/_inventory/inventory.ttl`, `alice/_knop/_references/references.ttl`, and `alice/bio/_knop/_inventory/inventory.ttl` unchanged
- do not generate any Bob ResourcePages yet; `bob/index.html`, `bob/_knop/index.html`, `bob/_knop/_meta/index.html`, `bob/_knop/_inventory/index.html`, and `bob/_knop/_references/index.html` should all remain absent

This task should prove the first non-woven referenced-resource extraction path without absorbing `13-bob-extracted-woven`, payload-byte splitting, or broad graph-rewrite abstractions.

## Discussion

### Why this is the next slice

The settled fixture ladder still makes the next carried sequence clear:

- semantic change
- weave

After `11-alice-bio-v2-woven`, the next missing implementation-bearing step is the non-woven extraction of `bob` into a minimal Knop-managed surface.

Jumping straight to `13-bob-extracted-woven` would blur the same boundary the fixture ladder is trying to preserve:

- `extract` creates Bob's current Knop-managed resources and updates the current mesh inventory
- the later `weave` versions, validates, and generates the Bob-facing page surface afterward

### Why this slice should stay narrow

The settled `12` fixture is deliberately small. The actual semantic result is meaningful, but the filesystem delta is tight:

- one updated current mesh inventory
- three new Bob support-artifact Turtle files
- no new generated pages
- no new explicit histories yet
- no change to the current payload bytes

That makes this a good carried slice because it proves referenced-resource extraction behavior directly without conflating it with weaving or presentation.

### What extraction means in this first slice

For the settled Alice Bio `12` target, extraction does not mean "split Bob out of the current payload bytes."

The payload stays intact. The extracted result is instead:

- a new Knop for `bob`
- minimal Bob support artifacts
- a `Supplemental` reference from `bob` back to `alice/bio`
- an explicit `referenceTargetState` pointing to the current woven Alice Bio payload state at `alice/bio/_history001/_s0002`

This should stay the carried semantic boundary for the first local `extract` path.

### Existing spec posture

This slice should get a dedicated [[wd.spec.2026-04-05-extract-behavior]] note before implementation.

Unlike `weave`, `integrate`, `knop.create`, `knop.addReference`, and `payload.update`, there is no current behavior note for `extract`, and this is the first carried slice with a distinct machine-facing `extract` operation.

The existing [[wd.spec.2026-04-03-weave-behavior]] and [[wd.spec.2026-04-04-knop-add-reference-behavior]] notes should be treated as neighboring context, not as substitutes for a real `extract` behavior note.

### Request-boundary posture

The first carried `extract` slice should stay fixture-first and narrow.

That means:

- the local implementation should center on the settled `targetDesignatorPath` `bob`
- it should resolve the Bob extraction from the current Alice Bio payload surface proven by the fixture rather than trying to solve generic multi-source disambiguation
- it should not attempt a broad "extract arbitrary subgraph into arbitrary artifact family" abstraction

If this first slice exposes a real need for a wider request shape, that should be made explicit in the new behavior note rather than guessed in the implementation.

### Acceptance-boundary posture

The `12` fixture repo also changes `README.md`, but that is cross-cutting fixture ladder narration, not semantic operation output.

The black-box CLI acceptance for this slice should stay manifest-scoped and file-expectation-driven rather than treating unrelated fixture-documentation churn as part of `extract` behavior.

## Resolved Questions

- The machine-facing job kind and manifest `operationId` should stay `extract`.
- `extract` should get a dedicated `wd.spec.*` note before implementation rather than being folded into the weave or add-reference notes.
- The first carried slice should create a Bob Knop and Bob-owned support artifacts without creating a Bob payload artifact.
- The first carried slice should use `ReferenceRole/Supplemental` for the extracted Bob link and should explicitly record `referenceTargetState <alice/bio/_history001/_s0002>`.
- The first carried slice should leave current payload bytes and generated pages unchanged.
- The first carried slice should keep broader source-selection ambiguity, payload splitting, and graph-surgery abstractions out of scope.

## Decisions

- Treat `11-alice-bio-v2-woven` -> `12-bob-extracted` as the next carried implementation slice.
- Add a dedicated [[wd.spec.2026-04-05-extract-behavior]] note for this slice.
- Keep the first `extract` implementation local or in-process over shared `core` and `runtime`.
- Use the settled Alice Bio `12-bob-extracted` manifest and fixture as the first acceptance target.
- Keep the slice non-woven: update current mesh inventory and create current Bob support-artifact Turtle files only.
- Create a Bob `ReferenceCatalog` with one Supplemental link back to `alice/bio`, pinned to `alice/bio/_history001/_s0002`.
- Do not create any Bob ResourcePages in this step.
- Do not split `bob` out of `alice-bio.ttl` in this step.
- Keep black-box CLI acceptance manifest-scoped rather than coupling it to unrelated fixture `README.md` churn.
- Do not absorb `13-bob-extracted-woven`, payload splitting, daemon work, or the broader RDF cleanup task into this note.

## Contract Changes

- This task may introduce the first thin public request/result examples for `extract` in `semantic-flow-framework`.
- This task should not broaden the public contract into a generic resource-extraction, payload-splitting, or subgraph-rewrite API beyond what the carried `11` -> `12` slice actually proves.

## Testing

- Follow [[wd.testing]].
- Add failing unit tests for narrow `extract` planning and validation logic where practical.
- Start with failing integration and black-box CLI tests against the settled `12-bob-extracted` fixture target so the non-woven boundary is locked in before implementation.
- Add integration tests for local filesystem results against the settled `12-bob-extracted` fixture target.
- Add a black-box CLI acceptance test scoped by the settled `12-bob-extracted` Accord manifest.
- Keep the comparison black-box and fixture-oriented, with strong checks that Bob ResourcePages remain absent and existing Alice surfaces remain unchanged.
- Keep the CLI acceptance manifest-scoped rather than requiring full-tree equality with unrelated fixture-documentation changes.

## Non-Goals

- implementing `13-bob-extracted-woven`
- creating Bob histories under `bob/_knop/_meta/_history001/...`, `bob/_knop/_inventory/_history001/...`, or `bob/_knop/_references/_history001/...`
- generating Bob ResourcePages
- splitting `bob` into a separate payload artifact
- changing `alice-bio.ttl`
- introducing a generic RDF extraction or graph-rewrite framework
- implementing daemon endpoints

## Implementation Plan

- [ ] Draft [[wd.spec.2026-04-05-extract-behavior]] and settle the first local request/result boundary for `extract`.
- [ ] Define the first local CLI surface for the carried `extract` operation.
- [ ] Add failing integration and black-box CLI tests for the narrow `11` -> `12` extraction behavior, then add unit tests where a real planning or validation seam appears.
- [ ] Implement the first local or in-process `extract` path over shared `core` and `runtime`.
- [ ] Draft or refine the thin public API example or contract fragment for `extract` in `semantic-flow-framework` if this slice sharpens the public contract.
- [ ] Update relevant overview/spec/framework notes as the slice settles.
