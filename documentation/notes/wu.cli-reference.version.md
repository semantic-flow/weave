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
weave version --target 'designatorPath=game/state' --target 'designatorPath=game/session'
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

Repeated exact payload targets are planned together in canonical designator-path order. A coherent batch writes one merged support-artifact progression for shared support files; if any requested payload target is malformed, the entire version plan is refused before files are written. Re-running an already-applied payload batch no-ops already-current payloads.

For explicit multi-target payload batches, Weave hashes the requested targets' current working payload files before batch content capture and verifies those hashes after capture. A changed working payload refuses the whole batch before Weave writes version output, with a diagnostic naming the changed file. Changes after capture are ignored by design.

`weave version` reads `_mesh/_config/config.ttl` when present. Mesh-local config can set durable history tracking and naming defaults. `--history-tracking-policy` remains a command-scoped override for the current run.

`weave set history` and `weave set next-state` can persist payload-only intent for a later version operation; see [[wu.cli-reference.set.history]] and [[wu.cli-reference.set.next-state]].

If a named-state payload history is current, omitted `stateSegment` fails closed instead of silently choosing an ordinal successor.

## Environment

- [[wu.environment-variables#weave_log_dir]] controls where command audit logs are written.
- [[wu.environment-variables#weave_timing]] enables aggregate timing lines.
- [[wu.environment-variables#home-and-userprofile]] can affect workspace/local-access policy resolution.
