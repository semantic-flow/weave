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
  mesh create, knop create, integrate, payload update, version, validate, generate, extract, weave
  request/result types shared by all callers
  shared designator normalization now treats `/` as a CLI-only root sentinel and `""` as the internal root designator path, including root-aware target selection and support-artifact path derivation
  current carried slices: `mesh create` request validation/support-artifact rendering, `knop create` planning over an existing mesh inventory, the first narrow `integrate` planning slice for `05-alice-knop-created-woven` -> `06-alice-bio-integrated`, the first narrow `knop add-reference` planning slice for `07-alice-bio-integrated-woven` -> `08-alice-bio-referenced`, the first narrow `payload.update` planning slice for `09-alice-bio-referenced-woven` -> `10-alice-bio-updated`, the first narrow `extract` planning slice for `11-alice-bio-v2-woven` -> `12-bob-extracted`, and the first five narrow `weave` planning slices for `04-alice-knop-created` -> `05-alice-knop-created-woven`, `06-alice-bio-integrated` -> `07-alice-bio-integrated-woven`, `08-alice-bio-referenced` -> `09-alice-bio-referenced-woven`, `10-alice-bio-updated` -> `11-alice-bio-v2-woven`, and `12-bob-extracted` -> `13-bob-extracted-woven`

### runtime
  local workspace execution
  filesystem, git, RDF loading, page generation, config, locking hooks
  job execution primitives, but not HTTP
  includes first-pass Deno-native structured operational and audit logging
  persistent config direction is RDF, probably JSON-LD, and should remain queryable via SPARQL
  runtime inventory discovery, workspace loaders, and page rendering now carry the root designator path as a first-class resource when a root Knop exists at `_knop`
  current carried slices: local filesystem materialization for `mesh create`, `knop create`, `knop add-reference`, the first local `integrate` pass over an existing workspace payload file, the first local `payload.update` pass over an already woven payload artifact, the first local `extract` pass that resolves one target designator against exactly one woven payload artifact in the workspace and pins `referenceTargetState` to that artifact's latest historical state, the first local `validate` / `version` / `generate` runtime seams under `runtime/weave`, and the first five local `weave` passes over an existing workspace with a shared runtime ResourcePage renderer seam, including the first extracted-resource weave that versions Bob support artifacts, advances `_mesh/_inventory` to `_s0004`, updates one existing current identifier page, and stages recursive multi-target `version` batches against a virtual current workspace state before writes
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
  designator-path inputs now normalize CLI `/` to the internal root designator representation before crossing into runtime/core
  current carried slices: top-level local `weave` with repeatable `--target <key=value,...>` resource targeting plus version-oriented payload naming pass-through, standalone local `weave validate`, `weave version`, and `weave generate` entry points over the same shared seams, recursive batch versioning under the composed `weave` flow, plus local `weave mesh create`, `weave knop create`, `weave knop add-reference`, `weave integrate`, `weave payload update`, and `weave extract`, all over shared core/runtime
  current acceptance paths: black-box CLI execution checked against the `02-mesh-created`, `04-alice-knop-created`, `05-alice-knop-created-woven`, `06-alice-bio-integrated`, `07-alice-bio-integrated-woven`, `08-alice-bio-referenced`, `09-alice-bio-referenced-woven`, `10-alice-bio-updated`, `11-alice-bio-v2-woven`, `12-bob-extracted`, and `13-bob-extracted-woven` Accord manifest scopes

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
- The third carried implementation slice is the local `integrate` path matching the settled Alice Bio `05-alice-knop-created-woven` -> `06-alice-bio-integrated` fixture state.
- The fourth carried implementation slice is the local `weave` path matching the settled Alice Bio `06-alice-bio-integrated` -> `07-alice-bio-integrated-woven` fixture state.
- The fifth carried implementation slice is the local `knop add-reference` path matching the settled Alice Bio `07-alice-bio-integrated-woven` -> `08-alice-bio-referenced` fixture state.
- The sixth carried implementation slice is the local `weave` path matching the settled Alice Bio `08-alice-bio-referenced` -> `09-alice-bio-referenced-woven` fixture state.
- The seventh carried implementation slice is the local `payload.update` path matching the settled Alice Bio `09-alice-bio-referenced-woven` -> `10-alice-bio-updated` fixture state.
- The eighth carried implementation slice is the local `weave` path matching the settled Alice Bio `10-alice-bio-updated` -> `11-alice-bio-v2-woven` fixture state.
- The ninth carried implementation slice is the local `extract` path matching the settled Alice Bio `11-alice-bio-v2-woven` -> `12-bob-extracted` fixture state.
- The tenth carried implementation slice is the local `weave` path matching the settled Alice Bio `12-bob-extracted` -> `13-bob-extracted-woven` fixture state.
- The current carried `weave` slices are the local `04-alice-knop-created` -> `05-alice-knop-created-woven`, `06-alice-bio-integrated` -> `07-alice-bio-integrated-woven`, `08-alice-bio-referenced` -> `09-alice-bio-referenced-woven`, `10-alice-bio-updated` -> `11-alice-bio-v2-woven`, and `12-bob-extracted` -> `13-bob-extracted-woven` paths, including first-history creation for Knop support artifacts, first payload-artifact history creation, first ReferenceCatalog history creation on an already-versioned Knop surface, second payload-history creation on an already-versioned payload surface, the first extracted-resource support-artifact weave, and minimal generated HTML pages rendered through a shared runtime page seam.
- `mesh create` now has a manifest-scoped black-box CLI acceptance test and thin framework example payloads.
- `knop create` now resolves `meshBase` from existing mesh metadata, creates the first Knop support artifacts, and has a manifest-scoped black-box CLI acceptance test.
- `knop add-reference` now resolves `meshBase` from existing mesh metadata, requires an explicit local `referenceRole`, creates the first Knop-owned `ReferenceCatalog` working file, updates the existing Knop inventory, and has manifest-scoped black-box CLI acceptance coverage for `08-alice-bio-referenced`.
- `integrate` now resolves a local source path or `file:` URL into a mesh-relative working file path, creates the first payload-Knop support artifacts, updates MeshInventory, and has manifest-scoped black-box CLI acceptance coverage together with thin framework examples.
- `payload.update` now resolves the existing working payload file from an already woven payload surface, stages replacement bytes from a local path or `file:` URL without changing the semantic mesh path, updates only `alice-bio.ttl` for the carried `10` slice, and has manifest-scoped black-box CLI acceptance coverage together with thin framework examples.
- `extract` now resolves the target designator against exactly one woven payload artifact already present in the workspace, creates a new minimal Knop plus `ReferenceCatalog`, pins the created `ReferenceLink` to the source payload artifact's latest historical state, leaves Alice payload bytes and existing Alice surfaces unchanged, and has manifest-scoped black-box CLI acceptance coverage for `12-bob-extracted`.
- `weave` now runs as the top-level local CLI action, versions the first Alice Knop support artifacts, the first Alice Bio payload history surface, the first Alice ReferenceCatalog history surface, the second Alice Bio payload historical state, and the first Bob extracted-support surface, advances MeshInventory only where the public current surface changed, batches recursive target sets before writes, and has manifest-scoped black-box CLI acceptance coverage through `13`.
- Root designator support now treats `/` as the CLI spelling and `""` as the internal runtime/core value, including exact and recursive `--target` handling plus root-owned `_knop`, `_history001`, and `index.html` paths without leading slashes.
