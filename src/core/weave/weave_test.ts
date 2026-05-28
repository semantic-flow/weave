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

function meshMetadataProgressionTurtle(
  latestStatePath: string,
  nextStateOrdinal: number,
  nextStateSegmentHint?: string,
): string {
  const historyPath = latestStatePath.slice(
    0,
    latestStatePath.lastIndexOf("/"),
  );
  const hint = nextStateSegmentHint === undefined ? "" : ` ;
  sfcfg:hasNextStateSegmentHint "${nextStateSegmentHint}"`;

  return `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<_mesh> a sflo:SemanticMesh ;
  sflo:meshBase "https://semantic-flow.github.io/mesh-alice-bio/"^^xsd:anyURI ;
  sflo:hasMeshInventory <_mesh/_inventory> .

<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:currentArtifactHistory <${historyPath}> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger .

<${historyPath}> a sflo:ArtifactHistory ;
  sflo:latestHistoricalState <${latestStatePath}> ;
  sflo:nextStateOrdinal "${nextStateOrdinal}"^^xsd:nonNegativeInteger${hint} .
`;
}

const firstWeaveMeshInventoryTurtle =
  `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
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

const firstWeaveMeshMetadataTurtle = meshMetadataProgressionTurtle(
  "_mesh/_inventory/_history001/_s0001",
  2,
);

const sidecarMeshCreatedInventoryTurtle =
  `@base <https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .
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
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<alice/_knop> a sflo:Knop ;
  sflo:designatorPath "alice" ;
  sflo:hasWorkingKnopInventoryFile <alice/_knop/_inventory/inventory.ttl> .
`;

const rootSourcePreExtractMeshInventoryTurtle =
  `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
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
  foaf:knows <alice/data> .

<alice/data> a schema:Person ;
  foaf:givenName "Alice" ;
  foaf:nick "alice-bio" .
`;

const firstWeaveKnopInventoryTurtle =
  `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<alice/_knop> a sflo:Knop ;
  sflo:hasKnopMetadata <alice/_knop/_meta> ;
  sflo:hasKnopInventory <alice/_knop/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <alice/_knop/_inventory/inventory.ttl> .
`;

Deno.test("planMeshSupportResourcePages adds current support ResourcePages including config", () => {
  const plan = planMeshSupportResourcePages({
    meshBase: "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
    currentMeshInventoryTurtle: sidecarMeshCreatedInventoryTurtle,
    currentMeshMetadataTurtle:
      `@base <https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<_mesh> a sflo:SemanticMesh .
`,
    currentMeshConfigTurtle:
      `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:MeshConfig .
`,
    supportHistoryPolicies: {
      meshMetadata: "currentOnly",
      meshInventory: "currentOnly",
      config: "versioned",
    },
  });

  assertEquals(plan.versionedDesignatorPaths, []);
  assertEquals(
    plan.createdFiles.map((file) => file.path),
    [
      "_mesh/_config/_history001/_s0001/ttl/config.ttl",
    ],
  );
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
    "sflo:hasWorkingLocatedFile <_mesh/_config/config.ttl> ;\n  sflo:hasResourcePage <_mesh/_config/index.html> ;\n  sflo:hasArtifactHistory <_mesh/_config/_history001> ;",
  );
  assertStringIncludes(
    inventory,
    "sflo:hasWorkingLocatedFile <_mesh/_meta/meta.ttl> ;\n  sflo:hasResourcePage <_mesh/_meta/index.html> .",
  );
  assertStringIncludes(
    inventory,
    "sflo:hasWorkingLocatedFile <_mesh/_inventory/inventory.ttl> ;\n  sflo:hasResourcePage <_mesh/_inventory/index.html> .",
  );
  assertStringIncludes(
    inventory,
    "<_mesh/_config/index.html> a sflo:ResourcePage, sflo:LocatedFile .",
  );
  assertFalse(
    inventory.includes(
      "sflo:currentArtifactHistory <_mesh/_inventory/_history001>",
    ),
  );
  assertFalse(
    inventory.includes(
      "sflo:currentArtifactHistory <_mesh/_meta/_history001>",
    ),
  );
  assertStringIncludes(
    inventory,
    "<_mesh/_config/_history001/_s0001/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;",
  );
});

Deno.test("planMeshSupportResourcePages records initial mesh inventory progression in metadata", () => {
  const plan = planMeshSupportResourcePages({
    meshBase: "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
    currentMeshInventoryTurtle: sidecarMeshCreatedInventoryTurtle,
    currentMeshMetadataTurtle:
      `@base <https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<_mesh> a sflo:SemanticMesh .
`,
    currentMeshConfigTurtle:
      `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:MeshConfig .
`,
    supportHistoryPolicies: {
      meshMetadata: "versioned",
      meshInventory: "versioned",
      config: "versioned",
    },
  });

  assertEquals(
    plan.updatedFiles.map((file) => file.path),
    ["_mesh/_meta/meta.ttl", "_mesh/_inventory/inventory.ttl"],
  );
  const updatedMetadata =
    plan.updatedFiles.find((file) => file.path === "_mesh/_meta/meta.ttl")
      ?.contents ?? "";
  assertStringIncludes(
    updatedMetadata,
    "sflo:currentArtifactHistory <_mesh/_inventory/_history001> ;",
  );
  assertStringIncludes(
    updatedMetadata,
    "sflo:latestHistoricalState <_mesh/_inventory/_history001/_s0001> ;",
  );
  assertStringIncludes(
    plan.createdFiles.find((file) =>
      file.path === "_mesh/_meta/_history001/_s0001/ttl/meta.ttl"
    )?.contents ?? "",
    "sflo:latestHistoricalState <_mesh/_inventory/_history001/_s0001> ;",
  );
});

Deno.test("planMeshSupportResourcePages omits suppressed support ResourcePage facts", () => {
  const plan = planMeshSupportResourcePages({
    meshBase: "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
    currentMeshInventoryTurtle: sidecarMeshCreatedInventoryTurtle,
    currentMeshMetadataTurtle:
      `@base <https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<_mesh> a sflo:SemanticMesh .
`,
    currentMeshConfigTurtle:
      `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:MeshConfig .
`,
    supportHistoryPolicies: {
      meshMetadata: "currentOnly",
      meshInventory: "currentOnly",
      config: "versioned",
    },
    resourcePageGenerationPolicies: {
      config: "suppress",
    },
  });

  const inventory = plan.updatedFiles[0]?.contents ?? "";
  assertFalse(inventory.includes("_mesh/_config/index.html"));
  assertFalse(inventory.includes("_mesh/_config/_history001/index.html"));
  assertFalse(
    inventory.includes("_mesh/_config/_history001/_s0001/index.html"),
  );
  assertStringIncludes(
    inventory,
    "sflo:hasWorkingLocatedFile <_mesh/_config/config.ttl> ;\n  sflo:hasArtifactHistory <_mesh/_config/_history001> ;",
  );
  assertStringIncludes(
    inventory,
    "<_mesh/_config/_history001/_s0001/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;",
  );
});

const firstPayloadWeaveMeshInventoryTurtle =
  `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
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

<alice/data> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <alice-data.ttl> .

<alice/data/_knop> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <alice/data/_knop/_inventory/inventory.ttl> .
`;

const firstPayloadWeaveMeshMetadataTurtle = meshMetadataProgressionTurtle(
  "_mesh/_inventory/_history001/_s0002",
  3,
);

const firstPayloadWeaveKnopMetadataTurtle =
  `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<alice/data/_knop> a sflo:Knop ;
  sflo:designatorPath "alice/data" ;
  sflo:hasWorkingKnopInventoryFile <alice/data/_knop/_inventory/inventory.ttl> .
`;

const firstPayloadWeaveKnopInventoryTurtle =
  `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<alice/data/_knop> a sflo:Knop ;
  sflo:hasKnopMetadata <alice/data/_knop/_meta> ;
  sflo:hasKnopInventory <alice/data/_knop/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <alice/data/_knop/_inventory/inventory.ttl> ;
  sflo:hasPayloadArtifact <alice/data> .

<alice/data> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <alice-data.ttl> .
`;

const laterFirstPayloadWeaveMeshInventoryTurtle =
  `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<_mesh> a sflo:SemanticMesh ;
  sflo:meshBase "https://semantic-flow.github.io/mesh-alice-bio/"^^xsd:anyURI ;
  sflo:hasMeshMetadata <_mesh/_meta> ;
  sflo:hasMeshInventory <_mesh/_inventory> ;
  sflo:hasKnop <alice/_knop> ;
  sflo:hasKnop <alice/data/_knop> ;
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
  sflo:hasManifestation <_mesh/_inventory/_history001/_s0001/ttl> ;
  sflo:locatedFileForState <_mesh/_inventory/_history001/_s0001/ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0001/index.html> .

<_mesh/_inventory/_history001/_s0001/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <_mesh/_inventory/_history001/_s0001/ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0001/ttl/index.html> .

<_mesh/_inventory/_history001/_s0002> a sflo:HistoricalState ;
  sflo:stateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:previousHistoricalState <_mesh/_inventory/_history001/_s0001> ;
  sflo:hasManifestation <_mesh/_inventory/_history001/_s0002/ttl> ;
  sflo:locatedFileForState <_mesh/_inventory/_history001/_s0002/ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0002/index.html> .

<_mesh/_inventory/_history001/_s0002/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <_mesh/_inventory/_history001/_s0002/ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0002/ttl/index.html> .

<_mesh/_inventory/_history001/_s0003> a sflo:HistoricalState ;
  sflo:stateOrdinal "3"^^xsd:nonNegativeInteger ;
  sflo:previousHistoricalState <_mesh/_inventory/_history001/_s0002> ;
  sflo:hasManifestation <_mesh/_inventory/_history001/_s0003/ttl> ;
  sflo:locatedFileForState <_mesh/_inventory/_history001/_s0003/ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0003/index.html> .

<_mesh/_inventory/_history001/_s0003/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <_mesh/_inventory/_history001/_s0003/ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0003/ttl/index.html> .

<_mesh/_inventory/_history001/_s0004> a sflo:HistoricalState ;
  sflo:stateOrdinal "4"^^xsd:nonNegativeInteger ;
  sflo:previousHistoricalState <_mesh/_inventory/_history001/_s0003> ;
  sflo:hasManifestation <_mesh/_inventory/_history001/_s0004/ttl> ;
  sflo:locatedFileForState <_mesh/_inventory/_history001/_s0004/ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0004/index.html> .

<_mesh/_inventory/_history001/_s0004/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <_mesh/_inventory/_history001/_s0004/ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0004/ttl/index.html> .

<_mesh/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/_history001/_s0001/ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/_history001/_s0002/ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/_history001/_s0003/ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/_history001/_s0004/ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<alice/_knop/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<alice/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0001/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0002/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0002/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0003/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0003/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0004/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0004/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`;

const laterFirstPayloadWeaveMeshMetadataTurtle = meshMetadataProgressionTurtle(
  "_mesh/_inventory/_history001/_s0004",
  5,
  "release-candidate",
);

const laterFirstPayloadWeaveKnopMetadataTurtle =
  `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<alice/page-main/_knop> a sflo:Knop ;
  sflo:designatorPath "alice/page-main" ;
  sflo:hasWorkingKnopInventoryFile <alice/page-main/_knop/_inventory/inventory.ttl> .
`;

const laterFirstPayloadWeaveKnopInventoryTurtle =
  `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

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
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
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

<alice/data> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <alice-data.ttl> .

<alice/data/_knop> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <alice/data/_knop/_inventory/inventory.ttl> .
`;

const firstReferenceCatalogWeaveMeshMetadataTurtle =
  meshMetadataProgressionTurtle(
    "_mesh/_inventory/_history001/_s0003",
    4,
  );

const firstReferenceCatalogWeaveKnopInventoryTurtle =
  `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
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
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<alice> sflo:hasReferenceLink <alice/_knop/_references#reference001> .

<alice/_knop/_references#reference001> a sflo:ReferenceLink ;
  sflo:referenceLinkFor <alice> ;
  sflo:hasReferenceRole <https://semantic-flow.github.io/sflo/ontology/referenceRole_canonical> ;
  sflo:hasReferenceSource <alice/_knop/_references#reference001-source> .

<alice/_knop/_references#reference001-source> a sflo:ReferenceSource ;
  sflo:targetArtifact <alice/data> .
`;

const secondPayloadWeaveKnopInventoryTurtle =
  `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<alice/data/_knop> a sflo:Knop ;
  sflo:hasKnopMetadata <alice/data/_knop/_meta> ;
  sflo:hasKnopInventory <alice/data/_knop/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <alice/data/_knop/_inventory/inventory.ttl> ;
  sflo:hasPayloadArtifact <alice/data> ;
  sflo:hasResourcePage <alice/data/_knop/index.html> .

<alice/data> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <alice/data/_history001> ;
  sflo:currentArtifactHistory <alice/data/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <alice-data.ttl> ;
  sflo:hasResourcePage <alice/data/index.html> .

<alice/data/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <alice/data/_history001/_s0001> ;
  sflo:latestHistoricalState <alice/data/_history001/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <alice/data/_history001/index.html> .

<alice/data/_history001/_s0001> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <alice/data/_history001/_s0001/alice-bio-ttl> ;
  sflo:locatedFileForState <alice/data/_history001/_s0001/ttl/alice-data.ttl> ;
  sflo:hasResourcePage <alice/data/_history001/_s0001/index.html> .

<alice/data/_history001/_s0001/alice-bio-ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <alice/data/_history001/_s0001/ttl/alice-data.ttl> ;
  sflo:hasResourcePage <alice/data/_history001/_s0001/ttl/index.html> .

<alice/data/_knop/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <alice/data/_knop/_inventory/_history001> ;
  sflo:currentArtifactHistory <alice/data/_knop/_inventory/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <alice/data/_knop/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <alice/data/_knop/_inventory/index.html> .

<alice/data/_knop/_inventory/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <alice/data/_knop/_inventory/_history001/_s0001> ;
  sflo:latestHistoricalState <alice/data/_knop/_inventory/_history001/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <alice/data/_knop/_inventory/_history001/index.html> .
`;

Deno.test("planWeave renders the first alice knop-created-woven slice", () => {
  const plan = planWeave({
    request: {},
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: firstWeaveMeshInventoryTurtle,
    currentMeshMetadataTurtle: firstWeaveMeshMetadataTurtle,
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
    "_mesh/_meta/meta.ttl",
  ]);
  assertEquals(
    plan.createdFiles.map((file) => file.path),
    [
      "_mesh/_inventory/_history001/_s0002/ttl/inventory.ttl",
      "alice/_knop/_meta/_history001/_s0001/ttl/meta.ttl",
      "alice/_knop/_inventory/_history001/_s0001/ttl/inventory.ttl",
    ],
  );
  assertEquals(plan.createdPages[2], {
    kind: "identifier",
    path: "alice/index.html",
    designatorPath: "alice",
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

Deno.test("planWeave applies current-only KnopMetadata policy on the first Knop weave slice", () => {
  const plan = planWeave({
    request: {},
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: firstWeaveMeshInventoryTurtle,
    currentMeshMetadataTurtle: firstWeaveMeshMetadataTurtle,
    weaveableKnops: [{
      designatorPath: "alice",
      currentKnopMetadataTurtle: firstWeaveKnopMetadataTurtle,
      currentKnopInventoryTurtle: firstWeaveKnopInventoryTurtle,
    }],
    supportHistoryPolicies: {
      knopMetadata: "currentOnly",
    },
  });

  assertEquals(
    plan.createdFiles.map((file) => file.path),
    [
      "_mesh/_inventory/_history001/_s0002/ttl/inventory.ttl",
      "alice/_knop/_inventory/_history001/_s0001/ttl/inventory.ttl",
    ],
  );
  const knopInventory = plan.updatedFiles[1]?.contents ?? "";
  assertStringIncludes(
    knopInventory,
    "sflo:hasWorkingLocatedFile <alice/_knop/_meta/meta.ttl> ;\n  sflo:hasResourcePage <alice/_knop/_meta/index.html> .",
  );
  assertFalse(knopInventory.includes("alice/_knop/_meta/_history001"));
  assertStringIncludes(knopInventory, "alice/_knop/_inventory/_history001");
  assert(
    plan.createdPages.some((page) =>
      page.path === "alice/_knop/_meta/index.html"
    ),
  );
  assertFalse(
    plan.createdPages.some((page) =>
      page.path.startsWith("alice/_knop/_meta/_history001")
    ),
  );
});

Deno.test("planWeave applies current-only MeshInventory policy on the first Knop weave slice", () => {
  const plan = planWeave({
    request: {},
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: firstWeaveMeshInventoryTurtle,
    currentMeshMetadataTurtle: firstWeaveMeshMetadataTurtle,
    weaveableKnops: [{
      designatorPath: "alice",
      currentKnopMetadataTurtle: firstWeaveKnopMetadataTurtle,
      currentKnopInventoryTurtle: firstWeaveKnopInventoryTurtle,
    }],
    supportHistoryPolicies: {
      meshInventory: "currentOnly",
    },
  });

  assertEquals(plan.updatedFiles.map((file) => file.path), [
    "_mesh/_inventory/inventory.ttl",
    "alice/_knop/_inventory/inventory.ttl",
  ]);
  assertEquals(
    plan.createdFiles.map((file) => file.path),
    [
      "alice/_knop/_meta/_history001/_s0001/ttl/meta.ttl",
      "alice/_knop/_inventory/_history001/_s0001/ttl/inventory.ttl",
    ],
  );
  assertFalse(
    plan.createdPages.some((page) =>
      page.path.startsWith("_mesh/_inventory/_history001/")
    ),
  );
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "<alice> sflo:hasResourcePage <alice/index.html> .",
  );
});

Deno.test("planWeave renders the first alice bio payload weave slice", () => {
  const plan = planWeave({
    request: {
      targets: [{ designatorPath: "alice/data" }],
    },
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: firstPayloadWeaveMeshInventoryTurtle,
    currentMeshMetadataTurtle: firstPayloadWeaveMeshMetadataTurtle,
    weaveableKnops: [{
      designatorPath: "alice/data",
      currentKnopMetadataTurtle: firstPayloadWeaveKnopMetadataTurtle,
      currentKnopInventoryTurtle: firstPayloadWeaveKnopInventoryTurtle,
      payloadArtifact: {
        workingLocalRelativePath: "alice-data.ttl",
        currentPayloadTurtle:
          `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix schema: <https://schema.org/> .

<alice> a schema:Person .
`,
      },
    }],
  });

  assertEquals(plan.wovenDesignatorPaths, ["alice/data"]);
  assertEquals(plan.updatedFiles.map((file) => file.path), [
    "_mesh/_inventory/inventory.ttl",
    "alice/data/_knop/_inventory/inventory.ttl",
    "_mesh/_meta/meta.ttl",
  ]);
  assertEquals(
    plan.createdFiles.map((file) => file.path),
    [
      "_mesh/_inventory/_history001/_s0003/ttl/inventory.ttl",
      "alice/data/_history001/_s0001/ttl/alice-data.ttl",
      "alice/data/_knop/_meta/_history001/_s0001/ttl/meta.ttl",
      "alice/data/_knop/_inventory/_history001/_s0001/ttl/inventory.ttl",
    ],
  );
  assertEquals(plan.createdPages[2], {
    kind: "identifier",
    path: "alice/data/index.html",
    designatorPath: "alice/data",
    workingLocalRelativePath: "alice-data.ttl",
  });
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "<alice/data> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;",
  );
  assertStringIncludes(
    plan.updatedFiles[1]?.contents ?? "",
    "sflo:currentArtifactHistory <alice/data/_history001> ;",
  );
});

Deno.test("planWeave preserves floating repository payload source locators", () => {
  const repositorySourceFloatingLocator = {
    repositoryUrl: "https://github.com/semantic-flow/sflo.git",
    repositoryPathFromRoot: "alice-data.ttl",
  };
  const floatingLocatorBlock = `sflo:hasRepositorySourceFloatingLocator [
    a sflo:RepositorySourceFloatingLocator ;
    sflo:sourceRepositoryUrl "https://github.com/semantic-flow/sflo.git" ;
    sflo:sourceRepositoryPathFromRoot "alice-data.ttl"
  ]`;
  const currentMeshInventoryTurtle = firstPayloadWeaveMeshInventoryTurtle
    .replace(
      "sflo:hasWorkingLocatedFile <alice-data.ttl>",
      floatingLocatorBlock,
    );
  const currentKnopInventoryTurtle = firstPayloadWeaveKnopInventoryTurtle
    .replace(
      "sflo:hasWorkingLocatedFile <alice-data.ttl>",
      floatingLocatorBlock,
    );

  const plan = planWeave({
    request: {
      targets: [{ designatorPath: "alice/data" }],
    },
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle,
    currentMeshMetadataTurtle: firstPayloadWeaveMeshMetadataTurtle,
    weaveableKnops: [{
      designatorPath: "alice/data",
      currentKnopMetadataTurtle: firstPayloadWeaveKnopMetadataTurtle,
      currentKnopInventoryTurtle,
      payloadArtifact: {
        workingLocalRelativePath: "alice-data.ttl",
        workingAccessUrl:
          "https://raw.githubusercontent.com/semantic-flow/sflo/main/alice-data.ttl",
        repositorySourceFloatingLocator,
        currentPayloadTurtle:
          `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix schema: <https://schema.org/> .

<alice> a schema:Person .
`,
      },
    }],
  });

  const meshInventory =
    plan.updatedFiles.find((file) =>
      file.path === "_mesh/_inventory/inventory.ttl"
    )?.contents ?? "";
  const knopInventory =
    plan.updatedFiles.find((file) =>
      file.path === "alice/data/_knop/_inventory/inventory.ttl"
    )?.contents ?? "";

  for (const turtle of [meshInventory, knopInventory]) {
    assertStringIncludes(
      turtle,
      "sflo:hasRepositorySourceFloatingLocator [",
    );
    assertStringIncludes(
      turtle,
      'sflo:sourceRepositoryUrl "https://github.com/semantic-flow/sflo.git"',
    );
    assertStringIncludes(
      turtle,
      'sflo:sourceRepositoryPathFromRoot "alice-data.ttl"',
    );
    assertFalse(turtle.includes("sflo:hasWorkingLocatedFile <alice-data.ttl>"));
    assertFalse(turtle.includes("<alice-data.ttl> a sflo:LocatedFile"));
  }
  assertEquals(
    plan.createdPages.find((page) => page.path === "alice/data/index.html"),
    {
      kind: "identifier",
      path: "alice/data/index.html",
      designatorPath: "alice/data",
      workingLocalRelativePath: "alice-data.ttl",
      workingAccessUrl:
        "https://raw.githubusercontent.com/semantic-flow/sflo/main/alice-data.ttl",
      repositorySourceFloatingLocator,
    },
  );
});

Deno.test("planWeave applies current-only KnopMetadata policy on the first payload weave slice", () => {
  const plan = planWeave({
    request: {
      targets: [{ designatorPath: "alice/data" }],
    },
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: firstPayloadWeaveMeshInventoryTurtle,
    currentMeshMetadataTurtle: firstPayloadWeaveMeshMetadataTurtle,
    weaveableKnops: [{
      designatorPath: "alice/data",
      currentKnopMetadataTurtle: firstPayloadWeaveKnopMetadataTurtle,
      currentKnopInventoryTurtle: firstPayloadWeaveKnopInventoryTurtle,
      payloadArtifact: {
        workingLocalRelativePath: "alice-data.ttl",
        currentPayloadTurtle:
          `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix schema: <https://schema.org/> .

<alice> a schema:Person .
`,
      },
    }],
    supportHistoryPolicies: {
      knopMetadata: "currentOnly",
    },
  });

  assertEquals(
    plan.createdFiles.map((file) => file.path),
    [
      "_mesh/_inventory/_history001/_s0003/ttl/inventory.ttl",
      "alice/data/_history001/_s0001/ttl/alice-data.ttl",
      "alice/data/_knop/_inventory/_history001/_s0001/ttl/inventory.ttl",
    ],
  );
  const knopInventory = plan.updatedFiles[1]?.contents ?? "";
  assertStringIncludes(
    knopInventory,
    "sflo:hasWorkingLocatedFile <alice/data/_knop/_meta/meta.ttl> ;\n  sflo:hasResourcePage <alice/data/_knop/_meta/index.html> .",
  );
  assertFalse(knopInventory.includes("alice/data/_knop/_meta/_history001"));
  assertStringIncludes(knopInventory, "alice/data/_history001");
  assertStringIncludes(
    knopInventory,
    "alice/data/_knop/_inventory/_history001",
  );
  assert(
    plan.createdPages.some((page) =>
      page.path === "alice/data/_knop/_meta/index.html"
    ),
  );
  assertFalse(
    plan.createdPages.some((page) =>
      page.path.startsWith("alice/data/_knop/_meta/_history001")
    ),
  );
});

Deno.test("planWeave omits payload ResourcePage facts when payload pages are suppressed", () => {
  const plan = planWeave({
    request: {
      targets: [{ designatorPath: "alice/data" }],
    },
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: firstPayloadWeaveMeshInventoryTurtle,
    currentMeshMetadataTurtle: firstPayloadWeaveMeshMetadataTurtle,
    weaveableKnops: [{
      designatorPath: "alice/data",
      currentKnopMetadataTurtle: firstPayloadWeaveKnopMetadataTurtle,
      currentKnopInventoryTurtle: firstPayloadWeaveKnopInventoryTurtle,
      payloadArtifact: {
        workingLocalRelativePath: "alice-data.ttl",
        currentPayloadTurtle:
          `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix schema: <https://schema.org/> .

<alice> a schema:Person .
`,
      },
    }],
    resourcePageGenerationPolicies: {
      payload: "suppress",
    },
  });

  const meshInventory = plan.updatedFiles[0]?.contents ?? "";
  const knopInventory = plan.updatedFiles[1]?.contents ?? "";

  assertFalse(meshInventory.includes("alice/data/index.html"));
  assertFalse(knopInventory.includes("alice/data/index.html"));
  assertFalse(knopInventory.includes("alice/data/_history001/index.html"));
  assertFalse(
    knopInventory.includes("alice/data/_history001/_s0001/index.html"),
  );
  assertFalse(
    knopInventory.includes("alice/data/_history001/_s0001/ttl/index.html"),
  );
  assertStringIncludes(knopInventory, "alice/data/_knop/index.html");
  assertStringIncludes(knopInventory, "alice/data/_knop/_inventory/index.html");
  assertFalse(
    plan.createdPages.some((page) =>
      page.path === "alice/data/index.html" ||
      page.path.startsWith("alice/data/_history001")
    ),
  );
  assert(
    plan.createdPages.some((page) =>
      page.path === "alice/data/_knop/index.html"
    ),
  );
});

Deno.test("planWeave applies configured ordinal naming policies on the first payload weave slice", () => {
  const plan = planWeave({
    request: {
      targets: [{ designatorPath: "alice/data" }],
    },
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: firstPayloadWeaveMeshInventoryTurtle,
    currentMeshMetadataTurtle: firstPayloadWeaveMeshMetadataTurtle,
    weaveableKnops: [{
      designatorPath: "alice/data",
      currentKnopMetadataTurtle: firstPayloadWeaveKnopMetadataTurtle,
      currentKnopInventoryTurtle: firstPayloadWeaveKnopInventoryTurtle,
      payloadArtifact: {
        workingLocalRelativePath: "alice-data.ttl",
        currentPayloadTurtle:
          `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix schema: <https://schema.org/> .

<alice> a schema:Person .
`,
      },
    }],
    namingPolicies: {
      historyNamingPolicy: "ordinal",
      stateNamingPolicy: "ordinal",
      manifestationNamingPolicy: "filenameDerived",
    },
  });

  assert(
    plan.createdFiles.some((file) =>
      file.path === "alice/data/_history001/_s0001/ttl/alice-data.ttl"
    ),
  );
  assertStringIncludes(
    plan.updatedFiles[1]?.contents ?? "",
    "sflo:currentArtifactHistory <alice/data/_history001> ;",
  );
});

Deno.test("planWeave applies explicit target segments under non-ordinal naming policies on the first payload weave slice", () => {
  const plan = planWeave({
    request: {
      targets: [{
        designatorPath: "alice/data",
        historySegment: "releases",
        stateSegment: "v0.0.1",
      }],
    },
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: firstPayloadWeaveMeshInventoryTurtle,
    currentMeshMetadataTurtle: firstPayloadWeaveMeshMetadataTurtle,
    weaveableKnops: [{
      designatorPath: "alice/data",
      currentKnopMetadataTurtle: firstPayloadWeaveKnopMetadataTurtle,
      currentKnopInventoryTurtle: firstPayloadWeaveKnopInventoryTurtle,
      payloadArtifact: {
        workingLocalRelativePath: "alice-data.ttl",
        currentPayloadTurtle:
          `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix schema: <https://schema.org/> .

<alice> a schema:Person .
`,
      },
    }],
    namingPolicies: {
      historyNamingPolicy: "named",
      stateNamingPolicy: "semver",
      manifestationNamingPolicy: "ordinal",
    },
  });

  assert(
    plan.createdFiles.some((file) =>
      file.path === "alice/data/releases/v0.0.1/_m0001/alice-data.ttl"
    ),
  );
  assertStringIncludes(
    plan.updatedFiles[1]?.contents ?? "",
    "sflo:currentArtifactHistory <alice/data/releases> ;",
  );
  assertStringIncludes(
    plan.updatedFiles[1]?.contents ?? "",
    "sflo:hasManifestation <alice/data/releases/v0.0.1/_m0001> ;",
  );
});

Deno.test("planWeave consumes payload history and next-state intent on the first payload weave slice", () => {
  const currentKnopInventoryTurtle = firstPayloadWeaveKnopInventoryTurtle
    .replace(
      "@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .",
      `@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .`,
    )
    .replace(
      "sflo:hasWorkingLocatedFile <alice-data.ttl> .",
      `sflo:currentArtifactHistory <alice/data/releases> ;
  sflo:hasArtifactHistory <alice/data/releases> ;
  sflo:hasWorkingLocatedFile <alice-data.ttl> .

<alice/data/releases> sfcfg:hasNextStateSegmentHint "v0.1.0" .`,
    );

  assertEquals(
    detectPendingWeaveSlice(
      "https://semantic-flow.github.io/mesh-alice-bio/",
      "alice/data",
      currentKnopInventoryTurtle,
    ),
    "firstPayloadWeave",
  );

  const plan = planWeave({
    request: {
      targets: [{ designatorPath: "alice/data" }],
    },
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: firstPayloadWeaveMeshInventoryTurtle,
    currentMeshMetadataTurtle: firstPayloadWeaveMeshMetadataTurtle,
    weaveableKnops: [{
      designatorPath: "alice/data",
      currentKnopMetadataTurtle: firstPayloadWeaveKnopMetadataTurtle,
      currentKnopInventoryTurtle,
      payloadArtifact: {
        workingLocalRelativePath: "alice-data.ttl",
        currentArtifactHistoryPath: "alice/data/releases",
        currentPayloadTurtle:
          `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix schema: <https://schema.org/> .

<alice> a schema:Person .
`,
      },
    }],
    namingPolicies: {
      historyNamingPolicy: "named",
      stateNamingPolicy: "semver",
      manifestationNamingPolicy: "filenameDerived",
    },
  });

  assert(
    plan.createdFiles.some((file) =>
      file.path === "alice/data/releases/v0.1.0/ttl/alice-data.ttl"
    ),
  );
  assertStringIncludes(
    plan.updatedFiles[1]?.contents ?? "",
    "sflo:currentArtifactHistory <alice/data/releases> ;",
  );
  assertStringIncludes(
    plan.updatedFiles[1]?.contents ?? "",
    "sflo:latestHistoricalState <alice/data/releases/v0.1.0> ;",
  );
  assertFalse(
    (plan.updatedFiles[1]?.contents ?? "").includes(
      "sfcfg:hasNextStateSegmentHint",
    ),
  );
});

Deno.test("planWeave requires explicit history segments for named history naming", () => {
  assertThrows(
    () =>
      planWeave({
        request: {
          targets: [{ designatorPath: "alice/data" }],
        },
        meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
        currentMeshInventoryTurtle: firstPayloadWeaveMeshInventoryTurtle,
        currentMeshMetadataTurtle: firstPayloadWeaveMeshMetadataTurtle,
        weaveableKnops: [{
          designatorPath: "alice/data",
          currentKnopMetadataTurtle: firstPayloadWeaveKnopMetadataTurtle,
          currentKnopInventoryTurtle: firstPayloadWeaveKnopInventoryTurtle,
          payloadArtifact: {
            workingLocalRelativePath: "alice-data.ttl",
            currentPayloadTurtle: "<alice> a <https://schema.org/Person> .\n",
          },
        }],
        namingPolicies: {
          historyNamingPolicy: "named",
        },
      }),
    WeaveInputError,
    "historyNamingPolicy named requires an explicit historySegment",
  );
});

Deno.test("planWeave requires explicit state segments for non-ordinal state naming", () => {
  assertThrows(
    () =>
      planWeave({
        request: {
          targets: [{ designatorPath: "alice/data" }],
        },
        meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
        currentMeshInventoryTurtle: firstPayloadWeaveMeshInventoryTurtle,
        currentMeshMetadataTurtle: firstPayloadWeaveMeshMetadataTurtle,
        weaveableKnops: [{
          designatorPath: "alice/data",
          currentKnopMetadataTurtle: firstPayloadWeaveKnopMetadataTurtle,
          currentKnopInventoryTurtle: firstPayloadWeaveKnopInventoryTurtle,
          payloadArtifact: {
            workingLocalRelativePath: "alice-data.ttl",
            currentPayloadTurtle: "<alice> a <https://schema.org/Person> .\n",
          },
        }],
        namingPolicies: {
          stateNamingPolicy: "semver",
        },
      }),
    WeaveInputError,
    "stateNamingPolicy semver requires an explicit stateSegment",
  );
});

Deno.test("planWeave rejects explicit state segments that violate semver naming policy", () => {
  assertThrows(
    () =>
      planWeave({
        request: {
          targets: [{
            designatorPath: "alice/data",
            historySegment: "releases",
            stateSegment: "release-candidate",
          }],
        },
        meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
        currentMeshInventoryTurtle: firstPayloadWeaveMeshInventoryTurtle,
        currentMeshMetadataTurtle: firstPayloadWeaveMeshMetadataTurtle,
        weaveableKnops: [{
          designatorPath: "alice/data",
          currentKnopMetadataTurtle: firstPayloadWeaveKnopMetadataTurtle,
          currentKnopInventoryTurtle: firstPayloadWeaveKnopInventoryTurtle,
          payloadArtifact: {
            workingLocalRelativePath: "alice-data.ttl",
            currentPayloadTurtle: "<alice> a <https://schema.org/Person> .\n",
          },
        }],
        namingPolicies: {
          historyNamingPolicy: "named",
          stateNamingPolicy: "semver",
        },
      }),
    WeaveInputError,
    "stateSegment release-candidate does not satisfy stateNamingPolicy semver",
  );
});

Deno.test("planWeave renders a later first payload weave slice against a carried mesh inventory", () => {
  const plan = planWeave({
    request: {
      targets: [{ designatorPath: "alice/page-main" }],
    },
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: laterFirstPayloadWeaveMeshInventoryTurtle,
    currentMeshMetadataTurtle: laterFirstPayloadWeaveMeshMetadataTurtle,
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
      "_mesh/_inventory/_history001/release-candidate/ttl/inventory.ttl",
      "alice/page-main/_history001/_s0001/md/alice-page-main.md",
      "alice/page-main/_knop/_meta/_history001/_s0001/ttl/meta.ttl",
      "alice/page-main/_knop/_inventory/_history001/_s0001/ttl/inventory.ttl",
    ],
  );
  assertEquals(plan.createdPages[0], {
    kind: "simple",
    path: "_mesh/_inventory/_history001/release-candidate/index.html",
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
    `sflo:hasHistoricalState <_mesh/_inventory/_history001/release-candidate> ;`,
  );
  assertFalse(
    (plan.updatedFiles[0]?.contents ?? "").includes(
      "sflo:latestHistoricalState <_mesh/_inventory/_history001/release-candidate>",
    ),
  );
  assertFalse(
    (plan.updatedFiles[0]?.contents ?? "").includes(
      "sflo:currentArtifactHistory <_mesh/_inventory/_history001>",
    ),
  );
  assertFalse(
    (plan.updatedFiles[0]?.contents ?? "").includes(
      `<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <_mesh/_inventory/_history001> ;
  sflo:nextHistoryOrdinal`,
    ),
  );
  assertStringIncludes(
    plan.updatedFiles[2]?.contents ?? "",
    `sflo:latestHistoricalState <_mesh/_inventory/_history001/release-candidate> ;`,
  );
  assertStringIncludes(
    plan.updatedFiles[2]?.contents ?? "",
    `sflo:nextStateOrdinal "6"^^xsd:nonNegativeInteger .`,
  );
  assertFalse(
    (plan.updatedFiles[2]?.contents ?? "").includes(
      "sfcfg:hasNextStateSegmentHint",
    ),
  );
  assertStringIncludes(
    plan.updatedFiles[1]?.contents ?? "",
    "sflo:currentArtifactHistory <alice/page-main/_history001> ;",
  );
});

Deno.test("planWeave anchors a nested first payload page at the mesh page when the parent identifier is absent", () => {
  const currentMeshInventoryTurtle = laterFirstPayloadWeaveMeshInventoryTurtle
    .replace(
      "  sflo:hasKnop <alice/page-main/_knop> ;",
      "  sflo:hasKnop <carol/data/_knop> ;",
    )
    .replaceAll("alice/page-main", "carol/data")
    .replaceAll("alice-page-main.md", "carol-data.ttl");
  const plan = planWeave({
    request: {
      targets: [{ designatorPath: "carol/data" }],
    },
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle,
    currentMeshMetadataTurtle: laterFirstPayloadWeaveMeshMetadataTurtle,
    weaveableKnops: [{
      designatorPath: "carol/data",
      currentKnopMetadataTurtle: laterFirstPayloadWeaveKnopMetadataTurtle
        .replaceAll("alice/page-main", "carol/data")
        .replaceAll("alice-page-main.md", "carol-data.ttl"),
      currentKnopInventoryTurtle: laterFirstPayloadWeaveKnopInventoryTurtle
        .replaceAll("alice/page-main", "carol/data")
        .replaceAll("alice-page-main.md", "carol-data.ttl"),
      payloadArtifact: {
        workingLocalRelativePath: "carol-data.ttl",
        currentPayloadTurtle:
          `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix schema: <https://schema.org/> .

<carol> a schema:Person .
`,
      },
    }],
  });

  const inventory =
    plan.updatedFiles.find((file) =>
      file.path === "_mesh/_inventory/inventory.ttl"
    )?.contents ?? "";

  assertStringIncludes(
    inventory,
    "<carol/data/index.html> a sflo:ResourcePage, sflo:LocatedFile .",
  );
  assertStringIncludes(
    inventory,
    "<carol/data/_knop/index.html> a sflo:ResourcePage, sflo:LocatedFile .",
  );
  assertFalse(inventory.includes("<carol/index.html>"));
  assertFalse(inventory.includes("<carol/_knop>"));
  assert(
    plan.createdPages.some((page) => page.path === "carol/data/index.html"),
  );
});

Deno.test("planWeave renders a first payload weave for non-RDF digital artifacts", () => {
  const currentMeshInventoryTurtle = laterFirstPayloadWeaveMeshInventoryTurtle
    .replace(
      "  sflo:hasKnop <alice/page-main/_knop> ;",
      "  sflo:hasKnop <carol/bio/_knop> ;",
    )
    .replaceAll("alice/page-main", "carol/bio")
    .replaceAll("alice-page-main.md", "carol-bio.md")
    .replace(
      "<carol/bio> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;",
      "<carol/bio> a sflo:PayloadArtifact, sflo:DigitalArtifact ;",
    )
    .replace(
      "<carol-bio.md> a sflo:LocatedFile, sflo:RdfDocument .",
      "<carol-bio.md> a sflo:LocatedFile .",
    );
  const currentKnopInventoryTurtle = laterFirstPayloadWeaveKnopInventoryTurtle
    .replaceAll("alice/page-main", "carol/bio")
    .replaceAll("alice-page-main.md", "carol-bio.md")
    .replace(
      "<carol/bio> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;",
      "<carol/bio> a sflo:PayloadArtifact, sflo:DigitalArtifact ;",
    )
    .replace(
      "<carol-bio.md> a sflo:LocatedFile, sflo:RdfDocument .",
      "<carol-bio.md> a sflo:LocatedFile .",
    );
  const plan = planWeave({
    request: {
      targets: [{ designatorPath: "carol/bio" }],
    },
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle,
    currentMeshMetadataTurtle: laterFirstPayloadWeaveMeshMetadataTurtle,
    weaveableKnops: [{
      designatorPath: "carol/bio",
      currentKnopMetadataTurtle: laterFirstPayloadWeaveKnopMetadataTurtle
        .replaceAll("alice/page-main", "carol/bio")
        .replaceAll("alice-page-main.md", "carol-bio.md"),
      currentKnopInventoryTurtle,
      payloadArtifact: {
        workingLocalRelativePath: "carol-bio.md",
        currentPayloadTurtle: "# Carol Burnett\n\nImported Markdown bio.\n",
      },
    }],
  });

  assertEquals(plan.wovenDesignatorPaths, ["carol/bio"]);
  assert(
    plan.createdFiles.some((file) =>
      file.path === "carol/bio/_history001/_s0001/md/carol-bio.md"
    ),
  );
  const knopInventory =
    plan.updatedFiles.find((file) =>
      file.path === "carol/bio/_knop/_inventory/inventory.ttl"
    )?.contents ?? "";
  const meshInventory =
    plan.updatedFiles.find((file) =>
      file.path === "_mesh/_inventory/inventory.ttl"
    )?.contents ?? "";
  for (const turtle of [knopInventory, meshInventory]) {
    assertStringIncludes(
      turtle,
      "<carol/bio> a sflo:PayloadArtifact, sflo:DigitalArtifact ;",
    );
    assertFalse(
      turtle.includes(
        "<carol/bio> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;",
      ),
    );
  }
  assertStringIncludes(
    knopInventory,
    "<carol/bio/_history001/_s0001/md> a sflo:ArtifactManifestation ;",
  );
  assertFalse(
    knopInventory.includes(
      "<carol/bio/_history001/_s0001/md> a sflo:ArtifactManifestation, sflo:RdfDocument ;",
    ),
  );
});

Deno.test("planWeave writes binary first payload snapshots separately", () => {
  const currentMeshInventoryTurtle = laterFirstPayloadWeaveMeshInventoryTurtle
    .replace(
      "  sflo:hasKnop <alice/page-main/_knop> ;",
      "  sflo:hasKnop <favicon/_knop> ;",
    )
    .replaceAll("alice/page-main", "favicon")
    .replaceAll("alice-page-main.md", "favicon.ico")
    .replace(
      "<favicon> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;",
      "<favicon> a sflo:PayloadArtifact, sflo:DigitalArtifact ;",
    )
    .replace(
      "<favicon.ico> a sflo:LocatedFile, sflo:RdfDocument .",
      "<favicon.ico> a sflo:LocatedFile .",
    );
  const currentKnopInventoryTurtle = laterFirstPayloadWeaveKnopInventoryTurtle
    .replaceAll("alice/page-main", "favicon")
    .replaceAll("alice-page-main.md", "favicon.ico")
    .replace(
      "<favicon> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;",
      "<favicon> a sflo:PayloadArtifact, sflo:DigitalArtifact ;",
    )
    .replace(
      "<favicon.ico> a sflo:LocatedFile, sflo:RdfDocument .",
      "<favicon.ico> a sflo:LocatedFile .",
    );
  const faviconBytes = new Uint8Array([0, 1, 2, 3, 255]);
  const plan = planWeave({
    request: {
      targets: [{ designatorPath: "favicon" }],
    },
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle,
    currentMeshMetadataTurtle: laterFirstPayloadWeaveMeshMetadataTurtle,
    weaveableKnops: [{
      designatorPath: "favicon",
      currentKnopMetadataTurtle: laterFirstPayloadWeaveKnopMetadataTurtle
        .replaceAll("alice/page-main", "favicon")
        .replaceAll("alice-page-main.md", "favicon.ico"),
      currentKnopInventoryTurtle,
      payloadArtifact: {
        workingLocalRelativePath: "favicon.ico",
        currentPayloadTurtle: "",
        currentPayloadBytes: faviconBytes,
      },
    }],
  });

  assertFalse(
    plan.createdFiles.some((file) =>
      file.path === "favicon/_history001/_s0001/ico/favicon.ico"
    ),
  );
  assertEquals(plan.createdBinaryFiles?.map((file) => file.path), [
    "favicon/_history001/_s0001/ico/favicon.ico",
  ]);
  assertEquals(plan.createdBinaryFiles?.[0]?.contents, faviconBytes);
});

Deno.test("planWeave advances ordinal MeshInventory progression after a named latest state", () => {
  const hintedPlan = planWeave({
    request: {
      targets: [{ designatorPath: "alice/page-main" }],
    },
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: laterFirstPayloadWeaveMeshInventoryTurtle,
    currentMeshMetadataTurtle: laterFirstPayloadWeaveMeshMetadataTurtle,
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
  const carriedMeshInventory = hintedPlan.updatedFiles.find((file) =>
    file.path === "_mesh/_inventory/inventory.ttl"
  )!.contents
    .replace(
      "  sflo:hasKnop <alice/page-main/_knop> ;\n  sflo:hasResourcePage <_mesh/index.html> .",
      "  sflo:hasKnop <alice/page-main/_knop> ;\n  sflo:hasKnop <carol/_knop> ;\n  sflo:hasResourcePage <_mesh/index.html> .",
    )
    .replace(
      "<alice>\n  sflo:hasResourcePage <alice/index.html> .",
      `<alice>
  sflo:hasResourcePage <alice/index.html> .

<carol/_knop> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <carol/_knop/_inventory/inventory.ttl> .`,
    );
  const currentMeshMetadataTurtle =
    hintedPlan.updatedFiles.find((file) =>
      file.path === "_mesh/_meta/meta.ttl"
    )!.contents;

  const plan = planWeave({
    request: {
      targets: [{ designatorPath: "carol" }],
    },
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: carriedMeshInventory,
    currentMeshMetadataTurtle,
    weaveableKnops: [{
      designatorPath: "carol",
      currentKnopMetadataTurtle: firstWeaveKnopMetadataTurtle
        .replaceAll("<alice/_knop>", "<carol/_knop>")
        .replace('sflo:designatorPath "alice"', 'sflo:designatorPath "carol"')
        .replaceAll(
          "<alice/_knop/_inventory/inventory.ttl>",
          "<carol/_knop/_inventory/inventory.ttl>",
        ),
      currentKnopInventoryTurtle: firstWeaveKnopInventoryTurtle
        .replaceAll("<alice/_knop>", "<carol/_knop>")
        .replaceAll("<alice/_knop/_meta>", "<carol/_knop/_meta>")
        .replaceAll("<alice/_knop/_inventory>", "<carol/_knop/_inventory>")
        .replaceAll(
          "<alice/_knop/_inventory/inventory.ttl>",
          "<carol/_knop/_inventory/inventory.ttl>",
        ),
    }],
  });

  assertEquals(
    plan.createdFiles[0]?.path,
    "_mesh/_inventory/_history001/_s0006/ttl/inventory.ttl",
  );
  assertStringIncludes(
    plan.updatedFiles[2]?.contents ?? "",
    "sflo:latestHistoricalState <_mesh/_inventory/_history001/_s0006> ;",
  );
  assertStringIncludes(
    plan.updatedFiles[2]?.contents ?? "",
    `sflo:nextStateOrdinal "7"^^xsd:nonNegativeInteger .`,
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
    currentMeshMetadataTurtle: meshMetadataProgressionTurtle(
      "_mesh/_inventory/_history001/_s0005",
      6,
    ),
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
      "_mesh/_inventory/_history001/_s0006/ttl/inventory.ttl",
      "_knop/_meta/_history001/_s0001/ttl/meta.ttl",
      "_knop/_inventory/_history001/_s0001/ttl/inventory.ttl",
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
  });
  assertStringIncludes(
    plan.updatedFiles[2]?.contents ?? "",
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
        designatorPath: "alice/data",
        historySegment: "releases",
        stateSegment: "v0.0.1",
      }],
    },
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: firstPayloadWeaveMeshInventoryTurtle,
    currentMeshMetadataTurtle: firstPayloadWeaveMeshMetadataTurtle,
    weaveableKnops: [{
      designatorPath: "alice/data",
      currentKnopMetadataTurtle: firstPayloadWeaveKnopMetadataTurtle,
      currentKnopInventoryTurtle: firstPayloadWeaveKnopInventoryTurtle,
      payloadArtifact: {
        workingLocalRelativePath: "alice-data.ttl",
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
      "_mesh/_inventory/_history001/_s0003/ttl/inventory.ttl",
      "alice/data/releases/v0.0.1/ttl/alice-data.ttl",
      "alice/data/_knop/_meta/_history001/_s0001/ttl/meta.ttl",
      "alice/data/_knop/_inventory/_history001/_s0001/ttl/inventory.ttl",
    ],
  );
  assertStringIncludes(
    plan.updatedFiles[1]?.contents ?? "",
    "sflo:currentArtifactHistory <alice/data/releases> ;",
  );
  assertStringIncludes(
    plan.updatedFiles[1]?.contents ?? "",
    "sflo:latestHistoricalState <alice/data/releases/v0.0.1> ;",
  );
  assertEquals(
    plan.createdPages.slice(2, 5).map((page) => page.path),
    [
      "alice/data/index.html",
      "alice/data/releases/index.html",
      "alice/data/releases/v0.0.1/index.html",
    ],
  );
});

Deno.test("planWeave applies requested payload manifestation naming on the first payload weave slice", () => {
  const plan = planWeave({
    request: {
      targets: [{
        designatorPath: "alice/data",
        historySegment: "releases",
        stateSegment: "v0.0.1",
        manifestationSegment: "ttl",
      }],
    },
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: firstPayloadWeaveMeshInventoryTurtle,
    currentMeshMetadataTurtle: firstPayloadWeaveMeshMetadataTurtle,
    weaveableKnops: [{
      designatorPath: "alice/data",
      currentKnopMetadataTurtle: firstPayloadWeaveKnopMetadataTurtle,
      currentKnopInventoryTurtle: firstPayloadWeaveKnopInventoryTurtle,
      payloadArtifact: {
        workingLocalRelativePath: "alice-data.ttl",
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
      file.path === "alice/data/releases/v0.0.1/ttl/alice-data.ttl"
    ),
  );
  assert(
    plan.createdPages.some((page) =>
      page.path === "alice/data/releases/v0.0.1/ttl/index.html"
    ),
  );
  assertStringIncludes(
    plan.updatedFiles[1]?.contents ?? "",
    "sflo:hasManifestation <alice/data/releases/v0.0.1/ttl> ;",
  );
  assertStringIncludes(
    plan.updatedFiles[1]?.contents ?? "",
    "sflo:locatedFileForState <alice/data/releases/v0.0.1/ttl/alice-data.ttl> ;",
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
      "<alice/data> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;",
      "<alice/data> rdf:type sflo:RdfDocument, sflo:DigitalArtifact, sflo:PayloadArtifact ;",
    )
    .replace(
      "<alice/data/_knop> a sflo:Knop ;",
      "<alice/data/_knop>\n  rdf:type sflo:Knop ;",
    );
  const equivalentKnopMetadataTurtle = withRdfPrefix(
    firstPayloadWeaveKnopMetadataTurtle,
  ).replace(
    "<alice/data/_knop> a sflo:Knop ;",
    "<alice/data/_knop>\n  rdf:type sflo:Knop ;",
  );
  const equivalentKnopInventoryTurtle = withRdfPrefix(
    firstPayloadWeaveKnopInventoryTurtle,
  )
    .replace(
      "<alice/data/_knop> a sflo:Knop ;",
      "<alice/data/_knop>\n  rdf:type sflo:Knop ;",
    )
    .replace(
      "<alice/data> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;",
      "<alice/data> rdf:type sflo:RdfDocument, sflo:DigitalArtifact, sflo:PayloadArtifact ;",
    );

  const plan = planWeave({
    request: {
      targets: [{ designatorPath: "alice/data" }],
    },
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: equivalentMeshInventoryTurtle,
    currentMeshMetadataTurtle: firstPayloadWeaveMeshMetadataTurtle,
    weaveableKnops: [{
      designatorPath: "alice/data",
      currentKnopMetadataTurtle: equivalentKnopMetadataTurtle,
      currentKnopInventoryTurtle: equivalentKnopInventoryTurtle,
      payloadArtifact: {
        workingLocalRelativePath: "alice-data.ttl",
        currentPayloadTurtle:
          `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix schema: <https://schema.org/> .

<alice> a schema:Person .
`,
      },
    }],
  });

  assertEquals(plan.wovenDesignatorPaths, ["alice/data"]);
  assertEquals(plan.updatedFiles.map((file) => file.path), [
    "_mesh/_inventory/inventory.ttl",
    "alice/data/_knop/_inventory/inventory.ttl",
    "_mesh/_meta/meta.ttl",
  ]);
});

Deno.test("planWeave renders the first alice reference-catalog weave slice", () => {
  const plan = planWeave({
    request: {},
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: firstReferenceCatalogWeaveMeshInventoryTurtle,
    currentMeshMetadataTurtle: firstReferenceCatalogWeaveMeshMetadataTurtle,
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
      "alice/_knop/_inventory/_history001/_s0002/ttl/inventory.ttl",
      "alice/_knop/_references/_history001/_s0001/ttl/references.ttl",
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
      referenceTargetPath: "alice/data",
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

Deno.test("planWeave supports current-only first reference-catalog weave", () => {
  const currentOnlyReferenceCatalogWeaveKnopInventoryTurtle =
    `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<alice/_knop> a sflo:Knop ;
  sflo:hasKnopMetadata <alice/_knop/_meta> ;
  sflo:hasKnopInventory <alice/_knop/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <alice/_knop/_inventory/inventory.ttl> ;
  sflo:hasReferenceCatalog <alice/_knop/_references> ;
  sflo:hasResourcePage <alice/_knop/index.html> .

<alice/_knop/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <alice/_knop/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <alice/_knop/_inventory/index.html> .

<alice/_knop/_references> a sflo:ReferenceCatalog, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <alice/_knop/_references/references.ttl> .

<alice/_knop/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<alice/_knop/_references/references.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<alice/_knop/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<alice/_knop/_inventory/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`;

  const plan = planWeave({
    request: {},
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: firstReferenceCatalogWeaveMeshInventoryTurtle,
    currentMeshMetadataTurtle: firstReferenceCatalogWeaveMeshMetadataTurtle,
    weaveableKnops: [{
      designatorPath: "alice",
      currentKnopMetadataTurtle: firstWeaveKnopMetadataTurtle,
      currentKnopInventoryTurtle:
        currentOnlyReferenceCatalogWeaveKnopInventoryTurtle,
      referenceCatalogArtifact: {
        workingLocalRelativePath: "alice/_knop/_references/references.ttl",
        currentReferenceCatalogTurtle:
          firstReferenceCatalogWeaveReferenceCatalogTurtle,
      },
    }],
    supportHistoryPolicies: {
      knopInventory: "currentOnly",
      referenceCatalog: "currentOnly",
    },
  });

  assertEquals(plan.wovenDesignatorPaths, ["alice"]);
  assertEquals(plan.createdFiles, []);
  assertEquals(plan.updatedFiles.map((file) => file.path), [
    "alice/_knop/_inventory/inventory.ttl",
  ]);
  assertEquals(plan.createdPages.map((page) => page.path), [
    "alice/_knop/_references/index.html",
  ]);
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "sflo:hasResourcePage <alice/_knop/_references/index.html>",
  );
  assertFalse(
    (plan.updatedFiles[0]?.contents ?? "").includes(
      "alice/_knop/_references/_history001",
    ),
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
  sflo:hasReferenceRole <https://semantic-flow.github.io/sflo/ontology/referenceRole_canonical> ;
  sflo:hasReferenceSource <alice/_knop/_references#reference001-source> .

<alice/_knop/_references#reference001-source> a sflo:ReferenceSource ;
  sflo:targetArtifact <alice/data> .
`,
    `<alice/_knop/_references#reference001>
  rdf:type sflo:ReferenceLink ;
  sflo:hasReferenceRole <https://semantic-flow.github.io/sflo/ontology/referenceRole_canonical> ;
  sflo:hasReferenceSource <alice/_knop/_references#reference001-source> ;
  sflo:referenceLinkFor <alice> .

<alice/_knop/_references#reference001-source>
  sflo:targetArtifact <alice/data> ;
  rdf:type sflo:ReferenceSource .
`,
  );

  const plan = planWeave({
    request: {},
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: equivalentMeshInventoryTurtle,
    currentMeshMetadataTurtle: firstReferenceCatalogWeaveMeshMetadataTurtle,
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
    currentMeshMetadataTurtle: firstReferenceCatalogWeaveMeshMetadataTurtle,
    weaveableKnops: [{
      designatorPath: "alice",
      currentKnopMetadataTurtle: firstWeaveKnopMetadataTurtle,
      currentKnopInventoryTurtle: firstReferenceCatalogWeaveKnopInventoryTurtle
        .replaceAll(
          "alice/_knop/_references/references.ttl",
          workingLocalRelativePath,
        )
        .replace(
          `sflo:hasWorkingLocatedFile <${workingLocalRelativePath}> .`,
          `sflo:workingLocalRelativePath "${workingLocalRelativePath}" .`,
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
      "alice/_knop/_inventory/_history001/_s0002/ttl/inventory.ttl",
      "alice/_knop/_references/_history001/_s0001/ttl/reference-links-v1.ttl",
    ],
  );
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    `sflo:hasWorkingLocatedFile <${workingLocalRelativePath}> ;`,
  );
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "sflo:locatedFileForState <alice/_knop/_references/_history001/_s0001/ttl/reference-links-v1.ttl> ;",
  );
  assertEquals(
    plan.createdPages[5],
    {
      kind: "simple",
      path: "alice/_knop/_references/_history001/_s0001/ttl/index.html",
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
      .replaceAll("<alice/data>", "<carol/bio>")
      .replaceAll(
        "<alice/data/_knop>",
        "<carol/bio/_knop>",
      ),
    currentMeshMetadataTurtle: firstReferenceCatalogWeaveMeshMetadataTurtle,
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
            .replaceAll("<alice/data>", "<carol/bio>"),
      },
    }],
  });

  assertEquals(plan.wovenDesignatorPaths, ["carol"]);
  assertEquals(plan.updatedFiles.map((file) => file.path), [
    "carol/_knop/_inventory/inventory.ttl",
  ]);
  assertEquals(
    plan.createdFiles[1]?.path,
    "carol/_knop/_references/_history001/_s0001/ttl/references.ttl",
  );
});

Deno.test("planWeave renders the second alice bio payload weave slice", () => {
  const plan = planWeave({
    request: {
      targets: [{ designatorPath: "alice/data" }],
    },
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: firstReferenceCatalogWeaveMeshInventoryTurtle,
    weaveableKnops: [{
      designatorPath: "alice/data",
      currentKnopMetadataTurtle: firstPayloadWeaveKnopMetadataTurtle,
      currentKnopInventoryTurtle: secondPayloadWeaveKnopInventoryTurtle,
      payloadArtifact: {
        workingLocalRelativePath: "alice-data.ttl",
        currentArtifactHistoryPath: "alice/data/_history001",
        currentPayloadTurtle:
          `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix schema: <https://schema.org/> .

<alice> a schema:Person .
<alice/data> dcterms:creator <alice> .
`,
        latestHistoricalStatePath: "alice/data/_history001/_s0001",
      },
    }],
  });

  assertEquals(plan.wovenDesignatorPaths, ["alice/data"]);
  assertEquals(plan.updatedFiles.map((file) => file.path), [
    "alice/data/_knop/_inventory/inventory.ttl",
  ]);
  assertEquals(
    plan.createdFiles.map((file) => file.path),
    [
      "alice/data/_history001/_s0002/ttl/alice-data.ttl",
      "alice/data/_knop/_inventory/_history001/_s0002/ttl/inventory.ttl",
    ],
  );
  assertEquals(plan.createdPages.map((page) => page.path), [
    "alice/data/_history001/_s0002/index.html",
    "alice/data/_history001/_s0002/ttl/index.html",
    "alice/data/_knop/_inventory/_history001/_s0002/index.html",
    "alice/data/_knop/_inventory/_history001/_s0002/ttl/index.html",
  ]);
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "sflo:latestHistoricalState <alice/data/_history001/_s0002> ;",
  );
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "sflo:latestHistoricalState <alice/data/_knop/_inventory/_history001/_s0002> ;",
  );
});

Deno.test("planWeave applies configured manifestation naming on the second payload weave slice", () => {
  const plan = planWeave({
    request: {
      targets: [{
        designatorPath: "alice/data",
        stateSegment: "_s0002",
      }],
    },
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: firstReferenceCatalogWeaveMeshInventoryTurtle,
    weaveableKnops: [{
      designatorPath: "alice/data",
      currentKnopMetadataTurtle: firstPayloadWeaveKnopMetadataTurtle,
      currentKnopInventoryTurtle: secondPayloadWeaveKnopInventoryTurtle,
      payloadArtifact: {
        workingLocalRelativePath: "alice-data.ttl",
        currentArtifactHistoryPath: "alice/data/_history001",
        currentPayloadTurtle:
          `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix schema: <https://schema.org/> .

<alice> a schema:Person .
<alice/data> dcterms:creator <alice> .
`,
        latestHistoricalStatePath: "alice/data/_history001/_s0001",
      },
    }],
    namingPolicies: {
      manifestationNamingPolicy: "ordinal",
    },
  });

  assertEquals(
    plan.createdFiles.map((file) => file.path),
    [
      "alice/data/_history001/_s0002/_m0001/alice-data.ttl",
      "alice/data/_knop/_inventory/_history001/_s0002/ttl/inventory.ttl",
    ],
  );
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "sflo:hasManifestation <alice/data/_history001/_s0002/_m0001> ;",
  );
});

Deno.test("planWeave requires explicit state segments for non-ordinal state naming on the second payload weave slice", () => {
  assertThrows(
    () =>
      planWeave({
        request: {
          targets: [{ designatorPath: "alice/data" }],
        },
        meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
        currentMeshInventoryTurtle:
          firstReferenceCatalogWeaveMeshInventoryTurtle,
        weaveableKnops: [{
          designatorPath: "alice/data",
          currentKnopMetadataTurtle: firstPayloadWeaveKnopMetadataTurtle,
          currentKnopInventoryTurtle: secondPayloadWeaveKnopInventoryTurtle,
          payloadArtifact: {
            workingLocalRelativePath: "alice-data.ttl",
            currentArtifactHistoryPath: "alice/data/_history001",
            currentPayloadTurtle: "<alice> a <https://schema.org/Person> .\n",
            latestHistoricalStatePath: "alice/data/_history001/_s0001",
          },
        }],
        namingPolicies: {
          stateNamingPolicy: "date",
        },
      }),
    WeaveInputError,
    "stateNamingPolicy date requires an explicit stateSegment",
  );
});

Deno.test("planWeave applies requested payload naming on the second payload weave slice", () => {
  const currentKnopInventoryTurtle = secondPayloadWeaveKnopInventoryTurtle
    .replaceAll(
      "alice/data/_history001/_s0001",
      "alice/data/releases/v0.0.1",
    )
    .replaceAll("alice/data/_history001", "alice/data/releases");
  const plan = planWeave({
    request: {
      targets: [{
        designatorPath: "alice/data",
        historySegment: "releases",
        stateSegment: "v0.0.2",
        manifestationSegment: "ttl",
      }],
    },
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: firstReferenceCatalogWeaveMeshInventoryTurtle,
    weaveableKnops: [{
      designatorPath: "alice/data",
      currentKnopMetadataTurtle: firstPayloadWeaveKnopMetadataTurtle,
      currentKnopInventoryTurtle,
      payloadArtifact: {
        workingLocalRelativePath: "alice-data.ttl",
        currentArtifactHistoryPath: "alice/data/releases",
        currentPayloadTurtle:
          `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix schema: <https://schema.org/> .

<alice> a schema:Person .
<alice/data> dcterms:creator <alice> .
`,
        latestHistoricalStatePath: "alice/data/releases/v0.0.1",
      },
    }],
  });

  assertEquals(
    plan.createdFiles.map((file) => file.path),
    [
      "alice/data/releases/v0.0.2/ttl/alice-data.ttl",
      "alice/data/_knop/_inventory/_history001/_s0002/ttl/inventory.ttl",
    ],
  );
  assertEquals(plan.createdPages.map((page) => page.path), [
    "alice/data/releases/v0.0.2/index.html",
    "alice/data/releases/v0.0.2/ttl/index.html",
    "alice/data/_knop/_inventory/_history001/_s0002/index.html",
    "alice/data/_knop/_inventory/_history001/_s0002/ttl/index.html",
  ]);
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "sflo:previousHistoricalState <alice/data/releases/v0.0.1> ;",
  );
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "sflo:latestHistoricalState <alice/data/releases/v0.0.2> ;",
  );
});

Deno.test("planWeave consumes next-state intent on the selected current history", () => {
  const currentKnopInventoryTurtle = secondPayloadWeaveKnopInventoryTurtle
    .replace(
      "@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .",
      `@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .`,
    )
    .replace(
      'sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;',
      `sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sfcfg:hasNextStateSegmentHint "v0.0.2" ;`,
    );
  const plan = planWeave({
    request: {
      targets: [{ designatorPath: "alice/data" }],
    },
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: firstReferenceCatalogWeaveMeshInventoryTurtle,
    weaveableKnops: [{
      designatorPath: "alice/data",
      currentKnopMetadataTurtle: firstPayloadWeaveKnopMetadataTurtle,
      currentKnopInventoryTurtle,
      payloadArtifact: {
        workingLocalRelativePath: "alice-data.ttl",
        currentArtifactHistoryPath: "alice/data/_history001",
        currentPayloadTurtle:
          `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix schema: <https://schema.org/> .

<alice> a schema:Person .
<alice/data> dcterms:creator <alice> .
`,
        latestHistoricalStatePath: "alice/data/_history001/_s0001",
      },
    }],
  });

  assertEquals(
    plan.createdFiles[0]?.path,
    "alice/data/_history001/v0.0.2/ttl/alice-data.ttl",
  );
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "sflo:latestHistoricalState <alice/data/_history001/v0.0.2> ;",
  );
  assertFalse(
    (plan.updatedFiles[0]?.contents ?? "").includes(
      "sfcfg:hasNextStateSegmentHint",
    ),
  );
});

Deno.test("detectPendingWeaveSlice accepts semantically equivalent second payload weave Turtle", () => {
  const equivalentKnopInventoryTurtle = withRdfPrefix(
    secondPayloadWeaveKnopInventoryTurtle,
  )
    .replace(
      "<alice/data/_knop> a sflo:Knop ;",
      "<alice/data/_knop>\n  rdf:type sflo:Knop ;",
    )
    .replace(
      "<alice/data> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;",
      "<alice/data> rdf:type sflo:RdfDocument, sflo:DigitalArtifact, sflo:PayloadArtifact ;",
    )
    .replace(
      "<alice/data/_history001> a sflo:ArtifactHistory ;",
      "<alice/data/_history001>\n  rdf:type sflo:ArtifactHistory ;",
    )
    .replace(
      "<alice/data/_knop/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;",
      "<alice/data/_knop/_inventory> rdf:type sflo:RdfDocument, sflo:DigitalArtifact, sflo:KnopInventory ;",
    )
    .replace(
      "<alice/data/_knop/_inventory/_history001> a sflo:ArtifactHistory ;",
      "<alice/data/_knop/_inventory/_history001>\n  rdf:type sflo:ArtifactHistory ;",
    );

  assertEquals(
    detectPendingWeaveSlice(
      "https://semantic-flow.github.io/mesh-alice-bio/",
      "alice/data",
      equivalentKnopInventoryTurtle,
    ),
    "secondPayloadWeave",
  );
});

Deno.test("detectPendingWeaveSlice supports custom payload history and state naming", () => {
  const customNamedKnopInventoryTurtle = secondPayloadWeaveKnopInventoryTurtle
    .replaceAll(
      "alice/data/_history001/_s0001",
      "alice/data/releases/v0.0.1",
    )
    .replaceAll("alice/data/_history001", "alice/data/releases");

  assertEquals(
    detectPendingWeaveSlice(
      "https://semantic-flow.github.io/mesh-alice-bio/",
      "alice/data",
      customNamedKnopInventoryTurtle,
    ),
    "secondPayloadWeave",
  );
});

Deno.test("detectPendingWeaveSlice ignores current-only settled Knops with ResourcePages", () => {
  const currentOnlySettledKnopInventoryTurtle =
    `@base <https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<ontology/_knop> a sflo:Knop ;
  sflo:hasKnopMetadata <ontology/_knop/_meta> ;
  sflo:hasKnopInventory <ontology/_knop/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <ontology/_knop/_inventory/inventory.ttl> ;
  sflo:hasPayloadArtifact <ontology> ;
  sflo:hasResourcePage <ontology/_knop/index.html> .

<ontology> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <ontology/releases> ;
  sflo:currentArtifactHistory <ontology/releases> ;
  sflo:workingLocalRelativePath "../ontology/fantasy-rules-ontology.ttl" ;
  sflo:hasResourcePage <ontology/index.html> .

<ontology/releases> a sflo:ArtifactHistory ;
  sflo:latestHistoricalState <ontology/releases/v0.0.2> ;
  sflo:nextStateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <ontology/releases/index.html> .

<ontology/releases/v0.0.2> a sflo:HistoricalState ;
  sflo:hasManifestation <ontology/releases/v0.0.2/ttl> ;
  sflo:locatedFileForState <ontology/releases/v0.0.2/ttl/fantasy-rules-ontology.ttl> ;
  sflo:hasResourcePage <ontology/releases/v0.0.2/index.html> .

<ontology/_knop/_meta> a sflo:KnopMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <ontology/_knop/_meta/meta.ttl> ;
  sflo:hasResourcePage <ontology/_knop/_meta/index.html> .

<ontology/_knop/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <ontology/_knop/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <ontology/_knop/_inventory/index.html> .
`;

  assertEquals(
    detectPendingWeaveSlice(
      "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
      "ontology",
      currentOnlySettledKnopInventoryTurtle,
    ),
    undefined,
  );
});

Deno.test("planWeave can start a requested payload history after another history exists", () => {
  const currentKnopInventoryTurtle = secondPayloadWeaveKnopInventoryTurtle
    .replaceAll(
      "alice/data/_history001/_s0001",
      "alice/data/releases/v0.0.1",
    )
    .replaceAll("alice/data/_history001", "alice/data/releases");

  const plan = planWeave({
    request: {
      targets: [{
        designatorPath: "alice/data",
        historySegment: "archive",
        stateSegment: "v0.0.1",
        manifestationSegment: "ttl",
      }],
    },
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: firstReferenceCatalogWeaveMeshInventoryTurtle,
    weaveableKnops: [{
      designatorPath: "alice/data",
      currentKnopMetadataTurtle: firstPayloadWeaveKnopMetadataTurtle,
      currentKnopInventoryTurtle,
      payloadArtifact: {
        workingLocalRelativePath: "alice-data.ttl",
        currentArtifactHistoryPath: "alice/data/releases",
        currentPayloadTurtle:
          `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix schema: <https://schema.org/> .

<alice> a schema:Person .
<alice/data> dcterms:creator <alice> .
`,
        latestHistoricalStatePath: "alice/data/releases/v0.0.1",
      },
    }],
  });

  assert(
    plan.createdFiles.some((file) =>
      file.path === "alice/data/archive/v0.0.1/ttl/alice-data.ttl"
    ),
  );
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "sflo:currentArtifactHistory <alice/data/archive> ;",
  );
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    `sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;`,
  );
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "sflo:hasArtifactHistory <alice/data/releases> ;",
  );
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "sflo:hasArtifactHistory <alice/data/archive> ;",
  );
  assertFalse(
    (plan.updatedFiles[0]?.contents ?? "").includes(
      "<alice/data/archive> a sflo:ArtifactHistory ;\n  sflo:historyOrdinal",
    ),
  );
  assertFalse(
    (plan.updatedFiles[0]?.contents ?? "").includes(
      "<alice/data/archive/v0.0.1> a sflo:HistoricalState ;\n  sflo:stateOrdinal",
    ),
  );
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    `sflo:nextStateOrdinal "1"^^xsd:nonNegativeInteger`,
  );
});

Deno.test("planWeave can start a requested payload history with working-only KnopInventory policy", () => {
  const historyPath = "alice/data/_knop/_inventory/_history001";
  const versionedKnopInventoryTurtle = secondPayloadWeaveKnopInventoryTurtle
    .replaceAll(
      "alice/data/_history001/_s0001",
      "alice/data/releases/v0.0.1",
    )
    .replaceAll("alice/data/_history001", "alice/data/releases");
  const currentKnopInventoryTurtle = versionedKnopInventoryTurtle
    .replace(
      `  sflo:hasArtifactHistory <${historyPath}> ;
  sflo:currentArtifactHistory <${historyPath}> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
`,
      "",
    )
    .replace(
      `
<${historyPath}> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${historyPath}/_s0001> ;
  sflo:latestHistoricalState <${historyPath}/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${historyPath}/index.html> .
`,
      "",
    );

  const plan = planWeave({
    request: {
      targets: [{
        designatorPath: "alice/data",
        historySegment: "archive",
        stateSegment: "v0.0.1",
        manifestationSegment: "ttl",
      }],
    },
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: firstReferenceCatalogWeaveMeshInventoryTurtle,
    weaveableKnops: [{
      designatorPath: "alice/data",
      currentKnopMetadataTurtle: firstPayloadWeaveKnopMetadataTurtle,
      currentKnopInventoryTurtle,
      payloadArtifact: {
        workingLocalRelativePath: "alice-data.ttl",
        currentArtifactHistoryPath: "alice/data/releases",
        currentPayloadTurtle:
          `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix schema: <https://schema.org/> .

<alice> a schema:Person .
<alice/data> dcterms:creator <alice> .
`,
        latestHistoricalStatePath: "alice/data/releases/v0.0.1",
      },
    }],
    supportHistoryPolicies: {
      knopInventory: "currentOnly",
    },
  });

  assertEquals(
    plan.createdFiles.map((file) => file.path),
    ["alice/data/archive/v0.0.1/ttl/alice-data.ttl"],
  );
  assertEquals(plan.createdPages.map((page) => page.path), [
    "alice/data/archive/v0.0.1/index.html",
    "alice/data/archive/v0.0.1/ttl/index.html",
  ]);
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "sflo:hasArtifactHistory <alice/data/archive> ;\n  sflo:hasArtifactHistory <alice/data/releases> ;",
  );
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "sflo:hasWorkingLocatedFile <alice/data/_knop/_inventory/inventory.ttl> ;",
  );
  assertFalse(
    (plan.updatedFiles[0]?.contents ?? "").includes(
      "alice/data/_knop/_inventory/_history001",
    ),
  );
});

Deno.test("planWeave rejects implicit ordinal advancement after a named payload state", () => {
  const currentKnopInventoryTurtle = secondPayloadWeaveKnopInventoryTurtle
    .replaceAll(
      "alice/data/_history001/_s0001",
      "alice/data/releases/v0.0.1",
    )
    .replaceAll("alice/data/_history001", "alice/data/releases");

  assertThrows(
    () =>
      planWeave({
        request: {
          targets: [{ designatorPath: "alice/data" }],
        },
        meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
        currentMeshInventoryTurtle:
          firstReferenceCatalogWeaveMeshInventoryTurtle,
        weaveableKnops: [{
          designatorPath: "alice/data",
          currentKnopMetadataTurtle: firstPayloadWeaveKnopMetadataTurtle,
          currentKnopInventoryTurtle,
          payloadArtifact: {
            workingLocalRelativePath: "alice-data.ttl",
            currentArtifactHistoryPath: "alice/data/releases",
            currentPayloadTurtle:
              `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix schema: <https://schema.org/> .

<alice> a schema:Person .
<alice/data> dcterms:creator <alice> .
`,
            latestHistoricalStatePath: "alice/data/releases/v0.0.1",
          },
        }],
      }),
    WeaveInputError,
    "Cannot auto-version payload artifact alice/data because current payload history alice/data/releases uses named historical state alice/data/releases/v0.0.1",
  );
});

Deno.test("planWeave renders the extracted bob woven slice", async () => {
  const plan = planWeave(await createExtractedBobWeaveInput());

  assertEquals(plan.wovenDesignatorPaths, ["bob"]);
  assertEquals(plan.updatedFiles.map((file) => file.path), [
    "_mesh/_inventory/inventory.ttl",
    "bob/_knop/_inventory/inventory.ttl",
    "bob/_knop/_sources/sources.ttl",
    "_mesh/_inventory/_history001/index.html",
    "_mesh/_meta/meta.ttl",
  ]);
  assertEquals(
    plan.createdPages.some((page) =>
      page.path === "bob/_knop/_references/index.html"
    ),
    false,
  );
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "<bob>\n  sflo:hasResourcePage <bob/index.html> .",
  );
  const bobPage = plan.createdFiles.find((file) =>
    file.path === "bob/index.html"
  );
  assertStringIncludes(bobPage?.contents ?? "", "<h1>bob</h1>");
});

Deno.test("planWeave accepts extracted terms from floating repository source payloads", async () => {
  const input = await createExtractedBobWeaveInput();
  const repositorySourceFloatingLocator = {
    repositoryUrl: "https://github.com/semantic-flow/mesh-alice-bio.git",
    repositoryPathFromRoot: "alice-data.ttl",
  };
  input.currentMeshInventoryTurtle = input.currentMeshInventoryTurtle.replace(
    "sflo:hasWorkingLocatedFile <alice-data.ttl> ;",
    `sflo:hasRepositorySourceFloatingLocator [
    a sflo:RepositorySourceFloatingLocator ;
    sflo:sourceRepositoryUrl "${repositorySourceFloatingLocator.repositoryUrl}" ;
    sflo:sourceRepositoryPathFromRoot "${repositorySourceFloatingLocator.repositoryPathFromRoot}"
  ] ;`,
  );
  input.weaveableKnops[0]!.referenceTargetSourcePayloadArtifact = {
    ...input.weaveableKnops[0]!.referenceTargetSourcePayloadArtifact!,
    repositorySourceFloatingLocator,
  };

  const plan = planWeave(input);

  assertEquals(plan.wovenDesignatorPaths, ["bob"]);
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "sflo:hasRepositorySourceFloatingLocator [",
  );
});

Deno.test("planWeave rejects extracted terms from mismatched floating repository sources", async () => {
  const input = await createExtractedBobWeaveInput();
  input.currentMeshInventoryTurtle = input.currentMeshInventoryTurtle.replace(
    "sflo:hasWorkingLocatedFile <alice-data.ttl> ;",
    `sflo:hasRepositorySourceFloatingLocator [
    a sflo:RepositorySourceFloatingLocator ;
    sflo:sourceRepositoryUrl "https://github.com/semantic-flow/mesh-alice-bio.git" ;
    sflo:sourceRepositoryPathFromRoot "alice-data.ttl"
  ] ;`,
  );
  input.weaveableKnops[0]!.referenceTargetSourcePayloadArtifact = {
    ...input.weaveableKnops[0]!.referenceTargetSourcePayloadArtifact!,
    repositorySourceFloatingLocator: {
      repositoryUrl: "https://github.com/example/not-alice-bio.git",
      repositoryPathFromRoot: "alice-data.ttl",
    },
  };

  assertThrows(
    () => planWeave(input),
    WeaveInputError,
    "settled extracted-knop pre-weave mesh inventory shape",
  );
});

Deno.test("planWeave applies current-only support history policies on extracted Knop weave", async () => {
  const input = await createExtractedBobWeaveInput();
  input.supportHistoryPolicies = {
    meshInventory: "currentOnly",
    knopMetadata: "currentOnly",
    knopInventory: "currentOnly",
  };

  const plan = planWeave(input);
  const createdPaths = plan.createdFiles.map((file) => file.path);

  assertFalse(
    createdPaths.some((path) =>
      path.startsWith("_mesh/_inventory/_history001/")
    ),
  );
  assertFalse(
    createdPaths.some((path) =>
      path.startsWith("bob/_knop/_meta/_history001/")
    ),
  );
  assertFalse(
    createdPaths.some((path) =>
      path.startsWith("bob/_knop/_inventory/_history001/")
    ),
  );
  assertFalse(
    plan.createdPages.some((page) =>
      page.path.startsWith("bob/_knop/_meta/_history001/")
    ),
  );
  assertFalse(
    plan.createdPages.some((page) =>
      page.path.startsWith("bob/_knop/_inventory/_history001/")
    ),
  );

  const knopInventory =
    plan.updatedFiles.find((file) =>
      file.path === "bob/_knop/_inventory/inventory.ttl"
    )?.contents ?? "";
  assertStringIncludes(
    knopInventory,
    `sflo:hasWorkingLocatedFile <bob/_knop/_meta/meta.ttl> ;
  sflo:hasResourcePage <bob/_knop/_meta/index.html> .`,
  );
  assertStringIncludes(
    knopInventory,
    `sflo:hasWorkingLocatedFile <bob/_knop/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <bob/_knop/_inventory/index.html> .`,
  );
  assertFalse(knopInventory.includes("bob/_knop/_meta/_history001"));
  assertFalse(knopInventory.includes("bob/_knop/_inventory/_history001"));
});

Deno.test("planWeave accepts semantically equivalent extracted bob ExtractionSource Turtle", async () => {
  const input = await createExtractedBobWeaveInput();
  input.weaveableKnops[0]!.referenceTargetSourcePayloadArtifact!
    .currentSourceRegistryTurtle = withRdfPrefix(
      input.weaveableKnops[0]!.referenceTargetSourcePayloadArtifact!
        .currentSourceRegistryTurtle!,
    ).replace(
      " a sflo:ExtractionSource ;",
      " rdf:type sflo:ExtractionSource ;",
    );

  const plan = planWeave(input);

  assertEquals(plan.wovenDesignatorPaths, ["bob"]);
  assertEquals(
    plan.createdPages.some((page) =>
      page.path === "bob/_knop/_references/index.html"
    ),
    false,
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

Deno.test("planWeave records exact extracted bob source state during weave", async () => {
  const input = await createExtractedBobWeaveInput();

  const plan = planWeave(input);
  const sourceDigest = input.weaveableKnops[0]!
    .referenceTargetSourcePayloadArtifact!.sourceEvidence!.sourceDigest!;

  assertStringIncludes(
    plan.updatedFiles[2]?.contents ?? "",
    `sflo:targetArtifact <alice/data> ;
  sflo:targetHistoricalState <alice/data/_history001/_s0002> ;
  sflo:hasResolutionObservation <bob/_knop/_sources#extraction-source-observation-001> .

<bob/_knop/_sources#extraction-source-observation-001> a sflo:ArtifactResolutionObservation ;
  sflo:observedArtifactResolutionSpec [
    a sflo:ArtifactResolutionSpec ;
    sflo:targetHistoricalState <alice/data/_history001/_s0002> ;
    sflo:targetManifestation <alice/data/_history001/_s0002/ttl> ;
    sflo:targetLocatedFile <alice/data/_history001/_s0002/ttl/alice-data.ttl>
  ] ;
  sflo:observedContentDigest "${sourceDigest}" .`,
  );
});

Deno.test("planWeave rejects extracted bob weave inputs when the source payload path does not match", async () => {
  const input = await createExtractedBobWeaveInput();
  input.weaveableKnops[0]!.referenceTargetSourcePayloadArtifact!
    .currentSourceRegistryTurtle = input.weaveableKnops[0]!
      .referenceTargetSourcePayloadArtifact!.currentSourceRegistryTurtle!
      .replace(
        "sflo:targetArtifact <alice/data> ;",
        "sflo:targetArtifact <carol/bio> ;",
      );

  assertThrows(
    () => planWeave(input),
    WeaveInputError,
    "settled extracted-knop source registry shape",
  );
});

Deno.test("planWeave rejects extracted bob weave inputs when the source payload state does not match", async () => {
  const input = await createExtractedBobWeaveInput();
  input.weaveableKnops[0]!.referenceTargetSourcePayloadArtifact!
    .currentSourceRegistryTurtle = withExactExtractedSourceState(
      input.weaveableKnops[0]!.referenceTargetSourcePayloadArtifact!
        .currentSourceRegistryTurtle!,
      "alice/data/_history001/_s0002",
    );
  input.weaveableKnops[0]!.referenceTargetSourcePayloadArtifact = {
    ...input.weaveableKnops[0]!.referenceTargetSourcePayloadArtifact!,
    latestHistoricalStatePath: "alice/data/_history001/_s0001",
  };

  assertThrows(
    () => planWeave(input),
    WeaveInputError,
    "settled extracted-knop source registry shape",
  );
});

Deno.test("planWeave accepts extracted weave inputs sourced from the root payload", () => {
  const extractPlan = planExtract({
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: rootSourcePreExtractMeshInventoryTurtle,
    designatorPath: "alice/data",
    sourceDesignatorPath: "",
    sourceStatePath: "_history001/_s0001",
    sourceWorkingLocalRelativePath: "root-person.ttl",
  });
  const createdFileByPath = new Map(
    extractPlan.createdFiles.map((file) => [file.path, file.contents]),
  );

  const plan = planWeave({
    request: {
      targets: [{ designatorPath: "alice/data" }],
    },
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: extractPlan.updatedFiles[0]!.contents,
    currentMeshMetadataTurtle: meshMetadataProgressionTurtle(
      "_mesh/_inventory/_history001/_s0003",
      4,
    ),
    weaveableKnops: [{
      designatorPath: "alice/data",
      currentKnopMetadataTurtle: createdFileByPath.get(
        "alice/data/_knop/_meta/meta.ttl",
      )!,
      currentKnopInventoryTurtle: createdFileByPath.get(
        "alice/data/_knop/_inventory/inventory.ttl",
      )!,
      referenceTargetSourcePayloadArtifact: {
        designatorPath: "",
        workingLocalRelativePath: "root-person.ttl",
        currentPayloadTurtle: rootSourcePersonPayloadTurtle,
        sourceRegistryWorkingLocalRelativePath:
          "alice/data/_knop/_sources/sources.ttl",
        currentSourceRegistryTurtle: createdFileByPath.get(
          "alice/data/_knop/_sources/sources.ttl",
        )!,
        latestHistoricalStatePath: "_history001/_s0001",
      },
    }],
  });

  assertEquals(plan.wovenDesignatorPaths, ["alice/data"]);
  assertEquals(
    plan.createdPages.some((page) =>
      page.path === "alice/data/_knop/_references/index.html"
    ),
    false,
  );
});

Deno.test("planWeave accepts an extracted root identifier sourced from an already woven nested payload", () => {
  const carolDataTurtle =
    `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix schema: <https://schema.org/> .

<carol> a schema:Person .
`;
  const currentMeshInventoryTurtle = laterFirstPayloadWeaveMeshInventoryTurtle
    .replace(
      "  sflo:hasKnop <alice/page-main/_knop> ;",
      "  sflo:hasKnop <carol/data/_knop> ;",
    )
    .replaceAll("alice/page-main", "carol/data")
    .replaceAll("alice-page-main.md", "carol-data.ttl");
  const dataPlan = planWeave({
    request: {
      targets: [{ designatorPath: "carol/data" }],
    },
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle,
    currentMeshMetadataTurtle: laterFirstPayloadWeaveMeshMetadataTurtle,
    weaveableKnops: [{
      designatorPath: "carol/data",
      currentKnopMetadataTurtle: laterFirstPayloadWeaveKnopMetadataTurtle
        .replaceAll("alice/page-main", "carol/data")
        .replaceAll("alice-page-main.md", "carol-data.ttl"),
      currentKnopInventoryTurtle: laterFirstPayloadWeaveKnopInventoryTurtle
        .replaceAll("alice/page-main", "carol/data")
        .replaceAll("alice-page-main.md", "carol-data.ttl"),
      payloadArtifact: {
        workingLocalRelativePath: "carol-data.ttl",
        currentPayloadTurtle: carolDataTurtle,
      },
    }],
  });
  const dataMeshInventory =
    dataPlan.updatedFiles.find((file) =>
      file.path === "_mesh/_inventory/inventory.ttl"
    )!.contents;
  const dataMeshMetadata =
    dataPlan.updatedFiles.find((file) => file.path === "_mesh/_meta/meta.ttl")!
      .contents;
  const extractPlan = planExtract({
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: dataMeshInventory,
    designatorPath: "carol",
    sourceDesignatorPath: "carol/data",
    sourceWorkingLocalRelativePath: "carol-data.ttl",
  });
  const createdFileByPath = new Map(
    extractPlan.createdFiles.map((file) => [file.path, file.contents]),
  );

  const plan = planWeave({
    request: {
      targets: [{ designatorPath: "carol" }],
    },
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: extractPlan.updatedFiles[0]!.contents,
    currentMeshMetadataTurtle: dataMeshMetadata,
    weaveableKnops: [{
      designatorPath: "carol",
      currentKnopMetadataTurtle: createdFileByPath.get(
        "carol/_knop/_meta/meta.ttl",
      )!,
      currentKnopInventoryTurtle: createdFileByPath.get(
        "carol/_knop/_inventory/inventory.ttl",
      )!,
      referenceTargetSourcePayloadArtifact: {
        designatorPath: "carol/data",
        workingLocalRelativePath: "carol-data.ttl",
        currentPayloadTurtle: carolDataTurtle,
        sourceRegistryWorkingLocalRelativePath:
          "carol/_knop/_sources/sources.ttl",
        currentSourceRegistryTurtle: createdFileByPath.get(
          "carol/_knop/_sources/sources.ttl",
        )!,
        latestHistoricalStatePath: "carol/data/_history001/_s0001",
      },
    }],
  });

  assertEquals(plan.wovenDesignatorPaths, ["carol"]);
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "<carol>\n  sflo:hasResourcePage <carol/index.html> .",
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
      `<alice/data/_knop> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <alice/data/_knop/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <alice/data/_knop/index.html> .`,
      `<alice/data/_knop> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <alice/data/_knop/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <alice/data/_knop/index.html> .

<carol>
  sflo:hasResourcePage <carol/index.html> .

<carol/_knop> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <carol/_knop/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <carol/_knop/index.html> .`,
    )
    .replace(
      `<alice-data.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh> sflo:hasKnop <bob/_knop> .`,
      `<alice-data.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<carol/_knop/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh> sflo:hasKnop <bob/_knop> .`,
    )
    .replace(
      `<alice/data/_knop/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_meta/index.html> a sflo:ResourcePage, sflo:LocatedFile .`,
      `<alice/data/_knop/index.html> a sflo:ResourcePage, sflo:LocatedFile .

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

Deno.test("planWeave rejects extracted bob inventory without typed ExtractionSource", async () => {
  const input = await createExtractedBobWeaveInput();
  input.weaveableKnops[0]!.referenceTargetSourcePayloadArtifact!
    .currentSourceRegistryTurtle = input.weaveableKnops[0]!
      .referenceTargetSourcePayloadArtifact!.currentSourceRegistryTurtle!
      .replace(
        "<bob/_knop/_sources#extraction-source> a sflo:ExtractionSource ;\n",
        "",
      );

  assertThrows(
    () => planWeave(input),
    WeaveInputError,
    "settled extracted-knop source registry shape",
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
    "alice/_knop/_page/_history001/_s0001/ttl/page.ttl",
    "alice/_knop/_inventory/_history001/_s0003/ttl/inventory.ttl",
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
    "alice/_knop/_inventory/_history001/_s0003/ttl/index.html",
    "alice/_knop/_page/index.html",
    "alice/_knop/_page/_history001/index.html",
    "alice/_knop/_page/_history001/_s0001/index.html",
    "alice/_knop/_page/_history001/_s0001/ttl/index.html",
  ]);
});

Deno.test("planWeave supports current-only first page-definition weave", async () => {
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
    supportHistoryPolicies: {
      resourcePageDefinition: "currentOnly",
    },
  });

  assertEquals(plan.wovenDesignatorPaths, ["alice"]);
  assertEquals(plan.createdFiles, []);
  assertEquals(plan.updatedFiles.map((file) => file.path), [
    "alice/_knop/_inventory/inventory.ttl",
  ]);
  assertEquals(plan.createdPages.map((page) => page.path), [
    "alice/index.html",
    "alice/_knop/_page/index.html",
  ]);
  const updatedKnopInventory = plan.updatedFiles[0]?.contents ?? "";
  assertStringIncludes(
    updatedKnopInventory,
    "sflo:hasResourcePage <alice/_knop/_page/index.html>",
  );
  assertFalse(updatedKnopInventory.includes("alice/_knop/_page/_history001"));
  assertEquals(
    detectPendingWeaveSlice(meshBase, "alice", updatedKnopInventory),
    undefined,
  );
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
      `  sflo:hasWorkingKnopInventoryFile <bob/_knop/_inventory/inventory.ttl> ;\n  sflo:hasResourcePage <bob/_knop/index.html> .\n`,
      `  sflo:hasWorkingKnopInventoryFile <bob/_knop/_inventory/inventory.ttl> ;\n  sflo:hasResourcePage <bob/_knop/index.html> ;\n  sflo:hasResourcePageDefinition <bob/_knop/_page> .\n`,
    )
    .replace(
      `<bob/_knop/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .\n`,
      `<bob/_knop/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .\n\n<bob/_knop/_page> a sflo:ResourcePageDefinition, sflo:DigitalArtifact, sflo:RdfDocument ;\n  sflo:hasWorkingLocatedFile <bob/_knop/_page/page.ttl> .\n\n<bob/_knop/_page/page.ttl> a sflo:LocatedFile, sflo:RdfDocument .\n`,
    );
  const pageDefinitionTurtle =
    `@base <https://semantic-flow.github.io/mesh-alice-bio/bob/_knop/_page> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<> a sflo:ResourcePageDefinition, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasPageRegion <#main-region> .

<#main-region> a sflo:ResourcePageRegion ;
  sflo:regionKey "main" ;
  sflo:hasResourcePageSource <#main-source> .

<#main-source> a sflo:ResourcePageSource ;
  sflo:targetArtifact <https://semantic-flow.github.io/mesh-alice-bio/bob/page-main> ;
  sflo:hasArtifactResolutionMode <https://semantic-flow.github.io/sflo/ontology/artifactResolutionMode_working> .
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
    "bob/_knop/_page/_history001/_s0001/ttl/page.ttl",
    "bob/_knop/_inventory/_history001/_s0002/ttl/inventory.ttl",
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
    "bob/_knop/_inventory/_history001/_s0002/ttl/index.html",
    "bob/_knop/_page/index.html",
    "bob/_knop/_page/_history001/index.html",
    "bob/_knop/_page/_history001/_s0001/index.html",
    "bob/_knop/_page/_history001/_s0001/ttl/index.html",
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
    `<#main-source> a sflo:ResourcePageSource ;
  sflo:targetLocalRelativePath "alice/alice.md" .`,
    `<#main-source> a sflo:ResourcePageSource ;
  sflo:targetArtifact <https://semantic-flow.github.io/mesh-alice-bio/alice/page-main> ;
  sflo:hasArtifactResolutionMode <https://semantic-flow.github.io/sflo/ontology/artifactResolutionMode_working> .`,
  );
  const latestHistoricalSnapshotTurtle = await readMeshAliceBioBranchFile(
    "17-alice-page-main-integrated-woven",
    "alice/_knop/_page/_history001/_s0001/ttl/page.ttl",
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
    "alice/_knop/_page/_history001/_s0002/ttl/page.ttl",
    "alice/_knop/_inventory/_history001/_s0004/ttl/inventory.ttl",
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
    "alice/_knop/_inventory/_history001/_s0004/ttl/index.html",
    "alice/_knop/_page/index.html",
    "alice/_knop/_page/_history001/index.html",
    "alice/_knop/_page/_history001/_s0002/index.html",
    "alice/_knop/_page/_history001/_s0002/ttl/index.html",
  ]);
});

Deno.test("planWeave renders a later page-definition weave revision without a reference catalog", async () => {
  const meshBase = "https://semantic-flow.github.io/mesh-alice-bio/";
  const fixtureRef = "a.25-root-page-customized-woven";
  const currentPageDefinitionTurtle = (
    await readMeshAliceBioBranchFile(
      fixtureRef,
      "_knop/_page/page.ttl",
    )
  ).replace(
    `<#main-source> a sflo:ResourcePageSource ;
  sflo:targetLocalRelativePath "home.md" .`,
    `<#main-source> a sflo:ResourcePageSource ;
  sflo:targetArtifact <https://semantic-flow.github.io/mesh-alice-bio/alice/bio> ;
  sflo:hasArtifactResolutionMode <https://semantic-flow.github.io/sflo/ontology/artifactResolutionMode_working> .`,
  );
  const latestHistoricalSnapshotTurtle = await readMeshAliceBioBranchFile(
    fixtureRef,
    "_knop/_page/_history001/_s0001/ttl/page.ttl",
  );
  const plan = planWeave({
    request: {
      targets: [{ designatorPath: "" }],
    },
    meshBase,
    currentMeshInventoryTurtle: await readMeshAliceBioBranchFile(
      fixtureRef,
      "_mesh/_inventory/inventory.ttl",
    ),
    weaveableKnops: [{
      designatorPath: "",
      currentKnopMetadataTurtle: await readMeshAliceBioBranchFile(
        fixtureRef,
        "_knop/_meta/meta.ttl",
      ),
      currentKnopInventoryTurtle: await readMeshAliceBioBranchFile(
        fixtureRef,
        "_knop/_inventory/inventory.ttl",
      ),
      resourcePageDefinitionArtifact: {
        artifactPath: "_knop/_page",
        workingLocalRelativePath: "_knop/_page/page.ttl",
        currentPageDefinitionTurtle,
        currentArtifactHistoryPath: "_knop/_page/_history001",
        currentArtifactHistoryExists: true,
        latestHistoricalStatePath: "_knop/_page/_history001/_s0001",
        latestHistoricalSnapshotTurtle,
        assetBundlePath: "_knop/_assets",
      },
    }],
  });

  assertEquals(plan.wovenDesignatorPaths, [""]);
  assertEquals(plan.updatedFiles.map((file) => file.path), [
    "_knop/_inventory/inventory.ttl",
  ]);
  assertEquals(plan.createdFiles.map((file) => file.path), [
    "_knop/_page/_history001/_s0002/ttl/page.ttl",
    "_knop/_inventory/_history001/_s0003/ttl/inventory.ttl",
  ]);
  assertEquals(plan.createdFiles[0]?.contents, currentPageDefinitionTurtle);
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "sflo:latestHistoricalState <_knop/_page/_history001/_s0002> ;",
  );
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "sflo:latestHistoricalState <_knop/_inventory/_history001/_s0003> ;",
  );
  assertEquals(plan.createdPages.map((page) => page.path), [
    "index.html",
    "_knop/_inventory/_history001/_s0003/index.html",
    "_knop/_inventory/_history001/_s0003/ttl/index.html",
    "_knop/_page/index.html",
    "_knop/_page/_history001/index.html",
    "_knop/_page/_history001/_s0002/index.html",
    "_knop/_page/_history001/_s0002/ttl/index.html",
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
    "_knop/_page/_history001/_s0001/ttl/page.ttl",
    "_knop/_inventory/_history001/_s0002/ttl/inventory.ttl",
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
    "_knop/_inventory/_history001/_s0002/ttl/index.html",
    "_knop/_page/index.html",
    "_knop/_page/_history001/index.html",
    "_knop/_page/_history001/_s0001/index.html",
    "_knop/_page/_history001/_s0001/ttl/index.html",
  ]);
});

async function createExtractedBobWeaveInput(): Promise<PlanWeaveInput> {
  const latestHistoricalSnapshotPath =
    "alice/data/_history001/_s0002/ttl/alice-data.ttl";
  const latestHistoricalSnapshotTurtle = await readMeshAliceBioBranchFile(
    "11-alice-bio-v2-woven",
    latestHistoricalSnapshotPath,
  );
  const sourceDigest = await sha256Digest(latestHistoricalSnapshotTurtle);
  const extractPlan = planExtract({
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: await readMeshAliceBioBranchFile(
      "11-alice-bio-v2-woven",
      "_mesh/_inventory/inventory.ttl",
    ),
    designatorPath: "bob",
    sourceDesignatorPath: "alice/data",
    sourceStatePath: "alice/data/_history001/_s0002",
    sourceEvidence: {
      sourceLocatedFilePath: "alice-data.ttl",
      sourceDigest,
    },
    sourceWorkingLocalRelativePath: "alice-data.ttl",
  });
  const createdFileByPath = new Map(
    extractPlan.createdFiles.map((file) => [file.path, file.contents]),
  );
  return {
    request: {
      targets: [{ designatorPath: "bob" }],
    },
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    currentMeshInventoryTurtle: extractPlan.updatedFiles[0]!.contents,
    currentMeshMetadataTurtle: meshMetadataProgressionTurtle(
      "_mesh/_inventory/_history001/_s0003",
      4,
    ),
    weaveableKnops: [{
      designatorPath: "bob",
      currentKnopMetadataTurtle: createdFileByPath.get(
        "bob/_knop/_meta/meta.ttl",
      )!,
      currentKnopInventoryTurtle: createdFileByPath.get(
        "bob/_knop/_inventory/inventory.ttl",
      )!,
      referenceTargetSourcePayloadArtifact: {
        designatorPath: "alice/data",
        workingLocalRelativePath: "alice-data.ttl",
        currentPayloadTurtle: await readMeshAliceBioBranchFile(
          "12-bob-extracted",
          "alice-data.ttl",
        ),
        sourceRegistryWorkingLocalRelativePath:
          "bob/_knop/_sources/sources.ttl",
        currentSourceRegistryTurtle: createdFileByPath.get(
          "bob/_knop/_sources/sources.ttl",
        )!,
        latestHistoricalSnapshotPath,
        latestHistoricalSnapshotTurtle,
        latestHistoricalStatePath: "alice/data/_history001/_s0002",
        sourceEvidence: {
          sourceStatePath: "alice/data/_history001/_s0002",
          sourceManifestationPath: "alice/data/_history001/_s0002/ttl",
          sourceLocatedFilePath: latestHistoricalSnapshotPath,
          sourceDigest,
        },
      },
    }],
  };
}

function withExactExtractedSourceState(
  turtle: string,
  sourceStatePath: string,
): string {
  return turtle.replace(
    / {2}sflo:targetArtifact <alice\/data> ;\n(?: {2}sflo:[^\n]+(?: ;|\.)\n?)+/,
    `  sflo:targetArtifact <alice/data> ;
  sflo:targetHistoricalState <${sourceStatePath}> .`,
  );
}

function withRdfPrefix(turtle: string): string {
  return turtle.includes("@prefix rdf:") ? turtle : turtle.replace(
    "@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .",
    `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .`,
  );
}

async function sha256Digest(contents: string): Promise<string> {
  const bytes = new TextEncoder().encode(contents);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
}
