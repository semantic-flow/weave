---
title: Documentation
description: How to make this site your own
created: "2024-11-21"
updated: "2024-11-21"
---

- **Weave** is a dynamic CLI tool for remixing static sites, focused on syncing,
  monitoring, and managing files from multiple inclusion sources.
- It integrates file watching, repository handling, and dynamic workflows to
  empower static site generation.
- It's output is a folder (named "_woven" by default) that blends different
  sources (git repos, local folders, remote files) based on inclusion rules
- While running in "monitor" mode, will watch local folders (including repo
  folders) detect changes in any local sources, and copy them to the output
  folder where they can be picked up by a static site generator
- The project follows a modular structure inspired by Lume, with:
  - A `src/cli` directory for CLI-specific logic.
  - A `src/core/util` directory for core utilities like repository management, file
    syncing, and configuration handling.
  - A `deps` folder for centralized dependency management, similar to Lume's
    approach.
- options: 
  - --config for config file
  - --out or --wovenDir specifies the "_woven" folder where files are copied
  - --repoDir lets you specify the path where any git repos of content are stored
  - monitor, watches 

- **Planned Features**:
  - Dynamic configuration reloading during runtime.
  - Modular utilities for syncing, monitoring, and conflict resolution.
  - A future interactive mode for real-time adjustments and task prioritization.
