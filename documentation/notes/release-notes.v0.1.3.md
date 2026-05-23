---
id: fd509c549d5a4ff992ce7c89e5626e5e
title: 'release notes v0.1.3'
desc: ''
updated: 1779516796976
created: 1779516796976
---

## Summary

`v0.1.3` is a maintenance release for Weave. It packages the refactoring work that split large weave planning and ResourcePage generation internals into smaller modules, and it fixes native binary packaging so built-in Weave default configuration is available from compiled release binaries.

No generated RDF, CLI command, or ResourcePage output change is intended in this release.

## Highlights

- Native release binaries now embed the `defaults/` directory during `deno compile`, so packaged `weave` executables can load built-in application and config-resolution defaults without depending on a source checkout layout.
- Runtime weave execution was split into focused modules for request normalization, candidate loading, artifact loading, planning context, version execution, prepared execution, progress reporting, ResourcePage context/model assembly, raw source panels, and page generation.
- Core weave planning helpers were split into focused modules for request/model types, slice classification, payload version layout and overwrite planning, RDF/Turtle helpers, shape/source-locator assertions, ResourcePage model builders, render helpers, source-registry blocks, and progression resolvers.
- Shared target selection semantics now live in `src/core/targeting.ts`, reducing duplication between runtime orchestration and pure core planning.
- Release metadata tests now cover the native binary compile arguments that embed defaults.

## Breaking Or Changed Behavior

- No intentional CLI removals or Semantic Flow behavior changes from `v0.1.2`.
- Native binary behavior is corrected for packaged execution: built-in Weave defaults are now bundled into the compiled executable.
- The release contains broad internal module movement. Code importing from private internal module paths may need to follow the new layout; public CLI usage and public core weave façade imports are intended to remain stable.

## Artifacts

- Git tag: `v0.1.3`
- GitHub Release: `v0.1.3`
- Native binary archives for Linux x64, Windows x64, macOS x64, and macOS arm64
- Matching `.sha256` checksum files
- npm packages for `@semantic-flow/weave` and supported platform packages

## Validation

- Source quality gate passed with `deno task ci`: fmt check, lint, type check, coverage test run, and LCOV generation.
- Release workflow rehearsal: run the `Release Manual` workflow with npm dry-run and draft GitHub Release mode before publishing.
- Native binary smoke path: each built executable should run `weave --version`, and npm smoke install should verify the wrapper package resolves the matching platform package.

## Known Limitations

- This release does not add new mesh operations or broaden first-class source acquisition. Manifest-driven bulk `integrate` and import/copy acquisition remain future work.
- The native binaries include Weave defaults, but workspace and host-local policy still control access to local files and detached source checkouts.
- The large internal refactor is intentionally behavior-preserving; planned ResourcePage config/templating and fixture-helper generalization work remains separate.

## Next

- Continue with ResourcePage config and templating work.
- Replace remaining fixture-specific helper paths with generalized render/model paths after the maintenance release checkpoint.
