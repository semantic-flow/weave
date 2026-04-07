import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import { readMeshAliceBioBranchFile } from "../../../tests/support/mesh_alice_bio_fixture.ts";
import { ExtractInputError, planExtract } from "./extract.ts";
import { KnopCreateInputError } from "../knop/create.ts";

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

Deno.test("planExtract fails closed when the source payload LocatedFile block changes shape", async () => {
  const currentMeshInventoryTurtle = withRdfPrefix(
    await readMeshAliceBioBranchFile(
      "11-alice-bio-v2-woven",
      "_mesh/_inventory/inventory.ttl",
    ),
  ).replace(
    "<alice-bio.ttl> a sflo:LocatedFile, sflo:RdfDocument .",
    "<alice-bio.ttl> rdf:type sflo:RdfDocument, sflo:LocatedFile .",
  );

  assertThrows(
    () =>
      planExtract({
        meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
        currentMeshInventoryTurtle,
        designatorPath: "bob",
        referenceTargetDesignatorPath: "alice/bio",
        referenceTargetStatePath: "alice/bio/_history001/_s0002",
        referenceTargetWorkingFilePath: "alice-bio.ttl",
      }),
    ExtractInputError,
    "Failed to resolve the source payload located-file block for alice-bio.ttl",
  );
});

function withRdfPrefix(turtle: string): string {
  return turtle.includes("@prefix rdf:") ? turtle : turtle.replace(
    "@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .",
    `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .`,
  );
}
