---
id: fdpf85wtomsgp6k544lg0kb
title: Fixture Ladder Regeneration
desc: ''
updated: 1779180085811
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

## Preflight

Start from a clean Weave checkout and clean fixture checkouts. Regeneration moves fixture refs, so unrelated fixture work should be committed, stashed, or moved out of the way first.

```sh
git status --short

for repo in mesh-alice-bio mesh-sidecar-fantasy-rules mesh-branch-fantasy-rules; do
  git -C "dependencies/github.com/semantic-flow/$repo" status --short --branch
done
```

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

## Dry Run

Run a full dry run first. This catches command failures, validation failures, missing assets, missing refs, and generated-output guardrail failures without moving fixture refs.

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

After the dry run passes, execute each scenario in plan order without `--dry-run`.

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
  for branch in $(git -C "$repo_path" branch --format='%(refname:short)' 'a.*'); do
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

After reviewing the printed commands, run only the intended pushes. For `mesh-branch-fantasy-rules`, also push `gh-pages` if the branch-published publication branch was intentionally fast-forwarded:

```sh
git -C dependencies/github.com/semantic-flow/mesh-branch-fantasy-rules push origin gh-pages
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
- Generated-output guardrail failure: the transition may have produced structurally suspicious output; inspect the guardrail before forcing a branch update.
- `workspace root must be empty before materialization`: delete the debug workspace or choose a new path.
- Branch-published rerung refuses to move `gh-pages`: the current publication branch is not an ancestor of the regenerated publication commit; inspect before rebasing, resetting, or force-pushing.

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
