import { Parser, type Quad, type Term } from "n3";
import {
  SFCFG_NAMESPACE,
  SFLO_NAMESPACE,
  XSD_NAMESPACE,
} from "../rdf/namespaces.ts";
import { escapeTurtleString } from "../rdf/turtle.ts";
import { WeaveInputError } from "./errors.ts";
import { planInventoryAppend } from "./inventory_append_planner.ts";
import {
  hasNamedNodeFact,
  parseWeaveShapeQuads,
  requireOptionalNamedNodeObject,
  resolveOptionalLiteralObject,
  resolveOptionalNamedNodePath,
  toAbsoluteIri,
} from "./rdf_helpers.ts";
import {
  collectSubjectSubtreeBlocks,
  findSubjectBlockIndex,
  getSubjectPathFromBlock,
  splitTurtleBlocks,
} from "./turtle_blocks.ts";

const RDF_TYPE_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const SFLO_HAS_EXTRACTION_SOURCE_IRI = `${SFLO_NAMESPACE}hasExtractionSource`;
const SFLO_HAS_KNOP_SOURCE_REGISTRY_IRI =
  `${SFLO_NAMESPACE}hasKnopSourceRegistry`;
const SFLO_HAS_REFERENCE_CATALOG_IRI = `${SFLO_NAMESPACE}hasReferenceCatalog`;
const SFLO_HAS_WORKING_LOCATED_FILE_IRI =
  `${SFLO_NAMESPACE}hasWorkingLocatedFile`;
const SFLO_KNOP_SOURCE_REGISTRY_IRI = `${SFLO_NAMESPACE}KnopSourceRegistry`;
const SFLO_REFERENCE_CATALOG_IRI = `${SFLO_NAMESPACE}ReferenceCatalog`;
const SFLO_WORKING_FILE_PATH_IRI = `${SFLO_NAMESPACE}workingLocalRelativePath`;
const SFLO_CURRENT_ARTIFACT_HISTORY_IRI =
  `${SFLO_NAMESPACE}currentArtifactHistory`;
const SFLO_LATEST_HISTORICAL_STATE_IRI =
  `${SFLO_NAMESPACE}latestHistoricalState`;
const SFLO_NEXT_HISTORY_ORDINAL_IRI = `${SFLO_NAMESPACE}nextHistoryOrdinal`;
const SFLO_NEXT_STATE_ORDINAL_IRI = `${SFLO_NAMESPACE}nextStateOrdinal`;
const SFCFG_HAS_NEXT_STATE_SEGMENT_HINT_IRI =
  `${SFCFG_NAMESPACE}hasNextStateSegmentHint`;
const XSD_STRING_IRI = `${XSD_NAMESPACE}string`;
const MUTABLE_PROGRESSION_PREDICATES = new Set([
  SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
  SFLO_LATEST_HISTORICAL_STATE_IRI,
  SFLO_NEXT_HISTORY_ORDINAL_IRI,
  SFLO_NEXT_STATE_ORDINAL_IRI,
  SFCFG_HAS_NEXT_STATE_SEGMENT_HINT_IRI,
]);
const SUPPORT_SINGLE_VALUED_PREDICATES = [
  SFLO_HAS_EXTRACTION_SOURCE_IRI,
  SFLO_HAS_KNOP_SOURCE_REGISTRY_IRI,
  SFLO_HAS_REFERENCE_CATALOG_IRI,
  SFLO_HAS_WORKING_LOCATED_FILE_IRI,
  SFLO_WORKING_FILE_PATH_IRI,
];

interface CurrentKnopSourceRegistry {
  sourceRegistryPath: string;
  sourcesFilePath: string;
  extractionSourcePath?: string;
}

interface CurrentKnopReferenceCatalog {
  referenceCatalogPath: string;
  referencesFilePath: string;
  referencesFilePredicateIri: string;
}

interface RequestedSupportFact {
  key: string;
  turtle: string;
}

interface CarriedSupportBlock {
  subjectPath: string;
  block: string;
  quads: readonly Quad[];
  requestedFacts: readonly RequestedSupportFact[];
  hasMutableProgressionFacts: boolean;
}

export function renderKnopInventoryWithPreservedSupportArtifacts(options: {
  meshBase: string;
  currentKnopInventoryTurtle: string;
  renderedKnopInventoryTurtle: string;
  knopPath: string;
}): string {
  const sourceRegistry = resolveCurrentKnopSourceRegistry(options);
  const referenceCatalog = resolveCurrentKnopReferenceCatalog(options);
  if (sourceRegistry === undefined && referenceCatalog === undefined) {
    return options.renderedKnopInventoryTurtle;
  }

  const carriedSupport = collectCarriedSupportFactsAndBlocks(
    options,
    sourceRegistry,
    referenceCatalog,
  );
  const requestedFactsBody = carriedSupport.facts
    .map((fact) => fact.turtle)
    .join("\n");
  if (requestedFactsBody.length === 0) {
    return options.renderedKnopInventoryTurtle;
  }
  const requestedFactsTurtle =
    `${supportFactParseDirectives()}\n\n${requestedFactsBody}`;

  const plan = planInventoryAppend({
    baseIri: options.meshBase,
    currentInventoryTurtle: options.renderedKnopInventoryTurtle,
    requestedSettledFactsTurtle: requestedFactsTurtle,
    singleValuedSettledPredicates: SUPPORT_SINGLE_VALUED_PREDICATES,
    currentInventoryLabel: "rendered KnopInventory",
    requestedFactsLabel: "carried Knop support facts",
  });

  if (plan.kind === "conflict") {
    throw new WeaveInputError(
      `Could not preserve carried Knop support facts for ${options.knopPath}: ${
        plan.conflicts.map((conflict) => conflict.message).join(" ")
      }`,
    );
  }

  if (plan.kind === "unchanged") {
    return options.renderedKnopInventoryTurtle;
  }

  return appendMissingCarriedSupportFacts(
    options,
    plan.missing.map((fact) => fact.key),
    carriedSupport,
  );
}

function resolveCurrentKnopSourceRegistry(options: {
  meshBase: string;
  currentKnopInventoryTurtle: string;
  knopPath: string;
}): CurrentKnopSourceRegistry | undefined {
  const errorMessage =
    `Could not resolve Knop source registry from the current KnopInventory for ${options.knopPath}.`;
  const quads = parseWeaveShapeQuads(
    options.meshBase,
    options.currentKnopInventoryTurtle,
    errorMessage,
  );
  const sourceRegistryPath = resolveOptionalNamedNodePath(
    quads,
    options.meshBase,
    options.knopPath,
    SFLO_HAS_KNOP_SOURCE_REGISTRY_IRI,
    errorMessage,
  );
  if (sourceRegistryPath === undefined) {
    return undefined;
  }
  const extractionSourceIri = requireOptionalNamedNodeObject(
    quads,
    toAbsoluteIri(options.meshBase, options.knopPath),
    SFLO_HAS_EXTRACTION_SOURCE_IRI,
    errorMessage,
  );
  const extractionSourcePath = extractionSourceIri === undefined
    ? undefined
    : extractionSourceIri.startsWith(options.meshBase)
    ? extractionSourceIri.slice(options.meshBase.length)
    : extractionSourceIri;

  if (
    !hasNamedNodeFact(
      quads,
      options.meshBase,
      sourceRegistryPath,
      RDF_TYPE_IRI,
      SFLO_KNOP_SOURCE_REGISTRY_IRI,
    )
  ) {
    throw new WeaveInputError(errorMessage);
  }

  const sourcesFilePath = resolveOptionalNamedNodePath(
    quads,
    options.meshBase,
    sourceRegistryPath,
    SFLO_HAS_WORKING_LOCATED_FILE_IRI,
    errorMessage,
  );
  if (sourcesFilePath === undefined) {
    throw new WeaveInputError(errorMessage);
  }

  return { sourceRegistryPath, sourcesFilePath, extractionSourcePath };
}

function resolveCurrentKnopReferenceCatalog(options: {
  meshBase: string;
  currentKnopInventoryTurtle: string;
  knopPath: string;
}): CurrentKnopReferenceCatalog | undefined {
  const errorMessage =
    `Could not resolve Knop reference catalog from the current KnopInventory for ${options.knopPath}.`;
  const quads = parseWeaveShapeQuads(
    options.meshBase,
    options.currentKnopInventoryTurtle,
    errorMessage,
  );
  const referenceCatalogPath = resolveOptionalNamedNodePath(
    quads,
    options.meshBase,
    options.knopPath,
    SFLO_HAS_REFERENCE_CATALOG_IRI,
    errorMessage,
  );
  if (referenceCatalogPath === undefined) {
    return undefined;
  }

  if (
    !hasNamedNodeFact(
      quads,
      options.meshBase,
      referenceCatalogPath,
      RDF_TYPE_IRI,
      SFLO_REFERENCE_CATALOG_IRI,
    )
  ) {
    throw new WeaveInputError(errorMessage);
  }

  const referencesLocatedFilePath = resolveOptionalNamedNodePath(
    quads,
    options.meshBase,
    referenceCatalogPath,
    SFLO_HAS_WORKING_LOCATED_FILE_IRI,
    errorMessage,
  );
  const referencesFilePath = referencesLocatedFilePath ??
    resolveOptionalLiteralObject(
      quads,
      options.meshBase,
      referenceCatalogPath,
      SFLO_WORKING_FILE_PATH_IRI,
      errorMessage,
    );
  if (referencesFilePath === undefined) {
    throw new WeaveInputError(errorMessage);
  }

  return {
    referenceCatalogPath,
    referencesFilePath,
    referencesFilePredicateIri: referencesLocatedFilePath === undefined
      ? SFLO_WORKING_FILE_PATH_IRI
      : SFLO_HAS_WORKING_LOCATED_FILE_IRI,
  };
}

function collectCarriedSupportFactsAndBlocks(
  options: {
    meshBase: string;
    currentKnopInventoryTurtle: string;
    knopPath: string;
  },
  sourceRegistry: CurrentKnopSourceRegistry | undefined,
  referenceCatalog: CurrentKnopReferenceCatalog | undefined,
): {
  facts: readonly RequestedSupportFact[];
  blocks: readonly CarriedSupportBlock[];
} {
  const currentDirectives = extractTurtleDirectives(
    options.currentKnopInventoryTurtle,
  );
  const currentBlocks = splitTurtleBlocks(options.currentKnopInventoryTurtle);
  const requestedFacts: RequestedSupportFact[] = [];
  const carriedBlocks: CarriedSupportBlock[] = [];
  const carriedBlockSubjectPaths = new Set<string>();

  for (
    const fact of renderKnopSupportLinkFacts(
      options.knopPath,
      sourceRegistry,
      referenceCatalog,
    )
  ) {
    requestedFacts.push(...parseRequestedSupportFacts(options.meshBase, fact));
  }

  const addBlock = (subjectPath: string | undefined) => {
    if (
      subjectPath === undefined || carriedBlockSubjectPaths.has(subjectPath)
    ) {
      return;
    }
    const blockIndex = findSubjectBlockIndex(currentBlocks, subjectPath);
    if (blockIndex === -1) {
      return;
    }

    const block = currentBlocks[blockIndex]!;
    const quads = parseBlockQuads(
      options.meshBase,
      currentDirectives,
      block,
      `Could not parse carried Knop support block <${subjectPath}>.`,
    );
    const hasMutableProgressionFacts = quads.some((quad) =>
      MUTABLE_PROGRESSION_PREDICATES.has(quad.predicate.value)
    );
    const requestedBlockFacts = quads
      .filter((quad) =>
        !MUTABLE_PROGRESSION_PREDICATES.has(quad.predicate.value)
      )
      .map((quad: Quad) => toRequestedSupportFact(quad, options.meshBase));
    carriedBlockSubjectPaths.add(subjectPath);
    carriedBlocks.push({
      subjectPath,
      block,
      quads,
      requestedFacts: requestedBlockFacts,
      hasMutableProgressionFacts,
    });
    requestedFacts.push(...requestedBlockFacts);
  };

  if (sourceRegistry !== undefined) {
    addBlock(sourceRegistry.sourceRegistryPath);
    addBlock(sourceRegistry.sourcesFilePath);
    addBlock(sourceRegistry.extractionSourcePath);
    if (!carriedBlockSubjectPaths.has(sourceRegistry.sourceRegistryPath)) {
      requestedFacts.push(
        ...parseRequestedSupportFacts(
          options.meshBase,
          renderSourceRegistryFallbackFacts(sourceRegistry),
        ),
      );
    }
    if (!carriedBlockSubjectPaths.has(sourceRegistry.sourcesFilePath)) {
      requestedFacts.push(
        ...parseRequestedSupportFacts(
          options.meshBase,
          renderLocatedFileFallbackFact(sourceRegistry.sourcesFilePath),
        ),
      );
    }
  }

  if (referenceCatalog !== undefined) {
    for (
      const block of collectSubjectSubtreeBlocks(
        currentBlocks,
        referenceCatalog.referenceCatalogPath,
      )
    ) {
      addBlock(getSubjectPathFromBlock(block));
    }
    if (!carriedBlockSubjectPaths.has(referenceCatalog.referenceCatalogPath)) {
      requestedFacts.push(
        ...parseRequestedSupportFacts(
          options.meshBase,
          renderReferenceCatalogFallbackFacts(referenceCatalog),
        ),
      );
    }
    if (!carriedBlockSubjectPaths.has(referenceCatalog.referencesFilePath)) {
      requestedFacts.push(
        ...parseRequestedSupportFacts(
          options.meshBase,
          renderLocatedFileFallbackFact(referenceCatalog.referencesFilePath),
        ),
      );
    }
  }

  return {
    facts: deduplicateRequestedFacts(requestedFacts),
    blocks: carriedBlocks,
  };
}

function appendMissingCarriedSupportFacts(
  options: {
    meshBase: string;
    currentKnopInventoryTurtle: string;
    renderedKnopInventoryTurtle: string;
  },
  missingFactKeys: readonly string[],
  carriedSupport: {
    facts: readonly RequestedSupportFact[];
    blocks: readonly CarriedSupportBlock[];
  },
): string {
  const missingKeys = new Set(missingFactKeys);
  const coveredByBlockKeys = new Set<string>();
  const renderedSubjectIris = new Set(
    parseWeaveShapeQuads(
      options.meshBase,
      options.renderedKnopInventoryTurtle,
      "Could not parse rendered KnopInventory while preserving carried support facts.",
    ).flatMap((quad) =>
      quad.subject.termType === "NamedNode" ? [quad.subject.value] : []
    ),
  );

  const appendBlocks: string[] = [];
  for (const block of carriedSupport.blocks) {
    const blockHasMissingFacts = block.requestedFacts.some((fact) =>
      missingKeys.has(fact.key)
    );
    const blockSubjectIri = toAbsoluteIri(options.meshBase, block.subjectPath);
    if (
      blockHasMissingFacts &&
      !block.hasMutableProgressionFacts &&
      !renderedSubjectIris.has(blockSubjectIri)
    ) {
      appendBlocks.push(block.block);
      for (const fact of block.requestedFacts) {
        coveredByBlockKeys.add(fact.key);
      }
    }
  }

  const appendFacts = carriedSupport.facts
    .filter((fact) =>
      missingKeys.has(fact.key) && !coveredByBlockKeys.has(fact.key)
    )
    .map((fact) => fact.turtle);
  const appendChunks = [
    ...(appendBlocks.length === 0 ? [] : [
      ...missingPrefixDeclarations(
        options.currentKnopInventoryTurtle,
        options.renderedKnopInventoryTurtle,
      ),
    ]),
    ...appendFacts,
    ...appendBlocks,
  ];

  if (appendChunks.length === 0) {
    return options.renderedKnopInventoryTurtle;
  }

  return appendTurtleChunks(options.renderedKnopInventoryTurtle, appendChunks);
}

function renderKnopSupportLinkFacts(
  knopPath: string,
  sourceRegistry: CurrentKnopSourceRegistry | undefined,
  referenceCatalog: CurrentKnopReferenceCatalog | undefined,
): string[] {
  return [
    ...(sourceRegistry === undefined ? [] : [
      renderNamedNodeFact(
        knopPath,
        SFLO_HAS_KNOP_SOURCE_REGISTRY_IRI,
        sourceRegistry.sourceRegistryPath,
      ),
      ...(sourceRegistry.extractionSourcePath === undefined ? [] : [
        renderNamedNodeFact(
          knopPath,
          SFLO_HAS_EXTRACTION_SOURCE_IRI,
          sourceRegistry.extractionSourcePath,
        ),
      ]),
    ]),
    ...(referenceCatalog === undefined ? [] : [
      renderNamedNodeFact(
        knopPath,
        SFLO_HAS_REFERENCE_CATALOG_IRI,
        referenceCatalog.referenceCatalogPath,
      ),
    ]),
  ];
}

function renderSourceRegistryFallbackFacts(
  sourceRegistry: CurrentKnopSourceRegistry,
): string {
  return [
    renderNamedNodeFact(
      sourceRegistry.sourceRegistryPath,
      RDF_TYPE_IRI,
      SFLO_KNOP_SOURCE_REGISTRY_IRI,
    ),
    renderNamedNodeFact(
      sourceRegistry.sourceRegistryPath,
      RDF_TYPE_IRI,
      `${SFLO_NAMESPACE}DigitalArtifact`,
    ),
    renderNamedNodeFact(
      sourceRegistry.sourceRegistryPath,
      RDF_TYPE_IRI,
      `${SFLO_NAMESPACE}RdfDocument`,
    ),
    renderNamedNodeFact(
      sourceRegistry.sourceRegistryPath,
      SFLO_HAS_WORKING_LOCATED_FILE_IRI,
      sourceRegistry.sourcesFilePath,
    ),
  ].join("\n");
}

function renderReferenceCatalogFallbackFacts(
  referenceCatalog: CurrentKnopReferenceCatalog,
): string {
  return [
    renderNamedNodeFact(
      referenceCatalog.referenceCatalogPath,
      RDF_TYPE_IRI,
      SFLO_REFERENCE_CATALOG_IRI,
    ),
    renderNamedNodeFact(
      referenceCatalog.referenceCatalogPath,
      RDF_TYPE_IRI,
      `${SFLO_NAMESPACE}DigitalArtifact`,
    ),
    renderNamedNodeFact(
      referenceCatalog.referenceCatalogPath,
      RDF_TYPE_IRI,
      `${SFLO_NAMESPACE}RdfDocument`,
    ),
    referenceCatalog.referencesFilePredicateIri === SFLO_WORKING_FILE_PATH_IRI
      ? renderLiteralFact(
        referenceCatalog.referenceCatalogPath,
        SFLO_WORKING_FILE_PATH_IRI,
        referenceCatalog.referencesFilePath,
      )
      : renderNamedNodeFact(
        referenceCatalog.referenceCatalogPath,
        SFLO_HAS_WORKING_LOCATED_FILE_IRI,
        referenceCatalog.referencesFilePath,
      ),
  ].join("\n");
}

function renderLocatedFileFallbackFact(path: string): string {
  return [
    renderNamedNodeFact(path, RDF_TYPE_IRI, `${SFLO_NAMESPACE}LocatedFile`),
    renderNamedNodeFact(path, RDF_TYPE_IRI, `${SFLO_NAMESPACE}RdfDocument`),
  ].join("\n");
}

function renderNamedNodeFact(
  subjectPath: string,
  predicateIri: string,
  objectPathOrIri: string,
): string {
  return `${renderNamedNodeTerm(subjectPath, "subject")} ${
    renderNamedNodeTerm(predicateIri, "predicate")
  } ${renderNamedNodeTerm(objectPathOrIri, "object")} .`;
}

function renderLiteralFact(
  subjectPath: string,
  predicateIri: string,
  value: string,
): string {
  return `${renderNamedNodeTerm(subjectPath, "subject")} ${
    renderNamedNodeTerm(predicateIri, "predicate")
  } "${escapeTurtleString(value)}" .`;
}

function parseRequestedSupportFacts(
  meshBase: string,
  turtle: string,
): RequestedSupportFact[] {
  return new Parser({ baseIRI: meshBase }).parse(
    `${supportFactParseDirectives()}\n\n${turtle}`,
  )
    .filter((quad: Quad) =>
      !MUTABLE_PROGRESSION_PREDICATES.has(quad.predicate.value)
    )
    .map((quad: Quad) => toRequestedSupportFact(quad, meshBase));
}

function supportFactParseDirectives(): string {
  return `@prefix sflo: <${SFLO_NAMESPACE}> .`;
}

function parseBlockQuads(
  meshBase: string,
  directives: string,
  block: string,
  errorMessage: string,
): Quad[] {
  try {
    return new Parser({ baseIRI: meshBase }).parse(`${directives}\n\n${block}`);
  } catch {
    throw new WeaveInputError(errorMessage);
  }
}

function toRequestedSupportFact(
  quad: Quad,
  meshBase: string,
): RequestedSupportFact {
  return {
    key: toQuadKey(quad),
    turtle: `${renderTurtleTerm(quad.subject, meshBase, "subject")} ${
      renderTurtleTerm(quad.predicate, meshBase, "predicate")
    } ${renderTurtleTerm(quad.object, meshBase, "object")} .`,
  };
}

function deduplicateRequestedFacts(
  facts: readonly RequestedSupportFact[],
): RequestedSupportFact[] {
  const seen = new Set<string>();
  const deduped: RequestedSupportFact[] = [];
  for (const fact of facts) {
    if (seen.has(fact.key)) {
      continue;
    }
    seen.add(fact.key);
    deduped.push(fact);
  }
  return deduped;
}

function toQuadKey(quad: Quad): string {
  return [
    toTermKey(quad.graph),
    toTermKey(quad.subject),
    toTermKey(quad.predicate),
    toTermKey(quad.object),
  ].join("|");
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

function renderTurtleTerm(
  term: Term,
  meshBase: string,
  position: "subject" | "predicate" | "object",
): string {
  switch (term.termType) {
    case "NamedNode":
      return renderNamedNodeTerm(term.value, position, meshBase);
    case "Literal":
      return renderTurtleLiteral(term);
    default:
      throw new WeaveInputError(
        "Could not render carried Knop support fact.",
      );
  }
}

function renderNamedNodeTerm(
  value: string,
  position: "subject" | "predicate" | "object",
  meshBase?: string,
): string {
  if (position === "predicate" && value === RDF_TYPE_IRI) {
    return "a";
  }
  if (value.startsWith(SFLO_NAMESPACE)) {
    return `sflo:${value.slice(SFLO_NAMESPACE.length)}`;
  }
  if (meshBase !== undefined && value.startsWith(meshBase)) {
    return `<${value.slice(meshBase.length)}>`;
  }
  return `<${value}>`;
}

function renderTurtleLiteral(term: Term & { termType: "Literal" }): string {
  const value = `"${escapeTurtleString(term.value)}"`;
  if (term.language.length > 0) {
    return `${value}@${term.language}`;
  }
  if (term.datatype.value === XSD_STRING_IRI) {
    return value;
  }
  return `${value}^^<${term.datatype.value}>`;
}

function extractTurtleDirectives(turtle: string): string {
  return turtle.split("\n")
    .filter((line) => line.startsWith("@base ") || line.startsWith("@prefix "))
    .join("\n");
}

function missingPrefixDeclarations(
  currentTurtle: string,
  renderedTurtle: string,
): string[] {
  const renderedPrefixes = new Set(
    renderedTurtle.split("\n").filter((line) => line.startsWith("@prefix ")),
  );
  return currentTurtle.split("\n").filter((line) =>
    line.startsWith("@prefix ") && !renderedPrefixes.has(line)
  );
}

function appendTurtleChunks(turtle: string, chunks: readonly string[]): string {
  const appendTurtle = `${chunks.join("\n\n")}\n`;
  if (turtle.length === 0) {
    return appendTurtle;
  }
  if (turtle.endsWith("\n\n")) {
    return `${turtle}${appendTurtle}`;
  }
  if (turtle.endsWith("\n")) {
    return `${turtle}\n${appendTurtle}`;
  }
  return `${turtle}\n\n${appendTurtle}`;
}
