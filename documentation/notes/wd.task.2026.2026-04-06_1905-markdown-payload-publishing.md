---
id: rvoyc7eqrx86kvauhtl41o9
title: 2026 04 06 1905 Markdown Payload Publishing
desc: ''
updated: 1775527837222
created: 1775527837223
---

## Goals

- Carry the next real implementation-facing slice for publishing Markdown payloads through Weave without splitting that work into a separate site-generator product.
- Establish a clean baseline where ordinary Markdown works by default rather than making Dendron semantics mandatory for all published payloads.
- Define Dendron compatibility as an optional source-interpretation profile layered on top of Markdown rather than as the whole product boundary.
- Keep publication behavior profile-driven so `kato`, `weave`, `accord`, and other note vaults can share the same Weave-owned publishing pipeline while still diverging in inclusion rules, URLs, navigation, and fallback behavior.
- Keep this first task narrow enough to clarify the architecture and near-term implementation seam without absorbing a broad generic SSG, theme system, or every future note-publishing use case.

## Summary

This task should define and then begin the first carried Weave slice for publishing Markdown-backed content as semantic/public page surfaces.

The key boundary should be:

- plain Markdown is the baseline payload format
- Dendron compatibility is an optional source-format profile on top of that baseline
- repository-specific publication behavior is a separate publication-profile concern

That split matters because the problem is not just "render Dendron notes." Weave needs a reusable publishing pipeline that can:

- accept ordinary Markdown payloads
- optionally interpret richer source conventions such as Dendron note names, frontmatter, and wikilinks
- map selected source artifacts into a public mesh/page surface rooted at `docs/` or an equivalent output tree

The intended first direction is not a separate `dendrogen` tool and not a Kato-only website generator. It is a Weave-owned Markdown payload publishing seam that can serve multiple repos while remaining narrow enough to implement incrementally.

For the current first slice, the implementation and contract should assume:

- source Markdown payloads may remain outside the public page tree
- generated public pages are a distinct output surface
- unpublished source notes may still participate in link resolution and may need explicit fallback-link behavior
- richer Dendron semantics should only activate when the selected source-format profile requests them

## Discussion

## Open Issues

## Decisions

- Treat Markdown payload publishing as a Weave concern rather than as a separate standalone site-generator product.
- Use ordinary Markdown as the default source-content baseline.
- Treat Dendron compatibility as a source-interpretation profile layered on top of Markdown rather than as the default required mode.
- Keep publication behavior in a separate publication-profile layer so source-format interpretation and publication policy do not collapse into one configuration mechanism.
- Allow source payloads and generated public pages to live in different surfaces; the working/source Markdown files do not need to be web-accessible at their original paths.
- Design the publishing pipeline so unpublished source notes can still be resolved as known targets even when they do not receive public generated pages.
- Keep the first slice narrow: define the shared publishing seam, the Markdown baseline, and the profile split before investing in a broad generic SSG or theme architecture.
- Treat `kato`, `weave`, `accord`, and similar note vaults as different publication-profile consumers of the same Weave-owned publishing subsystem rather than as separate generators.

## Contract Changes

## Testing

## Non-Goals

## Implementation Plan

- [ ]
