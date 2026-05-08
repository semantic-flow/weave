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
- Preserve enough settled state to regenerate or audit historical resource pages where Weave has promised historical resource pages, without requiring full copied inventory snapshots by default.
- Separate mutable current/progression facts from inventory so inventory can stay focused on the public mesh/resource map and avoid becoming the huge hot file for allocator state.
- Leave a clean seam for later config-driven policy without blocking this smaller default-behavior cleanup on the full config story.


## Summary

The short answer is: history cannot be blanket-disabled, but many support histories should be current-only or slim by default.

The earlier "inventory history is foundational" framing was too broad. Current Weave does depend on mutable current/progression facts such as `sflo:currentArtifactHistory`, `sflo:latestHistoricalState`, and `sflo:nextStateOrdinal`, but the code audit did not show a strong need to preserve old values of those facts after they stop being true. Those facts are needed to plan the next weave, choose current source snapshots, and validate current progression. They are not currently needed by resource pages as stale historical "current" facts.

That suggests a better target: move mutable current/progression facts out of inventory and into `_mesh/_meta`, `_knop/_meta`, or a future explicit working-state artifact. `_meta` is small and easy to access; inventory can become the mostly stable public map of resources, located files, pages, histories, states, Knops, and artifact membership.

Historical resource-page regeneration should not require re-weaving from old mutable current pointers. If historical pages need to be regenerated, the durable input should be a generation manifest, render manifest, checkpoint, or source-state bundle that records the concrete source artifact states, page definition state, reference catalog state, renderer/config state, and output paths used when the page was generated. For testing, mutable values needed to reproduce a weave can also be captured in the fixture manifest. Re-weaving old mesh states is not a general user-facing requirement.

Payloads should keep history by default. `_mesh/_inventory` and `_knop/_inventory` should keep their current history behavior in the immediate quick fix because the current implementation still reads inventory history/progression shape to plan later weaves. But the longer direction is to stop using full inventory history as the blunt tool for mutable progression and historical page regeneration. After the mutable-state split, inventory can likely become current-only, delta/checkpoint based, or metadata-only historical by default, with historical inventory HTML pages suppressed or deferred.

The first slim-history pass should target support artifacts whose history is mostly noise: `_mesh/_meta`, `_knop/_meta`, and probably `_mesh/_config`. These can remain current DigitalArtifacts with working located files and current resource pages, but omit initial `ArtifactHistory`, `HistoricalState`, manifestation, snapshot, and history-page generation by default. If `_meta` becomes the home for mutable current/progression facts, it is still allowed to be current-only by default; those facts are working state, not necessarily historical source material.

Do not solve full config first. Introduce a small internal policy seam now, default it conservatively, and let later config work feed that seam. Do not combine this with a general "turn off resource page generation" feature yet; that is related but has a different contract around dereferenceability and `sflo:hasResourcePage` facts.

## Discussion

### Current facts versus historical reconstruction

The instinct that "former inventory might be needed to recreate page resources that have history" is only partly right. Former full inventory snapshots are one possible way to preserve enough context, but they are not the only way and probably not the right default.

The mutable current/progression facts currently stored in inventory are needed for current operations:

- `sflo:currentArtifactHistory` identifies the current history for a versioned artifact
- `sflo:latestHistoricalState` identifies the current/latest state in that history
- `sflo:nextStateOrdinal` and `sflo:nextHistoryOrdinal` allocate the next ordinal names
- current working-file and page relationships tell the runtime where to read and what is currently dereferenceable

Those values are time-relative. But after a later weave changes them, old values are not usually needed just because they used to be true. They are needed only if a feature promises to reconstruct a prior mesh view that depended on "current as of then."

For historical resource-page regeneration, the better durable input is a page-generation manifest or render bundle, not old unscoped current pointers. A manifest can say: this page was generated from payload state `alice/bio/_history001/_s0001`, page definition state `alice/_knop/_page/_history001/_s0002`, reference catalog state `alice/_knop/_references/_history001/_s0001`, renderer/config version X, and output path Y. That is clearer than asking an old inventory snapshot what happened to be latest at the time.

This means any artifact that is part of the durable input to historical resource pages needs either:

- its own history/state snapshots
- another immutable snapshot or manifest that contains the same information
- or an explicit decision that old generated pages are not reproducible from mesh state

Right now `_mesh/_inventory` is the durable mesh-level snapshot because the implementation puts both public map facts and mutable current/progression facts there. That is convenient, but it creates large mostly-duplicated inventory snapshots and a lot of support HTML. The target design should split those concerns.

That is different from preserving payload history. Payload historical states are user-facing resources. Mutable pointers to the latest payload state are working state.

### Move mutable progression facts out of inventory

Inventory should not be the hot path for every mutable allocator/current pointer if it is also the potentially huge public mesh map.

Candidate facts to move to `_mesh/_meta`, `_knop/_meta`, or a future explicit working-state artifact:

- current artifact history pointers
- latest historical state pointers
- next history/state ordinals
- current progression facts for support artifacts
- possibly current working-file pointers, if those are better treated as current working state than public map data

`_meta` is a reasonable first landing place because it is small and already support-oriented. The long-term ontology should decide whether these are truly metadata facts or whether Weave needs a more specific working-state/progression artifact. Either way, the design should avoid requiring a full inventory snapshot whenever only a small mutable pointer changes.

### Artifact classes by default policy

Recommended default policy:

- Payload artifacts: history on by default.
- `_mesh/_inventory`: keep history on in the immediate implementation because current planner/progression code depends on it; target current-only, delta/checkpoint, or metadata-only history after mutable facts move out and page-regeneration manifests exist.
- `_knop/_inventory`: keep history on in the immediate implementation because current weave progression depends on it; target current-only or slim history once Knop progression facts move to `_knop/_meta` or a dedicated working-state artifact.
- `_mesh/_meta`, `_knop/_meta`: history off by default.
- `_mesh/_config`: history off by default for the quick fix, unless a future config story explicitly chooses to version mesh policy changes.
- `_knop/_assets`: no history by default; if an asset needs independent publication or versioning, model it as its own payload artifact. This aligns with [[wd.task.2026.2026-04-08_1735-page-definition-ontology-and-config]].
- `ResourcePageDefinition` (`_knop/_page`) and `ReferenceCatalog` (`_knop/_references`): behavior-bearing support artifacts. They can become current-only by default only if generated page manifests or page-output durability preserve enough information to regenerate historical pages. Until that contract is explicit, keep them versioned or treat them as a separate policy class.

The last bullet is the main pushback on "everything else can avoid history." Page definitions and reference catalogs can probably become current-only if Weave treats generated page HTML as the durable historical output or stores a manifest/render bundle that pins the source states used for historical output. But if Weave wants to regenerate old pages from mesh RDF alone, then old page definitions, source-selection policy, and reference links need historical snapshots or an equivalent render-bundle snapshot.

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
- Which mutable current/progression facts should move from inventory into `_mesh/_meta`, `_knop/_meta`, or a dedicated working-state artifact?
- Is `_knop/_inventory` conceptually required to have history, or is that only a current implementation dependency that should be replaced by a more explicit Knop progression model?
- Can `_mesh/_inventory` become current-only by default once historical page regeneration is driven by manifests/checkpoints rather than full inventory snapshots?
- What should a page-generation manifest record: source artifact states, page definition state, reference catalog state, renderer version, config/effective policy, output path, checksums, or full source snapshots?
- Should `_mesh/_config` ever be historical by default, or should config changes be tracked through repository history and current mesh state unless explicitly opted in?
- What is the future policy vocabulary: boolean flags, a small enum such as `current-only` / `versioned`, or an artifact-class default with per-artifact overrides?
- Where should inheritable policy live once config is ready: mesh config, Knop config, artifact-local config, operational config, or some combination?
- If resource page generation becomes configurable, what exact RDF should be emitted when a page is intentionally not generated?

## Decisions

- Payload artifacts keep history by default.
- Keep `_mesh/_inventory` history on in the immediate quick fix because current weave planning depends on the existing inventory history/progression shape.
- Keep `_knop/_inventory` history on in the immediate quick fix because current weave progression depends on it.
- Longer-term direction: move mutable current/progression facts out of inventory into `_meta` or a dedicated working-state artifact, then make inventory history slim, current-only, delta/checkpoint based, or metadata-only by default.
- Historical resource-page regeneration should be driven by explicit page/render manifests, source-state bundles, generated output durability, or checkpoints rather than relying on stale mutable current pointers in old inventory snapshots.
- First slim-history implementation should default `_mesh/_meta`, `_knop/_meta`, and `_mesh/_config` to current-only support artifacts.
- Do not wait for full config before implementing the first default cleanup; create an internal policy seam that later config can drive.
- Do not implement a broad resource-page generation toggle in the same first pass.

## Contract Changes

- Current-only support artifacts are valid DigitalArtifacts when they have current working-file facts and resource-page facts but no `sflo:hasArtifactHistory`, `sflo:currentArtifactHistory`, `sflo:nextHistoryOrdinal`, `ArtifactHistory`, `HistoricalState`, or manifestation snapshot for that support artifact itself.
- For artifacts whose history is disabled, Weave should not emit history/state/manifestation resource pages or `sflo:hasResourcePage` facts for those omitted historical resources.
- Payload artifact history behavior is unchanged.
- `_mesh/_inventory` and `_knop/_inventory` history behavior is unchanged in the first pass, but this is now treated as an implementation dependency rather than a permanent conceptual requirement.
- Future page regeneration contracts should prefer explicit generation manifests/checkpoints that pin concrete source states over full copied inventory snapshots.
- Future inventory contracts should distinguish public map facts from mutable current/progression facts.
- No public config, CLI flag, or request-field contract is introduced in the quick fix.

## Testing

- Core planner tests should assert that new first-weave outputs omit `_mesh/_meta` and `_knop/_meta` history triples, snapshot files, and history/state/manifestation pages when the default policy is current-only.
- Mesh support resource-page tests should assert `_mesh/_config` does not get default history when present, while its current page and working file remain represented.
- Existing payload tests should continue to assert payload `ArtifactHistory`, first `HistoricalState`, manifestation, snapshot, and history pages.
- Existing mesh and Knop inventory tests should continue to assert inventory history advancement and next-state ordinal behavior.
- Runtime/integration tests should verify generated current pages do not link to omitted support-history pages.
- Add at least one regression test that a second weave still resolves mesh and Knop inventory progression after metadata/config history is omitted.
- Add later tests, when the mutable-state split lands, proving the next weave can resolve current/progression facts from `_meta` or the dedicated working-state artifact without reading historical inventory snapshots.
- Add later tests for page-generation manifests that prove historical pages can be regenerated from pinned source states without relying on stale `latestHistoricalState` facts from old inventory snapshots.

## Non-Goals

- Do not disable payload history by default.
- Do not disable `_mesh/_inventory` history in this task.
- Do not disable `_knop/_inventory` history in the first implementation pass.
- Do not require full inventory snapshots forever as the only way to regenerate historical resource pages.
- Do not promise general re-weaving of old mesh states as a user-facing feature; test fixtures may capture additional mutable state in manifests when needed.
- Do not design or expose the full inheritable config surface here.
- Do not add a general resource-page generation toggle here.
- Do not migrate or delete already-generated historical support artifacts in existing carried fixtures unless a fixture refresh explicitly requires it.
- Do not treat `_knop/_assets` files as governed artifacts; assets remain helper files unless separately modeled as payload artifacts.

## Implementation Plan

- [ ] Introduce an internal support-history policy helper that can answer whether a candidate artifact role should create history by default.
- [ ] Classify at least `_mesh/_meta`, `_mesh/_config`, `_knop/_meta`, `_mesh/_inventory`, `_knop/_inventory`, payload artifacts, `ResourcePageDefinition`, and `ReferenceCatalog`.
- [ ] Audit mutable current/progression facts currently stored in `_mesh/_inventory` and `_knop/_inventory`, and classify which should move to `_mesh/_meta`, `_knop/_meta`, or a future working-state artifact.
- [ ] Sketch a page-generation manifest/checkpoint contract for historical page regeneration that pins source artifact states instead of relying on old inventory current pointers.
- [ ] Refactor mesh-support page planning so `_mesh/_meta` and `_mesh/_config` can keep current pages without creating support history.
- [ ] Refactor first Knop and first payload weave renderers so `_knop/_meta` remains current-only by default.
- [ ] Keep `_mesh/_inventory` and `_knop/_inventory` history rendering unchanged.
- [ ] Audit generated page models and hand-rendered pages so current support pages do not link to omitted support histories.
- [ ] Update focused core and integration tests for the new default output shape.
- [ ] Run the relevant Deno validation tasks after code changes, at minimum `deno task test` and `deno task lint` for a broad renderer/planner change.
- [ ] Leave clear TODOs for later config-driven policy and resource-page generation policy.
