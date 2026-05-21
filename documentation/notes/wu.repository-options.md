---
id: 96vumpc760psizhzvrw4y29
title: Repository Options
desc: 'publication topology options for a semantic mesh'
created: 1775529630513
---

## Whole-repo semantic mesh:
Use this when the repo itself is the canonical mesh workspace, current files and historical states should live next to each other, and the generated structure is part of the thing you actually want to inspect and version directly.

This is a good fit for reference meshes and artifact-native projects.

A reference mesh is a repo whose main purpose is to publish a stable, inspectable example or reference dataset. Readers are expected to browse the mesh structure itself, so exposing the whole repo as the mesh is usually acceptable.

An artifact-native project is a project where the primary authored content already is the governed artifact surface. The repo layout is intentionally shaped around durable public artifact identifiers rather than around an independent software/build workflow.

Use this option carefully for ordinary software or ontology repositories. A whole-repo mesh makes the repo layout part of the public identifier and page surface, which can be awkward when project files naturally move over time or when private/internal project material should not be exposed through generated pages.

If a whole-repo mesh is published, every file contained in it would be available. For private working files and other unrelated files, you should use either a sidecar mesh or a branch-published mesh.

## Sidecar semantic mesh:
Use this when the source repo is primarily an authoring environment and the public mesh is a publishable projection. The mesh rides alongside the rest of the repo rather than being the repo's main subject.

This should usually be the default for repos that are not primarily meshes: software projects, ontology projects, Markdown/note publishing, and anything where generated histories/pages would otherwise drown the source tree.

Sidecar meshes fit the practical rule that mesh paths should be relatively stable. Most project source trees are allowed to move around as the project evolves; the public mesh should not have to churn every time the authoring layout changes. In a sidecar layout, working payload files can remain in project-appropriate source locations while the mesh keeps stable public identifiers, generated resource pages, and historical snapshots under a publishable root such as `docs/`.

This also limits accidental publication. A whole-repo mesh tends to make the whole repo feel like the public page surface, while a sidecar mesh keeps the public mesh boundary explicit.

Sidecar meshes may still need publication-host presets. For example, a GitHub Pages preset can manage `.nojekyll` when the sidecar root is served directly by GitHub Pages. That control is about the publication root and host, not about whether the mesh lives on the source branch or on a separate branch.

## Branch-published semantic mesh:

Use this when the authored source branch should stay clean, but the project still wants stable dereferenceable mesh pages from a publication branch such as `gh-pages`.

A branch-published mesh is sidecar-like in purpose: the public mesh is a generated projection of (some of) the source repository rather than the main authoring layout. The difference is operational. Instead of storing generated `_mesh/`, histories, inventories, and pages in a `docs/` directory on the source branch, the generated mesh lives in a separate publication branch.

This is a strong fit for ontology and vocabulary repositories where maintainers want the normal branch to contain only source artifacts such as Turtle, SHACL, Markdown, or examples, while GitHub Pages serves the generated Semantic Flow surface from a dedicated branch.

Branch-published meshes should record durable source provenance, such as repository, ref, source path, and content digest. They should not record one contributor's local sibling checkout path as public RDF. Local paths belong to the deploy operation that reads the source checkout and writes the publication checkout; the published mesh should describe the source material, not the workstation layout.

Choose this option when generated mesh state would be too noisy for the source branch, when review of generated publication output can happen on the publication branch, and when the project can tolerate a slightly more explicit deploy workflow.

The branch boundary should not create a different Semantic Flow model. The same underlying operations should apply across whole-repo, sidecar, and branch-published meshes: create a mesh root, integrate or materialize source bytes according to an explicit locator/materialization policy, weave/version/generate the mesh, apply any selected publication-host preset, validate the publication output, and optionally commit changes when the mesh root is a git worktree. A branch-published mesh mainly changes the default source/output boundary and publication safety checks; it should not require a separate semantic command family unless branch-specific behavior is genuinely needed.
