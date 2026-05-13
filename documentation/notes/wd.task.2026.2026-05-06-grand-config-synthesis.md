---
id: 0fq7qy19dmg9vqypoktfuax
title: 2026 05 06 Grand Config Synthesis
desc: ''
updated: 1778134118907
created: 1778128425390
---

## Goals

- Consolidate the current config-related design threads into one task that can guide an overhaul of `dependencies/github.com/semantic-flow/sflo/semantic-flow-config-ontology.ttl`.
- Preserve the useful current split between core ontology, config ontology, and implementation/runtime behavior.
- Reintroduce Knop-local and Knop-inheritable config as separate mesh-managed `DigitalArtifact`s, not just embedded blank-node config.
- Define config policy vocabulary for history tracking, resource page generation, presentation, naming defaults, and reusable config artifacts without falling back to broad booleans.
- Clarify the relationship between portable mesh/Knop-authored config, trusted operational/runtime config, config-resolution config, derived `ResolvedConfig`, and operation-specific effective config.
- Keep `sflo:nextHistoryOrdinal` and `sflo:nextStateOrdinal` in inventory/history RDF, not in config.
- Support reusable named config artifacts that can be referenced from many Knops, meshes, submeshes, and external meshes.
- Define `ConfigResolutionConfig` as the config-resolution layer that controls how config files and reusable config artifacts are discovered, ordered, trusted, merged, cached, and rejected.
- Externalize Weave's built-in/default behavior choices as named `ApplicationConfig` / `ConfigResolutionConfig` profile artifacts in a Weave-owned defaults mesh so defaults currently implicit in code or surfaced only through API/CLI options become inspectable and overrideable.
- Move mutable progression facts out of inventory and into `_mesh/_meta` / `_knop/_meta`, with a future option to split them into a more specific working-state artifact if `_meta` becomes semantically overloaded.
- Treat [[ont.task.2026.2026-05-03-enumeration-type-instances]] as a prerequisite for the config ontology overhaul so the many config policy values are introduced as flat underscore-separated individuals rather than new slash-style enum IRIs.
- Fold the actionable decisions from [[ont.task.2026.2026-03-23-config-modernization]], [[wd.task.2026.2026-04-08_1735-page-definition-ontology-and-config]], [[wd.task.2026.2026-04-11_1723-operational-config-for-runtime-resolution]], and [[wd.task.2026.2026-05-05-optional-history-and-slim-support-artifacts-by-default]] into a coherent next task.

## Summary

The config line needs a deliberate consolidation pass. The current active config ontology already contains a good substrate: `Config`, `ConfigArtifact`, `hasConfig`, `hasEffectiveConfig`, `OperationalConfig`, `MeshConfig`, local/remote access rules, and ResourcePage presentation template terms. The old `sflo-config-ontology.jsonld` contains useful lineage, especially named reusable `ConfigArtifact`s, template/style artifacts, and the old `generateResourcePages` / `createHistoricalStatesOnWeave` pressure. But the old ontology's `AbstractArtifact`, Flow/State framing, broad template mapping, regex targeting, and boolean switches should not be carried forward directly.

The synthesized direction is:

- portable authored config belongs in mesh-managed config artifacts such as `_mesh/_config`, `_mesh/_knop-inheritable-config`, `_knop/_local-config`, and `_knop/_inheritable-config`
- operational/runtime config supplies trusted runtime inputs and gates, such as host access policy and bootstrap resolver policy
- `ResolvedConfig` is derived resolver output, while effective config is the operation-specific runtime policy object derived from it
- reusable config is a first-class `ConfigArtifact` / `DigitalArtifact` with its own IRI, working file, optional history, and resource page policy
- config attachment and config resolution should use explicit target/reference vocabulary rather than path conventions alone
- `ConfigResolutionConfig` exists as a small bootstrap layer for config discovery and resolver policy
- a Weave default profile externalizes built-in behavior and config-resolution defaults before mesh config, Knop config, operational gates, API overrides, or CLI overrides are applied
- history tracking and resource page generation should be policy-valued, not booleans
- controlled policy values should use the flat underscore-separated enum-instance convention from [[ont.task.2026.2026-05-03-enumeration-type-instances]]
- artifact history allocator state remains in core inventory/history RDF

This task should supersede the older "replace local/inheritable config with mesh-scoped defaults only" direction from [[ont.task.2026.2026-03-23-config-modernization]]. Mesh-level defaults are still important, but they are not enough. Knops need two different config surfaces: config that applies locally to the Knop and its own artifacts, and config that the Knop offers to descendants.

## Discussion

### Source Task Scan

[[ont.task.2026.2026-05-03-enumeration-type-instances]] should be handled before the config ontology overhaul mints new policy values. Config will introduce many controlled vocabulary values: artifact roles, history policies, page-generation policies, naming policies, layer roles, reference policies, cache policies, cycle policies, and unknown-term policies. If the config overhaul lands first with slash-style values or unseparated flat camelCase values, it will immediately create another migration. The enum task does not need to finish every fixture rerung before config design can continue, but the naming convention and ontology-level enum migration should be settled first and config examples should use the flat underscore-separated convention from the start.

[[ont.task.2026.2026-03-23-config-modernization]] established the modern base: `Config` remains distinct from `DigitalArtifact`, `ConfigArtifact` can also be a `DigitalArtifact` / `RdfDocument`, explicit mesh/Knop config attachment is preferable to relying only on generic `hasConfig`, reusable config artifacts are valid, `hasEffectiveConfig` is a non-authoritative runtime/debug view, and the old Flow/State configuration model should be dropped. Its "old `LocalConfig` / `InheritableConfig` split should probably be replaced by mesh-scoped defaults plus explicit knop overrides" is now superseded by this task: mesh defaults are useful, but not a replacement for `_knop/_local-config` and `_knop/_inheritable-config`.

[[wd.task.2026.2026-04-08_1735-page-definition-ontology-and-config]] established that page content composition belongs in core, while template/chrome/presentation preferences belong in config. It also established that templates and stylesheets should be first-class artifacts and that the old regex-heavy template mapping machinery should not be copied forward. The page-definition work also keeps `targetLocalRelativePath`, `targetAccessUrl`, `workingLocalRelativePath`, and `workingAccessUrl` out of presentation config and leaves access policy to operational config.

[[wd.task.2026.2026-04-11_1723-operational-config-for-runtime-resolution]] established operational config as a first-class runtime concern for CLI, daemon, and other execution surfaces. It distinguishes mesh-carried expectations from machine-local trust policy and uses deny-by-default local/remote access allow rules. This task keeps that split and adds `ResolvedConfig` for the resolver's derived behavior policy. `ResolvedConfig` may include history, page generation, presentation, naming, and the trust gates that were applied during resolution, but it is derived output rather than the operational input itself.

[[wd.task.2026.2026-05-05-optional-history-and-slim-support-artifacts-by-default]] established the need for policy-valued history tracking and page-generation control. Payloads keep history by default. Low-value support surfaces should be slim by default in their history behavior, but current ResourcePages should still be generated by default so artifacts are dereferenceable unless a config explicitly suppresses or defers a page. Inventory should not keep history by default; `_mesh/_inventory` and `_knop/_inventory` should be current-only unless explicitly configured otherwise. The current Weave planner still reads `_mesh/_inventory` and `_knop/_inventory` history/progression facts to decide the next weave, so the runtime migration needs to move those mutable current/progression facts into `_mesh/_meta` and `_knop/_meta` before the default inventory policy can be applied without fixture churn. Historical page regeneration should be driven by explicit page/render manifests, pinned source states, output durability, checkpoints, or source-state bundles rather than stale mutable current pointers in old inventory snapshots.

### Authored Config Layers

The authored portable config layers should be explicit:

- `_mesh/_config`: mesh-level config for the mesh surface and defaults that apply across the mesh
- `_mesh/_knop-inheritable-config`: mesh-level defaults the mesh offers into Knop inheritance inside the mesh boundary
- `_knop/_local-config`: local config for the Knop, its resource page, and artifacts governed at that Knop
- `_knop/_inheritable-config`: defaults the Knop offers to descendant Knops and subtrees
- reusable named config artifacts: ordinary named `ConfigArtifact` resources that may live anywhere in a mesh, such as `alice/alices-favorite-sf-config-setting`, and may be referenced by mesh, Knop, local, or inheritable config

`_knop/_local-config` and `_knop/_inheritable-config` should be separate `DigitalArtifact`s because they have different semantics, lifecycle, history policy, and attachment behavior. The preferred default is to version them and generate current ResourcePages for dereferenceability; meshes can still opt specific config artifacts or historical support pages into suppressed, deferred, current-only, checkpoint-only, or metadata-only policy.

Do not model every authored config layer as a disjoint class. A config artifact can cross layer boundaries: the same reusable artifact might be referenced as a mesh default in one place, a Knop-local override in another, and an inherited policy fragment somewhere else. The durable semantics should come from attachment properties, `ConfigLayerRole` values, and resolution context. Layer-specific classes are optional conveniences only when they add validation value without preventing reuse.

`KnopConfig` is a useful optional scope marker for a portable config artifact attached to a Knop. That is separate from the active ontology's machine/user-local `LocalConfig` meaning, which should be renamed or specialized toward host-local operational config. Knop-local versus Knop-inheritable behavior should be expressed by attachment properties or layer roles.

Inheritable config should be an attachment/layer role rather than a single class. A mesh can attach inheritable defaults for Knop scopes inside the mesh through the canonical support artifact `_mesh/_knop-inheritable-config`, and a Knop can attach inheritable defaults for descendant Knops. The source artifact may still just be a `ConfigArtifact`, optionally also a `MeshConfig` or `KnopConfig` when that marker helps validation.

### Operational Config And Effective Config

Operational/runtime config is a trusted runtime input. It should cover:

- host/runtime trust policy, such as local path and remote URL access
- bootstrap resolver policy, such as which config roots are allowed, whether portable resolver hints are honored, and whether external config references may be followed
- machine-local, workspace-local, daemon, CLI, or API runtime settings that gate resolution before portable mesh config participates

The CLI should support two operational modes:

- stand-alone mode: each invocation loads trusted defaults, operational config, mesh config, and requested scopes from disk, then recomputes `ResolvedConfig` and derives the operation's effective config
- service-backed mode: the CLI delegates to a long-running service that can keep watchers, scoped `ResolvedConfig` caches, and config-resolution diagnostics warm across invocations

Stand-alone mode may still read a persistent diagnostic cache, but only after validating source fingerprints, resolver/profile digests, and trust-policy identity. It should not rely on a previous process's watcher state. Service-backed mode can use file watchers and cached scoped `ResolvedConfig` as its normal fast path, while still tying correctness to explicit source fingerprints and invalidation records.

Operational config may be stored in more than one location:

- mesh-root-local operational config, for example under the mesh's `_mesh/_config` or another explicitly discovered mesh-local support path
- workspace-local operational config outside the mesh root but inside the active workspace checkout
- user/machine-local operational config outside the workspace, such as a user config directory or an explicit CLI-provided config file path
- daemon/session operational config managed by a long-running runtime

Operational config files may use relative paths for mesh roots, workspace roots, and referenced config files. Relative paths should resolve against the config file that declares them unless the RDF explicitly names a base such as mesh root, workspace root, user home, or absolute path. This keeps portable workspace config useful without forcing absolute host paths into repo-carried files.

Trust depends on where the operational config comes from. Mesh-root-local and workspace-local operational config may declare local project expectations and may point at local config files within the mesh or workspace boundary. It may narrow behavior and describe project-local source allowances, but it must not grant access outside that boundary or enable remote/external config loading by itself. Broader filesystem access, user-home access, remote access, or current-following external config references require higher-trust user/machine-local, daemon, or explicit runtime config. In other words: in-mesh and in-workspace operational config can request local project config; it cannot appoint itself as host-trust authority.

`ResolvedConfig` should be the ontology name for persisted or inspectable derived resolver output. It records what the config resolver produced for a scope after Weave defaults, operational gates, config-resolution policy, authored mesh config, inherited Knop config, local Knop config, reusable config artifacts, and validated request-level config inputs have been applied.

Use "effective config" as the runtime concept for the actual policy object an application operation uses. In many operations, the effective config will simply be the resolved config. But keeping the names separate leaves room for the application to derive an operation-specific effective config by applying execution context, feature flags, emergency caps, or other non-portable overlays that should not be mistaken for the resolver's stable output.

Do not collapse operational config into `ResolvedConfig` or effective config. Operational config is an input and trust gate. `ResolvedConfig` is derived resolver output. Effective config is the active in-memory result used by an operation. If `ResolvedConfig` or effective config is persisted for diagnostics or daemon state, it should carry enough metadata to make clear that it is derived runtime state, not authored source data.

`hasEffectiveConfig` should remain non-authoritative when asserted in mesh RDF. It is useful for runtime/debug output and legacy continuity, but portable authored mesh config must not become authoritative merely by asserting what its own effective config is. New vocabulary should prefer `hasResolvedConfig` / `hasResolvedConfigFor` for derived resolver output and reserve "effective" wording for the runtime view actually used by an operation.

The active resolved/effective config model may cover many scopes:

- multiple mesh roots in one daemon process
- submeshes
- Knops and descendant Knop scopes
- artifact roles such as payload, metadata, inventory, config, page definition, reference catalog, and assets
- specific artifacts
- page generation and presentation layers
- applied access-policy decisions for diagnostics, without turning effective config into a portable source of trust

### Weave Default Profile

Weave needs a default profile: an explicit representation of choices that are currently implicit in TypeScript defaults, CLI defaults, API request defaults, renderer defaults, planner defaults, and fixture-shaped assumptions.

This layer should answer: "What would Weave do if no mesh, Knop, artifact, runtime, API, or CLI override said otherwise?"

Use `ApplicationConfig` for the broad application behavior class. Do not define `WeaveDefaultConfig` as a class. The concrete Weave default should be a named profile artifact or bundle, not a new class: an instance of existing config classes such as `ApplicationConfig`, `ConfigArtifact`, and, for resolver defaults, `ConfigResolutionConfig`.

The Weave default profile should include or point to a baseline `ConfigResolutionConfig`. That does not make portable mesh config authoritative over resolver trust. It means Weave's own trusted default bundle declares both behavior defaults and resolver defaults before machine-local operational config, mesh config, reusable config, request fields, and CLI overrides participate.

The canonical Weave default artifacts should live in a Weave-owned defaults mesh that is separate from the `sflo`/ontology mesh. This keeps implementation defaults out of the ontology namespace while still making them dereferenceable, versionable, and reusable as ordinary Semantic Flow artifacts. The Weave repo can carry the source TTL files, and runtime code may embed or bundle the parsed defaults for packaging, but the source of truth should be inspectable RDF in that defaults mesh, not a private TypeScript object.

Some defaults are platform-level Semantic Flow expectations rather than Weave-only choices. Those should live in the sflo/framework layer as shared profiles or specs if they are meant to be consistent across implementations. Weave can then import or mirror that platform profile and add implementation-specific defaults.

The default behavior config should include defaults such as:

- default history policy is current-only unless an artifact role or artifact-specific policy says otherwise
- payload artifacts are versioned by default
- portable authored config artifacts are versioned by default and get current ResourcePages by default unless explicitly suppressed or deferred
- `_mesh/_inventory` and `_knop/_inventory` are current-only by default unless a mesh explicitly opts inventory into history
- `_mesh/_meta` and `_knop/_meta` own mutable current/progression facts and may be current-only or slim-history by default
- current ResourcePages are generated by default for artifacts
- support artifact history pages may be suppressed or deferred by explicit policy even when the support artifact itself is versioned
- default history segment strategy is ordinal
- default state segment strategy is ordinal
- default manifestation segment strategy is filename/content-kind derived unless explicitly configured
- page renderer/presentation defaults when no `ResourcePagePresentationConfig` is present
- default config resolution profile, represented by or linked to the Weave default `ConfigResolutionConfig`, including fail-closed behavior for unknown terms and config cycles

This is not the same as resolved runtime config. The Weave default profile is an input layer. Resolved runtime config is the result after application defaults, operational resolver policy, mesh config, inherited Knop config, local Knop config, reusable config artifacts, API request fields, and CLI overrides have been applied and validated.

This is also not the same as portable mesh config. A mesh may override or narrow application defaults, but the defaults themselves should be inspectable independently of any mesh. For testing, the default config should be loadable as a fixture or embedded RDF artifact so test expectations can point at a declared default instead of reverse-engineering behavior from code.

The practical implementation should keep TTL files as the source of truth and then parse, validate, or generate internal typed objects from them:

```turtle
@prefix sfcfg: <https://semantic-flow.github.io/ontology/config/> .

<> a sfcfg:ApplicationConfig ;
  sfcfg:hasConfigResolutionConfig <config-resolution/default> ;
  sfcfg:hasDefaultHistoryTrackingPolicy sfcfg:historyTrackingPolicy_currentOnly ;
  sfcfg:hasDefaultResourcePageGenerationPolicy sfcfg:resourcePageGenerationPolicy_generate ;
  sfcfg:hasHistoryTrackingDefault [
    a sfcfg:ArtifactRolePolicy ;
    sfcfg:hasArtifactRole sfcfg:artifactRole_payload ;
    sfcfg:hasHistoryTrackingPolicy sfcfg:historyTrackingPolicy_versioned
  ], [
    a sfcfg:ArtifactRolePolicy ;
    sfcfg:hasArtifactRole sfcfg:artifactRole_meshInventory ;
    sfcfg:hasHistoryTrackingPolicy sfcfg:historyTrackingPolicy_currentOnly
  ], [
    a sfcfg:ArtifactRolePolicy ;
    sfcfg:hasArtifactRole sfcfg:artifactRole_knopInventory ;
    sfcfg:hasHistoryTrackingPolicy sfcfg:historyTrackingPolicy_currentOnly
  ], [
    a sfcfg:ArtifactRolePolicy ;
    sfcfg:hasArtifactRole sfcfg:artifactRole_knopMetadata ;
    sfcfg:hasHistoryTrackingPolicy sfcfg:historyTrackingPolicy_currentOnly
  ] .
```

Model all stable current defaults that affect repeatable behavior, persisted mesh RDF, generated pages, artifact resolution, or validation. Do not model every CLI/API field as config merely because the current command surface has a default. Some fields are operation requests, safety controls, diagnostic controls, or execution context rather than reusable policy. CLI/API fields can override config at runtime, but should not be the only durable way to express repeatable policy.

Immediate default-config candidates include:

- artifact-role history policies
- resource page generation policies
- naming and segment strategy defaults
- default artifact-resolution mode and fallback behavior where an operation currently chooses one implicitly
- extraction-source resolution defaults
- page presentation/template/style defaults
- config-resolution defaults such as unknown-term policy, cycle policy, reference policy, and `ResolvedConfig` cache policy
- validation strictness that materially changes accepted mesh/config RDF

Request-only or operational-only inputs include:

- explicit operation targets, designator paths, source paths, payload paths, source states, requested history/state names, and input bytes
- `--accept-preview`, `--yes`, `--force`, `--dry-run`, write/commit/push choices, and other safety controls
- terminal output format, logging verbosity, progress display, and diagnostic verbosity
- mesh root, workspace root, explicit config file path, process environment, and daemon/session selection
- host filesystem or network access grants, which belong in trusted operational config rather than portable mesh config
- transient timeout, retry, concurrency, or cache-location choices unless later promoted to stable runtime policy

Concrete current CLI/API fields that stay request-only or operational-only include:

- `--mesh-root`, `--workspace`, and any explicit config-file path because they select runtime context rather than mesh behavior
- positional `source` arguments, positional `designatorPath` arguments, `--designator-path`, `--target`, `--source`, `--source-state`, and `--reference-target-designator-path` because they identify this operation's inputs or targets
- `--payload-history-segment`, `--payload-state-segment`, `--payload-manifestation-segment`, and `--mesh-base` because they are explicit creation/versioning requests; config may supply naming defaults and hints, but the command's concrete value is still an operation override
- `--grant-source-directory` because it changes local access policy and must be treated as trusted operational configuration, not portable mesh behavior config
- `--reference-role` because it is the semantic content of one requested reference, not a reusable default unless a later task introduces an explicit reference-default policy
- `--all-terms` because it selects a batch operation shape, not a standing policy
- `--accept-preview`, `--interactive`, and `--no-nojekyll` because they are safety, UX, or publishing-environment controls
- `--include-semantic-flow-metadata` until the page-presentation model carries that as an explicit resource-page presentation policy

Phase 0 should include an inventory of current implicit defaults in code, API defaults, CLI defaults, page planning, history planning, and fixture assumptions. Each default should be classified as one of:

- Weave default behavior config: stable behavior preference or default policy
- operational config: trusted runtime input or host access gate
- explicit operation request: one-shot target, input, or command intent
- derived `ResolvedConfig` / effective config: runtime output only, not authored input

### Current Implementation Default Inventory

Current Weave code still carries several fixture-shaped defaults that should become explicit config, operational config, or request data as the resolver lands. This inventory is intentionally descriptive rather than normative; it documents what the code currently does so the first resolver slice can avoid changing behavior accidentally.

Weave default behavior config candidates:

- `defaults/application.ttl` is now the source RDF for the intended default profile: default history is current-only, payload and config artifacts are versioned, mesh and Knop inventory are current-only, runtime meta is current-only, current ResourcePages are generated by default, historical page regeneration defaults to config-at-the-time, history/state naming defaults to ordinal, and manifestation naming defaults to filename-derived.
- The runtime currently materializes current and historical ResourcePages for many support artifacts, including `_mesh/_meta`, `_mesh/_inventory`, `_mesh/_config`, `_knop/_meta`, `_knop/_inventory`, references, page definitions, histories, states, and manifestations. Current-page generation matches the default dereferenceability goal; historical support pages still need explicit resolver policy so history/backfill behavior is no longer fixture-shaped.
- Payload versioning defaults to `_history001` and `_s0001` for first history/state and then reads `sflo:nextStateOrdinal` from artifact/history RDF for later states. A provided manifestation segment overrides the filename-derived manifestation segment for that invocation.
- `mesh create` includes `.nojekyll` by default only when the mesh base host is `github.io` or ends with `.github.io`. That is a publishing-environment default, not portable mesh behavior.
- ResourcePage rendering defaults to the built-in theme, hides the generated Semantic Flow metadata section unless requested, truncates long history lists with a fixed head/tail policy, and inlines raw source panels only under the current byte limit.
- Current fixture expectations assume support artifacts are historical and include historical pages. Those history/backfill expectations are migration targets, not policy targets; fixture regeneration should wait until the resolver and inheritance semantics are stable.

Operational config and trusted runtime inputs:

- CLI `--mesh-root` defaults to the current directory and selects the runtime context. It is not portable config.
- Workspace root inference is currently operational: `_mesh/_config/config.ttl` may carry `sfcfg:workspaceRootRelativeToMeshRoot`, and `loadOperationalLocalPathPolicy` treats it as project-local layout inside the active trust boundary.
- Local path access is deny-by-default outside the mesh root. Mesh-carried rules, user/machine-local `.sf-local-access.ttl`, and the current `--grant-source-directory` flow are operational access policy, not portable behavior defaults.
- Mesh-carried path rules may describe project-local workspace access but cannot grant arbitrary host traversal; broader access such as user-home or absolute-path allowances requires higher-trust local config.
- CLI/runtime logging currently writes under the inferred workspace `.weave/logs` directory and marks commands as `localMode: true`. Log location and local/service mode are operational runtime state.

Explicit operation requests:

- Positional designator paths, `--target`, `--source`, `--source-state`, `--reference-role`, `--all-terms`, `--payload-history-segment`, `--payload-state-segment`, `--payload-manifestation-segment`, and `--mesh-base` describe one operation's subject, source, semantic payload, or requested names.
- `--accept-preview`, interactive confirmations, `--no-nojekyll`, and future force/dry-run-style controls are safety or publishing-environment request controls.
- `--include-semantic-flow-metadata` is currently a request flag. It may later become a ResourcePage presentation policy, but until the presentation model is ready it remains request-only.

Derived runtime output:

- `ValidateResult`, `VersionPlan`, `GenerateResult`, `WeaveResult`, resolved local file paths, ResourcePage render models, extracted-source resolution, computed next paths, and generated audit/operational log records are derived output.
- A future `ResolvedConfig` may record the policy decisions behind those outputs, but the generated outputs themselves must not become authored source config or trust-granting input.

### Meta-Config And The Bootstrap Problem

We need config about how config is resolved, but that introduces a bootstrap problem: if ordinary config can decide which config sources are trusted, then untrusted config can grant itself authority.

The way out is a small config-resolution layer named `ConfigResolutionConfig` rather than a vague `MetaConfig`. This layer configures the resolver itself:

- which config layers are discovered
- which config sources are allowed
- which reusable config targets may be followed
- whether current-following external config references are allowed
- merge and precedence profile
- inheritance traversal profile
- unknown-term behavior
- cycle behavior
- cache/lock behavior for `ResolvedConfig`
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

Portable mesh config may declare expectations and narrow behavior inside the trust boundary already granted by the runtime:

- expected config artifacts and their roles
- mesh-local and Knop-local/inheritable config attachments
- reusable config references that are already resolvable under trusted local/remote access policy
- stricter policies such as pinned-only references, lower max reference depth, rejecting unknown terms, rejecting cycles, or suppressing current-following references
- inheritance and merge preferences for portable behavior config, subject to trusted resolver caps
- preferred layer roles for mesh-authored config, as hints rather than authority over runtime trust

Trusted bootstrap or machine-local operational config must control decisions that can broaden authority or alter the host trust boundary:

- which config roots are discovered before portable config is read
- whether portable resolver hints are honored at all
- local path and remote URL access allow rules
- whether external reusable config references may be followed
- whether current-following external config references are allowed
- maximum reference depth and cycle behavior caps
- cache/lock locations outside the mesh and whether persistent diagnostic caches are written
- which machine-local, workspace-local, daemon, or explicit runtime config files participate
- whether unknown policy terms are tolerated in trusted/runtime config

Workspace-local operational config sits in the middle: trusted enough to describe local project layout, but not trusted enough to expand host access beyond the workspace unless a higher-trust policy permits that expansion. Runtime discovery should therefore distinguish `configLayerRole_workspaceOperational` from `configLayerRole_machineLocalOperational` rather than merging them into a single "local config" bucket.

When portable config and trusted resolver policy conflict, the runtime should fail closed or apply the stricter policy. Portable config can make resolution narrower; it cannot make the runtime trust more.

### Config Resolution Layers

The resolver should reason over explicit layers rather than an implicit pile of Turtle files.

Candidate `ConfigLayerRole` controlled values:

- `configLayerRole_builtInDefaults`
- `configLayerRole_weaveDefaults`
- `configLayerRole_commandOverride`
- `configLayerRole_machineLocalOperational`
- `configLayerRole_workspaceOperational`
- `configLayerRole_meshLocal`
- `configLayerRole_meshInheritable`
- `configLayerRole_knopInherited`
- `configLayerRole_knopLocal`
- `configLayerRole_knopInheritable`
- `configLayerRole_reusableConfig`
- `configLayerRole_resolvedRuntime`

Use `configLayerRole_knopInheritable` for the authored config source attached to a parent Knop. Use `configLayerRole_knopInherited` or a similar resolved-layer role for that same source after it is projected into a descendant scope's effective config. The exact values can be adjusted, but authored inheritance and inherited effective input should not be collapsed accidentally.

The exact order should be a configured `ConfigPrecedenceProfile`, not baked into comments. A default profile can say:

- implementation-internal emergency defaults are weakest
- Weave default profile is the normal declared baseline
- mesh and ancestor inheritable defaults override application defaults
- reusable config applies at the point where it is referenced
- Knop local config overrides inherited config for that Knop
- command/request overrides are strongest, but still validated against policy
- machine-local operational trust policy is not a normal behavior override; it gates what can be read or fetched

That last point matters. Access policy is not merely another setting to merge. It controls which sources may be loaded. Behavior config can be inherited and overridden. Trust policy must gate resolution before behavior config can participate.

Layer ordering should be mostly implementation/profile data rather than hard-coded ontology law. The config ontology should define the vocabulary needed to express and validate a precedence profile: `ConfigLayer`, `ConfigLayerRole`, `ConfigPrecedenceProfile`, ordering properties such as `layerOrder` or explicit before/after relations, merge-profile links, and comments for security invariants. It should not prescribe Weave's full concrete order as the only valid Semantic Flow order.

The ontology should carry a small number of normative invariants:

- trust-gating layers are evaluated before untrusted portable config can affect discovery
- portable mesh config cannot grant broader host filesystem or network access
- stricter trusted resolver policy wins over looser portable hints
- request/CLI overrides can override behavior policy for one operation, but still cannot bypass validation or host-trust gates
- `ResolvedConfig` and effective config are outputs from resolution/application, not input layers that can recursively authorize themselves

Concrete ordering, numeric `layerOrder` values, and supported precedence profiles belong in Weave's default profile and in any future implementation profile artifacts. Shared cross-implementation profiles can be published as profile artifacts if they become useful, but the ontology should provide the grammar for those profiles rather than freezing a single resolver stack.

A single global precedence order is not enough for every property. The `ConfigPrecedenceProfile` should define the candidate layer sequence, while `ConfigMergeProfile` or property-family rules define how values combine or conflict. Examples:

- Host trust gates: trusted operational config is not a normal behavior override. If machine-local policy disallows remote config references and mesh config requests them, the result is disallowed. If machine-local config allows only the workspace and workspace-local config points at a project-local config file, the file can participate only inside that boundary.
- Resolver safety caps: stricter policy wins. If Weave defaults allow reference depth 8, machine-local operational config caps it at 4, and portable mesh config requests 12, the result is 4. If mesh config asks to reject unknown terms while defaults merely warn, the stricter rejection can apply.
- Scope-specific behavior defaults: nearest applicable scope wins after trust gates. For resource page presentation, a Knop-local template can override a mesh default template for that Knop, while an artifact-specific presentation policy can override both. A parent Knop's inheritable stylesheet can provide a fallback for descendants that do not specify their own.
- Required invariants: required or fail-closed policies can dominate ordinary overrides. If an artifact role is marked required by the current implementation but mesh config asks for current-only history, the resolver should either keep the required policy or fail closed rather than silently weakening that invariant.
- Operation request fields: explicit command/API fields select what this invocation is asking Weave to do, including targets, source bindings, concrete requested names, and backfill/generation requests. They are not durable config, but they can narrow or specialize a single operation. A `--target` can narrow the operation even if config defaults describe all Knops. A requested payload state segment can override a naming default or hint when it is legal for the current artifact history; Weave should warn when the request overrides a resolved config hint.
- Additive values: some properties merge by union or append rather than winner-takes-all. Page support assets, diagnostic tags, or local presentation affordances may accumulate across mesh and inherited Knop config, subject to deduplication and explicit remove/block rules.
- Reusable config references: reusable config is merged where it is referenced, not at one universal global layer. A reusable presentation profile referenced from mesh config behaves like mesh config; the same profile referenced from Knop-local config behaves like Knop-local config.

Segment request examples:

- Config says `sfcfg:hasNextStateSegmentHint "v0.2.0"` and the operator runs `weave version --payload-state-segment v0.3.0`. Use `v0.3.0` if it is a valid unused state segment for the artifact history, and warn that the command request overrode the config hint.
- Config says `sfcfg:hasStateNamingPolicy sfcfg:stateNamingPolicy_semver` and the operator runs `weave version --payload-state-segment v0.3.0`. Use it without a conflict warning because the request satisfies the naming policy, though it may still warn if it differs from a next-segment hint.
- Config says `sfcfg:hasStateNamingPolicy sfcfg:stateNamingPolicy_semver` and the operator runs `weave version --payload-state-segment release-candidate`. Fail unless the operation carries an explicit policy-override acknowledgement and the trusted resolver profile says this naming policy is overrideable. Even then, the requested segment still must pass core artifact/history validation.
- Config or implementation policy says a support artifact's history is required. A command request cannot override that by asking for current-only history; this is a required invariant, not a soft naming hint.

This means operation request fields sit above defaults and hints, but below hard invariants and trust gates. If a policy is meant to be strict but overrideable, the config vocabulary should be able to say so explicitly. A future CLI flag might acknowledge that override for one operation, but the exact spelling should be decided with the CLI design rather than baked into the ontology examples.

### Candidate Meta-Config Vocabulary

Candidate classes:

- `ConfigResolutionConfig`
- `ConfigResolutionRecord`
- `ResolvedConfig`
- `ConfigLayer`
- `ConfigLayerRole`
- `ConfigPrecedenceProfile`
- `ConfigMergeProfile`
- `ConfigReferencePolicy`
- `ConfigInheritancePolicy`
- `OperationRequestOverridePolicy`
- `ConfigCyclePolicy`
- `UnknownConfigTermPolicy`
- `ResolvedConfigCachePolicy`

Candidate properties:

- `hasConfigLayer`
- `hasConfigLayerRole`
- `hasConfigSource`
- `hasConfigPrecedenceProfile`
- `hasConfigMergeProfile`
- `hasConfigReferencePolicy`
- `hasConfigInheritancePolicy`
- `hasOperationRequestOverridePolicy`
- `hasConfigCyclePolicy`
- `hasUnknownConfigTermPolicy`
- `hasResolvedConfigCachePolicy`
- `allowsPortableResolverHints`
- `maxConfigReferenceDepth`
- `hasConfigRoot`
- `hasConfigScope`
- `hasResolvedConfig`
- `hasResolvedConfigFor`
- `resolvedFromConfig`
- `resolvedAt`
- `hasConfigSourceFingerprint`
- `hasResolvedConfigDigest`
- `hasConfigResolutionRecord`
- `hasContentDigest`
- `expectsContentDigest`

Candidate controlled values:

- `unknownConfigTermPolicy_reject`
- `unknownConfigTermPolicy_ignore`
- `unknownConfigTermPolicy_warn`
- `configCyclePolicy_reject`
- `configCyclePolicy_useFirstSeen`
- `configReferencePolicy_noExternalReferences`
- `configReferencePolicy_pinnedOnly`
- `configReferencePolicy_currentAllowedWithinTrustedBoundary`
- `operationRequestOverridePolicy_warnAndApply`
- `operationRequestOverridePolicy_rejectConflict`
- `operationRequestOverridePolicy_requireExplicitAcknowledgement`
- `configInheritancePolicy_acceptAndPropagate`
- `configInheritancePolicy_acceptDoNotPropagate`
- `configInheritancePolicy_blockInherited`
- `configInheritancePolicy_offerDescendantsOnly`
- `configInheritancePolicy_offerSelfAndDescendants`
- `resolvedConfigCachePolicy_noCache`
- `resolvedConfigCachePolicy_cacheForProcess`
- `resolvedConfigCachePolicy_persistDiagnosticCache`

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
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<> a sfcfg:ConfigResolutionConfig ;
  sfcfg:hasUnknownConfigTermPolicy sfcfg:unknownConfigTermPolicy_reject ;
  sfcfg:hasConfigCyclePolicy sfcfg:configCyclePolicy_reject ;
  sfcfg:hasConfigReferencePolicy sfcfg:configReferencePolicy_pinnedOnly ;
  sfcfg:hasResolvedConfigCachePolicy sfcfg:resolvedConfigCachePolicy_cacheForProcess ;
  sfcfg:maxConfigReferenceDepth "8"^^xsd:nonNegativeInteger ;
  sfcfg:hasConfigLayer [
    a sfcfg:ConfigLayer ;
    sfcfg:hasConfigLayerRole sfcfg:configLayerRole_builtInDefaults ;
    sfcfg:layerOrder "10"^^xsd:nonNegativeInteger
  ], [
    a sfcfg:ConfigLayer ;
    sfcfg:hasConfigLayerRole sfcfg:configLayerRole_meshLocal ;
    sfcfg:hasConfigSource [
      a sflo:ArtifactResolutionTarget ;
      sflo:hasTargetArtifact <_mesh/_config> ;
      sflo:hasArtifactResolutionMode sflo:artifactResolutionMode_current
    ] ;
    sfcfg:layerOrder "40"^^xsd:nonNegativeInteger
  ], [
    a sfcfg:ConfigLayer ;
    sfcfg:hasConfigLayerRole sfcfg:configLayerRole_knopLocal ;
    sfcfg:layerOrder "80"^^xsd:nonNegativeInteger
  ] .
```

If a project wants a reusable config:

```turtle
<alice/_knop> sfcfg:hasKnopLocalConfigSource [
  a sflo:ArtifactResolutionTarget ;
  sflo:hasTargetArtifact <alice/alices-favorite-sf-config-setting> ;
  sflo:hasArtifactResolutionMode sflo:artifactResolutionMode_pinned ;
  sflo:hasRequestedTargetState <alice/alices-favorite-sf-config-setting/_history001/_s0003> ;
  sflo:expectsContentDigest "sha256:8f3c..."
] .
```

The resolver config decides whether that source may be followed, how it is merged, and whether the target must be pinned.

Pinned or external config sources should carry a content digest when the runtime can know one. That applies especially to `sflo:ArtifactResolutionTarget` values that name an external target, a `sflo:LocatedFile`, or a pinned historical state whose bytes may be served from mutable infrastructure. The digest lets Weave detect that a supposedly pinned source has changed, reject stale caches, and warn about remote or local filesystem drift.

The first-pass vocabulary should include at least:

- `sflo:hasContentDigest`: a property for byte-bearing resources such as `LocatedFile`, `ArtifactManifestation`, and possibly `HistoricalState` when the state has a canonical byte representation
- `sflo:expectsContentDigest`: a property on `ArtifactResolutionTarget` for the digest expected after resolution

The literal form should include the algorithm, such as `sha256:<hex>`, so it remains algorithm-agile without requiring a full digest object immediately. If later needs justify richer metadata, this can evolve into a `ContentDigest` node with algorithm, value, canonicalization profile, byte length, and computed-at time. For RDF graph artifacts, the digest should name the byte stream or canonicalization profile being hashed, because Turtle serialization bytes and RDF graph meaning are not the same thing.

Digest lifecycle should distinguish authoring from verification:

- At target creation or pinning time, Weave should compute and store the expected digest when it can read the target bytes under current trust policy. This is the normal path for pinned targets, local `LocatedFile` targets, and external targets fetched during an explicit trusted operation.
- If the runtime cannot read the target at creation time, the authoring API may accept a user-supplied expected digest. If policy requires digests and neither computed nor supplied digest is available, target creation should fail or leave the target unresolved according to policy rather than silently creating a weak pin.
- At weave/config-resolution time, Weave should verify fetched or loaded bytes against the expected digest before using them. A mismatch is a resolution failure by default for pinned config sources and at least a warning/fail-closed policy decision for current-following sources.
- For current-following sources, Weave may record the observed digest in `ConfigResolutionRecord` and cache keys without treating it as a stable expected digest on the authored target.
- When a target is intentionally repinned or modified, Weave should recompute the expected digest from the newly resolved bytes or require the operator/API caller to supply the new digest.

The current CLI/API surface only exposes one concrete resolution-target maintenance flow: extraction source creation and update through `weave extract --source`, `weave extract --source-state`, and `weave set extraction-source`. There is not yet a generic command for authoring config-source resolution targets. The config implementation should define that surface rather than assuming operators will hand-edit RDF forever, but the complete operator-facing command set can follow after the first fixture-visible config pass. A future surface could be shaped like `weave config source add|set|pin|unpin|remove`, with options for target artifact, target state, located file or URL, current versus pinned mode, fallback policy, and optional `--expected-digest`; when omitted, the digest should be computed from resolved bytes during the trusted authoring operation.

First-pass config-source target management should use the existing `sflo:ArtifactResolutionTarget` contract directly. `weave config source add` creates a new target attached through the requested role-specific property such as `sfcfg:hasMeshConfigSource`, `sfcfg:hasKnopLocalConfigSource`, or `sfcfg:hasKnopInheritableConfigSource`. `set` replaces the attachment for that role/scope, `pin` converts an existing current-following target to a pinned target by recording the resolved state and expected digest, `unpin` removes the requested state and expected digest only when trusted resolver policy allows current-following config, and `remove` deletes the attachment while leaving the reusable `ConfigArtifact` itself untouched. Authoring commands must resolve paths relative to the declaring config file unless an explicit base is modeled, must reject external/current-following targets unless trusted operational config allows them, and must fail when a policy-required digest cannot be computed or explicitly supplied.

### First-Pass Example Bundle

These examples are Weave developer-note implementation sketches for now. They are not yet normative `sflo` examples, and they are not broader Semantic Flow Framework tutorial examples. Once the resolver names and fixture-visible behavior settle, compact normative examples should move into the `sflo` ontology repo, while scenario meshes such as `mesh-sidecar-fantasy-rules` and `mesh-alice-bio` should stay with the framework/examples material.

Mesh config and mesh-inheritable config source attachments:

```turtle
@base <https://example.test/mesh/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@prefix sfcfg: <https://semantic-flow.github.io/ontology/config/> .

<_mesh> a sflo:SemanticMesh ;
  sfcfg:hasMeshConfigSource [
    a sflo:ArtifactResolutionTarget ;
    sflo:hasTargetArtifact <_mesh/_config> ;
    sflo:hasArtifactResolutionMode sflo:artifactResolutionMode_current
  ] ;
  sfcfg:hasMeshInheritableConfigSource [
    a sflo:ArtifactResolutionTarget ;
    sflo:hasTargetArtifact <_mesh/_knop-inheritable-config> ;
    sflo:hasArtifactResolutionMode sflo:artifactResolutionMode_pinned ;
    sflo:hasRequestedTargetState <_mesh/_knop-inheritable-config/_history001/_s0003> ;
    sflo:expectsContentDigest "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  ] .

<_mesh/_config> a sfcfg:MeshConfig, sfcfg:ConfigArtifact, sflo:DigitalArtifact, sflo:RdfDocument .

<_mesh/_knop-inheritable-config> a sfcfg:MeshConfig, sfcfg:ConfigArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sfcfg:hasDefaultResourcePageGenerationPolicy sfcfg:resourcePageGenerationPolicy_generate .
```

Knop-local config, Knop-inheritable config, and reusable config imported at the attachment point:

```turtle
@base <https://example.test/mesh/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@prefix sfcfg: <https://semantic-flow.github.io/ontology/config/> .

<alice/_knop> a sflo:Knop ;
  sfcfg:hasKnopLocalConfigSource [
    a sflo:ArtifactResolutionTarget ;
    sflo:hasTargetArtifact <alice/_knop/_local-config> ;
    sflo:hasArtifactResolutionMode sflo:artifactResolutionMode_current
  ] ;
  sfcfg:hasKnopInheritableConfigSource [
    a sflo:ArtifactResolutionTarget ;
    sflo:hasTargetArtifact <alice/_knop/_inheritable-config> ;
    sflo:hasArtifactResolutionMode sflo:artifactResolutionMode_current
  ] .

<alice/_knop/_local-config> a sfcfg:KnopConfig, sfcfg:ConfigArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sfcfg:hasConfigSource [
    a sflo:ArtifactResolutionTarget ;
    sflo:hasTargetArtifact <profiles/presentation-slim> ;
    sflo:hasArtifactResolutionMode sflo:artifactResolutionMode_pinned ;
    sflo:hasRequestedTargetState <profiles/presentation-slim/_history001/_s0004> ;
    sflo:expectsContentDigest "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  ] .

<alice/_knop/_inheritable-config> a sfcfg:KnopConfig, sfcfg:ConfigArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sfcfg:hasConfigInheritancePolicy sfcfg:configInheritancePolicy_offerDescendantsOnly ;
  sfcfg:hasDefaultHistoryTrackingPolicy sfcfg:historyTrackingPolicy_versioned .
```

Host-local operational config remains trusted runtime input:

```turtle
@prefix sfcfg: <https://semantic-flow.github.io/ontology/config/> .

<> a sfcfg:HostLocalOperationalConfig ;
  sfcfg:hasLocalPathAccessRule [
    a sfcfg:LocalPathAccessRule ;
    sfcfg:hasLocalPathBase sfcfg:localPathBase_userHome ;
    sfcfg:pathPrefix "semantic-flow/shared-config/" ;
    sfcfg:hasLocalPathLocatorKind sfcfg:localPathLocatorKind_workingLocalRelativePath
  ] .
```

Derived `ResolvedConfig` and resolution records:

```turtle
@base <https://example.test/mesh/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@prefix sfcfg: <https://semantic-flow.github.io/ontology/config/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<#resolved-alice-knop> a sfcfg:ResolvedConfig ;
  sfcfg:hasResolvedConfigFor <alice/_knop> ;
  sfcfg:resolvedFromConfig <https://semantic-flow.github.io/weave/defaults/application>, <_mesh/_config>, <alice/_knop/_local-config> ;
  sfcfg:resolvedAt "2026-05-13T12:00:00Z"^^xsd:dateTimeStamp ;
  sfcfg:hasResolverProfileDigest "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" ;
  sfcfg:hasTrustPolicyDigest "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" ;
  sfcfg:hasResolvedConfigDigest "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" ;
  sfcfg:hasConfigResolutionRecord [
    a sfcfg:ConfigResolutionRecord ;
    sfcfg:hasConfigLayerRole sfcfg:configLayerRole_knopLocal ;
    sfcfg:resolvedFromConfig <alice/_knop/_local-config> ;
    sfcfg:hasConfigResolutionStatus sfcfg:configResolutionStatus_accepted ;
    sfcfg:hasConfigSourceFingerprint "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
  ], [
    a sfcfg:ConfigResolutionRecord ;
    sfcfg:hasConfigLayerRole sfcfg:configLayerRole_reusableConfig ;
    sfcfg:resolvedFromConfig <shared/current-following-profile> ;
    sfcfg:hasConfigResolutionStatus sfcfg:configResolutionStatus_rejected
  ] .
```

### Config Resolution Logs And Caches

Runtime logs should remain append-only JSONL, but each record should be shaped as single-line compact JSON-LD rather than plain uncontextualized JSON. The standards-compliant baseline is to put a compact `@context` IRI on each line, not an inline context object. That keeps every line independently parseable as JSON-LD while avoiding a large repeated context. If the repeated context IRI still becomes annoying, Weave may define a non-standard "Weave JSON-LD Lines" profile where the log stream has a sibling context or manifest file and each JSON line carries compact terms plus a context/profile identifier. General JSON-LD consumers would need a small preprocessing step that injects the context before expansion; tools that require standalone JSON-LD records should use the repeated context-IRI form.

Config resolution should emit explicit `config.resolution.*` log events. These events should record provenance and decisions, not full config contents: source kind, layer role, declaring scope, declared location, resolved location, resolution mode, trust tier, accepted/ignored/rejected status, source content digest or fingerprint, resolver profile hash, `ResolvedConfig` digest, warnings, and cache hit/miss status. The operational log may carry richer diagnostics. The security-audit log should carry the smaller decision-grade summary because config source selection affects host trust and weave behavior.

We should not recompute `ResolvedConfig` from scratch for every weave when the in-scope config sources have not changed. Short-lived CLI commands can use a process-local cache for one operation. Long-running runtimes should use watcher-backed caches for local files and explicit freshness policy for remote or current-following sources. Persistent diagnostic caches are optional operational/runtime state and should be configured through trusted operational config, not portable mesh config alone.

The cache should be organized per mesh root as the storage container, but entries need scope keys because `ResolvedConfig` may differ by submesh, Knop, artifact role, or specific artifact. The runtime should compute and cache scoped `ResolvedConfig` lazily instead of precomputing every descendant Knop. A first implementation can invalidate coarsely at the mesh level when any in-scope config source changes; later implementations can use each `ConfigResolutionRecord`'s dependency set to invalidate only affected scopes.

Cache keys should include the resolver/profile digest, Weave version or resolver implementation version, trust-policy digest, mesh root/base identity, scope key, and source fingerprints. File watchers are an invalidation aid, not the only correctness mechanism; each cached result should still be tied to fingerprints, digests, pinned historical states, ETags, or another explicit freshness token.

Runtime logs, config-resolution records, and `ResolvedConfig` caches should live outside the mesh by default. They can still become in-mesh `DigitalArtifact`s by deliberate integration, just like any other file, but that promotion should be explicit and should consider redaction of host paths, user-local config locations, and security decisions.

### First-Pass Weave Resolver Contract

The first runtime resolver should be deliberately small but strict enough to keep fixture regeneration from encoding another temporary model.

Trusted bootstrap profile:

- The trusted bootstrap profile is the union of implementation emergency defaults, the checked-in Weave defaults RDF under `defaults/`, explicit runtime inputs, machine-local operational config, and daemon/session profile state.
- Weave's checked-in defaults are trusted because they ship with the application. Portable mesh config may include `sfcfg:hasConfigResolutionConfig` and resolver hints, but those hints are accepted only after the trusted bootstrap profile says they are legal.
- Mesh-root-local and workspace-local operational config can describe project layout and project-local config sources inside the active workspace boundary. They cannot grant access outside the workspace, enable remote config, enable external current-following references, or choose machine-local config files.
- Machine-local operational config and explicit runtime inputs are the first places that may broaden local or remote access, permit external config references, or choose persistent cache/log locations.

Portable resolver hints:

- Legal portable hints include role-specific config attachments, expected config artifacts, mesh-local and Knop-local/inheritable config sources, reusable config targets already inside the trusted boundary, stricter unknown-term/cycle/reference policies, lower reference-depth caps, and inheritance preferences for portable behavior config.
- Portable hints are capped by trusted policy. They cannot raise max reference depth above the trusted cap, loosen unknown-term or cycle policy, turn pinned-only into current-following, write caches outside approved operational locations, grant filesystem/network access, or make `ResolvedConfig` an input source.
- When a portable hint conflicts with trusted policy, the resolver applies the stricter policy or rejects the source with a `config.resolution.source.rejected` event.

Defaults source and diagnostics:

- Source RDF for Weave's default profile lives directly under top-level `defaults/`, currently `defaults/application.ttl` and `defaults/config-resolution.ttl`.
- Runtime packaging may embed parsed defaults, but tests and diagnostics should keep comparing the embedded/default in-memory representation against those TTL files. A future diagnostic command should be able to emit the active default profile and the digest of each default source file.
- Defaults under `defaults/` are source artifacts for Weave's sidecar defaults mesh, but they are not yet placed under generated `_mesh` support paths. The future packaging command should integrate them into a sidecar mesh rather than making hand-maintained `_mesh` files authoritative.

Discovery and layer order:

- Evaluate trust gates before portable config discovery: implementation emergency defaults, Weave default `ConfigResolutionConfig`, explicit runtime arguments, machine-local operational config, workspace-local operational config, and mesh-root-local operational config.
- Discover behavior config after the active trust boundary is known: Weave application defaults, mesh-local config, mesh-inheritable config, ancestor Knop inheritable config projected as `configLayerRole_knopInherited`, current Knop local config, and reusable config at each attachment point.
- Apply request/command overrides last for the current operation only, then validate the resulting effective operation config against hard invariants and current artifact/history RDF.
- Reusable config is not a single global layer. It is merged where the source is referenced: a reusable config imported from mesh config behaves as mesh config, while the same reusable config imported from Knop-local config behaves as Knop-local config.

Mesh-local config remains a normal mesh-scoped behavior layer in that order. It is not walked through Knop inheritance controls. Mesh-inheritable config is the mesh-scope offer that enters the inherited Knop stream and can then be stopped or blocked by Knop inheritance policy.

Property-family merge rules:

- Trust gates merge by intersection/deny-by-default. A lower-trust source may narrow access but cannot widen it.
- Safety caps use stricter-wins semantics, including unknown-term policy, cycle policy, external reference policy, current-following permission, and max reference depth.
- Scoped behavior defaults use nearest applicable scope after trust gates: artifact-specific policy beats Knop-local policy, which beats inherited Knop policy, which beats mesh policy, which beats application defaults.
- Required invariants dominate ordinary overrides. If implementation policy requires a ledger artifact or rejects an invalid name, config and request fields cannot silently weaken that requirement.
- Additive values such as page support assets or diagnostic tags merge by stable union with deduplication. Explicit block/remove vocabulary should be added before additive values can be safely subtracted.
- Operation request values can specialize one invocation. They may override hints with warnings, satisfy strict policies without warnings, or fail against non-overrideable policies.

Segment override behavior:

- If config supplies a next segment hint and the command supplies a different legal segment, use the command segment and emit a warning tied to the target, property, resolved hint, and requested value.
- If config supplies a naming policy and the command segment satisfies it, use the command value without conflict warning.
- If the command segment violates a hard naming invariant or current artifact/history RDF, fail before writing.
- If the command segment violates a strict but overrideable policy, require an explicit operation-level acknowledgement and a trusted resolver profile that allows that override class. Until such a CLI/API acknowledgement exists, fail closed.

Inheritance traversal:

- For a target Knop, collect mesh-inheritable config, then walk ancestor Knops from root to parent and collect each ancestor's inheritable offers that are still propagating.
- Default inbound inheritance is `configInheritancePolicy_acceptAndPropagate` inside one mesh boundary. `acceptDoNotPropagate` applies incoming inherited config to the current scope but stops it from reaching descendants. `blockInherited` rejects incoming inherited config for the current scope and descendants.
- Default outbound Knop-inheritable config is `offerDescendantsOnly`. `offerSelfAndDescendants` projects the offer into the authored Knop as well, but Knop-local config for that same Knop still wins for nearest-scope behavior defaults.
- Submesh boundaries stop inheritance unless an explicit config source crosses the boundary and trusted operational policy allows that source to be read.

Validation:

- All config sources must parse as RDF before participation. Malformed config fails the source; if the source was required by trusted policy, resolution fails the scope.
- Policy-valued properties must point to known individuals of the expected policy class. Unknown `sfcfg:` policy values fail under the default reject policy.
- Singleton resolver policy properties such as max reference depth and cache policy must have exactly one effective value after merge unless a property-specific merge rule says otherwise.
- Naming hints must be syntactically legal path segments and must still be validated against current artifact/history RDF immediately before write.
- Config-source targets must resolve to a `ConfigArtifact`, RDF-bearing `DigitalArtifact`, trusted `LocatedFile`, or trusted external bytes according to active reference policy. Unresolved required targets fail closed.

Digest validation:

- Pinned, external, and `LocatedFile`-based config sources should carry `sflo:expectsContentDigest` when the runtime can compute or know the bytes. Pinned config without a required digest fails creation/pinning under strict policy.
- Resolution verifies loaded bytes before parsing or merging. Digest mismatch on a pinned or external config source is a resolution failure by default.
- Current-following sources inside the trusted boundary may record observed content digest in `ConfigResolutionRecord` and cache keys. Whether a mismatch with an authored expected digest warns or fails is controlled by trusted policy; default should fail for config sources.
- Repinning recomputes the expected digest from trusted resolved bytes or requires an explicitly supplied digest.

Cycle, depth, cache, and lock behavior:

- The resolver walks config-source targets with a visited stack and rejects cycles by default.
- The Weave default maximum config reference depth is 8. Trusted operational config may lower it. Portable config may lower it but not raise it above the trusted cap.
- Stand-alone CLI invocations may use a process-local cache only for the current command. They may read a persistent diagnostic cache only after verifying resolver profile digest, trust-policy digest, source fingerprints, mesh identity, and scope key.
- Service-backed mode may keep watcher-backed scoped caches warm across invocations. Watchers are invalidation hints; cache correctness still depends on fingerprints, digests, pinned states, ETags, or equivalent freshness tokens.
- Default cache and lock files belong in operational storage such as `.weave/cache` under the trusted workspace container, not in semantic mesh history and not as implicit `DigitalArtifact`s.

Config-resolution logs:

- Emit compact single-line JSON-LD events with an `@context` IRI per line for standards-compliant logs. A future sidecar-context profile must be explicitly labeled as a Weave-specific optimization.
- First-pass event names should include `config.resolution.started`, `config.resolution.source.discovered`, `config.resolution.source.accepted`, `config.resolution.source.ignored`, `config.resolution.source.rejected`, `config.resolution.digest.verified`, `config.resolution.digest.mismatch`, `config.resolution.cache.hit`, `config.resolution.cache.miss`, and `config.resolution.completed`.
- Log event payloads should include source kind, layer role, declaring scope, declared location, resolved location, resolution mode, trust tier, decision status, source fingerprint or digest, resolver profile digest, trust-policy digest, scope key, `ResolvedConfig` digest when available, warning/error codes, and cache status. Do not log full config content by default.

Representing many scopes:

- `ResolvedConfig` cache entries are scoped by mesh root/base identity plus optional submesh path, Knop path, artifact role, artifact path, and operation kind.
- Compute scoped `ResolvedConfig` lazily. A mesh-level resolved profile can seed lower scopes, but Knop/artifact scopes must remain distinguishable because inheritance, local overrides, and artifact-role defaults can differ.
- A daemon may manage many mesh roots. Each mesh root gets its own cache container and scope namespace; reusable config shared across meshes can be cached by source digest, but its merged effect is still scope-specific.

### No Boolean Policy Flags

The old `generateResourcePages` and `createHistoricalStatesOnWeave` booleans name real needs, but booleans are the wrong core contract. They are too narrow for inventory history, deferred page generation, and policy inheritance.

Use controlled policy resources instead. Candidate policy families:

- `HistoryTrackingPolicy`
  - `historyTrackingPolicy_versioned`
  - `historyTrackingPolicy_currentOnly`
  - `historyTrackingPolicy_required`
- `ResourcePageGenerationPolicy`
  - `resourcePageGenerationPolicy_generate`
  - `resourcePageGenerationPolicy_suppress`
  - `resourcePageGenerationPolicy_defer`
  - `resourcePageGenerationPolicy_onRequest`
- `ResourcePageRegenerationConfigPolicy`
  - `resourcePageRegenerationConfigPolicy_configAtTheTime`
  - `resourcePageRegenerationConfigPolicy_currentPresentation`
  - `resourcePageRegenerationConfigPolicy_currentFullConfig`
  - `resourcePageRegenerationConfigPolicy_historicalSemanticsCurrentPresentation`
- `HistoryNamingPolicy`
  - `historyNamingPolicy_ordinal`
  - `historyNamingPolicy_named`
- `StateNamingPolicy`
  - `stateNamingPolicy_ordinal`
  - `stateNamingPolicy_semver`
  - `stateNamingPolicy_date`

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

But config must not become the authoritative counter store. A weave should resolve config, derive the operation's effective config, validate requested or hinted names against the current artifact/history RDF, then update the real `nextHistoryOrdinal` or `nextStateOrdinal` facts only as part of the normal inventory/history state transition.

### Reusable Config Artifacts And Targeting

Reusable config artifacts need first-class attachment and resolution vocabulary.

The existing core `ArtifactResolutionTarget` pattern is what we need for the first pass: it can target a `DigitalArtifact`, request a history or state, and specify current versus pinned resolution. Simpler is better here. Reuse `sflo:ArtifactResolutionTarget` directly through config-specific attachment properties and SHACL shapes rather than minting `ConfigResolutionTarget` as a new class immediately.

Pros of a config-specific subclass would be discoverability, easier config-only queries, and a convenient place for config-specific comments or future constraints. Cons are stronger for the first pass: it duplicates core resolution vocabulary, creates one more class to explain, risks parallel resolver semantics, and adds migration burden if `ArtifactResolutionTarget` changes. If direct reuse becomes too vague after implementation, `ConfigResolutionTarget` can be added later as a non-breaking subclass.

Candidate direction:

- `hasConfigSource` or role-specific subproperties that point from a config-bearing resource to `sflo:ArtifactResolutionTarget`
- `hasTargetArtifact` can target a `ConfigArtifact` because `ConfigArtifact` is a `DigitalArtifact`
- `hasRequestedTargetHistory`, `hasRequestedTargetState`, `hasArtifactResolutionMode`, and `hasArtifactResolutionFallbackPolicy` can carry current/pinned config-source semantics

This supports:

- a Knop referencing a reusable config artifact in the same mesh
- a mesh referencing a reusable default config artifact
- an inheritable config referencing shared fragments
- a runtime resolving a config from an external mesh under explicit access policy

Do not add `ConfigFragment`. Everything is a config fragment in one sense: any RDF subgraph can participate in config resolution. Inline blank-node or embedded RDF config can remain ordinary `Config` data. Anything that needs independent identity, reuse across attachments, history, dereferenceability, or cross-mesh reference should be a `ConfigArtifact`.

### Attachment And Inheritance

Generic `hasConfig` remains useful, but the public model should include role-specific attachment properties so merge behavior is not hidden in path names:

- `hasMeshConfig`
- `hasMeshInheritableConfig`
- `hasKnopConfig`
- `hasKnopLocalConfig`
- `hasKnopInheritableConfig`
- `hasConfigSource` or role-specific config-source properties
- `hasEffectiveConfig` for runtime/debug output

Inheritance should be scoped and explicit:

- mesh-level config supplies mesh defaults
- `_mesh/_knop-inheritable-config` supplies defaults into Knop inheritance inside the mesh boundary
- a parent Knop's inheritable config supplies defaults for descendants
- a Knop's local config overrides inherited defaults for that Knop
- reusable config artifacts may be imported/referenced into either layer
- application/runtime defaults are the final fallback

By default, a Knop's inheritable config should be an offer to descendants, not an implicit local override for the Knop itself. If a Knop also needs the policy locally, attach the same config artifact through its local config role or use a policy that explicitly makes inheritance self-inclusive.

The mesh-local versus mesh-inheritable distinction is not about whether mesh config participates in resolution. Both participate. Mesh-local config is applied as a mesh-scoped layer, while mesh-inheritable config is projected into Knop scopes as inherited input before ancestor Knop offers. Knop inheritance stop/block controls apply to that inherited stream, not to all mesh-scoped policy.

Implement a minimal inherited-config propagation control in the first config pass, before fixture ladder regeneration. The fixture ladders will otherwise encode a propagation model implicitly, and we would pay the rerung cost twice when the explicit control lands.

Do not revive the full old "configuration firewall" machinery yet. The first-pass control should be policy-valued and scoped:

- default normal Knop inheritance accepts inherited config and propagates it to descendants inside the current mesh boundary
- a scope can accept inherited config locally but stop propagation to descendants
- a scope can block incoming inherited config entirely for itself and descendants
- a scope can make its own inheritable config descendant-only or explicitly self-inclusive
- submesh boundary behavior should be explicit rather than accidentally inherited through path traversal

Candidate values can start small, for example `configInheritancePolicy_acceptAndPropagate`, `configInheritancePolicy_acceptDoNotPropagate`, `configInheritancePolicy_blockInherited`, `configInheritancePolicy_offerDescendantsOnly`, and `configInheritancePolicy_offerSelfAndDescendants`. If implementation shows that inbound acceptance and outbound offer behavior need separate properties, split them then; the important first-pass contract is that propagation is explicit, testable, and no longer just an implementation accident.

### Config Artifacts And History

Config artifacts are `DigitalArtifact`s and therefore may have histories. Not every config-related file should be historical by default.

Options:

- current-only config artifacts keep support surfaces quiet, but make historical replay and page regeneration depend on whatever config exists now
- versioned config artifacts preserve "config at the time" and make historical rendering/debugging more reproducible, but add support-history artifacts
- checkpointed or metadata-only config histories preserve fingerprints and selected snapshots without recording every minor edit as a full public surface
- versioned config with explicit suppressed ResourcePages records history without making every config state dereferenceable or visible in the generated site

The preferred default is: all portable authored config artifacts are versioned by default and their current ResourcePages are generated by default. They remain suppressible or deferrable by explicit policy. That includes `_mesh/_config`, `_mesh/_knop-inheritable-config`, `_knop/_local-config`, `_knop/_inheritable-config`, reusable named config artifacts, page presentation config, template artifacts, and stylesheet artifacts when they are modeled as mesh artifacts. The reason is reproducibility and dereferenceability: historical ResourcePage regeneration, diagnostics, and audits need to know which config was in force when a state was created or when a page was rendered, and current config artifacts should remain inspectable unless a mesh deliberately hides or defers them.

This does not mean every operational or derived config file participates in mesh history. Machine-local operational config, daemon state, runtime logs, `ResolvedConfig` caches, and config-resolution diagnostics stay outside normal mesh history unless explicitly represented or integrated as mesh `DigitalArtifact`s.

This is a default policy, not a hard ontology rule. A mesh can still opt a noisy config artifact into current-only, checkpoint-only, or metadata-only history, but that should be an explicit policy choice.

### Resource Page Generation

Resource page generation should be independently configurable from history tracking.

Current resource pages and important navigation pages may be generated during ordinary `weave` / `generate` flows according to policy. Historical resource pages should not be regenerated automatically on every weave. They should be generated or refreshed only when an operator explicitly requests historical page generation, when a transition manifest explicitly requires it, or when a future policy introduces a deliberate scheduled/backfill mode.

When historical page regeneration is requested, Weave should attempt to regenerate the requested history/state/manifestation pages from the available history, inventory, page-definition, and source snapshots. If a required or explicitly specified source file, snapshot, page definition, or manifestation file is missing, Weave should warn with the missing path and the page it prevented. Missing optional supplemental inputs may produce partial pages with warnings, but missing required inputs should not silently produce misleading historical pages.

Historical ResourcePage regeneration should make the config-time choice explicit. At minimum, layout/templating/presentation config needs selectable modes:

- config-at-the-time: use the page definition, template, stylesheet, presentation config, and relevant `ResolvedConfig` sources/fingerprints that applied when the historical page or state was originally generated
- current presentation config: use the historical content/source state but apply the current page definition, template, stylesheet, and presentation config so old content can be refreshed into the current site chrome
- current full config: use current config wherever compatible with the historical source state, useful for administrative rebuilds but less faithful as a historical artifact
- hybrid policy: preserve historical semantic/source-resolution config while applying current layout/chrome config

To support config-at-the-time regeneration, page generation should eventually record a render/provenance manifest with the content source states, page definition/template/stylesheet artifacts or fingerprints, renderer version, relevant `ResolvedConfig` digest, and selected regeneration mode. If that manifest or a pinned config source is missing, Weave should warn and either fall back according to policy or fail that page regeneration.

The config model must answer:

- whether current resource pages are generated
- whether history pages are eligible for explicit request/backfill generation when history exists
- whether state and manifestation pages are generated
- whether historical pages are generated automatically, only on request, or suppressed
- whether historical page regeneration uses config-at-the-time, current presentation config, current full config, or a hybrid policy
- whether config support artifacts get pages
- whether generated resource pages get a `sflo:hasResourcePage` relation while suppressed pages omit it
- whether page generation can be deferred and generated later from history/inventory

Suppressed pages should omit `sflo:hasResourcePage`. Do not leave an unfulfilled `hasResourcePage` promise for a page that policy says should not exist. This can mean an older historical state has a resource page while the current resource does not, or vice versa after policy changes. That is acceptable because each inventory/state describes the page facts for that state. If a page is generated later by explicit request/backfill, the corresponding current or historical inventory update can add the `sflo:hasResourcePage` fact at that time.

The default should preserve dereferenceability for artifacts by generating current ResourcePages. Slim support artifacts should still be able to suppress or defer noisy current or historical pages by explicit policy.

First-pass suppression granularity can be coarse. The resolver should support the default generate/suppress/defer/on-request policy at least at the default, artifact-role, and named-artifact/config-source level. It does not need to block on separate suppression controls for every generated page surface, such as Knop identifier pages, arbitrary IRI/term pages, `ArtifactHistory` pages, `HistoricalState` pages, and `ArtifactManifestation` pages. For the first runtime slice, it is acceptable for those pages to follow the owning artifact's page policy or the current implementation's bundled page-generation behavior. More precise page-kind policy can be added after the resolver exists and after fixture regeneration shows where the broad policy is too blunt.

### Config Ontology Overhaul Scope

The active `semantic-flow-config-ontology.ttl` should be revised rather than replaced blindly.

Keep or refine:

- `Config`
- `ConfigArtifact`
- `hasConfig`
- `configFor`
- `hasEffectiveConfig`
- Weave default profile artifacts as a serializable baseline layer in a Weave-owned defaults mesh
- `OperationalConfig`
- `MeshConfig`
- local and remote access rule vocabulary, with the active `LocalConfig` meaning renamed or specialized as host-local operational config
- ResourcePage presentation template and stylesheet artifacts

Add or substantially revise:

- Knop-local and Knop-inheritable config attachment properties and layer-role values
- optional `KnopConfig` marker for portable config attached to a Knop
- mesh-level inheritable config attachment and layer-role vocabulary
- content digest vocabulary for `LocatedFile`, `ArtifactManifestation`, and `ArtifactResolutionTarget` freshness checks
- role-specific config attachment properties
- config-source / reusable-config resolution vocabulary
- policy-valued history tracking
- policy-valued resource page generation
- naming-default policy and hint vocabulary
- `ResolvedConfig` vocabulary and comments about operation-specific effective config
- config-resolution / meta-config vocabulary
- Weave default profile vocabulary and artifact examples
- clear terms for machine-local operational config so it does not collide with Knop-local config

Drop or avoid reviving:

- old `AbstractArtifact` and Flow/State config framing
- disjoint classes for every authored config layer when attachment role and resolution context express the semantics better
- `ConfigFragment`
- generic regex template mappings as the first inheritance/selection mechanism
- boolean `generateResourcePages`
- boolean `createHistoricalStatesOnWeave`
- treating `nextHistoryOrdinal` or `nextStateOrdinal` as config
- allowing portable config to expand its own config-source trust boundary
- host service settings as the center of this ontology overhaul

## Sequencing

The next-step sequencing is still good: implement the grand config synthesis next, while keeping [[wd.task.2026.2026-05-07-fixture-ladder-generator]] close enough that we do not hand-repair generated branches during the migration.

Recommended order:

1. Settle the enum naming convention enough to mint new config controlled values with flat underscore-separated names.
2. Land the config ontology vocabulary and compact examples for Weave defaults, authored config layers, reusable config sources, history/page policies, content digests, and `ResolvedConfig`.
3. Implement the first runtime slice that can resolve the new default profile, mesh config, Knop local config, Knop inheritable config, minimal inherited propagation controls, naming hints, history policy, and resource-page policy.
4. Build or refine the fixture-ladder generator concurrently until it can replay at least the fixture branches affected by the config migration.
5. Regenerate fixture ladders once for the combined enum, config vocabulary, and inherited-propagation fallout.

The important boundary is that fixture repo repair should wait until the enum naming, config vocabulary, and minimal inheritance propagation semantics are all represented. Otherwise the fixture branches will encode a temporary config model and need another full rerung.

The config implementation does not need to wait for every deferred runtime feature. Service-backed watcher caches, rich historical page render manifests, full config-source target management commands, and long-running daemon ergonomics can follow after the fixture-affecting semantics are stable.

## Deferred / Future Work

Use this section for items that are real, but should not block the first config pass or the fixture ladder rerung. Keep the main implementation checklist for work that is expected to land in the current config slice; use deferred checklist markers only when a specific checklist item is intentionally pushed out.

- Full service-backed watcher implementation and fine-grained scoped `ResolvedConfig` cache invalidation.
- Persistent diagnostic cache storage beyond source-fingerprint-safe cache keys and log records.
- Complete `weave config source add|set|pin|unpin|remove` authoring surface, if the first pass can use compact RDF examples or a smaller internal API.
- Rich render/provenance manifests for all historical ResourcePage regeneration modes.
- Fine-grained page-kind suppression controls for Knop/IRI pages, `ArtifactHistory`, `HistoricalState`, and `ArtifactManifestation` pages beyond the first-pass default/role/artifact-level ResourcePage policy.
- Scheduled or automatic historical ResourcePage backfill.
- Package-manager-style config dependency resolution across external meshes.
- Publishing and governance workflow for the future `sflo` sidecar mesh.
- Promoting operational logs, config-resolution records, or runtime caches into in-mesh `DigitalArtifact`s by default.
- More granular inheritance firewall semantics beyond accept/propagate/block/self-inclusive policy.

## Open Issues

- No current design blockers. Remaining details are implementation-shape decisions tracked in the checklist or explicitly deferred above.

## Decisions

- Name the config-resolution/meta-config class `ConfigResolutionConfig`.
- Use `https://semantic-flow.github.io/sflo/ontology/` as the canonical `sflo` namespace/CURIE base. The config ontology should not import core terms through the older `https://semantic-flow.github.io/ontology/core/` alias.
- Do not define `WeaveDefaultConfig` as a class. Treat the concrete Weave default as a named profile artifact or bundle whose contents are instances of broader config classes such as `ApplicationConfig`, `ConfigResolutionConfig`, and `ConfigArtifact`.
- Let the Weave default profile include or point to a default `ConfigResolutionConfig`; this is trusted application baseline config, not portable mesh authority over resolver trust.
- Put canonical Weave default profile artifacts in a Weave-owned defaults mesh separate from the `sflo` ontology mesh.
- Put the first Weave defaults source RDF directly under top-level `defaults/`; it can be integrated into a sidecar mesh with Weave commands when that packaging flow is ready.
- Runtime code may embed parsed Weave defaults and a diagnostic command may emit them, but the inspectable source of truth should be RDF artifacts in the Weave defaults mesh.
- Model authored config layer semantics primarily through attachment properties, `ConfigLayerRole` values, and resolution context rather than disjoint classes for every layer.
- Define config layer ordering vocabulary and resolver safety invariants in the ontology, but keep concrete layer order and numeric precedence in Weave/default or implementation profile artifacts.
- Name persisted or inspectable derived resolver output `ResolvedConfig`. Use "effective config" for the runtime policy object actually used by an operation, which may be derived from `ResolvedConfig` plus application/runtime overlays.
- Reuse `sflo:ArtifactResolutionTarget` directly for reusable config-source references in the first pass. Do not mint `ConfigResolutionTarget` unless direct reuse proves too vague after implementation.
- Drop `ConfigFragment`; use inline ordinary `Config` data for embedded fragments and `ConfigArtifact` for anything with independent identity, reuse, history, dereferenceability, or cross-mesh reference.
- Treat default precedence as a combination of a source/layer sequence plus property-family merge rules. Trust gates, safety caps, scoped behavior defaults, required invariants, operation request fields, additive values, and reusable config references do not all use the same winner-takes-all order.
- Model all stable current defaults that affect repeatable behavior, persisted mesh RDF, generated pages, artifact resolution, or validation as default config candidates.
- Keep operation targets, input paths/bytes, safety controls, output/logging controls, execution context, and host access grants out of portable default config.
- Allow portable mesh config to declare config expectations, attachments, reusable config references, stricter resolver policies, and preferred mesh-authored layer roles within the runtime's existing trust boundary.
- Restrict trust-expanding resolver decisions to trusted bootstrap or machine-local operational config, including config-root discovery, honoring portable resolver hints, local/remote access grants, external/current-following references, cache/lock locations, and host/runtime config participation.
- Allow operational config to live in the mesh root, workspace, user/machine-local filesystem, explicit runtime config files, or daemon/session state, with relative paths resolved from the declaring config file unless an explicit base is modeled.
- Treat mesh-root-local and workspace-local operational config as project-local policy that can describe local config and local layout inside the runtime-approved boundary, but cannot grant access outside that boundary or enable remote/external config loading without higher-trust operational policy.
- Model CLI operation as either stand-alone or service-backed. Stand-alone invocations re-resolve config from trusted defaults, operational inputs, mesh files, and requested scopes every time; service-backed invocations may reuse watcher-maintained scoped `ResolvedConfig` caches across invocations.
- Rename or specialize the active ontology's machine/user-local `LocalConfig` meaning as host-local operational config, with candidate name `HostLocalOperationalConfig`, and keep it under `OperationalConfig`.
- Replace `LocalConfig` outright with `HostLocalOperationalConfig`; do not add compatibility aliases for this pre-v1 vocabulary.
- Use `KnopConfig` only as an optional portable scope marker for config attached to a Knop; Knop-local and Knop-inheritable semantics should come from attachment properties and `ConfigLayerRole` values.
- Treat inheritable config as an attachment/layer role that may be used at mesh scope or Knop scope rather than as a single layer-specific class.
- Implement minimal inherited config propagation controls in the first config pass, before fixture ladder regeneration, so fixture outputs encode the explicit accept/propagate/block semantics instead of a temporary implicit traversal rule.
- Keep first-pass inheritance propagation policy small: accept and propagate by default inside a normal Knop hierarchy; allow a scope to accept inherited config but stop propagation; allow a scope to block inherited config; allow authored inheritable config to be descendant-only by default or explicitly self-inclusive.
- When portable config and trusted resolver policy conflict, fail closed or apply the stricter policy.
- Reintroduce `_knop/_local-config` and `_knop/_inheritable-config` as separate Knop support artifacts.
- Treat `_knop/_local-config` and `_knop/_inheritable-config` as `DigitalArtifact` / `RdfDocument` config artifacts that may be independently versioned.
- Keep `sflo:nextHistoryOrdinal` and `sflo:nextStateOrdinal` in inventory/history RDF, not in config.
- Put digest terms such as `sflo:hasContentDigest` and `sflo:expectsContentDigest` in the core ontology because they apply to byte-bearing core resources and artifact-resolution targets, not just config.
- Use policy-valued vocabulary for history tracking and resource page generation rather than booleans.
- Allow config to provide naming defaults and hints such as default history segment, default state segment, state naming policy, and next state segment hint.
- Require weave/version operations to validate config-provided naming hints against current artifact/history RDF before using them.
- Let explicit CLI/API segment arguments override config defaults and hints for one operation, with a warning when they differ from a resolved hint.
- Fail closed when a CLI/API segment argument violates a hard invariant, trust gate, or non-overrideable policy. For strict but overrideable policies, require an explicit operation override acknowledgement plus resolver policy allowing that class of override.
- Keep payload artifacts historical by default.
- Version portable authored config artifacts by default, including mesh config, `_mesh/_knop-inheritable-config`, Knop local config, Knop inheritable config, reusable named config artifacts, and presentation/template/style config artifacts when they are represented as mesh artifacts.
- Allow explicit suppression or deferral of ResourcePages for config support artifacts when they are not useful to publish; versioning config history does not require generating a visible page for every config state when policy says otherwise.
- Do not keep `_mesh/_inventory` or `_knop/_inventory` history by default; inventory defaults to current-only unless a mesh explicitly opts in.
- Treat current runtime reads of inventory history/progression facts as transitional implementation debt to remove before applying the current-only inventory default to fixture-backed behavior.
- Default low-value working/progression artifacts such as `_mesh/_meta` and `_knop/_meta` toward current-only, slim-history, checkpoint-only, or metadata-only history policy unless overridden.
- Treat operational/runtime config as a trusted runtime input and trust gate, not as `ResolvedConfig` or the application's effective config.
- Treat `ResolvedConfig` as derived resolver output produced from Weave defaults, operational gates, resolver policy, authored config, reusable config artifacts, and validated request-level config inputs.
- Add a config-resolution / meta-config layer to control discovery, trust, precedence, merge behavior, reference following, cycle handling, and `ResolvedConfig` caching.
- Add a Weave default profile layer that externalizes stable behavior defaults currently implicit in code or exposed only through API/CLI defaults.
- Treat the Weave default profile as an input to config resolution, not as the same thing as `ResolvedConfig` or operation-specific effective config.
- Keep one-shot operation inputs separate from default config, while allowing API/CLI overrides to sit above config during a single operation.
- Trusted bootstrap resolver policy must come from built-in defaults, explicit runtime input, machine-local operational config, or daemon-managed runtime state, not from untrusted portable mesh config alone.
- Portable mesh config may declare resolver hints or expected config sources, but it must not expand local/remote trust boundaries by itself.
- Default config resolution should fail closed on unknown required terms, cycles, unresolved config targets, and disallowed external config references.
- Reusable config references should default toward pinned resolution; current-following reusable config must require explicit resolver policy.
- Pinned, external, and `LocatedFile`-based config sources should carry content digests when the runtime can compute or know them. Resolution should warn or fail, according to policy, when fetched bytes do not match the expected digest.
- Compute expected content digests during trusted target creation, pinning, or repinning when bytes are readable; accept user-supplied expected digests only through explicit authoring API/CLI fields; verify expected digests during weave/config resolution before using resolved bytes.
- Add a future config-source resolution-target management surface, because current CLI/API support only covers extraction-source targets through `weave extract --source`, `weave extract --source-state`, and `weave set extraction-source`.
- Runtime JSONL records should be shaped as single-line compact JSON-LD. The standards-compliant form repeats a compact `@context` IRI per line; a Weave-specific sidecar-context profile may be added for compact internal logs, but it must be labeled as requiring a preprocessing/context-injection step.
- Config resolution should emit `config.resolution.*` events that record source provenance, trust decisions, content digests or fingerprints, resolver profile digests, `ResolvedConfig` digests, warnings, and cache status without logging full config contents by default.
- `ResolvedConfig` should be cached by source fingerprints and resolver/trust/profile identity rather than recomputed from scratch for every weave. Use process-local caches for short-lived commands and watcher-backed caches for long-running runtimes.
- Store config cache entries in a mesh-level cache container with lazy per-scope entries for submeshes, Knops, artifact roles, and specific artifacts rather than assuming one `ResolvedConfig` per mesh is enough.
- Keep runtime logs, config-resolution records, and persistent `ResolvedConfig` caches outside the mesh by default, while allowing deliberate promotion into in-mesh `DigitalArtifact`s when a mesh wants auditable operational records.
- Historical resource pages should be regenerated only on explicit request or manifest/policy-directed backfill, not automatically on every weave.
- Historical ResourcePage regeneration should support config-at-the-time, current presentation config, current full config, and hybrid historical-semantic/current-presentation modes.
- Page generation should eventually record render/provenance manifests with source states, page definition/template/stylesheet sources or fingerprints, renderer version, relevant `ResolvedConfig` digest, and regeneration mode.
- Requested historical page regeneration should warn when required or explicitly specified source files, snapshots, page definitions, or manifestation files are missing; missing required inputs should not silently produce misleading pages.
- Suppressed resource pages should omit `sflo:hasResourcePage`; if a suppressed page is later generated by explicit request/backfill, add the relation in the corresponding current or historical inventory update.
- Keep example placement split by repository role for now. The `sflo` ontology repo should carry compact normative ontology/SHACL/SPARQL examples and eventually its own sidecar mesh for the ontology artifacts. The Semantic Flow Framework repo should keep broader tutorial and scenario examples such as `mesh-sidecar-fantasy-rules` and `mesh-alice-bio` under `/examples`. Weave developer notes should keep implementation sketches, migration plans, and exploratory examples that are not yet normative or tutorial material.
- It is acceptable for the future `sflo` sidecar mesh to generate or reference artifacts from the Semantic Flow Framework repo when those artifacts are the broader docs/examples source of truth. The sflo/SFF split is a practical role separation, not a hard architectural law.
- Keep portable authored config and machine/runtime trust policy distinct even when both use the config ontology.
- Treat reusable named configs as first-class `ConfigArtifact`s that can be referenced across Knops, meshes, and external meshes.
- Prefer reusing or specializing the existing artifact-resolution vocabulary for config-source references rather than inventing an unrelated targeting model.
- Preserve template and stylesheet artifacts as first-class `DigitalArtifact`s.
- Do not revive regex-heavy template mappings as the first resource-page presentation selection model.
- Revise the active `semantic-flow-config-ontology.ttl` in place rather than copying the old JSON-LD ontology forward.
- Complete the enum-style individual naming pass before minting new config policy individuals; all new config controlled values should use flat underscore-separated IRIs such as `sfcfg:historyTrackingPolicy_currentOnly`, not slash-style or unseparated flat camelCase IRIs.
- Tackle fixture ladder generation after the Phase 1 config ontology/default-profile pass so regenerated examples and test data absorb enum and config vocabulary changes together.

## Contract Changes

- Add portable Knop-local and Knop-inheritable config artifact vocabulary.
- Add optional `KnopConfig` vocabulary for config artifacts scoped to a Knop without making local/inheritable semantics class-bound.
- Add mesh-level inheritable config attachment vocabulary.
- Add minimal inherited config propagation-control vocabulary for accept-and-propagate, accept-with-stop, block inherited config, descendant-only offers, and self-inclusive offers.
- Add policy-valued history tracking vocabulary.
- Add policy-valued resource page generation vocabulary.
- Add policy-valued ResourcePage regeneration config modes for config-at-the-time, current presentation config, current full config, and hybrid historical-semantic/current-presentation regeneration.
- Add config naming-default and naming-hint vocabulary that is separate from core ordinal allocator state.
- Add operation-request override policy vocabulary for warning/applying, rejecting conflicts, or requiring explicit acknowledgement when request fields conflict with resolved config.
- Add config attachment and config-source resolution vocabulary for reusable named config artifacts.
- Add content digest vocabulary for byte-bearing resources and expected resolved targets, at least `hasContentDigest` and `expectsContentDigest`.
- Define digest lifecycle for target creation, pinning, repinning, user-supplied expected digests, and weave-time verification.
- Define API/CLI affordances for creating and modifying config-source resolution targets.
- Add config-resolution vocabulary for layers, layer roles, precedence profiles, merge profiles, reference policy, cycle policy, unknown-term policy, and `ResolvedConfig` cache policy.
- Define a trusted bootstrap model for resolver configuration.
- Define runtime log records for config resolution as compact JSON-LD JSONL, including the standard context-IRI-per-line profile and any optional Weave-specific sidecar-context profile.
- Define `ConfigResolutionRecord` or equivalent derived provenance vocabulary for config source decisions, content digests or fingerprints, `ResolvedConfig` digests, and cache status.
- Define `ResolvedConfig` as derived resolver output and clarify its relationship to the operation's effective config.
- Add Weave default profile vocabulary and examples for implementation default history policy, page policy, naming policy, presentation policy, and resolver defaults.
- Define how Weave default profile artifacts are represented, embedded, or emitted so defaults are inspectable independently of TypeScript implementation details.
- Define example placement conventions across `sflo`, Semantic Flow Framework, and Weave developer notes.
- Align all new config controlled values with the flat underscore-separated enum-instance convention from [[ont.task.2026.2026-05-03-enumeration-type-instances]].
- Clarify that `hasEffectiveConfig`, `hasResolvedConfig`, and resolved config artifacts are derived runtime/debug/application state, not operational input and not authoritative mesh source data unless explicitly modeled otherwise.
- Rename or specialize active machine/user-local `LocalConfig` so it cannot be confused with Knop-local portable config.
- Clarify CLI stand-alone versus service-backed config resolution and cache behavior.
- Clarify that portable resolver hints cannot grant host filesystem or network access without operational trust policy.
- Update the active config ontology to align with current `sflo:DigitalArtifact`, `sflo:Knop`, `sflo:SemanticMesh`, `sflo:ArtifactResolutionTarget`, and `sflo:ResourcePageDefinition` vocabulary.
- Retire old boolean config terms in favor of controlled policy resources.
- Retire old `AbstractArtifact` and Flow/State based config inheritance assumptions.

## Testing

- Ontology validation should cover the revised config ontology and examples.
- Add example RDF for `_mesh/_config`, `_mesh/_knop-inheritable-config`, `_knop/_local-config`, `_knop/_inheritable-config`, and a reusable named config artifact.
- Add example RDF showing a Knop inheriting defaults from a parent and overriding them locally.
- Add example RDF and resolver tests for inherited config propagation controls: default accept/propagate, accept-but-stop, block inherited config, descendant-only inheritable config, and explicitly self-inclusive inheritable config.
- Add example RDF showing a reusable config artifact referenced through a pinned config-source target.
- Add example RDF showing current-following config-source resolution.
- Add example RDF for the Weave default profile mesh and how it is overridden by mesh, inherited Knop, local Knop, and CLI/API request policy.
- Keep normative minimal examples in the `sflo` ontology repo, broader scenario meshes in Semantic Flow Framework `/examples`, and implementation/migration examples in Weave developer notes until they are ready to graduate.
- Add parity tests or diagnostics proving the implementation's internal defaults match the serialized or emitted Weave default profile artifacts.
- Add ontology checks or search-based guardrails that reject new slash-style enum individuals in config examples and vocabulary.
- Add runtime config resolver unit tests for effective policy precedence.
- Add tests covering property-family merge semantics, including trust-gate caps, nearest-scope behavior overrides, required invariants, operation request field validation, additive presentation values, and reusable config imported at different attachment points.
- Add tests proving CLI/API segment arguments override config defaults and hints with warnings, fail against hard invariants, and require explicit acknowledgement for strict-but-overrideable policy conflicts.
- Add tests for config-resolution bootstrap behavior: untrusted portable config cannot enable external config references by itself.
- Add tests for resolver policy values: unknown term rejection, cycle rejection, max reference depth, pinned-only reusable config, and current-following opt-in.
- Add tests that pinned and external config sources with `expectsContentDigest` detect changed `LocatedFile` or remote bytes and invalidate cached `ResolvedConfig`.
- Add tests proving config-source target creation computes expected digests when bytes are readable, accepts explicit expected digests when allowed, and verifies digests during weave/config resolution.
- Add tests for `ResolvedConfig` cache behavior if persistent diagnostic caches are introduced.
- Add tests proving stand-alone CLI mode re-resolves config per invocation and service-backed mode invalidates cached scoped config when watched source fingerprints change.
- Add tests for `config.resolution.*` log events and JSON-LD JSONL context handling when config-resolution logging is implemented.
- Add tests proving config-provided history/state segment hints do not bypass current artifact/history RDF validation.
- Add tests proving `nextHistoryOrdinal` and `nextStateOrdinal` continue to come from inventory/history RDF.
- Add tests for resource page generation policies, including suppressed pages and omitted historical support pages.
- Add tests for historical ResourcePage regeneration with config-at-the-time versus current presentation config, including warnings when render manifests or pinned config sources are missing.
- Add fail-closed tests for malformed config, unknown policy values, unresolved reusable config targets, and disallowed external config references.

## Non-Goals

- Do not implement the full config resolver in the ontology overhaul before the vocabulary is reviewed.
- Do not pretend every CLI/API option is config; operation-specific inputs and targets remain request data.
- Do not move `sflo:nextHistoryOrdinal` or `sflo:nextStateOrdinal` into config.
- Do not use booleans as the durable policy vocabulary for history tracking or resource page generation.
- Do not make machine-local trust policy travel silently as portable mesh config.
- Do not model `ResolvedConfig` or operation-specific effective config as `OperationalConfig`.
- Do not let ordinary portable config decide which untrusted config sources may be loaded.
- Do not implement a fully general package-manager-style config dependency resolver.
- Do not add `ConfigFragment` as a separate class.
- Do not add `ConfigResolutionTarget` as a first-pass class unless direct reuse of `sflo:ArtifactResolutionTarget` proves insufficient.
- Do not make runtime logs, config-resolution records, or `ResolvedConfig` caches into mesh artifacts by default.
- Do not revive the old Flow/State config model.
- Do not revive regex-driven template mapping as the first page-presentation selection model.
- Do not solve every daemon service setting, logging setting, or long-running host concern in this task.
- Do not force machine-local operational config, runtime logs, `ResolvedConfig` caches, config-resolution diagnostics, or other derived runtime state into mesh history by default.
- Do not make `_knop/_assets` recursively governed just because page presentation config references stylesheets or templates.

## Implementation Plan

### Phase 0: Synthesis And Examples

- [x] Finish or at least settle the ontology enum-instance naming task enough that config policy values can be minted once, using the flat underscore-separated convention.
- [x] Record the synthesized decisions from the current task and the four source tasks.
- [x] Inventory current implicit TypeScript, API, CLI, page planning, history planning, and fixture defaults.
- [x] Classify each current default as Weave default profile config, operational config, explicit operation request, or derived effective config.
- [x] Draft compact example RDF for mesh config, Knop local config, Knop inheritable config, reusable config artifacts, operational config, and derived `ResolvedConfig`.
- [x] Draft compact example RDF for config-resolution / meta-config, including pinned reusable config and a rejected current-following config source.
- [x] Draft compact example RDF for the Weave default profile mesh.
- [x] Classify draft examples as normative sflo examples, Semantic Flow Framework scenario examples, or Weave developer-note implementation examples.
- [x] Decide initial names for policy classes and controlled policy values.

### Phase 1: Config Ontology Overhaul

- [x] Update `dependencies/github.com/semantic-flow/sflo/semantic-flow-config-ontology.ttl` with Knop local/inheritable config attachment properties and layer-role values.
- [x] Add or refine reusable config-source resolution vocabulary by directly reusing `sflo:ArtifactResolutionTarget`.
- [x] Add content digest vocabulary for `LocatedFile`, `ArtifactManifestation`, and `ArtifactResolutionTarget`.
- [x] Add SHACL expectations for content digest use.
- [x] Define generic config-source target management API/CLI behavior, including add, set, pin, unpin, remove, and expected-digest handling.
- [x] Add config-resolution / meta-config classes for layers, layer roles, precedence, merge behavior, reference policy, cycle policy, unknown-term policy, and cache policy.
- [x] Add Weave default profile properties and examples for default policies currently implicit in code/API/CLI defaults, without minting a `WeaveDefaultConfig` class.
- [x] Add `KnopConfig` only if it helps validation, and keep Knop local/inheritable behavior on attachment properties and layer roles.
- [x] Add mesh-level and Knop-level inheritable config attachment vocabulary.
- [x] Add minimal inherited config propagation-control vocabulary for accepting, stopping, blocking, and self-including inherited config.
- [x] Add policy-valued history tracking and resource page generation vocabulary.
- [x] Add ResourcePage regeneration config policy vocabulary and render/provenance manifest vocabulary.
- [x] Add naming-default and naming-hint vocabulary without moving ordinal allocator state into config.
- [x] Add operation-request override policy vocabulary for segment defaults, hints, strict policies, and explicit override acknowledgements.
- [x] Add `ResolvedConfig` vocabulary and comments that distinguish derived resolver output from authored source config and operation-specific effective config.
- [x] Rename or specialize machine/user-local `LocalConfig` as host-local operational config, with candidate name `HostLocalOperationalConfig`.
- [x] Remove or avoid `ConfigFragment` and document when inline `Config` data versus `ConfigArtifact` should be used.
- [x] Update ontology comments to reject old booleans and regex mappings as first-pass contracts.

### Phase 2: Weave Config Discovery And Resolution Design

- [x] Define the trusted bootstrap resolver profile and which sources can supply it.
- [x] Define which portable resolver hints are legal and which are capped by trusted bootstrap policy.
- [x] Define the Weave-owned defaults mesh, where Weave default profile artifacts are loaded from, and how they can be inspected in tests and diagnostics.
- [x] Define config discovery order for `_mesh/_config`, `_mesh/_knop-inheritable-config`, `_knop/_local-config`, `_knop/_inheritable-config`, reusable config artifacts, machine-local operational config, and command-line overrides.
- [x] Define property-family merge and precedence rules for trust gates, safety caps, scoped behavior defaults, required invariants, operation request fields, additive values, and reusable config attachment points.
- [x] Define warning and failure behavior for CLI/API segment arguments that override hints, satisfy strict policies, or conflict with overrideable versus non-overrideable policies.
- [x] Define inheritance traversal rules for Knop hierarchy and submesh boundaries, including default accept/propagate behavior and explicit stop/block/self-inclusive propagation policies.
- [x] Define validation rules for config policies, naming hints, reusable config targets, and unknown terms.
- [x] Define digest validation rules for external, pinned, and `LocatedFile`-based config sources.
- [x] Define when config-source target commands compute, persist, recompute, or require expected content digests.
- [x] Define cycle detection, maximum config reference depth, and cache/lock semantics for resolved config.
- [x] Define stand-alone CLI re-resolution behavior versus service-backed watcher/cache behavior.
- [x] Define the `config.resolution.*` log event schema, JSON-LD context strategy, cache key shape, and watcher/fingerprint invalidation model.
- [x] Define how resolved runtime config can represent many meshes, submeshes, Knops, and artifacts.

### Phase 3: Runtime Implementation Slices

- [x] Implement an internal effective-config model that can answer history policy and resource-page policy for a target artifact role.
- [x] Implement minimal inherited config propagation controls before fixture ladder regeneration, covering normal propagation, accept-but-stop, block inherited config, and descendant-only versus self-inclusive offers.
- [x] Wire the first support-artifact history-policy slice into mesh support ResourcePage catch-up: `_mesh/_meta` and `_mesh/_inventory` use current-only history by default while `_mesh/_config` remains versioned.
- [ ] Wire history policy into the slim-support-artifact work from [[wd.task.2026.2026-05-05-optional-history-and-slim-support-artifacts-by-default]].
- [ ] Wire naming defaults and hints into payload versioning without bypassing current RDF validation.
- [ ] Wire resource-page generation policy into page planning separately from history policy.
- [ ] Wire historical ResourcePage regeneration to select config-at-the-time, current presentation config, current full config, or hybrid regeneration policy.
- [ ] Keep path/URL trust policy integration aligned with [[wd.task.2026.2026-04-11_1723-operational-config-for-runtime-resolution]].
- [ ] Update non-fixture unit and integration tests alongside each runtime slice so parser, resolver, naming, history-policy, and page-policy expectations move with the implementation.

### Phase 4: Validation And Documentation

- [ ] Add ontology examples and tests for the revised vocabulary.
- [ ] Update or reference Semantic Flow Framework examples such as `mesh-sidecar-fantasy-rules` and `mesh-alice-bio` after the ontology examples settle.
- [ ] Add Weave unit and integration tests for config resolution and policy application.
- [ ] After fixture-ladder regeneration, update fixture-backed Weave tests, Accord manifests, and conformance expectations for the combined enum/config vocabulary changes.
- [ ] Update related task notes and roadmap references to point at this grand synthesis task as the config umbrella.
- [ ] Update [[wd.codebase-overview]] when the resolver becomes a standard runtime seam.
- [ ] Update user-facing docs only after the CLI/runtime behavior is implemented.
