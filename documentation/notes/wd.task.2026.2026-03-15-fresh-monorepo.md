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
- a long-running `daemon` as the main service process, which implements the HTTP Semantic Flow API
- official clients such as CLI and web app talking primarily to the daemon in remote mode
- the CLI also supporting local or in-process execution against shared logic, with no daemon required
- support for long-running jobs such as `weave integrate <tree>` and `weave version`
- checked-out sibling repos grouped under one local folder named `dependencies/`
- a flatter first-pass code layout than Kato, with semantic boundaries expressed in `src/` before any forced `apps/` or `packages/` split
- the public Semantic Flow API contract continuing to live in `semantic-flow-framework` for now rather than in a day-one separate spec repo
- user-facing documentation living in `documentation/notes/wu.*`, with shared top-level notes such as `product-vision` and `roadmap` remaining top-level for now

This task is not yet about implementing the new monorepo. It is about freezing the repo shape and the architecture-review surface first.

## Current Initial Monorepo Layout

Suggested working name: `weave`

```text
weave/
  src/
    core/                   # semantic operations, domain rules, shared request/result types
    runtime/                # workspace execution, RDF, rendering, config, jobs, logging, locking
    daemon/                 # HTTP API host over core/runtime
    cli/                    # command routing and interactive prompts
    web/                    # browser client support and local operator surface for Shuttle
  documentation/
    notes/
  tests/
    e2e/
    integration/
    fixtures/
  examples/
  dependencies/             # checked-out sibling repos for local context
```

If those seams later prove strong enough to deserve separate packages or apps, they can be split out after the first implementation exists. The initial bias should be to keep the codebase flatter and easier to move through.

## Tentative Repo Boundary Choices

### Keep in the main monorepo

- daemon
- CLI
- web client (`Shuttle`)
- shared core/runtime code
- weave-specific documentation
- test fixtures and examples

### Existing separate repos to continue using

- ontology repo
- weave dev archive
- semantic-flow-framework
- accord

## Other Repos To Create Or Consider

### Not day-one requirements

- `semantic-flow-api-spec`
  - not required yet
  - the public Semantic Flow API contract currently lives in `semantic-flow-framework`
  - reconsider only if the contract needs independent release cadence or governance

## Status

This task is now largely decision-setting rather than implementation-bearing.

The major repo-shape decisions are effectively locked:

- `dependencies/` is the sibling-repo folder
- the public contract stays in `semantic-flow-framework` for now
- Weave starts flatter under `src/`
- the browser client is currently named `Shuttle`
- a TUI remains explicitly deferred

The next meaningful work should happen in a new implementation-focused task note rather than by extending this note into a pseudo-backlog.

## Local Reference Repo Strategy

Current preference:

- keep checked-out sibling repos under a single top-level folder such as `dependencies/`
- use that folder for ontologies, old sflo/kato material, API spec repo, docs repo, and planning repo when useful
- keep this separate from the first-party workspace packages so humans, tools, and LLMs can clearly tell what is “the product” versus “reference context”
