---
id: oims6nkz1ws981ll1ulxot0
title: root designator
desc: ''
updated: 1779376337614
created: 1779376337614
---

## Summary

The root designator is written as `/` in the CLI. It refers to the mesh root resource, not the operating-system filesystem root.

## Examples

```sh
weave --target 'designatorPath=/'
weave --target 'designatorPath=/,recursive=true'
weave integrate ./root.ttl --designator-path /
weave extract /
weave payload update ./root-v2.ttl /
weave knop create /
```

The same sentinel is accepted anywhere a Weave command expects a designator path, including `--reference-target-designator-path`:

```sh
weave knop add-reference alice \
  --reference-target-designator-path / \
  --reference-role Supplemental
```

## Notes

When a command prints or stores mesh-relative paths, root-owned support artifacts still live in ordinary files such as `_knop/` and `_mesh/`. The `/` value is only the user-facing designator-path spelling.

## Environment

The root designator does not read environment variables. The command using it determines the relevant variables; see [[wu.environment-variables]].
