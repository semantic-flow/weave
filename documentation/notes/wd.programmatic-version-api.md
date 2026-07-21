---
id: wdprogversionapi20260721
title: Programmatic Version API
desc: ''
updated: 1784667355000
created: 1784667355000
---

## Purpose

This note defines the Weave v1 in-process API contract for coherently recording caller-supplied payload bytes. The portable observable behavior is [[sf.spec.2026-07-21-programmatic-version-api]].

The contract and implementation strategy were ratified by PM GO in [[wa.task.2026.2026-07-21_1322-programmatic-version-api]].

## Stable Public Surface

The stable function and primary types are:

- `versionPayloads`
- `VersionPayloadsRequest`
- `VersionPayloadsResult`
- `PayloadVersionOutcome`
- `WeaveApiError`
- `WeaveApiErrorCode`
- `WeaveApiErrorStage`

`WeaveApiError` is the exact public error base. Its `code` and `stage` fields are exact stable discriminants. Message text is diagnostic only and must not be treated as a machine contract.

The public root module is `src/mod.ts`. For a repository-root consumer file, the exact import specifier is `./src/mod.ts`. The API is re-exported from that root; consumers must not import `src/api/` implementation modules directly.

The current npm package is a native CLI wrapper rather than a library export vehicle. This contract therefore pins the repository source root, not an `@semantic-flow/weave` library specifier. Library packaging is tracked separately in [[wd.todo]].

## Request Contract

The request has this exact shape:

```ts
export interface VersionPayloadsRequest {
  meshRoot: string;
  items: readonly VersionPayloadItem[];
  defaults?: PayloadVersionDefaults;
  historyTrackingPolicyOverride?: HistoryTrackingPolicy;
  overwriteExistingState?: boolean;
}

export interface VersionPayloadItem {
  designatorPath: string;
  bytes: Uint8Array;
  historySegment?: string;
  stateSegment?: string;
  manifestationSegment?: string;
}

export interface PayloadVersionDefaults {
  historySegment?: string;
  stateSegment?: string;
  manifestationSegment?: string;
}
```

`meshRoot` is required and must be an absolute host path. There is no current-directory default.

`items` must be non-empty. Targets are exact payload targets only; recursive selection and payload-IRI input are not part of v1. Duplicate target identities after normalization refuse the whole request.

The public root-designator representation is the literal string `/`. The empty string is not a public alias. The API normalizes `/` to the existing internal root representation and returns `/` in results and error target details.

`bytes` is the only payload-content representation. Each view is admission-copied using its own byte offset and length, then decoded with fatal UTF-8 behavior. There is no string overload and no binary-content path in v1.

`overwriteExistingState` defaults to `false`. When `true`, `items` must contain exactly one item and that item must explicitly provide `historySegment` and `stateSegment`. A multi-item overwrite refuses at ADMIT with `code === "invalid-request"`.

## Result Contract

The result has this exact shape:

```ts
export interface VersionPayloadsResult {
  meshBase: string;
  outcomes: readonly PayloadVersionOutcome[];
  createdPaths: readonly string[];
  updatedPaths: readonly string[];
}

export interface PayloadVersionOutcome {
  status: "applied" | "alreadyCurrent";
  designatorPath: string;
  payloadArtifactIri: string;
  historySegment: string;
  stateSegment: string;
  manifestationSegment: string;
  snapshotPath: string;
}
```

`outcomes` contains one entry per normalized request item in canonical designator-path order. `createdPaths`, `updatedPaths`, and `snapshotPath` are mesh-root-relative paths using `/` separators. `updatedPaths` includes working payload updates and version/support updates that were physically written. A no-op request has empty created and updated lists.

`applied` means the request wrote a needed working/history transition. `alreadyCurrent` means admitted content and requested resolved naming already match the current latest state and no transition is needed for that item. The mutable core `VersionPlan` is never returned.

## Phase Contract

| Phase | Required work | First possible mutation | Error-code families |
| --- | --- | --- | --- |
| ADMIT | Validate request and identity shape; require an absolute `meshRoot`; require non-empty exact items; normalize `/`; refuse normalized duplicates and multi-item overwrite; copy every byte view; strictly decode UTF-8. | None | `invalid-request`, `unsupported-content` |
| LOAD | Load mesh metadata, inventories, effective target/ancestor/mesh configuration, and settled payload shape; resolve exact targets and absolute mesh-local working paths; refuse repository/floating sources; then determine content-kind eligibility. | None | `unknown-target`, `not-a-payload`, `malformed-mesh`, `inconsistent-policy`, `unsupported-source`, `unsupported-content`, reserved `snapshot-conflict` |
| PLAN | Seed the caller-owned text overlay with admitted payload text; load settled candidates through that overlay; resolve precedence; plan one coherent batch including cardinality one; join working updates and version outputs into one preflight set; parse/preflight all planned RDF and destinations. Whole-mesh validation is absent. | None | `plan-conflict` |
| WRITE | Apply the combined working-file and version-output plan. Writes are sequential and non-transactional; failure reports paths known to have completed and paths that may have been touched. | First physical mutation | `io-failure` |
| RESULT | Derive canonical per-target `applied`/`alreadyCurrent` outcomes and request-level created/updated path lists; do not expose the mutable plan. | No new mutation | None |

Any ADMIT, LOAD, or PLAN error leaves the mesh untouched. This is whole-request semantic refusal before both working-payload and version-output writes, not a transaction guarantee after WRITE starts.

## Overlay Seam

The following text is carried verbatim from amendment r2 item 1:

> the API orchestration (a) admission-copies and strictly UTF-8-decodes each buffer; (b) after inventory/source resolution, seeds a caller-owned `TextFileOverlay` at each resolved absolute mesh-local working path; (c) loads settled payload candidates and PLANS against that seeded overlay; (d) joins the working-file updates into the combined preflight/validation set; (e) performs NO physical write until that combined plan is green. Normative mutation example (required in the wd note): caller buffer mutation after admission is invisible; an external disk mutation after plan-green is unsupported concurrency (F2's caller-owned law) and is NOT reported as a bytes-capture conflict. This is an API-orchestration seam over landed planning, not a replacement planner.

The seeded overlay is authoritative for requested working payload content. The implementation must not first install the requested working bytes and then call the landed version path.

The combined preflight covers existence/collision checks and RDF parsing for both working updates and version outputs. It does not turn the subsequent sequential writes into a transaction.

## Capture And Concurrency

The caller owns single-writer serialization for a mesh. Concurrent API/API and API/CLI mutation is outside the supported contract. The API introduces no mutex or cross-process lock.

The admitted copies are the payload capture boundary. There is no API changed-under-capture comparison between admitted bytes and the pre-call or concurrently changed working payload file.

The landed capture-hash exclusion of configuration and support inputs is preserved: config and support files are not claimed as snapshot-verified inputs. Mutating them concurrently violates the caller-owned serialization rule and is not guaranteed to produce `snapshot-conflict`.

`snapshot-conflict` is retained as a final reserved code for a bounded file-backed capture conflict if such a covered read set remains in the shared execution seam. PM GO explicitly confirmed the reserved value to avoid later public-union churn. It is not emitted in v1, including for mutation of caller buffers, requested working payload files shadowed by the overlay, configuration files, or support files.

## Full Precedence Contract

The API resolves each target independently through the ordered sources below, then verifies that the resulting target-scoped planning policies can form one coherent batch.

| Decision | 1 — per-item explicit | 2 — batch default | 3 — persisted payload intent | 4 — effective config policy | 5 — built-in default |
| --- | --- | --- | --- | --- | --- |
| History segment | `item.historySegment` | `defaults.historySegment` | selected `currentArtifactHistory` when present | nearest applicable target, ancestor, then mesh history-naming policy | ordinal history naming, beginning with `_history001` |
| State segment | `item.stateSegment` | `defaults.stateSegment` | selected history's `hasNextStateSegmentHint` | nearest applicable target, ancestor, then mesh state-naming policy | next ordinal state segment; named current histories still fail closed when no next segment can be derived |
| Manifestation segment | `item.manifestationSegment` | `defaults.manifestationSegment` | no persisted manifestation intent in v1, so continue | nearest applicable target, ancestor, then mesh manifestation-naming policy | segment derived from the working payload name/content convention |

Per-item fields override batch defaults exactly as CLI per-target fields override general payload-segment flags. A missing field continues down its own column; an explicit field in one column does not suppress persisted or configured values for another column.

`historyTrackingPolicyOverride` is a request-wide explicit override. When present it wins over target, ancestor, and mesh configuration for this invocation. When absent, normal effective target/ancestor/mesh configuration and then the built-in tracking policy apply. It is not persisted by this operation.

`overwriteExistingState` is request-wide, explicit, and defaults to `false`. It is not inherited from payload intent or configuration. When `true`, it selects only the explicit existing current history/state named by the sole item; it does not participate in the ordinary naming fallback chain.

After resolution, any target-scoped disagreement in support-history, naming, ResourcePage-generation, or other planning policy that prevents one deterministic shared plan refuses the entire request with `inconsistent-policy`. The implementation must not pick the first target's policy as a batch-wide winner.

## Error Contract

The final stage values are:

```ts
export type WeaveApiErrorStage = "admit" | "load" | "plan" | "write";
```

The final code values are:

```ts
export type WeaveApiErrorCode =
  | "invalid-request"
  | "unknown-target"
  | "not-a-payload"
  | "malformed-mesh"
  | "inconsistent-policy"
  | "unsupported-source"
  | "unsupported-content"
  | "snapshot-conflict"
  | "plan-conflict"
  | "io-failure";
```

| Stage | Code | Exact contract meaning |
| --- | --- | --- |
| `admit` | `invalid-request` | The request shape, absolute mesh root, item identity, segment, duplicate rule, exact-target rule, or overwrite cardinality/required-fields rule is invalid. |
| `admit` | `unsupported-content` | An admitted byte sequence is not valid UTF-8. |
| `load` | `unknown-target` | A normalized exact designator is not declared by the loaded mesh. |
| `load` | `not-a-payload` | The designator exists but does not resolve to a payload artifact. |
| `load` | `malformed-mesh` | Required mesh metadata, inventory, config, settled-shape, history, or progression facts are unparsable, missing, conflicting, or invalid. |
| `load` | `inconsistent-policy` | Effective target-scoped policies disagree across members and cannot form one coherent batch. |
| `load` | `unsupported-source` | The target uses a repository-backed, floating, remote, outside-policy, missing, or non-file working source rather than an eligible mesh-local source. |
| `load` | `unsupported-content` | The resolved target is not an eligible UTF-8 text/RDF payload, or its decoded content is empty, whitespace-only, or otherwise ineligible. |
| `load` | `snapshot-conflict` | Reserved for a covered file-backed read dependency that changes during bounded capture; never used for admitted payload bytes or excluded config/support inputs. |
| `plan` | `plan-conflict` | Naming/progression facts, requested overwrite coordinates, existing destinations, combined create/update paths, or generated RDF prevent a valid preflighted plan. |
| `write` | `io-failure` | A physical create or update failed after WRITE began; the error discloses completed and possibly touched paths. |

All public failures are thrown as `WeaveApiError`. The class has exact readonly `code` and `stage` fields and may carry readonly `target`, `path`, `completedPaths`, and `possiblyTouchedPaths` detail plus an Error `cause`. The stable minimum detail shape is:

```ts
export class WeaveApiError extends Error {
  readonly code: WeaveApiErrorCode;
  readonly stage: WeaveApiErrorStage;
  readonly target?: { readonly index: number; readonly designatorPath: string };
  readonly path?: string;
  readonly completedPaths?: readonly string[];
  readonly possiblyTouchedPaths?: readonly string[];
  override readonly cause?: unknown;
}
```

`message` and any underlying internal error type are diagnostic only. Callers branch on `code` and `stage`.

## Cardinality-One And Overwrite Dispatch

The exact implementation strategy is recorded in the governing task's before-code deliverables. In summary, non-overwrite API requests use an API-only coherent-payload-batch planning entry for every cardinality, including one. The entry directly uses the core explicit payload-batch planner and its `alreadyCurrent` skip instead of relying on the landed general `planWeave` dispatch.

Single-item overwrite uses the existing exact single-candidate overwrite planner after the same ADMIT, LOAD, overlay, and combined-preflight boundary. Multi-item overwrite never reaches planning.

The CLI runtime predicate and general core single-candidate dispatch remain unchanged.

## Compiling Normative Call

This example is intended for a TypeScript file at the Weave repository root and imports only the public root module:

```ts
import {
  type VersionPayloadsRequest,
  versionPayloads,
  WeaveApiError,
} from "./src/mod.ts";

const request: VersionPayloadsRequest = {
  meshRoot: "/srv/semantic-flow/rules-mesh",
  items: [
    {
      designatorPath: "rules/core",
      bytes: new TextEncoder().encode("@prefix ex: <https://example.test/> .\nex:rules ex:revision 2 .\n"),
      stateSegment: "v0.4.0",
      manifestationSegment: "ttl",
    },
    {
      designatorPath: "rules/shacl",
      bytes: new TextEncoder().encode("@prefix ex: <https://example.test/> .\nex:shapes ex:revision 2 .\n"),
      stateSegment: "v0.4.0",
      manifestationSegment: "ttl",
    },
  ],
  defaults: {
    historySegment: "releases",
  },
  historyTrackingPolicyOverride: "versioned",
  overwriteExistingState: false,
};

try {
  const result = await versionPayloads(request);
  for (const outcome of result.outcomes) {
    console.log(outcome.status, outcome.designatorPath, outcome.snapshotPath);
  }
} catch (error) {
  if (error instanceof WeaveApiError) {
    console.error(error.stage, error.code, error.completedPaths ?? []);
  } else {
    throw error;
  }
}
```

The root payload uses `designatorPath: "/"` in the same request shape.

## Non-Goals

- no CLI behavior change
- no shared locking or transaction layer
- no binary payload support
- no repository/floating source mutation
- no recursive target selection
- no payload-IRI request identity
- no page generation or whole-mesh validation
- no mutable planner result exposure
- no claim that the current binary-only npm wrapper is already a library distribution
