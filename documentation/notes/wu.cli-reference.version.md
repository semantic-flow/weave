---
id: vzx3s8qe0dvrs28wlyw7s7l
title: weave version
desc: ''
updated: 1779376203827
created: 1779376203827
---

## Summary

`weave version` creates historical states for current targeted resources without generating pages.

## Usage

```sh
weave version [--mesh-root <meshRoot>] [--target <target>]...
weave version [--payload-history-segment <segment>] [--payload-state-segment <segment>] [--payload-manifestation-segment <segment>]
weave version [--history-tracking-policy <policy>]
```

Targets use [[wu.cli-reference.target-syntax]]. Use `/` for the root designator as described in [[wu.cli-reference.root-designator]].

## Examples

```sh
weave version
weave version --target 'designatorPath=alice/data'
weave version \
  --target 'designatorPath=alice/data' \
  --payload-history-segment releases \
  --payload-state-segment v0.1.0 \
  --payload-manifestation-segment ttl
weave version \
  --target 'designatorPath=ontology,stateSegment=v0.1.0,manifestationSegment=ttl' \
  --target 'designatorPath=ontology/shacl,stateSegment=v0.1.0,manifestationSegment=ttl'
```

## Naming

Payload version naming can be provided as general `--payload-*` defaults or as fields on individual version targets. Per-target fields override the general defaults.

`weave set history` and `weave set next-state` can persist payload-only intent for a later version operation; see [[wu.cli-reference.set.history]] and [[wu.cli-reference.set.next-state]].

If a named-state payload history is current, omitted `stateSegment` fails closed instead of silently choosing an ordinal successor.

## Environment

- [[wu.environment-variables#weave_log_dir]] controls where command audit logs are written.
- [[wu.environment-variables#weave_timing]] enables aggregate timing lines.
- [[wu.environment-variables#home-and-userprofile]] can affect workspace/local-access policy resolution.
