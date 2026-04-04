---
id: yco42nwsnax60rms6xdssv4
title: 2026 04 04 CI Dependency Fixes
desc: ''
updated: 1775318903701
created: 1775318903701
---

## Goals

- Make Weave CI succeed in a clean GitHub Actions checkout rather than only in a developer workspace that happens to contain ignored sibling repositories.
- Replace workstation-specific test path assumptions with repository-relative dependency resolution that matches the existing `dependencies/` layout.
- Make external test repositories used by Weave explicit in CI so `deno task check` and `deno task test` reflect what the repository actually needs.
- Fix the current CI failure without blocking on separate packaging work such as publishing `accord`.

## Summary

The first Weave CI workflow exposed a hidden dependency problem rather than a pure TypeScript problem.

`deno task check` passed locally because the current workspace contains ignored local checkouts under `dependencies/`, including:

- `dependencies/github.com/spectacular-voyage/accord`
- `dependencies/github.com/semantic-flow/semantic-flow-framework`
- `dependencies/github.com/semantic-flow/mesh-alice-bio`

GitHub Actions does not receive those ignored repositories in a clean checkout, so imports and fixture reads that work locally fail in CI.

This task should make the dependency model explicit and portable:

- Weave tests should resolve those repositories via repository-relative `dependencies/...` paths rather than `/home/djradon/...` absolute paths.
- GitHub Actions should check out the external repositories Weave tests currently require into those same `dependencies/...` locations.
- The fix should be honest about current architecture: for now Weave is allowed to depend on external fixture and helper repos in CI, but that dependency must be explicit.

This task is not the place to redesign the whole test strategy or wait for Accord publication before CI can become reliable.

## Discussion

### Why the current CI failed

The CI failure was:

- `TS2307` on `tests/e2e/integrate_cli_test.ts` for `accord/src/checker/compare_rdf.ts`
- `TS2307` on `tests/support/accord_manifest.ts` for `accord/src/manifest/model.ts`

Those files exist in the local workspace only because `dependencies/**` is ignored and the developer machine happens to have the extra repositories checked out already.

The same hidden dependency pattern also exists for conformance manifests and fixture branch material:

- `semantic-flow-framework` provides Alice Bio conformance manifests
- `mesh-alice-bio` provides the git history used as fixture branch material

So the real problem is not "TypeScript missed an import." The real problem is that Weave tests currently rely on ignored local repositories and one helper uses hardcoded absolute paths.

The first CI dependency fix also exposed a second git-shape assumption: a GitHub Actions checkout of `mesh-alice-bio` does not necessarily create local branches like `05-alice-knop-created-woven`, even when the corresponding remote-tracking ref exists. Tests therefore need to resolve fixture refs against either local branch names or `origin/<ref>`.

### Why relative `dependencies/` paths are the right immediate fix

For this repository, using repository-relative `dependencies/...` paths is simpler and more honest than adding environment-variable configuration first.

The repo already has a clear convention:

- embedded or local dependency material lives under `dependencies/`

Using that same layout for CI checkouts means:

- local development and CI agree on where supporting repositories live
- tests stay deterministic
- path handling becomes portable across machines and runners
- no workstation-specific `/home/djradon/...` assumptions remain

Environment-variable overrides could be added later if there is a concrete need for alternate layouts, but they are not required for the first clean fix.

### External repositories currently required by tests

At the moment Weave tests rely on three external repositories:

- `accord`
  - used for RDF comparison helpers and manifest model types
- `semantic-flow-framework`
  - used for Alice Bio conformance manifests
- `mesh-alice-bio`
  - used for git-addressable branch fixture content

The current implementation should treat all three as explicit CI inputs.

### Scope boundary

Checking out `accord` into `dependencies/` is acceptable for now.

That is not the end-state architecture. A later follow-up may:

- publish Accord and consume it as a real dependency
- copy only the tiny helper surface Weave actually needs
- further decouple Weave tests from external source-repo imports

But that is follow-up work. This task exists to make the current test harness portable and honest.

## Open Issues

- Once Accord is published or otherwise stabilized, should Weave stop importing Accord source files directly and instead consume a narrower, explicit dependency surface?

## Decisions

- Treat the current external test repositories as explicit CI dependencies rather than hidden local workspace assumptions.
- Replace absolute workstation paths with repository-relative `dependencies/...` resolution in Weave test helpers.
- Check out `accord`, `semantic-flow-framework`, and `mesh-alice-bio` into `dependencies/...` in GitHub Actions for now.
- Use the external repositories' default branches for now rather than pinning specific SHAs in this first CI dependency fix.
- Fetch full git history for `mesh-alice-bio` in CI because Weave tests address fixture branches by name.
- Resolve `mesh-alice-bio` fixture refs against both local and remote-tracking branch names so CI does not depend on local branch creation.
- Do not block this fix on publishing Accord.
- Keep the current carried-slice testing model rather than redesigning fixture sourcing in this task.

## Contract Changes

- No public Semantic Flow or Weave API contract changes are required.
- This task changes repository test portability and CI behavior, not external runtime behavior.

## Testing

- `deno task check` should pass in a workspace where required external repositories exist only because CI checked them out into `dependencies/...`.
- `deno task test` should pass under the same conditions.
- The updated CI workflow should validate the same repository-relative layout used locally.
- The CI checkout for `mesh-alice-bio` should expose the named fixture refs that Weave tests read through `git show` and `git ls-tree`.
- Helper logic should continue to work when those fixture refs exist only as `origin/<ref>` rather than local branches.
- Tests that depend on conformance manifests or fixture branch material should no longer require `/home/djradon/...`-style absolute paths.

## Non-Goals

- publishing `accord`
- redesigning Weave’s broader acceptance-testing architecture
- vendoring large external repositories into Weave
- replacing carried-slice fixture repositories with generated local fixtures
- changing branch-protection or Codecov policy
- turning external test dependencies into a polished package-management story in this pass

## Implementation Plan

- [x] Refine this task note into the concrete first-pass dependency-fix rollout.
- [x] Replace hardcoded absolute dependency paths in test helpers with repository-relative resolution rooted at the Weave repository.
- [x] Audit test imports and helper usage so all current external repository assumptions are explicit.
- [x] Update `.github/workflows/ci.yml` to check out `accord` into `dependencies/github.com/spectacular-voyage/accord`.
- [x] Update `.github/workflows/ci.yml` to check out `semantic-flow-framework` into `dependencies/github.com/semantic-flow/semantic-flow-framework`.
- [x] Update `.github/workflows/ci.yml` to check out `mesh-alice-bio` into `dependencies/github.com/semantic-flow/mesh-alice-bio`.
- [x] Verify `deno task check` succeeds after the path changes.
- [x] Verify `deno task test` succeeds after the path changes.
- [ ] Verify the GitHub Actions workflow no longer depends on ignored local repositories being present on the runner.
- [ ] Decide later whether Accord should become a published dependency or whether Weave should copy the tiny helper surface it currently imports.
