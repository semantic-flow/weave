import { assertEquals } from "@std/assert";
import { extractCurrentReferenceCatalogLinks } from "./reference_catalog_links.ts";

const MESH_BASE = "https://example.test/mesh/";

Deno.test("extractCurrentReferenceCatalogLinks ignores non-link catalog fragments", () => {
  const links = extractCurrentReferenceCatalogLinks(
    MESH_BASE,
    `@base <${MESH_BASE}> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<alice> sflo:hasReferenceLink <alice/_knop/_references#reference001> .

<alice/_knop/_references#catalog> rdfs:label "Alice references" .

<alice/_knop/_references#reference001> a sflo:ReferenceLink ;
  sflo:referenceLinkFor <alice> ;
  sflo:hasReferenceRole sflo:referenceRole_canonical ;
  sflo:hasReferenceSource <alice/_knop/_references#reference001-source> .

<alice/_knop/_references#reference001-source> a sflo:ReferenceSource ;
  sflo:hasTargetArtifact <alice/bio> .`,
    "alice",
    "alice/_knop/_references",
  );

  assertEquals(links, [{
    fragment: "reference001",
    referenceRoleLabel: "canonical",
    referenceTargetPath: "alice/bio",
  }]);
});
