import { assertEquals, assertThrows } from "@std/assert";
import { readMeshAliceBioBranchFile } from "../../../tests/support/mesh_alice_bio_fixture.ts";
import { PayloadUpdateInputError, planPayloadUpdate } from "./update.ts";

Deno.test("planPayloadUpdate renders the first payload-update slice", async () => {
  const plan = planPayloadUpdate({
    designatorPath: "alice/bio",
    workingLocalRelativePath: "alice-bio.ttl",
    replacementPayloadTurtle: await readMeshAliceBioBranchFile(
      "10-alice-bio-updated",
      "alice-bio.ttl",
    ),
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentKnopInventoryTurtle: await readMeshAliceBioBranchFile(
      "09-alice-bio-referenced-woven",
      "alice/bio/_knop/_inventory/inventory.ttl",
    ),
  });

  assertEquals(
    plan.payloadArtifactIri,
    "https://semantic-flow.github.io/mesh-alice-bio/alice/bio",
  );
  assertEquals(plan.workingLocalRelativePath, "alice-bio.ttl");
  assertEquals(plan.updatedFiles.map((file) => file.path), ["alice-bio.ttl"]);
  assertEquals(
    plan.updatedFiles[0]?.contents,
    await readMeshAliceBioBranchFile("10-alice-bio-updated", "alice-bio.ttl"),
  );
});

Deno.test("planPayloadUpdate rejects an inventory that does not resolve the woven payload artifact", () => {
  assertThrows(
    () =>
      planPayloadUpdate({
        designatorPath: "alice/bio",
        workingLocalRelativePath: "alice-bio.ttl",
        replacementPayloadTurtle: "@base <https://example.org/> .\n",
        meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
        currentKnopInventoryTurtle:
          `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .

<alice/bio/_knop> a sflo:Knop ;
  sflo:hasKnopInventory <alice/bio/_knop/_inventory> .
`,
      }),
    PayloadUpdateInputError,
    "settled woven payload shape",
  );
});

Deno.test("planPayloadUpdate accepts semantically equivalent woven payload inventory turtle", () => {
  const plan = planPayloadUpdate({
    designatorPath: "alice/bio",
    workingLocalRelativePath: "alice-bio.ttl",
    replacementPayloadTurtle: "@base <https://example.org/> .\n",
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentKnopInventoryTurtle:
      `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .

<alice/bio> sflo:currentArtifactHistory <alice/bio/_history001> ;
  sflo:hasWorkingLocatedFile <alice-bio.ttl> ;
  rdf:type sflo:RdfDocument, sflo:DigitalArtifact, sflo:PayloadArtifact .

<alice/bio/_knop> sflo:hasPayloadArtifact <alice/bio> ;
  rdf:type sflo:Knop .
`,
  });

  assertEquals(plan.updatedFiles.map((file) => file.path), ["alice-bio.ttl"]);
});
