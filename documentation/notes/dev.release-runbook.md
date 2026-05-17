---
id: 1u8rkf5ka5mmgschlel7lym
title: Release Runbook
desc: ''
updated: 1778685955558
created: 1778685955558
---

## Purpose

Current developer-facing release process for Weave.

Weave is moving from the `v0.0.2` source-checkpoint release model toward the first packaged `v0.1.0` release. This runbook documents the current packaged release path: durable root version metadata, `weave --version`, release-note stubs, native binary builds, binary archive/checksum packaging, npm package assembly, npm install smoke tests, ordered npm dry-run/publish support, and a manual GitHub Actions release workflow.

## Current Model

- The authored release version lives in root `deno.json` as `version`.
- Runtime version reporting uses the same root version: `weave --version`.
- Use `deno task bump:version` to change the root version and create or verify `documentation/notes/release-notes.v<version>.md`.
- Release notes live at `documentation/notes/release-notes.v<version>.md`.
- `deno task build:binaries` compiles native `weave` binaries and writes per-platform `bundle-metadata.json`.
- `deno task package:binaries` turns built platform directories into `.tar.gz` or `.zip` archives plus `.sha256` files.
- `deno task assemble:npm-packages` creates the npm wrapper package and selected platform packages from built platform directories, including package `publishConfig` metadata and an aggregate `npm-packages-metadata.json` manifest.
- `deno task smoke:npm-install` reads `npm-packages-metadata.json`, runs `npm pack`, installs the wrapper and host platform package tarballs into a temporary project, and verifies `weave --version`.
- `deno task publish:npm-packages` reads `npm-packages-metadata.json` and publishes platform packages before the wrapper package, with dry-run and dist-tag options for the normal trusted-publishing path.
- `.github/workflows/release-manual.yml` is the primary release path for packaged releases. It builds native binaries on native Linux, Windows, macOS x64, and macOS arm64 runners; packages release archives/checksums; assembles npm packages; smoke-tests npm installation on native runners; optionally dry-runs or publishes npm packages; and optionally drafts or publishes the GitHub Release.
- GitHub Actions CI and `deno task ci` are the intended quality gates. Fixture tests that inspect branch-published generated output read explicit Git refs; deterministic source assets are also checked from source-bearing refs so local preview checkouts such as `gh-pages` do not change the test meaning.
- The manual release workflow defaults to no npm publication and no GitHub Release mutation. Rehearsal and publication both require explicit workflow inputs.

## Pre-Release

1. Confirm the release scope and version. For the first full packaged release target, use `v0.1.0` unless the task scope changes.
2. Bump or verify the release version:

```bash
deno task bump:version -- --version 0.1.0
```

Use `--patch`, `--minor`, or `--major` instead when advancing from an existing release.

3. Fill `documentation/notes/release-notes.v<version>.md`. Do not leave generated TODO placeholders in release notes for a real release.
4. Make sure the release notes describe what is actually in the release commit, not work planned immediately afterward.
5. Run the current focused release-tooling checks:

```bash
deno task fmt:check
deno task lint
deno task check
deno test --allow-read --allow-write tests/scripts/bump_version_test.ts tests/scripts/release_metadata_test.ts tests/scripts/package_binaries_test.ts tests/scripts/assemble_npm_packages_test.ts tests/scripts/publish_npm_packages_test.ts tests/scripts/smoke_npm_install_test.ts src/version_test.ts
deno test --allow-read --allow-write --allow-run=deno --allow-env tests/e2e/weave_cli_test.ts --filter "weave --version reports"
```

6. Run the full quality gate when feasible:

```bash
deno task ci
```

If `deno task ci` fails, record the failing command and reason explicitly in the release notes and do not call the release CI-clean.

7. Build at least the local platform binary as a release-script smoke test:

```bash
deno task build:binaries -- --platform linux-x64 --out-dir /tmp/weave-binaries
deno task package:binaries -- --platform linux-x64 --build-dir /tmp/weave-binaries --out-dir /tmp/weave-release
deno task assemble:npm-packages -- --platform linux-x64 --build-dir /tmp/weave-binaries --out-dir /tmp/weave-npm/node_modules
deno task smoke:npm-install -- --input-dir /tmp/weave-npm/node_modules --work-dir /tmp/weave-npm-smoke
/tmp/weave-binaries/linux-x64/weave --version
ls /tmp/weave-release
```

Adjust the platform label to match the runner when validating elsewhere. Supported labels are `linux-x64`, `windows-x64`, `macos-x64`, and `macos-arm64`.

8. Inspect the worktree:

```bash
git status --short
git diff --check
```

9. Commit the release preparation changes with a message that names the release, for example:

```text
release: prepare v0.1.0 packaging groundwork

- add canonical version metadata and version reporting
- add release-note bump tooling
- add native binary build and packaging scripts
- add local npm package assembly
- add local npm install smoke testing
```

10. Push the branch. Prefer a green GitHub CI run before tagging, but if this is an explicit checkpoint exception, make sure the release notes do not claim green validation.

## Release

Use a reviewed commit on `main`. Green CI is preferred; for a deliberate checkpoint exception, the GitHub Release notes must say that the quality gate is known follow-up work.

The primary release path is the manual GitHub Actions workflow:

1. Open the `Release Manual` workflow on the release commit.
2. Run a rehearsal first:

```text
npm_publish_mode: dry-run
npm_tag: latest
github_release_mode: draft
```

3. Inspect the workflow artifacts, npm dry-run logs, draft GitHub Release body, uploaded archives, and checksum assets.
4. If the rehearsal is good, rerun the same workflow on the same commit for publication:

```text
npm_publish_mode: publish
npm_tag: latest
github_release_mode: publish
```

The workflow derives the release tag from downloaded bundle metadata. Do not add a free-form tag input unless the workflow also proves the tag matches root `deno.json`, binary bundle metadata, npm package versions, and release notes.

The workflow strips Dendron frontmatter from `documentation/notes/release-notes.v<version>.md` and fails if the stripped body is empty. The workflow creates or updates the GitHub Release, uploads `.tar.gz`/`.zip` archives and `.sha256` files, and sets the release target to the workflow commit.

The npm publish job publishes platform packages before the wrapper package. Real publish runs use npm trusted publishing through GitHub Actions OIDC; each npm package must trust the `semantic-flow/weave` repository and the `release-manual.yml` workflow. npm generates provenance automatically for trusted public-package publishes, so the workflow does not pass `NODE_AUTH_TOKEN` or `--provenance` in the normal path.

### Troubleshooting

If the npm install smoke jobs fail while reading `dist/npm/npm-packages-metadata.json`, the smoke script is not using the downloaded package artifact path. The workflow should pass `--input-dir .test-tmp/downloaded-npm-packages`, and the script must tolerate the leading `--` separator from `deno task smoke:npm-install -- ...`. If the log already shows `.test-tmp/downloaded-npm-packages/npm-packages-metadata.json`, inspect the `weave-npm-packages` artifact instead: it should contain `npm-packages-metadata.json` at the artifact root plus `@semantic-flow/weave*` package directories. If the expected and actual version strings look identical but the actual version is colored in the GitHub log, the installed command emitted ANSI color codes; compare against decolorized output and print escaped raw output in the failure message.

### Manual Fallback

Use the script-by-script path only for local debugging or emergency release repair. Build and package every supported platform before claiming a full release.

```bash
deno task build:binaries -- --platform linux-x64 --out-dir /tmp/weave-binaries
deno task package:binaries -- --platform linux-x64 --build-dir /tmp/weave-binaries --out-dir /tmp/weave-release
deno task assemble:npm-packages -- --platform linux-x64 --build-dir /tmp/weave-binaries --out-dir /tmp/weave-npm/node_modules
deno task smoke:npm-install -- --input-dir /tmp/weave-npm/node_modules --work-dir /tmp/weave-npm-smoke
deno task publish:npm-packages -- --input-dir /tmp/weave-npm/node_modules --dry-run --tag latest
```

Manual GitHub Release creation should still use the release notes body without Dendron frontmatter. Prefer the workflow because it already validates version consistency and uploads the expected asset set.

## Post-Release

- Confirm the GitHub Release exists and points at the intended commit.
- Confirm the release body matches `documentation/notes/release-notes.v<version>.md` after frontmatter removal.
- Confirm any uploaded binary archives have matching `.sha256` files and match the release notes.
- Confirm npm packages exist under the expected version and dist-tag:

```bash
npm view @semantic-flow/weave@0.1.0 version dist-tags
npm view @semantic-flow/weave-linux-x64@0.1.0 version dist-tags
npm view @semantic-flow/weave-windows-x64@0.1.0 version dist-tags
npm view @semantic-flow/weave-macos-x64@0.1.0 version dist-tags
npm view @semantic-flow/weave-macos-arm64@0.1.0 version dist-tags
```

- Confirm a normal npm install works on at least one machine:

```bash
npm install -g @semantic-flow/weave@0.1.0
weave --version
npm uninstall -g @semantic-flow/weave
```

- If another clone needs the new tag, run:

```bash
git fetch --tags origin
```

## Current Caveats

- The `Release Manual` workflow has been rehearsed on GitHub Actions for the `v0.1.0` packaging path, but release runner labels and npm trusted-publishing settings should still be checked before each publish.
- The workflow uses `macos-15-intel` for macOS x64 and `macos-latest` for macOS arm64. If GitHub-hosted runner labels change, update the workflow before release.
- The workflow expects npm trusted publishing to be configured for the wrapper package and every platform package. Token-based publishing with `--provenance` remains a manual fallback only.
- Local fixture tests should be ref-based rather than checkout-state-based. If a fixture test fails only when a sibling fixture checkout is on a preview/publication branch, treat that as a test coupling bug before treating it as release code drift.
- Release notes are Dendron notes, so any GitHub Release body must omit frontmatter.

## Future Release Workflow

Before treating `v0.1.0` as a distributable product release, finish the remaining release-workflow pieces tracked in [[wd.task.2026.2026-05-13-full-ci-cd]]:

- run the manual workflow in rehearsal mode for materially changed release tooling
- inspect the generated archives/checksums and draft release before publication
- decide whether the known fixture/config test failures block `v0.1.0`
- publish only after npm scope ownership and trusted-publishing settings are confirmed for every package

Keep releases explicit and boring: reviewed commit, authored version, release notes, manual workflow rehearsal when release tooling changed, no false CI claims, and no real npm publish without registry confirmation.
