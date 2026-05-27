import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { DEFAULT_RESOURCE_PAGE_PRESENTATION_PROFILE } from "../config/effective_config.ts";
import type { OperationalLocalPathPolicy } from "../operational/local_path_policy.ts";
import { loadActiveCustomIdentifierPage } from "./page_definition.ts";

Deno.test("loadActiveCustomIdentifierPage resolves authored regions without direct presentation config", async () => {
  await withPageDefinitionFixture(async ({ meshRoot, policy }) => {
    const page = await loadActiveCustomIdentifierPage(
      meshRoot,
      policy,
      "https://semantic-flow.github.io/mesh-alice-bio/",
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

Deno.test("loadActiveCustomIdentifierPage resolves explicit generated ResourcePage panel selections", async () => {
  await withPageDefinitionFixture(async ({ meshRoot, policy }) => {
    const rawSourcePanelSelectionIri =
      DEFAULT_RESOURCE_PAGE_PRESENTATION_PROFILE.panelSelections.find((
        selection,
      ) => selection.panel === "rawSource")!.iri;
    const page = await loadActiveCustomIdentifierPage(
      meshRoot,
      policy,
      "https://semantic-flow.github.io/mesh-alice-bio/",
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

function pageDefinitionTurtle(
  generatedPanelSelectionIri?: string,
): string {
  return `@base <https://semantic-flow.github.io/mesh-alice-bio/alice/_knop/_page> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
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
  sflo:targetLocalRelativePath "alice.md" .
`;
}
