---
id: 13j87uzddf6fg8gzc668wnq
title: weave set extraction-source
desc: ''
updated: 1779376245932
created: 1779376245932
---

## Summary

`weave set extraction-source` replaces the extraction-source contract for an existing extracted Knop.

## Usage

```sh
weave set extraction-source <targetDesignatorPath> [--mesh-root <meshRoot>] (--source <sourceDesignatorPath> | --source-state <historicalStatePath>)
weave set extraction-source --all-terms [--mesh-root <meshRoot>] (--source <sourceDesignatorPath> | --source-state <historicalStatePath>) [--accept-preview]
```

## Examples

```sh
weave set extraction-source ontology/AbilityScore --mesh-root docs --source ontology
weave set extraction-source ontology/AbilityScore --mesh-root docs --source-state ontology/releases/v0.1.0
weave set extraction-source --all-terms --mesh-root docs --source ontology --accept-preview
```

## Source Modes

`--source` records a working-source binding to the current source payload artifact.

`--source-state` records an exact source-state binding and fails if the historical source bytes do not mention the target term. It reads the woven historical snapshot, so the source artifact's current working file or floating repository locator does not need to be resolvable.

The command replaces the existing source-registry `sflo:ExtractionSource` details; it does not append a second primary extraction source.

## All-Terms Updates

The `--all-terms` form discovers named mesh-scoped terms from the selected source graph, previews the existing extracted terms that will be updated, and writes all listed updates after confirmation. Use `--accept-preview` for noninteractive runs.

## Environment

- [[wu.environment-variables#weave_log_dir]] controls where runtime logs are written.
- [[wu.environment-variables#home-and-userprofile]] can affect workspace/local-access policy resolution.
