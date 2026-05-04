import {
  assert,
  assertEquals,
  assertFalse,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import { compareRdfContent } from "../../../dependencies/github.com/spectacular-voyage/accord/src/checker/compare_rdf.ts";
import { planExtract } from "../extract/extract.ts";
import { planKnopCreate } from "../knop/create.ts";
import {
  detectPendingWeaveSlice,
  planMeshSupportResourcePages,
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

const sidecarMeshCreatedInventoryTurtle =
  `@base <https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@prefix sfcfg: <https://semantic-flow.github.io/ontology/config/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<_mesh> a sflo:SemanticMesh ;
  sflo:meshBase "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/"^^xsd:anyURI ;
  sflo:hasMeshMetadata <_mesh/_meta> ;
  sflo:hasMeshInventory <_mesh/_inventory> ;
  sfcfg:hasConfig <_mesh/_config> .

<_mesh/_meta> a sflo:MeshMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <_mesh/_meta/meta.ttl> .

<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <_mesh/_inventory/inventory.ttl> .

<_mesh/_config> a sfcfg:MeshConfig, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <_mesh/_config/config.ttl> .

<_mesh/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_config/config.ttl> a sflo:LocatedFile, sflo:RdfDocument .
`;

const firstWeaveKnopMetadataTurtle =
  `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .

<alice/_knop> a sflo:Knop ;
  sflo:designatorPath "alice" ;
  sflo:hasWorkingKnopInventoryFile <alice/_knop/_inventory/inventory.ttl> .
`;

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

<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:currentArtifactHistory <_mesh/_inventory/_history001> .

<_mesh/_inventory/_history001>
  sflo:latestHistoricalState <_mesh/_inventory/_history001/_s0003> ;
  sflo:nextStateOrdinal "4"^^xsd:nonNegativeInteger .

<root-person.ttl> a sflo:LocatedFile, sflo:RdfDocument .
`;

const rootSourcePersonPayloadTurtle =
  `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix schema: <https://schema.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

<> a schema:Dataset ;
  schema:name "Root Source Payload" .

<alice> a schema:Person ;
  foaf:name "Alice" ;
  schema:birthDate "2000-01-01" ;
  foaf:knows <alice/bio> .

<alice/bio> a schema:Person ;
  foaf:givenName "Alice" ;
  foaf:nick "alice-bio" .
`;

const firstWeaveKnopInventoryTurtle =
  `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .

<alice/_knop> a sflo:Knop ;
  sflo:hasKnopMetadata <alice/_knop/_meta> ;
  sflo:hasKnopInventory <alice/_knop/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <alice/_knop/_inventory/inventory.ttl> .
`;

Deno.test("planMeshSupportResourcePages adds current support ResourcePages including config", () => {
  const plan = planMeshSupportResourcePages({
    meshBase: "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
    currentMeshInventoryTurtle: sidecarMeshCreatedInventoryTurtle,
  });

  assertEquals(plan.versionedDesignatorPaths, []);
  assertEquals(plan.createdFiles, []);
  assertEquals(
    plan.updatedFiles.map((file) => file.path),
    ["_mesh/_inventory/inventory.ttl"],
  );
  const inventory = plan.updatedFiles[0]?.contents ?? "";
  assertStringIncludes(
    inventory,
    "sfcfg:hasConfig <_mesh/_config> ;\n  sflo:hasResourcePage <_mesh/index.html> .",
  );
  assertStringIncludes(
    inventory,
    "sflo:hasWorkingLocatedFile <_mesh/_config/config.ttl> ;\n  sflo:hasResourcePage <_mesh/_config/index.html> .",
  );
  assertStringIncludes(
    inventory,
    "<_mesh/_config/index.html> a sflo:ResourcePage, sflo:LocatedFile .",
  );
});

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

const laterFirstPayloadWeaveMeshInventoryTurtle =
  `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<_mesh> a sflo:SemanticMesh ;
  sflo:meshBase "https://semantic-flow.github.io/mesh-alice-bio/"^^xsd:anyURI ;
  sflo:hasMeshMetadata <_mesh/_meta> ;
  sflo:hasMeshInventory <_mesh/_inventory> ;
  sflo:hasKnop <alice/_knop> ;
  sflo:hasKnop <alice/bio/_knop> ;
  sflo:hasKnop <alice/page-main/_knop> ;
  sflo:hasResourcePage <_mesh/index.html> .

<alice>
  sflo:hasResourcePage <alice/index.html> .

<alice/_knop> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <alice/_knop/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <alice/_knop/index.html> .

<alice/page-main> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <alice-page-main.md> .

<alice/page-main/_knop> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <alice/page-main/_knop/_inventory/inventory.ttl> .

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
  sflo:hasHistoricalState <_mesh/_inventory/_history001/_s0004> ;
  sflo:latestHistoricalState <_mesh/_inventory/_history001/_s0004> ;
  sflo:nextStateOrdinal "5"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/index.html> .

<_mesh/_inventory/_history001/_s0001> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <_mesh/_inventory/_history001/_s0001/inventory-ttl> ;
  sflo:locatedFileForState <_mesh/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0001/index.html> .

<_mesh/_inventory/_history001/_s0001/inventory-ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:hasLocatedFile <_mesh/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0001/inventory-ttl/index.html> .

<_mesh/_inventory/_history001/_s0002> a sflo:HistoricalState ;
  sflo:stateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:previousHistoricalState <_mesh/_inventory/_history001/_s0001> ;
  sflo:hasManifestation <_mesh/_inventory/_history001/_s0002/inventory-ttl> ;
  sflo:locatedFileForState <_mesh/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0002/index.html> .

<_mesh/_inventory/_history001/_s0002/inventory-ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:hasLocatedFile <_mesh/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0002/inventory-ttl/index.html> .

<_mesh/_inventory/_history001/_s0003> a sflo:HistoricalState ;
  sflo:stateOrdinal "3"^^xsd:nonNegativeInteger ;
  sflo:previousHistoricalState <_mesh/_inventory/_history001/_s0002> ;
  sflo:hasManifestation <_mesh/_inventory/_history001/_s0003/inventory-ttl> ;
  sflo:locatedFileForState <_mesh/_inventory/_history001/_s0003/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0003/index.html> .

<_mesh/_inventory/_history001/_s0003/inventory-ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:hasLocatedFile <_mesh/_inventory/_history001/_s0003/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0003/inventory-ttl/index.html> .

<_mesh/_inventory/_history001/_s0004> a sflo:HistoricalState ;
  sflo:stateOrdinal "4"^^xsd:nonNegativeInteger ;
  sflo:previousHistoricalState <_mesh/_inventory/_history001/_s0003> ;
  sflo:hasManifestation <_mesh/_inventory/_history001/_s0004/inventory-ttl> ;
  sflo:locatedFileForState <_mesh/_inventory/_history001/_s0004/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0004/index.html> .

<_mesh/_inventory/_history001/_s0004/inventory-ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:hasLocatedFile <_mesh/_inventory/_history001/_s0004/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0004/inventory-ttl/index.html> .

<_mesh/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/_history001/_s0003/inventory-ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/_history001/_s0004/inventory-ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<alice/_knop/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<alice/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0001/inventory-ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0002/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0002/inventory-ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0003/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0003/inventory-ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0004/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0004/inventory-ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`;

const laterFirstPayloadWeaveKnopMetadataTurtle =
  `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .

<alice/page-main/_knop> a sflo:Knop ;
  sflo:designatorPath "alice/page-main" ;
  sflo:hasWorkingKnopInventoryFile <alice/page-main/_knop/_inventory/inventory.ttl> .
`;

const laterFirstPayloadWeaveKnopInventoryTurtle =
  `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .

<alice/page-main/_knop> a sflo:Knop ;
  sflo:hasKnopMetadata <alice/page-main/_knop/_meta> ;
  sflo:hasKnopInventory <alice/page-main/_knop/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <alice/page-main/_knop/_inventory/inventory.ttl> ;
  sflo:hasPayloadArtifact <alice/page-main> .

<alice/page-main> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <alice-page-main.md> .

<alice/page-main/_knop/_meta> a sflo:KnopMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <alice/page-main/_knop/_meta/meta.ttl> .

<alice/page-main/_knop/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <alice/page-main/_knop/_inventory/inventory.ttl> .

<alice/page-main/_knop/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<alice/page-main/_knop/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<alice-page-main.md> a sflo:LocatedFile, sflo:RdfDocument .
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
    workingLocalRelativePath: undefined,
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
        workingLocalRelativePath: "alice-bio.ttl",
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
    workingLocalRelativePath: "alice-bio.ttl",
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

Deno.test("planWeave renders a later first payload weave slice against a carried mesh inventory", () => {
  const plan = planWeave({
    request: {
      targets: [{ designatorPath: "alice/page-main" }],
    },
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: laterFirstPayloadWeaveMeshInventoryTurtle,
    weaveableKnops: [{
      designatorPath: "alice/page-main",
      currentKnopMetadataTurtle: laterFirstPayloadWeaveKnopMetadataTurtle,
      currentKnopInventoryTurtle: laterFirstPayloadWeaveKnopInventoryTurtle,
      payloadArtifact: {
        workingLocalRelativePath: "alice-page-main.md",
        currentPayloadTurtle: "# Alice\n\nGoverned page main content.\n",
      },
    }],
  });

  assertEquals(plan.wovenDesignatorPaths, ["alice/page-main"]);
  assertEquals(
    plan.createdFiles.map((file) => file.path),
    [
      "_mesh/_inventory/_history001/_s0005/inventory-ttl/inventory.ttl",
      "alice/page-main/_history001/_s0001/alice-page-main-md/alice-page-main.md",
      "alice/page-main/_knop/_meta/_history001/_s0001/meta-ttl/meta.ttl",
      "alice/page-main/_knop/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl",
    ],
  );
  assertEquals(plan.createdPages[0], {
    kind: "simple",
    path: "_mesh/_inventory/_history001/_s0005/index.html",
    description: "Resource page for the fifth MeshInventory historical state.",
  });
  assertEquals(plan.createdPages[2], {
    kind: "identifier",
    path: "alice/page-main/index.html",
    designatorPath: "alice/page-main",
    workingLocalRelativePath: "alice-page-main.md",
  });
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    `sflo:latestHistoricalState <_mesh/_inventory/_history001/_s0005> ;`,
  );
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    `sflo:nextStateOrdinal "6"^^xsd:nonNegativeInteger ;`,
  );
  assertStringIncludes(
    plan.updatedFiles[1]?.contents ?? "",
    "sflo:currentArtifactHistory <alice/page-main/_history001> ;",
  );
});

Deno.test("planWeave supports a later first root Knop weave against a carried mesh inventory", async () => {
  const createPlan = planKnopCreate({
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    designatorPath: "",
    currentMeshInventoryTurtle: await readMeshAliceBioBranchFile(
      "21-bob-page-imported-source-woven",
      "_mesh/_inventory/inventory.ttl",
    ),
  });

  const plan = planWeave({
    request: {
      targets: [{ designatorPath: "" }],
    },
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: createPlan.updatedFiles[0]!.contents,
    weaveableKnops: [{
      designatorPath: "",
      currentKnopMetadataTurtle: createPlan.createdFiles[0]!.contents,
      currentKnopInventoryTurtle: createPlan.createdFiles[1]!.contents,
    }],
  });

  assertEquals(plan.wovenDesignatorPaths, [""]);
  assertEquals(
    plan.createdFiles.map((file) => file.path),
    [
      "_mesh/_inventory/_history001/_s0006/inventory-ttl/inventory.ttl",
      "_knop/_meta/_history001/_s0001/meta-ttl/meta.ttl",
      "_knop/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl",
    ],
  );
  assertEquals(plan.createdPages[0], {
    kind: "simple",
    path: "_mesh/_inventory/_history001/_s0006/index.html",
    description: "Resource page for the sixth MeshInventory historical state.",
  });
  assertEquals(plan.createdPages[2], {
    kind: "identifier",
    path: "index.html",
    designatorPath: "",
    workingLocalRelativePath: undefined,
  });
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "sflo:latestHistoricalState <_mesh/_inventory/_history001/_s0006> ;",
  );
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "<>\n  sflo:hasResourcePage <index.html> .",
  );
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "<_knop> a sflo:Knop ;\n  sflo:hasWorkingKnopInventoryFile <_knop/_inventory/inventory.ttl> ;\n  sflo:hasResourcePage <_knop/index.html> .",
  );
});

Deno.test("planWeave applies requested payload history and state naming on the first payload weave slice", () => {
  const plan = planWeave({
    request: {
      targets: [{
        designatorPath: "alice/bio",
        historySegment: "releases",
        stateSegment: "v0.0.1",
      }],
    },
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: firstPayloadWeaveMeshInventoryTurtle,
    weaveableKnops: [{
      designatorPath: "alice/bio",
      currentKnopMetadataTurtle: firstPayloadWeaveKnopMetadataTurtle,
      currentKnopInventoryTurtle: firstPayloadWeaveKnopInventoryTurtle,
      payloadArtifact: {
        workingLocalRelativePath: "alice-bio.ttl",
        currentPayloadTurtle:
          `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix schema: <https://schema.org/> .

<alice> a schema:Person .
`,
      },
    }],
  });

  assertEquals(
    plan.createdFiles.map((file) => file.path),
    [
      "_mesh/_inventory/_history001/_s0003/inventory-ttl/inventory.ttl",
      "alice/bio/releases/v0.0.1/alice-bio-ttl/alice-bio.ttl",
      "alice/bio/_knop/_meta/_history001/_s0001/meta-ttl/meta.ttl",
      "alice/bio/_knop/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl",
    ],
  );
  assertStringIncludes(
    plan.updatedFiles[1]?.contents ?? "",
    "sflo:currentArtifactHistory <alice/bio/releases> ;",
  );
  assertStringIncludes(
    plan.updatedFiles[1]?.contents ?? "",
    "sflo:latestHistoricalState <alice/bio/releases/v0.0.1> ;",
  );
  assertEquals(
    plan.createdPages.slice(2, 5).map((page) => page.path),
    [
      "alice/bio/index.html",
      "alice/bio/releases/index.html",
      "alice/bio/releases/v0.0.1/index.html",
    ],
  );
});

Deno.test("planWeave applies requested payload manifestation naming on the first payload weave slice", () => {
  const plan = planWeave({
    request: {
      targets: [{
        designatorPath: "alice/bio",
        historySegment: "releases",
        stateSegment: "v0.0.1",
        manifestationSegment: "ttl",
      }],
    },
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: firstPayloadWeaveMeshInventoryTurtle,
    weaveableKnops: [{
      designatorPath: "alice/bio",
      currentKnopMetadataTurtle: firstPayloadWeaveKnopMetadataTurtle,
      currentKnopInventoryTurtle: firstPayloadWeaveKnopInventoryTurtle,
      payloadArtifact: {
        workingLocalRelativePath: "alice-bio.ttl",
        currentPayloadTurtle:
          `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix schema: <https://schema.org/> .

<alice> a schema:Person .
`,
      },
    }],
  });

  assert(
    plan.createdFiles.some((file) =>
      file.path === "alice/bio/releases/v0.0.1/ttl/alice-bio.ttl"
    ),
  );
  assert(
    plan.createdPages.some((page) =>
      page.path === "alice/bio/releases/v0.0.1/ttl/index.html"
    ),
  );
  assertStringIncludes(
    plan.updatedFiles[1]?.contents ?? "",
    "sflo:hasManifestation <alice/bio/releases/v0.0.1/ttl> ;",
  );
  assertStringIncludes(
    plan.updatedFiles[1]?.contents ?? "",
    "sflo:locatedFileForState <alice/bio/releases/v0.0.1/ttl/alice-bio.ttl> ;",
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
        workingLocalRelativePath: "alice-bio.ttl",
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
        workingLocalRelativePath: "alice/_knop/_references/references.ttl",
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
        workingLocalRelativePath: "alice/_knop/_references/references.ttl",
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
  const workingLocalRelativePath =
    "alice/_knop/_references/reference-links-v1.ttl";
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
          workingLocalRelativePath,
        ),
      referenceCatalogArtifact: {
        workingLocalRelativePath,
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
    `sflo:hasWorkingLocatedFile <${workingLocalRelativePath}> ;`,
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
        workingLocalRelativePath: "carol/_knop/_references/references.ttl",
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
        workingLocalRelativePath: "alice-bio.ttl",
        currentArtifactHistoryPath: "alice/bio/_history001",
        currentPayloadTurtle:
          `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix schema: <https://schema.org/> .

<alice> a schema:Person .
<alice/bio> dcterms:creator <alice> .
`,
        latestHistoricalStatePath: "alice/bio/_history001/_s0001",
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

Deno.test("planWeave applies requested payload naming on the second payload weave slice", () => {
  const currentKnopInventoryTurtle = secondPayloadWeaveKnopInventoryTurtle
    .replaceAll(
      "alice/bio/_history001/_s0001",
      "alice/bio/releases/v0.0.1",
    )
    .replaceAll("alice/bio/_history001", "alice/bio/releases");
  const plan = planWeave({
    request: {
      targets: [{
        designatorPath: "alice/bio",
        historySegment: "releases",
        stateSegment: "v0.0.2",
        manifestationSegment: "ttl",
      }],
    },
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: firstReferenceCatalogWeaveMeshInventoryTurtle,
    weaveableKnops: [{
      designatorPath: "alice/bio",
      currentKnopMetadataTurtle: firstPayloadWeaveKnopMetadataTurtle,
      currentKnopInventoryTurtle,
      payloadArtifact: {
        workingLocalRelativePath: "alice-bio.ttl",
        currentArtifactHistoryPath: "alice/bio/releases",
        currentPayloadTurtle:
          `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix schema: <https://schema.org/> .

<alice> a schema:Person .
<alice/bio> dcterms:creator <alice> .
`,
        latestHistoricalStatePath: "alice/bio/releases/v0.0.1",
      },
    }],
  });

  assertEquals(
    plan.createdFiles.map((file) => file.path),
    [
      "alice/bio/releases/v0.0.2/ttl/alice-bio.ttl",
      "alice/bio/_knop/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl",
    ],
  );
  assertEquals(plan.createdPages.map((page) => page.path), [
    "alice/bio/releases/v0.0.2/index.html",
    "alice/bio/releases/v0.0.2/ttl/index.html",
    "alice/bio/_knop/_inventory/_history001/_s0002/index.html",
    "alice/bio/_knop/_inventory/_history001/_s0002/inventory-ttl/index.html",
  ]);
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "sflo:previousHistoricalState <alice/bio/releases/v0.0.1> ;",
  );
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "sflo:latestHistoricalState <alice/bio/releases/v0.0.2> ;",
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

Deno.test("detectPendingWeaveSlice supports custom payload history and state naming", () => {
  const customNamedKnopInventoryTurtle = secondPayloadWeaveKnopInventoryTurtle
    .replaceAll(
      "alice/bio/_history001/_s0001",
      "alice/bio/releases/v0.0.1",
    )
    .replaceAll("alice/bio/_history001", "alice/bio/releases");

  assertEquals(
    detectPendingWeaveSlice(
      "https://semantic-flow.github.io/mesh-alice-bio/",
      "alice/bio",
      customNamedKnopInventoryTurtle,
    ),
    "secondPayloadWeave",
  );
});

Deno.test("planWeave rejects a mismatched requested payload history on the second payload weave slice", () => {
  const currentKnopInventoryTurtle = secondPayloadWeaveKnopInventoryTurtle
    .replaceAll(
      "alice/bio/_history001/_s0001",
      "alice/bio/releases/v0.0.1",
    )
    .replaceAll("alice/bio/_history001", "alice/bio/releases");

  assertThrows(
    () =>
      planWeave({
        request: {
          targets: [{
            designatorPath: "alice/bio",
            historySegment: "archive",
            stateSegment: "v0.0.2",
          }],
        },
        meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
        currentMeshInventoryTurtle:
          firstReferenceCatalogWeaveMeshInventoryTurtle,
        weaveableKnops: [{
          designatorPath: "alice/bio",
          currentKnopMetadataTurtle: firstPayloadWeaveKnopMetadataTurtle,
          currentKnopInventoryTurtle,
          payloadArtifact: {
            workingLocalRelativePath: "alice-bio.ttl",
            currentArtifactHistoryPath: "alice/bio/releases",
            currentPayloadTurtle:
              `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix schema: <https://schema.org/> .

<alice> a schema:Person .
<alice/bio> dcterms:creator <alice> .
`,
            latestHistoricalStatePath: "alice/bio/releases/v0.0.1",
          },
        }],
      }),
    WeaveInputError,
    "does not match the current payload history",
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
    workingLocalRelativePath: "bob/_knop/_references/references.ttl",
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

Deno.test("planWeave accepts extracted weave inputs sourced from the root payload", () => {
  const extractPlan = planExtract({
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: rootSourcePreExtractMeshInventoryTurtle,
    designatorPath: "alice/bio",
    referenceTargetDesignatorPath: "",
    referenceTargetStatePath: "_history001/_s0001",
    referenceTargetWorkingLocalRelativePath: "root-person.ttl",
  });
  const createdFileByPath = new Map(
    extractPlan.createdFiles.map((file) => [file.path, file.contents]),
  );

  const plan = planWeave({
    request: {
      targets: [{ designatorPath: "alice/bio" }],
    },
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: extractPlan.updatedFiles[0]!.contents,
    weaveableKnops: [{
      designatorPath: "alice/bio",
      currentKnopMetadataTurtle: createdFileByPath.get(
        "alice/bio/_knop/_meta/meta.ttl",
      )!,
      currentKnopInventoryTurtle: createdFileByPath.get(
        "alice/bio/_knop/_inventory/inventory.ttl",
      )!,
      referenceCatalogArtifact: {
        workingLocalRelativePath: "alice/bio/_knop/_references/references.ttl",
        currentReferenceCatalogTurtle: createdFileByPath.get(
          "alice/bio/_knop/_references/references.ttl",
        )!,
      },
      referenceTargetSourcePayloadArtifact: {
        designatorPath: "",
        workingLocalRelativePath: "root-person.ttl",
        currentPayloadTurtle: rootSourcePersonPayloadTurtle,
        latestHistoricalStatePath: "_history001/_s0001",
      },
    }],
  });

  assertEquals(plan.wovenDesignatorPaths, ["alice/bio"]);
  assertEquals(
    plan.createdPages.find((page) =>
      page.path === "alice/bio/_knop/_references/index.html"
    ),
    {
      kind: "referenceCatalog",
      path: "alice/bio/_knop/_references/index.html",
      catalogPath: "alice/bio/_knop/_references",
      ownerDesignatorPath: "alice/bio",
      currentLinks: [{
        fragment: "reference001",
        referenceRoleLabel: "supplemental",
        referenceTargetPath: "",
        referenceTargetStatePath: "_history001/_s0001",
      }],
    },
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

Deno.test("detectPendingWeaveSlice recognizes the page-definition weave slice", async () => {
  assertEquals(
    detectPendingWeaveSlice(
      "https://semantic-flow.github.io/mesh-alice-bio/",
      "alice",
      await readMeshAliceBioBranchFile(
        "14-alice-page-customized",
        "alice/_knop/_inventory/inventory.ttl",
      ),
    ),
    "pageDefinitionWeave",
  );
});

Deno.test("planWeave renders the first page-definition weave slice", async () => {
  const meshBase = "https://semantic-flow.github.io/mesh-alice-bio/";
  const pageDefinitionTurtle = await readMeshAliceBioBranchFile(
    "14-alice-page-customized",
    "alice/_knop/_page/page.ttl",
  );
  const plan = planWeave({
    request: {
      targets: [{ designatorPath: "alice" }],
    },
    meshBase,
    currentMeshInventoryTurtle: await readMeshAliceBioBranchFile(
      "14-alice-page-customized",
      "_mesh/_inventory/inventory.ttl",
    ),
    weaveableKnops: [{
      designatorPath: "alice",
      currentKnopMetadataTurtle: await readMeshAliceBioBranchFile(
        "14-alice-page-customized",
        "alice/_knop/_meta/meta.ttl",
      ),
      currentKnopInventoryTurtle: await readMeshAliceBioBranchFile(
        "14-alice-page-customized",
        "alice/_knop/_inventory/inventory.ttl",
      ),
      resourcePageDefinitionArtifact: {
        artifactPath: "alice/_knop/_page",
        workingLocalRelativePath: "alice/_knop/_page/page.ttl",
        currentPageDefinitionTurtle: pageDefinitionTurtle,
        currentArtifactHistoryExists: false,
        assetBundlePath: "alice/_knop/_assets",
      },
    }],
  });

  assertEquals(plan.wovenDesignatorPaths, ["alice"]);
  assertEquals(plan.updatedFiles.map((file) => file.path), [
    "alice/_knop/_inventory/inventory.ttl",
  ]);
  assertEquals(plan.createdFiles.map((file) => file.path), [
    "alice/_knop/_page/_history001/_s0001/page-ttl/page.ttl",
    "alice/_knop/_inventory/_history001/_s0003/inventory-ttl/inventory.ttl",
  ]);
  assertEquals(plan.createdFiles[0]?.contents, pageDefinitionTurtle);
  assertEquals(
    await compareRdfContent({
      left: new TextEncoder().encode(plan.updatedFiles[0]?.contents ?? ""),
      right: new TextEncoder().encode(
        await readMeshAliceBioBranchFile(
          "15-alice-page-customized-woven",
          "alice/_knop/_inventory/inventory.ttl",
        ),
      ),
      path: "alice/_knop/_inventory/inventory.ttl",
    }),
    true,
  );
  assertEquals(plan.createdPages.map((page) => page.path), [
    "alice/index.html",
    "alice/_knop/_inventory/_history001/_s0003/index.html",
    "alice/_knop/_inventory/_history001/_s0003/inventory-ttl/index.html",
    "alice/_knop/_page/index.html",
    "alice/_knop/_page/_history001/index.html",
    "alice/_knop/_page/_history001/_s0001/index.html",
    "alice/_knop/_page/_history001/_s0001/page-ttl/index.html",
  ]);
});

Deno.test("planWeave generalizes the first page-definition weave slice for earlier KnopInventory states", async () => {
  const meshBase = "https://semantic-flow.github.io/mesh-alice-bio/";
  const currentKnopInventoryTurtle = (
    await readMeshAliceBioBranchFile(
      "13-bob-extracted-woven",
      "bob/_knop/_inventory/inventory.ttl",
    )
  )
    .replace(
      "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n",
      "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n@prefix sfc: <https://semantic-flow.github.io/ontology/core/> .\n",
    )
    .replace(
      `  sflo:hasReferenceCatalog <bob/_knop/_references> ;\n  sflo:hasWorkingKnopInventoryFile <bob/_knop/_inventory/inventory.ttl> ;\n  sflo:hasResourcePage <bob/_knop/index.html> .\n`,
      `  sflo:hasReferenceCatalog <bob/_knop/_references> ;\n  sflo:hasWorkingKnopInventoryFile <bob/_knop/_inventory/inventory.ttl> ;\n  sflo:hasResourcePage <bob/_knop/index.html> ;\n  sfc:hasResourcePageDefinition <bob/_knop/_page> .\n`,
    )
    .replace(
      `<bob/_knop/_references> a sflo:ReferenceCatalog, sflo:DigitalArtifact, sflo:RdfDocument ;\n  sflo:hasArtifactHistory <bob/_knop/_references/_history001> ;\n  sflo:currentArtifactHistory <bob/_knop/_references/_history001> ;\n  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;\n  sflo:hasWorkingLocatedFile <bob/_knop/_references/references.ttl> ;\n  sflo:hasResourcePage <bob/_knop/_references/index.html> .\n`,
      `<bob/_knop/_references> a sflo:ReferenceCatalog, sflo:DigitalArtifact, sflo:RdfDocument ;\n  sflo:hasArtifactHistory <bob/_knop/_references/_history001> ;\n  sflo:currentArtifactHistory <bob/_knop/_references/_history001> ;\n  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;\n  sflo:hasWorkingLocatedFile <bob/_knop/_references/references.ttl> ;\n  sflo:hasResourcePage <bob/_knop/_references/index.html> .\n\n<bob/_knop/_page> a sfc:ResourcePageDefinition, sflo:DigitalArtifact, sflo:RdfDocument ;\n  sflo:hasWorkingLocatedFile <bob/_knop/_page/page.ttl> .\n`,
    )
    .replace(
      `<bob/_knop/_references/references.ttl> a sflo:LocatedFile, sflo:RdfDocument .\n`,
      `<bob/_knop/_references/references.ttl> a sflo:LocatedFile, sflo:RdfDocument .\n\n<bob/_knop/_page/page.ttl> a sflo:LocatedFile, sflo:RdfDocument .\n`,
    );
  const pageDefinitionTurtle =
    `@base <https://semantic-flow.github.io/mesh-alice-bio/bob/_knop/_page> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@prefix sfc: <https://semantic-flow.github.io/ontology/core/> .

<> a sfc:ResourcePageDefinition, sflo:DigitalArtifact, sflo:RdfDocument ;
  sfc:hasPageRegion <#main-region> .

<#main-region> a sfc:ResourcePageRegion ;
  sfc:regionKey "main" ;
  sfc:hasResourcePageSource <#main-source> .

<#main-source> a sfc:ResourcePageSource ;
  sfc:hasTargetArtifact <https://semantic-flow.github.io/mesh-alice-bio/bob/page-main> ;
  sfc:hasArtifactResolutionMode <https://semantic-flow.github.io/ontology/core/ArtifactResolutionMode/Current> .
`;
  const plan = planWeave({
    request: {
      targets: [{ designatorPath: "bob" }],
    },
    meshBase,
    currentMeshInventoryTurtle: await readMeshAliceBioBranchFile(
      "13-bob-extracted-woven",
      "_mesh/_inventory/inventory.ttl",
    ),
    weaveableKnops: [{
      designatorPath: "bob",
      currentKnopMetadataTurtle: await readMeshAliceBioBranchFile(
        "13-bob-extracted-woven",
        "bob/_knop/_meta/meta.ttl",
      ),
      currentKnopInventoryTurtle,
      resourcePageDefinitionArtifact: {
        artifactPath: "bob/_knop/_page",
        workingLocalRelativePath: "bob/_knop/_page/page.ttl",
        currentPageDefinitionTurtle: pageDefinitionTurtle,
        currentArtifactHistoryExists: false,
      },
    }],
  });

  assertEquals(plan.wovenDesignatorPaths, ["bob"]);
  assertEquals(plan.updatedFiles.map((file) => file.path), [
    "bob/_knop/_inventory/inventory.ttl",
  ]);
  assertEquals(plan.createdFiles.map((file) => file.path), [
    "bob/_knop/_page/_history001/_s0001/page-ttl/page.ttl",
    "bob/_knop/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl",
  ]);
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "sflo:latestHistoricalState <bob/_knop/_inventory/_history001/_s0002> ;",
  );
  assertFalse(
    (plan.updatedFiles[0]?.contents ?? "").includes(
      "sflo:latestHistoricalState <bob/_knop/_inventory/_history001/_s0003> ;",
    ),
  );
  assertEquals(plan.createdPages.map((page) => page.path), [
    "bob/index.html",
    "bob/_knop/_inventory/_history001/_s0002/index.html",
    "bob/_knop/_inventory/_history001/_s0002/inventory-ttl/index.html",
    "bob/_knop/_page/index.html",
    "bob/_knop/_page/_history001/index.html",
    "bob/_knop/_page/_history001/_s0001/index.html",
    "bob/_knop/_page/_history001/_s0001/page-ttl/index.html",
  ]);
});

Deno.test("planWeave renders a later page-definition weave revision", async () => {
  const meshBase = "https://semantic-flow.github.io/mesh-alice-bio/";
  const currentPageDefinitionTurtle = (
    await readMeshAliceBioBranchFile(
      "17-alice-page-main-integrated-woven",
      "alice/_knop/_page/page.ttl",
    )
  ).replace(
    `<#main-source> a sfc:ResourcePageSource ;
  sfc:targetLocalRelativePath "alice/alice.md" .`,
    `<#main-source> a sfc:ResourcePageSource ;
  sfc:hasTargetArtifact <https://semantic-flow.github.io/mesh-alice-bio/alice/page-main> ;
  sfc:hasArtifactResolutionMode <https://semantic-flow.github.io/ontology/core/ArtifactResolutionMode/Current> .`,
  );
  const latestHistoricalSnapshotTurtle = await readMeshAliceBioBranchFile(
    "17-alice-page-main-integrated-woven",
    "alice/_knop/_page/_history001/_s0001/page-ttl/page.ttl",
  );
  const plan = planWeave({
    request: {
      targets: [{ designatorPath: "alice" }],
    },
    meshBase,
    currentMeshInventoryTurtle: await readMeshAliceBioBranchFile(
      "17-alice-page-main-integrated-woven",
      "_mesh/_inventory/inventory.ttl",
    ),
    weaveableKnops: [{
      designatorPath: "alice",
      currentKnopMetadataTurtle: await readMeshAliceBioBranchFile(
        "17-alice-page-main-integrated-woven",
        "alice/_knop/_meta/meta.ttl",
      ),
      currentKnopInventoryTurtle: await readMeshAliceBioBranchFile(
        "17-alice-page-main-integrated-woven",
        "alice/_knop/_inventory/inventory.ttl",
      ),
      resourcePageDefinitionArtifact: {
        artifactPath: "alice/_knop/_page",
        workingLocalRelativePath: "alice/_knop/_page/page.ttl",
        currentPageDefinitionTurtle,
        currentArtifactHistoryPath: "alice/_knop/_page/_history001",
        currentArtifactHistoryExists: true,
        latestHistoricalStatePath: "alice/_knop/_page/_history001/_s0001",
        latestHistoricalSnapshotTurtle,
        assetBundlePath: "alice/_knop/_assets",
      },
    }],
  });

  assertEquals(plan.wovenDesignatorPaths, ["alice"]);
  assertEquals(plan.updatedFiles.map((file) => file.path), [
    "alice/_knop/_inventory/inventory.ttl",
  ]);
  assertEquals(plan.createdFiles.map((file) => file.path), [
    "alice/_knop/_page/_history001/_s0002/page-ttl/page.ttl",
    "alice/_knop/_inventory/_history001/_s0004/inventory-ttl/inventory.ttl",
  ]);
  assertEquals(plan.createdFiles[0]?.contents, currentPageDefinitionTurtle);
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "sflo:latestHistoricalState <alice/_knop/_page/_history001/_s0002> ;",
  );
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "sflo:latestHistoricalState <alice/_knop/_inventory/_history001/_s0004> ;",
  );
  assertEquals(plan.createdPages.map((page) => page.path), [
    "alice/index.html",
    "alice/_knop/_inventory/_history001/_s0004/index.html",
    "alice/_knop/_inventory/_history001/_s0004/inventory-ttl/index.html",
    "alice/_knop/_page/index.html",
    "alice/_knop/_page/_history001/index.html",
    "alice/_knop/_page/_history001/_s0002/index.html",
    "alice/_knop/_page/_history001/_s0002/page-ttl/index.html",
  ]);
});

Deno.test("planWeave renders a root page-definition weave without requiring a reference catalog", async () => {
  const meshBase = "https://semantic-flow.github.io/mesh-alice-bio/";
  const currentPageDefinitionTurtle = await readMeshAliceBioBranchFile(
    "24-root-page-customized",
    "_knop/_page/page.ttl",
  );
  const plan = planWeave({
    request: {
      targets: [{ designatorPath: "" }],
    },
    meshBase,
    currentMeshInventoryTurtle: await readMeshAliceBioBranchFile(
      "24-root-page-customized",
      "_mesh/_inventory/inventory.ttl",
    ),
    weaveableKnops: [{
      designatorPath: "",
      currentKnopMetadataTurtle: await readMeshAliceBioBranchFile(
        "24-root-page-customized",
        "_knop/_meta/meta.ttl",
      ),
      currentKnopInventoryTurtle: await readMeshAliceBioBranchFile(
        "24-root-page-customized",
        "_knop/_inventory/inventory.ttl",
      ),
      resourcePageDefinitionArtifact: {
        artifactPath: "_knop/_page",
        workingLocalRelativePath: "_knop/_page/page.ttl",
        currentPageDefinitionTurtle,
        currentArtifactHistoryExists: false,
        assetBundlePath: "_knop/_assets",
      },
    }],
  });

  assertEquals(plan.wovenDesignatorPaths, [""]);
  assertEquals(plan.updatedFiles.map((file) => file.path), [
    "_knop/_inventory/inventory.ttl",
  ]);
  assertEquals(plan.createdFiles.map((file) => file.path), [
    "_knop/_page/_history001/_s0001/page-ttl/page.ttl",
    "_knop/_inventory/_history001/_s0002/inventory-ttl/inventory.ttl",
  ]);
  assertEquals(plan.createdFiles[0]?.contents, currentPageDefinitionTurtle);
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "sflo:latestHistoricalState <_knop/_page/_history001/_s0001> ;",
  );
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "sflo:latestHistoricalState <_knop/_inventory/_history001/_s0002> ;",
  );
  assertEquals(plan.createdPages.map((page) => page.path), [
    "index.html",
    "_knop/_inventory/_history001/_s0002/index.html",
    "_knop/_inventory/_history001/_s0002/inventory-ttl/index.html",
    "_knop/_page/index.html",
    "_knop/_page/_history001/index.html",
    "_knop/_page/_history001/_s0001/index.html",
    "_knop/_page/_history001/_s0001/page-ttl/index.html",
  ]);
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
        workingLocalRelativePath: "bob/_knop/_references/references.ttl",
        currentReferenceCatalogTurtle: await readMeshAliceBioBranchFile(
          "12-bob-extracted",
          "bob/_knop/_references/references.ttl",
        ),
      },
      referenceTargetSourcePayloadArtifact: {
        designatorPath: "alice/bio",
        workingLocalRelativePath: "alice-bio.ttl",
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
