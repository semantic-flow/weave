import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import {
  detectPendingWeaveSlice,
  planWeave,
  type PlanWeaveInput,
  WeaveInputError,
} from "./weave.ts";
import { readMeshAliceBioBranchFile } from "../../../tests/support/mesh_alice_bio_fixture.ts";

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

const secondPayloadWeaveKnopInventoryTurtle =
  `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<alice/bio/_knop> a sflo:Knop ;
  sflo:hasKnopMetadata <alice/bio/_knop/_meta> ;
  sflo:hasKnopInventory <alice/bio/_knop/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <alice/bio/_knop/_inventory/inventory.ttl> ;
  sflo:hasPayloadArtifact <alice/bio> ;
  sflo:hasResourcePage <alice/bio/_knop/index.html> .

<alice/bio> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <alice/bio/_history001> ;
  sflo:currentArtifactHistory <alice/bio/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <alice-bio.ttl> ;
  sflo:hasResourcePage <alice/bio/index.html> .

<alice/bio/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <alice/bio/_history001/_s0001> ;
  sflo:latestHistoricalState <alice/bio/_history001/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <alice/bio/_history001/index.html> .

<alice/bio/_history001/_s0001> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <alice/bio/_history001/_s0001/alice-bio-ttl> ;
  sflo:locatedFileForState <alice/bio/_history001/_s0001/alice-bio-ttl/alice-bio.ttl> ;
  sflo:hasResourcePage <alice/bio/_history001/_s0001/index.html> .

<alice/bio/_history001/_s0001/alice-bio-ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:hasLocatedFile <alice/bio/_history001/_s0001/alice-bio-ttl/alice-bio.ttl> ;
  sflo:hasResourcePage <alice/bio/_history001/_s0001/alice-bio-ttl/index.html> .

<alice/bio/_knop/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <alice/bio/_knop/_inventory/_history001> ;
  sflo:currentArtifactHistory <alice/bio/_knop/_inventory/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <alice/bio/_knop/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <alice/bio/_knop/_inventory/index.html> .

<alice/bio/_knop/_inventory/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <alice/bio/_knop/_inventory/_history001/_s0001> ;
  sflo:latestHistoricalState <alice/bio/_knop/_inventory/_history001/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <alice/bio/_knop/_inventory/_history001/index.html> .
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
      targets: [{ designatorPath: "alice/bio" }],
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

Deno.test("planWeave accepts semantically equivalent first payload weave Turtle", () => {
  const equivalentMeshInventoryTurtle = withRdfPrefix(
    firstPayloadWeaveMeshInventoryTurtle,
  )
    .replace(
      "<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument ;",
      "<_mesh/_inventory> rdf:type sflo:RdfDocument, sflo:DigitalArtifact, sflo:MeshInventory ;",
    )
    .replace(
      "<_mesh/_inventory/_history001> a sflo:ArtifactHistory ;",
      "<_mesh/_inventory/_history001>\n  rdf:type sflo:ArtifactHistory ;",
    )
    .replace(
      "<alice/bio> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;",
      "<alice/bio> rdf:type sflo:RdfDocument, sflo:DigitalArtifact, sflo:PayloadArtifact ;",
    )
    .replace(
      "<alice/bio/_knop> a sflo:Knop ;",
      "<alice/bio/_knop>\n  rdf:type sflo:Knop ;",
    );
  const equivalentKnopMetadataTurtle = withRdfPrefix(
    firstPayloadWeaveKnopMetadataTurtle,
  ).replace(
    "<alice/bio/_knop> a sflo:Knop ;",
    "<alice/bio/_knop>\n  rdf:type sflo:Knop ;",
  );
  const equivalentKnopInventoryTurtle = withRdfPrefix(
    firstPayloadWeaveKnopInventoryTurtle,
  )
    .replace(
      "<alice/bio/_knop> a sflo:Knop ;",
      "<alice/bio/_knop>\n  rdf:type sflo:Knop ;",
    )
    .replace(
      "<alice/bio> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;",
      "<alice/bio> rdf:type sflo:RdfDocument, sflo:DigitalArtifact, sflo:PayloadArtifact ;",
    );

  const plan = planWeave({
    request: {
      targets: [{ designatorPath: "alice/bio" }],
    },
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: equivalentMeshInventoryTurtle,
    weaveableKnops: [{
      designatorPath: "alice/bio",
      currentKnopMetadataTurtle: equivalentKnopMetadataTurtle,
      currentKnopInventoryTurtle: equivalentKnopInventoryTurtle,
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

Deno.test("planWeave accepts semantically equivalent first reference-catalog weave Turtle", () => {
  const equivalentMeshInventoryTurtle = withRdfPrefix(
    firstReferenceCatalogWeaveMeshInventoryTurtle,
  )
    .replace(
      "<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument ;",
      "<_mesh/_inventory> rdf:type sflo:RdfDocument, sflo:DigitalArtifact, sflo:MeshInventory ;",
    )
    .replace(
      "<_mesh/_inventory/_history001> a sflo:ArtifactHistory ;",
      "<_mesh/_inventory/_history001>\n  rdf:type sflo:ArtifactHistory ;",
    )
    .replace(
      "<alice/_knop> a sflo:Knop ;",
      "<alice/_knop>\n  rdf:type sflo:Knop ;",
    );
  const equivalentKnopMetadataTurtle = withRdfPrefix(
    firstWeaveKnopMetadataTurtle,
  ).replace(
    "<alice/_knop> a sflo:Knop ;",
    "<alice/_knop>\n  rdf:type sflo:Knop ;",
  );
  const equivalentKnopInventoryTurtle = withRdfPrefix(
    firstReferenceCatalogWeaveKnopInventoryTurtle,
  )
    .replace(
      "<alice/_knop> a sflo:Knop ;",
      "<alice/_knop>\n  rdf:type sflo:Knop ;",
    )
    .replace(
      "<alice/_knop/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;",
      "<alice/_knop/_inventory> rdf:type sflo:RdfDocument, sflo:DigitalArtifact, sflo:KnopInventory ;",
    )
    .replace(
      "<alice/_knop/_references> a sflo:ReferenceCatalog, sflo:DigitalArtifact, sflo:RdfDocument ;",
      "<alice/_knop/_references> rdf:type sflo:RdfDocument, sflo:DigitalArtifact, sflo:ReferenceCatalog ;",
    )
    .replace(
      "<alice/_knop/_inventory/_history001> a sflo:ArtifactHistory ;",
      "<alice/_knop/_inventory/_history001>\n  rdf:type sflo:ArtifactHistory ;",
    );
  const equivalentReferenceCatalogTurtle = withRdfPrefix(
    firstReferenceCatalogWeaveReferenceCatalogTurtle,
  ).replace(
    `<alice/_knop/_references#reference001> a sflo:ReferenceLink ;
  sflo:referenceLinkFor <alice> ;
  sflo:hasReferenceRole <https://semantic-flow.github.io/semantic-flow-ontology/ReferenceRole/Canonical> ;
  sflo:referenceTarget <alice/bio> .
`,
    `<alice/_knop/_references#reference001>
  sflo:referenceTarget <alice/bio> ;
  rdf:type sflo:ReferenceLink ;
  sflo:hasReferenceRole <https://semantic-flow.github.io/semantic-flow-ontology/ReferenceRole/Canonical> ;
  sflo:referenceLinkFor <alice> .
`,
  );

  const plan = planWeave({
    request: {},
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: equivalentMeshInventoryTurtle,
    weaveableKnops: [{
      designatorPath: "alice",
      currentKnopMetadataTurtle: equivalentKnopMetadataTurtle,
      currentKnopInventoryTurtle: equivalentKnopInventoryTurtle,
      referenceCatalogArtifact: {
        workingFilePath: "alice/_knop/_references/references.ttl",
        currentReferenceCatalogTurtle: equivalentReferenceCatalogTurtle,
      },
    }],
  });

  assertEquals(plan.wovenDesignatorPaths, ["alice"]);
  assertEquals(plan.updatedFiles.map((file) => file.path), [
    "alice/_knop/_inventory/inventory.ttl",
  ]);
});

Deno.test("planWeave preserves the current ReferenceCatalog working file path", () => {
  const workingFilePath = "alice/_knop/_references/reference-links-v1.ttl";
  const plan = planWeave({
    request: {},
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: firstReferenceCatalogWeaveMeshInventoryTurtle,
    weaveableKnops: [{
      designatorPath: "alice",
      currentKnopMetadataTurtle: firstWeaveKnopMetadataTurtle,
      currentKnopInventoryTurtle: firstReferenceCatalogWeaveKnopInventoryTurtle
        .replaceAll(
          "alice/_knop/_references/references.ttl",
          workingFilePath,
        ),
      referenceCatalogArtifact: {
        workingFilePath,
        currentReferenceCatalogTurtle:
          firstReferenceCatalogWeaveReferenceCatalogTurtle,
      },
    }],
  });

  assertEquals(
    plan.createdFiles.map((file) => file.path),
    [
      "alice/_knop/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl",
      "alice/_knop/_references/_history001/_s0001/reference-links-v1-ttl/reference-links-v1.ttl",
    ],
  );
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    `sflo:hasWorkingLocatedFile <${workingFilePath}> ;`,
  );
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "sflo:locatedFileForState <alice/_knop/_references/_history001/_s0001/reference-links-v1-ttl/reference-links-v1.ttl> ;",
  );
  assertEquals(
    plan.createdPages[5],
    {
      kind: "simple",
      path:
        "alice/_knop/_references/_history001/_s0001/reference-links-v1-ttl/index.html",
      description:
        "Resource page for the Turtle manifestation of the first alice ReferenceCatalog historical state.",
    },
  );
});

Deno.test("planWeave supports the first reference-catalog weave slice for non-alice designators", () => {
  const plan = planWeave({
    request: {},
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: firstReferenceCatalogWeaveMeshInventoryTurtle
      .replaceAll("<alice/_knop>", "<carol/_knop>")
      .replaceAll(
        "<alice/_knop/_inventory/inventory.ttl>",
        "<carol/_knop/_inventory/inventory.ttl>",
      )
      .replaceAll("<alice/bio>", "<carol/bio>")
      .replaceAll(
        "<alice/bio/_knop>",
        "<carol/bio/_knop>",
      ),
    weaveableKnops: [{
      designatorPath: "carol",
      currentKnopMetadataTurtle: firstWeaveKnopMetadataTurtle
        .replace("<alice/_knop>", "<carol/_knop>")
        .replace('sflo:designatorPath "alice"', 'sflo:designatorPath "carol"')
        .replace(
          "<alice/_knop/_inventory/inventory.ttl>",
          "<carol/_knop/_inventory/inventory.ttl>",
        ),
      currentKnopInventoryTurtle: firstReferenceCatalogWeaveKnopInventoryTurtle
        .replaceAll("<alice/_knop>", "<carol/_knop>")
        .replaceAll(
          "<alice/_knop/_meta>",
          "<carol/_knop/_meta>",
        )
        .replaceAll(
          "<alice/_knop/_inventory>",
          "<carol/_knop/_inventory>",
        )
        .replaceAll(
          "<alice/_knop/_inventory/inventory.ttl>",
          "<carol/_knop/_inventory/inventory.ttl>",
        )
        .replaceAll(
          "<alice/_knop/_references>",
          "<carol/_knop/_references>",
        )
        .replaceAll(
          "<alice/_knop/_references/references.ttl>",
          "<carol/_knop/_references/references.ttl>",
        )
        .replaceAll(
          "<alice/_knop/_inventory/_history001>",
          "<carol/_knop/_inventory/_history001>",
        )
        .replaceAll(
          "<alice/_knop/_inventory/_history001/_s0001>",
          "<carol/_knop/_inventory/_history001/_s0001>",
        )
        .replaceAll(
          "<alice/_knop/index.html>",
          "<carol/_knop/index.html>",
        )
        .replaceAll(
          "<alice/_knop/_inventory/index.html>",
          "<carol/_knop/_inventory/index.html>",
        )
        .replaceAll(
          "<alice/_knop/_inventory/_history001/index.html>",
          "<carol/_knop/_inventory/_history001/index.html>",
        ),
      referenceCatalogArtifact: {
        workingFilePath: "carol/_knop/_references/references.ttl",
        currentReferenceCatalogTurtle:
          firstReferenceCatalogWeaveReferenceCatalogTurtle
            .replaceAll("<alice>", "<carol>")
            .replaceAll(
              "<alice/_knop/_references#reference001>",
              "<carol/_knop/_references#reference001>",
            )
            .replaceAll("<alice/bio>", "<carol/bio>"),
      },
    }],
  });

  assertEquals(plan.wovenDesignatorPaths, ["carol"]);
  assertEquals(plan.updatedFiles.map((file) => file.path), [
    "carol/_knop/_inventory/inventory.ttl",
  ]);
  assertEquals(
    plan.createdFiles[1]?.path,
    "carol/_knop/_references/_history001/_s0001/references-ttl/references.ttl",
  );
});

Deno.test("planWeave renders the second alice bio payload weave slice", () => {
  const plan = planWeave({
    request: {
      targets: [{ designatorPath: "alice/bio" }],
    },
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: firstReferenceCatalogWeaveMeshInventoryTurtle,
    weaveableKnops: [{
      designatorPath: "alice/bio",
      currentKnopMetadataTurtle: firstPayloadWeaveKnopMetadataTurtle,
      currentKnopInventoryTurtle: secondPayloadWeaveKnopInventoryTurtle,
      payloadArtifact: {
        workingFilePath: "alice-bio.ttl",
        currentPayloadTurtle:
          `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix schema: <https://schema.org/> .

<alice> a schema:Person .
<alice/bio> dcterms:creator <alice> .
`,
      },
    }],
  });

  assertEquals(plan.wovenDesignatorPaths, ["alice/bio"]);
  assertEquals(plan.updatedFiles.map((file) => file.path), [
    "alice/bio/_knop/_inventory/inventory.ttl",
  ]);
  assertEquals(
    plan.createdFiles.map((file) => file.path),
    [
      "alice/bio/_history001/_s0002/alice-bio-ttl/alice-bio.ttl",
      "alice/bio/_knop/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl",
    ],
  );
  assertEquals(plan.createdPages.map((page) => page.path), [
    "alice/bio/_history001/_s0002/index.html",
    "alice/bio/_history001/_s0002/alice-bio-ttl/index.html",
    "alice/bio/_knop/_inventory/_history001/_s0002/index.html",
    "alice/bio/_knop/_inventory/_history001/_s0002/inventory-ttl/index.html",
  ]);
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "sflo:latestHistoricalState <alice/bio/_history001/_s0002> ;",
  );
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "sflo:latestHistoricalState <alice/bio/_knop/_inventory/_history001/_s0002> ;",
  );
});

Deno.test("detectPendingWeaveSlice accepts semantically equivalent second payload weave Turtle", () => {
  const equivalentKnopInventoryTurtle = withRdfPrefix(
    secondPayloadWeaveKnopInventoryTurtle,
  )
    .replace(
      "<alice/bio/_knop> a sflo:Knop ;",
      "<alice/bio/_knop>\n  rdf:type sflo:Knop ;",
    )
    .replace(
      "<alice/bio> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;",
      "<alice/bio> rdf:type sflo:RdfDocument, sflo:DigitalArtifact, sflo:PayloadArtifact ;",
    )
    .replace(
      "<alice/bio/_history001> a sflo:ArtifactHistory ;",
      "<alice/bio/_history001>\n  rdf:type sflo:ArtifactHistory ;",
    )
    .replace(
      "<alice/bio/_knop/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;",
      "<alice/bio/_knop/_inventory> rdf:type sflo:RdfDocument, sflo:DigitalArtifact, sflo:KnopInventory ;",
    )
    .replace(
      "<alice/bio/_knop/_inventory/_history001> a sflo:ArtifactHistory ;",
      "<alice/bio/_knop/_inventory/_history001>\n  rdf:type sflo:ArtifactHistory ;",
    );

  assertEquals(
    detectPendingWeaveSlice(
      "https://semantic-flow.github.io/mesh-alice-bio/",
      "alice/bio",
      equivalentKnopInventoryTurtle,
    ),
    "secondPayloadWeave",
  );
});

Deno.test("planWeave renders the extracted bob woven slice", async () => {
  const plan = planWeave(await createExtractedBobWeaveInput());

  assertEquals(plan.wovenDesignatorPaths, ["bob"]);
  assertEquals(plan.updatedFiles.map((file) => file.path), [
    "_mesh/_inventory/inventory.ttl",
    "bob/_knop/_inventory/inventory.ttl",
    "_mesh/_inventory/_history001/index.html",
    "alice/index.html",
  ]);
  assertEquals(
    plan.createdPages.find((page) =>
      page.path === "bob/_knop/_references/index.html"
    ),
    {
      kind: "referenceCatalog",
      path: "bob/_knop/_references/index.html",
      catalogPath: "bob/_knop/_references",
      ownerDesignatorPath: "bob",
      currentLinks: [{
        fragment: "reference001",
        referenceRoleLabel: "supplemental",
        referenceTargetPath: "alice/bio",
        referenceTargetStatePath: "alice/bio/_history001/_s0002",
      }],
    },
  );
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "<bob>\n  sflo:hasResourcePage <bob/index.html> .",
  );
  assertStringIncludes(
    plan.updatedFiles[3]?.contents ?? "",
    '<td><a href="../bob">bob</a></td>',
  );
});

Deno.test("planWeave accepts semantically equivalent extracted bob ReferenceCatalog Turtle", async () => {
  const input = await createExtractedBobWeaveInput();
  input.weaveableKnops[0]!.referenceCatalogArtifact = {
    ...input.weaveableKnops[0]!.referenceCatalogArtifact!,
    currentReferenceCatalogTurtle: withRdfPrefix(
      input.weaveableKnops[0]!.referenceCatalogArtifact!
        .currentReferenceCatalogTurtle,
    ).replace(
      " a sflo:ReferenceLink ;",
      " rdf:type sflo:ReferenceLink ;",
    ),
  };

  const plan = planWeave(input);

  assertEquals(plan.wovenDesignatorPaths, ["bob"]);
  assertEquals(
    plan.createdPages.find((page) =>
      page.path === "bob/_knop/_references/index.html"
    ),
    {
      kind: "referenceCatalog",
      path: "bob/_knop/_references/index.html",
      catalogPath: "bob/_knop/_references",
      ownerDesignatorPath: "bob",
      currentLinks: [{
        fragment: "reference001",
        referenceRoleLabel: "supplemental",
        referenceTargetPath: "alice/bio",
        referenceTargetStatePath: "alice/bio/_history001/_s0002",
      }],
    },
  );
});

Deno.test("planWeave accepts a semantically equivalent extracted bob Knop block", async () => {
  const input = await createExtractedBobWeaveInput();
  input.currentMeshInventoryTurtle = withRdfPrefix(
    input.currentMeshInventoryTurtle,
  )
    .replace(
      `<bob/_knop> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <bob/_knop/_inventory/inventory.ttl> .
`,
      `<bob/_knop>
  rdf:type sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <bob/_knop/_inventory/inventory.ttl> .
`,
    );

  const plan = planWeave(input);

  assertEquals(plan.wovenDesignatorPaths, ["bob"]);
  assertEquals(
    plan.updatedFiles[0]?.contents ?? "",
    await readMeshAliceBioBranchFile(
      "13-bob-extracted-woven",
      "_mesh/_inventory/inventory.ttl",
    ),
  );
});

Deno.test("planWeave rejects extracted bob weave inputs without a pinned source historical state", async () => {
  const input = await createExtractedBobWeaveInput();
  input.weaveableKnops[0]!.referenceCatalogArtifact = {
    workingFilePath: "bob/_knop/_references/references.ttl",
    currentReferenceCatalogTurtle:
      `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .

<bob> sflo:hasReferenceLink <bob/_knop/_references#reference001> .

<bob/_knop/_references#reference001> a sflo:ReferenceLink ;
  sflo:referenceLinkFor <bob> ;
  sflo:hasReferenceRole <https://semantic-flow.github.io/semantic-flow-ontology/ReferenceRole/Supplemental> ;
  sflo:referenceTarget <alice/bio> .
`,
  };

  assertThrows(
    () => planWeave(input),
    WeaveInputError,
    "must pin its source ReferenceCatalog link to a historical state",
  );
});

Deno.test("planWeave rejects extracted bob weave inputs when the source payload path does not match", async () => {
  const input = await createExtractedBobWeaveInput();
  input.weaveableKnops[0]!.referenceCatalogArtifact = {
    ...input.weaveableKnops[0]!.referenceCatalogArtifact!,
    currentReferenceCatalogTurtle: input.weaveableKnops[0]!
      .referenceCatalogArtifact!.currentReferenceCatalogTurtle.replace(
        "sflo:referenceTarget <alice/bio> ;",
        "sflo:referenceTarget <carol/bio> ;",
      ),
  };

  assertThrows(
    () => planWeave(input),
    WeaveInputError,
    "did not resolve the expected source payload path",
  );
});

Deno.test("planWeave rejects extracted bob weave inputs when the source payload state does not match", async () => {
  const input = await createExtractedBobWeaveInput();
  input.weaveableKnops[0]!.referenceTargetSourcePayloadArtifact = {
    ...input.weaveableKnops[0]!.referenceTargetSourcePayloadArtifact!,
    latestHistoricalStatePath: "alice/bio/_history001/_s0001",
  };

  assertThrows(
    () => planWeave(input),
    WeaveInputError,
    "did not resolve the expected source payload state",
  );
});

Deno.test("planWeave preserves unrelated mesh inventory blocks during extracted bob weave", async () => {
  const input = await createExtractedBobWeaveInput();
  input.currentMeshInventoryTurtle = input.currentMeshInventoryTurtle
    .replace(
      "  sflo:hasKnop <bob/_knop> ;\n  sflo:hasResourcePage <_mesh/index.html> .",
      "  sflo:hasKnop <bob/_knop> ;\n  sflo:hasKnop <carol/_knop> ;\n  sflo:hasResourcePage <_mesh/index.html> .",
    )
    .replace(
      `<alice/bio/_knop> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <alice/bio/_knop/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <alice/bio/_knop/index.html> .`,
      `<alice/bio/_knop> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <alice/bio/_knop/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <alice/bio/_knop/index.html> .

<carol>
  sflo:hasResourcePage <carol/index.html> .

<carol/_knop> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <carol/_knop/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <carol/_knop/index.html> .`,
    )
    .replace(
      `<bob/_knop/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<alice-bio.ttl> a sflo:LocatedFile, sflo:RdfDocument .`,
      `<bob/_knop/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<carol/_knop/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<alice-bio.ttl> a sflo:LocatedFile, sflo:RdfDocument .`,
    )
    .replace(
      `<alice/bio/_knop/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_meta/index.html> a sflo:ResourcePage, sflo:LocatedFile .`,
      `<alice/bio/_knop/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<carol/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<carol/_knop/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_meta/index.html> a sflo:ResourcePage, sflo:LocatedFile .`,
    );

  const plan = planWeave(input);

  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    `<carol/_knop> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <carol/_knop/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <carol/_knop/index.html> .`,
  );
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    `<carol/_knop/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .`,
  );
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    `<carol/_knop/index.html> a sflo:ResourcePage, sflo:LocatedFile .`,
  );
});

Deno.test("planWeave rejects orphaned extracted bob ReferenceCatalog links", async () => {
  const input = await createExtractedBobWeaveInput();
  input.weaveableKnops[0]!.referenceCatalogArtifact = {
    ...input.weaveableKnops[0]!.referenceCatalogArtifact!,
    currentReferenceCatalogTurtle: input.weaveableKnops[0]!
      .referenceCatalogArtifact!.currentReferenceCatalogTurtle.replace(
        "<bob> sflo:hasReferenceLink <bob/_knop/_references#reference001> .\n\n",
        "",
      ),
  };

  assertThrows(
    () => planWeave(input),
    WeaveInputError,
    "owner did not declare current link reference001",
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

async function createExtractedBobWeaveInput(): Promise<PlanWeaveInput> {
  return {
    request: {
      targets: [{ designatorPath: "bob" }],
    },
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: await readMeshAliceBioBranchFile(
      "12-bob-extracted",
      "_mesh/_inventory/inventory.ttl",
    ),
    weaveableKnops: [{
      designatorPath: "bob",
      currentKnopMetadataTurtle: await readMeshAliceBioBranchFile(
        "12-bob-extracted",
        "bob/_knop/_meta/meta.ttl",
      ),
      currentKnopInventoryTurtle: await readMeshAliceBioBranchFile(
        "12-bob-extracted",
        "bob/_knop/_inventory/inventory.ttl",
      ),
      referenceCatalogArtifact: {
        workingFilePath: "bob/_knop/_references/references.ttl",
        currentReferenceCatalogTurtle: await readMeshAliceBioBranchFile(
          "12-bob-extracted",
          "bob/_knop/_references/references.ttl",
        ),
      },
      referenceTargetSourcePayloadArtifact: {
        designatorPath: "alice/bio",
        workingFilePath: "alice-bio.ttl",
        currentPayloadTurtle: await readMeshAliceBioBranchFile(
          "12-bob-extracted",
          "alice-bio.ttl",
        ),
        latestHistoricalStatePath: "alice/bio/_history001/_s0002",
      },
    }],
  };
}

function withRdfPrefix(turtle: string): string {
  return turtle.includes("@prefix rdf:") ? turtle : turtle.replace(
    "@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .",
    `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .`,
  );
}
