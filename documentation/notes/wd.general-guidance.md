---
id: jfmdc6ovahwph9hv7jrlir1
title: General Guidance
desc: ''
created: 1773626592609
---


## Purpose

This note defines day-to-day Weave development guidance for humans and LLM Agents.

IMPORTANT: This project must use modern Deno best practices and, whenever
possible, Deno-native or Deno-first libraries. LLMs often try to use Node
libraries and conventions, so watch out for that.

## Testing

see [[wd.testing]]

## Dependencies

- This project depends heavily on the Semantic Flow ontologies, which can be embedded for convenience at `dependencies/github.com/semantic-flow/ontology`

## Working Rules

- the ontology is key!
  - review at least the [[ont.summary.core]] 
  - the entire core ontology is at `dependencies/github.com/semantic-flow/ontology/semantic-flow-core-ontology.ttl`
- Documentation must be continuously verified and updated, especially:
  - this file [[wd.general-guidance]]
  - [[wd.codebase-overview]]
- files in these directories are historical only, be careful when accessing them:
  - /dependencies/github.com/semantic-flow/sflo-dendron-notes (ancient)
  - /dependencies/github.com/semantic-flow/sflo (previous effort)
  - /dependencies/github.com/semantic-flow/weave-dev-archive (this project's archive)
- until a v1.0 release, avoid backward-compatibility shims
- Startup/config behavior is fail-closed by default:
  - daemon subprocess startup must load runtime config successfully before
    entering runtime loop.
  - runtime config validation rejects malformed or unknown `featureFlags` keys.
  - Windows detached daemon launch should use `Start-Process` semantics to
    avoid parent/child lifecycle coupling seen with direct subprocess spawn.
- commit messages should include a "semantic commits"-style summary line and then detailed bullet points describing developer-relevant changes

## Task notes

Before starting substantial code changes, a task note should be written and refined. Task notes live in `documentation/notes/` with a filename like `wd.task.2026.2026-MM-DD_HHmm-task-slug.md` and the template lives in [[template.task]]. Actionable "To-Do" items should be pre-pended with markdown checkboxes (`[ ]`) to track completion (`[x]`), cancellation (`[c]`), or deferment (`[d]`).

`documentation/notes/wd.task.*.md`: Do not rename `wd.task.*` notes to `wd.completed.*` unless the user explicitly asks you to. If a user asks for that rename and it changes wikilinks, update the affected references.

Before a task is closed, [[wd.decision-log]] should be updated with important decisions made.

## Behavior specs

Use `documentation/notes/wd.spec.*` for current behavior specs that are meant to guide implementation and drive higher-level tests.

Use a `wd.spec.*` note when:

- the behavior is externally visible
- the behavior spans multiple subsystems or files
- the expected result is best described in terms of observable outcomes and invariants
- the resulting tests are likely to be black-box or integration-style

These notes are especially useful as sources for:

- integration tests
- black-box functional tests
- Accord manifests or similar acceptance checks

A `wd.spec.*` note is not a replacement for executable tests and is not automatically the public API contract. It is a current implementation-facing behavior spec. See [[wd.testing]] for the testing posture that goes with this.


## Development Loop

Use app-specific tasks as needed:

```bash
deno task dev:web
deno task dev:daemon
deno task dev:root
```

## Validation Workflow

During active development, run only what matches your change:

- `deno task test` when changing logic/tests.
- `deno task check` when changing types/contracts/public APIs.
- `deno task lint` when touching broader structural code.
- if behavior changed materially, update the relevant `wd.spec.*` note and tests together rather than letting them drift


### Before merge
- update  [[wd.codebase-overview]]
- run:
```bash
deno task fmt
deno task ci
```
