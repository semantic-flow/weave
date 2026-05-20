---
id: fdpf85wtomsgp6k544lg0kb
title: Fixture Ladder Regeneration
desc: ''
updated: 1779235115411
created: 1779180078954
---

## Purpose

This note is the operational playbook for regenerating Weave's live Semantic Flow fixture ladders. These ladders are external git repositories under `dependencies/github.com/semantic-flow/` that Weave tests read by ref, so regenerating them is a cross-repo operation: Weave code produces new fixture states, the fixture repository refs move locally, and the fixture branches must be reviewed and pushed separately.

Use this playbook when the expected generated mesh shape changes across many fixture-backed tests, for example after ontology vocabulary changes, ResourcePage output changes, inventory/source-registry structure changes, or branch-publication workflow changes. Do not use it for an isolated assertion bug that can be fixed with a focused test update.

## Fixture Repositories

The current live fixture ladders are:

- `dependencies/github.com/semantic-flow/mesh-alice-bio`
- `dependencies/github.com/semantic-flow/mesh-sidecar-fantasy-rules`
- `dependencies/github.com/semantic-flow/mesh-branch-fantasy-rules`

The live ladder refs use the `a.*` branch series. Older unprefixed branch series are historical fixtures; do not regenerate or chase them during a live ladder rerung unless a task explicitly asks for that archival series.

The transition manifests and example specs live in the Semantic Flow Framework checkout:

- `dependencies/github.com/semantic-flow/semantic-flow-framework`

The ladder runner also uses Accord from:

- `dependencies/github.com/spectacular-voyage/accord`

GitHub CI must check out all of these fixture repositories before running the full test suite. If local tests pass but GitHub CI cannot resolve refs such as `a.10-root-knop`, the workflow is probably missing a fixture checkout or fetch. If GitHub CI reads old vocabulary such as `sflo:hasLocatedFile` while local fixture refs have `sflo:locatedFileForManifestation`, the remote fixture branches are stale and need to be pushed.

## Tooling

The entrypoint is:

```sh
deno task fixture:ladder -- --scenario alice-bio
deno task fixture:ladder -- --scenario sidecar-fantasy-rules
deno task fixture:ladder -- --scenario branch-fantasy-rules
```

Useful options:

- `--scenario <id>` selects `alice-bio`, `sidecar-fantasy-rules`, or `branch-fantasy-rules`
- `--json` prints machine-readable plan/result data
- `--materialize <transition-id>` copies a transition's source state into a workspace without running the transition
- `--execute <transition-id>` materializes, runs, validates, and, if successful, updates the local fixture branch ref
- `--dry-run` executes and validates but does not update fixture branch refs
- `--workspace-root <path>` uses a specific empty workspace, useful for debugging one transition

The script intentionally does not push fixture branches. Its successful output says which branch was updated and reminds you to push that branch separately.

## Rung Dependency Model

A fixture ladder is an ordered chain of branch refs. Most transitions read the previous rung's `toRef` as their next `fromRef`, so regeneration is usually a whole-ladder operation: an early ontology, inventory, ResourcePage, source-registry, or publication behavior change needs to be carried through every later rung.

The runner's plan order is the source of truth. Do not regenerate by alphabetically sorting branch names. This matters most in `branch-fantasy-rules`, where the source lane and publication lane diverge: `10-first-release-source` starts from `a.01-source-only`, while later publication transitions continue from publication refs.

Local rung branches are also part of the chain. During a whole-ladder execution, transition N updates a local `a.*` branch, and transition N+1 should read that freshly regenerated local branch. Targeted regeneration is still possible, but use it only when the changed behavior is isolated to a late transition and all earlier `fromRef` branches are intentionally kept as-is.

## Preflight

Start from a clean Weave checkout and clean fixture checkouts. Regeneration moves fixture refs, so unrelated fixture work should be committed, stashed, or moved out of the way first.

```sh
git status --short

for repo in mesh-alice-bio mesh-sidecar-fantasy-rules mesh-branch-fantasy-rules; do
  git -C "dependencies/github.com/semantic-flow/$repo" status --short --branch
done
```

Keep fixture working trees on ordinary source branches such as `main` during regeneration. In particular, `mesh-branch-fantasy-rules` may have a local `gh-pages` branch that is a publication output and does not carry `.assets`; running the ladder from that checkout can fail before the transition logic is reached.

Because the resolver checks local `a.*` branches before `origin/a.*`, stale local rung branches can shadow the remote fixture baseline. Before a whole-ladder rerung, decide whether the current local rungs are intentional input or whether you want to clean them out and rebuild from remote refs.

Fetch the latest fixture refs before comparing local and remote state:

```sh
for repo in mesh-alice-bio mesh-sidecar-fantasy-rules mesh-branch-fantasy-rules; do
  git -C "dependencies/github.com/semantic-flow/$repo" fetch origin "+refs/heads/*:refs/remotes/origin/*"
done
```

Review the ladder plans:

```sh
for scenario in alice-bio sidecar-fantasy-rules branch-fantasy-rules; do
  deno task fixture:ladder -- --scenario "$scenario"
done
```

For a compact transition list:

```sh
for scenario in alice-bio sidecar-fantasy-rules branch-fantasy-rules; do
  deno task fixture:ladder -- --scenario "$scenario" --json |
    jq -r '"# " + .scenario.label, (.transitions[] | [.id, .fromRef, .toRef] | @tsv)'
done
```

## Clean Local Rung Branches

For a whole-ladder rerung, the least surprising starting point is usually "remote baseline, then rebuild locally in plan order." After fetching, remove local `a.*` checkpoint branches if they are stale, experimental, or left over from a previous partial rerung. This only removes local branch names; it does not delete remote fixture branches.

First make sure no fixture repo is currently checked out on a rung branch:

```sh
for repo in mesh-alice-bio mesh-sidecar-fantasy-rules mesh-branch-fantasy-rules; do
  repo_path="dependencies/github.com/semantic-flow/$repo"
  current="$(git -C "$repo_path" branch --show-current)"
  case "$current" in
    a.*) echo "$repo is on rung branch $current; switch to a non-rung branch before cleanup" ;;
  esac
done
```

Then inspect unpushed local rung commits before deleting branch refs:

```sh
for repo in mesh-alice-bio mesh-sidecar-fantasy-rules mesh-branch-fantasy-rules; do
  repo_path="dependencies/github.com/semantic-flow/$repo"
  echo "## $repo"
  git -C "$repo_path" log --oneline --decorate --branches='a.*' --not --remotes=origin --max-count=50
done
```

If that review is clean, remove the local rung branches:

```sh
for repo in mesh-alice-bio mesh-sidecar-fantasy-rules mesh-branch-fantasy-rules; do
  repo_path="dependencies/github.com/semantic-flow/$repo"
  for branch in $(git -C "$repo_path" branch --list --format='%(refname:short)' 'a.*'); do
    git -C "$repo_path" branch -D "$branch"
  done
done
```

Do not clean `gh-pages` as part of rung cleanup. For branch-published fixtures, treat `gh-pages` as a publication branch and review or reset it deliberately when needed.

## Dry Run

Run a full dry run first. This catches command failures, validation failures, missing assets, missing refs, and generated-output guardrail failures without moving fixture refs.

Because `--dry-run` does not update local `a.*` branches, it does not fully simulate cumulative rung-to-rung propagation. Treat it as a transition smoke test. The execute pass is the step that actually rebuilds the ladder chain.

When the remote target branch is already known stale, a dry-run can complete the operation and still report comparison failures against that stale `toRef`. In that case, separate "the command ran and generated plausible output" from "the output matches the old remote checkpoint." Command failures, missing assets, validation failures against the generated workspace, and generated-output guardrail failures are stop signs; stale target comparisons are the drift you are about to replace.

```sh
for scenario in alice-bio sidecar-fantasy-rules branch-fantasy-rules; do
  deno task fixture:ladder -- --scenario "$scenario" --json |
    jq -r '.transitions[].id' |
    while read -r transition; do
      deno task fixture:ladder -- --scenario "$scenario" --execute "$transition" --dry-run
    done
done
```

If one transition fails, debug that transition directly with a named workspace:

```sh
rm -rf /tmp/weave-fixture-debug
deno task fixture:ladder -- \
  --scenario sidecar-fantasy-rules \
  --materialize 10-root-knop \
  --workspace-root /tmp/weave-fixture-debug
```

Then run the printed command manually from the printed workspace. When the fix is made, rerun the same transition with `--execute ... --dry-run`.

## Execute

After the dry run passes, execute each scenario in plan order without `--dry-run`. Whole-ladder execution is the normal regeneration path: each updated local rung becomes available to the later transitions that depend on it.

```sh
for scenario in alice-bio sidecar-fantasy-rules branch-fantasy-rules; do
  deno task fixture:ladder -- --scenario "$scenario" --json |
    jq -r '.transitions[].id' |
    while read -r transition; do
      deno task fixture:ladder -- --scenario "$scenario" --execute "$transition"
    done
done
```

Each successful transition writes a local commit object into the fixture repository and updates a local branch such as `a.05-alice-knop-created-woven`. For branch-published transitions, the script may also fast-forward the local publication branch, such as `gh-pages`, after updating the checkpoint branch.

The branch-published ladder is not strictly a single source-lane chain: `10-first-release-source` starts from `a.01-source-only`, while later publication transitions continue from publication refs. Use the plan order from the script rather than inventing an order by sorting branch names.

If a branch-published rerung intentionally rewrites the publication ladder from an earlier checkpoint, local `gh-pages` may not be an ancestor of the regenerated publication commit. Inspect the divergence. If the regenerated publication branch is correct, move local `gh-pages` deliberately to the regenerated publication checkpoint and plan a `--force-with-lease` push for `gh-pages` after review.

## Review

Inspect every fixture repo before pushing anything:

```sh
for repo in mesh-alice-bio mesh-sidecar-fantasy-rules mesh-branch-fantasy-rules; do
  echo "## $repo"
  git -C "dependencies/github.com/semantic-flow/$repo" status --short --branch
  git -C "dependencies/github.com/semantic-flow/$repo" log --oneline --decorate --branches='a.*' --not --remotes=origin --max-count=30
done
```

Spot-check representative generated changes. For a vocabulary-wide rerung, it is normal to see broad mechanical changes such as property renames, generated ResourcePage updates, source-registry shape updates, or support inventory updates. It is not normal to see unrelated personal files, runtime logs, `.weave/`, editor files, or accidental source edits.

```sh
git -C dependencies/github.com/semantic-flow/mesh-alice-bio diff --stat origin/a.05-alice-knop-created-woven..a.05-alice-knop-created-woven
git -C dependencies/github.com/semantic-flow/mesh-sidecar-fantasy-rules diff --stat origin/a.17-all-remaining-terms-woven..a.17-all-remaining-terms-woven
git -C dependencies/github.com/semantic-flow/mesh-branch-fantasy-rules diff --stat origin/a.15-extracted-term-references-woven..a.15-extracted-term-references-woven
```

Run the local gate from Weave after regeneration:

```sh
deno task ci
```

For release/CI parity, also run the same coverage path used by GitHub Actions:

```sh
deno task test:coverage
deno task coverage:lcov
```

## Push

Push only the fixture branches that were intentionally regenerated. Prefer copying the branch names printed by the execution output so you do not accidentally publish unrelated local fixture branches.

Example:

```sh
git -C dependencies/github.com/semantic-flow/mesh-alice-bio push origin a.04-alice-knop-created a.05-alice-knop-created-woven
```

For a full rerung, generate a reviewable push plan first:

```sh
for repo in mesh-alice-bio mesh-sidecar-fantasy-rules mesh-branch-fantasy-rules; do
  repo_path="dependencies/github.com/semantic-flow/$repo"
  echo "## $repo"
  for branch in $(git -C "$repo_path" branch --list --format='%(refname:short)' 'a.*'); do
    if git -C "$repo_path" rev-parse --verify --quiet "origin/$branch" >/dev/null; then
      if [ -n "$(git -C "$repo_path" log --oneline "origin/$branch..$branch")" ]; then
        echo "git -C $repo_path push origin $branch"
      fi
    else
      echo "git -C $repo_path push origin $branch"
    fi
  done
done
```

After reviewing the printed commands, run only the intended pushes. For `mesh-branch-fantasy-rules`, also push `gh-pages` if the branch-published publication branch was intentionally updated. Use a normal push when it is a fast-forward:

```sh
git -C dependencies/github.com/semantic-flow/mesh-branch-fantasy-rules push origin gh-pages
```

Use `--force-with-lease` only after confirming the rerung intentionally rewrote publication history:

```sh
git -C dependencies/github.com/semantic-flow/mesh-branch-fantasy-rules push --force-with-lease origin gh-pages
```

## Final Checks

After pushing fixture branches:

```sh
for repo in mesh-alice-bio mesh-sidecar-fantasy-rules mesh-branch-fantasy-rules; do
  git -C "dependencies/github.com/semantic-flow/$repo" fetch origin "+refs/heads/*:refs/remotes/origin/*"
  git -C "dependencies/github.com/semantic-flow/$repo" status --short --branch
done

deno task ci
```

Then rerun or recheck the GitHub PR CI. GitHub CI should now resolve all fixture refs from remote branches and compare against the same generated bytes that local tests used.

## Failure Patterns

- `Failed to resolve fixture ref ...`: the fixture repo is missing locally, the workflow did not check it out, the relevant branch was not fetched, or the branch was never pushed.
- Diffs show old vocabulary such as `sflo:hasLocatedFile` while local output uses new vocabulary such as `sflo:locatedFileForManifestation`: local fixture branches were regenerated but remote fixture branches are stale.
- Local tests pass but GitHub CI fails against older bytes: a local `a.*` branch may be shadowing a stale remote branch. Push the intended regenerated rung branches or clean local rungs and reproduce from `origin/a.*`.
- Generated-output guardrail failure: the transition may have produced structurally suspicious output; inspect the guardrail before forcing a branch update.
- `workspace root must be empty before materialization`: delete the debug workspace or choose a new path.
- Branch-published rerung refuses to move `gh-pages`: the current publication branch is not an ancestor of the regenerated publication commit; inspect before rebasing, resetting, or force-pushing with lease.
- Branch-published materialization cannot find `.assets`: the fixture checkout is probably on `gh-pages`; switch that repo back to `main` and rerun.
- Replay tries to run removed commands such as `weave prepare gh-pages`: the manifest is stale. Replace first-time source publication with `integrate` plus `weave`. For an already-integrated external source with a stable working locator, do not re-integrate or update the binding; materialize the intended source checkout and weave/version from the existing working locator. Use a future source-binding update only when the locator or source policy itself is changing.

## Commit Messages

Fixture repo commits are created by the script with messages like:

```text
Regenerate fixture branch a.05-alice-knop-created-woven
```

The Weave repo commit that changes the generator, tests, or docs should explain why the rerung was needed, for example:

```text
weave: document fixture ladder regeneration

- add a developer playbook for dry-running and executing live fixture ladders
- describe review and push steps for Alice, sidecar, and branch-published fixtures
- record CI failure patterns for missing fixture refs and stale remote fixture branches
```
## Finally, merge to main

After non-branch ladders have been regenerated, fast-forward main to those final states, so that main always reflects the latest rung.