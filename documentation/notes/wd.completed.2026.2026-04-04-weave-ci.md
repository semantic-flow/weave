---
id: p6n4x8b2q1v7m3c9t5k0jra
title: 2026 04 04 Weave CI
desc: ''
updated: 1775338619505
created: 1775366400000
---

## Goals

- Establish a pragmatic PR-based CI workflow for `weave` so changes land through branches and pull requests rather than direct pushes to the default branch.
- Bring CodeRabbit review and Codecov coverage reporting into pull requests early enough to improve review quality without overengineering release automation.
- Add baseline quality gates that are strict enough to protect `main` but still low-maintenance for an early Deno-first repository.
- Keep repository automation aligned with the current carried-slice development model rather than pretending release engineering is already settled.

## Summary

This task should define and then implement the first real CI and PR workflow for `weave`.

The immediate motivation is practical:

- branch-based development with pull requests
- automatic CI results on each PR
- CodeRabbit review on PRs
- Codecov reports on PRs
- branch protection and required checks as actual quality gates

The repository does not currently have a `.github/` workflow surface. That means this task needs to cover both repository-local automation files and the GitHub-side setup that cannot be expressed only in git-tracked files.

The intended end state is a low-maintenance baseline:

- PRs run the main validation stack
- coverage is uploaded and visible in Codecov
- CodeRabbit reviews are available on PRs
- the default branch is protected by required checks
- GitHub-native code scanning is enabled where it adds value

This task should not expand into release automation, packaging, or broader DevOps work that the repository is not ready to own yet.

## Discussion

### Why this is needed now

The repository has moved past one-off bootstrap work.

There are now enough carried slices, tests, and separate repositories in play that direct-merge development is starting to cost more than a simple PR workflow.

The immediate value of CI here is not abstract process compliance. It is:

- catching regressions before merge
- making review outcomes visible in the PR itself
- getting CodeRabbit and Codecov into the same place humans are already reviewing
- making later branch protection possible without inventing new workflow semantics

Coverage should also be treated as part of the repository task surface rather than as ad hoc shell inside GitHub Actions. If Weave generates LCOV in CI, the commands for doing that should live in dedicated Deno tasks so local and CI behavior stay aligned.

### Current repository state

Today `weave` has:

- a Deno task-level validation entrypoint in `deno task ci`
- no `.github/workflows/ci.yml`
- no `.coderabbit.yaml`
- no repository-local Codecov wiring
- no documented Weave-specific PR baseline or GitHub quality-gate policy

That means the first CI task should start with the minimum useful GitHub automation rather than trying to skip straight to advanced scanning or release work.

### Recommended rollout order

#### Phase 1: PR baseline

This is the minimum needed to start branch-based development sanely.

- add `.github/workflows/ci.yml`
- run `deno task ci`
- add dedicated coverage tasks so CI can generate coverage output without workflow-only shell glue
- add a minimal root `.coderabbit.yaml`
- install or verify the CodeRabbit GitHub app for the repository or organization
- enable branch protection for the default branch

Branch protection should require at least:

- pull requests before merge
- passing `ci` status
- no direct pushes by default

CodeRabbit should start as advisory review, not as the only merge gate.

### Phase 2: Coverage publishing

Once the PR baseline is green, add Codecov reporting.

The likely shape is:

- add Deno tasks equivalent to Accord's `test:coverage` and `coverage:lcov`
- generate `coverage/lcov.info` through those tasks in CI
- upload coverage with the standard Codecov GitHub Action
- prefer the Kato-style OIDC path rather than a repository token unless Codecov forces a different setup
- keep Codecov informational first, then decide later whether patch coverage or project coverage should gate merges

Coverage visibility is useful immediately, but it should not outrank basic pass/fail CI bring-up.

### Phase 3: Code scanning and maintenance

After the PR baseline is stable, add the next GitHub-native hardening layer.

Current recommendation:

- enable GitHub CodeQL default setup first rather than authoring a custom workflow
- add Dependabot for GitHub Actions updates
- defer OSV-Scanner for now and revisit only after dependency surface or packaging complexity makes it materially useful

This keeps the repository on the low-maintenance path and avoids premature workflow sprawl.

### Quality-gate posture

The first real quality gates should be conservative but real.

Recommended default posture:

- `ci` is required before merge
- PR review is required before merge
- CodeRabbit is advisory, not a replacement for human review
- Codecov is informational at first
- CodeQL alerts are triaged, but not automatically treated as merge blockers until the first baseline is understood

That is strong enough to change behavior without turning the repo into a settings maze.

### Likely repository inventory

The first implementation likely needs:

- `.github/workflows/ci.yml`
- `.coderabbit.yaml`
- probably `.github/dependabot.yml`

The initial `.coderabbit.yaml` should at least exclude note classes that are mostly archival or conversational review noise, for example:

```yaml
reviews:
  path_filters:
    - "!documentation/notes/wd.conv.*"
    - "!documentation/notes/wd.completed.*"
  auto_review:
    enabled: true
```

If Codecov onboarding requires repository-local configuration, that should be kept minimal at first.

### Weave-specific follow-up

A later follow-up may use Accord in CI as a stronger acceptance oracle for carried fixture slices.

That should not be part of the first CI task unless the baseline PR workflow is already working and the added signal is clearly worth the maintenance cost.

## Open Issues

- Should the repository later move Dependabot configuration from GitHub web settings into a committed `.github/dependabot.yml` so update policy is repository-local and reviewable?

## Decisions

- Prioritize PR-based development and required CI before release automation.
- Use CodeRabbit for PR review, but do not let it replace ordinary branch protection and human review expectations.
- Prefer a single baseline `ci.yml` workflow first rather than multiple specialized workflows.
- Prefer the existing Deno task entrypoint `deno task ci` as the core validation command.
- Put coverage generation behind dedicated Deno tasks rather than workflow-local shell, following Accord's `test:coverage` and `coverage:lcov` pattern unless Weave hits a concrete reason to diverge.
- Generate coverage in CI during the first bring-up even if Codecov does not become a required gate immediately.
- Keep Codecov informational during the first bring-up rather than making patch coverage an early merge gate.
- Commit a minimal `.coderabbit.yaml` that excludes `documentation/notes/wd.conv.*` and `documentation/notes/wd.completed.*` from review noise.
- Prefer GitHub CodeQL default setup before introducing a custom code-scanning workflow.
- Prefer the Kato-style Codecov OIDC path over repository tokens by default.
- Defer OSV-Scanner until the repository has more dependency or packaging surface to justify the maintenance cost.
- Defer release automation, packaging automation, and broader security workflow sprawl.

## Contract Changes

- No public Semantic Flow or Weave API contract changes are required by this task.
- This task affects repository workflow, review policy, and automation posture rather than external semantic behavior.

## Testing

- The baseline CI workflow should at minimum run the same validation stack developers are expected to run locally via `deno task ci`.
- Coverage generation should be validated both locally and in GitHub Actions through the dedicated Deno tasks before trusting Codecov reports.
- If branch protection is enabled during this task, verify the required check names match the actual workflow job names so merges do not get stuck on stale configuration.
- If CodeQL or Dependabot are enabled, review the first baseline output and adjust only after seeing real repository-specific noise.

## Non-Goals

- release automation
- packaging or distribution automation
- npm publication work
- a full security-program workflow suite on day one
- making CodeRabbit or Codecov the sole merge gate
- folding Accord-based acceptance execution into the first CI bring-up by default

## Implementation Plan

- [x] Refine this task note into the concrete first-pass Weave CI rollout.
- [x] Add `.github/workflows/ci.yml` for pull requests and default-branch validation.
- [x] Add dedicated coverage tasks, likely `test:coverage` and `coverage:lcov`, so coverage generation is repository-defined rather than workflow-local.
- [x] Add a minimal `.coderabbit.yaml` with Weave-appropriate review exclusions.
- [x] Verify or install the CodeRabbit GitHub app for the relevant repository or organization.
- [c] Enable branch protection on the default branch and require the `ci` status for this first pass.
- [x] Generate `coverage/lcov.info` in CI via the dedicated coverage tasks.
- [x] Onboard `weave` in Codecov.
- [x] Add the first Codecov upload step.
- [x] Prefer an OIDC-based Codecov upload path unless a concrete blocker appears.
- [x] Enable GitHub CodeQL default setup and review the first baseline findings.
- [x] Add Dependabot for GitHub Actions updates if the initial workflow surface is stable enough to justify it.
- [c] Revisit later whether Codecov should remain informational or become a required signal.
