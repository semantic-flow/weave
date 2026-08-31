---
id: 2f6eb47ee31647c5b0fe87a6258cc29d
title: 'release notes v0.7.0'
desc: 'v0.7.0: untargeted multi-pending first-payload weave, nested extraction sources, append-only ReferenceCatalog inventory, and the vocabulary-namespace IRI compaction fix'
updated: 1785691343498
created: 1785691343498
---

## Summary

`v0.7.0` is a weave-correctness release. It removes three conditions under which `weave` refused meshes it should have accepted — untargeted multi-pending first-payload sets, extracted-term weave from nested sources, and any mesh published under the SFLO vocabulary namespace — and migrates the first production inventory renderer onto the append-only planner.

It is also the first release that can generate the published SFLO mesh. That corpus (`gh-pages` root commit `46b87d7`) was built from `main` at `2f04b71`, which is this release's code: `v0.6.0` provably could not produce it, because the vocabulary-namespace IRI compaction defect fixed here made every weave of that mesh fail. Consumers reproducing the published SFLO mesh need `0.7.0` or later.

Three of the four changes are labeled `fix`, but the batch dispatch is a genuine capability addition — a previously-refused invocation now succeeds — so this is a minor, not a patch.

## Highlights

- **Untargeted multi-pending first-payload weave, batched into one transaction.** When every candidate in an untargeted set classifies as `firstPayloadWeave` (and `overwrite` is not requested), `planWeave` now dispatches the set through the existing coherent payload-batch planner, and `prepareVersionExecution` routes it as one policy-validated `VersionPlan`. The result is one MeshInventory state and one working update for the whole set, with canonical ordering independent of discovery order. Single-target and explicit multi-target behavior is unchanged; mixed, recursive, and later-payload sets stay on the sequential path.
- **Extracted-term weave from nested sources.** `assertCurrentMeshInventoryShapeForFirstExtractedKnopWeave` no longer demands a Knop, working inventory locator, and page for the source payload's derived first path segment. A grouping path segment is not automatically a managed Semantic Flow identifier, and Weave no longer synthesizes Knop facts, files, or pages for one. The actual source-payload/Knop and target-Knop assertions are unchanged.
- **Append-only current-only ReferenceCatalog inventory weave.** `renderCurrentOnlyReferenceCatalogWovenKnopInventoryTurtle` now routes through `planInventoryAppend` instead of splitting, replacing, and rejoining subject blocks. Existing inventory bytes are preserved as an exact prefix, and a semantic no-op returns the exact input bytes. This is the first production consumer migrated onto the append planner.
- **Mesh IRIs under the vocabulary namespace no longer compact to invalid Turtle.** `renderNamedNodeTerm` compacted `<https://semantic-flow.github.io/sflo/ontology/_knop/_sources>` to `sflo:_knop/_sources`; a Turtle prefixed name's local part may not contain `/`, so the carried support facts Weave had just rendered failed to re-parse and every weave of that mesh refused with "Could not parse carried Knop support facts Turtle." Compaction to `sflo:` now happens only when the local name has no path separator. Found by dogfooding the SFLO published-mesh regeneration.

## Breaking Or Changed Behavior

- **Eligibility: untargeted weave accepts multi-pending first-payload sets.** An untargeted `weave` over a mesh with several pending first payloads previously failed with `supports exactly one weave candidate; found 2`; it now succeeds as a single batched transaction. If you relied on that refusal as a guard against unintended breadth, target explicitly. The MeshInventory advances **once** for the set rather than once per candidate.
- **Output bytes: current-only ReferenceCatalog inventory writes changed shape.** The old renderer reordered page types and dropped a trailing blank line when rejoining subject blocks; the append path does neither. Inventory files written by `0.7.0` on this path can differ byte-wise from `0.6.0` output for the same logical content. **Known residual:** the append path emits a trailing blank line where the old renderer emitted a single newline — cosmetic, valid Turtle, tracked in [[wa.plan.2026.2026-05-17-append-onlyish-inventory]].
- **Fail-closed: inventory conflict detection is stricter.** Conflicts now compare requested against existing facts and report both, replacing a substring guard that accepted a requested locator appearing in an unrelated predicate while a *different* working locator was carried. Writes that `0.6.0` silently accepted on that false negative now fail closed as conflicts. This is a correctness fix, but it can surface as a new error on an existing mesh.
- **Cardinality: only `hasWorkingLocatedFile` is treated as single-valued** on this path. `hasResourcePage` is not functional in the ontology and is no longer collapsed as if it were.
- **Output shape: Turtle IRI compaction is narrower.** IRIs whose local name contains a path separator now render in mesh-relative or absolute form instead of a `sflo:` prefixed name. Scoped by construction to meshes with resources under the vocabulary namespace — no other mesh's output changes.
- **Acceptance: nested extraction sources no longer require root Knop facts.** Meshes that `0.6.0` refused with `settled extracted-knop pre-weave mesh inventory shape` now weave. No previously-accepted mesh changes behavior, and no `_knop` artifacts are synthesized for grouping segments.
- **BREAKING for CommonJS consumers: `@semantic-flow/weave-lib` is now ESM-only.** The dnt build no longer emits the `script/` (CJS) output, so the package exposes `exports: { ".": { "import": "./esm/api/mod.js" } }` with no `require` entry and no `main`. Node 20 — already this package's declared engine floor — supports ESM natively, and the off-tree Node contract smoke already exercised the ESM path, so the API surface itself is unchanged. `import { validateMesh, versionPayloads } from "@semantic-flow/weave-lib"` is unaffected; `require("@semantic-flow/weave-lib")` no longer resolves.

  Why now: dependencies the page-generation surface needs are ESM-only upstream. This was already latent — the previously generated CJS bundle contained `require("shiki")`, and Shiki is ESM-only; it was invisible only because `src/api/mod.ts` exports validation and versioning, not page generation. Dropping CJS resolves the existing inconsistency and unblocks the Markdown pipeline work.

- No API, CLI routing, or `versionPayloads`/`validateMesh` contract changes. `@semantic-flow/weave-lib` ships at `0.7.0` with an unchanged API surface — only its module format changed.

## Artifacts

- npm: `@semantic-flow/weave`, four platform packages, and `@semantic-flow/weave-lib`, all at `0.7.0`; tag `v0.7.0`; GitHub Release with archives and `.sha256` checksums.

## Validation

- `deno task ci` green on the release-preparation commit: 780 passed, 0 failed (~1m2s), lint/fmt/check clean, coverage report generated.
- Every change landed with a recorded fail-on-old regression test: the batch dispatch (reverse-order untargeted set, canonical ordering, one inventory state), the nested source (SRD-shaped failure arm, no synthesized `alice/_knop` artifacts), all three append-planner tests (exact-prefix, byte-equal no-op, both-facts conflict), and the vocabulary-namespace re-parse.
- Dogfooded end to end: the SFLO `gh-pages` mesh was regenerated and published on this code (2,921 files, byte-reproducible across three runs, deployed payloads byte-identical to the tagged source).

## Known Limitations

- Extract→weave→generate at thousand-term nested-source scale still runs close to V8's ~4 GiB ceiling: a probe completed N=1,700 on the faithful nested-source shape at 3.79 GiB peak, with recursive planning and page generation dominating and extracted candidates never entering this release's batch path. The open follow-up at this release is now recorded in [[wa.completed.2026.2026-08-02_1330-extracted-term-weave-batch-path]]; downstream workarounds for extractor scale should stay in place.
- At this release, current-mode extracted-term weave and condition-specific diagnostics were unshipped. The diagnostics and broader planner work later landed under [[wa.completed.2026.2026-07-03_1332-stagecraft-weave-planner-generalization]]; the remaining current-mode extracted/progress work and deferred fixture gates stay with [[wa.task.2026.2026-05-04-refactor-planFirstPayloadWeave]].
- Only one production renderer is on the append-only planner; general append-onlyish inventory semantics remain open work.

## Next

- Batch path for extracted candidates, to make extract→weave→generate viable at thousand-term nested-source scale.
- Remaining first-payload planner blockers and condition-specific diagnostics.
- Broader append-onlyish inventory migration, including the trailing-newline hygiene residual above.
