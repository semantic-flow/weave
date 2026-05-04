---
id: zcfvz4v7wxljtye9263tchs
title: CLI Reference
desc: ''
updated: 1775629411758
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
weave extract <targetDesignatorPath> [--mesh-root <meshRoot>] [--source-designator-path <sourceDesignatorPath>]
weave extract --all-terms --source-designator-path <sourceDesignatorPath> [--mesh-root <meshRoot>] [--yes]
```

`<targetDesignatorPath>` is the resource or term surface to create. `--source-designator-path <sourceDesignatorPath>` selects the already woven payload artifact that describes that target when source resolution would otherwise be ambiguous; it is not the term being extracted.

`--all-terms` extracts every new named mesh-scoped term discovered in the selected source RDF artifact. It previews the identifiers that will be created and asks for confirmation before writing; `--yes` confirms the preview for noninteractive runs. Existing Knops, blank nodes, support artifact paths, and generated page/file artifact paths are skipped.

```sh
weave extract bob
weave extract /
weave extract ontology/CharacterShape --mesh-root docs --source-designator-path shacl
weave extract --all-terms --mesh-root docs --source-designator-path shacl --yes
```

For example, the current Fantasy Rules sidecar term slice is represented as explicit single-target extractions:

```sh
weave extract ontology/AbilityScore --mesh-root docs --source-designator-path ontology
weave extract ontology/Alignment --mesh-root docs --source-designator-path ontology
weave extract ontology/Character --mesh-root docs --source-designator-path ontology
weave extract ontology/PlayerCharacter --mesh-root docs --source-designator-path ontology
weave extract ontology/CharacterShape --mesh-root docs --source-designator-path shacl
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
