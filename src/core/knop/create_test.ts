import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import { KnopCreateInputError, planKnopCreate } from "./create.ts";

const wovenMeshInventory =
  `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<_mesh> a sflo:SemanticMesh ;
  sflo:meshBase "https://semantic-flow.github.io/mesh-alice-bio/"^^xsd:anyURI ;
  sflo:hasMeshMetadata <_mesh/_meta> ;
  sflo:hasMeshInventory <_mesh/_inventory> ;
  sflo:hasResourcePage <_mesh/index.html> .

<_mesh/_meta> a sflo:MeshMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <_mesh/_meta/meta.ttl> .

<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <_mesh/_inventory/inventory.ttl> .

<_mesh/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`;

Deno.test("planKnopCreate renders first knop support artifacts", () => {
  const plan = planKnopCreate({
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    designatorPath: "alice",
    currentMeshInventoryTurtle: wovenMeshInventory,
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
  assertStringIncludes(
    plan.createdFiles[0]?.contents ?? "",
    'sflo:designatorPath "alice" ;',
  );
  assertStringIncludes(
    plan.createdFiles[1]?.contents ?? "",
    "<alice/_knop/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;",
  );
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "  sflo:hasKnop <alice/_knop> ;",
  );
});

Deno.test("planKnopCreate rejects reserved designator path segments", () => {
  assertThrows(
    () =>
      planKnopCreate({
        meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
        designatorPath: "alice/_knop",
        currentMeshInventoryTurtle: wovenMeshInventory,
      }),
    KnopCreateInputError,
    "reserved path segments",
  );
});

Deno.test("planKnopCreate rejects an already-registered knop", () => {
  assertThrows(
    () =>
      planKnopCreate({
        meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
        designatorPath: "alice",
        currentMeshInventoryTurtle: wovenMeshInventory.replace(
          "  sflo:hasResourcePage <_mesh/index.html> .",
          "  sflo:hasKnop <alice/_knop> ;\n  sflo:hasResourcePage <_mesh/index.html> .\n\n<alice/_knop> a sflo:Knop ;\n  sflo:hasWorkingKnopInventoryFile <alice/_knop/_inventory/inventory.ttl> .",
        ),
      }),
    KnopCreateInputError,
    "already registers knop",
  );
});
