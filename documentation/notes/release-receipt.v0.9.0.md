---
id: 2a29ca08f82c4755aa0c943ed3176549
title: 'Weave v0.9.0 Release Receipt'
desc: 'Source, SFLO dependency, library parity, rehearsal, publication, registry, archive, and installed-consumer verification for Weave v0.9.0'
created: 1787505800000
---

## Status

Weave `v0.9.0` was published on 2026-08-23. SFLO dependency, source, packed-library founding parity, all-platform rehearsal, npm/GitHub publication, archive checksum, installed CLI/library, and direct published founding lifecycle gates are complete.

## Dependency Release

- SFLO v0.5.0 source/tag: `cf10917ee759901f40226e65a3c24b6824459b25`.
- SFLO Pages: `cc416147f61c6ead9cd9110cf4a34fb9b75e40f8`.
- Source CI `32654106737` and Pages deployment `32654532757` succeeded.
- Live core/config/SHACL v0.5.0 payloads are byte-identical to the tag; [[ont.report.2026-08-23-v0.5.0-release]] carries the full receipt.

## Candidate Source

- Reviewed founding implementation: Weave `1b2f080` with final hardening `06da19c`.
- Packed npm-library founding parity: `398c6f8`.
- Canonical parity CI: `https://github.com/semantic-flow/weave/actions/runs/32654551167`, success for source and the strengthened npm-lib job; CodeQL `32654550995` succeeded.
- Versioned local source gate: `deno task fmt` and `deno task ci`, 887/887 green with format, lint, type checks, coverage tests, and LCOV generation.
- Versioned packed library gate: build, pack, off-tree Node install, exact named export, payload parity, founding state-1/correction parity, byte-identical trees, and validation green.
- Release commit: `727c4b22c5307e9a0715de6e201a970b0b548e6c`.
- Release-commit canonical CI: `https://github.com/semantic-flow/weave/actions/runs/32654946339`, success for source CI and the strengthened npm-lib founding smoke.
- Release-commit CodeQL: `https://github.com/semantic-flow/weave/actions/runs/32654946260`, success.

## Release Candidate

- Root authored version: `0.9.0`.
- Local candidate build identity: `398c6f8f913dcf0d6a672a1aca4ddb147d4c9918`; the release workflow will stamp the final release commit and build time.
- Linux native archive and wrapper/platform package assembly passed; `@semantic-flow/weave` and `@semantic-flow/weave-linux-x64` npm publish dry-runs passed.
- `@semantic-flow/weave-lib@0.9.0` npm publish dry-run passed with 521 files, 272.4 kB packed / 1.6 MB unpacked.
- Candidate tarball SHA-256:
  - wrapper: `a7d3b4ecd1ac5acd32cadd47bd9f2d24dbabff54bebb9ed747b7f8a620573fe2`
  - library: `223af1ea95d7254989aa03398fdb7f3a6a5799f01ac379fb5ce621fa2250ed34`
  - Linux x64: `7ce8c4347bb6b4b5523da03fce020857087660416e3104a4d0c292df791954c5`
- A clean disposable npm consumer installed all three candidate tarballs with zero vulnerabilities. The CLI reported `{"version":"0.9.0","commit":"398c6f8f913dcf0d6a672a1aca4ddb147d4c9918","built":null}` and the installed library exported exactly `WeaveApiError`, `validateMesh`, `versionFoundingReferentData`, and `versionPayloads`.
- The workflow release artifacts are built from and stamped with committed release SHA `727c4b22c5307e9a0715de6e201a970b0b548e6c`; the local candidate SHA above identifies the already-reviewed behavior/library-parity parent used before the version-only release commit.

## Workflow Rehearsal

- Release Manual: `https://github.com/semantic-flow/weave/actions/runs/32655150477`, success.
- Inputs: `npm_publish_mode=dry-run`, `npm_tag=latest`, `github_release_mode=draft`.
- Commit: `727c4b22c5307e9a0715de6e201a970b0b548e6c`.
- All four native builds, native binary smokes, archive packaging, wrapper/platform assembly, all four off-tree npm installation smokes, wrapper/platform npm dry-runs, dnt library build, packed Node founding lifecycle smoke, library npm dry-run, and draft GitHub Release management passed.
- Draft inspection: exact release-note body, target release commit, non-prerelease, and eight expected archives/checksums. No `v0.9.0` tag or npm package existed after rehearsal.

## Publication

- Release Manual: `https://github.com/semantic-flow/weave/actions/runs/32655411689`, success.
- Inputs: `npm_publish_mode=publish`, `npm_tag=latest`, `github_release_mode=publish`.
- Commit: `727c4b22c5307e9a0715de6e201a970b0b548e6c`, identical to rehearsal.
- Trusted publishing completed for the wrapper, four native platform packages, and `@semantic-flow/weave-lib`; all pre-publish build/install/founding smoke gates reran green before registry mutation.
- Published at `2026-08-23T17:41:56Z`.
- Git tag `v0.9.0` resolves to the release commit.
- GitHub Release: `https://github.com/semantic-flow/weave/releases/tag/v0.9.0`, non-draft and non-prerelease with eight assets.

## Post-Publish Verification

- npm `latest` resolves to `0.9.0` for `@semantic-flow/weave`, all four platform packages, and `@semantic-flow/weave-lib`.
- Downloaded archive SHA-256 values, each verified against its published checksum file:
  - Linux x64: `86aa141b73a5cd49cfeda11dda9c7df561674d761f48ed65ae49b70da9c0f90f`
  - macOS arm64: `e1804ffae3e9159e76d0b2ec41a48de54103f0709fdeab90bcf3d5b2865afa2f`
  - macOS x64: `fb4cddc7951d1c2468a7225f6aa178aa7fa724b653270b4445bacabfb00f4ce7`
  - Windows x64: `7cc1d987559e10fd0791fdb16aaaa81630b6c04a02bbd2991fa7f23544945093`
- A fresh disposable registry consumer installed `@semantic-flow/weave@0.9.0` and `@semantic-flow/weave-lib@0.9.0` with zero vulnerabilities.
- Installed CLI receipt: `{"version":"0.9.0","commit":"727c4b22c5307e9a0715de6e201a970b0b548e6c","built":"2026-08-23T17:37:14Z"}`.
- Installed library exports exactly `WeaveApiError`, `validateMesh`, `versionFoundingReferentData`, and `versionPayloads`.
- The published library settled state 1 and corrected state 2 for exact founding bytes, preserved state 1, advanced working bytes, matched both SHA-256 digests, and produced no founding page. State digests: `sha256:5b49dba819f667494d6ad73a669e01610a18e97e2499b3c85dacb257f6b8b01a` and `sha256:594cb4d37305d8b22dc8c49f17d8c4464cc50e17cba4ff3dec4557efbb04f58b`.

## Consumer Boundary

The local Stagecraft checkout is four commits behind canonical `main`, contains user-owned `package.json` plus untracked `deno.lock` changes, and has not wired the FoundingReferentData API. This release session does not touch it and does not claim an unavailable Stagecraft founding press. Direct CLI/API, Accord, SFLO Pages, and packed/installed library receipts are the honest release gates.
