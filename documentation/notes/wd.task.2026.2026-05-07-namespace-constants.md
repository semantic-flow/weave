---
id: x9gbod9q6a2rjlv4r5z8h3p
title: Namespace Constants
desc: ''
created: 1778200000000
---

## Goals

Centralize Semantic Flow namespace roots and Turtle prefix declarations so generated RDF, parsers, and page rendering cannot drift across competing SFLO or config URLs.

## Summary

Introduce a small shared namespace module and import it from the code paths that emit or compare SFLO/SFCFG namespaces.

## Discussion

The previous `sfc:` cleanup found repeated file-local namespace constants. Those constants made single-file code clear, but they did not prevent files from retaining older namespace roots or prefix names.

## Open Issues

None.

## Decisions

- Keep individual SFLO term constants local unless they are already shared across modules.
- Centralize namespace roots, prefix labels, and Turtle prefix declaration strings.
- Do not add backward-compatibility shims for older namespace roots before v1.

## Contract Changes

No intended external behavior change.

## Testing

- [x] `deno task check`
- [x] `deno task lint`
- [x] `deno task fmt:check`
- [d] Focused `deno test` over touched emit/parse modules: 84 passed / 28 failed because branch-backed fixture expectations still contain the pre-SFLO namespace URLs and are slated for regeneration.

## Non-Goals

- Do not create a full SFLO term registry.
- Do not refactor fixture meshes.

## Implementation Plan

- [x] Add shared namespace constants.
- [x] Replace repeated SFLO/SFCFG namespace roots in production code.
- [x] Replace emitted Turtle prefix declaration literals in production code.
- [x] Run focused validation.
