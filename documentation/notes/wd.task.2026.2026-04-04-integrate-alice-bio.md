---
id: v4m8n2q1c7x5k9b3j6t0rpa
title: 2026 04 04 Integrate Alice Bio
desc: ''
updated: 1775365200000
created: 1775365200000
---

## Goals

- Carry the next real local semantic slice after the first completed `weave` implementation.
- Implement the first local or in-process `integrate` path over shared `core` and `runtime`.
- Reuse the same fixture-driven unit, integration, and black-box acceptance pattern used for the first carried slices.
- Keep the first `integrate` implementation narrow enough to prove payload integration behavior without absorbing the subsequent `weave` responsibilities.

## Summary

This task picks up after the completed local `04-alice-knop-created` -> `05-alice-knop-created-woven` `weave` slice.

The next carried slice should be the first local `integrate` implementation, targeting the settled Alice Bio transition from `05-alice-knop-created-woven` to `06-alice-bio-integrated`.

The target behavior is deliberately narrow:

- add the `alice/bio` payload artifact to the current mesh surface
- keep the working payload bytes at the existing root `alice-bio.ttl` path
- create `alice/bio/_knop/_meta/meta.ttl`
- create `alice/bio/_knop/_inventory/inventory.ttl`
- update `_mesh/_inventory/inventory.ttl` to register the integrated payload artifact and its Knop
- leave page generation, explicit histories, and other weave behavior for the following `07-alice-bio-integrated-woven` slice

This task should prove the first real payload-integration path without folding in later extraction, reference management, or payload weaving behavior.

## Discussion

### Why this is the next slice

The settled fixture ladder models `06-alice-bio-integrated` as the direct semantic result of `integrate`, with `07-alice-bio-integrated-woven` reserved for the later `weave` pass.

That makes `05` -> `06` the next missing implementation-bearing step after the first completed local `weave` slice.

Jumping straight to `07` would blur the same boundary the fixture ladder is trying to preserve:

- `integrate` changes the current semantic surface
- `weave` versions, validates, and generates that current surface afterward

### Why this first integrate slice should stay narrow

The settled `06` fixture is intentionally modest.

It adds the new `alice/bio` payload artifact and the payload Knop support artifacts, but it does not yet:

- create payload history
- create `alice/bio/index.html`
- create `alice/bio/_knop/.../index.html`
- auto-create `bob` resources from the referenced IRI in the payload
- move the working Turtle bytes away from the repo root

That narrow scope is useful because it proves the payload-artifact association behavior directly without conflating it with later versioning or rendering work.

### Existing fixture guidance

The settled fixture and conformance notes already pin down two important expectations for this slice:

- the working payload bytes remain at `alice-bio.ttl` in the non-woven `06` state
- referenced-resource extraction behavior such as auto-creating `bob` should stay out of this first baseline integration slice

That means the first local `integrate` implementation should be driven primarily by the settled `06-alice-bio-integrated` fixture and manifest, with additional prose only where the behavior still needs clarification.

## Open Issues

- Do we want a dedicated `wd.spec.*` note for `integrate` before implementation, or should the first slice stay fixture-and-manifest-driven unless a missing behavior boundary shows up?
- What should the first local CLI surface for `integrate` be: explicit source path plus `designatorPath`, or a thinner command shape?
- How thin should the first public `integrate` request/result examples be in `semantic-flow-framework`?

## Decisions

- Treat `05-alice-knop-created-woven` -> `06-alice-bio-integrated` as the next carried implementation slice.
- Use the settled Alice Bio `06-alice-bio-integrated` manifest and fixture as the first acceptance target.
- Keep the first `integrate` implementation local or in-process over shared `core` and `runtime`.
- Keep the working payload bytes at `alice-bio.ttl` for this first slice rather than relocating the file before the woven step.
- Do not absorb payload weaving, page generation, explicit histories, referenced-resource extraction, or daemon work into this task.

## Contract Changes

- This task may introduce the first thin public request/result examples for `integrate` in `semantic-flow-framework`.
- This task should not broaden the public API beyond what the first local payload-integration slice actually proves.

## Testing

- Follow [[wd.testing]].
- Add failing unit tests for narrow `integrate` planning logic where practical.
- Add integration tests for local filesystem results against the settled `06-alice-bio-integrated` fixture target.
- Add a black-box CLI acceptance test scoped by the settled `06-alice-bio-integrated` Accord manifest.
- Keep the comparison black-box and fixture-oriented rather than coupling tests to internal helper structure.

## Non-Goals

- implementing the `07-alice-bio-integrated-woven` weave behavior
- creating payload history or historical snapshot files
- generating `alice/bio` or payload-Knop HTML pages
- auto-creating `bob` or other referenced-resource Knops
- introducing reference-catalog behavior
- moving or copying the working payload bytes away from `alice-bio.ttl`
- implementing daemon endpoints

## Implementation Plan

- [ ] Decide whether `integrate` needs a dedicated `wd.spec.*` note before implementation.
- [ ] Define the first local request/result shapes for `integrate` in shared `core` and `runtime`.
- [ ] Define the exact first local CLI surface for the carried `integrate` operation.
- [ ] Add failing unit and integration tests for the first `integrate` behavior.
- [ ] Implement the first local or in-process `integrate` path over shared `core` and `runtime`.
- [ ] Add a black-box CLI acceptance test scoped by the settled `06-alice-bio-integrated` Accord manifest.
- [ ] Draft the first thin public API example or contract fragment for `integrate` in `semantic-flow-framework` if this slice sharpens the public contract.
- [ ] Update relevant overview/spec/framework notes as the slice settles.
