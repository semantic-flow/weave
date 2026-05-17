---
id: njbcs0xawyh27n9yvfogx30
title: 2026 05 16 Deploy Profile
desc: ''
updated: 1778979845532
created: 1778979845532
---

## Goals

- Add a structured deploy profile for branch-published workflows so repeated `weave deploy gh-pages` runs do not require long flag lists.
- Keep deploy profiles as operational input, not durable mesh config and not required source-branch content.
- Support the multi-source ontology-publishing shape needed by `sflo` and later URPX: core/config/SHACL source bindings, all-terms extraction, source-reference creation, source provenance, and publication controls.
- Preserve the clean-source-branch story: source checkout paths, publication worktree paths, log directories, and commit/push policy must not be written into public mesh RDF.
- Make profile loading fail closed on malformed or unknown keys.

## Summary

The current `weave deploy gh-pages` CLI is intentionally explicit and narrow. That is good for the first branch-published implementation slice, but it gets clumsy once an ontology repo needs to publish several source files and then run follow-up operations such as all-terms extraction and source-reference creation.

A deploy profile should be the pleasant, repeatable operational input for that workflow. It can live in CI config, an operator-local directory, or a future source repo if the project deliberately wants publication intent reviewed with source changes. It should not be required on `sflo:main` or URPX source branches.

There is no pressing reason to implement this before the next dogfood step. The nearer blockers are config namespace cleanup, all-terms source-reference support, and a manual or lightly scripted `sflo` branch-published run. The profile becomes valuable once those commands are known and repetitive.

## Discussion

### Why A Profile

Branch-published deployment has two layers:

- operation-local inputs such as source root, publication worktree root, log directory, dry-run/commit behavior, and local checkout layout;
- durable publication facts such as source repository URL/ref/commit/path/digest and target designator/materialization paths.

Today, the operation-local inputs are supplied as CLI flags. That works for one source binding, but `sflo` already wants core, config, and SHACL, and URPX will probably want a similar multi-file setup. A profile gives us a structured request without putting host-local paths into `_mesh/_config/config.ttl`.

### Proposed CLI Shape

Prefer an explicit profile flag on the existing command:

```bash
weave deploy gh-pages --profile ./publish.weave.json --dry-run
weave deploy gh-pages --profile ./publish.weave.json
```

CLI flags supplied alongside the profile should be treated as operation overrides. Overrides are useful for `--dry-run`, `--commit`, `--commit-message`, `--publish-root`, or `--log-dir`, but should be validated against the same fail-closed profile rules.

### First Profile Format

Use JSON for the first slice. Deno parses it natively, tests are straightforward, and we avoid taking on YAML/JSONC dependency and comment semantics before the behavior is stable.

Example `sflo`-style profile:

```json
{
  "kind": "weave.deployProfile",
  "version": 1,
  "topology": "gh-pages",
  "meshBase": "https://semantic-flow.github.io/sflo/",
  "sourceRoot": ".",
  "publishRoot": "../sflo-gh-pages",
  "publicationBranch": "gh-pages",
  "logDir": "/tmp/weave-logs/sflo",
  "includeNoJekyll": true,
  "sourceRepositoryUrl": "https://github.com/semantic-flow/sflo.git",
  "sourceRef": "main",
  "sourceProvenance": "commit",
  "sources": [
    {
      "sourcePath": "semantic-flow-core-ontology.ttl",
      "designatorPath": "ontology",
      "targetPath": "ontology/semantic-flow-core-ontology.ttl",
      "extractAllTerms": true,
      "addSourceReferences": true,
      "referenceRole": "canonical"
    },
    {
      "sourcePath": "semantic-flow-config-ontology.ttl",
      "designatorPath": "config",
      "targetPath": "config/semantic-flow-config-ontology.ttl",
      "extractAllTerms": true,
      "addSourceReferences": true,
      "referenceRole": "canonical"
    },
    {
      "sourcePath": "semantic-flow-core-shacl.ttl",
      "designatorPath": "ontology/shacl",
      "targetPath": "ontology/shacl/semantic-flow-core-shacl.ttl",
      "extractAllTerms": true,
      "addSourceReferences": true,
      "referenceRole": "canonical"
    }
  ]
}
```

Path resolution rules should be conservative:

- `sourceRoot`, `publishRoot`, and `logDir` resolve relative to the profile file directory unless absolute;
- `sourcePath` resolves relative to `sourceRoot`;
- `targetPath` resolves relative to `publishRoot`;
- `designatorPath` remains a mesh designator path, not a filesystem path;
- no local resolved absolute path is persisted into the publication mesh.

### Execution Model

The profile should initially expand into the same runtime operations we already trust:

- validate roots, publication cleanliness, branch/worktree assumptions, and no local-path leakage;
- bootstrap the publication mesh if needed;
- materialize each source binding into the publication root;
- integrate or update the source artifact at the requested designator path;
- run `extract --all-terms` when requested;
- add source references when requested;
- generate ResourcePages for requested or affected targets;
- optionally create a local publication commit, but never push unless a later explicit task adds guarded push support.

This is still local generation. The profile is not a hosted deployment service and should not hide destructive git behavior behind friendly config.

### Relationship To Mesh Config

The deploy profile is input to a deploy operation. It may seed durable publication facts into `gh-pages`, but it is not itself authoritative mesh config. In particular, a profile may mention `publishRoot`, `sourceRoot`, and `logDir`; those values should never appear in public RDF merely because the profile supplied them.

Durable source provenance should still be recorded as repository/ref/commit/path/digest-style facts in the publication branch. The exact observed source commit should remain the authoritative provenance anchor, with `main` or another branch recorded as refresh context when applicable.

## Open Issues

- Should profile-source operations be strictly sequential in the profile order, or should Weave eventually infer dependency ordering from source bindings and requested extraction/generation steps?
- Should `sourceRepositoryUrl` and `sourceRef` be top-level defaults only, per-source only, or both with per-source overrides?
- Should `sourceCommit` be accepted as an input for deterministic replay, or always observed from the local source checkout during deploy?
- Should the first implementation support only `topology: "gh-pages"`, or define the profile grammar broadly enough for future sidecar/whole-repo deployments while rejecting unsupported topologies?
- Should there be a separate `--profile-only` validation command, or is `--dry-run --profile ...` sufficient?

## Decisions

- Defer implementation until after all-terms source-reference support and the first `sflo` dogfood commands are better understood.
- Use JSON as the first profile format.
- Treat deploy profiles as trusted operational input, not durable mesh config.
- Require unknown-key rejection and clear validation errors.
- Keep branch-published `gh-pages` as the first supported topology.
- Keep push behavior out of scope for the first profile slice.

## Contract Changes

- CLI: `weave deploy gh-pages` gains `--profile <path>`.
- CLI/profile merge behavior must be documented: explicit CLI flags may override profile values, and conflicts should be visible in dry-run output.
- Runtime/deploy API gains a profile parser/resolver that produces the existing structured deploy request shape plus ordered follow-up operations.
- Profile parsing rejects malformed JSON, unsupported `version`, unsupported `topology`, unknown keys, unsafe paths, and missing required fields.
- Dry-run output should include the profile path, resolved source/publication roots, source bindings, planned generation/extraction/reference steps, git operations, and values inferred from git.

## Testing

- Add parser unit tests for valid profile, missing required fields, unknown keys, unsafe paths, unsupported version/topology, and CLI override behavior.
- Add integration tests proving a profile can bootstrap and materialize multiple source bindings without writing host-local paths into public RDF.
- Add dry-run tests showing planned paths and operations without mutating the publication root.
- Add e2e CLI coverage for `weave deploy gh-pages --profile`.
- Add tests proving `--publish-root` can override the profile in CI/operator contexts.
- Run `deno task check` and `deno task lint` after implementation.

## Non-Goals

- Do not implement this before all-terms source references unless repeated manual dogfood commands become the real bottleneck.
- Do not require a deploy profile to live on the source branch.
- Do not persist source root, publication root, log directory, or machine-local trust grants into public mesh RDF.
- Do not add YAML/JSONC support in the first slice.
- Do not add push/force-push behavior.
- Do not add guarded rebuild mode here; that belongs to [[wd.task.2026.2026-05-14_1105-guarded-branch-published-rebuild]].

## Implementation Plan

- [ ] Capture the final manual `sflo` dogfood command sequence after source-reference support lands.
- [ ] Define the v1 JSON profile schema from that command sequence.
- [ ] Implement profile parsing and fail-closed validation.
- [ ] Add CLI `--profile <path>` support for `weave deploy gh-pages`.
- [ ] Resolve profile paths relative to the profile file directory.
- [ ] Merge profile values with explicit CLI overrides and include conflicts/overrides in dry-run output.
- [ ] Support multiple source bindings in one profile-driven deploy.
- [ ] Wire optional all-terms extraction and source-reference steps once those runtime features exist.
- [ ] Prove no host-local path leakage into generated RDF or durable config.
- [ ] Add parser, integration, and CLI tests.
- [ ] Update [[wu.cli-reference]] after the command shape is stable.
- [ ] Run focused tests, then `deno task check` and `deno task lint`.
