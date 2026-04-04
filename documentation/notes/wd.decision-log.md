---
id: xniuk4dvzoi717h9g8epjbk
title: Decision Log
desc: ''
updated: 1773897667180
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
- References: [[wd.task.2026.2026-03-15-fresh-monorepo]], [[wd.task.2026.2026-03-20-architecture-planning]], [[wd.codebase-overview]]
- Why:
  - The CLI must support both remote and local or in-process execution without forking semantic behavior.

### 2026-04-03: Public Contract Stays in semantic-flow-framework for Now

- Decision: Keep the public Semantic Flow API contract in `semantic-flow-framework` for now rather than creating a day-one separate spec repo.
- References: [[wd.task.2026.2026-03-15-fresh-monorepo]], [[wd.task.2026.2026-03-20-architecture-planning]]
- Why:
  - The contract is still being discovered alongside the first implementation slices and example corpus.

### 2026-04-03: dependencies/ Is the Reference Repo Folder

- Decision: Use `dependencies/` as the top-level folder for checked-out sibling repos.
- References: [[wd.task.2026.2026-03-15-fresh-monorepo]]

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
- References: [[wd.task.2026.2026-03-15-fresh-monorepo]], [[wd.task.2026.2026-03-20-architecture-planning]]

### 2026-04-03: Browser Client Name

- Decision: Use `Shuttle` as the current user-facing name for the browser client.
- References: [[wd.task.2026.2026-03-15-fresh-monorepo]], [[wd.task.2026.2026-03-20-architecture-planning]], [[wd.codebase-overview]]

### 2026-04-03: TUI Deferred

- Decision: Defer TUI work until there is a real near-term use case that needs a persistent terminal app.
- References: [[wd.task.2026.2026-03-20-architecture-planning]], [[wd.cli]]

### 2026-04-03: Bootstrap Logging Extraction Boundary

- Decision: For the first Weave slice, keep the Kato logging carry-forward limited to `LogRecord`, log sinks, `StructuredLogger`, `AuditLogger`, and JSONL file output.
- References: [[wd.task.2026.2026-04-03-weave-bootstrap-mesh-create]], [[wd.spec.2026-04-03-mesh-create]]
- Why:
  - This preserves the useful operational-vs-audit split and local JSONL behavior without pulling in Kato's broader logging adapter stack, daemon wiring, or unrelated runtime concerns.
- Follow-Up Tasks:
  - [ ] Decide the durable default runtime log/config location once the RDF-backed config slice exists.

### 2026-04-03: knop create Resolves Mesh Identity from Workspace

- Decision: The first local `knop create` CLI requires an explicit `designatorPath` and resolves `meshBase` from the existing workspace mesh support surface rather than asking users to restate mesh identity.
- References: [[wd.task.2026.2026-04-03-knop-create]], [[wd.spec.2026-04-03-knop-create]]
- Why:
  - `knop create` acts on an existing mesh, so repeating `meshBase` on the CLI is redundant and easier to misuse.
