import {
  assert,
  assertEquals,
  assertFalse,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import { Parser, type Quad, type Term } from "n3";
import { RDF_NAMESPACE, SFLO_NAMESPACE } from "../rdf/namespaces.ts";
import { WeaveInputError } from "./errors.ts";
import {
  planInventoryAppend,
  prepareCurrentInventory,
  renderInventoryAppendPlan,
} from "./inventory_append_planner.ts";

const meshBase = "https://semantic-flow.github.io/mesh-alice-bio/";
const sfloHasPayloadArtifact = `${SFLO_NAMESPACE}hasPayloadArtifact`;
const sfloHasHistoricalState = `${SFLO_NAMESPACE}hasHistoricalState`;

Deno.test("planInventoryAppend treats semantic duplicate facts as a no-op", () => {
  const currentInventoryTurtle = `@base <${meshBase}> .
@prefix rdf: <${RDF_NAMESPACE}> .
@prefix sflo: <${SFLO_NAMESPACE}> .

<alice/_knop> rdf:type sflo:Knop .
`;
  const plan = planInventoryAppend({
    baseIri: meshBase,
    currentInventoryTurtle,
    requestedSettledFactsTurtle: `@base <${meshBase}> .
@prefix sflo: <${SFLO_NAMESPACE}> .

<alice/_knop> a sflo:Knop .
`,
  });

  assert(plan.kind === "unchanged");
  assertEquals(plan.outputTurtle, currentInventoryTurtle);
  assertEquals(plan.alreadyPresent.length, 1);
  assertEquals(plan.missing.length, 0);
});

Deno.test("planInventoryAppend appends only missing requested facts", () => {
  const currentInventoryTurtle = `@base <${meshBase}> .
@prefix sflo: <${SFLO_NAMESPACE}> .

<alice/_knop> a sflo:Knop .
`;
  const plan = planInventoryAppend({
    baseIri: meshBase,
    currentInventoryTurtle,
    requestedSettledFactsTurtle: `@base <${meshBase}> .
@prefix sflo: <${SFLO_NAMESPACE}> .

<alice/_knop> a sflo:Knop ;
  sflo:hasPayloadArtifact <alice/data> .
`,
  });

  assert(plan.kind === "append");
  assertEquals(plan.alreadyPresent.length, 1);
  assertEquals(plan.missing.length, 1);
  assert(plan.outputTurtle.startsWith(currentInventoryTurtle));
  assertFalse(plan.appendTurtle.includes("sflo:Knop"));
  assert(
    hasNamedNodeFact(
      plan.outputTurtle,
      `${meshBase}alice/_knop`,
      sfloHasPayloadArtifact,
      `${meshBase}alice/data`,
    ),
  );
});

Deno.test("planInventoryAppend fails closed on single-valued predicate conflicts", () => {
  const plan = planInventoryAppend({
    baseIri: meshBase,
    currentInventoryTurtle: `@base <${meshBase}> .
@prefix sflo: <${SFLO_NAMESPACE}> .

<alice/_knop> sflo:hasPayloadArtifact <alice/data-v1> .
`,
    requestedSettledFactsTurtle: `@base <${meshBase}> .
@prefix sflo: <${SFLO_NAMESPACE}> .

<alice/_knop> sflo:hasPayloadArtifact <alice/data-v2> .
`,
    singleValuedSettledPredicates: [sfloHasPayloadArtifact],
  });

  assert(plan.kind === "conflict");
  assertEquals(plan.conflicts.length, 1);
  assertEquals("outputTurtle" in plan, false);
  assertStringIncludes(plan.conflicts[0]!.message, "alice/data-v1");
  assertStringIncludes(plan.conflicts[0]!.message, "alice/data-v2");
});

Deno.test("planInventoryAppend fails closed on divergent requested single-valued facts", () => {
  const plan = planInventoryAppend({
    baseIri: meshBase,
    currentInventoryTurtle: `@base <${meshBase}> .
@prefix sflo: <${SFLO_NAMESPACE}> .

<alice/_knop> a sflo:Knop .
`,
    requestedSettledFactsTurtle: `@base <${meshBase}> .
@prefix sflo: <${SFLO_NAMESPACE}> .

<alice/_knop> sflo:hasPayloadArtifact <alice/data-v1>, <alice/data-v2> .
`,
    singleValuedSettledPredicates: [sfloHasPayloadArtifact],
  });

  assert(plan.kind === "conflict");
  assertEquals(plan.conflicts.length, 1);
  assertStringIncludes(plan.conflicts[0]!.message, "alice/data-v1");
  assertStringIncludes(plan.conflicts[0]!.message, "alice/data-v2");
});

Deno.test("planInventoryAppend allows repeated requested multi-valued predicates", () => {
  const plan = planInventoryAppend({
    baseIri: meshBase,
    currentInventoryTurtle: `@base <${meshBase}> .
@prefix sflo: <${SFLO_NAMESPACE}> .

<alice> a sflo:PayloadArtifact .
`,
    requestedSettledFactsTurtle: `@base <${meshBase}> .
@prefix sflo: <${SFLO_NAMESPACE}> .

<alice/_history001> sflo:hasHistoricalState <alice/_history001/_s0001>, <alice/_history001/_s0002> .
`,
    singleValuedSettledPredicates: [sfloHasPayloadArtifact],
  });

  assert(plan.kind === "append");
  assertEquals(plan.conflicts.length, 0);
  assertEquals(plan.missing.length, 2);
  assert(
    hasNamedNodeFact(
      plan.outputTurtle,
      `${meshBase}alice/_history001`,
      sfloHasHistoricalState,
      `${meshBase}alice/_history001/_s0001`,
    ),
  );
  assert(
    hasNamedNodeFact(
      plan.outputTurtle,
      `${meshBase}alice/_history001`,
      sfloHasHistoricalState,
      `${meshBase}alice/_history001/_s0002`,
    ),
  );
});

Deno.test("planInventoryAppend preserves unknown existing triples byte-for-byte", () => {
  const currentInventoryTurtle = `@base <${meshBase}> .
@prefix ex: <https://example.org/vocab/> .
@prefix sflo: <${SFLO_NAMESPACE}> .

# hand-curated local inventory note
<alice/_knop> ex:curatedNote "keep this byte-for-byte" .
`;
  const plan = planInventoryAppend({
    baseIri: meshBase,
    currentInventoryTurtle,
    requestedSettledFactsTurtle: `@base <${meshBase}> .
@prefix sflo: <${SFLO_NAMESPACE}> .

<alice/_knop> sflo:hasPayloadArtifact <alice/data> .
`,
  });

  assert(plan.kind === "append");
  assert(plan.outputTurtle.startsWith(currentInventoryTurtle));
  assertStringIncludes(
    plan.outputTurtle,
    '# hand-curated local inventory note\n<alice/_knop> ex:curatedNote "keep this byte-for-byte" .',
  );
  assert(
    hasNamedNodeFact(
      plan.outputTurtle,
      `${meshBase}alice/_knop`,
      sfloHasPayloadArtifact,
      `${meshBase}alice/data`,
    ),
  );
});

Deno.test("planInventoryAppend prepared input supports append and exact rendered output", () => {
  const currentInventoryTurtle = `@base <https://elsewhere.example/carried/> .

<${meshBase}alice/_knop> <${RDF_NAMESPACE}type> <${SFLO_NAMESPACE}Knop> .
`;
  const preparedCurrentInventory = prepareCurrentInventory({
    baseIri: meshBase,
    currentInventoryTurtle,
  });
  const plan = planInventoryAppend({
    preparedCurrentInventory,
    requestedSettledFactsTurtle:
      `<${meshBase}alice/_knop> <https://example.org/vocab/note> "bonjour"@fr ;
  <https://example.org/vocab/count> "7"^^<http://www.w3.org/2001/XMLSchema#integer> ;
  <${SFLO_NAMESPACE}hasPayloadArtifact> <${meshBase}alice/data> .
`,
  });

  assert(plan.kind === "append");
  const outputTurtle = renderInventoryAppendPlan({
    preparedCurrentInventory,
    plan,
  });
  assert(outputTurtle.startsWith(currentInventoryTurtle));
  assertFalse(outputTurtle.endsWith("\n\n"));
  assertQuadSetEquals(
    new Parser({ baseIRI: meshBase }).parse(outputTurtle),
    [
      ...preparedCurrentInventory.quads,
      ...new Parser({ baseIRI: meshBase }).parse(plan.appendTurtle),
    ],
  );
  assertStringIncludes(outputTurtle, '"bonjour"@fr');
  assertStringIncludes(
    outputTurtle,
    '"7"^^<http://www.w3.org/2001/XMLSchema#integer>',
  );
});

Deno.test("planInventoryAppend prepared input returns exact bytes for no-op", () => {
  const currentInventoryTurtle =
    `<${meshBase}alice/_knop> <${RDF_NAMESPACE}type> <${SFLO_NAMESPACE}Knop> .\n`;
  const preparedCurrentInventory = prepareCurrentInventory({
    baseIri: meshBase,
    currentInventoryTurtle,
  });
  const plan = planInventoryAppend({
    preparedCurrentInventory,
    requestedSettledFactsTurtle:
      `<${meshBase}alice/_knop> <${RDF_NAMESPACE}type> <${SFLO_NAMESPACE}Knop> .\n`,
  });

  assert(plan.kind === "unchanged");
  assertEquals(
    renderInventoryAppendPlan({ preparedCurrentInventory, plan }),
    currentInventoryTurtle,
  );
});

Deno.test("planInventoryAppend prepared input fails closed on conflict", () => {
  const preparedCurrentInventory = prepareCurrentInventory({
    baseIri: meshBase,
    currentInventoryTurtle:
      `<${meshBase}alice/_knop> <${sfloHasPayloadArtifact}> <${meshBase}alice/data-v1> .\n`,
  });
  const plan = planInventoryAppend({
    preparedCurrentInventory,
    requestedSettledFactsTurtle:
      `<${meshBase}alice/_knop> <${sfloHasPayloadArtifact}> <${meshBase}alice/data-v2> .\n`,
    singleValuedSettledPredicates: [sfloHasPayloadArtifact],
  });

  assert(plan.kind === "conflict");
  assertStringIncludes(plan.conflicts[0]!.message, "alice/data-v1");
  assertStringIncludes(plan.conflicts[0]!.message, "alice/data-v2");
});

Deno.test("prepareCurrentInventory rejects named-graph facts", () => {
  assertThrows(
    () =>
      prepareCurrentInventory({
        baseIri: meshBase,
        currentInventoryTurtle:
          `<https://example.org/graph> { <alice/_knop> a <${SFLO_NAMESPACE}Knop> . }`,
      }),
    WeaveInputError,
    "default graph",
  );
});

function hasNamedNodeFact(
  turtle: string,
  subjectIri: string,
  predicateIri: string,
  objectIri: string,
): boolean {
  return new Parser({ baseIRI: meshBase }).parse(turtle).some((quad: Quad) =>
    quad.subject.termType === "NamedNode" &&
    quad.subject.value === subjectIri &&
    quad.predicate.value === predicateIri &&
    quad.object.termType === "NamedNode" &&
    quad.object.value === objectIri
  );
}

function assertQuadSetEquals(
  actualQuads: readonly Quad[],
  expectedQuads: readonly Quad[],
): void {
  assertEquals(
    new Set(actualQuads.map(toQuadKey)),
    new Set(expectedQuads.map(toQuadKey)),
  );
}

function toQuadKey(quad: Quad): string {
  return [quad.graph, quad.subject, quad.predicate, quad.object]
    .map(toTermKey)
    .join("|");
}

function toTermKey(term: Term): string {
  if (term.termType === "Literal") {
    return [
      term.termType,
      term.value,
      term.language,
      term.datatype.value,
    ].join(":");
  }
  return `${term.termType}:${term.value}`;
}
