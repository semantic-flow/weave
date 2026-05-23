import { SFLO_NAMESPACE } from "../rdf/namespaces.ts";
import { WeaveInputError } from "./errors.ts";
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
  renderSubjectPredicateBlock,
  replaceSubjectBlock,
  splitTurtleBlocks,
  upsertSubjectBlockAfter,
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

interface CurrentKnopSourceRegistry {
  sourceRegistryPath: string;
  sourcesFilePath: string;
  extractionSourcePath?: string;
}

interface CurrentKnopReferenceCatalog {
  referenceCatalogPath: string;
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

  let blocks = splitTurtleBlocks(options.renderedKnopInventoryTurtle);
  const currentBlocks = splitTurtleBlocks(options.currentKnopInventoryTurtle);
  const knopBlockIndex = findSubjectBlockIndex(blocks, options.knopPath);
  if (knopBlockIndex === -1) {
    throw new WeaveInputError(
      `Rendered KnopInventory did not contain Knop block <${options.knopPath}> while preserving carried Knop support artifacts.`,
    );
  }

  blocks = replaceSubjectBlock(
    blocks,
    options.knopPath,
    renderKnopBlockWithCarriedSupportFacts(
      blocks[knopBlockIndex]!,
      sourceRegistry,
      referenceCatalog,
    ),
  );
  let insertionSubjectPath = `${options.knopPath}/_inventory`;

  if (sourceRegistry !== undefined) {
    blocks = upsertSubjectBlockAfter(
      blocks,
      insertionSubjectPath,
      sourceRegistry.sourceRegistryPath,
      renderSubjectPredicateBlock(
        sourceRegistry.sourceRegistryPath,
        "sflo:KnopSourceRegistry, sflo:DigitalArtifact, sflo:RdfDocument",
        [
          `sflo:hasWorkingLocatedFile <${sourceRegistry.sourcesFilePath}>`,
        ],
      ),
    );
    blocks = upsertSubjectBlockAfter(
      blocks,
      sourceRegistry.sourceRegistryPath,
      sourceRegistry.sourcesFilePath,
      renderLocatedFileBlock(sourceRegistry.sourcesFilePath),
    );
    insertionSubjectPath = sourceRegistry.sourcesFilePath;
  }

  if (
    referenceCatalog !== undefined &&
    findSubjectBlockIndex(blocks, referenceCatalog.referenceCatalogPath) === -1
  ) {
    for (
      const block of collectSubjectSubtreeBlocks(
        currentBlocks,
        referenceCatalog.referenceCatalogPath,
      )
    ) {
      const subjectPath = getSubjectPathFromBlock(block);
      if (!subjectPath) {
        continue;
      }
      blocks = upsertSubjectBlockAfter(
        blocks,
        insertionSubjectPath,
        subjectPath,
        block,
      );
      insertionSubjectPath = subjectPath;
    }
  }

  return `${blocks.join("\n\n")}\n`;
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

  return { referenceCatalogPath };
}

function renderKnopBlockWithCarriedSupportFacts(
  block: string,
  sourceRegistry: CurrentKnopSourceRegistry | undefined,
  referenceCatalog: CurrentKnopReferenceCatalog | undefined,
): string {
  const carriedLines = [
    ...(sourceRegistry === undefined ? [] : [
      `  sflo:hasKnopSourceRegistry <${sourceRegistry.sourceRegistryPath}> ;`,
      ...(sourceRegistry.extractionSourcePath === undefined ? [] : [
        `  sflo:hasExtractionSource <${sourceRegistry.extractionSourcePath}> ;`,
      ]),
    ]),
    ...(referenceCatalog === undefined ? [] : [
      `  sflo:hasReferenceCatalog <${referenceCatalog.referenceCatalogPath}> ;`,
    ]),
  ].filter((line) => !block.includes(line));
  if (carriedLines.length === 0) {
    return block;
  }

  const workingInventoryLine = "  sflo:hasWorkingKnopInventoryFile ";
  if (!block.includes(workingInventoryLine)) {
    throw new WeaveInputError(
      "Could not find hasWorkingKnopInventoryFile while preserving carried Knop support artifacts.",
    );
  }

  return block.replace(
    workingInventoryLine,
    `${carriedLines.join("\n")}\n${workingInventoryLine}`,
  );
}

function renderLocatedFileBlock(path: string): string {
  return `<${path}> a sflo:LocatedFile, sflo:RdfDocument .`;
}
