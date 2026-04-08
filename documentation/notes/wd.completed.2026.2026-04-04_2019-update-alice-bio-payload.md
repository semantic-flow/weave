---
id: 36n2frq6aqahs0czp3v6u4as
title: 2026 04 04 2019 Update Alice Bio Payload
desc: ''
updated: 1775534865855
created: 1775359260000
---
wd.completed.2026.2026-04-05_0903-weave-alice-bio-v2-woven
## Goals

- Carry the next real local semantic slice after [[wd.completed.2026.2026-04-04_1553-weave-alice-bio-referenced-woven]].
- Implement the first local or in-process `payload.update` path over shared `core` and `runtime`.
- Add a dedicated behavior spec note for `payload.update` rather than leaving this new operation implicit in fixture diffs alone.
- Keep this first payload-update implementation narrow enough to prove non-woven working-payload replacement behavior without absorbing the later `11-alice-bio-v2-woven` weave responsibilities or a generic RDF patch system.

## Summary

This task should follow the carried local `08-alice-bio-referenced` -> `09-alice-bio-referenced-woven` `weave` slice.

The next carried slice should target the settled Alice Bio transition from `09-alice-bio-referenced-woven` to `10-alice-bio-updated`.

The target behavior is deliberately narrow:

- update the existing working payload file `alice-bio.ttl` for the already managed payload artifact `alice/bio`
- keep the working payload file at the existing root path rather than relocating it before the later woven `v2` slice
- leave `alice/bio/_history001/_s0001/...` unchanged until the next `weave`
- leave `_mesh/_inventory/inventory.ttl`, `alice/_knop/_inventory/inventory.ttl`, `alice/_knop/_references/references.ttl`, `alice/_knop/_references/index.html`, `alice/_knop/_references/_history001/...`, `alice/bio/index.html`, and `alice/bio/_knop/_inventory/inventory.ttl` unchanged
- keep the change single-artifact and non-woven: in the settled `09` -> `10` fixture, no file other than `alice-bio.ttl` changes

This task should prove the first semantic payload-update path without folding in `11-alice-bio-v2-woven`, Bob extraction, or generalized RDF-editing abstractions.

## Discussion

### Why this is the next slice

The settled fixture ladder and Accord manifest make the next missing implementation-bearing step explicit:

- semantic change
- weave

After `09-alice-bio-referenced-woven`, the next carried step is the non-woven payload update, not the later `11` weave and not the cross-cutting RDF-parsing cleanup task.

Jumping straight to `11-alice-bio-v2-woven` would blur the same boundary the fixture ladder is trying to preserve:

- `payload.update` changes the current semantic payload bytes
- `weave` versions, validates, and regenerates the current surface afterward

### Why this slice should stay narrow

The settled `10-alice-bio-updated` fixture is deliberately clean. The repo diff from `09` to `10` changes only `alice-bio.ttl`.

Within that one-file change, the semantic content shift is still meaningful:

- use explicit mesh-root IRIs like `<alice>` and `<bob>` rather than the prior `:` prefix shorthand
- add `<alice/bio> dcterms:creator <alice>`
- expand `<bob>` into a local `schema:Person` description with `foaf:givenName` and `foaf:nick`

At the same time, the first payload snapshot and all current support artifacts remain frozen. That makes this a good carried slice because it proves semantic-update behavior directly without conflating it with versioning, page generation, or extraction behavior.

### Existing spec posture

This slice should get a dedicated [[wd.spec.2026-04-04-payload-update-behavior]] note before implementation.

Unlike `weave`, `integrate`, `knop.create`, and `knop.addReference`, there is no current behavior note for `payload.update`, and this is a distinct manifest-backed operation with its own machine-facing name.

The existing [[wd.spec.2026-04-04-integrate-behavior]] and [[wd.spec.2026-04-03-weave-behavior]] notes should be treated as neighboring context, not as a substitute for a real `payload.update` behavior note.

### Working-file posture

The first carried `payload.update` slice should update the bytes of the already managed working payload file in place.

That means:

- the target designator should already resolve to an existing integrated payload artifact
- the local runtime should resolve the existing working located file for that payload artifact from the already-versioned payload surface rather than treating existing history as an unsupported shape
- local replacement input should accept either a plain filesystem path or an explicit `file:` URL, reject remote `scheme://` sources, and avoid misclassifying colon-containing filenames as URLs
- the current slice should not invent a patch language, relocate the working file, or create a new historical snapshot before the later `11` weave
- the current slice should not route through any page-regeneration path; the `09` catalog and payload pages are frozen context for this semantic update, not outputs of it

## Resolved Questions

- The machine-facing job kind and manifest `operationId` should stay `payload.update`.
- `payload.update` should get a dedicated `wd.spec.*` note before implementation rather than being folded into the weave note.
- The first local request/result boundary should stay narrow around an existing payload `designatorPath` plus a replacement source input, while keeping host staging and file-replacement details in the local runtime rather than shared `core`.
- The first carried slice should update the existing working payload bytes in place rather than introducing a general RDF diff or patch abstraction.
- The first carried slice should treat the existing `alice/bio` payload artifact history and the frozen `09` generated pages as normal preconditions, not as signals that the runtime is already “too woven” to update.
- The current local validation floor should stay narrow: changed RDF should parse cleanly and match the settled fixture semantics, while broader merged-graph or SHACL validation remains a later concern.
- The first local source boundary should stay explicit: support local filesystem paths and `file:` URLs, reject remote URL schemes, and keep host-path interpretation in local runtime rather than shared `core`.

## Decisions

- Treat `09-alice-bio-referenced-woven` -> `10-alice-bio-updated` as the next carried implementation slice.
- Use the settled Alice Bio `10-alice-bio-updated` manifest and fixture as the first acceptance target.
- Add a dedicated [[wd.spec.2026-04-04-payload-update-behavior]] note for this slice.
- Keep the first `payload.update` implementation local or in-process over shared `core` and `runtime`.
- Keep the slice single-artifact and non-woven: in the settled acceptance target, only `alice-bio.ttl` should change.
- Preserve the current working file placement at `alice-bio.ttl` for this first slice.
- Leave `alice/bio/_history001/_s0001/...`, `_mesh/_inventory/inventory.ttl`, `alice/_knop/_inventory/inventory.ttl`, `alice/_knop/_references/references.ttl`, `alice/_knop/_references/index.html`, `alice/_knop/_references/_history001/...`, `alice/bio/index.html`, and `alice/bio/_knop/_inventory/inventory.ttl` unchanged in this non-woven step.
- Do not absorb `11-alice-bio-v2-woven`, Bob extraction, generic RDF patching, daemon work, or broader rendering ambitions into this task.

## Contract Changes

- This task may introduce the first thin public request/result examples for `payload.update` in `semantic-flow-framework`.
- This task should not broaden the public contract into a generic RDF-editing, merge, or patch API beyond what the carried `09` -> `10` slice actually proves.

## Testing

- Follow [[wd.testing]].
- Add failing unit tests for narrow `payload.update` planning and validation logic where practical.
- Start with failing integration and black-box CLI tests against the settled `10-alice-bio-updated` fixture target so the single-file invariant is locked in before implementation.
- Add integration tests for local filesystem results against the settled `10-alice-bio-updated` fixture target.
- Add a black-box CLI acceptance test scoped by the settled `10-alice-bio-updated` Accord manifest.
- Cover both accepted local source forms: plain filesystem paths and explicit `file:` URLs.
- Add regression coverage that remote `scheme://` inputs are rejected and colon-containing filenames still stay on the filesystem-path path.
- Lock in fail-closed behavior: invalid Turtle replacement input should abort the update and leave the current working payload file unchanged.
- Cover CLI validation for conflicting positional versus `--designator-path` inputs and for a missing designator path before logging or execution starts.
- Keep the comparison black-box and fixture-oriented, with strong checks that untouched support artifacts remain unchanged.

## Non-Goals

- implementing `11-alice-bio-v2-woven`
- creating a new payload historical state under `alice/bio/_history001/...`
- updating `_mesh/_inventory` or any Knop inventory in this non-woven step
- generating or regenerating HTML pages
- creating `bob/_knop` support artifacts or performing Bob extraction
- introducing a generic RDF diff, merge, or patch language
- relocating `alice-bio.ttl`
- implementing daemon endpoints

## Implementation Plan

- [x] Draft [[wd.spec.2026-04-04-payload-update-behavior]] and settle the first local request/result boundary for `payload.update`.
- [x] Define the first local CLI surface for the carried `payload.update` operation.
- [x] Add failing integration and black-box CLI tests for the narrow `09` -> `10` payload-update behavior, then add unit tests where a real planning or validation seam appears.
- [x] Implement the first local or in-process `payload.update` path over shared `core` and `runtime`.
- [x] Draft or refine the thin public API example or contract fragment for `payload.update` in `semantic-flow-framework` if this slice sharpens the public contract.
- [x] Update relevant overview/spec/framework notes as the slice settles.

## Outcome

The carried `09-alice-bio-referenced-woven` -> `10-alice-bio-updated` slice is now implemented locally.

- `payload.update` now has a dedicated behavior note at [[wd.spec.2026-04-04-payload-update-behavior]].
- the first local CLI surface is `weave payload update <source> [designatorPath]`, with `--designator-path` as the explicit option form
- shared `core` now plans replacement of the already managed working payload file for an existing woven payload artifact, using parser-backed inventory checks rather than brittle string matching, while local `runtime` resolves the workspace state and stages replacement bytes from a local path or explicit `file:` URL
- the local runtime rejects remote URL schemes, keeps colon-containing filenames on the filesystem-path path, and fails closed if replacement Turtle does not parse, leaving the existing working payload file untouched
- the carried implementation keeps the settled `10` invariant: only `alice-bio.ttl` changes, while `_mesh/_inventory/inventory.ttl`, Knop inventories, historical payload snapshots, and generated pages remain unchanged
- focused unit, integration, and black-box CLI coverage now lock the slice against the settled `10-alice-bio-updated` manifest and fixture
- broader RDF parsing cleanup still belongs in [[wd.completed.2026.2026-04-04_0952-rdf-parsing]] rather than this narrow carried slice
