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

Deno.test("renderKnopInventoryWithPreservedSupportArtifacts preserves repeated source-registry subject blocks", () => {
  const sourceRegistryPath = `${knopPath}/_sources`;
  const currentKnopInventoryTurtle = inventoryWithSupportFacts({
    sourceRegistry: true,
  }).replace(
    `<${sourceRegistryPath}> a sflo:KnopSourceRegistry, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${sourceRegistryPath}/sources.ttl> .`,
    `<${sourceRegistryPath}> a sflo:KnopSourceRegistry .

<${sourceRegistryPath}> a sflo:DigitalArtifact .

<${sourceRegistryPath}> a sflo:RdfDocument .

<${sourceRegistryPath}> sflo:hasWorkingLocatedFile <${sourceRegistryPath}/sources.ttl> .`,
  );
  const output = renderKnopInventoryWithPreservedSupportArtifacts({
    meshBase,
    currentKnopInventoryTurtle,
    renderedKnopInventoryTurtle: inventoryWithSupportFacts({}),
    knopPath,
  });

  assert(
    hasNamedNodeFact(
      output,
      `${meshBase}${sourceRegistryPath}`,
      `${SFLO_NAMESPACE}hasWorkingLocatedFile`,
      `${meshBase}${sourceRegistryPath}/sources.ttl`,
    ),
  );
  assert(
    hasNamedNodeFact(
      output,
      `${meshBase}${sourceRegistryPath}`,
      `${RDF_NAMESPACE}type`,
      `${SFLO_NAMESPACE}DigitalArtifact`,
    ),
  );
  assert(
    hasNamedNodeFact(
      output,
      `${meshBase}${sourceRegistryPath}`,
      `${RDF_NAMESPACE}type`,
      `${SFLO_NAMESPACE}RdfDocument`,
    ),
  );
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

  const quads = new Parser({ baseIRI: meshBase }).parse(output);
  assertFalse(hasPredicate(quads, `${SFLO_NAMESPACE}currentArtifactHistory`));
  assertFalse(hasPredicate(quads, `${SFLO_NAMESPACE}nextHistoryOrdinal`));
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

function hasPredicate(quads: readonly Quad[], predicateIri: string): boolean {
  return quads.some((quad) => quad.predicate.value === predicateIri);
}

function parseQuads(turtle: string): Quad[] {
  return new Parser({ baseIRI: meshBase }).parse(turtle);
}

// A mesh whose designator path sits at the SFLO vocabulary namespace — the
// sflo mesh itself, published at https://semantic-flow.github.io/sflo/ with
// its ontology payload at `ontology/` — used to emit `sflo:_knop/_sources`
// for its own resources. `/` is not legal in a Turtle prefixed name's local
// part, so the carried facts failed to re-parse and every weave of that mesh
// refused with "Could not parse carried Knop support facts Turtle."
Deno.test("renderKnopInventoryWithPreservedSupportArtifacts preserves support facts when the mesh sits under the SFLO vocabulary namespace", () => {
  const sfloMeshBase = "https://semantic-flow.github.io/sflo/";
  const sfloKnopPath = "ontology/_knop";
  const currentKnopInventoryTurtle = `@base <${sfloMeshBase}> .
@prefix sflo: <${SFLO_NAMESPACE}> .

<ontology/_knop> a sflo:Knop ;
  sflo:hasKnopMetadata <ontology/_knop/_meta> ;
  sflo:hasKnopInventory <ontology/_knop/_inventory> ;
  sflo:hasKnopSourceRegistry <ontology/_knop/_sources> ;
  sflo:hasWorkingKnopInventoryFile <ontology/_knop/_inventory/inventory.ttl> ;
  sflo:hasPayloadArtifact <ontology> .

<ontology/_knop/_sources> a sflo:KnopSourceRegistry, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <ontology/_knop/_sources/sources.ttl> .

<ontology/_knop/_sources/sources.ttl> a sflo:LocatedFile, sflo:RdfDocument .
`;

  const rendered = renderKnopInventoryWithPreservedSupportArtifacts({
    meshBase: sfloMeshBase,
    currentKnopInventoryTurtle,
    renderedKnopInventoryTurtle: currentKnopInventoryTurtle,
    knopPath: sfloKnopPath,
  });

  // The result must re-parse, and must never contain a prefixed name whose
  // local part carries a path separator.
  const quads = new Parser({ baseIRI: sfloMeshBase }).parse(rendered);
  assert(quads.length > 0);
  assertFalse(/\bsflo:[^\s;,.]*\//.test(rendered));
  assertStringIncludes(rendered, "ontology/_knop/_sources");
});

Deno.test("renderKnopInventoryWithPreservedSupportArtifacts carries complete founding history and mutable progression", () => {
  const current = `${
    inventoryWithSupportFacts({
      extraPrefixes: "@prefix ex: <https://example.test/vocab/> .\n",
    })
  }
<${knopPath}> sflo:hasFoundingReferentData <${knopPath}/_founding> .

<${knopPath}/_founding> a sflo:FoundingReferentData, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${knopPath}/_founding/data.ttl> ;
  sflo:hasArtifactHistory <${knopPath}/_founding/_history001> ;
  sflo:defaultArtifactHistory <${knopPath}/_founding/_history001> ;
  sflo:currentArtifactHistory <${knopPath}/_founding/_history001> .

<${knopPath}/_founding/_history001> a sflo:ArtifactHistory ;
  sflo:hasHistoricalState <${knopPath}/_founding/_history001/_s0001> ;
  sflo:latestHistoricalState <${knopPath}/_founding/_history001/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger .

<${knopPath}/_founding/_history001/_s0001> a sflo:HistoricalState ;
  sflo:hasManifestation <${knopPath}/_founding/_history001/_s0001/ttl> .

<${knopPath}/_founding/_history001/_s0001/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  ex:opaque "keep byte-for-byte" ;
  sflo:hasContentDigest "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" ;
  sflo:locatedFileForManifestation <${knopPath}/_founding/_history001/_s0001/ttl/data.ttl> .

<${knopPath}/_founding/data.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_founding/_history001/_s0001/ttl/data.ttl> a sflo:LocatedFile, sflo:RdfDocument ;
  sflo:hasContentDigest "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" .
`;
  const output = renderKnopInventoryWithPreservedSupportArtifacts({
    meshBase,
    currentKnopInventoryTurtle: current,
    renderedKnopInventoryTurtle: inventoryWithSupportFacts({}),
    knopPath,
  });

  for (
    const expected of [
      `sflo:hasFoundingReferentData <${knopPath}/_founding>`,
      `sflo:latestHistoricalState <${knopPath}/_founding/_history001/_s0001>`,
      'sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger',
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      'ex:opaque "keep byte-for-byte"',
    ]
  ) {
    assertStringIncludes(output, expected);
  }
  assert(parseQuads(output).length > 0);
});
