---
id: 07t1zf88ffzay7y46jxejgv
title: Weave release notes v0.1.1
desc: ''
updated: 1779177649199
created: 1778971865164
---

## Summary

`v0.1.1` is the first post-package Weave release focused on replacing the old branch-specific `prepare gh-pages` surface with general mesh operations. It makes branch-published and sidecar publication flows more symmetric: create a mesh with an explicit publication profile, integrate source bytes from wherever they live, version only when a new payload state is intended, generate pages from governed state, and validate either the whole mesh or the publication surface.

This release is still pre-1.0. It intentionally removes legacy command paths rather than carrying compatibility shims.

## Highlights

- Removed the `weave prepare gh-pages` CLI/runtime surface. GitHub Pages publication now uses ordinary `mesh create`, `integrate`, `version`, `weave`, `generate`, and `validate` commands.
- Added explicit publication-profile handling at mesh creation. `github-pages` currently persists the resolved profile in mesh config and creates the Pages-specific `.nojekyll` file. Weave does not create or manage `CNAME`.
- Added separate validation scopes: `weave validate mesh` for whole-mesh validation and `weave validate publication` for publication-readiness checks such as configured host preset expectations and conservative host-local path leakage detection.
- Added `--validate-before` and `--validate-after` options to the default `weave` command for workflows that want validation around the version/generate phases.
- Added persistent payload version intent commands, `weave set history` and `weave set next-state`, so release naming can be staged before `weave version` actually creates a new `HistoricalState`.
- Added automatic working-only source binding support to `integrate` for extra-mesh working sources. Repository-backed evidence remains available when URL/ref/path metadata is supplied, but ordinary floating bindings use the internal `payload-source` id and omit ref/commit/path/digest constraints.
- Added host-local access grants for detached source worktrees, so branch-published meshes can integrate source bytes that live outside the publication worktree without copying them into the mesh.
- Added working and latest-state artifact resolution behavior for ResourcePage sources. Exact requested target coordinates remain exact by default; mutable source following is now represented more explicitly.
- Preserved extracted source references through subsequent weave operations and improved ResourcePage presentation for RDF labels, child classes, property labels, source references, and support pages.
- Added an SFLO dogfooding command sequence showing how to rebuild a clean GitHub Pages publication mesh from a detached release source worktree.

## Breaking Or Changed Behavior

- `weave prepare gh-pages` is gone. Existing scripts must use the composed mesh/publication commands instead.
- `src/runtime/deploy/gh_pages.ts` and the deploy-specific gh-pages tests were removed with the legacy prepare runtime.
- The publication profile is now mesh configuration, not an implicit behavior inferred from a branch-only command.
- GitHub Pages-specific behavior is intentionally narrow. `.nojekyll` is managed by the `github-pages` profile; `CNAME` remains a human-owned file.
- `artifactResolutionMode_current` and `artifactResolutionMode_pinned` are no longer the intended active vocabulary. Working-byte and latest-settled-state resolution are modeled separately, while exact state/file/commit/digest coordinates imply exact identity.
- `weave version` remains the command that creates payload states. `weave set history` and `weave set next-state` only record intent for a later version operation.

## Validation

Release validation uses:

- `deno task fmt:check`
- `deno task lint`
- `deno task check`
- `deno task test`
- `deno task ci` as the normal source quality gate
- a disposable SFLO GitHub Pages replay using a detached `v0.1.0` source worktree, preflight `weave validate mesh`, final untargeted `weave`, and post-generation `weave validate publication`

The manual release workflow should be rehearsed before any npm publish or GitHub Release publication, following [[wd.release-runbook]].

## Known Limitations

- Manifest-driven bulk `integrate` is still future work. Current release flows integrate each source payload explicitly.
- First-class `weave import` for copy acquisition into the mesh/publication tree is not part of this release.
- Automated SFLO release actions are not included here. This release provides the Weave command surface those actions should use.
- Whole-mesh validation is still evolving. In particular, some checks are useful as preflight checks before weaving but are not yet a complete post-generation idempotency contract.
- The fixture ladders have not all been regenerated for the new ontology vocabulary. They should be rerun after the ontology and release workflow settle.

## Artifacts

Release artifacts match the packaged `v0.1.x` model:

- Git tag: `v0.1.1`
- GitHub Release: `v0.1.1`
- Native binary archives for Linux x64, Windows x64, macOS x64, and macOS arm64
- Matching `.sha256` checksum files
- npm packages for `@semantic-flow/weave` and supported platform packages
