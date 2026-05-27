---
id: ljq9af8hy7jkimwx0dlmvvq
title: environment variables
desc: ''
updated: 1779377175636
created: 1779375751859
---

## WEAVE_LOG_DIR

Sets the directory where Weave writes runtime and audit logs. If unset, logs are written under `${XDG_STATE_HOME:-~/.local/state}/weave/meshes/<mesh-identifier>/logs/`. The mesh identifier is derived from the canonical mesh base, so whole-root and sidecar meshes for the same mesh base share the same user-local log location.

Relevant command notes: [[wu.cli-reference.weave]], [[wu.cli-reference.validate]], [[wu.cli-reference.version]], [[wu.cli-reference.generate]], [[wu.cli-reference.mesh.create]], [[wu.cli-reference.import]], [[wu.cli-reference.integrate]], [[wu.cli-reference.extract]], [[wu.cli-reference.set.extraction-source]], [[wu.cli-reference.payload.update]], [[wu.cli-reference.knop.create]], [[wu.cli-reference.knop.add-reference]], [[wu.cli-reference.set.history]], [[wu.cli-reference.set.next-state]].

```sh
WEAVE_LOG_DIR=/tmp/weave-logs weave --mesh-root docs
```

## WEAVE_SETTINGS

Sets the root directory for Weave's per-user settings store. If unset, Weave uses `${XDG_CONFIG_HOME:-~/.config}/weave`. Mesh-scoped host-local access grants are stored under `$WEAVE_SETTINGS/meshes/<mesh-identifier>/access.ttl`.

```sh
WEAVE_SETTINGS=/tmp/weave-settings weave integrate source.ttl --designator-path source --grant-source-directory .
```

## XDG_STATE_HOME and XDG_CACHE_HOME

`XDG_STATE_HOME` selects the fallback root for default runtime logs when `WEAVE_LOG_DIR` is unset. `XDG_CACHE_HOME` selects the fallback root for mesh-scoped cache files. If unset, Weave uses `~/.local/state` and `~/.cache`.

## WEAVE_TIMING

Enables aggregate runtime timing output on stderr for `weave`, `weave validate`, `weave version`, and `weave generate`. Any non-empty value except `0`, `false`, `no`, or `off` enables timing.

Relevant command notes: [[wu.cli-reference.weave]], [[wu.cli-reference.validate]], [[wu.cli-reference.version]], [[wu.cli-reference.generate]].

```sh
WEAVE_TIMING=1 weave --mesh-root docs
WEAVE_TIMING=1 weave validate publication --mesh-root docs
```

## HOME and USERPROFILE

Weave uses `HOME`, or `USERPROFILE` when `HOME` is not set, as the fallback base for the user settings store and XDG state/cache locations. `weave integrate --grant-source-directory` may need these variables when `WEAVE_SETTINGS` and the relevant XDG home variables are not set.

Publication validation also uses `HOME` as conservative evidence for host-local path leakage. If Weave cannot resolve a user settings root from `WEAVE_SETTINGS`, XDG variables, `HOME`, or `USERPROFILE`, it cannot add host-local access rules.

Relevant command notes: [[wu.cli-reference.weave]], [[wu.cli-reference.validate]], [[wu.cli-reference.version]], [[wu.cli-reference.generate]], [[wu.cli-reference.integrate]], [[wu.cli-reference.extract]], [[wu.cli-reference.set.extraction-source]].

## Example-Only Shell Variables

Some runbook examples define shell variables such as `WEAVE_CLI`, `WEAVE_ROOT`, `SFLO_SRC`, or `SFLO_PUB` to keep command sequences readable. Weave does not read those names directly; they are ordinary shell conveniences. See [[wu.cli-reference.examples.sflo]] for one dogfooding sequence that uses them.
