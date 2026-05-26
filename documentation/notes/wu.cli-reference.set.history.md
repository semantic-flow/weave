---
id: krp93o5b60z4cqfjpzs7n47
title: weave set history
desc: ''
updated: 1779376287413
created: 1779376287413
---

## Summary

`weave set history` sets the current/default ArtifactHistory segment for a payload artifact without creating a historical state.

## Usage

```sh
weave set history <designatorPath> <historySegment> [--mesh-root <meshRoot>]
```

## Examples

```sh
weave set history alice/data releases
weave set history ontology releases --mesh-root docs
```

## Notes

This is payload-only versioning intent. It updates the current Knop inventory so the next explicit versioning operation uses the selected history, but it does not write a payload snapshot, create ResourcePages, or copy source bytes.

Use [[wu.cli-reference.set.next-state]] to stage the next state segment in the selected history. Use [[wu.cli-reference.version]] or [[wu.cli-reference.weave]] to actually create the next state.

## Environment

- [[wu.environment-variables#weave_log_dir]] controls where runtime logs are written.
