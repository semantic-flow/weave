---
id: 3srwlsh9zj3u9n9dtb8hkb7
title: 2026 05 04 Extraction Improvements
desc: ''
updated: 1777934283501
created: 1777934283501
---

## Goals

- Make extraction-source resolution explicit enough that extracted term pages can either track the current source artifact or intentionally pin to a historical state.
- Restore the useful default: extracting a term from a source artifact should track that source artifact's current state unless the operator explicitly requests a pinned source state.
- Add a dedicated command for changing an existing extracted Knop's source-resolution contract without overloading `extract`, which should remain primarily a creation operation.
- Clean up all-terms confirmation naming by replacing vague `--yes` usage with a flag that describes the accepted action.
- Preserve the sidecar ladder's historical rungs while giving the upcoming `16-version-bump` / `17-version-bump-woven` pair enough behavior to prove extracted pages can refresh from updated ontology or SHACL source.
- Keep forced unchanged release-state creation out of this task; that belongs to version/weave behavior even though the sidecar version-bump pair needs it.

## Summary

Current extraction always writes a pinned `sfc:ExtractionSource` with `sfc:hasRequestedTargetState` and `sfc:hasArtifactResolutionMode <.../Pinned>`. That was useful for the first Alice Bio and Fantasy Rules extraction rungs because it made the first extraction state reproducible, but it is the wrong default for ontology and SHACL term pages that should reflect the current source artifact across later source releases.

The improved model is:

- `Current` source resolution is the default for new extracted terms.
- `Pinned` source resolution is explicit and requires a historical source state.
- `extract` creates missing extracted identifier surfaces and skips already-created surfaces in batch mode.
- a dedicated `set extraction-source` command updates the source-resolution contract for an existing extracted Knop.
- generated pages resolve source-derived RDF facts through the extracted Knop's linked source registry and its `sfc:ExtractionSource`, using current or pinned semantics as recorded there.

This task should update the CLI, runtime extraction planning, generated page source loading, tests, and user-facing docs. It should also create the behavior needed before the Fantasy Rules sidecar `17-version-bump-woven` rung can prove existing extracted term pages update after the ontology or SHACL source advances to `v0.0.2`.

## Discussion

The important distinction is between extraction as creation and extraction-source management as later maintenance.

`weave extract` is allowed to skip existing extracted Knops. That is sensible for `--all-terms`, where the operator wants to mint missing term surfaces from a source RDF graph without rewriting every already-governed identifier. But skipping existing Knops means `extract --all-terms` cannot be the only operation that changes an already extracted term from a pinned source to a current-tracking source. That change should be a deliberate update to the Knop source registry's source-resolution contract.

The CLI should avoid vague confirmation flags. `--yes` does not say what is being accepted. For all-terms extraction, the operator is accepting the previewed list of identifiers to create, so the noninteractive flag should be `--accept-preview`. Because Weave is pre-v1, this task can remove or replace `--yes` rather than preserving it as a compatibility alias unless a short transition proves necessary.

The source selection options should encode resolution mode directly:

```sh
weave extract ontology/AbilityScore --source ontology
```

creates a missing term surface whose `ExtractionSource` follows the current ontology source artifact.

```sh
weave extract ontology/AbilityScore --source-state ontology/releases/v0.0.1
```

creates a missing term surface whose `ExtractionSource` is pinned to that historical source state. `--source-state` implies pinned resolution and should resolve the owning source artifact from mesh inventory rather than requiring the operator to repeat both `--source ontology` and `--source-state ontology/releases/v0.0.1`.

For existing extracted terms, use a dedicated command:

```sh
weave set extraction-source ontology/AbilityScore --source ontology
weave set extraction-source ontology/AbilityScore --source-state ontology/releases/v0.0.1
```

The command should replace the single source binding for the target extracted Knop. It should not append another `sfc:hasExtractionSource` edge.

The batch form can use the source artifact to discover scoped terms and then update source-resolution contracts for terms that already have Knops:

```sh
weave set extraction-source --all-terms --source ontology --accept-preview
weave set extraction-source --all-terms --source-state ontology/releases/v0.0.1 --accept-preview
```

This is separate from `weave extract --all-terms`, which creates missing term surfaces. The batch set command is the migration/update surface for already-created term Knops.

The first Fantasy Rules `08/09` extraction branches and manifests currently assert pinned extraction sources. There are two reasonable paths:

- leave those historical rungs pinned and add a later migration in `16/17` using `weave set extraction-source --all-terms --source ontology` and `--source shacl`
- retrofit the older rungs and manifests to make current-tracking extraction the default from the start

The safer path is to leave settled historical rungs alone unless they block the sidecar ladder. The `16/17` pair can intentionally demonstrate the migration from pinned to current before proving term pages refresh from `v0.0.2`.

This task is related to but distinct from forced unchanged state creation. The sidecar `17` release pair needs a new SHACL `v0.0.2` state even if SHACL bytes are unchanged, but that is version/weave behavior and should be tracked separately.

## Decisions

- Use `Current` as the default `ArtifactResolutionMode` for newly created `ExtractionSource` records.
- Treat missing `sfc:hasArtifactResolutionMode` on `ExtractionSource` as `Current` for generated page resolution, so older or simpler inventories can omit the default.
- Use `--source <sourceDesignatorPath>` for current-tracking extraction source selection.
- Use `--source-state <historicalStatePath>` for pinned extraction source selection; this implies pinned mode and should resolve the owning source artifact from mesh inventory.
- Keep `--source` and `--source-state` mutually exclusive.
- Do not add a generic `--source-resolution current|pinned` flag unless implementation reveals a real ambiguity.
- Add `weave set extraction-source` as the dedicated command for changing an existing extracted Knop's source-resolution contract.
- `weave set extraction-source --all-terms` should update every already extracted term discovered in the selected source graph after preview acceptance. The project has release history, so an operator can revert if a broad migration is wrong.
- Treat it as an error when `weave extract --source-state <state>` or `weave set extraction-source --source-state <state>` selects a pinned historical state that does not mention the target term.
- Enforce one primary extraction source per extracted Knop. SHACL should express this as `sh:maxCount 1` for `sfc:hasExtractionSource` where the shape applies, while the extraction-source details live in the Knop's `_sources` registry.
- Rename all-terms noninteractive confirmation from `--yes` to `--accept-preview`.
- Remove `--source-designator-path` immediately instead of keeping it as a deprecated alias for `--source`.
- Remove `--yes` immediately instead of keeping it as a deprecated alias for `--accept-preview`.
- Keep forced unchanged payload versioning out of this task.
- Leave older Fantasy Rules `08/09` fixture manifests pinned. The `16/17` version-bump pair should explicitly migrate existing extracted terms with `weave set extraction-source`.

## Contract Changes

- `weave extract <targetDesignatorPath>` continues to create a missing extracted identifier surface from an eligible woven RDF source.
- `weave extract <targetDesignatorPath> --source <sourceDesignatorPath>` creates a missing extracted identifier surface with current-tracking source resolution.
- `weave extract <targetDesignatorPath> --source-state <historicalStatePath>` creates a missing extracted identifier surface with pinned source resolution.
- `weave extract --all-terms --source <sourceDesignatorPath> --accept-preview` creates missing term surfaces from the selected current-tracking source artifact.
- `weave extract --all-terms --source-state <historicalStatePath> --accept-preview` creates missing term surfaces from the selected pinned source state.
- `weave set extraction-source <targetDesignatorPath> --source <sourceDesignatorPath>` replaces the existing extracted Knop's source binding with a current-tracking source binding.
- `weave set extraction-source <targetDesignatorPath> --source-state <historicalStatePath>` replaces the existing extracted Knop's source binding with a pinned source binding.
- `weave set extraction-source --all-terms --source <sourceDesignatorPath> --accept-preview` previews and updates existing extracted terms discovered in the selected source graph to current-tracking source resolution.
- `weave set extraction-source --all-terms --source-state <historicalStatePath> --accept-preview` previews and updates existing extracted terms discovered in the selected source graph to pinned source resolution.
- Generated resource pages for extracted terms must read source-derived RDF facts using the recorded `ExtractionSource` resolution mode from the Knop's linked source registry.
- Current-tracking generated pages use the source artifact's current latest state at generation time.
- Pinned generated pages use the recorded `sfc:hasRequestedTargetState`.
- Inventory-rooted extraction-source records are obsolete; stale fixture refs should be regenerated to the `_sources` registry shape rather than carried as a compatibility mode.

## Testing

- Add core extraction planner tests for current-mode `ExtractionSource` Turtle.
- Add core extraction planner tests for pinned-mode `ExtractionSource` Turtle using `sourceStatePath`.
- Add runtime tests that generated extracted term pages refresh from the current source artifact after the source artifact advances.
- Add runtime tests that pinned extracted term pages continue to render from the pinned historical state after the source artifact advances.
- Add CLI tests for `weave extract <target> --source <source>`.
- Add CLI tests for `weave extract <target> --source-state <state>`.
- Add CLI validation tests proving `--source` and `--source-state` are mutually exclusive.
- Add CLI tests for `weave extract --all-terms --source <source> --accept-preview`.
- Add CLI tests proving `--yes` is rejected.
- Add runtime and CLI tests for `weave set extraction-source <target> --source <source>`.
- Add runtime and CLI tests for `weave set extraction-source <target> --source-state <state>`.
- Add tests proving `weave set extraction-source` replaces the existing binding rather than appending a second `sfc:hasExtractionSource`.
- Add SHACL or ontology validation coverage for at-most-one `sfc:hasExtractionSource` where that shape is maintained in this repository or the ontology dependency, plus source-registry validation for the owned source binding.
- Update sidecar integration coverage so the `16/17` version-bump pair can migrate existing extracted terms to current source resolution and then verify refreshed extracted pages.

## Non-Goals

- Creating missing extracted term surfaces from `weave set extraction-source`; use `weave extract` for creation.
- Forced unchanged release-state creation for unchanged ontology or SHACL bytes; this belongs to version/weave behavior.
- Multiple primary extraction sources for one extracted Knop.
- Replacing `ReferenceCatalog` or `ReferenceLink` behavior.
- Automatic deletion or deprecation when a current-tracking source no longer describes an extracted term.
- Remote source fetching or live web dereferencing.
- Reworking fixture page prose or styling beyond what is required to prove source-resolution behavior.

## Implementation Plan

- [x] Update this task note and related sidecar/all-terms notes with the settled extraction-source resolution contract.
- [x] Update [[wu.cli-reference]] with `--source`, `--source-state`, `--accept-preview`, and `weave set extraction-source`.
- [ ] Update the relevant Semantic Flow behavior spec, likely [[sf.spec.2026-04-05-extract-behavior]], for current and pinned source-resolution semantics.
- [x] Extend extraction planning so `ExtractionSource` can be rendered in current or pinned mode.
- [x] Update single-target extract runtime and CLI parsing to use `--source` and `--source-state`.
- [x] Update all-terms extract runtime and CLI parsing to use `--source` / `--source-state` and `--accept-preview`.
- [x] Update generated page source loading so current-mode extraction sources resolve the source artifact's current latest state at generation time.
- [x] Add `weave set extraction-source` runtime support for one target.
- [x] Add `weave set extraction-source --all-terms` runtime support for batch migration/update.
- [x] Add or update SHACL constraints so an extracted Knop has at most one `sfc:hasExtractionSource` and extraction-source details are accepted in `_sources`.
- [x] Update unit, integration, and e2e tests for the new contract.
- [x] Decide whether to retrofit existing Fantasy Rules `08/09` rungs or keep them pinned and migrate in `16/17`.
- [x] Update [[wd.decision-log]] once behavior is implemented and the fixture policy is settled.
