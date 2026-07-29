---
id: o2s4eka79psta3u49zz4lz3
title: API Reference
desc: ''
updated: 1785294876079
created: 1785294876079
---

## Overview

Weave exposes one programmatic entry point: `versionPayloads`. It records one coherent batch of payload versions against an existing mesh — updating each working payload file and writing the matching history snapshot and support artifacts — without spawning the CLI or staging temporary files. Its outputs are byte-identical to the CLI `payload update` + `version` workflow, and that equivalence is CI-enforced.

This note is the user-facing reference. The normative contract, including the exact phase and precedence tables, lives in [[wd.programmatic-version-api]].

## Getting the API

Node and bundler consumers use the npm library package (available since `v0.5.0`):

```bash
npm install @semantic-flow/weave-lib
```

```ts
import { versionPayloads, WeaveApiError } from "@semantic-flow/weave-lib";
```

The package ships dual ESM/CJS with TypeScript declarations and requires Node 20+. It never spawns subprocesses or opens network connections.

Deno consumers can use the npm build via an `npm:` specifier:

```ts
import { versionPayloads } from "npm:@semantic-flow/weave-lib";
```

or import the repository source root from a full-commit-pinned checkout, which remains the stable low-level path:

```ts
import { versionPayloads, WeaveApiError } from "./src/mod.ts";
```

Do not import `src/api/` implementation modules directly. The npm package `@semantic-flow/weave` (no `-lib`) is the native CLI wrapper, not a library.

## versionPayloads

```ts
const result = await versionPayloads({
  meshRoot: "/abs/path/to/mesh",
  items: [
    {
      designatorPath: "rules/core",
      bytes: new TextEncoder().encode(turtleText),
    },
  ],
});
```

### Request

```ts
interface VersionPayloadsRequest {
  meshRoot: string;
  items: readonly VersionPayloadItem[];
  defaults?: PayloadVersionDefaults;
  historyTrackingPolicyOverride?: HistoryTrackingPolicy;
  overwriteExistingState?: boolean;
}

interface VersionPayloadItem {
  designatorPath: string;
  bytes: Uint8Array;
  historySegment?: string;
  stateSegment?: string;
  manifestationSegment?: string;
}

interface PayloadVersionDefaults {
  historySegment?: string;
  stateSegment?: string;
  manifestationSegment?: string;
}
```

- `meshRoot` must be an absolute host path. There is no current-directory default.
- `items` must be non-empty, and every item is an exact payload target. Recursive selection and payload-IRI input are not supported. Duplicate targets after normalization refuse the whole request.
- The root designator is the literal string `/` (see [[wu.cli-reference.root-designator]]); it is returned as `/` in results and error details.
- `bytes` is the only content representation. Each view is copied at admission (later caller mutation is invisible) and decoded as strict UTF-8. Binary and empty/whitespace-only content refuse with typed errors.
- Segment resolution per decision runs: per-item field → `defaults` field → persisted payload intent → effective config policy → built-in default (ordinal naming such as `_history001`/`_s0002`). Per-item fields shadow `defaults` exactly like CLI per-target fields shadow the general flags.
- `historyTrackingPolicyOverride` (`"versioned"`, `"currentOnly"`, `"required"`, `"slimHistory"`, `"checkpointOnly"`, `"metadataOnly"`) is a one-invocation override over target/ancestor/mesh config; it is not persisted.
- `overwriteExistingState` defaults to `false`. When `true`, the request must contain exactly one item, and that item must explicitly name `historySegment` and `stateSegment` of the existing current state to overwrite.

### Result

```ts
interface VersionPayloadsResult {
  meshBase: string;
  outcomes: readonly PayloadVersionOutcome[];
  createdPaths: readonly string[];
  updatedPaths: readonly string[];
}

interface PayloadVersionOutcome {
  status: "applied" | "alreadyCurrent";
  designatorPath: string;
  payloadArtifactIri: string;
  historySegment: string;
  stateSegment: string;
  manifestationSegment: string;
  snapshotPath: string;
}
```

`outcomes` has one entry per item in canonical designator-path order. `applied` means a working/history transition was written; `alreadyCurrent` means the admitted content and resolved naming already match the latest state, so nothing was written for that item. All paths are mesh-root-relative with `/` separators. A fully no-op request has empty `createdPaths` and `updatedPaths`, which makes blind retries safe.

## Error handling

Every public failure is a `WeaveApiError`. Branch on the readonly `code` and `stage` fields; `message` text is diagnostic only.

```ts
try {
  await versionPayloads(request);
} catch (error) {
  if (error instanceof WeaveApiError && error.stage !== "write") {
    // admit/load/plan refusals leave the mesh untouched — safe to fix and retry
  }
}
```

Stages are `"admit" | "load" | "plan" | "write"`. Any `admit`, `load`, or `plan` error is a whole-request refusal before any mutation. Only `write` errors (`code === "io-failure"`) can leave partial output; they disclose `completedPaths`, plus `completedCreatedPaths` (creates a repair can remove) and `completedUpdatedPaths` (updates whose prior bytes are gone), and `possiblyTouchedPaths`.

| Stage | Codes |
| --- | --- |
| `admit` | `invalid-request` (shape, non-absolute mesh root, duplicates, multi-item overwrite), `unsupported-content` (invalid UTF-8) |
| `load` | `unknown-target`, `not-a-payload`, `malformed-mesh`, `inconsistent-policy` (targets cannot form one coherent batch), `unsupported-source` (repository/floating/remote/non-file working source), `unsupported-content` (non-text or empty payload), `snapshot-conflict` (reserved, never emitted in v1) |
| `plan` | `plan-conflict` (naming/progression facts, overwrite coordinates, destination collisions, or generated RDF fail preflight) |
| `write` | `io-failure` |

The exact per-code meanings are tabulated in [[wd.programmatic-version-api]].

## Caller responsibilities

- The caller owns single-writer serialization per mesh. There is no lock, journal, rollback, or filesystem transaction; concurrent API/API or API/CLI mutation of one mesh is unsupported.
- Writes are sequential. After an `io-failure`, use the disclosed path fields for repair; a retry after partial support-artifact writes can refuse with `plan-conflict` until repaired.
- Mesh-local UTF-8 text/RDF payloads only. Payloads whose inventory declares a repository-source (floating) locator refuse with `unsupported-source`; version those through the CLI instead.

## Related

- [[wd.programmatic-version-api]] — normative contract (phases, precedence, error table)
- [[wd.library-packaging]] — how `@semantic-flow/weave-lib` is built, smoked, and published
- [[wu.cli-reference.payload.update]] and [[wu.cli-reference.version]] — the equivalent CLI workflow
- [[wu.cli-reference.root-designator]] — root designator semantics
