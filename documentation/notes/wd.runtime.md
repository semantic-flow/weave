---
id: gfdo53dmqcjro2tpt8h70c0
title: Runtime
desc: ''
updated: 1777853773256
created: 1777853773256
---

## Purpose

This note collects Weave app runtime guidance: CLI behavior, local filesystem execution, daemon behavior, runtime configuration, and host-environment boundaries.

The app is named Weave, but `weave` is also a Semantic Flow operation. Use "the `weave` operation" when referring to the Semantic Flow operation that versions, validates, and generates mesh surfaces. Use "Weave runtime", "Weave CLI", or "Weave app" when referring to this implementation.

Portable Semantic Flow behavior belongs in `sf.spec.*` notes in the Semantic Flow Framework. Weave-specific runtime details belong here or in narrower `wd.*` implementation notes.

## CLI Mesh Roots

The Weave CLI spells local mesh selection as `--mesh-root` for `weave`, `weave validate`, `weave version`, `weave generate`, and `weave integrate`. When omitted, the command working directory is used as the mesh root.

For `weave integrate`, relative source paths are resolved from the command working directory. The stored `workingLocalRelativePath` remains relative to the mesh root after local path policy approves the source.

When integrating a source outside the mesh root but inside the inferred workspace root, `weave integrate --grant-source-directory <path>` adds a constrained mesh-carried `workingLocalRelativePath` access rule for that source directory before resolving the source. This is the sidecar path for artifact-specific adjacent directories such as `ontology/` or `shacl/`; omitting the grant keeps extra-mesh source access fail-closed unless existing config already allows it.

If an adjacent workspace source is denied and a mesh config exists, the runtime should suggest the corresponding `--grant-source-directory` value. Adjacent interworkspace sources should use explicit local/operator access policy unless the mesh config deliberately defines a larger workspace relationship; mesh-carried grants should not silently expand beyond the inferred workspace root.

`weave mesh create` also accepts `--workspace` because it may need to create the initial mesh config before any mesh-carried workspace relationship exists.

## Runtime Logs

The Weave CLI writes runtime logs under `.weave/logs/` in the inferred workspace root. For whole-root meshes this is the mesh root. For sidecar meshes, the workspace root is inferred from mesh config and the logs remain outside the public mesh root.
