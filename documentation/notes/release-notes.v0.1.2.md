---
id: baffu3p06ydec5m0eikqklb
title: 'Weave release notes v0.1.2'
desc: ''
updated: 1779377195633
created: 1779339110088
---

## Summary

`v0.1.2` is a compatibility-focused Weave release for detached and branch-published mesh workflows. It tightens floating repository source handling, makes current ResourcePages prefer settled historical content, improves targeted generation correctness, and adds diagnostics and caching for larger recursive weave runs.

This release is still pre-1.0. It does not reintroduce compatibility shims for retired pre-`v0.1.1` command paths, but the changes since `v0.1.1` are intended as additive features, correctness fixes, documentation, and performance work rather than a new breaking command surface.

## Highlights

- Added floating repository source locators for `weave integrate` with `--source-repository-current`, `--source-repository-url`, and optional `--source-repository-remote`, so branch-published meshes can describe mutable working sources by repository URL and repository-root path without persisting workstation-local paths, refs, commits, or digests.
- Preserved floating repository source locators through payload weaving, extraction, generated ResourcePage metadata, and source resolution from allowed local checkouts.
- Normalized common GitHub HTTPS, SSH, and scp-style repository remotes when matching floating repository source URLs against local source grants.
- Changed current `sflo:RdfDocument` ResourcePages to prefer the latest woven historical manifestation for RDF-derived panels when a latest state exists. Mutable working files remain visible as source locator metadata, but current published pages no longer derive semantic panels from unwoven draft bytes.
- Added ResourcePage metadata rows for working source URLs and floating repository source context. Repository URLs render as links, while repository-root paths remain plain text so the page does not imply a pinned branch, commit, or file URL.
- Added `WEAVE_TIMING=1` runtime timing instrumentation for `weave validate`, `weave version`, `weave generate`, and the composed `weave` command, with aggregate timings emitted to stderr so normal command output remains stable.
- Added command-scoped read and candidate caching for recursive weave planning, preserving overlay semantics while avoiding repeated candidate reconstruction during large all-terms publication runs.
- Fixed targeted ResourcePage generation so sibling SHACL child shape rows keep their correct `NodeShape`, `PropertyShape`, or generic `Shape` classification when only selected pages are regenerated.
- Kept Weave-owned defaults guardrails local to this repository, so ordinary CI no longer checks out the SFLO ontology repository only to verify Weave runtime defaults.
- Expanded user-facing CLI notes for the main command surface, shared target syntax, root designators, environment variables, and the SFLO dogfooding publication replay.

## Source Provenance

`weave integrate --source-repository-current` now records a floating current-source binding for repository-backed source files. The binding identifies the source repository and repository-root path while intentionally omitting branch/ref, commit, digest, and local checkout path evidence.

This is meant for publication branches and detached `gh-pages`-style meshes where the source artifact lives in another checkout and should be described as "current source in this repository path," not as "whatever happened to be on this developer's disk." Exact repository evidence remains available through the existing pinned repository fields when a workflow knows the ref, commit, and path it wants to publish.

Floating bindings are now carried across the practical release path:

- `integrate` can write the binding while reading bytes from an allowed local checkout.
- `extract` accepts payloads that use floating repository source locators.
- `weave` validates extracted source payloads by repository URL and repository-root path, then resolves source panels from the host-approved checkout.
- ResourcePages show repository source context without exposing local absolute paths.

See [[wu.cli-reference.integrate]], [[wu.repository-options]], and [[wu.cli-reference.examples.sflo]] for the workflow-level details.

## ResourcePages

Current RDF ResourcePages now favor settled content. When a current RDF artifact has a latest historical state, Weave builds RDF-derived panels from that latest historical manifestation instead of from mutable working bytes. Current-only support artifacts still use their current files, and working source metadata remains visible where it is useful context.

This affects payload pages, Knop support pages, mesh support pages, and ResourcePageDefinition-backed page sources. It makes generated publication pages less likely to show semantic panels from dirty local draft files while still preserving a visible trail back to the mutable source binding.

Targeted generation also received a correctness fix for displayed child resource rows. Sibling SHACL shapes now retain the right class labels when regenerating only selected pages, which is especially important for large ontology and SHACL publications that regenerate slices rather than the whole mesh.

## Performance And Diagnostics

Recursive weave planning now uses command-scoped caches for file reads and weaveable candidate discovery. The cache is invalidated when staged writes touch the recorded dependencies, so recursive target planning can avoid rebuilding the same candidate set repeatedly while still seeing overlay changes made earlier in the command.

`WEAVE_TIMING=1` enables aggregate timing lines on stderr for `weave validate`, `weave version`, `weave generate`, and `weave`. Repeated recursive phases are aggregated with counts and averages, and cache counters are included where useful. Timing output is diagnostic only; stdout and command summaries remain stable.

See [[wu.environment-variables#weave_timing]] and [[wd.codebase-overview.caching]].

## Documentation

The user-facing command reference was expanded around the command surface introduced in `v0.1.1` and refined in this release:

The SFLO example flow now emphasizes disposable publication replay, floating repository source bindings, targeted weave runs, and post-weave validation.

## Changed Behavior

- Current `sflo:RdfDocument` pages now display RDF-derived facts from the latest historical manifestation when one is available. Workflows that intentionally inspect dirty working bytes should look at the working source locator or exact file/source pages rather than assuming the current identifier page follows the mutable file.
- ResourcePage source metadata now distinguishes local working paths, working URLs, and floating repository source context. A floating repository source path is not rendered as a mesh-local file path or a pinned remote file URL.
- Floating repository source bindings intentionally omit local checkout paths, ref/commit evidence, and digest evidence. Exact source evidence still belongs to pinned repository metadata or exact historical state/source references.
- Mesh-owned source candidate roots for floating repository resolution are constrained to the configured workspace boundary. Host-local policy remains the place for explicitly approved separate checkouts.
- Ordinary CI no longer checks out the SFLO ontology repository just to run Weave-owned default guardrails; those checks now stay local to this repository.
- There are no intentional command removals or new breaking CLI migrations from `v0.1.1`.

## Validation

Release validation should use the normal Weave source gate before tagging:

- `deno task fmt:check`
- `deno task lint`
- `deno task check`
- `deno task test`
- `deno task ci`

Additional focused coverage added in this release exercises:

- floating repository source integration, extraction, weave validation, and ResourcePage metadata
- allowed local checkout resolution for floating repository sources
- latest historical RDF panel selection for stale working files and multi-manifestation histories
- recursive weave candidate caching and timing output
- targeted SHACL child row classification
- local defaults guardrails without an SFLO checkout

The SFLO publication replay remains a useful manual release exercise for this slice because it exercises floating repository source bindings, all-terms extraction, recursive weave planning, generated ResourcePages, and publication validation against a large branch-published mesh. Follow [[wu.cli-reference.examples.sflo]] for the current dogfooding sequence.

## Known Limitations

- Floating repository source resolution still depends on an allowed local checkout. Weave records portable source intent in the mesh, but local host policy decides which checkout may satisfy it.
- Remote HTTP(S) source fetching is still not part of `weave integrate`; local paths and `file:` URLs remain the supported byte-acquisition inputs.
- Floating repository source locators are intentionally current/floating. Use pinned repository metadata or historical state/source references when the publication needs immutable source evidence.
- Timing output is intentionally an environment-controlled diagnostic surface, not a stable machine-readable telemetry API.
- Manifest-driven bulk `integrate` and first-class source import/copy acquisition remain future work.

## Artifacts

Release artifacts follow the `v0.1.x` packaged model:

- Git tag: `v0.1.2`
- GitHub Release: `v0.1.2`
- Native binary archives for Linux x64, Windows x64, macOS x64, and macOS arm64
- Matching `.sha256` checksum files
- npm packages for `@semantic-flow/weave` and supported platform packages
