---
id: wlo29fbckg2hkue5zu32lqs
title: Codebase Overview
desc: ''
updated: 1779635111101
created: 1773673181726
---

## Purpose

This note is a short map of the Weave repository. It should help a developer decide where to look before editing. It is not a changelog, task log, release note, or fixture history.

For development rules, start with [[wd.general-guidance]]. For testing posture, use [[wd.testing]]. For decisions, use [[wd.decision-log]]. For detailed historical context, use the task and completed-task notes in the weave-dev archive.

## Repository Shape

- `src/core`: semantic operation contracts and pure planning logic. Core code should avoid local filesystem, git, process, logging, and host-runtime assumptions.
- `src/runtime`: local workspace execution. Runtime code loads files, reads git/workspace state, resolves effective config, logs, stages writes, and calls core planners.
- `src/cli`: terminal UX. CLI code parses commands/options, normalizes user input, calls runtime, and formats output. It should not contain semantic planning logic.
- `src/daemon`: future HTTP/API process. Scaffold only for now.
- `src/web`: future browser client. Scaffold only for now.
- `scripts`: release, packaging, fixture, and maintenance scripts.
- `tests`: integration, e2e, script, support, and fixture-oriented tests. Unit tests usually live next to the source module they exercise.
- `dependencies/github.com/semantic-flow/sflo`: embedded Semantic Flow ontology dependency used by implementation and tests.
- `dependencies/github.com/semantic-flow/weave-dev-archive`: Kato/task archive. Keep durable developer docs in `documentation/notes/wd.*`; keep task history in the archive.

## Core Layer

Core owns portable Semantic Flow behavior: request/result types, RDF/Turtle helpers, target semantics, and operation planners.

- `src/core/targeting.ts` owns shared target selection semantics.
- `src/core/rdf` owns local RDF/Turtle parsing and namespace helpers.
- `src/core/mesh`, `src/core/knop`, `src/core/integrate`, `src/core/payload`, and `src/core/extract` own operation-specific pure planning.
- `src/core/weave` owns shared weave/version/generate contracts and planner helpers.
- `src/core/weave/weave.ts` is still the major pressure point. It remains the public façade for core weave imports, but it is being decomposed under [[wa.completed.2026.2026-05-21_0849_careful-extraction-refactor]].
- Already extracted core weave helpers include `errors.ts`, `version_plan.ts`, `mesh_support_pages.ts`, `requests.ts`, `source_models.ts`, `candidates.ts`, `planning_models.ts`, `progression_models.ts`, `progression_resolvers.ts`, `slices.ts`, `rdf_helpers.ts`, `turtle_blocks.ts`, `artifact_history_queries.ts`, `artifact_manifestation_paths.ts`, `slice_classification.ts`, `payload_version_layout.ts`, `payload_overwrite.ts`, `payload_renderers.ts`, `mesh_inventory_renderers.ts`, `knop_inventory_renderers.ts`, `legacy_page_renderers.ts`, `extraction_source_blocks.ts`, `knop_support_renderers.ts`, `shape_assertions.ts`, `source_locator_assertions.ts`, `source_locator_renderers.ts`, `support_history_renderers.ts`, `working_file_paths.ts`, `reference_catalog_links.ts`, `resource_page_builders.ts`, `resource_page_models.ts`, `resource_page_template_contract.ts`, `resource_page_history_groups.ts`, `resource_page_policy.ts`, `resource_page_reference_links.ts`, `naming_policy.ts`, and `support_history_policy.ts`.

## Runtime Layer

Runtime owns local execution against a workspace: filesystem reads/writes, git-aware source resolution, effective config loading, structured logging, progress reporting, and command-scoped staging.

- `src/runtime/config` loads and resolves effective runtime config from RDF.
- `src/runtime/artifact_resolution` resolves `sflo:ArtifactResolutionSpec`-shaped runtime requests into requested/observed coordinates plus optional bytes/text under local path policy.
- `src/runtime/logging` provides structured operational and audit logging.
- `src/runtime/operational/local_path_policy.ts` controls workspace-local path safety and allowed repo-adjacent access.
- `src/runtime/weave/weave.ts` is the public runtime façade for validate/version/generate/weave.
- `src/runtime/weave/prepared_execution.ts`, `candidate_loader.ts`, `planning_context.ts`, `artifact_loaders.ts`, `version_execution.ts`, and `request_normalization.ts` hold non-page-generation runtime weave execution pieces.
- `src/runtime/weave/page_generation.ts`, `page_model_assembly.ts`, `page_contexts.ts`, `raw_source_panels.ts`, and `pages.ts` hold ResourcePage generation, model assembly, context loading, raw-source panels, and HTML rendering.
- `WEAVE_TIMING=1` reports runtime phase timings; keep timing phase names stable during move-only refactors unless a task explicitly changes them.

## CLI, Daemon, Web

- `src/cli` currently exposes the useful application surface. Local commands call runtime directly.
- The daemon and web app are placeholders for the future API/browser product and should not accumulate semantic logic before those slices are active.

## Where To Change Things

- Target parsing or exact/recursive selection: `src/core/targeting.ts`, then runtime/CLI normalization call sites.
- Pure operation semantics or generated RDF shape: `src/core/**`.
- Local file discovery, write behavior, or workspace safety: `src/runtime/**`.
- Weave/version planning: start in `src/core/weave/weave.ts`, then move stable helpers out as part of the core weave decomposition task.
- Runtime weave execution: `src/runtime/weave/**`.
- Generated ResourcePage HTML: `src/runtime/weave/pages.ts`; supporting data comes from the page generation/context/model modules nearby.
- Effective config behavior: `src/runtime/config/**`, plus core policy types under `src/core/weave/**` when the policy is portable.
- CLI flags and output: `src/cli/**`.
- Release, packaging, or fixture automation: `scripts/**` and `tests/scripts/**`.

## Testing Map

- `deno task fmt`: format project files.
- `deno task lint`: lint scripts, source, and tests.
- `deno task check`: type-check scripts, source, and tests.
- `deno task test`: run the project test suite with the standard test harness.
- `deno task ci`: pre-merge confidence path.
- Use focused tests while iterating, then broaden according to the risk of the change. CLI-visible behavior needs e2e coverage; shared planner changes usually need core plus integration coverage.

## Current Refactor Notes

- Core weave planner decomposition: [[wa.completed.2026.2026-05-21_0849_careful-extraction-refactor]].
- Completed core weave model/type extraction slice: [[wa.completed.2026.2026-05-21_1037-core-weave-first-extraction-slice]].
- Completed core weave RDF/Turtle helper extraction slice: [[wa.completed.2026.2026-05-22_1358-core-weave-rdf-and-turtle-helper-extraction]].
- Completed core weave slice-classification extraction slice: [[wa.completed.2026.2026-05-22_1424-core-weave-slice-classification-extraction]].
- Completed core weave payload renderer extraction slice: [[wa.completed.2026.2026-05-22_2252-payload-render-helpers]].
- Completed core weave Knop support preservation extraction slice: [[wa.completed.2026.2026-05-22_2117-core-weave-knop-support-render-preservation-extraction]].
- Completed core weave mesh inventory renderer extraction slice: [[wa.completed.2026.2026-05-22_2139-core-weave-mesh-inventory-renderer-extraction]].
- Completed core weave KnopInventory renderer extraction slice: [[wa.completed.2026.2026-05-22_2206-core-weave-knop-inventory-renderer-extraction]].
- Completed core weave legacy HTML page renderer extraction slice: [[wa.completed.2026.2026-05-22_2222-core-weave-html-page-renderer-extraction]].
- Completed core weave source-registry ExtractionSource helper extraction slice: [[wa.completed.2026.2026-05-22_2239-source-registry-extraction-source-helper-extraction]].
- Latest core weave progression resolver extraction slice: [[wa.task.2026.2026-05-22_2248-core-weave-progression-resolver-extraction]].
- Runtime weave decomposition is complete: [[wa.completed.2026.2026-05-21_1035-runtime-weave-module-decomposition]].
- Runtime ResourcePage generation decomposition is complete: [[wa.completed.2026.2026-05-21_1036-runtime-resource-page-generation-decomposition]].
