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
- Keep operational config separate from core mesh RDF so persisted mesh data remains portable across users, machines, and checkout locations.

## Summary

We now have core vocabulary for current-byte locators and direct resolution targets:

- `workingFilePath`
- `workingAccessUrl`
- `targetMeshPath`
- `targetAccessUrl`

What we do not yet have is the operational policy layer that says when a runtime may actually use them.

That policy is no longer just a daemon concern. The current Weave CLI already needs it, because the next runtime slice is controlled extra-mesh local targeting for `../...` paths, and later slices may need explicit remote access policy too.

The old `sflo-host` ontology is useful as precedent because it recognized that application/runtime behavior needs its own config surface. But it is not the right model to copy forward directly. Its center of gravity is `HostServiceConfig`, logging channels, contained service toggles, port/host/scheme binding, and service-host mesh registration. That is mostly daemon or long-running-host shape, not the shared runtime-resolution policy that current CLI and daemon both need.

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

That does not mean the CLI and daemon need identical discovery behavior. It means the policy model and semantics should be shared even if the loading surface differs.

For example, it would be reasonable for the CLI to accept an explicit config file path while a daemon also supports a conventional config location. But both should hydrate the same underlying operational-config model.

### Relationship to the current config ontology

The modern config ontology at `dependencies/github.com/semantic-flow/ontology/semantic-flow-config-ontology.ttl` already provides a generic `Config` / `ConfigArtifact` model. That suggests a likely direction:

- keep generic config attachment in the config ontology line
- define a new operational/runtime-resolution config vocabulary on top of that line, or adjacent to it
- avoid dropping runtime policy directly into the core ontology

The exact namespace split is still open. It may live in the current config ontology, or in a narrowly scoped companion ontology if that keeps concerns clearer.

### Relationship to `1545`

This task is now the natural home for the operational-config questions that `[[wd.task.2026.2026-04-08_1545-resource-page-definition-and-sources]]` should not have to carry by itself:

- allowed-directory rules for `targetMeshPath` and `workingFilePath`
- remote-use policy for `targetAccessUrl`
- remote-use policy for `workingAccessUrl`
- CLI-versus-daemon loading and precedence

That lets `1545` stay focused on page-definition behavior instead of turning into the operational-policy task too.

## Open Issues

- Whether the new vocabulary should live directly in `semantic-flow-config-ontology.ttl` or in a separate operational/host companion ontology.
- Whether the first-pass root object should be named something like `OperationalConfig`, `RuntimeResolutionConfig`, or `HostRuntimeConfig`.
- How config discovery and precedence should work across explicit CLI arguments, environment, and optional default file locations.
- Whether local-directory policy should be represented as allowed roots, allowed path prefixes, or richer directory resources.
- How to express policy for multiple meshes in one workspace or one daemon process without reviving the old `meshPaths` service-registration framing as the primary abstraction.
- Whether remote policy should be all-or-nothing at first or should immediately support scheme/origin allowlists.
- How operational config should be surfaced in tests so extra-mesh path cases are easy to exercise without hiding policy in global environment state.
- Whether logging/service-host concerns from the old `sflo-host` line should remain explicitly out of scope for this task or be listed as later follow-on work.

## Decisions

- Operational resolution policy should be treated as a first-class config concern rather than as ad hoc runtime branching.
- The new operational-config direction must be usable by CLI and daemon, not daemon-only.
- The old `sflo-host` ontology is precedent, not a drop-in model.
- Service-host concerns such as port binding, contained service toggles, and log rotation should not define the center of this task.
- Allowed-directory rules for `workingFilePath` and `targetMeshPath` should live in operational config, not in persisted mesh RDF.
- Remote-use rules for `workingAccessUrl` and `targetAccessUrl` should also live in operational config, not in persisted mesh RDF.
- The first widening target should be controlled extra-mesh local path resolution through configured allowed directories, not remote fetching.
- Runtime behavior should stay fail-closed when operational config is missing, malformed, or disallows the requested path or URL.

## Contract Changes

- Introduce a modern operational-config task and vocabulary direction for runtime resolution policy.
- Define a shared config shape that can be consumed by both CLI and daemon execution surfaces.
- Define allowed local-directory policy for `workingFilePath` and `targetMeshPath`.
- Define remote-access policy for `workingAccessUrl` and `targetAccessUrl`.
- Define config-loading and precedence expectations at the runtime boundary.
- Define how operational config interacts with portable mesh RDF without requiring absolute host paths in core data.

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

## Implementation Plan

### Phase 0: Review And Narrow The Problem

- [ ] Review `dependencies/github.com/semantic-flow/ontology/old/sflo-host-ontology.jsonld` and explicitly separate reusable ideas from daemon-service baggage.
- [ ] Review the current config ontology line and decide whether operational/runtime-resolution config belongs there or in a narrow companion ontology.
- [ ] Cross-link this task from [[wd.task.2026.2026-04-08_1545-resource-page-definition-and-sources]] and roadmap items that currently point at operational-config questions without a dedicated home.

### Phase 1: Define The Config Contract

- [ ] Draft the first-pass operational-config vocabulary and example shapes.
- [ ] Define the runtime-facing semantics for allowed local directories, remote-access policy, and fail-closed behavior.
- [ ] Define CLI/daemon/shared consumption expectations and config precedence rules.
- [ ] Decide whether the first-pass config should support one mesh root, multiple mesh roots, or an abstract runtime context with multiple allowed roots.

### Phase 2: Implement Local Boundary Policy

- [ ] Add runtime loading for the new operational config in a way that CLI and daemon can both consume.
- [ ] Broaden `workingFilePath` handling so `../...` is allowed only within configured allowed local directories.
- [ ] Broaden `targetMeshPath` handling so `../...` is allowed only within configured allowed local directories.
- [ ] Keep fail-closed behavior for malformed paths, missing config, or paths outside the configured boundary.

### Phase 3: Defer Or Gate Remote Policy Carefully

- [ ] Add explicit policy gating for `workingAccessUrl`.
- [ ] Add explicit policy gating for `targetAccessUrl`.
- [ ] Decide whether remote access remains model-only in the first operational-config slice or whether narrowly scoped runtime use is justified immediately after local-boundary support lands.

### Phase 4: Validate And Align Notes

- [ ] Add focused unit, integration, and CLI coverage for local-boundary policy.
- [ ] Update [[wd.general-guidance]] or [[wd.codebase-overview]] if operational-config loading becomes a standard runtime seam.
- [ ] Update linked task/spec notes once the config contract is settled enough that they should cite this task rather than open-ended host-config precedent.
