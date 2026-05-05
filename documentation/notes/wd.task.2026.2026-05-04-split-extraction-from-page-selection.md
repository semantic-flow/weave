---
id: 3xfcwno4h4umtw57anxod6m
title: 2026 05 04 Split Extraction from Page Selection
desc: ''
updated: 1777952005356
created: 1777952005356
---

## Goals

- Split the current overloaded `extract` behavior into term identifier creation and page data selection.
- Keep "extract terms" available for the part that actually extracts term identifiers from RDF documents and creates Knop-managed identifier surfaces.
- Replace the current `ExtractionSource`-centered page-data model with ReferenceLinks plus a general ResourcePage selection policy.
- Let Canonical references contribute page-table facts by default using wildcard subject selection, while still allowing finer selectors later.
- Make page selection apply to both reference-backed pages and native/ingested `RdfDocument` pages.
- Coordinate this with [[ont.task.2026.2026-05-03-enumeration-type-instances]] so rerunging Alice Bio and Fantasy Rules happens once.
- Record exact commands while rerunging affected fixture ladder transitions.

## Summary

Current extraction bundles together several concerns:

- discovering or selecting RDF terms from an `RdfDocument`
- creating identifier/Knop support surfaces for those terms
- recording a source binding for the created Knop
- using selected RDF facts from that source when rendering the identifier page

Only the first two are really "extraction." The latter concerns are page data selection and reference/source policy. The new direction is:

- `extract terms` creates missing identifier/Knop surfaces for RDF terms discovered in a source graph.
- ReferenceLinks describe semantic reference relationships between the managed identifier and source/reference artifacts.
- ResourcePage selection policy decides which reference roles are eligible to contribute data to the page.
- RDF selectors choose which facts from eligible sources are integrated into the page table.
- Raw source display remains separate from selected semantic table display.

The immediate ontology use case should use Canonical ReferenceLinks from extracted terms to their source ontology/SHACL artifacts. A Canonical reference with no explicit selector defaults to wildcard subject selection: include all triples from that source graph where the focus node is the target identifier. This gives ontology term pages complete term data without inventing a selector for every predicate in the first pass.

## Discussion

### Where the model lives

The association belongs in the Knop-owned support surface. The Knop inventory should expose enough state for page generation to discover references and page-selection policy. The detailed ReferenceLinks may continue to live in a `ReferenceCatalog` artifact when one is present, because Alice Bio already established that pattern by the Bob extraction rung. The key point is that page generation should not depend on a private implementation-only side table; the reference and selection policy must be mesh-carried.

For small generated term surfaces, we can choose whether the first implementation writes the ReferenceLink and policy directly in the Knop inventory or creates a ReferenceCatalog immediately. The durable contract is that the Knop inventory makes those support artifacts discoverable and that the ReferenceLink/page-selection data is carried in RDF.

### Reference roles and page eligibility

Do not add `ReferenceRole/pageSource` in the first pass. Reference roles should describe the semantic relationship, not a renderer flag. Page selection should instead have policy over roles.

Default policy:

- `referenceRoleCanonical` is eligible for page integration.
- A Canonical reference with no explicit selector uses subject wildcard selection.
- `referenceRoleSupplemental` is not page-integrated by default unless page policy opts in.
- Deprecated references should not contribute page data unless an explicit policy later says otherwise.

This means "if you do not want a reference to contribute all focus-node facts by default, do not mark it Canonical." Finer-grained selection can be added to Canonical or Supplemental references when needed.

### Selectors

Initial selector concepts should stay RDF-native and small:

- `RdfSubjectWildcardSelector`: select all triples where the focus node is the subject.
- `RdfPredicateObjectSelector`: given the focus node as subject, select objects of matching predicates.
- `RdfPredicateSubjectSelector`: given the focus node as object, select subjects of matching predicates.

The default Canonical behavior is equivalent to `RdfSubjectWildcardSelector`. We may not need to serialize that selector for the common case, but naming it in the ontology makes the default explainable and testable.

Later selectors may include:

- a predicate-use selector for pages about RDF properties where the target identifier appears as the predicate
- `SparqlSelector` for relators, paths, graph joins, or complex projection
- output-role mapping for title, description, summary, table section, or other page slots

Do not implement SPARQL selection in the first pass.

### Focus nodes

The default focus node is the managed identifier IRI. That works for ontology terms and the current SHACL `fant:CharacterShape` case where the page path and source subject can still resolve to the same mesh IRI. A later `sourceFocusNode` or similar property may be needed when a page should draw data about a source subject that differs from the managed identifier.

### Current versus pinned source resolution

Reference/page data selection should reuse the existing artifact resolution concepts:

- current resolution follows the current source artifact
- pinned resolution uses exactly the requested HistoricalState

There should be no silent fallback from Current to an older state when a selected fact disappears. If Current no longer contains selected data, the page should omit it or surface a diagnostic. Any fallback behavior must be explicit in a future policy.

### Page display

Selected facts should be integrated into the resource page property table or a table-like fact section with labels and links, not only displayed as raw source snippets. Raw source panels remain useful for inspection and debugging, but they are not the primary semantic page presentation.

This table-selection mechanism should apply to native/ingested `RdfDocument` pages too. A large RDF document can have many metadata triples; page policy should decide what is eligible for the summary table rather than dumping every source triple into the main page display.

### Command transcript

This split and the enum cleanup will require repairing early ladder states: Alice Bio already uses ReferenceLinks by the Bob extraction rungs, and Fantasy Rules term extraction happens early in the sidecar ladder. We should use this pass to record exact commands for every rerunged transition, either in the Accord manifest as a structured invocation/reproduction command or in the conformance README if the manifest vocabulary is not ready.

## Open Issues

- CLI naming: whether the final local command remains `weave extract --all-terms`, becomes `weave extract terms`, or moves under an `integrate terms` family.
- Whether term extraction should create Canonical ReferenceLinks by default, or whether reference creation should be an explicit follow-up command.
- Whether the first implementation writes generated term ReferenceLinks directly in Knop inventory or always creates a ReferenceCatalog.
- Exact ontology names for page policy and selector classes/properties.
- Whether selected facts should render only in the top property table or in grouped fact sections when there are many selected triples.
- Whether Supplemental references can be opted into wildcard selection with a policy property such as `includesReferenceRole`.
- How to represent selector ordering and conflict resolution when multiple eligible sources provide the same predicate.
- Whether `ExtractionSource` should be removed immediately or kept briefly as an internal compatibility bridge during rerunging.
- How much of Alice Bio and Fantasy Rules should be repaired by rerunning commands versus surgical branch edits.

## Decisions

- "Page Selection" is the task scope; it is broader than reference selection and should apply to all RDF-backed resource pages.
- Split term extraction from page selection.
- Keep ReferenceLinks as the durable model for semantic reference/source relationships.
- Do not use a `pageSource` ReferenceRole in the first pass.
- Canonical references are eligible for page integration by default.
- A Canonical reference with no explicit selector means wildcard subject selection over the focus node.
- Supplemental references do not page-integrate by default.
- Page selection should use current/pinned artifact resolution semantics and should not silently fall back from Current to an older state.
- Selected facts should be displayed as table data with labels and links where practical; raw source remains a separate inspection surface.
- Coordinate implementation and rerunging with the flat camelCase enum migration.

## Contract Changes

- Current `ExtractionSource`-based inventories should be replaced by ReferenceLink plus page-selection policy for new/updated ladders.
- Term extraction creates identifier/Knop surfaces and may create initial reference/page-selection support, depending on the final CLI decision.
- Page generation uses eligible ReferenceLinks and selectors to collect facts for identifier pages.
- Canonical source references without explicit selectors contribute all focus-node subject triples from the selected source graph.
- Pinned references use the requested HistoricalState exactly; Current references use the current source artifact at generation time.
- Page generation should not treat raw source display as equivalent to selected page data.
- Existing `ReferenceLink` rungs in Alice Bio should be preserved conceptually but updated to the new enum IRIs and page-selection model where needed.

## Testing

- Add ontology validation for new page-selection classes/properties and flat enum values.
- Add Weave tests proving Canonical references with no selectors contribute focus-node facts to the page table.
- Add Weave tests proving Supplemental references do not contribute page facts by default.
- Add Weave tests for explicit predicate-object selectors.
- Add Weave tests for current source resolution updating selected page facts after the source advances.
- Add Weave tests for pinned source resolution remaining stable after the source advances.
- Add tests proving no silent fallback to older source states when Current no longer has a selected fact.
- Update Alice Bio fixture tests from the first affected ReferenceLink branch.
- Update Fantasy Rules fixture tests from the first affected term-extraction branch.
- Validate rerunged Accord manifests and command transcripts.

## Non-Goals

- Implementing SPARQL selectors in the first pass.
- Creating a full page layout/template language.
- Selecting from live remote RDF at page generation time.
- Silent fallback from Current sources to older historical states.
- Replacing raw source panels; they remain useful as inspection surfaces.
- Solving hash-IRI page generation unless the immediate fixture requires it.
- Designing final selector conflict-resolution policy beyond deterministic ordering for the first pass.

## Implementation Plan

- [ ] Finalize ontology names for ResourcePage policy and RDF selector classes/properties.
- [ ] Coordinate enum IRI migration through [[ont.task.2026.2026-05-03-enumeration-type-instances]] before writing new page-selection enum values.
- [ ] Update [[sf.api]] to clarify that `extract terms` creates identifiers/Knops and page selection is separate.
- [ ] Update the relevant Semantic Flow behavior specs for term extraction and page selection.
- [ ] Update the core ontology to add page-selection vocabulary and replace `ExtractionSource` usage as the durable model.
- [ ] Update Weave extraction planning so term extraction can create ReferenceLinks/page-selection support instead of `ExtractionSource`.
- [ ] Update page generation to collect selected facts from eligible Canonical references.
- [ ] Add predicate-object selector support after wildcard Canonical behavior works.
- [ ] Decide whether to keep a temporary reader for old `ExtractionSource` inventories during branch repair.
- [ ] Rerung Alice Bio from the first affected ReferenceLink/extraction branch and record every command used.
- [ ] Rerung Fantasy Rules from the first affected term-extraction branch and record every command used.
- [ ] Update Accord manifests to focus on Semantic Flow artifacts and selected-data behavior, not renderer prose/layout.
- [ ] Run focused Weave tests, lint/check, and conformance validation.
