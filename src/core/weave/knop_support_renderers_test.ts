import {
  assert,
  assertEquals,
  assertFalse,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import { Parser, type Quad } from "n3";
import {
  RDF_NAMESPACE,
  SFLO_NAMESPACE,
  XSD_NAMESPACE,
} from "../rdf/namespaces.ts";
import { WeaveInputError } from "./errors.ts";
import { renderKnopInventoryWithPreservedSupportArtifacts } from "./knop_support_renderers.ts";

const meshBase = "https://semantic-flow.github.io/mesh-alice-bio/";
const knopPath = "alice/_knop";

Deno.test("renderKnopInventoryWithPreservedSupportArtifacts no-ops semantically equivalent carried support facts", () => {
  const currentKnopInventoryTurtle = inventoryWithSupportFacts({
    sourceRegistry: true,
    referenceCatalog: true,
    sourceRegistryUsesRdfType: true,
  });
  const renderedKnopInventoryTurtle = inventoryWithSupportFacts({
    sourceRegistry: true,
    referenceCatalog: true,
  });

  assertEquals(
    renderKnopInventoryWithPreservedSupportArtifacts({
      meshBase,
      currentKnopInventoryTurtle,
      renderedKnopInventoryTurtle,
      knopPath,
    }),
    renderedKnopInventoryTurtle,
  );
});

Deno.test("renderKnopInventoryWithPreservedSupportArtifacts appends missing carried support facts", () => {
  const output = renderKnopInventoryWithPreservedSupportArtifacts({
    meshBase,
    currentKnopInventoryTurtle: inventoryWithSupportFacts({
      sourceRegistry: true,
      referenceCatalog: true,
    }),
    renderedKnopInventoryTurtle: inventoryWithSupportFacts({}),
    knopPath,
  });

  assert(
    hasNamedNodeFact(
      output,
      `${meshBase}${knopPath}`,
      `${SFLO_NAMESPACE}hasKnopSourceRegistry`,
      `${meshBase}${knopPath}/_sources`,
    ),
  );
  assert(
    hasNamedNodeFact(
      output,
      `${meshBase}${knopPath}`,
      `${SFLO_NAMESPACE}hasReferenceCatalog`,
      `${meshBase}${knopPath}/_references`,
    ),
  );
  assert(
    hasNamedNodeFact(
      output,
      `${meshBase}${knopPath}/_sources`,
      `${SFLO_NAMESPACE}hasWorkingLocatedFile`,
      `${meshBase}${knopPath}/_sources/sources.ttl`,
    ),
  );
});

Deno.test("renderKnopInventoryWithPreservedSupportArtifacts preserves unknown carried support facts byte-for-byte", () => {
  const currentKnopInventoryTurtle = inventoryWithSupportFacts({
    sourceRegistry: true,
    sourceRegistryExtra: '  ex:opaqueSourceFact "keep exactly" ;',
    extraPrefixes: "@prefix ex: <https://example.org/vocab/> .\n",
  });
  const output = renderKnopInventoryWithPreservedSupportArtifacts({
    meshBase,
    currentKnopInventoryTurtle,
    renderedKnopInventoryTurtle: inventoryWithSupportFacts({}),
    knopPath,
  });

  assertStringIncludes(
    output,
    '  ex:opaqueSourceFact "keep exactly" ;\n  sflo:hasWorkingLocatedFile <alice/_knop/_sources/sources.ttl> .',
  );
  assertStringIncludes(output, "@prefix ex: <https://example.org/vocab/> .");
  assert(parseQuads(output).length > 0);
});

Deno.test("renderKnopInventoryWithPreservedSupportArtifacts carries reference catalog when source registry is already rendered", () => {
  const output = renderKnopInventoryWithPreservedSupportArtifacts({
    meshBase,
    currentKnopInventoryTurtle: inventoryWithSupportFacts({
      sourceRegistry: true,
      referenceCatalog: true,
    }),
    renderedKnopInventoryTurtle: inventoryWithSupportFacts({
      sourceRegistry: true,
    }),
    knopPath,
  });

  assert(
    hasNamedNodeFact(
      output,
      `${meshBase}${knopPath}`,
      `${SFLO_NAMESPACE}hasKnopSourceRegistry`,
      `${meshBase}${knopPath}/_sources`,
    ),
  );
  assert(
    hasNamedNodeFact(
      output,
      `${meshBase}${knopPath}`,
      `${SFLO_NAMESPACE}hasReferenceCatalog`,
      `${meshBase}${knopPath}/_references`,
    ),
  );
});

Deno.test("renderKnopInventoryWithPreservedSupportArtifacts carries source registry when reference catalog is already rendered", () => {
  const output = renderKnopInventoryWithPreservedSupportArtifacts({
    meshBase,
    currentKnopInventoryTurtle: inventoryWithSupportFacts({
      sourceRegistry: true,
      referenceCatalog: true,
    }),
    renderedKnopInventoryTurtle: inventoryWithSupportFacts({
      referenceCatalog: true,
    }),
    knopPath,
  });

  assert(
    hasNamedNodeFact(
      output,
      `${meshBase}${knopPath}`,
      `${SFLO_NAMESPACE}hasKnopSourceRegistry`,
      `${meshBase}${knopPath}/_sources`,
    ),
  );
  assert(
    hasNamedNodeFact(
      output,
      `${meshBase}${knopPath}`,
      `${SFLO_NAMESPACE}hasReferenceCatalog`,
      `${meshBase}${knopPath}/_references`,
    ),
  );
});

Deno.test("renderKnopInventoryWithPreservedSupportArtifacts fails closed on conflicting carried support facts", () => {
  const error = assertThrows(
    () =>
      renderKnopInventoryWithPreservedSupportArtifacts({
        meshBase,
        currentKnopInventoryTurtle: inventoryWithSupportFacts({
          sourceRegistry: true,
        }),
        renderedKnopInventoryTurtle: inventoryWithSupportFacts({
          sourceRegistry: true,
          sourceRegistryPath: "alice/_knop/_other-sources",
        }),
        knopPath,
      }),
    WeaveInputError,
    "conflicts",
  );

  assertStringIncludes(error.message, "alice/_knop/_sources");
  assertStringIncludes(error.message, "alice/_knop/_other-sources");
});

Deno.test("renderKnopInventoryWithPreservedSupportArtifacts does not carry mutable progression facts from support blocks", () => {
  const output = renderKnopInventoryWithPreservedSupportArtifacts({
    meshBase,
    currentKnopInventoryTurtle: inventoryWithSupportFacts({
      referenceCatalog: true,
      referenceCatalogProgression: true,
    }),
    renderedKnopInventoryTurtle: inventoryWithSupportFacts({}),
    knopPath,
  });

  assertFalse(output.includes("sflo:currentArtifactHistory"));
  assertFalse(output.includes("sflo:nextHistoryOrdinal"));
});

function inventoryWithSupportFacts(options: {
  sourceRegistry?: boolean;
  sourceRegistryPath?: string;
  sourceRegistryUsesRdfType?: boolean;
  sourceRegistryExtra?: string;
  referenceCatalog?: boolean;
  referenceCatalogProgression?: boolean;
  extraPrefixes?: string;
}): string {
  const sourceRegistryPath = options.sourceRegistryPath ??
    `${knopPath}/_sources`;
  const referenceCatalogPath = `${knopPath}/_references`;
  const sourceRegistryLine = options.sourceRegistry
    ? `  sflo:hasKnopSourceRegistry <${sourceRegistryPath}> ;
  sflo:hasExtractionSource <${sourceRegistryPath}#extraction-source> ;
`
    : "";
  const referenceCatalogLine = options.referenceCatalog
    ? `  sflo:hasReferenceCatalog <${referenceCatalogPath}> ;
`
    : "";
  const sourceRegistryTypePredicate = options.sourceRegistryUsesRdfType
    ? "rdf:type"
    : "a";
  const sourceRegistryBlock = options.sourceRegistry
    ? `
<${sourceRegistryPath}> ${sourceRegistryTypePredicate} sflo:KnopSourceRegistry, sflo:DigitalArtifact, sflo:RdfDocument ;
${options.sourceRegistryExtra ?? ""}${
      options.sourceRegistryExtra ? "\n" : ""
    }  sflo:hasWorkingLocatedFile <${sourceRegistryPath}/sources.ttl> .

<${sourceRegistryPath}/sources.ttl> a sflo:LocatedFile, sflo:RdfDocument .
`
    : "";
  const referenceCatalogProgression = options.referenceCatalogProgression
    ? ` ;
  sflo:currentArtifactHistory <${referenceCatalogPath}/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger`
    : "";
  const referenceCatalogBlock = options.referenceCatalog
    ? `
<${referenceCatalogPath}> a sflo:ReferenceCatalog, sflo:DigitalArtifact, sflo:RdfDocument${referenceCatalogProgression} ;
  sflo:hasWorkingLocatedFile <${referenceCatalogPath}/references.ttl> .

<${referenceCatalogPath}/references.ttl> a sflo:LocatedFile, sflo:RdfDocument .
`
    : "";

  return `@base <${meshBase}> .
@prefix rdf: <${RDF_NAMESPACE}> .
@prefix sflo: <${SFLO_NAMESPACE}> .
@prefix xsd: <${XSD_NAMESPACE}> .
${options.extraPrefixes ?? ""}
<${knopPath}> a sflo:Knop ;
${sourceRegistryLine}${referenceCatalogLine}  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> .

<${knopPath}/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${knopPath}/_inventory/inventory.ttl> .

<${knopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .
${sourceRegistryBlock}${referenceCatalogBlock}`;
}

function hasNamedNodeFact(
  turtle: string,
  subjectIri: string,
  predicateIri: string,
  objectIri: string,
): boolean {
  return parseQuads(turtle).some((quad) =>
    quad.subject.termType === "NamedNode" &&
    quad.subject.value === subjectIri &&
    quad.predicate.value === predicateIri &&
    quad.object.termType === "NamedNode" &&
    quad.object.value === objectIri
  );
}

function parseQuads(turtle: string): Quad[] {
  return new Parser({ baseIRI: meshBase }).parse(turtle);
}
