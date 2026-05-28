---
id: 1u8rkf5ka5mmgschlel7lym
title: Release Runbook
desc: ''
updated: 1779952454402
created: 1778685955558
---

## Purpose

Current developer-facing release process for packaged Weave releases.

The normal release path is the `Release Manual` GitHub Actions workflow, run from a reviewed commit on `main`. The workflow builds native binaries, packages release archives/checksums, assembles npm packages, smoke-tests npm installation on native runners, optionally dry-runs or publishes npm packages, and optionally drafts or publishes the GitHub Release.

## Current Model

- The authored release version lives in root `deno.json` as `version`; `weave --version`, binary bundle metadata, npm package versions, and release tags are derived from that value.
- Use `deno task bump:version` to change the root version and create or verify `documentation/notes/release-notes.v<version>.md`.
- Release notes live at `documentation/notes/release-notes.v<version>.md`; the workflow strips Dendron frontmatter before writing the GitHub Release body and fails if the stripped body is empty.
- `.github/workflows/release-manual.yml` is the primary packaged-release path. It runs the release-specific build, archive, checksum, npm assembly, npm smoke-test, npm publish/dry-run, and GitHub Release steps.
- The workflow derives the release tag from downloaded bundle metadata. Do not add a free-form tag input unless the workflow also proves the tag matches root `deno.json`, binary bundle metadata, npm package versions, and release notes.
- GitHub Actions CI and `deno task ci` are the intended source quality gates. Fixture tests that inspect branch-published generated output should read explicit Git refs so local preview checkouts such as `gh-pages` do not change the test meaning.
- The manual release workflow defaults to no npm publication and no GitHub Release mutation. Rehearsal and publication both require explicit workflow inputs.

## Pre-Release

1. Confirm the release scope and version.
2. Bump or verify the release version:

```bash
VERSION=0.2.2
deno task bump:version -- --version "$VERSION"
```

Set `VERSION` to the intended release version. Use `--patch`, `--minor`, or `--major` instead when advancing mechanically from the current root version.

3. Fill `documentation/notes/release-notes.v<version>.md`. Do not leave generated TODO placeholders in release notes for a real release.
4. Make sure the release notes describe what is actually in the release commit, not work planned immediately afterward.
5. For Semantic Flow ontology/SHACL release prep, confirm each `owl:versionIRI` points at the raw bytes for the matching release tag, for example `https://raw.githubusercontent.com/semantic-flow/sflo/refs/tags/v0.1.0/semantic-flow-core-shacl.ttl`, and confirm that tag will exist on the repository that serves those bytes. Do not use a mutable branch URL such as `refs/heads/main` for an OWL version IRI.
6. Run the source quality gate:

```bash
deno task ci
```

If `deno task ci` fails, record the failing command and reason explicitly in the release notes and do not call the release CI-clean.

7. Inspect the worktree:

```bash
git status --short
git diff --check
```

8. Commit the release preparation changes with a message that names the release, for example:

```text
release: prepare v0.1.1

- bump root version metadata
- update release notes
- verify source quality gate
```

9. Push the branch. Prefer a green GitHub CI run before running the release workflow; if this is an explicit checkpoint exception, make sure the release notes do not claim green validation.

## Release

Use a reviewed commit on `main`. Green CI is preferred; for a deliberate checkpoint exception, the GitHub Release notes must say that the quality gate is known follow-up work.

1. Open the `Release Manual` workflow on the release commit.
2. Run a rehearsal first:

```text
npm_publish_mode: dry-run
npm_tag: latest
github_release_mode: draft
```

3. Inspect the workflow artifacts, npm dry-run logs, draft GitHub Release body, uploaded archives, and checksum assets. The rehearsal should prove the complete release path without publishing npm packages.
4. If the rehearsal is good, rerun the same workflow on the same commit for publication:

```text
npm_publish_mode: publish
npm_tag: latest
github_release_mode: publish
```

The workflow creates or updates the GitHub Release, uploads `.tar.gz`/`.zip` archives and `.sha256` files, and sets the release target to the workflow commit.

The npm publish job publishes platform packages before the wrapper package. Real publish runs use npm trusted publishing through GitHub Actions OIDC; each npm package must trust the `semantic-flow/weave` repository and the `release-manual.yml` workflow. npm generates provenance automatically for trusted public-package publishes, so the workflow does not pass `NODE_AUTH_TOKEN` or `--provenance` in the normal path.

If npm publication succeeds but the GitHub Release step needs repair, rerun the workflow on the same commit with `npm_publish_mode: skip` and the appropriate `github_release_mode`. Do not rerun npm publication for versions that already exist on the registry.

### Troubleshooting

If the npm install smoke jobs fail while reading `dist/npm/npm-packages-metadata.json`, the smoke script is not using the downloaded package artifact path. The workflow should pass `--input-dir .test-tmp/downloaded-npm-packages`, and the script must tolerate the leading `--` separator from `deno task smoke:npm-install -- ...`. If the log already shows `.test-tmp/downloaded-npm-packages/npm-packages-metadata.json`, inspect the `weave-npm-packages` artifact instead: it should contain `npm-packages-metadata.json` at the artifact root plus `@semantic-flow/weave*` package directories. If the expected and actual version strings look identical but the actual version is colored in the GitHub log, the installed command emitted ANSI color codes; compare against decolorized output and print escaped raw output in the failure message.

### Manual Fallback

Use script-by-script commands only for local debugging or emergency release repair. Build and package every supported platform before claiming a full release.

```bash
deno task build:binaries -- --platform <platform> --out-dir /tmp/weave-binaries
deno task package:binaries -- --platform <platform> --build-dir /tmp/weave-binaries --out-dir /tmp/weave-release
deno task assemble:npm-packages -- --build-dir /tmp/weave-binaries --out-dir /tmp/weave-npm/node_modules
deno task smoke:npm-install -- --input-dir /tmp/weave-npm/node_modules --work-dir /tmp/weave-npm-smoke
deno task publish:npm-packages -- --input-dir /tmp/weave-npm/node_modules --dry-run --tag latest
```

Supported platform labels are `linux-x64`, `windows-x64`, `macos-x64`, and `macos-arm64`. Manual GitHub Release creation should still use the release notes body without Dendron frontmatter. Prefer the workflow because it already validates version consistency and uploads the expected asset set.

## Post-Release

- Confirm the GitHub Release exists and points at the intended commit.
- Confirm the release body matches `documentation/notes/release-notes.v<version>.md` after frontmatter removal.
- Confirm any uploaded binary archives have matching `.sha256` files and match the release notes.
- Confirm npm packages exist under the expected version and dist-tag:

```bash
VERSION=$(deno eval 'console.log(JSON.parse(await Deno.readTextFile("deno.json")).version)')
npm view "@semantic-flow/weave@$VERSION" version dist-tags
npm view "@semantic-flow/weave-linux-x64@$VERSION" version dist-tags
npm view "@semantic-flow/weave-windows-x64@$VERSION" version dist-tags
npm view "@semantic-flow/weave-macos-x64@$VERSION" version dist-tags
npm view "@semantic-flow/weave-macos-arm64@$VERSION" version dist-tags
```

- Confirm a normal npm install works on at least one machine:

```bash
VERSION=$(deno eval 'console.log(JSON.parse(await Deno.readTextFile("deno.json")).version)')
npm install -g "@semantic-flow/weave@$VERSION"
weave --version
npm uninstall -g @semantic-flow/weave
```

- If another clone needs the new tag, run:

```bash
git fetch --tags origin
```

## Current Caveats

- The workflow uses `macos-15-intel` for macOS x64 and `macos-latest` for macOS arm64. If GitHub-hosted runner labels change, update the workflow before release.
- The workflow expects npm trusted publishing to be configured for the wrapper package and every platform package. Token-based publishing with `--provenance` remains an emergency fallback only.
- Release notes are Dendron notes, so any GitHub Release body must omit frontmatter.

Keep releases explicit and boring: reviewed commit, authored version, release notes, manual workflow rehearsal when release tooling changed, no false CI claims, and no real npm publish without registry confirmation.
