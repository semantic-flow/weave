import { assertEquals } from "@std/assert";
import { Parser, type Quad } from "n3";
import { KnopCreateInventoryIndex } from "./create_inventory_index.ts";

const meshBase = "https://example.org/stagecraft-index-test/";
const rdfType = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const sflo = "https://semantic-flow.github.io/sflo/ontology/";

Deno.test("KnopCreateInventoryIndex performs one quad pass for all Knop membership lookups", () => {
  const count = 552;
  const membershipTurtle = Array.from(
    { length: count },
    (_, index) => {
      const path = `iri-${String(index + 1).padStart(4, "0")}/_knop`;
      return `<_mesh> <${sflo}hasKnop> <${path}> .\n<${path}> <${rdfType}> <${sflo}Knop> .`;
    },
  ).join("\n");
  const quads = new Parser({ baseIRI: meshBase }).parse(membershipTurtle);
  let yieldedQuadCount = 0;
  const countedQuads = function* (): Generator<Quad> {
    for (const quad of quads) {
      yieldedQuadCount += 1;
      yield quad;
    }
  };
  const index = new KnopCreateInventoryIndex(countedQuads());

  assertEquals(yieldedQuadCount, quads.length);
  for (let indexNumber = 1; indexNumber <= count; indexNumber += 1) {
    const knopIri = new URL(
      `iri-${String(indexNumber).padStart(4, "0")}/_knop`,
      meshBase,
    ).href;
    assertEquals(
      index.hasNamedNodeFact(
        new URL("_mesh", meshBase).href,
        `${sflo}hasKnop`,
        knopIri,
      ),
      true,
    );
  }
  assertEquals(yieldedQuadCount, quads.length);
});

Deno.test("KnopCreateInventoryIndex dedupes exact named-node and literal objects", () => {
  const predicate = "https://example.org/value";
  const subjectIri = new URL("resource", meshBase).href;
  const index = new KnopCreateInventoryIndex(
    new Parser({ baseIRI: meshBase }).parse(
      `<resource> <${predicate}> <target>, <target>, "chat"@en, "chat"@en,
  "chat"@fr, "7"^^<http://www.w3.org/2001/XMLSchema#integer>,
  "7"^^<http://www.w3.org/2001/XMLSchema#string> .`,
    ),
  );

  assertEquals(
    index.listNamedNodeObjectIris(subjectIri, predicate),
    [new URL("target", meshBase).href],
  );
  assertEquals(index.listLiteralObjects(subjectIri, predicate), [
    {
      value: "chat",
      language: "en",
      datatypeIri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString",
    },
    {
      value: "chat",
      language: "fr",
      datatypeIri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString",
    },
    {
      value: "7",
      language: "",
      datatypeIri: "http://www.w3.org/2001/XMLSchema#integer",
    },
    {
      value: "7",
      language: "",
      datatypeIri: "http://www.w3.org/2001/XMLSchema#string",
    },
  ]);
});
