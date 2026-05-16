---
id: gnzt0bhjjp2df26q98ipa9g
title: 2026 05 16_1625 Manifest Completeness Check
desc: ''
updated: 1778973915922
created: 1778973915922
---

## Goals

- Add a Weave-side fixture manifest completeness check so fixture branches cannot drift beyond what their Accord manifests explicitly describe.
- Keep the check focused on fixture truthfulness: every `fromRef` to `toRef` tree change is either declared by `hasFileExpectation` or intentionally excluded by `ignorePaths`.
- Preserve the existing Weave e2e role: runtime commands should continue proving that generated output matches the selected fixture branch.
- Make release preflight catch manifest drift before downstream Accord fixture tests do.
- Keep this general enough to cover Alice Bio, sidecar Fantasy Rules, and branch-published Fantasy Rules ladders without hard-coding mesh-specific path lists.

## Summary

The immediate failure mode is not a Weave runtime mismatch. Accord is finding that some fixture manifests are incomplete: branch diffs include generated files that are not covered by `hasFileExpectation` and are not ignored. Weave tests can still pass because they mostly compare command output to fixture branches and only compare manifest-declared files for content semantics.

That split is useful, but it leaves a blind spot in Weave: we can update fixture branches and e2e tests while forgetting to update the manifests that are supposed to explain those branches. Add a dedicated manifest-completeness gate in Weave, and adjust Accord's optional external fixture tests so they sweep current manifests without relying on brittle exact pass counts.

## Discussion

There are two separate contracts:

- Weave runtime compatibility: given a fixture branch and command, does Weave produce the expected workspace state?
- Accord manifest completeness: given `fromRef` and `toRef`, does the manifest fully describe the branch diff and the expected semantic checks?

The existing Weave e2e helpers mostly exercise the first contract. They are allowed to compare the whole workspace file list to `toRef`, then compare only the files listed in `hasFileExpectation`. That means an extra generated `index.html` can be present in both Weave output and the fixture branch while remaining absent from the manifest.

Accord's `tree_completeness` check exercises the second contract. It should remain strict. If the branch diff changes, either the manifest expectations need to change or the path needs a deliberate `ignorePaths` entry.

I do not think we should fold Accord's full manifest-completeness behavior into every Weave e2e assertion. That would make failure causes muddy and make ordinary runtime tests feel like manifest-schema tests. A separate check gives a cleaner signal.

Accord's optional `mesh-alice-bio` fixture test should also be improved, but that belongs in Accord: discover the current manifest set, run `accord check` for each, and assert all pass. It should not assert exact pass counts against living fixture branches. Exact counts are good for Accord's own tiny testdata, not for Weave-owned fixture ladders.

## Open Issues

- Should the Weave manifest-completeness task run in ordinary `deno task ci`, or only in release preflight until fixture dependency setup is stable?
- Should a completeness sweep include all fixture scenarios by default, or start with Alice Bio and add sidecar and branch-published fixtures once their manifests are repaired?
- Do we want an "expected incomplete" allowlist while existing manifests are being repaired, or should the task land only after all current manifests pass?
- Should completeness checking live inside `scripts/fixture-ladder.ts`, a new small script, or a shared test helper that can be called from both tests and tasks?
- Should generated HTML pages normally be declared with `hasFileExpectation`, or should broad generated-page families use `ignorePaths` when RDF expectations already cover the semantic contract?

## Decisions

- Keep Weave e2e output tests and Accord manifest completeness checks as separate validation layers.
- Add a dedicated Weave task for fixture manifest completeness rather than overloading `deno task test`.
- Treat `ignorePaths` as an explicit contract, not a convenience blanket. Meaningful generated output should usually be represented by expectations unless the path family is intentionally outside the manifest's behavior contract.
- In Accord, keep fixture-based mesh tests optional but make them sweep all current manifests when enabled.
- In Accord, prefer pass/fail status assertions over exact pass-count assertions for external living fixture repos.

## Contract Changes

- Developer validation contract: fixture branch updates must be accompanied by manifest updates that describe the resulting branch diff.
- Release preflight should include the manifest-completeness check before publishing Weave or refreshing downstream conformance fixtures.
- No Weave runtime behavior change is intended.
- No Accord `check` replay behavior is intended. `check` validates fixture state; replay command metadata remains separate.

## Testing

- Add focused tests for the Weave completeness wrapper, including:
  - a passing manifest whose changed paths are fully covered by `hasFileExpectation`;
  - a failing manifest with an unexpected changed path;
  - a passing manifest where an unexpected path is deliberately covered by `ignorePaths`;
  - an invalid manifest where a file expectation conflicts with `ignorePaths`.
- Run the new task against the current Alice Bio manifests after repairing drift.
- Run the new task against sidecar and branch-published fixture manifests once their manifest expectations are current.
- Keep `deno task ci` green.
- Update [[dev.release-runbook]] to include the manifest-completeness task in release preflight.

## Non-Goals

- Do not make Accord execute `hasCommandInvocation` or `hasCommandSequence` as part of `accord check`.
- Do not replace Weave's existing e2e fixture-output tests.
- Do not add mesh-specific generated path hard-coding to Weave tests.
- Do not use `ignorePaths` to hide fixture drift that should be documented as generated output.
- Do not require all developers to have every optional external fixture checkout available for ordinary local unit tests unless we intentionally add the task to `ci`.

## Implementation Plan

- [ ] Inventory current fixture manifest failures from Accord's optional mesh fixture test output and group them by path family.
- [ ] Repair current Alice Bio manifests by adding missing `hasFileExpectation` entries or deliberate `ignorePaths` entries.
- [ ] Add a Weave manifest-completeness script or fixture-ladder subcommand that runs Accord tree completeness against configured fixture manifest sets.
- [ ] Add `deno task fixture:manifest-check` or equivalent to `deno.json`.
- [ ] Add focused tests for the completeness wrapper and failure reporting.
- [ ] Decide whether the task belongs in ordinary `deno task ci`, a new `deno task ci:fixtures`, or release preflight only.
- [ ] Update [[dev.release-runbook]] with the chosen command and expected failure triage workflow.
- [ ] Add or update Accord optional fixture tests so they discover all current Alice manifests, rewrite legacy refs to `a.*` where needed, and assert pass/fail status without exact pass-count coupling.
- [ ] Repeat the manifest repair/check loop for sidecar Fantasy Rules and branch-published Fantasy Rules fixture ladders.
