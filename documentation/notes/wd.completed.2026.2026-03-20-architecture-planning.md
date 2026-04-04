---
id: bw3amcysclo64aty396b378
title: 2026 03 20 Architecture Planning
desc: ''
updated: 1774284812485
created: 1774046567965
---


### Purpose

Produce a concise carryover map for:

- concepts worth preserving
- implementation ideas worth preserving
- terminology that must be translated
- assumptions that should be dropped entirely

### Explicit review themes

- daemon/service-first architecture
- CLI/web/TUI as clients of the daemon
- long-running job model for weave operations
- filesystem scanning and scoped config discovery
- locking, watch/reload, and conflict avoidance
- static ResourcePage generation and site/API symmetry
- whether “RDF everywhere” remains the right implementation posture, or whether RDF should be concentrated at the boundaries and persisted forms
- Deno runtime viability for RDF tooling
- logging and observability package boundaries

### Expected outputs

- a carry-forward list
- a reset/remove list
- a terminology-translation list
- a shortlist of proof-of-concept tasks needed before committing to the new stack

## Status Update

This note is now partly historical.

Several questions that were open when the note was created have since been settled by later framework work, the `mesh-alice-bio` fixture ladder, and the working Accord checker.

The remaining implementation-bearing work has been moved into [[wd.task.2026.2026-04-03-weave-bootstrap-mesh-create]] so this note can remain a planning and carry-forward artifact rather than acting like an implementation backlog.

## Carry Forward

- daemon as service runtime implementing the public HTTP contract
- shared `core` and `runtime` below the daemon
- CLI remote plus local or in-process execution
- job-centric submitted semantic operations
- OpenAPI primary, Hydra layer, SSE-friendly live progress
- Deno-first runtime
- RDF-heavy implementation with persistent config in RDF, probably JSON-LD
- fail-closed config and startup behavior
- locking, watch/reload, and filesystem discipline from the older host/runtime thinking
- site-generation and API symmetry as a long-term design pressure
- Kato-style structured operational and audit logging as the starting logging model

## Reset or Remove

- treating Deno RDF viability as still speculative
- treating the daemon as the only place where semantics can run locally
- treating the public API as something to finish completely before implementation starts
- forcing an `apps/` plus `packages/` split before code exists
- reintroducing old `Node` terminology or `_next`/current-flip modeling
- dragging in full observability, TUI, or other large subsystem ambitions before the first slice is proven

## Terminology Translation

- old `Node` language becomes `Knop`
- `API` means the public Semantic Flow contract
- `daemon` means the Weave service runtime implementing the HTTP API
- `web app` currently means the browser client named `Shuttle`
- `interactive CLI` means command-scoped prompting, not a TUI by default

## Locked Decisions

### Runtime and RDF viability

- Weave is now Deno-first.
- A separate “can Deno handle RDF tooling?” proof-of-concept is no longer required before bootstrap work.
- The practical basis is the current Accord implementation and corpus checks, which already use `n3`, `@comunica/query-sparql`, and RDF canonical comparison successfully under Deno.

### Daemon and API shape

- The Semantic Flow API is the public contract.
- The daemon is the long-running service runtime and HTTP implementation of that contract.
- Shared semantic logic should live below the daemon in `core` and `runtime`.
- The CLI and web app are clients of the daemon in remote mode, but the CLI must also support local or in-process execution against the same shared logic.

### Public API specification

- OpenAPI remains the canonical public HTTP contract.
- Hydra remains the preferred hypermedia layer for JSON-LD representations.
- AsyncAPI is, at most, a later companion contract for standardized public event channels.
- The public contract currently lives in `semantic-flow-framework`; a separate day-one API-spec repo is not required.
- The public contract should start thin and be co-developed with the first implementation slices rather than being exhaustively specified up front.

### Long-running work

- Submitted semantic operations should be represented canonically as `Job` resources, even when some implementations complete quickly.
- Polling against `Job` resources is the baseline.
- SSE is the preferred live-progress transport for HTTP clients, including the CLI in remote mode.
- Not every HTTP interaction is a job, but first-class semantic operations should follow the job model for public API consistency.

### Repository layout

- The initial Weave codebase should start flatter under `src/` rather than forcing an `apps/` plus `packages/` split before code exists.
- The current target boundary is:
  - `src/core`
  - `src/runtime`
  - `src/daemon`
  - `src/cli`
  - `src/web`
- Checked-out sibling repos should continue living under `dependencies/`.

### Logging and observability

- Reuse Kato logging concepts rather than old sflo logging implementation.
- Carry forward:
  - an in-repo structured logger facade
  - explicit operational vs audit channel separation
  - config-driven log levels
  - an adapter seam for a more capable backend later
- Prefer reusing Kato's Deno-native logging implementation substantially if the extraction stays narrow enough, rather than rewriting the same logging layer from scratch.
- Do not start Weave with a separate observability package or a full OpenTelemetry program.
- First-pass Weave logging should be Deno-native, local-first, and live under `runtime`.

### CLI interaction

- Use Cliffy for first-pass command routing and interactive prompts.
- Interactive command flows are a CLI concern, not a reason to introduce a TUI framework immediately.
- Defer TUI framework adoption until there is a real need for a persistent terminal app rather than command-scoped prompting.

### Config direction

- Persistent Weave configuration should be RDF, probably JSON-LD.
- Persistent config should be queryable via SPARQL.
- This direction applies to stored or resolved config surfaces; it does not require every ephemeral CLI flag to be persisted immediately as RDF.

### Web client naming

- The current browser client name is `Shuttle`.
- The internal `src/web` label is still acceptable as an implementation boundary even if the user-facing product name is different.

### Suggested Prompt

```
We’re defining an architecture-planning subtask for a fresh Weave reset.

Review the [[ont.summary.core]] and reference the ontology as necessary:

- /home/djradon/hub/semantic-flow/weave/dependencies/github.com/semantic-flow/ontology/notes/ont.summary.core.md
- /home/djradon/hub/semantic-flow/weave/dependencies/github.com/semantic-flow/ontology/semantic-flow-core-ontology.ttl

Reading these local files for context on my previous architecture:

- /home/djradon/hub/semantic-flow/weave/dependencies/github.com/semantic-flow/sflo/documentation/dev.general-guidance.md
- /home/djradon/hub/semantic-flow/weave/dependencies/github.com/semantic-flow/sflo/documentation/product.sflo-host.md
- /home/djradon/hub/semantic-flow/weave/dependencies/github.com/semantic-flow/sflo/documentation/product.plugins.sflo-api.md
- /home/djradon/hub/semantic-flow/sflo/dependencies/github.com/semantic-flow/sflo-dendron-notes/sflo.architecture.md

Also review these more lightly, mainly for terminology drift and any ideas still worth carrying over:

- /home/djradon/hub/semantic-flow/weave/dependencies/github.com/semantic-flow/sflo/documentation/product.cli.md
- /home/djradon/hub/semantic-flow/weave/dependencies/github.com/semantic-flow/sflo/documentation/product.plugins.sflo-web.md
- /home/djradon/hub/semantic-flow/weave/dependencies/github.com/semantic-flow/sflo/documentation/product.core.md

Read this for general Kato guidance:

- /home/djradon/hub/spectacular-voyage/kato/dev-docs/notes/dev.general-guidance.md

Kato is Deno-based, old sflo stuff was going to be Node.

Context and current direction:

- We are starting over with a fresh Weave codebase.
- The new repo will likely be a monorepo with apps such as:
  - daemon
  - cli
  - web
  - maybe later tui
  - api web interface
  - comunica/n3-backed RDF datastore with custom SPARQL query engine
- The daemon is the long-running service process and implements the Weave API.
- Official clients should be treated primarily as clients of the daemon.
  - Possibly the cli could both interface with the Daemon AND implement some of the Weave API on its own.
- Long-running operations matter a lot, such as:
  - `weave integrate <tree>`
  - `weave version`
  - 'weave mesh create'
  - large validation/regeneration jobs
- Old terminology is often outdated:
  - `Node` should generally now be treated as `Knop`
  - older `_next` / “current flips” language is suspicious
- We want to review what to preserve from kato/sflo and what to change.
- One likely change is being more explicit about jobs, daemon coordination, and possibly a public API spec.
- Another likely change is revisiting the “RDF everywhere” implementation posture.
- Before committing to Deno, we may want a proof of concept for backend RDF tooling, especially N3 and Comunica compatibility.

What I want from you:

1. Review the architecture material and separate it into:
   - carry forward
   - reset/remove
   - terminology translation
   - still-open architecture questions

2. Recommend how deeply each old document or subsystem should influence the new architecture.

3. Propose the contents of a new architecture-planning task note for the fresh Weave repo.
   - Do not create a new file automatically.
   - Instead, draft the note content in chat so we can review it first.

4. Pay special attention to:
   - daemon vs API naming and responsibility split
   - long-running job model
   - whether OpenAPI alone is enough or whether AsyncAPI/hybrid should be considered
   - whether Deno needs a proof of concept before committing
   - what to do with RDF, config resolution, locking, file watching, and ResourcePage generation
   - what parts of the old sflo-host / sflo-api thinking are still solid

Please keep the answer architectural, not implementation-heavy.
I want a planning document and analysis, not code changes.

If you discover documentation that seems unclear, stale, or contradictory, call that out explicitly.
```


## How Deeply To Review The Old Architecture Notes

### Review in depth

- `documentation/product.sflo-host.md`
  - central control, locking, watchers, and coordination remain highly relevant
- `documentation/product.plugins.sflo-api.md`
  - noun URLs, `_working` semantics, job-oriented API design, and API/site symmetry are still highly relevant
- `dependencies/github.com/semantic-flow/sflo-dendron-notes/sflo.architecture.md`
  - review the service-first split, config inheritance, job/process shape, and stack assumptions

### Review lightly / translate terminology only

- `documentation/product.cli.md`
  - likely still useful, but reframe the CLI as a daemon client first
- `documentation/product.plugins.sflo-web.md`
  - mostly a UI-approach note; useful only at a high level for now
- `documentation/product.core.md`
  - too thin to drive design by itself
- `documentation/product.plugins.md`
- `documentation/product.plugins.mesh-server.md`
- `documentation/product.plugins.api-docs.md`

### Treat as likely outdated unless reconfirmed

- old `Node` terminology
- `_next` / “current flips” language
- assumptions that the API is a thin layer rather than a daemon-backed job system
- fragment-generation and HTMX-specific ideas that depend on old UI assumptions
- stack picks that were made before the current restart, especially where the new model is now more Knop-first and more explicit about long-running operations

## Remaining Open Questions

### Public API specification detail

- The first implementation slice to carry through local execution, Accord comparison, and HTTP-facing examples should be `mesh create`.
- After `mesh create`, decide whether the next carried slice should be `weave` itself or the first Knop/payload operation.

### Long-running operations and protocol choice

- Which operations must be first-class jobs?
  - `weave integrate <tree>`
  - `weave version`
  - large-scale validation
  - large-scale regeneration

### User docs repo boundary

- User docs stay inside the monorepo for the initial implementation under `documentation/notes/wu.*`.
- Shared cross-audience notes may remain top-level for now.

### Package boundaries

- How small can the first Deno-native logging facade stay while still preserving the useful Kato patterns?
- Which runtime capabilities should stay grouped under `runtime` initially versus being split later?
  - logging
  - config
  - RDF helpers
  - renderers
  - job execution support

### Web and TUI naming

- Keep `web` as the internal implementation label for now.
- TUI remains deferred unless a real near-term use case appears.

## TODO

- [x] Decide whether to pin down other planning or architecture documentation before reviewing Kato and old sflo documents
- [x] Freeze the tentative monorepo layout or revise it
- [x] Decide whether `weave-api-spec` is a day-one repo
- [x] Create the architecture-planning subtask
- [x] Review `product.sflo-host`, `product.plugins.sflo-api`, and `sflo.architecture` in depth
- [x] Record a carryover/reset list from kato/sflo
- [x] Decide whether a Deno + RDF proof of concept is required before locking runtime choice
- [x] Decide whether the service runtime is named “daemon”
- [x] Decide how long-running jobs are represented in the public API contract
- [x] Choose the first-pass interactive CLI library
- [x] Choose the first carried implementation slice
- [x] Decide where initial user docs live
- [x] Name the browser client
- [x] Defer TUI
- [x] Write the first Weave bootstrap task note
- [c] Define the first-pass Deno-native runtime logging facade, carrying forward Kato operational/audit patterns
  - moved to [[wd.task.2026.2026-04-03-weave-bootstrap-mesh-create]]
- [c] Define the concrete `mesh create` implementation checklist and acceptance checks
  - moved to [[wd.task.2026.2026-04-03-weave-bootstrap-mesh-create]]

## Non-Goals

- implementing the monorepo in this task
- rewriting all old product docs now
- preserving old sflo terminology without translation
- deciding the entire web UI architecture up front
