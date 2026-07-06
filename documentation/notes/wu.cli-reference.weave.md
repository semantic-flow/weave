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
weave [--mesh-root <meshRoot>] [--target <target>]... [--generated-at <iso-8601>]
weave [--payload-history-segment <segment>] [--payload-state-segment <segment>] [--payload-manifestation-segment <segment>]
weave [--history-tracking-policy <policy>] [--silent] [--validate-before] [--validate-after]
```

`--mesh-root` defaults to the current directory. `--target` uses the shared [[wu.cli-reference.target-syntax]] form, and `/` is the root designator described in [[wu.cli-reference.root-designator]].

## Examples

```sh
weave
weave --mesh-root docs
weave --target 'designatorPath=alice/data'
weave --target 'designatorPath=alice,recursive=true'
weave --target 'designatorPath=game/state' --target 'designatorPath=game/session'
weave --generated-at 2026-07-06T12:34:56Z
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

Existing-mesh commands load `_mesh/_config/config.ttl` when it exists. Mesh-local config can set durable policy bindings for history tracking, ResourcePage generation, and ResourcePage presentation, plus scoped settings such as publication profile and naming defaults.

`--history-tracking-policy` is an advanced command-scoped override for artifact history behavior. Supported values are `versioned`, `currentOnly`, `required`, `slimHistory`, `checkpointOnly`, and `metadataOnly`. It applies only to the current command and wins over mesh-local config for that run.

`--generated-at` pins the single timestamp used in generated ResourcePage footers for this invocation. The value must be an ISO 8601 instant with an explicit UTC offset, such as `2026-07-06T12:34:56Z` or `2026-07-06T08:34:56-04:00`; Weave canonicalizes it to UTC `toISOString()` form in output. When this flag is supplied, footer-only page differences are written so existing pages converge to the requested timestamp. When omitted, Weave samples the current time once and keeps the normal timestamp-only skip behavior.

Payload naming applies only to payload artifacts selected for versioning. Support artifacts keep system-controlled history paths. If a payload's current history uses a named state such as `v0.0.1`, a later version request must provide the next `stateSegment` or explicitly request an ordinal fallback segment.

Repeated exact `--target` flags can advance multiple payload artifacts in one invocation. Explicit payload batches are planned in canonical designator-path order, only include the requested targets, and merge shared support-artifact updates into one deterministic plan. Re-running the same completed payload batch no-ops already-current payloads rather than creating duplicate historical states.

For explicit multi-target payload batches, Weave hashes the requested targets' current working payload files before batch content capture and verifies those hashes after capture. If a working payload changes during capture, the whole batch is refused before Weave writes anything, and the diagnostic names the changed file. Changes after capture are ignored by design; the batch is derived from the captured content.

## Environment

- [[wu.environment-variables#weave_log_dir]] controls where runtime logs are written.
- [[wu.environment-variables#weave_timing]] enables timing lines for the composed flow and its phases.
- [[wu.environment-variables#home-and-userprofile]] can affect workspace/local-access policy resolution and publication validation.
