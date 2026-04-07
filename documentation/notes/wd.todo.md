---
id: 5d7q7j0ra3tybq1dn6e1zha
title: Todo
desc: ''
updated: 1775542572988
created: 1774046031081
---

## Backlog

- [ ] After [[wd.task.2026.2026-04-04_0952-rdf-parsing]] and before or during [[wd.task.2026.2026-04-06_1905-markdown-payload-publishing]], decide whether Weave should add operation-scoped parsed RDF read models for mesh-awareness in publishing and later daemon handlers; defer any daemon-wide in-memory mesh cache until real daemon job flow, locking, and invalidation needs are specified.
- [ ] If `_mesh/_meta/meta.ttl` grows beyond the current carried shape, tighten `src/runtime/mesh/metadata.ts` to require `sflo:meshBase` on the expected mesh subject such as `<_mesh>` rather than accepting that triple from any subject in the document.
- [ ] Decide whether Weave should keep Turtle as the canonical on-disk RDF support-artifact format while later allowing multi-serialization RDF ingest/export at operation boundaries; if explored, scope parser/serializer selection by media type or extension, artifact metadata for serialization choice, hardcoded `.ttl` path assumptions, per-history-state serialization policy, and the runtime checks that still assume `.ttl` payloads in paths such as `src/runtime/integrate/integrate.ts` and `src/runtime/extract/extract.ts`.
