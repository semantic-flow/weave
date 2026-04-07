---
id: 5up1yk17ii78mlwt5nxqpeo
title: 2026 04 07_0020 History and State Naming
desc: ''
updated: 1775546848688
created: 1775546440859
---

## Goals

- Allow callers to choose the path segment used for the first explicit payload `ArtifactHistory`, for example `releases` instead of `_history001`.
- Allow callers to choose the path segment used for each newly created payload `HistoricalState`, for example `v0.0.1` instead of `_s0001`.
- Keep the current default behavior unchanged whenever no custom names are supplied.
- Keep ordinals as the machine ordering model even when custom path names are used.
- Preserve pseudo-immutability: once a history or state path exists, Weave should never rename it.

## Summary

This task should define a narrow first naming slice for payload histories and payload states before Markdown payload publishing broadens the public artifact surface.

The intended first boundary is:

- payload artifacts only
- first explicit payload history may receive a caller-chosen history segment when it is first created
- every new payload state may receive a caller-chosen state segment on the weave operation that creates it
- no renaming of existing paths
- no custom naming for mesh inventory, Knop metadata, Knop inventory, ReferenceCatalog, or extracted support-artifact histories/states in this first slice

The motivating ontology publishing example is a payload history/state path such as `ontology/releases/v0.0.1/ontology-ttl/ontology.ttl` rather than the current default `_history001/_s0001/...` pattern.

## Discussion

Right now Weave hardcodes default path conventions such as `_history001` and `_s0001` across `core/weave`, `integrate`, `payload.update`, `extract`, and tests.

That is acceptable as a system default, but it is too rigid for publication scenarios where the path itself matters, especially ontology publication where a released artifact should often live at a stable human-meaningful path such as:

- `ontology/releases/v0.0.1/ontology-ttl/ontology.ttl`

The key distinction for this task is between:

- default generated names
- caller-supplied names for newly created payload history/state resources

This task should not collapse those together. Default numeric allocation still matters and should remain the fallback behavior when the caller does not supply custom names.

The task also should not treat path names as the only ordering mechanism. Even if a caller picks `releases` and `v0.0.1`, the RDF graph should still carry:

- `historyOrdinal`
- `stateOrdinal`
- `nextHistoryOrdinal`
- `nextStateOrdinal`

Those ordinals remain the machine ordering model and the basis for future default allocation. Custom path names are a naming override, not a replacement for artifact lineage metadata.

## Open Issues

- Should the first core contract introduce target-scoped request objects immediately, or should it keep `designatorPaths` plus a parallel naming map for backward compatibility during the transition?

## Decisions

- Limit the first slice to payload artifact histories and payload states.
- Custom history naming applies only when the first explicit payload history is created.
- Custom state naming may be supplied on every weave operation that creates a new payload state.
- If no custom names are supplied, behavior stays exactly as it is now.
- Ordinals remain in RDF even when custom path names are used.
- History and state path names must never be renamed after creation.
- Re-using an existing history segment or state segment is an error.
- Conservative path grammar is sufficient for the first slice: a single path segment using ASCII `[A-Za-z0-9._-]+`.
- Inconsistent custom state naming across later weave operations is acceptable as long as each name is unique within the artifact history.
- This task is about the core semantics first; user-facing CLI surface can follow after the core contract is settled.
- In the first slice, a custom history segment is supplied only on the weave operation that first materializes that payload history; no separate persistent preference record is needed.
- The contract should allow custom naming across multiple payload targets in one weave operation, for example when `ontology` and `shacl` are both published under the same release/state naming convention.

## Contract Changes

- `core/weave` will need target-scoped optional inputs for payload history/state naming.
- The likely steady-state shape is a list of target specifications such as:
  - `designatorPath`
  - optional `historySegment`
  - optional `stateSegment`
- If backward compatibility matters during the first implementation, `designatorPaths` may temporarily remain as a shorthand for unnamed/default targets, but the naming-aware path should be target-scoped rather than scalar.
- The first payload weave slice should be able to accept both:
  - an optional history segment for the first explicit payload history
  - an optional state segment for the newly created payload `HistoricalState`
- Later payload weave slices should be able to accept:
  - an optional state segment for each newly created payload `HistoricalState`
- If a history already exists and the caller supplies a history segment, the operation should fail closed rather than silently ignore or reinterpret it.
- If a requested history segment or state segment is already in use, the operation should fail closed before planning file writes.
- Custom naming only changes path segments for the `ArtifactHistory` and `HistoricalState` resources plus their descendant manifestation/resource-page paths; it does not remove or redefine ordinal predicates.

## Testing

- Keep all current tests green when no custom names are supplied.
- Add core planner coverage proving the first payload weave can create a custom history segment plus a custom first state segment.
- Add core planner coverage proving a later payload weave can create a custom state segment under an existing history.
- Add coverage proving multiple payload targets in one weave request can each carry their own custom history/state naming, including the case where different targets intentionally share the same segment names such as `releases` and `v0.0.1`.
- Add coverage proving re-use of an existing history segment fails.
- Add coverage proving re-use of an existing state segment fails.
- Add coverage proving inconsistent but unique later state naming is accepted.
- Add integration coverage for an ontology-like example path such as `ontology/releases/v0.0.1/ontology-ttl/ontology.ttl`.
- Add coverage proving support artifacts still keep their current generated `_history001` / `_s0001` naming in this first slice.

## Non-Goals

- Renaming existing histories or states.
- Changing mesh inventory, Knop metadata, Knop inventory, or ReferenceCatalog history/state naming in this first slice.
- Removing ordinal predicates or making path names the authoritative ordering model.
- Backfilling older carried fixtures to use custom names by default.
- Solving generic multi-history policy for every artifact type at once.

## Implementation Plan

- [ ] Refine `WeaveRequest` toward target-scoped request objects so naming can be supplied per payload target rather than as one scalar for the whole operation.
- [ ] Add shared validation helpers for custom history/state path segments and duplicate-name rejection.
- [ ] Thread optional payload history/state naming through the first payload weave slice (`06 -> 07`) while preserving the existing default behavior.
- [ ] Thread optional payload state naming through the second payload weave slice (`10 -> 11`) while preserving the existing default behavior.
- [ ] Update page/manifestation path rendering so descendant paths follow the chosen history/state segments.
- [ ] Add core and integration coverage for the default path, custom first-history path, custom later-state path, multi-target named weave, and duplicate-name rejection cases.
