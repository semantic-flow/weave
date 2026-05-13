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

Payloads should keep history by default. `_mesh/_inventory` and `_knop/_inventory` are current-only by default in the Weave default profile, but many current implementation paths still read inventory history/progression shape to plan later weaves. The longer direction is to stop using full inventory history as the blunt tool for mutable progression and historical page regeneration. After the mutable-state split, inventory can be current-only, delta/checkpoint based, or metadata-only historical by default, with historical inventory HTML pages suppressed or deferred.

The first slim-history pass should target support artifacts whose history is mostly noise: `_mesh/_meta`, `_knop/_meta`, and inventory paths where the planner no longer depends on inventory history shape. These can remain current DigitalArtifacts with working located files and current resource pages, but omit initial `ArtifactHistory`, `HistoricalState`, manifestation, snapshot, and history-page generation by default. Authored config artifacts are different: after the grand config synthesis decision, `_mesh/_config`, `_mesh/_knop-inheritable-config`, `_knop/_local-config`, `_knop/_inheritable-config`, and reusable config artifacts are versioned by default. If `_meta` becomes the home for mutable current/progression facts, it is still allowed to be current-only by default; those facts are working state, not necessarily historical source material.

Do not wait for the entire config resolver before landing bridge slices. Use the default effective config and keep the seam narrow. Do not combine this with a general "turn off resource page generation" feature yet; that is related but has a different contract around dereferenceability and `sflo:hasResourcePage` facts.

### Current Alignment With Grand Config Synthesis

[[wd.task.2026.2026-05-06-grand-config-synthesis]] now supersedes the pre-config parts of this note. We no longer need to invent a separate temporary policy model here: Weave's checked-in default profile under `defaults/` is the policy source for the first runtime slices.

Important deltas from the original quick-fix sketch:

- `_mesh/_config`, `_mesh/_knop-inheritable-config`, `_knop/_local-config`, `_knop/_inheritable-config`, and reusable authored config artifacts are versioned by default, with current ResourcePages generated by default.
- `_mesh/_meta`, `_knop/_meta`, `_mesh/_inventory`, and `_knop/_inventory` default current-only unless overridden, but inventory remains transitional because current weave planners still read inventory progression/history shape in many paths.
- The first implemented bridge slice wires the default effective config into mesh support ResourcePage catch-up: `_mesh/_meta` and `_mesh/_inventory` remain current-only there while `_mesh/_config` is versioned.
- The second bridge slice generalizes that support-history policy seam into core weave planning and applies default effective config to first Knop and first payload weave outputs: `_knop/_meta` remains current-only while payload history and `_knop/_inventory` history stay unchanged.
- The broad fixture-visible implementation should still wait until the config vocabulary, default profile, inherited propagation semantics, and fixture-ladder generator are stable enough to avoid rerunning fixture repair twice.

So the answer is: start implementing narrow bridge slices now, but do not perform the full slim-support fixture migration until the config synthesis first pass is settled.

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

### Page-generation manifest contract

Historical ResourcePage regeneration should be driven by a render/provenance manifest, checkpoint, or equivalent source-state bundle. The manifest is derived runtime evidence, not authored portable config. It can be stored outside the mesh by default, bundled with fixture manifests for tests, or deliberately promoted into a mesh artifact when a project wants auditable page-render provenance.

The minimal manifest contract should record:

- the generated page path and the resource IRI/path that page represented
- page kind, at least current artifact/resource, `ArtifactHistory`, `HistoricalState`, and `ArtifactManifestation`
- generated timestamp, renderer identifier/version, and Weave version or renderer implementation digest
- selected `ResourcePageRegenerationConfigPolicy` mode
- source artifact states used for semantic content, including payload/source state, inventory state, reference catalog state, extraction-source target state, and any other required source snapshots
- presentation inputs, including ResourcePageDefinition, template, stylesheet, presentation config, and built-in renderer/theme identifiers or digests
- relevant `ResolvedConfig` digest plus the config-source fingerprints or pinned states needed to explain that resolved config
- output digest for the generated HTML file
- warnings for missing optional inputs and failures for missing required inputs

The regeneration modes from [[wd.task.2026.2026-05-06-grand-config-synthesis]] need different required inputs:

- `configAtTheTime` requires enough manifest data to recover the page definition, template/stylesheet/presentation config, relevant resolved config, renderer identity, and semantic source snapshots from the original render. If those required inputs are missing, regeneration should warn and fail that page rather than silently rendering with current defaults.
- `currentPresentation` uses historical semantic/source snapshots but current page-definition/template/stylesheet/presentation config. It still requires pinned historical content/source inputs.
- `currentFullConfig` uses current config wherever compatible with the historical source state. It is useful for administrative rebuilds but should be labeled less faithful because config drift can change output.
- `historicalSemanticsCurrentPresentation` preserves historical source-resolution/semantic config while applying current layout/chrome config.

The manifest should never rely on an old inventory's mutable `sflo:latestHistoricalState`, `sflo:currentArtifactHistory`, `sflo:nextStateOrdinal`, or `sflo:nextHistoryOrdinal` facts as unqualified truth. If an old value matters, the manifest should name the concrete state or digest that was used. That lets `_mesh/_inventory` and `_knop/_inventory` move toward current-only or checkpoint-style behavior without making historical page regeneration guess from stale "current" pointers.

### Move mutable progression facts out of inventory

Inventory should not be the hot path for every mutable allocator/current pointer if it is also the potentially huge public mesh map.

Candidate facts to move to `_mesh/_meta`, `_knop/_meta`, or a future explicit working-state artifact:

- current artifact history pointers
- latest historical state pointers
- next history/state ordinals
- current progression facts for support artifacts
- possibly current working-file pointers, if those are better treated as current working state than public map data

`_meta` is the first landing place because it is small and already support-oriented. It should hold current/progression facts, not the whole history. Stable membership stays in inventory/history; `_meta` says where Weave should continue from.

Use the split progression shape:

```ttl
<_mesh/_inventory>
  sflo:currentArtifactHistory <_mesh/_inventory/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sfcfg:hasNextHistorySegmentHint "_history002" .

<_mesh/_inventory/_history001>
  sflo:latestHistoricalState <_mesh/_inventory/_history001/_s0007> ;
  sflo:nextStateOrdinal "8"^^xsd:nonNegativeInteger ;
  sfcfg:hasNextStateSegmentHint "_s0008" .
```

Segment hints are candidate names for the next minted history or state. They are not a substitute for the ordinal counters. When an operation supplies an explicit segment, that explicit segment controls the actual minted path. When no operation segment is supplied, a segment hint controls the minted path if present. Otherwise, Weave derives the anonymous ordinal segment from `sflo:nextHistoryOrdinal` or `sflo:nextStateOrdinal`. The ordinal counter always keeps counting monotonically even when a named segment is used, so a later anonymous state does not reuse an ordinal that was skipped by a named state.

Current code audit:

- `sflo:currentArtifactHistory` is read from current inventory by runtime artifact resolvers and version planning to choose the active history for payloads, ReferenceCatalogs, ResourcePageDefinitions, mesh support artifacts, and Knop support artifacts. It is a current selector, not historical evidence. Target home: `_mesh/_meta` or `_knop/_meta` for support artifacts and a future artifact working-state/progression record for payload/config-like governed artifacts.
- `sflo:latestHistoricalState` is read from the current active history to choose source bytes, validate named-state progression, and plan the next historical state. ResourcePage policy ownership no longer uses it as an ownership edge; it follows stable `sflo:hasHistoricalState` ownership instead. Target home: same progression record as `currentArtifactHistory`.
- `sflo:nextHistoryOrdinal` and `sflo:nextStateOrdinal` are allocator state. They are not source facts for historical reconstruction and should move out first once each planner has a stable current/progression source outside inventory. Target home: `_mesh/_meta`, `_knop/_meta`, or a dedicated working-state artifact.
- `sflo:hasWorkingLocatedFile` and `sflo:workingLocalRelativePath` are current source locators used by runtime loaders and page raw-source panels. Mesh-local public located files may remain useful public map facts, but extra-mesh `workingLocalRelativePath` literals are operational/trust-gated current inputs rather than durable historical facts. Target home: current artifact working state, with historical manifests pinning the actual state/manifestation used for old pages.
- `sflo:hasArtifactHistory`, `sflo:hasHistoricalState`, `sflo:hasManifestation`, historical `sflo:hasLocatedFile`, and truthful `sflo:hasResourcePage` facts should remain inventory/history facts because they describe durable resource membership and generated/public surfaces rather than mutable "current" pointers.
- Extraction-source bindings and reference-target bindings need a separate pass: pinned source-state bindings are durable page-generation inputs, while current-following bindings are mutable resolution instructions and should be captured in render manifests when they influence historical pages.

The immediate implementation consequence is modest: do not make `_mesh/_inventory` or `_knop/_inventory` fully current-only in broad fixture output until version planning can read current selectors and allocator state from `_meta` or a working-state artifact. But the audit removes the mystery: the blockers are current selectors, allocator counters, and current working locators, not the stable history/state membership facts.

### Artifact classes by default policy

Recommended default policy:

- Payload artifacts: history on by default.
- `_mesh/_inventory`: keep history on in the immediate implementation because current planner/progression code depends on it; target current-only, delta/checkpoint, or metadata-only history after mutable facts move out and page-regeneration manifests exist.
- `_knop/_inventory`: keep history on in the immediate implementation because current weave progression depends on it; target current-only or slim history once Knop progression facts move to `_knop/_meta` or a dedicated working-state artifact.
- `_mesh/_meta`, `_knop/_meta`: history off by default.
- `_mesh/_config` and `_mesh/_knop-inheritable-config`: versioned by default under the grand config synthesis defaults, because portable authored config should preserve config-at-the-time for diagnostics, historical page regeneration, and audit.
- `_knop/_assets`: no history by default; if an asset needs independent publication or versioning, model it as its own payload artifact. This aligns with [[wd.task.2026.2026-04-08_1735-page-definition-ontology-and-config]].
- `ResourcePageDefinition` (`_knop/_page`) and `ReferenceCatalog` (`_knop/_references`): behavior-bearing support artifacts. They can become current-only by default only if generated page manifests or page-output durability preserve enough information to regenerate historical pages. Until that contract is explicit, keep them versioned or treat them as a separate policy class.

The last bullet is the main pushback on "everything else can avoid history." Page definitions and reference catalogs can probably become current-only if Weave treats generated page HTML as the durable historical output or stores a manifest/render bundle that pins the source states used for historical output. But if Weave wants to regenerate old pages from mesh RDF alone, then old page definitions, source-selection policy, and reference links need historical snapshots or an equivalent render-bundle snapshot.

### Config first?

Do not block every implementation slice on full config, but do not create a second temporary policy surface either.

Full config needs mesh/submesh/Knop/artifact inheritance, operational versus portable config boundaries, validation, CLI/runtime loading behavior, and ontology vocabulary. That is too large for this cleanup, and it risks freezing a config surface before the history policy is settled. The grand config synthesis task now owns that vocabulary and default-profile work, so this task should consume those policies through internal seams rather than defining competing defaults.

The implementation should still be shaped for config later:

- centralize history policy in one helper or policy object rather than scattering `if support artifact` branches
- name the policy in terms of artifact role, not incidental path string checks where possible
- leave current request/CLI surfaces unchanged
- add TODOs or internal types that make it obvious where later config should enter

Later resolver work can then decide scoped overrides such as `historyPolicy current-only` or `historyPolicy versioned` at mesh, submesh, Knop, artifact-kind, or artifact-specific scope.

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
- Should mutable current/progression facts live directly in `_mesh/_meta` / `_knop/_meta`, or should Weave introduce a more explicit working-state/progression artifact?
- Is `_knop/_inventory` conceptually required to have history, or is that only a current implementation dependency that should be replaced by a more explicit Knop progression model?
- Can `_mesh/_inventory` become current-only by default once historical page regeneration is driven by manifests/checkpoints rather than full inventory snapshots?
- Which page-generation manifest fields should be mandatory for each page kind, and when should Weave store a full source snapshot instead of only state/digest references?
- Can `_mesh/_config` history ever be safely suppressed for tiny/local-only meshes, or is versioned config always the safer default?
- How should the first resolver surface scoped overrides for default history policy without letting portable config weaken trusted runtime invariants?
- Where should inheritable history policy live in practice: `_mesh/_knop-inheritable-config`, `_knop/_inheritable-config`, artifact-local config, operational config, or some combination?
- If resource page generation becomes configurable, what exact RDF should be emitted when a page is intentionally not generated?

## Decisions

- Payload artifacts keep history by default.
- `_mesh/_inventory` and `_knop/_inventory` are current-only by default in the Weave default profile, but applying that behavior everywhere is blocked by current weave planning paths that still depend on inventory history/progression shape.
- Keep `_knop/_inventory` history rendering unchanged until Knop progression facts move out of inventory or the planner can resolve them from a narrower working-state source.
- Longer-term direction: move mutable current/progression facts out of inventory into `_meta` or a dedicated working-state artifact, then make inventory history slim, current-only, delta/checkpoint based, or metadata-only by default.
- Historical resource-page regeneration should be driven by explicit page/render manifests, source-state bundles, generated output durability, or checkpoints rather than relying on stale mutable current pointers in old inventory snapshots.
- First slim-history implementation should default `_mesh/_meta` and `_knop/_meta` to current-only support artifacts, while authored config artifacts remain versioned by default.
- Do not wait for the full resolver before implementing bridge slices; do wait before broad fixture migration that would bake temporary policy behavior into examples.
- Do not implement a broad resource-page generation toggle in the same first pass.

## Contract Changes

- Current-only support artifacts are valid DigitalArtifacts when they have current working-file facts and resource-page facts but no `sflo:hasArtifactHistory`, `sflo:currentArtifactHistory`, `sflo:nextHistoryOrdinal`, `ArtifactHistory`, `HistoricalState`, or manifestation snapshot for that support artifact itself.
- For artifacts whose history is disabled, Weave should not emit history/state/manifestation resource pages or `sflo:hasResourcePage` facts for those omitted historical resources.
- Payload artifact history behavior is unchanged.
- `_mesh/_inventory` and `_knop/_inventory` history behavior is transitional. The mesh support ResourcePage catch-up path can already honor current-only mesh inventory policy, but the full weave planner still has inventory-history dependencies.
- Future page regeneration contracts should prefer explicit generation manifests/checkpoints that pin concrete source states over full copied inventory snapshots.
- Future inventory contracts should distinguish public map facts from mutable current/progression facts.
- No CLI flag or request-field contract is introduced in the quick fix. Default behavior comes from Weave's checked-in default config profile as that profile becomes wired into runtime paths.

## Testing

- Core planner tests should assert that new first-weave outputs omit `_mesh/_meta` and `_knop/_meta` history triples, snapshot files, and history/state/manifestation pages when the default policy is current-only.
- Mesh support resource-page tests should assert `_mesh/_meta` and `_mesh/_inventory` can keep current pages without new support history while `_mesh/_config` remains versioned by default.
- Existing payload tests should continue to assert payload `ArtifactHistory`, first `HistoricalState`, manifestation, snapshot, and history pages.
- Existing mesh and Knop inventory tests should continue to assert inventory history advancement and next-state ordinal behavior.
- Runtime/integration tests should verify generated current pages do not link to omitted support-history pages.
- Add at least one regression test that a second weave still resolves mesh and Knop inventory progression after metadata/config history is omitted.
- Add later tests, when the mutable-state split lands, proving the next weave can resolve current/progression facts from `_meta` or the dedicated working-state artifact without reading historical inventory snapshots.
- Add later tests for page-generation manifests that prove historical pages can be regenerated from pinned source states without relying on stale `latestHistoricalState` facts from old inventory snapshots.

## Non-Goals

- Do not disable payload history by default.
- Do not force all `_mesh/_inventory` planning paths current-only in this task; apply it only where the planner no longer depends on inventory history shape.
- Do not disable `_knop/_inventory` history in the first implementation pass.
- Do not require full inventory snapshots forever as the only way to regenerate historical resource pages.
- Do not promise general re-weaving of old mesh states as a user-facing feature; test fixtures may capture additional mutable state in manifests when needed.
- Do not design or expose the full inheritable config surface here; consume the terms and defaults from [[wd.task.2026.2026-05-06-grand-config-synthesis]].
- Do not add a general resource-page generation toggle here.
- Do not migrate or delete already-generated historical support artifacts in existing carried fixtures unless a fixture refresh explicitly requires it.
- Do not treat `_knop/_assets` files as governed artifacts; assets remain helper files unless separately modeled as payload artifacts.

## Implementation Plan

- [x] Introduce an internal support-history policy seam that can answer whether a candidate artifact role should create history by default for mesh support ResourcePage catch-up.
- [x] Generalize the support-history policy seam beyond mesh support ResourcePage catch-up.
- [x] Classify at least `_mesh/_meta`, `_mesh/_config`, `_mesh/_knop-inheritable-config`, `_knop/_meta`, `_mesh/_inventory`, `_knop/_inventory`, payload artifacts, `ResourcePageDefinition`, and `ReferenceCatalog`.
- [x] Audit mutable current/progression facts currently stored in `_mesh/_inventory` and `_knop/_inventory`, and classify which should move to `_mesh/_meta`, `_knop/_meta`, or a future working-state artifact.
- [x] Sketch a page-generation manifest/checkpoint contract for historical page regeneration that pins source artifact states instead of relying on old inventory current pointers.
- [x] Refactor mesh-support page planning so `_mesh/_meta` and `_mesh/_inventory` can keep current pages without creating support history when default policy says current-only.
- [x] Keep `_mesh/_config` versioned in mesh-support page planning unless an explicit future policy overrides it.
- [x] Refactor first Knop and first payload weave renderers so `_knop/_meta` remains current-only by default.
- [x] Keep `_mesh/_inventory` and `_knop/_inventory` history rendering unchanged.
- [ ] Audit generated page models and hand-rendered pages so current support pages do not link to omitted support histories.
- [ ] Update focused core and integration tests for the new default output shape.
- [ ] Run the relevant Deno validation tasks after code changes, at minimum `deno task test` and `deno task lint` for a broad renderer/planner change.
- [ ] Leave clear TODOs for later config-driven policy and resource-page generation policy.
