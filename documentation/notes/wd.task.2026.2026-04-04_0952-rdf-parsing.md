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

Weave currently uses `n3` to validate generated Turtle parses, and `core/weave` now also uses parsed quads for some source-payload fact resolution. Even so, several carried slices still inspect or mutate RDF by reading Turtle as text.

That was acceptable for the first narrow fixture-driven slices, but it is now real technical debt:

- four runtime loaders still extract `meshBase` via regex
- runtime `extract` and `weave` now carry near-duplicate Turtle block parsers for Knop, payload, and ReferenceCatalog discovery
- `core/weave` slice detection and shape assertions still rely on required Turtle fragments
- `core/extract`, `core/knop/create`, and `core/integrate` still perform fixture-shaped string surgery over existing Turtle

This task exists to make that debt explicit and scoped. It is not an argument to rewrite all RDF handling at once or to block current carried slices on a large parser refactor.

The immediate highest-value cleanup is narrower than a full rewrite:

- first, replace shared runtime readers over live workspace RDF
- second, deduplicate parser-aware inventory discovery across `extract` and `weave`
- later, revisit the broader core assertion and graph-mutation rewrites

That sequencing matters because the runtime readers are the most likely to fail on harmless Turtle serialization changes in a live workspace, while the mutation rewrites are larger structural work that should not automatically block the next publication-facing slice.

## Current Status

- This note is still open.
- The original inventory in this note became incomplete once the `11 -> 12` `extract` and `12 -> 13` extracted-resource `weave` slices landed.
- `src/core/weave/weave.ts` now has a partial RDF-aware seam for source payload fact lookup, so the task should build on that rather than starting from zero.
- The next defensible cleanup step before [[wd.task.2026.2026-04-06_1905-markdown-payload-publishing]] is the shared runtime read-path work, not the larger `_mesh/_inventory` mutation rewrite.

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
- runtime inventory discovery used by `extract` and `weave`
- `core/weave` slice detection and shape assertions

By contrast, the line-oriented `_mesh/_inventory` mutation in `core/knop/create` and `core/integrate` is still real debt, but it is a larger graph-rewrite project and not the best immediate blocker if the goal is to stabilize the current carried runtime before the next publication-facing task.

## Current Locations

### Priority 1: Runtime RDF reads that load required workspace facts

- `src/runtime/knop/create.ts`
  - `loadCurrentMeshState`
  - currently extracts `meshBase` from `_mesh/_meta/meta.ttl` with a regex over Turtle text
- `src/runtime/integrate/integrate.ts`
  - `loadCurrentMeshState`
  - currently extracts `meshBase` from `_mesh/_meta/meta.ttl` with a regex over Turtle text
- `src/runtime/extract/extract.ts`
  - `loadCurrentMeshState`
  - currently extracts `meshBase` from `_mesh/_meta/meta.ttl` with a regex over Turtle text
- `src/runtime/weave/weave.ts`
  - `loadMeshState`
  - currently extracts `meshBase` from `_mesh/_meta/meta.ttl` with a regex over Turtle text

These are the highest-priority replacements because they are shared runtime reads over live workspace data and are more likely to fail on harmless serialization changes.

### Priority 2: Runtime RDF discovery duplicated across `extract` and `weave`

- `src/runtime/weave/weave.ts`
  - `loadWeaveableKnopCandidates`
  - discovers Knop IRIs with `matchAll(/<([^>]+\\/_knop)> a sflo:Knop ;/g)` over `currentMeshInventoryTurtle`
  - `loadPayloadWorkingArtifact`, `loadReferenceCatalogWorkingArtifact`, and `loadReferenceTargetSourcePayloadArtifact` rely on `includes`, `split("\\n\\n")`, `startsWith`, and regex over Turtle blocks
- `src/runtime/extract/extract.ts`
  - `loadExtractSourcePayloadCandidates`
  - discovers Knop IRIs with `matchAll(/<([^>]+\\/_knop)> a sflo:Knop ;/g)` over `currentMeshInventoryTurtle`
  - `loadExtractSourcePayloadCandidate` relies on `includes`, `split("\\n\\n")`, `startsWith`, and regex over Turtle blocks

This should move to shared parsed-quads inspection of `MeshInventory`, `KnopInventory`, payload-artifact, and ReferenceCatalog relationships so `extract` and `weave` stop carrying two near-identical text parsers.

### Priority 3: Core `weave` shape assertions expressed as string fragments

- `src/core/weave/weave.ts`
  - `detectPendingWeaveSlice`
  - currently classifies carried weave slices through required string fragments and `includes` checks
- `src/core/weave/weave.ts`
  - current mesh and Knop shape assertion helpers
  - currently validate supported slice shapes and "already has history" through specific Turtle fragments and `includes` checks

These are not generic validators yet, but they should still reason over parsed RDF terms rather than specific Turtle formatting.

Partial progress already exists here:

- `src/core/weave/weave.ts`
  - `requireLiteralValue`
  - `requireNamedNodePath`
  - `parseTurtleQuads`
  - already use `n3` quads for source-payload fact resolution while rendering extracted/current pages

That seam should be reused rather than reintroducing another ad hoc parser path.

### Priority 4: Narrow extract-specific Turtle surgery

- `src/core/extract/extract.ts`
  - `injectReferenceTargetState`
  - `reorderMeshInventoryLocatedFiles`
  - `normalizeExtractKnopInventoryTurtle`
  - currently mutate planned Turtle through regex insertion and block reordering
- `src/runtime/weave/weave.ts`
  - `loadPayloadWorkingArtifact`
  - still performs deliberate narrow block parsing over Knop inventory Turtle for the carried slice

These are real RDF-handling debt, but they are lower priority than the shared runtime readers above unless the carried extract/weave surfaces broaden and need to tolerate more flexible Turtle serialization.

### Priority 5: Core Turtle mutation via line-oriented mesh-inventory editing

- `src/core/knop/create.ts`
  - `renderUpdatedMeshInventoryTurtle`
  - `insertKnopIntoMeshBlock`
  - `insertKnopBlock`
  - `insertKnopInventoryLocatedFile`
  - currently checks for existing graph facts via string includes and rewrites `_mesh/_inventory/inventory.ttl` by line indexing and `splice`
- `src/core/integrate/integrate.ts`
  - `renderUpdatedMeshInventoryTurtle`
  - `insertKnopIntoMeshBlock`
  - `insertPayloadAndKnopBlocks`
  - `insertLocatedFileDeclarations`
  - currently checks for existing graph facts via string includes and rewrites `_mesh/_inventory/inventory.ttl` by line indexing and `splice`

These are still the biggest structural cleanup items. They should eventually parse the existing inventory graph, apply graph-level changes, and reserialize, but they are not the most urgent blocker if the goal is to stabilize the current runtime before payload publishing.

## Suggested Follow-Up Order

1. Replace runtime `meshBase` regex extraction in `knop create`, `integrate`, `extract`, and `weave` with one shared RDF-aware helper.
2. Replace the duplicated runtime `extract` and `weave` Knop/payload/reference discovery logic with shared parsed inventory inspection.
3. Replace `core/weave` string-fragment slice detection and shape assertions with graph-aware slice assertions that reuse the existing quad-parsing seam where possible.
4. Re-evaluate the remaining narrow `core/extract` and runtime block parsers once the shared runtime readers are in place.
5. Replace `core/knop/create` and `core/integrate` line-oriented mesh-inventory mutation with graph mutation plus serialization.

## Decisions

- Treat regex, substring, and line-oriented Turtle structure inspection as one cleanup family for this task.
- Treat `split("\\n\\n")`, `startsWith`, and similar block-oriented Turtle parsing as part of the same cleanup family when they infer RDF structure.
- Prioritize shared runtime workspace reads before broader graph-mutation refactors.
- Fold the newer `extract` and extracted-resource `weave` readers into this task rather than creating a second RDF-cleanup note.
- Keep pure rendering helpers out of scope unless they first inspect existing Turtle structure.
- Consider the shared runtime read-path cleanup the most defensible next step before [[wd.task.2026.2026-04-06_1905-markdown-payload-publishing]].
- Do not block Markdown payload publishing on rewriting `core/knop/create` and `core/integrate` mesh-inventory mutation if the higher-risk runtime reader cleanup has already landed.
- Do not hide these replacements inside unrelated feature tasks unless the affected location is already being touched for another concrete reason.

## Contract Changes

- No public Semantic Flow API contract changes are required.
- This task changes internal RDF handling robustness, not the externally intended semantic behavior.

## Testing

- Each replaced runtime loader should gain or keep tests proving it still resolves the intended workspace facts.
- Refactors should preserve the current carried-slice acceptance tests for `mesh create`, `knop create`, `integrate`, `extract`, and `weave`.
- New RDF-aware helpers should be tested against Turtle that is semantically equivalent but formatted differently from the current fixtures where practical.
- Shared runtime inventory readers should gain tests that cover Knop discovery, payload-artifact discovery, ReferenceCatalog discovery, and current-history resolution under equivalent-but-differently-formatted Turtle where feasible.

## Non-Goals

- rewriting every RDF serializer in the repository
- turning this task into a generic SHACL-validation effort
- redesigning the carried-slice fixture ladder
- broadening current operation behavior beyond the settled fixture targets

## Related Coderabbit comments

- The currently relevant review guidance is the repeated request to replace narrow string-based Turtle readers in `src/runtime/weave/weave.ts` and `src/runtime/extract/extract.ts` with parser-aware logic or, at minimum, explicitly documented narrow assumptions.
- Recent HTML helper dedupe and escaping comments were addressed separately and are not part of this task any more.

## Implementation Plan

- [ ] Add a shared RDF-aware helper for reading `meshBase` from `_mesh/_meta/meta.ttl` and replace the four runtime regex call sites.
- [ ] Add shared parsed inventory helpers and replace duplicated runtime discovery in `src/runtime/extract/extract.ts` and `src/runtime/weave/weave.ts`.
- [ ] Replace string-fragment slice detection and shape assertions in `src/core/weave/weave.ts` with graph-aware checks that reuse the existing quad-parsing seam where possible.
- [ ] Re-evaluate whether the carried `extract` and extracted-resource `weave` surfaces still need fixture-shaped string parsing once the shared runtime discovery helpers are in place.
- [ ] Replace line-oriented `_mesh/_inventory/inventory.ttl` mutation in `src/core/knop/create.ts` with graph mutation plus serialization.
- [ ] Replace line-oriented `_mesh/_inventory/inventory.ttl` mutation in `src/core/integrate/integrate.ts` with graph mutation plus serialization.
