---
id: bj99pvhgszcuiztsjap7cvb
title: 2026 05 15_1113 Mesh Branch Fantasy Rules
desc: ''
updated: 1778902824700
created: 1778868835253
---

## Goals

- Fill the repo at `git@github.com:semantic-flow/mesh-branch-fantasy-rules.git` with a branch-published Fantasy Rules fixture ladder that reuses the Sidecar Fantasy Rules source material but exercises the clean-source-branch topology.
- Keep `mesh-sidecar-fantasy-rules` as the docs-rooted sidecar fixture and make this repo the branch-published counterpart.
- Push the limits of Weave's branch-published workflow: repository source locators, source/ref/commit/digest provenance, deploy dry-runs, local publication commits, dirty-worktree guardrails, publication controls, config expressivity, swtiching history on and off and on again, and pushing ResourcePage generation to its limits.
  - Our goal is to uncover weak spots in the ontology, the weave process, and the testing / fixture general approach
- Preserve the organic ladder principle: each rung is produced from the previous source/publication state plus declared transition inputs. Nothing should jump straight to a later expected mesh shape.
  - but we will have to ensure Accord can compare commits instead of branches, because these rungs are all on the same gh-pages branch
- Avoid encoding local sibling checkout paths or sidecar-specific assumptions into generated public RDF.

## Summary

The Sidecar Fantasy Rules ladder is now replayed through `a.17-all-remaining-terms-woven`, and `mesh-sidecar-fantasy-rules:main` has been fast-forwarded to that final generated sidecar state. This task starts the next fixture topology: a branch-published Fantasy Rules repo where `main` stays clean source/control material and the generated Semantic Flow mesh lives on publication branches.

This fixture should be similar enough to Sidecar Fantasy Rules to reuse the ontology, SHACL, example, release, and attribution assets, but different enough to prove that branch-published meshes are not just `docs/` sidecars in disguise. The branch-published fixture should show how Weave reads source bytes from one checkout/ref, materializes or updates publication bytes in a separate publication worktree, records durable repository/ref/path/digest provenance, and produces ResourcePages without publishing one developer's local filesystem layout.

The first implementation can remain concrete and fixture-oriented. The important thing is to model source state and publication state separately. A single sidecar branch can represent both authored source and generated mesh output; a branch-published rung is more honestly a tuple of source ref plus publication ref.

The first source-lane slice is in place: `a.00-blank-slate` points at the control state with README/control files plus deterministic `.assets`, `a.01-source-only` is generated from the fixture ladder tool, and `mesh-branch-fantasy-rules:main` has been fast-forwarded to that clean source-only state. The first publication-lane slice is also in place: `a.02-publication-bootstrapped-woven` is generated from `a.01-source-only`, validates against the branch-published Accord manifest, and `gh-pages` was fast-forwarded to that first publication commit. Repository source materialization is covered through `a.04-shacl-integrated-woven`: `a.03` materializes/integrates/weaves the ontology source, `a.04` does the same for SHACL, and both publication checkpoints record source ref, resolved source commit, repository-relative path, digest, and public target artifact IRIs in per-Knop `_sources` registries. Selected term extraction/weaving is covered through `a.06-ontology-and-shacl-terms-extracted-woven`: `a.05` extracts selected ontology and SHACL terms directly in the publication root, and `a.06` weaves those term Knops while pinning their extraction sources to the observed ontology/SHACL states. Root/examples/Gunaar coverage runs through `a.09-gunaar-example-dataset-woven`: `a.07` creates root and examples collection Knops, `a.08` weaves them, and `a.09` materializes the Gunaar example dataset from the clean source ref with per-Knop repository source provenance. First-release coverage runs through `a.11-first-release-woven`: `a.10` updates the clean source lane from deterministic first-release assets, and `a.11` updates publication working bytes from that source ref, refreshes per-Knop source registries for ontology, SHACL, and Gunaar, weaves named ontology/SHACL release states, and weaves the updated Gunaar payload as the next ordinal state. Final ResourcePage coverage runs through `a.13-all-remaining-terms-woven`: `a.12` extracts every remaining mesh-scoped IRI from the ontology, SHACL, and Gunaar sources, and `a.13` performs a broad publication-root weave that generated ResourcePages for all extracted terms. Current-mode canonical ReferenceLink coverage runs through `a.15-extracted-term-references-woven`: `a.14` curates representative references from extracted terms back to their current source artifacts, and `a.15` weaves those ReferenceCatalogs while leaving extraction source provenance pinned separately. The numeric publication refs were regenerated for the `_sources` extraction-provenance shape and the exact-target history-role fix, and `gh-pages` now points at the final `a.15-extracted-term-references-woven` publication state.

## Discussion

### Relationship To Sidecar Fantasy Rules

Use Sidecar Fantasy Rules as the content source and behavioral comparison point, not as the topology template. The source bytes we want are the same family of assets:

- `NOTICE.md`
- `ontology/fantasy-rules-ontology.ttl`
- `shacl/fantasy-rules-shacl.ttl`
- `examples/gunaar.ttl`
- release/update variants from `.assets/14-first-release/`

The branch-published repo should not carry generated `docs/` output on `main`. `main` should be readable as a normal source repository. Publication output should live on generated publication refs and ultimately on the Pages publication branch, probably `gh-pages`.

### Branch Shape

The `a.` prefix remains the replay-family prefix for this version of the fixture ladder. It corresponds roughly to the current ontology/Weave fixture contract family and lets us regenerate without colliding with older or experimental refs.

Branch-published fixtures need an explicit answer for source-state refs and publication-state refs. The sidecar ladder's simple `a.00` through `a.17` sequence is not enough because source updates and publication updates do not happen in the same tree. The first design should prefer clarity over cleverness:

- source refs identify the clean authored repository state used as input for a rung
- publication checkpoints identify generated publication worktree state after the rung
- source refs and publication checkpoints share one numeric `a.*` ladder so refs alpha-sort in rung order
- source states use ordinary numeric names such as `a.00-blank-slate` and `a.01-source-only`
- publication checkpoints use numeric `*-woven` names such as `a.02-publication-bootstrapped-woven`
- publication output is produced sequentially on `gh-pages`; after each generated publication rung is accepted, `gh-pages` should fast-forward to that same commit while the matching numeric `a.*-woven` ref marks the checkpoint
- Accord should compare the relevant commits/checkpoints, not assume every publication rung is an independently checked-out branch
- `main` remains a clean source branch, similar to the `a.01-source-only` state
- final publication state can be fast-forwarded to `gh-pages`
- generated rung refs should all start with `a.` until a scenario master manifest owns the prefix

An acceptable first cut may use deterministic `.assets` source materialization for source rungs, but the scenario definition still needs to record the source state used for each publication step. We should not leave future readers guessing which source bytes produced a publication commit.

### Candidate Ladder

The branch-published ladder should start smaller than the sidecar ladder if the deploy surface needs another slice first, but the intended end state is parallel coverage:

- source/control seed with deterministic `.assets` and clean authored source files
- publication bootstrap with `_mesh/` config and `.nojekyll`, without generated source-branch clutter
- materialize and integrate ontology source from repository locator metadata
- weave the ontology surface
- materialize and integrate SHACL source
- weave the SHACL surface
- extract selected ontology and SHACL terms
- weave extracted term pages
- create root/examples surfaces
- materialize and integrate the Gunaar example dataset
- weave the example dataset
- apply the first-release source update from deterministic assets
- weave named release states for ontology and SHACL
- extract all remaining terms from ontology, SHACL, and example source
- broad weave the final publication surface so every mesh-scoped non-file term IRI has a ResourcePage
- curate representative current-mode canonical references from extracted terms to their source artifacts
- weave the curated ReferenceCatalogs and their ResourcePages

This does not have to preserve every Sidecar rung number exactly. Coverage matters more than numerology, but the progression should remain organic and inspectable.

The current `deploy gh-pages` source-binding operation materializes, integrates, and weaves a bound source in one publication-root operation. The branch-published fixture therefore uses one woven publication checkpoint for each source binding rather than manufacturing a non-woven intermediate rung that the command surface does not actually produce.

### What This Should Prove

The fixture should prove the branch-published promises from [[wd.task.2026.2026-05-13_1655-support-gh-pages-branch-based-deployments]]:

- source branch stays clean: no generated `_mesh`, histories, inventories, pages, `.weave/`, or publication-only controls are written to the source checkout
- publication branch records durable source provenance: repository URL, ref, commit when honest, repository-relative path, and digest
- generated RDF does not persist source-root, publish-root, sibling worktree paths, file URLs, or `../source`-style topology
- deploy can bootstrap a publication root, preserve `.nojekyll`/`CNAME`/manual files, and refuse stale or dirty publication roots unless explicitly allowed
- local publication commit behavior is explicit and still no-push by default
- publication branches remain replayable from deterministic assets and declared commands

### Generator Fit

The existing `scripts/fixture-ladder.ts` is close, but branch-published replay is a different shape. It currently assumes one fixture repo worktree per transition. This task likely needs the generator to understand a source materialization root and a publication materialization root for the same transition.

The generator should still read command invocations from Accord manifests where possible. Mesh-specific command argv should not creep back into TypeScript. If a transition needs a file operation, the file operation should point at deterministic fixture `.assets` bytes with explicit provenance.

### Asset Placement

The branch fixture repo should carry deterministic `.assets` bytes because fixture replay must not depend on whatever happens to be on another branch at replay time. The clean source branch may also contain the current authored source files, but `.assets` remain the replay inputs for organic source-state construction and release/update transitions.

The source branch and publication branch should agree on public identifiers. The mesh base should become `https://semantic-flow.github.io/mesh-branch-fantasy-rules/`, not the sidecar fixture base.

## Open Issues

- What concrete ref type should publication checkpoints use for long-term comparison: lightweight tags, local branch refs, or raw commit SHAs recorded in manifests? The immediate fixture path uses numeric branch refs.
- When should multi-source/profile deploy input be added? The first rungs can use repeated single-source deploy invocations, but later rungs should add profile coverage if the one-source command surface becomes noisy.
- How should Accord represent commit-to-commit fixture comparisons for a publication branch whose rungs all live on `gh-pages`?
- How much fixture-specific publication commit metadata should live in Accord manifests versus a future scenario master file?
- How should local preview worktrees that check out `gh-pages` be handled during reruns? The current maintenance convention is to use the dependency checkout itself for preview, usually sitting on `gh-pages`, and reset/switch it deliberately during replay so temporary preview worktrees do not block publication ref updates.

## Decisions

- `mesh-sidecar-fantasy-rules` remains the docs-rooted sidecar fixture. `mesh-branch-fantasy-rules` is the separate branch-published fixture.
- Use the `a.` prefix again for this replay family until a scenario/spec master file owns the prefix.
- Use one numeric `a.*` ladder for both source states and publication checkpoints so refs alpha-sort in rung order.
- Source states use names like `a.00-blank-slate` and `a.01-source-only`; publication checkpoints use names like `a.02-publication-bootstrapped-woven`.
- Publication output itself should move sequentially on `gh-pages`; each accepted numeric `a.*-woven` publication checkpoint should also fast-forward `gh-pages` to the same commit.
- Treat branch-published rung state as source ref plus publication ref, even if the first implementation stores the source side as deterministic `.assets` rather than as paired source branches.
- Keep `main` clean in the branch-published fixture repo, similar to `a.01-source-only`. Do not merge generated publication output to `main`; the branch-published analog of "merge final rung" is fast-forwarding the publication branch, such as `gh-pages`, to the final generated publication state.
- Reuse Sidecar Fantasy Rules source assets, but mint branch fixture IRIs with the `mesh-branch-fantasy-rules` base.
- The initial source assembly from `.assets` does not need additional provenance modeling beyond the fixture assets existing as deterministic replay inputs.
- Start branch-published publication rungs without multi-source/profile deploy input; add that later when it improves coverage or reduces command noise.
- Store branch-published conformance manifests in `semantic-flow-framework/examples/branch-fantasy-rules/conformance/`, parallel to the sidecar fixture manifests.
- After deploy materializes source bytes into the publication worktree, ordinary extraction and weave operations can run directly in that publication worktree.
- Exercise `.nojekyll` in the fixture. Do not add `CNAME` for this fixture because there is no custom DNS alias; `CNAME` behavior can stay covered by deploy-focused tests.
- Do not record host-local source or publication checkout paths in generated public RDF. Durable provenance should be repository/ref/path/digest-shaped.
- Preserve the existing no-push posture in Weave commands. Fixture branch pushes can remain explicit git operations during fixture maintenance.
- Delete the old experimental `a.source.*` refs now that the numeric `a.*` source/publication ladder is pushed.
- Repository source bindings and extraction-source details should live beside the target Knop as `_knop/_sources/sources.ttl`, with the KnopInventory linking the source registry via `sflo:hasKnopSourceRegistry` and pointing to the primary extraction source with `sflo:hasExtractionSource`. `_mesh/_config/config.ttl` should stay operational config rather than carrying source provenance for included artifacts.

## Contract Changes

- No immediate external Semantic Flow contract change is required just to create the fixture.
- The fixture-ladder generator may gain a branch-published scenario shape with separate source and publication materialization roots.
- Branch-published conformance manifests may need to describe both source-state inputs and publication-state outputs for one transition.
- Deploy/replay manifests may need first-class multi-source command/profile metadata later if repeated single-source CLI invocations become too awkward.

## Testing

- Add fixture-ladder dry-run tests for a `branch-fantasy-rules` scenario before branch writes.
- Add generator tests proving branch-published transitions materialize separate source and publication roots and never update the source root during publication output steps.
- Add integration coverage that final branch-published output has ResourcePages for every mesh-scoped non-file source term IRI, matching the sidecar final-coverage intent.
- Add or reuse deploy tests for local-path leakage, repository source locator RDF, dirty publication-root rejection, preserved publication controls, and local commit behavior.
- Validate each generated rung against Accord manifests, then run focused deploy/fixture tests plus `deno task check` and `deno task lint` after code changes.

## Non-Goals

- Replacing the docs-rooted Sidecar Fantasy Rules fixture.
- Building the guarded rebuild-from-scratch mode from [[wd.task.2026.2026-05-14_1105-guarded-branch-published-rebuild]] as part of the first branch fixture.
- Adding automatic push support to `weave deploy gh-pages`.
- Making the source branch dirty with generated publication files.
- Designing the final universal scenario master manifest unless this fixture exposes a concrete need.

## Implementation Plan

- [x] Confirm Sidecar Fantasy Rules `a.00` through `a.17` refs are pushed and `main` is fast-forwarded to `a.17-all-remaining-terms-woven`.
- [x] Inspect or clone `mesh-branch-fantasy-rules` and record its current branch/remotes/worktree state.
- [x] Choose the first branch naming scheme for source-state and publication-state rungs, preserving the `a.` replay-family prefix.
- [x] Seed the clean source branch from Sidecar Fantasy Rules deterministic assets, changing the mesh base and repository identity to `mesh-branch-fantasy-rules`.
- [x] Add deterministic `.assets` bytes for initial source files and first-release source updates.
- [x] Add the first `semantic-flow-framework/examples/branch-fantasy-rules/conformance/` manifest for the source seed transition.
- [x] Add the branch-published conformance manifest for publication bootstrap.
- [x] Add branch-published conformance manifests for first source materialization.
- [x] Extend `scripts/fixture-ladder.ts` with a `branch-fantasy-rules` source-lane scenario.
- [x] Add dry-run planner tests for the branch-published source-lane scenario before executing generated branches.
- [x] Generate, validate, and push `a.01-source-only` from `a.00-blank-slate`.
- [x] Extend `scripts/fixture-ladder.ts` with branch-published publication-lane execution that can plan separate source and publication materialization roots.
- [x] Regenerate the first publication bootstrap rung and validate no source checkout files were written.
- [x] Regenerate ontology and SHACL materialization/integration/weave rungs using branch-published Knop source registry metadata.
- [x] Add extraction/weave rungs for selected ontology and SHACL terms.
- [x] Add root/examples/Gunaar dataset rungs.
- [x] Add first-release source update and named-release weave rungs.
- [x] Add final all-remaining-terms extraction and broad weave rungs.
- [x] Add representative current-mode canonical ReferenceLink rungs for extracted terms and weave their ReferenceCatalogs.
- [x] Push generated branch-published fixture refs intentionally after validation.
- [x] Fast-forward the publication branch, `gh-pages`, to the latest generated publication rung after review; keep `main` clean source. The temporary preview worktrees were removed, and the dependency checkout now usually sits clean on `gh-pages` for local preview.
- [x] Add final fixture-backed integration coverage for source-cleanliness, publication provenance, and all-term ResourcePage completeness.
- [x] Regenerate and push branch-published `a.05` through `a.15` after moving extraction-source provenance to `_knop/_sources`, adding current-mode representative references, and fixing exact-target ResourcePage generation so release-state pages preserve ancestor history roles.
- [x] Update [[wu.cli-reference]], [[sf.api]] / [[sf.api.examples]], [[ont.summary.core]] (with the new sources supporting artifact) and the mesh-branch-fantasy-rules README.
- [ ] Revisit [[ont.task.2026.2026-03-24-integration-support]] after the `_sources` supporting artifact has settled, especially whether source registries should remain the durable model or move again.
