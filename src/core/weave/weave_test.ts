import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import { planWeave, WeaveInputError } from "./weave.ts";

const firstWeaveMeshInventoryTurtle =
  `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<_mesh> a sflo:SemanticMesh ;
  sflo:meshBase "https://semantic-flow.github.io/mesh-alice-bio/"^^xsd:anyURI ;
  sflo:hasMeshMetadata <_mesh/_meta> ;
  sflo:hasMeshInventory <_mesh/_inventory> ;
  sflo:hasKnop <alice/_knop> ;
  sflo:hasResourcePage <_mesh/index.html> .

<alice/_knop> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <alice/_knop/_inventory/inventory.ttl> .

<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <_mesh/_inventory/_history001> ;
  sflo:currentArtifactHistory <_mesh/_inventory/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <_mesh/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/index.html> .

<_mesh/_inventory/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <_mesh/_inventory/_history001/_s0001> ;
  sflo:latestHistoricalState <_mesh/_inventory/_history001/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/index.html> .
`;

const firstWeaveKnopMetadataTurtle =
  `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .

<alice/_knop> a sflo:Knop ;
  sflo:designatorPath "alice" ;
  sflo:hasWorkingKnopInventoryFile <alice/_knop/_inventory/inventory.ttl> .
`;

const firstWeaveKnopInventoryTurtle =
  `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .

<alice/_knop> a sflo:Knop ;
  sflo:hasKnopMetadata <alice/_knop/_meta> ;
  sflo:hasKnopInventory <alice/_knop/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <alice/_knop/_inventory/inventory.ttl> .
`;

const firstPayloadWeaveMeshInventoryTurtle =
  `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <_mesh/_inventory/_history001> ;
  sflo:currentArtifactHistory <_mesh/_inventory/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <_mesh/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/index.html> .

<_mesh/_inventory/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <_mesh/_inventory/_history001/_s0001> ;
  sflo:hasHistoricalState <_mesh/_inventory/_history001/_s0002> ;
  sflo:latestHistoricalState <_mesh/_inventory/_history001/_s0002> ;
  sflo:nextStateOrdinal "3"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/index.html> .

<alice/bio> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <alice-bio.ttl> .

<alice/bio/_knop> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <alice/bio/_knop/_inventory/inventory.ttl> .
`;

const firstPayloadWeaveKnopMetadataTurtle =
  `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .

<alice/bio/_knop> a sflo:Knop ;
  sflo:designatorPath "alice/bio" ;
  sflo:hasWorkingKnopInventoryFile <alice/bio/_knop/_inventory/inventory.ttl> .
`;

const firstPayloadWeaveKnopInventoryTurtle =
  `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .

<alice/bio/_knop> a sflo:Knop ;
  sflo:hasKnopMetadata <alice/bio/_knop/_meta> ;
  sflo:hasKnopInventory <alice/bio/_knop/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <alice/bio/_knop/_inventory/inventory.ttl> ;
  sflo:hasPayloadArtifact <alice/bio> .

<alice/bio> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <alice-bio.ttl> .
`;

const firstReferenceCatalogWeaveMeshInventoryTurtle =
  `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <_mesh/_inventory/_history001> ;
  sflo:currentArtifactHistory <_mesh/_inventory/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <_mesh/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/index.html> .

<_mesh/_inventory/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <_mesh/_inventory/_history001/_s0001> ;
  sflo:hasHistoricalState <_mesh/_inventory/_history001/_s0002> ;
  sflo:hasHistoricalState <_mesh/_inventory/_history001/_s0003> ;
  sflo:latestHistoricalState <_mesh/_inventory/_history001/_s0003> ;
  sflo:nextStateOrdinal "4"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/index.html> .

<alice/_knop> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <alice/_knop/_inventory/inventory.ttl> .

<alice/bio> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <alice-bio.ttl> .

<alice/bio/_knop> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <alice/bio/_knop/_inventory/inventory.ttl> .
`;

const firstReferenceCatalogWeaveKnopInventoryTurtle =
  `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<alice/_knop> a sflo:Knop ;
  sflo:hasKnopMetadata <alice/_knop/_meta> ;
  sflo:hasKnopInventory <alice/_knop/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <alice/_knop/_inventory/inventory.ttl> ;
  sflo:hasReferenceCatalog <alice/_knop/_references> ;
  sflo:hasResourcePage <alice/_knop/index.html> .

<alice/_knop/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <alice/_knop/_inventory/_history001> ;
  sflo:currentArtifactHistory <alice/_knop/_inventory/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <alice/_knop/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <alice/_knop/_inventory/index.html> .

<alice/_knop/_references> a sflo:ReferenceCatalog, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <alice/_knop/_references/references.ttl> .

<alice/_knop/_inventory/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <alice/_knop/_inventory/_history001/_s0001> ;
  sflo:latestHistoricalState <alice/_knop/_inventory/_history001/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <alice/_knop/_inventory/_history001/index.html> .
`;

const firstReferenceCatalogWeaveReferenceCatalogTurtle =
  `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .

<alice> sflo:hasReferenceLink <alice/_knop/_references#reference001> .

<alice/_knop/_references#reference001> a sflo:ReferenceLink ;
  sflo:referenceLinkFor <alice> ;
  sflo:hasReferenceRole <https://semantic-flow.github.io/semantic-flow-ontology/ReferenceRole/Canonical> ;
  sflo:referenceTarget <alice/bio> .
`;

Deno.test("planWeave renders the first alice knop-created-woven slice", () => {
  const plan = planWeave({
    request: {},
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: firstWeaveMeshInventoryTurtle,
    weaveableKnops: [{
      designatorPath: "alice",
      currentKnopMetadataTurtle: firstWeaveKnopMetadataTurtle,
      currentKnopInventoryTurtle: firstWeaveKnopInventoryTurtle,
    }],
  });

  assertEquals(plan.wovenDesignatorPaths, ["alice"]);
  assertEquals(plan.updatedFiles.map((file) => file.path), [
    "_mesh/_inventory/inventory.ttl",
    "alice/_knop/_inventory/inventory.ttl",
  ]);
  assertEquals(
    plan.createdFiles.map((file) => file.path),
    [
      "_mesh/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl",
      "alice/_knop/_meta/_history001/_s0001/meta-ttl/meta.ttl",
      "alice/_knop/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl",
    ],
  );
  assertEquals(plan.createdPages[2], {
    kind: "identifier",
    path: "alice/index.html",
    designatorPath: "alice",
    workingFilePath: undefined,
  });
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "<alice>\n  sflo:hasResourcePage <alice/index.html> .",
  );
  assertStringIncludes(
    plan.updatedFiles[1]?.contents ?? "",
    "sflo:currentArtifactHistory <alice/_knop/_inventory/_history001> ;",
  );
});

Deno.test("planWeave renders the first alice bio payload weave slice", () => {
  const plan = planWeave({
    request: {
      designatorPaths: ["alice/bio"],
    },
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: firstPayloadWeaveMeshInventoryTurtle,
    weaveableKnops: [{
      designatorPath: "alice/bio",
      currentKnopMetadataTurtle: firstPayloadWeaveKnopMetadataTurtle,
      currentKnopInventoryTurtle: firstPayloadWeaveKnopInventoryTurtle,
      payloadArtifact: {
        workingFilePath: "alice-bio.ttl",
        currentPayloadTurtle:
          `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix schema: <https://schema.org/> .

<alice> a schema:Person .
`,
      },
    }],
  });

  assertEquals(plan.wovenDesignatorPaths, ["alice/bio"]);
  assertEquals(plan.updatedFiles.map((file) => file.path), [
    "_mesh/_inventory/inventory.ttl",
    "alice/bio/_knop/_inventory/inventory.ttl",
  ]);
  assertEquals(
    plan.createdFiles.map((file) => file.path),
    [
      "_mesh/_inventory/_history001/_s0003/inventory-ttl/inventory.ttl",
      "alice/bio/_history001/_s0001/alice-bio-ttl/alice-bio.ttl",
      "alice/bio/_knop/_meta/_history001/_s0001/meta-ttl/meta.ttl",
      "alice/bio/_knop/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl",
    ],
  );
  assertEquals(plan.createdPages[2], {
    kind: "identifier",
    path: "alice/bio/index.html",
    designatorPath: "alice/bio",
    workingFilePath: "alice-bio.ttl",
  });
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "<alice/bio> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;",
  );
  assertStringIncludes(
    plan.updatedFiles[1]?.contents ?? "",
    "sflo:currentArtifactHistory <alice/bio/_history001> ;",
  );
});

Deno.test("planWeave renders the first alice reference-catalog weave slice", () => {
  const plan = planWeave({
    request: {},
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: firstReferenceCatalogWeaveMeshInventoryTurtle,
    weaveableKnops: [{
      designatorPath: "alice",
      currentKnopMetadataTurtle: firstWeaveKnopMetadataTurtle,
      currentKnopInventoryTurtle: firstReferenceCatalogWeaveKnopInventoryTurtle,
      referenceCatalogArtifact: {
        workingFilePath: "alice/_knop/_references/references.ttl",
        currentReferenceCatalogTurtle:
          firstReferenceCatalogWeaveReferenceCatalogTurtle,
      },
    }],
  });

  assertEquals(plan.wovenDesignatorPaths, ["alice"]);
  assertEquals(plan.updatedFiles.map((file) => file.path), [
    "alice/_knop/_inventory/inventory.ttl",
  ]);
  assertEquals(
    plan.createdFiles.map((file) => file.path),
    [
      "alice/_knop/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl",
      "alice/_knop/_references/_history001/_s0001/references-ttl/references.ttl",
    ],
  );
  assertEquals(plan.createdPages[2], {
    kind: "referenceCatalog",
    path: "alice/_knop/_references/index.html",
    catalogPath: "alice/_knop/_references",
    ownerDesignatorPath: "alice",
    currentLinks: [{
      fragment: "reference001",
      referenceRoleLabel: "canonical",
      referenceTargetPath: "alice/bio",
    }],
  });
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "sflo:latestHistoricalState <alice/_knop/_inventory/_history001/_s0002> ;",
  );
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "sflo:hasArtifactHistory <alice/_knop/_references/_history001> ;",
  );
});

Deno.test("planWeave rejects when no weaveable candidates were provided", () => {
  assertThrows(
    () =>
      planWeave({
        request: {},
        meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
        currentMeshInventoryTurtle: firstWeaveMeshInventoryTurtle,
        weaveableKnops: [],
      }),
    WeaveInputError,
    "No weave candidates",
  );
});
