---
id: 59807393db294acb8991d298a5d288f2
title: 'release notes v0.5.0'
desc: ''
updated: 1785291583008
created: 1785291583008
---

## Summary

`v0.5.0` packages Weave's programmatic surface as a consumable npm library. The new `@semantic-flow/weave-lib` package is built from `src/api/mod.ts` with dnt and exposes `versionPayloads`, `WeaveApiError`, and the public request/result types to Node and bundler consumers as dual ESM/CJS with TypeScript declarations. The pinned-checkout `./src/mod.ts` import, the CLI wrapper `@semantic-flow/weave`, and the native binaries all keep working unchanged; the library is an additional distribution of the same source.

The release also carries a CLI diagnostics fix: `weave mesh create` outside a workspace now explains itself instead of failing opaquely.

## Highlights

- Added `@semantic-flow/weave-lib`, the npm library package for the payload version API, built via `deno task build:npm-lib` (dnt, ES2022, dual ESM/CJS, bundled type declarations, `@types/n3` for consumer type traversal).
- Added an off-tree downstream contract smoke (`deno task smoke:npm-lib`): the packed tarball is installed into a temp consumer outside the source tree, a real `versionPayloads` batch runs under Node, and the resulting mesh tree and outcomes are asserted byte-identical to the same batch through the Deno source import.
- Added an fs-purity guard test: the runtime module graph of `src/api/**` must stay free of subprocess and network APIs so Node compatibility cannot silently rot. Plain fs reads remain allowed because dnt shims them.
- Split git-backed repository-source resolution out of the module graph the API imports. It now lives behind a lazy dynamic import that only loads when a repository/floating source is actually resolved — a path `versionPayloads` refuses up front — and degrades gracefully in runtimes without `Deno.Command`.
- Embedded the runtime-loaded `defaults/*.ttl` documents as a generated module with a byte-identical drift test, removing the last package-relative `import.meta.url` resource read (the JSR/off-tree bug class the Accord `v0.1.0` release hit).
- Annotated the six public-API symbols flagged by the `deno publish --dry-run` slow-type check, keeping the surface ready for a future JSR export.
- CI gained an `npm-lib` job (build + off-tree Node smoke); the manual release workflow builds, smokes, uploads, and optionally publishes the library alongside the existing wrapper/platform flow, with all npm publish jobs gated on both smokes.
- `weave mesh create` invoked outside a workspace now reports a self-explanatory error.

## Breaking Or Changed Behavior

- None for existing consumers. CLI routing, native binary packaging, the `./src/mod.ts` pinned-source import, and API semantics are unchanged.
- `versionPayloads` still accepts existing mesh-local UTF-8 text/RDF payloads only and still refuses repository/floating sources with typed errors; the packaged library inherits those contracts exactly (byte-equivalence is CI-enforced).
- Version bump is minor because the release adds a new published artifact.

## Artifacts

- New: `@semantic-flow/weave-lib` on npm (first publish in this release).
- Git tag and GitHub Release: `v0.5.0` when the release runbook is executed.
- Native binaries, `@semantic-flow/weave` CLI wrapper, and platform packages continue as before.

## Validation

- Source quality gate: `deno task ci` green (fmt, lint, type-check, full test suite with coverage).
- Library gate: `deno task build:npm-lib` (dnt build with type-check) plus `deno task smoke:npm-lib` (off-tree Node consumer, byte-equivalence against the source import) green locally and wired into CI.
- fs-purity guard and defaults drift test run inside the normal test suite.

## Known Limitations

- No JSR export yet: JSR does not polyfill `Deno.*` for non-Deno consumers, so JSR publishing stays deferred until the npm/dnt path is proven with real consumers. Deno consumers can use `npm:@semantic-flow/weave-lib` or the pinned-source import.
- The library exposes the payload version API only (`versionPayloads` and its types); the wider `./src/mod.ts` surface remains source-import-only.
- npm trusted publishing for the new `@semantic-flow/weave-lib` package name must be configured on the registry before the first publish (see the release runbook for the fallback).

## Next

- Prove the packaged library with a downstream consumer, then revisit the JSR export.
- Extend the library surface as new API entry points land in [[wd.programmatic-version-api]] follow-ups.
