import { assertEquals } from "@std/assert";
import {
  filterResourcePageFactsFromInventoryTurtle,
  listGeneratedResourcePagePaths,
  type ResourcePageGenerationConfig,
} from "./resource_page_policy.ts";

const MESH_BASE = "https://semantic-flow.github.io/mesh-test/";

Deno.test("settled multi-page facts survive policy changes while their pages stop generating", () => {
  const inventoryTurtle = `@base <${MESH_BASE}> .
@prefix ex: <https://example.org/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

# Preserve these exact settled bytes, including unfamiliar facts and comments.
<alice/data> a sflo:PayloadArtifact, sflo:DigitalArtifact ;
  ex:carried "unchanged" ;
  sflo:hasResourcePage <alice/data/index.html> ;
  sflo:hasResourcePage <alice/data/print/index.html> .

<alice/data/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<alice/data/print/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`;
  const generate = policyConfig("generate");
  const suppress = policyConfig("suppress");

  assertEquals(
    listGeneratedResourcePagePaths({
      meshBase: MESH_BASE,
      inventoryTurtle,
      parseErrorMessage: "Could not parse test inventory.",
      config: generate,
    }),
    ["alice/data/index.html", "alice/data/print/index.html"],
  );
  assertEquals(
    filterResourcePageFactsFromInventoryTurtle({
      meshBase: MESH_BASE,
      inventoryTurtle,
      parseErrorMessage: "Could not parse test inventory.",
      config: suppress,
    }),
    inventoryTurtle,
  );
  assertEquals(
    listGeneratedResourcePagePaths({
      meshBase: MESH_BASE,
      inventoryTurtle,
      parseErrorMessage: "Could not parse test inventory.",
      config: suppress,
    }),
    [],
  );
});

function policyConfig(
  payloadPolicy: "generate" | "suppress",
): ResourcePageGenerationConfig {
  return {
    resourcePageGenerationPolicyForArtifactRole(role) {
      return role === "payload" ? payloadPolicy : "generate";
    },
  };
}
