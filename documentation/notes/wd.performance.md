---
id: 3ejxqiohsnmab98vcha41cg
title: Performance
desc: ''
updated: 1779383744275
created: 1779383744275
---

## Purpose

This note is durable developer guidance for measuring Weave performance. Current timing work is tracked in [[wa.task.2026.2026-05-17-weave-performance-optimization]], and the command-scoped cache design is summarized in [[wd.codebase-overview.caching]].

Weave performance work should start from evidence gathered on real commands. Use timings to identify dominant phases before changing planner, validation, RDF parsing, or generated-output code.

## Timing Surface

Set `WEAVE_TIMING=1` to enable aggregate timing output on stderr for `weave`, `weave validate`, `weave version`, and `weave generate`. See [[wu.environment-variables#weave_timing]] for the user-facing environment-variable reference.

```sh
WEAVE_TIMING=1 deno task dev:root -- --mesh-root "$SFLO_PUB"
WEAVE_TIMING=1 deno task dev:root -- validate mesh --mesh-root "$SFLO_PUB"
WEAVE_TIMING=1 deno task dev:root -- generate --mesh-root "$SFLO_PUB"
```

Timing output is diagnostic only. It is not a stable telemetry API, and normal stdout summaries should stay usable without parsing timing lines.

## Recommended Workloads

Use a workload large enough to expose repeated planning, parsing, and generated-output costs. The current reference workload is the regenerated SFLO `gh-pages` publication mesh, especially `validate mesh` over the all-terms shape.

When comparing changes, keep the workload stable:

- use the same Weave commit label convention, including `+working` when the tree has uncommitted performance changes
- use the same source and publication mesh checkout
- rerun from a settled worktree when measuring read/planning costs, unless the change specifically concerns dirty generated output
- record candidate/path counts, created files, updated files, and generated page counts when the command reports them
- avoid mixing cold-cache, warm-cache, and edited-worktree observations in the same comparison without saying so in the notes column

## Recording Runs

Record comparable timing runs in `dependencies/github.com/semantic-flow/weave-dev-archive/timings/weave-performance.csv`. That archive is development evidence, not product documentation.

The CSV currently tracks:

- when the run was recorded
- Weave commit or working commit label
- workload and command
- mesh-root label, not a host-local absolute path
- candidate/path counts and created/updated/generated outputs
- total time and important phase times
- notes for cache counters or unusual run conditions

Use broad labels such as `sflo-gh-pages-local` instead of machine-specific paths. Do not record secrets, host-local access details, or private source paths.

## Reading Timing Output

The timing lines are phase-oriented. Repeated phases are aggregated and include `count` and `avg`, which is usually more useful than chasing only total wall-clock time.

For large `validate mesh` and root `weave` runs, pay special attention to:

- mesh metadata/config load
- mesh inventory load/parse
- candidate discovery and recursive candidate loading
- per-candidate planning
- RDF validation
- writes and ResourcePage generation
- cache counters such as `readCacheHits`, `stagedReadHits`, `candidateCacheHits`, `candidateCacheStores`, and `candidateCacheInvalidations`

The first SFLO all-terms timing pass showed `validate mesh` at roughly 13.8s, dominated by repeated loop candidate loading. After command-scoped read caching and dependency-aware candidate caching, the same workload dropped to roughly 3.7s, and recursive planning became the largest remaining phase. Future performance work should continue from the current dominant phase rather than assuming filesystem reads are still the bottleneck.

## Development Rules

- Add timing instrumentation before optimizing a new area unless an existing timing run already identifies the bottleneck.
- Keep caches command-scoped and in-memory unless a new design explicitly handles repository state, source bindings, generated-output policy, ontology/config versions, and stale data.
- Preserve overlay semantics: later candidates in one command invocation must see planned output staged by earlier candidates.
- Do not add normal CI gates based on wall-clock timing. Prefer instrumentation-oriented tests such as proving unchanged files are not reread or reparsed repeatedly during a batch command.
- Keep large SFLO publication timing fixtures local-only unless we separately decide to add a checked-in generated fixture.
- Run timing commands with `--silent` only when the question is specifically about quiet automation behavior; otherwise keep normal progress output visible so hangs and phase boundaries are easier to diagnose.

## Useful Follow-Ups

Likely next timing-driven work:

- parsed RDF reuse inside the command-scoped planning context
- planner-level reuse for recursive `validate mesh` and root `weave`
- progress output for expensive validation phases, with detailed per-candidate chatter behind `--verbose`
- a small regression test that asserts repeated stable inputs are not reread/reparsed excessively, without asserting absolute wall-clock time
