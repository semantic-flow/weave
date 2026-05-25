import type { Quad } from "n3";
import {
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
import { WeaveInputError } from "./errors.ts";
import {
  requirePayloadCurrentStatePath,
  requirePayloadHistoryPath,
} from "./payload_version_layout.ts";
import type {
  MeshInventoryProgression,
  PageDefinitionWeaveProgression,
} from "./progression_models.ts";
import {
  hasLiteralFact,
  hasNamedNodeFact,
  hasPredicateFact,
  hasSubjectPredicateFact,
  parseWeaveShapeQuads,
  requireOptionalNamedNodeObject,
  requireSingleNamedNodeObject,
  requireSingleNonNegativeIntegerLiteral,
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
import {
  shouldMaterializeSupportHistory,
  type SupportArtifactHistoryPolicy,
} from "./support_history_policy.ts";

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
const SFLO_HAS_REQUESTED_TARGET_STATE_IRI =
  `${SFLO_NAMESPACE}hasRequestedTargetState`;
const SFLO_HAS_TARGET_ARTIFACT_IRI = `${SFLO_NAMESPACE}hasTargetArtifact`;
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
const SFLO_HAS_PAYLOAD_ARTIFACT_IRI = `${SFLO_NAMESPACE}hasPayloadArtifact`;
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

export function resolveMeshInventoryProgressionFromMetadata(
  meshBase: string,
  currentMeshMetadataTurtle: string | undefined,
  errorMessage: string,
): MeshInventoryProgression {
  if (currentMeshMetadataTurtle === undefined) {
    throw new WeaveInputError(errorMessage);
  }

  const quads = parseWeaveShapeQuads(
    meshBase,
    currentMeshMetadataTurtle,
    errorMessage,
  );
  const meshInventoryIri = toAbsoluteIri(meshBase, "_mesh/_inventory");
  const historyIri = requireSingleNamedNodeObject(
    quads,
    meshInventoryIri,
    SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
    errorMessage,
  );
  const nextHistoryOrdinal = requireSingleNonNegativeIntegerLiteral(
    quads,
    meshInventoryIri,
    SFLO_NEXT_HISTORY_ORDINAL_IRI,
    errorMessage,
  );
  const historyPath = toMeshRelativePath(
    meshBase,
    historyIri,
    "the current MeshInventory history",
  );
  const latestStateIri = requireSingleNamedNodeObject(
    quads,
    historyIri,
    SFLO_LATEST_HISTORICAL_STATE_IRI,
    errorMessage,
  );
  const latestStatePath = toMeshRelativePath(
    meshBase,
    latestStateIri,
    "the latest MeshInventory historical state",
  );
  const nextStateOrdinal = requireSingleNonNegativeIntegerLiteral(
    quads,
    historyIri,
    SFLO_NEXT_STATE_ORDINAL_IRI,
    errorMessage,
  );
  if (nextStateOrdinal === 0) {
    throw new WeaveInputError(errorMessage);
  }
  const latestStateOrdinal = nextStateOrdinal - 1;
  const nextStateSegmentHint = resolveOptionalSegmentHint(
    quads,
    historyIri,
    SFCFG_HAS_NEXT_STATE_SEGMENT_HINT_IRI,
    errorMessage,
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
  const rootDesignatorPath = toRootDesignatorPath(sourcePayloadDesignatorPath);
  const rootKnopPath = toKnopPath(rootDesignatorPath);
  const sourceKnopPath = toKnopPath(sourcePayloadDesignatorPath);
  const knopPath = toKnopPath(designatorPath);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  const sourcePayloadPagePath = toDesignatorResourcePagePath(
    sourcePayloadDesignatorPath,
  );
  const errorMessage =
    `The current local weave slice only supports the settled extracted-knop pre-weave mesh inventory shape for ${designatorPath}.`;
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentMeshInventoryTurtle,
    errorMessage,
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
    [rootKnopPath, RDF_TYPE_IRI, SFLO_KNOP_IRI],
    [
      rootKnopPath,
      SFLO_HAS_WORKING_KNOP_INVENTORY_FILE_IRI,
      `${rootKnopPath}/_inventory/inventory.ttl`,
    ],
    [
      rootKnopPath,
      SFLO_HAS_RESOURCE_PAGE_IRI,
      `${rootKnopPath}/index.html`,
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
    [extractionSourcePath, SFLO_HAS_TARGET_ARTIFACT_IRI, sourceDesignatorPath],
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
    SFLO_HAS_REQUESTED_TARGET_STATE_IRI,
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
  const errorMessage =
    `The current local weave slice only supports the settled first-history KnopMetadata shape for ${designatorPath}.`;
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentKnopMetadataTurtle,
    errorMessage,
  );

  assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
    [knopPath, RDF_TYPE_IRI, SFLO_KNOP_IRI],
    [
      knopPath,
      SFLO_HAS_WORKING_KNOP_INVENTORY_FILE_IRI,
      `${knopPath}/_inventory/inventory.ttl`,
    ],
  ]);
  assertHasLiteralFacts(quads, meshBase, errorMessage, [
    [knopPath, SFLO_DESIGNATOR_PATH_IRI, designatorPath],
  ]);

  if (hasPredicateFact(quads, SFLO_HAS_ARTIFACT_HISTORY_IRI)) {
    throw new WeaveInputError(
      `KnopMetadata already has explicit history for ${designatorPath}.`,
    );
  }
}

export function assertCurrentKnopInventoryBaseShape(
  meshBase: string,
  currentKnopInventoryTurtle: string,
  knopPath: string,
): void {
  const errorMessage =
    `The current local weave slice only supports the settled first-history KnopInventory shape for ${knopPath}.`;
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
  ]);
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
  const errorMessage =
    `The current local weave slice only supports the settled integrated payload shape for ${designatorPath}.`;
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentKnopInventoryTurtle,
    errorMessage,
  );

  assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
    [designatorPath, RDF_TYPE_IRI, SFLO_PAYLOAD_ARTIFACT_IRI],
    [designatorPath, RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    [designatorPath, RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
  ]);
  assertHasCurrentPayloadSourceLocator(
    quads,
    meshBase,
    errorMessage,
    designatorPath,
    payloadArtifact,
  );

  const existingHistoryPaths = resolveNamedNodeObjectPaths(
    quads,
    meshBase,
    designatorPath,
    SFLO_HAS_ARTIFACT_HISTORY_IRI,
    errorMessage,
  );
  const currentHistoryPath = resolveOptionalNamedNodePath(
    quads,
    meshBase,
    designatorPath,
    SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
    errorMessage,
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

export function assertCurrentKnopInventoryShapeForSecondPayloadWeave(
  meshBase: string,
  currentKnopInventoryTurtle: string,
  designatorPath: string,
  payloadArtifact: PayloadWorkingArtifact,
  nextPayloadStatePath: string,
  options?: { knopInventoryHistoryPolicy?: SupportArtifactHistoryPolicy },
): void {
  const knopPath = toKnopPath(designatorPath);
  const payloadHistoryPath = requirePayloadHistoryPath(
    designatorPath,
    payloadArtifact,
  );
  const currentPayloadStatePath = requirePayloadCurrentStatePath(
    designatorPath,
    payloadArtifact,
    payloadHistoryPath,
  );
  const errorMessage =
    `The current local weave slice only supports the settled second payload weave shape for ${designatorPath}.`;
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentKnopInventoryTurtle,
    errorMessage,
  );
  const versionKnopInventory = shouldMaterializeSupportHistory(
    options?.knopInventoryHistoryPolicy ?? "versioned",
  );

  const expectedFacts: NamedNodeFact[] = [
    [knopPath, RDF_TYPE_IRI, SFLO_KNOP_IRI],
    [knopPath, SFLO_HAS_PAYLOAD_ARTIFACT_IRI, designatorPath],
    [designatorPath, RDF_TYPE_IRI, SFLO_PAYLOAD_ARTIFACT_IRI],
    [designatorPath, RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    [designatorPath, RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [
      designatorPath,
      SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
      payloadHistoryPath,
    ],
    [
      payloadHistoryPath,
      SFLO_LATEST_HISTORICAL_STATE_IRI,
      currentPayloadStatePath,
    ],
    [`${knopPath}/_inventory`, RDF_TYPE_IRI, SFLO_KNOP_INVENTORY_IRI],
    [`${knopPath}/_inventory`, RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    [`${knopPath}/_inventory`, RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
  ];
  if (versionKnopInventory) {
    expectedFacts.push(
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
    );
  }
  assertHasNamedNodeFacts(quads, meshBase, errorMessage, expectedFacts);
  assertHasCurrentPayloadSourceLocator(
    quads,
    meshBase,
    errorMessage,
    designatorPath,
    payloadArtifact,
  );
  assertHasCurrentWorkingFileLocator(
    quads,
    meshBase,
    errorMessage,
    `${knopPath}/_inventory`,
    `${knopPath}/_inventory/inventory.ttl`,
  );
  assertHasLiteralFacts(quads, meshBase, errorMessage, [
    [
      payloadHistoryPath,
      SFLO_NEXT_STATE_ORDINAL_IRI,
      "2",
      XSD_NON_NEGATIVE_INTEGER_IRI,
    ],
  ]);

  if (
    hasNamedNodeFact(
      quads,
      meshBase,
      payloadHistoryPath,
      SFLO_HAS_HISTORICAL_STATE_IRI,
      nextPayloadStatePath,
    )
  ) {
    throw new WeaveInputError(
      `Payload artifact already has a second explicit historical state for ${designatorPath}.`,
    );
  }
  if (
    versionKnopInventory &&
    hasNamedNodeFact(
      quads,
      meshBase,
      `${knopPath}/_inventory/_history001`,
      SFLO_HAS_HISTORICAL_STATE_IRI,
      `${knopPath}/_inventory/_history001/_s0002`,
    )
  ) {
    throw new WeaveInputError(
      `KnopInventory already has a second explicit historical state for ${designatorPath}.`,
    );
  }
}

export function assertHasNamedNodeFacts(
  quads: readonly Quad[],
  meshBase: string,
  errorMessage: string,
  facts: readonly NamedNodeFact[],
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
      throw new WeaveInputError(errorMessage);
    }
  }
}

export function assertHasLiteralFacts(
  quads: readonly Quad[],
  meshBase: string,
  errorMessage: string,
  facts: readonly LiteralFact[],
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
      throw new WeaveInputError(errorMessage);
    }
  }
}

function toRootDesignatorPath(designatorPath: string): string {
  const firstSlash = designatorPath.indexOf("/");
  return firstSlash === -1
    ? designatorPath
    : designatorPath.slice(0, firstSlash);
}

function toHistoryPathFromStatePath(statePath: string): string {
  return statePath.slice(0, statePath.lastIndexOf("/"));
}

function toStateSegment(stateOrdinal: number): string {
  return `_s${String(stateOrdinal).padStart(4, "0")}`;
}
