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

This task decides and lands how Weave's library surface is published — npm library package, JSR export, or both — and wires it into CI and the release runbook. It is planning + execution + CI, tracked on the `next/v0.4.1` branch.

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
- 2026-07-22: first library release is **npm-only via dnt**, shipped as **v0.5.0** (new published artifact = minor bump). JSR does not polyfill Deno globals, so a JSR-published package would be Deno-only for code that calls `Deno.*`; dnt is the vehicle that produces a genuinely Node-compatible npm package, and Deno consumers can use the npm build via `npm:` specifiers or keep the pinned-source import. JSR publishing is deferred, not rejected.
- Add a fs-purity guard (PM request): a test/lint asserting `src/api/**` and its transitive runtime imports use no `Deno.Command` (subprocess) and no network APIs, so Node compatibility cannot silently rot after the first publish. Plain fs (`Deno.readTextFile`/`writeFile`) is allowed because dnt shims it; the guard targets subprocess and network only.
- Embed the `defaults/*.ttl` resources as generated modules regardless of registry: it removes the `import.meta.url` read (`WEAVE_DEFAULTS_ROOT` in `src/runtime/config/effective_config.ts`) that `versionPayloads` transitively hits, and avoids dnt having to copy data files. The audit found this is the only runtime `import.meta.url` resource load in `src/` (the other two hits are test files).
- Slow types: the JSR/`deno publish` dry-run surfaced 6 `missing-explicit-type` errors on the public API. dnt requires the same explicit-type discipline, so annotate the exported symbols in `src/mod.ts` / `src/api/version_payloads.ts` as part of this work.

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
- [ ] Add the fs-purity guard test (no `Deno.Command`/network in `src/api/**` + transitive runtime imports) and get it green against the current API path before refactoring, so regressions are caught during the work.
- [ ] Embed `defaults/*.ttl` as generated modules with a byte-identical drift test; rewire `effective_config.ts` to the embedded constants.
- [ ] Annotate the 6 public-API symbols with explicit types.
- [ ] Add a dnt build script (`jsr:@deno/dnt`) producing the Node-compatible npm library package (name TBD — see open issues), separate from the CLI wrapper package.
- [ ] Add the downstream off-tree contract smoke test, run under Node (the honest Node CI leg).
- [ ] Wire the dnt build + Node smoke + publish into the release runbook and `release-manual.yml`.
- [ ] Bump to v0.5.0, write `release-notes.v0.5.0` (this note's decisions + the mesh-create diagnostics fix riding along), and release.
- [ ] Update [[wd.programmatic-version-api]] and release notes to point consumers at the packaged library, keeping the pinned-source import documented.

## Open Issues (updated 2026-07-22)

- Library package name on npm: distinct from the CLI wrapper `@semantic-flow/weave`. Candidate `@semantic-flow/weave-lib` or `@semantic-flow/weave-api`. Needs a decision before first publish (name is semi-permanent).
- Answered 2026-07-22 (module-graph trace of `src/api/mod.ts`, 67 local files): the API graph is subprocess/network-clean except **one** file, `src/runtime/operational/local_path_policy.ts`, which has `new Deno.Command("git", ...)` in `tryRunGit` (used by repository-source resolution — `resolveRepositorySourceFloatingLocalPath`/`listGitRemoteUrls`). `versionPayloads` refuses repository/floating sources, so git is **imported but not called** on the API path; the API also uses this module's non-git functions (`loadOperationalLocalPathPolicy`, `resolveAllowedLocalPath`). dnt's Deno shim can polyfill `Deno.Command`, so this is not a hard blocker, but the clean fix is to split the git-subprocess resolution out of the module the API imports so the API graph is genuinely subprocess-free and the fs-purity guard passes without an exception. This is the PM's "accidental fs-purity" made concrete: one import away from subprocess creep.
- JSR publishing remains a deferred follow-up once npm/dnt is proven.
