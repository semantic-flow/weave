---
id: wdprogvalidateapi20260730
title: Programmatic Validate API
desc: 'v1 contract for validateMesh: structured findings over the recursive planner/preflight validation path. Ratified in the 2026-07-30 spec review r1 of wa.completed.2026.2026-07-29_1219-programmatic-validate-mesh-api.'
updated: 1785440266000
created: 1785440266000
---

## Purpose

This note defines the Weave v1 in-process API contract for programmatic mesh validation: `validateMesh` returns structured findings instead of formatted CLI text. The rulings were ratified in the spec review r1 recorded in `wa.completed.2026.2026-07-29_1219-programmatic-validate-mesh-api` (archive vault, 2026-07-30). Exact code spellings below are final per that review's delegation.

Companion contract: [[wd.programmatic-version-api]] (`versionPayloads`). The two share `WeaveApiError` and its code/stage discriminants.

## Stable Public Surface

- `validateMesh`
- `ValidateMeshRequest`
- `ValidateTarget`
- `ValidateMeshResult`
- `MeshValidationFinding`
- `MeshValidationFindingCode`
- `WeaveApiError` / `WeaveApiErrorCode` / `WeaveApiErrorStage` (shared; extended — see Error Contract)

The public root module is `src/mod.ts`; the npm library is `@semantic-flow/weave-lib` (built from `src/api/mod.ts`). Consumers must not import `src/api/` implementation modules directly. The npm CLI package `@semantic-flow/weave` remains the CLI wrapper, not a library.

## Request Contract

```ts
export interface ValidateMeshRequest {
  meshRoot: string;                     // absolute host path; no current-directory default
  targets?: readonly ValidateTarget[];  // absent or empty = whole mesh
}

export interface ValidateTarget {
  designatorPath: string;               // "/" is the public root alias (versionPayloads rule)
  recursive?: boolean;                  // default false
}
```

- v1 validates **mesh scope only**. There is deliberately no `scope` field: publication-scope validation is a future additive field, ruled out of v1. (Publication-readiness checks still run — see Coverage — because CLI mesh validation includes the retained publication checks when a publication profile is configured; parity is preserved.)
- Duplicate targets after normalization refuse the whole request (`invalid-request`), as in `versionPayloads`.
- The API mutates nothing and takes no lock. An unlocked read can observe a writer mid-operation; callers participating in a coherence gate should use the advisory-lock pattern documented in [[wu.api-reference]].

## Result Contract

```ts
export interface ValidateMeshResult {
  meshBase?: string;                    // absent only when mesh metadata could not be resolved
  findings: readonly MeshValidationFinding[];
  coverage: {
    knownDesignatorPathCount: number;   // designator paths the loaded MeshInventory declares
    plannedDesignatorPathCount: number; // pending candidates the recursive planner completed planning for
  };
}

export interface MeshValidationFinding {
  severity: "error" | "warning";        // v1 emits only "error"; "warning" is reserved
  code: MeshValidationFindingCode;      // stable machine discriminant
  message: string;                      // diagnostic only; never a machine contract
  path?: string;                        // mesh-root-relative, "/" separators
  designatorPath?: string;              // when attributable to a designator
}
```

- **No derived `valid` boolean.** `findings.some(f => f.severity === "error")` is the only truth; a derived boolean invites drift. (Ruled 2026-07-30 under the PM's delegated GO.)
- **Coverage is planner-coverage, not integrity-coverage.** v1 validation is a dry run of the recursive version planner plus preflight RDF parsing of the planned outputs plus publication-readiness checks. It is NOT a traversal-parse of every existing mesh file; comprehensive mesh integrity is future growth, per the portable spec's framing. `knownDesignatorPathCount` distinguishes a settled-mesh green from an empty selection.
- `meshBase` is optional for exactly one reason: when mesh metadata cannot be resolved, the run reports a `malformed-mesh-metadata` finding and no meshBase exists to report.

## Findings Contract — the v1 code registry (final spellings)

```ts
export type MeshValidationFindingCode =
  // mesh-invalid
  | "malformed-mesh-metadata"
  | "malformed-inventory"
  | "malformed-config"
  | "missing-artifact"
  | "path-boundary-violation"
  | "unresolvable-extraction-source"
  | "malformed-page-definition"
  | "progression-conflict"
  | "naming-policy-violation"
  | "planned-rdf-invalid"
  | "plan-conflict"
  // weave-limitation
  | "unsupported-mesh-shape"
  // publication-readiness (emitted in mesh scope when a profile is configured)
  | "publication-path-leakage"
  | "publication-readiness";
```

(`publication-readiness` is the finalized spelling of the review's working name `publication-profile-unsupported`; it covers profile-requirement failures — `.nojekyll` missing or not a file — and publication-profile config problems alike.)

### Refusal-family → code mapping

Family letters refer to the 2026-07-30 refusal-family enumeration recorded with the task note. Assignments within a family may be refined at build only within this ratified registry (no new codes, no removals).

| Code | Families | Meaning |
| --- | --- | --- |
| `malformed-mesh-metadata` | B3 | Mesh metadata (`_mesh/_meta/meta.ttl`, meshBase) unresolvable or invalid. |
| `malformed-inventory` | C1, C2, J6, J8, K2 | Mesh/Knop inventory Turtle unparsable, or required inventory facts/blocks missing, ambiguous, or conflicting. |
| `malformed-config` | E1, E2, E3, E4 | Effective-config resolution failed: unparsable config, conflicting bindings, discovery cycles, invalid operational config in mesh config. |
| `missing-artifact` | D1, G13 | A declared working payload, snapshot, or support artifact is absent from the workspace. |
| `path-boundary-violation` | D2 (+ unwrapped `LocalPathAccessError`) | A resolved path escapes the allowed local-path boundary. |
| `unresolvable-extraction-source` | D3, D4 | Extraction-source resolution failed or resolved outside the mesh. |
| `malformed-page-definition` | D5 | ResourcePageDefinition unparsable or invalid. |
| `progression-conflict` | J1, H5, I1, I3, I4, G10, J3, J7, J9, J10 | History/state progression facts conflict, are impossible, or cannot be resolved. |
| `naming-policy-violation` | I2 | Explicit/derived segment names violate the effective naming policy. |
| `planned-rdf-invalid` | K1 | A planned output `.ttl` does not parse — generated-RDF preflight failure. |
| `plan-conflict` | G9, L2 | The plan produced conflicting created/updated paths. |
| `unsupported-mesh-shape` | F1–F13, G1–G8, G11, H1–H4, L1, L3, J2 (unsupported-resource arm) | A fixture-shaped "only supports …" planner/assertion gate refused a valid-but-unsupported mesh. One code for all gates; the message names the specific gate. Occurrences shrink as the planner generalizes; the code stays stable. |
| `publication-path-leakage` | M1, M2 | Published text contains host-local file URLs or absolute host paths. |
| `publication-readiness` | M3–M7 | Publication-profile requirements unmet or profile config invalid. |

### Ordering, multiplicity, and fail-fast (ruled)

- Findings are reported in deterministic emission order: mesh-validation findings first (planner traversal order), publication-readiness findings after (walk order). No dedup collapse is performed.
- **v1 preserves the engine's fail-fast planning semantics:** a blocking mesh refusal ends planning, so a run reports at most one mesh-invalid/weave-limitation finding; publication-readiness checks collect multiple findings when planning is green. "All findings in one pass" is future engine work (see the bounded-memory sibling task), not a v1 promise. Consumers get exactly the information the CLI gets today, in structured form.

## Error Contract (thrown; cannot-validate only)

Mesh invalidity is result data. `WeaveApiError` is thrown only when validation itself cannot proceed:

| Stage | Code | Meaning for `validateMesh` |
| --- | --- | --- |
| `admit` | `invalid-request` | Request/target shape invalid: non-absolute or empty `meshRoot`, malformed target specs, normalized duplicates. (Families A1, A2, A4.) |
| `load` | `read-failure` | **New code (additive union extension).** I/O-environment failure: mesh root absent or not a directory, permission errors, files vanishing mid-read, unresolvable user-settings environment. (Families B1, N1, N2, E5.) |
| `load` | `malformed-mesh` | Reused with its landed meaning for exactly one precondition: no mesh support surface exists at `meshRoot` (family B2) — there is no mesh to attach findings to. Mesh *content* problems are findings, never this error. |
| `load` | `unknown-target` | Requested targets match no known designator. (Family A3.) |
| `load` | `unsupported-source` | A pending candidate requires repository-backed/floating source resolution — the ruled v1 capability limitation. See Source Capability. |

- `read-failure` is an additive extension of the shared `WeaveApiErrorCode` union; `versionPayloads` never emits it. `io-failure` remains write-stage-only and is never used for reads. [[wd.programmatic-version-api]] is amended by reference.
- **Unexpected errors propagate raw (ruled).** Non-domain errors — weave defects — rethrow unwrapped; they are bugs to report upstream, not contract. A domain refusal reaching the API boundary without a classified code is treated as a weave defect and also propagates raw: every typed code means something ruled.

## Classification discipline (build requirement)

Classification is **class- and tag-based, never message-string-based** — the `mapPreparationError` substring approach in `versionPayloads` is the anti-pattern this registry replaces. The build tags refusal emission sites (or introduces typed error subclasses, e.g. for the plain-`Error` throws in `runtime/mesh/inventory.ts`) so the API boundary maps class+tag → code. The 2026-07-30 enumeration is the tagging checklist; the error classes that today escape `executeValidate` uncaught (plain inventory `Error`, `EffectiveConfigError`, `ConfigSourceDiscoveryError`, `ConfigInheritanceError`, `OperationalConfigError`, `ResourcePagePolicyError`) must be caught and classified — closing the enumeration's two contract holes. CLI behavior (text, exit codes 0/1) is unchanged.

## Source Capability (ruled)

v1 `validateMesh` owns the necessary domain — meshes whose sources are mesh-local files — with full CLI-equivalence. Pending candidates carrying a repository-source floating locator refuse up front with `unsupported-source` (load), a stable typed limitation, instead of the current Node degradation (git feature-detect fails → misleading missing-working-payload error). The atomic git operations (checkout identification: repo root + remote-URL match) stay CLI-only. The fullest architecture — a capability-injected checkout-identification seam shared by CLI and lib — is the parked task sketch `wa.task.2026.2026-07-30_1237-checkout-identification-seam` and is strictly additive over this refusal.

## Parity Law (as narrowed by the capability ruling)

`weave validate` and `validateMesh` consume one findings pipeline; CLI text is a rendering of the structured findings. Within the shared capability domain (mesh-local sources), identical inputs produce identical findings — enforced structurally (one pipeline), verified by parity fixtures, never test-patrolled across two implementations.

## Evolution Rules

- Additive evolution only: new finding codes, new optional request/result fields, and the future `scope` field extend the contract; existing codes, fields, and meanings never change or disappear.
- `"warning"` severity is reserved (never emitted in v1); consumers must not assume `severity === "error"`.
- Message text is diagnostic and may change in any release.
