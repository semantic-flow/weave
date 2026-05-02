---
id: ct5bq1c4j0r2l8w7n6v9yxa
title: 2026 04 08_1133 Root Designator Path Support
desc: ''
updated: 1775711600000
created: 1775711600000
---

## Goals

- Support the root designator path as a first-class resource across local CLI, runtime, and core planning.
- Treat the root designator as the mesh base IRI, equivalent to RDF `<>`, without conflating it with `_mesh` support artifacts.
- Use `/` as the CLI sentinel for root while keeping the normalized internal representation path-relative.
- Preserve the resource-root targeting rules established in [[wd.completed.2026.2026-04-07_0020-targeting]].

## Summary

Current Weave behavior assumes that every designator path is non-empty. That assumption leaks through validation, target parsing, inventory discovery, path derivation, and page rendering.

The CLI reference now reserves `/` as the intended root-designator sentinel in [[wu.cli-reference]], but current releases do not actually support it. This task should make root designator paths real rather than merely documented.

The core semantic rule should be:

- the root designator path identifies the mesh base resource itself
- in RDF terms, it is the local relative-path analogue of `<>`
- in CLI terms, it is spelled `/`
- internally, it should normalize to the empty string `""`

That means this is not just a parser task. The implementation needs to make root-aware path construction and selection semantics coherent end-to-end.

## Discussion

The current blockers are structural:

- designator normalization rejects empty strings, so there is no internal way to represent root today
- CLI target parsing requires a non-empty `designatorPath` and has no explicit root sentinel
- inventory discovery drops the root candidate because `<_knop>` currently resolves to an empty relative designator path and that empty result is filtered out
- several path builders still use naïve string interpolation such as `${designatorPath}/_knop`, which would produce `/_knop`, `/_history001`, or `/index.html` for root instead of `_knop`, `_history001`, and `index.html`
- user-facing renderers would currently display a blank designator label if root were represented internally as `""`

The target-selection semantics also need to stay sharp:

- omitted targets still mean "all weaveable candidates"
- `designatorPath=/` exact targeting means "only the root identifier"
- `designatorPath=/,recursive=true` means "the root identifier plus all descendant identifiers"
- the existing most-specific-wins rule from [[wd.completed.2026.2026-04-07_0020-targeting]] should remain in force, so a more specific descendant target still overrides a recursive root target

The support-artifact boundary also matters:

- the root resource may own `_knop`, `_history001`, `index.html`, and related root-owned artifact paths
- `_mesh` remains mesh support and is not the same thing as the root resource
- root support should not reopen support-artifact-only explicit targeting

This task should make root spelling consistent across CLI surfaces. Any CLI argument or option whose meaning is "designator path" should accept `/` and normalize it before crossing into runtime/core logic. That includes shared `--target` parsing as well as single-designator commands such as `integrate`, `payload update`, `extract`, `knop create`, and `knop add-reference`.

## Open Issues

- None currently blocking if `/` remains a CLI-only sentinel and `""` remains the normalized internal root representation.

## Decisions

- The root designator path is semantically the mesh base IRI and should be treated as equivalent to RDF `<>`.
- The CLI spelling for the root designator path is `/`.
- The normalized internal representation for the root designator path is `""`.
- CLI normalization should translate `/` to `""` before runtime/core request handling rather than teaching every downstream layer about two root spellings.
- Omitted targets do not mean root; explicit `/` targeting remains distinct from supplying no targets.
- Exact `/` targeting selects only the root designator resource if it exists.
- Recursive `/` targeting selects the root designator resource plus descendant resources.
- Root-owned support artifacts must remain mesh-relative paths with no leading slash, for example `_knop`, `_history001`, and `index.html`.
- User-facing displays of the root designator path should render `/`, not a blank string.
- The resource-root targeting boundary from [[wd.completed.2026.2026-04-07_0020-targeting]] remains unchanged; `/` is a resource-root target, not a generic support-artifact escape hatch.

## Contract Changes

- Any CLI input field whose meaning is "designator path" should accept `/` as the root sentinel.
- Shared `--target <key=value,...>` parsing should accept `designatorPath=/`.
- `--reference-target-designator-path /` should be valid where a reference target may point at the root resource.
- Programmatic runtime/core request contracts should continue to use `designatorPath: ""` for the root resource rather than `/`.
- Root-aware path helpers should replace direct `${designatorPath}/...` string interpolation for support-artifact and page paths.
- Inventory discovery should include the root candidate when a root Knop exists at `_knop`.
- Resource page models and any other user-facing renderers should display `/` when the underlying designator path is `""`.

## Testing

- Add core coverage for root designator normalization and root-aware path helpers.
- Add core targeting coverage for exact root targeting and recursive root targeting.
- Add core targeting coverage proving recursive root still loses to a more specific descendant target when both match.
- Add runtime inventory coverage proving a root Knop at `_knop` yields the root candidate.
- Add integration and e2e coverage for `weave`, `weave validate`, `weave version`, and `weave generate` using `designatorPath=/`.
- Add CLI coverage for single-designator commands that accept `/`.
- Add coverage proving root-owned support-artifact paths are emitted without leading slashes.
- Keep existing non-root behavior unchanged.

## Non-Goals

- Changing the meaning or layout of `_mesh` support artifacts.
- Implementing public "latest" aliases or other current-state exposure changes.
- Multiple-history policy changes.
- HTML payload behavior.
- Support-artifact-only explicit targeting.
- Redefining omitted targets to mean the root resource.

## Implementation Plan

- [x] Introduce root-aware designator and path helpers, including CLI normalization from `/` to internal `""`.
- [x] Make shared `--target` parsing accept the root sentinel.
- [x] Make all single-designator CLI inputs accept the root sentinel consistently.
- [x] Include the root resource in inventory discovery and target resolution.
- [x] Refactor support-artifact and page path derivation so root-owned paths never gain a leading slash.
- [x] Update page and other user-facing rendering to display `/` for the root resource.
- [x] Add core, runtime, integration, and e2e coverage for root exact targeting, root recursive targeting, and root-owned path layout.
- [x] Update [[wu.cli-reference]] and [[wd.codebase-overview]] when the implementation lands.
