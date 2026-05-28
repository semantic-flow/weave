import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import { DEFAULT_RESOURCE_PAGE_PRESENTATION_PROFILE } from "../config/effective_config.ts";
import type { OperationalLocalPathPolicy } from "../operational/local_path_policy.ts";
import {
  loadActiveCustomIdentifierPage,
  ResourcePageDefinitionResolutionError,
} from "./page_definition.ts";

const MESH_BASE = "https://semantic-flow.github.io/mesh-alice-bio/";
const SFLO = "https://semantic-flow.github.io/sflo/ontology/";

Deno.test("loadActiveCustomIdentifierPage resolves authored regions without direct presentation config", async () => {
  await withPageDefinitionFixture(async ({ meshRoot, policy }) => {
    const page = await loadActiveCustomIdentifierPage(
      meshRoot,
      policy,
      MESH_BASE,
      "alice",
      {
        artifactPath: "alice/_knop/_page",
        workingLocalRelativePath: "alice/_knop/_page/page.ttl",
        currentPageDefinitionTurtle: pageDefinitionTurtle(),
        currentArtifactHistoryExists: true,
      },
    );

    assertEquals(page?.presentationConfigIri, undefined);
    assertEquals(page?.generatedPanelSelectionIris, []);
    assertEquals(page?.regions[0]?.markdown, "# Alice\n");
  });
});

Deno.test("loadActiveCustomIdentifierPage resolves current-only ResourcePageDefinitions", async () => {
  await withPageDefinitionFixture(async ({ meshRoot, policy }) => {
    const page = await loadActiveCustomIdentifierPage(
      meshRoot,
      policy,
      MESH_BASE,
      "alice",
      {
        artifactPath: "alice/_knop/_page",
        workingLocalRelativePath: "alice/_knop/_page/page.ttl",
        currentPageDefinitionTurtle: pageDefinitionTurtle(),
        currentArtifactHistoryExists: false,
      },
    );

    assertEquals(page?.definitionPath, "alice/_knop/_page");
    assertEquals(page?.regions[0]?.markdown, "# Alice\n");
  });
});

Deno.test("loadActiveCustomIdentifierPage resolves explicit generated ResourcePage panel selections", async () => {
  await withPageDefinitionFixture(async ({ meshRoot, policy }) => {
    const rawSourcePanelSelectionIri =
      DEFAULT_RESOURCE_PAGE_PRESENTATION_PROFILE.panelSelections.find((
        selection,
      ) => selection.panel === "rawSource")!.iri;
    const page = await loadActiveCustomIdentifierPage(
      meshRoot,
      policy,
      MESH_BASE,
      "alice",
      {
        artifactPath: "alice/_knop/_page",
        workingLocalRelativePath: "alice/_knop/_page/page.ttl",
        currentPageDefinitionTurtle: pageDefinitionTurtle(
          rawSourcePanelSelectionIri,
        ),
        currentArtifactHistoryExists: true,
      },
    );

    assertEquals(page?.generatedPanelSelectionIris, [
      rawSourcePanelSelectionIri,
    ]);
  });
});

Deno.test("loadActiveCustomIdentifierPage resolves exact payload state page sources", async () => {
  await withPageDefinitionFixture(async ({ meshRoot, policy }) => {
    await materializePayloadArtifact(meshRoot);
    await Deno.writeTextFile(
      join(meshRoot, "alice/_history001/_s0001/md/source.md"),
      "# Exact Alice\n",
    );

    const page = await loadActiveCustomIdentifierPage(
      meshRoot,
      policy,
      MESH_BASE,
      "alice",
      {
        artifactPath: "alice/_knop/_page",
        workingLocalRelativePath: "alice/_knop/_page/page.ttl",
        currentPageDefinitionTurtle: pageDefinitionTurtle(
          undefined,
          `sflo:targetArtifact <${MESH_BASE}alice> ;
  sflo:targetHistoricalState <${MESH_BASE}alice/_history001/_s0001>`,
        ),
        currentArtifactHistoryExists: true,
      },
    );

    assertEquals(
      page?.regions[0]?.sourcePath,
      "alice/_history001/_s0001/md/source.md",
    );
    assertEquals(page?.regions[0]?.markdown, "# Exact Alice\n");
  });
});

Deno.test("loadActiveCustomIdentifierPage uses explicit fallback after unavailable exact source", async () => {
  await withPageDefinitionFixture(async ({ meshRoot, policy }) => {
    await materializePayloadArtifact(meshRoot);

    const page = await loadActiveCustomIdentifierPage(
      meshRoot,
      policy,
      MESH_BASE,
      "alice",
      {
        artifactPath: "alice/_knop/_page",
        workingLocalRelativePath: "alice/_knop/_page/page.ttl",
        currentPageDefinitionTurtle: pageDefinitionTurtle(
          undefined,
          `sflo:targetArtifact <${MESH_BASE}alice> ;
  sflo:targetHistoricalState <${MESH_BASE}alice/_history001/_s0001> ;
  sflo:hasFallbackArtifactResolutionSpec [
    a sflo:ArtifactResolutionSpec ;
    sflo:targetLocalRelativePath "alice.md"
  ]`,
        ),
        currentArtifactHistoryExists: true,
      },
    );

    assertEquals(page?.regions[0]?.sourcePath, "alice.md");
    assertEquals(page?.regions[0]?.markdown, "# Alice\n");
  });
});

Deno.test("loadActiveCustomIdentifierPage does not broaden direct local sources with fallback", async () => {
  await withPageDefinitionFixture(async ({ meshRoot, policy }) => {
    await assertRejects(
      () =>
        loadActiveCustomIdentifierPage(
          meshRoot,
          policy,
          MESH_BASE,
          "alice",
          {
            artifactPath: "alice/_knop/_page",
            workingLocalRelativePath: "alice/_knop/_page/page.ttl",
            currentPageDefinitionTurtle: pageDefinitionTurtle(
              undefined,
              `sflo:targetLocalRelativePath "missing.md" ;
  sflo:hasFallbackArtifactResolutionSpec [
    a sflo:ArtifactResolutionSpec ;
    sflo:targetLocalRelativePath "alice.md"
  ]`,
            ),
            currentArtifactHistoryExists: true,
          },
        ),
      ResourcePageDefinitionResolutionError,
      "applies artifact-resolution policy fields to a direct targetLocalRelativePath source",
    );
  });
});

Deno.test("loadActiveCustomIdentifierPage rejects direct targetAccessUrl sources", async () => {
  await withPageDefinitionFixture(async ({ meshRoot, policy }) => {
    await assertRejects(
      () =>
        loadActiveCustomIdentifierPage(
          meshRoot,
          policy,
          MESH_BASE,
          "alice",
          {
            artifactPath: "alice/_knop/_page",
            workingLocalRelativePath: "alice/_knop/_page/page.ttl",
            currentPageDefinitionTurtle: pageDefinitionTurtle(
              undefined,
              `sflo:targetAccessUrl "https://example.org/alice.md"`,
            ),
            currentArtifactHistoryExists: true,
          },
        ),
      ResourcePageDefinitionResolutionError,
      "uses targetAccessUrl",
    );
  });
});

async function withPageDefinitionFixture(
  fn: (
    fixture: {
      meshRoot: string;
      policy: OperationalLocalPathPolicy;
    },
  ) => Promise<void>,
): Promise<void> {
  const meshRoot = await Deno.makeTempDir({
    prefix: "weave-page-definition-",
  });
  try {
    await Deno.writeTextFile(join(meshRoot, "alice.md"), "# Alice\n");
    await fn({
      meshRoot,
      policy: {
        meshRoot,
        workspaceRoot: meshRoot,
        rules: [],
      },
    });
  } finally {
    await Deno.remove(meshRoot, { recursive: true });
  }
}

async function materializePayloadArtifact(meshRoot: string): Promise<void> {
  await Deno.mkdir(join(meshRoot, "alice/_knop/_inventory"), {
    recursive: true,
  });
  await Deno.mkdir(join(meshRoot, "alice/_history001/_s0001/md"), {
    recursive: true,
  });
  await Deno.writeTextFile(
    join(meshRoot, "alice/source.md"),
    "# Working Alice\n",
  );
  await Deno.writeTextFile(
    join(meshRoot, "alice/_knop/_inventory/inventory.ttl"),
    `@base <${MESH_BASE}> .
@prefix sflo: <${SFLO}> .

<alice/_knop> a sflo:Knop ;
  sflo:hasPayloadArtifact <alice> .

<alice> a sflo:PayloadArtifact, sflo:RdfDocument ;
  sflo:workingLocalRelativePath "alice/source.md" ;
  sflo:currentArtifactHistory <alice/_history001> ;
  sflo:hasArtifactHistory <alice/_history001> .

<alice/_history001> a sflo:ArtifactHistory ;
  sflo:latestHistoricalState <alice/_history001/_s0001> .

<alice/_history001/_s0001> a sflo:HistoricalState ;
  sflo:locatedFileForState <alice/_history001/_s0001/md/source.md> .
`,
  );
}

function pageDefinitionTurtle(
  generatedPanelSelectionIri?: string,
  sourceTurtle = `sflo:targetLocalRelativePath "alice.md"`,
): string {
  return `@base <${MESH_BASE}alice/_knop/_page> .
@prefix sflo: <${SFLO}> .
@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sflo:ResourcePageDefinition, sflo:DigitalArtifact, sflo:RdfDocument ;
  ${
    generatedPanelSelectionIri
      ? `sfcfg:hasGeneratedResourcePagePanelSelection <${generatedPanelSelectionIri}> ;`
      : ""
  }
  sflo:hasPageRegion <#main-region> .

<#main-region> a sflo:ResourcePageRegion ;
  sflo:regionKey "main" ;
  sflo:hasResourcePageSource <#main-source> .

<#main-source> a sflo:ResourcePageSource ;
  ${sourceTurtle} .
`;
}
