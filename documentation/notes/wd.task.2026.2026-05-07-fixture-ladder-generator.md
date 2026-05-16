---
id: 9xybywi58iqffsh96al5yhl
title: 2026 05 07 Fixture Ladder Generator
desc: ''
updated: 1778219880393
created: 1778219880393
---

## Goals

- Replace hand-carried fixture branch ladders with a reproducible fixture-ladder generation workflow.
- Treat fixture repository branches as disposable generated rungs that can be replayed after ontology, config, planner, renderer, or manifest changes.
- Keep Accord transition manifests as the durable behavior contract, while fixture branches remain convenient test and inspection material.
- Support the existing Alice Bio and Sidecar Fantasy Rules fixture repositories without forcing a generalized scenario engine in the first pass.
- Make rerunning from an early branch boring: run one command, replay transitions in order, validate each step, and report drift.
- Preserve the ability for tests to compare Weave output against settled fixture refs.
- Keep GitHub Pages publication focused on the final SemanticSite unless a specific task needs intermediate states.
- Coordinate the generator with the enum-instance migration in [[ont.task.2026.2026-05-03-enumeration-type-instances]] and the config synthesis in [[wd.task.2026.2026-05-06-grand-config-synthesis]].

## Summary

The current fixture repositories use numbered branch ladders such as Alice Bio's `00-blank-slate` through `25-root-page-customized-woven` and Sidecar Fantasy Rules' `00-blank-slate` through `15-first-release-woven`. Those ladders are useful because they make each operation transition inspectable and give tests stable refs to compare against. They are also expensive: when an early rung changes, every later rung must be recreated, and the recreation process currently depends too much on human/agent memory.

The better model is to keep the ladder shape but change ownership. The durable source should be the transition journal, Accord manifests, and checked-in source assets. The branch ladder should be replayed output. A fixture generator should materialize a fixture repo from a known starting point, run each declared transition with the current Weave CLI/runtime, validate the result against the matching Accord manifest, and update the branch ref for that rung.

This task belongs in Weave because the generator orchestrates Weave commands, integrates with Weave tests, and manages local fixture repositories under `dependencies/github.com/semantic-flow/`. The portable transition manifests can remain in the Semantic Flow Framework examples tree where they already live.

## Discussion

### Current Shape

Weave tests currently read fixture branch contents from helper modules such as `tests/support/mesh_alice_bio_fixture.ts` and `tests/support/mesh_sidecar_fantasy_rules_fixture.ts`. The helpers resolve local or remote refs, read files via `git show`, list branch files via `git ls-tree`, and materialize branch contents into temporary directories. Integration and e2e tests then run Weave operations and compare the generated workspace to the expected fixture branch or to manifest-scoped expectations.

That structure is basically right for tests. The weak part is fixture maintenance. Branches are being used both as acceptance snapshots and as authored historical examples. The first use is valuable. The second is where the maintenance cost comes from.

### Generated Evolutionary Rungs

For this task, a generated rung means:

- a fixture branch may be force-updated during an intentional regeneration
- a branch's contents are not independently authored once the transition source and manifest are settled
- review should focus on manifest changes, generator changes, and the generated diff, not on preserving branch commit history
- if an early rung changes, later rungs should be regenerated from the new state instead of patched manually

This does not make the fixtures less important. It makes their provenance clearer. A rung is evidence produced by replaying the previous rung plus declared transition inputs; it is not a standalone golden source. Tests may still compare against branch refs, but the branch ref is downstream of the replay contract.

### Source Of Truth

The intended source layers are:

- fixture scenario definition: ordered list of transitions, branch names, commands, source refs, destination refs, and manifest names
- Accord manifests: durable per-transition expected behavior and file expectations
- deterministic fixture-repo `.assets` bytes: source files staged into the workspace before command-backed transitions or applied by declared file operations
- Weave implementation: current operation behavior
- fixture repo branches: generated rung outputs used by tests and local inspection

The first implementation can encode the scenario definition in TypeScript if that keeps the tool simple. A later pass can move it to JSON, JSON-LD, YAML, or an Accord-adjacent manifest if the shape stabilizes.

The replay-command and source-provenance shape should be coordinated with Accord rather than treated as a permanent Weave-only scenario format. See [[ac.task.2026.2026-05-14-generalized-replay-and-provenance]]. Weave can still build temporary adapters for execution, but the durable metadata vocabulary should belong to Accord if it is going to be reusable outside branch-laddered fixtures.

Accord now honors `ignorePaths` in whole-tree transition completeness checks. The fixture generator should take advantage of that instead of maintaining a separate ad hoc tree-diff allowlist. Generated checks should fail on unexpected non-ignored path changes, should reject invalid ignore patterns through Accord validation/checking, and should avoid manifests that both ignore and explicitly expect the same path.

### Publication

We do not need every intermediate branch to publish through GitHub Pages at the same time. The fixture repos mainly demonstrate a mesh. Publishing the final SemanticSite is enough by default.

If intermediate states become useful for documentation or demos, the generator can later copy selected rung outputs into a single Pages deployment tree such as `/alice-bio/07-alice-bio-integrated-woven/`. That should be a separate publishing enhancement, not part of the first generator.

### Relationship To Branch-Published Meshes

[[wd.task.2026.2026-05-13_1655-support-gh-pages-branch-based-deployments]] should not replace the existing `mesh-sidecar-fantasy-rules` fixture. Contrary to an earlier direction, `mesh-sidecar-fantasy-rules` remains the durable docs-rooted sidecar mesh example, with source files at the repository root and generated mesh output under `docs/`.

Branch-published Fantasy Rules coverage should move to a separate fixture repository, tentatively `mesh-branch-fantasy-rules`, so the two repository topologies stay explicit:

- `mesh-sidecar-fantasy-rules`: source root and repository root are the same checkout; mesh root is `docs/`; source files remain outside the mesh root.
- `mesh-branch-fantasy-rules`: source/control branch and publication branch exercise branch-published delivery without disturbing the sidecar fixture contract.

This means the fixture generator should rerung Sidecar Fantasy Rules in its existing docs-rooted shape before adding the branch-published Fantasy fixture. The branch-published repo can reuse lessons from the sidecar replay, but it should not be forced into the same ladder or branch namespace.

### Relationship To Config Synthesis

The config synthesis will probably invalidate most existing fixture outputs. It will introduce explicit Weave defaults, config artifacts, local/inheritable Knop config, inherited propagation controls, changed support-artifact history policy, and likely updated generated pages/manifests. That is exactly the sort of change a generator should absorb.

The generator should be designed alongside the next config pass and used before repairing fixture repos. Otherwise we will spend the config migration doing another manual ladder repair and then still need the generator afterward.

That does not mean the generator has to be perfect before config synthesis begins. The minimum useful version is a deterministic replay tool for one fixture repo, probably Alice Bio, with clear dry-run/status output and validation hooks. Config design can proceed concurrently, but fixture repo repair should wait until the enum and config vocabulary changes can be regenerated together.

The immediate reason to start now is concrete: the current broad weave tests still read fixture branches that carry the old `https://semantic-flow.github.io/semantic-flow-ontology/` namespace and inventory-owned mutable progression facts. Current code is moving toward the canonical `https://semantic-flow.github.io/sflo/ontology/` namespace and the `_mesh/_meta` MeshInventory progression seam from [[wd.task.2026.2026-05-06-grand-config-synthesis]]. We do not want backward-compatibility shims for pre-v1 fixture shapes; the generator should make it cheap to regenerate the expected branches cleanly instead.

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

The first useful implementation should not try to repair every fixture branch in one leap. It should first inventory the existing ladder and produce a reviewable plan whose transition definitions are explicit enough to review. Then implement one real Alice Bio transition in a temporary checkout, validate it, and only after that add branch update support. Regeneration commands write local fixture branch tips by default; `--dry-run` is the explicit escape hatch for command/validation rehearsal without branch updates. Plain planning remains non-mutating. New Alice Bio replay branches use the `a.` prefix, starting with `a.00-blank-slate`, so the regenerated evolutionary chain can coexist with older unprefixed fixture branches while the shape settles.

### Inventory Snapshot

The current Accord conformance manifests already identify each transition's `operationId`, `fromRef`, `toRef`, target designator path or paths, and file/RDF expectations. They do not record the exact replay command, command working directory, prompt policy, source-file setup, or manual source provenance needed to reproduce the transition without archive/context memory.

Alice Bio currently has manifests for `01-source-only` through `25-root-page-customized-woven`:

- `01-source-only`: seed source-only fixture state from `00-blank-slate`.
- `02-mesh-created`: `mesh.create` from `01-source-only`.
- `03-mesh-created-woven`: top-level `weave` from `02-mesh-created`.
- `04-alice-knop-created`: `knop.create alice`.
- `05-alice-knop-created-woven`: top-level `weave`.
- `06-alice-bio-integrated`: `integrate alice-bio.ttl --designator-path alice/bio`.
- `07-alice-bio-integrated-woven`: top-level `weave`.
- `08-alice-bio-referenced`: `knop.addReference alice` with target `alice/bio` and role `canonical`.
- `09-alice-bio-referenced-woven`: top-level `weave`.
- `10-alice-bio-updated`: `payload.update alice/bio` from the v2 source bytes.
- `11-alice-bio-v2-woven`: top-level `weave` targeted at `alice/bio`.
- `12-bob-extracted`: `extract bob`.
- `13-bob-extracted-woven`: top-level `weave` targeted at `bob`.
- `14-alice-page-customized`: `resourcePage.define alice`; currently a hand-authored fixture operation, not a first-class replay command.
- `15-alice-page-customized-woven`: top-level `weave` targeted at `alice`.
- `16-alice-page-main-integrated`: `integrate alice/page-main`.
- `17-alice-page-main-integrated-woven`: top-level `weave` targeted at `alice/page-main`.
- `18-alice-page-artifact-source`: `resourcePage.define alice`; currently a hand-authored fixture operation that repoints the page definition to the governed artifact.
- `19-alice-page-artifact-source-woven`: top-level `weave` targeted at `alice`.
- `20-bob-page-imported-source`: `import bob`; currently a carried fixture shape ahead of a first-class `import` command.
- `21-bob-page-imported-source-woven`: top-level `weave` targeted at `bob`.
- `22-root-knop-created`: `knop.create /`.
- `23-root-knop-created-woven`: top-level `weave` targeted at `/`.
- `24-root-page-customized`: `resourcePage.define /`; currently a hand-authored fixture operation.
- `25-root-page-customized-woven`: top-level `weave` targeted at `/`.

Sidecar Fantasy Rules currently has manifests for `01-source-only` through `17-all-remaining-terms-woven`. `01-source-only` is now the source-seeding transition from the `a.00-blank-slate` control branch into the authored ontology, SHACL, example data, and attribution files:

- `01-source-only`: fixture file operation that seeds `NOTICE.md`, `ontology/fantasy-rules-ontology.ttl`, `shacl/fantasy-rules-shacl.ttl`, and `examples/gunaar.ttl` from deterministic `.assets` bytes in the fixture repo.
- `02-sidecar-mesh-created`: `mesh.create` with workspace root `.` and mesh root `docs`.
- `03-sidecar-mesh-created-woven`: top-level `weave --mesh-root docs`.
- `04-ontology-integrated`: `integrate` the adjacent ontology source into the docs-rooted mesh.
- `05-ontology-integrated-woven`: top-level `weave --mesh-root docs`.
- `06-shacl-integrated`: `integrate` the adjacent SHACL source into the docs-rooted mesh.
- `07-shacl-integrated-woven`: top-level `weave --mesh-root docs`.
- `08-ontology-and-shacl-terms-extracted`: five explicit `extract` commands for `ontology/AbilityScore`, `ontology/Alignment`, `ontology/Character`, `ontology/PlayerCharacter`, and `ontology/CharacterShape`, preserving the split between ontology-sourced and SHACL-sourced extraction.
- `09-ontology-and-shacl-terms-extracted-woven`: top-level `weave --mesh-root docs`.
- `10-root-knop`: `knop.create` for `/` and `examples`.
- `11-root-knop-woven`: top-level `weave --mesh-root docs` with both root and examples targets.
- `12-gunaar-example-dataset`: `integrate examples/gunaar.ttl examples/gunaar --mesh-root docs --grant-source-directory examples`.
- `13-gunaar-example-dataset-woven`: top-level `weave --mesh-root docs --target designatorPath=examples/gunaar`.
- `14-first-release`: `source.update`; currently a hand-authored fixture operation that prepares release metadata in authored ontology and SHACL source files.
- `15-first-release-woven`: two explicit named-release top-level `weave --mesh-root docs` operations, one for `ontology` and one for `shacl`, using `--payload-history-segment releases`, `--payload-state-segment v0.0.2`, and `--payload-manifestation-segment ttl`.
- `16-all-remaining-terms-extracted`: three `extract --all-terms --accept-preview --mesh-root docs` operations sourced from `ontology`, `shacl`, and `examples/gunaar`, adding Knop-managed surfaces for the remaining mesh-scoped ontology, SHACL, and example term IRIs.
- `17-all-remaining-terms-woven`: broad `weave --mesh-root docs`, relying on weave candidate detection to skip already-settled current-only support Knops while versioning the newly extracted terms and refreshing ResourcePages.

Existing e2e tests provide partial command templates for several transitions, and the CLI runtime writes command audit events under `.weave/logs/security-audit.jsonl`. Those logs are useful runtime evidence, but they are not the durable replay contract. The scenario definition should record the intended command before execution, and tests can still assert that the command emits operational/audit logs while replaying.

### Command And Source Provenance

Each generated transition should record enough provenance to reproduce the fixture state without relying on chat archives, task-note archaeology, or human memory:

- command provenance: executable, argv, command working directory, relevant environment overrides, prompt/confirmation policy, and whether the operation is expected to write runtime logs.
- materialization provenance: source fixture repo, source ref, target ref, mesh root, workspace root, files copied into the temporary workspace before running the command, and any path replacements used only for comparison.
- manual-source provenance: for non-command transitions, the source of each created or replaced file, whether it is inline fixture-authored content, a copied file from an earlier branch, an external URL, or content derived from a specific task note.
- remote-source provenance: URL, fetch mode, expected media type when relevant, and a content digest or checked-in source fixture so reruns are deterministic even if the remote changes.
- validation provenance: manifest path, full-tree comparison mode, manifest-scoped comparison mode, expected guardrails, and expected generated-output invariants.

This matters immediately for the hand-authored or command-incomplete rungs:

- `14-alice-page-customized`, `18-alice-page-artifact-source`, and `24-root-page-customized` create or replace page-definition, Markdown, CSS, sidebar, and inventory files without a first-class `resourcePage.define` command. The generator can initially replay these as declared file operations, but the source for each authored file must be explicit.
- `20-bob-page-imported-source` uses the outside-origin Markdown URL recorded in [[wd.task.2026.2026-04-13_1245-bob-import-boundary-for-page-source]]: `https://raw.githubusercontent.com/djradon/public-notes/refs/heads/main/user.bob-newhart.md`. The generator should not refetch a moving branch URL blindly during deterministic replay; it should either pin a digest, use checked-in fixture source bytes, or both.
- `14-first-release` in Sidecar Fantasy Rules prepares release metadata in authored ontology and SHACL source files, while `15-first-release-woven` materializes the release histories. The scenario should preserve that split and record the two named-release weave commands explicitly.

The first scenario-definition format should therefore support both `command` steps and `fileOperation` steps. A `fileOperation` step is not a weaker contract; it must be more explicit about where bytes came from because no CLI command currently carries that provenance for us.

## Open Issues

- Should scenario definitions live as TypeScript in Weave, as data files in Weave, or beside Accord manifests in the Semantic Flow Framework examples tree?
- Should generated fixture branch commits be one commit per rung, or should the generator only update branch tips without caring about branch-local history?
- How should the generator handle intentionally hand-authored source-only branches such as `01-source-only`?
- How much of the temporary Alice Bio TypeScript scenario can move into Accord manifest replay metadata before a separate scenario index is needed?
- Should manifest validation compare full tree contents, manifest-scoped expectations only, or both depending on transition type?
- How much should generated HTML be normalized before comparison, especially as renderer behavior changes?
- Should final SemanticSite publication be handled by this generator later or by a separate release/publish task?
- Should the first generator command live under `tests/fixtures`, `tools/fixtures`, or a Deno task entry point such as `deno task fixture:ladder`?
- Should the generator validate canonical namespace and progression-location invariants before branch writes, or should those stay in separate ontology/fixture tests?

## Decisions

- The fixture generator is a Weave developer-tooling task, not part of the portable Semantic Flow ontology work.
- Fixture branch ladders should become disposable generated outputs.
- Accord manifests and ordered transition definitions are the durable contract.
- Rungs must be replayed sequentially from the previous rung; skipping directly to a later rung is only a diagnostic/materialization convenience, not the regeneration model.
- New Alice Bio and Sidecar Fantasy Rules regeneration branches use the `a.` prefix while this replay shape stabilizes.
- Deterministic `.assets` source bytes live in the fixture repo and feed source-only, command-input, and file-operation transitions; they are authored inputs, not golden output snapshots.
- `a.00-blank-slate` is the replay base/control rung for `.assets` and other excluded repo-control files.
- For whole-mesh and sidecar fixture repos, `main` should ultimately be the reviewed final generated mesh state. Branch-published mesh fixtures are the exception because `main` is source/control by design.
- Use a concrete TypeScript scenario definition for ordering and current file-operation glue in the first generator pass. Replay commands and deterministic command-input source bytes belong in Accord manifests.
- Keep the existing fixture branch comparison tests for now; update their assumptions only where needed to support generated refs.
- Publish only the final SemanticSite by default; intermediate Pages publication is out of scope for the first pass.
- Do not rename completed task notes or fixture branches as part of this task unless explicitly requested.
- Do not build a fully generic fixture scenario engine in the first pass.
- Do not add compatibility handling for old fixture namespaces or inventory-owned progression facts; stale fixtures should be regenerated against the current contract.
- Record exact replay commands for command-backed transitions.
- Hydrate command-backed transition execution from Accord `hasReplayProfile.hasCommandInvocation`; do not keep mesh-specific CLI argv in the generator code.
- Regeneration execution updates local fixture branch tips by default after command success and generated-output guardrails pass; use `--dry-run` for rehearsal without a branch update.
- Stale manifest or previous-branch comparison drift should be reported during regeneration, but should not block a local branch update once command execution and generated-output guardrails have passed.
- The generator does not push fixture branches automatically. After a local branch update, the CLI should tell the operator to push intentionally if the regenerated fixture should leave the checkout; manual pushes are part of the reviewed regeneration workflow.
- Record explicit source provenance for manually created, copied, fetched, or derived files. A fixture branch is not repeatable if the source of hand-authored bytes only exists in a prior conversation.
- Regenerate `mesh-sidecar-fantasy-rules` as a docs-rooted sidecar mesh; use a separate future `mesh-branch-fantasy-rules` repository for branch-published Fantasy Rules coverage.
- Extraction provenance should resolve as deeply as the source evidence allows: source artifact first, then history/state when present, then manifestation, located file, and digest. If a source artifact cannot provide history/state evidence, provenance should still record concrete observed bytes through located-file/digest evidence, with timestamp fallback reserved for cases where byte evidence cannot be made durable.
- Use `sflo:hasObservedSourceLocatedFile` only for source evidence that is modeled as a mesh `LocatedFile` resource. Use the datatype property `sflo:observedSourceLocalRelativePath` for local checkout paths, especially sidecar source paths outside the mesh root, and pair it with `sflo:observedSourceDigest` when bytes are observed.
- Accord `ReplayProfile` may declare `hasCommandSequence` for one transition that is replayed by several ordered Weave invocations. The fixture generator should execute those invocations in order and treat the sequence as one rung operation.
- Current-only support artifacts can be settled without versioned support histories. Broad weave candidate detection should not reinterpret a current-only KnopInventory with existing ResourcePage facts as a new first-weave candidate, while still allowing payload versioning and explicit history-naming requests through the existing target API.

## Contract Changes

- No immediate external Semantic Flow API contract changes.
- Weave's internal fixture maintenance contract changes: generated fixture branches are no longer treated as hand-maintained source material.
- Test fixtures may gain a declared scenario/replay contract that names transition order, expected source refs, expected target refs, commands, and manifests.
- Scenario/replay contracts should also name manual file operations and remote or inline source provenance for transitions that are not yet backed by a first-class Weave command.
- Future fixture branch diffs should be reviewed as generated outputs from a declared replay, not as standalone authored examples or golden sources.
- Generated fixture outputs should use the canonical `sflo` namespace and the current `_mesh/_meta` progression contract rather than preserving old fixture shapes.

## Testing

- Add focused unit tests for scenario definition parsing/validation if the scenario becomes data-driven.
- Add dry-run tests for command planning so transition order, source branch, target branch, manifest path, and command arguments are validated without mutating fixture repos.
- Add at least one integration-style test that regenerates a small temporary fixture ladder from a minimal scenario.
- Use existing e2e and integration fixture comparisons as the main acceptance check after branch regeneration.
- Use Accord whole-tree completeness checks and `ignorePaths` for generated fixture comparison rather than maintaining a second path-diff policy in Weave.
- Add a guardrail or validation step for generated fixture output that catches old `semantic-flow-ontology` namespace usage and stale inventory-owned MeshInventory progression facts before branch refs are updated.
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

- [x] Inventory the current Alice Bio and Sidecar Fantasy Rules branch ladders, manifest names, transition commands, and existing test expectations.
- [x] Add the first branch-published Fantasy Rules source-only proof manifest before fixture branch rerunging.
- [d] Inventory the currently failing fixture-backed tests and classify each failure as stale fixture namespace, stale progression location, page-definition shape drift, manifest drift, or implementation regression. Deferred until the planner/executor exists; the dominant fixture failures are already known stale output shapes.
- [x] Decide the first scenario-definition format, favoring a simple TypeScript definition unless a data file is clearly better.
- [x] Implement a dry-run planner that prints transition order, source branch, target branch, manifest path, command or file operation, source provenance, and expected validation steps.
- [x] Implement local materialization for a source branch into a temporary workspace using the existing fixture helper behavior as a reference.
- [x] Implement execution for the first Alice Bio transition that runs the intended Weave command and validates the result against its Accord manifest.
- [x] Add generated-output guardrails for canonical `sflo` namespace and current `_mesh/_meta` MeshInventory progression shape before any branch write.
- [x] Add branch update support for command-backed regeneration, with `--dry-run` as the explicit non-writing mode and no push support.
- [x] Add deterministic fixture-repo `.assets` handling for Alice Bio source-only, command-input, and page/file-operation transitions.
- [x] Prefix the new Alice Bio regeneration branch ladder with `a.` so generated rungs can coexist with the old branch ladder while the replay model settles.
- [x] Clean the Alice Bio replay base down to `.assets` and repository notes, then branch it as `a.00-blank-slate`.
- [x] Move Alice Bio command replay argv and command-input materialization metadata into Accord manifests, and hydrate command execution from those manifests.
- [x] Extend the generator through the full Alice Bio ladder, including source-only, command-backed, file-operation, import-source, and root-page transitions through `a.25-root-page-customized-woven`.
- [x] Push the generated Alice Bio `a.00` through `a.25` fixture refs after local validation.
- [ ] Update or add documentation for the Alice Bio regeneration workflow.
- [x] Extend the generator beyond Sidecar Fantasy Rules source-only into the command-backed docs-rooted sidecar fixture ladder using the `a.` branch prefix for the next replay family.
- [x] Decide that `mesh-sidecar-fantasy-rules` stays a docs-rooted sidecar fixture; branch-published Fantasy Rules coverage belongs in a separate future `mesh-branch-fantasy-rules` repository.
- [x] Create the Sidecar Fantasy Rules `a.00-blank-slate` control branch with deterministic `.assets` bytes selected from `origin/01-source-only` and `origin/15-first-release-woven`.
- [x] Add the Sidecar Fantasy Rules `01-source-only` manifest, teach the ladder generator about the `sidecar-fantasy-rules` scenario, and regenerate local branch `a.01-source-only` from `a.00-blank-slate`.
- [x] Generalize generated-output guardrails so sidecar mesh roots such as `docs/_mesh` are checked for stale MeshInventory progression ownership, not only root `_mesh` output.
- [x] Add the Sidecar Fantasy Rules `02-sidecar-mesh-created` replay profile, regenerate local branch `a.02-sidecar-mesh-created`, and update its manifest assertions for the canonical `sflo` namespace.
- [x] Add the Sidecar Fantasy Rules `03-sidecar-mesh-created-woven` replay profile, regenerate local branch `a.03-sidecar-mesh-created-woven`, and update its manifest for the slim support-history behavior and extension-only `ttl` manifestation segment.
- [x] Add the Sidecar Fantasy Rules `04-ontology-integrated` replay profile, regenerate local branch `a.04-ontology-integrated`, and update its manifest for current config enum IRIs and canonical `sflo` assertions.
- [x] Add and validate Sidecar Fantasy Rules `05-ontology-integrated-woven`, `06-shacl-integrated`, and `07-shacl-integrated-woven` replay profiles, regenerate their `a.` branches, and update their manifests for current support-history behavior.
- [x] Add Accord and generator support for manifest-declared command sequences, then use it to replay and validate Sidecar Fantasy Rules `08-ontology-and-shacl-terms-extracted`.
- [x] Push the generated Sidecar Fantasy Rules `a.00` through `a.08` fixture refs after local validation.
- [x] Regenerate and push Sidecar Fantasy Rules `a.09-ontology-and-shacl-terms-extracted-woven` with pinned extraction evidence that records observed source state, manifestation, located file, and digest after weave.
- [x] Add Sidecar Fantasy Rules replay profiles and generator transitions for `10-root-knop` through `15-first-release-woven`, including deterministic `.assets` handling for the first-release authored source update.
- [x] Regenerate, validate, and push Sidecar Fantasy Rules `a.10-root-knop` through `a.15-first-release-woven`.
- [x] Keep Sidecar Fantasy Rules support artifacts slim/current-only during root Knop creation, extracted-term weaving, and release-history weaving; do not expect generated `_knop/_inventory` support history snapshots for those sidecar rungs.
- [x] Add temporary `a.` prefix resolution to the Sidecar Fantasy Rules fixture test helper, matching Alice Bio until a scenario master manifest owns the prefix.
- [x] Confirm Alice Bio's current-mode extraction provenance is not the sidecar local-path mistake: `alice-bio.ttl` is modeled as an in-mesh `LocatedFile`, while sidecar source files outside `docs/` use `sflo:observedSourceLocalRelativePath` plus `sflo:observedSourceDigest`.
- [x] Add Sidecar Fantasy Rules `16-all-remaining-terms-extracted` and `17-all-remaining-terms-woven`, regenerate and push both `a.` refs, and cover the final branch with an integration test that every mesh-scoped non-file source IRI has a ResourcePage.
- [x] Fix broad weave candidate detection so settled current-only support Knops with existing ResourcePages are skipped instead of being retried as first-weave candidates.
- [x] Add branch-published Fantasy Rules fixture coverage in a separate repository after the sidecar ladder is replayable and green.
- [x] Regenerate and push Branch Fantasy Rules `a.05` through `a.15`, Sidecar Fantasy Rules `a.08` through `a.17`, and Alice Bio `a.12` through `a.25` after extraction-source provenance settled in `_knop/_sources` and ResourcePage generation learned to preserve ancestor history roles on exact-target release-state pages.
- [ ] Update Accord manifests, fixture-backed Weave tests, and conformance expectations after generated branches are rerung for the combined enum/config changes.
- [ ] Record the expected workflow for large ontology/config churn: update manifests, run generator, inspect generated branch diffs, run fixture tests, commit/push branch updates intentionally.
- [x] Update [[wd.task.2026.2026-05-06-grand-config-synthesis]] to reference this task as the intended fixture regeneration path before the config-driven fixture rebuild.
- [x] Update [[wd.decision-log]] with the decision to treat fixture branches as disposable generated outputs once the implementation path is accepted.
