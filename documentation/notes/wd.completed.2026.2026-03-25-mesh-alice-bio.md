---
id: ar5um7avia6hg8524xjrgpo
title: 2026 03 25 Mesh Alice Bio
desc: ''
updated: 1775225038617
created: 1774446399214
---

## Goals

- Create a small standalone `mesh-alice-bio` example repo that can serve as a living golden example for Semantic Flow evolution.
- Represent the example as a sequence of explicit scenario branches that show the manual evolution from plain RDF source into a mesh-managed layout.
- Use the repo as a comparison target for future Weave API and CLI operations.

## Summary

This task is about creating a concrete Alice Bio example repository that starts from a plain RDF file and then evolves through manually created mesh states.

The repo is currently checked out at:

- `/home/djradon/hub/semantic-flow/weave/dependencies/github.com/semantic-flow/mesh-alice-bio`

Each settled transition should also get a matching Accord manifest in:

- `/home/djradon/hub/semantic-flow/weave/dependencies/github.com/semantic-flow/semantic-flow-framework/examples/alice-bio/conformance/`

The comparison standard for “API/CLI matches the manual branch” is:

- same filesystem layout
- RDF graphs that are equivalent after canonicalization
- explicit allowances for volatile values such as timestamps and other runtime-generated identifiers if needed

`rdf-canonize` or an equivalent RDF canonicalization step should be used for graph comparison.

## Discussion

### Repo role

The example repo should be treated as a staged fixture, not just a demo. It should be usable for:

- ontology discussion
- CLI/API comparison
- manual inspection of filesystem layout
- future documentation examples

### Initial source content

The initial `alice-bio.ttl` in the `01-source-only` branch should stay intentionally simple and use ordinary RDF vocabularies rather than Semantic Flow terms.

The seed data should describe:

- Alice's name
- Alice's birthday
- that Alice `foaf:knows` Bob

The Bob reference should remain just a referenced IRI in the seed file rather than a separately described local resource.

The source should use standard vocabularies such as FOAF and Schema.org wherever practical.

### Mesh base

The default `meshBase` for the example should be:

- `https://semantic-flow.github.io/mesh-alice-bio/`

The trailing slash is important in the current model, because the Semantic Flow identifier is formed as `meshBase + designatorPath`, and the normal designator paths should remain slashless.

### Branch semantics

- `00-blank-slate`
  - repository scaffold only, before introducing the seed RDF example
- `01-source-only`
  - contains just the plain source RDF and no Semantic Flow mesh structure
- `02-mesh-created`
  - contains the manual equivalent of `mesh create`, including `_mesh`, mesh metadata, and mesh inventory
- `03-mesh-created-woven`
  - contains the result of weaving `02-mesh-created`, including versioned support artifacts and generated ResourcePages
- `04-alice-knop-created`
  - contains the manual equivalent of creating a Knop for the non-payload referent `alice`
- `05-alice-knop-created-woven`
  - contains the result of weaving `04-alice-knop-created`
- `06-alice-bio-integrated`
  - contains the manual equivalent of integrating the source artifact into the mesh as the payload artifact for `alice/bio`, while keeping the working payload bytes in the existing root `alice-bio.ttl`
- `07-alice-bio-integrated-woven`
  - contains the result of weaving `06-alice-bio-integrated`
- `08-alice-bio-referenced`
  - introduce a dedicated `ReferenceCatalog` for `alice` and add a ReferenceLink about `alice` that targets `alice/bio`
- `09-alice-bio-referenced-woven`
  - contains the result of weaving `08-alice-bio-referenced`, including versioning and page generation for the new `ReferenceCatalog`
- `10-alice-bio-updated`
  - updates the integrated source artifact before the next weave creates the `v2` state, using explicit mesh-root IRIs for `<alice>` and `<bob>`, adding `<alice/bio> dcterms:creator <alice>`, and expanding Bob into a local Person description
- `11-alice-bio-v2-woven`
  - contains the result of weaving `10-alice-bio-updated`, including the second generated historical state in the current explicit history, an advanced `alice/bio` KnopInventory state, and regenerated ResourcePages with navigable mesh links, while still leaving `_mesh/_inventory` unchanged
- `12-bob-extracted`
  - create the `bob` Knop-managed resources from the local Bob reference in `alice-bio.ttl`, add a Supplemental ReferenceLink about `bob` that targets `alice/bio`, but do not split the payload bytes or generate new pages yet
- `13-bob-extracted-woven`
  - contains the result of weaving `12-bob-extracted`, including Bob support-artifact histories, generated Bob ResourcePages, and an advanced `_mesh/_inventory` state

Using `alice-bio-integrated` is preferable to `alice-bio-knop-created`, because the main action for the payload artifact case is integration rather than merely minting a non-payload Knop.

### Woven branches

Branches named `*-woven` represent the result of the `weave` operation over the immediately preceding branch state. For this fixture, `weave` means `version`, `validate`, and `generate`; it does not perform `integrate`.

For artifact history generated by `weave`, the current ontology direction is to use explicit `ArtifactHistory` resources and generated names of the form `_historyNNN/_sNNNN` rather than older `vN` path tokens.

For `03-mesh-created-woven`, that means weaving `02-mesh-created` should version `_mesh/_meta` and `_mesh/_inventory` into explicit histories such as `_mesh/_meta/_history001/_s0001/...` and `_mesh/_inventory/_history001/_s0001/...`.

For `05-alice-knop-created-woven`, the woven result should version `alice/_knop/_meta` and `alice/_knop/_inventory`, advance `_mesh/_inventory` to a new historical state, and generate the public `alice/index.html` page plus the Knop-facing ResourcePages. A woven branch is only considered complete when the working Turtle files match their latest historical-state copies exactly.

For `07-alice-bio-integrated-woven`, the woven result should version the newly integrated `alice/bio` payload artifact plus `alice/bio/_knop/_meta` and `alice/bio/_knop/_inventory`, advance `_mesh/_inventory` to a new historical state, and generate the public `alice/bio/index.html` page together with the `alice/bio` payload-history and Knop-facing ResourcePages. As with other woven branches, completion requires the working Turtle files to match their latest historical-state copies exactly.

For `08-alice-bio-referenced`, keep the change deliberately small: update the `alice` Knop inventory to attach a `ReferenceCatalog`, add `alice/_knop/_references/references.ttl`, and store one canonical `ReferenceLink` there about `<alice>` with target `<alice/bio>`. `ReferenceLink` identities should be stable fragment IRIs rooted at the catalog resource, for example `<alice/_knop/_references#reference001>`. Do not weave new history, generate new pages, or broaden the mesh inventory surface yet.

For `09-alice-bio-referenced-woven`, weave the new `alice/_knop/_references` artifact and advance `alice/_knop/_inventory` to a new latest historical state, but do not advance `_mesh/_inventory` because the reference surface remains Knop-internal. The generated `alice/_knop/_references/index.html` page should act as the dereference target for current and retired fragment-identified links by consulting both the working catalog and catalog history.

### File layout

The current working layout conventions look good and should be kept unless implementation pressure proves otherwise:

- `_mesh/_meta/meta.ttl`
- `_mesh/_inventory/inventory.ttl`  
- `_mesh/_meta/_history001/_s0001/...`
- `_mesh/_inventory/_history001/_s0001/...`
- `alice/_knop/_meta/meta.ttl`
- `alice/_knop/_inventory/inventory.ttl`
- `alice/_knop/_references/references.ttl`
- `alice/bio/_knop/_meta/meta.ttl`
- `alice/bio/_knop/_inventory/inventory.ttl`
- `alice/bio/_history001/_s0001/...`

For the non-woven `06-alice-bio-integrated` branch, the current direction is to keep the working payload bytes at the existing root `alice-bio.ttl` path and associate that file with the new `alice/bio` payload artifact, rather than physically relocating the Turtle file before the woven branch.

### Mesh metadata vs inventory

For `02-mesh-created`, `_mesh/_meta/meta.ttl` should stay light and carry only mesh-level facts such as `meshBase` plus, if helpful, a direct pointer to the current inventory file via `hasWorkingMeshInventoryFile`, while `_mesh/_inventory/inventory.ttl` should act as the canonical self-contained current-surface map. Support-artifact identity, typing, `hasMeshInventory`, and artifact-history facts should live canonically in inventory rather than being repeated in metadata. The normative rationale is recorded in [[ont.decision-log]].

### Referenced-resource creation

Part of integration will eventually need to address referenced IRIs found in integrated RDF, such as auto-creating a Knop for `bob` when `alice-bio.ttl` mentions Bob.

That behavior should be treated as a later scenario, controlled by config or command-line behavior such as `autoCreateResources`, rather than being folded into the first baseline integration branch by default.

## Open Issues

- Which exact local names and sample values should be used in the seed RDF beyond the core fields already decided?

## Decisions

- Create a new dedicated `mesh-alice-bio` repo rather than burying the example inside an existing codebase.
- Use scenario branches rather than only immutable milestones.
- Use `alice-bio-integrated` as the payload-artifact milestone name.
- Include `00-blank-slate` as part of the ordered scenario ladder.
- Use zero-padded numbered branch names below `10` for stable sorting and easy visual ordering.
- Keep Bob as a referenced IRI in the seed source rather than a separately described local resource.
- Prefer standard RDF vocabularies in the seed file, using FOAF where it fits cleanly and Schema.org where FOAF is awkward.
- Do not add tags yet; branches are sufficient for the current comparison fixture.
- Interleave `*-woven` branches after each remaining manual semantic milestone starting with `02-mesh-created`.
- Treat branch-to-API/CLI comparison as filesystem-layout equality plus canonized RDF equivalence, excluding only volatile `created` and `updated` timestamps unless another unstable field proves unavoidable.
- Reserve `v2` naming for the post-weave result of the updated payload branch rather than the pre-weave updated state.
- Use `08-alice-bio-referenced` as the distinct branch where the `alice` Knop gains a `ReferenceCatalog` containing a ReferenceLink about `alice` that targets `alice/bio`.
- Use `12-bob-extracted` as the first comparison branch for referenced-resource extraction behavior.
- Use `https://semantic-flow.github.io/mesh-alice-bio/` as the default example `meshBase`.
- Generate `alice/index.html` in `05-alice-knop-created-woven` even though Alice does not yet have an integrated payload artifact.
- In `06-alice-bio-integrated`, keep `alice-bio.ttl` at the repo root as the working located file for the new `alice/bio` payload artifact.

## Contract Changes

- No public API contract changes are required by this task.
- This task should produce concrete fixtures that can later be used to test or refine the CLI and API contracts.

## Testing

- Compare manual branch output against Weave CLI/API output using:
  - filesystem layout inspection
  - RDF canonicalization and graph comparison
- Exclude only `created` and `updated` timestamps from strict equivalence checks unless another volatile field proves unavoidable.

## Non-Goals

- fully solving integration-template modeling
- fully solving config inheritance
- deciding the final long-term vocabulary for auto-created referenced-resource behavior
- locking every future Alice Bio scenario before the repo exists

## Implementation Plan

- [x] Create the `mesh-alice-bio` repo with a short README explaining its role as a staged Semantic Flow example and comparison fixture.
- [x] Create the `00-blank-slate` branch as the repository scaffold before the example content is introduced.
- [x] Create the `01-source-only` branch with a minimal `alice-bio.ttl` describing Alice and a referenced Bob IRI using ordinary RDF vocabularies.
- [x] Create `01-source-only.jsonld` in `semantic-flow-framework/examples/alice-bio/conformance/` for `00-blank-slate` -> `01-source-only`.
- [x] Create the `02-mesh-created` branch with the manual equivalent of `mesh create`.
- [x] Create `02-mesh-created.jsonld` in `semantic-flow-framework/examples/alice-bio/conformance/` for `01-source-only` -> `02-mesh-created`.
- [x] Create the `03-mesh-created-woven` branch with the manual equivalent of weaving `02-mesh-created`.
- [x] Create `03-mesh-created-woven.jsonld` in `semantic-flow-framework/examples/alice-bio/conformance/` for `02-mesh-created` -> `03-mesh-created-woven`.
- [x] Create the `04-alice-knop-created` branch with the manual equivalent of creating the `alice` Knop and its support artifacts.
- [x] Create `04-alice-knop-created.jsonld` in `semantic-flow-framework/examples/alice-bio/conformance/` for `03-mesh-created-woven` -> `04-alice-knop-created`.
- [x] Create the `05-alice-knop-created-woven` branch with the manual equivalent of weaving `04-alice-knop-created`.
- [x] Create `05-alice-knop-created-woven.jsonld` in `semantic-flow-framework/examples/alice-bio/conformance/` for `04-alice-knop-created` -> `05-alice-knop-created-woven`.
- [x] Create the `06-alice-bio-integrated` branch with the manual equivalent of integrating `alice-bio.ttl` as the payload artifact for `alice/bio`.
- [x] Create `06-alice-bio-integrated.jsonld` in `semantic-flow-framework/examples/alice-bio/conformance/` for `05-alice-knop-created-woven` -> `06-alice-bio-integrated`.
- [x] Create the `07-alice-bio-integrated-woven` branch with the manual equivalent of weaving `06-alice-bio-integrated`.
- [x] Create `07-alice-bio-integrated-woven.jsonld` in `semantic-flow-framework/examples/alice-bio/conformance/` for `06-alice-bio-integrated` -> `07-alice-bio-integrated-woven`.
- [x] Create the `08-alice-bio-referenced` branch where the `alice` Knop gains a `ReferenceCatalog` containing a ReferenceLink about `alice` that targets `alice/bio`.
- [x] Create `08-alice-bio-referenced.jsonld` in `semantic-flow-framework/examples/alice-bio/conformance/` for `07-alice-bio-integrated-woven` -> `08-alice-bio-referenced`.
- [x] Create the `09-alice-bio-referenced-woven` branch with the manual equivalent of weaving `08-alice-bio-referenced`.
- [x] Create `09-alice-bio-referenced-woven.jsonld` in `semantic-flow-framework/examples/alice-bio/conformance/` for `08-alice-bio-referenced` -> `09-alice-bio-referenced-woven`.
- [x] Create the `10-alice-bio-updated` branch with the manual equivalent of updating the integrated payload before weaving `v2`.
- [x] Create `10-alice-bio-updated.jsonld` in `semantic-flow-framework/examples/alice-bio/conformance/` for `09-alice-bio-referenced-woven` -> `10-alice-bio-updated`.
- [x] Create the `11-alice-bio-v2-woven` branch with the manual equivalent of weaving `10-alice-bio-updated`.
- [x] Create `11-alice-bio-v2-woven.jsonld` in `semantic-flow-framework/examples/alice-bio/conformance/` for `10-alice-bio-updated` -> `11-alice-bio-v2-woven`.
- [x] Create the `12-bob-extracted` branch with the manual equivalent of extracting the referenced Bob IRI into Knop-managed resources.
- [x] Create `12-bob-extracted.jsonld` in `semantic-flow-framework/examples/alice-bio/conformance/` for `11-alice-bio-v2-woven` -> `12-bob-extracted`.
- [x] Create the `13-bob-extracted-woven` branch with the manual equivalent of weaving `12-bob-extracted`.
- [x] Create `13-bob-extracted-woven.jsonld` in `semantic-flow-framework/examples/alice-bio/conformance/` for `12-bob-extracted` -> `13-bob-extracted-woven`.
- [x] Record the intended meaning of each branch in the repo README so later comparisons stay understandable.
- [x] Decide the exact RDF comparison workflow, including canonicalization tooling and exclusions for volatile values.
