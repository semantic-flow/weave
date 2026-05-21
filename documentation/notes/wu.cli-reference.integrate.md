---
id: cfvs3v07w6068f0jd19ytjv
title: Integrate
desc: ''
updated: 1779337973920
created: 1779337973920
---

## Purpose

`weave integrate` registers source bytes as a payload artifact at a Semantic Flow designator path. It creates the payload Knop support artifacts, records the current working source locator, updates mesh inventory, and leaves versioning/page generation for a later `weave`, `weave version`, or `weave generate` step.

## Basic Usage

```sh
weave integrate ./alice-bio.ttl alice/bio
weave integrate ./alice-bio.ttl --designator-path alice/bio
weave integrate ./root.ttl --designator-path /
```

The source argument is the file to integrate. The designator path can be positional or supplied with `--designator-path`; if both are present they must match.

## Source Locations

The current local CLI accepts local filesystem paths and `file:` URLs. Relative paths are resolved from the command working directory, not from `--mesh-root`.

```sh
weave integrate ./ontology/example.ttl ontology --mesh-root docs
weave integrate "file:///home/example/project/ontology/example.ttl" ontology --mesh-root docs
```

HTTP(S) source URLs are not currently fetched by `weave integrate`. The ontology has `sflo:workingAccessUrl`, and the config ontology has remote-access policy vocabulary, but Weave's local runtime does not yet resolve remote working bytes from that predicate. Today, remote repository or URL metadata can describe provenance, but the command still reads bytes from a local path or `file:` URL.

## Extra-Mesh Local Sources

When the source file is outside the mesh root, the source must be allowed by operational local-path policy. For common sidecar meshes, `--grant-source-directory` can add the needed grant before resolving the source.

```sh
weave integrate ./ontology/fantasy-rules-ontology.ttl ontology \
  --mesh-root docs \
  --grant-source-directory ontology
```

If the approved source path is outside the mesh root, `integrate` creates a Knop source registry automatically with the internal `payload-source` binding id, a working resolution mode, and a local target locator for the source bytes.

## Floating Repository Sources

For branch-published meshes or sibling source/publication worktrees, use `--source-repository-current` when the working source should be identified by the repository and repository-root path rather than by a local workstation path.

```sh
weave integrate "$SFLO_SRC/semantic-flow-core-ontology.ttl" ontology \
  --mesh-root "$SFLO_PUB" \
  --grant-source-directory "$SFLO_SRC" \
  --source-repository-current \
  --source-repository-url "https://github.com/semantic-flow/sflo.git"
```

This records `sflo:hasRepositorySourceFloatingLocator` with `sflo:sourceRepositoryUrl` and `sflo:sourceRepositoryPathFromRoot`. It intentionally does not persist the local checkout path, branch name, commit, ref, or digest. Later versioning resolves the current bytes from an allowed local checkout of that repository.

If `--source-repository-url` is omitted, Weave resolves the URL from the source checkout's git remote. Use `--source-repository-remote <name>` with `--source-repository-current` to choose a remote other than `origin`.

## Pinned Repository Provenance

Use repository metadata without `--source-repository-current` when the source observation should be tied to a specific ref/path and optional commit evidence.

```sh
weave integrate ./ontology/fantasy-rules-ontology.ttl ontology \
  --mesh-root docs \
  --grant-source-directory ontology \
  --source-repository-url "https://github.com/example/source.git" \
  --source-repository-ref main \
  --source-repository-path ontology/fantasy-rules-ontology.ttl
```

When pinned repository metadata is supplied, Weave records source provenance and computes a `sha256:` digest for the local bytes it observed. If `--source-digest` is also supplied, the command fails if the computed digest differs.

## Raw GitHub URLs

For public repositories, a raw GitHub URL can be attractive because it makes the source bytes independently dereferenceable and forces source changes to be pushed before publication automation can version them. That can be a useful release discipline.

The tradeoffs are mostly operational:

- branch raw URLs are mutable and can change between validation and versioning unless paired with digest or commit evidence
- tag or commit raw URLs are stable, but then they behave more like pinned source evidence than a mutable working file
- remote fetches add network availability, rate limit, authentication, and cache consistency concerns
- a raw URL alone loses some repository structure unless paired with repository URL, ref/commit, and path metadata

Because remote working-byte fetch is not implemented yet, use raw URLs today inside the source RDF where they are part of the artifact's own vocabulary, such as `owl:versionIRI`, `schema:contentUrl`, or `dcat:downloadURL`. Use local checkout paths plus `--source-repository-current` for mutable working source integration.
