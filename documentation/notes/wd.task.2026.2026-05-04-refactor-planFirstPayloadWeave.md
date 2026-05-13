---
id: j3whxgx0cc4dmsas8asep6z
title: 2026-05-04-refactor-planFirstPayloadWeave
desc: ''
updated: 1777957090449
created: 1777957090449
---

## Goals

- Remove the unnecessary "settled first-payload-weave mesh inventory shape" restriction from `planFirstPayloadWeave` and the local `weave` path.
- Remove the stale pinned-only extracted-Knop weave guard that rejects current-tracking extraction sources created by `extract --all-terms --source`.
- Support the practical sidecar workflow where an operator creates a mesh, integrates more than one first-time payload artifact, and then runs one weave to version those pending payloads.
- Add minimal operator-visible progress output for local `weave` runs so long sidecar operations do not appear stalled.
- Keep the semantic invariant that MeshInventory progression must be knowable before writing historical states, but derive that progression from RDF instead of from a fixture-specific shape.
- Preserve existing carried fixture behavior for Alice Bio and Fantasy Rules sidecar states while widening the accepted input shapes.
- Use the URPX ontology demo as the motivating real-world case: a docs-rooted sidecar mesh with `ontology` and `shacl` integrated before the first payload weave.

## Summary

The current first-payload weave path still has an overly narrow guard. After `mesh create`, if a user integrates both `ontology/urpx-ontology.ttl` and `shacl/urpx-shacl.ttl` into a docs-rooted sidecar mesh and then runs `weave --mesh-root docs`, the planner fails with:

```text
The current local weave slice only supports a settled first-payload-weave mesh inventory shape.
```

That error is not a semantic model requirement. It is an implementation artifact from the carried fixture ladder. The true requirement is that the current MeshInventory history and next state can be resolved coherently. If that can be resolved, first-time payload artifacts without histories should be versionable even when more than one pending payload exists.

This task should refactor the first-payload weave planning path so it can handle multiple pending first-payload candidates in a deterministic transaction. The planner should no longer require the user to weave the empty mesh, integrate exactly one payload, weave, integrate the next payload, and weave again just to satisfy an internal shape guard.

The same URPX demo exposed a second blocker after `extract --all-terms`: first extracted-Knop weave still expects the old pinned extraction-source shape. Current extraction now creates `sfc:hasArtifactResolutionMode <.../ArtifactResolutionMode/Current>` by default, but `planFirstExtractedKnopWeave` still asserts `Pinned` plus `sfc:hasRequestedTargetState`. This task should include the corresponding fix so extracted term pages can be woven without forcing operators to migrate all terms back to pinned source states.

The demo also showed that local `weave` gives too little visible progress while it is doing real work. The command eventually prints a result summary and paths, and structured logs may exist under `.weave/logs`, but an operator running a large ontology/SHACL sidecar weave needs minimal stdout/stderr status as the command progresses. This should not become noisy tracing by default; it should be enough to show which phase is running and which high-level target group is being processed.

## Discussion

The current implementation already contains a partial generalization for "later first payload weave" work, tracked in [[wd.task.2026.2026-04-13_0910-weave-shape-generalization-for-later-carried-states]]. That work made it possible to add a new first-time payload to an already carried mesh inventory. It did not cover the adjacent but important case where a newly created mesh has multiple pre-weave payload integrations.

The failure mode appears when MeshInventory contains more than the one exact fixture-shaped pending payload expected by `resolveCurrentMeshInventoryProgressionForFirstPayloadWeave`. In the URPX demo, `docs/_mesh/_inventory/inventory.ttl` has both:

```turtle
<_mesh> sflo:hasKnop <ontology/_knop> .

<ontology> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:workingLocalRelativePath "../ontology/urpx-ontology.ttl" .

<_mesh> sflo:hasKnop <shacl/_knop> .

<shacl> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:workingLocalRelativePath "../shacl/urpx-shacl.ttl" .
```

That is a reasonable pre-weave state. The mesh inventory has registered two Knops and two payload artifacts; neither payload has a history yet. The user intent is clear: version both first payloads and produce pages. The current planner instead behaves as though first-payload weave can only ever occur against one settled branch shape.

After working around that first-payload limitation, the URPX run also showed a stale extracted-Knop assertion. For an extracted term such as `ontology/A`, `docs/ontology/A/_knop/_inventory/inventory.ttl` can legitimately contain:

```turtle
<ontology/A/_knop/_inventory#extraction-source> a sfc:ExtractionSource ;
  sfc:hasTargetArtifact <ontology> ;
  sfc:hasArtifactResolutionMode <https://semantic-flow.github.io/ontology/core/ArtifactResolutionMode/Current> .
```

That is the current intended default from [[wd.task.2026.2026-05-04-extraction-improvements]]. The first extracted-Knop weave path currently rejects it because `assertCurrentKnopInventoryShapeForFirstExtractedKnopWeave` still requires:

```turtle
sfc:hasRequestedTargetState <...> ;
sfc:hasArtifactResolutionMode <https://semantic-flow.github.io/ontology/core/ArtifactResolutionMode/Pinned> .
```

That pinned-only assertion should be replaced with validation that accepts both current and pinned extraction-source contracts, then preserves the chosen contract in the woven KnopInventory historical state.

There are two possible levels of fix:

- Narrow fix: improve the diagnostic and require operators to use the staged workflow.
- Real fix: generalize first-payload planning so multiple pending first payloads can be woven in one run, and generalize first extracted-Knop weave so current-tracking extracted terms can be woven.

The narrow fix is not enough. It would preserve avoidable friction and encode an operational ritual that does not belong in the model. The real fix should be done, but it needs to be implemented carefully because `weave` writes MeshInventory historical states and payload-local histories together.

The important design point is that MeshInventory should advance coherently. If multiple first payloads are woven in one transaction, we should prefer a single MeshInventory next state that reflects all newly current payload histories and resource pages, rather than creating a cascade of intermediate mesh inventory states inside one command. Intermediate states can be useful for auditability, but the current local transaction model already treats multi-target weaves as a batch in other areas; one coherent output state is easier to reason about and avoids order-dependent public history churn.

Candidate ordering still matters for deterministic file output and user-facing summaries. Pending payload candidates should be sorted by normalized designator path unless an explicit target list provides an order that must be preserved for requested targets. If both `ontology` and `shacl` are pending and the user runs an untargeted weave, the planned payload-local created files should be deterministic.

Status output should be designed separately from structured logging. The current runtime already has operational and audit loggers, but those are not a good substitute for in-terminal progress during an interactive local command. The CLI should emit concise progress lines such as candidate discovery, planning, writing files, and page generation. It should avoid printing every generated file during the work phase because the final summary already lists created and updated paths.

## Open Issues

- Should multi-pending first-payload weave create one MeshInventory next state containing all payload updates, or one MeshInventory state per payload? The current recommendation is one MeshInventory next state per command.
- Should explicitly targeted `weave --target designatorPath=ontology --target designatorPath=shacl` preserve target order for output ordering, while untargeted weave sorts by designator path?
- Should `weave --target designatorPath=ontology` leave a simultaneously pending `shacl` first payload untouched? The likely answer is yes: exact targeting should only weave selected candidates.
- Should first-payload weave also support recursive target selection under a parent path such as `--target designatorPath=ontology,recursive=true` for multiple pending payloads? This should follow existing target normalization semantics rather than adding special first-payload rules.
- Does generated page ordering or navigation currently assume only one first-payload candidate? This needs verification in the runtime page seam.
- Do Accord manifests need a new URPX-inspired fixture, or should the existing Fantasy Rules sidecar ladder be extended to cover two pending first payloads before the first payload weave?
- Should the extracted-Knop current-source fix live in this task or in [[wd.task.2026.2026-05-04-extraction-improvements]]? Because it blocks the same URPX demo and is a stale weave assertion, this note should track it, while the extraction-improvements note remains the source of the intended extraction-source contract.
- Should `renderFirstExtractedKnopWovenKnopInventoryTurtle` preserve the exact current pre-weave extraction-source block, or normalize it into a canonical current/pinned rendering? Prefer preserving the semantic contract while allowing canonical ordering in the woven output.
- Should minimal weave progress be on by default for local CLI runs, or gated behind a verbosity flag? The current recommendation is default-on for sparse phase/status lines, with any detailed per-file tracing left to a future verbosity option or existing logs.
- Should progress lines go to stdout or stderr? Prefer stderr for progress so stdout can remain more script-friendly for final result output, unless the existing CLI conventions strongly prefer stdout.

## Decisions

- The exact "settled first-payload-weave mesh inventory shape" is not a model invariant and should not remain the acceptance criterion.
- The invariant to keep is: MeshInventory progression must be derivable from the current RDF and the resulting transaction must write coherent current/history/next ordinal facts.
- First-payload weave should support multiple pending first payloads in one command.
- A multi-pending first-payload weave should create one MeshInventory next state for the command, unless later implementation work finds a concrete reason this breaks existing history semantics.
- First extracted-Knop weave must accept current-tracking extraction sources as valid, not just pinned historical-state sources.
- Woven extracted-Knop inventory must preserve the extraction-source resolution mode. Current stays current; pinned stays pinned with its requested target state.
- Local `weave` should emit sparse progress status during long-running operations. Status output is operational feedback, not part of the semantic mesh contract.
- Existing single-payload carried fixtures should remain valid and should not drift except where the generalized renderer normalizes semantically equivalent output in an intentional, tested way.

## Contract Changes

- `weave --mesh-root docs` should work when the mesh inventory contains more than one pending first-time payload artifact, as long as each selected candidate has a valid payload relationship, Knop inventory, Knop metadata, and resolvable working payload bytes.
- `weave --target ...` should allow selecting one or more pending first-time payload artifacts from a mesh that contains other pending payloads.
- The CLI should no longer require operators to interleave `integrate` and `weave` one payload at a time for first-time payloads.
- `weave --mesh-root docs` should work after `extract --all-terms --source ontology --accept-preview`, where extracted term inventories use current-tracking `sfc:ExtractionSource` contracts.
- Pinned extraction-source contracts created with `--source-state` should remain supported.
- `weave` should show minimal progress while discovering candidates, planning, writing files, and generating pages for large sidecar meshes.
- Existing behavior for a single pending first payload remains supported.
- Failure messages should describe the actual invalid condition, such as missing MeshInventory history progression, ambiguous target selection, missing payload working file, or malformed Knop inventory, rather than referring to a settled fixture shape.

## Testing

- Add core `planWeave` coverage for two pending first payloads against a newly created and initially woven docs-rooted sidecar MeshInventory.
- Add core coverage for exact targeting one pending first payload while another pending first payload remains registered but unselected.
- Add runtime/integration coverage that creates a sidecar mesh, integrates `ontology` and `shacl`, runs one `weave`, and verifies both payload histories, Knop support histories, MeshInventory current state, and generated pages.
- Add core/runtime coverage for first extracted-Knop weave with a current-tracking extraction source and verify the woven KnopInventory still records `ArtifactResolutionMode/Current` without `hasRequestedTargetState`.
- Keep or add coverage for first extracted-Knop weave with a pinned extraction source and verify the woven KnopInventory still records `ArtifactResolutionMode/Pinned` and `hasRequestedTargetState`.
- Add CLI coverage for minimal progress output, or unit-test the progress reporter if direct CLI stdout/stderr assertions would be brittle.
- Add or update CLI coverage for the same multi-pending sidecar flow.
- Add regression coverage for the old single first-payload Alice Bio and later first-payload carried state so the generalization does not break current fixtures.
- Run at least `deno task test` for this change; run `deno task lint` as required after the significant code change.

## Non-Goals

- Rewriting all of `src/core/weave/weave.ts` into a generic transaction engine in this task.
- Generalizing unrelated shape-specific weave seams except where they block the URPX sidecar flow.
- Changing `integrate` semantics; this task starts from the assumption that `integrate` may register a payload artifact without immediately versioning it.
- Changing extraction-source creation semantics or `extract --all-terms`; those are covered in [[wd.task.2026.2026-05-04-extraction-improvements]] and later split work. This task only fixes weave to honor the already-created current/pinned contracts.
- Designing a full verbosity/logging configuration system. This task only needs minimal progress for local weave runs.
- Renaming carried fixture branches or task notes.

## Implementation Plan

- [ ] Reproduce the URPX-shaped failure in a focused test: docs-rooted mesh, `ontology` and `shacl` integrated before first payload weave, then a single `weave`.
- [ ] Trace the first-payload planner flow from `detectPendingWeaveSlice` through `planFirstPayloadWeave`, `resolveCurrentMeshInventoryProgressionForFirstPayloadWeave`, and `renderFirstPayloadWovenMeshInventoryTurtle`.
- [ ] Introduce a generalized MeshInventory progression resolver for first-payload weave that validates the current MeshInventory history/current/latest/next ordinal facts without requiring one fixture-specific subject set.
- [ ] Refactor first-payload planning so a `WeavePlan` can include multiple first-payload candidates in one transaction.
- [ ] Render one updated MeshInventory working file and one new MeshInventory historical manifestation that includes all selected first-payload updates.
- [ ] Render payload-local histories and Knop support histories for each selected first-payload candidate.
- [ ] Keep deterministic candidate ordering for created files, updated files, generated pages, and console summaries.
- [ ] Ensure exact target selection can weave one pending first payload without forcing unrelated pending payloads.
- [ ] Replace fixture-shape error text with condition-specific validation errors.
- [ ] Reproduce the extracted-term failure after `extract --all-terms --source ontology --accept-preview`: first extracted-Knop weave rejects `ArtifactResolutionMode/Current` for a term such as `ontology/A`.
- [ ] Refactor `assertCurrentKnopInventoryShapeForFirstExtractedKnopWeave` so it validates an `sfc:ExtractionSource` with exactly one supported resolution mode: `Current` with no requested target state, or `Pinned` with exactly one requested target state.
- [ ] Refactor `renderFirstExtractedKnopWovenKnopInventoryTurtle` so it preserves the selected extraction-source contract instead of always rendering pinned mode.
- [ ] Update `planFirstExtractedKnopWeave` and source-payload resolution plumbing so current-mode extracted pages read from the current source payload and pinned-mode extracted pages read from the requested historical state.
- [ ] Replace extracted-Knop fixture-shape error text with condition-specific validation errors.
- [ ] Inspect existing CLI/runtime logging to determine whether progress output can reuse a small reporter interface or should stay as CLI-owned status writes.
- [ ] Add minimal `weave` progress output for candidate discovery, planning, file writes, and page generation.
- [ ] Keep progress output sparse and deterministic; avoid per-file spam during the work phase.
- [ ] Add core, runtime/integration, and CLI tests for multi-pending first-payload weave.
- [ ] Add core, runtime/integration, and CLI tests for current-tracking extracted-term weave after `extract --all-terms --source`.
- [ ] Add focused test coverage for progress output or the progress reporter.
- [ ] Run `deno task test`.
- [ ] Run `deno task lint`.
- [ ] Update [[wd.codebase-overview]] and [[wd.decision-log]] if the implemented contract materially changes from the decisions above.
