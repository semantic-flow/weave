---
id: 96vumpc760psizhzvrw4y29
title: Repository Options
desc: 'publication topology options for a semantic mesh'
updated: 1775530185587
created: 1775529630513
---

## Whole-repo semantic mesh:
Use this when the repo itself is the canonical mesh workspace, current files and historical states should live next to each other, and the generated structure is part of the thing you actually want to inspect and version directly. Good fit for fixture repos, reference meshes, and artifact-native projects.

## /docs semantic mesh:
Use this when the source repo is primarily an authoring environment and the public mesh is a publishable projection. This is probably the best fit for Markdown/note publishing, Kato/Weave/Accord docs, and anything where generated histories/pages would otherwise drown the source tree.
