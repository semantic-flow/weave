---
id: 5d7q7j0ra3tybq1dn6e1zha
title: Todo
desc: ''
updated: 1775608847554
created: 1774046031081
---

## Backlog

- [ ] After [[wa.completed.2026.2026-04-04_0952-rdf-parsing]] and before or during [[wd.task.2026.2026-04-06_1905-markdown-payload-publishing]], decide whether Weave should add operation-scoped parsed RDF read models for mesh-awareness in publishing and later daemon handlers; defer any daemon-wide in-memory mesh cache until real daemon job flow, locking, and invalidation needs are specified.
- [ ] If `_mesh/_meta/meta.ttl` grows beyond the current carried shape, tighten `src/runtime/mesh/metadata.ts` to require `sflo:meshBase` on the expected mesh subject such as `<_mesh>` rather than accepting that triple from any subject in the document.
- [ ] Decide whether Weave should keep Turtle as the canonical on-disk RDF support-artifact format while later allowing multi-serialization RDF ingest/export at operation boundaries; if explored, scope parser/serializer selection by media type or extension, artifact metadata for serialization choice, hardcoded `.ttl` path assumptions, per-history-state serialization policy, and the runtime checks that still assume `.ttl` payloads in paths such as `src/runtime/integrate/integrate.ts` and `src/runtime/extract/extract.ts`.
- [ ] Replace the remaining subject-level canonical rewrites with graph-preserving updates when richer mesh inventories are expected. Example: if extracted weave updates `<bob/_knop>` to add `sflo:hasResourcePage <bob/_knop/index.html>`, and a later mesh also records unrelated extra triples on that same subject such as `<bob/_knop> ex:importedFrom <https://example.org/source>` or `<bob/_knop> sflo:hasLabel "Bob Knop"`, the rewrite should keep those extra triples and only add or replace the triples this slice owns, rather than re-rendering the whole subject block and silently dropping the rest.
- when an artifact gets created or (in the case of a payload artifact, integrated) it's possible to have "trackHistory" turned off (usually in config but potentially in CLI); support the situation where a changed WorkingFile, on weave, only updates a "latestState" and doesn't write to history
- [ ] Decide whether Weave should migrate acceptance fixtures from git-branch-backed before/after states in `mesh-alice-bio` to explicit folder-backed snapshots. Upside: simpler local/CI fixture reads and easier task-specific fixture authoring. Downside: more duplicated checked-out fixture trees, loss of branch-based carried-slice provenance, and required updates to conformance manifests, notes, and helpers that currently address fixture refs by branch name.
