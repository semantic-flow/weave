import { toKnopPath } from "../designator_segments.ts";
import { SFLO_NAMESPACE } from "../rdf/namespaces.ts";
import type { ResourcePageDefinitionWorkingArtifact } from "./candidates.ts";
import { WeaveInputError } from "./errors.ts";
import type {
  MeshInventoryProgression,
  PageDefinitionWeaveProgression,
} from "./progression_models.ts";
import {
  hasNamedNodeFact,
  parseWeaveShapeQuads,
  requireOptionalNamedNodeObject,
  requireSingleNamedNodeObject,
  requireSingleNonNegativeIntegerLiteral,
  resolveOptionalNamedNodePath,
  toAbsoluteIri,
  toMeshRelativePath,
} from "./rdf_helpers.ts";
import {
  assertHasNamedNodeFacts,
  resolveMeshInventoryProgressionFromMetadata,
} from "./shape_assertions.ts";
import { assertHasCurrentWorkingFileLocator } from "./source_locator_assertions.ts";

const RDF_TYPE_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const SFLO_HAS_KNOP_ASSET_BUNDLE_IRI = `${SFLO_NAMESPACE}hasKnopAssetBundle`;
const SFLO_HAS_RESOURCE_PAGE_DEFINITION_IRI =
  `${SFLO_NAMESPACE}hasResourcePageDefinition`;
const SFLO_KNOP_ASSET_BUNDLE_IRI = `${SFLO_NAMESPACE}KnopAssetBundle`;
const SFLO_RESOURCE_PAGE_DEFINITION_IRI =
  `${SFLO_NAMESPACE}ResourcePageDefinition`;
const SFLO_CURRENT_ARTIFACT_HISTORY_IRI =
  `${SFLO_NAMESPACE}currentArtifactHistory`;
const SFLO_DIGITAL_ARTIFACT_IRI = `${SFLO_NAMESPACE}DigitalArtifact`;
const SFLO_HAS_ARTIFACT_HISTORY_IRI = `${SFLO_NAMESPACE}hasArtifactHistory`;
const SFLO_HAS_MANIFESTATION_IRI = `${SFLO_NAMESPACE}hasManifestation`;
const SFLO_HAS_HISTORICAL_STATE_IRI = `${SFLO_NAMESPACE}hasHistoricalState`;
const SFLO_HAS_KNOP_INVENTORY_IRI = `${SFLO_NAMESPACE}hasKnopInventory`;
const SFLO_HAS_KNOP_METADATA_IRI = `${SFLO_NAMESPACE}hasKnopMetadata`;
const SFLO_HAS_WORKING_KNOP_INVENTORY_FILE_IRI =
  `${SFLO_NAMESPACE}hasWorkingKnopInventoryFile`;
const SFLO_KNOP_IRI = `${SFLO_NAMESPACE}Knop`;
const SFLO_KNOP_INVENTORY_IRI = `${SFLO_NAMESPACE}KnopInventory`;
const SFLO_LATEST_HISTORICAL_STATE_IRI =
  `${SFLO_NAMESPACE}latestHistoricalState`;
const SFLO_MESH_INVENTORY_IRI = `${SFLO_NAMESPACE}MeshInventory`;
const SFLO_NEXT_STATE_ORDINAL_IRI = `${SFLO_NAMESPACE}nextStateOrdinal`;
const SFLO_PAYLOAD_ARTIFACT_IRI = `${SFLO_NAMESPACE}PayloadArtifact`;
const SFLO_RDF_DOCUMENT_IRI = `${SFLO_NAMESPACE}RdfDocument`;

export function resolvePageDefinitionWeaveProgression(
  designatorPath: string,
  pageDefinitionArtifact: ResourcePageDefinitionWorkingArtifact,
): PageDefinitionWeaveProgression {
  const errorMessage =
    `The current local weave slice only supports a settled ResourcePageDefinition progression for ${designatorPath}.`;
  const historyPath = pageDefinitionArtifact.currentArtifactHistoryPath ??
    `${pageDefinitionArtifact.artifactPath}/_history001`;

  if (!pageDefinitionArtifact.currentArtifactHistoryExists) {
    if (
      pageDefinitionArtifact.currentArtifactHistoryPath !== undefined ||
      pageDefinitionArtifact.latestHistoricalStatePath !== undefined
    ) {
      throw new WeaveInputError(errorMessage);
    }

    return {
      historyPath,
      latestStateOrdinal: 0,
      nextStatePath: `${historyPath}/_s0001`,
      nextStateOrdinal: 1,
      nextManifestationPath: `${historyPath}/_s0001/ttl`,
      nextSnapshotPath: `${historyPath}/_s0001/ttl/page.ttl`,
    };
  }

  const latestStatePath = pageDefinitionArtifact.latestHistoricalStatePath;
  if (!latestStatePath) {
    throw new WeaveInputError(errorMessage);
  }
  const latestStateOrdinal = parseStateOrdinalFromPath(
    latestStatePath,
    errorMessage,
  );
  if (toHistoryPathFromStatePath(latestStatePath) !== historyPath) {
    throw new WeaveInputError(errorMessage);
  }
  const nextStateOrdinal = latestStateOrdinal + 1;
  const nextStatePath = `${historyPath}/${toStateSegment(nextStateOrdinal)}`;

  return {
    historyPath,
    latestStatePath,
    latestStateOrdinal,
    nextStatePath,
    nextStateOrdinal,
    nextManifestationPath: `${nextStatePath}/ttl`,
    nextSnapshotPath: `${nextStatePath}/ttl/page.ttl`,
  };
}

export function resolveCurrentKnopInventoryProgressionForPageDefinitionWeave(
  meshBase: string,
  currentKnopInventoryTurtle: string,
  designatorPath: string,
  pageDefinitionArtifact: ResourcePageDefinitionWorkingArtifact,
  pageDefinitionProgression: PageDefinitionWeaveProgression,
): MeshInventoryProgression {
  const knopPath = toKnopPath(designatorPath);
  const pageDefinitionPath = pageDefinitionArtifact.artifactPath;
  const errorMessage =
    `The current local weave slice only supports a settled page-definition KnopInventory progression for ${designatorPath}.`;
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentKnopInventoryTurtle,
    errorMessage,
  );

  assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
    [knopPath, RDF_TYPE_IRI, SFLO_KNOP_IRI],
    [knopPath, SFLO_HAS_KNOP_METADATA_IRI, `${knopPath}/_meta`],
    [knopPath, SFLO_HAS_KNOP_INVENTORY_IRI, `${knopPath}/_inventory`],
    [knopPath, SFLO_HAS_RESOURCE_PAGE_DEFINITION_IRI, pageDefinitionPath],
    [
      knopPath,
      SFLO_HAS_WORKING_KNOP_INVENTORY_FILE_IRI,
      `${knopPath}/_inventory/inventory.ttl`,
    ],
    [`${knopPath}/_inventory`, RDF_TYPE_IRI, SFLO_KNOP_INVENTORY_IRI],
    [`${knopPath}/_inventory`, RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    [`${knopPath}/_inventory`, RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [pageDefinitionPath, RDF_TYPE_IRI, SFLO_RESOURCE_PAGE_DEFINITION_IRI],
    [pageDefinitionPath, RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    [pageDefinitionPath, RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
  ]);
  assertHasCurrentWorkingFileLocator(
    quads,
    meshBase,
    errorMessage,
    pageDefinitionPath,
    pageDefinitionArtifact.workingLocalRelativePath,
  );

  const historyIri = requireSingleNamedNodeObject(
    quads,
    toAbsoluteIri(meshBase, `${knopPath}/_inventory`),
    SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
    errorMessage,
  );
  const historyPath = toMeshRelativePath(
    meshBase,
    historyIri,
    "the current KnopInventory history",
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
    "the latest KnopInventory historical state",
  );
  const latestStateOrdinal = parseStateOrdinalFromPath(
    latestStatePath,
    errorMessage,
  );
  const nextStateOrdinal = requireSingleNonNegativeIntegerLiteral(
    quads,
    historyIri,
    SFLO_NEXT_STATE_ORDINAL_IRI,
    errorMessage,
  );
  if (
    historyPath !== `${knopPath}/_inventory/_history001` ||
    toHistoryPathFromStatePath(latestStatePath) !== historyPath ||
    nextStateOrdinal !== latestStateOrdinal + 1
  ) {
    throw new WeaveInputError(errorMessage);
  }
  if (
    pageDefinitionArtifact.currentArtifactHistoryExists &&
    !hasNamedNodeFact(
      quads,
      meshBase,
      pageDefinitionPath,
      SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
      pageDefinitionProgression.historyPath,
    )
  ) {
    throw new WeaveInputError(errorMessage);
  }
  if (
    pageDefinitionArtifact.currentArtifactHistoryExists &&
    pageDefinitionProgression.latestStatePath &&
    !hasNamedNodeFact(
      quads,
      meshBase,
      pageDefinitionProgression.historyPath,
      SFLO_LATEST_HISTORICAL_STATE_IRI,
      pageDefinitionProgression.latestStatePath,
    )
  ) {
    throw new WeaveInputError(errorMessage);
  }
  if (!pageDefinitionArtifact.currentArtifactHistoryExists) {
    if (
      resolveOptionalNamedNodePath(
        quads,
        meshBase,
        pageDefinitionPath,
        SFLO_HAS_ARTIFACT_HISTORY_IRI,
        errorMessage,
      ) ||
      resolveOptionalNamedNodePath(
        quads,
        meshBase,
        pageDefinitionPath,
        SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
        errorMessage,
      )
    ) {
      throw new WeaveInputError(errorMessage);
    }
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

  return {
    historyPath,
    latestStatePath,
    latestStateOrdinal,
    latestManifestationPath: `${latestStatePath}/ttl`,
    nextStatePath: `${historyPath}/${toStateSegment(nextStateOrdinal)}`,
    nextStateOrdinal,
  };
}

export function resolveCurrentMeshInventoryProgressionForFirstKnopWeave(
  meshBase: string,
  currentMeshInventoryTurtle: string,
  currentMeshMetadataTurtle: string | undefined,
  designatorPath: string,
): MeshInventoryProgression {
  const knopPath = toKnopPath(designatorPath);
  const errorMessage =
    "The current local weave slice only supports a settled first-knop-weave mesh inventory progression.";
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
  const progression = resolveMeshInventoryProgressionFromMetadata(
    meshBase,
    currentMeshMetadataTurtle,
    errorMessage,
  );
  if (
    progression.historyPath !== "_mesh/_inventory/_history001" ||
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

  return progression;
}

export function resolveCurrentMeshInventoryProgressionForFirstPayloadWeave(
  meshBase: string,
  currentMeshInventoryTurtle: string,
  currentMeshMetadataTurtle: string | undefined,
  designatorPath: string,
): MeshInventoryProgression {
  const knopPath = toKnopPath(designatorPath);
  const errorMessage =
    "The current local weave slice only supports a settled first-payload-weave mesh inventory shape.";
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentMeshInventoryTurtle,
    errorMessage,
  );

  assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_MESH_INVENTORY_IRI],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [designatorPath, RDF_TYPE_IRI, SFLO_PAYLOAD_ARTIFACT_IRI],
    [designatorPath, RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    [designatorPath, RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [knopPath, RDF_TYPE_IRI, SFLO_KNOP_IRI],
  ]);

  const progression = resolveMeshInventoryProgressionFromMetadata(
    meshBase,
    currentMeshMetadataTurtle,
    errorMessage,
  );
  if (progression.nextStateOrdinal !== progression.latestStateOrdinal + 1) {
    throw new WeaveInputError(errorMessage);
  }
  const latestManifestationIri = requireOptionalNamedNodeObject(
    quads,
    toAbsoluteIri(meshBase, progression.latestStatePath),
    SFLO_HAS_MANIFESTATION_IRI,
    errorMessage,
  );
  const latestManifestationPath = latestManifestationIri
    ? toMeshRelativePath(
      meshBase,
      latestManifestationIri,
      "the latest MeshInventory historical-state manifestation",
    )
    : `${progression.latestStatePath}/ttl`;
  if (
    toHistoryPathFromStatePath(progression.latestStatePath) !==
      progression.historyPath ||
    latestManifestationPath !==
      `${progression.latestStatePath}/ttl` ||
    (!latestManifestationIri && progression.latestStateOrdinal !== 2)
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

  return {
    ...progression,
    latestManifestationPath,
  };
}

function toHistoryPathFromStatePath(statePath: string): string {
  return statePath.slice(0, statePath.lastIndexOf("/"));
}

function parseStateOrdinalFromPath(
  statePath: string,
  errorMessage: string,
): number {
  const match = toLastPathSegment(statePath).match(/^_s(\d+)$/);
  const parsed = match ? Number(match[1]) : Number.NaN;

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new WeaveInputError(errorMessage);
  }

  return parsed;
}

function toStateSegment(stateOrdinal: number): string {
  return `_s${String(stateOrdinal).padStart(4, "0")}`;
}

function toLastPathSegment(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}
