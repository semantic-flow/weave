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
