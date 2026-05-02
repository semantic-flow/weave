---
id: swe9sy5ce5xos9ahuvt1bw4
title: 2026 05 02 Address Content Sensitive Manifests
desc: ''
updated: 1777739858405
created: 1777739839852
---

## Goal

Decide whether Semantic Flow conformance manifests should require exact generated HTML content for Resource Pages, or whether those checks should be removed, weakened to presence/absence, or moved into narrower renderer tests.

This follows from [[wd.task.2026.2026-05-02-fix-failing-tests]], where Weave's local conformance harness was made less brittle by treating `.html` manifest expectations as presence-only while keeping RDF and non-HTML content checks strict.

## Bottom Line

The current Alice Bio conformance suite is extensive enough that exact Resource Page HTML checks are acting like a UI snapshot suite, not just a behavioral conformance suite.

As of 2026-05-02, the Alice Bio conformance manifests contain 156 Resource Page `.html` file expectations. Of those, 138 declare `compareMode: "text"`. Under Accord's literal `check` semantics, only 35 of those are content-sensitive because Accord only compares contents for `updated` and `unchanged` file expectations; the 103 `added` HTML text expectations are effectively presence checks. Weave's e2e harness previously compared all text expectations, including `added` HTML files, but it now treats all `.html` text expectations as presence-only.

Recommendation: remove exact HTML content requirements from conformance manifests for Resource Pages. Keep Resource Page presence/absence checks and keep RDF graph checks that assert Resource Pages are registered with `sflo:hasResourcePage` and typed as `sflo:ResourcePage`/`sflo:LocatedFile`. Keep exact renderer output checks in focused Weave renderer tests where we intentionally own the HTML template, escaping behavior, relative links, canonical links, and markdown rendering.

## Scope Measured

Measured manifests:

`dependencies/github.com/semantic-flow/semantic-flow-framework/examples/alice-bio/conformance/*.jsonld`

Measured Resource Page expectations by file path suffix:

`path` ending in `.html`

Measured direct manifest content sensitivity by:

`compareMode: "text"` plus `changeType: "updated"` or `changeType: "unchanged"` for Accord CLI semantics.

This note is about Resource Page checks in conformance manifests. It does not recommend weakening RDF source, inventory, metadata, page-definition, CSS, Markdown, or other non-HTML content comparisons.

## Important Semantics Nuance

There are two different enforcement surfaces right now.

Accord CLI:

- Checks presence for all file expectations.
- Compares file contents only when `changeType` is `updated` or `unchanged`.
- Compares only `compareMode: "bytes"` and `compareMode: "text"` in that content comparison path.
- Therefore `added` + `compareMode: "text"` HTML expectations are presence-only in Accord today.

Weave e2e conformance harness before [[wd.task.2026.2026-05-02-fix-failing-tests]]:

- Compared every manifest `compareMode: "text"` expectation against the fixture branch content.
- That made `added` HTML Resource Pages exact snapshots in Weave even though Accord itself treated them as presence-only.

Weave e2e conformance harness after [[wd.task.2026.2026-05-02-fix-failing-tests]]:

- Uses `shouldCompareManifestTextFileContents(path)` and returns `false` for `.html`.
- Continues to stat `.html` paths so presence is still enforced.
- Continues to compare RDF canonical content and non-HTML text content.

This means the manifests still encode `compareMode: "text"` for Resource Pages, but current Weave tests no longer treat those Resource Page text modes as a content contract.

## Inventory Snapshot

Across 25 Alice Bio conformance manifests:

| Measure | Count |
| --- | ---: |
| Total `FileExpectation` entries | 321 |
| Resource Page `.html` expectations | 156 |
| Resource Page `.html` expectations with `compareMode: "text"` | 138 |
| Resource Page `.html` expectations that are content-sensitive under Accord semantics | 35 |
| Resource Page `.html` expectations that are presence-only under Accord semantics despite `compareMode: "text"` | 103 |
| Resource Page `.html` absence expectations | 18 |
| RDF/SPARQL assertions mentioning `hasResourcePage` or `index.html` | 27 |
| RDF expectations that directly target an `.html` file expectation | 0 |

Resource Page `.html` expectations by change type and mode:

| Change Type And Mode | Count | Effective Accord Behavior |
| --- | ---: | --- |
| `added` + `text` | 103 | Presence only |
| `updated` + `text` | 27 | Exact text comparison |
| `unchanged` + `text` | 8 | Exact text comparison |
| `absent` + no compare mode | 18 | Absence only |

## Manifest By Manifest

| Manifest | HTML Expectations | Added Text | Updated Text | Unchanged Text | Absent | Accord Content-Sensitive HTML Checks | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `01-source-only.jsonld` | 0 | 0 | 0 | 0 | 0 | 0 | No Resource Pages |
| `02-mesh-created.jsonld` | 0 | 0 | 0 | 0 | 0 | 0 | No Resource Pages |
| `03-mesh-created-woven.jsonld` | 9 | 9 | 0 | 0 | 0 | 0 | Created generated mesh/root support pages; presence-oriented in Accord |
| `04-alice-knop-created.jsonld` | 0 | 0 | 0 | 0 | 0 | 0 | No Resource Pages |
| `05-alice-knop-created-woven.jsonld` | 12 | 12 | 0 | 0 | 0 | 0 | Created generated Alice Knop pages; presence-oriented in Accord |
| `06-alice-bio-integrated.jsonld` | 4 | 0 | 0 | 0 | 4 | 0 | Absence checks before weave |
| `07-alice-bio-integrated-woven.jsonld` | 15 | 15 | 0 | 0 | 0 | 0 | Created generated Alice bio pages; presence-oriented in Accord |
| `08-alice-bio-referenced.jsonld` | 0 | 0 | 0 | 0 | 0 | 0 | No Resource Pages |
| `09-alice-bio-referenced-woven.jsonld` | 6 | 6 | 0 | 0 | 0 | 0 | Created reference-catalog support pages; presence-oriented in Accord |
| `10-alice-bio-updated.jsonld` | 0 | 0 | 0 | 0 | 0 | 0 | No Resource Pages |
| `11-alice-bio-v2-woven.jsonld` | 20 | 4 | 16 | 0 | 0 | 16 | Largest exact HTML snapshot cluster; mostly generated support pages plus `alice/index.html` and `alice/bio/index.html` |
| `12-bob-extracted.jsonld` | 5 | 0 | 0 | 0 | 5 | 0 | Absence checks before weave |
| `13-bob-extracted-woven.jsonld` | 18 | 16 | 2 | 0 | 0 | 2 | Exact checks for mesh inventory history page and regenerated `alice/index.html` |
| `14-alice-page-customized.jsonld` | 2 | 0 | 0 | 1 | 1 | 1 | Exact unchanged check for customized `alice/index.html`; absence check for old generated page-definition support page |
| `15-alice-page-customized-woven.jsonld` | 8 | 6 | 2 | 0 | 0 | 2 | Exact checks for inventory history page and customized `alice/index.html` |
| `16-alice-page-main-integrated.jsonld` | 2 | 0 | 0 | 1 | 1 | 1 | Exact unchanged check for customized `alice/index.html`; absence check for page-main Resource Page before weave |
| `17-alice-page-main-integrated-woven.jsonld` | 8 | 7 | 0 | 1 | 0 | 1 | Exact unchanged check for customized `alice/index.html` |
| `18-alice-page-artifact-source.jsonld` | 2 | 0 | 0 | 2 | 0 | 2 | Exact unchanged checks for `alice/_knop/_page/index.html` and `alice/index.html` |
| `19-alice-page-artifact-source-woven.jsonld` | 9 | 4 | 4 | 1 | 0 | 5 | Exact checks around page-definition artifact-source transition, including `alice/page-main/index.html`, page-definition support pages, inventory history, and `alice/index.html` |
| `20-bob-page-imported-source.jsonld` | 3 | 0 | 0 | 1 | 2 | 1 | Exact unchanged check for `bob/index.html`; absence checks for source support pages |
| `21-bob-page-imported-source-woven.jsonld` | 9 | 6 | 2 | 0 | 1 | 2 | Exact checks for Bob inventory history and `bob/index.html`; absence check for imported-source file page |
| `22-root-knop-created.jsonld` | 2 | 0 | 0 | 0 | 2 | 0 | Absence checks before root weave |
| `23-root-knop-created-woven.jsonld` | 12 | 12 | 0 | 0 | 0 | 0 | Created generated root support pages; presence-oriented in Accord |
| `24-root-page-customized.jsonld` | 2 | 0 | 0 | 1 | 1 | 1 | Exact unchanged check for customized root `index.html`; absence check for old generated page-definition support page |
| `25-root-page-customized-woven.jsonld` | 8 | 6 | 1 | 0 | 1 | 1 | Exact check for customized root `index.html`; absence check for root reference-catalog surface |

## Accord Content-Sensitive Resource Page Paths

These are the 35 Resource Page paths that are exact HTML content checks under Accord semantics because they are `updated` or `unchanged` with `compareMode: "text"`.

| Manifest | Change Type | Path |
| --- | --- | --- |
| `11-alice-bio-v2-woven.jsonld` | `updated` | `_mesh/_meta/_history001/index.html` |
| `11-alice-bio-v2-woven.jsonld` | `updated` | `_mesh/_inventory/_history001/index.html` |
| `11-alice-bio-v2-woven.jsonld` | `updated` | `alice/_knop/_meta/_history001/index.html` |
| `11-alice-bio-v2-woven.jsonld` | `updated` | `alice/_knop/_inventory/_history001/index.html` |
| `11-alice-bio-v2-woven.jsonld` | `updated` | `alice/_knop/_references/_history001/index.html` |
| `11-alice-bio-v2-woven.jsonld` | `updated` | `alice/bio/_knop/_meta/_history001/index.html` |
| `11-alice-bio-v2-woven.jsonld` | `updated` | `alice/index.html` |
| `11-alice-bio-v2-woven.jsonld` | `updated` | `alice/bio/index.html` |
| `11-alice-bio-v2-woven.jsonld` | `updated` | `alice/bio/_history001/index.html` |
| `11-alice-bio-v2-woven.jsonld` | `updated` | `alice/bio/_history001/_s0001/index.html` |
| `11-alice-bio-v2-woven.jsonld` | `updated` | `alice/bio/_history001/_s0001/alice-bio-ttl/index.html` |
| `11-alice-bio-v2-woven.jsonld` | `updated` | `alice/bio/_knop/index.html` |
| `11-alice-bio-v2-woven.jsonld` | `updated` | `alice/bio/_knop/_inventory/index.html` |
| `11-alice-bio-v2-woven.jsonld` | `updated` | `alice/bio/_knop/_inventory/_history001/index.html` |
| `11-alice-bio-v2-woven.jsonld` | `updated` | `alice/bio/_knop/_inventory/_history001/_s0001/index.html` |
| `11-alice-bio-v2-woven.jsonld` | `updated` | `alice/bio/_knop/_inventory/_history001/_s0001/inventory-ttl/index.html` |
| `13-bob-extracted-woven.jsonld` | `updated` | `_mesh/_inventory/_history001/index.html` |
| `13-bob-extracted-woven.jsonld` | `updated` | `alice/index.html` |
| `14-alice-page-customized.jsonld` | `unchanged` | `alice/index.html` |
| `15-alice-page-customized-woven.jsonld` | `updated` | `alice/_knop/_inventory/_history001/index.html` |
| `15-alice-page-customized-woven.jsonld` | `updated` | `alice/index.html` |
| `16-alice-page-main-integrated.jsonld` | `unchanged` | `alice/index.html` |
| `17-alice-page-main-integrated-woven.jsonld` | `unchanged` | `alice/index.html` |
| `18-alice-page-artifact-source.jsonld` | `unchanged` | `alice/_knop/_page/index.html` |
| `18-alice-page-artifact-source.jsonld` | `unchanged` | `alice/index.html` |
| `19-alice-page-artifact-source-woven.jsonld` | `unchanged` | `alice/page-main/index.html` |
| `19-alice-page-artifact-source-woven.jsonld` | `updated` | `alice/_knop/_page/index.html` |
| `19-alice-page-artifact-source-woven.jsonld` | `updated` | `alice/_knop/_page/_history001/index.html` |
| `19-alice-page-artifact-source-woven.jsonld` | `updated` | `alice/_knop/_inventory/_history001/index.html` |
| `19-alice-page-artifact-source-woven.jsonld` | `updated` | `alice/index.html` |
| `20-bob-page-imported-source.jsonld` | `unchanged` | `bob/index.html` |
| `21-bob-page-imported-source-woven.jsonld` | `updated` | `bob/_knop/_inventory/_history001/index.html` |
| `21-bob-page-imported-source-woven.jsonld` | `updated` | `bob/index.html` |
| `24-root-page-customized.jsonld` | `unchanged` | `index.html` |
| `25-root-page-customized-woven.jsonld` | `updated` | `index.html` |

## Types Of Resource Page Checks

### 1. Presence Checks For Newly Created Generated Resource Pages

These are `added` `.html` file expectations. They usually represent pages created by weave, integrate, extract, or knop creation:

- Mesh/root pages such as `_mesh/index.html`, `_mesh/_inventory/index.html`, `_mesh/_meta/index.html`, and their first history/state/file pages.
- Identifier pages such as `alice/index.html`, `alice/bio/index.html`, `bob/index.html`, and root `index.html`.
- Knop pages such as `alice/_knop/index.html`, `bob/_knop/index.html`, and `_knop/index.html`.
- Support artifact pages for metadata, inventory, references, and page definitions.
- Historical state and manifestation pages such as `_history001/index.html`, `_s0001/index.html`, and `*-ttl/index.html`.

These are worth keeping as conformance checks, but they should be expressed as presence checks rather than exact HTML text checks. A conformance implementation should prove that it creates the expected Resource Page surface without being forced to match Weave's current HTML template.

### 2. Absence Checks For Resource Pages That Should Not Exist Yet

These are `absent` `.html` file expectations. They appear in pre-weave or transitional manifests, especially where a page should not be generated before a supporting artifact exists or where an old surface is intentionally not present.

Examples:

- `06-alice-bio-integrated.jsonld` expects Alice bio Resource Pages to be absent before the woven state.
- `12-bob-extracted.jsonld` expects Bob Resource Pages to be absent before the woven state.
- `14-alice-page-customized.jsonld`, `16-alice-page-main-integrated.jsonld`, and `24-root-page-customized.jsonld` assert that certain generated page-definition surfaces are absent before the relevant weave.
- `25-root-page-customized-woven.jsonld` asserts the root reference-catalog Resource Page remains absent.

These are worth keeping. They are not content-sensitive and they protect useful lifecycle boundaries.

### 3. Exact HTML Checks For Generated Support Resource Pages

These include inventory, metadata, reference-catalog, payload history, state, manifestation, Knop, and ResourcePageDefinition support pages. They currently lock down title text, body wording, relative links, canonical links, and sometimes list contents.

Examples:

- `_mesh/_inventory/_history001/index.html`
- `alice/_knop/_inventory/_history001/index.html`
- `alice/bio/_knop/_inventory/_history001/_s0001/inventory-ttl/index.html`
- `alice/_knop/_page/index.html`
- `alice/_knop/_page/_history001/index.html`

These catch real renderer regressions, especially broken relative links and missing page-registration links. However, they are too broad for cross-implementation conformance. They bind every implementation and every fixture branch to Weave's exact generated prose and HTML structure.

If we want to retain this value, keep it in focused Weave renderer tests such as `src/runtime/weave/pages_test.ts`, or replace whole-file conformance comparisons with a smaller set of semantic assertions.

### 4. Exact HTML Checks For Public Identifier Resource Pages

These are the riskiest conformance checks because Resource Pages are intended to be author-customizable.

Examples:

- `alice/index.html`
- `alice/bio/index.html`
- `bob/index.html`
- root `index.html`
- `alice/page-main/index.html`

These should not be conformance content checks. In customized-page transitions, the exact HTML comes from mesh-local Markdown, CSS, and ResourcePageDefinition state. Eventually authors should be able to make these pages whatever they want, so conformance should not require specific headings, paragraphs, layout, or generated wrapper markup beyond any structural contract we explicitly decide to require.

For public identifier Resource Pages, conformance should generally check:

- The page exists when the corresponding identifier surface is expected.
- The page is registered in RDF with `sflo:hasResourcePage`.
- The page-definition artifact and source files are versioned and inventoried correctly.
- The source content files are preserved, moved, or versioned correctly.

It should not check exact rendered HTML content.

### 5. RDF Graph Checks That Mention Resource Pages

There are 27 SPARQL ASK assertions mentioning `hasResourcePage` or `index.html`. None of the RDF expectations directly target HTML files; they target RDF files and ask whether RDF state contains the expected Resource Page relationships.

These checks are worth keeping. They are not HTML content checks; they validate the semantic contract that identifiers and support artifacts advertise their Resource Pages.

Useful examples of what these checks protect:

- A designator has a Resource Page via `sflo:hasResourcePage`.
- A Knop or support artifact has its Resource Page registered.
- A ResourcePageDefinition has its artifact history and current history connected to its support page.
- Resource Pages are typed as `sflo:ResourcePage` and `sflo:LocatedFile` in generated RDF.

### 6. Non-HTML Content Checks In The Same Manifests

The manifests also contain strict checks for Turtle, Markdown, CSS, and other non-HTML files. Those are not the problem described here.

Examples worth keeping strict:

- `rdfCanonical` checks for inventory, metadata, references, payload RDF, and page-definition RDF.
- Exact text checks for Markdown source content backing customized pages.
- Exact checks for CSS assets when the scenario is specifically about preserving or versioning authored stylesheets.

These files are the source-of-truth material that Weave should preserve, version, inventory, or transform correctly. Weakening generated Resource Page HTML checks should not weaken source content checks.

## Page Category Breakdown

All 156 Resource Page expectations fall into these rough categories:

| Page Category | All HTML Expectations | Accord Content-Sensitive HTML Checks |
| --- | ---: | ---: |
| Knop page | 7 | 1 |
| KnopInventory support page | 32 | 8 |
| KnopMetadata support page | 16 | 2 |
| MeshInventory support page | 16 | 2 |
| MeshMetadata support page | 5 | 1 |
| Payload history/state/manifestation page | 22 | 3 |
| Payload or artifact current page | 13 | 2 |
| ReferenceCatalog support page | 10 | 1 |
| ResourcePageDefinition support page | 15 | 3 |
| Root identifier page | 4 | 2 |
| Top-level identifier page | 16 | 10 |

This breakdown shows that the exact checks are not limited to author-customizable public pages. They also cover generated support pages. The product question is therefore broader than "custom pages": do conformance manifests define a required generated HTML UI, or only require Resource Page existence and RDF registration?

## Checks Worth Keeping In Conformance

Keep these in conformance manifests:

- Resource Page presence expectations for files that should exist.
- Resource Page absence expectations for files that should not exist.
- RDF expectations involving `sflo:hasResourcePage`, `sflo:ResourcePage`, and `sflo:LocatedFile`.
- RDF/source content checks for page-definition artifacts and their latest ontology terms, especially `sflo:targetMeshPath` for ResourcePageDefinition sources.
- Exact content checks for authored source files such as Markdown and CSS when the scenario is about preserving, importing, or versioning those files.

Potentially keep a tiny number of generated HTML checks outside conformance:

- Renderer unit tests for escaping dynamic content.
- Renderer unit tests for canonical link generation.
- Renderer unit tests for relative link calculation.
- Renderer unit tests for customized page markdown rendering.

Those are implementation tests for Weave, not conformance contracts for arbitrary Resource Page content.

## Checks To Remove Or Reframe

Remove or reframe these from conformance manifests:

- Exact whole-file text comparisons for public identifier Resource Pages.
- Exact whole-file text comparisons for customized Resource Pages.
- Exact whole-file text comparisons for generated support Resource Pages unless the product explicitly wants Weave's current generated HTML as a conformance-level public contract.

Preferred replacement:

- Treat `changeType` as the transition-level presence contract. `added`, `updated`, `unchanged`, `removed`, and `absent` already encode whether the file should be present at `fromRef`, `toRef`, or both. Actual content equality/difference is a separate comparison concern.
- For `.html` Resource Page expectations, omit `compareMode` so Accord checks only the transition-level file presence.
- Keep `absent` expectations as-is.
- Keep RDF graph checks strict.
- Keep exact text checks for non-HTML source content.

The migration convention should be:

- Remove `compareMode: "text"` from every Resource Page `.html` `FileExpectation`.
- Keep the existing `changeType` values and paths.
- Keep `absent` Resource Page expectations as absence checks.
- Document that `.html` Resource Page expectations are path/presence contracts unless paired with a more specific future HTML assertion type. No such targeted HTML assertion type is needed for the current cleanup.

## Decisions

1. Conformance should not require exact generated HTML for support Resource Pages.

Support Resource Page checks should be path presence/absence plus RDF registration.

2. Conformance should not require exact generated HTML for public/custom identifier Resource Pages.

These pages are author-customizable, so exact headings, prose, layout, and generated wrapper markup are not conformance contracts.

3. Weave may keep exact renderer output tests only in narrow implementation-test cases.

Escaping, relative links, canonical links, markdown rendering, and required shell structure can be covered by focused unit tests if needed. This is optional for the current cleanup and should not be imported into cross-repo conformance manifests.

4. Accord does not need a new presence compare mode for this cleanup.

Accord already has presence semantics through `changeType`. The cleanup is manifest authorship: Resource Page `.html` expectations should not use `compareMode: "text"`.

## Proposed Follow-Up Work

- [x] Decide policy: Resource Page `.html` file expectations are not content contracts.
- [x] Migrate the Alice Bio conformance manifests by removing `compareMode: "text"` from every Resource Page `.html` `FileExpectation`.
- [x] Keep each Resource Page `.html` `path` and `changeType` intact so presence/absence expectations remain covered.
- [x] Keep RDF expectations involving `sflo:hasResourcePage`, `sflo:ResourcePage`, and `sflo:LocatedFile` strict.
- [x] Keep strict RDF canonical checks for ResourcePageDefinition artifacts and latest ontology terms.
- [x] Keep strict non-HTML source content checks for Markdown, CSS, Turtle, and other authored/source files.
- [x] Update SFF conformance manifest authoring guidance to say Resource Page `.html` expectations are presence/absence contracts, not exact text fixtures.
- [x] After migrated manifests are consumed by Weave, remove the local `.html` text-comparison special case if it is no longer needed.
- [x] Verify with Accord/SFF manifest checks and Weave e2e/full tests against the migrated manifests.

## Cleanup Progress

On 2026-05-02, the Alice Bio manifests were mechanically migrated so every Resource Page `.html` `FileExpectation` omits `compareMode`; 138 HTML text compare modes were removed. No sidecar fantasy conformance JSON-LD manifests exist yet, but its conformance README now carries the same Resource Page convention. Weave's local e2e harness no longer has a hard-coded `.html` skip; missing `compareMode` is now treated as presence-only for any manifest file expectation.

## Current State In Weave

Weave currently has a pragmatic local mitigation:

`tests/support/accord_manifest.ts`:

```ts
export function shouldCompareManifestTextFileContents(path: string): boolean {
  return !path.endsWith(".html");
}
```

This keeps Weave's e2e tests aligned with the decision: Resource Page manifests verify existence but do not require exact generated HTML content. It is still a local harness rule, not yet a cleaned-up conformance manifest contract.

## Deferred Question

If we later need conformance-level HTML semantics, add targeted assertions such as "contains canonical URL", "links to working file", or "includes source fragment anchor" rather than whole-file text snapshots. No such targeted HTML assertion type is needed for the current cleanup.
