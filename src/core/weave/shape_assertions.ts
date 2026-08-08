import type { Quad } from "n3";
import {
  formatDesignatorPathForDisplay,
  toDesignatorResourcePagePath,
  toKnopPath,
} from "../designator_segments.ts";
import { SFCFG_NAMESPACE, SFLO_NAMESPACE } from "../rdf/namespaces.ts";
import { isDeclaredArtifactHistory } from "./artifact_history_queries.ts";
import type {
  PayloadWorkingArtifact,
  ReferenceTargetSourcePayloadArtifact,
  ResourcePageDefinitionWorkingArtifact,
} from "./candidates.ts";
import {
  type MeshValidationFindingAttribution,
  type MeshValidationFindingCode,
  WeaveInputError as BaseWeaveInputError,
} from "./errors.ts";
import type {
  MeshInventoryProgression,
  PageDefinitionWeaveProgression,
} from "./progression_models.ts";
import {
  hasLiteralFact,
  hasNamedNodeFact,
  hasPredicateFact,
  hasSubjectPredicateFact,
  parseWeaveShapeQuads as parseBaseWeaveShapeQuads,
  requireOptionalNamedNodeObject,
  requireSingleNamedNodeObject,
  requireSingleNamedNodeObjectWithDiagnostics,
  requireSingleNonNegativeIntegerLiteral,
  requireSingleNonNegativeIntegerLiteralWithDiagnostics,
  resolveNamedNodeObjectPaths,
  resolveOptionalNamedNodePath,
  resolveOptionalSegmentHint,
  toAbsoluteIri,
  toMeshRelativePath,
} from "./rdf_helpers.ts";
import {
  assertHasCurrentPayloadSourceLocator,
  assertHasCurrentSourceLocator,
  assertHasCurrentWorkingFileLocator,
} from "./source_locator_assertions.ts";

class WeaveInputError extends BaseWeaveInputError {
  constructor(
    message: string,
    findingCode: MeshValidationFindingCode = "unsupported-mesh-shape",
    attribution: MeshValidationFindingAttribution = {},
  ) {
    super(message, findingCode, attribution);
  }
}

function parseWeaveShapeQuads(
  meshBase: string,
  turtle: string,
  errorMessage: string,
  findingCode: MeshValidationFindingCode = "unsupported-mesh-shape",
): readonly Quad[] {
  try {
    return parseBaseWeaveShapeQuads(
      meshBase,
      turtle,
      errorMessage,
      findingCode,
    );
  } catch (error) {
    if (error instanceof BaseWeaveInputError) {
      throw new WeaveInputError(error.message, findingCode);
    }
    throw error;
  }
}

const RDF_TYPE_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const XSD_NON_NEGATIVE_INTEGER_IRI =
  "http://www.w3.org/2001/XMLSchema#nonNegativeInteger";
const SFCFG_HAS_NEXT_STATE_SEGMENT_HINT_IRI =
  `${SFCFG_NAMESPACE}hasNextStateSegmentHint`;
const SFLO_ARTIFACT_RESOLUTION_MODE_WORKING_IRI =
  `${SFLO_NAMESPACE}artifactResolutionMode_working`;
const SFLO_EXTRACTION_SOURCE_IRI = `${SFLO_NAMESPACE}ExtractionSource`;
const SFLO_HAS_ARTIFACT_RESOLUTION_MODE_IRI =
  `${SFLO_NAMESPACE}hasArtifactResolutionMode`;
const SFLO_HAS_EXTRACTION_SOURCE_IRI = `${SFLO_NAMESPACE}hasExtractionSource`;
const SFLO_TARGET_HISTORICAL_STATE_IRI =
  `${SFLO_NAMESPACE}targetHistoricalState`;
const SFLO_TARGET_ARTIFACT_IRI = `${SFLO_NAMESPACE}targetArtifact`;
const SFLO_HAS_KNOP_ASSET_BUNDLE_IRI = `${SFLO_NAMESPACE}hasKnopAssetBundle`;
const SFLO_HAS_RESOURCE_PAGE_DEFINITION_IRI =
  `${SFLO_NAMESPACE}hasResourcePageDefinition`;
const SFLO_KNOP_ASSET_BUNDLE_IRI = `${SFLO_NAMESPACE}KnopAssetBundle`;
const SFLO_RESOURCE_PAGE_DEFINITION_IRI =
  `${SFLO_NAMESPACE}ResourcePageDefinition`;
const SFLO_CURRENT_ARTIFACT_HISTORY_IRI =
  `${SFLO_NAMESPACE}currentArtifactHistory`;
const SFLO_DESIGNATOR_PATH_IRI = `${SFLO_NAMESPACE}designatorPath`;
const SFLO_DIGITAL_ARTIFACT_IRI = `${SFLO_NAMESPACE}DigitalArtifact`;
const SFLO_HAS_ARTIFACT_HISTORY_IRI = `${SFLO_NAMESPACE}hasArtifactHistory`;
const SFLO_HAS_HISTORICAL_STATE_IRI = `${SFLO_NAMESPACE}hasHistoricalState`;
const SFLO_HAS_KNOP_INVENTORY_IRI = `${SFLO_NAMESPACE}hasKnopInventory`;
const SFLO_HAS_KNOP_METADATA_IRI = `${SFLO_NAMESPACE}hasKnopMetadata`;
const SFLO_HAS_KNOP_SOURCE_REGISTRY_IRI =
  `${SFLO_NAMESPACE}hasKnopSourceRegistry`;
const SFLO_HAS_REFERENCE_CATALOG_IRI = `${SFLO_NAMESPACE}hasReferenceCatalog`;
const SFLO_HAS_RESOURCE_PAGE_IRI = `${SFLO_NAMESPACE}hasResourcePage`;
const SFLO_HAS_SOURCE_BINDING_IRI = `${SFLO_NAMESPACE}hasSourceBinding`;
const SFLO_HAS_WORKING_KNOP_INVENTORY_FILE_IRI =
  `${SFLO_NAMESPACE}hasWorkingKnopInventoryFile`;
const SFLO_HAS_WORKING_LOCATED_FILE_IRI =
  `${SFLO_NAMESPACE}hasWorkingLocatedFile`;
const SFLO_KNOP_IRI = `${SFLO_NAMESPACE}Knop`;
const SFLO_KNOP_INVENTORY_IRI = `${SFLO_NAMESPACE}KnopInventory`;
const SFLO_KNOP_METADATA_IRI = `${SFLO_NAMESPACE}KnopMetadata`;
const SFLO_KNOP_SOURCE_REGISTRY_IRI = `${SFLO_NAMESPACE}KnopSourceRegistry`;
const SFLO_LATEST_HISTORICAL_STATE_IRI =
  `${SFLO_NAMESPACE}latestHistoricalState`;
const SFLO_LOCATED_FILE_IRI = `${SFLO_NAMESPACE}LocatedFile`;
const SFLO_MESH_INVENTORY_IRI = `${SFLO_NAMESPACE}MeshInventory`;
const SFLO_NEXT_HISTORY_ORDINAL_IRI = `${SFLO_NAMESPACE}nextHistoryOrdinal`;
const SFLO_NEXT_STATE_ORDINAL_IRI = `${SFLO_NAMESPACE}nextStateOrdinal`;
const SFLO_PAYLOAD_ARTIFACT_IRI = `${SFLO_NAMESPACE}PayloadArtifact`;
const SFLO_RDF_DOCUMENT_IRI = `${SFLO_NAMESPACE}RdfDocument`;
const SFLO_REFERENCE_CATALOG_IRI = `${SFLO_NAMESPACE}ReferenceCatalog`;

type NamedNodeFact = readonly [string, string, string];
type LiteralFact = readonly [string, string, string, string?];

export interface MeshInventoryProgressionDiagnostics {
  findingCode: MeshValidationFindingCode;
  missingMetadata: string;
  invalidMetadataTurtle: string;
  missingCurrentHistory: string;
  conflictingCurrentHistory: string;
  missingNextHistoryOrdinal: string;
  conflictingNextHistoryOrdinal: string;
  invalidNextHistoryOrdinal: string;
  missingLatestState(historyPath: string): string;
  conflictingLatestState(historyPath: string): string;
  missingNextStateOrdinal(historyPath: string): string;
  conflictingNextStateOrdinal(historyPath: string): string;
  invalidNextStateOrdinal(historyPath: string): string;
  zeroNextStateOrdinal(historyPath: string): string;
  invalidNextStateSegmentHint(historyPath: string): string;
}

export function resolveMeshInventoryProgressionFromMetadata(
  meshBase: string,
  currentMeshMetadataTurtle: string | undefined,
  errorMessage: string,
  diagnostics?: MeshInventoryProgressionDiagnostics,
): MeshInventoryProgression {
  if (currentMeshMetadataTurtle === undefined) {
    throw new WeaveInputError(
      diagnostics?.missingMetadata ?? errorMessage,
      diagnostics?.findingCode,
    );
  }

  const quads = parseWeaveShapeQuads(
    meshBase,
    currentMeshMetadataTurtle,
    diagnostics?.invalidMetadataTurtle ?? errorMessage,
    diagnostics?.findingCode,
  );
  const meshInventoryIri = toAbsoluteIri(meshBase, "_mesh/_inventory");
  const historyIri = diagnostics === undefined
    ? requireSingleNamedNodeObject(
      quads,
      meshInventoryIri,
      SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
      errorMessage,
    )
    : requireSingleNamedNodeObjectWithDiagnostics(
      quads,
      meshInventoryIri,
      SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
      {
        missingMessage: diagnostics.missingCurrentHistory,
        conflictMessage: diagnostics.conflictingCurrentHistory,
        findingCode: diagnostics.findingCode,
      },
    );
  const nextHistoryOrdinal = diagnostics === undefined
    ? requireSingleNonNegativeIntegerLiteral(
      quads,
      meshInventoryIri,
      SFLO_NEXT_HISTORY_ORDINAL_IRI,
      errorMessage,
    )
    : requireSingleNonNegativeIntegerLiteralWithDiagnostics(
      quads,
      meshInventoryIri,
      SFLO_NEXT_HISTORY_ORDINAL_IRI,
      {
        missingMessage: diagnostics.missingNextHistoryOrdinal,
        conflictMessage: diagnostics.conflictingNextHistoryOrdinal,
        invalidMessage: diagnostics.invalidNextHistoryOrdinal,
        findingCode: diagnostics.findingCode,
      },
    );
  const historyPath = toMeshRelativePath(
    meshBase,
    historyIri,
    "the current MeshInventory history",
  );
  const latestStateIri = diagnostics === undefined
    ? requireSingleNamedNodeObject(
      quads,
      historyIri,
      SFLO_LATEST_HISTORICAL_STATE_IRI,
      errorMessage,
    )
    : requireSingleNamedNodeObjectWithDiagnostics(
      quads,
      historyIri,
      SFLO_LATEST_HISTORICAL_STATE_IRI,
      {
        missingMessage: diagnostics.missingLatestState(historyPath),
        conflictMessage: diagnostics.conflictingLatestState(historyPath),
        findingCode: diagnostics.findingCode,
      },
    );
  const latestStatePath = toMeshRelativePath(
    meshBase,
    latestStateIri,
    "the latest MeshInventory historical state",
  );
  const nextStateOrdinal = diagnostics === undefined
    ? requireSingleNonNegativeIntegerLiteral(
      quads,
      historyIri,
      SFLO_NEXT_STATE_ORDINAL_IRI,
      errorMessage,
    )
    : requireSingleNonNegativeIntegerLiteralWithDiagnostics(
      quads,
      historyIri,
      SFLO_NEXT_STATE_ORDINAL_IRI,
      {
        missingMessage: diagnostics.missingNextStateOrdinal(historyPath),
        conflictMessage: diagnostics.conflictingNextStateOrdinal(historyPath),
        invalidMessage: diagnostics.invalidNextStateOrdinal(historyPath),
        findingCode: diagnostics.findingCode,
      },
    );
  if (nextStateOrdinal === 0) {
    throw new WeaveInputError(
      diagnostics?.zeroNextStateOrdinal(historyPath) ?? errorMessage,
      diagnostics?.findingCode,
    );
  }
  const latestStateOrdinal = nextStateOrdinal - 1;
  const nextStateSegmentHint = resolveOptionalSegmentHint(
    quads,
    historyIri,
    SFCFG_HAS_NEXT_STATE_SEGMENT_HINT_IRI,
    diagnostics?.invalidNextStateSegmentHint(historyPath) ?? errorMessage,
    diagnostics?.findingCode,
  );
  const nextStatePath = `${historyPath}/${
    nextStateSegmentHint ?? toStateSegment(nextStateOrdinal)
  }`;

  return {
    historyPath,
    nextHistoryOrdinal,
    latestStatePath,
    latestStateOrdinal,
    latestManifestationPath: `${latestStatePath}/ttl`,
    nextStatePath,
    nextStateOrdinal,
  };
}

export function assertCurrentMeshInventoryShapeForFirstReferenceCatalogWeave(
  meshBase: string,
  currentMeshInventoryTurtle: string,
  currentMeshMetadataTurtle: string | undefined,
  designatorPath: string,
): void {
  const knopPath = toKnopPath(designatorPath);
  const errorMessage =
    "The current local weave slice only supports the settled 08 pre-weave reference-catalog mesh inventory shape.";
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentMeshInventoryTurtle,
    errorMessage,
  );

  assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_MESH_INVENTORY_IRI],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [knopPath, RDF_TYPE_IRI, SFLO_KNOP_IRI],
  ]);

  const historyIri = requireOptionalNamedNodeObject(
    quads,
    toAbsoluteIri(meshBase, "_mesh/_inventory"),
    SFLO_HAS_ARTIFACT_HISTORY_IRI,
    errorMessage,
  );
  if (historyIri === undefined) {
    return;
  }

  const progression = resolveMeshInventoryProgressionFromMetadata(
    meshBase,
    currentMeshMetadataTurtle,
    errorMessage,
  );
  const historyPath = toMeshRelativePath(
    meshBase,
    historyIri,
    "the current MeshInventory history",
  );
  if (
    progression.historyPath !== historyPath ||
    toHistoryPathFromStatePath(progression.latestStatePath) !==
      progression.historyPath ||
    progression.nextStateOrdinal !== progression.latestStateOrdinal + 1
  ) {
    throw new WeaveInputError(errorMessage);
  }

  assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
    [
      "_mesh/_inventory",
      SFLO_HAS_ARTIFACT_HISTORY_IRI,
      progression.historyPath,
    ],
    [
      progression.historyPath,
      SFLO_HAS_HISTORICAL_STATE_IRI,
      progression.latestStatePath,
    ],
  ]);
}

export function assertCurrentMeshInventoryShapeForFirstExtractedKnopWeave(
  meshBase: string,
  currentMeshInventoryTurtle: string,
  meshInventoryProgression: MeshInventoryProgression | undefined,
  designatorPath: string,
  sourcePayloadDesignatorPath: string,
  sourcePayloadArtifact: Pick<
    ReferenceTargetSourcePayloadArtifact,
    "workingLocalRelativePath" | "repositorySourceFloatingLocator"
  >,
): void {
  const errorMessage =
    `The current local weave slice only supports the settled extracted-knop pre-weave mesh inventory shape for ${designatorPath}.`;
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentMeshInventoryTurtle,
    errorMessage,
  );
  assertCurrentMeshInventoryQuadsForFirstExtractedKnopWeave(
    quads,
    meshBase,
    meshInventoryProgression,
    designatorPath,
    sourcePayloadDesignatorPath,
    sourcePayloadArtifact,
    errorMessage,
  );
}

export function assertCurrentMeshInventoryShapeForFirstExtractedKnopBatchWeave(
  meshBase: string,
  currentMeshInventoryTurtle: string,
  meshInventoryProgression: MeshInventoryProgression | undefined,
  targets: readonly {
    designatorPath: string;
    sourcePayloadDesignatorPath: string;
    sourcePayloadArtifact: Pick<
      ReferenceTargetSourcePayloadArtifact,
      "workingLocalRelativePath" | "repositorySourceFloatingLocator"
    >;
  }[],
): void {
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentMeshInventoryTurtle,
    "Could not parse the current MeshInventory for an untargeted extracted-Knop batch weave.",
  );
  for (const target of targets) {
    const errorMessage =
      `The current local weave slice only supports the settled extracted-knop pre-weave mesh inventory shape for ${target.designatorPath}.`;
    assertCurrentMeshInventoryQuadsForFirstExtractedKnopWeave(
      quads,
      meshBase,
      meshInventoryProgression,
      target.designatorPath,
      target.sourcePayloadDesignatorPath,
      target.sourcePayloadArtifact,
      errorMessage,
    );
  }
}

function assertCurrentMeshInventoryQuadsForFirstExtractedKnopWeave(
  quads: readonly Quad[],
  meshBase: string,
  meshInventoryProgression: MeshInventoryProgression | undefined,
  designatorPath: string,
  sourcePayloadDesignatorPath: string,
  sourcePayloadArtifact: Pick<
    ReferenceTargetSourcePayloadArtifact,
    "workingLocalRelativePath" | "repositorySourceFloatingLocator"
  >,
  errorMessage: string,
): void {
  const sourceKnopPath = toKnopPath(sourcePayloadDesignatorPath);
  const knopPath = toKnopPath(designatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  const sourcePayloadPagePath = toDesignatorResourcePagePath(
    sourcePayloadDesignatorPath,
  );

  assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_MESH_INVENTORY_IRI],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    ...(meshInventoryProgression === undefined ? [] : [
      [
        "_mesh/_inventory",
        SFLO_HAS_ARTIFACT_HISTORY_IRI,
        meshInventoryProgression.historyPath,
      ],
      [
        meshInventoryProgression.historyPath,
        SFLO_HAS_HISTORICAL_STATE_IRI,
        meshInventoryProgression.latestStatePath,
      ],
    ] as const),
    [sourcePayloadDesignatorPath, RDF_TYPE_IRI, SFLO_PAYLOAD_ARTIFACT_IRI],
    [sourcePayloadDesignatorPath, RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    [sourcePayloadDesignatorPath, RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [
      sourcePayloadDesignatorPath,
      SFLO_HAS_RESOURCE_PAGE_IRI,
      sourcePayloadPagePath,
    ],
    [sourceKnopPath, RDF_TYPE_IRI, SFLO_KNOP_IRI],
    [
      sourceKnopPath,
      SFLO_HAS_WORKING_KNOP_INVENTORY_FILE_IRI,
      `${sourceKnopPath}/_inventory/inventory.ttl`,
    ],
    [
      sourceKnopPath,
      SFLO_HAS_RESOURCE_PAGE_IRI,
      `${sourceKnopPath}/index.html`,
    ],
    [knopPath, RDF_TYPE_IRI, SFLO_KNOP_IRI],
  ]);
  if (meshInventoryProgression !== undefined) {
    if (
      meshInventoryProgression.historyPath !== "_mesh/_inventory/_history001" ||
      toHistoryPathFromStatePath(meshInventoryProgression.latestStatePath) !==
        meshInventoryProgression.historyPath ||
      meshInventoryProgression.nextStateOrdinal !==
        meshInventoryProgression.latestStateOrdinal + 1
    ) {
      throw new WeaveInputError(errorMessage);
    }
  }
  assertHasCurrentSourceLocator(
    quads,
    meshBase,
    errorMessage,
    sourcePayloadDesignatorPath,
    sourcePayloadArtifact,
  );

  if (
    hasNamedNodeFact(
      quads,
      meshBase,
      designatorPath,
      SFLO_HAS_RESOURCE_PAGE_IRI,
      designatorPagePath,
    ) ||
    hasNamedNodeFact(
      quads,
      meshBase,
      knopPath,
      SFLO_HAS_RESOURCE_PAGE_IRI,
      `${knopPath}/index.html`,
    )
  ) {
    throw new WeaveInputError(
      `Mesh inventory already exposes current woven pages for ${designatorPath}.`,
    );
  }
}

export function assertCurrentKnopInventoryShapeForFirstExtractedKnopWeave(
  meshBase: string,
  currentKnopInventoryTurtle: string,
  designatorPath: string,
): void {
  const knopPath = toKnopPath(designatorPath);
  const sourceRegistryPath = `${knopPath}/_sources`;
  const sourcesFilePath = `${sourceRegistryPath}/sources.ttl`;
  const extractionSourcePath = `${sourceRegistryPath}#extraction-source`;
  const errorMessage =
    `The current local weave slice only supports the settled extracted-knop inventory shape for ${designatorPath}.`;
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentKnopInventoryTurtle,
    errorMessage,
  );

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
    [`${knopPath}/_inventory`, RDF_TYPE_IRI, SFLO_KNOP_INVENTORY_IRI],
    [`${knopPath}/_inventory`, RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    [`${knopPath}/_inventory`, RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [knopPath, SFLO_HAS_KNOP_SOURCE_REGISTRY_IRI, sourceRegistryPath],
    [knopPath, SFLO_HAS_EXTRACTION_SOURCE_IRI, extractionSourcePath],
    [sourceRegistryPath, RDF_TYPE_IRI, SFLO_KNOP_SOURCE_REGISTRY_IRI],
    [
      sourceRegistryPath,
      SFLO_HAS_WORKING_LOCATED_FILE_IRI,
      sourcesFilePath,
    ],
    [sourcesFilePath, RDF_TYPE_IRI, SFLO_LOCATED_FILE_IRI],
    [sourcesFilePath, RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
  ]);
  assertHasCurrentWorkingFileLocator(
    quads,
    meshBase,
    errorMessage,
    `${knopPath}/_meta`,
    `${knopPath}/_meta/meta.ttl`,
  );
  assertHasCurrentWorkingFileLocator(
    quads,
    meshBase,
    errorMessage,
    `${knopPath}/_inventory`,
    `${knopPath}/_inventory/inventory.ttl`,
  );

  if (hasPredicateFact(quads, SFLO_HAS_ARTIFACT_HISTORY_IRI)) {
    throw new WeaveInputError(
      `Extracted KnopInventory already has explicit woven history for ${designatorPath}.`,
    );
  }
}

export function assertCurrentSourceRegistryShapeForFirstExtractedKnopWeave(
  meshBase: string,
  currentSourceRegistryTurtle: string,
  designatorPath: string,
  sourceDesignatorPath: string,
  sourceStatePath: string,
): void {
  const sourceRegistryPath = `${toKnopPath(designatorPath)}/_sources`;
  const extractionSourcePath = `${sourceRegistryPath}#extraction-source`;
  const errorMessage =
    `The current local weave slice only supports the settled extracted-knop source registry shape for ${designatorPath}.`;
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentSourceRegistryTurtle,
    errorMessage,
  );

  assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
    [sourceRegistryPath, RDF_TYPE_IRI, SFLO_KNOP_SOURCE_REGISTRY_IRI],
    [sourceRegistryPath, SFLO_HAS_SOURCE_BINDING_IRI, extractionSourcePath],
    [extractionSourcePath, RDF_TYPE_IRI, SFLO_EXTRACTION_SOURCE_IRI],
    [extractionSourcePath, SFLO_TARGET_ARTIFACT_IRI, sourceDesignatorPath],
  ]);
  const hasWorkingResolutionMode = hasNamedNodeFact(
    quads,
    meshBase,
    extractionSourcePath,
    SFLO_HAS_ARTIFACT_RESOLUTION_MODE_IRI,
    SFLO_ARTIFACT_RESOLUTION_MODE_WORKING_IRI,
  );
  const hasExactTargetState = hasNamedNodeFact(
    quads,
    meshBase,
    extractionSourcePath,
    SFLO_TARGET_HISTORICAL_STATE_IRI,
    sourceStatePath,
  );
  if (!hasWorkingResolutionMode && !hasExactTargetState) {
    throw new WeaveInputError(errorMessage);
  }
}

export function assertReferenceTargetSourcePayloadShapeForFirstExtractedKnopWeave(
  payloadArtifact: ReferenceTargetSourcePayloadArtifact,
): void {
  if (!payloadArtifact.workingLocalRelativePath.endsWith(".ttl")) {
    throw new WeaveInputError(
      `The current local extracted weave slice only supports Turtle source payload files; found ${payloadArtifact.workingLocalRelativePath}.`,
    );
  }

  const expectedPrefix = payloadArtifact.designatorPath.length === 0
    ? undefined
    : `${payloadArtifact.designatorPath}/`;
  if (
    payloadArtifact.latestHistoricalStatePath.length === 0 ||
    (expectedPrefix !== undefined &&
      !payloadArtifact.latestHistoricalStatePath.startsWith(expectedPrefix))
  ) {
    throw new WeaveInputError(
      `The current local extracted weave slice only supports source payloads with an explicit current historical state.`,
    );
  }
}

export function assertCurrentKnopMetadataShape(
  meshBase: string,
  currentKnopMetadataTurtle: string,
  designatorPath: string,
  knopPath: string,
): void {
  const metadataPath = `${knopPath}/_meta/meta.ttl`;
  const designator = formatDesignatorPathForDisplay(designatorPath);
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentKnopMetadataTurtle,
    `KnopMetadata file ${metadataPath} for designator path ${designator} is not valid Turtle. Repair the file before retrying weave.`,
    "malformed-knop-metadata",
  );

  assertHasNamedNodeFacts(
    quads,
    meshBase,
    `KnopMetadata file ${metadataPath} for designator path ${designator} is missing rdf:type sflo:Knop on subject <${knopPath}>. Add that fact before retrying weave.`,
    [[knopPath, RDF_TYPE_IRI, SFLO_KNOP_IRI]],
    "malformed-knop-metadata",
  );
  assertHasNamedNodeFacts(
    quads,
    meshBase,
    `KnopMetadata file ${metadataPath} for designator path ${designator} is missing sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> on subject <${knopPath}>. Add that fact before retrying weave.`,
    [
      [
        knopPath,
        SFLO_HAS_WORKING_KNOP_INVENTORY_FILE_IRI,
        `${knopPath}/_inventory/inventory.ttl`,
      ],
    ],
    "malformed-knop-metadata",
  );
  assertHasLiteralFacts(
    quads,
    meshBase,
    `KnopMetadata file ${metadataPath} for designator path ${designator} is missing sflo:designatorPath "${designatorPath}" on subject <${knopPath}>. Add that exact literal before retrying weave.`,
    [
      [knopPath, SFLO_DESIGNATOR_PATH_IRI, designatorPath],
    ],
    "malformed-knop-metadata",
  );

  if (hasPredicateFact(quads, SFLO_HAS_ARTIFACT_HISTORY_IRI)) {
    throw new WeaveInputError(
      `KnopMetadata already has explicit history for ${designatorPath}.`,
    );
  }
}

export function assertCurrentKnopInventoryBaseShape(
  meshBase: string,
  currentKnopInventoryTurtle: string,
  designatorPath: string,
  knopPath: string,
): void {
  const inventoryPath = `${knopPath}/_inventory/inventory.ttl`;
  const designator = formatDesignatorPathForDisplay(designatorPath);
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentKnopInventoryTurtle,
    `KnopInventory file ${inventoryPath} for designator path ${designator} is not valid Turtle. Repair the file before retrying weave.`,
    "malformed-inventory",
  );

  assertHasNamedNodeFacts(
    quads,
    meshBase,
    `KnopInventory file ${inventoryPath} for designator path ${designator} is missing rdf:type sflo:Knop on subject <${knopPath}>. Add that fact before retrying weave.`,
    [[knopPath, RDF_TYPE_IRI, SFLO_KNOP_IRI]],
    "malformed-inventory",
  );
  assertHasNamedNodeFacts(
    quads,
    meshBase,
    `KnopInventory file ${inventoryPath} for designator path ${designator} is missing sflo:hasKnopMetadata <${knopPath}/_meta> on subject <${knopPath}>. Add that fact before retrying weave.`,
    [[knopPath, SFLO_HAS_KNOP_METADATA_IRI, `${knopPath}/_meta`]],
    "malformed-inventory",
  );
  assertHasNamedNodeFacts(
    quads,
    meshBase,
    `KnopInventory file ${inventoryPath} for designator path ${designator} is missing sflo:hasKnopInventory <${knopPath}/_inventory> on subject <${knopPath}>. Add that fact before retrying weave.`,
    [[knopPath, SFLO_HAS_KNOP_INVENTORY_IRI, `${knopPath}/_inventory`]],
    "malformed-inventory",
  );
  assertHasNamedNodeFacts(
    quads,
    meshBase,
    `KnopInventory file ${inventoryPath} for designator path ${designator} is missing sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> on subject <${knopPath}>. Add that fact before retrying weave.`,
    [
      [
        knopPath,
        SFLO_HAS_WORKING_KNOP_INVENTORY_FILE_IRI,
        `${knopPath}/_inventory/inventory.ttl`,
      ],
    ],
    "malformed-inventory",
  );
}

export function assertCurrentKnopInventoryWithoutHistory(
  meshBase: string,
  currentKnopInventoryTurtle: string,
  knopPath: string,
): void {
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentKnopInventoryTurtle,
    `Could not parse the current KnopInventory while checking current history state for ${knopPath}.`,
  );

  if (
    hasSubjectPredicateFact(
      quads,
      meshBase,
      `${knopPath}/_inventory`,
      SFLO_HAS_ARTIFACT_HISTORY_IRI,
    )
  ) {
    throw new WeaveInputError(
      `KnopInventory already has explicit history for ${knopPath}.`,
    );
  }
}

export function assertCurrentPayloadArtifactShape(
  meshBase: string,
  currentKnopInventoryTurtle: string,
  designatorPath: string,
  payloadArtifact: PayloadWorkingArtifact,
): void {
  const legacyParseErrorMessage =
    `The current local weave slice only supports the settled integrated payload shape for ${designatorPath}.`;
  const designator = formatDesignatorPathForDisplay(designatorPath);
  const inventoryPath = `${
    toKnopPath(designatorPath)
  }/_inventory/inventory.ttl`;
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentKnopInventoryTurtle,
    legacyParseErrorMessage,
  );

  assertHasNamedNodeFacts(
    quads,
    meshBase,
    `KnopInventory file ${inventoryPath} for designator path ${designator} is missing rdf:type sflo:PayloadArtifact on payload subject <${designatorPath}>. Add that fact before retrying weave.`,
    [[designatorPath, RDF_TYPE_IRI, SFLO_PAYLOAD_ARTIFACT_IRI]],
    "malformed-inventory",
  );
  assertHasNamedNodeFacts(
    quads,
    meshBase,
    `KnopInventory file ${inventoryPath} for designator path ${designator} is missing rdf:type sflo:DigitalArtifact on payload subject <${designatorPath}>. Add that fact before retrying weave.`,
    [[designatorPath, RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI]],
    "malformed-inventory",
  );
  assertHasCurrentPayloadSourceLocator(
    quads,
    meshBase,
    `KnopInventory file ${inventoryPath} for designator path ${designator} does not identify exactly one current working source for payload subject <${designatorPath}> that matches the loaded payload path ${payloadArtifact.workingLocalRelativePath}. Correct the payload locator facts or reload the candidate before retrying weave.`,
    designatorPath,
    payloadArtifact,
    "malformed-inventory",
  );

  const existingHistoryPaths = resolveNamedNodeObjectPaths(
    quads,
    meshBase,
    designatorPath,
    SFLO_HAS_ARTIFACT_HISTORY_IRI,
    legacyParseErrorMessage,
  );
  const currentHistoryPath = resolveOptionalNamedNodePath(
    quads,
    meshBase,
    designatorPath,
    SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
    legacyParseErrorMessage,
  );
  const hasExistingDeclaredHistory = existingHistoryPaths.some((path) =>
    isDeclaredArtifactHistory(quads, meshBase, path)
  );
  if (
    hasExistingDeclaredHistory ||
    (currentHistoryPath !== undefined &&
      isDeclaredArtifactHistory(quads, meshBase, currentHistoryPath))
  ) {
    throw new WeaveInputError(
      `Payload artifact already has explicit history for ${designatorPath}.`,
    );
  }
}

export function currentPayloadArtifactIsRdfDocument(
  meshBase: string,
  currentKnopInventoryTurtle: string,
  designatorPath: string,
): boolean {
  const errorMessage =
    `The current local weave slice only supports the settled integrated payload shape for ${designatorPath}.`;
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentKnopInventoryTurtle,
    errorMessage,
  );

  return hasNamedNodeFact(
    quads,
    meshBase,
    designatorPath,
    RDF_TYPE_IRI,
    SFLO_RDF_DOCUMENT_IRI,
  );
}

export function assertCurrentKnopInventoryShapeForFirstPageDefinitionWeave(
  meshBase: string,
  currentKnopInventoryTurtle: string,
  designatorPath: string,
  pageDefinitionArtifact: ResourcePageDefinitionWorkingArtifact,
  knopInventoryProgression: MeshInventoryProgression,
): void {
  const knopPath = toKnopPath(designatorPath);
  const errorMessage =
    `The current local weave slice only supports the settled page-definition inventory shape for ${designatorPath}.`;
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentKnopInventoryTurtle,
    errorMessage,
  );

  assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
    [knopPath, RDF_TYPE_IRI, SFLO_KNOP_IRI],
    [knopPath, SFLO_HAS_KNOP_METADATA_IRI, `${knopPath}/_meta`],
    [knopPath, SFLO_HAS_KNOP_INVENTORY_IRI, `${knopPath}/_inventory`],
    [knopPath, SFLO_HAS_RESOURCE_PAGE_DEFINITION_IRI, `${knopPath}/_page`],
    [
      knopPath,
      SFLO_HAS_WORKING_KNOP_INVENTORY_FILE_IRI,
      `${knopPath}/_inventory/inventory.ttl`,
    ],
    [`${knopPath}/_inventory`, RDF_TYPE_IRI, SFLO_KNOP_INVENTORY_IRI],
    [`${knopPath}/_inventory`, RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    [`${knopPath}/_inventory`, RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [
      `${knopPath}/_inventory`,
      SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
      `${knopPath}/_inventory/_history001`,
    ],
    [`${knopPath}/_page`, RDF_TYPE_IRI, SFLO_RESOURCE_PAGE_DEFINITION_IRI],
    [`${knopPath}/_page`, RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    [`${knopPath}/_page`, RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
  ]);
  assertHasCurrentWorkingFileLocator(
    quads,
    meshBase,
    errorMessage,
    `${knopPath}/_page`,
    pageDefinitionArtifact.workingLocalRelativePath,
  );
  assertHasLiteralFacts(quads, meshBase, errorMessage, [[
    `${knopPath}/_inventory/_history001`,
    SFLO_NEXT_STATE_ORDINAL_IRI,
    String(knopInventoryProgression.nextStateOrdinal),
    XSD_NON_NEGATIVE_INTEGER_IRI,
  ]]);

  if (
    !hasNamedNodeFact(
      quads,
      meshBase,
      `${knopPath}/_inventory/_history001`,
      SFLO_LATEST_HISTORICAL_STATE_IRI,
      knopInventoryProgression.latestStatePath,
    )
  ) {
    throw new WeaveInputError(
      `KnopInventory is not at the expected pre-page-definition history state for ${designatorPath}.`,
    );
  }

  if (
    resolveOptionalNamedNodePath(
      quads,
      meshBase,
      `${knopPath}/_page`,
      SFLO_HAS_ARTIFACT_HISTORY_IRI,
      errorMessage,
    ) ||
    resolveOptionalNamedNodePath(
      quads,
      meshBase,
      `${knopPath}/_page`,
      SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
      errorMessage,
    )
  ) {
    throw new WeaveInputError(
      `ResourcePageDefinition already has explicit history for ${designatorPath}.`,
    );
  }

  if (pageDefinitionArtifact.assetBundlePath) {
    assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
      [
        knopPath,
        SFLO_HAS_KNOP_ASSET_BUNDLE_IRI,
        pageDefinitionArtifact.assetBundlePath,
      ],
      [
        pageDefinitionArtifact.assetBundlePath,
        RDF_TYPE_IRI,
        SFLO_KNOP_ASSET_BUNDLE_IRI,
      ],
    ]);
  }
}

export function assertCurrentKnopInventoryShapeForSubsequentPageDefinitionWeave(
  meshBase: string,
  currentKnopInventoryTurtle: string,
  designatorPath: string,
  pageDefinitionArtifact: ResourcePageDefinitionWorkingArtifact,
  progression: PageDefinitionWeaveProgression,
  knopInventoryProgression: MeshInventoryProgression,
): void {
  const knopPath = toKnopPath(designatorPath);
  const errorMessage =
    `The current local weave slice only supports the settled later page-definition inventory shape for ${designatorPath}.`;
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentKnopInventoryTurtle,
    errorMessage,
  );

  assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
    [knopPath, RDF_TYPE_IRI, SFLO_KNOP_IRI],
    [knopPath, SFLO_HAS_KNOP_METADATA_IRI, `${knopPath}/_meta`],
    [knopPath, SFLO_HAS_KNOP_INVENTORY_IRI, `${knopPath}/_inventory`],
    [knopPath, SFLO_HAS_RESOURCE_PAGE_DEFINITION_IRI, `${knopPath}/_page`],
    [
      `${knopPath}/_inventory`,
      SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
      knopInventoryProgression.historyPath,
    ],
    [
      `${knopPath}/_inventory`,
      SFLO_HAS_WORKING_LOCATED_FILE_IRI,
      `${knopPath}/_inventory/inventory.ttl`,
    ],
    [
      `${knopPath}/_page`,
      SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
      progression.historyPath,
    ],
    [
      progression.historyPath,
      SFLO_LATEST_HISTORICAL_STATE_IRI,
      progression.latestStatePath!,
    ],
  ]);
  assertHasCurrentWorkingFileLocator(
    quads,
    meshBase,
    errorMessage,
    `${knopPath}/_page`,
    pageDefinitionArtifact.workingLocalRelativePath,
  );
  assertHasLiteralFacts(quads, meshBase, errorMessage, [
    [
      progression.historyPath,
      SFLO_NEXT_STATE_ORDINAL_IRI,
      String(progression.nextStateOrdinal),
      XSD_NON_NEGATIVE_INTEGER_IRI,
    ],
    [
      knopInventoryProgression.historyPath,
      SFLO_NEXT_STATE_ORDINAL_IRI,
      String(knopInventoryProgression.nextStateOrdinal),
      XSD_NON_NEGATIVE_INTEGER_IRI,
    ],
  ]);

  if (
    hasNamedNodeFact(
      quads,
      meshBase,
      progression.historyPath,
      SFLO_HAS_HISTORICAL_STATE_IRI,
      progression.nextStatePath,
    ) ||
    hasNamedNodeFact(
      quads,
      meshBase,
      knopInventoryProgression.historyPath,
      SFLO_HAS_HISTORICAL_STATE_IRI,
      knopInventoryProgression.nextStatePath,
    )
  ) {
    throw new WeaveInputError(
      `ResourcePageDefinition already has a later explicit historical state for ${designatorPath}.`,
    );
  }

  if (pageDefinitionArtifact.assetBundlePath) {
    assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
      [
        knopPath,
        SFLO_HAS_KNOP_ASSET_BUNDLE_IRI,
        pageDefinitionArtifact.assetBundlePath,
      ],
      [
        pageDefinitionArtifact.assetBundlePath,
        RDF_TYPE_IRI,
        SFLO_KNOP_ASSET_BUNDLE_IRI,
      ],
    ]);
  }
}

export function assertCurrentKnopInventoryShapeForFirstReferenceCatalogWeave(
  meshBase: string,
  currentKnopInventoryTurtle: string,
  designatorPath: string,
  workingLocalRelativePath: string,
  options?: { versionKnopInventory?: boolean },
): void {
  const knopPath = toKnopPath(designatorPath);
  const referenceCatalogPath = `${knopPath}/_references`;
  const versionKnopInventory = options?.versionKnopInventory ?? true;
  const errorMessage =
    `The current local weave slice only supports the settled first ReferenceCatalog weave shape for ${designatorPath}.`;
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentKnopInventoryTurtle,
    errorMessage,
  );

  assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
    [knopPath, RDF_TYPE_IRI, SFLO_KNOP_IRI],
    [knopPath, SFLO_HAS_REFERENCE_CATALOG_IRI, referenceCatalogPath],
    [`${knopPath}/_inventory`, RDF_TYPE_IRI, SFLO_KNOP_INVENTORY_IRI],
    [`${knopPath}/_inventory`, RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    [`${knopPath}/_inventory`, RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [referenceCatalogPath, RDF_TYPE_IRI, SFLO_REFERENCE_CATALOG_IRI],
    [referenceCatalogPath, RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    [referenceCatalogPath, RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
  ]);
  assertHasCurrentWorkingFileLocator(
    quads,
    meshBase,
    errorMessage,
    referenceCatalogPath,
    workingLocalRelativePath,
  );

  if (versionKnopInventory) {
    assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
      [
        `${knopPath}/_inventory`,
        SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
        `${knopPath}/_inventory/_history001`,
      ],
      [
        `${knopPath}/_inventory/_history001`,
        SFLO_LATEST_HISTORICAL_STATE_IRI,
        `${knopPath}/_inventory/_history001/_s0001`,
      ],
    ]);
    assertHasLiteralFacts(quads, meshBase, errorMessage, [
      [
        `${knopPath}/_inventory/_history001`,
        SFLO_NEXT_STATE_ORDINAL_IRI,
        "2",
        XSD_NON_NEGATIVE_INTEGER_IRI,
      ],
    ]);
  } else {
    assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
      [knopPath, SFLO_HAS_RESOURCE_PAGE_IRI, `${knopPath}/index.html`],
      [
        `${knopPath}/_inventory`,
        SFLO_HAS_RESOURCE_PAGE_IRI,
        `${knopPath}/_inventory/index.html`,
      ],
    ]);
  }

  if (
    hasNamedNodeFact(
      quads,
      meshBase,
      referenceCatalogPath,
      SFLO_HAS_ARTIFACT_HISTORY_IRI,
      `${referenceCatalogPath}/_history001`,
    )
  ) {
    throw new WeaveInputError(
      `ReferenceCatalog already has explicit history for ${designatorPath}.`,
    );
  }
  if (
    hasNamedNodeFact(
      quads,
      meshBase,
      referenceCatalogPath,
      SFLO_HAS_RESOURCE_PAGE_IRI,
      `${referenceCatalogPath}/index.html`,
    )
  ) {
    throw new WeaveInputError(
      `ReferenceCatalog already has a ResourcePage for ${designatorPath}.`,
    );
  }
}

export function assertHasNamedNodeFacts(
  quads: readonly Quad[],
  meshBase: string,
  errorMessage: string,
  facts: readonly NamedNodeFact[],
  findingCode: MeshValidationFindingCode = "unsupported-mesh-shape",
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
      throw new WeaveInputError(errorMessage, findingCode);
    }
  }
}

export function assertHasLiteralFacts(
  quads: readonly Quad[],
  meshBase: string,
  errorMessage: string,
  facts: readonly LiteralFact[],
  findingCode: MeshValidationFindingCode = "unsupported-mesh-shape",
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
      throw new WeaveInputError(errorMessage, findingCode);
    }
  }
}

function toHistoryPathFromStatePath(statePath: string): string {
  return statePath.slice(0, statePath.lastIndexOf("/"));
}

function toStateSegment(stateOrdinal: number): string {
  return `_s${String(stateOrdinal).padStart(4, "0")}`;
}
