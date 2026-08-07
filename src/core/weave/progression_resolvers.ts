import {
  formatDesignatorPathForDisplay,
  toKnopPath,
} from "../designator_segments.ts";
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
  type MeshInventoryProgressionDiagnostics,
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
      throw new WeaveInputError(errorMessage, "unsupported-mesh-shape");
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
    throw new WeaveInputError(errorMessage, "unsupported-mesh-shape");
  }
  const latestStateOrdinal = parseStateOrdinalFromPath(
    latestStatePath,
    errorMessage,
  );
  if (toHistoryPathFromStatePath(latestStatePath) !== historyPath) {
    throw new WeaveInputError(errorMessage, "unsupported-mesh-shape");
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
    throw new WeaveInputError(errorMessage, "unsupported-mesh-shape");
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
    throw new WeaveInputError(errorMessage, "unsupported-mesh-shape");
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
    throw new WeaveInputError(errorMessage, "unsupported-mesh-shape");
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
      throw new WeaveInputError(errorMessage, "unsupported-mesh-shape");
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
    throw new WeaveInputError(errorMessage, "unsupported-mesh-shape");
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
  const designator = formatDesignatorPathForDisplay(designatorPath);
  const legacyErrorMessage =
    "The current local weave slice only supports a settled first-payload-weave mesh inventory shape.";
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentMeshInventoryTurtle,
    `MeshInventory file _mesh/_inventory/inventory.ttl for designator path ${designator} is not valid Turtle. Repair the file before retrying weave.`,
    "malformed-inventory",
  );

  assertHasNamedNodeFacts(
    quads,
    meshBase,
    `MeshInventory file _mesh/_inventory/inventory.ttl for designator path ${designator} is missing rdf:type sflo:MeshInventory on subject <_mesh/_inventory>. Add that fact before retrying weave.`,
    [["_mesh/_inventory", RDF_TYPE_IRI, SFLO_MESH_INVENTORY_IRI]],
    "malformed-inventory",
  );
  assertHasNamedNodeFacts(
    quads,
    meshBase,
    `MeshInventory file _mesh/_inventory/inventory.ttl for designator path ${designator} is missing rdf:type sflo:DigitalArtifact on subject <_mesh/_inventory>. Add that fact before retrying weave.`,
    [["_mesh/_inventory", RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI]],
    "malformed-inventory",
  );
  assertHasNamedNodeFacts(
    quads,
    meshBase,
    `MeshInventory file _mesh/_inventory/inventory.ttl for designator path ${designator} is missing rdf:type sflo:RdfDocument on subject <_mesh/_inventory>. Add that fact before retrying weave.`,
    [["_mesh/_inventory", RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI]],
    "malformed-inventory",
  );
  assertHasNamedNodeFacts(
    quads,
    meshBase,
    `MeshInventory file _mesh/_inventory/inventory.ttl for designator path ${designator} is missing rdf:type sflo:PayloadArtifact on payload subject <${designatorPath}>. Add that fact before retrying weave.`,
    [[designatorPath, RDF_TYPE_IRI, SFLO_PAYLOAD_ARTIFACT_IRI]],
    "malformed-inventory",
  );
  assertHasNamedNodeFacts(
    quads,
    meshBase,
    `MeshInventory file _mesh/_inventory/inventory.ttl for designator path ${designator} is missing rdf:type sflo:DigitalArtifact on payload subject <${designatorPath}>. Add that fact before retrying weave.`,
    [[designatorPath, RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI]],
    "malformed-inventory",
  );
  assertHasNamedNodeFacts(
    quads,
    meshBase,
    `MeshInventory file _mesh/_inventory/inventory.ttl for designator path ${designator} is missing rdf:type sflo:Knop on subject <${knopPath}>. Add that fact before retrying weave.`,
    [[knopPath, RDF_TYPE_IRI, SFLO_KNOP_IRI]],
    "malformed-inventory",
  );

  const progression = resolveMeshInventoryProgressionFromMetadata(
    meshBase,
    currentMeshMetadataTurtle,
    legacyErrorMessage,
    firstPayloadMeshInventoryProgressionDiagnostics(designatorPath),
  );
  if (progression.nextStateOrdinal !== progression.latestStateOrdinal + 1) {
    throw new WeaveInputError(
      legacyErrorMessage,
      "unsupported-mesh-shape",
    );
  }
  const latestManifestationIri = requireOptionalNamedNodeObject(
    quads,
    toAbsoluteIri(meshBase, progression.latestStatePath),
    SFLO_HAS_MANIFESTATION_IRI,
    `MeshInventory file _mesh/_inventory/inventory.ttl for designator path ${designator} has more than one sflo:hasManifestation IRI on latest state <${progression.latestStatePath}>. Keep exactly one current manifestation before retrying weave.`,
    "malformed-inventory",
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
      progression.historyPath
  ) {
    throw new WeaveInputError(
      `MeshMetadata file _mesh/_meta/meta.ttl for designator path ${designator} points sflo:latestHistoricalState to <${progression.latestStatePath}>, outside current MeshInventory history <${progression.historyPath}>. Point the latest state inside the current history before retrying weave.`,
      "malformed-mesh-metadata",
    );
  }
  if (latestManifestationPath !== `${progression.latestStatePath}/ttl`) {
    throw new WeaveInputError(
      legacyErrorMessage,
      "unsupported-mesh-shape",
    );
  }
  if (!latestManifestationIri && progression.latestStateOrdinal !== 2) {
    throw new WeaveInputError(
      legacyErrorMessage,
      "unsupported-mesh-shape",
    );
  }
  assertHasNamedNodeFacts(
    quads,
    meshBase,
    `MeshInventory file _mesh/_inventory/inventory.ttl for designator path ${designator} is missing sflo:hasArtifactHistory <${progression.historyPath}> on subject <_mesh/_inventory>. Add that fact before retrying weave.`,
    [
      [
        "_mesh/_inventory",
        SFLO_HAS_ARTIFACT_HISTORY_IRI,
        progression.historyPath,
      ],
    ],
    "malformed-inventory",
  );
  assertHasNamedNodeFacts(
    quads,
    meshBase,
    `MeshInventory file _mesh/_inventory/inventory.ttl for designator path ${designator} is missing sflo:hasHistoricalState <${progression.latestStatePath}> on history subject <${progression.historyPath}>. Add that fact before retrying weave.`,
    [
      [
        progression.historyPath,
        SFLO_HAS_HISTORICAL_STATE_IRI,
        progression.latestStatePath,
      ],
    ],
    "malformed-inventory",
  );

  return {
    ...progression,
    latestManifestationPath,
  };
}

function firstPayloadMeshInventoryProgressionDiagnostics(
  designatorPath: string,
): MeshInventoryProgressionDiagnostics {
  const metadataPath = "_mesh/_meta/meta.ttl";
  const inventorySubject = "<_mesh/_inventory>";
  const designator = formatDesignatorPathForDisplay(designatorPath);
  const context =
    `MeshMetadata file ${metadataPath} for designator path ${designator}`;
  return {
    findingCode: "malformed-mesh-metadata",
    missingMetadata:
      `MeshMetadata file ${metadataPath} for designator path ${designator} is missing. Restore it with the current MeshInventory history facts before retrying weave.`,
    invalidMetadataTurtle:
      `MeshMetadata file ${metadataPath} for designator path ${designator} is not valid Turtle. Repair the file before retrying weave.`,
    missingCurrentHistory:
      `${context} is missing sflo:currentArtifactHistory on subject ${inventorySubject}. Point it to the current MeshInventory ArtifactHistory before retrying weave.`,
    conflictingCurrentHistory:
      `${context} has conflicting sflo:currentArtifactHistory IRIs on subject ${inventorySubject}. Keep exactly one current MeshInventory history before retrying weave.`,
    missingNextHistoryOrdinal:
      `${context} is missing sflo:nextHistoryOrdinal on subject ${inventorySubject}. Add one non-negative integer ordinal before retrying weave.`,
    conflictingNextHistoryOrdinal:
      `${context} has conflicting sflo:nextHistoryOrdinal values on subject ${inventorySubject}. Keep exactly one non-negative integer ordinal before retrying weave.`,
    invalidNextHistoryOrdinal:
      `${context} has an invalid sflo:nextHistoryOrdinal on subject ${inventorySubject}. Use one xsd:nonNegativeInteger value before retrying weave.`,
    missingLatestState: (historyPath) =>
      `${context} is missing sflo:latestHistoricalState on history subject <${historyPath}>. Point that history to its latest state before retrying weave.`,
    conflictingLatestState: (historyPath) =>
      `${context} has conflicting sflo:latestHistoricalState IRIs on history subject <${historyPath}>. Keep exactly one latest state before retrying weave.`,
    missingNextStateOrdinal: (historyPath) =>
      `${context} is missing sflo:nextStateOrdinal on history subject <${historyPath}>. Add one non-negative integer ordinal before retrying weave.`,
    conflictingNextStateOrdinal: (historyPath) =>
      `${context} has conflicting sflo:nextStateOrdinal values on history subject <${historyPath}>. Keep exactly one non-negative integer ordinal before retrying weave.`,
    invalidNextStateOrdinal: (historyPath) =>
      `${context} has an invalid sflo:nextStateOrdinal on history subject <${historyPath}>. Use one xsd:nonNegativeInteger value before retrying weave.`,
    zeroNextStateOrdinal: (historyPath) =>
      `${context} sets sflo:nextStateOrdinal to "0" on history subject <${historyPath}>, which cannot follow an existing latest state. Set it to at least "1" before retrying weave.`,
    invalidNextStateSegmentHint: (historyPath) =>
      `${context} has conflicting or invalid sfcfg:hasNextStateSegmentHint values on history subject <${historyPath}>. Keep at most one safe path segment before retrying weave.`,
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
    throw new WeaveInputError(errorMessage, "unsupported-mesh-shape");
  }

  return parsed;
}

function toStateSegment(stateOrdinal: number): string {
  return `_s${String(stateOrdinal).padStart(4, "0")}`;
}

function toLastPathSegment(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}
