---
id: yzu9g1n4ppf9lpf17xahj3u
title: 2026 05 14_1105 Guarded Branch Published Rebuild
desc: ''
updated: 1778766300000
created: 1778766300000
---

## Goals

- Add an explicit rebuild-from-scratch mode for branch-published meshes after incremental publication is the proven default.
- Keep rebuild behavior loud, guarded, and separate from ordinary `weave deploy gh-pages`.
- Preserve intentional publication controls such as `.nojekyll`, `CNAME`, and declared manual files when rebuilding.
- Prevent accidental source-branch writes, branch resets, force updates, or publication file deletion.

## Summary

[[wd.task.2026.2026-05-13_1655-support-gh-pages-branch-based-deployments]] proves the clean-source, incremental branch-published path. Rebuild-from-scratch is still useful for disaster recovery, fixture regeneration, and intentional model churn, but it has a different risk profile. It should not ride along as a casual flag on the first local deploy implementation.

This task is for the later guarded rebuild path. The mode should require an explicit operator decision, validate preserved-file policy before deleting anything, and make the planned deletion/write set inspectable before it mutates a publication worktree.

## Discussion

Normal branch-published deploy treats the publication branch as stateful Semantic Flow output. It reuses the existing mesh shell, preserves unknown non-generated files, updates source bindings, and advances generated state incrementally. Rebuild mode temporarily treats generated output as disposable and therefore needs stronger guardrails.

The dangerous operations are deleting existing publication files, resetting generated mesh state, and potentially recreating semantic histories. Those operations should be separate from local generation, local commit support, and push support.

The dry-run planner should grow enough detail to show:

- paths that would be deleted
- paths that would be preserved
- paths that would be recreated
- publication control files that would be carried forward
- whether semantic histories would be reset
- whether the publication worktree is clean enough for a rebuild

## Open Issues

- Should rebuild preserve unknown files by default, or require an explicit preserved-file allowlist?
- Should rebuild require both `--rebuild-from-scratch` and `--confirm-rebuild`, or is one loud flag plus dry-run enough?
- Should rebuild be allowed against a dirty publication worktree under any circumstances?
- Should rebuild delete generated histories, or should history reset be an even louder sub-mode?
- Should fixture-ladder regeneration use this mode directly, or use fixture-specific checkout replacement instead?

## Decisions

- Rebuild mode is deferred from the first branch-published deploy task.
- Rebuild mode must be explicit and guarded; it is not the default deploy path.
- Incremental deploy remains the default for branch-published meshes.
- Push support is out of scope for rebuild mode until local commit behavior is settled.

## Contract Changes

- Future branch-published deploy may gain a guarded rebuild mode that deletes/recreates generated publication output only after an explicit rebuild request.
- Rebuild dry-run output should include deletion and preservation plans.

## Testing

- Add dry-run tests showing rebuild deletion/preservation plans without mutating the publication root.
- Add integration tests proving normal deploy does not delete unknown publication files.
- Add integration tests proving rebuild refuses dirty publication worktrees by default.
- Add tests for `.nojekyll`, `CNAME`, and declared preserved-file handling.
- Add tests proving rebuild does not touch the source checkout.

## Non-Goals

- Adding push support.
- Replacing incremental deploy as the default branch-published workflow.
- Solving fixture ladder regeneration directly.
- Force-pushing or deleting publication branch content without explicit operator intent.

## Implementation Plan

- [ ] Define the rebuild request shape and preserved-file policy.
- [ ] Extend dry-run output with deletion and preservation plans.
- [ ] Add guarded rebuild validation for clean publication worktrees.
- [ ] Implement local rebuild without commit/push.
- [ ] Add focused integration tests.
