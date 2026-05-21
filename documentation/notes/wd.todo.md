---
id: 5d7q7j0ra3tybq1dn6e1zha
title: Todo
desc: ''
updated: 1779383363506
created: 1774046031081
---


## Backlog

- [ ] feed the release notes as a supplemental reference into the corresponding historical states, but so far references only works on RDF.
- [ ] After [[wa.completed.2026.2026-04-04_0952-rdf-parsing]] and before or during [[wa.task.2026.2026-04-06_1905-markdown-payload-publishing]], decide whether Weave should add operation-scoped parsed RDF read models for mesh-awareness in publishing and later daemon handlers; defer any daemon-wide in-memory mesh cache until real daemon job flow, locking, and invalidation needs are specified.
- [ ] If `_mesh/_meta/meta.ttl` grows beyond the current carried shape, tighten `src/runtime/mesh/metadata.ts` to require `sflo:meshBase` on the expected mesh subject such as `<_mesh>` rather than accepting that triple from any subject in the document.
- [ ] Decide whether Weave should keep Turtle as the canonical on-disk RDF support-artifact format while later allowing multi-serialization RDF ingest/export at operation boundaries; if explored, scope parser/serializer selection by media type or extension, artifact metadata for serialization choice, hardcoded `.ttl` path assumptions, per-history-state serialization policy, and the runtime checks that still assume `.ttl` payloads in paths such as `src/runtime/integrate/integrate.ts` and `src/runtime/extract/extract.ts`.
- [ ] Implement append-onlyish inventory writes from [[wa.task.2026.2026-05-17-append-onlyish-inventory]]: normal inventory operations should append new settled facts, no-op existing facts, and fail closed on conflicting facts; current/progression pointers belong in metadata or explicit repair/regeneration/retraction modes, not graph-preserving rewrites.
- [ ] Add a carried fixture or focused test for forcing a new payload release state when the source bytes are unchanged, so named-release sequencing can publish a new HistoricalState without relying on content changes. This was deferred from the Fantasy Rules `v0.0.2` slice after the SHACL source gained real version metadata changes.
- [ ] Add user-visible `generate`/`validate` findings for ResourcePage publication anomalies, especially current RDF artifact pages that have ResourcePage generation enabled but no latest HistoricalState to render from.
- [ ] Add a publication option to suppress working-file locator metadata on ResourcePages, while still deriving semantic panels from settled historical states.
- [ ] Add an optional `WEAVE_TEST_TMP_ROOT` override for `createTestTmpDir()` only if stable grouping of preserved test temp workspaces becomes useful again. The current helper already defaults to platform temp space outside the repository.
- [ ] Audit and document the remaining support-artifact history exceptions: Weave defaults now make supporting DigitalArtifacts current-only/thin unless a role overrides that policy, with `config` still explicitly versioned and ResourcePageDefinition progression still carrying a versioned legacy path.
- when an artifact gets created or (in the case of a payload artifact, integrated) it's possible to have "trackHistory" turned off (usually in config but potentially in CLI); support the situation where a changed WorkingFile, on weave, only updates a "latestState" and doesn't write to history
- [ ] Decide whether Weave should migrate acceptance fixtures from git-branch-backed before/after states in `mesh-alice-bio` to explicit folder-backed snapshots. Upside: simpler local/CI fixture reads and easier task-specific fixture authoring. Downside: more duplicated checked-out fixture trees, loss of branch-based carried-slice provenance, and required updates to conformance manifests, notes, and helpers that currently address fixture refs by branch name.
