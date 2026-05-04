---
id: oavk9pw1lwz2duq3fpcw2dw
title: 2026 05 03 Term Extraction
desc: ''
updated: 1777854312008
created: 1777854312008
---

## Goals

- Add the next `mesh-sidecar-fantasy-rules` fixture pair for extracting ontology terms from the already woven ontology document.
- Use the pair to clarify Semantic Flow `extract` behavior for ontology-term publishing, not graph splitting or payload rewriting.
- Keep the first extracted term set deliberately small and reviewable.
- Make the extracted ontology terms dereferenceable through Knop-managed current surfaces and generated pages under the docs-rooted sidecar mesh.
- Plan Accord transition coverage for both the non-woven extraction step and the woven publication step, without creating the manifest files until the 08/09 branch shapes are settled.

## Summary

The sidecar fixture currently plans through `07-shacl-integrated-woven`: the ontology and SHACL documents are governed artifacts, and their first release bytes have been woven into the public docs-rooted mesh. The next useful behavior slice is term extraction: mint Knop-managed Semantic Flow identifier surfaces for selected slash-IRI ontology terms described by the governed ontology document.

The proposed pair is:

- `08-ontology-terms-extracted`: extract selected ontology term identifiers from the woven ontology document into minimal Knop-managed current surfaces.
- `09-ontology-terms-extracted-woven`: run the `weave` operation over those extracted term surfaces so public term pages and support-artifact histories exist.

This is separate from [[wd.task.2026.2026-05-02-fantasy-rules-sidecar]] because the sidecar task is already carrying mesh topology, config, adjacent-source policy, release paths, and resource-page behavior. Term extraction has its own operation semantics and should not be hidden inside that broader fixture task.

## Discussion

The first sidecar ladder proves that an ontology document can be governed and released as a sidecar artifact. That does not automatically make each ontology term a first-class dereferenceable Semantic Flow resource. For slash IRIs such as `https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/ontology/AbilityScore`, the mesh should be able to expose a term page at `docs/ontology/AbilityScore/index.html` backed by a Knop surface at `docs/ontology/AbilityScore/_knop/`.

This task should apply the Alice Bio extraction precedent without copying its exact Bob-shaped assumptions. The Alice Bio slice extracted one resource mentioned in a payload document and created a minimal Knop plus a supplemental reference back to the source payload state. The fantasy-rules slice should extract several selected ontology terms from one governed ontology artifact. The source artifact is the woven ontology document, and each extracted term should be justified by triples in that document.

The first extracted term set should stay small. A reasonable starting set is:

- `ontology/AbilityScore`
- `ontology/Alignment`
- `ontology/Character`
- `ontology/PlayerCharacter`, if it is already present in the authored ontology by the time 08 is cut

Representative controlled values can follow after the class-term path is settled. Extracting every subject IRI from the ontology in the first pair is the wrong target: it would make the fixture noisy, make branch review harder, and force broad source-selection policy before the core term-surface behavior is proven.

For `08`, extraction should create current support surfaces only. It should update the working mesh inventory so the extracted term Knops are discoverable, and it should create minimal `D/_knop/_meta/meta.ttl`, `D/_knop/_inventory/inventory.ttl`, and probably `D/_knop/_references/references.ttl` files for each extracted term. It should not create histories or generated pages yet.

For `09`, the `weave` operation should version the new support artifacts, validate the resulting current surface, and generate public pages for the extracted terms and their support artifacts. The term pages should be term pages, not generic artifact pages: they should identify the term, show useful type/label/comment facts from the ontology document when available, and link back to the governing ontology artifact and release state that justified the extraction.

The exact reference role still needs care. `ReferenceRole/Supplemental` was right for Bob because Alice's bio remained a descriptive source for Bob. Ontology term extraction may deserve a stronger `DefinedBy`, `Source`, or ontology-specific role if the ontology vocabulary already has one. If no better role exists yet, the first fixture can use `Supplemental` explicitly and leave a follow-up decision to refine role vocabulary.

## Open Issues

- Which exact term list should be extracted in the first 08/09 pair?
- Should extracted ontology term references use existing `ReferenceRole/Supplemental`, or should the ontology define a more precise role such as "defined by" before this pair is treated as settled?
- Should `extract` accept an explicit source artifact selector for this slice, or should the first sidecar implementation infer the single woven ontology source from the target designator paths?
- Should one `extract` request create multiple term surfaces in a batch, or should 08 represent a sequence of single-target extractions whose combined result is the branch state?
- How much ontology-derived term detail belongs in generated term pages in 09 versus staying deferred to a broader resource-page template task?
- Should controlled-value individuals be included in the first pair, or deferred until class extraction is stable?

## Decisions

- Use `08-ontology-terms-extracted` for the non-woven extraction branch.
- Use `09-ontology-terms-extracted-woven` for the woven publication branch.
- Keep term extraction separate from the main sidecar task note; cross-reference [[wd.task.2026.2026-05-02-fantasy-rules-sidecar]] rather than expanding it further.
- Treat this as ontology-term identifier extraction, not ontology payload splitting.
- Do not rewrite `ontology/fantasy-rules-ontology.ttl` or the woven ontology release bytes during extraction.
- Use docs-rooted designator paths such as `ontology/AbilityScore`, producing local mesh paths under `docs/ontology/AbilityScore/`.
- Keep the first extracted set narrow and explicitly listed in the manifests.
- Defer hash-IRI extraction; this pair is for the existing slash-IRI term convention.

## Contract Changes

- Extend the sidecar fixture ladder beyond `07-shacl-integrated-woven` with an ontology-term extraction pair.
- Extend `extract` behavior from one Bob-like target to a sidecar ontology-term use case where selected term identifiers are extracted from one governed, woven RDF document.
- Define that non-woven term extraction creates Knop-managed current surfaces and updates working mesh inventory, but does not create histories or pages.
- Define that the woven term extraction step versions those support artifacts and generates public dereferenceable term pages.
- Clarify how extracted term surfaces point back to the source ontology artifact and the relevant woven ontology state.
- Add sidecar Accord manifests for `07 -> 08` and `08 -> 09` as part of this task once the expected branch outputs are concrete enough to make the manifests normative.

## Testing

- Do not create the 08/09 conformance manifests until the extracted term set, reference role, and expected branch output are settled.
- Add `semantic-flow-framework/examples/sidecar-fantasy-rules/conformance/08-ontology-terms-extracted.jsonld` as part of this task when the 08 transition is ready to become normative.
- Add `semantic-flow-framework/examples/sidecar-fantasy-rules/conformance/09-ontology-terms-extracted-woven.jsonld` as part of this task when the 09 transition is ready to become normative.
- Validate each new manifest before treating its fixture branch as settled.
- Add or update Weave integration coverage that checks out `07-shacl-integrated-woven`, runs the intended extraction flow, and compares the result to `08-ontology-terms-extracted`.
- Add or update Weave integration coverage that checks out `08-ontology-terms-extracted`, runs the `weave` operation, and compares the result to `09-ontology-terms-extracted-woven`.
- Include fail-closed coverage for extracting a term that is not described by the selected woven ontology source.
- Include fail-closed coverage for attempting to overwrite an existing term Knop support surface.
- Include page-presence assertions for generated term pages in 09, without requiring exact HTML text comparison unless the renderer contract is intentionally tightened.

## Non-Goals

- Extracting every ontology subject IRI in the first pair.
- Supporting hash-IRI term extraction.
- Splitting the ontology document into one payload artifact per term.
- Rewriting or normalizing the authored ontology source as part of extraction.
- Creating a complete fantasy-rules vocabulary.
- Settling all resource-page template design for ontology term pages.
- Adding remote source fetching or live `workingAccessUrl` dereferencing.
- Replacing the separate sidecar topology and release-path work in [[wd.task.2026.2026-05-02-fantasy-rules-sidecar]].

## Implementation Plan

- [x] Update the fixture README with `08-ontology-terms-extracted` and `09-ontology-terms-extracted-woven`.
- [x] Update the sidecar conformance README with the new transition names and walkthrough.
- [ ] Decide the exact first extracted term list before authoring the 08 manifest.
- [ ] Decide whether the first reference role should remain `ReferenceRole/Supplemental` or use a more precise ontology/source role.
- [ ] Update [[sf.spec.2026-04-05-extract-behavior]] with the ontology-term extraction shape before implementation depends on it.
- [ ] Author `08-ontology-terms-extracted.jsonld` only after the 08 expected output shape is settled enough for the manifest to be normative.
- [ ] Create the `08-ontology-terms-extracted` fixture branch from `07-shacl-integrated-woven`.
- [ ] Author `09-ontology-terms-extracted-woven.jsonld` only after the 09 expected output shape is settled enough for the manifest to be normative.
- [ ] Create the `09-ontology-terms-extracted-woven` fixture branch from 08 by running the `weave` operation.
- [ ] Add or update Weave tests for the 07 -> 08 and 08 -> 09 transitions.
- [ ] Update [[wd.codebase-overview]] and [[wd.decision-log]] after the behavior is implemented and settled.
