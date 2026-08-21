---
id: f8m2x6v1k4r9p3t5n7h0bca
title: 'Weave v0.8.0 Release Receipt'
desc: 'Source, package-candidate, Stagecraft consumer, workflow, registry, archive, and installed-CLI verification for Weave v0.8.0'
created: 1787367600000
---

## Status

Release candidate gates through the private Stagecraft smoke are complete. Workflow rehearsal, publication, and post-publish verification are recorded below when they complete.

## Candidate Source

- Behavioral candidate commit on `main`: `55b4f002c76f17805c7f7dd43fdaf146e37f9c30`.
- Candidate pull request: `https://github.com/semantic-flow/weave/pull/46`.
- Remote candidate CI: `https://github.com/semantic-flow/weave/actions/runs/32525314290`, success for source CI and npm-lib smoke.
- Local versioned source gate: `deno task fmt` and `deno task ci`, 841 passed / 0 failed with format, lint, type checks, and coverage generation clean.
- Root authored version: `0.8.0`.
- SFLO dependency release: source tag `v0.4.0` at `e9c03c2b`; Pages commit `72d18379`; live payloads byte-identical to the tag. See [[ont.report.2026-08-21-v0.4.0-release]].

## Local Candidate Packaging

Built from the versioned release tree with build metadata commit `55b4f002c76f17805c7f7dd43fdaf146e37f9c30`:

- Linux x64 binary archive: `/tmp/weave-v0.8.0-candidate-release/weave-v0.8.0-linux-x64.tar.gz` with matching `.sha256` file.
- Native CLI npm install smoke passed in an off-tree project; installed output was `weave 0.8.0`.
- Platform and wrapper `npm publish --dry-run` passed.
- `deno task build:npm-lib`, `deno task smoke:npm-lib`, and library `npm publish --dry-run` passed; the off-tree Node consumer versioned two payloads and exercised `validateMesh`.

Candidate tarball digests:

- `@semantic-flow/weave@0.8.0`: `sha256:50fdcb7ebac936fdc50cf6dfd15489915ad516855b36352e7e306d22ca1fc442`.
- `@semantic-flow/weave-linux-x64@0.8.0`: `sha256:1e4056d24007bd83f16809ce318646900e250153f51404d946a930d11497145f`.
- `@semantic-flow/weave-lib@0.8.0`: `sha256:eda458ed8f07a02749d69e22e896385cc27fb93b62707446ff239689f6dbbaac`.

Candidate CLI version receipt:

```json
{"version":"0.8.0","commit":"55b4f002c76f17805c7f7dd43fdaf146e37f9c30","built":null}
```

## Stagecraft Release-Candidate Smoke

- Stagecraft commit: `b83fcf6e22e81a4c74ba371ef22706003cb1baa7`.
- Disposable worktree dependency override installed the wrapper and Linux x64 candidate tarballs above; the worktree was removed after the receipt was preserved, and the real Stagecraft checkout was not modified.
- Receipt bundle: `/tmp/weave-v0.8.0-stagecraft-smoke.json`.
- Receipt digest: `sha256:bc1670e885ebdf2cd084733ac90f5d6381ea930759724dcb41a4d4c91c485e02`.
- `@stagecraft/store` TypeScript check passed under the candidate override.

### Real press flow

Stagecraft `flushHistoricalState` called the candidate through `packages/store/src/persistence.ts`. The flow created the mesh, issued three working-only `weave integrate` calls, and issued one three-target `weave version` call. It returned `versioned`; all three versioned files were byte-identical to their working files; and Stagecraft `assertRuntimeContentIntegrity` passed before, during, and after persistence. All 15 generated Turtle files parsed through Stagecraft's Oxigraph 0.5.9 runtime substrate.

The real Stagecraft path is working-only: it does not pass repository metadata to `integrate`, so it intentionally creates no source registry, repository locator, expectation, or observation. The repository-backed v0.8.0 RDF assertions were therefore exercised in a second disposable probe rather than falsely attributed to the press path.

### Repository-backed RDF probe

Two exact repository integrations used tracked Stagecraft ontology files:

- Without caller expectation: repository locator digest-property count 0; `expectsContentDigest` absent; computed `observedContentDigest` present and canonical; observed spec recorded the concrete Stagecraft ontology path.
- With caller expectation: repository locator digest-property count 0; the one caller-supplied canonical expectation was retained; computed observation matched it; observed spec recorded the concrete Stagecraft SHACL path.

Both registries parsed through Oxigraph. Stagecraft's exact `createPopulationValidator` boundary, using `shacl-engine` 1.1.2, ran the shipped SFLO v0.4.0 repository-locator, expected-digest, expected-subject-typing, and observation shapes unchanged. The targeted report conformed with 0 results and 0 violations.

The broader Stagecraft SHACL sweep was not runnable from the detached worktree because Stagecraft's untracked dependency checkouts were intentionally absent. That infrastructure condition is unrelated to the candidate; the required exact adapter ran directly on the generated RDF.

## SFLO Pages Dogfood

Publishing SFLO v0.4.0 found and fixed two Weave release blockers before this candidate was packaged:

- `8e29b3e`: move a late carried canonical `sfcfg:` declaration before a newly inserted next-state hint.
- `55b4f00`: preserve every repeated same-subject source-registry/reference-catalog block during versioning.

The final Pages run at Weave `55b4f00` published 371 Knops and 1,491 valid Turtle files, produced byte-identical tagged payloads, and returned zero mesh/publication findings.

## Workflow Rehearsal

Pending.

## Publication

Pending.

## Post-Publish Verification

Pending.
