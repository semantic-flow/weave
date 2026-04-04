---
id: wlo29fbckg2hkue5zu32lqs
title: Codebase Overview
desc: ''
updated: 1775265585659
created: 1773673181726
---

## Packages

### core
  semantic operations and domain rules
  mesh create, knop create, integrate, version, validate, generate, extract, weave
  request/result types shared by all callers
  current carried slices: `mesh create` request validation/support-artifact rendering, `knop create` planning over an existing mesh inventory, and the first narrow `weave` planning/rendering slice for `04-alice-knop-created` -> `05-alice-knop-created-woven`

### runtime
  local workspace execution
  filesystem, git, RDF loading, page generation, config, locking hooks
  job execution primitives, but not HTTP
  includes first-pass Deno-native structured operational and audit logging
  persistent config direction is RDF, probably JSON-LD, and should remain queryable via SPARQL
  current carried slices: local filesystem materialization for `mesh create`, `knop create`, and the first local `weave` pass over an existing workspace
  current logging slice: narrow Kato-inspired `LogRecord` / sink / `StructuredLogger` / `AuditLogger` JSONL layer

### daemon
  HTTP implementation of the public API
  Job resources, queueing, SSE, durable status, auth later
  translates HTTP <-> core/runtime calls
  current status: scaffold only, no daemon slice implemented yet

### cli
  terminal UX only
  first-pass command and interactive prompt surface uses Cliffy
  remote mode: talks to daemon over HTTP
  local mode: calls core/runtime directly
  no separate semantic logic
  current carried slices: top-level local `weave`, plus local `weave mesh create` and `weave knop create`, all over shared core/runtime
  current acceptance paths: black-box CLI execution checked against the `02-mesh-created`, `04-alice-knop-created`, and `05-alice-knop-created-woven` Accord manifest scopes

### web app
  browser client of daemon
  current user-facing name: Shuttle
  no semantic logic here either
  current status: scaffold only, no web slice implemented yet

## Current Bootstrap Status

- `deno.json` now defines the initial Deno project tasks for formatting, linting, type-checking, and tests.
- `src/core`, `src/runtime`, `src/cli`, `src/daemon`, and `src/web` now exist under the intended flat `src/` boundary.
- `tests/integration`, `tests/e2e`, `tests/support`, and `tests/fixtures` now exist as the first testing scaffold.
- The first carried implementation slice is the local `mesh create` path matching the settled Alice Bio `01-source-only` -> `02-mesh-created` fixture state.
- The second carried implementation slice is the local `knop create` path matching the settled Alice Bio `03-mesh-created-woven` -> `04-alice-knop-created` fixture state.
- The current carried `weave` slice is the local `04-alice-knop-created` -> `05-alice-knop-created-woven` path, including first-history creation for Knop support artifacts and minimal generated HTML pages.
- `mesh create` now has a manifest-scoped black-box CLI acceptance test and thin framework example payloads.
- `knop create` now resolves `meshBase` from existing mesh metadata, creates the first Knop support artifacts, and has a manifest-scoped black-box CLI acceptance test.
- `weave` now runs as the top-level local CLI action, versions the first Alice Knop support artifacts, advances MeshInventory, and has manifest-scoped black-box CLI acceptance coverage.
