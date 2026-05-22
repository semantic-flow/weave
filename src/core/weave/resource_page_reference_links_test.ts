import { assertEquals, assertThrows } from "@std/assert";
import { SFLO_NAMESPACE } from "../rdf/namespaces.ts";
import {
  extractResourceReferenceLinks,
  SFLO_REFERENCE_ROLE_CANONICAL_IRI,
} from "./resource_page_reference_links.ts";

const MESH_BASE = "https://example.test/mesh/";

Deno.test("extractResourceReferenceLinks resolves current mesh and URI literal targets", () => {
  const links = extractResourceReferenceLinks(
    MESH_BASE,
    "alice",
    `@base <${MESH_BASE}> .
@prefix sflo: <${SFLO_NAMESPACE}> .

<alice> sflo:hasReferenceLink <alice/_knop/_references#reference002>, <alice/_knop/_references#reference001> .

<alice/_knop/_references#reference002> a sflo:ReferenceLink ;
  sflo:referenceLinkFor <alice> ;
  sflo:hasReferenceRole sflo:referenceRole_supporting ;
  sflo:referenceTarget <carol> .

<alice/_knop/_references#reference001> a sflo:ReferenceLink ;
  sflo:referenceLinkFor <alice> ;
  sflo:hasReferenceRole sflo:referenceRole_canonical ;
  sflo:referenceTarget <bob> ;
  sflo:referenceTargetState <bob/_history001/_s0001> ;
  sflo:referenceUriLiteral "https://archive.example/alice" .

<alice/_knop/_references#unlinked> a sflo:ReferenceLink ;
  sflo:referenceLinkFor <alice> ;
  sflo:hasReferenceRole sflo:referenceRole_canonical ;
  sflo:referenceTarget <ignored> .
`,
  );

  assertEquals(links, [
    {
      roleIris: [SFLO_REFERENCE_ROLE_CANONICAL_IRI],
      model: {
        roleLabel: "canonical",
        targets: [
          {
            href: "https://archive.example/alice",
            label: "https://archive.example/alice",
          },
          {
            href: "https://example.test/mesh/bob",
            label: "https://example.test/mesh/bob",
          },
          {
            href: "https://example.test/mesh/bob/_history001/_s0001",
            label: "https://example.test/mesh/bob/_history001/_s0001",
          },
        ],
      },
      referenceTargetPaths: ["bob"],
      referenceTargetStatePaths: ["bob/_history001/_s0001"],
    },
    {
      roleIris: [`${SFLO_NAMESPACE}referenceRole_supporting`],
      model: {
        roleLabel: "supporting",
        targets: [
          {
            href: "https://example.test/mesh/carol",
            label: "https://example.test/mesh/carol",
          },
        ],
      },
      referenceTargetPaths: ["carol"],
      referenceTargetStatePaths: [],
    },
  ]);
});

Deno.test("extractResourceReferenceLinks uses the supplied parse error factory", () => {
  class ReferenceParseError extends Error {}

  assertThrows(
    () =>
      extractResourceReferenceLinks(
        MESH_BASE,
        "alice",
        "not valid turtle",
        (message) => new ReferenceParseError(message),
      ),
    ReferenceParseError,
    "Could not parse the current ReferenceCatalog while collecting references for alice.",
  );
});
