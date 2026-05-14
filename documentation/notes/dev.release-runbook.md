---
id: 1u8rkf5ka5mmgschlel7lym
title: Release Runbook
desc: ''
updated: 1778685955558
created: 1778685955558
---

## Purpose

Current developer-facing release process for Weave.

Weave is moving from the `v0.0.2` source-checkpoint release model toward the first packaged `v0.1.0` release. This runbook documents the current transitional state: Weave now has durable root version metadata, `weave --version`, a bump task, release-note stubs, native binary builds, binary archive/checksum packaging, and local npm package assembly, but it does not yet have npm install smoke tests, npm publishing, or the manual GitHub Actions release workflow.

## Current Model

- The authored release version lives in root `deno.json` as `version`.
- Runtime version reporting uses the same root version: `weave --version`.
- Use `deno task bump:version` to change the root version and create or verify `documentation/notes/release-notes.v<version>.md`.
- Release notes live at `documentation/notes/release-notes.v<version>.md`.
- `deno task build:binaries` compiles native `weave` binaries and writes per-platform `bundle-metadata.json`.
- `deno task package:binaries` turns built platform directories into `.tar.gz` or `.zip` archives plus `.sha256` files.
- `deno task assemble:npm-packages` creates the npm wrapper package and selected platform packages from built platform directories.
- GitHub Actions CI and `deno task ci` are the intended quality gates, but the current full test suite still has known fixture/config drift tracked in [[wd.task.2026.2026-05-13-full-ci-cd]] and [[wd.task.2026.2026-05-07-fixture-ladder-generator]].
- There is no automated release workflow yet. Create any GitHub Release manually or with `gh release create`.
- There is no npm package installation smoke-test or publication step yet.
- npm assembly is local package-directory assembly only, so do not claim published npm packages until smoke and publish scripts land.

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
deno test --allow-read --allow-write tests/scripts/bump_version_test.ts tests/scripts/release_metadata_test.ts tests/scripts/package_binaries_test.ts tests/scripts/assemble_npm_packages_test.ts src/version_test.ts
deno test --allow-read --allow-write --allow-run=deno --allow-env tests/e2e/weave_cli_test.ts --filter "weave --version reports"
```

6. Run the full quality gate when feasible:

```bash
deno task ci
```

If `deno task ci` still fails with the known fixture/config drift, record that explicitly in the release notes and do not call the release CI-clean.

7. Build at least the local platform binary as a release-script smoke test:

```bash
deno task build:binaries -- --platform linux-x64 --out-dir /tmp/weave-binaries
deno task package:binaries -- --platform linux-x64 --build-dir /tmp/weave-binaries --out-dir /tmp/weave-release
deno task assemble:npm-packages -- --platform linux-x64 --build-dir /tmp/weave-binaries --out-dir /tmp/weave-npm/node_modules
/tmp/weave-binaries/linux-x64/weave --version
node /tmp/weave-npm/node_modules/@semantic-flow/weave/bin/weave.js --version
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
```

10. Push the branch. Prefer a green GitHub CI run before tagging, but if this is an explicit checkpoint exception, make sure the release notes do not claim green validation.

## Release

Use a reviewed commit on `main`. Green CI is preferred; for a deliberate checkpoint exception, the GitHub Release notes must say that the quality gate is known follow-up work.

Until npm smoke/publish scripts and `release-manual.yml` exist, releases are still manually created GitHub Releases. Binary archives from `package:binaries` may be uploaded manually only after building and packaging every supported platform and confirming matching checksum files. npm package directories from `assemble:npm-packages` are build outputs, not published packages.

Create and push the tag:

```bash
git tag -a v0.1.0 -m v0.1.0
git push origin v0.1.0
```

Create the GitHub Release. The release body should be the release notes content without the Dendron frontmatter. Either paste the body through the GitHub UI, or use a temporary body file and `gh`:

```bash
sed '1,/^---$/d; 1,/^---$/d' documentation/notes/release-notes.v0.1.0.md > /tmp/weave-release-notes.v0.1.0.md
gh release create v0.1.0 --title v0.1.0 --notes-file /tmp/weave-release-notes.v0.1.0.md
```

For a release that should be reviewed before publication, create the release as a draft:

```bash
gh release create v0.1.0 --title v0.1.0 --draft --notes-file /tmp/weave-release-notes.v0.1.0.md
```

## Post-Release

- Confirm the GitHub Release exists and points at the intended commit.
- Confirm the release body matches `documentation/notes/release-notes.v<version>.md` after frontmatter removal.
- Confirm any uploaded binary archives have matching `.sha256` files and match the release notes.
- Confirm no npm package publication is expected until smoke and publish scripts land.
- If another clone needs the new tag, run:

```bash
git fetch --tags origin
```

## Current Caveats

- Weave does not yet have a release workflow like Kato's `Release Manual`.
- Weave can compile and package native binaries locally, but the cross-platform release workflow is not automated yet.
- Weave can assemble local npm package directories, but does not yet smoke-test installation or publish npm/JSR packages.
- `deno task test` is not yet green because fixture-backed expectations need regeneration.
- Release notes are Dendron notes, so any GitHub Release body must omit frontmatter.

## Future Release Workflow

Before treating `v0.1.0` as a distributable product release, finish the remaining release-workflow pieces tracked in [[wd.task.2026.2026-05-13-full-ci-cd]]:

- add npm install smoke tests
- add optional npm publish support
- add `.github/workflows/release-manual.yml`
- make the manual workflow the primary release path
- update this runbook again once the workflow behavior is real

Until those pieces land, keep releases explicit and boring: reviewed commit, authored version, release notes, annotated tag, GitHub Release, no npm claims, and no false CI claims.
