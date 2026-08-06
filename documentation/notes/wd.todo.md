---
id: 5d7q7j0ra3tybq1dn6e1zha
title: Todo
desc: ''
updated: 1779947902489
created: 1774046031081
---


## Backlog

Groomed on 2026-05-27 from all `wa.task.*` notes in the Weave archive. Updated after per-target effective config and `ResourcePageSource` exact/fallback resolution landed. Lightly refreshed on 2026-06-30 after the paper sprint was parked and Stagecraft became an active downstream consumer for persisted roleplaying data. **Regroomed 2026-08-02** against a full codex staleness sweep of all 41 open `wa.task.*` notes verified against `main`: seven closed to `wa.completed.*`, four cancelled to `wa.cancelled.*`, and every line below where the note, this file, and the code disagreed about what shipped has been reconciled.

### Current Work And Next Pick

- [x] Finish in-progress [[wa.completed.2026.2026-05-27_2215-resourcepage-source-resolution-semantics]]: exact `targetHistoricalState`, one-level fallback, no fallback for malformed/unsafe/unsupported specs, and focused resolver/page-definition tests.
- [x] Finish the current-only `ResourcePageDefinition` slice from [[wa.task.2026.2026-05-05-optional-history-and-slim-support-artifacts-by-default]]: `_knop/_page` can remain unversioned, custom page generation reads `_knop/_page/page.ttl` when `_history001` is absent, and omitted page-definition histories are not linked.
- [d] Park the June 2026 paper sprint as concept scratch, not current delivery work. The FOMI/FOIS drafts remain useful for terminology and future documentation, but engineering should not chase paper-specific implementation. Both venue notes are CANCELLED 2026-08-02 as expired targets — [[wa.cancelled.2026.2026-05-29-0954-fois-demonstration-paper]] (June deadlines missed) and [[wa.cancelled.2026.2026-06-30_1159-kgswc-2026-paper-target]] (2026-07-10 target passed with no submission). This cancels the *targets*, not the ambition: mint a fresh note when a venue is actually chosen.
- [x] Use [[wa.task.2026.2026-06-30_1108-stagecraft-driven-semantic-flow-requirements]] to collect concrete Stagecraft persistence requirements before reshaping Weave or SFLO vocabulary around imagined roleplaying-data needs. DONE 2026-08-01: eleven evidence-backed requirements with citations and an ownership map folded into the note; the still-unevidenced list guards against vocabulary/topology promotion. The note stays open only for the evidence-gated mesh-topology decision.
- [ ] Use [[wa.task.2026.2026-07-03_1332-stagecraft-weave-planner-generalization]] as the concrete Stagecraft-driven Weave blocker epic: reproduce the settled second-payload weave failure, generalize the planner from RDF facts, and replace fixture-shaped diagnostics.
- [d] Fix later binary payload advancement: cut as [[wa.task.2026.2026-08-01_1411-binary-payload-advancement]] and PARKED 2026-08-01 — no consumer ever asked for binary payloads (audit: neither feedback round mentions them; the "press includes non-text artifacts" line was a Stagecraft PM-seat open issue whose consumption was deferred to their own lane). The underlying code defect is real and documented (later advancement decodes bytes; later renderers mistype binary payloads as `sflo:RdfDocument`), and v1 refuses binary at API admission, so live exposure is narrow — existing binary working payloads through file-backed CLI `version`. Revive on a real occurrence or when the Stagecraft press lane lands.
- [x] Add a real library distribution vehicle for the stable programmatic API from [[wd.programmatic-version-api]]: done as `@semantic-flow/weave-lib` (npm via dnt, downstream off-tree contract smoke) per [[wd.library-packaging]], shipping in `v0.5.1`; JSR export still deferred.
- [ ] Get extracted candidates onto the batch path from [[wa.task.2026.2026-08-02_1330-extracted-term-weave-batch-path]], carved 2026-08-02 from the now-closed defect pair. Shipped in `v0.7.0`: the ancestor-Knop assumption is gone (PR #31), faithful nested-source pending-heavy generation exists (PR #32), and untargeted first-payload batching landed (PR #33). Still open: extracted candidates classify as `firstExtractedKnopWeave` and never enter that batch path, so N=1,700 weave peaks at 3.79 GiB against a ~4.09 GiB ceiling. Remaining residuals — targeted/untargeted agreement, MeshInventory history indexes from actual progression rather than the fixed `_s0001`–`_s0004` list, and the durable ~1,700-term regression — ride with that note.
- [ ] Take [[wa.task.2026.2026-05-17-append-onlyish-inventory]] as the next larger inventory-correctness task now that the current history-policy slice is bounded, unless a sharply scoped Stagecraft blocker proves more urgent.
- [ ] Release `v0.7.0`: version bumped and notes written 2026-08-02 (PR #36, `deno task ci` green). Four user-facing changes since `v0.6.0` — PRs #31/#33/#34/#35 — and the first release able to generate the published SFLO mesh, which was built from `main` at `2f04b71`. Minor rather than patch because the untargeted batch dispatch makes a previously-refused invocation succeed. Remaining: merge, then the `Release Manual` workflow (rehearsal, then publish).
- [x] Run the planning loop from [[wa.completed.2026.2026-07-31_1014-planning-loop-infrastructure]]: the queue gate (`deno task queue`), [[wd.queues]], [[wd.read-in.jimbo]], and [[wa.dave-court]] merged to main (PR #30) with all decisions ruled; dry run completed 2026-08-01 (loop armed at 10m, wakes 1–2 surveyed/fired/groomed live) and the task closed with the rename — the loop is now the operating mode.

### P0: Current Config And Resolution Follow-Ups

- [x] Implement [[wa.completed.2026.2026-05-27-2031-per-target-effective-config-resolution]] before applying Knop-local/inherited config to recursive or multi-target version/generate/weave operations.
- [x] Finish [[wa.completed.2026.2026-05-27_2215-resourcepage-source-resolution-semantics]] as the first broader page-source resolver cleanup consumer from [[wa.completed.2026.2026-05-24_1748-shared-artifact-resolution-runtime-service]] and [[wa.cancelled.2026.2026-04-08_1545-resource-page-definition-and-sources]].
- [x] Implement the current-only `ResourcePageDefinition` support-artifact slice from [[wa.task.2026.2026-05-05-optional-history-and-slim-support-artifacts-by-default]] after ResourcePageSource exact/fallback semantics landed.
- [ ] Keep path and URL trust policy aligned with [[wa.completed.2026.2026-04-11_1723-operational-config-for-runtime-resolution]], [[wa.task.2026.2026-05-20_2152-workingAccessUrl]], and the config-source resolver. Do not let portable mesh config silently grant broader host trust.
- [x] Document config-source bootstrap authoring now that tests exercise it correctly: mesh-local config-source attachments belong in `_mesh/_meta/meta.ttl`, Knop-local and inheritable attachments belong in current Knop metadata, and the resolved `_config/*.ttl` files are config payloads rather than bootstrap authority.

### P1: Publication, History, And Runtime Correctness

- [ ] Keep Stagecraft's persisted roleplaying-data use case in view when prioritizing runtime work: prefer slices that improve stable identifiers, exact state citation, append-onlyish histories, source provenance, and generated inspection pages for ordinary application data.
- [x] Land the single-target Stagecraft-triggered later-payload planner slice from [[wa.task.2026.2026-07-03_1332-stagecraft-weave-planner-generalization]]: full `weave` can advance a coherent later payload history instead of rejecting non-fixture-shaped states with "settled second payload weave shape" errors.
- [x] Follow up on [[wa.task.2026.2026-07-03_1332-stagecraft-weave-planner-generalization]] with multi-target later-payload advancement.
- [ ] Remove the remaining first-payload planner blockers from [[wa.task.2026.2026-05-04-refactor-planFirstPayloadWeave]]. **Multi-pending first-payload weave in one transaction SHIPPED in `v0.7.0`** (`d6f87ca`, PR #33) — untargeted all-`firstPayloadWeave` sets now batch, advancing the MeshInventory once. Still open: current-mode extracted-term weave, and replacing fixture-shaped errors with condition-specific diagnostics. The SFLO and URPX docs still warn about the old failure mode and need a pass.
- [ ] Implement append-onlyish inventory writes from [[wa.task.2026.2026-05-17-append-onlyish-inventory]]: normal inventory operations append new settled facts, no-op existing facts, and fail closed on conflicts; current/latest/next progression belongs in metadata or explicit repair/regeneration/retraction modes. **Partly shipped in `v0.7.0`** — `planInventoryAppend` exists with no-op/append/conflict/byte-preservation semantics, and the current-only ReferenceCatalog renderer is the first production consumer migrated onto it (`3573bf9`, PR #34). Remaining: migrate the other inventory writers and stop page-fact deletion. Nit boarded there: the append path emits a trailing blank line where the old renderer emitted a single newline.
- [d] Finish broader slim/current-only support-artifact behavior from [[wa.task.2026.2026-05-05-optional-history-and-slim-support-artifacts-by-default]]: the current-only `ResourcePageDefinition` slice has landed; remaining inventory/meta split and durable history-toggle coherence stay with [[wa.task.2026.2026-05-17-append-onlyish-inventory]] and follow-up history-policy work.
- [ ] Keep the durable history-toggle path coherent across config, CLI overrides, and weave/version/generate behavior. A changed working file should be able to update current/latest state without always writing a new history state when the effective history policy says current-only or slim.
- [x] Finish branch-published working-source portability from [[wa.completed.2026.2026-05-19_2349-branch-based-workingfile-fix]]. DONE 2026-08-02 (closed by the staleness sweep): all-file leakage inspection ships in `src/runtime/publication/presets.ts`, multi-finding validation is covered in the integration suite, the runtime docs describe the workflow, and the 2026-08-01 SFLO `gh-pages` replay reported zero publication issues with no host-local or sibling-worktree path leakage.
- [ ] Define and implement publication-base-relative link policy from [[wa.task.2026.2026-05-26_1321-relative-links]] for generated ResourcePages and rendered Markdown links. This should become a real task note before code work; the current note is only a prompt.
- [ ] Add user-visible `generate`/`validate` findings for ResourcePage publication anomalies, especially current RDF artifact pages that have ResourcePage generation enabled but no latest HistoricalState to render from.
- [ ] Add a publication option to suppress working-file locator metadata on ResourcePages while still deriving semantic panels from settled historical states.

### P2: Fixtures, Renderer, And Developer Experience

- [ ] Integrate Accord v0.1.0 capabilities into the fixture-ladder workflow: pin the CI accord checkout to the `v0.1.0` tag, run `accord validate` over the live Semantic Flow manifests as a fast CI authoring gate before slow ladder checks, convert the mesh-alice-bio smoke / full-corpus rerun to a scenario index driven by `accord check-scenario` for per-rung evidence, use `accord draft-manifest` as the starting point when ladder rungs change intentionally, and consider JSON assertions for generated-page contract checks. The accord-side features are complete (see `ac.completed.2026.2026-07-04-*` notes in the accord repo); this item is Weave-side adoption only.
- [x] Publish Weave's programmatic surface as a consumable library per [[wd.library-packaging]]: shipping in `v0.5.1` as the npm package `@semantic-flow/weave-lib` (dnt build, resource-loading audit + embedded defaults, fs-purity guard, off-tree Node contract smoke, release-runbook/CI wiring; the planned `v0.5.0` was folded into `v0.5.1`, and the lib-only `weave-lib@0.5.0` artifact gets deprecated as the final release step — see [[wd.consumer-feedback.0.5.1]] Open Issues). JSR export remains deferred until the npm path is proven with a downstream consumer.
- [x] Ship programmatic `validateMesh` v1: RELEASED in `v0.6.0` (2026-07-31, tag at `57b6b0d`) per the ratified contract [[wd.programmatic-validate-api]], together with the whole-mesh validate bounded-memory fix (srd-scale OOM → ~554 MiB; receipts in archive notes `wa.completed.2026.2026-07-29_1219-*` and `-1220-*`). Origin: the adoption-deciding ask from the 2026-07-28 Stagecraft review ([[wd.consumer-feedback.0.5.1]] §8), re-raised 2026-07-29. Residuals boarded on the archive notes: publication-scope for the API (additive), multi-finding collection, parse-churn/incremental-inventory work (with the extract/weave scale item above), versioned-policy snapshot arm, checkout-identification seam sketch.
- [ ] Friendlier auto-version error for named-head payload histories (Stagecraft courtesy request). When `resolveLaterPayloadVersionLayout` in [[src/core/weave/payload_version_layout.ts]] refuses because the current head is a named (non-`_sNNNN`) state, and that head name ends in an integer, suggest the incremented name as a concrete `stateSegment=` value (current `s0002` → suggest `stateSegment=s0003`) alongside the existing `_s0001` ordinal fallback, so a named `sNNNN` history is offered continuation in its own scheme rather than only an ordinal reset. Fall back to the current generic message when no numeric suffix is inferable. Pairs with the `mesh create` self-explanatory-error work as a small diagnostics-quality slice.
- [ ] Add the manifest completeness check from [[wa.task.2026.2026-05-16_1625-manifest-completeness-check]] so fixture branch diffs cannot drift beyond Accord manifest expectations or deliberate `ignorePaths`.
- [ ] Add the latest-state conformance fixture from [[wa.task.2026.2026-05-19_1536-latest-state-conformance]] once Accord can express the needed rendered-text assertions.
- [ ] Revisit custom ResourcePage follow-up work in [[wa.task.2026.2026-05-23-2157-resourcepage-followup]] after Knop config inheritance settles: the next useful slice is probably a narrow custom page fixture that keeps the shared Semantic Site presentation while opting into authored Markdown plus selected generated panels.
- [ ] Continue test/performance work from [[wa.task.2026.2026-05-26_2237-testing-optimization]] and [[wa.task.2026.2026-05-17-weave-performance-optimization]]: add `WEAVE_TEST_TIMING=1`, record baselines, cache fixture reads by resolved commit, add tiny-mesh builders for tests that do not need the real fixture ladders, and add validation progress output behind a quiet/default/verbose policy.
- [ ] Implement the first RDF parse/render boundary slice from [[wa.task.2026.2026-05-28-0030-rdf-and-turtle-cleanup]]: add shared Weave Turtle context/fact helpers, let `inventory_append_planner` accept requested facts/quads instead of parser-dependent Turtle snippets, and keep compact SFLO/config rendering separate from byte-preserved carried blocks.
- [ ] Split the largest files under [[wa.task.2026.2026-05-23_0040-further-refactoring]] in behavior-preserving slices: `src/runtime/weave/pages.ts`, `scripts/fixture-ladder.ts`, `src/core/weave/weave_test.ts`, `tests/integration/weave_test.ts`, and `tests/scripts/fixture_ladder_test.ts` are still large enough to slow future work.
- [ ] Decide renderer strategy before broadening Markdown behavior: either keep the current small renderer and close [[wa.cancelled.2026.2026-05-25-markdown-it]] as superseded, or switch deliberately to a Deno-friendly Markdown library. Tie this to [[wa.task.2026.2026-04-13_1715-page-renderer-refresh-and-html-regeneration]] and [[wa.task.2026.2026-05-24_2353-autolinking]] rather than making another ad hoc parser pass.
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
- [x] [[wa.cancelled.2026.2026-04-08_1545-resource-page-definition-and-sources]] was a legacy umbrella note. RESOLVED 2026-08-02: cancelled rather than split — the first-pass `_knop/_page` behavior landed, presentation moved to the resourcepage-config note, and remote current-byte work stays under `workingAccessUrl`.
- [ ] [[wa.task.2026.2026-04-13_1715-page-renderer-refresh-and-html-regeneration]], [[wa.task.2026.2026-05-24_2353-autolinking]], and [[wa.cancelled.2026.2026-05-25-markdown-it]] overlap. Choose one renderer/autolink direction before editing individual task notes.
- [ ] [[wa.task.2026.2026-05-04-fingerprint-verification]] should either be rewritten around the current digest vocabulary and a user-facing verify command, or marked superseded by artifact-resolution digest verification.
- [ ] [[wa.task.2026.2026-05-27_1314-oxigraph]] is an architectural sketch, not an implementation task. Convert it into a concrete spike with entry/exit criteria or leave it parked.
- [x] [[wa.cancelled.2026.2026-04-14_0018-configurable-test-tmp]] is superseded by the current platform-temp helper and Codecov output directory work. CANCELLED 2026-08-02. The optional `WEAVE_TEST_TMP_ROOT` override remains parked as its own P3 line.

## Task Note Audit Index

### Active

- [[wa.task.2026.2026-07-03_1332-stagecraft-weave-planner-generalization]]: active Stagecraft-triggered epic for replacing settled second-payload and adjacent fixture-shaped weave planner gates with fact-driven progression and condition-specific diagnostics.
- [[wa.task.2026.2026-05-04-refactor-planFirstPayloadWeave]]: active but narrowed; multi-pending first-payload weave shipped in `v0.7.0`, leaving current-mode extracted-term weave and condition-specific diagnostics. Docs still warn about the old failure mode.
- [[wa.task.2026.2026-05-17-append-onlyish-inventory]]: active but narrowed; the append planner exists and has its first production consumer as of `v0.7.0`. Remaining work is migrating the other writers.
- [[wa.task.2026.2026-05-05-optional-history-and-slim-support-artifacts-by-default]]: partially superseded by config synthesis, but the current-only `ResourcePageDefinition` and history-policy runtime behavior remain active.
- [[wa.completed.2026.2026-05-19_2349-branch-based-workingfile-fix]]: CLOSED 2026-08-02; validation, docs, and the SFLO replay all landed.
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

- [[wa.cancelled.2026.2026-04-08_1545-resource-page-definition-and-sources]]: CANCELLED 2026-08-02 as a split umbrella; first-pass behavior landed elsewhere and the leftovers are tracked under artifact-resolution work.
- [[wa.completed.2026.2026-04-11_1723-operational-config-for-runtime-resolution]]: CLOSED 2026-08-02; the seam is documented in wd.codebase-overview. Remote-policy follow-through lives in the workingAccessUrl note.
- [[wa.task.2026.2026-04-13_0910-weave-shape-generalization-for-later-carried-states]]: still useful as technical-debt context, but should stay pull-driven by concrete fixture failures.
- [[wa.task.2026.2026-04-13_1715-page-renderer-refresh-and-html-regeneration]]: partially completed by current Markdown rendering and ResourcePage pipeline work; needs reconciliation with Markdown-it and autolinking tasks.
- [[wa.cancelled.2026.2026-04-14_0018-configurable-test-tmp]]: CANCELLED 2026-08-02; a different design landed (platform temp dirs, no `WEAVE_TEST_TMP_ROOT`). The optional override stays parked in P3.
- [[wa.task.2026.2026-05-04-fingerprint-verification]]: needs rewrite or supersession decision.
- [[wa.task.2026.2026-05-04-split-extraction-from-page-selection]]: still directionally active but too broad; should be revised after ReferenceLink and page-selection vocabulary settles.
- [[wa.task.2026.2026-05-06-grand-config-synthesis]]: umbrella mostly executed; residual items are default-segment hints, historical ResourcePage regeneration policy, path/URL trust alignment, tests, and docs.
- [[wa.task.2026.2026-05-22_1128-referencelink-clarification]]: needs cross-repo audit before note edits.
- [[wa.task.2026.2026-05-24_2304-honor-mesh-config]]: needs task-note cleanup after Knop config inheritance work.
- [[wa.task.2026.2026-05-24_2353-autolinking]]: needs a real implementation plan.
- [[wa.cancelled.2026.2026-05-25-markdown-it]]: needs a keep-small-renderer versus adopt-library decision.
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
- [[wa.completed.2026.2026-05-22_2253-resourcepage-config-and-templating]]: appears completed except for future low-impact panel presentation modes.
- [[wa.completed.2026.2026-05-22_2308-fixture-helper-generalization]]: completed.
- [[wa.completed.2026.2026-05-23_2230-custom-resourcepage-shared-shell-fixture]]: completed, with Carol-specific work deferred to [[wa.completed.2026.2026-05-25_0849-carol]].
- [[wa.completed.2026.2026-05-25_0849-carol]]: completed; the fixture branches `a.26-carol` and `a.27-carol-woven` exist and the note checklist was corrected during this grooming pass.
- [[wa.completed.2026.2026-05-27_1347-drop-MeshInheritableConfig]]: completed.
