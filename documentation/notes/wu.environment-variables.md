---
id: ljq9af8hy7jkimwx0dlmvvq
title: environment variables
desc: ''
updated: 1779377175636
created: 1779375751859
---

## WEAVE_LOG_DIR

Sets the directory where Weave writes runtime and audit logs. If unset, logs are written under `.weave/logs/` in the inferred workspace root. For whole-root meshes the workspace is the mesh root; for sidecar meshes the workspace is inferred from `_mesh/_config/config.ttl`.

Relevant command notes: [[wu.cli-reference.weave]], [[wu.cli-reference.validate]], [[wu.cli-reference.version]], [[wu.cli-reference.generate]], [[wu.cli-reference.mesh.create]], [[wu.cli-reference.integrate]], [[wu.cli-reference.extract]], [[wu.cli-reference.set.extraction-source]], [[wu.cli-reference.payload.update]], [[wu.cli-reference.knop.create]], [[wu.cli-reference.knop.add-reference]], [[wu.cli-reference.set.history]], [[wu.cli-reference.set.next-state]].

```sh
WEAVE_LOG_DIR=/tmp/weave-logs weave --mesh-root docs
```

## WEAVE_TIMING

Enables aggregate runtime timing output on stderr for `weave`, `weave validate`, `weave version`, and `weave generate`. Any non-empty value except `0`, `false`, `no`, or `off` enables timing.

Relevant command notes: [[wu.cli-reference.weave]], [[wu.cli-reference.validate]], [[wu.cli-reference.version]], [[wu.cli-reference.generate]].

```sh
WEAVE_TIMING=1 weave --mesh-root docs
WEAVE_TIMING=1 weave validate publication --mesh-root docs
```

## WEAVE_GENERATED_AT

Overrides the timestamp used while rendering ResourcePages. This is mainly useful for deterministic tests, fixture regeneration, and reproducible documentation snapshots. Use an ISO 8601 timestamp.

Relevant command notes: [[wu.cli-reference.weave]], [[wu.cli-reference.generate]].

```sh
WEAVE_GENERATED_AT=2026-05-03T00:00:00.000Z weave generate --mesh-root docs
```

## HOME and USERPROFILE

Weave uses `HOME`, or `USERPROFILE` when `HOME` is not set, to find the host-local access file `~/.sf-local-access.ttl`. That file can carry local path grants for source directories outside the mesh workspace. `weave integrate --grant-source-directory` may need these variables when the grant belongs in host-local policy rather than mesh config.

Publication validation also uses `HOME` as conservative evidence for host-local path leakage. If neither `HOME` nor `USERPROFILE` is set, Weave cannot add host-local access rules.

Relevant command notes: [[wu.cli-reference.weave]], [[wu.cli-reference.validate]], [[wu.cli-reference.version]], [[wu.cli-reference.generate]], [[wu.cli-reference.integrate]], [[wu.cli-reference.extract]], [[wu.cli-reference.set.extraction-source]].

## Example-Only Shell Variables

Some runbook examples define shell variables such as `WEAVE_CLI`, `WEAVE_ROOT`, `SFLO_SRC`, or `SFLO_PUB` to keep command sequences readable. Weave does not read those names directly; they are ordinary shell conveniences. See [[wu.cli-reference.examples.sflo]] for one dogfooding sequence that uses them.
