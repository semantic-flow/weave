import { assertEquals, assertThrows } from "@std/assert";
import { readMeshAliceBioBranchFile } from "../../../tests/support/mesh_alice_bio_fixture.ts";
import { PayloadUpdateInputError, planPayloadUpdate } from "./update.ts";

Deno.test("planPayloadUpdate renders the first payload-update slice", async () => {
  const plan = planPayloadUpdate({
    designatorPath: "alice/data",
    workingLocalRelativePath: "alice-data.ttl",
    replacementPayloadTurtle: await readMeshAliceBioBranchFile(
      "10-alice-bio-updated",
      "alice-data.ttl",
    ),
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentKnopInventoryTurtle: await readMeshAliceBioBranchFile(
      "09-alice-bio-referenced-woven",
      "alice/data/_knop/_inventory/inventory.ttl",
    ),
  });

  assertEquals(
    plan.payloadArtifactIri,
    "https://semantic-flow.github.io/mesh-alice-bio/alice/data",
  );
  assertEquals(plan.workingLocalRelativePath, "alice-data.ttl");
  assertEquals(plan.updatedFiles.map((file) => file.path), ["alice-data.ttl"]);
  assertEquals(
    plan.updatedFiles[0]?.contents,
    await readMeshAliceBioBranchFile("10-alice-bio-updated", "alice-data.ttl"),
  );
});

Deno.test("planPayloadUpdate rejects an inventory that does not resolve the woven payload artifact", () => {
  assertThrows(
    () =>
      planPayloadUpdate({
        designatorPath: "alice/data",
        workingLocalRelativePath: "alice-data.ttl",
        replacementPayloadTurtle: "@base <https://example.org/> .\n",
        meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
        currentKnopInventoryTurtle:
          `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<alice/data/_knop> a sflo:Knop ;
  sflo:hasKnopInventory <alice/data/_knop/_inventory> .
`,
      }),
    PayloadUpdateInputError,
    "settled woven payload shape",
  );
});

Deno.test("planPayloadUpdate accepts semantically equivalent woven payload inventory turtle", () => {
  const plan = planPayloadUpdate({
    designatorPath: "alice/data",
    workingLocalRelativePath: "alice-data.ttl",
    replacementPayloadTurtle: "@base <https://example.org/> .\n",
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentKnopInventoryTurtle:
      `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<alice/data> sflo:currentArtifactHistory <alice/data/_history001> ;
  sflo:hasWorkingLocatedFile <alice-data.ttl> ;
  rdf:type sflo:RdfDocument, sflo:DigitalArtifact, sflo:PayloadArtifact .

<alice/data/_knop> sflo:hasPayloadArtifact <alice/data> ;
  rdf:type sflo:Knop .
`,
  });

  assertEquals(plan.updatedFiles.map((file) => file.path), ["alice-data.ttl"]);
});
