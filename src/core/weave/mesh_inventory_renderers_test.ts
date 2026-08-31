import { assert, assertEquals, assertFalse, assertThrows } from "@std/assert";
import { Parser, type Quad, type Term } from "n3";
import { WeaveInputError } from "./errors.ts";
import {
  renderBatchedFirstExtractedKnopWovenMeshInventoryTurtle,
  renderGenericFirstExtractedKnopWovenMeshInventoryTurtle,
} from "./mesh_inventory_renderers.ts";
import type { MeshInventoryProgression } from "./progression_models.ts";

const MESH_BASE = "https://example.test/mesh/";
const SFLO = "https://semantic-flow.github.io/sflo/ontology/";

const currentOnlyPendingInventory = `@base <${MESH_BASE}> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix ex: <https://example.test/vocab/> .
@prefix sflo: <${SFLO}> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<_mesh> a sflo:SemanticMesh ;
  sflo:hasKnop <term-b/_knop>, <term-a/_knop> ;
  sflo:hasResourcePage <_mesh/index.html> .

<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <_mesh/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/index.html> .

<_mesh/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<term-b> a ex:ExtractedTerm ;
  ex:opaqueBlank [ ex:value "keep-b" ] .
# preserve term-b operator note exactly

<term-b> ex:repeatedSubjectFact "keep repeated b" .

<term-b/_knop> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <term-b/_knop/_inventory/inventory.ttl> .

<term-b/_knop/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<term-a> a ex:ExtractedTerm ;
  ex:opaqueBlank [ ex:value "keep-a" ] .
# preserve term-a operator note exactly

<term-a> ex:repeatedSubjectFact "keep repeated a" .

<term-a/_knop> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <term-a/_knop/_inventory/inventory.ttl> .

<term-a/_knop/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .
`;

const meshInventoryProgression: MeshInventoryProgression = {
  historyPath: "_mesh/_inventory/_history001",
  nextHistoryOrdinal: 2,
  latestStatePath: "_mesh/_inventory/_history001/_s0001",
  latestStateOrdinal: 1,
  latestManifestationPath: "_mesh/_inventory/_history001/_s0001/ttl",
  nextStatePath: "_mesh/_inventory/_history001/_s0002",
  nextStateOrdinal: 2,
};

Deno.test("batched extracted MeshInventory appends current-only facts without rewriting carried target bytes", () => {
  const rendered = renderBatchedFirstExtractedKnopWovenMeshInventoryTurtle(
    currentOnlyPendingInventory,
    MESH_BASE,
    ["term-b", "term-a", "term-b"],
    undefined,
  );

  assert(rendered.startsWith(currentOnlyPendingInventory));
  assertTurtleGraphsEqual(
    rendered,
    `${currentOnlyPendingInventory}\n${
      renderTargetFacts(["term-a", "term-b"])
    }`,
  );
  const suffix = rendered.slice(currentOnlyPendingInventory.length);
  assert(suffix.indexOf("<term-a>") < suffix.indexOf("<term-b>"));
});

Deno.test("batched extracted MeshInventory returns exact bytes for a semantic no-op", () => {
  const alreadyWovenInventory = `${currentOnlyPendingInventory}\n${
    renderTargetFacts(["term-a", "term-b"])
  }`;

  assertEquals(
    renderBatchedFirstExtractedKnopWovenMeshInventoryTurtle(
      alreadyWovenInventory,
      MESH_BASE,
      ["term-b", "term-a"],
      undefined,
    ),
    alreadyWovenInventory,
  );
});

Deno.test("batched extracted MeshInventory rejects a conflicting Knop inventory locator", () => {
  const conflictingInventory = currentOnlyPendingInventory.replace(
    "<term-a/_knop/_inventory/inventory.ttl> .",
    "<term-a/_knop/_inventory/other.ttl> .",
  );

  assertThrows(
    () =>
      renderBatchedFirstExtractedKnopWovenMeshInventoryTurtle(
        conflictingInventory,
        MESH_BASE,
        ["term-a", "term-b"],
        undefined,
      ),
    WeaveInputError,
    "Requested settled inventory fact <https://example.test/mesh/term-a/_knop> <https://semantic-flow.github.io/sflo/ontology/hasWorkingKnopInventoryFile> <https://example.test/mesh/term-a/_knop/_inventory/inventory.ttl> . conflicts with existing fact <https://example.test/mesh/term-a/_knop> <https://semantic-flow.github.io/sflo/ontology/hasWorkingKnopInventoryFile> <https://example.test/mesh/term-a/_knop/_inventory/other.ttl> .",
  );
});

Deno.test("batched extracted MeshInventory appends one versioned progression graph", () => {
  const currentInventory = renderVersionedCurrentInventory();
  const rendered = renderBatchedFirstExtractedKnopWovenMeshInventoryTurtle(
    currentInventory,
    MESH_BASE,
    ["term-b", "term-a"],
    meshInventoryProgression,
  );

  assert(rendered.startsWith(currentInventory));
  assertTurtleGraphsEqual(
    rendered,
    `${currentInventory}\n${
      renderTargetFacts(["term-a", "term-b"])
    }\n${renderNextProgressionFacts()}`,
  );
  assertEquals(
    countNamedNodeFact(
      rendered,
      "_mesh/_inventory/_history001",
      `${SFLO}hasHistoricalState`,
      "_mesh/_inventory/_history001/_s0002",
    ),
    1,
  );
  assertFalse(rendered.includes("sflo:currentArtifactHistory"));
  assertFalse(rendered.includes("sflo:latestHistoricalState"));
  assertFalse(rendered.includes("sflo:nextStateOrdinal"));
});

Deno.test("versioned sequential extracted MeshInventory preserves carried target bytes", () => {
  const currentInventory = renderVersionedCurrentInventory();
  const rendered = renderGenericFirstExtractedKnopWovenMeshInventoryTurtle(
    currentInventory,
    MESH_BASE,
    "term-a",
    meshInventoryProgression,
  );

  assert(rendered.startsWith(currentInventory));
  assertTurtleGraphsEqual(
    rendered,
    `${currentInventory}\n${
      renderTargetFacts(["term-a"])
    }\n${renderNextProgressionFacts()}`,
  );
});

Deno.test("versioned sequential extracted MeshInventory returns exact bytes for a semantic no-op", () => {
  const currentInventory = renderVersionedCurrentInventory();
  const alreadyWovenInventory = `${currentInventory}\n${
    renderTargetFacts(["term-a"])
  }\n${renderNextProgressionFacts()}`;

  assertEquals(
    renderGenericFirstExtractedKnopWovenMeshInventoryTurtle(
      alreadyWovenInventory,
      MESH_BASE,
      "term-a",
      meshInventoryProgression,
    ),
    alreadyWovenInventory,
  );
});

Deno.test("versioned sequential extracted MeshInventory rejects a conflicting Knop inventory locator", () => {
  const conflictingInventory = renderVersionedCurrentInventory().replace(
    "<term-a/_knop/_inventory/inventory.ttl> .",
    "<term-a/_knop/_inventory/other.ttl> .",
  );

  assertThrows(
    () =>
      renderGenericFirstExtractedKnopWovenMeshInventoryTurtle(
        conflictingInventory,
        MESH_BASE,
        "term-a",
        meshInventoryProgression,
      ),
    WeaveInputError,
    "Requested settled inventory fact <https://example.test/mesh/term-a/_knop> <https://semantic-flow.github.io/sflo/ontology/hasWorkingKnopInventoryFile> <https://example.test/mesh/term-a/_knop/_inventory/inventory.ttl> . conflicts with existing fact <https://example.test/mesh/term-a/_knop> <https://semantic-flow.github.io/sflo/ontology/hasWorkingKnopInventoryFile> <https://example.test/mesh/term-a/_knop/_inventory/other.ttl> .",
  );
});

function renderVersionedCurrentInventory(): string {
  return currentOnlyPendingInventory.replace(
    "  sflo:hasWorkingLocatedFile <_mesh/_inventory/inventory.ttl> ;",
    `  sflo:hasArtifactHistory <_mesh/_inventory/_history001> ;
  sflo:hasWorkingLocatedFile <_mesh/_inventory/inventory.ttl> ;`,
  ).concat(`
<_mesh/_inventory/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <_mesh/_inventory/_history001/_s0001> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/index.html> .

<_mesh/_inventory/_history001/_s0001> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <_mesh/_inventory/_history001/_s0001/ttl> ;
  sflo:locatedFileForState <_mesh/_inventory/_history001/_s0001/ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0001/index.html> .

<_mesh/_inventory/_history001/_s0001/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <_mesh/_inventory/_history001/_s0001/ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0001/ttl/index.html> .

<_mesh/_inventory/_history001/_s0001/ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0001/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`);
}

function renderTargetFacts(designatorPaths: readonly string[]): string {
  const blocks = designatorPaths.flatMap((designatorPath) => {
    const knopPath = `${designatorPath}/_knop`;
    return [
      `<${designatorPath}> sflo:hasResourcePage <${designatorPath}/index.html> .`,
      `<${knopPath}> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/index.html> .`,
      `<${knopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .`,
      `<${designatorPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .`,
      `<${knopPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .`,
    ];
  });
  return `@base <${MESH_BASE}> .
@prefix sflo: <${SFLO}> .

${blocks.join("\n\n")}
`;
}

function renderNextProgressionFacts(): string {
  return `@base <${MESH_BASE}> .
@prefix sflo: <${SFLO}> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <_mesh/_inventory/_history001> ;
  sflo:hasWorkingLocatedFile <_mesh/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/index.html> .

<_mesh/_inventory/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <_mesh/_inventory/_history001/_s0001>, <_mesh/_inventory/_history001/_s0002> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/index.html> .

<_mesh/_inventory/_history001/_s0002> a sflo:HistoricalState ;
  sflo:stateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:previousHistoricalState <_mesh/_inventory/_history001/_s0001> ;
  sflo:hasManifestation <_mesh/_inventory/_history001/_s0002/ttl> ;
  sflo:locatedFileForState <_mesh/_inventory/_history001/_s0002/ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0002/index.html> .

<_mesh/_inventory/_history001/_s0002/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <_mesh/_inventory/_history001/_s0002/ttl/inventory.ttl> ;
  sflo:hasResourcePage <_mesh/_inventory/_history001/_s0002/ttl/index.html> .

<_mesh/_inventory/_history001/_s0002/ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/_history001/_s0002/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<_mesh/_inventory/_history001/_s0002/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`;
}

function assertTurtleGraphsEqual(actual: string, expected: string): void {
  assertEquals(toQuadKeys(actual), toQuadKeys(expected));
}

function toQuadKeys(turtle: string): string[] {
  // Prefix equality covers carried blank-node subgraphs; compare stable named
  // facts here because parser-local blank-node labels are not graph identity.
  const keys = new Set<string>(
    new Parser({ baseIRI: MESH_BASE }).parse(turtle)
      .filter((quad: Quad) =>
        quad.subject.termType !== "BlankNode" &&
        quad.object.termType !== "BlankNode"
      )
      .map((quad: Quad) =>
        [quad.subject, quad.predicate, quad.object, quad.graph]
          .map(toTermKey)
          .join("|")
      ),
  );
  return [...keys].sort();
}

function toTermKey(term: Term): string {
  if (term.termType === "Literal") {
    return [term.termType, term.value, term.language, term.datatype.value].join(
      ":",
    );
  }
  return `${term.termType}:${term.value}`;
}

function countNamedNodeFact(
  turtle: string,
  subjectPath: string,
  predicateIri: string,
  objectPath: string,
): number {
  const subjectIri = new URL(subjectPath, MESH_BASE).href;
  const objectIri = new URL(objectPath, MESH_BASE).href;
  return new Parser({ baseIRI: MESH_BASE }).parse(turtle).filter((quad: Quad) =>
    quad.subject.termType === "NamedNode" &&
    quad.subject.value === subjectIri &&
    quad.predicate.value === predicateIri &&
    quad.object.termType === "NamedNode" &&
    quad.object.value === objectIri
  ).length;
}
