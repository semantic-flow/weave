---
id: oe6tu7c83ffif2k2r71plni
title: weave payload update
desc: ''
updated: 1779376259649
created: 1779376259649
---

## Summary

`weave payload update` replaces the current working bytes of an existing payload artifact. It updates the working surface only; use [[wu.cli-reference.weave]] or [[wu.cli-reference.version]] to record those bytes into history.

## Usage

```sh
weave payload update <source> [designatorPath] [--mesh-root <meshRoot>]
weave payload update <source> --designator-path <designatorPath> [--mesh-root <meshRoot>]
```

Use `/` for the root designator as described in [[wu.cli-reference.root-designator]].

## Examples

```sh
weave payload update ./alice-bio-v2.ttl alice/bio
weave payload update ./alice-bio-v2.ttl --designator-path alice/bio
weave payload update ./root-v2.ttl /
weave payload update ./alice-bio-v2.ttl alice/bio --mesh-root ./mesh
```

## Notes

The designator path may be given either positionally or with `--designator-path`. If both are provided, they must match.

This command is for local working-surface mutation, not a distinct history/materialization operation. It is the update counterpart to first-time payload registration with [[wu.cli-reference.integrate]].

## Environment

- [[wu.environment-variables#weave_log_dir]] controls where runtime logs are written.
