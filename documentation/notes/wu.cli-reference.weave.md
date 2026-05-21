---
id: 4x2n6v8q3j0m5r7t9y1p
title: weave
desc: ''
updated: 1779377000000
created: 1779377000000
---

## Summary

`weave` runs the composed local publication flow for a mesh: validate, version, then generate ResourcePages. Use it when you want the normal end-to-end update instead of running [[wu.cli-reference.validate]], [[wu.cli-reference.version]], and [[wu.cli-reference.generate]] separately.

## Usage

```sh
weave [--mesh-root <meshRoot>] [--target <target>]...
weave [--payload-history-segment <segment>] [--payload-state-segment <segment>] [--payload-manifestation-segment <segment>]
weave [--history-tracking-policy <policy>] [--silent] [--validate-before] [--validate-after]
```

`--mesh-root` defaults to the current directory. `--target` uses the shared [[wu.cli-reference.target-syntax]] form, and `/` is the root designator described in [[wu.cli-reference.root-designator]].

## Examples

```sh
weave
weave --mesh-root docs
weave --target 'designatorPath=alice/bio'
weave --target 'designatorPath=alice,recursive=true'
weave --validate-before --validate-after
```

Use payload naming flags when a release-style payload path should be created during the internal version phase:

```sh
weave \
  --target 'designatorPath=ontology' \
  --payload-history-segment releases \
  --payload-state-segment v0.1.0 \
  --payload-manifestation-segment ttl
```

For multiple payloads with different names, put version fields directly on each target:

```sh
weave \
  --target 'designatorPath=ontology,historySegment=releases,stateSegment=v0.1.0,manifestationSegment=ttl' \
  --target 'designatorPath=ontology/shacl,historySegment=releases,stateSegment=v0.1.0,manifestationSegment=ttl'
```

## Notes

`--validate-before` and `--validate-after` run whole-mesh validation before or after the normal phases. They are useful in automation when you want an explicit preflight or postflight failure.

`--silent` suppresses progress lines from long recursive versioning runs. It does not suppress the final summary or error output.

`--history-tracking-policy` is an advanced command-scoped override for artifact history behavior. Supported values are `versioned`, `currentOnly`, `required`, `slimHistory`, `checkpointOnly`, and `metadataOnly`.

Payload naming applies only to payload artifacts selected for versioning. Support artifacts keep system-controlled history paths. If a payload's current history uses a named state such as `v0.0.1`, a later version request must provide the next `stateSegment` or explicitly request an ordinal fallback segment.

## Environment

- [[wu.environment-variables#weave_log_dir]] controls where runtime logs are written.
- [[wu.environment-variables#weave_timing]] enables timing lines for the composed flow and its phases.
- [[wu.environment-variables#weave_generated_at]] sets the timestamp used by the generate phase when rendering pages.
- [[wu.environment-variables#home-and-userprofile]] can affect workspace/local-access policy resolution and publication validation.
