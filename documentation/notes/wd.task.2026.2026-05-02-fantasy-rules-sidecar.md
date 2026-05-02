---
id: 6wjbum23c4rli8cojvtcp0i
title: 2026 05 02 Fantasy Rules Sidecar
desc: 'sidecar mesh fixture for dereferenceable ontology and SHACL publishing'
updated: 1777705655304
created: 1777705655304
---

## Goals

- Build out the new fixture repository named `mesh-sidecar-fantasy-rules`.
- Use the fixture to prove the docs-rooted sidecar mesh pattern for an ontology project: source files live outside the mesh root, while public identifiers, generated pages, and historical snapshots live under `docs/`.
- Exercise the dereferenceable ontology publishing use case described in [[ont.use-case.dereferenceable-ontology]] with a small fantasy-rules ontology and SHACL graph.
- Use the [System Reference Document 5.2.1](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf) as the source-reference boundary for fantasy-rules vocabulary work, subject to its CC-BY-4.0 attribution requirements.
- Keep the domain intentionally small: enough to feel real, not enough to become a fantasy rules knowledge-graph project.
- Use the fixture to improve Weave's sidecar ergonomics, resource-page templates, and visual presentation.
- Include the raw RDF content on `RdfDocument` resource pages, not just links to Turtle files.
- Evaluate a safe JavaScript URL-polish behavior for generated resource pages where the browser URL can display the canonical IRI without a trailing slash.
- Capture reusable conventions for future ontology projects such as URPX without putting URPX-specific complexity into the fixture.

## Summary

`mesh-alice-bio` has been a good whole-repo reference mesh, but it is no longer the right fixture for the next publication topology problem. The next useful fixture should be a normal project repo whose primary source files are not themselves the public mesh root.

`mesh-sidecar-fantasy-rules` should be that fixture. It should look like a small ontology project:

- authored ontology source under `ontology/`
- authored SHACL source under `shacl/`
- optional examples/tests under `examples/` or `test/`
- a Semantic Flow sidecar mesh under `docs/`

The public GitHub Pages surface would be `docs/`, with stable artifact IRIs such as:

- `https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/ontology`
- `https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/shacl`
- `https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/ontology/releases/v0.1.0`
- `https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/shacl/releases/v0.1.0`

The authored source files should remain in the project-appropriate source tree, while `docs/` carries the public mesh, generated resource pages, and copied historical release bytes.

The fixture should still use the Alice Bio branch-ladder pattern, but with one important clarification from the completed Alice Bio work: branches are the inspectable carrier for state, while Accord manifests are the acceptance contract for transitions. The branches are useful for human review and for automated comparison: a test can check out a source branch, run the intended operation or `weave`, and compare the produced workspace against the destination branch using the corresponding Accord manifest. The manifests should be created alongside the branch ladder as soon as each transition is settled, not deferred until final documentation cleanup.

The first ladder should stay focused on the core sidecar path:

- `00-blank-slate`
- `01-source-only`
- `02-sidecar-mesh-created`
- `03-sidecar-mesh-created-woven`
- `04-ontology-integrated`
- `05-ontology-integrated-woven`
- `06-shacl-integrated`
- `07-shacl-integrated-woven`

Version-bumped ontology states can be added later, after the first docs-rooted ontology and SHACL path is working and covered by conformance.

## Discussion

This fixture should carry several related questions at once, but they should not all be treated as one inseparable implementation slice.

The first question is sidecar topology:

- can Weave create and operate a mesh rooted at `docs/`?
- can a mesh artifact use `workingFilePath` to point at adjacent repo-local source such as `../ontology/fantasy-rules-ontology.ttl`?
- can operational config allow that adjacent path while still rejecting arbitrary traversal?
- can weave copy historical snapshots into the public mesh under `docs/`?
- can generated pages and support artifacts stay under `docs/` without exposing the entire repo as a public Pages surface?

The second question is ontology publication shape:

- the ontology artifact should be a `DigitalArtifact`, likely a `PayloadArtifact`, an `RdfDocument`, and an `owl:Ontology`
- the SHACL artifact should be a `DigitalArtifact`, likely a `PayloadArtifact`, an `RdfDocument`, and a `sh:ShapesGraph`; it may also be an `owl:Ontology` if it carries ontology-style metadata
- release history should use artifact-local paths such as `ontology/releases/v0.1.0` and `shacl/releases/v0.1.0`
- `owl:versionIRI` should point to versioned bytes, such as `https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/ontology/releases/v0.1.0/ttl/fantasy-rules-ontology.ttl`
- richer Semantic Flow artifact/history/manifestation/located-file detail can live in mesh inventory and support artifacts rather than being forced into the ontology source document

The source ontology is its own meaningful workstream. The SRD 5.2.1 document is large, even before deciding what should become classes, controlled values, examples, SHACL shapes, labels, definitions, and attribution. This task should not pretend that `fantasy-rules-ontology.ttl` is just a quick fixture stub. The first ontology slice should be curated deliberately, with enough domain structure to exercise ontology publishing without dragging the mesh-sidecar work into a full SRD modeling project.

The first ontology seed should stay small: `AbilityScore`, `Alignment`, `Character`, and a few representative controlled values or examples are enough. Larger SRD modeling work belongs in later task notes.

Use slash term IRIs first, not hash IRIs. The fixture should eventually support both patterns, but slash IRIs are the better first proof because term resource pages can stand independently and deprecated or removed terms do not force the ontology document page to keep carrying every old term description forever. The local rationale is also captured in `/home/djradon/hub/djradon/dendron-workspace/public-notes/vs.hash-vs-slash.md`.

The third question is whether the new fixture can improve how generated resource pages feel. The Alice Bio pages are useful, but the next fixture should push toward a calmer, clearer publication surface:

- better artifact landing pages for ontology and SHACL artifacts
- clearer current-vs-release sections
- direct links to current source bytes, versioned bytes, history pages, and support artifacts
- raw RDF rendering for `RdfDocument` pages, including ontology, SHACL, manifestation, and located-file pages where the bytes are locally available
- visible labels, descriptions, media types, and version values where the RDF provides them
- more intentional navigation between root, ontology, SHACL, release states, and located files
- a shared visual baseline that can later become a template/theme story rather than a collection of fixture-specific HTML strings

For RDF documents, the page should let a reader inspect the actual triples without leaving the resource page. That can start as an escaped `<pre><code>` block or a progressively enhanced source panel. The important contract is that `RdfDocument` resource pages are not only metadata about a file; they also expose the RDF document content when Weave has local bytes. The raw file URL should still exist for tools and copy/download workflows.

The fourth question is URL presentation. Static hosting wants `ontology/index.html`, and browsers usually display `/ontology/`. The ontology IRI may be `/ontology` without a trailing slash. A small generated script could use `history.replaceState` to display the canonical IRI form after page load.

That script is worth exploring, but it has a trap: changing the displayed URL from `/ontology/` to `/ontology` can change how relative links resolve unless the page uses absolute/root-relative links or an explicit safe `<base>` URL. The task should therefore treat trailing-slash removal as a page-rendering feature with tests, not a quick snippet pasted into every page.

This task also intersects with the open layout question in [[sf.todo]]: `mesh-content/` probably should not remain a top-level sibling forever. For this sidecar fixture, mesh-owned helper content should start under `docs/_mesh/content/`.

### Alice Bio Precedent

The closest precedent is [[wd.completed.2026.2026-03-25-mesh-alice-bio]] together with the framework conformance task [[sf.completed.2026.2026-03-29-conformance-for-mesh-alice-bio]] and the examples index [[sf.api.examples]].

The reusable parts are:

- keep a numbered, human-readable branch ladder for manual inspection and comparison
- use branch pairs as test refs: apply the operation from the source branch, then compare the generated result to the destination branch under the transition manifest
- distinguish non-woven semantic-operation branches from `*-woven` branches
- treat `weave` as version, validate, and generate, not as integrate or mesh creation
- write one Accord manifest per transition, even when the filename follows the destination branch for convenience
- store conformance manifests in the framework examples tree, not in each fixture branch
- add manifests while the transition is being authored, so they stay normative instead of being reverse-engineered after the fact

For this fixture, the corresponding framework example area should be `semantic-flow-framework/examples/sidecar-fantasy-rules/`, with API payloads under `api/` when needed and Accord manifests under `conformance/`.

The first ladder should be branch-based unless implementation pressure proves a generated-only fixture is more useful. A generated fixture can still be added later as a comparison output, but the hand-authored branch ladder is the reviewable design surface.

## Open Issues

- Should this fixture introduce a scaffold/template command such as `weave mesh create --root docs`, or should it only document the command shape for later implementation?
- Should authoring `fantasy-rules-ontology.ttl` be split into its own task note before the sidecar mesh ladder proceeds beyond source seeding?
- How much of the improved resource-page look-and-feel belongs in this task versus a separate renderer/template task?
- Should trailing-slash URL polish be enabled on all generated resource pages or only on pages whose canonical IRI is explicitly slashless?
- How should generated pages preserve relative-link behavior if `history.replaceState` changes the displayed URL?
- What exact operational config should allow `workingFilePath` values that traverse from `docs/` to adjacent source directories?
- Should a version-bumped ontology branch be a separate follow-up ladder pair, and if so should it version only the ontology first or ontology and SHACL together?

## Decisions

- The fixture repository name should be `mesh-sidecar-fantasy-rules`.
- The mesh root should be `docs/`.
- The fixture should be fantasy-rules inspired, not a full rules ontology.
- The first carried domain should be tiny and stable: classes such as `AbilityScore`, `Alignment`, `Character`, and perhaps a small number of representative individuals or controlled values are enough.
- The SRD 5.2.1 PDF should be the initial source-reference boundary for rules vocabulary decisions. It is published under CC-BY-4.0 and requires attribution.
- The fixture should avoid relying on trademarked branding or copied prose beyond what is intentionally and properly attributed from SRD 5.2.1.
- SRD attribution should live in `NOTICE.md`; ontology metadata should include source/provenance for SRD-derived vocabulary, but `dcterms:license` on the fantasy-rules ontology should identify the fantasy-rules ontology's own license, not the SRD license.
- Authoring `fantasy-rules-ontology.ttl` is a real modeling slice and should be planned deliberately rather than treated as incidental fixture setup.
- Use slash IRIs for ontology terms first. Hash-term support can be proven later.
- The fixture should carry ontology and SHACL as separate artifacts with independent histories.
- Release paths should be artifact-local: `ontology/releases/v0.1.0` and `shacl/releases/v0.1.0`, not a single repo-global `releases/v0.1.0/...` path.
- `owl:versionIRI` should point at versioned located Turtle bytes for OWL/RDF tool compatibility.
- Semantic Flow-specific release-state detail should be present in the mesh, but the authored ontology file should stay mostly normal OWL/RDF.
- Historical located files should be copied into the mesh by default when versioning is enabled.
- Use a numbered branch ladder for the hand-authored fixture, following the Alice Bio comparison pattern.
- The first ladder should run through `07-shacl-integrated-woven`; a version-bumped ontology pair can be added later.
- Use branch refs as test fixtures: source refs define operation input, destination refs define expected output, and Accord manifests define the transition assertions.
- Treat Accord manifests as transition contracts for the ladder, not as branch metadata or late acceptance paperwork.
- Store Fantasy Rules Sidecar conformance manifests in `semantic-flow-framework/examples/sidecar-fantasy-rules/conformance/`.
- Author the first manifest for each transition as that transition settles, before a runner or generated fixture is allowed to define the expected behavior.
- Sidecar support should remain fail-closed. A `workingFilePath` outside the mesh root is allowed only when operational config explicitly permits that adjacent repo-local path.
- Mesh-owned helper page content should live under `docs/_mesh/content/` in this fixture.
- Improved resource pages are in scope, but only after the core sidecar artifact/versioning shape is clear.
- `RdfDocument` resource pages should include raw RDF content when the document bytes are locally available.
- The trailing-slash URL script is in scope as an experiment, but it must not break relative links, canonical links, copied IRI controls, or no-JavaScript page usability.

## Contract Changes

- Add or clarify a sidecar mesh creation/use contract where the mesh root is not the repository root.
- Ensure `workingFilePath` can be resolved relative to a mesh root such as `docs/` while obeying explicit local path access policy.
- Ensure weaving can copy historical snapshots from adjacent source files into mesh-owned release paths under `docs/`.
- Define expected artifact-local release path handling for non-ordinal histories such as `ontology/releases` and named states such as `v0.1.0`.
- Define how ontology and SHACL artifacts advertise current working bytes, versioned located bytes, and generated resource pages in inventory.
- Define the sidecar fixture's transition-manifest convention in the framework examples tree, reusing the Alice Bio one-manifest-per-transition approach.
- Define how branch refs, operation execution, and Accord manifests are combined into acceptance tests for the sidecar fixture.
- Define the resource-page model needed for ontology/SHACL landing pages, release pages, manifestation pages, and located-file pages.
- Define how `RdfDocument` resource pages obtain and render raw RDF bytes from current working files and historical located files.
- Potentially introduce a shared page presentation/template seam so new resource-page improvements do not become fixture-specific HTML builders.
- Potentially introduce a generated page script contract for canonical IRI URL display, including when it may call `history.replaceState` and how generated links remain safe.
- Decide whether mesh-owned helper page content should move from top-level `mesh-content/` to `_mesh`-owned content paths.

## Testing

- Add fixture-level Accord acceptance coverage for `mesh-sidecar-fantasy-rules` as each branch transition is settled.
- Add branch-ref comparison tests that check out the source branch, run the intended operation or `weave`, and compare the resulting workspace to the destination branch under the matching Accord manifest.
- Add tests that run Weave against a workspace whose mesh root is `docs/`.
- Add tests proving `workingFilePath` can read explicitly allowed adjacent source files such as `../ontology/fantasy-rules-ontology.ttl` and `../shacl/fantasy-rules-shacl.ttl`.
- Add fail-closed tests for disallowed `workingFilePath` traversal outside the configured repo-local boundary.
- Add tests proving woven release snapshots are materialized inside `docs/` and remain byte-identical to the source bytes for that release.
- Add tests for `owl:versionIRI` pointing to versioned located Turtle files.
- Add tests that generated resource pages link to current artifact pages, histories, states, manifestations, and located files without assuming a whole-repo mesh root.
- Add tests that `RdfDocument` resource pages include escaped raw RDF content from the correct current or historical located file.
- Add browser-oriented or HTML-level tests for the trailing-slash script if it lands, including relative-link behavior after `history.replaceState`.
- Add visual/regression checks for the new resource-page template baseline if the renderer changes materially.

## Non-Goals

- Building a complete fantasy rules ontology.
- Modeling the full SRD 5.2.1.
- Modeling spells, monsters, equipment, classes, species, conditions, or combat systems in the first fixture.
- Making the fixture depend on URPX-specific terms or release policy.
- Replacing Alice Bio as the whole-repo reference mesh.
- Enabling arbitrary remote current-byte fetching.
- Treating `workingAccessUrl` or `targetAccessUrl` as live fetch inputs unless a separate operational-policy slice explicitly enables them.
- Making the generated resource pages a full client-side app.
- Requiring JavaScript for dereferenceability or basic navigation.

## Implementation Plan

### Phase 0: Fixture Shape, Ladder, And Source Policy

- [ ] Confirm the first public base IRI for `mesh-sidecar-fantasy-rules`.
- [ ] Draft the small first ontology slice around `AbilityScore`, `Alignment`, `Character`, and representative controlled values or examples.
- [ ] Review SRD 5.2.1 source for the small seed slice and defer larger SRD modeling.
- [ ] Add the SRD CC-BY-4.0 attribution boundary to `NOTICE.md` and choose source/provenance metadata for the ontology.
- [ ] Use slash IRIs for first-pass ontology terms.
- [ ] Draft the initial numbered branch ladder through `07-shacl-integrated-woven`, preserving the Alice Bio distinction between non-woven operation branches and `*-woven` branches.
- [ ] Create the first `semantic-flow-framework/examples/sidecar-fantasy-rules/conformance/README.md` plan before the first non-seed transition is treated as settled.
- [ ] Define the branch-ref testing loop for source branch, operation execution, destination branch, and Accord manifest comparison.
- [ ] Put first-pass mesh-owned helper page content under `docs/_mesh/content/`.

### Phase 1: Build Out The Sidecar Fixture Repo

- [ ] Initialize or update `mesh-sidecar-fantasy-rules` as the sidecar fixture repo.
- [ ] Add authored ontology source under `ontology/`.
- [ ] Add authored SHACL source under `shacl/`.
- [ ] Add `docs/` as the sidecar mesh root with `.nojekyll`.
- [ ] Add mesh metadata and inventory for a docs-rooted mesh.
- [ ] Add operational config needed for repo-local adjacent source access.
- [ ] Add Accord manifests for the seed and mesh-creation transitions as they settle.

### Phase 2: Integrate Ontology And SHACL Artifacts

- [ ] Integrate the ontology artifact at public path `ontology`.
- [ ] Integrate the SHACL artifact at public path `shacl`.
- [ ] Use `workingFilePath` to associate each artifact with its adjacent authored source file.
- [ ] Keep `hasWorkingLocatedFile` usage semantically consistent with the current located-byte story.
- [ ] Add current resource pages for root, ontology, SHACL, and relevant support artifacts.
- [ ] Add Accord manifests for the ontology and SHACL integration transitions as they settle.

### Phase 3: Weave The First Release

- [ ] Weave ontology release `v0.1.0` under `ontology/releases/v0.1.0`.
- [ ] Weave SHACL release `v0.1.0` under `shacl/releases/v0.1.0`.
- [ ] Materialize Turtle manifestations under each release state.
- [ ] Ensure `owl:versionIRI` points at the versioned located Turtle file.
- [ ] Ensure working source bytes and latest historical located bytes match where the release is current.
- [ ] Add Accord manifests for the first ontology and SHACL release/weave transitions as they settle.

### Phase 4: Improve Resource Pages

- [ ] Draft the target page model for ontology and SHACL artifact pages.
- [ ] Improve current artifact pages to show identity, current bytes, releases, histories, and support resources clearly.
- [ ] Improve historical-state and located-file pages enough that a reader can navigate the release structure without reading raw Turtle first.
- [ ] Add raw RDF panels to `RdfDocument` resource pages for locally available current and historical bytes.
- [ ] Move reusable page HTML/CSS rendering toward shared runtime seams rather than fixture-specific builders.
- [ ] Add or update specs if the resource-page contract changes materially.
- [ ] Add or update Accord manifests for resource-page expectations changed by this phase.

### Phase 5: URL Polish Experiment

- [ ] Design the canonical-IRI display script for generated `index.html` pages.
- [ ] Require an explicit canonical IRI signal before trimming a trailing slash.
- [ ] Preserve relative-link behavior with root-relative/absolute links or an explicit safe `<base>` strategy.
- [ ] Keep pages usable with JavaScript disabled.
- [ ] Add tests for slashful load URL, slashless displayed URL, canonical link, and link navigation.

### Phase 6: Acceptance And Documentation

- [ ] Add Weave integration/e2e tests for docs-rooted sidecar operation.
- [ ] Update [[wu.repository-options]] if the fixture changes the sidecar recommendation.
- [ ] Update [[wd.codebase-overview]] once implementation lands.
- [ ] Update [[wd.decision-log]] with settled sidecar, release-path, and resource-page decisions before closing the task.
