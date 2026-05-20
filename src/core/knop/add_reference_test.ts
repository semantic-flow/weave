import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import { readMeshAliceBioBranchFile } from "../../../tests/support/mesh_alice_bio_fixture.ts";
import {
  KnopAddReferenceInputError,
  planKnopAddReference,
} from "./add_reference.ts";

const wovenKnopInventory =
  `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<alice/_knop> a sflo:Knop ;
  sflo:hasKnopMetadata <alice/_knop/_meta> ;
  sflo:hasKnopInventory <alice/_knop/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <alice/_knop/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <alice/_knop/index.html> .

<alice/_knop/_meta> a sflo:KnopMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <alice/_knop/_meta/_history001> ;
  sflo:currentArtifactHistory <alice/_knop/_meta/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <alice/_knop/_meta/meta.ttl> ;
  sflo:hasResourcePage <alice/_knop/_meta/index.html> .

<alice/_knop/_meta/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <alice/_knop/_meta/_history001/_s0001> ;
  sflo:latestHistoricalState <alice/_knop/_meta/_history001/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <alice/_knop/_meta/_history001/index.html> .

<alice/_knop/_meta/_history001/_s0001> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <alice/_knop/_meta/_history001/_s0001/ttl> ;
  sflo:locatedFileForState <alice/_knop/_meta/_history001/_s0001/ttl/meta.ttl> ;
  sflo:hasResourcePage <alice/_knop/_meta/_history001/_s0001/index.html> .

<alice/_knop/_meta/_history001/_s0001/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <alice/_knop/_meta/_history001/_s0001/ttl/meta.ttl> ;
  sflo:hasResourcePage <alice/_knop/_meta/_history001/_s0001/ttl/index.html> .

<alice/_knop/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <alice/_knop/_inventory/_history001> ;
  sflo:currentArtifactHistory <alice/_knop/_inventory/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <alice/_knop/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <alice/_knop/_inventory/index.html> .

<alice/_knop/_inventory/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <alice/_knop/_inventory/_history001/_s0001> ;
  sflo:latestHistoricalState <alice/_knop/_inventory/_history001/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <alice/_knop/_inventory/_history001/index.html> .

<alice/_knop/_inventory/_history001/_s0001> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <alice/_knop/_inventory/_history001/_s0001/ttl> ;
  sflo:locatedFileForState <alice/_knop/_inventory/_history001/_s0001/ttl/inventory.ttl> ;
  sflo:hasResourcePage <alice/_knop/_inventory/_history001/_s0001/index.html> .

<alice/_knop/_inventory/_history001/_s0001/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <alice/_knop/_inventory/_history001/_s0001/ttl/inventory.ttl> ;
  sflo:hasResourcePage <alice/_knop/_inventory/_history001/_s0001/ttl/index.html> .

<alice/_knop/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<alice/_knop/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<alice/_knop/_meta/_history001/_s0001/ttl/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<alice/_knop/_inventory/_history001/_s0001/ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<alice/_knop/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<alice/_knop/_meta/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<alice/_knop/_meta/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<alice/_knop/_meta/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<alice/_knop/_meta/_history001/_s0001/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<alice/_knop/_inventory/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<alice/_knop/_inventory/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<alice/_knop/_inventory/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<alice/_knop/_inventory/_history001/_s0001/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`;

const unwovenKnopInventory =
  `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<bob/_knop> a sflo:Knop ;
  sflo:hasKnopMetadata <bob/_knop/_meta> ;
  sflo:hasKnopInventory <bob/_knop/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <bob/_knop/_inventory/inventory.ttl> .

<bob/_knop/_meta> a sflo:KnopMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <bob/_knop/_meta/meta.ttl> .

<bob/_knop/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <bob/_knop/_inventory/inventory.ttl> .

<bob/_knop/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<bob/_knop/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .
`;

const extractedKnopInventory =
  `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<bob/_knop> a sflo:Knop ;
  sflo:hasKnopMetadata <bob/_knop/_meta> ;
  sflo:hasKnopInventory <bob/_knop/_inventory> ;
  sflo:hasKnopSourceRegistry <bob/_knop/_sources> ;
  sflo:hasExtractionSource <bob/_knop/_sources#extraction-source> ;
  sflo:hasWorkingKnopInventoryFile <bob/_knop/_inventory/inventory.ttl> .

<bob/_knop/_meta> a sflo:KnopMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <bob/_knop/_meta/meta.ttl> .

<bob/_knop/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <bob/_knop/_inventory/inventory.ttl> .

<bob/_knop/_sources> a sflo:KnopSourceRegistry, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <bob/_knop/_sources/sources.ttl> .

<bob/_knop/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<bob/_knop/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<bob/_knop/_sources/sources.ttl> a sflo:LocatedFile, sflo:RdfDocument .
`;

const currentOnlyWovenExtractedKnopInventory =
  `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<bob/_knop> a sflo:Knop ;
  sflo:hasKnopMetadata <bob/_knop/_meta> ;
  sflo:hasKnopInventory <bob/_knop/_inventory> ;
  sflo:hasKnopSourceRegistry <bob/_knop/_sources> ;
  sflo:hasExtractionSource <bob/_knop/_sources#extraction-source> ;
  sflo:hasWorkingKnopInventoryFile <bob/_knop/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <bob/_knop/index.html> .

<bob/_knop/_meta> a sflo:KnopMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <bob/_knop/_meta/meta.ttl> ;
  sflo:hasResourcePage <bob/_knop/_meta/index.html> .

<bob/_knop/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <bob/_knop/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <bob/_knop/_inventory/index.html> .

<bob/_knop/_sources> a sflo:KnopSourceRegistry, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <bob/_knop/_sources/sources.ttl> .

<bob/_knop/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<bob/_knop/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<bob/_knop/_sources/sources.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<bob/_knop/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<bob/_knop/_meta/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<bob/_knop/_inventory/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`;

Deno.test("planKnopAddReference renders first reference catalog support artifacts", async () => {
  const plan = planKnopAddReference({
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    designatorPath: "alice",
    referenceTargetDesignatorPath: "alice/bio",
    referenceRole: "canonical",
    currentKnopInventoryTurtle: wovenKnopInventory,
  });

  assertEquals(
    plan.referenceCatalogIri,
    "https://semantic-flow.github.io/mesh-alice-bio/alice/_knop/_references",
  );
  assertEquals(
    plan.referenceLinkIri,
    "https://semantic-flow.github.io/mesh-alice-bio/alice/_knop/_references#reference001",
  );
  assertEquals(
    plan.referenceRoleIri,
    "https://semantic-flow.github.io/sflo/ontology/referenceRole_canonical",
  );
  assertEquals(
    plan.createdFiles.map((file) => file.path),
    ["alice/_knop/_references/references.ttl"],
  );
  assertEquals(
    plan.updatedFiles.map((file) => file.path),
    ["alice/_knop/_inventory/inventory.ttl"],
  );
  assertEquals(
    plan.createdFiles[0]?.contents ?? "",
    await readMeshAliceBioBranchFile(
      "08-alice-bio-referenced",
      "alice/_knop/_references/references.ttl",
    ),
  );
  assertEquals(
    plan.updatedFiles[0]?.contents ?? "",
    await readMeshAliceBioBranchFile(
      "08-alice-bio-referenced",
      "alice/_knop/_inventory/inventory.ttl",
    ),
  );
});

Deno.test("planKnopAddReference can pin a reference target state", () => {
  const plan = planKnopAddReference({
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    designatorPath: "alice",
    referenceTargetDesignatorPath: "alice/bio",
    referenceTargetStatePath: "alice/bio/_history001/_s0002",
    referenceRole: "canonical",
    currentKnopInventoryTurtle: wovenKnopInventory,
  });

  assertEquals(
    plan.referenceTargetStateIri,
    "https://semantic-flow.github.io/mesh-alice-bio/alice/bio/_history001/_s0002",
  );
  assertStringIncludes(
    plan.createdFiles[0]?.contents ?? "",
    "sflo:referenceTarget <alice/bio> ;\n  sflo:referenceTargetState <alice/bio/_history001/_s0002> .",
  );
});

Deno.test("planKnopAddReference supports unwoven knop inventory input", () => {
  const plan = planKnopAddReference({
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    designatorPath: "bob",
    referenceTargetDesignatorPath: "alice/bio",
    referenceRole: "supplemental",
    currentKnopInventoryTurtle: unwovenKnopInventory,
  });

  assertEquals(
    plan.updatedFiles[0]?.contents ?? "",
    `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<bob/_knop> a sflo:Knop ;
  sflo:hasKnopMetadata <bob/_knop/_meta> ;
  sflo:hasKnopInventory <bob/_knop/_inventory> ;
  sflo:hasReferenceCatalog <bob/_knop/_references> ;
  sflo:hasWorkingKnopInventoryFile <bob/_knop/_inventory/inventory.ttl> .

<bob/_knop/_meta> a sflo:KnopMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <bob/_knop/_meta/meta.ttl> .

<bob/_knop/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <bob/_knop/_inventory/inventory.ttl> .

<bob/_knop/_references> a sflo:ReferenceCatalog, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <bob/_knop/_references/references.ttl> .

<bob/_knop/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<bob/_knop/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<bob/_knop/_references/references.ttl> a sflo:LocatedFile, sflo:RdfDocument .
`,
  );
  assertStringIncludes(
    plan.createdFiles[0]?.contents ?? "",
    "sflo:hasReferenceRole <https://semantic-flow.github.io/sflo/ontology/referenceRole_supplemental> ;",
  );
});

Deno.test("planKnopAddReference preserves extracted source registry facts", () => {
  const plan = planKnopAddReference({
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    designatorPath: "bob",
    referenceTargetDesignatorPath: "alice/bio",
    referenceRole: "canonical",
    currentKnopInventoryTurtle: extractedKnopInventory,
  });
  const updatedInventory = plan.updatedFiles[0]?.contents ?? "";

  assertStringIncludes(
    updatedInventory,
    "sflo:hasKnopSourceRegistry <bob/_knop/_sources> ;",
  );
  assertStringIncludes(
    updatedInventory,
    "sflo:hasExtractionSource <bob/_knop/_sources#extraction-source> ;",
  );
  assertStringIncludes(
    updatedInventory,
    "<bob/_knop/_sources> a sflo:KnopSourceRegistry, sflo:DigitalArtifact, sflo:RdfDocument ;",
  );
  assertStringIncludes(
    updatedInventory,
    "<bob/_knop/_sources/sources.ttl> a sflo:LocatedFile, sflo:RdfDocument .",
  );
});

Deno.test("planKnopAddReference supports current-only woven extracted KnopInventory input", () => {
  const plan = planKnopAddReference({
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    designatorPath: "bob",
    referenceTargetDesignatorPath: "alice/bio",
    referenceRole: "canonical",
    currentKnopInventoryTurtle: currentOnlyWovenExtractedKnopInventory,
  });
  const updatedInventory = plan.updatedFiles[0]?.contents ?? "";

  assertStringIncludes(
    updatedInventory,
    "sflo:hasReferenceCatalog <bob/_knop/_references> ;",
  );
  assertStringIncludes(
    updatedInventory,
    "sflo:hasResourcePage <bob/_knop/index.html> .",
  );
  assertStringIncludes(
    updatedInventory,
    "<bob/_knop/_references> a sflo:ReferenceCatalog, sflo:DigitalArtifact, sflo:RdfDocument ;",
  );
  assertStringIncludes(
    updatedInventory,
    "sflo:hasKnopSourceRegistry <bob/_knop/_sources> ;",
  );
  assertEquals(updatedInventory.includes("sflo:hasArtifactHistory"), false);
});

Deno.test("planKnopAddReference normalizes referenceRole tokens case-insensitively", () => {
  const plan = planKnopAddReference({
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    designatorPath: "alice",
    referenceTargetDesignatorPath: "alice/bio",
    referenceRole: "Supplemental",
    currentKnopInventoryTurtle: wovenKnopInventory,
  });

  assertEquals(
    plan.referenceRoleIri,
    "https://semantic-flow.github.io/sflo/ontology/referenceRole_supplemental",
  );
  assertStringIncludes(
    plan.createdFiles[0]?.contents ?? "",
    "sflo:hasReferenceRole <https://semantic-flow.github.io/sflo/ontology/referenceRole_supplemental> ;",
  );
});

Deno.test("planKnopAddReference accepts semantically equivalent woven KnopInventory turtle", async () => {
  const plan = planKnopAddReference({
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    designatorPath: "alice",
    referenceTargetDesignatorPath: "alice/bio",
    referenceRole: "canonical",
    currentKnopInventoryTurtle: withRdfPrefix(wovenKnopInventory)
      .replace(
        "<alice/_knop> a sflo:Knop ;",
        "<alice/_knop>\n  rdf:type sflo:Knop ;",
      )
      .replace(
        "<alice/_knop/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;",
        "<alice/_knop/_inventory> rdf:type sflo:RdfDocument, sflo:DigitalArtifact, sflo:KnopInventory ;",
      ),
  });

  assertEquals(
    plan.updatedFiles[0]?.contents ?? "",
    await readMeshAliceBioBranchFile(
      "08-alice-bio-referenced",
      "alice/_knop/_inventory/inventory.ttl",
    ),
  );
});

Deno.test("planKnopAddReference rejects unsupported reference roles", () => {
  assertThrows(
    () =>
      planKnopAddReference({
        meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
        designatorPath: "alice",
        referenceTargetDesignatorPath: "alice/bio",
        referenceRole: "primary",
        currentKnopInventoryTurtle: wovenKnopInventory,
      }),
    KnopAddReferenceInputError,
    "Unsupported referenceRole",
  );
});

Deno.test("planKnopAddReference rejects prototype property reference roles", () => {
  assertThrows(
    () =>
      planKnopAddReference({
        meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
        designatorPath: "alice",
        referenceTargetDesignatorPath: "alice/bio",
        referenceRole: "constructor",
        currentKnopInventoryTurtle: wovenKnopInventory,
      }),
    KnopAddReferenceInputError,
    "Unsupported referenceRole",
  );
});

Deno.test("planKnopAddReference rejects unsafe designator segments before building IRIs", () => {
  assertThrows(
    () =>
      planKnopAddReference({
        meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
        designatorPath: "alice:bio",
        referenceTargetDesignatorPath: "alice/bio",
        referenceRole: "canonical",
        currentKnopInventoryTurtle: wovenKnopInventory,
      }),
    KnopAddReferenceInputError,
    'normalizeSafeDesignatorPath rejected segment "alice:bio"',
  );
});

Deno.test("planKnopAddReference rejects an already-registered reference catalog", () => {
  assertThrows(
    () =>
      planKnopAddReference({
        meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
        designatorPath: "alice",
        referenceTargetDesignatorPath: "alice/bio",
        referenceRole: "canonical",
        currentKnopInventoryTurtle: wovenKnopInventory.replace(
          "  sflo:hasResourcePage <alice/_knop/index.html> .",
          "  sflo:hasReferenceCatalog <alice/_knop/_references> ;\n  sflo:hasResourcePage <alice/_knop/index.html> .\n\n<alice/_knop/_references> a sflo:ReferenceCatalog, sflo:DigitalArtifact, sflo:RdfDocument ;\n  sflo:hasWorkingLocatedFile <alice/_knop/_references/references.ttl> .",
        ),
      }),
    KnopAddReferenceInputError,
    "already registers reference catalog",
  );
});

function withRdfPrefix(turtle: string): string {
  return turtle.includes("@prefix rdf:") ? turtle : turtle.replace(
    "@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .",
    `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .`,
  );
}
