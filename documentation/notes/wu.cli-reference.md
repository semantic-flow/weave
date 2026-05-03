---
id: zcfvz4v7wxljtye9263tchs
title: CLI Reference
desc: ''
updated: 1775629411758
created: 1775629411758
---

## Overview

`weave` is a workspace-oriented CLI. Most commands operate on the current directory unless `--workspace <path>` is provided.

Commands print a one-line summary to stdout followed by created or updated paths when relevant. Input or runtime errors return a non-zero exit code and print the error message to stderr.

Weave also writes runtime logs under `.weave/logs/` inside the workspace.

Use `weave --help` or `weave <command> --help` to inspect the live CLI.

## Common patterns

`--workspace <path>` selects the workspace root. It defaults to `.`.

`--target <spec>` limits `weave`, `weave validate`, `weave version`, and `weave generate` to specific designator paths.

If no `--target` flags are provided, those commands operate on all applicable weave candidates in the workspace.

## Target syntax

`--target` uses a comma-separated `key=value` form.

Supported keys:

- `designatorPath`
- `recursive`

Examples:

```sh
weave --target 'designatorPath=alice/bio'
weave generate --target 'designatorPath=alice,recursive=true'
weave validate --target 'designatorPath=alice/bio' --target 'designatorPath=bob'
```

Notes:

- `designatorPath` is required.
- `recursive=true` includes descendants of the given designator path.
- `recursive=false` is accepted and currently behaves the same as omitting `recursive`.
- Version-oriented fields such as `historySegment`, `stateSegment`, and `manifestationSegment` are not part of `--target`.

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

Examples:

```sh
weave
weave --workspace ./my-mesh
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

Constraints:

- payload version naming requires exactly one `--target`
- payload naming is applied only to payload versioning, not to shared target selection
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
```

Constraints:

- payload version naming requires exactly one `--target`

### `weave generate`

Generates current ResourcePages from the settled local workspace state without creating new historical states.

```sh
weave generate
weave generate --target 'designatorPath=alice/bio'
weave generate --target 'designatorPath=alice,recursive=true'
```

### `weave mesh create`

Creates the initial mesh support artifacts in an empty or new workspace.

```sh
weave mesh create --mesh-base 'https://example.org/'
weave mesh create --workspace ./my-mesh --mesh-base 'https://example.org/'
weave mesh create --workspace . --mesh-root docs --mesh-base 'https://example.org/my-project/'
weave mesh create --interactive
```

### `weave integrate`

Integrates a local source file into a designator path as a payload artifact, including policy-approved extra-mesh local sources.

```sh
weave integrate ./alice-bio.ttl alice/bio
weave integrate ./alice-bio.ttl --designator-path alice/bio
weave integrate ./root.ttl --designator-path /
```

Constraints:

- the designator path may be given either positionally or with `--designator-path`
- if both are provided, they must match
- the current local CLI slice accepts local filesystem paths or `file:` URLs
- sources inside the workspace are accepted directly
- extra-mesh local sources are accepted only when operational policy allows the resulting relative `workingLocalRelativePath`
- remote-source integration is still a broader semantic/API direction, not part of the current CLI contract

### `weave extract`

Creates a minimal Knop-managed surface for a local resource referenced inside a woven payload artifact.

```sh
weave extract bob
weave extract /
```

### `weave payload update`

Convenience command for replacing the current working bytes of an existing payload artifact. This updates the current working surface only; `weave` or `weave version` is what records those bytes into explicit history.

```sh
weave payload update ./alice-bio-v2.ttl alice/bio
weave payload update ./alice-bio-v2.ttl --designator-path alice/bio
weave payload update ./root-v2.ttl /
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
  --reference-role Supplemental
```

## Practical examples

Initialize a mesh:

```sh
weave mesh create --workspace ./mesh --mesh-base 'https://example.org/'
```

Integrate a payload, then weave it:

```sh
weave integrate ./alice-bio.ttl alice/bio --workspace ./mesh
weave --target 'designatorPath=alice/bio' --workspace ./mesh
```

Version without generation:

```sh
weave version --target 'designatorPath=alice/bio' --workspace ./mesh
```

Generate pages only:

```sh
weave generate --target 'designatorPath=alice,recursive=true' --workspace ./mesh
```
