import { assertEquals, assertStringIncludes } from "@std/assert";
import { renderResourcePage } from "./pages.ts";

Deno.test("renderResourcePage renders identifier pages with working file links", () => {
  const html = renderResourcePage(
    "https://semantic-flow.github.io/mesh-alice-bio/",
    {
      kind: "identifier",
      path: "alice/bio/index.html",
      designatorPath: "alice/bio",
      workingLocalRelativePath: "alice-bio.ttl",
    },
  );

  assertStringIncludes(html, "<title>mesh-alice-bio alice/bio</title>");
  assertStringIncludes(html, "<h1>alice/bio</h1>");
  assertStringIncludes(html, 'href="/mesh-alice-bio/alice-bio.ttl"');
  assertStringIncludes(html, 'href="/mesh-alice-bio/alice/bio/_knop"');
});

Deno.test("renderResourcePage renders the root identifier as slash", () => {
  const html = renderResourcePage(
    "https://semantic-flow.github.io/mesh-alice-bio/",
    {
      kind: "identifier",
      path: "index.html",
      designatorPath: "",
      workingLocalRelativePath: "root.ttl",
    },
  );

  assertStringIncludes(html, "<title>mesh-alice-bio /</title>");
  assertStringIncludes(html, "<h1>/</h1>");
  assertStringIncludes(html, 'href="/mesh-alice-bio/root.ttl"');
});

Deno.test("renderResourcePage renders current ReferenceCatalog pages with fragment anchors", () => {
  const html = renderResourcePage(
    "https://semantic-flow.github.io/mesh-alice-bio/",
    {
      kind: "referenceCatalog",
      path: "alice/_knop/_references/index.html",
      catalogPath: "alice/_knop/_references",
      ownerDesignatorPath: "alice",
      currentLinks: [{
        fragment: "reference001",
        referenceRoleLabel: "canonical",
        referenceTargetPath: "alice/bio",
      }],
    },
  );

  assertStringIncludes(html, "<h1>alice/_knop/_references</h1>");
  assertStringIncludes(html, "<h2>Current Links</h2>");
  assertStringIncludes(
    html,
    '<li id="reference001"><code>#reference001</code>: canonical reference target <code>alice/bio</code>.</li>',
  );
});

Deno.test("renderResourcePage escapes dynamic ReferenceCatalog HTML fragments", () => {
  const html = renderResourcePage(
    "https://semantic-flow.github.io/mesh-alice-bio/",
    {
      kind: "referenceCatalog",
      path: "alice/_knop/_references/index.html",
      catalogPath: 'alice/_knop/_references<&">',
      ownerDesignatorPath: 'alice & "bob"',
      currentLinks: [{
        fragment: "reference&<>\"'001",
        referenceRoleLabel: 'canonical & <primary> "role"',
        referenceTargetPath: 'alice/bio?x=<y>&z="1"',
      }],
    },
  );

  assertStringIncludes(html, "alice/_knop/_references&lt;&amp;&quot;&gt;");
  assertStringIncludes(html, "alice &amp; &quot;bob&quot;");
  assertStringIncludes(
    html,
    "canonical &amp; &lt;primary&gt; &quot;role&quot;",
  );
  assertStringIncludes(html, "alice/bio?x=&lt;y&gt;&amp;z=&quot;1&quot;");
});

Deno.test("renderResourcePage renders extracted ReferenceCatalog pages pinned to a historical state", () => {
  const html = renderResourcePage(
    "https://semantic-flow.github.io/mesh-alice-bio/",
    {
      kind: "referenceCatalog",
      path: "bob/_knop/_references/index.html",
      catalogPath: "bob/_knop/_references",
      ownerDesignatorPath: "bob",
      currentLinks: [{
        fragment: "reference001",
        referenceRoleLabel: "supplemental",
        referenceTargetPath: "alice/bio",
        referenceTargetStatePath: "alice/bio/_history001/_s0002",
      }],
    },
  );

  assertStringIncludes(
    html,
    '<a href="/mesh-alice-bio/alice/bio">alice/bio</a>',
  );
  assertStringIncludes(
    html,
    '<a href="/mesh-alice-bio/alice/bio/_history001/_s0002">/mesh-alice-bio/alice/bio/_history001/_s0002</a>',
  );
});

Deno.test("renderResourcePage renders pinned root ReferenceCatalog targets as slash", () => {
  const html = renderResourcePage(
    "https://semantic-flow.github.io/mesh-alice-bio/",
    {
      kind: "referenceCatalog",
      path: "alice/bio/_knop/_references/index.html",
      catalogPath: "alice/bio/_knop/_references",
      ownerDesignatorPath: "alice/bio",
      currentLinks: [{
        fragment: "reference001",
        referenceRoleLabel: "supplemental",
        referenceTargetPath: "",
        referenceTargetStatePath: "_history001/_s0001",
      }],
    },
  );

  assertStringIncludes(html, '<a href="/mesh-alice-bio/">/</a>');
  assertStringIncludes(
    html,
    '<a href="/mesh-alice-bio/_history001/_s0001">/mesh-alice-bio/_history001/_s0001</a>',
  );
});

Deno.test("renderResourcePage renders escaped raw RDF panels and raw file links", () => {
  const html = renderResourcePage(
    "https://semantic-flow.github.io/mesh-alice-bio/",
    {
      kind: "identifier",
      path: "alice/bio/index.html",
      designatorPath: "alice/bio",
      rawSourcePanels: [{
        label: "Current working RDF bytes",
        sourcePath: "alice-bio.ttl",
        contents: '<alice> <knows> "Bob & Alice" .',
      }],
    },
  );

  assertStringIncludes(html, "<h2>Raw RDF Source</h2>");
  assertStringIncludes(
    html,
    '<a href="/mesh-alice-bio/alice-bio.ttl">Raw file</a>',
  );
  assertStringIncludes(
    html,
    "pre code { display: block; background: transparent; color: inherit;",
  );
  assertStringIncludes(
    html,
    "&lt;alice&gt; &lt;knows&gt; &quot;Bob &amp; Alice&quot; .",
  );
});

Deno.test("renderResourcePage does not link extra-mesh local source paths", () => {
  const html = renderResourcePage(
    "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
    {
      kind: "identifier",
      path: "ontology/index.html",
      designatorPath: "ontology",
      workingLocalRelativePath: "../ontology/fantasy-rules-ontology.ttl",
      rawSourcePanels: [{
        label: "Current working RDF bytes",
        sourcePath: "../ontology/fantasy-rules-ontology.ttl",
        contents: "<ontology> a <Ontology> .",
      }],
    },
  );

  assertStringIncludes(
    html,
    'href="/mesh-sidecar-fantasy-rules/ontology/_knop"',
  );
  assertStringIncludes(
    html,
    '<tr><th scope="row">Working File</th><td><span>../ontology/fantasy-rules-ontology.ttl</span></td></tr>',
  );
  assertStringIncludes(html, "Local source outside mesh root");
});

Deno.test("renderResourcePage renders RDF description, classes, and histories", () => {
  const html = renderResourcePage(
    "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
    {
      kind: "identifier",
      path: "ontology/index.html",
      designatorPath: "ontology",
      workingLocalRelativePath: "../ontology/fantasy-rules-ontology.ttl",
      historyGroups: [{
        label: "Artifact history",
        path: "ontology/_history001",
        states: [{
          path: "ontology/_history001/_s0001",
          locatedFilePath:
            "ontology/_history001/_s0001/fantasy-rules-ontology-ttl/fantasy-rules-ontology.ttl",
        }],
      }],
      rawSourcePanels: [{
        label: "Current working RDF bytes",
        sourcePath: "../ontology/fantasy-rules-ontology.ttl",
        contents: `@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .

<ontology> a owl:Ontology ;
  dcterms:title "Fantasy Rules Ontology" ;
  dcterms:description "A small ontology fixture." .
`,
      }],
    },
  );

  assertStringIncludes(html, "<h1>Fantasy Rules Ontology</h1>");
  assertStringIncludes(html, "A small ontology fixture.");
  assertStringIncludes(html, '<p class="wf-classes">owl:Ontology</p>');
  assertStringIncludes(html, "<summary>Histories</summary>");
  assertStringIncludes(
    html,
    'href="/mesh-sidecar-fantasy-rules/ontology/_history001/_s0001"',
  );
  assertStringIncludes(
    html,
    'href="/mesh-sidecar-fantasy-rules/ontology/_history001/_s0001/fantasy-rules-ontology-ttl/fantasy-rules-ontology.ttl"',
  );
});

Deno.test("renderResourcePage renders customized identifier pages from mesh-local regions", () => {
  assertEquals(
    renderResourcePage(
      "https://semantic-flow.github.io/mesh-alice-bio/",
      {
        kind: "customIdentifier",
        path: "alice/index.html",
        designatorPath: "alice",
        definitionPath: "alice/_knop/_page",
        stylesheetPaths: ["alice/_knop/_assets/alice.css"],
        regions: [
          {
            key: "main",
            sourcePath: "alice/alice.md",
            markdown: `# Alice

This customized identifier page is driven by \`alice/_knop/_page/page.ttl\`.

Alice's integrated biography is available at [./bio](./bio), and the extracted Bob resource is available at [../bob](../bob).
`,
          },
          {
            key: "sidebar",
            sourcePath: "mesh-content/sidebar.md",
            markdown: `## Quick links

- [Alice Knop](./_knop)
- [Alice bio](./bio)
- [Bob](../bob)
`,
          },
        ],
      },
    ),
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>mesh-alice-bio alice</title>
  <link rel="canonical" href="https://semantic-flow.github.io/mesh-alice-bio/alice">
  <link rel="stylesheet" href="./_knop/_assets/alice.css">
</head>
<body class="alice-custom-page">
  <main class="alice-layout">
    <article class="alice-main">
      <h1>Alice</h1>
      <p>This customized identifier page is driven by <code>alice/_knop/_page/page.ttl</code>.</p>
      <p>Alice's integrated biography is available at <a href="./bio">./bio</a>, and the extracted Bob resource is available at <a href="../bob">../bob</a>.</p>
    </article>
    <aside class="alice-sidebar">
      <h2>Quick links</h2>
      <ul>
        <li><a href="./_knop">Alice Knop</a></li>
        <li><a href="./bio">Alice bio</a></li>
        <li><a href="../bob">Bob</a></li>
      </ul>
    </aside>

  </main>
  <footer>
    <small>The Semantic Flow identifier <a href="https://semantic-flow.github.io/mesh-alice-bio/alice">https://semantic-flow.github.io/mesh-alice-bio/alice</a> is currently rendered from the page-definition support artifact at <a href="./_knop/_page">./_knop/_page</a>.</small>
  </footer>
</body>
</html>
`,
  );
});
