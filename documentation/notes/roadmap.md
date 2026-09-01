---
id: g8nk8rv3jwqqjxyd4pgjkox
title: Roadmap
desc: ''
updated: 1787270400000
created: 1773889263552
---

## Grooming Note

Groomed 2026-08-21 and updated 2026-08-31. This note now carries direction and arc-level backlog; the operational queue lives in [[wd.todo]] and [[wd.queues]]. Priority Queue items that verifiably landed were removed (git history keeps the old list): the weave orchestration refactor items (the seams now live in `src/runtime/weave/` — `request_normalization.ts`, `prepared_execution.ts`, `version_execution.ts`, `page_generation.ts`, `page_model_assembly.ts`, `artifact_loaders.ts`), the first general `import` planner/runtime/CLI surface (`weave import`), exact/`Working`/`LatestState` page-source resolution with first-pass fallback, the current-only `ResourcePageDefinition` slice, retirement of the `alice/index.html` special-case builders in favor of page models, Knop-local/inherited config resolution, and the delivered Stagecraft work in [[wa.completed.2026.2026-07-03_1332-stagecraft-weave-planner-generalization]]. Standing policy lines — `_knop/_page/page.ttl` staying mesh-local with extra-mesh content crossing an explicit import boundary, and `_knop/_assets` staying a local ahistorical support area — are settled decisions recorded on [[wa.cancelled.2026.2026-04-08_1545-resource-page-definition-and-sources]], not open work. Renderer-refresh direction is owned by [[wa.task.2026.2026-08-06_0854-markdown-site-pipeline]].

## Next Arc — Candidates (2026-08-21, pending ruling)

1. **Remote resolution** — [[wa.task.2026.2026-05-20_2152-workingAccessUrl]]: let a mesh resolve current bytes for artifacts held elsewhere (e.g. a source ontology in another repository) over policy-gated HTTP(S), with digest-expectation fail-closed exactness. First concrete second-consumer signal 2026-08-21: another of Dave's projects may need a mesh targeting a remotely held ontology. No fetch path exists in `src/` yet; the `sfcfg` remote-policy shape still lives only in the SFLO decision log.
2. **Fingerprint verification** — [[wa.task.2026.2026-05-04-fingerprint-verification]]: the expected/observed digest separation (`c0daa57`) and canonical wire-form validation (in flight) make the operator-facing verify command a thin slice; best treated as the first bite of the remote/digest arc rather than its own arc.
3. **Markdown site pipeline** — [[wa.task.2026.2026-08-06_0854-markdown-site-pipeline]]: ten slices, slice 1 unblocked, packaging proven; the largest new-capability arc, currently queue 1.
4. **Append-only inventory migration** — [[wa.plan.2026.2026-05-17-append-onlyish-inventory]]: named locators, progression correction, first-Knop, versioned first-payload, and [[wa.completed.2026.2026-08-31_2101-initial-versioned-mesh-support-inventory-append]] are delivered; legacy/raw MeshInventory disposition and Knop-local progression ownership remain.

## Completed Arc — Founding Capability Releases (released 2026-08-23)

[[wa.completed-plan.2026.2026-08-23_0950-founding-capability-releases]] published SFLO v0.5.0, the portable Framework contract, and Weave/`weave-lib` v0.9.0. Vocabulary/Pages shipped before the runtime that emits those terms, and packed plus installed Node founding execution proved library parity. [[wa.completed-plan.2026.2026-08-22_1550-stagecraft-iri-initialization]] completed Gates G1–G3 after Dave selected the measured singular path; no batch carve is owed. See [[release-receipt.v0.9.0]].

## Remote And Extra-Mesh Resolution (arc backlog)

- `[importance: high]` Extend operational config from local-boundary policy into the remaining remote/runtime questions: explicit gating for `workingAccessUrl` and `targetAccessUrl`, selective command/runtime consumption, and whether remote-origin association belongs in `integrate` or stays centered on `import`. See [[wa.completed.2026.2026-04-11_1723-operational-config-for-runtime-resolution]] and [[wa.task.2026.2026-05-20_2152-workingAccessUrl]].
- `[importance: high]` Define the import, security, and resolution policy for outside-the-tree and extra-mesh content used by pages: allowed origin schemes, import triggers, pinning requirements, caching, offline behavior, HTML/script safety, and fail-closed error handling.
- `[importance: medium]` Support policy-gated HTTP request shaping for remote RDF sites that do not expose direct file/export URLs cleanly (custom `Accept` headers and related fetch metadata). Matters when a target ontology sits behind content negotiation rather than a raw file URL.

## Live Queue

- `[importance: medium] [how-soon: next]` Finish moving page HTML construction out of core weave planning: the `alice/index.html` special-case builders are gone and page models exist; the residual construction in `src/core/weave/resource_page_builders.ts` should ride the site pipeline's source/compiled model-boundary slice.
- `[importance: medium] [how-soon: next]` Keep templates and chrome policy adjacent to, but separate from, page-content composition: renderer code computes breadcrumbs, nav slices, and optional search inputs; templates render structured inputs rather than becoming a client/runtime framework.
- `[importance: medium] [how-soon: next]` Add Accord acceptance coverage for root lifecycle and customizable identifier pages on the carried ladder.
- `[importance: medium] [how-soon: next]` Replace remaining inventory rewrites with append-onlyish writes. Named locators, integrate append, corrected progression, first-Knop, versioned first-payload, and initial mesh-support append are delivered; audit legacy extract/raw import separately before ruling Knop-local progression ownership and migrating the remaining versioned KnopInventory families.
- `[importance: medium] [how-soon: later]` Add an API surface for deriving candidate `ReferenceLink`s from extraction provenance as an explicit proposal/curation operation, once role defaults and working-vs-exact reference semantics settle.
- `[importance: medium] [how-soon: later]` Add a transformation/extraction layer for using imported RDF datasets as page-region content (overlaps the site pipeline's DigitalArtifact site-generation slice).
- `[importance: medium] [how-soon: later]` Add reusable fixture helpers for root-sourced extract and page-customization scenarios.
- `[importance: medium] [how-soon: later]` Continue replacing raw designator-path concatenation and prefix checks with shared helpers from `src/core/designator_segments.ts`.
- `[importance: medium] [how-soon: later]` Expand templating and chrome controls for generated pages, including per-page preferences and mesh-level defaults.

## Multiple Histories

see [[wa.conv.2026.2026-04-07_1854-weave-targeting-codex#gpt-54_2026-04-07_2037_36]]

## Semantic Flow Overlay

- For identifiers with a ResourcePageDefinition, support an optional "Semantic Flow overlay" button that will display the normal Semantic Flow ResourcePage as an overlay window
