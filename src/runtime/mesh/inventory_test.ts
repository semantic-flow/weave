import { assertEquals, assertThrows } from "@std/assert";
import {
  listKnopDesignatorPaths,
  resolvePayloadArtifactInventoryState,
  resolveReferenceCatalogInventoryState,
  resolveReferenceTargetDesignatorPath,
  resolveResourcePageDefinitionInventoryState,
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

Deno.test("listKnopDesignatorPaths includes the root designator when the root Knop exists", () => {
  assertEquals(
    listKnopDesignatorPaths(
      MESH_BASE,
      `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@base <${MESH_BASE}> .

<_knop> rdf:type sflo:Knop .
<alice/_knop> rdf:type sflo:Knop .
`,
      "Could not parse mesh inventory",
    ),
    ["", "alice"],
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
      `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@base <${MESH_BASE}> .

<alice/_knop/_references#reference001> rdf:type sflo:ReferenceLink ;
  sflo:referenceLinkFor <alice> ;
  sflo:hasReferenceRole <https://semantic-flow.github.io/semantic-flow-ontology/ReferenceRole/Supplemental> ;
  sflo:referenceTarget <alice/bio> ;
  sflo:referenceTargetState <alice/bio/_history001/_s0002> .
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

Deno.test("resolveReferenceTargetDesignatorPath ignores unrelated catalog fragments", () => {
  assertEquals(
    resolveReferenceTargetDesignatorPath(
      MESH_BASE,
      `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@base <${MESH_BASE}> .

<alice/_knop/_references#note> sflo:referenceTarget <carol/bio> .

<alice/_knop/_references#reference001> rdf:type sflo:ReferenceLink ;
  sflo:referenceLinkFor <alice> ;
  sflo:hasReferenceRole <https://semantic-flow.github.io/semantic-flow-ontology/ReferenceRole/Supplemental> ;
  sflo:referenceTarget <alice/bio> ;
  sflo:referenceTargetState <alice/bio/_history001/_s0002> .
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

Deno.test("resolvePayloadArtifactInventoryState rejects working file IRIs with query or fragment parts", () => {
  assertThrows(
    () =>
      resolvePayloadArtifactInventoryState(
        MESH_BASE,
        `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@base <${MESH_BASE}> .

<alice/bio/_history001> rdf:type sflo:ArtifactHistory .
<alice/bio> sflo:hasWorkingLocatedFile <alice-bio.ttl?rev=1> ;
  rdf:type sflo:PayloadArtifact ;
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
    Error,
    "Could not resolve working payload file",
  );
  assertThrows(
    () =>
      resolvePayloadArtifactInventoryState(
        MESH_BASE,
        `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@base <${MESH_BASE}> .

<alice/bio/_history001> rdf:type sflo:ArtifactHistory .
<alice/bio> sflo:hasWorkingLocatedFile <alice-bio.ttl#manifest> ;
  rdf:type sflo:PayloadArtifact ;
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
    Error,
    "Could not resolve working payload file",
  );
});

Deno.test("resolvePayloadArtifactInventoryState accepts workingFilePath literals without hasWorkingLocatedFile", () => {
  assertEquals(
    resolvePayloadArtifactInventoryState(
      MESH_BASE,
      `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@base <${MESH_BASE}> .

<alice/bio/_history001> rdf:type sflo:ArtifactHistory .
<alice/bio> sflo:workingFilePath "alice-bio.ttl" ;
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
      latestHistoricalStatePath: undefined,
    },
  );
});

Deno.test("resolvePayloadArtifactInventoryState rejects inconsistent workingFilePath and hasWorkingLocatedFile", () => {
  assertThrows(
    () =>
      resolvePayloadArtifactInventoryState(
        MESH_BASE,
        `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@base <${MESH_BASE}> .

<alice/bio/_history001> rdf:type sflo:ArtifactHistory .
<alice/bio> sflo:workingFilePath "alice-bio-v2.ttl" ;
  sflo:hasWorkingLocatedFile <alice-bio.ttl> ;
  rdf:type sflo:PayloadArtifact ;
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
    Error,
    "Could not resolve working payload file",
  );
});

Deno.test("resolvePayloadArtifactInventoryState rejects unsupported workingFilePath literals", () => {
  assertThrows(
    () =>
      resolvePayloadArtifactInventoryState(
        MESH_BASE,
        `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@base <${MESH_BASE}> .

<alice/bio/_history001> rdf:type sflo:ArtifactHistory .
<alice/bio> sflo:workingFilePath "../alice-bio.ttl" ;
  rdf:type sflo:PayloadArtifact ;
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
    Error,
    "Could not resolve working payload file",
  );
});

Deno.test("resolveReferenceCatalogInventoryState accepts workingFilePath literals without hasWorkingLocatedFile", () => {
  assertEquals(
    resolveReferenceCatalogInventoryState(
      MESH_BASE,
      `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@base <${MESH_BASE}> .

<alice/_knop/_references> rdf:type sflo:ReferenceCatalog, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:workingFilePath "alice/_knop/_references/references.ttl" .
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

Deno.test("resolveResourcePageDefinitionInventoryState accepts workingFilePath literals without hasWorkingLocatedFile", () => {
  assertEquals(
    resolveResourcePageDefinitionInventoryState(
      MESH_BASE,
      `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@prefix sfc: <https://semantic-flow.github.io/ontology/core/> .
@base <${MESH_BASE}> .

<alice/_knop> rdf:type sflo:Knop ;
  sfc:hasResourcePageDefinition <alice/_knop/_page> ;
  sfc:hasKnopAssetBundle <alice/_knop/_assets> .

<alice/_knop/_page> rdf:type sfc:ResourcePageDefinition, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:workingFilePath "alice/_knop/_page/page.ttl" .

<alice/_knop/_assets> rdf:type sfc:KnopAssetBundle .
`,
      "alice",
      {
        parseErrorMessage: "Could not parse Knop inventory",
        missingWorkingFileMessage:
          "Could not resolve working ResourcePageDefinition file",
      },
    ),
    {
      artifactPath: "alice/_knop/_page",
      workingFilePath: "alice/_knop/_page/page.ttl",
      currentArtifactHistoryPath: undefined,
      currentArtifactHistoryExists: false,
      latestHistoricalStatePath: undefined,
      assetBundlePath: "alice/_knop/_assets",
    },
  );
});
