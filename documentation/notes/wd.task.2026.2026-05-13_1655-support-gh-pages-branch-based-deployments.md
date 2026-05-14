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

The first implementation should use the initial core repository-source locator vocabulary for the durable RDF shape, even while local source resolution remains command/profile-scoped. We should not hard-code sibling paths into generated public artifacts as though that were a durable source reference.

### Ontology Shape

The existing target-relator pattern is close to what branch-published meshes need. `ArtifactResolutionTarget` already provides the generic relator boundary, with specialized subclasses such as `ExtractionSource` and `ResourcePageSource`, and properties such as `targetLocalRelativePath`, `targetAccessUrl`, `hasTargetArtifact`, `hasTargetLocatedFile`, `hasTargetDistribution`, `hasRequestedTargetHistory`, `hasRequestedTargetState`, `hasArtifactResolutionMode`, `hasArtifactResolutionFallbackPolicy`, and `expectsContentDigest`.

Repo/ref/path/digest support should extend that pattern rather than introduce a payload-only side channel. The missing piece is a durable source locator that can name a version-control repository, a ref or commit, a path inside that ref, and an expected digest. That locator should be usable from any target relator that needs source bytes, including config materialization, payload integration, page-source Markdown, and assets.

The shape probably belongs in core `sflo` if it describes durable source provenance and target byte identity. Operational trust rules for fetching or reading those sources should remain in config/runtime policy, not in the core source locator itself.

### Source Binding Contract

A branch-published source binding has two deliberately separate halves:

- operation-local resolution: deploy receives a trusted local `sourceRoot` plus repository-relative `sourcePath` from CLI flags, a deploy profile, CI checkout layout, or host-local runtime state. This local root may be a sibling git worktree, but it is command-scoped input to the deploy operation, not durable mesh config.
- durable publication binding: `_mesh/_config/config.ttl` records the target and source identity using `ArtifactResolutionTarget` plus `RepositorySourceLocator` vocabulary. The durable facts are target designator, target publication-relative path, expected digest, source repository URL, source ref, optional source commit, source repository-relative path, and content digest.

The publication branch should not persist any of the following merely because a deploy read from a sibling source checkout:

- `sfcfg:workspaceRootRelativeToMeshRoot` that expands the publication workspace to include the source checkout
- `sfcfg:hasLocalPathAccessRule` granting access back to the source checkout
- `sflo:workingLocalRelativePath` pointing at `../source/...` or another host-local layout
- absolute local paths, file URLs, or other machine-specific checkout locations

Host-local grants such as `.sf-local-access.ttl` remain valid for lower-level operations that intentionally resolve extra-mesh `workingLocalRelativePath` values, but branch-published deploy should not require or mint such grants for its normal `sourceRoot` path. Deploy materializes source bytes into a publication-root relative target path first, then integrates/weaves from that publication-local copy. The durable config records provenance and byte identity, not the operator's checkout topology.

The minimum durable source binding shape for the first implementation is:

- `ArtifactResolutionTarget` for the binding relator
- `sflo:hasTargetArtifact` for the designator being materialized
- `sflo:targetLocalRelativePath` for the publication-root relative target path
- `sflo:expectsContentDigest` for the target bytes Weave expects to publish
- `sflo:hasTargetRepositorySource` pointing to a `RepositorySourceLocator`
- `sflo:sourceRepositoryUrl` for the durable repository identity or equivalent repository access URL
- `sflo:sourceRepositoryRef` for the symbolic or explicit ref used as source provenance
- `sflo:sourceRepositoryCommit` when an exact commit is known and honestly describes the materialized bytes
- `sflo:sourceRepositoryPath` for the repository-relative source path
- `sflo:hasContentDigest` for the source bytes that were actually materialized

Raw URLs are acceptable as access/rendering hints, or as the repository/source URL for non-git immutable resources that are digest-pinned. For git-hosted source material, URL-only bindings are too lossy as the primary durable identity because branch raw URLs are mutable and do not clearly preserve repository/ref/path structure. A GitHub raw commit URL can be useful, but the structured repo/ref-or-commit/path/digest locator should remain the canonical binding when the source is in git.

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
- source ref or commit when the operator wants an explicit pin; otherwise Weave can infer only clean, inspectable git facts such as the checked-out branch and exact `HEAD` commit
- publication checkout root or publication branch name
- mesh base IRI, either supplied explicitly or inferred from GitHub remote metadata when the default project-site URL is appropriate
- publication controls such as branch-create policy, `.nojekyll`, optional `CNAME`, local commit policy, and preserved-file policy

Initial target bindings are not required just to bootstrap the branch. They are required for the first useful materialization because Weave otherwise does not know which source file should become which mesh target, which source files are config inputs, which page-source assets should be materialized, or what designator paths should be integrated/extracted/generated.

Digests are also not required as operator-supplied bootstrap inputs. If the source ref is mutable or omitted, Weave can compute and record digests during materialization. Digest requirements become more important for deterministic replay, remote-source refresh, and provenance validation.

For the API, this can be a normal structured object. For the CLI, pure flags are possible for publication-branch bootstrap. They get noisy once first materialization involves multiple targets. A first CLI slice can support explicit flags for one or a few targets, but a profile input is likely needed before this is pleasant:

```bash
weave deploy gh-pages --bootstrap-profile publish.weave.json
```

The profile does not have to live in the source repository. It can be provided from outside the repo, from CI configuration, or from an operator's local working directory. If the goal is a completely clean source branch, the bootstrap profile should be treated as an operational input that seeds durable config into the publication branch, not as a file Weave requires on the source branch.

In this task, "publication root" means the local checkout/worktree directory where Weave writes the published mesh. GitHub Pages branch publishing currently serves either the selected branch root or that branch's `/docs` folder. For a `gh-pages` branch deployment, Weave should default to the branch root as both the publication source folder and mesh root, while leaving room for an explicit `/docs` override if a user deliberately chooses that Pages setting.

### Inference Rules

Inference should be conservative, inspectable, and visible in dry-run output. Weave should infer only values it can derive from the supplied source/publication roots without network magic or ambiguous repository conventions. Any inferred value should be overrideable by CLI flag or deploy profile, and host-local paths must never be persisted as durable mesh facts.

Publication worktree location is not inferred. In non-interactive runs, deploy requires `--publish-root` or a deploy profile value. In interactive runs, Weave may offer a conventional sibling default such as `../<repo>-gh-pages`, but the operator must accept or edit that path before Weave uses it.

Publication source folder defaults to the branch root for `gh-pages` branch publishing. A future explicit override can support repositories configured to serve `/docs` from the publication branch, but the first branch-published surface should treat publication root as the mesh root and generated Pages source.

Source repository URL can be inferred from the source checkout only when git metadata is available and one durable remote is unambiguous. Prefer `origin` when present; otherwise accept a single configured remote. If there are multiple plausible remotes, no remote, or a local-only remote that is not a durable publication identity, require `--source-repository-url` or a profile value.

Source repository ref can be inferred from a git source checkout when `git symbolic-ref --short HEAD` returns a branch name. Detached `HEAD` should not silently become a symbolic source ref; in that case Weave should require an explicit source ref or use an explicit commit-like ref only when the operator/profile asks for that behavior. Tags, full refs, and commit SHAs supplied by the operator should be preserved rather than rewritten.

Source repository commit can be inferred with `git rev-parse HEAD` only when the source checkout is clean enough for the commit to honestly describe the source bytes being materialized. If the source checkout has uncommitted changes that affect materialized inputs, Weave should either omit `sourceRepositoryCommit` and rely on the digest, or require an explicit override that makes the provenance policy visible. Recording `HEAD` as the source commit for dirty working-tree bytes would be misleading.

Mesh base can be inferred only for clear GitHub Pages project-site cases, such as an unambiguous GitHub remote for `owner/repo` plus the default project-site base `https://<owner>.github.io/<repo>/`. Custom domains, user/organization sites, enterprise GitHub hosts, non-GitHub remotes, and multiple remotes should require `--mesh-base` or a profile value until richer Pages metadata support exists.

Publication branch name may default to `gh-pages` for worktree creation/planning, but the public mesh base must not include or expose the branch name. Commit and push behavior should never be inferred from branch names or remotes; it remains explicit operator or CI policy.

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

### Dry-Run Surface

The first deploy workflow surface is local-only and inspectable:

```bash
weave deploy gh-pages --dry-run --source-root . --publish-root ../repo-gh-pages --mesh-base https://example.github.io/repo/
```

Dry-run performs the same input validation as the write path, including source/publication root checks, dirty publication worktree enforcement unless explicitly skipped, stale output rejection, and generated-RDF local-path leakage checks. It then simulates the deploy in an isolated temporary copy of the publication root so the reported path set comes from the same mesh create, source materialization, integrate, payload update, and weave operations that the real deploy would use.

The human-facing plan should print the source root, publication root, mesh base, mesh IRI, paths that would be created, paths that would be updated, existing files that would be preserved unchanged, materialized source provenance including digest when a source binding is supplied, validation checks, and git operations. For the first slice, git operations are intentionally limited to worktree inspection; Weave writes local files but does not commit unless an explicit commit flag is added, and does not push.

### Git Worktree Model

The likely implementation path is to use git worktrees rather than checking out branches in-place:

- source branch remains checked out at the normal repository root
- publication branch is checked out into a sibling temporary or configured worktree
- Weave writes generated mesh files into the publication worktree
- optional local commit happens from that publication worktree; push remains an explicit operator or CI action outside the first commit-support slice

The workflow should handle:

- missing `gh-pages` branch
- existing `gh-pages` branch
- dirty publication worktree
- stale generated files that should be removed before regeneration
- preserving intentionally carried files such as `CNAME`, `.nojekyll`, or deployment metadata

We should be very conservative about deletes. A publication branch reset is acceptable only behind an explicit flag and after preserving or re-creating known publication control files.

### Local Generation Workflow

The local workflow should be split into phases that make the branch boundary visible:

1. Resolve deploy inputs from CLI flags, deploy profile, CI environment, or prompts. Required roots are the source checkout root and publication root. The mesh base and source binding facts may be explicit or inferred only under the conservative rules above.
2. Inspect the source checkout. Confirm it exists, is distinct from the publication root, and contains each requested repository-relative source path. If source repository URL, ref, or commit are inferred, record whether they came from git remote metadata, symbolic `HEAD`, or exact `HEAD` commit. Dirty source checkouts are allowed for local byte materialization, but they should prevent silently recording `HEAD` as the source commit for changed bytes.
3. Resolve the publication worktree. If `--publish-root` names an existing directory, use that directory after root-overlap and dirty-worktree checks. If a future profile/flag asks Weave to create the worktree, require an explicit branch/create policy before running `git worktree add`; do not switch the source checkout in-place.
4. Inspect publication state before writing. Reject dirty publication git worktrees by default, reject partial branch-published mesh bootstrap state, reject stale local/publication clutter such as `.weave`, `.sf-local-access.ttl`, or old `docs/_mesh`, and report preserved non-generated files. Dry-run should perform the same checks before simulating writes in a temporary copy.
5. Bootstrap or reuse the publication mesh. If no `_mesh/_meta`, `_mesh/_inventory`, and `_mesh/_config` bootstrap exists, create the minimal mesh shell in the publication root. If all exist, reuse them only when the requested mesh base matches. If only some exist, fail closed rather than guessing how to repair them.
6. Materialize source bindings. For each binding, read bytes from `sourceRoot/sourcePath`, compute the digest, copy/update the publication-root relative target path, upsert the `RepositorySourceLocator` block in publication config, and run existing integrate/payload-update/weave operations from the publication-local target bytes. This keeps normal generation inside the publication workspace after the initial command-scoped read.
7. Validate generated publication output. Scan generated RDF for source/publication root paths and parent traversal, preserve publication controls such as `.nojekyll` and configured `CNAME`, and report created, updated, preserved, and woven paths. Later Accord checks can sit after this phase for fixture or CI acceptance.
8. Leave git publication actions explicit. The local write path stops after validated file writes unless `--commit` is supplied. When commit support is requested, Weave stages the publication worktree after validation, creates a local commit only when there is a publication diff, and prints a reminder that the publication branch still needs to be pushed for GitHub Pages to update. Push support should remain a separate explicit operator/CI policy.

The guardrails are intentionally stricter than a generic static-site build:

- never infer or persist the local publication worktree path
- never broaden the publication mesh workspace to include the sibling source checkout
- never create source-branch `_mesh`, `.weave`, `docs`, or `.sf-local-access.ttl` state as part of branch-published deploy
- never create, reset, or force-update a publication branch without an explicit branch policy flag or profile setting
- never delete unknown publication files during normal incremental deploy
- never record an exact source commit for bytes that are not actually represented by that commit
- never let commit or push happen as a side effect of a command whose surface only promised local generation

The first implementation now covers the local-write subset and explicit local commit slice of this workflow. Worktree creation and source-ref/mesh-base inference should remain separate guarded slices rather than being folded into the basic materialization path. Push stays out of the first commit-support slice; when Weave creates a local publication commit, the CLI clearly tells the operator that the commit must still be pushed for GitHub Pages to go live. Rebuild-from-scratch belongs in [[wd.task.2026.2026-05-14_1105-guarded-branch-published-rebuild]].

### Workspace Model

Branch-published deployment should not broaden the existing workspace concept so that one workspace casually spans both sibling worktrees. That is exactly the move that would make `../source-repo/...` feel natural in persisted RDF, and that is the shape we are trying to avoid.

For the first implementation, treat the publication root as the active mesh root and publication workspace. It owns `_mesh/`, `_mesh/_config/config.ttl`, generated pages, histories, inventories, validation output, and any publication-branch-local runtime state. Treat the source checkout as a trusted operation input root supplied by CLI, deploy profile, CI layout, or machine-local operational config. The deploy operation can create an in-memory resolver binding from durable source locator facts to that local source root, but the local sibling path must not become a durable mesh fact.

This means branch publication introduces a deploy context with at least two local roots: source root and publication root. That is not the same as redefining every Weave workspace as multi-root. If later daemon or multi-mesh work needs a general multi-root workspace model, it should be designed there; this task only needs enough context to keep clean source branches and fail-closed local access compatible.

### Incremental Publication

Branch-published meshes should be updated incrementally by default rather than overwritten on every run. The publication branch is not just disposable build output once it carries mesh histories, current-state progression, config, inventories, and release pages. Treating it as stateful is unusual for GitHub Pages, but it matches the Semantic Flow model better than rebuilding the branch from scratch every time.

The workflow should still support an explicit rebuild mode for disaster recovery, fixture regeneration, or intentional model churn. That mode should be loud and guarded, for example `--rebuild-from-scratch` plus a dirty-worktree check and an explicit preserved-file list. It is deferred to [[wd.task.2026.2026-05-14_1105-guarded-branch-published-rebuild]] so ordinary deploy can remain incremental by default. Default `deploy` should read the existing publication branch, compute the next semantic update, validate it, and optionally create a local commit only when requested.

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
- push `gh-pages` explicitly from CI or the operator's release workflow

This should eventually support CI permissions that are narrower than a blanket token with arbitrary write access. The task can start locally, but the design should not preclude a safe Action later.

## Open Issues And Working Answers

- Topology name: use `branch-published mesh` in user docs. `gh-pages mesh` is too GitHub-specific, `publication branch mesh` is accurate but clunky, and calling it only a sidecar mesh hides the important operational difference. The docs can describe it as a sidecar-like publication topology implemented through a publication branch.
- Source locators: branch-published targets should not use `workingLocalRelativePath` as their durable source provenance. The first implementation may use command/profile-scoped source-root resolution to read local files, but any persisted source binding should use core `sflo` repository-source locator vocabulary such as `RepositorySourceLocator`, `hasTargetRepositorySource`, `sourceRepositoryUrl`, `sourceRepositoryRef`, `sourceRepositoryCommit`, `sourceRepositoryPath`, and `hasContentDigest` / `expectsContentDigest`.
- Core versus config: repo/ref/path/digest identity belongs in core `sflo` as reusable source locator vocabulary that composes with `ArtifactResolutionTarget`; this vocabulary should land early, if not first, so the branch-published proof slice does not grow around temporary path-shaped RDF. Operational policy for resolving that locator, deciding whether network or local git access is allowed, and mapping it to a local checkout belongs in config/runtime policy.
- Clean source branch: `_mesh/_config/config.ttl` on the publication branch should be enough to support a source branch with no Semantic Flow or Weave files. This is the point of the topology. The source branch may still opt into carrying a bootstrap profile or authored config later, but that must not be required.
- Bootstrap surface: keep explicit flags for the first narrow CLI slice, but design the API around a structured request and make a deploy profile the pleasant path before target bindings become numerous. A completely clean source branch means the profile can live outside the source repo and seed durable config into the publication branch.
- Inference defaults: infer only values that are conventional and inspectable. Source repository URL can come from an unambiguous durable git remote, source ref can come from a symbolic checked-out branch, source commit can come from `HEAD` only when it honestly describes the materialized bytes, mesh base can come from GitHub remote/project Pages metadata when unambiguous, and `gh-pages` should default to branch-root publication. The publication worktree path should be prompted for interactively or required non-interactively, not silently guessed.
- Bootstrap versus materialization: model publication-branch bootstrap and first materialization as separate phases. One CLI command may perform both when target bindings are supplied, but the planner and tests should prove the phases independently.
- Host-local paths: allow CLI flags, deploy profile values, CI environment/request data, and higher-trust local config to supply source and publication roots. Do not write those roots, or grants derived from their sibling relationship, into the public `gh-pages` branch.
- Cross-worktree access: cross-worktree source access should be host-local and command-scoped for the first implementation. A publication branch may carry durable source provenance and project-local expectations, but it should not grant itself arbitrary sibling checkout access.
- Local generation workflow: resolve/inspect source and publication roots, reject unsafe publication state, bootstrap or reuse the publication mesh, materialize source bindings into publication-local target files, validate output, and stop before git commit unless explicit future flags request that action. Push remains external to the first commit-support slice.
- Durable source binding model: use git repository/ref/path/digest as the default durable model, with raw URLs as optional access/rendering forms. URL-first bindings are too lossy for private repos, local worktrees, branch/ref semantics, and digest-pinned replay.
- Preserved files: normal incremental deployment should preserve unknown non-generated files by default, and always preserve or recreate configured publication control files such as `.nojekyll` and `CNAME`. Reset/rebuild mode needs an explicit preserved-file policy and should refuse a dirty publication worktree unless forced.
- Command composition: the deploy command should orchestrate existing mesh create, integrate/version/weave/generate seams rather than invent a parallel generator. It can expose a higher-level workflow because the branch-published operator experience is different, but the internal semantic operations should remain recognizable and testable.
- No semantic payload change: if the source branch changes but resolved source bytes or semantic output do not change, Weave should validate, report no publication diff, skip local commit by default, and never push implicitly. Provenance-only updates, such as recording a new source commit for identical bytes, should be explicit policy rather than accidental churn.
- Default history policy: the branch-published proof path should float with the current default effective config. In particular, it must not create `_mesh/_inventory`, `_knop/_meta`, or `_knop/_inventory` history merely to preserve old fixture-ladder shapes. Legacy/versioned inventory shapes belong behind explicit non-default policy and can remain covered by Alice Bio or other compatibility fixtures.
- Default-history proof: the focused branch-published materialization slice now keeps MeshInventory, KnopMetadata, and KnopInventory current-only under runtime defaults while preserving the old explicit/versioned core shape when non-default policies are supplied.
- Dirty publication roots: branch-published deploy now refuses a dirty publication git worktree root by default. Operators can explicitly opt into dirty-root deployment for local experimentation, but the default path requires committed/stashed/clean publication state before Weave writes generated output.
- Publication controls: branch-published deploy preserves unknown files by leaving them alone, recreates `.nojekyll` when GitHub Pages protection is enabled, and can create or update a configured `CNAME` without persisting local checkout paths.
- Stale output validation: branch-published deploy rejects known stale local/publication clutter such as `.weave`, `.sf-local-access.ttl`, and old `docs/_mesh` sidecar output, then scans generated RDF support files for local source/publication root paths or parent-directory traversal before reporting success.
- Rebuild mode: rebuild-from-scratch should exist, but only as a separate guarded task after incremental update behavior is proven. Track it in [[wd.task.2026.2026-05-14_1105-guarded-branch-published-rebuild]] rather than bundling it into the first branch-published deploy path.
- Fixture placement: prefer converting Fantasy Rules to the branch-published ontology fixture if we keep only two main fixture repos. If that creates too much churn during fixture ladder regeneration, create focused temporary-git integration coverage first and defer the fixture move through [[wd.task.2026.2026-05-07-fixture-ladder-generator]].
- Fixture regeneration timing: rewrite the Semantic Flow Framework Fantasy Rules spec/example and build focused branch-published proof coverage before rerunging fixture branches. Build fixture-generator machinery early enough to avoid manual repair, but defer full branch-ladder regeneration until the topology and vocabulary are stable.
- Git automation boundary: Weave owns safe local planning, dirty-state checks, generation, validation, and explicit optional local commit creation. Worktree discovery/creation remains a future guarded slice. Push policy and CI credentials should remain explicit operator/CI concerns, with documented snippets rather than hidden automation. If Weave creates a local publication commit, the CLI warns that the operator or CI still needs to push it before the site updates.
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
- Source repository URL, source ref, source commit, mesh base, and publication source folder may be inferred only when local git/Pages conventions make them unambiguous and honest, while remaining explicit/overrideable.
- Branch-published source bindings separate operation-local `sourceRoot` resolution from durable repo/ref/path/digest publication facts; deploy must not persist sibling worktree paths or local path grants as source provenance.
- Raw URLs are secondary access/rendering hints for git-hosted source material; the canonical durable binding for git sources is structured repository/ref-or-commit/path/digest provenance.
- Branch-published local generation should use git worktrees rather than in-place branch switching, reject dirty or partial publication state by default, reserve branch creation and commit creation for explicit guarded flags or profile settings, defer rebuild mode to [[wd.task.2026.2026-05-14_1105-guarded-branch-published-rebuild]], and leave push as an explicit external action.
- The interactive CLI should prompt for the publication worktree path when it is omitted; non-interactive runs should require `--publish-root` or a deploy profile value.
- Branch-published deployment uses a deploy context with a source root and a publication root; it does not redefine the general workspace model. The publication root is the active mesh workspace, while the source root is a trusted operation input.
- Default branch-published deployment should update the existing publication branch incrementally rather than overwrite it from scratch.
- Branch-published deployment should follow default current-only MeshInventory, KnopMetadata, and KnopInventory behavior unless the operator/config explicitly requests versioned support history.
- Keep write and git behavior explicit; branch publication should be dry-run or local-only until the operator opts into local commit creation, and push remains outside the first commit-support slice.
- Preserve the existing `docs/` sidecar pattern as valid even if the Fantasy Rules fixture moves to branch-published publication.

## Contract Changes

- Weave should gain a documented branch-published mesh workflow for source repos that publish generated mesh output from a dedicated branch.
- User-facing repository topology docs should describe whole-repo, directory sidecar, and branch-published options.
- Branch-published source bindings should be target-neutral rather than payload-only, so config inputs, payload bytes, page sources, and assets can use the same addressing model.
- Core ontology includes initial repo/ref/path/digest source locator vocabulary that extends the existing target-relator pattern.
- Runtime/deploy config may need to distinguish host-local source checkout access from durable mesh-carried source provenance.
- CLI/API surface may gain a deploy command or profile that accepts source root, publication root/branch, mesh base, and safe local write/commit flags.
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

- [x] Confirm terminology and update [[wu.repository-options]] with a branch-published topology section.
- [x] Add initial core `sflo` repository-source locator vocabulary for durable repo/ref/path/digest provenance.
- [x] Confirm first implementation source-binding scope: command/profile-scoped local resolution is allowed for the proof slice, but any persisted binding needs target-neutral repo/ref/path/digest rather than `workingLocalRelativePath`.
- [x] Define the minimum source binding shape for repo/ref/path/digest inputs, including when raw URLs are acceptable.
- [x] Draft the core ontology change for a repo/ref/path/digest locator that composes with `ArtifactResolutionTarget`.
- [x] Define bootstrap API/CLI inputs for creating the first publication branch from a clean source branch.
- [x] Split publication-branch bootstrap from first materialization in the deploy model, even if one CLI command can perform both.
- [x] Define inference rules and override flags for source ref, mesh base, and publication source folder.
- [x] Add interactive prompting for missing publication worktree path and non-interactive fail-closed behavior when no path/profile is supplied.
- [x] Define the branch deploy context as source root plus publication root without broadening the general workspace model.
- [x] Draft the local generation workflow for source checkout plus publication worktree, including dirty-worktree and branch initialization guardrails.
- [x] Add a dry-run planner for the branch-published workflow that prints source root, publication root, mesh base, generated paths, preserved files, and git operations that would run.
- [x] Add path-policy tests for cross-worktree source access and host-local grants.
- [x] Create the first branch-published Fantasy Rules source-only proof ref and Accord manifest (`bp-01-source-only`) in the existing fixture repo/SFF conformance area.
- [x] Implement local-only branch-published publication-root bootstrap through `weave deploy gh-pages`.
- [x] Add focused bootstrap tests proving the source root stays free of `_mesh`/`.weave`, publication root carries `_mesh` plus config, public config has no sibling path leakage, and a second bootstrap run is a no-op.
- [x] Implement local-only branch-published materialization/generation for one simple ontology source from command-scoped source and publication roots.
- [x] Prove the first clean-source-branch slice in focused tests: source root contains only authored source, publication root carries `_mesh` and generated state, public RDF has no sibling path leakage, reruns are incremental, and default MeshInventory, KnopMetadata, and KnopInventory support histories remain current-only.
- [x] Add local integration coverage using an actual temporary git repo with source and `gh-pages` worktrees.
- [x] Update [[wd.task.2026.2026-05-07-fixture-ladder-generator]] to make fixture-generator work early but full fixture branch rerunging later, after branch-published topology and vocabulary are stable.
- [x] Add `.nojekyll` and optional `CNAME` preservation behavior.
- [x] Add validation that generated public mesh output does not include stale source-branch clutter or developer-specific sibling checkout paths.
- [x] Implement incremental publication-branch updates as the default behavior.
- [d] Add a guarded rebuild-from-scratch mode only after incremental updates are proven; deferred to [[wd.task.2026.2026-05-14_1105-guarded-branch-published-rebuild]].
- [x] Add explicit local commit support after local generation is proven, and print a CLI reminder that the publication branch still needs to be pushed for GitHub Pages to update.
- [ ] Decide whether to convert the Fantasy Rules fixture from `docs/` sidecar to branch-published output before the next fixture rerung.
- [x] Rewrite the Semantic Flow Framework Fantasy Rules example/spec for branch-published ontology delivery before rerunging fixture branches.
- [x] Update [[wd.task.2026.2026-05-07-fixture-ladder-generator]] if the fixture topology changes.
- [ ] Update [[wd.decision-log]] once the topology and path-provenance decisions are accepted.
