---
id: 8bpah0m381bbgwyger4hc47
title: target syntax
desc: ''
updated: 1779376324851
created: 1779376324851
---

## Summary

`--target` limits `weave`, `weave validate`, `weave version`, and `weave generate` to one or more designator paths. The value is a comma-separated list of `key=value` fields.

## Supported Keys

- `designatorPath`: required; use `/` for the root designator, described in [[wu.cli-reference.root-designator]]
- `recursive`: optional; `true` includes descendants of the designator path
- `historySegment`: accepted by [[wu.cli-reference.weave]] and [[wu.cli-reference.version]]
- `stateSegment`: accepted by [[wu.cli-reference.weave]] and [[wu.cli-reference.version]]
- `manifestationSegment`: accepted by [[wu.cli-reference.weave]] and [[wu.cli-reference.version]]

The aliases `payloadHistorySegment`, `payloadStateSegment`, and `payloadManifestationSegment` are also accepted inside version-capable target specs.

## Examples

```sh
weave --target 'designatorPath=alice/bio'
weave generate --target 'designatorPath=alice,recursive=true'
weave validate --target 'designatorPath=alice/bio' --target 'designatorPath=bob'
weave version --target 'designatorPath=ontology,historySegment=releases,stateSegment=v0.1.0,manifestationSegment=ttl'
```

## Rules

`designatorPath` is required. `recursive=false` is accepted and currently behaves the same as omitting `recursive`.

Version-oriented fields are rejected by [[wu.cli-reference.validate]] and [[wu.cli-reference.generate]] because those commands do not create historical states. For recursive version targets, version-oriented fields act as defaults for matched payload artifacts; a more specific target can override them.

## Environment

Target syntax itself does not read environment variables. The command using the target determines the relevant variables; see [[wu.environment-variables]].
