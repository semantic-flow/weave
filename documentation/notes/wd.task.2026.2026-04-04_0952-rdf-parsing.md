---
id: ztyyymaiv1nt04w7yreutfx
title: 2026 04 04_0952 Rdf Parsing
desc: ''
updated: 1775340809111
created: 1775321555314
---

## Goals

- Inventory every current production location where Weave interprets RDF/Turtle structure via regex, substring checks, or line-oriented text surgery instead of RDF-aware parsing.
- Separate the highest-risk runtime readers from the narrower carried-slice shape assertions and Turtle rewrite helpers.
- Define a pragmatic follow-up sequence so this cleanup can be done deliberately rather than piecemeal in unrelated feature tasks.

## Summary

Weave currently uses `n3` to validate generated Turtle parses, but several carried slices still inspect or mutate RDF by reading Turtle as text.

That was acceptable for the first narrow fixture-driven slices, but it is now real technical debt:

- runtime loaders extract facts such as `meshBase` via regex
- runtime `weave` discovers candidate Knops via regex and substring checks
- `core` shape assertions for the first local `weave` slice rely on required string fragments
- `core` mesh-inventory mutation for `knop create` and `integrate` still edits Turtle by line indexing and string insertion

This task exists to make that debt explicit and scoped. It is not an argument to rewrite all RDF handling at once or to block current carried slices on a large parser refactor.

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

## Current Locations

### Priority 1: Runtime RDF reads that load required workspace facts

- `src/runtime/knop/create.ts`
  - `loadCurrentMeshState`
  - currently extracts `meshBase` from `_mesh/_meta/meta.ttl` with a regex over Turtle text
- `src/runtime/integrate/integrate.ts`
  - `loadCurrentMeshState`
  - currently extracts `meshBase` from `_mesh/_meta/meta.ttl` with a regex over Turtle text
- `src/runtime/weave/weave.ts`
  - `loadMeshState`
  - currently extracts `meshBase` from `_mesh/_meta/meta.ttl` with a regex over Turtle text

These are the highest-priority replacements because they are shared runtime reads over live workspace data and are more likely to fail on harmless serialization changes.

### Priority 2: Runtime RDF discovery for current `weave` behavior

- `src/runtime/weave/weave.ts`
  - `loadFirstWeaveKnopCandidates`
  - discovers Knop IRIs with `matchAll(/<([^>]+\\/_knop)> a sflo:Knop ;/g)` over `currentMeshInventoryTurtle`
  - treats `currentKnopInventoryTurtle.includes("sflo:hasArtifactHistory")` as the signal that a Knop is already woven

This should move to parsed-quads inspection of `MeshInventory` and `KnopInventory` rather than regex and substring matching.

### Priority 3: Core `weave` shape assertions expressed as string fragments

- `src/core/weave/weave.ts`
  - `assertCurrentMeshInventoryShape`
  - currently validates the supported first-weave mesh inventory shape through required string fragments
- `src/core/weave/weave.ts`
  - `assertCurrentKnopMetadataShape`
  - currently validates Knop metadata shape and "already has history" by string includes
- `src/core/weave/weave.ts`
  - `assertCurrentKnopInventoryShape`
  - currently validates Knop inventory shape and "already has history" by string includes

These are not generic validators yet, but they should still reason over parsed RDF terms rather than specific Turtle formatting.

### Priority 4: Core Turtle mutation via line-oriented mesh-inventory editing

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

These are the biggest structural cleanup items. They should eventually parse the existing inventory graph, apply graph-level changes, and reserialize.

## Suggested Follow-Up Order

1. Replace runtime `meshBase` regex extraction in `knop create`, `integrate`, and `weave` with one shared RDF-aware helper.
2. Replace runtime `weave` Knop discovery and woven-state detection with parsed inventory inspection.
3. Replace `core/weave` string-fragment shape assertions with graph-aware slice assertions.
4. Replace `core/knop/create` and `core/integrate` line-oriented mesh-inventory mutation with graph mutation plus serialization.

## Decisions

- Treat regex, substring, and line-oriented Turtle structure inspection as one cleanup family for this task.
- Prioritize runtime workspace reads before broader graph-mutation refactors.
- Keep pure rendering helpers out of scope unless they first inspect existing Turtle structure.
- Do not hide these replacements inside unrelated feature tasks unless the affected location is already being touched for another concrete reason.

## Contract Changes

- No public Semantic Flow API contract changes are required.
- This task changes internal RDF handling robustness, not the externally intended semantic behavior.

## Testing

- Each replaced runtime loader should gain or keep tests proving it still resolves the intended workspace facts.
- Refactors should preserve the current carried-slice acceptance tests for `mesh create`, `knop create`, `integrate`, and `weave`.
- New RDF-aware helpers should be tested against Turtle that is semantically equivalent but formatted differently from the current fixtures where practical.

## Non-Goals

- rewriting every RDF serializer in the repository
- turning this task into a generic SHACL-validation effort
- redesigning the carried-slice fixture ladder
- broadening current operation behavior beyond the settled fixture targets

## Related Coderabbit comments

- Around line 24-28: The code in workingFileSentence calls
toRelativeHref(page.path, page.workingFilePath) twice, causing duplicate
computation; extract the result into a local variable (e.g., const workingHref =
toRelativeHref(page.path, page.workingFilePath)) and use workingHref in the
template string so workingFileSentence (and any other uses) reuses the single
computed value; update references in the surrounding function where
workingFileSentence is built.
- Around line 30-65: The templates interpolate unescaped values
(page.designatorPath, canonical, page.description, meshLabel, resourcePath,
workingFileSentence) into HTML; add a small HTML-escaping helper (e.g.,
escapeHtml) that replaces & < > " ' / and use it for all interpolated text and
for attribute values (href/title) in the template-generating function that
returns these HTML strings so every insertion uses escapeHtml(value) instead of
raw variables; ensure you only escape text nodes and attribute values (not
already-intended HTML) and write unit tests for escapeHtml to cover common edge
cases.

In `@src/runtime/weave/weave.ts`:
- Around line 250-302: The loadPayloadWorkingArtifact function uses brittle
string-based Turtle parsing (see split("\n\n"), the block search for
`<${designatorPath}> a sflo:PayloadArtifact...`, and the regex
/sflo:hasWorkingLocatedFile <([^>]+)>/) which is fragile but intentional for a
narrow fixture slice—add a clear comment above the loadPayloadWorkingArtifact
declaration stating that this is deliberate narrow-slice parsing, describing the
assumptions (specific Turtle serialization, blank-line-separated blocks, exact
predicate shapes), and include a TODO noting that a proper RDF parser should be
used if this function needs to handle more general/variable RDF serializations
in the future.

## Implementation Plan

- [ ] Add a shared RDF-aware helper for reading `meshBase` from `_mesh/_meta/meta.ttl` and replace the three runtime regex call sites.
- [ ] Replace `src/runtime/weave/weave.ts` candidate discovery and woven-state checks with parsed RDF inspection.
- [ ] Replace string-fragment slice assertions in `src/core/weave/weave.ts` with graph-aware checks.
- [ ] Replace line-oriented `_mesh/_inventory/inventory.ttl` mutation in `src/core/knop/create.ts` with graph mutation plus serialization.
- [ ] Replace line-oriented `_mesh/_inventory/inventory.ttl` mutation in `src/core/integrate/integrate.ts` with graph mutation plus serialization.
