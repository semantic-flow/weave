import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import {
  KnopAddReferenceInputError,
  planKnopAddReference,
} from "./add_reference.ts";

const wovenKnopInventory =
  `@base <https://semantic-flow.github.io/mesh-alice-bio/> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
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
  sflo:hasManifestation <alice/_knop/_meta/_history001/_s0001/meta-ttl> ;
  sflo:locatedFileForState <alice/_knop/_meta/_history001/_s0001/meta-ttl/meta.ttl> ;
  sflo:hasResourcePage <alice/_knop/_meta/_history001/_s0001/index.html> .

<alice/_knop/_meta/_history001/_s0001/meta-ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:hasLocatedFile <alice/_knop/_meta/_history001/_s0001/meta-ttl/meta.ttl> ;
  sflo:hasResourcePage <alice/_knop/_meta/_history001/_s0001/meta-ttl/index.html> .

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
  sflo:hasManifestation <alice/_knop/_inventory/_history001/_s0001/inventory-ttl> ;
  sflo:locatedFileForState <alice/_knop/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <alice/_knop/_inventory/_history001/_s0001/index.html> .

<alice/_knop/_inventory/_history001/_s0001/inventory-ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:hasLocatedFile <alice/_knop/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl> ;
  sflo:hasResourcePage <alice/_knop/_inventory/_history001/_s0001/inventory-ttl/index.html> .

<alice/_knop/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<alice/_knop/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<alice/_knop/_meta/_history001/_s0001/meta-ttl/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<alice/_knop/_inventory/_history001/_s0001/inventory-ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<alice/_knop/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<alice/_knop/_meta/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<alice/_knop/_meta/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<alice/_knop/_meta/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<alice/_knop/_meta/_history001/_s0001/meta-ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<alice/_knop/_inventory/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<alice/_knop/_inventory/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<alice/_knop/_inventory/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<alice/_knop/_inventory/_history001/_s0001/inventory-ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`;

Deno.test("planKnopAddReference renders first reference catalog support artifacts", () => {
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
    "https://semantic-flow.github.io/semantic-flow-ontology/ReferenceRole/Canonical",
  );
  assertEquals(
    plan.createdFiles.map((file) => file.path),
    ["alice/_knop/_references/references.ttl"],
  );
  assertEquals(
    plan.updatedFiles.map((file) => file.path),
    ["alice/_knop/_inventory/inventory.ttl"],
  );
  assertStringIncludes(
    plan.createdFiles[0]?.contents ?? "",
    "<alice> sflo:hasReferenceLink <alice/_knop/_references#reference001> .",
  );
  assertStringIncludes(
    plan.createdFiles[0]?.contents ?? "",
    "sflo:hasReferenceRole <https://semantic-flow.github.io/semantic-flow-ontology/ReferenceRole/Canonical> ;",
  );
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "  sflo:hasReferenceCatalog <alice/_knop/_references> ;",
  );
  assertStringIncludes(
    plan.updatedFiles[0]?.contents ?? "",
    "<alice/_knop/_references> a sflo:ReferenceCatalog, sflo:DigitalArtifact, sflo:RdfDocument ;",
  );
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
    "https://semantic-flow.github.io/semantic-flow-ontology/ReferenceRole/Supplemental",
  );
  assertStringIncludes(
    plan.createdFiles[0]?.contents ?? "",
    "sflo:hasReferenceRole <https://semantic-flow.github.io/semantic-flow-ontology/ReferenceRole/Supplemental> ;",
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
    'normalizeDesignatorPath rejected segment "alice:bio"',
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
