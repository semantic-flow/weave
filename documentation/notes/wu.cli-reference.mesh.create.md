---
id: nb3bfjlik3yjbk75c0c8hf2
title: weave mesh create
desc: ''
updated: 1779376219091
created: 1779376219091
---

## Summary

`weave mesh create` creates the first mesh support artifacts in a workspace.

## Usage

```sh
weave mesh create --mesh-base <meshBase> [--workspace <workspace>] [--mesh-root <meshRoot>]
weave mesh create --interactive [--workspace <workspace>] [--mesh-root <meshRoot>]
weave mesh create --mesh-base <meshBase> [--publication-profile auto|none|github-pages]
```

`--workspace` defaults to the current directory. `--mesh-root` is optional and must stay inside the workspace.

## Examples

```sh
weave mesh create --mesh-base 'https://example.org/'
weave mesh create --workspace ./my-mesh --mesh-base 'https://example.org/'
weave mesh create --workspace . --mesh-root docs --mesh-base 'https://example.org/my-project/'
weave mesh create --mesh-base 'https://semantic-flow.github.io/my-mesh/' --publication-profile github-pages
weave mesh create --mesh-base 'https://example.org/my-mesh/' --publication-profile auto
weave mesh create --interactive
```

## Mesh Roots

When `--mesh-root` names a child path such as `docs`, Weave creates the mesh under that path and writes `_mesh/_config/config.ttl` to record the portable relationship from the mesh root back to the workspace root. For `--workspace . --mesh-root docs`, that value is `../`.

Existing-mesh commands use `--mesh-root` differently: they select the mesh root and infer the workspace from mesh config. This creation command accepts `--workspace` because it may need to create that config for the first time.

## Publication Profiles

`--publication-profile` is explicit host setup. Use `github-pages` to create and persist the GitHub Pages profile, currently `.nojekyll`; use `none` to persist that no static-host profile is selected; use `auto` to infer GitHub Pages only from a `github.io` mesh base and otherwise persist `none`.

## Environment

- [[wu.environment-variables#weave_log_dir]] controls where runtime logs are written.
