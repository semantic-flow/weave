---
id: ijzwtz3lr7fzw8whca0gfwn
title: weave knop add-reference
desc: ''
updated: 1779376279580
created: 1779376279580
---

## Summary

`weave knop add-reference` creates the first reference-catalog surface for a designator path and adds a `ReferenceLink` to another mesh resource.

## Usage

```sh
weave knop add-reference <designatorPath> --reference-target-designator-path <referenceTargetDesignatorPath> --reference-role <referenceRole> [--mesh-root <meshRoot>]
```

Use `/` for the root designator as described in [[wu.cli-reference.root-designator]].

## Examples

```sh
weave knop add-reference \
  alice/bio \
  --reference-target-designator-path bob \
  --reference-role Supplemental

weave knop add-reference \
  alice \
  --reference-target-designator-path / \
  --reference-role Supplemental \
  --mesh-root ./mesh
```

## Notes

`--reference-target-designator-path` names the existing mesh resource used as the reference target. `--reference-role` is a role token recorded on the created ReferenceLink.

For extracted all-terms workflows, [[wu.cli-reference.extract]] can create source references automatically for newly extracted terms.

## Environment

- [[wu.environment-variables#weave_log_dir]] controls where runtime logs are written.
