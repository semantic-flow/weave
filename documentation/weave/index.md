---
title: Documentation
description: How to make this site your own
created: "2024-11-21"
updated: "2024-12-12"
---

- **Weave** is a dynamic CLI tool for remixing static sites, focused on syncing,
  monitoring, and managing files from multiple inclusion sources.
- It integrates file watching, repository handling, and dynamic workflows to
  empower static site generation.
- It's output is a folder (named "_woven" by default) that blends different
  sources (git repos, local folders, remote files) based on inclusion rules
- "monitor" will watch local folders (including repo folders) detect changes in
  any local sources, and copy them to the output folder where they can be picked
  up by a static site generator
- The project follows a modular structure inspired by Lume, with:
  - A `src/cli` directory for CLI-specific logic.
  - A `src/core/util` directory for core utilities like repository management,
    file syncing, and configuration handling.
  - A `deps` folder for centralized dependency management, similar to Lume's
    approach.

## Global Options

- `--config <file:string>`: Specify the path or URL to the configuration file.
- `--debug <level:string>`: Set log level (`DEBUG`, `INFO`, `WARN`, `ERROR`,
  `CRITICAL`). Overrides default log settings.
- `--dest <directory:string>`: Output directory (defaults to "_woven").
- `--globalClean`: Clean the destination directory before build.
- `--globalCopyStrategy <strategy:string>`: Copy strategy (`no-overwrite`,
  `overwrite`, `skip`, `prompt`).
- `--watchConfig`: configuration file changes take effect immediately without
  restarting Weave.
- `--workspaceDir <directory:string>`: Path where any git repositories of
  content are stored.

### Usage

- weave setup: interactive prompt to create config file if none present, and add
  inclusions
- weave inclusions list: lists all inclusions and their statuses
  (active/inactive, present/missing, current/ahead/behind/divergent) and copy
  strategies, in order but grouped by active/inactive;
- weave inclusions verify: output status "ready to weave", "not ready"
  - maybe suggest "--ignore-missing" and "repos prepare" if needed
  - check remote inclusions for availability
  - check local dirs for existence
  - if collisions, suggest global "--ignore-collisions"
- weave inclusions prepare:
  - do repos prepare, plus...
  - create local inclusion dirs if not present
  - create dest dir if not present, ensure writability
  - maybe not needed?
- weave repos list: lists configured repos including their "active" status and
  whether they're behind/ahead/diverged from their origin
- weave repos checkout: for missing repos, initialize if necessary and perform
  sparse checkout, depth 1 by default;
- weave repos commit: commit all active configured repos using message provided
- weave repos prepare: checkout; pull if no conflicts and autoPullBeforeBuild,
  then push (if autoPushBeforeBuild); list
- weave repos pull: pull latest for all active configured repos
- weave repos push: push all active configured repos
  - when no inclusions specified and excludeByDefault is false, nothing to do
- weave repos sync: commit using specified message, pull, then push
- weave repos verify: checks whether repos are ready for build (and eventually,
  whether a pull would produce any conflicts)
  - ensure sparse checkout settings are good
  - each git inclusion can have "ignore-behind", "ignore-ahead", "ignore-divergent", and "ignore-checkout-consistency"
- weave remap: transform directory names or filenames (to avoid collisions or
  for renaming in general)
- weave collisions: list any potential collisions to console or optionally to a
  file; optionally/eventually perform custom logic to avoid collisions;
  - silent options,
- weave build: `repos prepare` and then copy all specified directories and files
  for active inclusions into dest dir, by inclusion order.
  - clean: true | false
  - global-copy-strategy: overwrite | no-overwrite | skip | prompt
  - per-inclusion copy-strategy: overwrite | no-overwrite | skip | prompt
- weave watch: detects changes in active inclusions and copies them to dest
  - ?does it
- weave start: build and watch,
  - ?but only safely (i.e., repos all up-to-date, no collisions, build with
    prompt)

## Copying strategies

- `no-overwrite`: is the safe option where the copy will fail if a collision is
  detected; it only really makes sense if clean is true

With a copying strategy of "overwrite", the order matters, so we should probably
include a inclusions: order: key that takes an integer, and on build inclusion
will be copied by ascending order. This prevents having to re-order inclusions
just to change processing order.

Copying strategy of prompt will ask user whwat to do

- **Planned Features**:
  - Dynamic configuration reloading during runtime.
  - Modular utilities for syncing, monitoring, and collission resolution.
  - A future interactive mode for real-time adjustments and task prioritization.
  - Keeping a list of assets in the frame might be a good idea for detecting
    potential filename collisions before the copying actually starts, for more
    "atomic" weaving.
  - keep track of prompt copying strategy choices to automate ongoing conflicts
  - "ack" option for collisions, to suppress future warnings
  - `weave combine` will take two "conflicting" files and merge them,
    - useful for, say, composite navigation
