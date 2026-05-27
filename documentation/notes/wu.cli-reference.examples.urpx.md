---
id: h93g98a1ijiomjdh71867fr
title: URPX CLI Examples
desc: ''
updated: 1779808176419
created: 1779807300353
---

## Purpose

This note records the command sequence used while dogfooding Weave against the URPX ontology repository and a branch-published `gh-pages` mesh. The examples assume a Weave checkout, the URPX source repository at `/home/djradon/hub/urpx-org/urpx`, and a disposable local `gh-pages` worktree such as `/tmp/urpx-gh-pages`.

This note is a Weave CLI example rather than the authoritative URPX release runbook. URPX source release preparation, tagging, and public release checks remain owned by the URPX repository. This sequence focuses on creating the Semantic Flow publication mesh from the active source checkout.

This sequence scratch-regenerates the disposable `gh-pages` worktree from the active URPX source checkout. It intentionally does not preserve earlier local publication history. Use it only when the local publication worktree has no generated state that needs to survive.

The source checkout used by this replay should already contain release metadata for the version being published. The ontology and SHACL payload artifacts use `releases` as the artifact-history segment and the configured release state, such as `v0.2.0`, as the state segment.

The URPX publication mesh uses the slim history policy and wants ResourcePages to show the Semantic Flow metadata panel. Those are currently command-scoped options, not durable mesh config, so this sequence repeats the relevant flags on `weave` and `generate` commands. Once mesh-local config is honored for these policy families, the repeated flags should collapse into `_mesh/_config/config.ttl`.

The root welcome page remains a temporary compromise. The primitive commands below integrate `welcome.ttl` at `/`, which effectively gives the root designator an authored RDF document payload. That is useful for getting a working branch-published index, but it is not a final model for the semantic site/root resource. The ontology and SHACL payloads are integrated from the URPX source checkout with floating working-source bindings; they are not copied implicitly by `weave`.

## Step 1: Set Shell Variables

Use variables so the command sequence is replayable from the Weave checkout without repeating long local paths. `WEAVE_LOG_DIR` keeps local runtime logs out of the publication worktree. If replay resumes in a new shell, rerun this setup block before running more Weave commands; when `WEAVE_LOG_DIR` is unset, Weave falls back to `.weave/logs` under the inferred workspace root.

```sh
export WEAVE_ROOT=/home/djradon/hub/semantic-flow/weave
export WEAVE_CLI="$WEAVE_ROOT/src/main.ts"
export URPX_REPO=/home/djradon/hub/urpx-org/urpx
export URPX_SRC="$URPX_REPO"
export URPX_PUB=/tmp/urpx-gh-pages
export URPX_SOURCE_REPOSITORY_REMOTE=origin
export URPX_RELEASE_VERSION=0.2.0
export URPX_RELEASE_STATE="v$URPX_RELEASE_VERSION"
export URPX_HISTORY_POLICY=slimHistory
export WEAVE_LOG_DIR=/tmp/weave-logs

mkdir -p "$WEAVE_LOG_DIR"
cd "$WEAVE_ROOT"
```

Preflight the editable source checkout and publication worktree before deleting generated publication output. The source release validation is URPX-owned and checks the active Turtle release metadata, release notes, and release URL expectations.

```sh
git -C "$URPX_REPO" status --short --branch
git -C "$URPX_PUB" status --short --branch
git -C "$URPX_REPO" remote get-url "$URPX_SOURCE_REPOSITORY_REMOTE"

(cd "$URPX_REPO" && deno task release:validate -- --version "$URPX_RELEASE_VERSION")
```

## Step 2: Reset The Disposable Publication Worktree

This clears generated publication output. Use this only when the `gh-pages` worktree has no committed publication history you need to keep. The local `.git` file or directory is preserved, and `welcome.ttl` is recreated in Step 5.

```sh
find "$URPX_PUB" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
```

## Step 3: Create The Publication Mesh

Create the branch-published mesh support artifacts at the publication root. The explicit GitHub Pages publication profile creates `.nojekyll` and persists the resolved profile in `_mesh/_config/config.ttl`.

Today, `mesh create` does not persist history policy or ResourcePage metadata-panel opt-in. Keep those as explicit command options in later steps until mesh-local config is honored by existing-mesh commands.

```sh
deno run -A "$WEAVE_CLI" mesh create \
  --workspace "$URPX_PUB" \
  --mesh-base 'https://urpx-org.github.io/urpx/' \
  --publication-profile github-pages
```

## Step 4: Initialize Mesh Support History

Before integrating any payloads, run an untargeted weave with the slim history policy. On an empty mesh this initializes the mesh support histories and pages needed for a settled publication shape. That gives later payload weaves a settled support-history shape they can advance.

Do this before `welcome.ttl` is integrated. If `welcome.ttl` already exists as a weave candidate, untargeted `weave` will try to weave that payload too, and the current local slice can fail with "settled first-payload-weave mesh inventory shape." In the disposable URPX replay, recover by rerunning Step 2 onward rather than trying to repair the half-integrated root payload in place.

```sh
deno run -A "$WEAVE_CLI" \
  --mesh-root "$URPX_PUB" \
  --history-tracking-policy "$URPX_HISTORY_POLICY"

rg 'currentArtifactHistory <_mesh/_inventory/_history001>|latestHistoricalState <_mesh/_inventory/_history001/_s0001>' \
  "$URPX_PUB"/_mesh/_meta/meta.ttl >/dev/null

if test -e "$URPX_PUB/welcome.ttl"; then
  echo "welcome.ttl already exists; reset the disposable publication worktree and rerun Step 2 onward." >&2
  exit 1
fi
```

## Step 5: Integrate The Temporary Root Welcome Page

Integrate `welcome.ttl` as the root designator `/`. This is a pragmatic placeholder: `/` identifies the site's welcome page rather than a separately modeled "semantic site" resource, and the root IRI is backed by an RDF document payload. Revisit this once the root/site modeling is clearer.

The root ResourcePage canonicalizes to the slashless mesh IRI, so the welcome page facts should name `<https://urpx-org.github.io/urpx>` explicitly rather than relying on `<>` under the slash-terminated mesh base. Do not escape the `>` characters in Turtle IRIs. The `printf` form below keeps them inside shell quotes and writes to the file only at the final redirection.

```sh
printf '%s\n' \
  '@base <https://urpx-org.github.io/urpx/> .' \
  '@prefix dcterms: <http://purl.org/dc/terms/> .' \
  '' \
  '<https://urpx-org.github.io/urpx> dcterms:title "URPX" ;' \
  '  dcterms:description "The Utility Rate Plan Exchange ontology provides RDF, OWL, SHACL, and related resources for exchanging utility rate plan information." .' \
  > "$URPX_PUB/welcome.ttl"

if rg '\\>' "$URPX_PUB/welcome.ttl"; then
  echo "Turtle IRI delimiters in welcome.ttl should use plain >, not \\>." >&2
  exit 1
fi
```

```sh
deno run -A "$WEAVE_CLI" integrate "$URPX_PUB/welcome.ttl" / \
  --mesh-root "$URPX_PUB"
```

## Step 6: Weave The Root Welcome Page

Generate the root ResourcePage using Weave's default history and state naming. This keeps the root welcome page as the simple example for default payload naming, while the release artifacts below use explicit `releases/$URPX_RELEASE_STATE` naming.

```sh
deno run -A "$WEAVE_CLI" \
  --mesh-root "$URPX_PUB" \
  --history-tracking-policy "$URPX_HISTORY_POLICY" \
  --target 'designatorPath=/'
```

## Step 7: Integrate URPX Source Payloads

The branch-published URPX release uses source-lane payload integrations from `$URPX_SRC` into `$URPX_PUB`. `integrate` leaves the source bytes in the source checkout, records a floating repository source locator in each Knop inventory and source registry, and uses the current user's mesh-scoped settings access profile for the host-local read grant when `$URPX_SRC` is outside the publication mesh workspace.

Use `--source-repository-current` for this floating working-source replay. The source registries should record `sflo:hasRepositorySourceFloatingLocator` with `sflo:sourceRepositoryUrl` and `sflo:sourceRepositoryPathFromRoot`, but should not persist repository ref, commit, local checkout path, or digest evidence. The example records the local checkout's configured source remote so later local weaves can resolve the current source files without adding another git remote or persisting host-local paths.

```sh
deno run -A "$WEAVE_CLI" integrate "$URPX_SRC/ontology/urpx-ontology.ttl" ontology \
  --mesh-root "$URPX_PUB" \
  --grant-source-directory "$URPX_SRC" \
  --source-repository-current \
  --source-repository-remote "$URPX_SOURCE_REPOSITORY_REMOTE"

deno run -A "$WEAVE_CLI" integrate "$URPX_SRC/shacl/urpx-shacl.ttl" ontology/shacl \
  --mesh-root "$URPX_PUB" \
  --grant-source-directory "$URPX_SRC" \
  --source-repository-current \
  --source-repository-remote "$URPX_SOURCE_REPOSITORY_REMOTE"
```

Confirm the source bindings stayed floating and working-only, with no host-local source path leakage:

```sh
rg 'hasRepositorySourceFloatingLocator|sourceRepositoryPathFromRoot' \
  "$URPX_PUB"/ontology/_knop/_sources/sources.ttl \
  "$URPX_PUB"/ontology/shacl/_knop/_sources/sources.ttl >/dev/null

if rg 'targetLocalRelativePath|workingLocalRelativePath|sourceRepositoryRef|sourceRepositoryCommit|expectsContentDigest|hasContentDigest|/home/|/tmp/urpx-source|\\.\\./urpx-source' \
  "$URPX_PUB"/ontology/_knop/_sources/sources.ttl \
  "$URPX_PUB"/ontology/shacl/_knop/_sources/sources.ttl \
  "$URPX_PUB"/ontology/_knop/_inventory/inventory.ttl \
  "$URPX_PUB"/ontology/shacl/_knop/_inventory/inventory.ttl
then
  echo "Expected portable floating repository source bindings without local paths, pinning, or digest evidence." >&2
  exit 1
fi
```

Before publication, the source ontology metadata should consistently describe the configured release version, and `owl:versionIRI` should point at raw bytes for the matching eventual release tag. The version/HistoricalState resource can use `schema:contentUrl` for the preferred mesh-served Turtle URL and `sflo:hasManifestation` for the lightweight manifestation node whose `dcat:downloadURL` is the same mesh-served Turtle URL. The generated inventory carries the richer `ArtifactManifestation`, `LocatedFile`, and `locatedFileForManifestation` graph.

## Step 8: Weave The Source Payloads

Set the release history and state intent, then explicitly weave the two payloads. This targeted top-level weave creates the release states and current publication surfaces for the integrated source payloads; `weave generate` later renders pages from the resulting mesh state.

```sh
deno run -A "$WEAVE_CLI" set history ontology releases --mesh-root "$URPX_PUB"
deno run -A "$WEAVE_CLI" set next-state ontology "$URPX_RELEASE_STATE" --mesh-root "$URPX_PUB"

deno run -A "$WEAVE_CLI" set history ontology/shacl releases --mesh-root "$URPX_PUB"
deno run -A "$WEAVE_CLI" set next-state ontology/shacl "$URPX_RELEASE_STATE" --mesh-root "$URPX_PUB"

deno run -A "$WEAVE_CLI" \
  --mesh-root "$URPX_PUB" \
  --history-tracking-policy "$URPX_HISTORY_POLICY" \
  --payload-manifestation-segment ttl \
  --target 'designatorPath=ontology' \
  --target 'designatorPath=ontology/shacl'

test -f "$URPX_PUB/ontology/releases/$URPX_RELEASE_STATE/ttl/urpx-ontology.ttl"
test -f "$URPX_PUB/ontology/shacl/releases/$URPX_RELEASE_STATE/ttl/urpx-shacl.ttl"

rg "latestHistoricalState <ontology/releases/$URPX_RELEASE_STATE>|latestHistoricalState <ontology/shacl/releases/$URPX_RELEASE_STATE>" \
  "$URPX_PUB"/ontology/_knop/_inventory/inventory.ttl \
  "$URPX_PUB"/ontology/shacl/_knop/_inventory/inventory.ttl >/dev/null
```

## Step 9: Extract Terms From The Source Artifacts

Run all-terms extraction after the source artifacts have been woven into release states. These commands create first-class term identifiers for mesh-scoped named nodes discovered in subject, predicate, or object position, and skip existing Knops, blank nodes, and generated support/file resources such as `sflo:LocatedFile`s.

Extraction uses the locally woven release-state files with `--source-state` rather than resolving the floating current-source repository locator again. That keeps extraction anchored to the exact local publication snapshot that Step 8 just created and avoids depending on the source checkout's git remote spelling or SSH host aliases.

Each newly extracted term gets a Knop source registry at `_knop/_sources/sources.ttl` with an `sflo:ExtractionSource` linked from the Knop by `sflo:hasExtractionSource`. With `--source-state`, that extraction source is an exact binding to the selected payload state.

`--add-source-references` is additional: it creates a canonical `ReferenceCatalog` / `ReferenceLink` / `ReferenceSource` for terms newly extracted in that invocation. Existing terms are skipped, so this does not backfill references from a later source if a term was already extracted from an earlier source. If source references need to be repaired or regenerated, reset the disposable publication worktree and replay the sequence from the beginning rather than rerunning extraction over already-created terms.

```sh
deno run -A "$WEAVE_CLI" extract --all-terms \
  --mesh-root "$URPX_PUB" \
  --source-state "ontology/releases/$URPX_RELEASE_STATE" \
  --add-source-references \
  --reference-role canonical \
  --accept-preview

deno run -A "$WEAVE_CLI" extract --all-terms \
  --mesh-root "$URPX_PUB" \
  --source-state "ontology/shacl/releases/$URPX_RELEASE_STATE" \
  --add-source-references \
  --reference-role canonical \
  --accept-preview
```

## Step 10: Weave And Validate The Extracted Terms

Run an untargeted weave so every pending extracted term Knop and its support surfaces become part of the current publication mesh. This advances the generated publication side without changing the source checkout. Whole-mesh validation can conceptually be used as a preflight, but on this all-terms replay it currently has to dry-run many pending extracted-term weaves, so this dogfood sequence validates after the weave and page generation.

The explicit `generate` pass includes the Semantic Flow metadata panel. Top-level `weave` does not currently expose that opt-in, so use `generate --include-semantic-flow-metadata` as the final page render before validation.

```sh
deno run -A "$WEAVE_CLI" \
  --mesh-root "$URPX_PUB" \
  --history-tracking-policy "$URPX_HISTORY_POLICY"

deno run -A "$WEAVE_CLI" generate \
  --mesh-root "$URPX_PUB" \
  --history-tracking-policy "$URPX_HISTORY_POLICY" \
  --include-semantic-flow-metadata

deno run -A "$WEAVE_CLI" validate mesh \
  --mesh-root "$URPX_PUB"
```

## Step 11: Inspect The Generated Publication Worktree

Run publication validation after page generation. Publication validation checks the selected host preset, so the GitHub Pages profile should require `.nojekyll`.

```sh
deno run -A "$WEAVE_CLI" validate publication \
  --mesh-root "$URPX_PUB"
```

Confirm the root welcome page uses default payload naming, and the ontology and SHACL payloads use the configured release state under `releases`.

```sh
test -f "$URPX_PUB/_history001/_s0001/ttl/welcome.ttl"

find "$URPX_PUB" \
  -path "*/releases/$URPX_RELEASE_STATE/ttl/*.ttl" \
  -o -path '*/_s0001/ttl/*.ttl' \
  | sort

find "$URPX_PUB" \
  -path '*/_knop/_sources/sources.ttl' \
  -o -path '*/_knop/_references/references.ttl' \
  | sort

rg '<summary>Semantic Flow metadata</summary>' "$URPX_PUB" --glob '*.html' >/dev/null

git -C "$URPX_PUB" status --short --branch
```
