---
id: v4m8n2q1c7x5k9b3j6t0rpa
title: 2026 04 04 Integrate Alice Bio
desc: ''
updated: 1775320590523
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

## Resolved Questions

- `integrate` should get a dedicated `wd.spec.*` note before implementation. Unlike the first `weave` slice, there is no existing behavior note to reuse, and the `05` -> `06` transition is already an externally visible cross-subsystem boundary with a manifest-backed acceptance target.
- The first local CLI surface should take the source as the primary positional input and require `designatorPath` either as a second positional argument or via `--designator-path`. The current slice should resolve `meshBase` from the existing workspace mesh support surface rather than asking users to repeat it.
- The filesystem-separation tension should be resolved by keeping host paths out of `core`. The local CLI/runtime may accept a local path or `file:` URL as the source input, but shared `core` planning should operate on the resulting mesh-relative working file path that becomes the payload artifact's `hasWorkingLocatedFile`.
- The first public `integrate` request/result examples in `semantic-flow-framework` should stay thin: identify the existing mesh, one `designatorPath`, and one source URI, then report only created and updated semantic resources. Host filesystem paths, copy or staging policy, and later remote-fetch behavior should stay out of the thin core contract.

## Decisions

- Treat `05-alice-knop-created-woven` -> `06-alice-bio-integrated` as the next carried implementation slice.
- Use the settled Alice Bio `06-alice-bio-integrated` manifest and fixture as the first acceptance target.
- Add a dedicated [[wd.spec.2026-04-04-integrate-behavior]] note for this slice rather than leaving the operation semantics implicit in the fixture diff alone.
- Keep the first `integrate` implementation local or in-process over shared `core` and `runtime`.
- Make the first local CLI surface `weave integrate <path-or-file-url> [designatorPath]` with `--designator-path` as the explicit option form, and resolve `meshBase` from the existing workspace.
- Keep host filesystem paths out of shared `core` by planning `integrate` from `designatorPath` plus a mesh-relative working file path, while leaving room for later runtime staging from remote sources.
- Keep the working payload bytes at `alice-bio.ttl` for this first slice rather than relocating the file before the woven step.
- Do not absorb payload weaving, page generation, explicit histories, referenced-resource extraction, or daemon work into this task.

## Contract Changes

- This task may introduce the first thin public request/result examples for `integrate` in `semantic-flow-framework`, including a semantic source-URI input without standardizing host filesystem paths.
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

- [x] Decide whether `integrate` needs a dedicated `wd.spec.*` note before implementation.
- [x] Define the first local request/result shapes for `integrate` in shared `core` and `runtime`.
- [x] Define the exact first local CLI surface for the carried `integrate` operation.
- [x] Add failing unit and integration tests for the first `integrate` behavior.
- [x] Implement the first local or in-process `integrate` path over shared `core` and `runtime`.
- [x] Add a black-box CLI acceptance test scoped by the settled `06-alice-bio-integrated` Accord manifest.
- [x] Draft the first thin public API example or contract fragment for `integrate` in `semantic-flow-framework` if this slice sharpens the public contract.
- [x] Update relevant overview/spec/framework notes as the slice settles.

## coderabbit review

Verify each finding against the current code and only fix it if needed.

Inline comments:
In `@documentation/notes/conv.2026.2026-04-04_0839-integrate-alice-bio-codex.md`:
- Line 17: Replace the machine-specific absolute link in the sentence that
references "[wd.task.2026.2026-04-04-integrate-alice-bio.md]" with a
repo-relative path; update the link target from
"/home/.../weave/documentation/notes/wd.task.2026.2026-04-04-integrate-alice-bio.md"
to a relative path such as
"documentation/notes/wd.task.2026.2026-04-04-integrate-alice-bio.md" or
"./wd.task.2026.2026-04-04-integrate-alice-bio.md" so the Markdown link is
portable and does not leak local environment details.

In `@documentation/notes/conv.2026.2026-04-04_0839-knop-create-codex.md`:
- Line 17: This file contains absolute host filesystem links like
/home/djradon/hub/semantic-flow/weave/documentation/notes/wd.task.2026.2026-04-03-weave-bootstrap-mesh-create.md
which expose local paths and will break elsewhere; replace each absolute path
with a repo-relative link (e.g.,
documentation/notes/wd.task.2026.2026-04-03-weave-bootstrap-mesh-create.md) or a
wiki-style note link everywhere it appears (including the other occurrences you
flagged), preserving the same anchor text and markdown link syntax.

In `@src/runtime/integrate/integrate.ts`:
- Around line 175-189: resolveLoggers currently throws away a single provided
logger; preserve any provided logger and only create the missing one(s).
Implement by calling createRuntimeLoggers() once to get
defaultOperational/defaultAudit, then return { operationalLogger:
options.operationalLogger ?? defaultOperational, auditLogger:
options.auditLogger ?? defaultAudit } so an explicitly passed operationalLogger
or auditLogger is kept. Update resolveLoggers to use those symbols
(resolveLoggers, createRuntimeLoggers, operationalLogger, auditLogger) and
ensure no provided logger is overwritten.
- Around line 171-173: The user-facing string in describeIntegrateResult
currently uses fixed plural words and an awkward verb phrase; change
describeIntegrateResult (which takes an IntegrateResult with workingFilePath,
payloadArtifactIri, createdPaths.length and updatedPaths.length) to compute
counts and choose singular vs plural labels (e.g., "support artifact" vs
"support artifacts", "mesh artifact" vs "mesh artifacts") and format the
sentence with proper verb tense (e.g., "and updated M mesh artifact(s)") so the
message reads correctly for 0, 1, or many items.

---

Nitpick comments:
In `@src/runtime/integrate/integrate.ts`:
- Around line 322-339: The function assertUpdatedTargetsExist currently uses
blocking Deno.statSync; make it async by changing its signature to async
function assertUpdatedTargetsExist(...) and replace Deno.statSync(absolutePath)
with await Deno.stat(absolutePath) and keep the same error handling for
Deno.errors.NotFound; then update its call site (the place that invokes
assertUpdatedTargetsExist) to await the function so the async flow is preserved
(mirror how assertCreateTargetsDoNotExist is used).
- Around line 307-314: Replace the fragile regex extraction of meshBase from
meshMetadataTurtle (the meshBaseMatch block) with a proper Turtle parse using
n3's Parser and Store: parse meshMetadataTurtle into quads, query the store for
the predicate namedNode("sflo:meshBase"), and return quads[0].object.value; if
no quads found throw the same IntegrateRuntimeError("Could not resolve meshBase
from _mesh/_meta/meta.ttl"). Update references around meshBaseMatch and ensure
imports include Parser/Store/DataFactory (or use existing n3 imports) so
extraction is robust to whitespace, quotes and type annotations.