import { type Quad } from "n3";
import {
  appendMeshPath,
  isDirectChildMeshPath,
} from "../designator_segments.ts";
import { SFCFG_NAMESPACE, SFLO_NAMESPACE } from "../rdf/namespaces.ts";
import type { NormalizedVersionTargetSpec } from "../targeting.ts";
import { isDeclaredArtifactHistory } from "./artifact_history_queries.ts";
import type { PayloadWorkingArtifact } from "./candidates.ts";
import { WeaveInputError } from "./errors.ts";
import type {
  HistoryNamingPolicy,
  ManifestationNamingPolicy,
  StateNamingPolicy,
  WeaveNamingPolicies,
} from "./naming_policy.ts";
import {
  hasSubject,
  parseWeaveShapeQuads,
  requireSingleNonNegativeIntegerLiteral,
  resolveOptionalNamedNodePath,
  resolveOptionalSegmentHint,
  toAbsoluteIri,
} from "./rdf_helpers.ts";
import { requirePayloadCurrentStatePathFromInventory } from "./artifact_history_queries.ts";
import { toArtifactManifestationPath } from "./artifact_manifestation_paths.ts";

const SFCFG_HAS_NEXT_STATE_SEGMENT_HINT_IRI =
  `${SFCFG_NAMESPACE}hasNextStateSegmentHint`;
const SFLO_HAS_MANIFESTATION_IRI = `${SFLO_NAMESPACE}hasManifestation`;
const SFLO_NEXT_STATE_ORDINAL_IRI = `${SFLO_NAMESPACE}nextStateOrdinal`;

export interface PayloadVersionLayout {
  historyPath: string;
  isNewHistory?: boolean;
  currentStatePath?: string;
  currentManifestationPath?: string;
  previousStatePath?: string;
  nextStatePath: string;
  nextManifestationPath: string;
  nextStateOrdinal?: number;
}

export function resolveFirstPayloadVersionLayout(
  meshBase: string,
  designatorPath: string,
  workingLocalRelativePath: string,
  currentKnopInventoryTurtle: string,
  currentArtifactHistoryPath?: string,
  target?: NormalizedVersionTargetSpec,
  namingPolicies?: WeaveNamingPolicies,
): PayloadVersionLayout {
  const historyPath = target?.historySegment
    ? appendMeshPath(designatorPath, target.historySegment)
    : currentArtifactHistoryPath ??
      appendMeshPath(
        designatorPath,
        defaultHistorySegment(namingPolicies?.historyNamingPolicy),
      );
  if (!isDirectChildMeshPath(designatorPath, historyPath)) {
    throw new WeaveInputError(
      `Current payload history for ${designatorPath} was outside the payload designator path: ${historyPath}`,
    );
  }
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentKnopInventoryTurtle,
    `Could not parse the current KnopInventory while resolving payload history intent for ${designatorPath}.`,
  );
  const nextStateSegmentHint = resolveOptionalSegmentHint(
    quads,
    toAbsoluteIri(meshBase, historyPath),
    SFCFG_HAS_NEXT_STATE_SEGMENT_HINT_IRI,
    `Could not resolve the next payload state intent for ${designatorPath}.`,
  );
  const requestedStateSegment = target?.stateSegment ?? nextStateSegmentHint;
  assertRequestedStateSegmentSatisfiesPolicy(
    requestedStateSegment,
    namingPolicies?.stateNamingPolicy,
  );
  const nextStatePath = `${historyPath}/${
    requestedStateSegment ??
      defaultStateSegment(namingPolicies?.stateNamingPolicy)
  }`;
  const nextManifestationPath = toPayloadManifestationPath(
    nextStatePath,
    workingLocalRelativePath,
    target?.manifestationSegment,
    namingPolicies?.manifestationNamingPolicy,
  );

  return {
    historyPath,
    nextStatePath,
    nextManifestationPath,
  };
}

export function resolveLaterPayloadVersionLayout(
  meshBase: string,
  designatorPath: string,
  payloadArtifact: PayloadWorkingArtifact,
  currentKnopInventoryTurtle: string,
  target?: NormalizedVersionTargetSpec,
  namingPolicies?: WeaveNamingPolicies,
): PayloadVersionLayout {
  assertRequestedStateSegmentSatisfiesPolicy(
    target?.stateSegment,
    namingPolicies?.stateNamingPolicy,
  );
  const currentHistoryPath = requirePayloadHistoryPath(
    designatorPath,
    payloadArtifact,
  );
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentKnopInventoryTurtle,
    `Could not parse the current KnopInventory while resolving payload histories for ${designatorPath}.`,
  );
  const historyPath = target?.historySegment
    ? appendMeshPath(designatorPath, target.historySegment)
    : currentHistoryPath;
  if (!isDirectChildMeshPath(designatorPath, historyPath)) {
    throw new WeaveInputError(
      `Requested payload historySegment ${
        target?.historySegment ?? toLastPathSegment(historyPath)
      } was outside the payload designator path for ${designatorPath}.`,
    );
  }

  const historyExists = isDeclaredArtifactHistory(quads, meshBase, historyPath);
  const nextStateSegmentHint = resolveOptionalSegmentHint(
    quads,
    toAbsoluteIri(meshBase, historyPath),
    SFCFG_HAS_NEXT_STATE_SEGMENT_HINT_IRI,
    `Could not resolve the next payload state intent for ${designatorPath}.`,
  );
  if (!historyExists) {
    const requestedStateSegment = target?.stateSegment ?? nextStateSegmentHint;
    assertRequestedStateSegmentSatisfiesPolicy(
      requestedStateSegment,
      namingPolicies?.stateNamingPolicy,
    );
    const nextStatePath = `${historyPath}/${
      requestedStateSegment ??
        defaultStateSegment(namingPolicies?.stateNamingPolicy)
    }`;
    const nextManifestationPath = toPayloadManifestationPath(
      nextStatePath,
      payloadArtifact.workingLocalRelativePath,
      target?.manifestationSegment,
      namingPolicies?.manifestationNamingPolicy,
    );
    return {
      historyPath,
      isNewHistory: true,
      nextStatePath,
      nextManifestationPath,
      nextStateOrdinal: parseOptionalStateOrdinalFromPath(nextStatePath),
    };
  }

  const currentStatePath = requirePayloadCurrentStatePathFromInventory(
    quads,
    meshBase,
    designatorPath,
    historyPath,
    `Could not resolve the current payload historical state for ${designatorPath} in ${historyPath}.`,
    {
      missingMessage:
        `Payload history ${historyPath} for ${designatorPath} is missing sflo:latestHistoricalState.`,
      conflictMessage:
        `Payload history ${historyPath} for ${designatorPath} has conflicting sflo:latestHistoricalState facts.`,
    },
  );
  const currentManifestationPath =
    resolveCurrentPayloadManifestationPathFromInventory(
      quads,
      meshBase,
      designatorPath,
      currentStatePath,
    );
  if (
    target?.stateSegment === undefined &&
    nextStateSegmentHint === undefined &&
    parseOptionalStateOrdinalFromPath(currentStatePath) === undefined
  ) {
    throw new WeaveInputError(
      `Cannot auto-version payload artifact ${
        formatDesignatorPathForDisplay(designatorPath)
      } because current payload history ${historyPath} uses named historical state ${currentStatePath}. Provide stateSegment on the target, or explicitly request ordinal fallback with stateSegment=${
        toStateSegment(1)
      }.`,
    );
  }
  const requestedStateSegment = target?.stateSegment ?? nextStateSegmentHint;
  assertRequestedStateSegmentSatisfiesPolicy(
    requestedStateSegment,
    namingPolicies?.stateNamingPolicy,
  );
  if (requestedStateSegment === undefined) {
    assertAutoStateSegmentSupported(namingPolicies?.stateNamingPolicy);
  }
  const nextStatePath = requestedStateSegment
    ? `${historyPath}/${requestedStateSegment}`
    : resolveNextOrdinalStatePathFromHistory(
      quads,
      meshBase,
      historyPath,
      `Could not resolve the next payload historical state for ${designatorPath} in ${historyPath}.`,
      {
        missingMessage:
          `Payload history ${historyPath} for ${designatorPath} is missing sflo:nextStateOrdinal.`,
        conflictMessage:
          `Payload history ${historyPath} for ${designatorPath} has conflicting sflo:nextStateOrdinal facts.`,
        invalidMessage:
          `Payload history ${historyPath} for ${designatorPath} has invalid sflo:nextStateOrdinal.`,
      },
    );
  if (nextStatePath === currentStatePath) {
    throw new WeaveInputError(
      `Requested payload stateSegment ${
        toLastPathSegment(nextStatePath)
      } already names the current historical state for ${designatorPath}.`,
    );
  }
  if (hasSubject(quads, meshBase, nextStatePath)) {
    throw new WeaveInputError(
      `Requested payload stateSegment ${
        toLastPathSegment(nextStatePath)
      } already exists for ${designatorPath}.`,
    );
  }
  const nextManifestationPath = toPayloadManifestationPath(
    nextStatePath,
    payloadArtifact.workingLocalRelativePath,
    target?.manifestationSegment,
    namingPolicies?.manifestationNamingPolicy,
  );

  return {
    historyPath,
    currentStatePath,
    currentManifestationPath,
    previousStatePath: currentStatePath,
    nextStatePath,
    nextManifestationPath,
    nextStateOrdinal: parseOptionalStateOrdinalFromPath(nextStatePath),
  };
}

export function toPayloadManifestationPath(
  payloadStatePath: string,
  workingLocalRelativePath: string,
  manifestationSegment?: string,
  manifestationNamingPolicy?: ManifestationNamingPolicy,
): string {
  return toArtifactManifestationPath(
    payloadStatePath,
    workingLocalRelativePath,
    manifestationSegment,
    manifestationNamingPolicy,
  );
}

export function assertRequestedStateSegmentSatisfiesPolicy(
  stateSegment: string | undefined,
  stateNamingPolicy: StateNamingPolicy = "ordinal",
): void {
  if (stateSegment === undefined) {
    return;
  }

  switch (stateNamingPolicy) {
    case "ordinal":
      return;
    case "semver":
      if (/^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(stateSegment)) {
        return;
      }
      throw new WeaveInputError(
        `stateSegment ${stateSegment} does not satisfy stateNamingPolicy semver.`,
      );
    case "date":
      if (/^\d{4}-\d{2}-\d{2}$/.test(stateSegment)) {
        return;
      }
      throw new WeaveInputError(
        `stateSegment ${stateSegment} does not satisfy stateNamingPolicy date.`,
      );
  }
}

export function resolveCurrentPayloadManifestationPathFromInventory(
  quads: readonly Quad[],
  meshBase: string,
  designatorPath: string,
  currentStatePath: string,
): string {
  const errorMessage =
    `Could not resolve the current payload manifestation for ${designatorPath}.`;
  const manifestationPath = resolveOptionalNamedNodePath(
    quads,
    meshBase,
    currentStatePath,
    SFLO_HAS_MANIFESTATION_IRI,
    errorMessage,
  );
  if (manifestationPath) {
    return manifestationPath;
  }
  const locatedFilePath = resolveOptionalNamedNodePath(
    quads,
    meshBase,
    currentStatePath,
    `${SFLO_NAMESPACE}locatedFileForState`,
    errorMessage,
  );
  if (!locatedFilePath) {
    throw new WeaveInputError(errorMessage);
  }

  return toParentPath(locatedFilePath);
}

export function requirePayloadHistoryPath(
  designatorPath: string,
  payloadArtifact: PayloadWorkingArtifact,
): string {
  const historyPath = payloadArtifact.currentArtifactHistoryPath;
  if (!historyPath) {
    throw new WeaveInputError(
      `Could not resolve the current payload history for ${designatorPath}.`,
    );
  }
  if (!isDirectChildMeshPath(designatorPath, historyPath)) {
    throw new WeaveInputError(
      `Current payload history for ${designatorPath} was outside the payload designator path: ${historyPath}`,
    );
  }

  return historyPath;
}

export function requirePayloadCurrentStatePath(
  designatorPath: string,
  payloadArtifact: PayloadWorkingArtifact,
  historyPath: string,
): string {
  const currentStatePath = payloadArtifact.latestHistoricalStatePath;
  if (!currentStatePath) {
    throw new WeaveInputError(
      `Could not resolve the current payload historical state for ${designatorPath}.`,
    );
  }
  if (!currentStatePath.startsWith(`${historyPath}/`)) {
    throw new WeaveInputError(
      `Current payload historical state for ${designatorPath} was outside the current payload history: ${currentStatePath}`,
    );
  }

  return currentStatePath;
}

function defaultHistorySegment(
  historyNamingPolicy: HistoryNamingPolicy = "ordinal",
): string {
  switch (historyNamingPolicy) {
    case "ordinal":
      return "_history001";
    case "named":
      throw new WeaveInputError(
        "historyNamingPolicy named requires an explicit historySegment.",
      );
  }
}

function defaultStateSegment(
  stateNamingPolicy: StateNamingPolicy = "ordinal",
): string {
  switch (stateNamingPolicy) {
    case "ordinal":
      return "_s0001";
    case "semver":
    case "date":
      throw new WeaveInputError(
        `stateNamingPolicy ${stateNamingPolicy} requires an explicit stateSegment.`,
      );
  }
}

function assertAutoStateSegmentSupported(
  stateNamingPolicy: StateNamingPolicy = "ordinal",
): void {
  switch (stateNamingPolicy) {
    case "ordinal":
      return;
    case "semver":
    case "date":
      throw new WeaveInputError(
        `stateNamingPolicy ${stateNamingPolicy} requires an explicit stateSegment.`,
      );
  }
}

function resolveNextOrdinalStatePathFromHistory(
  quads: readonly Quad[],
  meshBase: string,
  historyPath: string,
  errorMessage: string,
  diagnostics?: {
    missingMessage?: string;
    conflictMessage?: string;
    invalidMessage?: string;
  },
): string {
  const nextStateOrdinal = diagnostics === undefined
    ? requireSingleNonNegativeIntegerLiteral(
      quads,
      toAbsoluteIri(meshBase, historyPath),
      SFLO_NEXT_STATE_ORDINAL_IRI,
      errorMessage,
    )
    : requireSingleNonNegativeIntegerLiteralWithDiagnostics(
      quads,
      toAbsoluteIri(meshBase, historyPath),
      SFLO_NEXT_STATE_ORDINAL_IRI,
      diagnostics,
    );
  if (nextStateOrdinal < 1) {
    throw new WeaveInputError(diagnostics?.invalidMessage ?? errorMessage);
  }

  return `${historyPath}/${toStateSegment(nextStateOrdinal)}`;
}

function requireSingleNonNegativeIntegerLiteralWithDiagnostics(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
  diagnostics: {
    missingMessage?: string;
    conflictMessage?: string;
    invalidMessage?: string;
  },
): number {
  const values = new Set<string>();
  for (const quad of quads) {
    if (
      quad.subject.termType === "NamedNode" &&
      quad.subject.value === subjectIri &&
      quad.predicate.value === predicateIri &&
      quad.object.termType === "Literal" &&
      quad.object.datatype.value ===
        "http://www.w3.org/2001/XMLSchema#nonNegativeInteger"
    ) {
      values.add(quad.object.value);
    }
  }

  if (values.size === 0) {
    throw new WeaveInputError(
      diagnostics.missingMessage ?? "Missing non-negative integer literal.",
    );
  }
  if (values.size > 1) {
    throw new WeaveInputError(
      diagnostics.conflictMessage ??
        "Conflicting non-negative integer literal facts.",
    );
  }

  const parsed = Number(values.values().next().value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new WeaveInputError(
      diagnostics.invalidMessage ?? "Invalid non-negative integer literal.",
    );
  }

  return parsed;
}

function parseOptionalStateOrdinalFromPath(
  statePath: string,
): number | undefined {
  const match = toLastPathSegment(statePath).match(/^_s(\d+)$/);
  const parsed = match ? Number(match[1]) : Number.NaN;

  return Number.isInteger(parsed) && parsed >= 1 ? parsed : undefined;
}

function toStateSegment(stateOrdinal: number): string {
  return `_s${String(stateOrdinal).padStart(4, "0")}`;
}

function toParentPath(path: string): string {
  const separatorIndex = path.lastIndexOf("/");
  if (separatorIndex < 0) {
    return "";
  }
  return path.slice(0, separatorIndex);
}

function toLastPathSegment(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function formatDesignatorPathForDisplay(designatorPath: string): string {
  return designatorPath.length === 0 ? "<root>" : designatorPath;
}
