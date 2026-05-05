import { assertEquals, assertFalse, assertStringIncludes } from "@std/assert";
import { renderResourcePage } from "./pages.ts";

Deno.test("renderResourcePage renders identifier pages with working file links", async () => {
  const html = await renderResourcePage(
    "https://semantic-flow.github.io/mesh-alice-bio/",
    {
      kind: "identifier",
      path: "alice/bio/index.html",
      designatorPath: "alice/bio",
      workingLocalRelativePath: "alice-bio.ttl",
    },
  );

  assertStringIncludes(html, "<title>mesh-alice-bio bio</title>");
  assertStringIncludes(html, "<h1>bio</h1>");
  assertStringIncludes(
    html,
    '<link rel="canonical" href="https://semantic-flow.github.io/mesh-alice-bio/alice/bio">',
  );
  assertStringIncludes(
    html,
    '<a class="wf-knop-link" href="/mesh-alice-bio/alice/bio/_knop" title="Knop" aria-label="Knop">🪢</a>',
  );
  assertFalse(html.includes("Associated Knop"));
  assertStringIncludes(html, 'href="/mesh-alice-bio/alice-bio.ttl"');
  assertStringIncludes(html, 'href="/mesh-alice-bio/alice/bio/_knop"');
});

Deno.test("renderResourcePage renders identifier extraction source metadata", async () => {
  const html = await renderResourcePage(
    "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
    {
      kind: "identifier",
      path: "ontology/AbilityScore/index.html",
      designatorPath: "ontology/AbilityScore",
      extractionSource: {
        sourceArtifactPath: "ontology",
        artifactResolutionModeIri:
          "https://semantic-flow.github.io/ontology/core/ArtifactResolutionMode/Current",
      },
    },
  );

  assertStringIncludes(
    html,
    '<tr><th scope="row">Extraction Source</th><td><a href="/mesh-sidecar-fantasy-rules/ontology">ontology</a></td></tr>',
  );
  assertStringIncludes(
    html,
    '<tr><th scope="row">Extraction Source Mode</th><td><a href="https://semantic-flow.github.io/ontology/core/ArtifactResolutionMode/Current">sflo:ArtifactResolutionMode/Current</a></td></tr>',
  );
});

Deno.test("renderResourcePage renders nested identifier fallback titles locally", async () => {
  const html = await renderResourcePage(
    "https://semantic-flow.github.io/mesh-alice-bio/",
    {
      kind: "identifier",
      path: "alice/page-main/index.html",
      designatorPath: "alice/page-main",
      workingLocalRelativePath: "alice-page-main.md",
    },
  );

  assertStringIncludes(html, "<title>mesh-alice-bio page-main</title>");
  assertStringIncludes(html, "<h1>page-main</h1>");
  assertStringIncludes(html, 'href="/mesh-alice-bio/alice"');
  assertStringIncludes(html, '<span aria-current="page">page-main</span>');
  assertStringIncludes(html, 'href="/mesh-alice-bio/alice/page-main/_knop"');
});

Deno.test("renderResourcePage renders the root identifier with the mesh label title", async () => {
  const html = await renderResourcePage(
    "https://semantic-flow.github.io/mesh-alice-bio/",
    {
      kind: "identifier",
      path: "index.html",
      designatorPath: "",
      workingLocalRelativePath: "root.ttl",
    },
  );

  assertStringIncludes(html, "<title>mesh-alice-bio</title>");
  assertStringIncludes(html, "<h1>mesh-alice-bio</h1>");
  assertStringIncludes(
    html,
    '<link rel="canonical" href="https://semantic-flow.github.io/mesh-alice-bio">',
  );
  assertFalse(
    html.includes(
      '<link rel="canonical" href="https://semantic-flow.github.io/mesh-alice-bio/">',
    ),
  );
  assertStringIncludes(
    html,
    `const canonicalLink = document.querySelector('link[rel="canonical"]');`,
  );
  assertStringIncludes(
    html,
    `location.pathname.endsWith("/") && !location.search && !location.hash`,
  );
  assertStringIncludes(
    html,
    `canonicalUrl.pathname === location.pathname.slice(0, -1)`,
  );
  assertStringIncludes(
    html,
    `history.replaceState(null, "", canonicalUrl.pathname);`,
  );
  assertStringIncludes(html, 'href="/mesh-alice-bio/root.ttl"');
});

Deno.test("renderResourcePage renders child identifier pills", async () => {
  const html = await renderResourcePage(
    "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
    {
      kind: "identifier",
      path: "ontology/index.html",
      designatorPath: "ontology",
      childIdentifiers: [
        { label: "AbilityScore", path: "ontology/AbilityScore" },
        { label: "Character", path: "ontology/Character" },
      ],
    },
  );

  assertStringIncludes(html, "Child Identifiers");
  assertStringIncludes(
    html,
    '<span class="wf-child-identifiers"><nobr><a class="wf-child-identifier" href="/mesh-sidecar-fantasy-rules/ontology/AbilityScore">AbilityScore</a></nobr><nobr><a class="wf-child-identifier" href="/mesh-sidecar-fantasy-rules/ontology/Character">Character</a></nobr></span>',
  );
});

Deno.test("renderResourcePage renders current ReferenceCatalog pages with fragment anchors", async () => {
  const html = await renderResourcePage(
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

  assertStringIncludes(html, "<h1>_references</h1>");
  assertStringIncludes(html, "<h2>Current Links</h2>");
  assertStringIncludes(
    html,
    '<li id="reference001"><code>#reference001</code>: canonical reference target <code>alice/bio</code>.</li>',
  );
});

Deno.test("renderResourcePage escapes dynamic ReferenceCatalog HTML fragments", async () => {
  const html = await renderResourcePage(
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

  assertStringIncludes(html, "_references&lt;&amp;&quot;&gt;");
  assertStringIncludes(html, "alice &amp; &quot;bob&quot;");
  assertStringIncludes(
    html,
    "canonical &amp; &lt;primary&gt; &quot;role&quot;",
  );
  assertStringIncludes(html, "alice/bio?x=&lt;y&gt;&amp;z=&quot;1&quot;");
});

Deno.test("renderResourcePage renders extracted ReferenceCatalog pages pinned to a historical state", async () => {
  const html = await renderResourcePage(
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

Deno.test("renderResourcePage renders pinned root ReferenceCatalog targets as slashless root links with mesh labels", async () => {
  const html = await renderResourcePage(
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

  assertStringIncludes(html, '<a href="/mesh-alice-bio">mesh-alice-bio</a>');
  assertStringIncludes(
    html,
    '<a href="/mesh-alice-bio/_history001/_s0001">/mesh-alice-bio/_history001/_s0001</a>',
  );
});

Deno.test("renderResourcePage renders Knop pages with local titles", async () => {
  const html = await renderResourcePage(
    "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
    {
      kind: "knop",
      path: "ontology/_knop/index.html",
      designatorPath: "ontology",
      ownerTitle: "Fantasy Rules Ontology",
      governedArtifacts: [],
      supportingArtifacts: [],
      childIdentifiers: [
        { label: "_inventory", path: "ontology/_knop/_inventory" },
        { label: "_meta", path: "ontology/_knop/_meta" },
        { label: "_page", path: "ontology/_knop/_page" },
      ],
    },
  );

  assertStringIncludes(
    html,
    "<title>mesh-sidecar-fantasy-rules _knop</title>",
  );
  assertStringIncludes(html, "<h1>_knop</h1>");
  assertStringIncludes(
    html,
    "Semantic Flow bundle of supporting data for Fantasy Rules Ontology.",
  );
  assertStringIncludes(
    html,
    'href="/mesh-sidecar-fantasy-rules/ontology"',
  );
  assertStringIncludes(html, '<span aria-current="page">_knop</span>');
  assertStringIncludes(html, "Child Identifiers");
  assertStringIncludes(
    html,
    '<nobr><a class="wf-child-identifier" href="/mesh-sidecar-fantasy-rules/ontology/_knop/_inventory">_inventory</a></nobr>',
  );
  assertStringIncludes(
    html,
    '<nobr><a class="wf-child-identifier" href="/mesh-sidecar-fantasy-rules/ontology/_knop/_meta">_meta</a></nobr>',
  );
});

Deno.test("renderResourcePage renders escaped raw RDF panels and raw file links", async () => {
  const html = await renderResourcePage(
    "https://semantic-flow.github.io/mesh-alice-bio/",
    {
      kind: "identifier",
      path: "alice/bio/index.html",
      designatorPath: "alice/bio",
      workingLocalRelativePath: "alice-bio.ttl",
      rawSourcePanels: [{
        label: "Current working file",
        sourcePath: "alice-bio.ttl",
        contents: '<alice> <knows> "Bob & Alice" .',
      }],
    },
  );

  assertStringIncludes(html, "<summary>Current working file</summary>");
  assertStringIncludes(
    html,
    '<a href="/mesh-alice-bio/alice-bio.ttl">Raw file</a>',
  );
  assertStringIncludes(
    html,
    ".wf-shell { display: grid; gap: 18px; min-width: 0; }",
  );
  assertStringIncludes(
    html,
    "pre { margin: 0; width: 100%; max-width: 100%; max-height: 64vh; overflow: auto;",
  );
  assertStringIncludes(
    html,
    "white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word;",
  );
  assertStringIncludes(
    html,
    "pre code { display: block; min-width: 0; background: transparent; color: inherit; border-radius: 0; padding: 0; white-space: inherit; overflow-wrap: inherit; word-break: inherit;",
  );
  assertStringIncludes(html, '<pre class="shiki github-dark-default"');
  assertFalse(
    html.includes('\n        <span class="line"'),
    "Shiki source lines should not include template indentation that renders inside pre-wrap blocks.",
  );
  assertStringIncludes(
    html,
    "&#x3C;alice>",
  );
});

Deno.test("renderResourcePage renders inventory fragment sections for ExtractionSource", async () => {
  const html = await renderResourcePage(
    "https://semantic-flow.github.io/mesh-alice-bio/",
    {
      kind: "simple",
      path: "bob/_knop/_inventory/index.html",
      description: "Generated resource page.",
      rawSourcePanels: [{
        label: "Current KnopInventory file",
        sourcePath: "bob/_knop/_inventory/inventory.ttl",
        contents: `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sfc: <https://semantic-flow.github.io/ontology/core/> .

<bob/_knop/_inventory#extraction-source> a sfc:ExtractionSource ;
  sfc:hasTargetArtifact <alice/bio> ;
  sfc:hasRequestedTargetState <alice/bio/_history001/_s0002> ;
  sfc:hasArtifactResolutionMode <https://semantic-flow.github.io/ontology/core/ArtifactResolutionMode/Pinned> .
`,
      }],
    },
  );

  assertStringIncludes(
    html,
    '<section class="wf-section" id="extraction-source">',
  );
  assertStringIncludes(html, "<h2>Extraction Source</h2>");
  assertStringIncludes(html, 'href="/mesh-alice-bio/alice/bio"');
  assertStringIncludes(
    html,
    'href="/mesh-alice-bio/alice/bio/_history001/_s0002"',
  );
  assertStringIncludes(html, "sflo:ArtifactResolutionMode/Pinned");
});

Deno.test("renderResourcePage does not link extra-mesh local source paths", async () => {
  const html = await renderResourcePage(
    "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
    {
      kind: "identifier",
      path: "ontology/index.html",
      designatorPath: "ontology",
      workingLocalRelativePath: "../ontology/fantasy-rules-ontology.ttl",
      rawSourcePanels: [{
        label: "Current working file",
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

Deno.test("renderResourcePage renders RDF description, classes, and histories", async () => {
  const html = await renderResourcePage(
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
          manifestationPath:
            "ontology/_history001/_s0001/fantasy-rules-ontology-ttl",
          locatedFilePath:
            "ontology/_history001/_s0001/fantasy-rules-ontology-ttl/fantasy-rules-ontology.ttl",
        }],
      }],
      rawSourcePanels: [{
        label: "Current working file",
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
  assertStringIncludes(
    html,
    '<p class="wf-classes">a <a href="http://www.w3.org/2002/07/owl#Ontology">owl:Ontology</a></p>',
  );
  assertStringIncludes(html, "<summary>History</summary>");
  assertStringIncludes(html, "sflo:ArtifactHistory");
  assertStringIncludes(html, "sflo:HistoricalState");
  assertStringIncludes(html, "sflo:ArtifactManifestation");
  assertStringIncludes(html, "sflo:LocatedFile");
  assertStringIncludes(
    html,
    'href="/mesh-sidecar-fantasy-rules/ontology/_history001/_s0001"',
  );
  assertStringIncludes(
    html,
    'href="/mesh-sidecar-fantasy-rules/ontology/_history001/_s0001/fantasy-rules-ontology-ttl"',
  );
  assertStringIncludes(
    html,
    'href="/mesh-sidecar-fantasy-rules/ontology/_history001/_s0001/fantasy-rules-ontology-ttl/fantasy-rules-ontology.ttl"',
  );
});

Deno.test("renderResourcePage truncates long history group lists", async () => {
  const historyGroups = Array.from({ length: 12 }, (_, index) => {
    const historySegment = `_history${String(index + 1).padStart(3, "0")}`;
    return {
      label: "Artifact history",
      path: `ontology/${historySegment}`,
      states: [],
    };
  });

  const html = await renderResourcePage(
    "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
    {
      kind: "identifier",
      path: "ontology/index.html",
      designatorPath: "ontology",
      historyGroups,
    },
  );

  assertStringIncludes(html, "wf-history-gap");
  assertStringIncludes(html, 'aria-label="3 history items omitted"');
  assertStringIncludes(html, ">⋮</div>");
  assertStringIncludes(html, "ontology/_history001");
  assertStringIncludes(html, "ontology/_history002");
  assertFalse(html.includes("ontology/_history003"));
  assertFalse(html.includes("ontology/_history005"));
  assertStringIncludes(html, "ontology/_history006");
  assertStringIncludes(html, "ontology/_history012");
});

Deno.test("renderResourcePage truncates long historical state lists", async () => {
  const states = Array.from({ length: 12 }, (_, index) => {
    const stateSegment = `_s${String(index + 1).padStart(4, "0")}`;
    const statePath = `ontology/_history001/${stateSegment}`;
    return {
      path: statePath,
      manifestationPath: `${statePath}/ttl`,
      locatedFilePath: `${statePath}/ttl/fantasy-rules-ontology.ttl`,
    };
  });

  const html = await renderResourcePage(
    "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
    {
      kind: "simple",
      path: "ontology/_history001/index.html",
      description: "Generated resource page.",
      historyGroups: [{
        label: "Artifact history",
        path: "ontology/_history001",
        states,
      }],
    },
  );

  assertStringIncludes(html, "<summary>Historical States</summary>");
  assertStringIncludes(html, 'aria-label="3 history items omitted"');
  assertStringIncludes(html, ">⋮</div>");
  assertStringIncludes(html, "ontology/_history001/_s0001");
  assertStringIncludes(html, "ontology/_history001/_s0002");
  assertFalse(html.includes("ontology/_history001/_s0003"));
  assertFalse(html.includes("ontology/_history001/_s0005"));
  assertStringIncludes(html, "ontology/_history001/_s0006");
  assertStringIncludes(html, "ontology/_history001/_s0012");
});

Deno.test("renderResourcePage compacts SHACL classes with the sh prefix", async () => {
  const html = await renderResourcePage(
    "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
    {
      kind: "identifier",
      path: "shacl/index.html",
      designatorPath: "shacl",
      rawSourcePanels: [{
        label: "Current working file",
        sourcePath: "../shacl/fantasy-rules-shacl.ttl",
        contents: `@prefix sh: <http://www.w3.org/ns/shacl#> .

<shacl> a sh:ShapesGraph .
`,
      }],
    },
  );

  assertStringIncludes(
    html,
    '<p class="wf-classes">a <a href="http://www.w3.org/ns/shacl#ShapesGraph">sh:ShapesGraph</a></p>',
  );
});

Deno.test("renderResourcePage renders term facts from a different source artifact namespace", async () => {
  const html = await renderResourcePage(
    "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
    {
      kind: "identifier",
      path: "ontology/CharacterShape/index.html",
      designatorPath: "ontology/CharacterShape",
      rawSourcePanels: [{
        label: "Pinned source file",
        sourcePath:
          "shacl/_history001/_s0001/fantasy-rules-shacl-ttl/fantasy-rules-shacl.ttl",
        contents:
          `@prefix fant: <https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/ontology/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix sh: <http://www.w3.org/ns/shacl#> .

fant:CharacterShape a sh:NodeShape ;
  rdfs:label "Character shape" ;
  rdfs:comment "Validates character data." ;
  sh:targetClass fant:Character .
`,
      }],
    },
  );

  assertStringIncludes(html, "<h1>Character shape</h1>");
  assertStringIncludes(html, "Validates character data.");
  assertStringIncludes(
    html,
    '<p class="wf-classes">a <a href="http://www.w3.org/ns/shacl#NodeShape">sh:NodeShape</a></p>',
  );
  assertFalse(
    html.includes("Pinned source file"),
    "extracted identifier pages should use source RDF for facts without embedding the full source file panel.",
  );
  assertFalse(
    html.includes(
      'href="/mesh-sidecar-fantasy-rules/shacl/_history001/_s0001/fantasy-rules-shacl-ttl/fantasy-rules-shacl.ttl"',
    ),
    "extracted identifier pages should not display raw source file links.",
  );
});

Deno.test("renderResourcePage scopes history component sections to the current layer", async () => {
  const historyGroup = {
    label: "Artifact history",
    path: "ontology/_history001",
    states: [{
      path: "ontology/_history001/_s0001",
      manifestationPath:
        "ontology/_history001/_s0001/fantasy-rules-ontology-ttl",
      locatedFilePath:
        "ontology/_history001/_s0001/fantasy-rules-ontology-ttl/fantasy-rules-ontology.ttl",
    }],
  };
  const historyHtml = await renderResourcePage(
    "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
    {
      kind: "simple",
      path: "ontology/_history001/index.html",
      description: "Generated resource page.",
      historyGroups: [historyGroup],
    },
  );
  const stateHtml = await renderResourcePage(
    "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
    {
      kind: "simple",
      path: "ontology/_history001/_s0001/index.html",
      description: "Generated resource page.",
      historyGroups: [historyGroup],
    },
  );
  const manifestationHtml = await renderResourcePage(
    "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
    {
      kind: "simple",
      path: "ontology/_history001/_s0001/fantasy-rules-ontology-ttl/index.html",
      description: "Generated resource page.",
      historyGroups: [historyGroup],
    },
  );

  assertStringIncludes(historyHtml, "<h1>_history001</h1>");
  assertStringIncludes(
    historyHtml,
    '<a href="/mesh-sidecar-fantasy-rules/ontology">ontology</a>',
  );
  assertStringIncludes(
    historyHtml,
    '<span aria-current="page">_history001</span>',
  );
  assertStringIncludes(historyHtml, "<summary>Historical States</summary>");
  assertStringIncludes(historyHtml, "sflo:HistoricalState");
  assertEquals(
    historyHtml.includes(
      '<a href="/mesh-sidecar-fantasy-rules/ontology/_history001">ontology/_history001</a>',
    ),
    false,
  );
  assertStringIncludes(stateHtml, "<summary>Manifestations</summary>");
  assertStringIncludes(stateHtml, "sflo:ArtifactManifestation");
  assertEquals(stateHtml.includes("sflo:HistoricalState"), true);
  assertStringIncludes(manifestationHtml, "<summary>Located Files</summary>");
  assertStringIncludes(manifestationHtml, "sflo:LocatedFile");
  assertEquals(manifestationHtml.includes("sflo:ArtifactManifestation"), true);
});

Deno.test("renderResourcePage renders Knop artifact links without history cake", async () => {
  const html = await renderResourcePage(
    "https://semantic-flow.github.io/mesh-alice-bio/",
    {
      kind: "knop",
      path: "alice/_knop/index.html",
      designatorPath: "alice",
      governedArtifacts: [{
        label: "PayloadArtifact",
        path: "alice/bio",
      }],
      supportingArtifacts: [
        {
          label: "KnopMetadata",
          path: "alice/_knop/_meta",
        },
        {
          label: "KnopInventory",
          path: "alice/_knop/_inventory",
        },
      ],
    },
  );

  assertStringIncludes(html, "<h1>_knop</h1>");
  assertStringIncludes(
    html,
    "Semantic Flow bundle of supporting data for alice.",
  );
  assertStringIncludes(html, "<h2>Governed Artifacts</h2>");
  assertStringIncludes(html, "PayloadArtifact");
  assertStringIncludes(html, 'href="/mesh-alice-bio/alice/bio"');
  assertStringIncludes(html, "<h2>Supporting Artifacts</h2>");
  assertStringIncludes(html, 'href="/mesh-alice-bio/alice/_knop/_meta"');
  assertStringIncludes(html, 'href="/mesh-alice-bio/alice/_knop/_inventory"');
  assertEquals(html.includes("<summary>History</summary>"), false);
  assertEquals(html.includes("sflo:ArtifactHistory"), false);
});

Deno.test("renderResourcePage renders customized identifier pages from mesh-local regions", async () => {
  assertEquals(
    await renderResourcePage(
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
