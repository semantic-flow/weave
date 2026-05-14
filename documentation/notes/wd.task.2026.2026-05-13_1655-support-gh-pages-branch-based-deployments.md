---
id: whl83xf5i9tlp39wceay5cf
title: 2026 05 13_1655 Support Gh Pages Branch Based Deployments
desc: ''
updated: 1778736548328
created: 1778716598190
---

## Goals

- For people for whom a sidecar mesh (in docs) is too much clutter, we need to be able to support the gh-pages publication route
- update [[wu.repository-options]]
- Support ontology and software repositories that want dereferenceable Semantic Flow pages without checking generated mesh support artifacts into their normal source branch.
- Keep the public URL shape stable: branch-based publication should still publish canonical mesh IRIs such as `https://example.github.io/repo/term`, not branch-flavored IRIs.
- Preserve Weave's fail-closed local path behavior while adding an intentional workflow for reading source files from one checkout/worktree and writing mesh output into another.
- Decide whether the Fantasy Rules fixture should move from a `docs/` sidecar example to a `gh-pages` branch example once fixture branches become regenerated outputs.
- Keep branch deployment separate from full fixture ladder generation unless an implementation detail genuinely belongs to both.

## Summary

Some repositories should not carry the generated mesh tree in their normal source branch. Ontology repositories are the immediate pressure point: a repo such as Klaar's URPX ontology may want canonical GitHub Pages publication from `gh-pages`, but may not want a `docs/` directory full of generated histories, inventories, and pages next to the authored ontology source.

The current sidecar pattern assumes a single checkout where the mesh root is a directory inside the source workspace, usually `docs/`. That gives Weave a simple local path story: payload sources can live outside `docs/` but still inside the source repository, and `_mesh/_config/config.ttl` can record `sfcfg:workspaceRootRelativeToMeshRoot ".."` plus constrained `workingLocalRelativePath` grants.

A branch-based deployment is different. The source branch and the publication branch are different filesystem trees, often represented by sibling git worktrees during local generation. Weave needs to read authored source from the source checkout and write the generated mesh into the `gh-pages` checkout, without making the published branch depend on a developer's local sibling-directory layout. This task is about designing and implementing that deployment mode cleanly.

## Discussion

### Repository Topologies

We currently describe two topologies in [[wu.repository-options]]:

- whole-repo mesh: the repository itself is the mesh
- sidecar mesh: the public mesh lives in a directory such as `docs/` inside the source checkout

Branch-based publication should be the third topology:

- branch-published mesh: authored source remains on the normal source branch, generated mesh output lives on a publication branch such as `gh-pages`

This is not merely a naming variant of `docs/` sidecar. It shares the same conceptual goal as sidecar publication, but its operational shape is different because the mesh root is not a subdirectory of the source checkout.

The user-facing docs should probably position branch-published meshes as the best fit for repositories where the source branch should stay clean: ontology repos, vocabulary repos, compact spec repos, and software repos that publish semantic documentation as a projection rather than as checked-in source material.

### Why This Is Not Just `--mesh-root ../repo-gh-pages`

The current runtime can technically be coaxed into reading sibling paths if the mesh config sets a workspace root above both worktrees and grants a relative path such as `../source/ontology/`. That would be a bad public contract.

Those paths are host-local operational facts, not semantic facts about the published mesh. If `_mesh/_config/config.ttl` in the `gh-pages` branch says the source is at `../urpx/ontology/`, the public branch has encoded one developer's checkout layout. A different contributor, CI runner, or downstream clone may not have that sibling directory at all.

The branch-based mode should therefore distinguish:

- durable publication data carried in the `gh-pages` branch
- host-local generation settings that say where the source checkout and publication checkout live today
- semantic source provenance that can name the source repository, source branch, source path, and optionally source commit/ref without implying a local filesystem path

This is the main departure from the existing file-based permission scoping. We should keep file access fail-closed, but the operator's local access grant should not be confused with the published mesh's source provenance.

### Working Source Locators

Current payload metadata leans heavily on `sflo:workingLocalRelativePath` or `sflo:hasWorkingLocatedFile`. That is natural when the source file is inside or adjacent to the mesh root in the same repository checkout. Branch-published meshes need a cleaner distinction.

Possible approaches:

- keep `workingLocalRelativePath` for local generation only, but use host-local config or command options to resolve it against a source checkout that is not published
- introduce a target-neutral source-repository locator shape for branch-published inputs, such as source repository URL, source branch/ref, source path, and expected content digest
- copy current source bytes into a mesh-carried source cache before weaving, then version from that local cache
- require branch-published workflows to integrate from materialized source snapshots and treat the source branch as provenance rather than as the runtime working file

The locator should not be payload-specific. The same general source locator idea should be able to point at authored payload bytes, page-source Markdown, stylesheet assets, local/default config inputs, or any other target material that the publication branch needs to materialize. The binding can be target-specific, but the source-addressing shape should be general.

Raw URLs may be enough for some remote inputs, especially when the URL is immutable and digest-pinned. GitHub raw URLs are not a complete replacement for a branch/ref/path locator, though. A raw branch URL is mutable, loses some repository/ref/path structure unless we parse GitHub-specific URL conventions, and is awkward for private repos, local worktrees, and CI checkouts. A git-oriented locator can still render or resolve through a raw URL when that is useful, but the durable source binding should be able to say "repo + ref + path + digest" directly.

The first implementation should probably avoid minting a broad new locator ontology until the branch-generation workflow exposes the minimum shape. Still, we should not hard-code sibling paths into generated public artifacts as though that were a durable source reference.

### Ontology Shape

The existing target-relator pattern is close to what branch-published meshes need. `ArtifactResolutionTarget` already provides the generic relator boundary, with specialized subclasses such as `ExtractionSource` and `ResourcePageSource`, and properties such as `targetLocalRelativePath`, `targetAccessUrl`, `hasTargetArtifact`, `hasTargetLocatedFile`, `hasTargetDistribution`, `hasRequestedTargetHistory`, `hasRequestedTargetState`, `hasArtifactResolutionMode`, `hasArtifactResolutionFallbackPolicy`, and `expectsContentDigest`.

Repo/ref/path/digest support should extend that pattern rather than introduce a payload-only side channel. The missing piece is a durable source locator that can name a version-control repository, a ref or commit, a path inside that ref, and an expected digest. That locator should be usable from any target relator that needs source bytes, including config materialization, payload integration, page-source Markdown, and assets.

The shape probably belongs in core `sflo` if it describes durable source provenance and target byte identity. Operational trust rules for fetching or reading those sources should remain in config/runtime policy, not in the core source locator itself.

### Clean Source Branch

It should be possible for the normal source branch to contain no Semantic Flow or Weave files at all. In that shape:

- authored ontology/source files live on the normal source branch
- the publication branch carries `_mesh/`, generated pages, histories, inventories, and Weave mesh config
- branch-published config records source bindings using repo/ref/path/digest-style provenance rather than local checkout paths
- host-local checkout paths are supplied by CLI flags, deploy profile state, CI checkout layout, or `.sf-local-access.ttl`

This means `_mesh/_config/config.ttl` can live in `gh-pages` and still be the mesh's durable config. The source branch stays clean. The main caveat is bootstrap: before the `gh-pages` branch exists, Weave needs enough command/profile input to create the first publication branch and seed its config. After that, source-to-target mappings can be maintained on the publication branch.

There is a review tradeoff. If config lives only on `gh-pages`, adding a new target or changing source bindings is a publication-branch change rather than a source-branch change. That may be acceptable for clean source repos, but the workflow should make it visible and reviewable.

### Bootstrap Inputs

API and CLI inputs can provide everything needed for first bootstrap if they are allowed to carry a structured publication request. There are two bootstrap levels that should stay distinct:

- publication-branch bootstrap: create or locate the publication worktree/branch and seed the empty mesh/config shell
- first materialization: bind one or more source inputs to mesh targets and run the first integrate/weave/generate pass

The publication-branch bootstrap can be small. It needs:

- source checkout root or source repository URL
- source ref or commit when the operator wants an explicit pin; otherwise Weave can infer the source repository default branch `HEAD` for initial provenance
- publication checkout root or publication branch name
- mesh base IRI, either supplied explicitly or inferred from GitHub remote metadata when the default project-site URL is appropriate
- publication controls such as branch-create policy, `.nojekyll`, optional `CNAME`, commit/push policy, and preserved-file policy

Initial target bindings are not required just to bootstrap the branch. They are required for the first useful materialization because Weave otherwise does not know which source file should become which mesh target, which source files are config inputs, which page-source assets should be materialized, or what designator paths should be integrated/extracted/generated.

Digests are also not required as operator-supplied bootstrap inputs. If the source ref is mutable or omitted, Weave can compute and record digests during materialization. Digest requirements become more important for deterministic replay, remote-source refresh, and provenance validation.

For the API, this can be a normal structured object. For the CLI, pure flags are possible for publication-branch bootstrap. They get noisy once first materialization involves multiple targets. A first CLI slice can support explicit flags for one or a few targets, but a profile input is likely needed before this is pleasant:

```bash
weave deploy gh-pages --bootstrap-profile publish.weave.json
```

The profile does not have to live in the source repository. It can be provided from outside the repo, from CI configuration, or from an operator's local working directory. If the goal is a completely clean source branch, the bootstrap profile should be treated as an operational input that seeds durable config into the publication branch, not as a file Weave requires on the source branch.

In this task, "publication root" means the local checkout/worktree directory where Weave writes the published mesh. GitHub Pages branch publishing currently serves either the selected branch root or that branch's `/docs` folder. For a `gh-pages` branch deployment, Weave should default to the branch root as both the publication source folder and mesh root, while leaving room for an explicit `/docs` override if a user deliberately chooses that Pages setting.

### Command Shape

There are two plausible command surfaces:

```bash
weave deploy gh-pages --source-root . --publish-root ../repo-gh-pages --mesh-base https://semantic-flow.github.io/repo/
```

or a more general profile-driven form:

```bash
weave deploy --profile gh-pages
```

The profile-driven shape is nicer long term, but the first slice can be explicit if that gets the path semantics and tests right. Important inputs are:

- source checkout root
- publication checkout root
- publication branch name, usually `gh-pages`
- mesh base IRI
- source paths or target designator paths to integrate/version/generate when the command is doing first materialization rather than only branch bootstrap
- whether to initialize/reset the publication branch
- whether to commit and/or push

The command should default to dry-run or no-push behavior until the branch state is inspectable. Creating or force-updating a publication branch should require an explicit flag.

If the publication worktree location is not supplied, the interactive CLI should prompt for it rather than silently guessing a sibling path. It may offer a conventional default such as `../<repo>-gh-pages`, but the operator needs to accept or edit that value before Weave creates or uses the worktree. In non-interactive mode, CI, or when stdin is not a TTY, an omitted publication root should fail with a clear message that points to `--publish-root` or a deploy profile value.

The prompt should be for the local publication worktree path, not for the public base IRI. The mesh base can still be inferred from GitHub remote metadata when that inference is enabled, but a host filesystem path is too consequential to infer and persist without explicit operator confirmation.

### Git Worktree Model

The likely implementation path is to use git worktrees rather than checking out branches in-place:

- source branch remains checked out at the normal repository root
- publication branch is checked out into a sibling temporary or configured worktree
- Weave writes generated mesh files into the publication worktree
- optional commit/push happens from that publication worktree

The workflow should handle:

- missing `gh-pages` branch
- existing `gh-pages` branch
- dirty publication worktree
- stale generated files that should be removed before regeneration
- preserving intentionally carried files such as `CNAME`, `.nojekyll`, or deployment metadata

We should be very conservative about deletes. A publication branch reset is acceptable only behind an explicit flag and after preserving or re-creating known publication control files.

### Workspace Model

Branch-published deployment should not broaden the existing workspace concept so that one workspace casually spans both sibling worktrees. That is exactly the move that would make `../source-repo/...` feel natural in persisted RDF, and that is the shape we are trying to avoid.

For the first implementation, treat the publication root as the active mesh root and publication workspace. It owns `_mesh/`, `_mesh/_config/config.ttl`, generated pages, histories, inventories, validation output, and any publication-branch-local runtime state. Treat the source checkout as a trusted operation input root supplied by CLI, deploy profile, CI layout, or machine-local operational config. The deploy operation can create an in-memory resolver binding from durable source locator facts to that local source root, but the local sibling path must not become a durable mesh fact.

This means branch publication introduces a deploy context with at least two local roots: source root and publication root. That is not the same as redefining every Weave workspace as multi-root. If later daemon or multi-mesh work needs a general multi-root workspace model, it should be designed there; this task only needs enough context to keep clean source branches and fail-closed local access compatible.

### Incremental Publication

Branch-published meshes should be updated incrementally by default rather than overwritten on every run. The publication branch is not just disposable build output once it carries mesh histories, current-state progression, config, inventories, and release pages. Treating it as stateful is unusual for GitHub Pages, but it matches the Semantic Flow model better than rebuilding the branch from scratch every time.

The workflow should still support an explicit rebuild mode for disaster recovery, fixture regeneration, or intentional model churn. That mode should be loud and guarded, for example `--rebuild-from-scratch` plus a dirty-worktree check and an explicit preserved-file list. Default `deploy` should read the existing publication branch, compute the next semantic update, validate it, and commit only meaningful changes.

### Fixture Implications

The Fantasy Rules fixture currently demonstrates a `docs/` sidecar mesh. If we keep only two fixture repos, it may be more useful for Fantasy Rules to demonstrate branch-published ontology delivery instead, because Alice Bio already exercises a whole-repo reference mesh and branch-published deployment is the more urgent ontology case.

This does not mean the `docs/` sidecar pattern goes away. It means the fixture corpus may have better coverage if:

- Alice Bio remains the whole-repo/reference mesh fixture
- Fantasy Rules becomes the branch-published ontology fixture
- docs-rooted sidecar behavior is covered by focused tests or a smaller fixture rather than by the main long ladder

If we make that change, [[wd.task.2026.2026-05-07-fixture-ladder-generator]] should record the new fixture topology before rerunging branches.

Accord now honors `ignorePaths` in whole-tree transition completeness checks. That is useful for branch-generated fixtures: manifests can assert that no unexpected source or publication tree paths changed while still ignoring intentional local-only assets, fixture setup material, or other declared non-contract paths. Branch-published manifests should use this for source-branch cleanliness and publication-branch completeness, and should rely on Accord's conflict checks to reject manifests that both ignore and explicitly expect the same path.

The ordering should be: settle the Semantic Flow Framework Fantasy Rules branch-published spec/example first, prove the branch-published clean-source behavior in a focused temporary-git integration slice, and build enough fixture-generator support to replay the chosen topology. Do not spend a full regeneration pass on the current `docs/` sidecar ladder immediately before replacing that ladder. The actual fixture branch rerung should happen later, once the branch-published topology, repository-source locator RDF, and near-term config/ontology churn are all stable enough to regenerate in one intentional pass.

### GitHub Pages Details

Branch-based GitHub Pages usually serves the root of the selected branch. Weave should make sure the generated branch contains the usual publication affordances:

- `.nojekyll` unless disabled
- optional `CNAME`
- generated `index.html` for the mesh root when the root Knop/page exists
- generated resource pages and historical pages
- no accidental source branch clutter

The canonical base IRI should be independent of the branch name. For GitHub Pages project sites, it is typically `https://<owner>.github.io/<repo>/`; for custom domains, it may be the custom origin.

### CI/Automation

The branch-published workflow should be scriptable in GitHub Actions:

- checkout source branch
- checkout or create `gh-pages` worktree/branch
- run Weave generation
- run validation
- commit generated changes only when there is a diff
- push `gh-pages`

This should eventually support CI permissions that are narrower than a blanket token with arbitrary write access. The task can start locally, but the design should not preclude a safe Action later.

## Open Issues And Working Answers

- Topology name: use `branch-published mesh` in user docs. `gh-pages mesh` is too GitHub-specific, `publication branch mesh` is accurate but clunky, and calling it only a sidecar mesh hides the important operational difference. The docs can describe it as a sidecar-like publication topology implemented through a publication branch.
- Source locators: branch-published targets should not use `workingLocalRelativePath` as their durable source provenance. The first implementation may use command/profile-scoped source-root resolution to read local files, but any persisted source binding should use core `sflo` repository-source locator vocabulary such as `RepositorySourceLocator`, `hasTargetRepositorySource`, `sourceRepositoryUrl`, `sourceRepositoryRef`, `sourceRepositoryCommit`, `sourceRepositoryPath`, and `hasContentDigest` / `expectsContentDigest`.
- Core versus config: repo/ref/path/digest identity belongs in core `sflo` as reusable source locator vocabulary that composes with `ArtifactResolutionTarget`; this vocabulary should land early, if not first, so the branch-published proof slice does not grow around temporary path-shaped RDF. Operational policy for resolving that locator, deciding whether network or local git access is allowed, and mapping it to a local checkout belongs in config/runtime policy.
- Clean source branch: `_mesh/_config/config.ttl` on the publication branch should be enough to support a source branch with no Semantic Flow or Weave files. This is the point of the topology. The source branch may still opt into carrying a bootstrap profile or authored config later, but that must not be required.
- Bootstrap surface: keep explicit flags for the first narrow CLI slice, but design the API around a structured request and make a deploy profile the pleasant path before target bindings become numerous. A completely clean source branch means the profile can live outside the source repo and seed durable config into the publication branch.
- Inference defaults: infer only values that are conventional and inspectable. Source ref can default to the checked-out source `HEAD`; mesh base can be inferred from GitHub remote/project Pages metadata when unambiguous; `gh-pages` should default to branch-root publication. The publication worktree path should be prompted for interactively or required non-interactively, not silently guessed.
- Bootstrap versus materialization: model publication-branch bootstrap and first materialization as separate phases. One CLI command may perform both when target bindings are supplied, but the planner and tests should prove the phases independently.
- Host-local paths: allow CLI flags, deploy profile values, CI environment/request data, and higher-trust local config to supply source and publication roots. Do not write those roots, or grants derived from their sibling relationship, into the public `gh-pages` branch.
- Cross-worktree access: cross-worktree source access should be host-local and command-scoped for the first implementation. A publication branch may carry durable source provenance and project-local expectations, but it should not grant itself arbitrary sibling checkout access.
- Durable source binding model: use git repository/ref/path/digest as the default durable model, with raw URLs as optional access/rendering forms. URL-first bindings are too lossy for private repos, local worktrees, branch/ref semantics, and digest-pinned replay.
- Preserved files: normal incremental deployment should preserve unknown non-generated files by default, and always preserve or recreate configured publication control files such as `.nojekyll` and `CNAME`. Reset/rebuild mode needs an explicit preserved-file policy and should refuse a dirty publication worktree unless forced.
- Command composition: the deploy command should orchestrate existing mesh create, integrate/version/weave/generate seams rather than invent a parallel generator. It can expose a higher-level workflow because the branch-published operator experience is different, but the internal semantic operations should remain recognizable and testable.
- No semantic payload change: if the source branch changes but resolved source bytes or semantic output do not change, Weave should validate, report no publication diff, and skip commit/push by default. Provenance-only updates, such as recording a new source commit for identical bytes, should be explicit policy rather than accidental churn.
- Rebuild mode: rebuild-from-scratch should exist, but only after incremental update behavior is proven. It should be a separate loud mode or guarded flag, not the default deploy path.
- Fixture placement: prefer converting Fantasy Rules to the branch-published ontology fixture if we keep only two main fixture repos. If that creates too much churn during fixture ladder regeneration, create focused temporary-git integration coverage first and defer the fixture move through [[wd.task.2026.2026-05-07-fixture-ladder-generator]].
- Fixture regeneration timing: rewrite the Semantic Flow Framework Fantasy Rules spec/example and build focused branch-published proof coverage before rerunging fixture branches. Build fixture-generator machinery early enough to avoid manual repair, but defer full branch-ladder regeneration until the topology and vocabulary are stable.
- Git automation boundary: Weave should own safe local planning, worktree discovery/creation, dirty-state checks, generation, validation, and optional commit creation. Push policy and CI credentials should remain explicit operator/CI concerns, with documented snippets rather than hidden automation.
- Vocabulary timing: the durable design needs core ontology vocabulary for repo/ref/path/digest source locators early, preferably before the first branch-published materialization slice. The proof slice can still take local source roots from runtime/deploy request data, but the RDF shape for persisted source provenance should already be the core locator shape rather than a throwaway branch-deploy special case.
- Workspace concept: do not re-address the general workspace model for this task. Define a branch deploy context with source root plus publication root, keep the publication root as the active mesh workspace, and treat the source root as a trusted operation input. Re-open the broader workspace concept only if daemon, multi-mesh, or long-lived multi-root use cases demand it.
- First implementation acceptance slice: prove the clean-source-branch story before adding fancy publishing automation. The source branch should contain only ontology/source files, the `gh-pages` branch should carry all `_mesh`, config, generated pages, histories, and inventories, no local sibling paths should appear in public RDF or generated config, and a second run should update incrementally.

## Decisions

- Branch-based publication is a first-class repository topology, not merely an accidental use of `--mesh-root` with a sibling path.
- User-facing docs should call the topology `branch-published mesh`.
- The public mesh base IRI must not include or expose the publication branch name.
- Do not encode developer-specific sibling checkout paths as durable public mesh facts.
- The design should allow the normal source branch to remain free of Semantic Flow and Weave files; durable mesh config may live on the publication branch.
- API/CLI bootstrap inputs may provide everything needed to create the first publication branch and seed its durable mesh config.
- Source ref, mesh base, and publication source folder may be inferred for common GitHub project-site cases, while remaining explicit/overrideable.
- The interactive CLI should prompt for the publication worktree path when it is omitted; non-interactive runs should require `--publish-root` or a deploy profile value.
- Branch-published deployment uses a deploy context with a source root and a publication root; it does not redefine the general workspace model. The publication root is the active mesh workspace, while the source root is a trusted operation input.
- Default branch-published deployment should update the existing publication branch incrementally rather than overwrite it from scratch.
- Keep write/push behavior explicit; branch publication should be dry-run or local-only until the operator opts into committing/pushing.
- Preserve the existing `docs/` sidecar pattern as valid even if the Fantasy Rules fixture moves to branch-published publication.

## Contract Changes

- Weave should gain a documented branch-published mesh workflow for source repos that publish generated mesh output from a dedicated branch.
- User-facing repository topology docs should describe whole-repo, directory sidecar, and branch-published options.
- Branch-published source bindings should be target-neutral rather than payload-only, so config inputs, payload bytes, page sources, and assets can use the same addressing model.
- Core ontology includes initial repo/ref/path/digest source locator vocabulary that extends the existing target-relator pattern.
- Runtime/deploy config may need to distinguish host-local source checkout access from durable mesh-carried source provenance.
- CLI/API surface may gain a deploy command or profile that accepts source root, publication root/branch, mesh base, and safe write/push flags.
- Interactive CLI execution should prompt for a missing publication worktree path; CI and other non-interactive execution should fail closed unless the path is supplied.
- Fixture expectations may change if the Fantasy Rules fixture stops using `docs/` and becomes the branch-published ontology fixture.
- The Semantic Flow Framework Fantasy Rules example/spec should be rewritten around the branch-published ontology shape before the fixture ladder is rerung.
- Full fixture branch regeneration should be a later generated-output pass, not a prerequisite for the first branch-published implementation slice.

## Testing

- Add focused unit tests for deploy/profile argument parsing once the command shape is selected.
- Add path-policy tests proving cross-worktree source access is fail-closed unless explicitly granted by host-local config or command-scoped options.
- Add tests proving public mesh config does not serialize developer-specific sibling checkout paths into publication output.
- Add tests proving the source branch can remain free of `_mesh`, `.weave`, `docs`, or other Weave/Semantic Flow generated files while the publication branch carries the mesh.
- Add tests proving bootstrap API/CLI inputs can seed a publication branch from a clean source branch.
- Add tests for bootstrap inference: omitted source ref uses default-branch `HEAD`, GitHub remote metadata can infer the default mesh base, and `gh-pages` defaults to branch-root publication.
- Add tests proving normal deployment updates an existing publication branch incrementally, while rebuild/reset behavior requires an explicit guarded flag.
- Add local integration coverage using a temporary git repo with a source branch and a `gh-pages` worktree.
- Add CLI coverage proving omitted publication root prompts interactively and fails closed in non-interactive mode.
- Verify generation preserves `.nojekyll` and configured `CNAME`, removes stale generated files only when requested, and refuses dirty publication worktrees by default.
- Add fixture or focused coverage for a branch-published ontology source where authored source stays off the publication branch.
- If Fantasy Rules moves to branch-published output, update its Accord manifests and fixture helper assumptions through [[wd.task.2026.2026-05-07-fixture-ladder-generator]], using whole-tree completeness checks plus `ignorePaths` for intentional non-contract paths.
- Rewrite the Semantic Flow Framework Fantasy Rules example/spec so the conformance story names source-branch authored ontology files, publication-branch mesh output, and repository-source locator provenance.
- Run `deno task lint` after significant implementation changes.

## Non-Goals

- Replacing ordinary `docs/` sidecar publication.
- Requiring every repository to use git branches or GitHub Pages.
- Designing a universal static-site deploy system for all hosts.
- Force-pushing or deleting publication branch content by default.
- Solving fixture ladder regeneration directly.
- Hiding source provenance; branch-published meshes still need to say where their source material came from, just not as host-local checkout paths.

## Implementation Plan

- [ ] Confirm terminology and update [[wu.repository-options]] with a branch-published topology section.
- [x] Add initial core `sflo` repository-source locator vocabulary for durable repo/ref/path/digest provenance.
- [ ] Confirm first implementation source-binding scope: command/profile-scoped local resolution is allowed for the proof slice, but any persisted binding needs target-neutral repo/ref/path/digest rather than `workingLocalRelativePath`.
- [ ] Define the minimum source binding shape for repo/ref/path/digest inputs, including when raw URLs are acceptable.
- [x] Draft the core ontology change for a repo/ref/path/digest locator that composes with `ArtifactResolutionTarget`.
- [x] Define bootstrap API/CLI inputs for creating the first publication branch from a clean source branch.
- [x] Split publication-branch bootstrap from first materialization in the deploy model, even if one CLI command can perform both.
- [ ] Define inference rules and override flags for source ref, mesh base, and publication source folder.
- [x] Add interactive prompting for missing publication worktree path and non-interactive fail-closed behavior when no path/profile is supplied.
- [x] Define the branch deploy context as source root plus publication root without broadening the general workspace model.
- [ ] Draft the local generation workflow for source checkout plus publication worktree, including dirty-worktree and branch initialization guardrails.
- [ ] Add a dry-run planner for the branch-published workflow that prints source root, publication root, mesh base, generated paths, preserved files, and git operations that would run.
- [ ] Add path-policy tests for cross-worktree source access and host-local grants.
- [x] Create the first branch-published Fantasy Rules source-only proof ref and Accord manifest (`bp-01-source-only`) in the existing fixture repo/SFF conformance area.
- [x] Implement local-only branch-published publication-root bootstrap through `weave deploy gh-pages`.
- [x] Add focused bootstrap tests proving the source root stays free of `_mesh`/`.weave`, publication root carries `_mesh` plus config, public config has no sibling path leakage, and a second bootstrap run is a no-op.
- [ ] Implement local-only branch-published generation for one simple ontology source in a temporary git repo.
- [ ] Prove the first clean-source-branch slice: source branch contains only authored source, publication branch carries all `_mesh` and generated state, public RDF has no sibling path leakage, and a rerun updates incrementally.
- [x] Update [[wd.task.2026.2026-05-07-fixture-ladder-generator]] to make fixture-generator work early but full fixture branch rerunging later, after branch-published topology and vocabulary are stable.
- [ ] Add `.nojekyll` and optional `CNAME` preservation behavior.
- [ ] Add validation that generated public mesh output does not include stale source-branch clutter or developer-specific sibling checkout paths.
- [ ] Implement incremental publication-branch updates as the default behavior.
- [ ] Add a guarded rebuild-from-scratch mode only after incremental updates are proven.
- [ ] Add explicit commit/push flags after local generation is proven.
- [ ] Decide whether to convert the Fantasy Rules fixture from `docs/` sidecar to branch-published output before the next fixture rerung.
- [x] Rewrite the Semantic Flow Framework Fantasy Rules example/spec for branch-published ontology delivery before rerunging fixture branches.
- [x] Update [[wd.task.2026.2026-05-07-fixture-ladder-generator]] if the fixture topology changes.
- [ ] Update [[wd.decision-log]] once the topology and path-provenance decisions are accepted.
