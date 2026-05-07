---
id: 0qamj2pmqwl0q6op3cb4jel
title: 2026 05 05 Optional History and Slim Support Artifacts by Default
desc: ''
updated: 1778083916122
created: 1778082622196
---

## Goals

- we should be able to turn history on and off manually for any DigitalArtifact, including supporting digital artifacts like meta and config
  - I think by default, support artifacts don't need history?
  - ideally we can specify whether history is on or off at the mesh level, any submesh level (via inheritable knop config, which I think needs to be re-introduced), per-knop, and per supporting artifact. Possibly in operational config too.
  - my sense is that config isn't really built out yet, [[ont.task.2026.2026-03-23-config-modernization]], [[wd.task.2026.2026-04-08_1735-page-definition-ontology-and-config]], and [[wd.task.2026.2026-04-11_1723-operational-config-for-runtime-resolution]], so maybe we have to address that first
  - in the meantime, can we just turn off history generation for support artifacts, keeping in mind that we'll need it configurable later?

- Keep payload artifacts historical by default. Payload history is a core user-facing value of Weave, not support-artifact noise.
- Reduce default support-artifact churn without breaking the current weave state model.
- Preserve enough settled state to regenerate or audit historical resource pages where Weave has promised historical resource pages.
- Leave a clean seam for later config-driven policy without blocking this smaller default-behavior cleanup on the full config story.


## Summary

The short answer is: history cannot be blanket-disabled, but some support histories should be current-only by default.

`_mesh/_inventory` is special. Its history is not just an archive of an implementation file; it is the mesh-level record of the settled public resource map after each weave. Former inventory states may be needed to understand or recreate resource pages, located-file declarations, history/state pages, and other generated RDF surfaces that were true at a prior weave. Keeping only `_mesh/_inventory/inventory.ttl` would keep the latest map, but it would lose the mesh-native identifier for "the inventory as of this weave."

Payloads should keep history by default. `_mesh/_inventory` should keep history for the foreseeable future. `_knop/_inventory` should also keep history in the current implementation because weave slice detection and Knop-local progression depend on it; later work may be able to replace that dependency with a better state/progression contract, but that is not a quick fix.

The first slim-history pass should target support artifacts whose history is mostly noise: `_mesh/_meta`, `_knop/_meta`, and probably `_mesh/_config`. These can remain current DigitalArtifacts with working located files and current resource pages, but omit initial `ArtifactHistory`, `HistoricalState`, manifestation, snapshot, and history-page generation by default.

Do not solve full config first. Introduce a small internal policy seam now, default it conservatively, and let later config work feed that seam. Do not combine this with a general "turn off resource page generation" feature yet; that is related but has a different contract around dereferenceability and `sflo:hasResourcePage` facts.

## Discussion

### Partial truth: some history is effectively required

The instinct that "former inventory might be needed to recreate page resources that have history" is right. It does not mean every artifact must always have history. It means any artifact that is part of the durable input to historical resource pages needs either:

- its own history/state snapshots
- another immutable snapshot that contains the same information
- or an explicit decision that old generated pages are not reproducible from mesh state

Right now `_mesh/_inventory` is the durable mesh-level snapshot. It records which resource pages, located files, histories, states, Knops, and payload artifacts existed after a weave. If it becomes current-only, a later weave can overwrite the facts needed to understand what the prior public mesh surface looked like.

That is different from `_mesh/_meta` and `_knop/_meta`. Those metadata files are DigitalArtifacts, but their historical states are not currently the driver for payload versioning, page-source selection, or mesh-resource reconstruction. Their current working files are usually enough.

### Artifact classes by default policy

Recommended default policy:

- Payload artifacts: history on by default.
- `_mesh/_inventory`: history on by default and probably required until a different mesh-state ledger exists.
- `_knop/_inventory`: history on by default in the current implementation; revisit once weave progression no longer depends on inventory history shape.
- `_mesh/_meta`, `_knop/_meta`: history off by default.
- `_mesh/_config`: history off by default for the quick fix, unless a future config story explicitly chooses to version mesh policy changes.
- `_knop/_assets`: no history by default; if an asset needs independent publication or versioning, model it as its own payload artifact. This aligns with [[wd.task.2026.2026-04-08_1735-page-definition-ontology-and-config]].
- `ResourcePageDefinition` (`_knop/_page`) and `ReferenceCatalog` (`_knop/_references`): not safe to casually default off until the page-history and regeneration contract is clearer. These are behavior-bearing support artifacts, not just descriptive metadata.

The last bullet is the main pushback on "everything else can avoid history." Page definitions and reference catalogs can probably become current-only if Weave treats generated page HTML as the historical output and does not promise source-level regeneration of old pages. But if Weave wants to regenerate old pages from mesh RDF, then old page definitions, source-selection policy, and reference links need historical snapshots or an equivalent render-bundle snapshot.

### Config first?

Do not block this quick fix on full config.

Full config needs mesh/submesh/Knop/artifact inheritance, operational versus portable config boundaries, validation, CLI/runtime loading behavior, and ontology vocabulary. That is too large for this cleanup, and it risks freezing a config surface before the history policy is settled.

The implementation should still be shaped for config later:

- centralize history policy in one helper or policy object rather than scattering `if support artifact` branches
- name the policy in terms of artifact role, not incidental path string checks where possible
- leave current request/CLI surfaces unchanged
- add TODOs or internal types that make it obvious where later config should enter

Later config can then decide defaults such as `historyPolicy current-only` or `historyPolicy versioned` at mesh, submesh, Knop, artifact-kind, or artifact-specific scope.

### Resource page generation toggle?

Do not combine general resource-page suppression with the first history-default change.

Turning off history generation removes history/state/manifestation files and their pages for artifacts that no longer have history. Turning off resource page generation changes dereferenceability and the meaning of `sflo:hasResourcePage`. That needs its own contract:

- If a page is not generated, should the RDF omit `sflo:hasResourcePage`, or can the triple remain as a promise for a later generator?
- Can current artifacts remain dereferenceable while historical pages are suppressed?
- Does page suppression apply to payload pages, support pages, state pages, manifestation pages, or all generated pages?
- How does `weave generate` later recover suppressed pages?

The safe order is:

- first slim support history for low-value support artifacts
- then define a separate page-generation policy, probably through config
- then implement page suppression with explicit RDF behavior

## Open Issues

- Should historical generated pages be reproducible from mesh state, or is the generated HTML/file output itself the durable historical artifact?
- Can `ResourcePageDefinition` and `ReferenceCatalog` become current-only by default, or do they need history whenever their facts influence historical page output?
- Is `_knop/_inventory` conceptually required to have history, or is that only a current implementation dependency that should eventually be replaced by a more explicit Knop progression model?
- Should `_mesh/_config` ever be historical by default, or should config changes be tracked through repository history and current mesh state unless explicitly opted in?
- What is the future policy vocabulary: boolean flags, a small enum such as `current-only` / `versioned`, or an artifact-class default with per-artifact overrides?
- Where should inheritable policy live once config is ready: mesh config, Knop config, artifact-local config, operational config, or some combination?
- If resource page generation becomes configurable, what exact RDF should be emitted when a page is intentionally not generated?

## Decisions

- Payload artifacts keep history by default.
- Keep `_mesh/_inventory` history on by default. It is the mesh-level settled-state ledger, not merely support-file noise.
- Keep `_knop/_inventory` history on for now because current weave progression depends on it.
- First slim-history implementation should default `_mesh/_meta`, `_knop/_meta`, and `_mesh/_config` to current-only support artifacts.
- Do not wait for full config before implementing the first default cleanup; create an internal policy seam that later config can drive.
- Do not implement a broad resource-page generation toggle in the same first pass.

## Contract Changes

- Current-only support artifacts are valid DigitalArtifacts when they have current working-file facts and resource-page facts but no `sflo:hasArtifactHistory`, `sflo:currentArtifactHistory`, `sflo:nextHistoryOrdinal`, `ArtifactHistory`, `HistoricalState`, or manifestation snapshot.
- For artifacts whose history is disabled, Weave should not emit history/state/manifestation resource pages or `sflo:hasResourcePage` facts for those omitted historical resources.
- Payload artifact history behavior is unchanged.
- `_mesh/_inventory` and `_knop/_inventory` history behavior is unchanged in the first pass.
- No public config, CLI flag, or request-field contract is introduced in the quick fix.

## Testing

- Core planner tests should assert that new first-weave outputs omit `_mesh/_meta` and `_knop/_meta` history triples, snapshot files, and history/state/manifestation pages when the default policy is current-only.
- Mesh support resource-page tests should assert `_mesh/_config` does not get default history when present, while its current page and working file remain represented.
- Existing payload tests should continue to assert payload `ArtifactHistory`, first `HistoricalState`, manifestation, snapshot, and history pages.
- Existing mesh and Knop inventory tests should continue to assert inventory history advancement and next-state ordinal behavior.
- Runtime/integration tests should verify generated current pages do not link to omitted support-history pages.
- Add at least one regression test that a second weave still resolves mesh and Knop inventory progression after metadata/config history is omitted.

## Non-Goals

- Do not disable payload history by default.
- Do not disable `_mesh/_inventory` history in this task.
- Do not disable `_knop/_inventory` history in the first implementation pass.
- Do not design or expose the full inheritable config surface here.
- Do not add a general resource-page generation toggle here.
- Do not migrate or delete already-generated historical support artifacts in existing carried fixtures unless a fixture refresh explicitly requires it.
- Do not treat `_knop/_assets` files as governed artifacts; assets remain helper files unless separately modeled as payload artifacts.

## Implementation Plan

- [ ] Introduce an internal support-history policy helper that can answer whether a candidate artifact role should create history by default.
- [ ] Classify at least `_mesh/_meta`, `_mesh/_config`, `_knop/_meta`, `_mesh/_inventory`, `_knop/_inventory`, payload artifacts, `ResourcePageDefinition`, and `ReferenceCatalog`.
- [ ] Refactor mesh-support page planning so `_mesh/_meta` and `_mesh/_config` can keep current pages without creating support history.
- [ ] Refactor first Knop and first payload weave renderers so `_knop/_meta` remains current-only by default.
- [ ] Keep `_mesh/_inventory` and `_knop/_inventory` history rendering unchanged.
- [ ] Audit generated page models and hand-rendered pages so current support pages do not link to omitted support histories.
- [ ] Update focused core and integration tests for the new default output shape.
- [ ] Run the relevant Deno validation tasks after code changes, at minimum `deno task test` and `deno task lint` for a broad renderer/planner change.
- [ ] Leave clear TODOs for later config-driven policy and resource-page generation policy.
