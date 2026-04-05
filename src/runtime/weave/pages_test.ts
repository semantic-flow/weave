import { assertEquals } from "@std/assert";
import { renderResourcePage } from "./pages.ts";

Deno.test("renderResourcePage renders identifier pages with working file links", () => {
  assertEquals(
    renderResourcePage(
      "https://semantic-flow.github.io/mesh-alice-bio/",
      {
        kind: "identifier",
        path: "alice/bio/index.html",
        designatorPath: "alice/bio",
        workingFilePath: "alice-bio.ttl",
      },
    ),
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>mesh-alice-bio alice/bio</title>
  <link rel="canonical" href="https://semantic-flow.github.io/mesh-alice-bio/alice/bio">
</head>
<body>
  <main>
    <h1><strong>alice/bio</strong></h1>
    <p>Resource page for the Semantic Flow identifier <a href="https://semantic-flow.github.io/mesh-alice-bio/alice/bio">https://semantic-flow.github.io/mesh-alice-bio/alice/bio</a>.</p>
  </main>
  <footer>
    <small>The Semantic Flow identifier <a href="https://semantic-flow.github.io/mesh-alice-bio/alice/bio">https://semantic-flow.github.io/mesh-alice-bio/alice/bio</a> has an associated Knop at <a href="./_knop">./_knop</a> and currently uses the working RDF file <a href="../../alice-bio.ttl">../../alice-bio.ttl</a>.</small>
  </footer>
</body>
</html>
`,
  );
});

Deno.test("renderResourcePage renders current ReferenceCatalog pages with fragment anchors", () => {
  assertEquals(
    renderResourcePage(
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
    ),
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>mesh-alice-bio alice/_knop/_references</title>
  <link rel="canonical" href="https://semantic-flow.github.io/mesh-alice-bio/alice/_knop/_references">
</head>
<body>
  <main>
    <h1>alice/_knop/_references</h1>
    <p>Resource page for the alice ReferenceCatalog artifact.</p>
    <section>
      <h2>Current Links</h2>
      <ul>
        <li id="reference001"><code>#reference001</code>: canonical reference target <code>alice/bio</code>.</li>
      </ul>
    </section>
  </main>
</body>
</html>
`,
  );
});

Deno.test("renderResourcePage escapes dynamic ReferenceCatalog HTML fragments", () => {
  assertEquals(
    renderResourcePage(
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
    ),
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>mesh-alice-bio alice/_knop/_references</title>
  <link rel="canonical" href="https://semantic-flow.github.io/mesh-alice-bio/alice/_knop/_references">
</head>
<body>
  <main>
    <h1>alice/_knop/_references&lt;&amp;&quot;&gt;</h1>
    <p>Resource page for the alice &amp; &quot;bob&quot; ReferenceCatalog artifact.</p>
    <section>
      <h2>Current Links</h2>
      <ul>
        <li id="reference&amp;&lt;&gt;&quot;&#39;001"><code>#reference&amp;&lt;&gt;&quot;&#39;001</code>: canonical &amp; &lt;primary&gt; &quot;role&quot; reference target <code>alice/bio?x=&lt;y&gt;&amp;z=&quot;1&quot;</code>.</li>
      </ul>
    </section>
  </main>
</body>
</html>
`,
  );
});
