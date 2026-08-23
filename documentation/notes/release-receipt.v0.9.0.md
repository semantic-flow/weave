---
id: 2a29ca08f82c4755aa0c943ed3176549
title: 'Weave v0.9.0 Release Receipt'
desc: 'Source, SFLO dependency, library parity, rehearsal, publication, registry, archive, and installed-consumer verification for Weave v0.9.0'
created: 1787505800000
---

## Status

Candidate preparation is active. SFLO v0.5.0 source and Pages are published; Weave source and packed-library founding parity gates are green. All-platform rehearsal and publication receipts remain required.

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
- Pending: committed release SHA and its canonical CI/CodeQL receipts.

## Workflow Rehearsal

Pending Release Manual `npm_publish_mode=dry-run`, `npm_tag=latest`, `github_release_mode=draft` receipt.

## Publication

Pending Release Manual publication receipt.

## Post-Publish Verification

Pending tag, GitHub Release, npm, archives/checksums, installed CLI JSON, installed library founding lifecycle, and clean-worktree receipts.

## Consumer Boundary

The local Stagecraft checkout is four commits behind canonical `main`, contains user-owned `package.json` plus untracked `deno.lock` changes, and has not wired the FoundingReferentData API. This release session does not touch it and does not claim an unavailable Stagecraft founding press. Direct CLI/API, Accord, SFLO Pages, and packed/installed library receipts are the honest release gates.
