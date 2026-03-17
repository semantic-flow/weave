---
id: ajkwikaxm4h81dzhvnyo3d7
title: 2026 03 13 Picking up the Pieces
desc: ''
updated: 1773674626903
created: 1773620895575
---

## Goal

Recover a coherent Semantic Flow core model by collapsing **Nomen** into **Knop**, using `D/` as the public designator placeholder, using `D/_knop/` as the Knop IRI, and by producing a realistic plan for ontology, documentation, and code follow-up.

## Summary

The current model is carrying two overlapping first-class resources:

* the public designator IRI `D/`, which denotes the referent
* a semantic support object (`Nomen`) for talking about that designator in RDF
* a semantic/artifact container (`Knop`) for payload, metadata, inventory, and support artifacts

The emerging direction is to collapse the last two into a single **Knop** model:

* `D/` remains the designator IRI
* `D/_knop/` denotes the mesh-managed Knop associated with `D/`
* all mesh-managed support artifacts live under `D/_knop/`
* if something is part of the mesh, it gets a Knop
* aliases also get their own Knops and declare their target in Knop metadata plus any naming metadata needed
* if we need to talk about the designator as an identifier-object distinct from the Knop, that should hang off `D/_knop/` as a subordinate RDF handle rather than overloading `D/_knop/` itself

This keeps the single-referent discipline at the public IRI while reducing conceptual duplication in the implementation model without forcing one IRI to mean both "container" and "identifier object".

## TODO

- [x] Switch examples from `T/` to `D/` so the placeholder clearly means "designator"
- [x] Decide that `D/_knop/` denotes the Knop, not the identifier-as-identifier
- [ ] Decide whether identifier-about-identifier needs an explicit subordinate handle such as `D/_knop/#identifier`, or can remain an implicit metadata convention
- [ ] Decide whether `designatorPath` survives as a Knop property, is renamed, or becomes purely derived
- [ ] Define the alias/canonical-target pattern for alias Knops
- [ ] Draft ontology deltas in the ontology repo
- [ ] Rewrite core docs around Knop-first terminology
- [ ] Decide whether to reset the kato repo docs/code or salvage them incrementally
- [ ] Identify the minimum code worth carrying forward, if any

## Discussion

### Proposed semantic split

The clean split appears to be:

* `D/` denotes the referent
* `D/_knop/` denotes the Knop that supports `D/` inside the mesh
* `D/_knop/#identifier` (or similar) can denote the designator considered as an identifier-object when that distinction matters
* `D/_knop/...` hosts metadata, inventory, payload-support structure, and other mesh-managed artifacts

This preserves the reason `Nomen` existed without requiring a separate first-class resource class for it.

### Why collapse Nomen into Knop

The latest ontology gives `Nomen` only a narrow unique role: carrying path/binding metadata and serving as a subject for identifier-about-identifier statements. In the filesystem-backed model, both jobs can be handled by the Knop:

* path/binding is already implied by the containing folder for normal meshes
* identifier-about-identifier metadata can usually live in Knop metadata, with an optional subordinate RDF handle under `D/_knop/` when we need to distinguish the identifier-object from the Knop itself

This reduces duplication between:

* Nomen metadata vs Knop metadata
* Nomen inventory vs Knop inventory
* Nomen containment vs Knop containment
* “binding” logic that is really just mesh structure

One important caveat: if `designatorPath` survives as a semantic property rather than becoming purely derived, it is more naturally a property of the identifier-object than of the Knop container. That is a strong argument for either making it derived in normal meshes or hanging it off a subordinate identifier handle instead of `D/_knop/` itself.

### Review: should `D/_knop/` double as the identifier handle?

Recommendation: **no**. `D/_knop/` should denote the Knop. If we need a first-class RDF subject for "the designator as a designator," use a subordinate handle such as `D/_knop/#identifier`.

Concrete cases where the distinction matters:

* container facts: `containsPayloadArtifact`, metadata/inventory containment, regeneration timestamps, local overlays, and resource-page hosting are about the Knop as a mesh-managed container
* identifier facts: alias status, canonical-target links, lexical normalization, minting/provenance, deprecation, and redirect lineage are about the designator as an identifier
* cross-mesh materialization: the same published designator may be represented by different mesh-local Knops in a mirror, working copy, or import pipeline, so container-local facts should not automatically become facts about the identifier itself
* rebuild vs rename: a Knop may be regenerated or structurally reorganized without minting a new designator, while a new designator or alias may be minted without inheriting the old container history
* validation/query shape: SHACL and SPARQL stay cleaner if Knop/container expectations and identifier-object expectations can be targeted separately instead of forcing one node to satisfy both roles

If none of those distinctions matter in a given serialized view, the subordinate identifier handle can remain implicit and appear only in generated RDF or not at all.

### Alias model

The current direction suggests:

* aliases are real mesh-managed identifiers, so they get their own Knops
* an alias Knop does not need its own payload
* an alias Knop should declare a target/canonical referent link in Knop metadata
* alias-specific naming/provenance metadata also belongs with that alias Knop

This keeps aliases first-class without reviving a separate Nomen layer.

### Filesystem posture

For a designator `D/`:

* `D/index.html` remains the primary human dereference point
* `D/_knop/index.html` can explain the support structure and expose raw metadata/inventory links
* payload and support artifacts live under `D/_knop/`

This aligns with the March 13 discussion that the repo itself should remain serveable as-is, with real resource pages and optional JS-loaded chrome.

## Open Issues

* Should `designatorPath` remain explicit on `Knop` for detached/in-memory modeling, or should it be derived for normal filesystem meshes?
* If the property survives, should it keep the name `designatorPath`, or become `meshPath`, `identifierPath`, or `knopPath`?
* If we model an explicit identifier-object under the Knop, what should its spelling be: `D/_knop/#identifier`, `D/_knop/#designator`, or something else?
* What is the canonical alias property? A dedicated alias-target relation may be clearer than overloading a general denotation property.
* How should we model a mesh-managed Knop whose referent is a DigitalArtifact hosted elsewhere?
* Do we preserve any prose use of “Nomen” as an informal word for the public designator, or retire it almost completely?
* How much backward compatibility do we want for existing `_nomen/` references in docs or generated structures?
* Should the root designator also have a root Knop at `/_knop/`?

## Decisions

### Proposed decisions

* Use `D/` as the canonical placeholder for a public designator in docs and examples.
* Let `D/_knop/` denote the Knop, not the identifier-as-identifier.
* If a first-class identifier-object handle is needed, model it as a subordinate IRI under `D/_knop/` rather than overloading `D/_knop/`.
* Collapse `Nomen` into `Knop` as the managed semantic support object.
* Keep `D/` as the public designator IRI that denotes the referent.
* Put mesh-managed support artifacts under `D/_knop/`.
* Treat aliases as their own Knops with explicit alias-target metadata.

### Recommendation: kato repo reset

Recommendation: **start over for the kato repo documentation and code, but not by losing history**.

That means:

* keep the conversation notes, task notes, and a few high-value project-level notes
* do not try to preserve the sprawling current conceptual docs as authoritative
* do not spend time adapting small legacy code unless it clearly supports the new Knop-first model
* rewrite a compact canonical doc set around the new model, then reintroduce only what still earns its keep

Rationale:

* too many existing docs encode the Nomen/Knop split and will keep reintroducing confusion
* incremental harmonization across a sprawling, outdated note set will likely cost more than a focused rewrite
* the small amount of existing code appears less valuable than a clean restatement of the model

Suggested preservation strategy:

* preserve current docs on the existing branch or under an explicit legacy/archive area
* define a small new canonical surface
* treat old notes as historical reference, not live specification

## Contract Changes

### Ontology-facing changes

* Deprecate or remove `sflo:Nomen` as a core managed class.
* Deprecate or remove `sflo:containsNomen`.
* Move naming/binding properties now attached to `Nomen` onto `Knop` and/or a subordinate identifier handle, if they remain explicit.
* Collapse `NomenMetadataArtifact` and `NomenInventoryArtifact` into Knop-level artifacts, or remove them.
* Clarify that `D/` denotes the referent, while `D/_knop/` denotes the supporting Knop.
* Decide whether any surviving identifier-specific properties should move to a subordinate identifier handle instead of the Knop node.
* Add or refine alias-target semantics for alias Knops.

### Filesystem/layout changes

* `D/_nomen/` is replaced by `D/_knop/`.
* metadata and inventory currently imagined under `_nomen/` move under `_knop/`.
* docs and examples should stop implying a separate Nomen container under the designator path.

### Documentation contract changes

Core docs must be rewritten so they consistently express:

* every mesh-managed identifier has a Knop
* the public designator and the support Knop are distinct IRIs with distinct denotations
* identifier-about-identifier, when modeled separately, hangs off the Knop IRI rather than reviving a separate `_nomen/` container
* “Nomen” is no longer a first-class managed resource, unless retained only as informal prose

## Testing

* Build a small canonical example tree covering:
  * a referential Knop
  * a payload Knop
  * an alias Knop
  * the mesh root
* Verify dereference semantics for:
  * `D/`
  * `D/index.html`
  * `D/_knop/`
  * `D/_knop/index.html`
  * optionally, an RDF-only identifier handle such as `D/_knop/#identifier`
* Run a terminology grep to find stale references:
  * `Nomen`
  * `_nomen`
  * `containsNomen`
  * `designates` / `designatorPath`
* Validate revised examples against SHACL once the ontology changes land.
* Check that the new model still supports both RDF-native resources and Dendron-flavored markdown resource-page generation.

## Non-Goals

* Reworking the entire ontology in this repo
* Preserving every old documentation page as active/canonical
* Maintaining compatibility with every experimental `_nomen/` layout ever discussed
* Reviving Nomen as a separate managed object just to preserve older terminology
* Porting forward legacy kato-side code without a clear current use case

## Implementation Plan

### Phase 1: freeze the conceptual core

1. Confirm the Knop-first model:
   * `D/` denotes referent
   * `D/_knop/` denotes Knop
2. Decide whether the identifier-support distinction should use an optional subordinate handle under `_knop/`, and if so choose its canonical spelling.
3. Decide the alias-target pattern and minimum metadata requirements for alias Knops.
4. Decide the fate of `designatorPath`.

### Phase 2: draft the ontology delta

1. Mark `Nomen` and its related classes/properties for deprecation/removal.
2. Rehome surviving naming properties onto `Knop` and/or a subordinate identifier handle if needed.
3. Add or clarify properties needed for alias targeting and canonicalization.
4. Update comments so the ontology matches the new denotation split.

### Phase 3: reset the canonical docs

1. Define the minimal live doc set to keep authoritative.
2. Rewrite the highest-leverage pages first:
   * `concept.nomen` or its replacement
   * `mesh-resource.knop`
   * identifier/denotation docs
   * resource-page/dereference docs
   * product/concept summary docs
3. Reclassify old sprawling docs as historical or archive material.

### Phase 4: code posture

1. Inventory the small kato-side code surface.
2. Keep only code that directly supports:
   * source discovery
   * weave/resource-page generation
   * metadata/inventory generation
3. Delete or ignore code that mainly reflects superseded Nomen-era structure.

### Phase 5: exemplar-first validation

1. Create one or two small exemplar meshes on paper first.
2. Use them to validate ontology terms, page layout, and alias semantics.
3. Only then implement or regenerate code/docs at broader scale.
