---
id: q8m4t1v7n2x5k9r3c6p0dya
title: 2026 04 04 Weave Alice Bio Integrated Woven
desc: ''
updated: 1775365200000
created: 1775365200000
---

## Goals

- Carry the next real local `weave` slice after the first completed local `integrate` implementation.
- Implement the next local or in-process `weave` path over shared `core` and `runtime`.
- Reuse the same spec, test, and acceptance pattern already used for the earlier carried slices.
- Keep this `weave` implementation narrow enough to prove payload weaving behavior without pretending to solve every later weave case.

## Summary

This task should pick up after the carried local `05-alice-knop-created-woven` -> `06-alice-bio-integrated` `integrate` slice.

The next carried slice should be the first local payload-oriented `weave` implementation, targeting the settled Alice Bio transition from `06-alice-bio-integrated` to `07-alice-bio-integrated-woven`.

The target behavior is deliberately narrow:

- version the newly integrated `alice/bio` payload artifact into its first explicit history
- version `alice/bio/_knop/_meta`
- version `alice/bio/_knop/_inventory`
- advance `_mesh/_inventory` from `_s0002` to `_s0003`
- generate the public `alice/bio` page plus the first payload-history and payload-Knop-facing ResourcePages
- keep the root working payload bytes at `alice-bio.ttl` while making them match the latest payload-history snapshot exactly

This task should prove the first real payload `version + validate + generate` path without absorbing reference extraction, Bob creation, or later richer page generation work.

## Discussion

### Why this is the next slice

The settled fixture ladder already makes the next carried sequence clear:

- `integrate`
- `weave`

After `06-alice-bio-integrated`, the next missing implementation-bearing step is the woven payload case, not a new non-woven semantic operation.

Jumping ahead would leave a real gap:

- payload integration would exist
- but the first payload-history, payload-Knop history, and `alice/bio` page-generation path would still be unimplemented

### Why this slice should stay narrow

The settled `07` fixture is specific enough to carry a real slice without opening the whole `weave` family again.

For `07-alice-bio-integrated-woven`, the current expected behavior is:

- `_mesh/_meta/meta.ttl` stays unchanged
- `_mesh/_inventory/inventory.ttl` advances to `_s0003`
- `alice-bio.ttl` stays at the repo root as the working payload file
- `alice/bio/_history001/_s0001/...` appears as the first explicit payload history
- `alice/bio/_knop/_meta` gets its first explicit history
- `alice/bio/_knop/_inventory` gets its first explicit history
- `alice/bio/index.html` and the first payload-Knop-facing HTML pages appear

That is enough to prove:

- first payload-artifact history creation
- coexistence of payload history with Knop support-artifact histories
- later-state advancement for an already-versioned mesh-owned support artifact
- first minimal generated HTML for a payload-bearing identifier

### Existing spec posture

This task should reuse [[wd.spec.2026-04-03-weave-behavior]] rather than creating another broad weave spec note immediately.

If this payload-oriented `weave` slice exposes a missing or ambiguous behavior boundary not already captured there, update the existing weave behavior note rather than spawning overlapping prose.

## Open Issues

- Does the current shared `weave` request shape stay narrow with `designatorPaths`, or does payload weaving reveal the need for a more explicit artifact-target model later?
- How much of the later richer payload-history and identifier-page rendering surface should stay out of this slice until there is a real rendering system?

## Decisions

- Treat `06-alice-bio-integrated` -> `07-alice-bio-integrated-woven` as the next carried implementation slice.
- Reuse [[wd.spec.2026-04-03-weave-behavior]] as the current behavior spec for this slice.
- Keep the next `weave` implementation local or in-process over shared `core` and `runtime`.
- Keep bare top-level `weave` as the local CLI surface for this slice rather than introducing a new `weave weave` spelling.
- Use the settled Alice Bio `07-alice-bio-integrated-woven` manifest and fixture as the first acceptance target.
- Keep `alice-bio.ttl` at the repo root as the current working payload file while materializing payload history under `alice/bio/_history001/...`.
- Do not absorb reference-catalog weaving, referenced-resource extraction, daemon work, or broader rendering ambitions into this task.

## Contract Changes

- This task may refine the thin public request/result examples for the generic `weave` operation in `semantic-flow-framework` if the payload case sharpens the current contract.
- This task should not attempt to finalize the full `weave` contract across every future artifact type and scope mode.

## Testing

- Follow [[wd.testing]].
- Add failing unit tests for the next narrow weave planning or rendering logic where practical.
- Add integration tests for local filesystem results against the settled `07-alice-bio-integrated-woven` fixture target.
- Add a black-box CLI acceptance test scoped by the settled `07-alice-bio-integrated-woven` Accord manifest.
- Keep the comparison black-box and fixture-oriented rather than coupling tests to internal helper structure.

## Non-Goals

- implementing `08-alice-bio-referenced`
- implementing reference-catalog weaving
- auto-creating `bob` or other referenced-resource Knops
- changing the current root working payload file placement
- implementing daemon endpoints
- implementing a broad or final HTML renderer system
- solving every future `weave` target-selection mode in this slice

## Implementation Plan

- [ ] Confirm whether the existing weave behavior spec is sufficient as-is for the `07` slice.
- [ ] Define the next local request/result shapes for `weave` in shared `core` and `runtime` if payload weaving requires a refinement.
- [ ] Add failing unit and integration tests for the `07` payload-weave behavior.
- [ ] Implement the next local or in-process `weave` path over shared `core` and `runtime`.
- [ ] Add a black-box CLI acceptance test scoped by the settled `07-alice-bio-integrated-woven` Accord manifest.
- [ ] Draft or refine the thin public API example or contract fragment for `weave` in `semantic-flow-framework` if this slice sharpens the public contract.
- [ ] Update relevant overview/spec/framework notes as the slice settles.
