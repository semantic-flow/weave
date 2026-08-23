---
id: 50wrbpt2qmwdutlyrh6001c
title: weave knop create
desc: ''
updated: 1779376268994
created: 1779376268994
---

## Summary

`weave knop create` creates the first Knop support artifacts for a designator path without integrating a payload. It can also admission-copy one bounded founding Turtle document about the new public referent.

## Usage

```sh
weave knop create <designatorPath> [--mesh-root <meshRoot>] [--founding-data <path>]
```

Use `/` for the root designator as described in [[wu.cli-reference.root-designator]].

## Examples

```sh
weave knop create alice/data
weave knop create /
weave knop create / --mesh-root docs
weave knop create characters/new-npc --founding-data ./new-npc-founding.ttl
```

## Notes

Use `knop create` when you need an identifier surface before there is a payload artifact for that designator. If the resource is backed by source bytes, [[wu.cli-reference.integrate]] is usually the higher-level starting point because it creates the payload-related support artifacts too.

`--founding-data` reads exact bytes from a path resolved from the command working directory under the normal local-path policy. It is refused for the root designator. The first profile accepts non-empty Turtle up to 64 KiB and 256 triples: every subject must be the exact absolute new public identifier, blank nodes and `@base` are forbidden, and SFLO/SFCFG predicates or types are not application data.

The bytes are written exactly to `D/_knop/_founding/data.ttl`. Initialization creates no history, pages, payload, references, sources, or network reads. A pre-existing conventional target is never adopted or overwritten.

Before publishing or landing a press, settle the working founding bytes with [[wu.cli-reference.version#founding-referent-data]].

## Environment

- [[wu.environment-variables#weave_log_dir]] controls where runtime logs are written.
