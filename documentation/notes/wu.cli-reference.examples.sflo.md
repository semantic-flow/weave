---
id: ewr0vs8qs6fpkrs63y7tzll
title: SFLO CLI Examples
desc: ''
updated: 1779030765340
created: 1779030765340
---

## Purpose

This note records the command sequence used while dogfooding Weave against the SFLO ontology repository and a branch-published `gh-pages` mesh. The examples assume a Weave checkout with a dependency-local SFLO source checkout and a disposable local `gh-pages` worktree such as `/tmp/sflo`.

This note is a dogfooding command sequence rather than the final CI runbook. The old `weave prepare gh-pages` wrapper has been removed, and branch-published source binding now uses ordinary `mesh create`, `integrate`, `set`, `version`, `extract`, `weave`, `generate`, `validate`, publication-profile, and CI/CD operations.

This sequence scratch-regenerates the disposable `gh-pages` worktree from the currently materialized SFLO source checkout. It intentionally does not preserve earlier local publication history such as the first `v0.1.0` replay; until the first release that needs durable public preservation, fewer extant generated versions are easier to reason about. Once exact source-state import/mapping exists, early versions can be recaptured deliberately.

The source checkout used by this replay should already contain release metadata for the version being published. The ontology, config ontology, and SHACL payload artifacts use `releases` as the artifact-history segment and the configured release state, such as `v0.1.1`, as the state segment.

The root welcome page can use the primitive commands below because it is authored directly in the publication root. The ontology, config ontology, and SHACL payloads are integrated from the SFLO source checkout with floating working-source bindings; they are not copied implicitly by `weave`.

## Step 1: Set Shell Variables

Use variables so the command sequence is replayable from the Weave checkout without repeating long local paths. `WEAVE_LOG_DIR` keeps local runtime logs out of the publication worktree.

```sh
export WEAVE_ROOT=/home/djradon/hub/semantic-flow/weave
export WEAVE_CLI="$WEAVE_ROOT/src/main.ts"
export SFLO_SRC="$WEAVE_ROOT/dependencies/github.com/semantic-flow/sflo"
export SFLO_PUB=/tmp/sflo
export SFLO_RELEASE_VERSION=0.1.1
export SFLO_RELEASE_STATE="v$SFLO_RELEASE_VERSION"
export WEAVE_LOG_DIR=/tmp/weave-logs

mkdir -p "$WEAVE_LOG_DIR"
cd "$WEAVE_ROOT"
```

Preflight the source and publication worktrees before deleting generated publication output. The source release validation is SFLO-owned and checks the active Turtle release metadata, release notes, and release URL expectations.

```sh
git -C "$SFLO_SRC" status --short --branch
git -C "$SFLO_PUB" status --short --branch

(cd "$SFLO_SRC" && deno task release:validate -- --version "$SFLO_RELEASE_VERSION")
```

## Step 2: Reset The Disposable Publication Worktree

This clears generated publication output. Use this only when the `gh-pages` worktree has no committed publication history you need to keep. The local `.git` file or directory is preserved, and `welcome.ttl` is recreated in Step 4.

```sh
find "$SFLO_PUB" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +

git -C "$SFLO_PUB" status --short --branch
```

## Step 3: Create The Publication Mesh

Create the branch-published mesh support artifacts at the publication root. The explicit GitHub Pages publication profile creates `.nojekyll` and persists the resolved profile in `_mesh/_config/config.ttl`.

```sh
deno run -A "$WEAVE_CLI" mesh create \
  --workspace "$SFLO_PUB" \
  --mesh-base 'https://semantic-flow.github.io/sflo/' \
  --publication-profile github-pages
```

## Step 4: Integrate The Root Welcome Page

Integrate `welcome.ttl` as the root designator `/`. In this sequence, `/` identifies the site's welcome page rather than a separate "semantic site" resource. The root ResourcePage canonicalizes to the slashless mesh IRI, so the welcome page facts should name `<https://semantic-flow.github.io/sflo>` explicitly rather than relying on `<>` under the slash-terminated mesh base.

```sh
cat > "$SFLO_PUB/welcome.ttl" <<'TTL'
@base <https://semantic-flow.github.io/sflo/> .
@prefix dcterms: <http://purl.org/dc/terms/> .

<https://semantic-flow.github.io/sflo> dcterms:title "Semantic Flow Ontology and Related Resources" ;
  dcterms:description "The Semantic Flow core ontology and other related resources provide a way to create identifiers that are dereferenceable, resilient, and explorable. It formalizes how Semantic Flow designators, supporting artifacts, and optional payload resources can be combined to make these identifiers useful." .
TTL
```

```sh
deno run -A "$WEAVE_CLI" integrate "$SFLO_PUB/welcome.ttl" / \
  --mesh-root "$SFLO_PUB"
```

## Step 5: Weave The Root Welcome Page

Generate the root ResourcePage with `main` as the history segment. Let Weave use the default state segment for the welcome page instead of naming a version-like state manually.

```sh
deno run -A "$WEAVE_CLI" \
  --mesh-root "$SFLO_PUB" \
  --target 'designatorPath=/,historySegment=main'
```

## Step 6: Integrate SFLO Source Payloads

The branch-published SFLO release uses source-lane payload integrations from `$SFLO_SRC` into `$SFLO_PUB`. `integrate` leaves the source bytes in the source checkout, records a working-only source binding in each Knop source registry, and uses `~/.sf-local-access.ttl` for the host-local read grant when `$SFLO_SRC` is outside the publication mesh workspace.

Do not pass repository flags for this floating working-source replay. The source registries should record `sflo:targetLocalRelativePath` and `sflo:artifactResolutionMode_working`, but should not persist repository ref, commit, path, or digest evidence.

```sh
deno run -A "$WEAVE_CLI" integrate "$SFLO_SRC/semantic-flow-core-ontology.ttl" ontology \
  --mesh-root "$SFLO_PUB" \
  --grant-source-directory "$SFLO_SRC"

deno run -A "$WEAVE_CLI" integrate "$SFLO_SRC/semantic-flow-config-ontology.ttl" config \
  --mesh-root "$SFLO_PUB" \
  --grant-source-directory "$SFLO_SRC"

deno run -A "$WEAVE_CLI" integrate "$SFLO_SRC/semantic-flow-core-shacl.ttl" ontology/shacl \
  --mesh-root "$SFLO_PUB" \
  --grant-source-directory "$SFLO_SRC"
```

Confirm the source bindings stayed floating and working-only:

```sh
if rg 'sourceRepository|expectsContentDigest|hasContentDigest' \
  "$SFLO_PUB"/ontology/_knop/_sources/sources.ttl \
  "$SFLO_PUB"/config/_knop/_sources/sources.ttl \
  "$SFLO_PUB"/ontology/shacl/_knop/_sources/sources.ttl
then
  echo "Expected floating working source bindings without repository or digest evidence." >&2
  exit 1
fi
```

Before publication, the source ontology metadata should consistently describe the configured release version, and `owl:versionIRI` should point at raw bytes for the matching eventual release tag. The version/HistoricalState resource can use `schema:contentUrl` for the preferred mesh-served Turtle URL and `sflo:hasManifestation` for the lightweight manifestation node whose `dcat:downloadURL` is the same mesh-served Turtle URL. The generated inventory carries the richer `ArtifactManifestation`, `LocatedFile`, and `locatedFileForManifestation` graph.

## Step 7: Version The Source Payloads

Set the release history and state intent, then explicitly version the three payloads. `weave version` creates historical states; `weave generate` later renders pages from the resulting mesh state.

```sh
deno run -A "$WEAVE_CLI" set history ontology releases --mesh-root "$SFLO_PUB"
deno run -A "$WEAVE_CLI" set next-state ontology "$SFLO_RELEASE_STATE" --mesh-root "$SFLO_PUB"

deno run -A "$WEAVE_CLI" set history config releases --mesh-root "$SFLO_PUB"
deno run -A "$WEAVE_CLI" set next-state config "$SFLO_RELEASE_STATE" --mesh-root "$SFLO_PUB"

deno run -A "$WEAVE_CLI" set history ontology/shacl releases --mesh-root "$SFLO_PUB"
deno run -A "$WEAVE_CLI" set next-state ontology/shacl "$SFLO_RELEASE_STATE" --mesh-root "$SFLO_PUB"

deno run -A "$WEAVE_CLI" version \
  --mesh-root "$SFLO_PUB" \
  --payload-manifestation-segment ttl \
  --target 'designatorPath=ontology' \
  --target 'designatorPath=config' \
  --target 'designatorPath=ontology/shacl'
```

## Step 8: Extract Terms From The Source Artifacts

Run all-terms extraction after the source artifacts have been versioned. These commands create first-class term identifiers for mesh-scoped named nodes discovered in subject, predicate, or object position, skip generated support/file resources such as `sflo:LocatedFile`s, and create canonical source references for terms newly extracted in that invocation. Existing extracted terms are skipped, so this does not backfill references from a later source if a term was already extracted from an earlier source. If source references need to be repaired or regenerated, reset the disposable publication worktree and replay the sequence from the beginning rather than rerunning extraction over already-created terms.

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

## Step 9: Validate And Weave The Extracted Terms

Run whole-mesh validation as a preflight after extraction, while the pending extracted term Knops still have not been woven into current generated pages. Then run an untargeted weave so every pending extracted term Knop and its support surfaces become part of the current publication mesh. This advances the generated publication side without changing the source checkout.

```sh
deno run -A "$WEAVE_CLI" validate mesh \
  --mesh-root "$SFLO_PUB"

deno run -A "$WEAVE_CLI" \
  --mesh-root "$SFLO_PUB"

deno run -A "$WEAVE_CLI" generate \
  --mesh-root "$SFLO_PUB"
```

## Step 10: Inspect The Generated Publication Worktree

Run publication validation after page generation. Publication validation checks the selected host preset, so the GitHub Pages profile should require `.nojekyll`.

```sh
deno run -A "$WEAVE_CLI" validate publication \
  --mesh-root "$SFLO_PUB"
```

Confirm the root welcome page uses `main/_s0001`, and the ontology, config, and SHACL payloads use the configured release state under `releases`.

```sh
find "$SFLO_PUB" \
  -path "*/releases/$SFLO_RELEASE_STATE/ttl/*.ttl" \
  -o -path '*/_s0001/ttl/*.ttl' \
  | sort

find "$SFLO_PUB" \
  -path '*/_knop/_sources/sources.ttl' \
  -o -path '*/_knop/_references/references.ttl' \
  | sort

git -C "$SFLO_PUB" status --short --branch
```
