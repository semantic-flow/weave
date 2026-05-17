import { Parser } from "n3";
import type { Quad } from "n3";
import type { PlannedFile } from "../planned_file.ts";
import {
  normalizeSafeDesignatorPath,
  toKnopPath,
  toReferenceCatalogPath,
} from "../designator_segments.ts";
import {
  SFLO_NAMESPACE,
  SFLO_TURTLE_PREFIX_DECLARATION,
} from "../rdf/namespaces.ts";

const RDF_TYPE_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const XSD_NON_NEGATIVE_INTEGER_IRI =
  "http://www.w3.org/2001/XMLSchema#nonNegativeInteger";
const SFLO_ARTIFACT_HISTORY_IRI = `${SFLO_NAMESPACE}ArtifactHistory`;
const SFLO_ARTIFACT_MANIFESTATION_IRI =
  `${SFLO_NAMESPACE}ArtifactManifestation`;
const SFLO_CURRENT_ARTIFACT_HISTORY_IRI =
  `${SFLO_NAMESPACE}currentArtifactHistory`;
const SFLO_DIGITAL_ARTIFACT_IRI = `${SFLO_NAMESPACE}DigitalArtifact`;
const SFLO_HAS_ARTIFACT_HISTORY_IRI = `${SFLO_NAMESPACE}hasArtifactHistory`;
const SFLO_HAS_HISTORICAL_STATE_IRI = `${SFLO_NAMESPACE}hasHistoricalState`;
const SFLO_HAS_KNOP_INVENTORY_IRI = `${SFLO_NAMESPACE}hasKnopInventory`;
const SFLO_HAS_KNOP_METADATA_IRI = `${SFLO_NAMESPACE}hasKnopMetadata`;
const SFLO_HAS_EXTRACTION_SOURCE_IRI = `${SFLO_NAMESPACE}hasExtractionSource`;
const SFLO_HAS_LOCATED_FILE_IRI = `${SFLO_NAMESPACE}hasLocatedFile`;
const SFLO_HAS_MANIFESTATION_IRI = `${SFLO_NAMESPACE}hasManifestation`;
const SFLO_HAS_KNOP_SOURCE_REGISTRY_IRI =
  `${SFLO_NAMESPACE}hasKnopSourceRegistry`;
const SFLO_HAS_REFERENCE_CATALOG_IRI = `${SFLO_NAMESPACE}hasReferenceCatalog`;
const SFLO_HAS_RESOURCE_PAGE_IRI = `${SFLO_NAMESPACE}hasResourcePage`;
const SFLO_HAS_WORKING_KNOP_INVENTORY_FILE_IRI =
  `${SFLO_NAMESPACE}hasWorkingKnopInventoryFile`;
const SFLO_HAS_WORKING_LOCATED_FILE_IRI =
  `${SFLO_NAMESPACE}hasWorkingLocatedFile`;
const SFLO_HISTORICAL_STATE_IRI = `${SFLO_NAMESPACE}HistoricalState`;
const SFLO_HISTORY_ORDINAL_IRI = `${SFLO_NAMESPACE}historyOrdinal`;
const SFLO_KNOP_IRI = `${SFLO_NAMESPACE}Knop`;
const SFLO_KNOP_INVENTORY_IRI = `${SFLO_NAMESPACE}KnopInventory`;
const SFLO_KNOP_METADATA_IRI = `${SFLO_NAMESPACE}KnopMetadata`;
const SFLO_KNOP_SOURCE_REGISTRY_IRI = `${SFLO_NAMESPACE}KnopSourceRegistry`;
const SFLO_LATEST_HISTORICAL_STATE_IRI =
  `${SFLO_NAMESPACE}latestHistoricalState`;
const SFLO_LOCATED_FILE_FOR_STATE_IRI = `${SFLO_NAMESPACE}locatedFileForState`;
const SFLO_LOCATED_FILE_IRI = `${SFLO_NAMESPACE}LocatedFile`;
const SFLO_NEXT_HISTORY_ORDINAL_IRI = `${SFLO_NAMESPACE}nextHistoryOrdinal`;
const SFLO_NEXT_STATE_ORDINAL_IRI = `${SFLO_NAMESPACE}nextStateOrdinal`;
const SFLO_RDF_DOCUMENT_IRI = `${SFLO_NAMESPACE}RdfDocument`;
const SFLO_REFERENCE_CATALOG_IRI = `${SFLO_NAMESPACE}ReferenceCatalog`;
const SFLO_RESOURCE_PAGE_IRI = `${SFLO_NAMESPACE}ResourcePage`;
const SFLO_STATE_ORDINAL_IRI = `${SFLO_NAMESPACE}stateOrdinal`;

const referenceRoleIriByToken = {
  canonical: `${SFLO_NAMESPACE}referenceRole_canonical`,
  supplemental: `${SFLO_NAMESPACE}referenceRole_supplemental`,
  deprecated: `${SFLO_NAMESPACE}referenceRole_deprecated`,
} as const;

type ReferenceRoleToken = keyof typeof referenceRoleIriByToken;

export interface KnopAddReferenceRequest {
  designatorPath: string;
  referenceTargetDesignatorPath: string;
  referenceTargetStatePath?: string;
  referenceRole: string;
}

export interface ResolvedKnopAddReferenceRequest
  extends KnopAddReferenceRequest {
  meshBase: string;
  currentKnopInventoryTurtle: string;
}

export interface KnopAddReferencePlan {
  meshBase: string;
  designatorPath: string;
  referenceTargetDesignatorPath: string;
  referenceTargetStatePath?: string;
  referenceCatalogIri: string;
  referenceLinkIri: string;
  referenceRoleIri: string;
  referenceTargetIri: string;
  referenceTargetStateIri?: string;
  createdFiles: readonly PlannedFile[];
  updatedFiles: readonly PlannedFile[];
}

export class KnopAddReferenceInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnopAddReferenceInputError";
  }
}

type KnopInventoryShape = "unwoven" | "woven";

interface CurrentKnopSourceFacts {
  sourceRegistryPath?: string;
  sourcesFilePath?: string;
  extractionSourcePath?: string;
  extractionSourceBlock?: string;
}

export function planKnopAddReference(
  request: ResolvedKnopAddReferenceRequest,
): KnopAddReferencePlan {
  const meshBase = normalizeMeshBase(request.meshBase);
  const designatorPath = normalizeDesignatorPath(
    request.designatorPath,
    "designatorPath",
  );
  const referenceTargetDesignatorPath = normalizeDesignatorPath(
    request.referenceTargetDesignatorPath,
    "referenceTargetDesignatorPath",
  );
  const referenceTargetStatePath = request.referenceTargetStatePath ===
      undefined
    ? undefined
    : normalizeRelativeIriPath(
      request.referenceTargetStatePath,
      "referenceTargetStatePath",
    );
  const referenceRoleIri = resolveReferenceRoleIri(request.referenceRole);
  const knopPath = toKnopPath(designatorPath);
  const referenceCatalogPath = `${knopPath}/_references`;
  const referenceLinkPath = `${referenceCatalogPath}#reference001`;

  return {
    meshBase,
    designatorPath,
    referenceTargetDesignatorPath,
    ...(referenceTargetStatePath ? { referenceTargetStatePath } : {}),
    referenceCatalogIri: new URL(referenceCatalogPath, meshBase).href,
    referenceLinkIri: new URL(referenceLinkPath, meshBase).href,
    referenceRoleIri,
    referenceTargetIri: new URL(referenceTargetDesignatorPath, meshBase).href,
    ...(referenceTargetStatePath
      ? {
        referenceTargetStateIri: new URL(referenceTargetStatePath, meshBase)
          .href,
      }
      : {}),
    createdFiles: [
      {
        path: `${referenceCatalogPath}/references.ttl`,
        contents: renderReferencesTurtle(
          meshBase,
          designatorPath,
          referenceTargetDesignatorPath,
          referenceTargetStatePath,
          referenceRoleIri,
        ),
      },
    ],
    updatedFiles: [
      {
        path: `${knopPath}/_inventory/inventory.ttl`,
        contents: renderUpdatedKnopInventoryTurtle(
          meshBase,
          request.currentKnopInventoryTurtle,
          knopPath,
        ),
      },
    ],
  };
}

function normalizeMeshBase(meshBase: string): string {
  const trimmed = meshBase.trim();
  if (trimmed.length === 0) {
    throw new KnopAddReferenceInputError("meshBase is required");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new KnopAddReferenceInputError("meshBase must be an absolute IRI");
  }

  if (!url.pathname.endsWith("/")) {
    throw new KnopAddReferenceInputError("meshBase must end with '/'");
  }
  if (url.search.length > 0 || url.hash.length > 0) {
    throw new KnopAddReferenceInputError(
      "meshBase must not include a query or fragment",
    );
  }

  return url.href;
}

function normalizeDesignatorPath(
  designatorPath: string,
  fieldName: string,
): string {
  return normalizeSafeDesignatorPath(
    designatorPath,
    fieldName,
    (message) => new KnopAddReferenceInputError(message),
    { allowRoot: true },
  );
}

function normalizeRelativeIriPath(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new KnopAddReferenceInputError(`${fieldName} is required`);
  }
  if (trimmed.startsWith("/") || trimmed.endsWith("/")) {
    throw new KnopAddReferenceInputError(
      `${fieldName} must not start or end with '/'`,
    );
  }
  if (
    trimmed.includes("\\") || trimmed.includes("?") || trimmed.includes("#")
  ) {
    throw new KnopAddReferenceInputError(
      `${fieldName} contains unsupported path characters`,
    );
  }

  const segments = trimmed.split("/");
  if (segments.some((segment) => segment.length === 0)) {
    throw new KnopAddReferenceInputError(
      `${fieldName} must not contain empty path segments`,
    );
  }
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new KnopAddReferenceInputError(
      `${fieldName} must not contain '.' or '..' path segments`,
    );
  }

  return trimmed;
}

export function resolveReferenceRoleIri(referenceRole: string): string {
  return referenceRoleIriByToken[normalizeReferenceRole(referenceRole)];
}

function normalizeReferenceRole(referenceRole: string): ReferenceRoleToken {
  const normalized = referenceRole.trim().toLowerCase();
  if (normalized.length === 0) {
    throw new KnopAddReferenceInputError("referenceRole is required");
  }
  if (
    Object.prototype.hasOwnProperty.call(referenceRoleIriByToken, normalized)
  ) {
    return normalized as ReferenceRoleToken;
  }
  throw new KnopAddReferenceInputError(
    `Unsupported referenceRole: ${referenceRole}`,
  );
}

function renderReferencesTurtle(
  meshBase: string,
  designatorPath: string,
  referenceTargetDesignatorPath: string,
  referenceTargetStatePath: string | undefined,
  referenceRoleIri: string,
): string {
  const referenceCatalogPath = toReferenceCatalogPath(designatorPath);
  const referenceTargetFacts = referenceTargetStatePath
    ? `  sflo:referenceTarget <${referenceTargetDesignatorPath}> ;
  sflo:referenceTargetState <${referenceTargetStatePath}> .`
    : `  sflo:referenceTarget <${referenceTargetDesignatorPath}> .`;

  return `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}

<${designatorPath}> sflo:hasReferenceLink <${referenceCatalogPath}#reference001> .

<${referenceCatalogPath}#reference001> a sflo:ReferenceLink ;
  sflo:referenceLinkFor <${designatorPath}> ;
  sflo:hasReferenceRole <${referenceRoleIri}> ;
${referenceTargetFacts}
`;
}

function renderUpdatedKnopInventoryTurtle(
  meshBase: string,
  currentKnopInventoryTurtle: string,
  knopPath: string,
): string {
  const shape = classifyCurrentKnopInventoryShape(
    meshBase,
    currentKnopInventoryTurtle,
    knopPath,
  );
  const rendered = shape === "woven"
    ? renderWovenKnopInventoryWithReferenceCatalog(meshBase, knopPath)
    : renderUnwovenKnopInventoryWithReferenceCatalog(meshBase, knopPath);

  return renderKnopInventoryWithPreservedSourceFacts({
    meshBase,
    currentKnopInventoryTurtle,
    renderedKnopInventoryTurtle: rendered,
    knopPath,
  });
}

function renderKnopInventoryWithPreservedSourceFacts(options: {
  meshBase: string;
  currentKnopInventoryTurtle: string;
  renderedKnopInventoryTurtle: string;
  knopPath: string;
}): string {
  const sourceFacts = resolveCurrentKnopSourceFacts(options);
  if (
    sourceFacts.sourceRegistryPath === undefined &&
    sourceFacts.extractionSourcePath === undefined
  ) {
    return options.renderedKnopInventoryTurtle;
  }

  let blocks = splitTurtleBlocks(options.renderedKnopInventoryTurtle);
  const knopBlockIndex = findSubjectBlockIndex(blocks, options.knopPath);
  if (knopBlockIndex === -1) {
    throw new KnopAddReferenceInputError(
      `rendered knop inventory is missing the ${options.knopPath} block`,
    );
  }

  blocks = replaceSubjectBlock(
    blocks,
    options.knopPath,
    renderKnopBlockWithSourceFacts(blocks[knopBlockIndex]!, sourceFacts),
  );
  if (
    sourceFacts.sourceRegistryPath !== undefined &&
    sourceFacts.sourcesFilePath !== undefined
  ) {
    blocks = upsertSubjectBlockAfter(
      blocks,
      `${options.knopPath}/_inventory`,
      sourceFacts.sourceRegistryPath,
      renderSubjectPredicateBlock(
        sourceFacts.sourceRegistryPath,
        "sflo:KnopSourceRegistry, sflo:DigitalArtifact, sflo:RdfDocument",
        [
          `sflo:hasWorkingLocatedFile <${sourceFacts.sourcesFilePath}>`,
        ],
      ),
    );
    blocks = upsertSubjectBlockAfter(
      blocks,
      sourceFacts.sourceRegistryPath,
      sourceFacts.sourcesFilePath,
      renderLocatedFileBlock(sourceFacts.sourcesFilePath),
    );
  }
  if (
    sourceFacts.extractionSourcePath !== undefined &&
    sourceFacts.extractionSourceBlock !== undefined
  ) {
    blocks = upsertSubjectBlockAfter(
      blocks,
      sourceFacts.sourceRegistryPath ?? `${options.knopPath}/_inventory`,
      sourceFacts.extractionSourcePath,
      sourceFacts.extractionSourceBlock,
    );
  }

  return `${blocks.join("\n\n")}\n`;
}

function resolveCurrentKnopSourceFacts(options: {
  meshBase: string;
  currentKnopInventoryTurtle: string;
  knopPath: string;
}): CurrentKnopSourceFacts {
  const errorMessage =
    `Could not resolve carried source facts from current KnopInventory for ${options.knopPath}.`;
  const quads = parseKnopInventoryQuads(
    options.meshBase,
    options.currentKnopInventoryTurtle,
    errorMessage,
  );
  const knopIri = new URL(options.knopPath, options.meshBase).href;
  const sourceRegistryIri = requireOptionalNamedNodeObject(
    quads,
    knopIri,
    SFLO_HAS_KNOP_SOURCE_REGISTRY_IRI,
    errorMessage,
  );
  const extractionSourceIri = requireOptionalNamedNodeObject(
    quads,
    knopIri,
    SFLO_HAS_EXTRACTION_SOURCE_IRI,
    errorMessage,
  );
  const sourceRegistryPath = sourceRegistryIri === undefined
    ? undefined
    : toMeshPath(options.meshBase, sourceRegistryIri, errorMessage);
  const extractionSourcePath = extractionSourceIri === undefined
    ? undefined
    : toMeshPath(options.meshBase, extractionSourceIri, errorMessage);
  const sourcesFilePath = sourceRegistryIri === undefined
    ? undefined
    : requireOptionalNamedNodeObject(
      quads,
      sourceRegistryIri,
      SFLO_HAS_WORKING_LOCATED_FILE_IRI,
      errorMessage,
    );
  const sourcesFileRelativePath = sourcesFilePath === undefined
    ? undefined
    : toMeshPath(options.meshBase, sourcesFilePath, errorMessage);
  const extractionSourceBlock = extractionSourcePath === undefined
    ? undefined
    : splitTurtleBlocks(options.currentKnopInventoryTurtle).find((block) =>
      getSubjectPathFromBlock(block) === extractionSourcePath
    );

  if (
    sourceRegistryPath !== undefined &&
    !hasNamedNodeFact(
      quads,
      options.meshBase,
      sourceRegistryPath,
      RDF_TYPE_IRI,
      SFLO_KNOP_SOURCE_REGISTRY_IRI,
    )
  ) {
    throw new KnopAddReferenceInputError(errorMessage);
  }
  if (
    sourceRegistryPath !== undefined && sourcesFileRelativePath === undefined
  ) {
    throw new KnopAddReferenceInputError(errorMessage);
  }

  return {
    ...(sourceRegistryPath !== undefined ? { sourceRegistryPath } : {}),
    ...(sourcesFileRelativePath !== undefined
      ? { sourcesFilePath: sourcesFileRelativePath }
      : {}),
    ...(extractionSourcePath !== undefined ? { extractionSourcePath } : {}),
    ...(extractionSourceBlock !== undefined ? { extractionSourceBlock } : {}),
  };
}

function renderKnopBlockWithSourceFacts(
  block: string,
  sourceFacts: CurrentKnopSourceFacts,
): string {
  const carriedLines = [
    ...(sourceFacts.sourceRegistryPath === undefined ? [] : [
      `  sflo:hasKnopSourceRegistry <${sourceFacts.sourceRegistryPath}> ;`,
    ]),
    ...(sourceFacts.extractionSourcePath === undefined ? [] : [
      `  sflo:hasExtractionSource <${sourceFacts.extractionSourcePath}> ;`,
    ]),
  ].filter((line) => !block.includes(line));
  if (carriedLines.length === 0) {
    return block;
  }

  const workingInventoryLine = "  sflo:hasWorkingKnopInventoryFile ";
  if (!block.includes(workingInventoryLine)) {
    throw new KnopAddReferenceInputError(
      "could not preserve source facts because the Knop block is missing hasWorkingKnopInventoryFile",
    );
  }

  return block.replace(
    workingInventoryLine,
    `${carriedLines.join("\n")}\n${workingInventoryLine}`,
  );
}

function splitTurtleBlocks(turtle: string): string[] {
  return turtle.trimEnd().split("\n\n");
}

function replaceSubjectBlock(
  blocks: readonly string[],
  subjectPath: string,
  replacementBlock: string,
): string[] {
  const index = findSubjectBlockIndex(blocks, subjectPath);
  if (index === -1) {
    throw new KnopAddReferenceInputError(
      `rendered knop inventory did not contain subject block <${subjectPath}>`,
    );
  }

  const nextBlocks = [...blocks];
  nextBlocks[index] = replacementBlock;
  return nextBlocks;
}

function upsertSubjectBlockAfter(
  blocks: readonly string[],
  anchorSubjectPath: string,
  subjectPath: string,
  block: string,
): string[] {
  const existingIndex = findSubjectBlockIndex(blocks, subjectPath);
  if (existingIndex !== -1) {
    const nextBlocks = [...blocks];
    nextBlocks[existingIndex] = block;
    return nextBlocks;
  }

  const anchorIndex = findSubjectBlockIndex(blocks, anchorSubjectPath);
  if (anchorIndex === -1) {
    throw new KnopAddReferenceInputError(
      `rendered knop inventory did not contain anchor subject block <${anchorSubjectPath}>`,
    );
  }

  const nextBlocks = [...blocks];
  nextBlocks.splice(anchorIndex + 1, 0, block);
  return nextBlocks;
}

function findSubjectBlockIndex(
  blocks: readonly string[],
  subjectPath: string,
): number {
  return blocks.findIndex((block) =>
    getSubjectPathFromBlock(block) === subjectPath
  );
}

function getSubjectPathFromBlock(block: string): string | undefined {
  const match = block.match(/^<([^>]*)>/);
  return match?.[1];
}

function renderSubjectPredicateBlock(
  subjectPath: string,
  typeList: string,
  predicates: readonly string[],
): string {
  return `<${subjectPath}> a ${typeList} ;
  ${predicates.join(" ;\n  ")} .`;
}

function renderLocatedFileBlock(path: string): string {
  return `<${path}> a sflo:LocatedFile, sflo:RdfDocument .`;
}

function classifyCurrentKnopInventoryShape(
  meshBase: string,
  currentKnopInventoryTurtle: string,
  knopPath: string,
): KnopInventoryShape {
  const referenceCatalogPath = `${knopPath}/_references`;
  const shapeErrorMessage =
    `current knop inventory has an unsupported carried shape for ${knopPath}`;
  const quads = parseKnopInventoryQuads(
    meshBase,
    currentKnopInventoryTurtle,
    shapeErrorMessage,
  );

  if (
    !hasNamedNodeFact(
      quads,
      meshBase,
      knopPath,
      RDF_TYPE_IRI,
      SFLO_KNOP_IRI,
    )
  ) {
    throw new KnopAddReferenceInputError(
      `current knop inventory is missing the ${knopPath} block`,
    );
  }

  if (
    hasNamedNodeFact(
      quads,
      meshBase,
      knopPath,
      SFLO_HAS_REFERENCE_CATALOG_IRI,
      referenceCatalogPath,
    ) ||
    hasNamedNodeFact(
      quads,
      meshBase,
      referenceCatalogPath,
      RDF_TYPE_IRI,
      SFLO_REFERENCE_CATALOG_IRI,
    )
  ) {
    throw new KnopAddReferenceInputError(
      `knop inventory already registers reference catalog: ${referenceCatalogPath}`,
    );
  }

  const hasWovenHistory = hasNamedNodeFact(
    quads,
    meshBase,
    knopPath,
    SFLO_HAS_RESOURCE_PAGE_IRI,
    `${knopPath}/index.html`,
  ) ||
    hasPredicateForSubject(
      quads,
      meshBase,
      `${knopPath}/_meta`,
      SFLO_HAS_ARTIFACT_HISTORY_IRI,
    ) ||
    hasPredicateForSubject(
      quads,
      meshBase,
      `${knopPath}/_inventory`,
      SFLO_HAS_ARTIFACT_HISTORY_IRI,
    );

  if (hasWovenHistory) {
    assertCurrentWovenKnopInventoryShape(
      quads,
      meshBase,
      knopPath,
      shapeErrorMessage,
    );
    return "woven";
  }

  assertCurrentUnwovenKnopInventoryShape(
    quads,
    meshBase,
    knopPath,
    shapeErrorMessage,
  );
  return "unwoven";
}

function assertCurrentUnwovenKnopInventoryShape(
  quads: readonly Quad[],
  meshBase: string,
  knopPath: string,
  errorMessage: string,
): void {
  assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
    [knopPath, RDF_TYPE_IRI, SFLO_KNOP_IRI],
    [knopPath, SFLO_HAS_KNOP_METADATA_IRI, `${knopPath}/_meta`],
    [knopPath, SFLO_HAS_KNOP_INVENTORY_IRI, `${knopPath}/_inventory`],
    [
      knopPath,
      SFLO_HAS_WORKING_KNOP_INVENTORY_FILE_IRI,
      `${knopPath}/_inventory/inventory.ttl`,
    ],
    [`${knopPath}/_meta`, RDF_TYPE_IRI, SFLO_KNOP_METADATA_IRI],
    [`${knopPath}/_meta`, RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    [`${knopPath}/_meta`, RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [
      `${knopPath}/_meta`,
      SFLO_HAS_WORKING_LOCATED_FILE_IRI,
      `${knopPath}/_meta/meta.ttl`,
    ],
    [`${knopPath}/_inventory`, RDF_TYPE_IRI, SFLO_KNOP_INVENTORY_IRI],
    [`${knopPath}/_inventory`, RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    [`${knopPath}/_inventory`, RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [
      `${knopPath}/_inventory`,
      SFLO_HAS_WORKING_LOCATED_FILE_IRI,
      `${knopPath}/_inventory/inventory.ttl`,
    ],
    [`${knopPath}/_meta/meta.ttl`, RDF_TYPE_IRI, SFLO_LOCATED_FILE_IRI],
    [`${knopPath}/_meta/meta.ttl`, RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [
      `${knopPath}/_inventory/inventory.ttl`,
      RDF_TYPE_IRI,
      SFLO_LOCATED_FILE_IRI,
    ],
    [
      `${knopPath}/_inventory/inventory.ttl`,
      RDF_TYPE_IRI,
      SFLO_RDF_DOCUMENT_IRI,
    ],
  ]);
}

function assertCurrentWovenKnopInventoryShape(
  quads: readonly Quad[],
  meshBase: string,
  knopPath: string,
  errorMessage: string,
): void {
  assertCurrentUnwovenKnopInventoryShape(
    quads,
    meshBase,
    knopPath,
    errorMessage,
  );
  assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
    [knopPath, SFLO_HAS_RESOURCE_PAGE_IRI, `${knopPath}/index.html`],
    [
      `${knopPath}/_meta`,
      SFLO_HAS_ARTIFACT_HISTORY_IRI,
      `${knopPath}/_meta/_history001`,
    ],
    [
      `${knopPath}/_meta`,
      SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
      `${knopPath}/_meta/_history001`,
    ],
    [
      `${knopPath}/_meta`,
      SFLO_HAS_RESOURCE_PAGE_IRI,
      `${knopPath}/_meta/index.html`,
    ],
    [
      `${knopPath}/_inventory`,
      SFLO_HAS_ARTIFACT_HISTORY_IRI,
      `${knopPath}/_inventory/_history001`,
    ],
    [
      `${knopPath}/_inventory`,
      SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
      `${knopPath}/_inventory/_history001`,
    ],
    [
      `${knopPath}/_inventory`,
      SFLO_HAS_RESOURCE_PAGE_IRI,
      `${knopPath}/_inventory/index.html`,
    ],
    [`${knopPath}/_meta/_history001`, RDF_TYPE_IRI, SFLO_ARTIFACT_HISTORY_IRI],
    [
      `${knopPath}/_meta/_history001`,
      SFLO_HAS_HISTORICAL_STATE_IRI,
      `${knopPath}/_meta/_history001/_s0001`,
    ],
    [
      `${knopPath}/_meta/_history001`,
      SFLO_LATEST_HISTORICAL_STATE_IRI,
      `${knopPath}/_meta/_history001/_s0001`,
    ],
    [
      `${knopPath}/_meta/_history001`,
      SFLO_HAS_RESOURCE_PAGE_IRI,
      `${knopPath}/_meta/_history001/index.html`,
    ],
    [
      `${knopPath}/_meta/_history001/_s0001`,
      RDF_TYPE_IRI,
      SFLO_HISTORICAL_STATE_IRI,
    ],
    [
      `${knopPath}/_meta/_history001/_s0001`,
      SFLO_HAS_MANIFESTATION_IRI,
      `${knopPath}/_meta/_history001/_s0001/ttl`,
    ],
    [
      `${knopPath}/_meta/_history001/_s0001`,
      SFLO_LOCATED_FILE_FOR_STATE_IRI,
      `${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl`,
    ],
    [
      `${knopPath}/_meta/_history001/_s0001`,
      SFLO_HAS_RESOURCE_PAGE_IRI,
      `${knopPath}/_meta/_history001/_s0001/index.html`,
    ],
    [
      `${knopPath}/_meta/_history001/_s0001/ttl`,
      RDF_TYPE_IRI,
      SFLO_ARTIFACT_MANIFESTATION_IRI,
    ],
    [
      `${knopPath}/_meta/_history001/_s0001/ttl`,
      RDF_TYPE_IRI,
      SFLO_RDF_DOCUMENT_IRI,
    ],
    [
      `${knopPath}/_meta/_history001/_s0001/ttl`,
      SFLO_HAS_LOCATED_FILE_IRI,
      `${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl`,
    ],
    [
      `${knopPath}/_meta/_history001/_s0001/ttl`,
      SFLO_HAS_RESOURCE_PAGE_IRI,
      `${knopPath}/_meta/_history001/_s0001/ttl/index.html`,
    ],
    [
      `${knopPath}/_inventory/_history001`,
      RDF_TYPE_IRI,
      SFLO_ARTIFACT_HISTORY_IRI,
    ],
    [
      `${knopPath}/_inventory/_history001`,
      SFLO_HAS_HISTORICAL_STATE_IRI,
      `${knopPath}/_inventory/_history001/_s0001`,
    ],
    [
      `${knopPath}/_inventory/_history001`,
      SFLO_LATEST_HISTORICAL_STATE_IRI,
      `${knopPath}/_inventory/_history001/_s0001`,
    ],
    [
      `${knopPath}/_inventory/_history001`,
      SFLO_HAS_RESOURCE_PAGE_IRI,
      `${knopPath}/_inventory/_history001/index.html`,
    ],
    [
      `${knopPath}/_inventory/_history001/_s0001`,
      RDF_TYPE_IRI,
      SFLO_HISTORICAL_STATE_IRI,
    ],
    [
      `${knopPath}/_inventory/_history001/_s0001`,
      SFLO_HAS_MANIFESTATION_IRI,
      `${knopPath}/_inventory/_history001/_s0001/ttl`,
    ],
    [
      `${knopPath}/_inventory/_history001/_s0001`,
      SFLO_LOCATED_FILE_FOR_STATE_IRI,
      `${knopPath}/_inventory/_history001/_s0001/ttl/inventory.ttl`,
    ],
    [
      `${knopPath}/_inventory/_history001/_s0001`,
      SFLO_HAS_RESOURCE_PAGE_IRI,
      `${knopPath}/_inventory/_history001/_s0001/index.html`,
    ],
    [
      `${knopPath}/_inventory/_history001/_s0001/ttl`,
      RDF_TYPE_IRI,
      SFLO_ARTIFACT_MANIFESTATION_IRI,
    ],
    [
      `${knopPath}/_inventory/_history001/_s0001/ttl`,
      RDF_TYPE_IRI,
      SFLO_RDF_DOCUMENT_IRI,
    ],
    [
      `${knopPath}/_inventory/_history001/_s0001/ttl`,
      SFLO_HAS_LOCATED_FILE_IRI,
      `${knopPath}/_inventory/_history001/_s0001/ttl/inventory.ttl`,
    ],
    [
      `${knopPath}/_inventory/_history001/_s0001/ttl`,
      SFLO_HAS_RESOURCE_PAGE_IRI,
      `${knopPath}/_inventory/_history001/_s0001/ttl/index.html`,
    ],
    [`${knopPath}/index.html`, RDF_TYPE_IRI, SFLO_RESOURCE_PAGE_IRI],
    [`${knopPath}/index.html`, RDF_TYPE_IRI, SFLO_LOCATED_FILE_IRI],
    [`${knopPath}/_meta/index.html`, RDF_TYPE_IRI, SFLO_RESOURCE_PAGE_IRI],
    [`${knopPath}/_meta/index.html`, RDF_TYPE_IRI, SFLO_LOCATED_FILE_IRI],
    [
      `${knopPath}/_meta/_history001/index.html`,
      RDF_TYPE_IRI,
      SFLO_RESOURCE_PAGE_IRI,
    ],
    [
      `${knopPath}/_meta/_history001/index.html`,
      RDF_TYPE_IRI,
      SFLO_LOCATED_FILE_IRI,
    ],
    [
      `${knopPath}/_meta/_history001/_s0001/index.html`,
      RDF_TYPE_IRI,
      SFLO_RESOURCE_PAGE_IRI,
    ],
    [
      `${knopPath}/_meta/_history001/_s0001/index.html`,
      RDF_TYPE_IRI,
      SFLO_LOCATED_FILE_IRI,
    ],
    [
      `${knopPath}/_meta/_history001/_s0001/ttl/index.html`,
      RDF_TYPE_IRI,
      SFLO_RESOURCE_PAGE_IRI,
    ],
    [
      `${knopPath}/_meta/_history001/_s0001/ttl/index.html`,
      RDF_TYPE_IRI,
      SFLO_LOCATED_FILE_IRI,
    ],
    [`${knopPath}/_inventory/index.html`, RDF_TYPE_IRI, SFLO_RESOURCE_PAGE_IRI],
    [`${knopPath}/_inventory/index.html`, RDF_TYPE_IRI, SFLO_LOCATED_FILE_IRI],
    [
      `${knopPath}/_inventory/_history001/index.html`,
      RDF_TYPE_IRI,
      SFLO_RESOURCE_PAGE_IRI,
    ],
    [
      `${knopPath}/_inventory/_history001/index.html`,
      RDF_TYPE_IRI,
      SFLO_LOCATED_FILE_IRI,
    ],
    [
      `${knopPath}/_inventory/_history001/_s0001/index.html`,
      RDF_TYPE_IRI,
      SFLO_RESOURCE_PAGE_IRI,
    ],
    [
      `${knopPath}/_inventory/_history001/_s0001/index.html`,
      RDF_TYPE_IRI,
      SFLO_LOCATED_FILE_IRI,
    ],
    [
      `${knopPath}/_inventory/_history001/_s0001/ttl/index.html`,
      RDF_TYPE_IRI,
      SFLO_RESOURCE_PAGE_IRI,
    ],
    [
      `${knopPath}/_inventory/_history001/_s0001/ttl/index.html`,
      RDF_TYPE_IRI,
      SFLO_LOCATED_FILE_IRI,
    ],
    [
      `${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl`,
      RDF_TYPE_IRI,
      SFLO_LOCATED_FILE_IRI,
    ],
    [
      `${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl`,
      RDF_TYPE_IRI,
      SFLO_RDF_DOCUMENT_IRI,
    ],
    [
      `${knopPath}/_inventory/_history001/_s0001/ttl/inventory.ttl`,
      RDF_TYPE_IRI,
      SFLO_LOCATED_FILE_IRI,
    ],
    [
      `${knopPath}/_inventory/_history001/_s0001/ttl/inventory.ttl`,
      RDF_TYPE_IRI,
      SFLO_RDF_DOCUMENT_IRI,
    ],
  ]);
  assertHasLiteralFacts(quads, meshBase, errorMessage, [
    [
      `${knopPath}/_meta`,
      SFLO_NEXT_HISTORY_ORDINAL_IRI,
      "2",
      XSD_NON_NEGATIVE_INTEGER_IRI,
    ],
    [
      `${knopPath}/_inventory`,
      SFLO_NEXT_HISTORY_ORDINAL_IRI,
      "2",
      XSD_NON_NEGATIVE_INTEGER_IRI,
    ],
    [
      `${knopPath}/_meta/_history001`,
      SFLO_HISTORY_ORDINAL_IRI,
      "1",
      XSD_NON_NEGATIVE_INTEGER_IRI,
    ],
    [
      `${knopPath}/_meta/_history001`,
      SFLO_NEXT_STATE_ORDINAL_IRI,
      "2",
      XSD_NON_NEGATIVE_INTEGER_IRI,
    ],
    [
      `${knopPath}/_meta/_history001/_s0001`,
      SFLO_STATE_ORDINAL_IRI,
      "1",
      XSD_NON_NEGATIVE_INTEGER_IRI,
    ],
    [
      `${knopPath}/_inventory/_history001`,
      SFLO_HISTORY_ORDINAL_IRI,
      "1",
      XSD_NON_NEGATIVE_INTEGER_IRI,
    ],
    [
      `${knopPath}/_inventory/_history001`,
      SFLO_NEXT_STATE_ORDINAL_IRI,
      "2",
      XSD_NON_NEGATIVE_INTEGER_IRI,
    ],
    [
      `${knopPath}/_inventory/_history001/_s0001`,
      SFLO_STATE_ORDINAL_IRI,
      "1",
      XSD_NON_NEGATIVE_INTEGER_IRI,
    ],
  ]);
}

function renderUnwovenKnopInventoryWithReferenceCatalog(
  meshBase: string,
  knopPath: string,
): string {
  return `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}

<${knopPath}> a sflo:Knop ;
  sflo:hasKnopMetadata <${knopPath}/_meta> ;
  sflo:hasKnopInventory <${knopPath}/_inventory> ;
  sflo:hasReferenceCatalog <${knopPath}/_references> ;
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> .

<${knopPath}/_meta> a sflo:KnopMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${knopPath}/_meta/meta.ttl> .

<${knopPath}/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${knopPath}/_inventory/inventory.ttl> .

<${knopPath}/_references> a sflo:ReferenceCatalog, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${knopPath}/_references/references.ttl> .

<${knopPath}/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_references/references.ttl> a sflo:LocatedFile, sflo:RdfDocument .
`;
}

function renderWovenKnopInventoryWithReferenceCatalog(
  meshBase: string,
  knopPath: string,
): string {
  return `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<${knopPath}> a sflo:Knop ;
  sflo:hasKnopMetadata <${knopPath}/_meta> ;
  sflo:hasKnopInventory <${knopPath}/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> ;
  sflo:hasReferenceCatalog <${knopPath}/_references> ;
  sflo:hasResourcePage <${knopPath}/index.html> .

<${knopPath}/_meta> a sflo:KnopMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <${knopPath}/_meta/_history001> ;
  sflo:currentArtifactHistory <${knopPath}/_meta/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <${knopPath}/_meta/meta.ttl> ;
  sflo:hasResourcePage <${knopPath}/_meta/index.html> .

<${knopPath}/_meta/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${knopPath}/_meta/_history001/_s0001> ;
  sflo:latestHistoricalState <${knopPath}/_meta/_history001/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/index.html> .

<${knopPath}/_meta/_history001/_s0001> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <${knopPath}/_meta/_history001/_s0001/ttl> ;
  sflo:locatedFileForState <${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/_s0001/index.html> .

<${knopPath}/_meta/_history001/_s0001/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:hasLocatedFile <${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/_s0001/ttl/index.html> .

<${knopPath}/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <${knopPath}/_inventory/_history001> ;
  sflo:currentArtifactHistory <${knopPath}/_inventory/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <${knopPath}/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/index.html> .

<${knopPath}/_references> a sflo:ReferenceCatalog, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${knopPath}/_references/references.ttl> .

<${knopPath}/_inventory/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${knopPath}/_inventory/_history001/_s0001> ;
  sflo:latestHistoricalState <${knopPath}/_inventory/_history001/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/index.html> .

<${knopPath}/_inventory/_history001/_s0001> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <${knopPath}/_inventory/_history001/_s0001/ttl> ;
  sflo:locatedFileForState <${knopPath}/_inventory/_history001/_s0001/ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0001/index.html> .

<${knopPath}/_inventory/_history001/_s0001/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:hasLocatedFile <${knopPath}/_inventory/_history001/_s0001/ttl/inventory.ttl> ;
  sflo:hasResourcePage <${knopPath}/_inventory/_history001/_s0001/ttl/index.html> .

<${knopPath}/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_references/references.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/_history001/_s0001/ttl/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_inventory/_history001/_s0001/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`;
}

function assertHasNamedNodeFacts(
  quads: readonly Quad[],
  meshBase: string,
  errorMessage: string,
  facts: readonly (readonly [string, string, string])[],
): void {
  for (const [subjectValue, predicateIri, objectValue] of facts) {
    if (
      !hasNamedNodeFact(
        quads,
        meshBase,
        subjectValue,
        predicateIri,
        objectValue,
      )
    ) {
      throw new KnopAddReferenceInputError(errorMessage);
    }
  }
}

function assertHasLiteralFacts(
  quads: readonly Quad[],
  meshBase: string,
  errorMessage: string,
  facts: readonly (readonly [string, string, string, string])[],
): void {
  for (const [subjectValue, predicateIri, literalValue, datatypeIri] of facts) {
    if (
      !hasLiteralFact(
        quads,
        meshBase,
        subjectValue,
        predicateIri,
        literalValue,
        datatypeIri,
      )
    ) {
      throw new KnopAddReferenceInputError(errorMessage);
    }
  }
}

function hasNamedNodeFact(
  quads: readonly Quad[],
  meshBase: string,
  subjectValue: string,
  predicateIri: string,
  objectValue: string,
): boolean {
  const subjectIri = new URL(subjectValue, meshBase).href;
  const objectIri = new URL(objectValue, meshBase).href;

  return quads.some((quad) =>
    quad.subject.termType === "NamedNode" &&
    quad.subject.value === subjectIri &&
    quad.predicate.value === predicateIri &&
    quad.object.termType === "NamedNode" &&
    quad.object.value === objectIri
  );
}

function hasLiteralFact(
  quads: readonly Quad[],
  meshBase: string,
  subjectValue: string,
  predicateIri: string,
  literalValue: string,
  datatypeIri: string,
): boolean {
  const subjectIri = new URL(subjectValue, meshBase).href;

  return quads.some((quad) =>
    quad.subject.termType === "NamedNode" &&
    quad.subject.value === subjectIri &&
    quad.predicate.value === predicateIri &&
    quad.object.termType === "Literal" &&
    quad.object.value === literalValue &&
    quad.object.datatype.value === datatypeIri
  );
}

function hasPredicateForSubject(
  quads: readonly Quad[],
  meshBase: string,
  subjectValue: string,
  predicateIri: string,
): boolean {
  const subjectIri = new URL(subjectValue, meshBase).href;

  return quads.some((quad) =>
    quad.subject.termType === "NamedNode" &&
    quad.subject.value === subjectIri &&
    quad.predicate.value === predicateIri
  );
}

function parseKnopInventoryQuads(
  meshBase: string,
  turtle: string,
  errorMessage: string,
): Quad[] {
  try {
    return new Parser({ baseIRI: meshBase }).parse(turtle);
  } catch {
    throw new KnopAddReferenceInputError(errorMessage);
  }
}

function requireOptionalNamedNodeObject(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
  errorMessage: string,
): string | undefined {
  const values = quads.flatMap((quad) =>
    quad.subject.termType === "NamedNode" &&
      quad.subject.value === subjectIri &&
      quad.predicate.value === predicateIri &&
      quad.object.termType === "NamedNode"
      ? [quad.object.value]
      : []
  );

  if (values.length > 1) {
    throw new KnopAddReferenceInputError(errorMessage);
  }

  return values[0];
}

function toMeshPath(
  meshBase: string,
  iri: string,
  errorMessage: string,
): string {
  if (!iri.startsWith(meshBase)) {
    throw new KnopAddReferenceInputError(errorMessage);
  }

  return iri.slice(meshBase.length);
}
