---
id: 51kutfeo8udd9dxgfzypi4o
title: 2026 03 15 Fresh Monorepo
desc: ''
updated: 1773619826601
created: 1773619811066
---

## Goal

Define the initial repository topology for a fresh Weave start, including:

* the main code monorepo layout
* other repos to create or defer
* how to organize checked-out reference repos locally
* an architecture-planning subtask that reviews what to carry over from kato/sflo and what to reset
* the major technical and product decisions that must be made before implementation hardens

## Summary

We are starting over with a fresh Weave codebase.

The current direction is:

* one main monorepo for code and code-adjacent development documentation
* a long-running **daemon** as the main service process, which exposes the **Weave API**
* official clients such as CLI, web app, and possibly a TUI talking primarily to the daemon
* support for long-running jobs such as `weave integrate <tree>` and `weave version`
* more repo modularization than kato used, because repos can be checked out side by side for local reference, search, and LLM context
* checked-out sibling repos grouped under one local folder such as `dependencies/` or `references/`

This task is not yet about implementing the new monorepo. It is about freezing the repo shape and the architecture-review surface first.

## Tentative Main Monorepo Layout

Suggested working name: `weave`

```text
weave/
  apps/
    daemon/                 # long-running process; implements the Weave API
    cli/                    # official command-line client
    web/                    # official web application
    tui/                    # optional later terminal UI
  packages/
    core/                   # domain model, operations, common types
    rdf/                    # RDF loading, serialization, validation helpers
    config/                 # JSON-LD config loading and resolution
    jobs/                   # long-running job model, progress, cancellation
    logging/                # structured logging API and helpers
    observability/          # tracing/metrics/OpenTelemetry integration
    fs/                     # filesystem scanning, locking, atomic writes
    render/                 # resource-page rendering and archetype logic
    api-client/             # typed client for the daemon API
    utils/                  # general shared utilities
  documentation/
    dev/                    # code-adjacent development docs
    user/                   # tentative; keep extractable if audience/cadence diverges
  tests/
    e2e/
    integration/
    fixtures/
  examples/
  dependencies/            # or references/ ; checked-out sibling repos for local context
```

## Tentative Repo Boundary Choices

### Keep in the main monorepo

* daemon
* CLI
* web app
* shared packages
* dev docs
* test fixtures and examples

### Tentatively keep in the monorepo, but with extraction discipline

* user docs

That means:

* no deep coupling from user docs into app internals
* a clear content/build boundary so user docs can become their own repo later
* site integration should happen through Weave/content integration, not because docs are forced to live in the same repo forever

### Existing separate repos to continue using

* ontology repos

## Other Repos To Create Or Consider

### Likely to create soon

* `weave-api-spec`
  * public API contract repo, if the Weave API is to be treated as a separately versioned/public artifact
* `weave-project`
  * feature ideas, tasks, roadmap, active planning notes

### Create later if needed

* `weave-user-docs`
  * only if user docs truly need a separate release cadence, site, permissions model, or editorial workflow
* `weave-project-archive`
  * completed/cancelled tasks and old conversations, if the main planning repo becomes too noisy

## Local Reference Repo Strategy

Current preference:

* keep checked-out sibling repos under a single top-level folder such as `dependencies/`
* use that folder for ontologies, old sflo/kato material, API spec repo, docs repo, and planning repo when useful
* keep this separate from the first-party workspace packages so humans, tools, and LLMs can clearly tell what is “the product” versus “reference context”

Open naming choice:

* `dependencies/`
* `references/`

## Architecture Planning Subtask

Add a dedicated architecture-planning subtask that reviews kato/sflo and decides what carries over versus what resets.

### Purpose

Produce a concise carryover map for:

* concepts worth preserving
* implementation ideas worth preserving
* terminology that must be translated
* assumptions that should be dropped entirely

### Explicit review themes

* daemon/service-first architecture
* CLI/web/TUI as clients of the daemon
* long-running job model for weave operations
* filesystem scanning and scoped config discovery
* locking, watch/reload, and conflict avoidance
* static ResourcePage generation and site/API symmetry
* whether “RDF everywhere” remains the right implementation posture, or whether RDF should be concentrated at the boundaries and persisted forms
* Deno runtime viability for RDF tooling
* logging and observability package boundaries

### Expected outputs

* a carry-forward list
* a reset/remove list
* a terminology-translation list
* a shortlist of proof-of-concept tasks needed before committing to the new stack

### Suggested Prompt

```
We’re defining an architecture-planning subtask for a fresh Weave reset.

Please begin by reading these local files for context:

- /home/djradon/hub/semantic-flow/sflo/documentation/dev.general-guidance.md
- /home/djradon/hub/semantic-flow/sflo/documentation/task.2026.2026-03-15-fresh-monorepo.md
- /home/djradon/hub/semantic-flow/sflo/documentation/product.sflo-host.md
- /home/djradon/hub/semantic-flow/sflo/documentation/product.plugins.sflo-api.md
- /home/djradon/hub/semantic-flow/sflo/dependencies/github.com/semantic-flow/sflo-dendron-notes/sflo.architecture.md

Also review these more lightly, mainly for terminology drift and any ideas still worth carrying over:

- /home/djradon/hub/semantic-flow/sflo/documentation/product.cli.md
- /home/djradon/hub/semantic-flow/sflo/documentation/product.plugins.sflo-web.md
- /home/djradon/hub/semantic-flow/sflo/documentation/product.core.md

Context and current direction:

- We are starting over with a fresh Weave codebase.
- The new repo will likely be a monorepo with apps such as:
  - daemon
  - cli
  - web
  - maybe later tui
- The daemon is the long-running service process and implements the Weave API.
- Official clients should be treated primarily as clients of the daemon.
- Long-running operations matter a lot, such as:
  - `weave integrate <tree>`
  - `weave version`
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

* `documentation/product.sflo-host.md`
  * central control, locking, watchers, and coordination remain highly relevant
* `documentation/product.plugins.sflo-api.md`
  * noun URLs, `_working` semantics, job-oriented API design, and API/site symmetry are still highly relevant
* `dependencies/github.com/semantic-flow/sflo-dendron-notes/sflo.architecture.md`
  * review the service-first split, config inheritance, job/process shape, and stack assumptions

### Review lightly / translate terminology only

* `documentation/product.cli.md`
  * likely still useful, but reframe the CLI as a daemon client first
* `documentation/product.plugins.sflo-web.md`
  * mostly a UI-approach note; useful only at a high level for now
* `documentation/product.core.md`
  * too thin to drive design by itself
* `documentation/product.plugins.md`
* `documentation/product.plugins.mesh-server.md`
* `documentation/product.plugins.api-docs.md`

### Treat as likely outdated unless reconfirmed

* old `Node` terminology
* `_next` / “current flips” language
* assumptions that the API is a thin layer rather than a daemon-backed job system
* fragment-generation and HTMX-specific ideas that depend on old UI assumptions
* stack picks that were made before the current restart, especially where the new model is now more Knop-first and more explicit about long-running operations

## Open Decisions

### Runtime and RDF viability

* Before committing to Deno, should we run a proof of concept to confirm that N3 and Comunica are workable in Deno for backend use?
* If Deno is only partly workable, what fallback posture is acceptable?
  * full Node runtime
  * Deno plus isolated Node subprocesses for specific RDF libraries
  * Deno only for some apps, Node for others

### Daemon and API shape

* Is the “API” really an app, or is the more accurate concept a **daemon** that implements the Weave API?
* Do we standardize on “daemon” as the runtime/service name and “API” as the contract it exposes?
* Should the CLI, web app, and future TUI be described as clients of the daemon rather than clients of the API in the abstract?

### Public API specification

* Should the Weave API spec live in a separate repo from day one?
* How much of the public contract should be stabilized early versus discovered during daemon and CLI implementation?

### Long-running operations and protocol choice

* Should the public contract use:
  * OpenAPI only
  * AsyncAPI only
  * a hybrid model
* If OpenAPI remains primary, how are long-running weave operations modeled?
  * job dispatch
  * polling
  * server-sent events
  * websocket or message-stream side channel
* Which operations must be first-class jobs?
  * `weave integrate <tree>`
  * `weave version`
  * large-scale validation
  * large-scale regeneration

### User docs repo boundary

* Do user docs stay inside the monorepo for the initial implementation?
* If yes, what constraints ensure they can move out later without major surgery?

### Reference repo folder naming

* `dependencies/` or `references/`?

### Package boundaries

* Do we create both `logging` and `observability` packages now?
* Which cross-cutting concerns belong in `core` versus dedicated packages?

## TODO

- [ ] Freeze the tentative monorepo layout or revise it
- [ ] Decide whether user docs start inside the monorepo or in their own repo
- [ ] Decide whether `weave-api-spec` is a day-one repo
- [ ] Create the architecture-planning subtask
- [ ] Review `product.sflo-host`, `product.plugins.sflo-api`, and `sflo.architecture` in depth
- [ ] Record a carryover/reset list from kato/sflo
- [ ] Decide whether a Deno + RDF proof of concept is required before locking runtime choice
- [ ] Decide whether the service runtime is named “daemon”
- [ ] Decide how long-running jobs are represented in the public API contract

## Non-Goals

* implementing the monorepo in this task
* rewriting all old product docs now
* preserving old sflo terminology without translation
* deciding the entire web UI architecture up front
