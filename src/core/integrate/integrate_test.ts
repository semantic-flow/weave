import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import { IntegrateInputError, planIntegrate } from "./integrate.ts";
import { readMeshAliceBioBranchFile } from "../../../tests/support/mesh_alice_bio_fixture.ts";

Deno.test("planIntegrate renders first payload integration artifacts", async () => {
  const plan = planIntegrate({
    designatorPath: "alice/bio",
    workingFilePath: "alice-bio.ttl",
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: await readMeshAliceBioBranchFile(
      "05-alice-knop-created-woven",
      "_mesh/_inventory/inventory.ttl",
    ),
  });

  assertEquals(
    plan.payloadArtifactIri,
    "https://semantic-flow.github.io/mesh-alice-bio/alice/bio",
  );
  assertEquals(
    plan.knopIri,
    "https://semantic-flow.github.io/mesh-alice-bio/alice/bio/_knop",
  );
  assertEquals(plan.workingFilePath, "alice-bio.ttl");
  assertEquals(
    plan.createdFiles.map((file) => file.path),
    [
      "alice/bio/_knop/_meta/meta.ttl",
      "alice/bio/_knop/_inventory/inventory.ttl",
    ],
  );
  assertEquals(
    plan.updatedFiles.map((file) => file.path),
    ["_mesh/_inventory/inventory.ttl"],
  );
  assertStringIncludes(
    plan.createdFiles[1]?.contents ?? "",
    "  sflo:hasPayloadArtifact <alice/bio> .",
  );
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "<alice/bio> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;",
  );
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "<alice-bio.ttl> a sflo:LocatedFile, sflo:RdfDocument .",
  );
});

Deno.test("planIntegrate rejects absolute working file paths", async () => {
  const currentMeshInventoryTurtle = await readMeshAliceBioBranchFile(
    "05-alice-knop-created-woven",
    "_mesh/_inventory/inventory.ttl",
  );

  assertThrows(
    () =>
      planIntegrate({
        designatorPath: "alice/bio",
        workingFilePath: "/tmp/alice-bio.ttl",
        meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
        currentMeshInventoryTurtle,
      }),
    IntegrateInputError,
    "mesh-relative file path",
  );
});
