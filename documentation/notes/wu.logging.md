---
id: ox7p4ikl06084kr9iqi9l49
title: Logging
desc: ''
updated: 1779378397551
created: 1779378397551
---

Weave writes local structured logs so you can review what a command attempted, which workspace it touched, and whether runtime work succeeded or failed. The logs are meant to be simple files you can inspect with ordinary command-line tools. They are not required for generated Semantic Flow output, and deleting them does not remove mesh data.

## Where Logs Are Written

By default, CLI logs are written under `.weave/logs/` in the inferred workspace root.

For a whole-root mesh, the workspace root is usually the mesh root. For a sidecar mesh such as `docs/`, Weave infers the workspace root from the mesh configuration and writes logs under the surrounding workspace unless `WEAVE_LOG_DIR` is set.

Use `WEAVE_LOG_DIR` to put logs somewhere else:

```sh
WEAVE_LOG_DIR=/tmp/weave-logs weave --mesh-root docs
```

See [[wu.environment-variables]] for the environment-variable summary.

## Log Files

Weave currently writes JSON Lines files:

- `operational.jsonl` contains runtime progress and outcome events, such as command start, success, failure, created paths, updated paths, skipped generated pages, or error messages.
- `security-audit.jsonl` contains audit-oriented events, especially CLI command invocation records after arguments have been normalized enough for Weave to know what command and workspace are being addressed.

Each line is one JSON object. New records are appended; Weave does not currently rotate, compress, or prune these files.

Some commands may only write `security-audit.jsonl`, and some successful commands may not create `operational.jsonl` if there was no operational event to record. Very early input errors can happen before logging starts, so a rejected command is not guaranteed to leave a log file.

## Record Shape

Every log record uses the same general shape:

```json
{"timestamp":"2026-04-03T12:00:00.000Z","level":"info","channel":"operational","event":"mesh.create.started","message":"Starting local mesh create","attributes":{"meshBase":"https://semantic-flow.github.io/mesh-alice-bio/"}}
```

Fields:

- `timestamp` is an ISO timestamp for when the record was written.
- `level` is one of `debug`, `info`, `warn`, or `error`.
- `channel` is `operational` or `security-audit`.
- `event` is the stable event name, useful for filtering.
- `message` is a short human-readable summary.
- `attributes` carries event-specific details such as `meshRoot`, `workspaceRoot`, `targets`, `createdPaths`, `updatedPaths`, or `error`.

Because this is JSONL, you can inspect it with tools such as `tail`, `jq`, or `grep`:

```sh
tail -n 20 .weave/logs/operational.jsonl
jq 'select(.level == "error")' .weave/logs/operational.jsonl
jq 'select(.event == "cli.command")' .weave/logs/security-audit.jsonl
```

## Operational Logs

Operational logs are for understanding what happened during local work. They are most useful when diagnosing a command that partly planned work, failed during validation, wrote files, skipped a no-op, or needs to be compared with CI output.

Examples of information that may appear:

- the workspace root and mesh root used by the command
- target designator paths
- created and updated paths
- validation or runtime failure messages
- generated pages skipped because only the generated timestamp differed

The CLI also prints a concise command result to stdout. The log is the more structured record when you need to compare runs or inspect details after the terminal output is gone.

## Audit Logs

Audit logs are for answering “what command did this checkout run?” They are intentionally separate from operational logs so command invocation history is easy to find.

CLI audit records use the `cli.command` event and include the command name plus command-specific attributes. For example, a `weave generate` run records the selected targets, mesh root, workspace root, metadata options, and local-mode marker.

Audit logs are local files, not a security boundary. They help with traceability, but they do not prevent edits or prove that a workspace was not changed by some other process.

## Privacy And Cleanup

Logs can include local filesystem paths, mesh roots, target designators, repository URLs, source paths, and error messages. Treat logs as local operational data. If you are preparing a public artifact or a support bundle, review the logs before sharing them.

It is safe to remove `.weave/logs/` when you no longer need command history:

```sh
rm -rf .weave/logs
```

For release or CI workflows, prefer setting `WEAVE_LOG_DIR` outside the publication worktree so generated site contents and local runtime logs stay separate.
