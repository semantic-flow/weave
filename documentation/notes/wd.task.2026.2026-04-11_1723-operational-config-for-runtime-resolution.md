---
id: q7r2m4n8x1c6v9b3k5p2t7y
title: 2026 04 11_1723 Operational Config For Runtime Resolution
desc: ''
created: 1775953446000
---

## Goals

- Define a process-agnostic operational-config model for runtime resolution policy so the same policy shape can be used by CLI, daemon, and other local execution surfaces.
- Move allowed-directory and network-access policy for `workingFilePath`, `targetMeshPath`, `workingAccessUrl`, and `targetAccessUrl` out of ad hoc runtime assumptions and into an explicit configuration contract.
- Reuse the useful "application config exists" idea from the old `sflo-host` line without inheriting its daemon-service bias as the default shape for current Weave work.
- Make extra-mesh local targeting possible in a controlled way, especially `../` path traversal for `workingFilePath` and `targetMeshPath` within configured local boundaries.
- Split repo-traveling operational access policy from user- or machine-local operational access policy so portable checkout expectations do not silently become host-trust decisions.
- Keep operational config separate from core mesh RDF so persisted mesh data remains portable across users, machines, and checkout locations.

## Summary

We now have core vocabulary for current-byte locators and direct resolution targets:

- `workingFilePath`
- `workingAccessUrl`
- `targetMeshPath`
- `targetAccessUrl`

What we do not yet have is the operational policy layer that says when a runtime may actually use them.

That policy is no longer just a daemon concern. The current Weave CLI already needs it for controlled extra-mesh local targeting through `../...` paths, and later slices may need explicit remote access policy too.

The old `sflo-host` ontology is useful as precedent because it recognized that application/runtime behavior needs its own config surface. But it is not the right model to copy forward directly. Its center of gravity is `HostServiceConfig`, logging channels, contained service toggles, port/host/scheme binding, and service-host mesh registration. That is mostly daemon or long-running-host shape, not the shared runtime-resolution policy that current CLI and daemon both need.

The current best direction is to keep this vocabulary in `semantic-flow-config-ontology.ttl` for now, with `OperationalConfig` as the broader root concept. A narrower `RuntimeResolutionConfig` can still appear later if the vocabulary grows enough that the resolution subset wants its own explicit subtype.

The first-pass draft vocabulary now includes:

- `OperationalConfig`
- `RepoOperationalConfig`
- `LocalOperationalConfig`
- `LocalPathAccessRule`
- `RemoteAccessRule`
- `LocalPathBase`
- `LocalPathLocatorKind`
- `RemoteLocatorKind`

That is enough to sketch both repo-traveling and machine-local policy without reviving daemon-centric host-service config or inventing a large filesystem-entity ontology.

This task should define the modern operational-config direction for runtime resolution boundaries and then wire it into Weave conservatively.

## Discussion

### What the old `sflo-host` line is good for

The old host ontology at `dependencies/github.com/semantic-flow/ontology/old/sflo-host-ontology.jsonld` still contains two useful ideas:

- application/runtime policy is a real configuration concern, not a detail to bury in core ontology comments or implementation code
- local mesh path registration and validation can belong to host/runtime config rather than to portable mesh RDF

Those ideas are still good.

### What should not be revived as-is

Most of the old `sflo-host` surface is service-host oriented:

- `HostServiceConfig`
- `LoggingConfig`
- `LogChannelConfig`
- `ContainedServicesConfig`
- `port`, `host`, `scheme`
- `apiEnabled`, `sparqlEnabled`, `queryWidgetEnabled`, `staticServerEnabled`, `apiDocsEnabled`
- log rotation and retention settings
- `meshPaths` as host-managed service registration

That is not the right first shape for the current problem.

We need a config surface that a one-shot CLI invocation can load just as naturally as a daemon process. So the new note should not start from "host service" as the conceptual center. It should start from "runtime resolution policy" or equivalent.

### Repo-traveling policy versus machine-local policy

The strongest split for this task is not "daemon config versus CLI config" and not "all config is a versioned support artifact." It is:

- repo-traveling operational policy that can safely ship with a checkout
- machine-local operational policy that represents host trust and user preference

The current likely conventions are:

- `/.sf-repo-access.ttl`
- `~/.sf-local-access.ttl`

The first file should be able to say things like:

- extra-mesh `../...` paths are allowed when they stay inside the checked-out repo boundary
- certain repo-adjacent directories are allowed because the project intentionally lays content out that way

The second file should be able to say things like:

- broader host-local directories are allowed on this machine
- remote access is allowed for specific schemes or origins
- this user wants stricter or broader policy than the repo default

That split matters because a cloned repo should not, by itself, be able to grant arbitrary host access. Repo-traveling policy should stay within a boundary that collaborators can reasonably audit and carry. Broader machine trust belongs in local config.

### Relationship to mesh-managed config artifacts

Older notes also explored versioned support-artifact config such as `_mesh/_mesh-config`, `_knop/_local-config`, and `_knop/_inheritable-config`. That line still has value, but it solves a different problem.

Portable mesh-managed config artifacts are a good fit for:

- page presentation defaults
- renderer preferences
- inheritable mesh behavior that should travel with the mesh

They are not the best default home for host trust policy such as:

- whether this machine may read `../documentation/...`
- whether this machine may read outside the repo entirely
- whether this machine may follow remote URLs

So this task should keep mesh-managed `ConfigArtifact` work distinct from host/runtime trust policy, even though both live in the broader config line.

### First-pass rule shape

The first-pass operational access model should stay small and implementable:

- positive allow rules only
- deny by default when no rule matches
- explicit declared base for local path rules
- explicit path-prefix matching rather than regex or implicit serializer-dependent base rules

The current draft shape in the config ontology is:

- `OperationalConfig`
  - `hasLocalPathAccessRule`
  - `hasRemoteAccessRule`
- `LocalPathAccessRule`
  - `hasLocalPathBase`
  - `pathPrefix`
  - `hasLocalPathLocatorKind`
- `RemoteAccessRule`
  - `hasRemoteLocatorKind`
  - `allowedRemoteScheme`
  - `allowedRemoteOrigin`

For local path rules, the declared bases currently include:

- `LocalPathBase/MeshRoot`
- `LocalPathBase/UserHome`
- `LocalPathBase/AbsolutePath`

This is intentionally smaller than a more ambitious directory-resource model. It gives the runtime a concrete first-pass access checker while leaving room to introduce richer directory resources later if real pressure appears.

For a non-whole-repo mesh, this means a repo-traveling access file may live at the repo root while still authoring `pathPrefix` values relative to the mesh root. A path such as `../documentation/sidebar.md` is still most naturally described from the mesh root's point of view, because that is how `targetMeshPath` and `workingFilePath` are authored in mesh RDF.

The first-pass runtime model assumes one active mesh root per execution. The non-whole-repo case does not require a dedicated long-lived fixture repo; focused tests can materialize a mesh beneath a temporary repo root and place `/.sf-repo-access.ttl` plus repo-adjacent files alongside it.

### First-pass effective policy

The first-pass model should stay honest about what it does and does not support.

- repo-traveling config contributes positive allow rules
- machine-local config contributes additional positive allow rules
- if no applicable rule matches, access is denied

That means the first-pass effective policy is the union of discovered applicable allow rules. It does not yet provide an explicit deny or local-override vocabulary. If later pressure appears for local opt-out or negative rules, we should add that explicitly rather than pretending the first-pass model already has it.

### Why this is now a first-class task

The core/runtime work has already reached the point where operational policy is the next blocker:

- `workingFilePath` is now implemented as a local current-byte locator in runtime resolution
- `targetMeshPath` is already used for local page-source resolution
- both are still conservatively mesh-root-bound in runtime behavior
- the next requested capability is controlled extra-mesh local targeting through `../...`
- later, `workingAccessUrl` and `targetAccessUrl` will need equally explicit remote-use policy

If we try to keep widening these behaviors without a dedicated operational-config task, we will end up scattering policy across CLI flags, runtime defaults, and ontology comments.

### What the new config needs to govern

At minimum, the first operational-config slice should cover:

- which local directories are allowed when `workingFilePath` uses `../`
- which local directories are allowed when `targetMeshPath` uses `../`
- whether direct remote target access through `targetAccessUrl` is allowed at all
- whether remote current-byte access through `workingAccessUrl` is allowed at all
- fail-closed behavior when a path or URL falls outside configured policy

That policy should be expressible without persisting absolute machine-specific paths into mesh RDF.

### CLI and daemon should consume the same policy surface

The important design constraint is shared consumption:

- the CLI should be able to load the operational config and apply the same resolution policy as the daemon
- the daemon should not get a special ontology branch that the CLI bypasses
- tests should be able to inject or materialize the same config shape deterministically

That does not mean every command needs to eagerly load or consult operational config. The shared seam should be used by the commands and runtime paths that actually resolve policy-governed locators such as `workingFilePath`, `targetMeshPath`, `workingAccessUrl`, or `targetAccessUrl`.

That does not mean the CLI and daemon need identical discovery behavior. It means the policy model and semantics should be shared even if the loading surface differs.

For example, it would be reasonable for the CLI to accept an explicit config file path while a daemon also supports a conventional config location. But both should hydrate the same underlying operational-config model.

### Relationship to the current config ontology

The modern config ontology at `dependencies/github.com/semantic-flow/ontology/semantic-flow-config-ontology.ttl` already provides a generic `Config` / `ConfigArtifact` model. That suggests a likely direction:

- keep generic config attachment in the config ontology line
- define `OperationalConfig` in that line for now rather than splitting immediately into a separate host/operational ontology
- treat any later `RuntimeResolutionConfig` as a possible specialization rather than the first root concept
- avoid dropping runtime policy directly into the core ontology

The namespace split can stay open for later if the operational line grows enough to justify its own companion ontology, but that is not a reason to block the first pass.

### Minimal example shapes

Repo-traveling access policy:

```turtle
@prefix sfcfg: <https://semantic-flow.github.io/ontology/config/> .

<> a sfcfg:RepoOperationalConfig ;
  sfcfg:hasLocalPathAccessRule [
    a sfcfg:LocalPathAccessRule ;
    sfcfg:hasLocalPathBase <https://semantic-flow.github.io/ontology/config/LocalPathBase/MeshRoot> ;
    sfcfg:pathPrefix "../documentation/" ;
    sfcfg:hasLocalPathLocatorKind <https://semantic-flow.github.io/ontology/config/LocalPathLocatorKind/Any>
  ] .
```

Machine-local access policy:

```turtle
@prefix sfcfg: <https://semantic-flow.github.io/ontology/config/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<> a sfcfg:LocalOperationalConfig ;
  sfcfg:hasLocalPathAccessRule [
    a sfcfg:LocalPathAccessRule ;
    sfcfg:hasLocalPathBase <https://semantic-flow.github.io/ontology/config/LocalPathBase/AbsolutePath> ;
    sfcfg:pathPrefix "/Users/example/shared-notes/" ;
    sfcfg:hasLocalPathLocatorKind <https://semantic-flow.github.io/ontology/config/LocalPathLocatorKind/TargetMeshPath>
  ] ;
  sfcfg:hasRemoteAccessRule [
    a sfcfg:RemoteAccessRule ;
    sfcfg:hasRemoteLocatorKind <https://semantic-flow.github.io/ontology/config/RemoteLocatorKind/TargetAccessUrl> ;
    sfcfg:allowedRemoteScheme "https" ;
    sfcfg:allowedRemoteOrigin "https://raw.githubusercontent.com"^^xsd:anyURI
  ] .
```

### Relationship to `1545`

This task is now the natural home for the operational-config questions that `[[wd.task.2026.2026-04-08_1545-resource-page-definition-and-sources]]` should not have to carry by itself:

- allowed-directory rules for `targetMeshPath` and `workingFilePath`
- remote-use policy for `targetAccessUrl`
- remote-use policy for `workingAccessUrl`
- CLI-versus-daemon loading and precedence

That lets `1545` stay focused on page-definition behavior instead of turning into the operational-policy task too.

## Open Issues

- How config discovery and precedence should work across explicit CLI arguments, environment, and optional default file locations.
- How to express policy for multiple meshes in one checkout or one daemon process without reviving the old `meshPaths` service-registration framing as the primary abstraction.
- How strict the repo-traveling boundary should be: inside mesh only, inside repo only, or a constrained set of repo-adjacent paths rooted from the checkout.
- Whether `/.sf-repo-access.ttl` and `~/.sf-local-access.ttl` should be the first-pass conventional file names or only documented example conventions.
- Whether remote policy should be all-or-nothing at first or should immediately support scheme/origin allowlists.
- Whether the positive-allow-only first pass should later grow explicit deny or local-override vocabulary.
- How operational config should be surfaced in tests so extra-mesh path cases are easy to exercise without hiding policy in global environment state.
- Whether logging/service-host concerns from the old `sflo-host` line should remain explicitly out of scope for this task or be listed as later follow-on work.

## Decisions

- Operational resolution policy should be treated as a first-class config concern rather than as ad hoc runtime branching.
- The new operational-config direction must be usable by CLI and daemon, not daemon-only.
- The old `sflo-host` ontology is precedent, not a drop-in model.
- The first-pass vocabulary should live in `semantic-flow-config-ontology.ttl` rather than blocking on a separate operational companion ontology.
- `OperationalConfig` is the better broad root concept for this task; a narrower `RuntimeResolutionConfig` can still appear later as a subtype if the line needs it.
- Service-host concerns such as port binding, contained service toggles, and log rotation should not define the center of this task.
- The first-pass local-boundary model should use explicit `LocalPathAccessRule` resources with a declared base plus `pathPrefix`, not regex or implicit path semantics.
- The first-pass remote-boundary model should use explicit `RemoteAccessRule` resources with locator-kind plus scheme/origin constraints.
- Allowed-directory rules for `workingFilePath` and `targetMeshPath` should live in operational config, not in persisted mesh RDF.
- Remote-use rules for `workingAccessUrl` and `targetAccessUrl` should also live in operational config, not in persisted mesh RDF.
- The first widening target should be controlled extra-mesh local path resolution through configured allowed directories, not remote fetching.
- Repo-traveling operational policy and machine-local operational policy should be modeled as distinct layers, even if they share vocabulary.
- A repo-traveling access file should not by itself grant arbitrary host access outside the checked-out repo boundary.
- Machine-local policy is the right place for broader host trust decisions such as extra-repo directories or remote-access allowances.
- The first-pass effective policy should be the union of applicable positive allow rules from discovered repo and local config; absence of a matching rule denies access.
- Mesh-managed `ConfigArtifact` work remains valid for portable behavior/config, but it should not become the default mechanism for machine-local host trust policy.
- Runtime behavior should stay fail-closed when operational config is missing, malformed, or disallows the requested path or URL.

## Contract Changes

- Introduce a modern operational-config task and vocabulary direction for runtime resolution policy.
- Define a shared config shape that can be consumed by both CLI and daemon execution surfaces.
- Define a repo-traveling operational access layer and a machine-local operational access layer with explicit first-pass combination semantics.
- Define allowed local-directory policy for `workingFilePath` and `targetMeshPath` through `LocalPathAccessRule`, `LocalPathBase`, and `pathPrefix`.
- Define remote-access policy for `workingAccessUrl` and `targetAccessUrl` through `RemoteAccessRule`, locator kind, and scheme/origin constraints.
- Define config-loading and precedence expectations at the runtime boundary.
- Define how operational config interacts with portable mesh RDF without requiring absolute host paths in core data.
- Define whether first-pass conventional discovery includes files such as `/.sf-repo-access.ttl` and `~/.sf-local-access.ttl`.

## Testing

- Add focused runtime tests proving `workingFilePath` and `targetMeshPath` reject `../...` paths when no operational allowance is configured.
- Add focused runtime tests proving `workingFilePath` and `targetMeshPath` can resolve `../...` paths when they remain within configured allowed local directories.
- Add fail-closed tests for malformed operational config.
- Add CLI-facing coverage proving the CLI can load and apply the operational config rather than silently bypassing it.
- Add daemon-facing coverage later if or when daemon runtime loading becomes real enough to exercise the same policy surface.
- Add focused tests proving disallowed `workingAccessUrl` and `targetAccessUrl` values are rejected before any network access is attempted.

## Non-Goals

- Rebuilding the full old `sflo-host` ontology as-is.
- Designing the final daemon hosting/service configuration surface.
- Taking on log rotation, log sinks, API toggles, SPARQL toggles, or static-server toggles in this same slice.
- Widening remote URL fetching before local allowed-directory policy is settled.
- Persisting machine-specific absolute host paths in mesh RDF.
- Making machine-local trust policy a default mesh-managed support artifact concern.

## Implementation Plan

### Phase 0: Review And Narrow The Problem

- [x] Review `dependencies/github.com/semantic-flow/ontology/old/sflo-host-ontology.jsonld` and explicitly separate reusable ideas from daemon-service baggage.
- [x] Review the current config ontology line and decide whether operational/runtime-resolution config belongs there or in a narrow companion ontology.
- [x] Cross-link this task from [[wd.task.2026.2026-04-08_1545-resource-page-definition-and-sources]] and roadmap items that currently point at operational-config questions without a dedicated home.

### Phase 1: Define The Config Contract

- [x] Draft the first-pass operational-config vocabulary and example shapes.
- [x] Draft the split between repo-traveling access policy and machine-local access policy, including likely conventions such as `/.sf-repo-access.ttl` and `~/.sf-local-access.ttl`.
- [x] Define the runtime-facing semantics for allowed local directories, remote-access policy, and fail-closed behavior.
- [x] Define CLI/daemon/shared consumption expectations and config precedence rules.
- [x] Decide whether the first-pass access checker compares resolved paths against allowed roots, allowed prefixes, or richer directory resources.
- [x] Decide whether the first-pass config should support one mesh root, multiple mesh roots, or an abstract runtime context with multiple allowed roots.

### Phase 2: Implement Local Boundary Policy

- [x] Add runtime loading for the new operational config in a way that CLI and daemon can both consume.
- [x] Broaden `workingFilePath` handling so `../...` is allowed only within configured allowed local directories.
- [x] Broaden `targetMeshPath` handling so `../...` is allowed only within configured allowed local directories.
- [x] Keep fail-closed behavior for malformed paths, missing config, or paths outside the configured boundary.

### Phase 3: Defer Or Gate Remote Policy Carefully

- [ ] Add explicit policy gating for `workingAccessUrl`.
- [ ] Add explicit policy gating for `targetAccessUrl`.
- [ ] Decide whether remote access remains model-only in the first operational-config slice or whether narrowly scoped runtime use is justified immediately after local-boundary support lands.
- [ ] Decide whether `integrate`, which already needs to support workspace-local and policy-approved extra-mesh local file association, should broaden further into policy-gated remote/external locator handling, or whether remote-origin association should stay centered on `import` while `integrate` remains the local-byte-binding surface.

### Phase 4: Validate And Align Notes

- [x] Add focused unit, integration, and CLI coverage for local-boundary policy.
- [ ] Update [[wd.general-guidance]] or [[wd.codebase-overview]] if operational-config loading becomes a standard runtime seam.
- [x] Update linked task/spec notes once the config contract is settled enough that they should cite this task rather than open-ended host-config precedent.
