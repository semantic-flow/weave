import {
  assert,
  assertEquals,
  assertFalse,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import { compareRdfContent } from "../../../dependencies/github.com/spectacular-voyage/accord/src/checker/compare_rdf.ts";
import { planMeshSupportResourcePages } from "./mesh_support_pages.ts";
import { WeaveInputError } from "./errors.ts";

const meshBase = "https://example.org/mesh/";

Deno.test("mesh-support page-only append preserves the exact carried MeshInventory prefix", async () => {
  const currentMeshInventoryTurtle = `${carriedMeshInventoryTurtle()}  `;
  const plan = planCurrentOnlyMeshSupportPages(currentMeshInventoryTurtle);
  const updatedInventory = plan.updatedFiles[0]?.contents ?? "";

  assert(updatedInventory.startsWith(currentMeshInventoryTurtle));
  assertEquals(
    await compareRdfContent({
      left: encode(updatedInventory),
      right: encode(
        `${currentMeshInventoryTurtle}${requestedSupportPageFactsTurtle()}`,
      ),
      path: "_mesh/_inventory/inventory.ttl",
    }),
    true,
  );
});

Deno.test("mesh-support page-only semantic no-op omits the inventory update", () => {
  const currentMeshInventoryTurtle =
    `${carriedMeshInventoryTurtle()}${requestedSupportPageFactsTurtle()}# retain trailing note\n  `;

  assertEquals(
    planCurrentOnlyMeshSupportPages(currentMeshInventoryTurtle).updatedFiles,
    [],
  );
});

Deno.test("mesh-support page-only append rejects a missing support subject", () => {
  const currentMeshInventoryTurtle = carriedMeshInventoryTurtle().replace(
    `<_mesh/_meta> a sflo:MeshMetadata ;
  ex:curatedNote "first block" .

<_mesh/_meta> ex:curatedNote "second block" .

`,
    "",
  );

  assertThrows(
    () => planCurrentOnlyMeshSupportPages(currentMeshInventoryTurtle),
    WeaveInputError,
    "did not contain support resource <_mesh/_meta>",
  );
});

Deno.test("initial mesh-support history keeps mutable progression in MeshMetadata only", () => {
  const plan = planMeshSupportResourcePages({
    meshBase,
    currentMeshInventoryTurtle: initialSupportInventoryTurtle(),
    currentMeshMetadataTurtle: initialMeshMetadataTurtle(),
    currentMeshConfigTurtle: "# current config bytes\n",
    supportHistoryPolicies: {
      meshMetadata: "versioned",
      meshInventory: "versioned",
      config: "versioned",
    },
  });
  const updatedInventory =
    plan.updatedFiles.find((file) =>
      file.path === "_mesh/_inventory/inventory.ttl"
    )?.contents ?? "";
  const updatedMetadata =
    plan.updatedFiles.find((file) => file.path === "_mesh/_meta/meta.ttl")
      ?.contents ?? "";

  for (
    const mutablePredicate of [
      "sflo:currentArtifactHistory",
      "sflo:nextHistoryOrdinal",
      "sflo:latestHistoricalState",
      "sflo:nextStateOrdinal",
    ]
  ) {
    assertFalse(
      updatedInventory.includes(mutablePredicate),
      "MeshInventory retained mutable predicate " + mutablePredicate,
    );
  }
  for (
    const supportPath of [
      "_mesh/_meta",
      "_mesh/_inventory",
      "_mesh/_config",
    ]
  ) {
    const historyPath = supportPath + "/_history001";
    assertStringIncludes(
      updatedInventory,
      "sflo:hasArtifactHistory <" + historyPath + ">",
    );
    assertStringIncludes(
      updatedInventory,
      "sflo:hasHistoricalState <" + historyPath + "/_s0001>",
    );
    assertStringIncludes(updatedMetadata, "<" + supportPath + ">");
    assertStringIncludes(
      updatedMetadata,
      "sflo:currentArtifactHistory <" + historyPath + ">",
    );
    assertStringIncludes(
      updatedMetadata,
      "<" + historyPath + ">",
    );
    assertStringIncludes(
      updatedMetadata,
      "sflo:latestHistoricalState <" + historyPath + "/_s0001>",
    );
  }
  assertEquals(
    plan.createdFiles.find((file) =>
      file.path === "_mesh/_meta/_history001/_s0001/ttl/meta.ttl"
    )?.contents,
    updatedMetadata,
  );
});

function planCurrentOnlyMeshSupportPages(
  currentMeshInventoryTurtle: string,
) {
  return planMeshSupportResourcePages({
    meshBase,
    currentMeshInventoryTurtle,
    currentMeshMetadataTurtle: "# metadata bytes are not versioned here\n",
    currentMeshConfigTurtle: "# config bytes are not versioned here\n",
    supportHistoryPolicies: {
      meshMetadata: "currentOnly",
      meshInventory: "currentOnly",
      config: "currentOnly",
    },
  });
}

function carriedMeshInventoryTurtle(): string {
  return `@base <${meshBase}> .
@prefix ex: <https://example.org/ns/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

# Preserve this curated mesh comment and every byte below it.
<_mesh> a sflo:SemanticMesh ;
  ex:curatedNote "mesh" .

<_mesh/_meta> a sflo:MeshMetadata ;
  ex:curatedNote "first block" .

<_mesh/_meta> ex:curatedNote "second block" .

<_mesh/_inventory> a sflo:MeshInventory ;
  ex:curatedNote "inventory" .

<_mesh/_config> a ex:Configuration ;
  ex:carriedDetail [
    ex:label "existing anonymous detail"
  ] .
`;
}

function requestedSupportPageFactsTurtle(): string {
  return `
@base <${meshBase}> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<_mesh> sflo:hasResourcePage <_mesh/index.html> .
<_mesh/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_meta> sflo:hasResourcePage <_mesh/_meta/index.html> .
<_mesh/_meta/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory> sflo:hasResourcePage <_mesh/_inventory/index.html> .
<_mesh/_inventory/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_config> sflo:hasResourcePage <_mesh/_config/index.html> .
<_mesh/_config/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`;
}

function initialSupportInventoryTurtle(): string {
  return [
    "@base <" + meshBase + "> .",
    "@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .",
    "",
    "<_mesh> a sflo:SemanticMesh .",
    "",
    "<_mesh/_meta> a sflo:MeshMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;",
    "  sflo:hasWorkingLocatedFile <_mesh/_meta/meta.ttl> .",
    "",
    "<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument ;",
    "  sflo:hasWorkingLocatedFile <_mesh/_inventory/inventory.ttl> .",
    "",
    "<_mesh/_config> a sflo:DigitalArtifact, sflo:RdfDocument ;",
    "  sflo:hasWorkingLocatedFile <_mesh/_config/config.ttl> .",
    "",
    "<_mesh/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .",
    "",
    "<_mesh/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .",
    "",
    "<_mesh/_config/config.ttl> a sflo:LocatedFile, sflo:RdfDocument .",
    "",
  ].join("\n");
}

function initialMeshMetadataTurtle(): string {
  return [
    "@base <" + meshBase + "> .",
    "@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .",
    "",
    "<_mesh> a sflo:SemanticMesh .",
    "",
    "<_mesh/_meta> a sflo:MeshMetadata, sflo:DigitalArtifact, sflo:RdfDocument .",
    "",
  ].join("\n");
}

function encode(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}
