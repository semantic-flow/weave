---
id: wdlibrarypackaging20260721
title: Library Packaging
desc: ''
updated: 1784698697141
created: 1784698697141
---

## Goals

- Publish Weave's programmatic surface as a consumable library, so downstream apps can import `versionPayloads` and future API entry points without pinning a full-commit source checkout.
- Keep the existing distribution outputs (native binaries, npm CLI-wrapper + platform packages) unchanged.
- Keep the pinned-checkout root import (`./src/mod.ts`) working as the stable low-level path even after a packaged library exists.
- Prove the packaged library actually works off the source tree with a downstream contract smoke test, not just a successful publish.

## Summary

`v0.4.0` shipped the programmatic payload version API as a **source-level** API: consumers import from a pinned checkout, and the release notes state plainly that "the native npm wrapper is not yet a library package, and no JSR export is defined." Library packaging was deferred to this note. See [[wd.programmatic-version-api]] for the API contract and [[release-notes.v0.4.0]] Known Limitations / Next.

This task decides and lands how Weave's library surface is published — npm library package, JSR export, or both — and wires it into CI and the release runbook. It is planning + execution + CI, tracked on the `next/v0.5.0` branch.

## Handoff status (2026-07-28)

Implementation is complete on `next/v0.5.0`: fs-purity guard, git-subprocess split, defaults embedding, explicit public-API types, dnt build (`deno task build:npm-lib`), off-tree Node contract smoke (`deno task smoke:npm-lib`), CI + release-manual wiring. `deno task ci` is green and the smoke proves byte-equivalence between the packed npm library under Node and the Deno source import.

**Release outcome (2026-07-28):** the one-time manual first publish put `weave-lib@0.5.0` on npm and the trusted publisher was configured, but the planned `v0.5.0` release was then **folded into `v0.5.1`** together with the consumer-feedback slice ([[wd.consumer-feedback-0.5.1]]) — one release run publishes everything at 0.5.1, after which `weave-lib@0.5.0` gets deprecated as a lib-only pre-release artifact. This work therefore ships in `v0.5.1` (pending: PR #23 merge + Release Manual run); `release-notes.v0.5.1` carries the combined content, and the v0.5.0 references in the dated decisions and plan items below are historical.

Implementation notes beyond the 2026-07-22 decisions:

- The git split alone could not make the API graph subprocess-free: three modules on the graph (`version_execution.ts`, `artifact_loaders.ts`, `resolver.ts`) call repository-source resolution. The seam is `src/runtime/operational/repository_source.ts`, which loads `repository_source_git.ts` via a lazy dynamic import; the fs-purity guard walks static code edges only and treats statically-visible dynamic imports as the sanctioned CLI-capability boundary. `tryRunGit` feature-detects `Deno.Command` through `globalThis`, so environments without subprocess capability get a graceful no-match instead of a crash.
- Only `application.ttl` and `config-resolution.ttl` are embedded: the audit reconfirmed they are the only defaults the runtime reads (stylesheet defaults are referenced by IRI, not read from the package tree).
- The dnt build needed `@types/n3` (n3@2 ships no types; added as a dependency so consumer type traversal works), `target: ES2022` (Error cause options), and the `Deno.Command` feature-detect above.

## Discussion

### Distribution options

- **JSR export.** Add a top-level `exports` map in `deno.json` (Weave currently has none) pointing at `./src/mod.ts`. This is the most natural fit for a Deno-first codebase and gives Deno consumers a versioned import. Risk: JSR publishing constraints (no `Deno.env`-at-import side effects, slow-type restrictions, dependency resolvability) need a `deno publish --dry-run` spike.
- **npm library package.** A separate package (distinct from the CLI wrapper) exposing the API for Node/bundler consumers. Heavier: needs a build/transpile step and a resolvable dependency graph.
- Decide whether one or both are in scope for the first slice. JSR-first is the likely cheapest credible path; npm library can follow if a Node consumer needs it.

### Resource-loading audit is the load-bearing risk

The Accord `v0.1.0` JSR release shipped a shapes-loading bug of exactly this class: `new URL("../../accord-shacl.ttl", import.meta.url)` + `Deno.readTextFile` works from a `file:` checkout but throws "Must be a file URL" from `https://jsr.io/...` (tracked and fixed in accord as `ac.task.2026.2026-07-05-jsr-shipped-shapes-loading`, embedding the resource as a generated module). Weave must be audited for the same pattern before publishing a library: any package-relative `import.meta.url` resource read (templates, SFLO/SHACL shapes, shiki grammars, config defaults) breaks once the module graph loads off the local filesystem. Embed or bundle those resources, and cover them with the off-tree smoke test.

### Boundary preservation

Packaging must not change CLI routing, binary outputs, or the `./src/mod.ts` import path. The library is an additional distribution of the same source, not a re-architecture.

## Open Issues

- JSR export, npm library package, or both for the first slice?
- Does `deno publish --dry-run` pass cleanly against the current `src/` graph, or do JSR slow-type / side-effect / dependency-resolution constraints need source changes first?
- Which package-relative resource loads exist today, and which break off the filesystem? (Grep `import.meta.url` across `src/`; check shiki grammar loading and any SFLO/template reads.)
- Package name and versioning: is the library published under `@semantic-flow/weave` (colliding with the CLI wrapper) or a distinct name? Is library packaging a `v0.4.1` patch or a `v0.5.0` minor, given it adds a new published artifact?
- How does the release runbook and `release-manual.yml` gain a library-publish step alongside the existing npm-wrapper/binary flow?

## Decisions

- Ship as an additive distribution: existing binaries, CLI wrapper, and the pinned-checkout `./src/mod.ts` import all keep working unchanged.
- Do not publish any library artifact until an off-tree downstream contract smoke test imports it and exercises `versionPayloads` end to end.
- Audit and eliminate filesystem-only resource loading (the accord JSR bug class) before first publish, rather than after a consumer hits it.
- 2026-07-22: first library release is **npm-only via dnt**, shipped as **v0.5.0** (new published artifact = minor bump), published under the npm name **`@semantic-flow/weave-lib`** (distinct from the CLI wrapper `@semantic-flow/weave`). JSR does not polyfill Deno globals, so a JSR-published package would be Deno-only for code that calls `Deno.*`; dnt is the vehicle that produces a genuinely Node-compatible npm package, and Deno consumers can use the npm build via `npm:` specifiers or keep the pinned-source import. JSR publishing is deferred, not rejected.
- Add a fs-purity guard (PM request): a test/lint asserting `src/api/**` and its transitive runtime imports use no `Deno.Command` (subprocess) and no network APIs, so Node compatibility cannot silently rot after the first publish. Plain fs (`Deno.readTextFile`/`writeFile`) is allowed because dnt shims it; the guard targets subprocess and network only.
- Embed the `defaults/*.ttl` resources as generated modules regardless of registry: it removes the `import.meta.url` read (`WEAVE_DEFAULTS_ROOT` in `src/runtime/config/effective_config.ts`) that `versionPayloads` transitively hits, and avoids dnt having to copy data files. The audit found this is the only runtime `import.meta.url` resource load in `src/` (the other two hits are test files).
- Slow types: the JSR/`deno publish` dry-run surfaced 6 `missing-explicit-type` errors on the public API. dnt requires the same explicit-type discipline, so annotate the exported symbols in `src/mod.ts` / `src/api/version_payloads.ts` as part of this work.
- **2026-08-06: the package is ESM-only.** `scripts/build-npm-lib.ts` sets `scriptModule: false`, so dnt emits `esm/` only — `exports: { ".": { "import": "./esm/api/mod.js" } }`, no `main`, no `require` entry, and `esm/package.json` carries `{"type":"module"}`. Node 20 (the declared engine floor) supports ESM natively. This resolved an inconsistency rather than creating one: the previously emitted CJS bundle already contained `require("shiki")` and Shiki is ESM-only upstream, so that build could never have worked as CJS for anything touching page generation — it went unnoticed only because `src/api/mod.ts` exports validation and versioning. Breaking for `require()` consumers; shipped in v0.7.0 and named in its release notes.

## Packaging constraints discovered in practice

Durable facts about the dnt build, recorded as they are found so they are not rediscovered per slice.

- **All dnt entry points must sit under the same base directory as the primary entry point** — in practice `src/`, since the primary is `src/api/mod.ts`. dnt derives a common base from the entry points and strips it from each path; an entry point elsewhere fails the transform outright with `Error stripping prefix of <path> with base <root>/src`. Found 2026-08-06 while adding a temporary subpath export pointing at `scripts/`.

  **This constrains package entry points only — not imports, and not what code may be exported.** Any module may be imported from anywhere in the graph, and production code lives under `src/` regardless, so no real design is affected. It matters only when declaring a new npm subpath export: the module it points at has to live under `src/`.

- **dnt auto-maps *runtime* `npm:` specifiers to real npm dependencies with exact versions.** Verified 2026-08-06 with the full `unified`/`remark`/`rehype` graph: nine import-map pins became nine exact `dependencies` entries in the generated `package.json` with no hand-written mapping.

  **Scope, per CodeRabbit on PR #40:** this covers runtime imports only. Type-only, peer, and other package metadata can still need an explicit entry in the builder's `package.dependencies` — `@types/n3` is declared by hand there precisely because `n3@2` ships no types and consumer type traversal would otherwise break. Adding an import-map pin is sufficient for code dnt actually walks; it is not sufficient for metadata dnt cannot infer.

## Contract Changes

- New published library artifact(s) (JSR export and/or npm library package); no change to the CLI, binaries, ontology, or API semantics.
- Release runbook and CI gain a library assembly + smoke + publish step.

## Testing

- `deno publish --dry-run` (or the npm library build) passes in CI.
- A downstream contract smoke test consumes the published/packed library from outside the source tree and runs a real `versionPayloads` batch against a temp mesh, asserting byte-equivalence with the source-import path.
- Existing `deno task ci`, binary smoke, and npm-wrapper smoke stay green.
- A regression that fails if any package-relative resource load resolves only under `file:`.

## Non-Goals

- Changing the API surface or adding new API entry points (owned by [[wd.programmatic-version-api]] and its follow-ups).
- Removing or altering the pinned-checkout source-import path.
- Changing CLI behavior, native binary packaging, or the ontology.

## Implementation Plan (v0.5.0, npm-only via dnt)

- [x] Grep `src/` for `import.meta.url` resource loads — one runtime blocker: `WEAVE_DEFAULTS_ROOT` in `src/runtime/config/effective_config.ts` (reached by `versionPayloads`).
- [x] `deno publish --dry-run` spike — surfaced 6 `missing-explicit-type` slow-type errors; name/exports otherwise structurally fine.
- [x] Add the fs-purity guard test (no `Deno.Command`/network in `src/api/**` + transitive runtime imports) and get it green against the current API path before refactoring, so regressions are caught during the work. — `src/api/fs_purity_test.ts`; went red on `local_path_policy.ts`, green after the split.
- [x] Embed `defaults/*.ttl` as generated modules with a byte-identical drift test; rewire `effective_config.ts` to the embedded constants. — `scripts/embed-defaults.ts` → `src/runtime/config/generated/weave_defaults.ts` (+ drift test); `deno task embed:defaults`.
- [x] Annotate the 6 public-API symbols with explicit types. — three turtle prefix declarations in `namespaces.ts`, three presentation profiles in `effective_config.ts`; `deno publish --dry-run` slow-type check now passes.
- [x] Add a dnt build script (`jsr:@deno/dnt`) producing the Node-compatible npm library package, separate from the CLI wrapper package. — `scripts/build-npm-lib.ts`, `deno task build:npm-lib`, entry `src/api/mod.ts`, package `@semantic-flow/weave-lib`.
- [x] Add the downstream off-tree contract smoke test, run under Node (the honest Node CI leg). — `scripts/smoke-npm-lib.ts`, `deno task smoke:npm-lib`; packs the tarball, installs into a temp consumer, byte-compares mesh trees and outcomes against the source import.
- [x] Wire the dnt build + Node smoke + publish into the release runbook and `release-manual.yml`. — new `npm-lib` CI job, `build-npm-lib`/`publish-npm-lib` release jobs gating all publishes; runbook updated.
- [x] Bump to v0.5.0, write `release-notes.v0.5.0` (this note's decisions + the mesh-create diagnostics fix riding along). Superseded by the fold: the version became 0.5.1, `release-notes.v0.5.0` was merged into `release-notes.v0.5.1` and deleted, and the trusted publisher is configured; only the v0.5.1 release run remains.
- [x] Update [[wd.programmatic-version-api]] and release notes to point consumers at the packaged library, keeping the pinned-source import documented.

## Open Issues (updated 2026-07-22)

- Library package name: decided 2026-07-22 as `@semantic-flow/weave-lib`.
- Answered 2026-07-22 (module-graph trace of `src/api/mod.ts`, 67 local files): the API graph is subprocess/network-clean except **one** file, `src/runtime/operational/local_path_policy.ts`, which has `new Deno.Command("git", ...)` in `tryRunGit` (used by repository-source resolution — `resolveRepositorySourceFloatingLocalPath`/`listGitRemoteUrls`). `versionPayloads` refuses repository/floating sources, so git is **imported but not called** on the API path; the API also uses this module's non-git functions (`loadOperationalLocalPathPolicy`, `resolveAllowedLocalPath`). dnt's Deno shim can polyfill `Deno.Command`, so this is not a hard blocker, but the clean fix is to split the git-subprocess resolution out of the module the API imports so the API graph is genuinely subprocess-free and the fs-purity guard passes without an exception. This is the PM's "accidental fs-purity" made concrete: one import away from subprocess creep.
- JSR publishing remains a deferred follow-up once npm/dnt is proven.
