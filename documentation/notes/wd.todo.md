---
id: 5d7q7j0ra3tybq1dn6e1zha
title: Todo
desc: ''
updated: 1779947902489
created: 1774046031081
---


## Backlog

Groomed on 2026-05-27 from all `wa.task.*` notes in the Weave archive. Updated after per-target effective config and `ResourcePageSource` exact/fallback resolution landed. Lightly refreshed on 2026-06-30 after the paper sprint was parked and Stagecraft became an active downstream consumer for persisted roleplaying data.

### Current Work And Next Pick

- [x] Finish in-progress [[wa.completed.2026.2026-05-27_2215-resourcepage-source-resolution-semantics]]: exact `targetHistoricalState`, one-level fallback, no fallback for malformed/unsafe/unsupported specs, and focused resolver/page-definition tests.
- [x] Finish the current-only `ResourcePageDefinition` slice from [[wa.task.2026.2026-05-05-optional-history-and-slim-support-artifacts-by-default]]: `_knop/_page` can remain unversioned, custom page generation reads `_knop/_page/page.ttl` when `_history001` is absent, and omitted page-definition histories are not linked.
- [d] Park the June 2026 paper sprint as concept scratch, not current delivery work. The FOMI/FOIS drafts remain useful for terminology and future documentation, with KGSWC 2026 now tracked as the next possible submission target in [[wa.task.2026.2026-06-30_1159-kgswc-2026-paper-target]], but engineering should not chase paper-specific implementation.
- [ ] Use [[wa.task.2026.2026-06-30_1108-stagecraft-driven-semantic-flow-requirements]] to collect concrete Stagecraft persistence requirements before reshaping Weave or SFLO vocabulary around imagined roleplaying-data needs.
- [ ] Use [[wa.task.2026.2026-07-03_1332-stagecraft-weave-planner-generalization]] as the concrete Stagecraft-driven Weave blocker epic: reproduce the settled second-payload weave failure, generalize the planner from RDF facts, and replace fixture-shaped diagnostics.
- [ ] Take [[wa.task.2026.2026-05-17-append-onlyish-inventory]] as the next larger inventory-correctness task now that the current history-policy slice is bounded, unless a sharply scoped Stagecraft blocker proves more urgent.

### P0: Current Config And Resolution Follow-Ups

- [x] Implement [[wa.completed.2026.2026-05-27-2031-per-target-effective-config-resolution]] before applying Knop-local/inherited config to recursive or multi-target version/generate/weave operations.
- [x] Finish [[wa.completed.2026.2026-05-27_2215-resourcepage-source-resolution-semantics]] as the first broader page-source resolver cleanup consumer from [[wa.completed.2026.2026-05-24_1748-shared-artifact-resolution-runtime-service]] and [[wa.task.2026.2026-04-08_1545-resource-page-definition-and-sources]].
- [x] Implement the current-only `ResourcePageDefinition` support-artifact slice from [[wa.task.2026.2026-05-05-optional-history-and-slim-support-artifacts-by-default]] after ResourcePageSource exact/fallback semantics landed.
- [ ] Keep path and URL trust policy aligned with [[wa.task.2026.2026-04-11_1723-operational-config-for-runtime-resolution]], [[wa.task.2026.2026-05-20_2152-workingAccessUrl]], and the config-source resolver. Do not let portable mesh config silently grant broader host trust.
- [x] Document config-source bootstrap authoring now that tests exercise it correctly: mesh-local config-source attachments belong in `_mesh/_meta/meta.ttl`, Knop-local and inheritable attachments belong in current Knop metadata, and the resolved `_config/*.ttl` files are config payloads rather than bootstrap authority.

### P1: Publication, History, And Runtime Correctness

- [ ] Keep Stagecraft's persisted roleplaying-data use case in view when prioritizing runtime work: prefer slices that improve stable identifiers, exact state citation, append-onlyish histories, source provenance, and generated inspection pages for ordinary application data.
- [x] Land the single-target Stagecraft-triggered later-payload planner slice from [[wa.task.2026.2026-07-03_1332-stagecraft-weave-planner-generalization]]: full `weave` can advance a coherent later payload history instead of rejecting non-fixture-shaped states with "settled second payload weave shape" errors.
- [x] Follow up on [[wa.task.2026.2026-07-03_1332-stagecraft-weave-planner-generalization]] with multi-target later-payload advancement.
- [ ] Remove the remaining first-payload planner blockers from [[wa.task.2026.2026-05-04-refactor-planFirstPayloadWeave]]: support multi-pending first-payload weave in one transaction, support current-mode extracted-term weave, and replace fixture-shaped errors with condition-specific diagnostics. The SFLO and URPX docs still warn about the current failure mode, so this is real backlog, not just cleanup.
- [ ] Implement append-onlyish inventory writes from [[wa.task.2026.2026-05-17-append-onlyish-inventory]]: normal inventory operations append new settled facts, no-op existing facts, and fail closed on conflicts; current/latest/next progression belongs in metadata or explicit repair/regeneration/retraction modes.
- [d] Finish broader slim/current-only support-artifact behavior from [[wa.task.2026.2026-05-05-optional-history-and-slim-support-artifacts-by-default]]: the current-only `ResourcePageDefinition` slice has landed; remaining inventory/meta split and durable history-toggle coherence stay with [[wa.task.2026.2026-05-17-append-onlyish-inventory]] and follow-up history-policy work.
- [ ] Keep the durable history-toggle path coherent across config, CLI overrides, and weave/version/generate behavior. A changed working file should be able to update current/latest state without always writing a new history state when the effective history policy says current-only or slim.
- [ ] Finish branch-published working-source portability from [[wa.task.2026.2026-05-19_2349-branch-based-workingfile-fix]]: add path-leakage validation with all failing files listed, update durable runtime docs only if needed, and rerun the scratch SFLO `gh-pages` publication to confirm no host-local or sibling-worktree paths leak.
- [ ] Define and implement publication-base-relative link policy from [[wa.task.2026.2026-05-26_1321-relative-links]] for generated ResourcePages and rendered Markdown links. This should become a real task note before code work; the current note is only a prompt.
- [ ] Add user-visible `generate`/`validate` findings for ResourcePage publication anomalies, especially current RDF artifact pages that have ResourcePage generation enabled but no latest HistoricalState to render from.
- [ ] Add a publication option to suppress working-file locator metadata on ResourcePages while still deriving semantic panels from settled historical states.

### P2: Fixtures, Renderer, And Developer Experience

- [ ] Integrate Accord v0.1.0 capabilities into the fixture-ladder workflow: pin the CI accord checkout to the `v0.1.0` tag, run `accord validate` over the live Semantic Flow manifests as a fast CI authoring gate before slow ladder checks, convert the mesh-alice-bio smoke / full-corpus rerun to a scenario index driven by `accord check-scenario` for per-rung evidence, use `accord draft-manifest` as the starting point when ladder rungs change intentionally, and consider JSON assertions for generated-page contract checks. The accord-side features are complete (see `ac.completed.2026.2026-07-04-*` notes in the accord repo); this item is Weave-side adoption only.
- [ ] Add the manifest completeness check from [[wa.task.2026.2026-05-16_1625-manifest-completeness-check]] so fixture branch diffs cannot drift beyond Accord manifest expectations or deliberate `ignorePaths`.
- [ ] Add the latest-state conformance fixture from [[wa.task.2026.2026-05-19_1536-latest-state-conformance]] once Accord can express the needed rendered-text assertions.
- [ ] Revisit custom ResourcePage follow-up work in [[wa.task.2026.2026-05-23-2157-resourcepage-followup]] after Knop config inheritance settles: the next useful slice is probably a narrow custom page fixture that keeps the shared Semantic Site presentation while opting into authored Markdown plus selected generated panels.
- [ ] Continue test/performance work from [[wa.task.2026.2026-05-26_2237-testing-optimization]] and [[wa.task.2026.2026-05-17-weave-performance-optimization]]: add `WEAVE_TEST_TIMING=1`, record baselines, cache fixture reads by resolved commit, add tiny-mesh builders for tests that do not need the real fixture ladders, and add validation progress output behind a quiet/default/verbose policy.
- [ ] Implement the first RDF parse/render boundary slice from [[wa.task.2026.2026-05-28-0030-rdf-and-turtle-cleanup]]: add shared Weave Turtle context/fact helpers, let `inventory_append_planner` accept requested facts/quads instead of parser-dependent Turtle snippets, and keep compact SFLO/config rendering separate from byte-preserved carried blocks.
- [ ] Split the largest files under [[wa.task.2026.2026-05-23_0040-further-refactoring]] in behavior-preserving slices: `src/runtime/weave/pages.ts`, `scripts/fixture-ladder.ts`, `src/core/weave/weave_test.ts`, `tests/integration/weave_test.ts`, and `tests/scripts/fixture_ladder_test.ts` are still large enough to slow future work.
- [ ] Decide renderer strategy before broadening Markdown behavior: either keep the current small renderer and close [[wa.task.2026.2026-05-25-markdown-it]] as superseded, or switch deliberately to a Deno-friendly Markdown library. Tie this to [[wa.task.2026.2026-04-13_1715-page-renderer-refresh-and-html-regeneration]] and [[wa.task.2026.2026-05-24_2353-autolinking]] rather than making another ad hoc parser pass.
- [ ] Define autolinking behavior from [[wa.task.2026.2026-05-24_2353-autolinking]]: term links in Turtle/prose, Dendron wikilinks in Markdown-derived pages, and any publication-base rewrite rules should be scoped together.
- [ ] Add a carried fixture or focused test for forcing a new payload release state when source bytes are unchanged, so named-release sequencing can publish a new HistoricalState without relying on content changes.
- [ ] Decide whether Weave should migrate acceptance fixtures from git-branch-backed before/after states to explicit folder-backed snapshots. Upside: simpler local/CI reads and easier task-specific fixture authoring. Downside: duplicated fixture trees, weaker branch provenance, and updates to manifests, notes, and helpers that currently address fixture refs by branch name.

### P3: Later Features And Architecture

- [ ] Keep manifest-driven integrate from [[wa.task.2026.2026-05-18_1846-integrate-manifest]] parked until the one-target integrate/source-binding contract and publication dogfood are stable.
- [ ] Keep guarded branch-published rebuild from [[wa.task.2026.2026-05-14_1105-guarded-branch-published-rebuild]] parked until incremental branch publishing has more mileage; rebuild should stay loud, dry-runnable, and deletion-plan-driven.
- [ ] Keep deploy profiles from [[wa.task.2026.2026-05-16-deploy-profile]] parked until the manual SFLO/URPX publication command sequence has stopped moving.
- [ ] Keep remote current-byte resolution from [[wa.task.2026.2026-05-20_2152-workingAccessUrl]] behind explicit operational policy, bounded fetch behavior, digest verification, and clear locator precedence.
- [ ] Decide whether Weave still needs a user-facing fingerprint verification command from [[wa.task.2026.2026-05-04-fingerprint-verification]]. The digest substrate now exists through artifact-resolution vocabulary; the missing piece is the operator-facing verify surface.
- [ ] Decide whether operation-scoped parsed RDF read models should graduate into an Oxigraph-backed graph store. Use [[wa.task.2026.2026-05-27_1314-oxigraph]] only after a concrete config/source/inventory query workload proves the value; do not start by introducing Oxigraph as a general cache.
- [ ] Feed release notes as supplemental references into corresponding historical states once non-RDF reference support exists.
- [ ] If `_mesh/_meta/meta.ttl` grows beyond the current carried shape, tighten `src/runtime/mesh/metadata.ts` to require `sflo:meshBase` on the expected mesh subject such as `<_mesh>` rather than accepting that triple from any subject in the document.
- [ ] Decide whether Weave should keep Turtle as the canonical on-disk RDF support-artifact format while later allowing multi-serialization RDF ingest/export at operation boundaries.
- [ ] Add an optional `WEAVE_TEST_TMP_ROOT` override for `createTestTmpDir()` only if stable grouping of preserved test temp workspaces becomes useful again. The current helper already defaults to platform temp space outside the repository.

## Human Decision Before Task-Note Edits

- [ ] [[wa.task.2026.2026-05-24_2304-honor-mesh-config]] appears broadly landed in code and user docs, including mesh config loading, history/presentation policy parsing, all-panels/no-panels defaults, command override precedence, and CLI documentation. Do not bulk-check this note until Knop config inheritance settles; then either mark the landed checklist items or replace the note with a short residual follow-up.
- [ ] [[wa.task.2026.2026-05-22_1128-referencelink-clarification]] also appears partly or mostly landed: `ReferenceSource` and `hasReferenceSource` exist in ontology/code/tests, but the note spans SFLO, framework specs, fixture regeneration, and terminology cleanup. It needs a cross-repo audit before checkbox edits.
- [ ] [[wa.task.2026.2026-04-08_1545-resource-page-definition-and-sources]] is now a legacy umbrella note. The first-pass `_knop/_page` behavior landed, while remaining work belongs to source-mode/fallback/import-boundary tasks. Decide whether to split/close the note or keep it as a historical ledger.
- [ ] [[wa.task.2026.2026-04-13_1715-page-renderer-refresh-and-html-regeneration]], [[wa.task.2026.2026-05-24_2353-autolinking]], and [[wa.task.2026.2026-05-25-markdown-it]] overlap. Choose one renderer/autolink direction before editing individual task notes.
- [ ] [[wa.task.2026.2026-05-04-fingerprint-verification]] should either be rewritten around the current digest vocabulary and a user-facing verify command, or marked superseded by artifact-resolution digest verification.
- [ ] [[wa.task.2026.2026-05-27_1314-oxigraph]] is an architectural sketch, not an implementation task. Convert it into a concrete spike with entry/exit criteria or leave it parked.
- [ ] [[wa.task.2026.2026-04-14_0018-configurable-test-tmp]] is mostly superseded by the current platform-temp helper and Codecov output directory work. Only edit the note if we decide the optional `WEAVE_TEST_TMP_ROOT` override is worth implementing.

## Task Note Audit Index

### Active

- [[wa.task.2026.2026-07-03_1332-stagecraft-weave-planner-generalization]]: active Stagecraft-triggered epic for replacing settled second-payload and adjacent fixture-shaped weave planner gates with fact-driven progression and condition-specific diagnostics.
- [[wa.task.2026.2026-05-04-refactor-planFirstPayloadWeave]]: active; docs still warn about the "settled first-payload-weave mesh inventory shape" failure, so the multi-pending first-payload and current-mode extracted-term fixes remain real.
- [[wa.task.2026.2026-05-17-append-onlyish-inventory]]: active; important correctness cleanup for reruns and release workflows.
- [[wa.task.2026.2026-05-05-optional-history-and-slim-support-artifacts-by-default]]: partially superseded by config synthesis, but the current-only `ResourcePageDefinition` and history-policy runtime behavior remain active.
- [[wa.task.2026.2026-05-19_2349-branch-based-workingfile-fix]]: mostly implemented, with validation/docs/SFLO replay residue.
- [[wa.task.2026.2026-05-26_1321-relative-links]]: active but underspecified; needs expansion before implementation.
- [[wa.task.2026.2026-05-16_1625-manifest-completeness-check]]: active fixture-infrastructure work; scenario indexes exist, but manifest completeness checking remains.
- [[wa.task.2026.2026-05-19_1536-latest-state-conformance]]: active conformance fixture backlog.
- [[wa.task.2026.2026-05-23-2157-resourcepage-followup]]: active product/fixture follow-up after the shared ResourcePage pipeline.
- [[wa.task.2026.2026-05-26_2237-testing-optimization]]: active; Codecov work landed, timing/caching/tiny-fixture work remains.
- [[wa.task.2026.2026-05-17-weave-performance-optimization]]: active but narrowed; read/candidate caching landed, parsed RDF reuse and validation progress remain.
- [[wa.task.2026.2026-05-28-0030-rdf-and-turtle-cleanup]]: active; first slice should reduce Turtle snippet/context coupling around inventory append planning without introducing Oxigraph or broad generated-TTL churn.
- [[wa.task.2026.2026-05-23_0040-further-refactoring]]: active maintenance backlog; still justified by current file sizes.
- [[wa.task.2026.2026-05-24_1648-ArtifactResolutionTarget-subclass-cleanup]]: active cleanup ledger after Knop config inheritance and import/source-registry work.

### Needs Revision Or Human Decision

- [[wa.task.2026.2026-04-08_1545-resource-page-definition-and-sources]]: needs revision; first-pass page definition behavior appears landed, with source-mode/fallback/import-boundary leftovers better tracked under artifact-resolution work.
- [[wa.task.2026.2026-04-11_1723-operational-config-for-runtime-resolution]]: mostly completed; only docs and remote-policy follow-through remain.
- [[wa.task.2026.2026-04-13_0910-weave-shape-generalization-for-later-carried-states]]: still useful as technical-debt context, but should stay pull-driven by concrete fixture failures.
- [[wa.task.2026.2026-04-13_1715-page-renderer-refresh-and-html-regeneration]]: partially completed by current Markdown rendering and ResourcePage pipeline work; needs reconciliation with Markdown-it and autolinking tasks.
- [[wa.task.2026.2026-04-14_0018-configurable-test-tmp]]: mostly superseded; platform temp and cleanup exist, optional env override remains parked.
- [[wa.task.2026.2026-05-04-fingerprint-verification]]: needs rewrite or supersession decision.
- [[wa.task.2026.2026-05-04-split-extraction-from-page-selection]]: still directionally active but too broad; should be revised after ReferenceLink and page-selection vocabulary settles.
- [[wa.task.2026.2026-05-06-grand-config-synthesis]]: umbrella mostly executed; residual items are default-segment hints, historical ResourcePage regeneration policy, path/URL trust alignment, tests, and docs.
- [[wa.task.2026.2026-05-22_1128-referencelink-clarification]]: needs cross-repo audit before note edits.
- [[wa.task.2026.2026-05-24_2304-honor-mesh-config]]: needs task-note cleanup after Knop config inheritance work.
- [[wa.task.2026.2026-05-24_2353-autolinking]]: needs a real implementation plan.
- [[wa.task.2026.2026-05-25-markdown-it]]: needs a keep-small-renderer versus adopt-library decision.
- [[wa.task.2026.2026-05-27_1314-oxigraph]]: needs conversion into a concrete spike or parking-lot item.

### Parked Future Work

- [[wa.task.2026.2026-05-14_1105-guarded-branch-published-rebuild]]: still valid, but not current.
- [[wa.task.2026.2026-05-16-deploy-profile]]: still valid after manual publication dogfood stabilizes.
- [[wa.task.2026.2026-05-18_1846-integrate-manifest]]: still valid, but after one-target integrate/source-binding behavior is settled.
- [[wa.task.2026.2026-05-20_2152-workingAccessUrl]]: valid future remote-resolution work, gated by operational policy and digest checks.

### Appears Completed Or Deferred

- [[wa.completed.2026.2026-05-24_1748-shared-artifact-resolution-runtime-service]]: completed first resolver slice; broader consumer migration remains tracked by [[wa.task.2026.2026-05-24_1648-ArtifactResolutionTarget-subclass-cleanup]] and the current Knop config task.
- [[wa.completed.2026.2026-05-27_1246-config-source-discovery-and-resolution]]: completed mesh-local config-source discovery and resolution; Knop-local and inherited config moved to [[wa.task.2026.2026-05-27_1914-knop-config-source-discovery-and-inheritance]].
- [[wa.task.2026.2026-05-27_1914-knop-config-source-discovery-and-inheritance]]: core Knop-local and inherited config-source runtime slice is implemented; remaining work is tracked as smaller follow-ups for inline config, multi-target/per-target effective config, and docs.
- [[wa.task.2026.2026-05-22_2253-resourcepage-config-and-templating]]: appears completed except for future low-impact panel presentation modes.
- [[wa.task.2026.2026-05-22_2308-fixture-helper-generalization]]: completed.
- [[wa.task.2026.2026-05-23_2230-custom-resourcepage-shared-shell-fixture]]: completed, with Carol-specific work deferred to [[wa.completed.2026.2026-05-25_0849-carol]].
- [[wa.completed.2026.2026-05-25_0849-carol]]: completed; the fixture branches `a.26-carol` and `a.27-carol-woven` exist and the note checklist was corrected during this grooming pass.
- [[wa.completed.2026.2026-05-27_1347-drop-MeshInheritableConfig]]: completed.
