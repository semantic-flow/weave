---
id: jfmdc6ovahwph9hv7jrlir1
title: General Guidance
desc: ''
updated: 1773673295148
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

- review the core ontology at `dependencies/github.com/semantic-flow/ontology/semantic-flow-core-ontology.ttl`
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

Before starting substantial code changes, a task note should be written and refined. Task notes live in `documentation/notes/wd.tasks.*` and the template lives in [[template.task]]. Actionable "To-Do" items should be pre-pended with markdown checkboxes (`[ ]`) to track completion (`[x]`) or cancellation (`[c]`)

Before a task is closed, [[wd.decision-log]] should be updated with important decisions made.


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


### Before merge
- update  [[wd.codebase-overview]]
- run:
```bash
deno task fmt
deno task ci
```