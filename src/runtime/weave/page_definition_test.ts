import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import { DEFAULT_RESOURCE_PAGE_PRESENTATION_PROFILE } from "../config/effective_config.ts";
import type { OperationalLocalPathPolicy } from "../operational/local_path_policy.ts";
import {
  loadActiveCustomIdentifierPage,
  ResourcePageDefinitionResolutionError,
} from "./page_definition.ts";

Deno.test("loadActiveCustomIdentifierPage resolves explicit ResourcePage presentation config", async () => {
  await withPageDefinitionFixture(async ({ meshRoot, policy }) => {
    const page = await loadActiveCustomIdentifierPage(
      meshRoot,
      policy,
      "https://semantic-flow.github.io/mesh-alice-bio/",
      "alice",
      {
        artifactPath: "alice/_knop/_page",
        workingLocalRelativePath: "alice/_knop/_page/page.ttl",
        currentPageDefinitionTurtle: pageDefinitionTurtle(
          DEFAULT_RESOURCE_PAGE_PRESENTATION_PROFILE.iri,
        ),
        currentArtifactHistoryExists: true,
      },
    );

    assertEquals(
      page?.presentationConfigIri,
      DEFAULT_RESOURCE_PAGE_PRESENTATION_PROFILE.iri,
    );
    assertEquals(page?.regions[0]?.markdown, "# Alice\n");
  });
});

Deno.test("loadActiveCustomIdentifierPage rejects unsupported ResourcePage presentation config", async () => {
  await withPageDefinitionFixture(async ({ meshRoot, policy }) => {
    await assertRejects(
      () =>
        loadActiveCustomIdentifierPage(
          meshRoot,
          policy,
          "https://semantic-flow.github.io/mesh-alice-bio/",
          "alice",
          {
            artifactPath: "alice/_knop/_page",
            workingLocalRelativePath: "alice/_knop/_page/page.ttl",
            currentPageDefinitionTurtle: pageDefinitionTurtle(
              "https://example.test/custom-presentation",
            ),
            currentArtifactHistoryExists: true,
          },
        ),
      ResourcePageDefinitionResolutionError,
      "unsupported ResourcePage presentation config",
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

function pageDefinitionTurtle(presentationConfigIri: string): string {
  return `@base <https://semantic-flow.github.io/mesh-alice-bio/alice/_knop/_page> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sflo:ResourcePageDefinition, sflo:DigitalArtifact, sflo:RdfDocument ;
  sfcfg:hasResourcePagePresentationConfig <${presentationConfigIri}> ;
  sflo:hasPageRegion <#main-region> .

<#main-region> a sflo:ResourcePageRegion ;
  sflo:regionKey "main" ;
  sflo:hasResourcePageSource <#main-source> .

<#main-source> a sflo:ResourcePageSource ;
  sflo:targetLocalRelativePath "alice.md" .
`;
}
