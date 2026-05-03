import { assertEquals, assertThrows } from "@std/assert";
import { IntegrateInputError, planIntegrate } from "./integrate.ts";
import { readMeshAliceBioBranchFile } from "../../../tests/support/mesh_alice_bio_fixture.ts";

Deno.test("planIntegrate renders first payload integration artifacts", async () => {
  const plan = planIntegrate({
    designatorPath: "alice/bio",
    workingLocalRelativePath: "alice-bio.ttl",
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
  assertEquals(plan.workingLocalRelativePath, "alice-bio.ttl");
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
  assertEquals(
    plan.createdFiles[0]?.contents,
    await readMeshAliceBioBranchFile(
      "06-alice-bio-integrated",
      "alice/bio/_knop/_meta/meta.ttl",
    ),
  );
  assertEquals(
    plan.createdFiles[1]?.contents,
    await readMeshAliceBioBranchFile(
      "06-alice-bio-integrated",
      "alice/bio/_knop/_inventory/inventory.ttl",
    ),
  );
  assertEquals(
    plan.updatedFiles[0]?.contents,
    await readMeshAliceBioBranchFile(
      "06-alice-bio-integrated",
      "_mesh/_inventory/inventory.ttl",
    ),
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
        workingLocalRelativePath: "/tmp/alice-bio.ttl",
        meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
        currentMeshInventoryTurtle,
      }),
    IntegrateInputError,
    "relative file path",
  );
});

Deno.test(
  "planIntegrate accepts extra-mesh workingLocalRelativePath values and renders them as literals",
  async () => {
    const currentMeshInventoryTurtle = await readMeshAliceBioBranchFile(
      "05-alice-knop-created-woven",
      "_mesh/_inventory/inventory.ttl",
    );

    const plan = planIntegrate({
      designatorPath: "alice/bio",
      workingLocalRelativePath: "../documentation/alice-bio.ttl",
      meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
      currentMeshInventoryTurtle,
    });

    assertEquals(
      plan.workingLocalRelativePath,
      "../documentation/alice-bio.ttl",
    );
    assertEquals(
      plan.createdFiles[1]?.contents.includes(
        'sflo:workingLocalRelativePath "../documentation/alice-bio.ttl" .',
      ),
      true,
    );
    assertEquals(
      plan.createdFiles[1]?.contents.includes(
        "sflo:hasWorkingLocatedFile <../documentation/alice-bio.ttl> .",
      ),
      false,
    );
    assertEquals(
      plan.updatedFiles[0]?.contents.includes(
        'sflo:workingLocalRelativePath "../documentation/alice-bio.ttl" .',
      ),
      true,
    );
  },
);

Deno.test(
  "planIntegrate accepts semantically equivalent woven MeshInventory turtle",
  async () => {
    const currentMeshInventoryTurtle = withRdfPrefix(
      await readMeshAliceBioBranchFile(
        "05-alice-knop-created-woven",
        "_mesh/_inventory/inventory.ttl",
      ),
    )
      .replace(
        "<alice/_knop> a sflo:Knop ;",
        "<alice/_knop> rdf:type sflo:Knop ;",
      )
      .replace(
        "<_mesh/_inventory/_history001/_s0002/inventory-ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;",
        "<_mesh/_inventory/_history001/_s0002/inventory-ttl> rdf:type sflo:RdfDocument, sflo:ArtifactManifestation ;",
      );

    const plan = planIntegrate({
      designatorPath: "alice/bio",
      workingLocalRelativePath: "alice-bio.ttl",
      meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
      currentMeshInventoryTurtle,
    });

    assertEquals(
      plan.updatedFiles[0]?.contents,
      await readMeshAliceBioBranchFile(
        "06-alice-bio-integrated",
        "_mesh/_inventory/inventory.ttl",
      ),
    );
  },
);

function withRdfPrefix(turtle: string): string {
  return turtle.replace(
    "@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .\n",
    "@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .\n@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .\n",
  );
}
