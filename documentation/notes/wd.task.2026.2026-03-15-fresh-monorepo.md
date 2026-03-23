---
id: 51kutfeo8udd9dxgfzypi4o
title: 2026 03 15 Fresh Monorepo
desc: ''
updated: 1774242813413
created: 1773619811066
---

## Goal

Define the initial repository topology for a fresh Weave start, including:

- the main code monorepo layout
- other repos to create or defer
- how to organize checked-out reference repos locally
- an architecture-planning subtask that reviews what to carry over from kato/sflo and what to reset
- the major technical and product decisions that must be made before implementation hardens

## Summary

We are starting over with a fresh Weave codebase.

The current direction is:

- one main monorepo for code and code-adjacent development documentation
- a long-running **daemon*- as the main service process, which exposes the **Weave API**
- official clients such as CLI, web app, and possibly a TUI talking primarily to the daemon
- support for long-running jobs such as `weave integrate <tree>` and `weave version`
- more repo modularization than kato used, because repos can be checked out side by side for local reference, search, and LLM context
- checked-out sibling repos grouped under one local folder such as `dependencies/` or `references/`

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
  documentation/            # code-adjacent development docs
    notes/                  # Dendron vault where most (if not all) documentation lives in markdown
      assets/               # images, etc references in the Dendron notes
  tests/
    e2e/
    integration/
    fixtures/
  examples/
  dependencies/            # or references/ ; checked-out sibling repos for local context
```

## Tentative Repo Boundary Choices

### Keep in the main monorepo

- daemon
- CLI
- web app
- shared packages
- weave-specific documentation
- test fixtures and examples

### Existing separate repos to continue using

- ontology repo
- weave dev archive
- semantic-flow-platf

## Other Repos To Create Or Consider

### Likely to create soon

- `semantic-flow-api-spec`
  - public API contract repo, if the Weave API is to be treated as a separately versioned/public artifact

## Local Reference Repo Strategy

Current preference:

- keep checked-out sibling repos under a single top-level folder such as `dependencies/`
- use that folder for ontologies, old sflo/kato material, API spec repo, docs repo, and planning repo when useful
- keep this separate from the first-party workspace packages so humans, tools, and LLMs can clearly tell what is “the product” versus “reference context”

Open naming choice:

- `dependencies/`
- `references/`

