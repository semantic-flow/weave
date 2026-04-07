---
id: ztyyymaiv1nt04w7yreutfx
title: 2026 04 04_0952 Rdf Parsing
desc: ''
updated: 1775340809111
created: 1775321555314
---

## Goals

- Inventory every current production location where Weave interprets RDF/Turtle structure via regex, substring checks, or line-oriented text surgery instead of RDF-aware parsing.
- Separate the highest-risk shared runtime readers from the narrower carried-slice shape assertions and Turtle rewrite helpers.
- Update this task to reflect the newer `extract` and extracted-resource `weave` slices rather than the earlier pre-Bob snapshot.
- Define a pragmatic follow-up sequence that clarifies what should land before [[wd.task.2026.2026-04-06_1905-markdown-payload-publishing]] and what can wait.

## Summary

Weave currently uses `n3` to validate generated Turtle parses, `core/weave` now uses parsed quads for some source-payload fact resolution, and `core/payload.update` already uses parsed quad matching for one settled carried shape. Even so, several carried slices still inspect or mutate RDF by reading Turtle as text.

That was acceptable for the first narrow fixture-driven slices, but it is now real technical debt:

- shared runtime `meshBase` loading, runtime inventory discovery, and `core/weave` carried-shape gating are now centralized in RDF-aware helpers, but the remaining narrow rewrite/mutation seams still inspect Turtle as text
- `core/extract`, `core/knop/create`, and `core/integrate` still perform fixture-shaped string surgery over existing Turtle

This task exists to make that debt explicit and scoped. It is not an argument to rewrite all RDF handling at once or to block current carried slices on a large parser refactor.

The immediate highest-value cleanup is narrower than a full rewrite:

- first, replace shared runtime readers over live workspace RDF
- second, deduplicate parser-aware inventory discovery across `extract`, `weave`, and `payload.update`
- later, revisit the broader core assertion and graph-mutation rewrites

That sequencing matters because the runtime readers are the most likely to fail on harmless Turtle serialization changes in a live workspace, while the mutation rewrites are larger structural work that should not automatically block the next publication-facing slice.

## Current Status

- This note is still open.
- The original inventory in this note became incomplete once the `11 -> 12` `extract` and `12 -> 13` extracted-resource `weave` slices landed.
- Priority 1 is now complete: `src/runtime/mesh/metadata.ts` provides one shared RDF-aware `meshBase` reader, and the six runtime call sites no longer regex `_mesh/_meta/meta.ttl`.
- Priority 2 is now complete: `src/runtime/mesh/inventory.ts` provides shared parsed inventory discovery for Knop lookup, payload working-file lookup, ReferenceCatalog working-file lookup, and extracted reference-target lookup across `extract`, `weave`, and `payload.update`.
- Priority 3 is now complete: `src/core/weave/weave.ts` now classifies carried weave slices and validates carried mesh/Knop/payload/reference shapes through parsed RDF facts rather than required Turtle fragments.
- The remaining `core/weave` block parser is now gone too: current ReferenceCatalog link discovery now parses quads, so `core/weave` no longer depends on `split("\\n\\n")` or regex block matching for carried ReferenceCatalog reads.
- Unit and integration coverage now prove that semantically equivalent mesh metadata Turtle is accepted across the affected runtime paths, and helper unit tests now cover semantically equivalent inventory Turtle for the shared runtime reader seam.
- `src/core/weave/weave.ts` already had a partial RDF-aware seam for source payload fact lookup, and `src/core/payload/update.ts` already proved the narrower "required facts over parsed quads" pattern for a carried slice; Priority 3 now extends that same posture to slice classification and carried-shape gating.
- The last narrow extract/extracted-weave rewrite seam is now explicitly shape-tested: `core/extract`'s located-file reorder and the `renderFirstExtractedKnopWovenMeshInventoryTurtle` `replaceExactOrThrow(...)` ladder both fail closed on semantically equivalent-but-differently-serialized inputs instead of silently drifting.
- Priority 5 is now complete too: `core/knop/create` and `core/integrate` now parse the carried MeshInventory facts they depend on and render the settled updated MeshInventory directly instead of mutating Turtle lines in place.
- The implementation plan in this note is now complete. The remaining open RDF debt here is intentionally narrower: the explicitly guarded extract/extracted-weave exact-shape seams that still fail closed on unsupported serialization changes.

## Discussion

### Why this needs its own task

The parsing debt is spread across runtime loading, runtime candidate discovery, and core inventory mutation.

If it is addressed opportunistically inside unrelated tasks, the likely result is inconsistent partial cleanup:

- one operation switches to quads
- sibling operations keep regex
- tests still encode line-fragile assumptions

This should instead be treated as a cross-cutting cleanup task with a clear inventory of touched locations.

### What counts as "replace regex with RDF-aware parsing"

For this task, the target is broader than literal regex.

The locations below should all count as RDF-parsing debt when they infer or rewrite graph structure through:

- `match` or `matchAll`
- `includes` checks that stand in for graph assertions
- `split("\\n")`, `indexOf`, or `splice` against Turtle source in order to mutate graph content

Pure serialization helpers that render new Turtle from known values are not in scope unless they first inspect existing Turtle text structurally.

### Sequencing posture

Before Markdown payload publishing, the most important risk is that shared runtime readers fail on harmless formatting changes in workspace Turtle files.

That argues for a near-term cleanup order of:

- runtime `meshBase` loading
- runtime inventory discovery used by `extract`, `weave`, and `payload.update`
- `core/weave` slice detection and carried-slice shape assertions

By contrast, the line-oriented `_mesh/_inventory` mutation in `core/knop/create` and `core/integrate` is still real debt, but it is a larger graph-rewrite project and not the best immediate blocker if the goal is to stabilize the current carried runtime before the next publication-facing task.

## Current Locations

### Completed: Shared runtime RDF reads that load required workspace facts

- `src/runtime/mesh/metadata.ts`
  - `loadWorkspaceMeshBase`
  - `resolveMeshBaseFromMetadataTurtle`
  - now parse `_mesh/_meta/meta.ttl` with `n3` quads and require exactly one `sflo:meshBase` `xsd:anyURI` literal
- `src/runtime/knop/create.ts`
  - `loadCurrentMeshState`
  - now delegates `meshBase` resolution to the shared runtime mesh metadata helper
- `src/runtime/integrate/integrate.ts`
  - `loadCurrentMeshState`
  - now delegates `meshBase` resolution to the shared runtime mesh metadata helper
- `src/runtime/extract/extract.ts`
  - `loadMeshState`
  - now delegates `meshBase` resolution to the shared runtime mesh metadata helper
- `src/runtime/weave/weave.ts`
  - `loadMeshState`
  - now delegates `meshBase` resolution to the shared runtime mesh metadata helper
- `src/runtime/payload/update.ts`
  - `loadCurrentPayloadState`
  - now delegates `meshBase` resolution to the shared runtime mesh metadata helper
- `src/runtime/knop/add_reference.ts`
  - `loadMeshBase`
  - now delegates `meshBase` resolution to the shared runtime mesh metadata helper

This priority is complete. The runtime is now robust to harmless Turtle serialization changes in mesh metadata for these carried local operations.

### Completed: Shared runtime inventory discovery across `extract`, `weave`, and `payload.update`

- `src/runtime/mesh/inventory.ts`
  - `listKnopDesignatorPaths`
  - `resolvePayloadArtifactInventoryState`
  - `resolveReferenceCatalogInventoryState`
  - `resolveReferenceTargetDesignatorPath`
  - now parse `MeshInventory`, `KnopInventory`, and `ReferenceCatalog` Turtle with `n3` quads and resolve only the specific carried facts the runtime needs
- `src/runtime/weave/weave.ts`
  - `loadWeaveableKnopCandidates`
  - now delegates Knop discovery to the shared runtime inventory helper
  - `loadPayloadWorkingArtifact`, `loadReferenceCatalogWorkingArtifact`, and `loadReferenceTargetSourcePayloadArtifact`
  - now delegate carried payload, ReferenceCatalog, and extracted-reference discovery to the shared runtime inventory helper
- `src/runtime/extract/extract.ts`
  - `loadExtractSourcePayloadCandidates`
  - now delegates Knop discovery to the shared runtime inventory helper
  - `loadExtractSourcePayloadCandidate`
  - now delegates carried payload-artifact and history discovery to the shared runtime inventory helper while keeping extract-specific fail-closed checks around current history resolution
- `src/runtime/payload/update.ts`
  - `loadCurrentPayloadState`
  - now delegates carried payload-artifact and working-file discovery to the shared runtime inventory helper

This priority is complete. The runtime no longer duplicates adjacent Knop/payload/reference inventory block parsers across those three carried operations.

Partial progress already existed here too and is still relevant:

- `src/runtime/extract/extract.ts`
  - `payloadMentionsTarget`
  - already parses working payload Turtle with `n3` quads when resolving whether a candidate payload mentions the requested extract target

### Completed: Core `weave` carried-shape gating over parsed RDF facts

- `src/core/weave/weave.ts`
  - `detectPendingWeaveSlice`
  - now classifies carried weave slices by parsing current KnopInventory Turtle and checking required/forbidden RDF facts rather than substring fragments
- `src/core/weave/weave.ts`
  - current mesh and Knop shape assertion helpers
  - now validate supported carried mesh/Knop/payload/reference shapes and "already has history" checks through parsed RDF facts rather than required Turtle fragments

This priority is complete. The planner still is not a generic validator, but it now reasons over parsed RDF terms instead of specific Turtle formatting for the carried slice gate.

The boundary stayed intentionally narrow:

- carried slice detection and settled-shape assertions moved from Turtle fragments to required RDF facts
- the change did not expand into generic RDF validation, SHACL, or a broad shape-engine effort

Existing parser-aware seams were reused here:

- `src/core/weave/weave.ts`
  - `requireLiteralValue`
  - `requireNamedNodePath`
  - `parseTurtleQuads`
  - already used `n3` quads for source-payload fact resolution while rendering extracted/current pages
- `src/core/weave/weave.ts`
  - `extractCurrentReferenceCatalogLinks`
  - now parses current ReferenceCatalog Turtle with `n3` quads and resolves carried link facts without relying on exact block shape, predicate order, or `a` shorthand
- `src/core/payload/update.ts`
  - `parseQuadKeys`
  - `quadSetHasAnyMatch`
  - already proved the narrower "required facts over parsed quads" approach against semantically equivalent Turtle for one carried payload-update shape

### Priority 4: Remaining narrow extract/extracted-weave Turtle surgery

- `src/core/extract/extract.ts`
  - `reorderMeshInventoryLocatedFiles`
  - still reorders the newly inserted `_knop/_inventory/inventory.ttl` `LocatedFile` block by splitting the planned MeshInventory Turtle into blank-line-delimited blocks
  - `planExtract` no longer mutates the created KnopInventory or ReferenceCatalog Turtle from sibling planner outputs; those two files are now rendered directly from known extract facts
- `src/core/weave/weave.ts`
  - `renderFirstExtractedKnopWovenMeshInventoryTurtle`
  - currently rewrites the settled `12 -> 13` MeshInventory Turtle by chaining `replaceExactOrThrow(...)` over exact fixture-shaped substrings, including:
    - the current `alice` identifier block before exposing `bob`
    - the extracted Knop block before adding its ResourcePage
    - the current MeshInventory history block before advancing `_s0004`
    - the `_s0003` manifestation block before inserting `_s0004`
    - the settled located-file block before adding the `_s0004` inventory file
    - the current identifier page block before exposing the new identifier page
    - the Knop page block before exposing the new Knop page
    - the MeshInventory page block before adding `_s0004` pages
  - this is intentionally narrow for the carried slice, but it is tightly coupled to exact whitespace, block boundaries, and predicate ordering

These are real RDF-handling debt, but they are now much narrower than before and are lower priority than the shared runtime readers above unless the carried extract/weave surfaces broaden and need to tolerate more flexible Turtle serialization.

Those seams are now intentionally guarded:

- `src/core/extract/extract_test.ts`
  - proves `planExtract` fails closed when the source payload `LocatedFile` block is semantically equivalent but no longer matches the settled block shape used by `reorderMeshInventoryLocatedFiles`
- `src/core/weave/weave_test.ts`
  - proves `planWeave` fails closed when the extracted Bob Knop block is semantically equivalent but no longer matches the settled block shape expected by `renderFirstExtractedKnopWovenMeshInventoryTurtle`

### Priority 5: Core Turtle mutation via line-oriented mesh-inventory editing

- `src/core/knop/add_reference.ts`
  - `renderUpdatedKnopInventoryTurtle`
  - no longer rewrites `_knop/_inventory/inventory.ttl` by line indexing and `splice`
  - now classifies unwoven vs woven carried KnopInventory shapes through parsed RDF facts and renders the updated inventory directly from known values while preserving the settled pre-weave fixture bytes
- `src/core/knop/create.ts`
  - `renderUpdatedMeshInventoryTurtle`
  - no longer rewrites `_mesh/_inventory/inventory.ttl` by line indexing and `splice`
  - now validates the carried `03 -> 04` MeshInventory shape through parsed RDF facts and renders the settled first-knop MeshInventory directly
- `src/core/integrate/integrate.ts`
  - `renderUpdatedMeshInventoryTurtle`
  - no longer rewrites `_mesh/_inventory/inventory.ttl` by line indexing and `splice`
  - now validates the carried `05 -> 06` MeshInventory shape through parsed RDF facts, resolves the existing woven Knop/identifier seam from quads, and renders the settled first-payload MeshInventory directly

This priority is now complete for the currently carried `knop create`, `integrate`, and `knop add_reference` slices. The broader future graph-mutation work, if needed, is now outside this task's immediate implementation plan.

## Suggested Follow-Up Order

1. Completed: replace runtime `meshBase` regex extraction in `knop create`, `integrate`, `extract`, `weave`, `payload.update`, and `knop.add_reference` with one shared RDF-aware helper.
2. Completed: replace the duplicated runtime `extract`, `weave`, and `payload.update` Knop/payload/reference discovery logic with shared parsed inventory inspection.
3. Completed: replace `core/weave` string-fragment slice detection and shape assertions with graph-aware carried-slice assertions that reuse the existing quad-parsing seam where possible.
4. Completed: explicitly shape-test the remaining `reorderMeshInventoryLocatedFiles` and extracted-weave `replaceExactOrThrow(...)` seam in `src/core/extract/extract.ts` and `src/core/weave/weave.ts` so they fail loudly when the settled fixture shape changes.
5. Completed: replace `core/knop/create` and `core/integrate` line-oriented MeshInventory mutation with parsed carried-shape checks plus direct settled rendering.

## Decisions

- Treat regex, substring, and line-oriented Turtle structure inspection as one cleanup family for this task.
- Treat `split("\\n\\n")`, `startsWith`, and similar block-oriented Turtle parsing as part of the same cleanup family when they infer RDF structure.
- Prioritize shared runtime workspace reads before broader graph-mutation refactors.
- Fold the newer `extract` and extracted-resource `weave` readers into this task rather than creating a second RDF-cleanup note.
- Keep pure rendering helpers out of scope unless they first inspect existing Turtle structure.
- Use one shared runtime mesh metadata parser for `_mesh/_meta/meta.ttl` rather than repeating per-operation `meshBase` readers.
- Reuse the existing `core/payload.update` parsed-quad matching posture as a model for carried-shape assertions where practical.
- Consider the shared runtime read-path cleanup the most defensible next step before [[wd.task.2026.2026-04-06_1905-markdown-payload-publishing]].
- Do not block Markdown payload publishing on rewriting `core/knop/create` and `core/integrate` mesh-inventory mutation if the higher-risk runtime reader cleanup has already landed.
- Do not block Markdown payload publishing on rewriting `core/knop/add_reference` inventory mutation if the higher-risk runtime reader cleanup has already landed.
- Do not hide these replacements inside unrelated feature tasks unless the affected location is already being touched for another concrete reason.

## Contract Changes

- No public Semantic Flow API contract changes are required.
- This task changes internal RDF handling robustness, not the externally intended semantic behavior.

## Testing

- Each replaced runtime loader should gain or keep tests proving it still resolves the intended workspace facts.
- A shared helper unit test plus equivalent-metadata integration tests now cover the completed `meshBase` reader replacement slice.
- Shared runtime inventory discovery now has helper unit tests that cover Knop discovery, payload-artifact discovery, ReferenceCatalog discovery, extracted reference-target discovery, and the carried distinction between a referenced history path and a typed ArtifactHistory node.
- `src/core/weave/weave_test.ts` now covers semantically equivalent carried Turtle for first payload planning, first ReferenceCatalog planning, extracted ReferenceCatalog link reads, and second-payload slice detection so the planner gate and current ReferenceCatalog reads are no longer formatting-coupled to the settled fixtures.
- `src/core/extract/extract_test.ts` and `tests/integration/extract_test.ts` still assert the settled Bob extract fixture exactly, which now implicitly covers the direct renderers for the created KnopInventory and ReferenceCatalog files while leaving only the MeshInventory located-file reorder as an explicit narrow text seam.
- `src/core/extract/extract_test.ts` now also proves the remaining located-file reorder fails closed when the source payload `LocatedFile` block changes only in serialization shape.
- `src/core/weave/weave_test.ts` now also proves the remaining extracted-weave `replaceExactOrThrow(...)` ladder fails closed when the current extracted Knop block changes only in serialization shape.
- `src/core/knop/add_reference_test.ts` now covers both unwoven and woven supported KnopInventory inputs and proves the parser-backed rewrite accepts semantically equivalent woven Turtle while preserving the settled referenced fixture bytes.
- `src/core/knop/create_test.ts` and `src/core/integrate/integrate_test.ts` now compare the created and updated artifacts against the settled `04` and `06` fixture bytes and prove the parser-backed MeshInventory rewrites accept semantically equivalent current MeshInventory Turtle.
- Refactors should preserve the current carried-slice acceptance tests for `mesh create`, `knop create`, `integrate`, `extract`, and `weave`.
- New RDF-aware helpers should be tested against Turtle that is semantically equivalent but formatted differently from the current fixtures where practical.
- Shared runtime reader refactors should add or extend coverage for `payload.update` and `knop.add_reference`, not only `extract` and `weave`.
- Any retained narrow `replaceExactOrThrow(...)` seam should have tests that assert the exact accepted input shape, so formatting-coupled replacements fail loudly when the settled fixture shape changes.

## Non-Goals

- rewriting every RDF serializer in the repository
- turning this task into a generic SHACL-validation effort
- redesigning the carried-slice fixture ladder
- broadening current operation behavior beyond the settled fixture targets

## Related Coderabbit comments

- The currently relevant review guidance is the repeated request to replace narrow string-based Turtle readers in `src/runtime/weave/weave.ts` and `src/runtime/extract/extract.ts` with parser-aware logic or, at minimum, explicitly documented narrow assumptions.
- Another relevant review comment calls out `src/core/weave/weave.ts` `renderFirstExtractedKnopWovenMeshInventoryTurtle` as exact-string-coupled replacement logic that should either be made parser-aware or explicitly documented and guarded by shape tests if retained temporarily.
- Recent HTML helper dedupe and escaping comments were addressed separately and are not part of this task any more.

## Implementation Plan

- [x] Add a shared RDF-aware helper for reading `meshBase` from `_mesh/_meta/meta.ttl` and replace the six runtime regex call sites.
- [x] Add shared parsed inventory helpers and replace duplicated runtime discovery in `src/runtime/extract/extract.ts`, `src/runtime/weave/weave.ts`, and `src/runtime/payload/update.ts`.
- [x] Replace string-fragment slice detection and shape assertions in `src/core/weave/weave.ts` with graph-aware carried-slice checks that reuse the existing quad-parsing seam where possible.
- [x] Replace the carried `core/weave` ReferenceCatalog block parser with parsed-quad link discovery and equivalent-Turtle planner coverage.
- [x] Stop mutating the created extract KnopInventory and ReferenceCatalog Turtle from sibling planner outputs; render those files directly from known extract facts instead.
- [x] Explicitly shape-test the remaining extract located-file reorder and extracted-resource `weave` fixture-shaped rewrite seam so semantically equivalent block-shape changes fail closed.
- [x] Re-evaluate whether `src/runtime/knop/add_reference.ts` should switch to the same shared runtime mesh metadata reader in the first cleanup slice even though it does not inspect inventory structure.
- [x] Replace line-oriented `_knop/_inventory/inventory.ttl` mutation in `src/core/knop/add_reference.ts` with parsed-shape classification plus direct rendering that preserves the settled carried fixtures.
- [x] Replace line-oriented `_mesh/_inventory/inventory.ttl` mutation in `src/core/knop/create.ts` with graph-aware carried-shape checks plus direct settled rendering.
- [x] Replace line-oriented `_mesh/_inventory/inventory.ttl` mutation in `src/core/integrate/integrate.ts` with graph-aware carried-shape checks plus direct settled rendering.
