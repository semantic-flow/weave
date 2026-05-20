---
id: 42f757dc89584d51810974bb8dede8a0
title: 'release notes v0.1.0'
desc: ''
updated: 1778975437247
created: 1778730578767
---

## Summary

`v0.1.0` is the first package-oriented Weave release. It turns the earlier source-checkpoint work into an installable CLI release path, while carrying the current Semantic Flow mesh-generation runtime through Alice Bio, Sidecar Fantasy Rules, and Branch-Published Fantasy Rules fixture coverage.

This release is still early: the daemon and web surfaces are not packaged as supported products, and parts of config resolution remain design/runtime follow-up work. The supported surface is the local `weave` CLI.

## Highlights

- `weave --version` now reports the canonical version from root `deno.json`.
- Native binary build and archive packaging scripts are in place for Linux x64, Windows x64, macOS x64, and macOS arm64.
- npm package assembly, local npm-install smoke testing, and ordered npm dry-run/publish scripting are in place for `@semantic-flow/weave` plus platform packages.
- A manual GitHub Actions release workflow can build native binaries, package archives/checksums, assemble npm packages, smoke-test installs, optionally publish npm packages, and optionally create or update the GitHub Release.
- Branch-published GitHub Pages mesh generation is covered by the `mesh-branch-fantasy-rules` fixture, including source-clean `main`, generated `gh-pages`, repository source provenance, extraction source registries, all-term ResourcePages, and representative working/exact source references.
- ResourcePages now surface source provenance, grouped references, direct RDF properties, source registries, raw RDF panels, history/state views, and branch-published release-state pages more coherently.
- Config/runtime groundwork now includes policy-valued history/page defaults, Weave default profile RDF, `HostLocalOperationalConfig`, `ConfigResolutionConfig`, `ResolvedConfig`, inherited config propagation primitives, and current-only support-artifact history policy slices.

## Breaking Or Changed Behavior

- The canonical Semantic Flow core namespace is `https://semantic-flow.github.io/sflo/ontology/`; stale `semantic-flow-ontology` expectations are retired.
- Config vocabulary uses flat namespace-local policy individuals such as `sfcfg:historyTrackingPolicy_currentOnly`; old slash-shaped and boolean config terms such as `generateResourcePages` / `createHistoricalStatesOnWeave` are retired.
- `LocalConfig` has been replaced by `HostLocalOperationalConfig` for host-local operational trust policy.
- Extraction provenance and repository source provenance live in Knop-owned `_knop/_sources/sources.ttl` registries; mesh config is not used as a provenance bucket.
- Branch-published publication output is local-only by default. Weave can create local publication commits, but it does not push them.
- Plain fixture planning remains non-mutating. Regeneration/execution requires explicit `--execute`, and branch updates are local unless pushed separately.

## Artifacts

- Git tag: `v0.1.0`
- GitHub Release: `v0.1.0`
- Native binary archives:
  - `weave-v0.1.0-linux-x64.tar.gz`
  - `weave-v0.1.0-windows-x64.zip`
  - `weave-v0.1.0-macos-x64.tar.gz`
  - `weave-v0.1.0-macos-arm64.tar.gz`
- Matching `.sha256` checksum files for native archives.
- npm packages:
  - `@semantic-flow/weave`
  - `@semantic-flow/weave-linux-x64`
  - `@semantic-flow/weave-windows-x64`
  - `@semantic-flow/weave-macos-x64`
  - `@semantic-flow/weave-macos-arm64`

## Validation

- `deno task ci` passed locally during release preparation: 422 tests passed.
- `deno task fmt:check`, `deno task lint`, `deno task check`, and `deno task test` are the intended source quality gate.
- Release tooling has focused coverage for version metadata, binary metadata, archive packaging, npm package assembly, npm install smoke setup, npm publish ordering, and `weave --version`.
- The manual release workflow should still be rehearsed in GitHub Actions before a real npm publish.

## Known Limitations

- The supported packaged surface is the local `weave` CLI. Daemon and web surfaces remain scaffolded/deferred.
- The branch-published fixture repo is often left on `gh-pages` for local preview. Tests should remain meaningful there: generated mesh assertions read generated refs, while deterministic source-asset checks read the asset-bearing source ref.
- Historical ResourcePage regeneration policy is parsed into effective config, but the full config-at-the-time/current/hybrid regeneration behavior remains follow-up work.
- Durable next history/state segment hint APIs are not part of this release. Friendly histories and states are available through explicit `historySegment`, `stateSegment`, and `manifestationSegment` request fields.
