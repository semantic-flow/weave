---
id: uy550h4ot52nhmj1owavxrv
title: 2026 05 13 Full CI/CD
desc: ''
updated: 1778686137322
created: 1778686130323
---

## Goals

- Make `v0.1.0` the first full Weave release rather than another source-only checkpoint.
- Add a Kato-style manual release workflow that builds native binary distributions, assembles npm packages, smoke-tests them on native runners, optionally publishes npm packages, and creates or updates the GitHub Release.
- Establish one authored version source for Weave to the extent practical, with all binary bundle metadata, npm package metadata, release tags, and runtime `--version` output derived from it.
- Add release notes conventions that work with Dendron notes while producing clean GitHub Release bodies.
- Update [[dev.release-runbook]] from the current source-checkpoint process to the full `v0.1.0` release process.
- Keep release packaging honest: ship only the executable surfaces that are actually supported by `v0.1.0`.
- Preserve current CI quality gates while adding release-specific build, packaging, and smoke validation.
- Restore a trustworthy green release gate for `v0.1.0`, since `v0.0.2` is being treated as a source checkpoint rather than a CI-clean distribution release.

## Summary

`v0.0.2` is a useful source checkpoint, but `v0.1.0` should be a real distribution release. The target is a Weave adaptation of Kato's current release model: native binary archives for Linux x64, Windows x64, macOS x64, and macOS arm64; a primary npm wrapper package; platform-specific npm packages that carry the native binaries; GitHub Release archives and checksums; and a manual GitHub Actions workflow that can run as a rehearsal or publish pass.

The important difference from Kato is scope. Weave currently has one real local CLI/runtime surface and scaffolded daemon/web areas. The first full release should package the supported `weave` command. It should not ship separate daemon or web binaries unless those surfaces become release-worthy before `v0.1.0`.

The release system should avoid version drift. The preferred model is a single authored version in root `deno.json`, with a `bump:version` script updating that field and ensuring the matching Dendron release-notes stub exists. Build scripts then derive binary metadata, npm `package.json` versions, archive names, GitHub Release tags, and `weave --version` output from that source. If implementation needs a generated TypeScript version module for compiled binaries, that module should be treated as derived output and checked by tests against the root version.

## Discussion

### Current State

Weave currently has:

- root `deno.json` tasks for `fmt`, `lint`, `check`, `test`, `test:coverage`, `coverage:lcov`, and `ci`
- GitHub Actions CI on pull requests and pushes to `main`
- Codecov upload from coverage
- Deno 2.7.14 in CI
- a release runbook in [[dev.release-runbook]] that now documents the transitional `v0.1.0` path
- `documentation/notes/release-notes.v0.0.2.md` as the first release-notes note
- `documentation/notes/release-notes.v0.1.0.md` as the first full-release stub
- no release workflow
- `deno task build:binaries` for native binary compilation and per-platform bundle metadata
- `deno task package:binaries` for Deno-native `.tar.gz`/`.zip` archive generation and `.sha256` checksum files
- `deno task assemble:npm-packages` for local npm wrapper/platform package directory assembly and `npm-packages-metadata.json` generation
- `deno task smoke:npm-install` for local `npm pack`, temp-project install, and installed `weave --version` smoke testing
- `deno task publish:npm-packages` for ordered npm dry-run/publish execution from assembled package directories
- `.github/workflows/release-manual.yml` for manual native binary builds, archive packaging, npm package assembly, native npm smoke testing, optional npm dry-run/publish, and optional GitHub Release draft/publish handling
- root `deno.json` version metadata and `weave --version`

That is enough for `v0.0.2`, especially as a deliberate checkpoint with known CI debt, but not enough for a release that users can install.

### Current Release-Gate Inventory

Earlier local validation after the first version-plumbing slice showed broad fixture-backed drift. After the fixture ladder regeneration, source-registry cleanup, ResourcePage/property work, release tooling slices, and ontology/config guardrails, the release gate is now much closer to the target:

- `deno task fmt:check` passes.
- `deno task lint` passes.
- `deno task check` passes.
- focused `weave --version` e2e coverage passes.
- focused release metadata and build-script argument tests pass.
- focused binary packaging helper tests pass.
- focused npm package assembly tests pass.
- focused npm install smoke setup tests pass.
- focused npm publish ordering and argument tests pass.
- `deno task ci` passes locally with 422 tests; branch-published fixture assertions read explicit Git refs rather than relying on the dependency checkout branch.

The branch-published Fantasy Rules dependency checkout is often left on `gh-pages` for preview, and that branch intentionally does not carry deterministic `.assets`. That should not affect fixture meaning: generated mesh assertions read generated refs, and the fixture-ladder source-asset contract reads `.assets` from the source-bearing `main` ref.

The old failures were not caused by version metadata. They clustered around pre-release fixture and contract drift that has now mostly been repaired:

- stale `https://semantic-flow.github.io/semantic-flow-ontology/` expectations versus the canonical `https://semantic-flow.github.io/sflo/ontology/` namespace
- stale enum/value shapes such as old reference-role IRIs versus flat namespace-local values
- stale config ontology IRIs such as `https://semantic-flow.github.io/ontology/config/meshRootPathBase`
- stale carried mesh and Knop inventory shapes after current config/progression changes
- fixture-backed CLI and integration tests reading old branch-ladder states that need regeneration through [[wa.completed.2026.2026-05-07-fixture-ladder-generator]]

That means the release pipeline can now move from infrastructure-building to release rehearsal. The main remaining release blockers are authored release notes, a manual workflow rehearsal on GitHub Actions, and confirmation of npm scope/package access before any real publish.

### Kato Release Pattern To Adapt

Kato's current release model is a good template:

- `deno task bump:version`
- `deno task build:binaries`
- `deno task package:binaries`
- `deno task assemble:npm-packages`
- `deno task smoke:npm-install`
- `deno task publish:npm-packages`
- a manual GitHub Actions release workflow with inputs for npm publish mode, npm dist-tag, and GitHub Release mode
- native builds on Linux x64, Windows x64, macOS x64, and macOS arm64
- archive plus `.sha256` release assets
- npm wrapper/platform package assembly from built bundle artifacts
- native npm-install smoke tests on each supported platform
- GitHub Release notes pulled from `documentation/notes/release-notes.v<version>.md` after stripping Dendron frontmatter

We should adapt this shape rather than inventing a separate release system. We should not copy it blindly: Kato has multiple supported executable surfaces and app-local version files, while Weave should start with one canonical version source and one supported executable.

### Target v0.1.0 Release Model

`v0.1.0` should produce:

- Git tag `v0.1.0`
- GitHub Release `v0.1.0`
- release notes from `documentation/notes/release-notes.v0.1.0.md`
- native binary bundle archive for each supported platform:
  - `weave-v0.1.0-linux-x64.tar.gz`
  - `weave-v0.1.0-windows-x64.zip`
  - `weave-v0.1.0-macos-x64.tar.gz`
  - `weave-v0.1.0-macos-arm64.tar.gz`
- matching `.sha256` files for each archive
- bundle metadata for each platform, including package name, version, platform label, operating system, architecture, executable names, archive names, and checksums
- npm wrapper package, likely `@semantic-flow/weave`
- platform-specific npm packages, likely:
  - `@semantic-flow/weave-linux-x64`
  - `@semantic-flow/weave-windows-x64`
  - `@semantic-flow/weave-macos-x64`
  - `@semantic-flow/weave-macos-arm64`

The npm wrapper should expose `weave` as a bin command and install/use the matching platform package. The platform packages should contain the native executable and minimal metadata; they should not duplicate the whole source tree.

### Version Metadata

Prefer root `deno.json` as the single authored version source:

```json
{
  "version": "0.1.0"
}
```

All other version-bearing artifacts should be generated or validated against that value:

- binary archive names
- bundle metadata
- npm package versions
- GitHub Release tag/title
- generated `weave --version` output
- release notes filename

If the compiled binary cannot conveniently import root `deno.json`, add a generated `src/version.generated.ts` or similar file, but do not make it an independently edited source of truth. The bump/version-check script should fail if generated runtime version metadata disagrees with root `deno.json`.

The version bump task should support:

```bash
deno task bump:version -- --patch
deno task bump:version -- --minor
deno task bump:version -- --major
deno task bump:version -- --version 0.1.0
```

The bump task should create or verify `documentation/notes/release-notes.v<version>.md` with Dendron frontmatter and a non-empty body placeholder.

### Binary Build And Packaging

Add `scripts/build-binaries.ts` to compile the supported executable surfaces with `deno compile`.

For `v0.1.0`, the supported binary should be:

- `weave`: local CLI/runtime entry point

Do not add separate `weave-daemon`, `weave-web`, or `shuttle` binaries unless the daemon/web surfaces become real release targets before this work lands.

The build script should:

- read the canonical release version
- build into a supplied output directory
- produce platform-native executable names, including `.exe` on Windows
- compile with explicit broad CLI permissions for the first pass: read, write, env, and run for `git`/`deno`
- fail if invoked from a dirty or mismatched version state when release mode requires strictness

The first implementation slice adds `scripts/build-binaries.ts`, `deno task build:binaries`, a shared release metadata module, and tests for the platform matrix, archive names, npm package names, and build-script arguments. The build script writes `bundle-metadata.json` beside each platform executable so packaging can consume a stable contract.

Add `scripts/package-binaries.ts` to turn build outputs into platform bundles. Each bundle should include:

- executable
- README or install note if useful
- license file if present
- bundle metadata JSON
- archive file
- `.sha256` checksum

The package script should produce `.tar.gz` for Unix platforms and `.zip` for Windows.

The second implementation slice adds `scripts/package-binaries.ts`, `deno task package:binaries`, Deno-native archive writers, SHA-256 checksum generation, archive-local install notes, license inclusion when `LICENSE` is present, and validation that build-time `bundle-metadata.json` still matches the canonical root version and platform metadata. Generated release outputs default under `dist/`, which is ignored.

### npm Integration

Add npm package assembly and publishing scripts modeled on Kato:

- `scripts/assemble-npm-packages.ts`
- `scripts/smoke-npm-install.ts`
- `scripts/publish-npm-packages.ts`
- helper modules for npm package permissions and package metadata as needed

The npm wrapper package should:

- expose `weave` through the `bin` field
- depend on or select the platform-specific package for the current OS/architecture
- print a clear unsupported-platform error when no platform package matches
- preserve npm provenance support when publishing from GitHub Actions

The platform packages should:

- be version-aligned with the wrapper package
- contain the packaged native binary for exactly one platform
- be marked with appropriate `os` and `cpu` constraints
- avoid lifecycle scripts when practical; prefer static bin dispatch from the wrapper

The third implementation slice adds `scripts/assemble-npm-packages.ts`, `deno task assemble:npm-packages`, npm package metadata helpers, a Node bin dispatcher for the wrapper package, platform packages with `os` and `cpu` constraints, copied native binaries, license/readme files, and tests for metadata, optional dependencies, bin dispatch contents, platform constraints, executable modes, and stale bundle metadata rejection. Follow-up publish metadata work adds scoped package `publishConfig`, repository/homepage/bugs metadata, and an aggregate `npm-packages-metadata.json` manifest for smoke/publish/workflow consumers. This is local package-directory assembly; publish behavior remains a separate slice.

The fourth implementation slice adds `scripts/smoke-npm-install.ts`, `deno task smoke:npm-install`, host platform package selection from `npm-packages-metadata.json`, `npm pack` for the wrapper and host platform package, temporary project install from local tarballs, installed `weave --version` verification, and tests for CLI argument parsing, Node platform naming, host platform matching, and npm bin shim path handling. This intentionally verifies the wrapper/platform package resolution path without introducing publish behavior yet.

The fifth implementation slice adds `scripts/publish-npm-packages.ts`, `deno task publish:npm-packages`, ordered platform-before-wrapper publication, downloaded artifact path resolution, executable mode restoration after artifact download, npm dry-run/publish argument construction, and tests for the publish ordering and rehearsal/publish flags.

The publish script should support:

- dry-run mode
- publish mode
- configurable npm dist-tag
- provenance when publishing from GitHub Actions

### Release Workflow

Add `.github/workflows/release-manual.yml` with `workflow_dispatch` inputs:

- `npm_publish_mode`: `skip`, `dry-run`, or `publish`
- `npm_tag`: default `latest`
- `github_release_mode`: `skip`, `draft`, or `publish`

The workflow should have jobs similar to:

- `build-binaries`: matrix over Linux x64, Windows x64, macOS x64, and macOS arm64
- `assemble-npm-packages`: download bundle artifacts and assemble npm packages
- `smoke-npm-install`: matrix over supported platforms, install the wrapper/platform packages from local assembly, and run `weave --version`
- `publish-npm-packages`: optional dry-run or publish
- `manage-github-release`: optional draft or published GitHub Release with binary archives and checksum assets

The release workflow derives the release tag from downloaded `bundle-metadata.json` files, not from a free-form workflow input. That reduces accidental tag/package mismatch.

The workflow should support a rehearsal pass:

- npm dry-run
- GitHub draft release
- all build/package/smoke jobs run

Then a publish pass can rerun the same commit with npm publish and GitHub publish inputs.

### CI Updates

Keep `.github/workflows/ci.yml` as the ordinary pull-request and `main` quality gate. Extend it only where useful:

- run dependency audit if we add a stable audit task
- use `--frozen` where practical once lockfile behavior is stable
- keep coverage upload
- avoid doing full cross-platform release builds on every PR unless release packaging becomes fragile

Release-specific cross-platform build/package/smoke belongs in `release-manual.yml`.

Consider adding separate security workflows after the release path is stable:

- CodeQL
- OSV Scanner
- scheduled dependency audit

Those are useful, but not required to make the first full release pipeline work.

### Release Notes Convention

Keep Dendron release notes under `documentation/notes/release-notes.v<version>.md`.

Each release note should have a GitHub-friendly body after frontmatter:

- `## Summary`
- `## Highlights`
- `## Breaking Or Changed Behavior` when applicable
- `## Artifacts`
- `## Validation`
- `## Known Limitations`
- `## Next`

The GitHub Release body should be generated by stripping Dendron frontmatter. The release workflow must fail if the stripped body is empty.

Release notes should describe the tagged commit. They may include a `Next` section, but should not imply unreleased work is already available.

### Runbook Update

Update [[dev.release-runbook]] after the scripts and workflow land. The updated runbook should treat the GitHub Actions manual workflow as the primary path and local script-by-script commands as fallback/debugging tools.

The runbook should include:

- version bump
- release notes update
- local quality gate
- expected CI status
- release workflow inputs
- rehearsal flow
- publish flow
- post-release checks for GitHub Release assets and npm packages
- manual fallback commands
- caveats about source-only `v0.0.2` versus full `v0.1.0`

## Open Issues

- Confirm whether the implemented npm package scope and names need any change before publish. The current metadata default is `@semantic-flow/weave` plus platform packages under the same scope.
- Decide whether `deno compile` permissions should be narrowed before `v0.1.0` publish, or whether explicit broad CLI permissions are acceptable for the first packaged release.
- Decide whether release artifacts should include SBOM or provenance metadata beyond npm provenance and SHA-256 checksums.
- Decide whether fixture-ladder regeneration must be complete before `v0.1.0`, or whether `v0.1.0` can be a full pipeline release with known fixture-generator work still pending.

## Decisions

- `v0.1.0` is the target for the first full Kato-style Weave release.
- Keep `v0.0.2` as a source-checkpoint release and do not retrofit it into the full pipeline.
- Use root `deno.json` as the preferred authored version source unless implementation proves that impractical.
- Add `deno task bump:version` so humans do not hand-edit release version metadata and release-note stubs.
- Import root `deno.json` for runtime version reporting and release metadata; generated version modules are not needed yet.
- Ship a native `weave` binary for `v0.1.0`.
- Do not ship separate daemon or web binaries until those surfaces are real release targets.
- Use GitHub Release archives plus `.sha256` checksum files as binary distribution artifacts.
- Use npm wrapper/platform packages as the first package-manager integration.
- Start with `@semantic-flow/weave` as the wrapper package name and `@semantic-flow/weave-<platform>` as the platform package naming convention.
- Model the release workflow on Kato's manual release workflow with rehearsal and publish modes.
- Keep full release packaging in a manual workflow rather than adding automatic publish-on-tag behavior for the first pass.
- Keep release notes as Dendron notes and strip frontmatter for GitHub Release bodies.
- Update [[dev.release-runbook]] as part of this task, after the actual scripts/workflow behavior is known.
- Use `NPM_TOKEN` through `NODE_AUTH_TOKEN` plus npm provenance for the first publish workflow, matching the current Kato pattern. npm trusted publishing can replace or supplement this later if the package settings are configured for it.
- Pin release workflow Deno setup to `2.7.14`, matching ordinary CI, until we intentionally choose a floating `v2.x` release lane.
- Make the manual workflow default to no npm publish and no GitHub Release mutation. Rehearsal is an explicit npm dry-run plus draft GitHub Release run; publication is a later explicit rerun.
- Use native GitHub-hosted runners for all supported package platforms, with `macos-15-intel` for macOS x64 and `macos-latest` for macOS arm64.

## Contract Changes

- Add durable version metadata, preferably root `deno.json` `version`.
- Add `weave --version` output.
- Add release scripts to root `deno.json`:
  - `build:binaries`
  - `package:binaries`
  - `assemble:npm-packages`
  - `smoke:npm-install`
  - `publish:npm-packages`
  - `bump:version`
- Add a manual release workflow under `.github/workflows/release-manual.yml`.
- Add native binary archive naming and metadata conventions.
- Add npm package naming and package metadata conventions.
- Add release notes body-stripping behavior for GitHub Releases.
- Update release runbook from source-checkpoint process to full release process.

## Testing

- `deno task ci` should remain green after all release scripts and workflow-support code are added.
- Any existing `deno task ci` failures must be resolved or explicitly split into separate tracked blockers before `v0.1.0` is published.
- Add unit tests for version metadata reading and validation.
- Add tests for `bump:version`, including explicit version, patch/minor/major bumping, and release-notes stub creation.
- Add tests for binary bundle metadata construction without requiring native compilation in unit tests.
- Add tests for archive naming and checksum generation.
- Add tests for npm package assembly, including wrapper package metadata, platform package metadata, bin dispatch, `os`/`cpu` constraints, and version alignment.
- Add smoke tests for local npm package install from assembled package directories.
- Release workflow should smoke-test `weave --version` from native binary bundles on Linux, Windows, macOS x64, and macOS arm64.
- Release workflow should smoke-test npm installation on Linux, Windows, macOS x64, and macOS arm64.
- Release workflow should fail when release notes are missing or empty after frontmatter stripping.
- Release workflow should fail when bundled metadata contains more than one version.
- Release workflow should fail when expected archives or checksum files are missing.

## Non-Goals

- Do not publish `v0.0.2` through the new full release pipeline.
- Do not ship unsupported daemon/web binaries just to mirror Kato's executable count.
- Do not add automatic publish-on-tag behavior in the first release workflow.
- Do not require full fixture-ladder regeneration merely to build the release pipeline unless `v0.1.0` release scope explicitly depends on regenerated fixtures.
- Do not solve Homebrew, Scoop, Winget, Docker, AUR, or installer packaging in this task.
- Do not require JSR publishing for `v0.1.0`; npm integration is the first package-manager target.
- Do not move general user-facing README content into release notes or developer runbooks.

## Implementation Plan

- [x] Confirm npm package names, release artifact names, and supported platform matrix as implementation defaults.
- [x] Inventory current `deno task ci` failures and decide which are release-pipeline blockers versus separate product/test debt.
- [ ] Restore the ordinary `deno task ci` quality gate before treating `v0.1.0` as releasable.
- [x] Add canonical version metadata to root `deno.json`.
- [x] Add runtime version-reporting support and expose `weave --version`.
- [x] Add `scripts/bump-version.ts` and root `deno task bump:version`.
- [x] Make the bump script create or verify `documentation/notes/release-notes.v<version>.md`.
- [x] Add tests for version metadata and bump behavior.
- [x] Add `scripts/build-binaries.ts` and root `deno task build:binaries`.
- [x] Add `scripts/package-binaries.ts` and root `deno task package:binaries`.
- [x] Add bundle metadata, archive naming, and `.sha256` generation.
- [x] Add tests for bundle metadata and packaging helpers.
- [x] Add tests for release platform metadata, archive naming, and build-script arguments.
- [x] Add `scripts/assemble-npm-packages.ts` and root `deno task assemble:npm-packages`.
- [x] Add npm wrapper package and platform package generation.
- [x] Add npm package publish metadata and aggregate package manifest generation.
- [x] Add `scripts/smoke-npm-install.ts` and root `deno task smoke:npm-install`.
- [x] Add `scripts/publish-npm-packages.ts` and root `deno task publish:npm-packages`.
- [x] Add tests for npm package assembly.
- [x] Add tests for npm package smoke-test setup.
- [x] Add tests for npm publish ordering and dry-run/provenance arguments.
- [x] Add `.github/workflows/release-manual.yml`.
- [x] Add native binary smoke tests to the release workflow.
- [x] Add npm install smoke tests to the release workflow.
- [x] Add optional npm dry-run/publish and GitHub draft/publish jobs to the release workflow.
- [x] Ensure GitHub Release creation strips Dendron frontmatter and uploads archives plus checksums.
- [x] Update `documentation/notes/release-notes.v0.1.0.md` convention or stub.
- [x] Update [[dev.release-runbook]] for the current version/binary-build and package state.
- [x] Update [[dev.release-runbook]] again after the release workflow becomes the primary path.
- [ ] Run `deno task ci`.
- [ ] Run a release rehearsal with npm dry-run and draft GitHub Release before publishing `v0.1.0`.
