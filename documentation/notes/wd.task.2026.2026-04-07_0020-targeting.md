---
id: 5up1yk17ii78mlwt5nxqpeo
title: 2026 04 07_0020 Targeting
desc: ''
updated: 1775546848688
created: 1775546440859
---

## Goals

- Define a shared target-scoped request model for local operations that need to address one or more designator paths.
- Implement that target model first on `weave`, while shaping it so later standalone `version`, `validate`, and `generate` surfaces can reuse it.
- Keep shared targeting resource-root based: target logical designator-root resources, not support artifacts directly.
- Define recursion and overlap behavior for targets so later multi-target operations can remain deterministic.

## Summary

This task should define the first shared targeting model for local Weave operations before Markdown payload publishing broadens the public artifact surface.

The intended first boundary is:

- introduce a target-scoped request shape that can later be reused by standalone `version`, `validate`, and `generate` operations
- apply that request model end-to-end to `weave` first, because `weave` is the only current first-class operation that already combines versioning, validation, and generation behavior
- keep targets resource-root based, for example `alice`, `alice/bio`, `ontology`, or `ontology/shacl`
- reject support-artifact-only explicit targets such as `_mesh/_inventory`, `alice/_knop/_meta`, or `alice/_knop/_references` in the first pass
- leave payload history/state naming to [[wd.task.2026.2026-04-07_0820-validate-version-generate]]

The motivating publication examples are target roots such as `ontology` and `ontology/shacl`, which later version-oriented operations may version under paths such as `ontology/releases/v0.0.1/ontology-ttl/ontology.ttl`.

## Discussion

The broader architecture language also talks about `version`, `validate`, and `generate`, but in the current local implementation those are not first-class runtime or CLI operations yet. Today, versioning, RDF validation, and page generation are effectively folded into `weave`.

So this task should do two things without conflating them:

- define the shared target model that later standalone operations can reuse
- implement that model only where it is currently real, which is `weave`

Target selection also needs to stay coherent as `WeaveRequest` moves from a flat `designatorPaths` list to target-scoped objects.

“Resource-root based” in this note means designator-root resources that own a Knop-managed surface, not their internal support artifacts. In practice, the first targeting model should address roots such as:

- `alice`
- `alice/bio`
- `ontology`
- `ontology/shacl`

and let each operation derive owned support-artifact work from those roots.

The current selection model is:

- no explicit designator paths means "all weaveable candidates"
- explicit designator paths are exact-match only

For the first `targets` contract, recursion should be supported from the start, but not implicitly. A target should be exact-match unless it opts into recursive selection.

That means overlap behavior must be explicit. The intended rule is:

- the most specific matching target wins
- "most specific" means the longest normalized matching `designatorPath`
- if two matching targets have the same normalized `designatorPath`, the request is ambiguous and should fail closed rather than depending on input order

## Open Issues

- What is the thinnest acceptable first CLI syntax for supplying one or more named `targets`, including per-target recursion, without turning this task into a broader CLI ergonomics redesign?

## Decisions

- Shared targeting should remain resource-root based in the first pass; no support-artifact-only explicit targets.
- The first implementation should cut straight to target-scoped request objects rather than introducing scalar naming fields or support-artifact path targeting that would need to be backed out immediately.
- The first implementation should carry the new `targets` shape all the way through `core/weave`, `runtime/weave`, and the CLI, but keep runtime and CLI changes as thin pass-through plumbing over the core contract rather than a separate surface redesign.
- This task defines a shared target model intended for later standalone `version`, `validate`, and `generate` surfaces, but those standalone operations are not implemented here.
- The first concrete implementation scope is `weave`, because that is the current operation where versioning, validation, and generation behavior are already composed.
- Target-scoped recursion should be supported from the start rather than deferred to a later redesign.
- Explicit targets remain exact-match by default; recursion is opt-in per target.
- When multiple targets match the same weave candidate, the most specific matching target wins.
- If multiple matching targets have the same normalized `designatorPath`, the request should fail closed as ambiguous.
- Payload `historySegment` and `stateSegment` are not part of the shared target model; they belong to version-oriented requests as captured in [[wd.task.2026.2026-04-07_0820-validate-version-generate]].
- Broader multi-target version orchestration should follow the `validate/version/generate` decomposition rather than being forced into the current single-candidate `weave` planner first.

## Contract Changes

- The first concrete contract change is in `WeaveRequest`, which should become target-scoped.
- The same target specification shape should be reusable later by standalone `version`, `validate`, and `generate` requests if and when those surfaces are introduced.
- `runtime/weave` should accept the same target-scoped request shape and pass it through without reinterpretation.
- The CLI `weave` command should accept a minimal first syntax for one or more target specifications and translate that syntax directly into the `targets` request shape.
- `WeaveRequest` should move to a list of target specifications such as:
  - `designatorPath`
  - optional `recursive`
- When `recursive` is true, the target applies to matching descendant payload designator paths as well as the exact path.
- When more than one target matches a candidate, the winner is the matching target with the longest normalized `designatorPath`.
- If more than one matching target has the same normalized `designatorPath`, planning should fail closed rather than using request order as a precedence rule.
- In the first pass, support-artifact-only explicit targets such as `_mesh/_inventory`, `alice/_knop/_meta`, or `alice/_knop/_references` should be rejected.
- Version-specific payload naming options belong to version-oriented requests, not to `TargetSpec`.

## Testing

- Keep all current tests green when no explicit targets are supplied.
- Add core coverage for exact-match target selection.
- Add core coverage for recursive target selection over descendant resource roots.
- Add core coverage for overlapping recursive and exact targets resolving by most-specific target.
- Add runtime and CLI coverage proving the `targets` request shape reaches `core/weave` intact.
- Add explicit coverage for default target selection semantics on `weave`, because that is the first implementation-bearing consumer of the shared target model.
- Add coverage proving recursive targets apply to descendant resource roots rather than support-artifact paths.
- Add coverage proving duplicate targets at the same specificity fail closed as ambiguous.
- Add coverage proving support-artifact-only explicit targets are rejected.
- Leave payload history/state naming coverage to [[wd.task.2026.2026-04-07_0820-validate-version-generate]].

## Non-Goals

- Implementing standalone `version`, `validate`, or `generate` commands in this task.
- Implementing payload history/state naming in this task.
- Support-artifact-only targeting in this task.
- Solving generic multi-history policy for every artifact type at once.

## Implementation Plan

- [ ] Refine `WeaveRequest` to use target-scoped request objects instead of `designatorPaths`.
- [ ] Define target matching semantics, including exact versus recursive targets and the most-specific-wins precedence rule.
- [ ] Keep the target specification shape narrow and reusable so later standalone `version`, `validate`, and `generate` surfaces can adopt it without a second redesign.
- [ ] Reject support-artifact-only explicit targets in the first pass.
- [ ] Thread the new `targets` request shape through `runtime/weave` as a thin pass-through to `core/weave`.
- [ ] Add the thinnest acceptable CLI syntax for one or more named `targets`, translating directly into the runtime/core request shape without broader CLI redesign.
- [ ] Add core, runtime, integration, and CLI coverage for default targeting, exact targets, recursive targets, ambiguous overlaps, and support-artifact rejection.
