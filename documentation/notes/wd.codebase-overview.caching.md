---
id: aiskxopvdnx3bk4u6hv6hii
title: Caching
desc: ''
updated: 1779333043793
created: 1779333043793
---

## Purpose

Weave caching is currently a command-scoped runtime optimization for expensive local mesh operations. It exists to avoid rereading and rebuilding the same planning inputs many times during recursive `validate`, `version`, `generate`, and `weave` flows, especially large publication meshes such as SFLO's generated `gh-pages` mesh.

The current work is tracked in [[wa.task.2026.2026-05-17-weave-performance-optimization]]. That task also records the motivating measurements: SFLO `validate mesh` dropped from roughly 13.8s to roughly 3.7s after command-scoped read and candidate caching, with repeated candidate loading no longer dominating the run.

## Scope

The cache is intentionally in-memory and per command invocation. It is not persisted, shared between CLI runs, or treated as a workspace index. Every command starts with a fresh cache, which keeps the model simple and avoids stale-data problems across editor changes, branch switches, generated output cleanup, or external file writes.

Because each invocation is a fresh slate, “invalidation” only means intra-command overlay behavior. If a command stages planned output during recursive planning, later reads in the same command must see those staged bytes instead of stale bytes loaded from disk earlier in the run.

## Current Runtime Shape

The current implementation lives in `src/runtime/weave/weave.ts` around `TextFileOverlay` and recursive version preparation.

`TextFileOverlay` has two responsibilities:

- it acts as the planned-output overlay used by recursive planning, so later candidates can read files staged by earlier candidates before those files are written to disk
- it owns the command-scoped caches used by the runtime weave planner

The read cache is path-keyed by absolute local file path. Reads check staged content first, then the command read cache, then disk. This preserves overlay semantics while avoiding repeated filesystem reads for stable inputs.

The candidate cache is keyed by designator path. Candidate loading is wrapped in a small dependency-capture window: every file read while resolving a candidate is recorded as a dependency of that candidate cache entry. When planned files are staged into the overlay, candidate cache entries whose recorded dependencies intersect those staged file paths are invalidated.

That dependency-aware invalidation is why the planner can reuse candidate discovery aggressively without flattening the recursive semantics. A later candidate can still observe inventory, metadata, source registry, or support-artifact changes staged by an earlier candidate.

## Timing Hooks

Timing instrumentation is controlled by `WEAVE_TIMING=1`. It writes aggregate phase timings to stderr without changing the normal command output shape.

The weave runtime currently reports cache-related counters in command timing details:

- `cachedReadFiles`
- `readCacheHits`
- `stagedReadHits`
- `candidateCacheHits`
- `candidateCacheStores`
- `candidateCacheInvalidations`

Recorded profiling runs belong in `dependencies/github.com/semantic-flow/weave-dev-archive/timings/weave-performance.csv`. The CSV is deliberately outside the user-facing docs because it is profiling evidence, not stable product behavior.

## Non-Goals

This is not a persistent parse cache, daemon cache, repository index, or file watcher. It also does not currently cache parsed RDF graphs as reusable semantic objects across planning calls. The current cache reduces repeated file reads and repeated candidate reconstruction, then lets the timing output show the next real bottleneck.

Do not add cross-invocation persistence without a new design. Persistent caching would need explicit keys for command profile, mesh root, source bindings, repository state, generated-output policy, and ontology/config versions. That is a different problem from the current command-local optimization.

## Next Likely Work

The latest SFLO timings show recursive planning itself as the largest remaining phase after read and candidate caching. The next useful pass is probably parsed RDF reuse or planner-level reuse within the same command-scoped context.

That follow-up should preserve the same constraints:

- command-scoped only
- overlay-aware reads first
- dependency-aware invalidation for staged files
- no weakening of recursive planning semantics
- no timing gate based on wall-clock assertions in normal tests
