---
id: ewr0vs8qs6fpkrs63y7tzll
title: SFLO CLI Examples
desc: ''
updated: 1779030765340
created: 1779030765340
---

## Purpose

This note records the command sequence used while dogfooding Weave against the SFLO ontology repository and a branch-published `gh-pages` mesh. The examples assume a Weave checkout with dependency-local sibling checkouts for the SFLO source repository and the SFLO publication worktree.

This note is temporarily not a complete replayable release script. The old `weave prepare gh-pages` wrapper has been removed, and branch-published source binding is being refactored into ordinary `integrate`, `weave`, `generate`, `validate`, publication-profile, and CI/CD operations.

The source checkout stays on `main`. The publication checkout is an unborn or disposable `gh-pages` worktree. The ontology and SHACL payload artifacts use `releases` as the artifact-history segment and `v0.1.0` as the state segment.

The root welcome page can still use the primitive commands below because it is authored directly in the publication root. The ontology, config ontology, and SHACL payloads should be integrated from the SFLO source checkout with repository-backed source evidence once that CLI/API surface lands; they should not be copied implicitly by `weave`.

## Step 1: Set Shell Variables

Use variables so the command sequence is replayable from the Weave checkout without repeating long local paths. `WEAVE_LOG_DIR` keeps local runtime logs out of the publication worktree.

```sh
export WEAVE_ROOT=/home/djradon/hub/semantic-flow/weave
export WEAVE_CLI="$WEAVE_ROOT/src/main.ts"
export SFLO_SRC="$WEAVE_ROOT/dependencies/github.com/semantic-flow/sflo"
export SFLO_PUB="$WEAVE_ROOT/dependencies/github.com/semantic-flow/sflo-gh-pages"
export SFLO_SOURCE_REPO='https://github.com/semantic-flow/sflo.git'
export SFLO_SOURCE_COMMIT="$(git -C "$SFLO_SRC" rev-parse v0.1.0^{commit})"
export WEAVE_LOG_DIR=/tmp/weave-logs

mkdir -p "$WEAVE_LOG_DIR"
cd "$WEAVE_ROOT"
```

## Step 2: Reset The Disposable Publication Worktree

This clears generated publication output while preserving `welcome.ttl`. Use this only when the `gh-pages` worktree has no committed publication history you need to keep.

```sh
tmp_welcome="$(mktemp)"
cp "$SFLO_PUB/welcome.ttl" "$tmp_welcome"

find "$SFLO_PUB" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +

cp "$tmp_welcome" "$SFLO_PUB/welcome.ttl"
rm "$tmp_welcome"

git -C "$SFLO_PUB" status --short --branch
```

## Step 3: Create The Publication Mesh

Create the branch-published mesh support artifacts at the publication root. Root publication meshes do not need `_mesh/_config/config.ttl`.

```sh
deno run -A "$WEAVE_CLI" mesh create \
  --workspace "$SFLO_PUB" \
  --mesh-base 'https://semantic-flow.github.io/sflo/'
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

## Step 6: Pending Source Integrations

The branch-published SFLO release needs three source-lane payload integrations from `$SFLO_SRC` into `$SFLO_PUB`:

- `semantic-flow-core-ontology.ttl` -> `ontology`
- `semantic-flow-config-ontology.ttl` -> `config`
- `semantic-flow-core-shacl.ttl` -> `ontology/shacl`

Before publication, the source ontology metadata should consistently describe `v0.1.0`, and `owl:versionIRI` should point at raw bytes for the matching release tag. The version/HistoricalState resource can use `schema:contentUrl` for the preferred mesh-served Turtle URL and `sflo:hasManifestation` for the lightweight manifestation node whose `dcat:downloadURL` is the same mesh-served Turtle URL. The generated inventory carries the richer `ArtifactManifestation`, `LocatedFile`, and `locatedFileForManifestation` graph. Commit and tag the SFLO source first, then use the tag as the source ref; do not record `main` for release-versioned bytes.

The replacement command shape should bind repository URL, ref, resolved commit, repository-relative path, requested history/state/manifestation segments, and resolution policy without treating branch publication as a special operation. Until that integrate surface exists, this example stops before source-payload release publication.

## Step 7: Extract Terms From The Source Artifacts

These remaining commands show the post-source-integration shape. Do not run them until the three source artifacts above have been integrated and woven.

Run all-terms extraction after the source artifacts have been woven. These commands create first-class term identifiers for mesh-scoped named nodes discovered in subject, predicate, or object position, skip generated support/file resources such as `sflo:LocatedFile`s, and create canonical source references for terms newly extracted in that invocation. Existing extracted terms are skipped, so this does not backfill references from a later source if a term was already extracted from an earlier source. If source references need to be repaired or regenerated, reset the disposable publication worktree and replay the sequence from the beginning rather than rerunning extraction over already-created terms.

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

## Step 8: Weave The Extracted Terms

Run an untargeted weave after extraction so every pending extracted term Knop and its support surfaces become part of the current publication mesh. This advances the generated publication side without changing the source checkout.

```sh
deno run -A "$WEAVE_CLI" \
  --mesh-root "$SFLO_PUB"
```

## Step 9: Inspect The Generated Publication Worktree

Confirm the root welcome page uses `main/_s0001`, and the ontology and SHACL payloads use `releases/v0.1.0/ttl`.

```sh
find "$SFLO_PUB" \
  -path '*/releases/v0.1.0/ttl/*.ttl' \
  -o -path '*/_s0001/ttl/*.ttl' \
  | sort

find "$SFLO_PUB" \
  -path '*/_knop/_sources/sources.ttl' \
  -o -path '*/_knop/_references/references.ttl' \
  | sort

git -C "$SFLO_PUB" status --short --branch
```
