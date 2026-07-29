---
id: wdconsumerfeedback051a
title: Consumer Feedback 0.5.1
desc: ''
updated: 1785297588142
created: 1785297588142
---

## Goals

- Turn the 2026-07-28 Stagecraft consumer review of `@semantic-flow/weave` / `weave-lib` (archived verbatim in [[wd.consumer-feedback-0.5.1.source]]) into a scoped `v0.5.1` slice: implement the cheap high-value asks, document the contracts the review showed were stated-but-unactionable, and record corrections where the review's measurements were wrong.
- Keep the load-bearing surfaces the reviewer depends on stable: the plain `weave <version>` output of `--version`, the `WeaveApiError` code/stage taxonomy, and the no-op idempotency contract.

## Summary

Stagecraft consumes Weave as a validation consumer (`weave validate mesh` in CI) and a packaging consumer (release gate string-matches `weave --version` output); they report no programmatic use yet. Their review makes eight substantive asks plus a priority table. This note records our verification of each claim, the disposition for `v0.5.1`, and the implementation plan. The review is the input; the decisions are ours. This note was reviewed by Codex (2026-07-28) and its corrections are folded in below.

Consumer-side facts (their pin, gate, topology) are **reported by the consumer**, not independently verifiable from this repository; repository-side claims are labeled measured where we measured them.

## Claim verification (measured 2026-07-28, this repo)

- **§5.1 "there is no v0.4.0 tag" is incorrect for the canonical repo.** `git ls-remote --tags origin` shows `refs/tags/v0.4.0` at `37f4b8f` (every release tag back to `v0.0.2` exists). The reviewer's `git describe` ran on a checkout that had not fetched tags; the runbook already notes `git fetch --tags origin`. (`v0.5.0` has no tag yet only because its GitHub Release has not been cut.)
- **Their open question is settled: the 4 MiB fix IS in `v0.4.0`.** `git merge-base --is-ancestor 23f50af v0.4.0` holds; the current limit is 4 MiB (`src/runtime/weave/raw_source_panels.ts:45`). Their publish-timing correlation happened to be right.
- **§5.3 is correct.** `release-notes.v0.4.0.md` never names the 1 MiB → 4 MiB raw-source inline-limit change. A ruled behavioral change went unnamed.
- **§2's feasibility guess is right, with one real contract wrinkle.** `outcomes` are derived before `writeCombinedPlan` runs, and the write lists are a replay of the prepared plan — the seam exists. But `createdPaths`/`updatedPaths` are defined as *physically written* paths, so a dry run cannot return "the same shape with the same meaning"; the result needs an explicit discriminant (see Decisions).
- **§6 verified concretely: cliffy 1 rejects `--version --json`** ("Option `--version` cannot be combined with other options"), so the JSON form needs a pre-parser fast path, not a cliffy option.
- **§7's observation is real but its premise isn't.** `weave` and `weave-lib` are one version line: both derive from root `deno.json` `version` and release together. The skew they saw (`weave-lib@0.5.0` vs CLI `0.4.0`) is a mid-release artifact of the v0.5.0 first-publish sequence, not independent lines.

## Disposition by review item

| Review item | Disposition for 0.5.1 |
| --- | --- |
| §2 `dryRun` plan mode (their #1) | **Implement.** Optional `dryRun?: boolean` on the request; identical admit/load/plan behavior and refusals; stops before WRITE; result carries an explicit `executed` discriminant with fields redefined as forecasts when `executed: false`. |
| §3 single-writer means | **Document (their ask #1).** Recommended advisory-lock pattern; `lockPath` / `isMeshBusy` deferred. |
| §4 `plan-conflict` repair path | **Document, conservatively.** Full restore-from-VCS procedure; surgical per-path repair is *not* derivable from the disclosed fields (Codex: `possiblyTouchedPaths` holds only the failed path, the failed write's create/update kind is not a stable field, and created parent directories are undisclosed). A stable failed-write-kind field is deferred. |
| §5.1 git tags | **No process change; document** release verification (fetch tags; tag ↔ version mapping). Correct the reviewer. |
| §5.2 build identification | **Implement for the CLI binary only.** `weave --version --json` → `{ "version", "commit", "built" }` from a build-stamped module; plain output unchanged. Not "provenance" — self-reported build identification; npm OIDC attestation is the actual provenance mechanism (and covers `weave-lib`, so lib stamping is cut — a build-info module imported by the CLI never enters the dnt graph anyway). |
| §5.3 behavioral changelog | **Adopt as process.** Runbook rule + release-notes stub generator (`scripts/bump-version.ts`) nudge; retroactive 4 MiB callout in the v0.5.1 notes. |
| §6 machine-readable version | Same implementation as §5.2. |
| §7 version-line relationship | **Document (trivial).** One line in both READMEs: same source, same version line, released together; `weave-lib@X` is built from the same commit as `weave@X`. No `peerDependency` — the library does not require the CLI at runtime, so enforcing one would be false coupling. |
| §8 programmatic `validateMesh` | **Defer to its own slice (0.6.0 candidate).** Adoption-deciding for them and legitimately medium-cost for us: it needs a designed findings contract (path/severity/code/message), the same rigor `versionPayloads` got. Recorded in [[wd.todo]]; not squeezed into a patch. |
| §1 praised surfaces | Regression constraint: error taxonomy, no-op idempotency, absolute-`meshRoot` rule, and write-failure disclosure fields must not change shape. |

## Decisions

- 2026-07-28: this slice ships as **v0.5.1** on `next/v0.5.1` (stacked on `next/v0.5.0`). `weave-lib@0.5.0` is already on the registry and immutable, so folding new work into 0.5.0 is not an option.
- 2026-07-28 (superseding the earlier prerequisite): **the v0.5.0 release is skipped and folded into v0.5.1.** Only `weave-lib@0.5.0` ever reached the public (the one-time manual first publish); the wrapper/platform packages, tag, and GitHub Release for 0.5.0 were never cut, and the trusted publisher is configured. One Release Manual run publishes everything at 0.5.1 with no expected-failure jobs; `weave-lib@0.5.0` is deprecated after the release as a lib-only pre-release artifact. `release-notes.v0.5.1` carries the combined content; `release-notes.v0.5.0` is deleted. v0.5.1 is the first release publishing `weave-lib` through OIDC end to end.
- **Dry-run contract:** `VersionPayloadsResult` gains a required `executed: boolean`. Real runs report `executed: true` with today's semantics. Dry runs report `executed: false`; `outcomes[].status`, `createdPaths`, and `updatedPaths` are forecasts of what a subsequent real run would do — nothing was written. Honest-plan, not simulation: dry-run green does not preclude a later `io-failure`, and it takes no lock. Adding a required field is an additive change for consumers (extra field) and an amendment to the exact-shape contract in [[wd.programmatic-version-api]], which this note owns as a follow-up.
- **Single write-manifest source of truth (Codex):** preflight, the writer, and the dry-run forecast must all consume one ordered combined-write manifest helper instead of three parallel reconstructions, so forecast/actual drift is structurally impossible.
- **`--version --json` parser strategy (Codex):** an exact pre-cliffy fast path in `runWeaveCli` for argument vectors containing only `--version`/`-V` and `--json` (either order, nothing else); everything else falls through to cliffy untouched. `--json` is deliberately not a cliffy root option because the root action mutates.
- **Build stamping design (Codex):** `src/generated/build_info.ts` is checked in with `null` commit/built (source runs report nulls). `scripts/build-binaries.ts` accepts `--commit <sha> --built <iso8601>`, writes the stamped module, compiles, and restores the original bytes in `finally` — never committed, dirty-tree safe. The release workflow passes `${{ github.sha }}`; each matrix job stamps its own timestamp (informational), and the workflow's binary smoke parses `--version --json` and asserts `commit === GITHUB_SHA` (the consistency value; timestamps only need to be valid ISO-8601). This is deliberately *not* the embedded-defaults pattern: stamping is ephemeral and nondeterministic, defaults are deterministic checked-in data with a drift test.
- **No runtime `git` for build info** — the binary runs detached from any checkout, so a runtime lookup cannot answer "which commit built this". (The fs-purity guard is *not* the reason; it covers the library API graph, and compiled binaries legitimately hold `--allow-run=git`.)
- **Locking guidance (documented pattern, no mechanism):** writers take an exclusive advisory lock on `<meshRoot>/.weave/lock` (inside the `.weave` directory that mesh walkers already special-case — a bare `.weave.lock` file risks being treated as mesh/publication content) for the duration of every mutating invocation, CLI or API. `flock(2)` on POSIX; Windows/Node consumers need an advisory-lock library (e.g. `proper-lockfile`) — the pattern is advisory and cooperative either way. Read-only operations (`validate`, dry runs) that participate in a coherence gate should take a shared lock or accept that an unlocked read can observe a writer mid-operation.
- **Repair procedure (documented, conservative):** from a `write`-stage `WeaveApiError`, restore the mesh working tree to its pre-call state from version control or a snapshot (`git status` / `git restore` for git-managed meshes), verify baseline equivalence, re-run `weave validate`, then retry the original request. Per-path surgical repair from `completedCreatedPaths`/`completedUpdatedPaths` is possible for the *completed* writes but cannot classify the *failed* write; the conservative procedure is the one we can stand behind. This is also the exit path `plan-conflict`-until-repaired refers to.
- Plain `--version` output stays byte-identical; Stagecraft is told to migrate their gate to the JSON `version` field.

## Contract Changes

- `VersionPayloadsRequest` gains optional `dryRun?: boolean` (default `false`); `VersionPayloadsResult` gains required `executed: boolean`. [[wd.programmatic-version-api]] is amended accordingly (this note is the owning follow-up), and the portable behavior spec (`sf.spec.*` in the Semantic Flow Framework notes, per [[wd.general-guidance]]) gains the dry-run behavior.
- CLI gains the exact `weave --version --json` form; documented in [[wu.cli-reference.weave]], not the API reference.
- New checked-in `src/generated/build_info.ts` (nulls) + stamping flags on `scripts/build-binaries.ts`; release workflow passes and verifies the SHA.
- Both package READMEs state the version-line relationship (§7).
- No changes to `validate` behavior, ontology, mesh formats, or existing error semantics.

## Testing

- Dry-run integration: (a) dry-run result equals the subsequent real run's result except `executed`; (b) mesh tree byte-identical before/after a dry run; (c) refusal parity with at least one ADMIT, one LOAD, one preparation-PLAN, and one preflight-PLAN case; (d) `alreadyCurrent` no-op forecast; (e) overwrite-mode dry run (distinct planner dispatch); (f) admission of `dryRun` true/false/absent/non-boolean.
- Off-tree npm smoke gains a dry-run leg (currently write-only), proving the packaged Node build forecasts identically too.
- `--version`: exact piped-byte assertion for the plain form (existing tests strip ANSI and trim — insufficient); JSON form tests: both flag orders, `-V` alias, `--json` alone falls through to cliffy, extra arguments fall through, output parses as a single JSON document, `version` matches `deno.json`, nulls in source runs.
- Release workflow: binary smoke asserts `commit === GITHUB_SHA` per platform. Ordinary CI gains one Linux compile + `--version --json` smoke (binary compilation is otherwise release-only).
- Existing `deno task ci`, npm-lib build + smoke, fs-purity guard all stay green.

## Non-Goals

- `lockPath` / `isMeshBusy` / in-library locking; `repairMesh()`; a stable failed-write-kind disclosure field (revisit if a consumer needs surgical repair).
- Programmatic `validateMesh` (§8) — deferred to its own designed slice; recorded in [[wd.todo]].
- `weave-lib` build stamping or a library provenance export; npm attestation covers the lib.
- Changing `validate` behavior or output; JSR publishing; renaming error codes/stages.
- Amending the published v0.4.0 GitHub Release body (the v0.5.1 notes carry the retroactive callout instead).

## Implementation Plan (v0.5.1)

- [x] Factor the ordered combined-write manifest helper; writer and preflight consume it.
- [x] Add `dryRun` admission + the pre-write return with `executed: false` forecasts; `executed: true` on the real path.
- [x] Dry-run tests per Testing above; extend the off-tree npm smoke with the dry-run leg.
- [x] Add `src/generated/build_info.ts` (nulls) and `--commit`/`--built` stamping with restore-in-`finally` to `scripts/build-binaries.ts`; workflow passes `github.sha` and the binary smoke asserts it; add the Linux compile smoke to ordinary CI.
- [x] Implement the `--version --json` fast path; plain + JSON output tests.
- [x] Docs: [[wu.api-reference]] (dry-run, locking pattern, conservative repair, release verification), [[wu.cli-reference.weave]] (`--version --json`), [[wd.programmatic-version-api]] (contract amendment), [[wd.release-runbook]] (behavioral-changelog rule), `scripts/bump-version.ts` release-notes stub nudge, both READMEs (§7 line), `sf.spec.*` dry-run behavior, [[wd.todo]] `validateMesh` entry.
- [x] Release notes v0.5.1 (combined library-packaging + this slice + retroactive 4 MiB callout naming `23f50af` shipped in v0.4.0) and version bump; v0.5.0 folded in rather than released first.
- [ ] Reply to Stagecraft: §5.1 correction (tags exist; fetch them), the settled 23f50af answer, `dryRun`/`--version --json` availability, locking + repair doc pointers, §7 clarification, §8 deferral with rationale.

## Open Issues

- Post-release: deprecate `weave-lib@0.5.0` on npm (`npm deprecate @semantic-flow/weave-lib@0.5.0 "Pre-release publish with no matching CLI release; use 0.5.1+."`).
- Whether Stagecraft's coherence-gate use of dry-run needs a shared-lock story stronger than documentation — revisit after they try it.
