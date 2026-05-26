---
id: 8bwvyxxxr5517fgv457lhte
title: Import
desc: ''
updated: 1779631617069
created: 1779631617069
---

## Status

`weave import` is available as the explicit source-acquisition command for copying selected bytes into a governed local working payload. Use [[wu.cli-reference.integrate]] when the working bytes should stay where they already live, and use [[wu.cli-reference.payload.update]] when an existing local payload only needs current-byte replacement without refreshed import provenance.

## Purpose

`weave import` materializes explicitly selected source bytes into a governed local working file. It copies bytes to `--working-file`, then creates or updates the Knop and payload artifact at the requested designator path so that copied file is the active working locator.

Import is the copy-acquisition boundary. It should record the source origin and observed byte fingerprint; without that bookkeeping, the workflow is usually just a manual download followed by [[wu.cli-reference.integrate]]. It is not versioning, page generation, branch publishing, repository checkout, or a live remote-source resolver.

The same operation is available below the CLI. API callers such as a daemon, web UI, or automation tool can perform acquisition, safe placement, artifact registration, provenance recording, and digest verification through one Weave operation instead of stitching those steps together themselves. The current CLI shape uses a mesh-root-relative `--working-file`; lower-level API requests may later expose richer destination locators for approved sidecar-adjacent and branch source-worktree targets.

## Usage

```sh
weave import <source> <designatorPath> --working-file <meshRelativePath> [--mesh-root <meshRoot>] [--expected-digest sha256:<hex>] [--replace-working]
```

Use `/` for the root designator as described in [[wu.cli-reference.root-designator]].

`--working-file` is required. Inferring filenames from the source or designator path can wait until examples settle.

`--expected-digest` is optional. When supplied, import verifies the acquired bytes before writing the governed working file; when omitted, import still computes and reports the observed digest and records it in provenance metadata.

## Examples

Import a local Markdown file into a whole-mesh repo:

```sh
weave import ./incoming/carol-burnett.md carol/page-main --working-file carol/page-main.md
```

Import a commit-pinned raw URL and require the observed digest:

```sh
weave import \
  "https://raw.githubusercontent.com/djradon/public-notes/f46d85187ed7781917b73dd7779b756e2d2b7494/user.carol-burnett.md" \
  carol/page-main \
  --working-file carol/page-main.md \
  --expected-digest sha256:5634ffc14165c55ab43c2af38b9d6395e22c8385f54d4a94a7d22d83c99afee7
```

Import into a sidecar mesh rooted at `docs` while reading source bytes from outside that mesh:

```sh
weave import ../source/pages/overview.md overview/page-main --mesh-root docs --working-file pages/overview.md
```

## Operation

The operation is:

1. Resolve the requested source.
2. Read or fetch the source bytes at command time.
3. Compute the observed digest and verify `--expected-digest` when supplied.
4. Write the bytes to `--working-file` under the active mesh root.
5. Create or update the Knop, payload artifact, Knop inventory, and mesh inventory for the target designator path.
6. Record useful origin/provenance metadata in the Knop source registry and the observed fingerprint without making the outside source the active working locator.

After import, ordinary `weave`, `weave version`, and `weave generate` should follow the governed local working file. They should not fetch the original URL or follow a floating source merely because import-origin metadata exists.

When the target working file or payload artifact already exists, use `--replace-working`. Replacement updates both the local working bytes and the source-origin/digest metadata.

## Source Locations

The current command supports:

- local filesystem paths
- `file:` URLs
- bounded HTTP(S) URLs

Relative local paths are resolved from the command working directory. `--working-file` is mesh-root-relative, must not escape the mesh root, and must not land under reserved support segments such as `_mesh` or `_knop`.

HTTP(S) sources are allowed only as explicit import sources. This does not allow `integrate`, `weave`, `generate`, or page-source resolution to fetch remote bytes implicitly.

If the desired working bytes should live outside the mesh root, such as in a sidecar-adjacent source folder or another branch/worktree, use normal filesystem or repository tooling followed by [[wu.cli-reference.integrate]] for now. Future import API surfaces may support those destinations explicitly under approved local-path policy, recording the copied file with the existing working-local locator shape rather than forcing every imported copy under the mesh root.

HTTP(S) import is an explicit fetch with scheme restrictions, timeout, maximum byte size, digest calculation, clear diagnostics, and redirect following bounded by the same fetch.

Imported Markdown, images, and other non-RDF payloads are not typed as `sflo:RdfDocument`. Import asserts RDF document type only when the source or working-file extension or HTTP content type conservatively indicates RDF. The source registry and other support artifacts remain RDF documents.

Import does not recursively fetch images or other linked assets referenced by imported Markdown. A later explicit asset-import mode could import selected linked assets, compute their own digests, and record separate source registry entries.

Copying from an already registered artifact/current-source binding is intentionally outside this first contract. If that rare use case becomes important, it should be designed as an explicit "copy existing artifact" workflow rather than folded into the normal outside-origin import path.

## Import, Integrate, And Payload Update

Use `integrate` when the working bytes should stay where they already live and Weave should register that source locator. This is the right shape for many sidecar and branch-published meshes that intentionally use approved extra-mesh or floating repository sources.

Use `import` when Weave should copy source bytes into a governed working destination and make that copied file the active working surface. The current CLI surface writes under the mesh root; later lower-level API surfaces may target approved sidecar-adjacent or branch source-worktree destinations.

Use `payload update` when a payload artifact already has a governed local working file and you only need to replace its current bytes.

Use `import --replace-working` when replacement should also refresh outside-origin provenance and digest evidence.

## Topology Notes

For a whole-mesh repo, `--working-file` names a normal mesh-relative file under the mesh root.

For a sidecar mesh, `--working-file` is still relative to the sidecar mesh root, such as `docs`, even if the source bytes come from the adjacent source repo.

API-level import requests may target an approved sidecar-adjacent source file when the desired durable working locator is intentionally outside the sidecar mesh root.

For a branch-published mesh, run import against the active mesh/publication checkout or explicitly selected local layout. Import should not switch branches, fetch repositories, commit files, or synchronize source and publication worktrees.

API-level import requests may target an approved source worktree or branch layout when the imported copy should live in the source lane and be followed through an explicit working-local locator.

## Environment

- [[wu.environment-variables#weave_log_dir]] controls where runtime logs are written.
- Source-tree Deno runs that exercise HTTP(S) import will need explicit network permission, likely scoped to the tested host such as `raw.githubusercontent.com`.

## Related

- [[wu.cli-reference.integrate]] registers working source locators without copying bytes into the mesh.
- [[wu.cli-reference.payload.update]] replaces current bytes for an existing local payload artifact.
- [[wu.cli-reference.version]] records governed working bytes into history.
- [[wu.repository-options]] describes whole-repo, sidecar, and branch-published mesh layouts.
