import { assertEquals, assertThrows } from "@std/assert";
import {
  FoundingReferentDataInputError,
  MAX_FOUNDING_REFERENT_DATA_BYTES,
  MAX_FOUNDING_REFERENT_DATA_TRIPLES,
  validateFoundingReferentData,
} from "./founding_referent_data.ts";

const meshBase = "https://example.test/mesh/";
const publicIri = `${meshBase}people/alice`;
const encode = (value: string) => new TextEncoder().encode(value);

Deno.test("validateFoundingReferentData accepts the flat downstream profile and preserves exact bytes", () => {
  for (
    const turtle of [
      `@prefix ex: <https://example.test/vocab/> .\n<${publicIri}> ex:iri <https://example.test/object> ; ex:language "hello"@en ; ex:typed "42"^^<http://www.w3.org/2001/XMLSchema#integer> .\n`,
      `\uFEFF<${publicIri}> <https://example.test/vocab/value> "BOM" .\r\n`,
    ]
  ) {
    const bytes = encode(turtle);
    const result = validateFoundingReferentData({
      meshBase,
      designatorPath: "people/alice",
      bytes,
    });
    assertEquals(result.publicReferentIri, publicIri);
    assertEquals(result.bytes, bytes);
    assertEquals(result.tripleCount > 0, true);
  }
});

Deno.test("validateFoundingReferentData rejects profile violations with content-free diagnostics", () => {
  const sentinel = "FOUNDING_SECRET_SENTINEL";
  const cases: Array<{
    code: FoundingReferentDataInputError["code"];
    turtle: string;
  }> = [
    { code: "empty-graph", turtle: `# ${sentinel}\n` },
    {
      code: "forbidden-base",
      turtle:
        `@base <https://example.test/> . <${publicIri}> <https://example.test/p> "${sentinel}" .`,
    },
    {
      code: "malformed-turtle",
      turtle: `<${publicIri}> <https://example.test/p> "${sentinel}`,
    },
    {
      code: "wrong-subject",
      turtle:
        `<https://example.test/other> <https://example.test/p> "${sentinel}" .`,
    },
    {
      code: "wrong-subject",
      turtle:
        `<${publicIri}#fragment> <https://example.test/p> "${sentinel}" .`,
    },
    {
      code: "wrong-subject",
      turtle:
        `<https://EXAMPLE.test/mesh/people/alice> <https://example.test/p> "${sentinel}" .`,
    },
    {
      code: "relative-iri",
      turtle: `<${publicIri}> <relative> "${sentinel}" .`,
    },
    {
      code: "forbidden-base",
      turtle:
        `BASE <https://example.test/> <${publicIri}> <https://example.test/p> "${sentinel}" .`,
    },
    {
      code: "malformed-turtle",
      turtle:
        `GRAPH <https://example.test/graph> { <${publicIri}> <https://example.test/p> "${sentinel}" . }`,
    },
    {
      code: "unsupported-rdf-term",
      turtle:
        `<< <${publicIri}> <https://example.test/p> <https://example.test/o> >> <https://example.test/q> "${sentinel}" .`,
    },
    {
      code: "malformed-turtle",
      turtle: `<${publicIri}> "generalized" "${sentinel}" .`,
    },
    {
      code: "unsupported-rdf-term",
      turtle: `[] <https://example.test/p> "${sentinel}" .`,
    },
    {
      code: "unsupported-rdf-term",
      turtle:
        `<${publicIri}> <https://example.test/p> [ <https://example.test/q> "${sentinel}" ] .`,
    },
    {
      code: "forbidden-core-vocabulary",
      turtle:
        `<${publicIri}> <https://semantic-flow.github.io/sflo/ontology/hasWorkingLocatedFile> "${sentinel}" .`,
    },
    {
      code: "forbidden-core-vocabulary",
      turtle:
        `<${publicIri}> <https://semantic-flow.github.io/sflo/config/hasConfig> "${sentinel}" .`,
    },
    {
      code: "forbidden-core-vocabulary",
      turtle:
        `<${publicIri}> a <https://semantic-flow.github.io/sflo/ontology/PayloadArtifact> .`,
    },
    {
      code: "forbidden-core-vocabulary",
      turtle:
        `<${publicIri}> a <https://semantic-flow.github.io/sflo/config/Config> .`,
    },
  ];

  for (const testCase of cases) {
    const error = assertThrows(
      () =>
        validateFoundingReferentData({
          meshBase,
          designatorPath: "people/alice",
          bytes: encode(testCase.turtle),
        }),
      FoundingReferentDataInputError,
    );
    assertEquals(error.code, testCase.code);
    assertEquals(error.message.includes(sentinel), false);
  }
});

Deno.test("validateFoundingReferentData rejects invalid UTF-8, root input, and bounds", () => {
  assertEquals(
    assertThrows(() =>
      validateFoundingReferentData({
        meshBase,
        designatorPath: "people/alice",
        bytes: new Uint8Array([0xff]),
      }), FoundingReferentDataInputError).code,
    "invalid-utf8",
  );
  assertEquals(
    assertThrows(() =>
      validateFoundingReferentData({
        meshBase,
        designatorPath: "",
        bytes: encode(`<${meshBase}> <https://example.test/p> "v" .`),
      }), FoundingReferentDataInputError).code,
    "root-refused",
  );
  assertEquals(
    assertThrows(() =>
      validateFoundingReferentData({
        meshBase,
        designatorPath: "people/alice",
        bytes: new Uint8Array(MAX_FOUNDING_REFERENT_DATA_BYTES + 1),
      }), FoundingReferentDataInputError).code,
    "source-too-large",
  );

  const triples = Array.from(
    { length: MAX_FOUNDING_REFERENT_DATA_TRIPLES + 1 },
    (_, index) => `<${publicIri}> <https://example.test/p${index}> "v" .`,
  ).join("\n");
  assertEquals(
    assertThrows(() =>
      validateFoundingReferentData({
        meshBase,
        designatorPath: "people/alice",
        bytes: encode(triples),
      }), FoundingReferentDataInputError).code,
    "too-many-triples",
  );
});
