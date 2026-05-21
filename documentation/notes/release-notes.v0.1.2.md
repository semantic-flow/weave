---
id: baffu3p06ydec5m0eikqklb
title: 'Weave release notes v0.1.2'
desc: ''
updated: 1779339125212
created: 1779339110088
---

## Summary

`v0.1.2` is a compatibility-focused Weave release that tightens branch-published source handling, generated ResourcePage source selection, and large-mesh runtime ergonomics after `v0.1.1`.

This release is still pre-1.0. It does not reintroduce compatibility shims for retired pre-`v0.1.1` command paths, but the post-`v0.1.1` changes are intended as additive features, correctness fixes, and performance improvements rather than a new breaking command surface.

## Highlights

- Added floating repository source locators for `integrate` with `--source-repository-current` and optional `--source-repository-remote`, so branch-published meshes can describe mutable working sources by repository URL and repository-root path without persisting workstation-local paths, refs, commits, or digests.
- Preserved floating repository source locators through payload weave, extraction, generated metadata rows, and source resolution from allowed local checkouts.
- Changed current `sflo:RdfDocument` ResourcePages to prefer the latest woven historical manifestation for RDF-derived panels when a latest state exists. Mutable working files remain visible as source locator metadata, but current published pages no longer derive semantic panels from unwoven draft bytes.
- Added `WEAVE_TIMING=1` runtime timing instrumentation for `validate`, `version`, `generate`, and `weave`, with aggregate timings emitted to stderr so normal command output remains stable.
- Added command-scoped read and candidate caching for recursive weave planning, preserving overlay semantics while avoiding repeated candidate reconstruction during large all-terms publication runs.
- Fixed targeted ResourcePage generation so sibling SHACL child shape rows keep their correct classification when only selected pages are regenerated.
- Updated SFLO dogfooding documentation around disposable GitHub Pages publication replay, floating repository source bindings, and post-weave validation.

## Changed Behavior

- Current `sflo:RdfDocument` pages now display RDF-derived facts from the latest historical manifestation when one is available. Workflows that intentionally inspect dirty working bytes should look at the working source locator or exact file/source pages rather than assuming the current identifier page follows the mutable file.
- Floating repository source bindings intentionally omit local checkout paths and digest evidence. Exact source evidence still belongs to pinned repository metadata or exact historical state/source references.
- Ordinary CI no longer checks out the SFLO ontology repository just to run Weave-owned default guardrails; those checks now stay local to this repository.

## Validation

Release validation should use the normal Weave source gate:

- `deno task fmt:check`
- `deno task lint`
- `deno task check`
- `deno task test`
- `deno task ci`

The SFLO publication replay remains a useful manual release exercise for this slice because it exercises floating repository source bindings, all-terms extraction, recursive weave planning, generated ResourcePages, and publication validation against a large branch-published mesh.

## Known Limitations

- Floating repository source resolution still depends on an allowed local checkout. Weave records portable source intent in the mesh, but local host policy decides which checkout may satisfy it.
- Remote HTTP(S) source fetching is still not part of `weave integrate`; local paths and `file:` URLs remain the supported byte-acquisition inputs.
- Timing output is intentionally an environment-controlled diagnostic surface, not a stable machine-readable telemetry API.
- Manifest-driven bulk `integrate` and first-class source import/copy acquisition remain future work.

## Artifacts

Release artifacts follow the `v0.1.x` packaged model:

- Git tag: `v0.1.2`
- GitHub Release: `v0.1.2`
- Native binary archives for Linux x64, Windows x64, macOS x64, and macOS arm64
- Matching `.sha256` checksum files
- npm packages for `@semantic-flow/weave` and supported platform packages
