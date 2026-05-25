---
id: ewr0vs8qs6fpkrs63y7tzll
title: SFLO CLI Examples
desc: ''
updated: 1779692417802
created: 1779030765340
---

## Purpose

This note records the command sequence used while dogfooding Weave against the SFLO ontology repository and a branch-published `gh-pages` mesh. The examples assume a Weave checkout with a dependency-local SFLO source repository and a disposable local `gh-pages` worktree such as `/tmp/sflo`.

This note is a dogfooding command sequence rather than the final CI runbook. The old `weave prepare gh-pages` wrapper has been removed, and branch-published source binding now uses ordinary `mesh create`, `integrate`, `set`, `weave`, `extract`, `generate`, `validate`, publication-profile, and CI/CD operations.

This sequence scratch-regenerates the disposable `gh-pages` worktree from the active SFLO source checkout. It intentionally does not preserve earlier local publication history such as the first `v0.1.0` replay; until the first release that needs durable public preservation, fewer extant generated versions are easier to reason about. Once exact source-state import/mapping exists, early versions can be recaptured deliberately.

The source checkout used by this replay should already contain release metadata for the version being published. The ontology, config ontology, and SHACL payload artifacts use `releases` as the artifact-history segment and the configured release state, such as `v0.1.1`, as the state segment.

The SFLO publication mesh wants all generated support artifacts to keep history and wants ResourcePages to show the Semantic Flow metadata panel. Those are currently command-scoped options, not durable mesh config, so this sequence repeats the relevant flags on `weave` and `generate` commands. Once mesh-local config is honored for these policy families, the repeated flags should collapse into `_mesh/_config/config.ttl`.

The root welcome page remains a temporary compromise. The primitive commands below integrate `welcome.ttl` at `/`, which effectively gives the root designator an authored RDF document payload. That is useful for getting a working branch-published index, but it is not a final model for the semantic site/root resource. The ontology, config ontology, and SHACL payloads are integrated from the SFLO source checkout with floating working-source bindings; they are not copied implicitly by `weave`.

## Step 1: Set Shell Variables

Use variables so the command sequence is replayable from the Weave checkout without repeating long local paths. `WEAVE_LOG_DIR` keeps local runtime logs out of the publication worktree. If replay resumes in a new shell, rerun this setup block before running more Weave commands; when `WEAVE_LOG_DIR` is unset, Weave falls back to `.weave/logs` under the inferred workspace root.

```sh
export WEAVE_ROOT=/home/djradon/hub/semantic-flow/weave
export WEAVE_CLI="$WEAVE_ROOT/src/main.ts"
export SFLO_REPO="$WEAVE_ROOT/dependencies/github.com/semantic-flow/sflo"
export SFLO_SRC="$SFLO_REPO"
export SFLO_PUB=/tmp/sflo
export SFLO_RELEASE_VERSION=0.2.0
export SFLO_RELEASE_STATE="v$SFLO_RELEASE_VERSION"
export SFLO_HISTORY_POLICY=versioned
export WEAVE_LOG_DIR=/tmp/weave-logs

mkdir -p "$WEAVE_LOG_DIR"
cd "$WEAVE_ROOT"
```

Preflight the editable source checkout and publication worktree before deleting generated publication output. The source release validation is SFLO-owned and checks the active Turtle release metadata, release notes, and release URL expectations.

```sh
git -C "$SFLO_REPO" status --short --branch
git -C "$SFLO_PUB" status --short --branch

(cd "$SFLO_REPO" && deno task release:validate --version "$SFLO_RELEASE_VERSION")
```

## Step 2: Reset The Disposable Publication Worktree

This clears generated publication output. Use this only when the `gh-pages` worktree has no committed publication history you need to keep. The local `.git` file or directory is preserved, and `welcome.ttl` is recreated in Step 5.

```sh
find "$SFLO_PUB" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
```

## Step 3: Create The Publication Mesh

Create the branch-published mesh support artifacts at the publication root. The explicit GitHub Pages publication profile creates `.nojekyll` and persists the resolved profile in `_mesh/_config/config.ttl`.

Today, `mesh create` does not persist history policy or ResourcePage metadata-panel opt-in. Keep those as explicit command options in later steps until mesh-local config is honored by existing-mesh commands.

```sh
deno run -A "$WEAVE_CLI" mesh create \
  --workspace "$SFLO_PUB" \
  --mesh-base 'https://semantic-flow.github.io/sflo/' \
  --publication-profile github-pages
```

## Step 4: Initialize Mesh Support History

Before integrating any payloads, run an untargeted weave with the all-history policy. On an empty mesh this initializes mesh support histories and pages, including the first `MeshInventory` historical state. That gives later payload weaves a settled support-history shape they can advance.

Do this before `welcome.ttl` is integrated. If `welcome.ttl` already exists as a weave candidate, untargeted `weave` will try to weave that payload too, and the current local slice can fail with "settled first-payload-weave mesh inventory shape." In the disposable SFLO replay, recover by rerunning Step 2 onward.

```sh
deno run -A "$WEAVE_CLI" \
  --mesh-root "$SFLO_PUB" \
  --history-tracking-policy "$SFLO_HISTORY_POLICY"
```

## Step 5: Integrate The Temporary Root Welcome Page

Integrate `welcome.ttl` as the root designator `/`. This is a pragmatic placeholder: `/` identifies the site's welcome page rather than a separately modeled "semantic site" resource, and the root IRI is backed by an RDF document payload. Revisit this once the root/site modeling is clearer.

The root ResourcePage canonicalizes to the slashless mesh IRI, so the welcome page facts should name `<https://semantic-flow.github.io/sflo>` explicitly rather than relying on `<>` under the slash-terminated mesh base.

```sh
cat > "$SFLO_PUB/welcome.ttl" <<'TTL'
@base <https://semantic-flow.github.io/sflo/> .
@prefix dcterms: <http://purl.org/dc/terms/> .

<https://semantic-flow.github.io/sflo> dcterms:title "Semantic Flow Ontology and Related Resources" ;
  dcterms:description "The Semantic Flow core ontology and other related resources provide a way to create identifiers that are dereferenceable, resilient, and explorable. It formalizes how Semantic Flow designators, supporting artifacts, and optional payload resources can be combined to make these identifiers useful." .
TTL

if rg '\\>' "$SFLO_PUB/welcome.ttl"; then
  echo "Turtle IRI delimiters in welcome.ttl should use plain >, not \\>." >&2
  exit 1
fi
```

```sh
deno run -A "$WEAVE_CLI" integrate "$SFLO_PUB/welcome.ttl" / \
  --mesh-root "$SFLO_PUB"
```

## Step 6: Weave The Root Welcome Page

Generate the root ResourcePage using Weave's default history and state naming. This keeps the root welcome page as the simple example for default payload naming, while the release artifacts below use explicit `releases/$SFLO_RELEASE_STATE` naming.

```sh
deno run -A "$WEAVE_CLI" \
  --mesh-root "$SFLO_PUB" \
  --history-tracking-policy "$SFLO_HISTORY_POLICY" \
  --target 'designatorPath=/'
```

## Step 7: Integrate SFLO Source Payloads

The branch-published SFLO release uses source-lane payload integrations from `$SFLO_SRC` into `$SFLO_PUB`. `integrate` leaves the source bytes in the source checkout, records a floating repository source locator in each Knop inventory and source registry, and uses `~/.sf-local-access.ttl` for the host-local read grant when `$SFLO_SRC` is outside the publication mesh workspace.

Use `--source-repository-current` for this floating working-source replay. The source registries should record `sflo:hasRepositorySourceFloatingLocator` with `sflo:sourceRepositoryUrl` and `sflo:sourceRepositoryPathFromRoot`, but should not persist repository ref, commit, local checkout path, or digest evidence.

```sh
deno run -A "$WEAVE_CLI" integrate "$SFLO_SRC/semantic-flow-core-ontology.ttl" ontology \
  --mesh-root "$SFLO_PUB" \
  --grant-source-directory "$SFLO_SRC" \
  --source-repository-current \
  --source-repository-url 'https://github.com/semantic-flow/sflo.git'

deno run -A "$WEAVE_CLI" integrate "$SFLO_SRC/semantic-flow-config-ontology.ttl" config \
  --mesh-root "$SFLO_PUB" \
  --grant-source-directory "$SFLO_SRC" \
  --source-repository-current \
  --source-repository-url 'https://github.com/semantic-flow/sflo.git'

deno run -A "$WEAVE_CLI" integrate "$SFLO_SRC/semantic-flow-core-shacl.ttl" ontology/shacl \
  --mesh-root "$SFLO_PUB" \
  --grant-source-directory "$SFLO_SRC" \
  --source-repository-current \
  --source-repository-url 'https://github.com/semantic-flow/sflo.git'
```

Confirm the source bindings stayed floating and working-only, with no host-local source path leakage:

```sh
rg 'hasRepositorySourceFloatingLocator|sourceRepositoryPathFromRoot' \
  "$SFLO_PUB"/ontology/_knop/_sources/sources.ttl \
  "$SFLO_PUB"/config/_knop/_sources/sources.ttl \
  "$SFLO_PUB"/ontology/shacl/_knop/_sources/sources.ttl >/dev/null

if rg 'targetLocalRelativePath|workingLocalRelativePath|sourceRepositoryRef|sourceRepositoryCommit|expectsContentDigest|hasContentDigest|/home/|/tmp/sflo-source|\\.\\./sflo-source' \
  "$SFLO_PUB"/ontology/_knop/_sources/sources.ttl \
  "$SFLO_PUB"/config/_knop/_sources/sources.ttl \
  "$SFLO_PUB"/ontology/shacl/_knop/_sources/sources.ttl \
  "$SFLO_PUB"/ontology/_knop/_inventory/inventory.ttl \
  "$SFLO_PUB"/config/_knop/_inventory/inventory.ttl \
  "$SFLO_PUB"/ontology/shacl/_knop/_inventory/inventory.ttl
then
  echo "Expected portable floating repository source bindings without local paths, pinning, or digest evidence." >&2
  exit 1
fi
```

Before publication, the source ontology metadata should consistently describe the configured release version, and `owl:versionIRI` should point at raw bytes for the matching eventual release tag. The version/HistoricalState resource can use `schema:contentUrl` for the preferred mesh-served Turtle URL and `sflo:hasManifestation` for the lightweight manifestation node whose `dcat:downloadURL` is the same mesh-served Turtle URL. The generated inventory carries the richer `ArtifactManifestation`, `LocatedFile`, and `locatedFileForManifestation` graph.

## Step 8: Weave The Source Payloads

Set the release history and state intent, then explicitly weave the three payloads. This targeted top-level weave creates the release states and current publication surfaces for the integrated source payloads; `weave generate` later renders pages from the resulting mesh state.

```sh
deno run -A "$WEAVE_CLI" set history ontology releases --mesh-root "$SFLO_PUB"
deno run -A "$WEAVE_CLI" set next-state ontology "$SFLO_RELEASE_STATE" --mesh-root "$SFLO_PUB"

deno run -A "$WEAVE_CLI" set history config releases --mesh-root "$SFLO_PUB"
deno run -A "$WEAVE_CLI" set next-state config "$SFLO_RELEASE_STATE" --mesh-root "$SFLO_PUB"

deno run -A "$WEAVE_CLI" set history ontology/shacl releases --mesh-root "$SFLO_PUB"
deno run -A "$WEAVE_CLI" set next-state ontology/shacl "$SFLO_RELEASE_STATE" --mesh-root "$SFLO_PUB"

deno run -A "$WEAVE_CLI" \
  --mesh-root "$SFLO_PUB" \
  --history-tracking-policy "$SFLO_HISTORY_POLICY" \
  --payload-manifestation-segment ttl \
  --target 'designatorPath=ontology' \
  --target 'designatorPath=config' \
  --target 'designatorPath=ontology/shacl'
```

## Step 9: Extract Terms From The Source Artifacts

Run all-terms extraction after the source artifacts have been woven into release states. These commands create first-class term identifiers for mesh-scoped named nodes discovered in subject, predicate, or object position, and skip existing Knops, blank nodes, and generated support/file resources such as `sflo:LocatedFile`s.

Each newly extracted term gets a Knop source registry at `_knop/_sources/sources.ttl` with an `sflo:ExtractionSource` linked from the Knop by `sflo:hasExtractionSource`. With `--source`, that extraction source is initially a working-source binding to the selected payload artifact. The later extracted-term weave checks that source and records the exact source state currently used by the source payload.

`--add-source-references` is additional: it creates a canonical `ReferenceCatalog` / `ReferenceLink` / `ReferenceSource` for terms newly extracted in that invocation. Existing terms are skipped, so this does not backfill references from a later source if a term was already extracted from an earlier source. If source references need to be repaired or regenerated, reset the disposable publication worktree and replay the sequence from the beginning rather than rerunning extraction over already-created terms.

```sh
deno run -A "$WEAVE_CLI" extract --all-terms \
  --mesh-root "$SFLO_PUB" \
  --source ontology \
  --add-source-references \
  --reference-role canonical \
  --accept-preview

deno run -A "$WEAVE_CLI" extract --all-terms \
  --mesh-root "$SFLO_PUB" \
  --source config \
  --add-source-references \
  --reference-role canonical \
  --accept-preview

deno run -A "$WEAVE_CLI" extract --all-terms \
  --mesh-root "$SFLO_PUB" \
  --source ontology/shacl \
  --add-source-references \
  --reference-role canonical \
  --accept-preview
```

## Step 10: Weave And Validate The Extracted Terms

Run an untargeted weave so every pending extracted term Knop and its support surfaces become part of the current publication mesh. This advances the generated publication side without changing the source checkout. Whole-mesh validation can conceptually be used as a preflight, but on this all-terms replay it currently has to dry-run hundreds of pending extracted-term weaves, so this dogfood sequence validates after the weave and page generation.

The explicit `generate` pass includes the Semantic Flow metadata panel. Top-level `weave` does not currently expose that opt-in, so use `generate --include-semantic-flow-metadata` as the final page render before validation.

```sh
deno run -A "$WEAVE_CLI" \
  --mesh-root "$SFLO_PUB" \
  --history-tracking-policy "$SFLO_HISTORY_POLICY"

deno run -A "$WEAVE_CLI" generate \
  --mesh-root "$SFLO_PUB" \
  --history-tracking-policy "$SFLO_HISTORY_POLICY" \
  --include-semantic-flow-metadata

deno run -A "$WEAVE_CLI" validate mesh \
  --mesh-root "$SFLO_PUB"
```

## Step 11: Inspect The Generated Publication Worktree

Run publication validation after page generation. Publication validation checks the selected host preset, so the GitHub Pages profile should require `.nojekyll`.

```sh
deno run -A "$WEAVE_CLI" validate publication \
  --mesh-root "$SFLO_PUB"
```

Confirm the root welcome page uses default payload naming, and the ontology, config, and SHACL payloads use the configured release state under `releases`.

```sh
  test -f "$SFLO_PUB/_history001/_s0001/ttl/welcome.ttl"

  find "$SFLO_PUB" \
    -path "*/releases/$SFLO_RELEASE_STATE/ttl/*.ttl" \
    -o -path '*/_s0001/ttl/*.ttl' \
    | sort

  find "$SFLO_PUB" \
    -path '*/_knop/_sources/sources.ttl' \
    -o -path '*/_knop/_references/references.ttl' \
    | sort

  rg '<summary>Semantic Flow metadata</summary>' "$SFLO_PUB" --glob '*.html' >/dev/null

git -C "$SFLO_PUB" status --short --branch
```
