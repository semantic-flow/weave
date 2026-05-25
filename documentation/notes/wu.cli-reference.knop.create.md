---
id: 50wrbpt2qmwdutlyrh6001c
title: weave knop create
desc: ''
updated: 1779376268994
created: 1779376268994
---

## Summary

`weave knop create` creates the first Knop support artifacts for a designator path without integrating a payload.

## Usage

```sh
weave knop create <designatorPath> [--mesh-root <meshRoot>]
```

Use `/` for the root designator as described in [[wu.cli-reference.root-designator]].

## Examples

```sh
weave knop create alice/data
weave knop create /
weave knop create / --mesh-root docs
```

## Notes

Use `knop create` when you need an identifier surface before there is a payload artifact for that designator. If the resource is backed by source bytes, [[wu.cli-reference.integrate]] is usually the higher-level starting point because it creates the payload-related support artifacts too.

## Environment

- [[wu.environment-variables#weave_log_dir]] controls where runtime logs are written.
