import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import { readMeshAliceBioBranchFile } from "../../../tests/support/mesh_alice_bio_fixture.ts";
import { ExtractInputError, planExtract } from "./extract.ts";
import { KnopCreateInputError } from "../knop/create.ts";

const rootSourcePreExtractMeshInventoryTurtle =
  `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<_mesh> a sflo:SemanticMesh ;
  sflo:meshBase "https://semantic-flow.github.io/mesh-alice-bio/"^^xsd:anyURI ;
  sflo:hasMeshMetadata <_mesh/_meta> ;
  sflo:hasMeshInventory <_mesh/_inventory> ;
  sflo:hasKnop <_knop> ;
  sflo:hasResourcePage <_mesh/index.html> .

<> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <root-person.ttl> ;
  sflo:hasResourcePage <index.html> .

<_knop> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <_knop/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <_knop/index.html> .

<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument .

<_mesh/_inventory/_history001>
  sflo:latestHistoricalState <_mesh/_inventory/_history001/_s0003> ;
  sflo:nextStateOrdinal "4"^^xsd:nonNegativeInteger .

<root-person.ttl> a sflo:LocatedFile, sflo:RdfDocument .
`;

Deno.test("planExtract renders the first non-woven bob extraction artifacts", async () => {
  const plan = planExtract({
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: await readMeshAliceBioBranchFile(
      "11-alice-bio-v2-woven",
      "_mesh/_inventory/inventory.ttl",
    ),
    designatorPath: "bob",
    referenceTargetDesignatorPath: "alice/bio",
    referenceTargetStatePath: "alice/bio/_history001/_s0002",
    referenceTargetWorkingFilePath: "alice-bio.ttl",
  });

  assertEquals(
    plan.referenceCatalogIri,
    "https://semantic-flow.github.io/mesh-alice-bio/bob/_knop/_references",
  );
  assertEquals(
    plan.referenceLinkIri,
    "https://semantic-flow.github.io/mesh-alice-bio/bob/_knop/_references#reference001",
  );
  assertEquals(
    plan.referenceRoleIri,
    "https://semantic-flow.github.io/semantic-flow-ontology/ReferenceRole/Supplemental",
  );
  assertEquals(
    plan.referenceTargetStateIri,
    "https://semantic-flow.github.io/mesh-alice-bio/alice/bio/_history001/_s0002",
  );
  assertEquals(
    plan.createdFiles.map((file) => file.path),
    [
      "bob/_knop/_meta/meta.ttl",
      "bob/_knop/_inventory/inventory.ttl",
      "bob/_knop/_references/references.ttl",
    ],
  );
  assertEquals(
    plan.updatedFiles.map((file) => file.path),
    ["_mesh/_inventory/inventory.ttl"],
  );
  assertEquals(
    plan.createdFiles[0]?.contents ?? "",
    await readMeshAliceBioBranchFile(
      "12-bob-extracted",
      "bob/_knop/_meta/meta.ttl",
    ),
  );
  assertEquals(
    plan.createdFiles[1]?.contents ?? "",
    await readMeshAliceBioBranchFile(
      "12-bob-extracted",
      "bob/_knop/_inventory/inventory.ttl",
    ),
  );
  assertEquals(
    plan.createdFiles[2]?.contents ?? "",
    await readMeshAliceBioBranchFile(
      "12-bob-extracted",
      "bob/_knop/_references/references.ttl",
    ),
  );
  // Keep this explicit so future extract changes still pin the reference to a
  // historical state in the rendered ReferenceCatalog file.
  assertStringIncludes(
    plan.createdFiles[2]?.contents ?? "",
    "sflo:referenceTargetState <alice/bio/_history001/_s0002> .",
  );
  assertEquals(
    plan.updatedFiles[0]?.contents ?? "",
    await readMeshAliceBioBranchFile(
      "12-bob-extracted",
      "_mesh/_inventory/inventory.ttl",
    ),
  );
});

Deno.test("planExtract accepts a root source payload when the root and source knops are the same", () => {
  const plan = planExtract({
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: rootSourcePreExtractMeshInventoryTurtle,
    designatorPath: "alice/bio",
    referenceTargetDesignatorPath: "",
    referenceTargetStatePath: "_history001/_s0001",
    referenceTargetWorkingFilePath: "root-person.ttl",
  });

  assertEquals(
    plan.createdFiles.map((file) => file.path),
    [
      "alice/bio/_knop/_meta/meta.ttl",
      "alice/bio/_knop/_inventory/inventory.ttl",
      "alice/bio/_knop/_references/references.ttl",
    ],
  );
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    `sflo:hasKnop <_knop> ;
  sflo:hasKnop <alice/bio/_knop> ;`,
  );
  assertStringIncludes(
    plan.createdFiles[2]?.contents ?? "",
    `sflo:referenceTarget <> ;
  sflo:referenceTargetState <_history001/_s0001> .`,
  );
});

Deno.test("planExtract rejects absolute referenceTargetWorkingFilePath values", async () => {
  const currentMeshInventoryTurtle = await readMeshAliceBioBranchFile(
    "11-alice-bio-v2-woven",
    "_mesh/_inventory/inventory.ttl",
  );

  assertThrows(
    () =>
      planExtract({
        meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
        currentMeshInventoryTurtle,
        designatorPath: "bob",
        referenceTargetDesignatorPath: "alice/bio",
        referenceTargetStatePath: "alice/bio/_history001/_s0002",
        referenceTargetWorkingFilePath: "/tmp/alice-bio.ttl",
      }),
    ExtractInputError,
    "mesh-relative file path",
  );
});

Deno.test("planExtract preserves the original knop-planning error as the cause", async () => {
  const currentMeshInventoryTurtle = await readMeshAliceBioBranchFile(
    "11-alice-bio-v2-woven",
    "_mesh/_inventory/inventory.ttl",
  );

  let thrown: unknown;
  try {
    planExtract({
      meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
      currentMeshInventoryTurtle,
      designatorPath: "alice",
      referenceTargetDesignatorPath: "alice/bio",
      referenceTargetStatePath: "alice/bio/_history001/_s0002",
      referenceTargetWorkingFilePath: "alice-bio.ttl",
    });
  } catch (error) {
    thrown = error;
  }

  if (!(thrown instanceof ExtractInputError)) {
    throw thrown;
  }

  if (!(thrown.cause instanceof KnopCreateInputError)) {
    throw new Error(
      "Expected ExtractInputError.cause to preserve KnopCreateInputError",
    );
  }
});

Deno.test("planExtract accepts a semantically equivalent source payload LocatedFile block", async () => {
  const currentMeshInventoryTurtle = withRdfPrefix(
    await readMeshAliceBioBranchFile(
      "11-alice-bio-v2-woven",
      "_mesh/_inventory/inventory.ttl",
    ),
  ).replace(
    "<alice-bio.ttl> a sflo:LocatedFile, sflo:RdfDocument .",
    "<alice-bio.ttl> rdf:type sflo:RdfDocument, sflo:LocatedFile .",
  );

  const plan = planExtract({
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle,
    designatorPath: "bob",
    referenceTargetDesignatorPath: "alice/bio",
    referenceTargetStatePath: "alice/bio/_history001/_s0002",
    referenceTargetWorkingFilePath: "alice-bio.ttl",
  });

  assertEquals(
    plan.updatedFiles[0]?.contents ?? "",
    await readMeshAliceBioBranchFile(
      "12-bob-extracted",
      "_mesh/_inventory/inventory.ttl",
    ),
  );
});

function withRdfPrefix(turtle: string): string {
  return turtle.includes("@prefix rdf:") ? turtle : turtle.replace(
    "@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .",
    `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .`,
  );
}
