---
title: Documentation
description: How to make this site your own
created: "2024-11-21"
updated: "2024-11-22"
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
- options:
  - --config for config file
  - --dest folder ("_woven" by default) to which files are copied
  - --repoDir lets you specify the path where any git repos of content are
    stored
  - --debug

### Usage

- weave repos list: lists configured repos including their "active" status and
  whether they're behind their origin
- weave repos pull: pull latest for all configured repos
- weave repos push: pull and then, if no conflicts, push all repos
- weave collisions: list any potential collisions
- weave prepare: for repos-branches present, pull then push (if
  autoPullBeforeBuild and autoPushBeforeBuild are true, pull should happen
  before push; ); for missing repos, clone (when no inclusions or exclusions
  specified and excludeByDefault is false) or sparse checkout otherwise, depth 1
  by default; list to console; optionally/eventually perform custom logic to
  avoid collisions; displays list of likely collisions;
  - silent options,
- weave build: prepare and then copy all specified directories and files for
  active inclusions into dest dir, by inclusion order.
  - clean: true | false
  - global-copy-strategy: overwrite | no-overwrite | prompt
  - per-inclusion copy-strategy: overwrite | no-overwrite | prompt
- weave monitor: detects changes in active inclusions and copies them to dest
- weave (default): build and monitor, but only safely (i.e., repos all
  up-to-date, no collisions, build with prompt)

## Copying strategies

- `no-overwrite`: is the safe option where the copy will fail if a collision is detected; it only really makes sense if clean is true

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
