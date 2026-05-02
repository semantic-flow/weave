import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import { KnopCreateInputError, planKnopCreate } from "./create.ts";
import { readMeshAliceBioBranchFile } from "../../../tests/support/mesh_alice_bio_fixture.ts";

Deno.test("planKnopCreate renders first knop support artifacts", async () => {
  const plan = planKnopCreate({
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    designatorPath: "alice",
    currentMeshInventoryTurtle: await readMeshAliceBioBranchFile(
      "03-mesh-created-woven",
      "_mesh/_inventory/inventory.ttl",
    ),
  });

  assertEquals(
    plan.knopIri,
    "https://semantic-flow.github.io/mesh-alice-bio/alice/_knop",
  );
  assertEquals(
    plan.createdFiles.map((file) => file.path),
    [
      "alice/_knop/_meta/meta.ttl",
      "alice/_knop/_inventory/inventory.ttl",
    ],
  );
  assertEquals(
    plan.updatedFiles.map((file) => file.path),
    ["_mesh/_inventory/inventory.ttl"],
  );
  assertEquals(
    plan.createdFiles[0]?.contents,
    await readMeshAliceBioBranchFile(
      "04-alice-knop-created",
      "alice/_knop/_meta/meta.ttl",
    ),
  );
  assertEquals(
    plan.createdFiles[1]?.contents,
    await readMeshAliceBioBranchFile(
      "04-alice-knop-created",
      "alice/_knop/_inventory/inventory.ttl",
    ),
  );
  assertEquals(
    plan.updatedFiles[0]?.contents,
    await readMeshAliceBioBranchFile(
      "04-alice-knop-created",
      "_mesh/_inventory/inventory.ttl",
    ),
  );
});

Deno.test("planKnopCreate rejects reserved designator path segments", () => {
  assertThrows(
    () =>
      planKnopCreate({
        meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
        designatorPath: "alice/_knop",
        currentMeshInventoryTurtle: "",
      }),
    KnopCreateInputError,
    "reserved path segments",
  );
});

Deno.test("planKnopCreate rejects an already-registered knop", async () => {
  const currentMeshInventoryTurtle = await readMeshAliceBioBranchFile(
    "04-alice-knop-created",
    "_mesh/_inventory/inventory.ttl",
  );

  assertThrows(
    () =>
      planKnopCreate({
        meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
        designatorPath: "alice",
        currentMeshInventoryTurtle,
      }),
    KnopCreateInputError,
    "already registers knop",
  );
});

Deno.test(
  "planKnopCreate accepts semantically equivalent woven MeshInventory turtle",
  async () => {
    const currentMeshInventoryTurtle = withRdfPrefix(
      await readMeshAliceBioBranchFile(
        "03-mesh-created-woven",
        "_mesh/_inventory/inventory.ttl",
      ),
    )
      .replace(
        "<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument ;",
        "<_mesh/_inventory> rdf:type sflo:RdfDocument, sflo:DigitalArtifact, sflo:MeshInventory ;",
      )
      .replace(
        "<_mesh/_meta/_history001/_s0001/meta-ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;",
        "<_mesh/_meta/_history001/_s0001/meta-ttl> rdf:type sflo:RdfDocument, sflo:ArtifactManifestation ;",
      );

    const plan = planKnopCreate({
      meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
      designatorPath: "alice",
      currentMeshInventoryTurtle,
    });

    assertEquals(
      plan.updatedFiles[0]?.contents,
      await readMeshAliceBioBranchFile(
        "04-alice-knop-created",
        "_mesh/_inventory/inventory.ttl",
      ),
    );
  },
);

Deno.test(
  "planKnopCreate supports creating the root Knop in a later carried mesh state",
  async () => {
    const plan = planKnopCreate({
      meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
      designatorPath: "",
      currentMeshInventoryTurtle: await readMeshAliceBioBranchFile(
        "21-bob-page-imported-source-woven",
        "_mesh/_inventory/inventory.ttl",
      ),
    });

    assertEquals(
      plan.createdFiles.map((file) => file.path),
      [
        "_knop/_meta/meta.ttl",
        "_knop/_inventory/inventory.ttl",
      ],
    );
    assertStringIncludes(
      plan.updatedFiles[0]?.contents ?? "",
      "sflo:hasKnop <_knop> ;",
    );
    assertStringIncludes(
      plan.updatedFiles[0]?.contents ?? "",
      "sflo:latestHistoricalState <_mesh/_inventory/_history001/_s0005> ;",
    );
    assertStringIncludes(
      plan.updatedFiles[0]?.contents ?? "",
      "<_knop/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .",
    );
  },
);

function withRdfPrefix(turtle: string): string {
  return turtle.includes("@prefix rdf:") ? turtle : turtle.replace(
    "@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .\n",
    "@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .\n@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .\n",
  );
}
