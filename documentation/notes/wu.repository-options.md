---
id: 96vumpc760psizhzvrw4y29
title: Repository Options
desc: 'publication topology options for a semantic mesh'
updated: 1777703721069
created: 1775529630513
---

## Whole-repo semantic mesh:
Use this when the repo itself is the canonical mesh workspace, current files and historical states should live next to each other, and the generated structure is part of the thing you actually want to inspect and version directly.

This is a good fit for reference meshes and artifact-native projects.

A reference mesh is a repo whose main purpose is to publish a stable, inspectable example or reference dataset. Readers are expected to browse the mesh structure itself, so exposing the whole repo as the mesh is usually acceptable.

An artifact-native project is a project where the primary authored content already is the governed artifact surface. The repo layout is intentionally shaped around durable public artifact identifiers rather than around an independent software/build workflow.

Use this option carefully for ordinary software or ontology repositories. A whole-repo mesh makes the repo layout part of the public identifier and page surface, which can be awkward when project files naturally move over time or when private/internal project material should not be exposed through generated pages.

## Sidecar semantic mesh:
Use this when the source repo is primarily an authoring environment and the public mesh is a publishable projection. The mesh rides alongside the rest of the repo rather than being the repo's main subject.

This should usually be the default for repos that are not primarily meshes: software projects, ontology projects, Markdown/note publishing, and anything where generated histories/pages would otherwise drown the source tree.

Sidecar meshes fit the practical rule that mesh paths should be relatively stable. Most project source trees are allowed to move around as the project evolves; the public mesh should not have to churn every time the authoring layout changes. In a sidecar layout, working payload files can remain in project-appropriate source locations while the mesh keeps stable public identifiers, generated resource pages, and historical snapshots under a publishable root such as `docs/`.

This also limits accidental publication. A whole-repo mesh tends to make the whole repo feel like the public page surface, while a sidecar mesh keeps the public mesh boundary explicit.
