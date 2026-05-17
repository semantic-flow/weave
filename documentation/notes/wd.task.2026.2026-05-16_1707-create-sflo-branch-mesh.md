---
id: ilvklxv3r9r6kdf8t5xjug4
title: 2026 05 16_1707 Create Sflo Branch Mesh
desc: ''
updated: 1778976491069
created: 1778976491069
---

## Goals

- Dogfood Weave on the live `sflo` ontology repo before attempting the URPX build.
- Treat `sflo:main` as clean source and use a branch-published mesh publication branch, probably `gh-pages`, as the woven/published state.
- Produce browsable ResourcePages for the core ontology, config ontology, SHACL, and supporting ontology artifacts with friendly history and state paths.
- Surface release-blocking gaps in branch-published mesh setup, deploy ergonomics, source provenance, and config defaults.
- Keep the workflow repeatable enough to become a small runbook for URPX and other ontology repos.

## Summary

The next useful dogfood step is to build a branch-published Semantic Flow mesh for `dependencies/github.com/semantic-flow/sflo`. This should exercise the same class of behavior URPX will need, but with an ontology we understand deeply and can inspect quickly.

The intended repository shape is:

- `main`: source-only ontology repository, suitable for normal ontology editing.
- `gh-pages`: woven/publication branch containing Weave support artifacts, generated ResourcePages, and source provenance that points back to source files and source commits on `main`.

This should not become an Alice-style fixture ladder yet. The first pass is a practical dogfood build: bootstrap the mesh, publish it, inspect the output, and record the sharp edges.

## Discussion

This task is primarily about release confidence. If Weave can publish the `sflo` ontology with good ResourcePages and understandable history/state paths, then URPX becomes a much cleaner external acceptance test. If `sflo` exposes missing config behavior, we can fix that before adding URPX-specific noise.

The branch-published setup is also the right model for ontology repos that want their source branch to stay clean while GitHub Pages serves the generated mesh. That means the publication branch cannot be treated like a sidecar `docs/` mesh. We should expect deploy commands to read from one worktree and write to another.

The one-worktree limitation matters. Git will not let the same branch be checked out in two worktrees at once, and a single worktree cannot simultaneously be on `main` and `gh-pages`. For this task, use `dependencies/github.com/semantic-flow/sflo` as the canonical source checkout on `main`, and use a separate temporary or dependency-local publication worktree for `gh-pages`. Before creating a publication worktree, check `git worktree list` so we do not collide with an existing checkout of `gh-pages`.

The publication worktree can be disposable during experimentation. Once the process stabilizes, decide whether to keep a named worktree under `dependencies/github.com/semantic-flow/sflo-gh-pages` or recreate it as needed. Avoid putting generated publication output into the source checkout unless we intentionally switch that checkout to `gh-pages` for preview.

## Open Issues

- Should all-terms extraction create source references by default, or should reference creation be an explicit `--add-source-references` / `--reference-role canonical` option?
- Should source-reference creation be limited to extracted terms that appear as RDF subjects, or should it include every extracted named mesh term discovered in subject, predicate, or object position?

## Working Answers

- Use `https://semantic-flow.github.io/sflo/` as the public mesh base for this pass.
- Start with `semantic-flow-core-ontology.ttl`, `semantic-flow-config-ontology.ttl`, and `semantic-flow-core-shacl.ttl`. Do not include `semantic-flow-prov-ontology.ttl` or `semantic-flow-job-ontology.ttl` until the first three files have healthy pages, source provenance, and generated links.
- Keep `sflo:main` clean for now. The normal durable mesh config should live on `gh-pages` under `_mesh/_config/config.ttl`, because it describes the publication mesh. First-bootstrap settings can be CLI/profile/CI/operator input, not source-branch files.
- Revisit source-side bootstrap config only if repeated dogfood or URPX setup needs reviewable, repo-carried publication intent that cannot reasonably live on the publication branch or in CI/operator input.
- There is no existing `gh-pages` branch, so the first pass should create a new publication branch/worktree rather than force-reset existing publication history. After that, normal dogfood runs should preserve and update the publication branch incrementally.
- Use `/tmp/weave-logs/sflo` as the explicit out-of-repo log directory for dogfood commands.
- Record source provenance with the exact observed source commit as the durable provenance anchor, and also record `main` as the source ref/context when the source was read from that lane. If a downstream consumer needs one value to prove what bytes were published, the commit wins.
- An Accord scenario is valuable as a pinned, invariant-based release preflight, not as a moving golden fixture over live `sflo:main`. Keep stable conformance fixtures in smaller controlled repos such as Fantasy Rules; use `sflo` to prove real ontology pressure without pretending it is frozen.
- Wait on an `sflo` Accord/conformance scenario until after the dogfood path works. Because `sflo` will continue to change, the scenario can be added later as a pinned or invariant-style preflight without blocking the current build.
- Use `https://semantic-flow.github.io/sflo/config` as the config ontology base if/when the config namespace moves for this dogfood run.

## Sequencing

The branch-published dogfood should exercise the same flow we want URPX to use, so all-terms extraction should come before the real `sflo` publication run. Manually specifying every term would dodge one of the most important ontology-publishing pressures.

Current Weave already has `weave extract --all-terms --source ...` plus preview/accept-preview behavior. It discovers mesh-scoped named terms in a selected RDF payload, skips existing Knops, and skips generated support artifacts. The missing piece for this dogfood run is bulk source-reference creation for the extracted terms.

The proposed sequence is:

- settle the config base before extraction, because terms outside `https://semantic-flow.github.io/sflo/` will not be treated as first-class mesh terms by ordinary mesh-scoped discovery;
- make all-terms extraction create or optionally create references from each extracted term back to its source artifact, using `sflo:referenceRole_canonical` for ontology-definition sources unless we decide on a narrower role;
- ensure those references are generated without manual per-term `knop add-reference` calls;
- then run the branch-published `sflo` dogfood for core, config, and SHACL;
- defer Accord/conformance packaging until the manual dogfood output proves which invariants are worth capturing.

## Bootstrap Config Evaluation

The useful split from [[wd.task.2026.2026-05-13_1655-support-gh-pages-branch-based-deployments]] still holds: operation-local checkout paths are not durable mesh facts, while source provenance and target bindings are durable publication facts.

For this dogfood pass, bootstrap input can stay outside `sflo:main` when it only says how this run is wired locally:

- source checkout root;
- publication worktree root;
- publication branch name;
- whether to create `.nojekyll`, `CNAME`, a local commit, or a dry-run plan;
- first-run source binding arguments for one invocation;
- explicit local log directory such as `/tmp/weave-logs`.

Bootstrap config starts to justify a persistent home when it captures stable publication intent rather than one operator's checkout topology:

- canonical mesh base and Pages source folder assumptions;
- ordered source-to-designator bindings for core/config/SHACL and later ontology artifacts;
- source repository URL, default source ref, and whether to record exact observed commits;
- target materialization paths in the publication branch;
- source-binding refresh policy, digest expectations, or pinning policy;
- publication controls such as `.nojekyll`, `CNAME`, preserved files, local commit policy, and rebuild/force-reset guardrails;
- ResourcePage generation and presentation defaults that should survive across runs;
- config-resolution/profile choices that narrow behavior without granting new host trust.

If that persistent bootstrap profile is needed, prefer one of these homes, in order:

- `gh-pages` durable mesh config for facts about the published mesh and source bindings;
- CI/deploy workflow configuration for repeatable automation of checkout paths, branch names, and credentials;
- an operator-local profile for machine-specific paths or trust grants.

Avoid putting bootstrap config on `main` unless the source repo deliberately wants publication intent reviewed with source changes. For URPX, keeping source clean is still the more valuable default.

## `/ontology` Review

Some `/ontology` strings are expected because `https://semantic-flow.github.io/sflo/ontology/...` is the current core ontology namespace under the `sflo` site. The cleanup candidates are the older standalone `https://semantic-flow.github.io/ontology/...` and `https://github.com/semantic-flow/ontology/...` references:

- `semantic-flow-config-ontology.ttl` has moved to the slashless ontology IRI `https://semantic-flow.github.io/sflo/config` with term namespace `https://semantic-flow.github.io/sflo/config/`.
- `semantic-flow-core-ontology.ttl` uses the `sflo` ontology IRI, but `vann:preferredNamespaceUri` still says `https://semantic-flow.github.io/ontology/core/`, and `owl:versionIRI` / one `dcat:downloadURL` still point at `github.com/semantic-flow/ontology`.
- `semantic-flow-core-shacl.ttl` uses the `sflo` ontology IRI, but `owl:versionIRI` and one `dcat:downloadURL` still point at `github.com/semantic-flow/ontology`.
- `semantic-flow-prov-ontology.ttl` and `semantic-flow-job-ontology.ttl` are still on the standalone `/ontology/prov` and `/ontology/job` bases, but those are outside the initial core/config/SHACL slice.

The config namespace now sits under the `sflo` mesh base, so ordinary mesh-scoped extraction can treat config terms such as `https://semantic-flow.github.io/sflo/config/Config` as first-class identifiers with designator paths under `config/...`.

## Decisions

- Start with `sflo` before URPX.
- Treat `main` as source-only and `gh-pages` as the woven/publication branch.
- Use a separate publication worktree for `gh-pages`; do not try to use one checkout for both source and publication operations.
- Keep the first pass practical and release-focused rather than building a full fixture ladder immediately.
- Prefer command-driven Weave operations over hand-editing generated publication artifacts.
- Use `/tmp/weave-logs` or another explicit out-of-repo log directory during dogfood commands.
- Use `https://semantic-flow.github.io/sflo/` as the dogfood mesh base.
- Start with core, config, and SHACL only.
- Keep source-side bootstrap config off `main` unless the dogfood run proves that repo-reviewed publication intent is worth the source-branch footprint.
- Create the first `gh-pages` publication branch from scratch because no existing branch/history needs preservation.
- Use `/tmp/weave-logs/sflo` for dogfood logs.
- Treat exact source commit metadata as the authoritative provenance for published bytes, with `main` recorded as refresh context when applicable.
- Treat any future `sflo` Accord work as a pinned or invariant-based preflight scenario, not a reliable mutable fixture.
- Use `https://semantic-flow.github.io/sflo/config` as the preferred config ontology base.
- Implement or verify bulk source-reference creation for all-terms extraction before relying on the `sflo` dogfood output.
- Defer the `sflo` Accord/conformance scenario until the dogfood run exposes stable invariants worth checking.

## Contract Changes

- No runtime contract change is intended at task start.
- The dogfood run may reveal needed config defaults or CLI behavior changes for branch-published meshes.
- Any behavior change that affects portable Semantic Flow expectations should update the relevant `sf.spec.*` note in the Semantic Flow Framework repo.
- Any Weave-local CLI or release workflow behavior should be recorded in Weave developer notes, especially [[dev.release-runbook]] if it affects release preflight.

## Testing

- Before code changes, record the exact commands used to bootstrap and publish `sflo`.
- Run focused Weave tests for any code changes discovered during dogfood.
- Run `deno task check` and `deno task lint` after significant code changes.
- Run `deno task ci` before treating this dogfood run as release confidence.
- Locally preview the generated publication branch with a mounted live server or equivalent so absolute/public links behave like GitHub Pages.
- Inspect representative ResourcePages:
  - the root mesh page;
  - `semantic-flow-core-ontology`;
  - key classes such as `DigitalArtifact`, `ResourcePage`, `Knop`, `ArtifactHistory`, and `HistoricalState`;
  - config ontology terms;
  - SHACL shapes.

## Non-Goals

- Do not publish to npm as part of this task.
- Do not build URPX until the `sflo` dogfood path is understood.
- Do not turn this into a full fixture ladder unless we deliberately create a follow-up.
- Do not move source ontology files into a sidecar `docs/` layout.
- Do not hand-author generated `gh-pages` ResourcePages except to diagnose whether Weave needs a code/config fix.
- Do not add compatibility shims for old publication branch shapes unless they are necessary for the current release.

## Implementation Plan

- [ ] Confirm `dependencies/github.com/semantic-flow/sflo` is clean on `main` and up to date.
- [ ] Inspect existing remote/local branches and `git worktree list` for `sflo`.
- [x] Decide the publication base IRI for this pass.
- [ ] Create a separate new `gh-pages` publication worktree for `sflo`.
- [ ] Bootstrap the branch-published mesh publication surface from the source checkout into the publication worktree.
- [ ] Implement or verify all-terms extraction with bulk source-reference creation.
- [ ] Integrate or source-bind `semantic-flow-core-ontology.ttl` from `main`.
- [ ] Weave/generate ResourcePages for the core ontology artifact.
- [ ] Add config and SHACL once the first artifact path is healthy.
- [ ] Defer prov/job artifacts until the core/config/SHACL slice has been inspected.
- [ ] Preview the publication worktree locally and inspect representative pages.
- [ ] Record any release-blocking gaps in config defaults, history/state naming, source provenance, generated links, or CLI ergonomics.
- [ ] Patch Weave only for issues that block the `sflo` dogfood or URPX release path.
- [ ] Run focused tests for any patches, then `deno task check`, `deno task lint`, and `deno task ci`.
- [ ] Update [[dev.release-runbook]] with the final dogfood commands if they become release preflight steps.
- [ ] Decide whether to push the `gh-pages` branch or keep the first run local-only.
