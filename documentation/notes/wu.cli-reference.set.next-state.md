---
id: dz24dzocq8z15bneeiwfg2l
title: weave set next-state
desc: ''
updated: 1779376295678
created: 1779376295678
---

## Summary

`weave set next-state` sets the next HistoricalState segment for a payload artifact without creating that state.

## Usage

```sh
weave set next-state <designatorPath> <stateSegment> [--mesh-root <meshRoot>]
```

## Examples

```sh
weave set next-state alice/data v0.1.0
weave set next-state ontology v0.1.0 --mesh-root docs
```

## Notes

The hint is stored on the selected current payload history and is consumed by the next [[wu.cli-reference.version]] or default [[wu.cli-reference.weave]] versioning phase for that payload.

If no current history has been selected yet, Weave uses the default `_history001` history lane. Use [[wu.cli-reference.set.history]] first when a named release lane such as `releases` should be current.

## Environment

- [[wu.environment-variables#weave_log_dir]] controls where runtime logs are written.
