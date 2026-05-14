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

Accord can now carry replay metadata and `ignorePaths`, which is useful for `.assets` and other source material. However, current `accord check` behavior described in the Accord user guide still says `ignorePaths` is loaded for downstream tooling and future whole-tree checks, not applied by the current path-scoped checker. For branch-generated fixtures, `.assets` should therefore be handled explicitly by the generator/replay workflow and by future Accord whole-tree checks, not assumed to be invisible to every current check.

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

## Open Issues

- What should we call this topology in user docs: `branch-published mesh`, `gh-pages mesh`, `publication branch mesh`, or a kind of sidecar mesh?
- Should branch-published targets keep using `workingLocalRelativePath`, or do we need a target-neutral source-repository locator before this is clean enough for ontology repos?
- Which parts of repo/ref/path/digest belong in core `sflo`, and which operational fetch/read policy belongs in config?
- Should `_mesh/_config/config.ttl` on the publication branch be enough to support source branches with no Semantic Flow or Weave files at all?
- Should the CLI accept all bootstrap inputs as flags, or should a structured bootstrap/profile file become the primary bootstrap surface?
- Which bootstrap values should be inferred by default: source ref from default-branch `HEAD`, mesh base from GitHub remote/project Pages URL, and publication source folder from `gh-pages` root?
- Should first materialization be a separate command from publication-branch bootstrap, or should one command support both phases depending on whether target bindings are provided?
- Should host-local source/publish checkout paths live only in `.sf-local-access.ttl`, in a new deploy profile file, in CLI flags, or in some combination?
- Should Weave ever write host-local path grants into the `gh-pages` branch, or should cross-worktree source access always be host-local and command-scoped?
- Should source bindings use git repository/ref/path/digest as the durable model, with raw URLs as an optional resolution form, or should URL-first bindings be the default?
- How should generated publication branches preserve files such as `CNAME`, `.nojekyll`, and other GitHub Pages control files during reset/regeneration?
- Should branch-published generation use one command that integrates, versions, and generates pages, or should it compose existing `mesh create`, `integrate`, `weave`, and future generator commands?
- How should the workflow behave when the source branch changes but the published mesh has no semantic payload change?
- Should rebuild-from-scratch exist as a separate command/mode from the normal incremental update path?
- Should branch-published fixture output live in the existing Fantasy Rules fixture repo, or should we create a third fixture repo that is deliberately branch-published?
- How much git automation belongs in Weave versus in documented CI/runbook snippets?
- Does this task need ontology/config vocabulary changes, or can the first implementation stay in Weave runtime/deploy config with minimal RDF surface change?

## Decisions

- Branch-based publication is a first-class repository topology, not merely an accidental use of `--mesh-root` with a sibling path.
- The public mesh base IRI must not include or expose the publication branch name.
- Do not encode developer-specific sibling checkout paths as durable public mesh facts.
- The design should allow the normal source branch to remain free of Semantic Flow and Weave files; durable mesh config may live on the publication branch.
- API/CLI bootstrap inputs may provide everything needed to create the first publication branch and seed its durable mesh config.
- Source ref, mesh base, and publication source folder may be inferred for common GitHub project-site cases, while remaining explicit/overrideable.
- Default branch-published deployment should update the existing publication branch incrementally rather than overwrite it from scratch.
- Keep write/push behavior explicit; branch publication should be dry-run or local-only until the operator opts into committing/pushing.
- Preserve the existing `docs/` sidecar pattern as valid even if the Fantasy Rules fixture moves to branch-published publication.

## Contract Changes

- Weave should gain a documented branch-published mesh workflow for source repos that publish generated mesh output from a dedicated branch.
- User-facing repository topology docs should describe whole-repo, directory sidecar, and branch-published options.
- Branch-published source bindings should be target-neutral rather than payload-only, so config inputs, payload bytes, page sources, and assets can use the same addressing model.
- Core ontology likely needs a repo/ref/path/digest source locator that extends the existing target-relator pattern.
- Runtime/deploy config may need to distinguish host-local source checkout access from durable mesh-carried source provenance.
- CLI/API surface may gain a deploy command or profile that accepts source root, publication root/branch, mesh base, and safe write/push flags.
- Fixture expectations may change if the Fantasy Rules fixture stops using `docs/` and becomes the branch-published ontology fixture.

## Testing

- Add focused unit tests for deploy/profile argument parsing once the command shape is selected.
- Add path-policy tests proving cross-worktree source access is fail-closed unless explicitly granted by host-local config or command-scoped options.
- Add tests proving public mesh config does not serialize developer-specific sibling checkout paths into publication output.
- Add tests proving the source branch can remain free of `_mesh`, `.weave`, `docs`, or other Weave/Semantic Flow generated files while the publication branch carries the mesh.
- Add tests proving bootstrap API/CLI inputs can seed a publication branch from a clean source branch.
- Add tests for bootstrap inference: omitted source ref uses default-branch `HEAD`, GitHub remote metadata can infer the default mesh base, and `gh-pages` defaults to branch-root publication.
- Add tests proving normal deployment updates an existing publication branch incrementally, while rebuild/reset behavior requires an explicit guarded flag.
- Add local integration coverage using a temporary git repo with a source branch and a `gh-pages` worktree.
- Verify generation preserves `.nojekyll` and configured `CNAME`, removes stale generated files only when requested, and refuses dirty publication worktrees by default.
- Add fixture or focused coverage for a branch-published ontology source where authored source stays off the publication branch.
- If Fantasy Rules moves to branch-published output, update its Accord manifests and fixture helper assumptions through [[wd.task.2026.2026-05-07-fixture-ladder-generator]].
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
- [ ] Decide whether the first implementation can use command/profile-scoped source-root resolution or needs new target-neutral source-repository locator vocabulary.
- [ ] Define the minimum source binding shape for repo/ref/path/digest inputs, including when raw URLs are acceptable.
- [ ] Draft the core ontology change for a repo/ref/path/digest locator that composes with `ArtifactResolutionTarget`.
- [ ] Define bootstrap API/CLI inputs for creating the first publication branch from a clean source branch.
- [ ] Split publication-branch bootstrap from first materialization in the deploy model, even if one CLI command can perform both.
- [ ] Define inference rules and override flags for source ref, mesh base, and publication source folder.
- [ ] Draft the local generation workflow for source checkout plus publication worktree, including dirty-worktree and branch initialization guardrails.
- [ ] Add a dry-run planner for the branch-published workflow that prints source root, publication root, mesh base, generated paths, preserved files, and git operations that would run.
- [ ] Add path-policy tests for cross-worktree source access and host-local grants.
- [ ] Implement local-only branch-published generation for one simple ontology source in a temporary git repo.
- [ ] Add `.nojekyll` and optional `CNAME` preservation behavior.
- [ ] Add validation that generated public mesh output does not include stale source-branch clutter or developer-specific sibling checkout paths.
- [ ] Implement incremental publication-branch updates as the default behavior.
- [ ] Add a guarded rebuild-from-scratch mode only after incremental updates are proven.
- [ ] Add explicit commit/push flags after local generation is proven.
- [ ] Decide whether to convert the Fantasy Rules fixture from `docs/` sidecar to branch-published output before the next fixture rerung.
- [ ] Update [[wd.task.2026.2026-05-07-fixture-ladder-generator]] if the fixture topology changes.
- [ ] Update [[wd.decision-log]] once the topology and path-provenance decisions are accepted.
