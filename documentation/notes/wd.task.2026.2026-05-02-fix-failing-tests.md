---
id: cohd5aqb8hrolpozb5zpb5o
title: 2026 05 02 Fix Failing Tests
desc: 'restore page-definition and source-resolution test health before merging next/v0.0.1'
updated: 1777737387316
created: 1777737387316
---

## Goals

- Restore the failing `tests/integration/weave_test.ts` page-definition/source-resolution cluster on `next/v0.0.1`.
- Separate current page-definition regressions or fixture drift from the payload manifestation version-naming work.
- Make `next/v0.0.1` mergeable to `main` with a clean CI story.
- Keep [[wd.task.2026.2026-05-02-fantasy-rules-sidecar]] moving only on source/fixture planning until this branch-level test debt is resolved.

## Summary

The `next/v0.0.1` branch currently has passing typecheck/lint and passing focused payload `manifestationSegment` coverage, but it is not merge-ready because a page-definition/source-resolution test cluster is failing.

The failures are not in the fantasy-rules sidecar fixture and do not appear to be caused by payload manifestation naming. They are concentrated around Alice Bio page-definition rendering and source resolution, especially current artifact-backed page sources, page definitions that use `workingFilePath`, and repo-adjacent `targetMeshPath` policy cases.

This should be treated as a release-branch stabilization task and a blocker for merging `next/v0.0.1` into `main`. It does not need to block Phase 0 or source-only work for [[wd.task.2026.2026-05-02-fantasy-rules-sidecar]], but it should block any fantasy-rules sidecar phases that rely on generated page behavior or on the sidecar branch being merged.

## Discussion

Known passing checks as of 2026-05-02:

- `deno task lint`
- `deno task check`
- focused payload manifestation/version naming tests
- focused CLI payload version naming tests

Known failing command:

```sh
deno test --allow-read --allow-write --allow-run=git,deno --allow-env tests/integration/weave_test.ts --filter '/page-customized-woven|artifact-backed page sources|workingFilePath literals|targetMeshPath/'
```

Latest observed result:

- 1 passed
- 7 failed
- 19 filtered out

Failing tests:

- `executeWeave matches the settled alice page-customized-woven fixture`
- `executeWeave resolves current artifact-backed page sources through hasTargetArtifact`
- `executeWeave resolves artifact-backed page sources through workingFilePath when repo policy permits them`
- `executeWeave fails closed when artifact-backed page sources request pinned resolution`
- `executeWeave resolves page definitions from workingFilePath literals`
- `executeWeave fails closed when targetMeshPath escapes the mesh root without operational policy`
- `executeWeave allows repo-adjacent targetMeshPath values when repo policy permits them`

Passing adjacent test:

- `executeWeave resolves payload current files from workingFilePath literals`

Observed failure modes:

- The settled Alice page-customized fixture and the workingFilePath-literal page-definition case fail during `executeGenerate` with `ResourcePageDefinition region main for alice uses distribution/located-file targets that this first implementation slice does not support yet.`
- Several artifact-backed and `targetMeshPath` policy tests fail earlier in test setup because `replaceFileText` cannot find the expected page-source snippet in `alice/_knop/_page/page.ttl`.

Those two failure modes point to either fixture-shape drift, implementation drift, or both:

- The carried Alice Bio page-definition source may have moved from the older `targetMeshPath "mesh-content/sidebar.md"` shape to a distribution/located-file target shape.
- The runtime still treats distribution/located-file page-source targets as unsupported in this implementation slice.
- Some tests still patch the older page-source text directly, so they may be stale even if the newer fixture shape is intentional.

The fix should start by inspecting the actual `14-alice-page-customized` and `15-alice-page-customized-woven` fixture files and their corresponding conformance manifests before changing runtime behavior. A stale test should be updated; a stale fixture should be regenerated or corrected; a real missing runtime contract should be implemented.

## Open Issues

- Is the distribution/located-file page-source shape in the current Alice Bio fixture intentional and already part of the intended contract, or did the fixture drift ahead of runtime support?
- Should distribution/located-file page-source targets be supported now, or should the fixture be restored to the existing `targetMeshPath` / artifact-backed source contract?
- Are the tests that patch `alice/_knop/_page/page.ttl` with literal string replacement still the right shape, or should they use RDF-aware edits or fixture helpers?
- Which conformance manifests should be treated as authoritative for the Alice page-customization transition after the renderer refresh work?

## Decisions

- Treat this as a `next/v0.0.1` merge blocker.
- Do not treat these failures as caused by the fantasy-rules sidecar source fixture unless investigation proves otherwise.
- Do not block fantasy-rules Phase 0/source-only work on this task.
- Block generated-page sidecar phases and `next/v0.0.1` merge until these tests are either fixed or deliberately retired with replacement coverage.
- Keep raw conversation transcripts out of this note; link only distilled context if needed.

## Contract Changes

- No new contract should be assumed at task start.
- If distribution/located-file page-source targets are intentional, define the runtime contract for resolving them before updating tests to depend on it.
- If the intended contract remains `targetMeshPath` and current artifact-backed sources only, restore the Alice fixture and tests to that contract.
- Keep fail-closed local path policy behavior for repo-adjacent `targetMeshPath` and `workingFilePath` inputs.

## Testing

- Preserve the currently passing focused payload manifestation/version naming coverage.
- Restore the failing `tests/integration/weave_test.ts` page-definition/source-resolution cluster.
- Run the narrow failing-test command until it passes.
- Run at least:
  - `deno task lint`
  - `deno task check`
  - `deno test --allow-read --allow-write --allow-run=git,deno --allow-env tests/integration/weave_test.ts`
- Before merging `next/v0.0.1`, run `deno task test` or document any remaining known non-deterministic/environmental failures.

## Non-Goals

- Building or weaving the fantasy-rules sidecar fixture.
- Changing payload `manifestationSegment` behavior unless the investigation finds a direct dependency.
- Migrating default payload manifestation segments from filename-derived defaults to extension-derived defaults.
- Reworking the entire page renderer.
- Replacing Accord conformance manifests with implementation tests.

## Implementation Plan

- [ ] Re-run and record the exact failure baseline from `tests/integration/weave_test.ts`.
- [ ] Inspect `14-alice-page-customized` and `15-alice-page-customized-woven` fixture contents for `alice/_knop/_page/page.ttl`, generated `alice/index.html`, and related inventory RDF.
- [ ] Inspect the corresponding Alice Bio conformance manifests for the page-customization transition.
- [ ] Decide whether distribution/located-file page-source targets are an intended contract or fixture drift.
- [ ] If the tests are stale, update them to patch or assert against the current fixture shape without weakening the behavioral contract.
- [ ] If the runtime is missing intended support, implement distribution/located-file page-source resolution with fail-closed behavior and focused coverage.
- [ ] Restore artifact-backed page-source tests for current resolution, `workingFilePath`, and pinned-mode rejection.
- [ ] Restore `targetMeshPath` policy tests for both denied traversal and explicitly allowed repo-adjacent paths.
- [ ] Run the narrow failing-test command until all listed failures pass.
- [ ] Run `deno task lint`.
- [ ] Run `deno task check`.
- [ ] Run `deno test --allow-read --allow-write --allow-run=git,deno --allow-env tests/integration/weave_test.ts`.
- [ ] Run or queue full `deno task test` before marking `next/v0.0.1` merge-ready.
