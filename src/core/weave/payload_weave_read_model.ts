import type { Quad } from "n3";
import { toKnopPath } from "../designator_segments.ts";
import { SFLO_NAMESPACE } from "../rdf/namespaces.ts";
import type { PayloadWorkingArtifact } from "./candidates.ts";
import { WeaveInputError } from "./errors.ts";
import type { PayloadVersionLayout } from "./payload_version_layout.ts";
import type { MeshInventoryProgression } from "./progression_models.ts";
import {
  hasNamedNodeFact,
  hasSubject,
  hasSubjectPredicateFact,
  parseWeaveShapeQuads,
  requireSingleNonNegativeIntegerLiteralWithDiagnostics,
  toAbsoluteIri,
  toMeshRelativePath,
} from "./rdf_helpers.ts";
import {
  assertHasCurrentPayloadSourceLocator,
  assertHasCurrentWorkingFileLocator,
} from "./source_locator_assertions.ts";
import {
  shouldMaterializeSupportHistory,
  type SupportArtifactHistoryPolicy,
} from "./support_history_policy.ts";

const RDF_TYPE_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const SFLO_ARTIFACT_HISTORY_IRI = `${SFLO_NAMESPACE}ArtifactHistory`;
const SFLO_CURRENT_ARTIFACT_HISTORY_IRI =
  `${SFLO_NAMESPACE}currentArtifactHistory`;
const SFLO_DIGITAL_ARTIFACT_IRI = `${SFLO_NAMESPACE}DigitalArtifact`;
const SFLO_HAS_ARTIFACT_HISTORY_IRI = `${SFLO_NAMESPACE}hasArtifactHistory`;
const SFLO_HAS_HISTORICAL_STATE_IRI = `${SFLO_NAMESPACE}hasHistoricalState`;
const SFLO_HAS_PAYLOAD_ARTIFACT_IRI = `${SFLO_NAMESPACE}hasPayloadArtifact`;
const SFLO_KNOP_INVENTORY_IRI = `${SFLO_NAMESPACE}KnopInventory`;
const SFLO_LATEST_HISTORICAL_STATE_IRI =
  `${SFLO_NAMESPACE}latestHistoricalState`;
const SFLO_NEXT_STATE_ORDINAL_IRI = `${SFLO_NAMESPACE}nextStateOrdinal`;
const SFLO_PAYLOAD_ARTIFACT_IRI = `${SFLO_NAMESPACE}PayloadArtifact`;
const SFLO_RDF_DOCUMENT_IRI = `${SFLO_NAMESPACE}RdfDocument`;

export interface LaterPayloadWeaveReadModel {
  knopMetadataHistoryPolicy: SupportArtifactHistoryPolicy;
  knopInventoryHistoryPolicy: SupportArtifactHistoryPolicy;
  knopInventoryProgression?: MeshInventoryProgression;
}

export function resolveLaterPayloadWeaveReadModel(
  meshBase: string,
  currentKnopInventoryTurtle: string,
  designatorPath: string,
  payloadArtifact: PayloadWorkingArtifact,
  payloadLayout: PayloadVersionLayout,
  options?: {
    knopMetadataHistoryPolicy?: SupportArtifactHistoryPolicy;
    knopInventoryHistoryPolicy?: SupportArtifactHistoryPolicy;
  },
): LaterPayloadWeaveReadModel {
  const parseErrorMessage =
    `Could not parse the current KnopInventory while resolving later payload weave facts for ${designatorPath}.`;
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentKnopInventoryTurtle,
    parseErrorMessage,
  );
  const knopPath = toKnopPath(designatorPath);
  const payloadHistoryPath = requirePayloadCurrentHistoryFact(
    quads,
    meshBase,
    designatorPath,
  );

  assertRequiredNamedNodeFact(
    quads,
    meshBase,
    knopPath,
    SFLO_HAS_PAYLOAD_ARTIFACT_IRI,
    designatorPath,
    `Knop ${knopPath} is missing sflo:hasPayloadArtifact <${designatorPath}>.`,
  );
  assertRequiredNamedNodeFact(
    quads,
    meshBase,
    designatorPath,
    RDF_TYPE_IRI,
    SFLO_PAYLOAD_ARTIFACT_IRI,
    `Payload artifact ${designatorPath} is missing rdf:type sflo:PayloadArtifact.`,
  );
  assertRequiredNamedNodeFact(
    quads,
    meshBase,
    designatorPath,
    RDF_TYPE_IRI,
    SFLO_DIGITAL_ARTIFACT_IRI,
    `Payload artifact ${designatorPath} is missing rdf:type sflo:DigitalArtifact.`,
  );
  assertHasCurrentPayloadSourceLocator(
    quads,
    meshBase,
    `Payload artifact ${designatorPath} is missing or conflicts on its current working file locator.`,
    designatorPath,
    payloadArtifact,
  );

  validateCurrentPayloadHistory(
    quads,
    meshBase,
    designatorPath,
    payloadHistoryPath,
    payloadArtifact,
    payloadLayout,
  );

  const effectiveKnopMetadataHistoryPolicy =
    resolveEffectiveKnopMetadataHistoryPolicy(
      quads,
      meshBase,
      knopPath,
      options?.knopMetadataHistoryPolicy,
    );
  const effectiveKnopInventoryHistoryPolicy =
    resolveEffectiveKnopInventoryHistoryPolicy(
      quads,
      meshBase,
      designatorPath,
      knopPath,
      options?.knopInventoryHistoryPolicy,
    );
  const knopInventoryProgression = shouldMaterializeSupportHistory(
      effectiveKnopInventoryHistoryPolicy,
    )
    ? resolveKnopInventoryProgression(
      quads,
      meshBase,
      designatorPath,
      knopPath,
    )
    : undefined;

  return {
    knopMetadataHistoryPolicy: effectiveKnopMetadataHistoryPolicy,
    knopInventoryHistoryPolicy: effectiveKnopInventoryHistoryPolicy,
    ...(knopInventoryProgression ? { knopInventoryProgression } : {}),
  };
}

function validateCurrentPayloadHistory(
  quads: readonly Quad[],
  meshBase: string,
  designatorPath: string,
  payloadHistoryPath: string,
  payloadArtifact: PayloadWorkingArtifact,
  payloadLayout: PayloadVersionLayout,
): void {
  if (payloadArtifact.currentArtifactHistoryPath !== payloadHistoryPath) {
    throw new WeaveInputError(
      `Payload artifact ${designatorPath} current history conflicts with the loaded candidate: inventory has ${payloadHistoryPath}, candidate has ${
        payloadArtifact.currentArtifactHistoryPath ?? "<missing>"
      }.`,
    );
  }
  if (!isArtifactHistory(quads, meshBase, payloadHistoryPath)) {
    throw new WeaveInputError(
      `Current payload history ${payloadHistoryPath} for ${designatorPath} is missing rdf:type sflo:ArtifactHistory.`,
    );
  }

  const latestStatePath = requireSingleNamedNodePathFact(quads, meshBase, {
    subjectPath: payloadHistoryPath,
    predicateIri: SFLO_LATEST_HISTORICAL_STATE_IRI,
    missingMessage:
      `Payload history ${payloadHistoryPath} for ${designatorPath} is missing sflo:latestHistoricalState.`,
    conflictMessage:
      `Payload history ${payloadHistoryPath} for ${designatorPath} has conflicting sflo:latestHistoricalState facts.`,
  });
  if (!latestStatePath.startsWith(`${payloadHistoryPath}/`)) {
    throw new WeaveInputError(
      `Payload history ${payloadHistoryPath} for ${designatorPath} points sflo:latestHistoricalState outside that history: ${latestStatePath}.`,
    );
  }

  if (payloadLayout.isNewHistory) {
    if (hasSubject(quads, meshBase, payloadLayout.nextStatePath)) {
      throw new WeaveInputError(
        `Requested payload state ${payloadLayout.nextStatePath} already exists for ${designatorPath}.`,
      );
    }
    return;
  }

  if (payloadLayout.historyPath !== payloadHistoryPath) {
    throw new WeaveInputError(
      `Invalid target selection for ${designatorPath}: requested current payload history ${payloadLayout.historyPath}, but current inventory selects ${payloadHistoryPath}.`,
    );
  }
  if (payloadLayout.currentStatePath !== latestStatePath) {
    throw new WeaveInputError(
      `Payload history ${payloadHistoryPath} for ${designatorPath} conflicts on sflo:latestHistoricalState: layout resolved ${
        payloadLayout.currentStatePath ?? "<missing>"
      }, inventory has ${latestStatePath}.`,
    );
  }

  const nextStateOrdinal = requireSingleNonNegativeIntegerFact(
    quads,
    meshBase,
    {
      subjectPath: payloadHistoryPath,
      predicateIri: SFLO_NEXT_STATE_ORDINAL_IRI,
      missingMessage:
        `Payload history ${payloadHistoryPath} for ${designatorPath} is missing sflo:nextStateOrdinal.`,
      conflictMessage:
        `Payload history ${payloadHistoryPath} for ${designatorPath} has conflicting sflo:nextStateOrdinal facts.`,
      invalidMessage:
        `Payload history ${payloadHistoryPath} for ${designatorPath} has invalid sflo:nextStateOrdinal.`,
    },
  );
  if (
    payloadLayout.nextStateOrdinal !== undefined &&
    payloadLayout.nextStateOrdinal !== nextStateOrdinal
  ) {
    throw new WeaveInputError(
      `Payload history ${payloadHistoryPath} for ${designatorPath} conflicts on sflo:nextStateOrdinal: layout resolved ${payloadLayout.nextStateOrdinal}, inventory has ${nextStateOrdinal}.`,
    );
  }

  const latestStateOrdinal = parseStateOrdinalFromPath(latestStatePath);
  if (
    latestStateOrdinal !== undefined &&
    nextStateOrdinal !== latestStateOrdinal + 1
  ) {
    throw new WeaveInputError(
      `Payload history ${payloadHistoryPath} for ${designatorPath} has impossible state progression: latest state ${latestStatePath} and sflo:nextStateOrdinal "${nextStateOrdinal}".`,
    );
  }
  if (
    hasNamedNodeFact(
      quads,
      meshBase,
      payloadHistoryPath,
      SFLO_HAS_HISTORICAL_STATE_IRI,
      payloadLayout.nextStatePath,
    ) ||
    hasSubject(quads, meshBase, payloadLayout.nextStatePath)
  ) {
    throw new WeaveInputError(
      `Payload artifact ${designatorPath} already has historical state ${payloadLayout.nextStatePath}.`,
    );
  }
}

function resolveKnopInventoryProgression(
  quads: readonly Quad[],
  meshBase: string,
  designatorPath: string,
  knopPath: string,
): MeshInventoryProgression {
  const inventoryPath = `${knopPath}/_inventory`;
  assertRequiredNamedNodeFact(
    quads,
    meshBase,
    inventoryPath,
    RDF_TYPE_IRI,
    SFLO_KNOP_INVENTORY_IRI,
    `KnopInventory ${inventoryPath} for ${designatorPath} is missing rdf:type sflo:KnopInventory.`,
  );
  assertRequiredNamedNodeFact(
    quads,
    meshBase,
    inventoryPath,
    RDF_TYPE_IRI,
    SFLO_DIGITAL_ARTIFACT_IRI,
    `KnopInventory ${inventoryPath} for ${designatorPath} is missing rdf:type sflo:DigitalArtifact.`,
  );
  assertRequiredNamedNodeFact(
    quads,
    meshBase,
    inventoryPath,
    RDF_TYPE_IRI,
    SFLO_RDF_DOCUMENT_IRI,
    `KnopInventory ${inventoryPath} for ${designatorPath} is missing rdf:type sflo:RdfDocument.`,
  );
  assertHasCurrentWorkingFileLocator(
    quads,
    meshBase,
    `KnopInventory ${inventoryPath} for ${designatorPath} is missing or conflicts on its current working file locator.`,
    inventoryPath,
    `${inventoryPath}/inventory.ttl`,
  );

  const historyPath = requireSingleNamedNodePathFact(quads, meshBase, {
    subjectPath: inventoryPath,
    predicateIri: SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
    missingMessage:
      `KnopInventory ${inventoryPath} for ${designatorPath} is missing sflo:currentArtifactHistory.`,
    conflictMessage:
      `KnopInventory ${inventoryPath} for ${designatorPath} has conflicting sflo:currentArtifactHistory facts.`,
  });
  if (!isArtifactHistory(quads, meshBase, historyPath)) {
    throw new WeaveInputError(
      `Current KnopInventory history ${historyPath} for ${designatorPath} is missing rdf:type sflo:ArtifactHistory.`,
    );
  }
  const latestStatePath = requireSingleNamedNodePathFact(quads, meshBase, {
    subjectPath: historyPath,
    predicateIri: SFLO_LATEST_HISTORICAL_STATE_IRI,
    missingMessage:
      `KnopInventory history ${historyPath} for ${designatorPath} is missing sflo:latestHistoricalState.`,
    conflictMessage:
      `KnopInventory history ${historyPath} for ${designatorPath} has conflicting sflo:latestHistoricalState facts.`,
  });
  if (!latestStatePath.startsWith(`${historyPath}/`)) {
    throw new WeaveInputError(
      `KnopInventory history ${historyPath} for ${designatorPath} points sflo:latestHistoricalState outside that history: ${latestStatePath}.`,
    );
  }
  const latestStateOrdinal = parseStateOrdinalFromPath(latestStatePath);
  if (latestStateOrdinal === undefined) {
    throw new WeaveInputError(
      `KnopInventory history ${historyPath} for ${designatorPath} uses a non-ordinal latest state and cannot be auto-advanced: ${latestStatePath}.`,
    );
  }
  const nextStateOrdinal = requireSingleNonNegativeIntegerFact(
    quads,
    meshBase,
    {
      subjectPath: historyPath,
      predicateIri: SFLO_NEXT_STATE_ORDINAL_IRI,
      missingMessage:
        `KnopInventory history ${historyPath} for ${designatorPath} is missing sflo:nextStateOrdinal.`,
      conflictMessage:
        `KnopInventory history ${historyPath} for ${designatorPath} has conflicting sflo:nextStateOrdinal facts.`,
      invalidMessage:
        `KnopInventory history ${historyPath} for ${designatorPath} has invalid sflo:nextStateOrdinal.`,
    },
  );
  if (nextStateOrdinal !== latestStateOrdinal + 1) {
    throw new WeaveInputError(
      `KnopInventory history ${historyPath} for ${designatorPath} has impossible inventory progression: latest state ${latestStatePath} and sflo:nextStateOrdinal "${nextStateOrdinal}".`,
    );
  }

  const nextStatePath = `${historyPath}/${toStateSegment(nextStateOrdinal)}`;
  if (
    hasNamedNodeFact(
      quads,
      meshBase,
      historyPath,
      SFLO_HAS_HISTORICAL_STATE_IRI,
      nextStatePath,
    ) ||
    hasSubject(quads, meshBase, nextStatePath)
  ) {
    throw new WeaveInputError(
      `KnopInventory history ${historyPath} for ${designatorPath} already has historical state ${nextStatePath}.`,
    );
  }

  return {
    historyPath,
    latestStatePath,
    latestStateOrdinal,
    latestManifestationPath: `${latestStatePath}/ttl`,
    nextStatePath,
    nextStateOrdinal,
  };
}

function resolveEffectiveKnopMetadataHistoryPolicy(
  quads: readonly Quad[],
  meshBase: string,
  knopPath: string,
  requestedPolicy: SupportArtifactHistoryPolicy | undefined,
): SupportArtifactHistoryPolicy {
  if (
    requestedPolicy !== undefined &&
    requestedPolicy !== "versioned" &&
    requestedPolicy !== "currentOnly"
  ) {
    return requestedPolicy;
  }
  if (requestedPolicy === "currentOnly") {
    return requestedPolicy;
  }

  const metadataPath = `${knopPath}/_meta`;
  if (
    hasSubject(quads, meshBase, metadataPath) &&
    !hasSubjectPredicateFact(
      quads,
      meshBase,
      metadataPath,
      SFLO_HAS_ARTIFACT_HISTORY_IRI,
    )
  ) {
    return "currentOnly";
  }

  return "versioned";
}

function resolveEffectiveKnopInventoryHistoryPolicy(
  quads: readonly Quad[],
  meshBase: string,
  designatorPath: string,
  knopPath: string,
  requestedPolicy: SupportArtifactHistoryPolicy | undefined,
): SupportArtifactHistoryPolicy {
  if (requestedPolicy === "currentOnly") {
    return requestedPolicy;
  }

  const inventoryPath = `${knopPath}/_inventory`;
  const hasCurrentHistory = hasSubjectPredicateFact(
    quads,
    meshBase,
    inventoryPath,
    SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
  );
  if (
    !hasCurrentHistory &&
    requestedPolicy !== undefined &&
    requestedPolicy !== "versioned"
  ) {
    throw new WeaveInputError(
      `Unsupported KnopInventory history policy ${requestedPolicy} for ${designatorPath}: ${inventoryPath} has no sflo:currentArtifactHistory to advance.`,
    );
  }
  if (!hasCurrentHistory) {
    return "currentOnly";
  }

  return requestedPolicy ?? "versioned";
}

function requirePayloadCurrentHistoryFact(
  quads: readonly Quad[],
  meshBase: string,
  designatorPath: string,
): string {
  return requireSingleNamedNodePathFact(quads, meshBase, {
    subjectPath: designatorPath,
    predicateIri: SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
    missingMessage:
      `Payload artifact ${designatorPath} is missing sflo:currentArtifactHistory.`,
    conflictMessage:
      `Payload artifact ${designatorPath} has conflicting sflo:currentArtifactHistory facts.`,
  });
}

function assertRequiredNamedNodeFact(
  quads: readonly Quad[],
  meshBase: string,
  subjectPath: string,
  predicateIri: string,
  objectPathOrIri: string,
  missingMessage: string,
): void {
  if (
    !hasNamedNodeFact(
      quads,
      meshBase,
      subjectPath,
      predicateIri,
      objectPathOrIri,
    )
  ) {
    throw new WeaveInputError(missingMessage);
  }
}

function requireSingleNamedNodePathFact(
  quads: readonly Quad[],
  meshBase: string,
  options: {
    subjectPath: string;
    predicateIri: string;
    missingMessage: string;
    conflictMessage: string;
  },
): string {
  const subjectIri = toAbsoluteIri(meshBase, options.subjectPath);
  const values = new Set<string>();
  for (const quad of quads) {
    if (
      quad.subject.termType === "NamedNode" &&
      quad.subject.value === subjectIri &&
      quad.predicate.value === options.predicateIri &&
      quad.object.termType === "NamedNode"
    ) {
      values.add(toMeshRelativePath(
        meshBase,
        quad.object.value,
        options
          .conflictMessage,
      ));
    }
  }

  if (values.size === 0) {
    throw new WeaveInputError(options.missingMessage);
  }
  if (values.size > 1) {
    throw new WeaveInputError(options.conflictMessage);
  }

  return values.values().next().value!;
}

function requireSingleNonNegativeIntegerFact(
  quads: readonly Quad[],
  meshBase: string,
  options: {
    subjectPath: string;
    predicateIri: string;
    missingMessage: string;
    conflictMessage: string;
    invalidMessage: string;
  },
): number {
  const subjectIri = toAbsoluteIri(meshBase, options.subjectPath);
  return requireSingleNonNegativeIntegerLiteralWithDiagnostics(
    quads,
    subjectIri,
    options.predicateIri,
    options,
  );
}

function isArtifactHistory(
  quads: readonly Quad[],
  meshBase: string,
  historyPath: string,
): boolean {
  return hasNamedNodeFact(
    quads,
    meshBase,
    historyPath,
    RDF_TYPE_IRI,
    SFLO_ARTIFACT_HISTORY_IRI,
  );
}

function parseStateOrdinalFromPath(statePath: string): number | undefined {
  const stateSegment = statePath.slice(statePath.lastIndexOf("/") + 1);
  const match = stateSegment.match(/^_s(\d+)$/);
  const parsed = match ? Number(match[1]) : Number.NaN;

  return Number.isInteger(parsed) && parsed >= 1 ? parsed : undefined;
}

function toStateSegment(stateOrdinal: number): string {
  return `_s${String(stateOrdinal).padStart(4, "0")}`;
}
