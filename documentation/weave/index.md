---
title: Weave
description:
created: "2024-11-21"
updated: "2024-12-12"
---

- **Weave** is a dynamic CLI tool for remixing static sites, focused on syncing,
  monitoring, and managing files from multiple inclusion sources.
- It integrates file watching, repository handling, and dynamic workflows to
  empower static site generation.

## Folder Structure

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

- **weave init**: interactive prompt to create config file if none present, and
  add inclusions
- **weave inclusions list**: lists all active inclusions and their statuses
  (present/missing, copy strategy, exclude), in order
  - takes `--format json` option to return results in json format
  - otherwise, returns them as a table sorted by _order_
- **weave inclusions verify**: output status "ready to weave", "not ready"
  - maybe suggest `--ignore-missing` and `repos prepare` if needed
  - check remote inclusions for availability
  - check local dirs for existence and non-emptiness
  - if collisions, suggest globalCopyStrategy
- **weave repos list**: lists configured repos including their "active" status
  and whether they're behind/ahead/diverged from their origin
  - takes `--format json` option to return results in json format
  - otherwise, returns them as a table sorted by _order_
- **weave repos checkout**: for missing repos, initialize if necessary and
  perform sparse checkout, depth 1 by default
- **weave repos commit**: commit all active configured repos using message
  provided
- **weave repos prepare**: checkout if necessary; pull if no conflicts and
  `autoPullBeforeBuild`, then push (if `autoPushBeforeBuild`); list
- **weave repos pull**: pull latest for all active configured repos
- **weave repos push**: push all active configured repos
  - when no inclusions specified and `excludeByDefault` is false, nothing to do
- **weave repos sync**: commit using specified message, pull, then push
- **weave repos verify**: checks whether repos are ready for build (and
  eventually, whether a pull would produce any conflicts)
  - ensure sparse checkout settings are good
  - each git inclusion can have `ignore-behind`, `ignore-ahead`,
    `ignore-divergent`, and `ignore-checkout-consistency`
- **weave collisions**: list any potential collisions to console or optionally
  to a file; optionally/eventually perform custom logic to avoid collisions
  - silent options
- **weave build**: `repos prepare` and then copy all included files (respecting
  directory structure when present) for active inclusions into dest dir, by
  inclusion order
  - options:
    - globalClean: `true` | `false` determines whether destination should be
      cleaned prior to build
    - globalCopyStrategy: `overwrite` | `no-overwrite` | `skip` | `prompt`
  - --no-verify: Skip verification of inclusions before building
  - --no-prepare: Skip preparation of repositories before building; this will
    save some time doing networked git operations
  - --pull-strategy: Pull strategy to use for git repositories (ff-only, rebase,
    merge)
  - --push-strategy: Push strategy to use for git repositories (no-force,
    force-with-lease, force)
  - --dry-run: simulate copying of files without actually copying them
- **weave watch**: detects changes in active inclusions and copies them to dest
  - doesn't itself build, only copies changed files that meet the inclusion
    conditions
- **weave start**: build and watch,
  - ?but only safely (i.e., repos all up-to-date, no collisions, build with
    prompt)
- **weave setup**: interactive prompt to create config file if none present, and
  add inclusions
- **weave repos list**: lists configured repos including their "active" status
  and whether they're behind/ahead/diverged from their origin
- **weave repos checkout**: for missing repos, initialize if necessary and
  perform sparse checkout, depth 1 by default
- **weave repos commit**: commit all active configured repos using message
  provided
- **weave repos prepare**: checkout if not already present; pull if no conflicts
  and `autoPullBeforeBuild`, then push (if `autoPushBeforeBuild`); list
- **weave repos pull**: pull latest for all active configured repos
- **weave repos push**: push all active configured repos
  - when no inclusions specified and `excludeByDefault` is false, nothing to do
- **weave repos sync**: commit using specified message, pull, then push
- **weave repos verify**: checks whether repos are ready for build (and
  eventually, whether a pull would produce any conflicts)
  - ensure sparse checkout settings are good
  - each git inclusion can have `ignore-behind`, `ignore-ahead`,
    `ignore-divergent`, and `ignore-checkout-consistency`
- **weave collisions**: list any potential collisions to console or optionally
  to a file; optionally/eventually perform custom logic to avoid collisions
  - silent options
- **weave build**: `repos prepare` and then copy all specified directories and
  files for active inclusions into dest dir, by inclusion order
  - clean: `true` | `false`
  - global-copy-strategy: `overwrite` | `no-overwrite` | `skip` | `prompt`
  - per-inclusion copy-strategy: `overwrite` | `no-overwrite` | `skip` |
    `prompt`
- **weave watch**: detects changes in active inclusions and copies them to dest
  - ?does it
- **weave start**: build and watch,
  - ?but only safely (i.e., repos all up-to-date, no collisions, build with
    prompt)

## File Handling Strategies

Weave provides several strategies for handling files during the build process:

- [Collision and Update Strategies](./collision-and-update-strategies.md):
  Detailed documentation on how to handle file collisions and updates.

### Copy Strategies

- `no-overwrite`: is the safe option where the build will fail if a collision is
  detected; it only really makes sense if clean is true
- `overwrite`: always overwrite existing files
- `skip`: skip copying if the file already exists
- `prompt`: ask user what to do for each collision

## Configuration File

The Weave configuration file (typically `weave.config.ts`) defines how your
project is structured and how files are included, processed, and built. It uses
TypeScript for type safety and better developer experience.

### Basic Structure

```typescript
// weave.config.ts
import { WeaveConfigInput } from "./src/types.ts";

export const weaveConfig: WeaveConfigInput = {
  global: {
    dest: "_woven", // Output directory
    dryRun: false, // Simulate operations without making changes
    globalClean: true, // Clean destination before build
    globalCopyStrategy: "no-overwrite", // Default copy strategy
    globalCollisionStrategy: "fail", // Default collision strategy
    globalUpdateStrategy: "never", // Default update strategy
    ignoreMissingTimestamps: false, // Whether to ignore missing timestamps
    watchConfig: false, // Auto-reload on config changes
    workspaceDir: "_source-repos", // Directory for cloned repositories
  },
  inclusions: [
    // Git repository inclusion
    {
      name: "Example Repository",
      type: "git",
      url: "git@github.com:user/repo.git",
      order: 10, // Processing order (lower numbers first)
      options: {
        branch: "main", // Branch to checkout
        include: ["docs", "src"], // Directories/files to include
        exclude: ["src/tests"], // Directories/files to exclude
        excludeByDefault: true, // Exclude everything not explicitly included
        autoPullBeforeBuild: true, // Pull before building
        autoPushBeforeBuild: false, // Push before building
        copyStrategy: "overwrite", // Override global copy strategy
        remappings: [ // Path remappings
          {
            source: "docs/", // Source path or pattern
            target: "documentation/", // Target path
          },
        ],
      },
    },

    // Web resource inclusion
    {
      type: "web",
      url: "https://raw.githubusercontent.com/user/repo/main/README.md",
      order: 20,
      options: {
        active: true,
        copyStrategy: "no-overwrite",
      },
    },

    // Local directory inclusion
    {
      type: "local",
      localPath: "local-content",
      order: 30,
      options: {
        active: true,
        include: ["**/*.md"],
        exclude: ["drafts/"],
        excludeByDefault: false,
        remappings: [
          {
            source: "blog/*.md",
            target: "posts/$1", // $1 refers to the wildcard match
          },
        ],
      },
    },
  ],
};
```

### Global Options

The `global` section defines project-wide settings:

- `dest`: Output directory for the woven content
- `dryRun`: When true, simulates operations without making changes
- `globalClean`: When true, cleans the destination directory before building
- `globalCopyStrategy`: Default strategy for handling file conflicts
- `globalCollisionStrategy`: Default strategy for handling file collisions
- `globalUpdateStrategy`: Default strategy for handling file updates
- `ignoreMissingTimestamps`: When true, ignores missing timestamps when using
  if-newer update strategy
- `watchConfig`: When true, automatically reloads when config changes
- `workspaceDir`: Directory where git repositories are stored

### Inclusions

The `inclusions` array defines content sources. Each inclusion has:

- `type`: Source type (`git`, `web`, or `local`)
- `name`: Optional human-readable name
- `order`: Processing priority (lower numbers processed first)
- Type-specific properties:
  - Git: `url` and `localPath` (optional)
  - Web: `url`
  - Local: `localPath`
- `options`: Inclusion-specific settings

### Inclusion Options

Common options for all inclusion types:

- `active`: When true, the inclusion is processed (default: true)
- `copyStrategy`: How to handle file conflicts, overrides global setting
- `collisionStrategy`: How to handle file collisions, overrides global setting
- `updateStrategy`: How to handle file updates, overrides global setting
- `ignoreMissingTimestamps`: Whether to ignore missing timestamps, overrides
  global setting
- `remappings`: Array of path transformations to apply during copying

#### Remappings

Remappings allow you to change the destination path of files during the build
process. Each remapping has:

- `source`: Source path or pattern (supports wildcards)
- `target`: Target path (can reference captured wildcards with $1, $2, etc.)

Examples:

```typescript
// Simple directory rename
{ source: "docs/", target: "documentation/" }

// File extension change
{ source: "*.txt", target: "*.md" }

// Complex pattern with wildcards
{ source: "content/*/index.md", target: "pages/$1.md" }
```

#### Git-specific Options

- `branch`: Branch to checkout
- `include`/`exclude`: Arrays of paths to include/exclude
- `excludeByDefault`: When true, only explicitly included paths are processed
- `autoPullBeforeBuild`: When true, pulls changes before building
- `autoPushBeforeBuild`: When true, pushes changes before building
- `pullStrategy`/`pushStrategy`: Strategies for git operations
- Various `ignore*` options to control verification behavior

#### Web-specific Options

- `ignoreRemoteAvailability`: When true, ignores availability check failures

#### Local-specific Options

- `include`/`exclude`: Arrays of paths to include/exclude
- `excludeByDefault`: When true, only explicitly included paths are processed
- `ignoreLocalEmpty`/`ignoreMissing`: Control verification behavior

## Planned Features

- Dynamic configuration reloading during runtime.
- Modular utilities for syncing, monitoring, and collision resolution.
- A future interactive mode for real-time adjustments and task prioritization.
- keep track of prompt copying strategy choices to automate ongoing conflicts
- "ack" option for collisions, to suppress future warnings
- combine two "conflicting" files and merge them,
  - useful for, say, composite navigation
