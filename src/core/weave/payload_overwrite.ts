import {
  appendMeshPath,
  isDirectChildMeshPath,
} from "../designator_segments.ts";
import { SFLO_NAMESPACE } from "../rdf/namespaces.ts";
import type { NormalizedVersionTargetSpec } from "../targeting.ts";
import { isDeclaredArtifactHistory } from "./artifact_history_queries.ts";
import type { WeaveableKnopCandidate } from "./candidates.ts";
import { WeaveInputError } from "./errors.ts";
import type { WeaveNamingPolicies } from "./naming_policy.ts";
import type { WeavePlan } from "./planning_models.ts";
import { hasNamedNodeFact, parseWeaveShapeQuads } from "./rdf_helpers.ts";
import { requirePayloadCurrentStatePathFromInventory } from "./artifact_history_queries.ts";
import {
  assertRequestedStateSegmentSatisfiesPolicy,
  resolveCurrentPayloadManifestationPathFromInventory,
  toPayloadManifestationPath,
} from "./payload_version_layout.ts";

const SFLO_HAS_HISTORICAL_STATE_IRI = `${SFLO_NAMESPACE}hasHistoricalState`;

export function assertOverwriteExistingStateTargets(
  targets: readonly NormalizedVersionTargetSpec[],
  overwriteExistingState: boolean,
): void {
  if (!overwriteExistingState) {
    return;
  }
  if (targets.length === 0) {
    throw new WeaveInputError(
      "overwriteExistingState requires at least one explicit target.",
    );
  }

  targets.forEach((target, index) => {
    const fieldName = `request.targets[${index}]`;
    if (target.recursive) {
      throw new WeaveInputError(
        `overwriteExistingState requires exact targets; ${fieldName}.recursive must not be true.`,
      );
    }
    if (target.historySegment === undefined) {
      throw new WeaveInputError(
        `overwriteExistingState requires ${fieldName}.historySegment.`,
      );
    }
    if (target.stateSegment === undefined) {
      throw new WeaveInputError(
        `overwriteExistingState requires ${fieldName}.stateSegment.`,
      );
    }
  });
}

export function planOverwriteExistingPayloadState(
  meshBase: string,
  candidate: WeaveableKnopCandidate,
  target: NormalizedVersionTargetSpec | undefined,
  namingPolicies?: WeaveNamingPolicies,
): WeavePlan {
  if (!target || !target.historySegment || !target.stateSegment) {
    throw new WeaveInputError(
      "overwriteExistingState requires an explicit payload historySegment and stateSegment.",
    );
  }
  const payloadArtifact = candidate.payloadArtifact;
  if (!payloadArtifact) {
    throw new WeaveInputError(
      `overwriteExistingState only supports payload version targets; ${candidate.designatorPath} is not a payload overwrite candidate.`,
    );
  }

  const designatorPath = candidate.designatorPath;
  assertRequestedStateSegmentSatisfiesPolicy(
    target.stateSegment,
    namingPolicies?.stateNamingPolicy,
  );

  const historyPath = appendMeshPath(designatorPath, target.historySegment);
  if (!isDirectChildMeshPath(designatorPath, historyPath)) {
    throw new WeaveInputError(
      `Requested payload historySegment ${target.historySegment} was outside the payload designator path for ${designatorPath}.`,
    );
  }
  const statePath = `${historyPath}/${target.stateSegment}`;
  const quads = parseWeaveShapeQuads(
    meshBase,
    candidate.currentKnopInventoryTurtle,
    `Could not parse the current KnopInventory while resolving overwrite state for ${designatorPath}.`,
  );

  if (!isDeclaredArtifactHistory(quads, meshBase, historyPath)) {
    throw new WeaveInputError(
      `Cannot overwrite payload state ${statePath} for ${designatorPath} because the requested history does not exist.`,
    );
  }
  if (
    !hasNamedNodeFact(
      quads,
      meshBase,
      historyPath,
      SFLO_HAS_HISTORICAL_STATE_IRI,
      statePath,
    )
  ) {
    throw new WeaveInputError(
      `Cannot overwrite payload state ${statePath} for ${designatorPath} because the requested state does not exist.`,
    );
  }

  const currentStatePath = requirePayloadCurrentStatePathFromInventory(
    quads,
    meshBase,
    designatorPath,
    historyPath,
    `Could not resolve the current payload historical state for ${designatorPath} in ${historyPath}.`,
  );
  if (statePath !== currentStatePath) {
    throw new WeaveInputError(
      `overwriteExistingState only supports the current payload historical state for ${designatorPath}; requested ${statePath} but current is ${currentStatePath}.`,
    );
  }

  const existingManifestationPath =
    resolveCurrentPayloadManifestationPathFromInventory(
      quads,
      meshBase,
      designatorPath,
      statePath,
    );
  if (target.manifestationSegment !== undefined) {
    const requestedManifestationPath = toPayloadManifestationPath(
      statePath,
      payloadArtifact.workingLocalRelativePath,
      target.manifestationSegment,
      namingPolicies?.manifestationNamingPolicy,
    );
    if (requestedManifestationPath !== existingManifestationPath) {
      throw new WeaveInputError(
        `Requested payload manifestationSegment ${target.manifestationSegment} does not match existing manifestation ${existingManifestationPath} for ${designatorPath}.`,
      );
    }
  }

  const payloadSnapshotPath = `${existingManifestationPath}/${
    toFileName(payloadArtifact.workingLocalRelativePath)
  }`;
  return {
    meshBase,
    wovenDesignatorPaths: [designatorPath],
    createdFiles: [],
    updatedFiles: [{
      path: payloadSnapshotPath,
      contents: payloadArtifact.currentPayloadTurtle,
    }],
    createdPages: [],
  };
}

function toFileName(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1]!;
}
