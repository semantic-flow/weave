---
id: h3631a7jwxxrdb3zq0vou9i
title: 2026 05 16_1748 Add Source References
desc: ''
updated: 1778978963780
created: 1778978963780
---

## Goals

- Add an explicit all-terms extraction option that creates source-reference links for every newly extracted term.
- Let ontology publication workflows avoid manual per-term `knop add-reference` calls after `extract --all-terms`.
- Use the existing `ReferenceCatalog` / `ReferenceLink` model and current `knop add-reference` serialization instead of inventing a second source-reference shape.
- Keep reference creation opt-in at first, because canonical references are correct for ontology-definition sources but too strong as a silent default for every RDF payload.

## Summary

`weave extract --all-terms --source ...` already discovers mesh-scoped named terms from a selected RDF source artifact, creates minimal Knop support surfaces for new terms, skips generated support artifacts, and reports preview output. The missing dogfood feature is source-reference creation: for ontology files such as `semantic-flow-core-ontology.ttl`, each extracted class/property/shape term should get a managed reference back to the source artifact that defines it.

The proposed CLI surface is:

```bash
weave extract --all-terms --source ontology --add-source-references --reference-role canonical
```

For the `sflo` dogfood run, this should create each extracted term's `_knop/_references/references.ttl` with a `sflo:ReferenceLink` targeting the source designator path and role `sflo:referenceRole_canonical`.

## Discussion

### Current State

All-terms extraction exists in runtime and CLI:

- runtime: `executeExtractAllTerms` and `previewExtractAllTerms`
- CLI: `weave extract --all-terms --source ... --accept-preview`
- tests: integration and e2e coverage prove discovery, preview, support-artifact skipping, and creation of Knop support surfaces

Managed reference creation also exists:

- runtime: `executeKnopAddReference`
- CLI: `weave knop add-reference <designator> --reference-target-designator-path <target> --reference-role <role>`
- tests: integration and e2e coverage prove reference catalog creation, idempotent-ish existing catalog handling, role IRIs, and generated page rendering

What does not exist yet is a bulk path that combines the two without forcing a human or deploy script to enumerate every discovered term.

### Reference Semantics

For ontology-definition sources, the desired relationship is broad and current by default:

- extracted term: the class, property, shape, or other named resource discovered in source RDF
- reference target: the source artifact designator, such as `ontology`, `config`, or `ontology/shacl`
- reference role: `canonical`
- target state: omitted for the first slice

The extraction source registry already records where extraction evidence came from and can carry pinned state/source evidence. The canonical reference should point to the governing source artifact unless we later need a separate pinned-reference mode.

### Subject/Predicate/Object Scope

All-terms discovery currently considers named nodes from subject, predicate, and object positions when they are under the mesh base and not generated support resources. For ontology publication this is useful because properties often appear as predicates before or outside their own declaration block, and classes/shapes may appear in object position. The first source-reference slice should follow the existing all-terms discovery result rather than introduce a narrower subject-only definition heuristic.

### Idempotence

The command should be safe to rerun. This first slice adds references only for terms newly extracted during the invocation, so a rerun after the terms already exist creates no additional reference catalogs. A later backfill mode can handle previously extracted terms that are missing source references.

## Open Issues

- Resolved: `--add-source-references` adds references only for terms newly created during this invocation.
- Resolved: when extraction uses `--source-state`, source references also carry `sflo:referenceTargetState` for that selected historical state.

## Decisions

- Add explicit `--add-source-references` and `--reference-role canonical` support to `extract --all-terms`.
- Keep source-reference creation opt-in for now.
- Require `--reference-role` when `--add-source-references` is supplied rather than silently defaulting to `canonical`.
- Use broad source-artifact references for current `--source` extraction, and add `sflo:referenceTargetState` when extraction explicitly selects `--source-state`.
- Reuse the existing `ReferenceCatalog` / `ReferenceLink` shape and `knop add-reference` planning semantics.
- Follow existing all-terms discovery scope across subject, predicate, and object named nodes.
- Do not backfill missing source references for existing terms in this slice.

## Contract Changes

- CLI: `weave extract --all-terms` accepts `--add-source-references`.
- CLI: `--reference-role <role>` becomes valid with `extract --all-terms` when `--add-source-references` is present.
- Runtime: `LocalExtractAllTermsRequest` gains optional source-reference fields.
- Runtime result should report reference-created paths separately or include them in created/updated paths while making the summary clear.
- Existing all-terms extraction without `--add-source-references` should keep its current behavior.
- `--reference-role` without `--add-source-references` is rejected for `extract --all-terms`.

## Testing

- Add runtime integration coverage proving `executeExtractAllTerms` with source references creates one reference catalog per newly extracted term.
- Assert each current-source reference uses `sflo:referenceRole_canonical`, `sflo:referenceTarget <sourceDesignatorPath>`, and no `sflo:referenceTargetState`.
- Assert source-state extraction references include `sflo:referenceTargetState`.
- Assert rerunning the command does not duplicate references.
- Add CLI e2e coverage for `weave extract --all-terms --source ... --add-source-references --reference-role canonical --accept-preview`.
- Keep existing tests for all-terms extraction without source references passing unchanged.
- Run focused extract/reference tests, then `deno task check` and `deno task lint` after implementation.

## Non-Goals

- Do not make source references the default behavior for all RDF payload extraction yet.
- Do not design a new reference role vocabulary in this task.
- Do not solve full source-reference backfill for every existing mesh unless it falls out naturally from the first implementation.
- Do not make an `sflo` Accord/conformance scenario as part of this task.

## Implementation Plan

- [x] Add request/result fields for all-terms source-reference creation.
- [x] Thread `--add-source-references` and `--reference-role` through the `extract --all-terms` CLI path.
- [x] Reuse or factor reference planning so all-terms extraction can create the same reference catalog artifacts as `knop add-reference`.
- [x] Ensure created references target the selected source designator path and use the requested reference role.
- [x] Make reruns avoid duplicate references.
- [x] Add focused runtime tests.
- [x] Add CLI e2e coverage.
- [x] Run focused tests, then `deno task check` and `deno task lint`.
