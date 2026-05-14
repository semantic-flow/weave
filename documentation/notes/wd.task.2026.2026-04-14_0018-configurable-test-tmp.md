---
id: aqslrdergnqejj5mulkfim2
title: 2026 04 14_0018 Configurable Test Tmp
desc: ''
updated: 1778743130406
created: 1778743130406
---

## Goals

- Make Weave's shared test temporary workspace root configurable.
- Stop default `deno task test` and `deno task test:coverage` runs from writing temporary workspaces under the repository-local `.test-tmp/` directory.
- Keep the existing per-test cleanup behavior, including `WEAVE_KEEP_TEST_TMP`, so preserved temp workspaces remain an intentional debugging choice rather than an accidental leak.
- Migrate direct `.test-tmp` writers to the shared test temp helper or another clearly justified temp strategy.
- Update developer testing documentation so contributors know where preserved test workspaces go and how to override that location.

## Summary

The current test harness writes `createTestTmpDir()` workspaces under `repoRoot/.test-tmp`. That was convenient when the test suite was smaller, but stale directories now accumulate when tests abort, when cleanup is intentionally disabled, or when test code bypasses the shared helper. Because `.test-tmp/` lives inside the repository, those leaks can still affect editor watching, search, file indexing, and mental noise even though the workspace settings hide the directory.

This task should introduce a configurable test temp root named `WEAVE_TEST_TMP_ROOT` and configure the repository's normal test tasks to place test workspaces outside the repository. The shared helper remains responsible for registering created directories and cleaning them after each test unless `WEAVE_KEEP_TEST_TMP=1` or `WEAVE_KEEP_TEST_TMP=true` is set.

This is not a substitute for cleanup correctness. We should still treat leftover temp workspaces as a signal that some test path bypassed the harness, crashed before cleanup, or was run with an explicit keep flag. The change is meant to keep those leftovers out of the repo and make the temp location intentional.

## Discussion

Current state:

- `tests/support/test_tmp.ts` hardcodes `const testTmpRoot = join(repoRoot, ".test-tmp")`.
- `deno task test` and `deno task test:coverage` preload `tests/support/test_tmp_harness.ts`, which wraps `Deno.test` and cleans registered `createTestTmpDir()` paths after each test.
- `WEAVE_KEEP_TEST_TMP` already preserves registered temp paths for debugging.
- `deno.json` excludes `.test-tmp/**`, and `weave.code-workspace` hides/excludes `.test-tmp/**`, but those are mitigations rather than cleanup.
- `tests/scripts/publish_npm_packages_test.ts` currently constructs a `.test-tmp/publish-npm-packages/...` path directly instead of using `createTestTmpDir()`.
- Some focused tests use plain `Deno.makeTempDir()` without a `dir`; those already go to the platform temp area and do not contribute to repo-local `.test-tmp` growth.

The implementation should centralize temp-root resolution in `tests/support/test_tmp.ts`. The helper should read a dedicated env var only after checking env permission, matching the existing `WEAVE_KEEP_TEST_TMP` pattern. Normal test tasks already run with `--allow-env`, so this should not require a permission expansion.

Recommended behavior:

- `WEAVE_TEST_TMP_ROOT` sets the parent directory used by `createTestTmpDir(prefix)`.
- If `WEAVE_TEST_TMP_ROOT` is relative, resolve it relative to the repository root, not whatever a test temporarily uses as `Deno.cwd()`.
- If `WEAVE_TEST_TMP_ROOT` is unset, use the platform temp directory through `Deno.makeTempDir({ prefix })` rather than falling back to repository-local `.test-tmp`.
- `deno task test` and `deno task test:coverage` should set `WEAVE_TEST_TMP_ROOT` to a stable path outside the repository, for example `../.weave-test-tmp`.
- `createTestTmpDir()` should continue to create uniquely named child directories with the caller-provided prefix and register them in the active cleanup scope.
- Preserve the existing cleanup order and aggregate-error behavior.

There is a small tradeoff between stable grouping and platform defaults. A stable external root such as `../.weave-test-tmp` is easier to inspect after `WEAVE_KEEP_TEST_TMP=1`; direct fallback to the platform temp directory is less likely to pollute the repo when someone runs `deno test` manually without using the configured task. The task-level env var gives us both.

The existing repository-local `.test-tmp/` directory can be deleted manually after this lands. Test code should not perform a broad automatic cleanup of old repo-local temp workspaces because that could erase a developer's preserved debugging output without an explicit request.

## Open Issues

- Should the configured external root be `../.weave-test-tmp`, `../.test-tmp/weave`, or an OS-temp-based absolute path? Recommendation: use `../.weave-test-tmp` for now because it is stable, outside the repo, easy to inspect, and simple to express in the existing Deno task style.
- Should `WEAVE_TEST_TMP_ROOT` be documented as accepting relative paths? Recommendation: yes, but define them as repo-root-relative to avoid surprises from tests that change process cwd.
- Should `.test-tmp/**` stay in `deno.json` and `weave.code-workspace` after the move? Recommendation: keep it for now because old local leftovers and ad hoc debugging directories may still exist.

## Decisions

- Use a test-harness env var for this rather than production config. This is developer infrastructure, not a Weave runtime behavior.
- Keep `WEAVE_KEEP_TEST_TMP` as the preservation switch; do not overload the new root setting to imply preservation.
- Keep cleanup scoped to the exact directories created through `createTestTmpDir()`; do not recursively sweep the whole configured root at the end of a run.
- Direct hardcoded `.test-tmp` paths in tests should be treated as bypasses and migrated.

## Contract Changes

- No Semantic Flow API, CLI, mesh, or runtime contract changes.
- Developer/test harness contract change: `createTestTmpDir()` will honor `WEAVE_TEST_TMP_ROOT`.
- Developer workflow change: normal test tasks will write temp workspaces outside the repository.
- Documentation change: update [[wd.testing]] to describe `WEAVE_TEST_TMP_ROOT`, the default task location, and its relationship to `WEAVE_KEEP_TEST_TMP`.

## Testing

- Add focused unit-style coverage for temp-root resolution if it can be tested without replacing process globals.
- Cover unset `WEAVE_TEST_TMP_ROOT` creating a temp directory outside `repoRoot/.test-tmp`.
- Cover relative `WEAVE_TEST_TMP_ROOT` resolving relative to `repoRoot`.
- Cover absolute `WEAVE_TEST_TMP_ROOT` being honored.
- Cover `WEAVE_KEEP_TEST_TMP` still preserving registered directories.
- Add or adjust an integration-level test that creates a temp directory through `createTestTmpDir()` with `WEAVE_TEST_TMP_ROOT` set to a test-controlled parent, then verifies cleanup removes the registered child when keep is not set.
- Run `deno task test` after implementation and verify no new directories are created under repository-local `.test-tmp/`.
- Run a targeted keep-mode check, for example `WEAVE_KEEP_TEST_TMP=1 deno task test --filter <small test>`, and verify the preserved workspace appears under the configured external root.
- Run `deno task lint` because the change touches shared test harness code and test task wiring.

## Non-Goals

- Do not introduce production runtime temp-directory configuration.
- Do not change Weave CLI behavior for user-provided workspaces or mesh roots.
- Do not automatically delete existing repository-local `.test-tmp/` contents as part of the test harness.
- Do not convert every use of `Deno.makeTempDir()` in the codebase; only migrate repo-local `.test-tmp` writers and tests that should participate in the shared cleanup harness.
- Do not remove `.test-tmp` editor or Deno excludes in this slice.

## Implementation Plan

- [ ] Add a `WEAVE_TEST_TMP_ROOT` constant and temp-root resolver in `tests/support/test_tmp.ts`.
- [ ] Change `createTestTmpDir()` so it uses the configured root when present and otherwise falls back to platform temp space.
- [ ] Preserve active-scope registration, reverse-order cleanup, `WEAVE_KEEP_TEST_TMP`, and aggregate cleanup/test error behavior.
- [ ] Configure `deno task test` and `deno task test:coverage` to set `WEAVE_TEST_TMP_ROOT` to an external stable path.
- [ ] Replace direct `.test-tmp` construction in `tests/scripts/publish_npm_packages_test.ts` with `createTestTmpDir()` or another registered helper path.
- [ ] Search for remaining repo-local `.test-tmp` writers and migrate any that create files during tests.
- [ ] Update [[wd.testing]] with the new temp-root behavior and debugging workflow.
- [ ] Add focused coverage for configured temp-root behavior.
- [ ] Run `deno task lint` and `deno task test`.
- [ ] Manually confirm a normal test run does not add new entries under repository-local `.test-tmp/`.
