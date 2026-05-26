---
id: l4f383cv6hbjvju218j5gur
title: weave validate
desc: ''
updated: 1779376196220
created: 1779376196220
---

## Summary

`weave validate` checks the current mesh or publication state without writing files.

## Usage

```sh
weave validate [mesh|publication] [--mesh-root <meshRoot>] [--target <target>]...
```

`mesh` is the default scope. `publication` runs publication-readiness checks and does not accept `--target`.

## Examples

```sh
weave validate
weave validate mesh
weave validate publication
weave validate --target 'designatorPath=alice/data'
weave validate --target 'designatorPath=alice,recursive=true'
```

## Scopes

`weave validate mesh` validates the mesh state. When a publication profile is configured, mesh validation includes the retained publication checks.

`weave validate publication` runs only publication-readiness checks, currently conservative host-local path leakage checks plus the GitHub Pages `.nojekyll` check when the mesh config selects the GitHub Pages profile.

Targeted mesh validation uses [[wu.cli-reference.target-syntax]]. Use [[wu.cli-reference.root-designator]] when the root resource is the target.

## Environment

- [[wu.environment-variables#weave_log_dir]] controls where command audit logs are written.
- [[wu.environment-variables#weave_timing]] enables aggregate timing lines for `validate.mesh` or `validate.publication`.
- [[wu.environment-variables#home-and-userprofile]] can affect local-access policy loading; `HOME` is also part of publication path-leakage evidence.
