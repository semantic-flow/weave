---
id: xniuk4dvzoi717h9g8epjbk
title: Decision Log
desc: ''
updated: 1775338353369
created: 1773630801215
---

## Decision Log Template

```
### Date: Decison Title

- Decision: {one line description of what was decided}
- References: {wikilinks to task or conversation notes}
- [optional] Why:
- [optional] Follow-Up Tasks:
  - [ ] each task gets a checkbox
```

## Decisions

### 2026-04-03: Deno-First Weave Runtime

- Decision: Use Deno as the primary Weave runtime and stop treating RDF-tool viability on Deno as an open prerequisite for bootstrap work.
- References: [[wd.task.2026.2026-03-20-architecture-planning]]
- Why:
  - Accord already proved the practical Deno stack against real Semantic Flow conformance work.

### 2026-04-03: Shared Core Below the Daemon

- Decision: Keep semantic operations in shared `core` and `runtime` code, with the daemon as the long-running HTTP implementation of the public Semantic Flow API.
- References: [[wd.completed.2026.2026-03-15-fresh-monorepo]], [[wd.task.2026.2026-03-20-architecture-planning]], [[wd.codebase-overview]]
- Why:
  - The CLI must support both remote and local or in-process execution without forking semantic behavior.

### 2026-04-03: Public Contract Stays in semantic-flow-framework for Now

- Decision: Keep the public Semantic Flow API contract in `semantic-flow-framework` for now rather than creating a day-one separate spec repo.
- References: [[wd.completed.2026.2026-03-15-fresh-monorepo]], [[wd.task.2026.2026-03-20-architecture-planning]]
- Why:
  - The contract is still being discovered alongside the first implementation slices and example corpus.

### 2026-04-03: dependencies/ Is the Reference Repo Folder

- Decision: Use `dependencies/` as the top-level folder for checked-out sibling repos.
- References: [[wd.completed.2026.2026-03-15-fresh-monorepo]]

### 2026-04-03: Reuse Kato Logging Concepts, Not the Full Stack

- Decision: Carry forward Kato's in-repo structured logger facade, operational vs audit split, and adapter seam, but start Weave with a small Deno-native runtime logging layer and defer full observability work.
- References: [[wd.task.2026.2026-03-20-architecture-planning]], [[wd.codebase-overview]]
- Why:
  - The useful carry-forward is the logging model, not Kato's whole observability program.

### 2026-04-03: Cliffy for First-Pass Interactive CLI

- Decision: Use Cliffy for the first-pass Weave CLI command surface and interactive prompts.
- References: [[wd.task.2026.2026-03-20-architecture-planning]], [[wd.cli]]
- Why:
  - It fits the Deno-first posture and avoids pulling in a Node- or React-heavy terminal framework before there is a real TUI requirement.

### 2026-04-03: Thin Co-Developed Public API

- Decision: Keep the public Semantic Flow API thin at first and co-develop it with the first implementation slices rather than trying to finish an exhaustive contract up front.
- References: [[wd.task.2026.2026-03-20-architecture-planning]]

### 2026-04-03: Job-Centric Submitted Operations

- Decision: Model submitted first-class semantic operations as `Job` resources even when some implementations complete quickly.
- References: [[wd.task.2026.2026-03-20-architecture-planning]], [[wd.codebase-overview]]
- Why:
  - Uniform public mutation semantics are cleaner than mixing job and non-job operation models by perceived size.

### 2026-04-03: mesh create Is the First Carried Slice

- Decision: Use `mesh create` as the first implementation slice to carry through local execution, tests, and HTTP-facing examples.
- References: [[wd.task.2026.2026-03-20-architecture-planning]]

### 2026-04-03: Persistent Config Is RDF

- Decision: Treat persistent Weave configuration as RDF, probably JSON-LD, and keep it queryable via SPARQL.
- References: [[wd.task.2026.2026-03-20-architecture-planning]], [[wd.codebase-overview]]

### 2026-04-03: User Docs Stay in the Monorepo for Now

- Decision: Keep initial user-facing documentation under `documentation/notes/wu.*`, while shared cross-audience notes may remain top-level for now.
- References: [[wd.completed.2026.2026-03-15-fresh-monorepo]], [[wd.task.2026.2026-03-20-architecture-planning]]

### 2026-04-03: Browser Client Name

- Decision: Use `Shuttle` as the current user-facing name for the browser client.
- References: [[wd.completed.2026.2026-03-15-fresh-monorepo]], [[wd.task.2026.2026-03-20-architecture-planning]], [[wd.codebase-overview]]

### 2026-04-03: TUI Deferred

- Decision: Defer TUI work until there is a real near-term use case that needs a persistent terminal app.
- References: [[wd.task.2026.2026-03-20-architecture-planning]], [[wd.cli]]

### 2026-04-03: Bootstrap Logging Extraction Boundary

- Decision: For the first Weave slice, keep the Kato logging carry-forward limited to `LogRecord`, log sinks, `StructuredLogger`, `AuditLogger`, and JSONL file output.
- References: [[wd.completed.2026.2026-04-03-weave-bootstrap-mesh-create]], [[wd.spec.2026-04-03-mesh-create]]
- Why:
  - This preserves the useful operational-vs-audit split and local JSONL behavior without pulling in Kato's broader logging adapter stack, daemon wiring, or unrelated runtime concerns.
- Follow-Up Tasks:
  - [ ] Decide the durable default runtime log/config location once the RDF-backed config slice exists.

### 2026-04-03: knop create Resolves Mesh Identity from Workspace

- Decision: The first local `knop create` CLI requires an explicit `designatorPath` and resolves `meshBase` from the existing workspace mesh support surface rather than asking users to restate mesh identity.
- References: [[wd.completed.2026.2026-04-03-knop-create]], [[wd.spec.2026-04-03-knop-create]]
- Why:
  - `knop create` acts on an existing mesh, so repeating `meshBase` on the CLI is redundant and easier to misuse.

### 2026-04-04: First Local weave Slice Targets Alice 04 -> 05

- Decision: Treat the settled Alice Bio `04-alice-knop-created` -> `05-alice-knop-created-woven` transition as the first carried local `weave` implementation slice, limited to one first-weave Knop candidate together with the corresponding MeshInventory advancement and first generated Knop-facing pages.
- References: [[wd.completed.2026.2026-04-04-weave-alice-knop-created-woven]], [[wd.spec.2026-04-03-weave-behavior]]
- Why:
  - It is the first settled `version + validate + generate` case after `knop create`.
  - It proves first-history creation for Knop support artifacts and a later-state advancement for MeshInventory without absorbing payload integration.

### 2026-04-04: Bare weave Is the First Local CLI Surface

- Decision: Expose the first local high-level `weave` operation as the top-level `weave` CLI action rather than requiring a `weave weave` subcommand.
- References: [[wd.completed.2026.2026-04-04-weave-alice-knop-created-woven]], [[wd.cli]]
- Why:
  - The machine-facing operation kind can remain `weave` without forcing an awkward duplicated CLI spelling.
  - The top-level action leaves room for lower-level subcommands such as `mesh create` and `knop create` alongside the high-level default operation.

### 2026-04-04: First Local integrate Slice Targets Alice 05 -> 06

- Decision: Treat the settled Alice Bio `05-alice-knop-created-woven` -> `06-alice-bio-integrated` transition as the first carried local `integrate` implementation slice, limited to creating the payload-Knop support artifacts and updating `MeshInventory` while leaving histories and generated pages for the later woven step.
- References: [[wd.completed.2026.2026-04-04-integrate-alice-bio]], [[wd.spec.2026-04-04-integrate-behavior]]
- Why:
  - It is the next settled semantic operation boundary after the first completed local `weave` slice.
  - The fixture already proves that payload integration is distinct from later `weave` behavior.

### 2026-04-04: integrate CLI Uses Explicit Source While core Stays Mesh-Relative

- Decision: Make the first local `integrate` CLI take the source as the primary positional input and accept `designatorPath` either as a second positional argument or via `--designator-path`, while keeping host paths out of shared `core` by planning the operation from a mesh-relative working file path.
- References: [[wd.completed.2026.2026-04-04-integrate-alice-bio]], [[wd.spec.2026-04-04-integrate-behavior]]
- Why:
  - The local CLI should read as acting on a source artifact rather than on a designator path.
  - A mesh-relative working file path in `core` leaves room for later runtime staging from `file:` or remote source URIs without collapsing the semantic contract into host-path semantics.

### 2026-04-04: Second Local weave Slice Targets Alice 06 -> 07

- Decision: Treat the settled Alice Bio `06-alice-bio-integrated` -> `07-alice-bio-integrated-woven` transition as the next carried local `weave` implementation slice, keep `designatorPaths` as the thin target surface, and route both the earlier `05` pages and the new `07` pages through a shared runtime page-rendering seam.
- References: [[wd.completed.2026.2026-04-04-weave-alice-bio-integrated-woven]], [[wd.spec.2026-04-03-weave-behavior]]
- Why:
  - It proves first payload-artifact history creation plus first payload-Knop support-artifact histories without absorbing later reference-catalog or Bob behavior.
  - The payload slice did not justify a broader artifact-target request contract; the existing narrow `designatorPaths` request still fit.

### 2026-04-04: Current Local weave Validation Floor Is Parse-Only

- Decision: Keep the current carried local `weave` runtime at parse-only RDF validation for generated outputs, while leaving merged-graph, ontology, and SHACL validation as a later follow-up.
- References: [[wd.completed.2026.2026-04-04-weave-alice-bio-integrated-woven]], [[wd.spec.2026-04-03-weave-behavior]]
- Why:
  - Parse validation is enough to carry the settled `07` payload weave slice without pretending the broader validator stack is already implemented.
