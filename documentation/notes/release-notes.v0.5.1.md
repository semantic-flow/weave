---
id: 0d46bf55232649b38d710d2339af8f53
title: 'release notes v0.5.1'
desc: ''
updated: 1785299154064
created: 1785299154064
---

## Summary

`v0.5.1` responds to the first downstream consumer review of the programmatic API and the packaged distributions ([[wd.consumer-feedback-0.5.1]]). It adds a dry-run plan mode to `versionPayloads`, machine-readable version and build identification to the CLI (`weave --version --json`), and closes the documentation gaps the review surfaced: a recommended mesh-locking pattern, a defined repair procedure for write failures, release-verification guidance, and a statement of the `weave`/`weave-lib` version relationship. No existing behavior changes.

## Highlights

- **`versionPayloads({ ..., dryRun: true })`** runs the full admit/load/plan pipeline — raising exactly the refusals a real run would raise at those stages — then returns a forecast without writing anything. The result gains an `executed: boolean` discriminant (`false` for forecasts); `outcomes`, `createdPaths`, and `updatedPaths` describe what the real call would do. Forecast and effect derive from one shared ordered write manifest, so they cannot drift; the off-tree Node smoke proves forecast/actual equivalence for the packaged library too.
- **`weave --version --json`** (exactly those two flags, either order) emits `{"version", "commit", "built"}` on one line. Release-built binaries report the exact release commit (stamped at build, verified against the workflow SHA in CI); source runs report `null`. The plain `weave <version>` line is unchanged and now covered by a byte-stability test, because downstream release gates string-match it — migrate such gates to the JSON `version` field.
- **Documented single-writer locking pattern**: an exclusive advisory lock on `<meshRoot>/.weave/lock` held for the duration of every mutating invocation (see [[wu.api-reference]]). Weave still takes no lock itself; the pattern is cooperative.
- **Documented write-failure repair procedure** defining what "repaired" means (restore from VCS/snapshot, verify baseline, `weave validate`, retry) — the exit condition `plan-conflict` refers to.
- **Release verification documented**: every release is tagged (`git fetch --tags origin` in pinned checkouts), and binaries now self-report their build commit.
- Both npm READMEs state that `@semantic-flow/weave` and `@semantic-flow/weave-lib` share one version line, built from the same commit and released together, with no runtime dependency between them.

## Breaking Or Changed Behavior

- `VersionPayloadsResult` gains a required `executed: boolean` field (`true` on all mutating runs). Additive for consumers reading known fields; the exact-shape contract in [[wd.programmatic-version-api]] is amended.
- No CLI, validation, versioning, or output behavior changes otherwise. The plain `--version` line is byte-identical to v0.5.0.
- **Retroactive disclosure for v0.4.0:** the raw-source inline limit was raised from 1 MiB to 4 MiB in commit `23f50af`, which shipped in `v0.4.0` but was not named in its release notes. Sources between 1 MiB and 4 MiB inline on ResourcePages from v0.4.0 onward. The release process now requires behavioral changes to be named in release notes.

## Artifacts

- npm: `@semantic-flow/weave`, four platform packages, and `@semantic-flow/weave-lib`, all at `0.5.1`. This is the first release expected to publish `weave-lib` through npm trusted publishing (its `0.5.0` first publish was manual).
- Git tag and GitHub Release: `v0.5.1` when the release runbook is executed.

## Validation

- `deno task ci` green (fmt, lint, type-check, full suite with coverage), including new dry-run integration tests (forecast/actual equivalence, no-mutation byte checks, per-stage refusal parity, overwrite forecasts), `--version` byte-stability and JSON-form tests, and build-info stamping tests (stamp-during-build, restore-on-failure, input validation).
- Off-tree npm smoke extended with a dry-run leg: the packed library under Node forecasts byte-identically to the Deno source import, and forecasts match subsequent real runs.
- Ordinary CI now compiles a Linux binary and verifies `--version --json` reports the workflow commit, with the source tree left clean.

## Known Limitations

- Dry-run is an honest plan, not a write simulation: it cannot preclude a later `io-failure`, and it takes no lock.
- The locking pattern is documentation only; Weave enforces nothing (`lockPath` / `isMeshBusy` deliberately deferred).
- The repair procedure is restoration-based; per-path surgical repair is not derivable from the disclosed error fields alone (a stable failed-write classification is deferred).
- Programmatic `validateMesh` with structured findings — the review's adoption-deciding ask — is deferred to its own designed slice (see [[wd.todo]]).

## Next

- v0.6.0 candidate: programmatic `validateMesh(meshRoot, options)` with structured findings (path, severity, code, message).
- JSR export remains deferred per [[wd.library-packaging]].
