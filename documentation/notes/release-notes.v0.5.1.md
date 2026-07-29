---
id: 0d46bf55232649b38d710d2339af8f53
title: 'release notes v0.5.1'
desc: ''
updated: 1785299154064
created: 1785299154064
---

## Summary

`v0.5.1` is the first release of Weave's programmatic surface as a consumable npm library, plus the response to the first downstream consumer review of that surface. (A planned `v0.5.0` was folded into this release; see Artifacts.)

The new `@semantic-flow/weave-lib` package is built from `src/api/mod.ts` with dnt and exposes `versionPayloads`, `WeaveApiError`, and the public request/result types to Node and bundler consumers as dual ESM/CJS with TypeScript declarations. The pinned-checkout `./src/mod.ts` import, the CLI wrapper `@semantic-flow/weave`, and the native binaries all keep working unchanged; the library is an additional distribution of the same source.

From the consumer review ([[wd.consumer-feedback-0.5.1]]): `versionPayloads` gains a dry-run plan mode, the CLI gains machine-readable version and build identification (`weave --version --json`), and the documentation gaps the review surfaced are closed — a recommended mesh-locking pattern, a defined repair procedure for write failures, release-verification guidance, and a statement of the `weave`/`weave-lib` version relationship.

## Highlights

- **`@semantic-flow/weave-lib`**, the npm library package for the payload version API, built via `deno task build:npm-lib` (dnt, ES2022, dual ESM/CJS, bundled type declarations). Gated by an off-tree downstream contract smoke: the packed tarball is installed into a temp consumer outside the source tree, a real `versionPayloads` batch runs under Node, and the resulting mesh tree and outcomes are asserted byte-identical to the same batch through the Deno source import.
- **An fs-purity guard test**: the runtime module graph of `src/api/**` must stay free of subprocess and network APIs so Node compatibility cannot silently rot. Git-backed repository-source resolution moved behind a lazy dynamic import that only loads when a repository/floating source is actually resolved — a path `versionPayloads` refuses up front — and degrades gracefully in runtimes without `Deno.Command`, a missing `git` binary, or denied run permission.
- **Embedded runtime defaults**: the `defaults/*.ttl` documents the runtime loads are embedded as a generated module with a byte-identical drift test, removing the last package-relative `import.meta.url` resource read (the off-tree bug class the Accord `v0.1.0` release hit).
- **`versionPayloads({ ..., dryRun: true })`** runs the full admit/load/plan pipeline — raising exactly the refusals a real run would raise at those stages — then returns a forecast without writing anything. The result gains an `executed: boolean` discriminant (`false` for forecasts); `outcomes`, `createdPaths`, and `updatedPaths` describe what the real call would do. Forecast and effect derive from one shared ordered write manifest, so they cannot drift; the off-tree Node smoke proves forecast/actual equivalence for the packaged library too.
- **`weave --version --json`** (exactly those two flags, either order) emits `{"version", "commit", "built"}` on one line. Release-built binaries report the exact release commit (stamped at build, verified against the workflow SHA in CI); source runs report `null`. The plain `weave <version>` line is unchanged and now covered by a byte-stability test, because downstream release gates string-match it — migrate such gates to the JSON `version` field.
- **Documented single-writer locking pattern**: an exclusive advisory lock on `<meshRoot>/.weave/lock` held for the duration of every mutating invocation (see [[wu.api-reference]]). Weave still takes no lock itself; the pattern is cooperative.
- **Documented write-failure repair procedure** defining what "repaired" means (restore from VCS/snapshot, verify baseline, `weave validate`, retry) — the exit condition `plan-conflict` refers to.
- **Release verification documented**: every release is tagged (`git fetch --tags origin` in pinned checkouts), and binaries now self-report their build commit.
- Both npm READMEs state that `@semantic-flow/weave` and `@semantic-flow/weave-lib` share one version line, built from the same commit and released together, with no runtime dependency between them.
- `weave mesh create` invoked outside a workspace now reports a self-explanatory error.

## Breaking Or Changed Behavior

- None for existing CLI or source-import consumers. CLI routing, native binary packaging, the `./src/mod.ts` pinned-source import, and validation behavior are unchanged. The plain `--version` line is byte-identical to v0.4.0.
- `VersionPayloadsResult` gains a required `executed: boolean` field (`true` on all mutating runs). Additive for consumers reading known fields; the exact-shape contract in [[wd.programmatic-version-api]] is amended.
- `versionPayloads` still accepts existing mesh-local UTF-8 text/RDF payloads only and still refuses repository/floating sources with typed errors; the packaged library inherits those contracts exactly (byte-equivalence is CI-enforced).
- **Retroactive disclosure for v0.4.0:** the raw-source inline limit was raised from 1 MiB to 4 MiB in commit `23f50af`, which shipped in `v0.4.0` but was not named in its release notes. Sources between 1 MiB and 4 MiB inline on ResourcePages from v0.4.0 onward. The release process now requires behavioral changes to be named in release notes.

## Artifacts

- npm: `@semantic-flow/weave`, four platform packages, and `@semantic-flow/weave-lib`, all at `0.5.1`.
- `weave-lib@0.5.0` exists on the registry as a lib-only pre-release artifact: npm cannot OIDC-publish a not-yet-existing package, so the first publish was manual, and the planned `v0.5.0` release was then folded into `v0.5.1`. No matching `weave@0.5.0`, git tag, or GitHub Release exists; `weave-lib@0.5.0` is deprecated in favor of `0.5.1`. This is the first release publishing `weave-lib` through npm trusted publishing.
- Git tag and GitHub Release: `v0.5.1` when the release runbook is executed.

## Validation

- `deno task ci` green (fmt, lint, type-check, full suite with coverage), including new dry-run integration tests (forecast/actual equivalence, no-mutation byte checks, per-stage refusal parity, overwrite forecasts), `--version` byte-stability and JSON-form tests, build-info stamping tests (stamp-during-build, restore-on-failure, input validation), the fs-purity guard, and the embedded-defaults drift test.
- Off-tree npm smoke (write and dry-run legs): the packed library under Node behaves byte-identically to the Deno source import.
- Ordinary CI now compiles a Linux binary and verifies `--version --json` reports the workflow commit, with the source tree left clean.

## Known Limitations

- Dry-run is an honest plan, not a write simulation: it cannot preclude a later `io-failure`, and it takes no lock.
- The locking pattern is documentation only; Weave enforces nothing (`lockPath` / `isMeshBusy` deliberately deferred).
- The repair procedure is restoration-based; per-path surgical repair is not derivable from the disclosed error fields alone (a stable failed-write classification is deferred).
- The library exposes the payload version API only. Programmatic `validateMesh` with structured findings — the review's adoption-deciding ask — is deferred to its own designed slice (see [[wd.todo]]).
- No JSR export yet: JSR does not polyfill `Deno.*` for non-Deno consumers, so JSR publishing stays deferred until the npm/dnt path is proven with real consumers. Deno consumers can use `npm:@semantic-flow/weave-lib` or the pinned-source import.

## Next

- v0.6.0 candidate: programmatic `validateMesh(meshRoot, options)` with structured findings (path, severity, code, message).
- JSR export remains deferred per [[wd.library-packaging]].
