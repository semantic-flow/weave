---
id: oavk9pw1lwz2duq3fpcw2dw
title: 2026 05 03 Term Extraction
desc: ''
updated: 1777854312008
created: 1777854312008
---

## Goals

- Add the next `mesh-sidecar-fantasy-rules` fixture pair for extracting ontology and SHACL terms from the already woven ontology and SHACL documents.
- Use the pair to clarify Semantic Flow `extract` behavior for ontology and SHACL term publishing, not graph splitting or payload rewriting.
- Keep the first extracted term set deliberately small and reviewable.
- Make the extracted ontology and SHACL terms dereferenceable through Knop-managed current surfaces and generated pages under the docs-rooted sidecar mesh.
- Preserve an explicit source link from each extracted term back to the ontology or SHACL artifact state that justified the extraction, so generated term pages can continue to render from the original source.
- Plan Accord transition coverage for both the non-woven extraction step and the woven publication step, without creating the manifest files until the 08/09 branch shapes are settled.

## Summary

The sidecar fixture currently plans through `07-shacl-integrated-woven`: the ontology and SHACL documents are governed artifacts, and their first current-history snapshots have been woven into the public docs-rooted mesh. The next useful behavior slice is term extraction: mint Knop-managed Semantic Flow identifier surfaces for selected slash-IRI ontology and SHACL terms described by the governed ontology and SHACL documents.

The proposed pair is:

- `08-ontology-and-shacl-terms-extracted`: extract selected ontology and SHACL term identifiers from the woven ontology and SHACL documents into minimal Knop-managed current surfaces.
- `09-ontology-and-shacl-terms-extracted-woven`: run the `weave` operation over those extracted term surfaces so public term pages and support-artifact histories exist.

This is separate from [[wd.task.2026.2026-05-02-fantasy-rules-sidecar]] because the sidecar task is already carrying mesh topology, config, adjacent-source policy, release paths, and resource-page behavior. Term extraction has its own operation semantics and should not be hidden inside that broader fixture task.

## Discussion

The first sidecar ladder proves that ontology and SHACL documents can be governed as sidecar artifacts. That does not automatically make each ontology class or SHACL shape a first-class dereferenceable Semantic Flow resource. For slash IRIs such as `https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/ontology/AbilityScore` and `https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/ontology/CharacterShape`, the mesh should be able to expose term pages backed by Knop surfaces.

This task should apply the Alice Bio extraction precedent without copying its exact Bob-shaped assumptions. The Alice Bio slice extracted one resource mentioned in a payload document and created a minimal Knop plus a supplemental reference back to the source payload state. That pinned `referenceTargetState` is especially important here. The fantasy-rules slice should extract several selected ontology terms from the governed ontology artifact and at least one selected shape term from the governed SHACL artifact, and each extracted term should keep an explicit reference back to the artifact state whose triples justified the extraction.

The first extracted term set should stay small. A reasonable starting set is:

- `ontology/AbilityScore`
- `ontology/Alignment`
- `ontology/Character`
- `ontology/PlayerCharacter`, if it is already present in the authored ontology by the time 08 is cut
- `ontology/CharacterShape`, if it is already present in the authored SHACL graph by the time 08 is cut

Representative controlled values and additional shapes can follow after the class/shape term path is settled. Extracting every subject IRI from the ontology or SHACL graph in the first pair is the wrong target: it would make the fixture noisy, make branch review harder, and force broad source-selection policy before the core term-surface behavior is proven.

For `08`, extraction should create current support surfaces only. It should update the working mesh inventory so the extracted term Knops are discoverable, and it should create minimal `D/_knop/_meta/meta.ttl`, `D/_knop/_inventory/inventory.ttl`, and probably `D/_knop/_references/references.ttl` files for each extracted term. The reference catalog should include a link whose `referenceTarget` is the ontology or SHACL artifact and whose `referenceTargetState` is the woven historical state used for extraction. It should not create histories or generated pages yet.

For `09`, the `weave` operation should version the new support artifacts, validate the resulting current surface, and generate public pages for the extracted terms and their support artifacts. The term pages should be term pages, not generic artifact pages: they should identify the term, show useful type/label/comment/path facts from the ontology or SHACL document when available, and link back to the governing artifact and historical state that justified the extraction. Page generation should resolve those displayed term facts through the pinned source link, not by scanning whatever source happens to be latest at render time.

If a later ontology or SHACL version no longer describes an extracted term, the existing extracted term surface should not be silently rewritten from missing current data. The conservative behavior is: no automatic fresh update is made for that term unless an explicit refresh/deprecation/removal operation is requested. Its page can still render from the previously pinned source state. A later fixture can decide whether disappearance from the latest source should create a `Deprecated` reference, a warning on the page, or a new lifecycle operation, but it should not be an implicit side effect of ordinary weave.

The exact reference role still needs care. `ReferenceRole/Supplemental` was right for Bob because Alice's bio remained a descriptive source for Bob. Ontology and SHACL term extraction may deserve a stronger `DefinedBy`, `Source`, or schema-specific role if the ontology vocabulary already has one. If no better role exists yet, the first fixture can use `Supplemental` explicitly and leave a follow-up decision to refine role vocabulary.

## Open Issues

- Which exact term list should be extracted in the first 08/09 pair?
- Should extracted ontology and SHACL term references use existing `ReferenceRole/Supplemental`, or should the ontology define a more precise role such as "defined by" before this pair is treated as settled?
- Should `extract` accept an explicit source artifact selector for this slice, or should the first sidecar implementation infer the woven ontology or SHACL source from the target designator paths?
- Should one `extract` request create multiple term surfaces in a batch, or should 08 represent a sequence of single-target extractions whose combined result is the branch state?
- What is the eventual refresh behavior when a newer ontology or SHACL state changes, removes, or deprecates an already extracted term?
- How much source-derived term detail belongs in generated term pages in 09 versus staying deferred to a broader resource-page template task?
- Should controlled-value individuals and additional shape resources be included in the first pair, or deferred until class/shape extraction is stable?

## Decisions

- Use `08-ontology-and-shacl-terms-extracted` for the non-woven extraction branch.
- Use `09-ontology-and-shacl-terms-extracted-woven` for the woven publication branch.
- Keep term extraction separate from the main sidecar task note; cross-reference [[wd.task.2026.2026-05-02-fantasy-rules-sidecar]] rather than expanding it further.
- Treat this as ontology and SHACL term identifier extraction, not payload splitting.
- Do not rewrite `ontology/fantasy-rules-ontology.ttl`, `shacl/fantasy-rules-shacl.ttl`, or their woven bytes during extraction.
- Use docs-rooted designator paths such as `ontology/AbilityScore`, producing local mesh paths under `docs/ontology/AbilityScore/`.
- Each extracted term must keep an explicit source reference to the ontology or SHACL artifact and the specific woven state used for extraction.
- Generated term pages should use that pinned source reference for source-derived display facts.
- If a later ontology or SHACL source no longer contains the term, ordinary weave should not silently erase or rewrite the extracted term page from missing latest data.
- Keep the first extracted set narrow and explicitly listed in the manifests.
- Defer hash-IRI extraction; this pair is for the existing slash-IRI term convention.
- The first `08` term set is `ontology/AbilityScore`, `ontology/Alignment`, `ontology/Character`, `ontology/PlayerCharacter`, and `ontology/CharacterShape`.
- Use `ReferenceRole/Supplemental` for the first sidecar term-extraction slice while leaving a more precise source/definition role as a future ontology decision.
- Represent `08` as a sequence of single-target `extract` operations with explicit source designators where needed: ontology class terms extract from `ontology`, and `ontology/CharacterShape` extracts from `shacl`.

## Contract Changes

- Extend the sidecar fixture ladder beyond `07-shacl-integrated-woven` with an ontology-and-SHACL-term extraction pair.
- Extend `extract` behavior from one Bob-like target to a sidecar ontology-and-SHACL-term use case where selected term identifiers are extracted from governed, woven RDF documents.
- Define that non-woven term extraction creates Knop-managed current surfaces and updates working mesh inventory, but does not create histories or pages.
- Define that the woven term extraction step versions those support artifacts and generates public dereferenceable term pages.
- Clarify how extracted term surfaces point back to the source ontology or SHACL artifact and the relevant woven state through an explicit reference link.
- Clarify that source-derived term-page content is backed by that explicit reference, not by opportunistic latest-source scanning.
- Add sidecar Accord manifests for `07 -> 08` and `08 -> 09` as part of this task once the expected branch outputs are concrete enough to make the manifests normative.

## Testing

- Do not create the 08/09 conformance manifests until the extracted term set, reference role, and expected branch output are settled.
- Add `semantic-flow-framework/examples/sidecar-fantasy-rules/conformance/08-ontology-and-shacl-terms-extracted.jsonld` as part of this task when the 08 transition is ready to become normative.
- Add `semantic-flow-framework/examples/sidecar-fantasy-rules/conformance/09-ontology-and-shacl-terms-extracted-woven.jsonld` as part of this task when the 09 transition is ready to become normative.
- Validate each new manifest before treating its fixture branch as settled.
- Add or update Weave integration coverage that checks out `07-shacl-integrated-woven`, runs the intended extraction flow, and compares the result to `08-ontology-and-shacl-terms-extracted`.
- Add or update Weave integration coverage that checks out `08-ontology-and-shacl-terms-extracted`, runs the `weave` operation, and compares the result to `09-ontology-and-shacl-terms-extracted-woven`.
- Include fail-closed coverage for extracting a term that is not described by the selected woven ontology or SHACL source.
- Include fail-closed coverage for attempting to overwrite an existing term Knop support surface.
- Include coverage that generated term pages can render source-derived facts from the pinned ontology or SHACL state.
- Include page-presence assertions for generated term pages in 09, without requiring exact HTML text comparison unless the renderer contract is intentionally tightened.

## Non-Goals

- Extracting every ontology or SHACL subject IRI in the first pair.
- Supporting hash-IRI term extraction.
- Splitting the ontology or SHACL document into one payload artifact per term.
- Rewriting or normalizing the authored ontology or SHACL source as part of extraction.
- Automatically deleting, rewriting, or deprecating an extracted term when a later ontology or SHACL version no longer contains that term.
- Creating a complete fantasy-rules vocabulary.
- Settling all resource-page template design for ontology or SHACL term pages.
- Adding remote source fetching or live `workingAccessUrl` dereferencing.
- Replacing the separate sidecar topology and release-path work in [[wd.task.2026.2026-05-02-fantasy-rules-sidecar]].

## Implementation Plan

- [x] Update the fixture README with `08-ontology-and-shacl-terms-extracted` and `09-ontology-and-shacl-terms-extracted-woven`.
- [x] Update the sidecar conformance README with the new transition names and walkthrough.
- [x] Decide the exact first extracted term list before authoring the 08 manifest.
- [x] Decide whether the first reference role should remain `ReferenceRole/Supplemental` or use a more precise ontology/source role.
- [x] Define the exact source-reference shape for extracted terms, including `referenceTarget` and `referenceTargetState`.
- [ ] Define the page-generation rule for rendering term facts from the pinned ontology or SHACL source state.
- [x] Update [[sf.spec.2026-04-05-extract-behavior]] with the ontology-and-SHACL-term extraction shape before implementation depends on it.
- [x] Author `08-ontology-and-shacl-terms-extracted.jsonld` only after the 08 expected output shape is settled enough for the manifest to be normative.
- [x] Create the `08-ontology-and-shacl-terms-extracted` fixture branch from `07-shacl-integrated-woven`.
- [ ] Author `09-ontology-and-shacl-terms-extracted-woven.jsonld` only after the 09 expected output shape is settled enough for the manifest to be normative.
- [ ] Create the `09-ontology-and-shacl-terms-extracted-woven` fixture branch from 08 by running the `weave` operation.
- [x] Add or update Weave tests for the 07 -> 08 transition.
- [ ] Add or update Weave tests for the 08 -> 09 transition.
- [x] Update [[wd.codebase-overview]] and [[wd.decision-log]] after the behavior is implemented and settled.
