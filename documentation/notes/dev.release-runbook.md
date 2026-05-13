---
id: 1u8rkf5ka5mmgschlel7lym
title: Release Runbook
desc: ''
updated: 1778685955558
created: 1778685955558
---

## Purpose

Current developer-facing release process for Weave.

Weave is still pre-package and pre-v1. The current release path is a reviewed source checkpoint: tag a commit, create a GitHub Release from that tag, and use the release notes in `documentation/notes/release-notes.v<version>.md` as the public summary. This is intentionally smaller than Kato's release pipeline because Weave does not yet build native binaries, assemble npm packages, publish to JSR/npm, or carry durable in-repo version metadata.

## Current Model

- The release version is represented by the Git tag, for example `v0.0.2`.
- Release notes live at `documentation/notes/release-notes.v<version>.md`.
- GitHub Actions CI and `deno task ci` are the intended quality gates, but `v0.0.2` is allowed as an explicit checkpoint exception while the full CI/CD task restores a real release gate for `v0.1.0`.
- There is no automated release workflow yet. Create the GitHub Release manually or with `gh release create`.
- There is no package publication step yet.
- There is no `weave --version` or package version file yet, so do not claim runtime version reporting until a later CI/CD task adds it.

## Pre-Release

1. Confirm the release scope and version. For the current checkpoint, use `v0.0.2`.
2. Update `documentation/notes/release-notes.v<version>.md`. Do not leave the note empty.
3. Make sure the release notes describe what is actually in the release commit, not work planned immediately afterward.
4. Run the local quality gate when feasible, or record the known failure if the checkpoint is intentionally proceeding:

```bash
deno task ci
```

5. Inspect the worktree:

```bash
git status --short
git diff --check
```

6. Commit the release preparation changes with a message that names the release, for example:

```text
docs: prepare v0.0.2 release checkpoint

- add Weave source-release runbook
- add v0.0.2 release notes
- record the pre-config-synthesis checkpoint scope
```

7. Push the branch. Prefer a green GitHub CI run before tagging, but if this is an explicit checkpoint exception, make sure the release notes do not claim green validation.

## Release

Use a reviewed commit on `main`. Green CI is preferred; for a deliberate source-checkpoint exception, the GitHub Release notes must say that the quality gate is known follow-up work.

Create and push the tag:

```bash
git tag -a v0.0.2 -m v0.0.2
git push origin v0.0.2
```

Create the GitHub Release. The release body should be the release notes content without the Dendron frontmatter. Either paste the body through the GitHub UI, or use a temporary body file and `gh`:

```bash
sed '1,/^---$/d; 1,/^---$/d' documentation/notes/release-notes.v0.0.2.md > /tmp/weave-release-notes.v0.0.2.md
gh release create v0.0.2 --title v0.0.2 --notes-file /tmp/weave-release-notes.v0.0.2.md
```

For a checkpoint that should be reviewed before publication, create the release as a draft:

```bash
gh release create v0.0.2 --title v0.0.2 --draft --notes-file /tmp/weave-release-notes.v0.0.2.md
```

## Post-Release

- Confirm the GitHub Release exists and points at the intended commit.
- Confirm the release body matches `documentation/notes/release-notes.v0.0.2.md` after frontmatter removal.
- Confirm no binary/package assets are expected for this release.
- If another clone needs the new tag, run:

```bash
git fetch --tags origin
```

## Current Caveats

- Weave does not yet have a release workflow like Kato's `Release Manual`.
- Weave does not yet publish CLI binaries or npm/JSR packages.
- Weave does not yet have a version bump task.
- Weave does not yet have a runtime `--version` surface.
- Release notes are Dendron notes, so any GitHub Release body must omit frontmatter.

## Future CI/CD Task

Create a dedicated Weave CI/CD task before treating releases as distributable product releases. That task should decide:

- where durable version metadata lives
- whether `weave --version` is supported and how it reads version metadata
- whether releases publish source-only checkpoints, Deno tasks, JSR packages, npm wrappers, native binaries, or some combination
- whether to add a `deno task bump:version`
- whether GitHub Releases are created by a manual workflow
- whether release notes are transformed automatically from Dendron notes
- what smoke tests prove a packaged CLI actually runs
- how fixture repositories and Accord manifests are validated before a release

Until that task lands, keep releases explicit and boring: reviewed commit, annotated tag, GitHub Release, no packaging claims, and no false CI claims.
