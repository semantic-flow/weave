---
id: 7ljbyvjrutupvu7nzw45rjw
title: 'release notes v0.0.2'
desc: ''
updated: 1778685993197
created: 1778685984243
---

## Summary

`v0.0.2` is a source checkpoint before the enum/config/fixture-ladder migration. It preserves the current local Weave implementation state after extraction-source improvements, recursive/named payload versioning work, root-resource targeting, and the latest config-design consolidation.

This release publishes the `v0.0.2` Git tag and GitHub Release as the release artifacts. It does not include packaged binaries or npm/JSR artifacts.

## Highlights

- Local CLI/runtime flows cover the carried Alice Bio ladder through the Bob extraction weave and the Sidecar Fantasy Rules ladder through the first named release weave.
- `weave`, `weave validate`, `weave version`, and `weave generate` share the local runtime seams for target selection, version planning, and page generation.
- `weave extract` supports explicit working or exact source selection with `--source` and `--source-state`.
- `weave set extraction-source` updates existing extracted Knops so source-following behavior can be changed without recreating term surfaces.
- Recursive batch target handling and root designator support are in place, including CLI `/` normalization to the internal root designator.
- ResourcePage rendering includes the recent extraction-source and metadata presentation refinements, with Semantic Flow metadata opt-in rather than always shown.
- Structured JSONL logging exists as a first narrow runtime/audit slice.
- The enum-instance naming decision has been settled toward flat underscore-separated individuals, with fixture regeneration deferred until after the next config pass.
- The grand config synthesis task now records the intended direction for Weave defaults, `ConfigResolutionConfig`, `ResolvedConfig`, authored config layers, inherited propagation controls, resource-page policy, content digests, and fixture sequencing.

## Validation Status

`v0.0.2` is a source checkpoint, not a polished distribution release. The intended source quality gate is:

```bash
deno task ci
```

At this checkpoint, the full quality gate is known to need follow-up work and should not be treated as the release's main claim. The release is still useful as a named baseline before the enum/config/fixture churn, and the dedicated full CI/CD task owns turning `v0.1.0` into a green, packageable release.

## Known Limitations

- No packaged CLI, daemon, web app, npm package, JSR package, or binary asset is produced for this release.
- No `weave --version` surface exists yet.
- The full `deno task ci` quality gate is not yet the effective release blocker.
- The daemon and web app remain scaffolds rather than carried runtime slices.
- Fixture branches still need a generator/replay workflow before the planned enum/config rerung.
- The active config implementation has not yet caught up with the grand config synthesis design.
- Historical ResourcePage regeneration, service-backed config caches, and generic config-source management commands remain future work.

## Next

With this checkpoint in place, the intended sequence is:

1. Begin the grand config synthesis implementation using the settled enum naming convention.
2. Update non-fixture tests alongside the config implementation as behavior and vocabulary change.
3. Implement minimal inherited config propagation controls before fixture rerunging.
4. Build or refine the fixture-ladder generator enough to regenerate affected branches.
5. Rerung fixtures once for the combined enum and config fallout, then update fixture-backed tests and Accord manifests against the regenerated outputs.
