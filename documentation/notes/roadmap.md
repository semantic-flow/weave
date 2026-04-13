---
id: g8nk8rv3jwqqjxyd4pgjkox
title: Roadmap
desc: ''
created: 1773889263552
---

## Priority Queue

- `[importance: high] [how-soon: next]` Refactor [[wd.codebase-overview|runtime weave]] orchestration in `src/runtime/weave/weave.ts` into smaller seams for request normalization, staged version planning, candidate loading, shared target-coverage rules, and page-generation orchestration. The current file is too large and currently carries multiple correctness-sensitive policies. See [[wd.task.2026.2026-04-08_1615-weave-orchestration-refactor]].
- `[importance: high] [how-soon: next]` Unify weave target preparation across `validate`, `version`, `generate`, and `executeWeave` so target normalization and selection happen once. This removes the current drift risk where one phase can learn new target semantics before the others do. See [[wd.task.2026.2026-04-08_1615-weave-orchestration-refactor]].
- `[importance: high] [how-soon: next]` Continue the carried page-definition ladder now that `16/17`, `18/19`, and `20/21` are real carried pairs: `22-25` should continue root lifecycle coverage on the same ladder. See [[wd.task.2026.2026-04-08_1545-resource-page-definition-and-sources]], [[wd.task.2026.2026-04-13_1245-bob-import-boundary-for-page-source]], and [[wd.spec.2026-04-11-identifier-page-customization-and-root-lifecycle]].
- `[importance: high] [how-soon: next]` Add the first general `import` planner/runtime/CLI surface so the Bob `20/21` import-boundary shape is not only a carried fixture path but also a supported first-class operation. See [[wd.task.2026.2026-04-13_1245-bob-import-boundary-for-page-source]].
- `[importance: high] [how-soon: next]` Complete remaining page-source artifact-resolution semantics by implementing `Pinned` versus `Current` and first-pass fallback behavior such as `ExactOnly` and `AcceptLatestInRequestedHistory`, while continuing to fail closed on cross-history or unrelated-artifact fallback. See [[wd.task.2026.2026-04-08_1545-resource-page-definition-and-sources]].
- `[importance: high] [how-soon: next]` Keep `_knop/_page/page.ttl` able to point at mesh-local `targetMeshPath` values and governed in-mesh artifacts, but require outside-the-tree or extra-mesh content to cross an explicit import boundary first so the imported in-tree copy becomes the governed artifact and current `WorkingLocatedFile` that page generation follows. See [[wd.task.2026.2026-04-08_1545-resource-page-definition-and-sources]].
- `[importance: high] [how-soon: next]` Extend operational config from local-boundary policy into the remaining remote/runtime questions: explicit gating for `workingAccessUrl` and `targetAccessUrl`, selective command/runtime consumption, and the remaining `integrate` boundary about whether remote-origin association belongs there or stays centered on `import`. See [[wd.task.2026.2026-04-11_1723-operational-config-for-runtime-resolution]].
- `[importance: high] [how-soon: next]` Define the import, security, and resolution policy for outside-the-tree and extra-mesh content used by pages: allowed origin schemes, import triggers, pinning requirements, caching, offline behavior, HTML/script safety, and fail-closed error handling. See [[wd.task.2026.2026-04-08_1545-resource-page-definition-and-sources]].
- `[importance: medium] [how-soon: later]` Support policy-gated HTTP request shaping for remote RDF sites that do not expose direct file/export URLs cleanly, including custom `Accept` headers and related fetch metadata, without making content-negotiation-heavy endpoints a prerequisite for the first carried import-boundary fixtures.
- `[importance: medium] [how-soon: later]` Add a transformation/extraction layer for using imported RDF datasets as page-region content. The current customizable identifier-page slice renders imported authored text as Markdown; it does not yet turn imported Turtle/JSON-LD datasets into good page-body content directly.
- `[importance: high] [how-soon: next]` Keep `_knop/_assets` as a local ahistorical support area even if helper metadata is added in ontology/config. If an asset needs independent versioning, publication, or reuse, make it a separate payload artifact and reference it from the page definition rather than trying to version `_assets` directly. See [[wd.task.2026.2026-04-08_1545-resource-page-definition-and-sources]].
- `[importance: high] [how-soon: next]` Move page HTML construction fully into runtime rendering seams. Core weave planning should emit page models only, and the existing `alice/index.html` special-case builders should be retired in favor of a more general page model and renderer.
- `[importance: medium] [how-soon: next]` Keep templates and chrome policy adjacent to, but separate from, page-content composition. Renderer code should compute breadcrumbs, nav slices, and any optional search inputs; templates should render structured inputs rather than turning page generation into a client/runtime framework. See [[wd.task.2026.2026-04-08_1545-resource-page-definition-and-sources]].
- `[importance: medium] [how-soon: next]` Add Accord acceptance coverage for root lifecycle and customizable identifier pages on the carried ladder now that the behavior spec and initial non-root customization slices are already in place.
- `[importance: medium] [how-soon: later]` Add reusable fixture helpers for root-sourced extract and page-customization scenarios so tests do not need to hand-build synthetic Turtle shapes repeatedly.
- `[importance: medium] [how-soon: later]` Continue replacing raw designator-path concatenation and prefix checks with shared helpers from `src/core/designator_segments.ts` to reduce future root-path regressions.
- `[importance: medium] [how-soon: later]` Replace remaining subject-level canonical rewrites with graph-preserving updates when richer mesh inventories and support surfaces are expected.
- `[importance: medium] [how-soon: later]` Expand templating and chrome controls for generated pages, including per-page preferences and mesh-level defaults.
- `[importance: low] [how-soon: later]` Add local and inheritable config once the artifact and page model is stable enough to justify configuration surface area.

## Multiple Histories

see [[wd.conv.2026.2026-04-07_1854-weave-targeting-codex#gpt-54_2026-04-07_2037_36]]

## Semantic Flow Overlay

- For identifiers with a ResourcePageDefinition, support an optional "Semantic Flow overlay" button that will display the normal Semantic Flow ResourcePage as an overlay window
