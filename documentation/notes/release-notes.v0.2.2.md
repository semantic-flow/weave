---
id: 75f2f1407bc849918424fff216c910fd
title: 'release notes v0.2.2'
desc: ''
updated: 1779952466744
created: 1779952466744
---

## Summary

`v0.2.2` is a runtime correctness and publication-prep release for Weave. It adds the shared artifact-resolution service, uses that service for source-backed config and ResourcePage loading, makes effective config target-aware, improves custom/current-only ResourcePage behavior, and strengthens the test/fixture pipeline used by GitHub CI and Codecov.

This release also starts the append-onlyish inventory cleanup. The first inventory slices add an RDF-aware append planner and use it to preserve carried Knop support facts without dropping source registries, extraction sources, reference catalogs, or unknown support details.

## Highlights

- Shared artifact resolution now handles governed working, target-local, target-located, latest-state, exact-state, fallback, digest, and observed-resolution evidence flows through a common runtime service.
- Config-source discovery now resolves mesh-local, Knop-local, and Knop-inheritable source attachments through the shared resolver, including recursive source chains, cycle/dedupe handling, and traceable source ordering.
- Effective config is now provided per mesh or target scope, so recursive and multi-target `weave`, `version`, and `generate` operations can apply Knop-local and inherited config to the right target instead of flattening everything into one global config.
- ResourcePage generation now supports per-page presentation config and exact/fallback ResourcePageSource resolution. Custom ResourcePage definitions can be current-only, so `_knop/_page/page.ttl` does not require a `_history001` shape when the effective policy says current-only.
- The fixture/test pipeline now includes immutable fixture snapshot caching, better Deno JUnit normalization for Codecov test analytics, and release-runbook guidance for versioned release notes.
- Append-onlyish inventory groundwork now includes an RDF-aware append planner plus planner-backed preservation for carried Knop support artifacts and `knop add-reference` source/reference coexistence.

## Breaking Or Changed Behavior

- This is still pre-1.0 software, and no compatibility shims are promised for stale pre-v1 fixture or inventory shapes.
- Mesh-inheritable config has been removed as a distinct runtime layer. Mesh config remains mesh-local config; Knop-local and Knop-inheritable behavior is handled through Knop-scoped source attachments and per-target effective config resolution.
- Source-backed config authority is attached from metadata. Mesh-local `sfcfg:hasConfigSource` belongs on `<_mesh>` in `_mesh/_meta/meta.ttl`; Knop-local and Knop-inheritable source attachments belong in current Knop metadata. Resolved `_config/*.ttl` files are config payloads, not bootstrap authority by filesystem location alone.
- ResourcePageSource resolution now fails closed for malformed, unsafe, or unsupported source specs instead of silently falling through to unrelated fallback content.
- ResourcePageDefinition current-only behavior means a Knop page-definition artifact may be represented by `_knop/_page/page.ttl` without a versioned `_history001` tree.
- Fixture helpers now read git-backed fixture snapshots from resolved commit SHAs rather than mutable refs, so local branch movement should not change fixture content under an existing cache key.

## Artifacts

- Git tag: `v0.2.2`
- GitHub Release: `v0.2.2`
- Native binary archives for Linux x64, Windows x64, macOS x64, and macOS arm64
- Matching `.sha256` checksum files
- npm packages for `@semantic-flow/weave` and supported platform packages

## Validation

- Source quality gate for release preparation: `deno task ci`, covering fmt check, lint, type check, coverage test run, and LCOV generation.
- PR-level GitHub Actions `ci`, CodeQL, and CodeRabbit checks passed for the release-candidate branch before release prep. Codecov patch status remained useful coverage telemetry rather than the source quality gate for this release.
- Release workflow rehearsal should use the `Release Manual` workflow with `npm_publish_mode: dry-run` and `github_release_mode: draft` before publishing npm packages or the GitHub Release.
- Native binary smoke path: each built executable should run `weave --version`, and npm smoke install should verify the wrapper package resolves the matching platform package.

## Known Limitations

- Full append-onlyish inventory behavior is not complete. The release includes the shared append planner and first support-artifact consumers, but broad MeshInventory/KnopInventory writer migration and the full inventory-versus-metadata progression split remain follow-up work.
- ResourcePageDefinition source regions still have a first-slice source-loading surface. Delegating direct `targetLocalRelativePath` regions fully through the shared resolver and adding `targetLocatedFile` support should land with explicit page-definition behavior tests.
- Generic config-source management commands do not exist yet; source-backed config can be authored in RDF, but there is no dedicated CLI for adding or auditing config-source attachments.
- Historical ResourcePage regeneration remains policy/design follow-up. Current generation is target-aware, but rebuild/repair/retraction modes are still intentionally separate future work.
- Remote working/source URL resolution remains behind explicit operational policy and digest expectations; broad remote fetch workflows are not part of this release.

## Next

- Continue append-onlyish inventory work: migrate remaining inventory writers to append/no-op/fail-closed semantics, keep mutable current/latest/next progression in metadata, and add rerun idempotence tests for release automation.
- Finish the ResourcePageDefinition resolver follow-up for direct `targetLocalRelativePath`, `targetLocatedFile`, digest, and fallback behavior.
- Use the improved GitHub test analytics on main to tune Codecov patch thresholds and identify real coverage gaps without letting coverage telemetry block unrelated correctness releases.
- Prepare the next publication dogfood pass for SFLO/URPX once this release is available as a packaged CLI.
