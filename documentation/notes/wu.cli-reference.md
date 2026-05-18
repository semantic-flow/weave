---
id: zcfvz4v7wxljtye9263tchs
title: CLI Reference
desc: ''
updated: 1779079397831
created: 1775629411758
---

## Overview

`weave` is a mesh-oriented CLI. Commands that operate on an existing mesh treat the current directory as the mesh root unless `--mesh-root <path>` is provided.

Commands print a one-line summary to stdout followed by created or updated paths when relevant. Input or runtime errors return a non-zero exit code and print the error message to stderr.

Weave writes runtime logs under `.weave/logs/` inside the workspace. For whole-root meshes the workspace is the mesh root. For sidecar meshes, Weave infers the workspace from `_mesh/_config/config.ttl`.

Use `weave --help` or `weave <command> --help` to inspect the live CLI.

## Common patterns

`--mesh-root <path>` selects the mesh root for existing-mesh operations such as `weave`, `weave validate`, `weave version`, `weave generate`, `weave integrate`, `weave extract`, `weave payload update`, `weave knop create`, and `weave knop add-reference`. It defaults to `.`.

`--target <spec>` limits `weave`, `weave validate`, `weave version`, and `weave generate` to specific designator paths.

If no `--target` flags are provided, those commands operate on all applicable weave candidates in the mesh.

## Workflow Shapes

There are two current ways to build a publication mesh.

For an in-place mesh, including a docs-rooted sidecar mesh that lives on the source branch, use the primitive commands:

```sh
weave mesh create --workspace . --mesh-root docs --mesh-base 'https://example.github.io/project/'
weave integrate ./ontology/example.ttl ontology --mesh-root docs --grant-source-directory ontology
weave --mesh-root docs --target 'designatorPath=ontology,historySegment=releases,stateSegment=v0.1.0,manifestationSegment=ttl'
```

This keeps the source checkout and mesh root in the same working tree. Extra-mesh source paths are represented through `workingLocalRelativePath` and require local path policy such as `--grant-source-directory`.

For a detached publication root, such as a generated `gh-pages` worktree, use `weave prepare gh-pages`:

```sh
weave prepare gh-pages \
  --source-root . \
  --publish-root ../project-gh-pages \
  --mesh-base 'https://example.github.io/project/' \
  --source-path ontology/example.ttl \
  --designator-path ontology \
  --payload-history-segment releases \
  --payload-state-segment v0.1.0 \
  --payload-manifestation-segment ttl \
  --source-repository-url 'https://github.com/example/project.git' \
  --source-ref v0.1.0
```

`prepare gh-pages` is an orchestration command over a detached root: it ensures the publication mesh exists, keeps publication controls such as `.nojekyll` in place, materializes a repository source file when requested, integrates or updates the payload, runs the needed weave work for that payload, records repository source provenance in `_knop/_sources/sources.ttl`, validates against local path leakage, and optionally creates a local publication commit.

Today `prepare gh-pages` accepts at most one `--source-path` per invocation. For a release with three published payload artifacts, run it three times, once per payload. Repeating the same invocation is safe: it is intended to be idempotent, and `--dry-run` reports whether any publication file changes would be made. A future manifest or batch form should make multi-payload release preparation one command.

Do not add an unconditional top-level `weave` after every `prepare gh-pages` run just to be safe. `prepare gh-pages` already runs the needed weave work for its own materialized payload. Run a separate `weave --mesh-root <publishRoot>` only after operations that create additional un-woven candidates, such as extracting new term identifiers.

## Target syntax

`--target` uses a comma-separated `key=value` form.

Supported keys:

- `designatorPath`
- `recursive`
- `historySegment` for `weave` and `weave version`
- `stateSegment` for `weave` and `weave version`
- `manifestationSegment` for `weave` and `weave version`

Examples:

```sh
weave --target 'designatorPath=alice/bio'
weave generate --target 'designatorPath=alice,recursive=true'
weave validate --target 'designatorPath=alice/bio' --target 'designatorPath=bob'
weave version --target 'designatorPath=ontology,historySegment=releases,stateSegment=v0.0.2,manifestationSegment=ttl'
```

Notes:

- `designatorPath` is required.
- `recursive=true` includes descendants of the given designator path.
- `recursive=false` is accepted and currently behaves the same as omitting `recursive`.
- Version-oriented target fields are accepted only by `weave` and `weave version`; `weave validate` and `weave generate` reject them because they do not create historical states.
- For recursive version targets, version-oriented fields act as defaults for matched payload artifacts. More specific targets can override them.

## Root special case

The root-designator sentinel is `/`.

Exact root targeting:

```sh
weave --target 'designatorPath=/'
```

Recursive root targeting:

```sh
weave --target 'designatorPath=/,recursive=true'
```

The same `/` sentinel is accepted anywhere a command expects a designator path, including `weave integrate`, `weave extract`, `weave payload update`, `weave knop create`, and `weave knop add-reference --reference-target-designator-path`.

## Commands

### `weave`

Runs the composed local weave flow:

1. validate
2. version
3. generate

For a newly created mesh with no Knops yet, `weave` can still materialize current support ResourcePages for `_mesh`, `_mesh/_meta`, `_mesh/_inventory`, and `_mesh/_config` when a sidecar config artifact exists.

Examples:

```sh
weave
weave --mesh-root ./docs
weave --target 'designatorPath=alice/bio'
weave --target 'designatorPath=alice,recursive=true'
```

Payload naming may be passed through to the internal `version` step:

```sh
weave \
  --target 'designatorPath=alice/bio' \
  --payload-history-segment releases \
  --payload-state-segment v0.0.1 \
  --payload-manifestation-segment ttl
```

The same payload naming flags can be used as general defaults for all included payload artifacts:

```sh
weave \
  --payload-history-segment releases \
  --payload-state-segment v0.0.2 \
  --payload-manifestation-segment ttl
```

For mixed naming, put the state names directly on the matching targets:

```sh
weave \
  --target 'designatorPath=ontology,historySegment=releases,stateSegment=v0.0.2,manifestationSegment=ttl' \
  --target 'designatorPath=shacl,historySegment=releases,stateSegment=v0.0.2,manifestationSegment=ttl'
```

Constraints:

- payload naming is applied only to payload artifacts selected for versioning; support artifacts keep system-controlled history paths
- per-target payload naming overrides the general `--payload-*` defaults for that target
- if a payload's current history uses a named HistoricalState such as `v0.0.1`, a later version request must provide the next `stateSegment` or explicitly request ordinal fallback with a segment such as `_s0001`
- if `--payload-manifestation-segment` is omitted, the current default derives the manifestation segment from the payload filename, such as `alice-bio-ttl` for `alice-bio.ttl`

### `weave validate`

Validates current local weave state without writing files.

```sh
weave validate
weave validate --target 'designatorPath=alice/bio'
weave validate --target 'designatorPath=alice,recursive=true'
```

### `weave version`

Versions current targeted resources without generating pages.

```sh
weave version
weave version --target 'designatorPath=alice/bio'
weave version \
  --target 'designatorPath=alice/bio' \
  --payload-history-segment releases \
  --payload-state-segment v0.0.1 \
  --payload-manifestation-segment ttl
weave version \
  --target 'designatorPath=ontology,stateSegment=v0.0.2,manifestationSegment=ttl' \
  --target 'designatorPath=shacl,stateSegment=v0.0.2,manifestationSegment=ttl'
```

Constraints:

- payload version naming can be provided as general `--payload-*` defaults or as per-target fields
- if a named-state payload history is current, omitted `stateSegment` fails closed instead of silently choosing an ordinal successor

### `weave generate`

Generates current ResourcePages from the settled local workspace state without creating new historical states.

```sh
weave generate
weave generate --target 'designatorPath=alice/bio'
weave generate --target 'designatorPath=alice,recursive=true'
```

### `weave mesh create`

Creates the initial mesh support artifacts in an empty or new workspace.

When `--mesh-root` names a child path such as `docs`, Weave creates the mesh under that path and writes `_mesh/_config/config.ttl` to record the portable relationship from the mesh root back to the workspace root. For `--workspace . --mesh-root docs`, that value is `../`.

```sh
weave mesh create --mesh-base 'https://example.org/'
weave mesh create --workspace ./my-mesh --mesh-base 'https://example.org/'
weave mesh create --workspace . --mesh-root docs --mesh-base 'https://example.org/my-project/'
weave mesh create --mesh-base 'https://semantic-flow.github.io/my-mesh/' --no-nojekyll
weave mesh create --interactive
```

### `weave prepare gh-pages`

Creates or updates a branch-published GitHub Pages mesh in a publication worktree. Use this when authored source files stay in a normal source checkout and generated mesh output lives in a separate publication branch checkout such as `gh-pages`.

The essential shape is a detached publication root, not the branch name itself: the command reads source bytes from `--source-root`, writes generated mesh output to `--publish-root`, and keeps host-local checkout paths out of the published RDF. Branch-published `gh-pages` worktrees are the current supported publication target. A docs-rooted sidecar mesh that lives on the source branch usually uses ordinary `weave mesh create`, `weave integrate`, and `weave` commands with `--mesh-root docs`; use `prepare gh-pages` when the publication root is a separate generated checkout/root that should carry repository source bindings instead of source-checkout local paths.

`--source-root` defaults to the current directory. `--publish-root` is required in noninteractive runs; interactive runs can prompt for it.

Root publication meshes do not need `_mesh/_config/config.ttl`; for this command the publication worktree root is also the mesh root. If a mesh config already exists, Weave preserves it and still validates generated RDF for local path leakage.

Repository source bindings are recorded beside the target Knop rather than in `_mesh/_config/config.ttl`. When preparation materializes a source file, Weave writes a source registry at `_knop/_sources/sources.ttl`, links it from the Knop inventory with `sflo:hasKnopSourceRegistry`, and records the repository URL, source ref, resolved commit, repository-relative path, and content digest. This keeps publication output portable without preserving a developer's checkout path.

With no `--source-path`, `prepare gh-pages` only prepares the publication root: mesh bootstrap, `.nojekyll` / `CNAME`, validation, and optional local commit. With `--source-path`, it also materializes exactly one source payload and weaves that payload target when needed.

Dry-run prints the planned writes, preserved files, validation checks, and git operations without mutating the publication worktree. If both created and updated paths are empty, rerunning `prepare gh-pages` with the same inputs would make no publication file changes:

```sh
weave prepare gh-pages \
  --dry-run \
  --source-root . \
  --publish-root ../my-repo-gh-pages \
  --mesh-base 'https://example.github.io/my-repo/'
```

Materialize one repository source file into the publication mesh:

```sh
weave prepare gh-pages \
  --source-root . \
  --publish-root ../my-repo-gh-pages \
  --mesh-base 'https://example.github.io/my-repo/' \
  --source-path ontology/fantasy-rules-ontology.ttl \
  --designator-path ontology \
  --payload-history-segment releases \
  --payload-state-segment v0.1.0 \
  --payload-manifestation-segment ttl \
  --source-repository-url 'https://github.com/example/my-repo.git' \
  --source-ref main
```

Create a local publication commit after successful preparation:

```sh
weave prepare gh-pages \
  --source-root . \
  --publish-root ../my-repo-gh-pages \
  --mesh-base 'https://example.github.io/my-repo/' \
  --commit \
  --commit-message 'Publish mesh'
```

Constraints:

- `--publish-root` must be a distinct publication worktree, not the source checkout or a directory inside it
- publication git worktrees must be clean by default before Weave writes
- `--allow-dirty-publish-root` is available for local experimentation, but cannot be combined with `--commit`
- `--commit` creates a local commit only when the publication worktree has changes
- Weave does not push; after a local commit, push the publication branch yourself for GitHub Pages to update
- `--commit-message` requires `--commit`
- `--source-commit` records an exact source commit in the source locator when supplied, but it should name bytes that the commit actually represents

For local preview or regeneration runs, set `WEAVE_LOG_DIR` to a temporary directory such as `/tmp/weave-logs` when you want runtime logs kept outside a publication checkout.

### `weave integrate`

Integrates a local source file into a designator path as a payload artifact, including policy-approved extra-mesh local sources.

```sh
weave integrate ./alice-bio.ttl alice/bio
weave integrate ./alice-bio.ttl --designator-path alice/bio
weave integrate ./ontology/fantasy-rules-ontology.ttl ontology --mesh-root docs --grant-source-directory ontology
weave integrate ./root.ttl --designator-path /
```

Constraints:

- the designator path may be given either positionally or with `--designator-path`
- if both are provided, they must match
- `--mesh-root <path>` selects the mesh root and defaults to the current directory
- relative source paths are resolved from the command working directory
- `--grant-source-directory <path>` adds a mesh-carried `workingLocalRelativePath` grant for that source directory before resolving the source
- the current local CLI slice accepts local filesystem paths or `file:` URLs
- sources inside the mesh root are accepted directly
- extra-mesh local sources are accepted only when operational policy allows the resulting relative `workingLocalRelativePath`
- denied adjacent workspace sources report the matching `--grant-source-directory` suggestion when Weave can infer one
- remote-source integration is still a broader semantic/API direction, not part of the current CLI contract

### `weave extract`

Creates a minimal Knop-managed surface for a local resource referenced inside a woven payload artifact.

Current syntax:

```sh
weave extract <targetDesignatorPath> [--mesh-root <meshRoot>] [--source <sourceDesignatorPath> | --source-state <historicalStatePath>]
weave extract --all-terms (--source <sourceDesignatorPath> | --source-state <historicalStatePath>) [--mesh-root <meshRoot>] [--accept-preview] [--add-source-references --reference-role <referenceRole>]
```

`<targetDesignatorPath>` is the resource or term surface to create. `--source <sourceDesignatorPath>` selects the already woven payload artifact that describes that target and records a current-tracking `sflo:ExtractionSource` in the Knop's `_sources` registry. `--source-state <historicalStatePath>` pins the extraction source to a historical source state and resolves the owning source artifact from mesh inventory.

`--source` and `--source-state` are mutually exclusive. If neither is supplied for single-target extraction, Weave resolves the unique current woven payload artifact that mentions the target. `--all-terms` requires an explicit `--source` or `--source-state`, previews the identifiers that will be created, and asks for confirmation before writing; `--accept-preview` accepts that preview for noninteractive runs. Existing Knops, blank nodes, support artifact paths, and generated page/file artifact paths are skipped.

`--add-source-references` is valid only with `--all-terms` and creates a `ReferenceCatalog` / `ReferenceLink` for each newly extracted term. `--reference-role <referenceRole>` is required with `--add-source-references`. The reference target is the selected source artifact; when extraction uses `--source-state`, the reference also carries `sflo:referenceTargetState` for that historical source state. Existing terms are not backfilled by this option.

```sh
weave extract bob
weave extract /
weave extract ontology/CharacterShape --mesh-root docs --source shacl
weave extract ontology/AbilityScore --mesh-root docs --source-state ontology/releases/v0.0.1
weave extract --all-terms --mesh-root docs --source shacl --accept-preview
weave extract --all-terms --mesh-root docs --source ontology --add-source-references --reference-role canonical --accept-preview
```

For example, the current Fantasy Rules sidecar term slice is represented as explicit single-target extractions:

```sh
weave extract ontology/AbilityScore --mesh-root docs --source ontology
weave extract ontology/Alignment --mesh-root docs --source ontology
weave extract ontology/Character --mesh-root docs --source ontology
weave extract ontology/PlayerCharacter --mesh-root docs --source ontology
weave extract ontology/CharacterShape --mesh-root docs --source shacl
```

### `weave set extraction-source`

Replaces the extraction-source contract for an existing extracted Knop. This is the maintenance operation for migrating already-created extracted term surfaces between current-tracking and pinned source resolution.

Current syntax:

```sh
weave set extraction-source <targetDesignatorPath> [--mesh-root <meshRoot>] (--source <sourceDesignatorPath> | --source-state <historicalStatePath>)
weave set extraction-source --all-terms [--mesh-root <meshRoot>] (--source <sourceDesignatorPath> | --source-state <historicalStatePath>) [--accept-preview]
```

`--source` records a current-tracking source binding. `--source-state` records a pinned source binding and fails if the historical source bytes do not mention the target term. The command replaces the existing source-registry `sflo:ExtractionSource` details; it does not append a second primary extraction source.

The `--all-terms` form discovers named mesh-scoped terms from the selected source graph, previews the existing extracted terms that will be updated, and updates all listed terms after confirmation or `--accept-preview`.

```sh
weave set extraction-source ontology/AbilityScore --mesh-root docs --source ontology
weave set extraction-source ontology/AbilityScore --mesh-root docs --source-state ontology/releases/v0.0.1
weave set extraction-source --all-terms --mesh-root docs --source ontology --accept-preview
```

### `weave payload update`

Convenience command for replacing the current working bytes of an existing payload artifact. This updates the current working surface only; `weave` or `weave version` is what records those bytes into explicit history.

```sh
weave payload update ./alice-bio-v2.ttl alice/bio
weave payload update ./alice-bio-v2.ttl --designator-path alice/bio
weave payload update ./root-v2.ttl /
weave payload update ./alice-bio-v2.ttl alice/bio --mesh-root ./mesh
```

Constraints:

- the designator path may be given either positionally or with `--designator-path`
- if both are provided, they must match
- this is a local working-surface mutation, not a distinct history/materialization operation

### `weave knop create`

Creates the first Knop support artifacts for a designator path.

```sh
weave knop create alice/bio
weave knop create /
weave knop create / --mesh-root docs
```

### `weave knop add-reference`

Creates the first reference-catalog surface for a designator path.

```sh
weave knop add-reference \
  alice/bio \
  --reference-target-designator-path bob \
  --reference-role Supplemental

weave knop add-reference \
  alice \
  --reference-target-designator-path / \
  --reference-role Supplemental \
  --mesh-root ./mesh
```

## Practical examples

Initialize a mesh:

```sh
weave mesh create --workspace ./mesh --mesh-base 'https://example.org/'
```

Integrate a payload, then weave it:

```sh
weave integrate ./mesh/alice-bio.ttl alice/bio --mesh-root ./mesh
weave --target 'designatorPath=alice/bio' --mesh-root ./mesh
```

Version without generation:

```sh
weave version --target 'designatorPath=alice/bio' --mesh-root ./mesh
```

Generate pages only:

```sh
weave generate --target 'designatorPath=alice,recursive=true' --mesh-root ./mesh
```
