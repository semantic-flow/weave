---
id: bw3amcysclo64aty396b378
title: 2026 03 20 Architecture Planning
desc: ''
updated: 1774047470973
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

### Suggested Prompt

```
We’re defining an architecture-planning subtask for a fresh Weave reset.

Review the [[ont.summary.core]] and reference the ontology as necessary:

- /home/djradon/hub/semantic-flow/weave/dependencies/github.com/semantic-flow/ontology/notes/ont.summary.core.md
- /home/djradon/hub/semantic-flow/weave/dependencies/github.com/semantic-flow/ontology/semantic-flow-core-ontology.ttl

Reading these local files for context on my previous architecture:

- /home/djradon/hub/semantic-flow/sflo/documentation/dev.general-guidance.md
- /home/djradon/hub/semantic-flow/sflo/documentation/product.sflo-host.md
- /home/djradon/hub/semantic-flow/sflo/documentation/product.plugins.sflo-api.md
- /home/djradon/hub/semantic-flow/sflo/dependencies/github.com/semantic-flow/sflo-dendron-notes/sflo.architecture.md

Also review these more lightly, mainly for terminology drift and any ideas still worth carrying over:

- /home/djradon/hub/semantic-flow/sflo/documentation/product.cli.md
- /home/djradon/hub/semantic-flow/sflo/documentation/product.plugins.sflo-web.md
- /home/djradon/hub/semantic-flow/sflo/documentation/product.core.md

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

## Open Decisions

### Runtime and RDF viability

- Before committing to Deno, should we run a proof of concept to confirm that N3 and Comunica are workable in Deno for backend use?
- If Deno is only partly workable, what fallback posture is acceptable?
  - full Node runtime
  - Deno plus isolated Node subprocesses for specific RDF libraries
  - Deno only for some apps, Node for others

### Daemon and API shape

- Is the “API” really an app, or is the more accurate concept a **daemon*- that implements the Weave API?
- Do we standardize on “daemon” as the runtime/service name and “API” as the contract it exposes?
- Should the CLI, web app, and future TUI be described as clients of the daemon rather than clients of the API in the abstract?

### Public API specification

- Should the Weave API spec live in a separate repo from day one?
- How much of the public contract should be stabilized early versus discovered during daemon and CLI implementation?

### Long-running operations and protocol choice

- Should the public contract use:
  - OpenAPI only
  - AsyncAPI only
  - a hybrid model
- If OpenAPI remains primary, how are long-running weave operations modeled?
  - job dispatch
  - polling
  - server-sent events
  - websocket or message-stream side channel
- Which operations must be first-class jobs?
  - `weave integrate <tree>`
  - `weave version`
  - large-scale validation
  - large-scale regeneration

### User docs repo boundary

- Do user docs stay inside the monorepo for the initial implementation?
- If yes, what constraints ensure they can move out later without major surgery?

### Reference repo folder naming

- `dependencies/` or `references/`?

### Package boundaries

- Do we create both `logging` and `observability` packages now?
- Which cross-cutting concerns belong in `core` versus dedicated packages?

## TODO

- [ ] Decide whether to pin down other planning or architecture documentation before reviewing Kato and old sflo documents
- [ ] Freeze the tentative monorepo layout or revise it
- [ ] Decide whether `weave-api-spec` is a day-one repo
- [ ] Create the architecture-planning subtask
- [ ] Review `product.sflo-host`, `product.plugins.sflo-api`, and `sflo.architecture` in depth
- [ ] Record a carryover/reset list from kato/sflo
- [ ] Decide whether a Deno + RDF proof of concept is required before locking runtime choice
- [ ] Decide whether the service runtime is named “daemon”
- [ ] Decide how long-running jobs are represented in the public API contract

## Non-Goals

- implementing the monorepo in this task
- rewriting all old product docs now
- preserving old sflo terminology without translation
- deciding the entire web UI architecture up front
