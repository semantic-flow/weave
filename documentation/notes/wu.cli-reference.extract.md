---
id: 1mh7wsb24ctofvnfg5fs1jg
title: weave extract
desc: ''
updated: 1779376237378
created: 1779376237378
---

## Summary

`weave extract` creates a minimal Knop-managed surface for a local resource referenced inside a woven payload artifact.

## Usage

```sh
weave extract <targetDesignatorPath> [--mesh-root <meshRoot>] [--source <sourceDesignatorPath> | --source-state <historicalStatePath>]
weave extract --all-terms (--source <sourceDesignatorPath> | --source-state <historicalStatePath>) [--mesh-root <meshRoot>] [--accept-preview] [--add-source-references --reference-role <referenceRole>]
```

Use `/` for the root designator as described in [[wu.cli-reference.root-designator]].

## Examples

```sh
weave extract bob
weave extract /
weave extract ontology/CharacterShape --mesh-root docs --source ontology/shacl
weave extract ontology/AbilityScore --mesh-root docs --source-state ontology/releases/v0.1.0
weave extract --all-terms --mesh-root docs --source ontology --accept-preview
weave extract --all-terms --mesh-root docs --source ontology --add-source-references --reference-role canonical --accept-preview
```

## Source Selection

`--source <sourceDesignatorPath>` selects the already woven payload artifact that describes the target and records a working-source `sflo:ExtractionSource` in the target Knop's `_sources` registry.

`--source-state <historicalStatePath>` records an exact historical source state and resolves the owning source artifact from mesh inventory. It reads the woven historical snapshot, so the source artifact's current working file or floating repository locator does not need to be resolvable.

`--source` and `--source-state` are mutually exclusive. If neither is supplied for single-target extraction, Weave resolves the unique current woven payload artifact that mentions the target.

## All-Terms Extraction

`--all-terms` discovers named mesh-scoped RDF terms from the selected source graph, previews the identifiers that will be created, and asks for confirmation before writing. Use `--accept-preview` for noninteractive runs.

Existing Knops, blank nodes, support artifact paths, and generated page/file artifact paths are skipped.

`--add-source-references` is valid only with `--all-terms` and creates a `ReferenceCatalog` / `ReferenceLink` for each newly extracted term. `--reference-role` is required with `--add-source-references`. Existing terms are not backfilled by this option.

## Environment

- [[wu.environment-variables#weave_log_dir]] controls where runtime logs are written.
- [[wu.environment-variables#home-and-userprofile]] can affect workspace/local-access policy resolution.
