import { assertEquals, assertThrows } from "@std/assert";
import {
  listImportSourceInventoryStates,
  listIntegrationSourceInventoryStates,
  listKnopDesignatorPaths,
  resolveExtractionSourceInventoryState,
  resolveHistoricalStateLocatedFilePath,
  resolveKnopSourceRegistryInventoryState,
  resolvePayloadArtifactInventoryState,
  resolveReferenceCatalogInventoryState,
  resolveReferenceTargetDesignatorPath,
  resolveReferenceTargetLinkState,
  resolveResourcePageDefinitionInventoryState,
  tryResolveReferenceTargetLinkState,
} from "./inventory.ts";

const MESH_BASE = "https://semantic-flow.github.io/mesh-alice-bio/";

Deno.test("listKnopDesignatorPaths accepts semantically equivalent mesh inventory turtle", () => {
  assertEquals(
    listKnopDesignatorPaths(
      MESH_BASE,
      `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
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
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
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
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
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
      workingLocalRelativePath: "alice-bio.ttl",
      workingLocatedFilePath: "alice-bio.ttl",
      currentArtifactHistoryPath: "alice/bio/_history001",
      currentArtifactHistoryExists: true,
      latestHistoricalStatePath: "alice/bio/_history001/_s0002",
    },
  );
});

Deno.test("resolvePayloadArtifactInventoryState accepts repository floating payload locators", () => {
  assertEquals(
    resolvePayloadArtifactInventoryState(
      MESH_BASE,
      `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@base <${MESH_BASE}> .

<alice/bio> rdf:type sflo:RdfDocument, sflo:DigitalArtifact, sflo:PayloadArtifact ;
  sflo:hasRepositorySourceFloatingLocator [
    a sflo:RepositorySourceFloatingLocator ;
    sflo:sourceRepositoryUrl "https://github.com/semantic-flow/sflo.git" ;
    sflo:sourceRepositoryPathFromRoot "semantic-flow-core-ontology.ttl"
  ] .
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
      workingLocalRelativePath: "semantic-flow-core-ontology.ttl",
      repositorySourceFloatingLocator: {
        repositoryUrl: "https://github.com/semantic-flow/sflo.git",
        repositoryPathFromRoot: "semantic-flow-core-ontology.ttl",
      },
      currentArtifactHistoryPath: undefined,
      currentArtifactHistoryExists: false,
      latestHistoricalStatePath: undefined,
    },
  );
});

Deno.test("resolvePayloadArtifactInventoryState resolves latest payload snapshot paths from state and manifestation links", () => {
  assertEquals(
    resolvePayloadArtifactInventoryState(
      MESH_BASE,
      `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@base <${MESH_BASE}> .

<alice/bio/_history001> sflo:latestHistoricalState <alice/bio/_history001/_s0002> ;
  rdf:type sflo:ArtifactHistory .
<alice/bio/_history001/_s0002> sflo:hasManifestation <alice/bio/_history001/_s0002/ttl> ;
  sflo:locatedFileForState <alice/bio/_history001/_s0002/ttl/alice-bio.ttl> .
<alice/bio/_history001/_s0002/ttl> sflo:locatedFileForManifestation <alice/bio/_history001/_s0002/ttl/alice-bio.ttl> .
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
      workingLocalRelativePath: "alice-bio.ttl",
      workingLocatedFilePath: "alice-bio.ttl",
      currentArtifactHistoryPath: "alice/bio/_history001",
      currentArtifactHistoryExists: true,
      latestHistoricalStatePath: "alice/bio/_history001/_s0002",
      latestHistoricalSnapshotPath:
        "alice/bio/_history001/_s0002/ttl/alice-bio.ttl",
    },
  );
});

Deno.test("resolveHistoricalStateLocatedFilePath resolves non-latest snapshot paths", () => {
  const inventoryTurtle =
    `@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@base <${MESH_BASE}> .

<alice/bio/_history001/_s0001> sflo:hasManifestation <alice/bio/_history001/_s0001/jsonld> .
<alice/bio/_history001/_s0001/jsonld> sflo:locatedFileForManifestation <alice/bio/_history001/_s0001/jsonld/alice.jsonld> .
`;

  assertEquals(
    resolveHistoricalStateLocatedFilePath(
      MESH_BASE,
      inventoryTurtle,
      "alice/bio/_history001/_s0001",
      "Could not parse Knop inventory",
    ),
    "alice/bio/_history001/_s0001/jsonld/alice.jsonld",
  );
});

Deno.test("resolvePayloadArtifactInventoryState tracks a missing ArtifactHistory node without failing closed", () => {
  assertEquals(
    resolvePayloadArtifactInventoryState(
      MESH_BASE,
      `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
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
      workingLocalRelativePath: "alice-bio.ttl",
      workingLocatedFilePath: "alice-bio.ttl",
      currentArtifactHistoryPath: "alice/bio/_history001",
      currentArtifactHistoryExists: false,
      latestHistoricalStatePath: undefined,
    },
  );
});

Deno.test("resolveExtractionSourceInventoryState returns source registry observed target evidence", () => {
  const inventoryTurtle =
    `@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@base <${MESH_BASE}> .

<bob/_knop> a sflo:Knop ;
  sflo:hasKnopSourceRegistry <bob/_knop/_sources> ;
  sflo:hasExtractionSource <bob/_knop/_sources#extraction-source> .

<bob/_knop/_sources> a sflo:KnopSourceRegistry, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <bob/_knop/_sources/sources.ttl> .
`;
  const sourcesTurtle =
    `@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@base <${MESH_BASE}> .

<bob/_knop/_sources> a sflo:KnopSourceRegistry, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <bob/_knop/_sources/sources.ttl> ;
  sflo:hasSourceBinding <bob/_knop/_sources#extraction-source> .

<bob/_knop/_sources#extraction-source> a sflo:ExtractionSource ;
  sflo:hasTargetArtifact <alice/bio> ;
  sflo:hasRequestedTargetState <alice/bio/_history001/_s0002> ;
  sflo:hasResolutionObservation <bob/_knop/_sources#extraction-source-observation-001> .

<bob/_knop/_sources#extraction-source-observation-001> a sflo:ArtifactResolutionObservation ;
  sflo:hasObservedTargetState <alice/bio/_history001/_s0002> ;
  sflo:hasObservedTargetManifestation <alice/bio/_history001/_s0002/ttl> ;
  sflo:hasObservedTargetLocatedFile <alice/bio/_history001/_s0002/ttl/alice-bio.ttl> ;
  sflo:observedTargetLocalRelativePath "../alice-bio.ttl" ;
  sflo:observedContentDigest "sha256:abc123" .
`;

  assertEquals(
    resolveExtractionSourceInventoryState(
      MESH_BASE,
      inventoryTurtle,
      "bob",
      {
        parseErrorMessage: "Could not parse Knop inventory",
        missingExtractionSourceMessage: "Missing ExtractionSource",
        missingTargetArtifactMessage: "Missing target artifact",
        missingRequestedTargetStateMessage: "Missing requested target state",
        unsupportedResolutionModeMessage: "Unsupported resolution mode",
      },
      sourcesTurtle,
    ),
    {
      sourceArtifactPath: "alice/bio",
      requestedTargetStatePath: "alice/bio/_history001/_s0002",
      observedSourceStatePath: "alice/bio/_history001/_s0002",
      observedSourceManifestationPath: "alice/bio/_history001/_s0002/ttl",
      observedSourceLocatedFilePath:
        "alice/bio/_history001/_s0002/ttl/alice-bio.ttl",
      observedSourceLocalRelativePath: "../alice-bio.ttl",
      observedSourceDigest: "sha256:abc123",
    },
  );
});

Deno.test("resolveExtractionSourceInventoryState reads source registry extraction bindings", () => {
  const inventoryTurtle =
    `@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@base <${MESH_BASE}> .

<bob/_knop> a sflo:Knop ;
  sflo:hasKnopSourceRegistry <bob/_knop/_sources> ;
  sflo:hasExtractionSource <bob/_knop/_sources#extraction-source> .

<bob/_knop/_sources> a sflo:KnopSourceRegistry, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <bob/_knop/_sources/sources.ttl> .
`;
  const sourcesTurtle =
    `@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@base <${MESH_BASE}> .

<bob/_knop/_sources> a sflo:KnopSourceRegistry, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <bob/_knop/_sources/sources.ttl> ;
  sflo:hasSourceBinding <bob/_knop/_sources#extraction-source> .

<bob/_knop/_sources#extraction-source> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> sflo:ExtractionSource ;
  sflo:hasTargetArtifact <alice/bio> ;
  sflo:hasArtifactResolutionMode <https://semantic-flow.github.io/sflo/ontology/artifactResolutionMode_working> .
`;

  assertEquals(
    resolveKnopSourceRegistryInventoryState(
      MESH_BASE,
      inventoryTurtle,
      "bob",
      {
        parseErrorMessage: "Could not parse Knop inventory",
        missingSourceRegistryMessage: "Missing source registry",
        missingWorkingFileMessage: "Missing source registry working file",
      },
    ),
    {
      sourceRegistryPath: "bob/_knop/_sources",
      workingLocalRelativePath: "bob/_knop/_sources/sources.ttl",
    },
  );
  assertEquals(
    resolveExtractionSourceInventoryState(
      MESH_BASE,
      inventoryTurtle,
      "bob",
      {
        parseErrorMessage: "Could not parse Knop inventory",
        missingExtractionSourceMessage: "Missing ExtractionSource",
        missingTargetArtifactMessage: "Missing target artifact",
        missingRequestedTargetStateMessage: "Missing requested target state",
        unsupportedResolutionModeMessage: "Unsupported resolution mode",
      },
      sourcesTurtle,
    ),
    {
      sourceArtifactPath: "alice/bio",
      artifactResolutionModeIri:
        "https://semantic-flow.github.io/sflo/ontology/artifactResolutionMode_working",
    },
  );
});

Deno.test("listIntegrationSourceInventoryStates reads IntegrationSource bindings without observations", () => {
  const sourcesTurtle =
    `@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@base <${MESH_BASE}> .

<alice/bio/_knop/_sources> a sflo:KnopSourceRegistry, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <alice/bio/_knop/_sources/sources.ttl> ;
  sflo:hasSourceBinding <alice/bio/_knop/_sources#payload-source> .

<alice/bio/_knop/_sources#payload-source> a sflo:IntegrationSource ;
  sflo:hasTargetArtifact <alice/bio> ;
  sflo:targetLocalRelativePath "../source/alice-bio.ttl" ;
  sflo:hasArtifactResolutionMode <https://semantic-flow.github.io/sflo/ontology/artifactResolutionMode_working> .
`;

  assertEquals(
    listIntegrationSourceInventoryStates(
      MESH_BASE,
      sourcesTurtle,
      "alice/bio/_knop/_sources",
      {
        parseErrorMessage: "Could not parse source registry",
        missingTargetArtifactMessage: "Missing target artifact",
        unsupportedResolutionModeMessage: "Unsupported resolution mode",
      },
    ),
    [{
      sourceBindingIri:
        "https://semantic-flow.github.io/mesh-alice-bio/alice/bio/_knop/_sources#payload-source",
      sourceArtifactPath: "alice/bio",
      targetLocalRelativePath: "../source/alice-bio.ttl",
      artifactResolutionModeIri:
        "https://semantic-flow.github.io/sflo/ontology/artifactResolutionMode_working",
    }],
  );
});

Deno.test("listIntegrationSourceInventoryStates reads repository-backed observations", () => {
  const sourcesTurtle =
    `@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@base <${MESH_BASE}> .

<alice/bio/_knop/_sources> a sflo:KnopSourceRegistry, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <alice/bio/_knop/_sources/sources.ttl> ;
  sflo:hasSourceBinding <alice/bio/_knop/_sources#payload-source> .

<alice/bio/_knop/_sources#payload-source> a sflo:IntegrationSource ;
  sflo:hasTargetArtifact <alice/bio> ;
  sflo:targetLocalRelativePath "../source/alice-bio.ttl" ;
  sflo:hasArtifactResolutionMode <https://semantic-flow.github.io/sflo/ontology/artifactResolutionMode_working> ;
  sflo:expectsContentDigest "sha256:abc123" ;
  sflo:hasResolutionObservation <alice/bio/_knop/_sources#payload-source-observation-001> ;
  sflo:hasTargetRepositorySource [
    a sflo:RepositorySourceLocator ;
    sflo:sourceRepositoryUrl "https://github.com/semantic-flow/mesh-alice-bio.git" ;
    sflo:sourceRepositoryRef "main" ;
    sflo:sourceRepositoryCommit "def456" ;
    sflo:sourceRepositoryPath "alice-bio.ttl" ;
    sflo:hasContentDigest "sha256:abc123"
  ] .

<alice/bio/_knop/_sources#payload-source-observation-001> a sflo:ArtifactResolutionObservation ;
  sflo:observedContentDigest "sha256:abc123" .
`;

  assertEquals(
    listIntegrationSourceInventoryStates(
      MESH_BASE,
      sourcesTurtle,
      "alice/bio/_knop/_sources",
      {
        parseErrorMessage: "Could not parse source registry",
        missingTargetArtifactMessage: "Missing target artifact",
        unsupportedResolutionModeMessage: "Unsupported resolution mode",
      },
    ),
    [{
      sourceBindingIri:
        "https://semantic-flow.github.io/mesh-alice-bio/alice/bio/_knop/_sources#payload-source",
      sourceArtifactPath: "alice/bio",
      targetLocalRelativePath: "../source/alice-bio.ttl",
      artifactResolutionModeIri:
        "https://semantic-flow.github.io/sflo/ontology/artifactResolutionMode_working",
      expectedContentDigest: "sha256:abc123",
      repositorySource: {
        repositoryUrl: "https://github.com/semantic-flow/mesh-alice-bio.git",
        repositoryRef: "main",
        repositoryCommit: "def456",
        repositoryPath: "alice-bio.ttl",
        contentDigest: "sha256:abc123",
      },
      observedSourceDigest: "sha256:abc123",
    }],
  );
});

Deno.test("listImportSourceInventoryStates reads URL import source observations", () => {
  const sourcesTurtle =
    `@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@base <${MESH_BASE}> .

<bob/page-main/_knop/_sources> a sflo:KnopSourceRegistry, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <bob/page-main/_knop/_sources/sources.ttl> ;
  sflo:hasSourceBinding <bob/page-main/_knop/_sources#payload-source> .

<bob/page-main/_knop/_sources#payload-source> a sflo:ImportSource ;
  sflo:hasTargetArtifact <bob/page-main> ;
  sflo:targetAccessUrl "https://example.com/bob.md" ;
  sflo:hasArtifactResolutionMode <https://semantic-flow.github.io/sflo/ontology/artifactResolutionMode_working> ;
  sflo:expectsContentDigest "sha256:abc123" ;
  sflo:hasResolutionObservation <bob/page-main/_knop/_sources#payload-source-observation-001> .

<bob/page-main/_knop/_sources#payload-source-observation-001> a sflo:ArtifactResolutionObservation ;
  sflo:observedContentDigest "sha256:abc123" ;
  sflo:observedTargetLocalRelativePath "bob-page-main.md" ;
  sflo:observedAt "2026-05-24T20:00:00.000Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
`;

  assertEquals(
    listImportSourceInventoryStates(
      MESH_BASE,
      sourcesTurtle,
      "bob/page-main/_knop/_sources",
      {
        parseErrorMessage: "Could not parse source registry",
        missingTargetArtifactMessage: "Missing target artifact",
        unsupportedResolutionModeMessage: "Unsupported resolution mode",
      },
    ),
    [{
      sourceBindingIri:
        "https://semantic-flow.github.io/mesh-alice-bio/bob/page-main/_knop/_sources#payload-source",
      sourceArtifactPath: "bob/page-main",
      targetAccessUrl: "https://example.com/bob.md",
      artifactResolutionModeIri:
        "https://semantic-flow.github.io/sflo/ontology/artifactResolutionMode_working",
      expectedContentDigest: "sha256:abc123",
      observedSourceLocalRelativePath: "bob-page-main.md",
      observedSourceDigest: "sha256:abc123",
      observedAt: "2026-05-24T20:00:00.000Z",
    }],
  );
});

Deno.test("resolveReferenceCatalogInventoryState accepts semantically equivalent Knop inventory turtle", () => {
  assertEquals(
    resolveReferenceCatalogInventoryState(
      MESH_BASE,
      `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
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
      workingLocalRelativePath: "alice/_knop/_references/references.ttl",
    },
  );
});

Deno.test("resolveReferenceTargetDesignatorPath accepts semantically equivalent ReferenceCatalog turtle", () => {
  assertEquals(
    resolveReferenceTargetDesignatorPath(
      MESH_BASE,
      `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@base <${MESH_BASE}> .

<alice/_knop/_references#reference001> rdf:type sflo:ReferenceLink ;
  sflo:referenceLinkFor <alice> ;
  sflo:hasReferenceRole <https://semantic-flow.github.io/sflo/ontology/referenceRole_supplemental> ;
  sflo:hasReferenceSource <alice/_knop/_references#reference001-source> .

<alice/_knop/_references#reference001-source> rdf:type sflo:ReferenceSource ;
  sflo:hasTargetArtifact <alice/bio> ;
  sflo:hasRequestedTargetState <alice/bio/_history001/_s0002> .
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

Deno.test("resolveReferenceTargetLinkState returns the exact target state", () => {
  assertEquals(
    resolveReferenceTargetLinkState(
      MESH_BASE,
      `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@base <${MESH_BASE}> .

<alice/_knop/_references#reference001> rdf:type sflo:ReferenceLink ;
  sflo:referenceLinkFor <alice> ;
  sflo:hasReferenceRole <https://semantic-flow.github.io/sflo/ontology/referenceRole_supplemental> ;
  sflo:hasReferenceSource <alice/_knop/_references#reference001-source> .

<alice/_knop/_references#reference001-source> rdf:type sflo:ReferenceSource ;
  sflo:hasTargetArtifact <alice/bio> ;
  sflo:hasRequestedTargetState <alice/bio/_history001/_s0002> .
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
    {
      referenceTargetPath: "alice/bio",
      referenceTargetStatePath: "alice/bio/_history001/_s0002",
    },
  );
});

Deno.test("tryResolveReferenceTargetLinkState returns undefined for broad links", () => {
  assertEquals(
    tryResolveReferenceTargetLinkState(
      MESH_BASE,
      `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@base <${MESH_BASE}> .

<alice/_knop/_references#reference001> rdf:type sflo:ReferenceLink ;
  sflo:referenceLinkFor <alice> ;
  sflo:hasReferenceRole <https://semantic-flow.github.io/sflo/ontology/referenceRole_supplemental> ;
  sflo:hasReferenceSource <alice/_knop/_references#reference001-source> .

<alice/_knop/_references#reference001-source> rdf:type sflo:ReferenceSource ;
  sflo:hasTargetArtifact <alice/bio> .
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
    undefined,
  );
});

Deno.test("resolveReferenceTargetDesignatorPath ignores unrelated catalog fragments", () => {
  assertEquals(
    resolveReferenceTargetDesignatorPath(
      MESH_BASE,
      `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@base <${MESH_BASE}> .

<alice/_knop/_references#note-source> sflo:hasTargetArtifact <carol/bio> .

<alice/_knop/_references#reference001> rdf:type sflo:ReferenceLink ;
  sflo:referenceLinkFor <alice> ;
  sflo:hasReferenceRole <https://semantic-flow.github.io/sflo/ontology/referenceRole_supplemental> ;
  sflo:hasReferenceSource <alice/_knop/_references#reference001-source> .

<alice/_knop/_references#reference001-source> rdf:type sflo:ReferenceSource ;
  sflo:hasTargetArtifact <alice/bio> ;
  sflo:hasRequestedTargetState <alice/bio/_history001/_s0002> .
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
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
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
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
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

Deno.test("resolvePayloadArtifactInventoryState accepts workingLocalRelativePath literals without hasWorkingLocatedFile", () => {
  assertEquals(
    resolvePayloadArtifactInventoryState(
      MESH_BASE,
      `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@base <${MESH_BASE}> .

<alice/bio/_history001> rdf:type sflo:ArtifactHistory .
<alice/bio> sflo:workingLocalRelativePath "alice-bio.ttl" ;
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
      workingLocalRelativePath: "alice-bio.ttl",
      currentArtifactHistoryPath: "alice/bio/_history001",
      currentArtifactHistoryExists: true,
      latestHistoricalStatePath: undefined,
    },
  );
});

Deno.test("resolvePayloadArtifactInventoryState rejects inconsistent workingLocalRelativePath and hasWorkingLocatedFile", () => {
  assertThrows(
    () =>
      resolvePayloadArtifactInventoryState(
        MESH_BASE,
        `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@base <${MESH_BASE}> .

<alice/bio/_history001> rdf:type sflo:ArtifactHistory .
<alice/bio> sflo:workingLocalRelativePath "alice-bio-v2.ttl" ;
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

Deno.test("resolvePayloadArtifactInventoryState accepts extra-mesh workingLocalRelativePath literals syntactically", () => {
  assertEquals(
    resolvePayloadArtifactInventoryState(
      MESH_BASE,
      `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@base <${MESH_BASE}> .

<alice/bio/_history001> rdf:type sflo:ArtifactHistory .
<alice/bio> sflo:workingLocalRelativePath "../alice-bio.ttl" ;
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
    {
      workingLocalRelativePath: "../alice-bio.ttl",
      currentArtifactHistoryPath: "alice/bio/_history001",
      currentArtifactHistoryExists: true,
      latestHistoricalStatePath: undefined,
    },
  );
});

Deno.test("resolveReferenceCatalogInventoryState accepts workingLocalRelativePath literals without hasWorkingLocatedFile", () => {
  assertEquals(
    resolveReferenceCatalogInventoryState(
      MESH_BASE,
      `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@base <${MESH_BASE}> .

<alice/_knop/_references> rdf:type sflo:ReferenceCatalog, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:workingLocalRelativePath "alice/_knop/_references/references.ttl" .
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
      workingLocalRelativePath: "alice/_knop/_references/references.ttl",
    },
  );
});

Deno.test("resolveResourcePageDefinitionInventoryState accepts workingLocalRelativePath literals without hasWorkingLocatedFile", () => {
  assertEquals(
    resolveResourcePageDefinitionInventoryState(
      MESH_BASE,
      `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@base <${MESH_BASE}> .

<alice/_knop> rdf:type sflo:Knop ;
  sflo:hasResourcePageDefinition <alice/_knop/_page> ;
  sflo:hasKnopAssetBundle <alice/_knop/_assets> .

<alice/_knop/_page> rdf:type sflo:ResourcePageDefinition, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:workingLocalRelativePath "alice/_knop/_page/page.ttl" .

<alice/_knop/_assets> rdf:type sflo:KnopAssetBundle .
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
      workingLocalRelativePath: "alice/_knop/_page/page.ttl",
      currentArtifactHistoryPath: undefined,
      currentArtifactHistoryExists: false,
      latestHistoricalStatePath: undefined,
      assetBundlePath: "alice/_knop/_assets",
    },
  );
});
