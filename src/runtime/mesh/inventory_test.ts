import { assertEquals } from "@std/assert";
import {
  listKnopDesignatorPaths,
  resolvePayloadArtifactInventoryState,
  resolveReferenceCatalogInventoryState,
  resolveReferenceTargetDesignatorPath,
} from "./inventory.ts";

const MESH_BASE = "https://semantic-flow.github.io/mesh-alice-bio/";

Deno.test("listKnopDesignatorPaths accepts semantically equivalent mesh inventory turtle", () => {
  assertEquals(
    listKnopDesignatorPaths(
      MESH_BASE,
      `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@base <${MESH_BASE}> .

<alice/bio/_knop> rdf:type sflo:Knop .
<alice/_knop> sflo:hasPayloadArtifact <alice> ;
  rdf:type sflo:Knop .
<https://example.org/external/_knop> rdf:type sflo:Knop .
`,
      "Could not parse mesh inventory",
    ),
    ["alice", "alice/bio"],
  );
});

Deno.test("resolvePayloadArtifactInventoryState accepts semantically equivalent Knop inventory turtle", () => {
  assertEquals(
    resolvePayloadArtifactInventoryState(
      MESH_BASE,
      `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@base <${MESH_BASE}> .

<alice/bio/_history001> sflo:latestHistoricalState <alice/bio/_history001/_s0002> ;
  rdf:type sflo:ArtifactHistory .
<alice/bio> sflo:hasWorkingLocatedFile <alice-bio.ttl> ;
  rdf:type sflo:RdfDocument, sflo:DigitalArtifact, sflo:PayloadArtifact ;
  sflo:currentArtifactHistory <alice/bio/_history001> .
<alice/bio/_knop> rdf:type sflo:Knop ;
  sflo:hasPayloadArtifact <alice/bio> .
`,
      "alice/bio",
      {
        parseErrorMessage: "Could not parse Knop inventory",
        missingWorkingFileMessage: "Could not resolve working payload file",
      },
    ),
    {
      workingFilePath: "alice-bio.ttl",
      currentArtifactHistoryPath: "alice/bio/_history001",
      currentArtifactHistoryExists: true,
      latestHistoricalStatePath: "alice/bio/_history001/_s0002",
    },
  );
});

Deno.test("resolvePayloadArtifactInventoryState tracks a missing ArtifactHistory node without failing closed", () => {
  assertEquals(
    resolvePayloadArtifactInventoryState(
      MESH_BASE,
      `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@base <${MESH_BASE}> .

<alice/bio> sflo:currentArtifactHistory <alice/bio/_history001> ;
  sflo:hasWorkingLocatedFile <alice-bio.ttl> ;
  rdf:type sflo:PayloadArtifact .
<alice/bio/_knop> rdf:type sflo:Knop ;
  sflo:hasPayloadArtifact <alice/bio> .
`,
      "alice/bio",
      {
        parseErrorMessage: "Could not parse Knop inventory",
        missingWorkingFileMessage: "Could not resolve working payload file",
      },
    ),
    {
      workingFilePath: "alice-bio.ttl",
      currentArtifactHistoryPath: "alice/bio/_history001",
      currentArtifactHistoryExists: false,
      latestHistoricalStatePath: undefined,
    },
  );
});

Deno.test("resolveReferenceCatalogInventoryState accepts semantically equivalent Knop inventory turtle", () => {
  assertEquals(
    resolveReferenceCatalogInventoryState(
      MESH_BASE,
      `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@base <${MESH_BASE}> .

<alice/_knop/_references> rdf:type sflo:ReferenceCatalog, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <alice/_knop/_references/references.ttl> .
<alice/_knop> rdf:type sflo:Knop ;
  sflo:hasReferenceCatalog <alice/_knop/_references> .
`,
      "alice",
      {
        parseErrorMessage: "Could not parse Knop inventory",
        missingWorkingFileMessage:
          "Could not resolve working ReferenceCatalog file",
      },
    ),
    {
      workingFilePath: "alice/_knop/_references/references.ttl",
    },
  );
});

Deno.test("resolveReferenceTargetDesignatorPath accepts semantically equivalent ReferenceCatalog turtle", () => {
  assertEquals(
    resolveReferenceTargetDesignatorPath(
      MESH_BASE,
      `@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@base <${MESH_BASE}> .

<alice/_knop/_references#reference001> sflo:referenceRole sflo:ExtractedReference ;
  sflo:referenceTarget <alice/bio> .
`,
      "alice",
      {
        parseErrorMessage: "Could not parse ReferenceCatalog",
        missingReferenceLinkMessage:
          "Could not resolve current extracted ReferenceCatalog link",
        missingReferenceTargetMessage:
          "Could not resolve current extracted ReferenceCatalog target",
      },
    ),
    "alice/bio",
  );
});
