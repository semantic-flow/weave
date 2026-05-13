---
id: 9xybywi58iqffsh96al5yhl
title: 2026 05 07 Fixture Ladder Generator
desc: ''
updated: 1778219880393
created: 1778219880393
---

## Goals

- Replace hand-carried fixture branch ladders with a reproducible fixture-ladder generation workflow.
- Treat fixture repository branches as disposable golden outputs that can be regenerated after ontology, config, planner, renderer, or manifest changes.
- Keep Accord transition manifests as the durable behavior contract, while fixture branches remain convenient test and inspection material.
- Support the existing Alice Bio and Sidecar Fantasy Rules fixture repositories without forcing a generalized scenario engine in the first pass.
- Make rerunging from an early branch boring: run one command, replay transitions in order, validate each step, and report drift.
- Preserve the ability for tests to compare Weave output against settled fixture refs.
- Keep GitHub Pages publication focused on the final SemanticSite unless a specific task needs intermediate states.
- Coordinate the generator with the enum-instance migration in [[ont.task.2026.2026-05-03-enumeration-type-instances]] and the config synthesis in [[wd.task.2026.2026-05-06-grand-config-synthesis]].

## Summary

The current fixture repositories use numbered branch ladders such as Alice Bio's `00-blank-slate` through `25-root-page-customized-woven` and Sidecar Fantasy Rules' `00-blank-slate` through `15-first-release-woven`. Those ladders are useful because they make each operation transition inspectable and give tests stable refs to compare against. They are also expensive: when an early rung changes, every later rung must be recreated, and the recreation process currently depends too much on human/agent memory.

The better model is to keep the ladder shape but change ownership. The durable source should be the transition journal and Accord manifests. The branch ladder should be generated output. A fixture generator should materialize a fixture repo from a known starting point, run each declared transition with the current Weave CLI/runtime, validate the result against the matching Accord manifest, and update the branch ref for that rung.

This task belongs in Weave because the generator orchestrates Weave commands, integrates with Weave tests, and manages local fixture repositories under `dependencies/github.com/semantic-flow/`. The portable transition manifests can remain in the Semantic Flow Framework examples tree where they already live.

## Discussion

### Current Shape

Weave tests currently read fixture branch contents from helper modules such as `tests/support/mesh_alice_bio_fixture.ts` and `tests/support/mesh_sidecar_fantasy_rules_fixture.ts`. The helpers resolve local or remote refs, read files via `git show`, list branch files via `git ls-tree`, and materialize branch contents into temporary directories. Integration and e2e tests then run Weave operations and compare the generated workspace to the expected fixture branch or to manifest-scoped expectations.

That structure is basically right for tests. The weak part is fixture maintenance. Branches are being used both as acceptance snapshots and as authored historical examples. The first use is valuable. The second is where the maintenance cost comes from.

### Disposable Golden Outputs

For this task, "disposable golden output" means:

- a fixture branch may be force-updated during an intentional regeneration
- a branch's contents are not independently authored once the transition source and manifest are settled
- review should focus on manifest changes, generator changes, and the generated diff, not on preserving branch commit history
- if an early rung changes, later rungs should be regenerated from the new state instead of patched manually

This does not make the fixtures less important. It makes their provenance clearer. The generated branch state is still the black-box expected output for tests. It is just no longer the source of truth for how to produce that state.

### Source Of Truth

The intended source layers are:

- fixture scenario definition: ordered list of transitions, branch names, commands, source refs, destination refs, and manifest names
- Accord manifests: durable per-transition expected behavior and file expectations
- Weave implementation: current operation behavior
- fixture repo branches: generated expected outputs used by tests and local inspection

The first implementation can encode the scenario definition in TypeScript if that keeps the tool simple. A later pass can move it to JSON, JSON-LD, YAML, or an Accord-adjacent manifest if the shape stabilizes.

### Publication

We do not need every intermediate branch to publish through GitHub Pages at the same time. The fixture repos mainly demonstrate a mesh. Publishing the final SemanticSite is enough by default.

If intermediate states become useful for documentation or demos, the generator can later copy selected rung outputs into a single Pages deployment tree such as `/alice-bio/07-alice-bio-integrated-woven/`. That should be a separate publishing enhancement, not part of the first generator.

### Relationship To Config Synthesis

The config synthesis will probably invalidate most existing fixture outputs. It will introduce explicit Weave defaults, config artifacts, local/inheritable Knop config, inherited propagation controls, changed support-artifact history policy, and likely updated generated pages/manifests. That is exactly the sort of change a generator should absorb.

The generator should be designed alongside the next config pass and used before repairing fixture repos. Otherwise we will spend the config migration doing another manual ladder repair and then still need the generator afterward.

That does not mean the generator has to be perfect before config synthesis begins. The minimum useful version is a deterministic replay tool for one fixture repo, probably Alice Bio, with clear dry-run/status output and validation hooks. Config design can proceed concurrently, but fixture repo repair should wait until the enum and config vocabulary changes can be regenerated together.

### Relationship To Enumeration Migration

The enum-instance migration in [[ont.task.2026.2026-05-03-enumeration-type-instances]] should not be blocked on a finished fixture generator. The enum task is ontology-level vocabulary cleanup and should settle before the config ontology mints many new controlled values.

Fixture regeneration for enum fallout is deferred until after the next config pass. A pragmatic order is:

1. Settle the enum naming convention and update ontology/code references.
2. Take the next config synthesis pass using the settled flat underscore-separated enum naming convention, including the minimal inherited config propagation controls that affect fixture output.
3. Build or refine the fixture generator concurrently enough to replay affected branches.
4. Rerung fixtures once for the combined enum and config fallout using the generator/replay path.

If config work exposes fixture-generator requirements, fold those requirements back into this task instead of doing one-off manual ladder repair.

### Initial Scope

Start with Alice Bio because it has the longest ladder and exercises mesh create, Knop create, integrate, weave, reference addition, payload update, extract, page customization, and root lifecycle behavior. Once Alice Bio can be regenerated, adapt the same machinery for Sidecar Fantasy Rules.

The generator should be intentionally concrete at first. It does not need to infer operations from arbitrary manifests. It can have explicit transition definitions that name the command to run, the source branch, the target branch, the manifest, and any path replacements or known comparison exclusions already used by tests.

## Open Issues

- Should scenario definitions live as TypeScript in Weave, as data files in Weave, or beside Accord manifests in the Semantic Flow Framework examples tree?
- Should generated fixture branch commits be one commit per rung, or should the generator only update branch tips without caring about branch-local history?
- Should the generator force-update branches by default, or require an explicit `--force` / `--write-branches` flag after a dry run?
- How should the generator handle intentionally hand-authored source-only branches such as `01-source-only`?
- Should manifest validation compare full tree contents, manifest-scoped expectations only, or both depending on transition type?
- How much should generated HTML be normalized before comparison, especially as renderer behavior changes?
- Should final SemanticSite publication be handled by this generator later or by a separate release/publish task?

## Decisions

- The fixture generator is a Weave developer-tooling task, not part of the portable Semantic Flow ontology work.
- Fixture branch ladders should become disposable generated outputs.
- Accord manifests and ordered transition definitions are the durable contract.
- Keep the existing fixture branch comparison tests for now; update their assumptions only where needed to support generated refs.
- Publish only the final SemanticSite by default; intermediate Pages publication is out of scope for the first pass.
- Do not rename completed task notes or fixture branches as part of this task unless explicitly requested.
- Do not build a fully generic fixture scenario engine in the first pass.

## Contract Changes

- No immediate external Semantic Flow API contract changes.
- Weave's internal fixture maintenance contract changes: generated fixture branches are no longer treated as hand-maintained source material.
- Test fixtures may gain a declared scenario/replay contract that names transition order, expected source refs, expected target refs, commands, and manifests.
- Future fixture branch diffs should be reviewed as generated outputs from a declared replay, not as standalone authored examples.

## Testing

- Add focused unit tests for scenario definition parsing/validation if the scenario becomes data-driven.
- Add dry-run tests for command planning so transition order, source branch, target branch, manifest path, and command arguments are validated without mutating fixture repos.
- Add at least one integration-style test that regenerates a small temporary fixture ladder from a minimal scenario.
- Use existing e2e and integration fixture comparisons as the main acceptance check after branch regeneration.
- Run `deno task lint` after significant implementation changes, per repo guidance.
- For actual fixture rerunging, run the relevant Accord manifest checks and the affected Weave fixture tests before accepting generated branches.

## Non-Goals

- Publishing every intermediate branch via GitHub Pages.
- Preserving old fixture branch commit histories during intentional regeneration.
- Designing a universal workflow engine for arbitrary Semantic Flow examples.
- Solving the config ontology overhaul directly.
- Solving the enum-instance migration directly.
- Rewriting Accord manifest semantics unless generator implementation exposes a concrete gap.
- Moving source-of-truth user-facing README content into fixture branches.

## Implementation Plan

- [ ] Inventory the current Alice Bio and Sidecar Fantasy Rules branch ladders, manifest names, transition commands, and existing test expectations.
- [ ] Decide the first scenario-definition format, favoring a simple TypeScript definition unless a data file is clearly better.
- [ ] Implement a dry-run planner that prints transition order, source branch, target branch, manifest path, command, and expected validation steps.
- [ ] Implement local materialization for a source branch into a temporary workspace using the existing fixture helper behavior as a reference.
- [ ] Implement execution for the first Alice Bio transition that runs the intended Weave command and validates the result against its Accord manifest.
- [ ] Add branch update support behind an explicit write flag so dry runs remain the default while the tool is being proven.
- [ ] Extend the generator through the full Alice Bio ladder.
- [ ] Update or add documentation for the Alice Bio regeneration workflow.
- [ ] Extend the generator to Sidecar Fantasy Rules.
- [ ] Update Accord manifests, fixture-backed Weave tests, and conformance expectations after generated branches are rerung for the combined enum/config changes.
- [ ] Record the expected workflow for large ontology/config churn: update manifests, run generator, inspect generated branch diffs, run fixture tests, commit/push branch updates intentionally.
- [x] Update [[wd.task.2026.2026-05-06-grand-config-synthesis]] to reference this task as the intended fixture regeneration path before the config-driven fixture rebuild.
- [ ] Update [[wd.decision-log]] with the decision to treat fixture branches as disposable generated outputs once the implementation path is accepted.
