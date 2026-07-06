import { join } from "@std/path";
import {
  formatDesignatorPathForDisplay,
  toKnopPath,
} from "../../core/designator_segments.ts";
import { SFLO_NAMESPACE } from "../../core/rdf/namespaces.ts";
import {
  findUncoveredRequestedTargets,
  type NormalizedVersionTargetSpec,
} from "../../core/targeting.ts";
import {
  detectPendingWeaveSlice,
  WeaveInputError,
} from "../../core/weave/weave.ts";
import type { WeaveableKnopCandidate } from "../../core/weave/candidates.ts";
import {
  hasNamedNodeFact,
  parseWeaveShapeQuads,
} from "../../core/weave/rdf_helpers.ts";
import type { WeaveSlice } from "../../core/weave/slices.ts";
import { listKnopDesignatorPaths } from "../mesh/inventory.ts";
import type { OperationalLocalPathPolicy } from "../operational/local_path_policy.ts";
import type { RuntimeTiming } from "../timing.ts";
import {
  loadPayloadWorkingArtifact,
  loadReferenceCatalogWorkingArtifact,
  loadReferenceTargetSourcePayloadArtifact,
  loadResourcePageDefinitionArtifact,
} from "./artifact_loaders.ts";
import {
  readTextFileWithOverlay,
  TextFileOverlay,
} from "./planning_context.ts";
import { timeOptional, timeOptionalSync } from "./timing_helpers.ts";

const SFLO_HAS_PAYLOAD_ARTIFACT_IRI = `${SFLO_NAMESPACE}hasPayloadArtifact`;

export function assertRequestedTargetsAreWeaveable(
  targets: readonly NormalizedVersionTargetSpec[],
  weaveableKnops: readonly WeaveableKnopCandidate[],
): void {
  if (targets.length === 0) {
    return;
  }

  const missingTargets = findUncoveredRequestedTargets(
    targets,
    weaveableKnops.map((candidate) => candidate.designatorPath),
  );
  if (missingTargets.length === 0) {
    return;
  }

  throw new WeaveInputError(
    `Requested targets are not currently weaveable: ${
      missingTargets.map((target) =>
        target.recursive
          ? `${
            formatDesignatorPathForDisplay(target.designatorPath)
          } (recursive)`
          : formatDesignatorPathForDisplay(target.designatorPath)
      ).join(", ")
    }.`,
  );
}

export interface LoadWeaveableKnopCandidatesOptions {
  includeSettledPayloadTargets?: boolean;
}

export async function loadWeaveableKnopCandidates(
  workspaceRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  meshBase: string,
  currentMeshInventoryTurtle: string,
  requestedDesignatorPaths: readonly string[],
  targetByDesignatorPath: ReadonlyMap<
    string,
    NormalizedVersionTargetSpec | undefined
  >,
  overlay?: ReadonlyMap<string, string>,
  timing?: RuntimeTiming,
  phasePrefix = "loadCandidates",
  options?: LoadWeaveableKnopCandidatesOptions,
): Promise<readonly WeaveableKnopCandidate[]> {
  const phase = (name: string) => `${phasePrefix}.${name}`;
  const designatorPaths = timeOptionalSync(
    timing,
    phase("listDesignatorPaths"),
    () =>
      listKnopDesignatorPaths(
        meshBase,
        currentMeshInventoryTurtle,
        "Could not parse the current MeshInventory while resolving weaveable Knop candidates.",
      ),
  );
  const requested = new Set(requestedDesignatorPaths);

  const candidates: WeaveableKnopCandidate[] = [];
  for (const designatorPath of designatorPaths) {
    if (requested.size > 0 && !requested.has(designatorPath)) {
      continue;
    }

    const candidate = await timeOptional(
      timing,
      phase("candidate"),
      () =>
        overlay instanceof TextFileOverlay
          ? overlay.loadCandidate(
            designatorPath,
            () =>
              loadWeaveableKnopCandidate(
                workspaceRoot,
                localPathPolicy,
                meshBase,
                designatorPath,
                targetByDesignatorPath.get(designatorPath),
                overlay,
                timing,
                phase("candidate"),
                options,
              ),
          )
          : loadWeaveableKnopCandidate(
            workspaceRoot,
            localPathPolicy,
            meshBase,
            designatorPath,
            targetByDesignatorPath.get(designatorPath),
            overlay,
            timing,
            phase("candidate"),
            options,
          ),
    );
    if (candidate === undefined) {
      continue;
    }

    candidates.push(candidate);
  }

  return candidates.sort((left, right) =>
    left.designatorPath.localeCompare(right.designatorPath)
  );
}

async function loadWeaveableKnopCandidate(
  workspaceRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  meshBase: string,
  designatorPath: string,
  target: NormalizedVersionTargetSpec | undefined,
  overlay?: ReadonlyMap<string, string>,
  timing?: RuntimeTiming,
  phasePrefix = "candidate",
  options?: LoadWeaveableKnopCandidatesOptions,
): Promise<WeaveableKnopCandidate | undefined> {
  const phase = (name: string) => `${phasePrefix}.${name}`;
  const knopPath = toKnopPath(designatorPath);
  const metadataPath = join(workspaceRoot, `${knopPath}/_meta/meta.ttl`);
  const inventoryPath = join(
    workspaceRoot,
    `${knopPath}/_inventory/inventory.ttl`,
  );
  let currentKnopMetadataTurtle: string;
  let currentKnopInventoryTurtle: string;

  try {
    [currentKnopMetadataTurtle, currentKnopInventoryTurtle] =
      await timeOptional(
        timing,
        phase("loadKnopSupport"),
        () =>
          Promise.all([
            readTextFileWithOverlay(metadataPath, overlay),
            readTextFileWithOverlay(inventoryPath, overlay),
          ]),
      );
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return undefined;
    }
    throw error;
  }

  const candidate: WeaveableKnopCandidate = {
    designatorPath,
    currentKnopMetadataTurtle,
    currentKnopInventoryTurtle,
  };
  let slice = timeOptionalSync(
    timing,
    phase("detectPendingSlice"),
    () =>
      detectPendingWeaveSlice(
        meshBase,
        designatorPath,
        currentKnopInventoryTurtle,
        target,
      ),
  );
  if (
    slice === undefined &&
    options?.includeSettledPayloadTargets === true &&
    target !== undefined &&
    hasExplicitPayloadCandidate(
      meshBase,
      designatorPath,
      currentKnopInventoryTurtle,
    )
  ) {
    slice = "laterPayloadWeave";
  }

  if (!slice) {
    return undefined;
  }

  if (
    slice === "firstPayloadWeave" || slice === "laterPayloadWeave" ||
    slice === "firstExtractedKnopWeave"
  ) {
    candidate.payloadArtifact = await timeOptional(
      timing,
      phase("loadPayloadWorkingArtifact"),
      () =>
        loadPayloadWorkingArtifact(
          workspaceRoot,
          localPathPolicy,
          meshBase,
          designatorPath,
          currentKnopInventoryTurtle,
          overlay,
        ),
    );
  }

  if (slice === "firstReferenceCatalogWeave") {
    candidate.referenceCatalogArtifact = await timeOptional(
      timing,
      phase("loadReferenceCatalogArtifact"),
      () =>
        loadReferenceCatalogWorkingArtifact(
          workspaceRoot,
          localPathPolicy,
          meshBase,
          designatorPath,
          currentKnopInventoryTurtle,
          overlay,
        ),
    );
  }

  if (slice === "pageDefinitionWeave") {
    candidate.resourcePageDefinitionArtifact = await timeOptional(
      timing,
      phase("loadResourcePageDefinitionArtifact"),
      () =>
        loadResourcePageDefinitionArtifact(
          workspaceRoot,
          localPathPolicy,
          meshBase,
          designatorPath,
          currentKnopInventoryTurtle,
        ),
    );
  }

  if (slice === "firstExtractedKnopWeave") {
    candidate.referenceTargetSourcePayloadArtifact = await timeOptional(
      timing,
      phase("loadReferenceTargetSourceArtifact"),
      () =>
        loadReferenceTargetSourcePayloadArtifact(
          workspaceRoot,
          localPathPolicy,
          meshBase,
          designatorPath,
          currentKnopInventoryTurtle,
          overlay,
        ),
    );
  }

  return isWeaveableKnopCandidate(candidate, slice, target, options)
    ? candidate
    : undefined;
}

function hasExplicitPayloadCandidate(
  meshBase: string,
  designatorPath: string,
  currentKnopInventoryTurtle: string,
): boolean {
  const quads = parseWeaveShapeQuads(
    meshBase,
    currentKnopInventoryTurtle,
    `Could not parse the current KnopInventory while loading explicit payload target ${designatorPath}.`,
  );
  return hasNamedNodeFact(
    quads,
    meshBase,
    toKnopPath(designatorPath),
    SFLO_HAS_PAYLOAD_ARTIFACT_IRI,
    designatorPath,
  );
}

function isWeaveableKnopCandidate(
  candidate: WeaveableKnopCandidate,
  slice: WeaveSlice,
  target?: NormalizedVersionTargetSpec,
  options?: LoadWeaveableKnopCandidatesOptions,
): boolean {
  if (slice === "firstExtractedKnopWeave") {
    return candidate.referenceTargetSourcePayloadArtifact !== undefined;
  }

  if (slice === "firstReferenceCatalogWeave") {
    return candidate.referenceCatalogArtifact !== undefined;
  }

  if (slice === "pageDefinitionWeave") {
    return candidate.resourcePageDefinitionArtifact !== undefined &&
      (
        !candidate.resourcePageDefinitionArtifact
          .currentArtifactHistoryExists ||
        (
          candidate.resourcePageDefinitionArtifact
              .latestHistoricalSnapshotTurtle !==
            undefined &&
          candidate.resourcePageDefinitionArtifact
              .currentPageDefinitionTurtle !==
            candidate.resourcePageDefinitionArtifact
              .latestHistoricalSnapshotTurtle
        )
      );
  }

  if (slice === "firstPayloadWeave") {
    return candidate.payloadArtifact !== undefined;
  }

  if (slice === "laterPayloadWeave") {
    if (candidate.payloadArtifact === undefined) {
      return false;
    }
    if (
      options?.includeSettledPayloadTargets === true &&
      target !== undefined
    ) {
      return true;
    }
    return hasPayloadVersionNamingTarget(target) ||
      (candidate.payloadArtifact.latestHistoricalSnapshotTurtle !==
          undefined &&
        candidate.payloadArtifact.currentPayloadTurtle !==
          candidate.payloadArtifact.latestHistoricalSnapshotTurtle) ||
      (candidate.payloadArtifact.currentPayloadBytes !== undefined &&
        candidate.payloadArtifact.latestHistoricalSnapshotBytes !==
          undefined &&
        !bytesEqual(
          candidate.payloadArtifact.currentPayloadBytes,
          candidate.payloadArtifact.latestHistoricalSnapshotBytes,
        ));
  }

  return slice === "firstKnopWeave";
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) {
    return false;
  }
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

function hasPayloadVersionNamingTarget(
  target?: NormalizedVersionTargetSpec,
): boolean {
  return target !== undefined &&
    (target.historySegment !== undefined ||
      target.stateSegment !== undefined ||
      target.manifestationSegment !== undefined);
}
