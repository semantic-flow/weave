---
id: 0fq7qy19dmg9vqypoktfuax
title: 2026 05 06 Grand Config Synthesis
desc: ''
updated: 1778128649410
created: 1778128425390
---

## Goals

- Consolidate the current config-related design threads into one task that can guide an overhaul of `dependencies/github.com/semantic-flow/ontology/semantic-flow-config-ontology.ttl`.
- Preserve the useful current split between core ontology, config ontology, and implementation/runtime behavior.
- Reintroduce Knop-local and Knop-inheritable config as separate mesh-managed `DigitalArtifact`s, not just embedded blank-node config.
- Define config policy vocabulary for history tracking, resource page generation, presentation, naming defaults, and reusable config artifacts without falling back to broad booleans.
- Clarify the relationship between portable mesh/Knop-authored config and operational/runtime resolved config.
- Keep `sflo:nextHistoryOrdinal` and `sflo:nextStateOrdinal` in inventory/history RDF, not in config.
- Support reusable named config artifacts that can be referenced from many Knops, meshes, submeshes, and external meshes.
- Define a meta-config / config-resolution layer that controls how config files and reusable config artifacts are discovered, ordered, trusted, merged, cached, and rejected.
- Externalize Weave's built-in/default behavior choices as an explicit "Weave default config" layer so defaults currently implicit in code or surfaced only through API/CLI options become inspectable and overrideable.
- Treat [[ont.task.2026.2026-05-03-enumeration-type-instances]] as a prerequisite for the config ontology overhaul so the many config policy values are introduced as flat camelCase individuals rather than new slash-style enum IRIs.
- Fold the actionable decisions from [[ont.task.2026.2026-03-23-config-modernization]], [[wd.task.2026.2026-04-08_1735-page-definition-ontology-and-config]], [[wd.task.2026.2026-04-11_1723-operational-config-for-runtime-resolution]], and [[wd.task.2026.2026-05-05-optional-history-and-slim-support-artifacts-by-default]] into a coherent next task.

## Summary

The config line needs a deliberate consolidation pass. The current active config ontology already contains a good substrate: `Config`, `ConfigArtifact`, `hasConfig`, `hasEffectiveConfig`, `OperationalConfig`, `MeshConfig`, local/remote access rules, and ResourcePage presentation template terms. The old `sflo-config-ontology.jsonld` contains useful lineage, especially named reusable `ConfigArtifact`s, template/style artifacts, and the old `generateResourcePages` / `createHistoricalStatesOnWeave` pressure. But the old ontology's `AbstractArtifact`, Flow/State framing, broad template mapping, regex targeting, and boolean switches should not be carried forward directly.

The synthesized direction is:

- portable authored config belongs in mesh-managed config artifacts such as `_mesh/_config`, `_knop/_local-config`, and `_knop/_inheritable-config`
- operational/runtime config can hold the application's active resolved config, including effective policies for many meshes, submeshes, Knops, and artifacts
- reusable config is a first-class `ConfigArtifact` / `DigitalArtifact` with its own IRI, working file, optional history, and resource page policy
- config attachment and config resolution should use explicit target/reference vocabulary rather than path conventions alone
- meta-config exists as a small bootstrap layer for config discovery and resolver policy
- Weave default config externalizes built-in behavior defaults before mesh, Knop, operational, API, or CLI overrides are applied
- history tracking and resource page generation should be policy-valued, not booleans
- controlled policy values should use the flat camelCase enum-instance convention from [[ont.task.2026.2026-05-03-enumeration-type-instances]]
- artifact history allocator state remains in core inventory/history RDF

This task should supersede the older "replace local/inheritable config with mesh-scoped defaults only" direction from [[ont.task.2026.2026-03-23-config-modernization]]. Mesh-level defaults are still important, but they are not enough. Knops need two different config surfaces: config that applies locally to the Knop and its own artifacts, and config that the Knop offers to descendants.

## Discussion

### Source Task Scan

[[ont.task.2026.2026-05-03-enumeration-type-instances]] should be handled before the config ontology overhaul mints new policy values. Config will introduce many controlled vocabulary values: artifact roles, history policies, page-generation policies, naming policies, layer roles, reference policies, cache policies, cycle policies, and unknown-term policies. If the config overhaul lands first with slash-style values, it will immediately create another migration. The enum task does not need to finish every fixture rerung before config design can continue, but the naming convention and ontology-level enum migration should be settled first and config examples should use the flat camelCase convention from the start.

[[ont.task.2026.2026-03-23-config-modernization]] established the modern base: `Config` remains distinct from `DigitalArtifact`, `ConfigArtifact` can also be a `DigitalArtifact` / `RdfDocument`, explicit mesh/Knop config attachment is preferable to relying only on generic `hasConfig`, reusable config artifacts are valid, `hasEffectiveConfig` is a non-authoritative runtime/debug view, and the old Flow/State configuration model should be dropped. Its "old `LocalConfig` / `InheritableConfig` split should probably be replaced by mesh-scoped defaults plus explicit knop overrides" is now superseded by this task: mesh defaults are useful, but not a replacement for `_knop/_local-config` and `_knop/_inheritable-config`.

[[wd.task.2026.2026-04-08_1735-page-definition-ontology-and-config]] established that page content composition belongs in core, while template/chrome/presentation preferences belong in config. It also established that templates and stylesheets should be first-class artifacts and that the old regex-heavy template mapping machinery should not be copied forward. The page-definition work also keeps `targetLocalRelativePath`, `targetAccessUrl`, `workingLocalRelativePath`, and `workingAccessUrl` out of presentation config and leaves access policy to operational config.

[[wd.task.2026.2026-04-11_1723-operational-config-for-runtime-resolution]] established operational config as a first-class runtime concern for CLI, daemon, and other execution surfaces. It distinguishes mesh-carried expectations from machine-local trust policy and uses deny-by-default local/remote access allow rules. This task keeps that split, but broadens the operational config idea to include the application's active resolved behavior config. That resolved config may include history, page generation, presentation, naming, and access policy for many meshes and Knops. It must still be clearly distinguished from portable authored config.

[[wd.task.2026.2026-05-05-optional-history-and-slim-support-artifacts-by-default]] established the need for policy-valued history tracking and page-generation control. Payloads keep history by default. `_mesh/_inventory` remains historical because it is the settled mesh-state ledger. `_knop/_inventory` remains historical for now because current weave progression depends on it. Low-value support artifacts such as `_mesh/_meta`, `_knop/_meta`, and probably `_mesh/_config` can default to current-only. The eventual config vocabulary should drive these defaults rather than hard-coded path checks.

### Authored Config Layers

The authored portable config layers should be explicit:

- `_mesh/_config`: mesh-level config for the mesh surface and defaults that apply across the mesh
- `_knop/_local-config`: local config for the Knop, its resource page, and artifacts governed at that Knop
- `_knop/_inheritable-config`: defaults the Knop offers to descendant Knops and subtrees
- reusable named config artifacts: ordinary named `ConfigArtifact` resources that may live anywhere in a mesh, such as `alice/alices-favorite-sf-config-setting`, and may be referenced by mesh, Knop, local, or inheritable config

`_knop/_local-config` and `_knop/_inheritable-config` should be separate `DigitalArtifact`s because they have different semantics, lifecycle, history policy, and attachment behavior. They might both be current-only by default in many meshes, but they must be capable of independent versioning when a mesh needs auditable config evolution.

### Operational And Resolved Config

Operational/runtime config has two related roles:

- host/runtime trust policy, such as local path and remote URL access
- active resolved application config, such as the effective history policy or page-generation policy for a particular mesh, submesh, Knop, artifact role, or artifact

This is acceptable as long as the distinction is explicit. Authored config is the portable source material. Resolved operational config is what the application actually uses at runtime after discovery, inheritance, reusable config resolution, local overrides, and host trust policy have been applied.

`hasEffectiveConfig` should remain non-authoritative when asserted in mesh RDF. A runtime may still maintain an authoritative in-memory or process-local resolved config for the active operation. If resolved config is persisted for diagnostics or daemon state, it should carry enough metadata to make clear that it is derived runtime state, not the source of truth.

The active runtime config may cover many scopes:

- multiple mesh roots in one daemon process
- submeshes
- Knops and descendant Knop scopes
- artifact roles such as payload, metadata, inventory, config, page definition, reference catalog, and assets
- specific artifacts
- page generation and presentation layers
- access policy layers

### Weave Default Config

Weave needs a default config layer: an explicit representation of choices that are currently implicit in TypeScript defaults, CLI defaults, API request defaults, renderer defaults, planner defaults, and fixture-shaped assumptions.

This layer should answer: "What would Weave do if no mesh, Knop, artifact, runtime, API, or CLI override said otherwise?"

Candidate name: `WeaveDefaultConfig`. Other acceptable names are `ApplicationDefaultConfig` or `ImplementationDefaultConfig`, but `WeaveDefaultConfig` is honest that this is the reference implementation's default behavior, not necessarily a universal Semantic Flow mandate.

The Weave default config should include defaults such as:

- payload artifacts are versioned by default
- `_mesh/_inventory` history is required by default
- `_knop/_inventory` history is versioned by default for current Weave progression
- `_mesh/_meta`, `_knop/_meta`, and ordinary config support artifacts may be current-only by default
- current payload resource pages are generated by default
- support artifact history pages may be suppressed by default when their history policy is current-only
- default history segment strategy is ordinal
- default state segment strategy is ordinal
- default manifestation segment strategy is filename/content-kind derived unless explicitly configured
- page renderer/presentation defaults when no `ResourcePagePresentationConfig` is present
- default config resolution profile, including fail-closed behavior for unknown terms and config cycles

This is not the same as resolved runtime config. The Weave default config is an input layer. Resolved runtime config is the result after Weave defaults, operational resolver policy, mesh config, inherited Knop config, local Knop config, reusable config artifacts, API request fields, and CLI overrides have been applied and validated.

This is also not the same as portable mesh config. A mesh may override or narrow Weave defaults, but the defaults themselves should be inspectable independently of any mesh. For testing, the default config should be loadable as a fixture or embedded RDF artifact so test expectations can point at a declared default instead of reverse-engineering behavior from code.

The practical implementation can start with an internal typed default object, but the contract should be shaped as if it can be serialized as RDF:

```turtle
@prefix sfcfg: <https://semantic-flow.github.io/ontology/config/> .

<> a sfcfg:WeaveDefaultConfig ;
  sfcfg:hasHistoryTrackingDefault [
    a sfcfg:ArtifactRolePolicy ;
    sfcfg:hasArtifactRole sfcfg:artifactRolePayload ;
    sfcfg:hasHistoryTrackingPolicy sfcfg:historyTrackingPolicyVersioned
  ], [
    a sfcfg:ArtifactRolePolicy ;
    sfcfg:hasArtifactRole sfcfg:artifactRoleMeshInventory ;
    sfcfg:hasHistoryTrackingPolicy sfcfg:historyTrackingPolicyRequired
  ], [
    a sfcfg:ArtifactRolePolicy ;
    sfcfg:hasArtifactRole sfcfg:artifactRoleKnopMetadata ;
    sfcfg:hasHistoryTrackingPolicy sfcfg:historyTrackingPolicyCurrentOnly
  ] ;
  sfcfg:hasResourcePageGenerationDefault [
    a sfcfg:ArtifactRolePolicy ;
    sfcfg:hasArtifactRole sfcfg:artifactRolePayload ;
    sfcfg:hasResourcePageGenerationPolicy sfcfg:resourcePageGenerationPolicyGenerate
  ] .
```

Do not move every command option into default config immediately. Some options are operation requests, not configuration. The useful boundary is: if a value describes stable behavior preference or default policy, it belongs in config; if it describes this one operation's explicit target or input bytes, it stays in the request. CLI/API fields can override config at runtime, but should not be the only durable way to express repeatable policy.

### Meta-Config And The Bootstrap Problem

We need config about how config is resolved, but that introduces a bootstrap problem: if ordinary config can decide which config sources are trusted, then untrusted config can grant itself authority.

The way out is a small meta-config layer, better named `ConfigResolutionConfig` or `ConfigResolverConfig` rather than a vague `MetaConfig`. This layer configures the resolver itself:

- which config layers are discovered
- which config sources are allowed
- which reusable config targets may be followed
- whether current-following external config references are allowed
- merge and precedence profile
- inheritance traversal profile
- unknown-term behavior
- cycle behavior
- cache/lock behavior for resolved effective config
- whether portable mesh config may affect resolver behavior at all

Meta-config should be split into two classes of decision:

- bootstrap resolver policy: what the application trusts before reading project config
- portable resolver hints: what a mesh would like the resolver to do, which the application may ignore or cap

The bootstrap resolver policy must come from a trusted source:

- built-in application defaults
- explicit CLI/runtime argument
- machine-local operational config
- daemon-managed runtime profile

Portable mesh config can request a resolver profile, but it must not be able to expand trust by itself. For example, a mesh can say "this mesh expects reusable configs under `../shared-config/`", but the runtime must still require operational local-path access policy before reading that path.

### Config Resolution Layers

The resolver should reason over explicit layers rather than an implicit pile of Turtle files.

Candidate `ConfigLayerRole` controlled values:

- `BuiltInDefaults`
- `WeaveDefaults`
- `CommandOverride`
- `MachineLocalOperational`
- `WorkspaceOperational`
- `MeshLocal`
- `MeshInheritableDefaults`
- `KnopInherited`
- `KnopLocal`
- `ReusableConfig`
- `ResolvedRuntime`

The exact order should be a configured `ConfigPrecedenceProfile`, not baked into comments. A default profile can say:

- implementation-internal emergency defaults are weakest
- Weave default config is the normal declared baseline
- mesh and ancestor inheritable defaults override application defaults
- reusable config applies at the point where it is referenced
- Knop local config overrides inherited config for that Knop
- command/request overrides are strongest, but still validated against policy
- machine-local operational trust policy is not a normal behavior override; it gates what can be read or fetched

That last point matters. Access policy is not merely another setting to merge. It controls which sources may be loaded. Behavior config can be inherited and overridden. Trust policy must gate resolution before behavior config can participate.

### Candidate Meta-Config Vocabulary

Candidate classes:

- `ConfigResolutionConfig`
- `ConfigLayer`
- `ConfigLayerRole`
- `ConfigPrecedenceProfile`
- `ConfigMergeProfile`
- `ConfigReferencePolicy`
- `ConfigInheritancePolicy`
- `ConfigCyclePolicy`
- `UnknownConfigTermPolicy`
- `EffectiveConfigCachePolicy`

Candidate properties:

- `hasConfigLayer`
- `hasConfigLayerRole`
- `hasConfigSource`
- `hasConfigPrecedenceProfile`
- `hasConfigMergeProfile`
- `hasConfigReferencePolicy`
- `hasConfigInheritancePolicy`
- `hasConfigCyclePolicy`
- `hasUnknownConfigTermPolicy`
- `hasEffectiveConfigCachePolicy`
- `allowsPortableResolverHints`
- `maxConfigReferenceDepth`
- `hasConfigRoot`
- `hasConfigScope`
- `hasResolvedConfigFor`
- `resolvedFromConfig`
- `resolvedAt`

Candidate controlled values:

- `unknownConfigTermPolicyReject`
- `unknownConfigTermPolicyIgnore`
- `unknownConfigTermPolicyWarn`
- `configCyclePolicyReject`
- `configCyclePolicyUseFirstSeen`
- `configReferencePolicyNoExternalReferences`
- `configReferencePolicyPinnedOnly`
- `configReferencePolicyCurrentAllowedWithinTrustedBoundary`
- `effectiveConfigCachePolicyNoCache`
- `effectiveConfigCachePolicyCacheForProcess`
- `effectiveConfigCachePolicyPersistDiagnosticCache`

The first implementation should prefer fail-closed values:

- reject unknown required policy terms
- reject config cycles
- reject unresolved reusable config targets
- reject external config references unless allowed by operational access policy
- require explicit opt-in before following current external config references

### Meta-Config Example Shape

Sketch only; names are candidates:

```turtle
@prefix sfcfg: <https://semantic-flow.github.io/ontology/config/> .
@prefix sflo: <https://semantic-flow.github.io/ontology/core/> .

<> a sfcfg:ConfigResolutionConfig ;
  sfcfg:hasUnknownConfigTermPolicy sfcfg:unknownConfigTermPolicyReject ;
  sfcfg:hasConfigCyclePolicy sfcfg:configCyclePolicyReject ;
  sfcfg:hasConfigReferencePolicy sfcfg:configReferencePolicyPinnedOnly ;
  sfcfg:hasEffectiveConfigCachePolicy sfcfg:effectiveConfigCachePolicyCacheForProcess ;
  sfcfg:maxConfigReferenceDepth "8"^^xsd:nonNegativeInteger ;
  sfcfg:hasConfigLayer [
    a sfcfg:ConfigLayer ;
    sfcfg:hasConfigLayerRole sfcfg:configLayerRoleBuiltInDefaults ;
    sfcfg:layerOrder "10"^^xsd:nonNegativeInteger
  ], [
    a sfcfg:ConfigLayer ;
    sfcfg:hasConfigLayerRole sfcfg:configLayerRoleMeshLocal ;
    sfcfg:hasConfigSource [
      a sfcfg:ConfigResolutionTarget ;
      sflo:hasTargetArtifact <_mesh/_config> ;
      sflo:hasArtifactResolutionMode sflo:artifactResolutionModeCurrent
    ] ;
    sfcfg:layerOrder "40"^^xsd:nonNegativeInteger
  ], [
    a sfcfg:ConfigLayer ;
    sfcfg:hasConfigLayerRole sfcfg:configLayerRoleKnopLocal ;
    sfcfg:layerOrder "80"^^xsd:nonNegativeInteger
  ] .
```

If a project wants a reusable config:

```turtle
<alice/_knop> sfcfg:hasKnopLocalConfigSource [
  a sfcfg:ConfigResolutionTarget ;
  sflo:hasTargetArtifact <alice/alices-favorite-sf-config-setting> ;
  sflo:hasArtifactResolutionMode sflo:artifactResolutionModePinned ;
  sflo:hasRequestedTargetState <alice/alices-favorite-sf-config-setting/_history001/_s0003>
] .
```

The resolver config decides whether that source may be followed, how it is merged, and whether the target must be pinned.

### No Boolean Policy Flags

The old `generateResourcePages` and `createHistoricalStatesOnWeave` booleans name real needs, but booleans are the wrong core contract. They are too narrow for inventory history, deferred page generation, and policy inheritance.

Use controlled policy resources instead. Candidate policy families:

- `HistoryTrackingPolicy`
  - `historyTrackingPolicyVersioned`
  - `historyTrackingPolicyCurrentOnly`
  - `historyTrackingPolicyRequired`
- `ResourcePageGenerationPolicy`
  - `resourcePageGenerationPolicyGenerate`
  - `resourcePageGenerationPolicySuppress`
  - `resourcePageGenerationPolicyDefer`
- `HistoryNamingPolicy`
  - `historyNamingPolicyOrdinal`
  - `historyNamingPolicyNamed`
- `StateNamingPolicy`
  - `stateNamingPolicyOrdinal`
  - `stateNamingPolicySemver`
  - `stateNamingPolicyDate`

The exact names can change during ontology work, but the shape should stay policy-valued rather than boolean-valued.

### Ordinals Stay In Core State

`sflo:nextHistoryOrdinal` and `sflo:nextStateOrdinal` stay in the artifact/inventory/history RDF. They are allocator state for a specific `DigitalArtifact` and `ArtifactHistory`, not configuration.

Config can provide defaults or hints:

- default history segment
- default state segment
- state segment strategy
- next state segment hint
- next history segment hint
- preferred release history segment such as `releases`

But config must not become the authoritative counter store. A weave should resolve the effective config, validate requested or hinted names against the current artifact/history RDF, then update the real `nextHistoryOrdinal` or `nextStateOrdinal` facts only as part of the normal inventory/history state transition.

### Reusable Config Artifacts And Targeting

Reusable config artifacts need first-class attachment and resolution vocabulary.

The existing core `ArtifactResolutionTarget` pattern is close to what we need: it can target a `DigitalArtifact`, request a history or state, and specify current versus pinned resolution. We should prefer reusing that pattern or defining a config-specific subclass rather than inventing a parallel resolver from scratch.

Candidate direction:

- `ConfigResolutionTarget` as a config-ontology subclass of `sflo:ArtifactResolutionTarget`
- `hasConfigSource` or role-specific subproperties that point from a config-bearing resource to a `ConfigResolutionTarget`
- `hasTargetArtifact` can target a `ConfigArtifact` because `ConfigArtifact` is a `DigitalArtifact`
- `hasRequestedTargetHistory`, `hasRequestedTargetState`, `hasArtifactResolutionMode`, and `hasArtifactResolutionFallbackPolicy` can carry current/pinned config-source semantics

This supports:

- a Knop referencing a reusable config artifact in the same mesh
- a mesh referencing a reusable default config artifact
- an inheritable config referencing shared fragments
- a runtime resolving a config from an external mesh under explicit access policy

The ontology should also decide whether `ConfigFragment` is needed. If it is kept, fragments can represent reusable RDF subgraphs that do not need independent `DigitalArtifact` identity. But when reuse crosses mesh boundaries or needs history, use a `ConfigArtifact`.

### Attachment And Inheritance

Generic `hasConfig` remains useful, but the public model should include role-specific attachment properties so merge behavior is not hidden in path names:

- `hasMeshConfig`
- `hasKnopLocalConfig`
- `hasKnopInheritableConfig`
- `hasConfigResolutionTarget` or role-specific config-source properties
- `hasEffectiveConfig` for runtime/debug output

Inheritance should be scoped and explicit:

- mesh-level config supplies mesh defaults and possibly top-level Knop defaults
- a parent Knop's inheritable config supplies defaults for descendants
- a Knop's local config overrides inherited defaults for that Knop
- reusable config artifacts may be imported/referenced into either layer
- application/runtime defaults are the final fallback

We should not overfit the old "configuration firewall" machinery before we need it, but the concept remains useful. We likely need some policy value that says whether a Knop accepts inherited config and whether its inheritable config propagates past itself. That should also be policy-valued rather than boolean-valued.

### Config Artifacts And History

Config artifacts are `DigitalArtifact`s and therefore may have histories. They should not all be historical by default.

Likely defaults:

- reusable named config artifacts: versioned by default if they are intended for cross-mesh or multi-Knop reuse
- `_knop/_local-config`: current-only by default, with opt-in versioning
- `_knop/_inheritable-config`: current-only by default, with opt-in versioning
- `_mesh/_config`: current-only by default for ordinary mesh behavior config, with opt-in versioning
- operational machine-local config: outside normal mesh history unless explicitly represented as a mesh artifact

This is a default policy, not a hard ontology rule.

### Resource Page Generation

Resource page generation should be independently configurable from history tracking.

The config model must answer:

- whether current resource pages are generated
- whether history pages are generated when history exists
- whether state and manifestation pages are generated
- whether config support artifacts get pages
- whether suppressed pages omit `sflo:hasResourcePage` or leave an unfulfilled promise
- whether page generation can be deferred and generated later from history/inventory

The default should preserve dereferenceability for public payloads and important mesh navigation, but slim support artifacts should be able to suppress noisy current and historical pages by policy.

### Config Ontology Overhaul Scope

The active `semantic-flow-config-ontology.ttl` should be revised rather than replaced blindly.

Keep or refine:

- `Config`
- `ConfigArtifact`
- `hasConfig`
- `configFor`
- `hasEffectiveConfig`
- Weave/application default config as a serializable baseline layer
- `OperationalConfig`
- `MeshConfig`
- local and remote access rule vocabulary
- ResourcePage presentation template and stylesheet artifacts

Add or substantially revise:

- `KnopLocalConfig`
- `KnopInheritableConfig`
- `ConfigFragment`, if still useful
- role-specific config attachment properties
- config-source / reusable-config resolution vocabulary
- policy-valued history tracking
- policy-valued resource page generation
- naming-default policy and hint vocabulary
- resolved/effective runtime config vocabulary
- config-resolution / meta-config vocabulary
- Weave default config vocabulary
- clear terms for machine-local operational config so it does not collide with Knop-local config

Drop or avoid reviving:

- old `AbstractArtifact` and Flow/State config framing
- generic regex template mappings as the first inheritance/selection mechanism
- boolean `generateResourcePages`
- boolean `createHistoricalStatesOnWeave`
- treating `nextHistoryOrdinal` or `nextStateOrdinal` as config
- allowing portable config to expand its own config-source trust boundary
- host service settings as the center of this ontology overhaul

## Open Issues

- What is the name of the meta-config class: `ConfigResolutionConfig`, `ConfigResolverConfig`, `ConfigBootstrapConfig`, or something else?
- Should the default baseline be named `WeaveDefaultConfig`, `ApplicationDefaultConfig`, or `ImplementationDefaultConfig`?
- Which current CLI/API defaults should become default config terms immediately, and which should remain request-only until they become stable policy?
- Should Weave default config be embedded in code, stored as an RDF file in the repo, emitted by a diagnostic command, or all three?
- Which resolver-policy decisions are allowed in portable mesh config, and which are restricted to trusted bootstrap or machine-local operational config?
- Should portable meshes be allowed to request resolver hints such as preferred layer order, or should portable resolver hints be limited to declaring expected config artifacts?
- How much of config layer ordering should be ontology vocabulary versus implementation profile?
- Should current-following reusable config references be allowed at all, or should reusable config be pinned by default unless the runtime profile explicitly permits current following?
- What lock/cache artifact, if any, records the exact config sources used for a weave?
- Should `LocalConfig` in the active ontology be renamed or specialized so it does not conflict with `KnopLocalConfig`? The current active meaning is machine/user-local config, not Knop-local config.
- Should the resolved runtime config be modeled as `OperationalConfig`, `ResolvedConfig`, `EffectiveConfig`, or a subclass such as `EffectiveOperationalConfig`?
- Should `ConfigResolutionTarget` be added as a config-specific subclass of `sflo:ArtifactResolutionTarget`, or should config attachment directly reuse `ArtifactResolutionTarget` without a subtype?
- Does `ConfigFragment` still add enough value once reusable named `ConfigArtifact`s exist?
- What is the exact precedence order across runtime defaults, machine-local operational config, mesh config, parent inheritable config, Knop local config, command-line request fields, and one-shot overrides?
- Should command-line history segment arguments override config hints, or should conflict between explicit request and config policy fail closed?
- Which resource-page suppression cases omit `sflo:hasResourcePage`, and which retain a planned/deferred page relation?
- Which config artifacts are versioned by default versus current-only by default?
- How should external reusable config artifacts be resolved, cached, and trusted across mesh boundaries?
- Should inherited config propagation controls be implemented now, or left for the first real multi-level Knop policy case?
- What examples should live in the ontology repo versus Weave developer notes?

## Decisions

- Reintroduce `_knop/_local-config` and `_knop/_inheritable-config` as separate Knop support artifacts.
- Treat `_knop/_local-config` and `_knop/_inheritable-config` as `DigitalArtifact` / `RdfDocument` config artifacts that may be independently versioned.
- Keep `sflo:nextHistoryOrdinal` and `sflo:nextStateOrdinal` in inventory/history RDF, not in config.
- Use policy-valued vocabulary for history tracking and resource page generation rather than booleans.
- Allow config to provide naming defaults and hints such as default history segment, default state segment, state naming policy, and next state segment hint.
- Require weave/version operations to validate config-provided naming hints against current artifact/history RDF before using them.
- Keep payload artifacts historical by default.
- Keep `_mesh/_inventory` historical by default because it is the settled mesh-state ledger.
- Keep `_knop/_inventory` historical for now because current weave progression depends on it.
- Default low-value support artifacts such as `_mesh/_meta`, `_knop/_meta`, and likely `_mesh/_config` toward current-only history policy unless overridden.
- Treat operational/runtime config as the application's active resolved config layer, not only as path/URL trust policy.
- Add a config-resolution / meta-config layer to control discovery, trust, precedence, merge behavior, reference following, cycle handling, and effective-config caching.
- Add a Weave default config layer that externalizes stable behavior defaults currently implicit in code or exposed only through API/CLI defaults.
- Treat Weave default config as an input to effective config resolution, not as the same thing as resolved runtime config.
- Keep one-shot operation inputs separate from default config, while allowing API/CLI overrides to sit above config during a single operation.
- Trusted bootstrap resolver policy must come from built-in defaults, explicit runtime input, machine-local operational config, or daemon-managed runtime state, not from untrusted portable mesh config alone.
- Portable mesh config may declare resolver hints or expected config sources, but it must not expand local/remote trust boundaries by itself.
- Default config resolution should fail closed on unknown required terms, cycles, unresolved config targets, and disallowed external config references.
- Reusable config references should default toward pinned resolution; current-following reusable config must require explicit resolver policy.
- Keep portable authored config and machine/runtime trust policy distinct even when both use the config ontology.
- Treat reusable named configs as first-class `ConfigArtifact`s that can be referenced across Knops, meshes, and external meshes.
- Prefer reusing or specializing the existing artifact-resolution vocabulary for config-source references rather than inventing an unrelated targeting model.
- Preserve template and stylesheet artifacts as first-class `DigitalArtifact`s.
- Do not revive regex-heavy template mappings as the first resource-page presentation selection model.
- Revise the active `semantic-flow-config-ontology.ttl` in place rather than copying the old JSON-LD ontology forward.
- Complete the enum-style individual naming pass before minting new config policy individuals; all new config controlled values should use flat camelCase IRIs such as `sfcfg:historyTrackingPolicyCurrentOnly`, not slash-style IRIs.

## Contract Changes

- Add portable Knop-local and Knop-inheritable config artifact vocabulary.
- Add policy-valued history tracking vocabulary.
- Add policy-valued resource page generation vocabulary.
- Add config naming-default and naming-hint vocabulary that is separate from core ordinal allocator state.
- Add config attachment and config-source resolution vocabulary for reusable named config artifacts.
- Add config-resolution vocabulary for layers, layer roles, precedence profiles, merge profiles, reference policy, cycle policy, unknown-term policy, and effective-config cache policy.
- Define a trusted bootstrap model for resolver configuration.
- Add Weave default config vocabulary for implementation default history policy, page policy, naming policy, presentation policy, and resolver defaults.
- Align all new config controlled values with the flat camelCase enum-instance convention from [[ont.task.2026.2026-05-03-enumeration-type-instances]].
- Clarify that `hasEffectiveConfig` and resolved config artifacts are derived runtime/debug/application state, not authoritative mesh source data unless explicitly modeled otherwise.
- Clarify the distinction between machine-local operational config and Knop-local portable config.
- Clarify that portable resolver hints cannot grant host filesystem or network access without operational trust policy.
- Update the active config ontology to align with current `sflo:DigitalArtifact`, `sflo:Knop`, `sflo:SemanticMesh`, `sflo:ArtifactResolutionTarget`, and `sflo:ResourcePageDefinition` vocabulary.
- Retire old boolean config terms in favor of controlled policy resources.
- Retire old `AbstractArtifact` and Flow/State based config inheritance assumptions.

## Testing

- Ontology validation should cover the revised config ontology and examples.
- Add example RDF for `_mesh/_config`, `_knop/_local-config`, `_knop/_inheritable-config`, and a reusable named config artifact.
- Add example RDF showing a Knop inheriting defaults from a parent and overriding them locally.
- Add example RDF showing a reusable config artifact referenced through a pinned config-source target.
- Add example RDF showing current-following config-source resolution.
- Add example RDF for Weave default config and how it is overridden by mesh, inherited Knop, local Knop, and CLI/API request policy.
- Add ontology checks or search-based guardrails that reject new slash-style enum individuals in config examples and vocabulary.
- Add runtime config resolver unit tests for effective policy precedence.
- Add tests for config-resolution bootstrap behavior: untrusted portable config cannot enable external config references by itself.
- Add tests for resolver policy values: unknown term rejection, cycle rejection, max reference depth, pinned-only reusable config, and current-following opt-in.
- Add tests for effective-config cache behavior if persistent diagnostic caches are introduced.
- Add tests proving config-provided history/state segment hints do not bypass current artifact/history RDF validation.
- Add tests proving `nextHistoryOrdinal` and `nextStateOrdinal` continue to come from inventory/history RDF.
- Add tests for resource page generation policies, including suppressed pages and omitted historical support pages.
- Add fail-closed tests for malformed config, unknown policy values, unresolved reusable config targets, and disallowed external config references.

## Non-Goals

- Do not implement the full config resolver in the ontology overhaul before the vocabulary is reviewed.
- Do not pretend every CLI/API option is config; operation-specific inputs and targets remain request data.
- Do not move `sflo:nextHistoryOrdinal` or `sflo:nextStateOrdinal` into config.
- Do not use booleans as the durable policy vocabulary for history tracking or resource page generation.
- Do not make machine-local trust policy travel silently as portable mesh config.
- Do not let ordinary portable config decide which untrusted config sources may be loaded.
- Do not implement a fully general package-manager-style config dependency resolver.
- Do not revive the old Flow/State config model.
- Do not revive regex-driven template mapping as the first page-presentation selection model.
- Do not solve every daemon service setting, logging setting, or long-running host concern in this task.
- Do not force every config artifact to be versioned by default.
- Do not make `_knop/_assets` recursively governed just because page presentation config references stylesheets or templates.

## Implementation Plan

### Phase 0: Synthesis And Examples

- [ ] Finish or at least settle the ontology enum-instance naming task enough that config policy values can be minted once, using the flat camelCase convention.
- [ ] Record the synthesized decisions from the current task and the four source tasks.
- [ ] Draft compact example RDF for mesh config, Knop local config, Knop inheritable config, reusable config artifacts, and resolved operational config.
- [ ] Draft compact example RDF for config-resolution / meta-config, including pinned reusable config and a rejected current-following config source.
- [ ] Draft compact example RDF for Weave default config.
- [ ] Decide initial names for policy classes and controlled policy values.

### Phase 1: Config Ontology Overhaul

- [ ] Update `dependencies/github.com/semantic-flow/ontology/semantic-flow-config-ontology.ttl` with Knop local/inheritable config classes and attachment properties.
- [ ] Add or refine reusable config-source resolution vocabulary, preferably by reusing or subclassing `sflo:ArtifactResolutionTarget`.
- [ ] Add config-resolution / meta-config classes for layers, layer roles, precedence, merge behavior, reference policy, cycle policy, unknown-term policy, and cache policy.
- [ ] Add Weave default config class and properties for default policies currently implicit in code/API/CLI defaults.
- [ ] Add policy-valued history tracking and resource page generation vocabulary.
- [ ] Add naming-default and naming-hint vocabulary without moving ordinal allocator state into config.
- [ ] Add resolved/effective runtime config vocabulary and comments that distinguish derived runtime state from authored source config.
- [ ] Rename, specialize, or clarify machine-local `LocalConfig` to avoid collision with Knop-local config.
- [ ] Keep or drop `ConfigFragment` deliberately, with examples either way.
- [ ] Update ontology comments to reject old booleans and regex mappings as first-pass contracts.

### Phase 2: Weave Config Discovery And Resolution Design

- [ ] Define the trusted bootstrap resolver profile and which sources can supply it.
- [ ] Define which portable resolver hints are legal and which are capped by trusted bootstrap policy.
- [ ] Define where Weave default config is loaded from and how it can be inspected in tests and diagnostics.
- [ ] Define config discovery order for `_mesh/_config`, `_knop/_local-config`, `_knop/_inheritable-config`, reusable config artifacts, machine-local operational config, and command-line overrides.
- [ ] Define effective-config merge and precedence rules.
- [ ] Define inheritance traversal rules for Knop hierarchy and submesh boundaries.
- [ ] Define validation rules for config policies, naming hints, reusable config targets, and unknown terms.
- [ ] Define cycle detection, maximum config reference depth, and cache/lock semantics for resolved config.
- [ ] Define how resolved runtime config can represent many meshes, submeshes, Knops, and artifacts.

### Phase 3: Runtime Implementation Slices

- [ ] Implement an internal effective-config model that can answer history policy and resource-page policy for a target artifact role.
- [ ] Wire history policy into the slim-support-artifact work from [[wd.task.2026.2026-05-05-optional-history-and-slim-support-artifacts-by-default]].
- [ ] Wire naming defaults and hints into payload versioning without bypassing current RDF validation.
- [ ] Wire resource-page generation policy into page planning separately from history policy.
- [ ] Keep path/URL trust policy integration aligned with [[wd.task.2026.2026-04-11_1723-operational-config-for-runtime-resolution]].

### Phase 4: Validation And Documentation

- [ ] Add ontology examples and tests for the revised vocabulary.
- [ ] Add Weave unit and integration tests for config resolution and policy application.
- [ ] Update related task notes and roadmap references to point at this grand synthesis task as the config umbrella.
- [ ] Update [[wd.codebase-overview]] when the resolver becomes a standard runtime seam.
- [ ] Update user-facing docs only after the CLI/runtime behavior is implemented.
