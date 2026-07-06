import { dirname, join, relative } from "@std/path";
import { Parser } from "n3";
import type {
  PlannedBinaryFile,
  PlannedFile,
} from "../../core/planned_file.ts";
import { toKnopPath } from "../../core/designator_segments.ts";
import {
  type NormalizedVersionTargetSpec,
  resolveTargetSelections,
} from "../../core/targeting.ts";
import type { WeaveableKnopCandidate } from "../../core/weave/candidates.ts";
import {
  detectPendingWeaveSlice,
  planMeshSupportResourcePages,
  planVersion,
  type VersionPlan,
  WeaveInputError,
} from "../../core/weave/weave.ts";
import {
  listKnopDesignatorPaths,
  resolvePayloadArtifactInventoryState,
} from "../mesh/inventory.ts";
import type {
  EffectiveConfig,
  HistoryTrackingPolicy,
} from "../config/effective_config.ts";
import {
  LocalPathAccessError,
  type OperationalLocalPathPolicy,
  resolveAllowedLocalPath,
  resolveRepositorySourceFloatingLocalPath,
} from "../operational/local_path_policy.ts";
import type { RuntimeTiming } from "../timing.ts";
import {
  assertRequestedTargetsAreWeaveable,
  loadWeaveableKnopCandidates,
} from "./candidate_loader.ts";
import {
  createEffectiveConfigProviderForExecution,
  type EffectiveConfigProvider,
  namingPoliciesFromEffectiveConfig,
  resourcePageGenerationConfigFromScopedEffectiveConfigs,
  resourcePageGenerationPoliciesFromEffectiveConfig,
  resourcePageGenerationPoliciesFromScopedEffectiveConfigs,
  supportHistoryPoliciesFromEffectiveConfig,
  supportHistoryPoliciesFromScopedEffectiveConfigs,
} from "./execution_config.ts";
import { WeaveRuntimeError } from "./errors.ts";
import {
  ensureWorkspaceRootExists,
  loadMeshState,
  type MeshState,
} from "./mesh_state.ts";
import {
  applyPlannedFilesToOverlay,
  TextFileOverlay,
} from "./planning_context.ts";
import type { WeaveProgressHandler } from "./progress.ts";
import { timeOptional, timeOptionalSync } from "./timing_helpers.ts";
import { toWorkspaceRelativePath } from "./workspace_paths.ts";

export interface PreparedVersionExecution {
  meshState: MeshState;
  plan: VersionPlan;
}

export interface InputSnapshotVerificationHooks {
  afterInitialHash?: () => Promise<void> | void;
  afterVerifiedCapture?: () => Promise<void> | void;
}

export interface PreparedVersionWriteResult {
  meshBase: string;
  versionedDesignatorPaths: readonly string[];
  createdPaths: readonly string[];
  updatedPaths: readonly string[];
}

export async function prepareVersionExecution(
  workspaceRoot: string,
  targets: readonly NormalizedVersionTargetSpec[],
  localPathPolicy: OperationalLocalPathPolicy,
  overwriteExistingState = false,
  historyTrackingPolicyOverride?: HistoryTrackingPolicy,
  onProgress?: WeaveProgressHandler,
  timing?: RuntimeTiming,
  inputSnapshotVerification?: InputSnapshotVerificationHooks,
): Promise<PreparedVersionExecution> {
  await timeOptional(
    timing,
    "prepare.ensureWorkspaceRoot",
    () => ensureWorkspaceRootExists(workspaceRoot),
  );
  const meshState = await timeOptional(
    timing,
    "prepare.loadMeshState",
    () => loadMeshState(workspaceRoot),
  );
  const allDesignatorPaths = timeOptionalSync(
    timing,
    "prepare.listDesignatorPaths",
    () =>
      listKnopDesignatorPaths(
        meshState.meshBase,
        meshState.currentMeshInventoryTurtle,
        "Could not parse the current MeshInventory while resolving weaveable Knop candidates.",
      ),
  );
  const resolvedTargets = timeOptionalSync(
    timing,
    "prepare.resolveTargets",
    () =>
      targets.length === 0 ? [] : resolveTargetSelections(
        allDesignatorPaths,
        targets,
        (message) => new WeaveInputError(message),
      ),
  );
  timing?.setField("knownDesignatorPaths", allDesignatorPaths.length);
  timing?.setField("requestedTargets", targets.length);
  timing?.setField("resolvedTargets", resolvedTargets.length);
  const requestedDesignatorPaths = resolvedTargets.map((selection) =>
    selection.designatorPath
  );
  const targetByDesignatorPath = new Map(
    resolvedTargets.map((selection) => [
      selection.designatorPath,
      selection.target as NormalizedVersionTargetSpec | undefined,
    ]),
  );
  const shouldAttemptPayloadBatch = shouldAttemptExplicitPayloadBatch(
    targets,
    overwriteExistingState,
  );
  const inputSnapshot = shouldAttemptPayloadBatch
    ? await timeOptional(
      timing,
      "prepare.snapshotPayloadInputs.hash",
      () =>
        createPayloadBatchWorkingFileSnapshot({
          workspaceRoot,
          localPathPolicy,
          meshBase: meshState.meshBase,
          requestedDesignatorPaths,
        }),
    )
    : undefined;
  if (inputSnapshot !== undefined) {
    await inputSnapshotVerification?.afterInitialHash?.();
  }
  const overlay = new TextFileOverlay();
  const initialWeaveableKnops = await timeOptional(
    timing,
    "prepare.loadInitialCandidates",
    () =>
      loadWeaveableKnopCandidates(
        workspaceRoot,
        localPathPolicy,
        meshState.meshBase,
        meshState.currentMeshInventoryTurtle,
        requestedDesignatorPaths,
        targetByDesignatorPath,
        overlay,
        timing,
        "prepare.loadInitialCandidates",
      ),
  );
  timing?.setField("initialWeaveableKnops", initialWeaveableKnops.length);
  const payloadBatchCandidates = shouldAttemptPayloadBatch
    ? await timeOptional(
      timing,
      "prepare.loadPayloadBatchCandidates",
      () =>
        loadWeaveableKnopCandidates(
          workspaceRoot,
          localPathPolicy,
          meshState.meshBase,
          meshState.currentMeshInventoryTurtle,
          requestedDesignatorPaths,
          targetByDesignatorPath,
          undefined,
          timing,
          "prepare.loadPayloadBatchCandidates",
          { includeSettledPayloadTargets: true },
        ),
    )
    : [];
  timing?.setField("payloadBatchCandidates", payloadBatchCandidates.length);
  if (inputSnapshot !== undefined) {
    await timeOptional(
      timing,
      "prepare.snapshotPayloadInputs.verify",
      () => inputSnapshot.verify(),
    );
    await inputSnapshotVerification?.afterVerifiedCapture?.();
  }
  const configCandidateKnops = payloadBatchCandidates.length > 0
    ? payloadBatchCandidates
    : initialWeaveableKnops;
  const targetMetadataTurtleByDesignatorPath = new Map(
    configCandidateKnops.map((candidate) => [
      candidate.designatorPath,
      candidate.currentKnopMetadataTurtle,
    ]),
  );
  const effectiveConfigProvider = createEffectiveConfigProviderForExecution({
    meshRoot: workspaceRoot,
    meshState,
    localPathPolicy,
    targetMetadataTurtleByDesignatorPath,
    historyTrackingPolicyOverride,
    timing,
    phasePrefix: "prepare.effectiveConfig",
  });
  const meshEffectiveConfig = await effectiveConfigProvider
    .configForMeshScope();

  if (
    payloadBatchCandidates.length > 0 &&
    isExplicitPayloadBatch(
      meshState.meshBase,
      payloadBatchCandidates,
      targetByDesignatorPath,
    )
  ) {
    assertRequestedTargetsAreWeaveable(targets, payloadBatchCandidates);
    const batchPlan = await timeOptional(
      timing,
      "prepare.planPayloadBatch",
      () =>
        planExplicitPayloadBatchVersion(
          meshState,
          payloadBatchCandidates,
          targetByDesignatorPath,
          meshEffectiveConfig,
          effectiveConfigProvider,
          overwriteExistingState,
          timing,
        ),
    );
    for (
      const [index, designatorPath] of batchPlan.versionedDesignatorPaths
        .entries()
    ) {
      onProgress?.({
        designatorPath,
        completed: index + 1,
        total: batchPlan.versionedDesignatorPaths.length,
        percent: batchPlan.versionedDesignatorPaths.length === 0
          ? 100
          : Math.round(
            ((index + 1) / batchPlan.versionedDesignatorPaths.length) * 100,
          ),
      });
    }
    return { meshState, plan: batchPlan };
  }

  assertRequestedTargetsAreWeaveable(
    targets,
    initialWeaveableKnops,
  );

  if (initialWeaveableKnops.length === 0) {
    if (targets.length === 0) {
      const supportHistoryPolicies = supportHistoryPoliciesFromEffectiveConfig(
        meshEffectiveConfig,
      );
      const resourcePageGenerationPolicies =
        resourcePageGenerationPoliciesFromEffectiveConfig(meshEffectiveConfig);
      return {
        meshState,
        plan: planMeshSupportResourcePages({
          meshBase: meshState.meshBase,
          currentMeshInventoryTurtle: meshState.currentMeshInventoryTurtle,
          currentMeshMetadataTurtle: meshState.currentMeshMetadataTurtle,
          currentMeshConfigTurtle: meshState.currentMeshConfigTurtle,
          supportHistoryPolicies,
          resourcePageGenerationConfig: meshEffectiveConfig,
          resourcePageGenerationPolicies,
        }),
      };
    }
    throw new WeaveInputError(
      "Requested targets did not match any weave candidates.",
    );
  }

  const remainingDesignatorPaths = initialWeaveableKnops.map((candidate) =>
    candidate.designatorPath
  );
  const createdFiles: PlannedFile[] = [];
  const createdBinaryFiles: PlannedBinaryFile[] = [];
  const createdPaths = new Set<string>();
  const updatedFileByPath = new Map<string, PlannedFile>();
  const updatedPathOrder: string[] = [];
  const versionedDesignatorPaths: string[] = [];

  while (remainingDesignatorPaths.length > 0) {
    const stagedMeshState = await timeOptional(
      timing,
      "prepare.loop.loadMeshState",
      () => loadMeshState(workspaceRoot, overlay),
    );
    const stagedWeaveableKnops = await timeOptional(
      timing,
      "prepare.loop.loadCandidates",
      () =>
        loadWeaveableKnopCandidates(
          workspaceRoot,
          localPathPolicy,
          stagedMeshState.meshBase,
          stagedMeshState.currentMeshInventoryTurtle,
          remainingDesignatorPaths,
          targetByDesignatorPath,
          overlay,
          timing,
          "prepare.loop.loadCandidates",
        ),
    );

    if (stagedWeaveableKnops.length === 0) {
      throw new WeaveInputError(
        `Recursive version planning could not continue cleanly for the remaining targets: ${
          remainingDesignatorPaths.join(", ")
        }.`,
      );
    }

    const nextCandidate = stagedWeaveableKnops[0]!;
    const nextDesignatorPath = nextCandidate.designatorPath;
    const target = targetByDesignatorPath.get(nextDesignatorPath);
    const targetEffectiveConfig = await effectiveConfigProvider
      .configForTarget(nextDesignatorPath);
    const supportHistoryPolicies =
      supportHistoryPoliciesFromScopedEffectiveConfigs(
        meshEffectiveConfig,
        targetEffectiveConfig,
      );
    const namingPolicies = namingPoliciesFromEffectiveConfig(
      targetEffectiveConfig,
    );
    const resourcePageGenerationConfig =
      resourcePageGenerationConfigFromScopedEffectiveConfigs(
        meshEffectiveConfig,
        targetEffectiveConfig,
      );
    const resourcePageGenerationPolicies =
      resourcePageGenerationPoliciesFromScopedEffectiveConfigs(
        meshEffectiveConfig,
        targetEffectiveConfig,
      );
    const nextPlan = timeOptionalSync(
      timing,
      "prepare.loop.planVersion",
      () =>
        planVersion({
          request: {
            ...(target ? { targets: [{ ...target.source }] } : {}),
            ...(overwriteExistingState ? { overwriteExistingState } : {}),
          },
          meshBase: stagedMeshState.meshBase,
          currentMeshInventoryTurtle:
            stagedMeshState.currentMeshInventoryTurtle,
          currentMeshMetadataTurtle: stagedMeshState.currentMeshMetadataTurtle,
          weaveableKnops: [nextCandidate],
          supportHistoryPolicies,
          namingPolicies,
          resourcePageGenerationConfig,
          resourcePageGenerationPolicies,
        }),
    );

    for (const file of nextPlan.createdFiles) {
      if (createdPaths.has(file.path) || updatedFileByPath.has(file.path)) {
        throw new WeaveInputError(
          `Recursive version planning produced a conflicting created file: ${file.path}`,
        );
      }
      createdFiles.push(file);
      createdPaths.add(file.path);
    }
    for (const file of nextPlan.createdBinaryFiles ?? []) {
      if (createdPaths.has(file.path) || updatedFileByPath.has(file.path)) {
        throw new WeaveInputError(
          `Recursive version planning produced a conflicting created file: ${file.path}`,
        );
      }
      createdBinaryFiles.push(file);
      createdPaths.add(file.path);
    }

    for (const file of nextPlan.updatedFiles) {
      if (createdPaths.has(file.path)) {
        throw new WeaveInputError(
          `Recursive version planning attempted to update a newly created file: ${file.path}`,
        );
      }
      if (!updatedFileByPath.has(file.path)) {
        updatedPathOrder.push(file.path);
      }
      updatedFileByPath.set(file.path, file);
    }

    versionedDesignatorPaths.push(...nextPlan.versionedDesignatorPaths);
    applyPlannedFilesToOverlay(workspaceRoot, overlay, nextPlan.createdFiles);
    applyPlannedFilesToOverlay(workspaceRoot, overlay, nextPlan.updatedFiles);

    const completedPath = nextPlan.versionedDesignatorPaths[0]!;
    const completedIndex = remainingDesignatorPaths.indexOf(completedPath);
    if (completedIndex < 0) {
      throw new WeaveInputError(
        `Recursive version planning lost track of ${completedPath}.`,
      );
    }
    remainingDesignatorPaths.splice(completedIndex, 1);

    const completed = versionedDesignatorPaths.length;
    onProgress?.({
      designatorPath: completedPath,
      completed,
      total: initialWeaveableKnops.length,
      percent: Math.round((completed / initialWeaveableKnops.length) * 100),
    });
  }

  const plan: VersionPlan = {
    meshBase: meshState.meshBase,
    versionedDesignatorPaths,
    createdFiles,
    ...(createdBinaryFiles.length > 0 ? { createdBinaryFiles } : {}),
    updatedFiles: updatedPathOrder.map((path) => updatedFileByPath.get(path)!),
  };

  timing?.setField("cachedReadFiles", overlay.readCount);
  timing?.setField("readCacheHits", overlay.cacheHitCount);
  timing?.setField("stagedReadHits", overlay.stagedHitCount);
  timing?.setField("candidateCacheHits", overlay.candidateCacheHitCount);
  timing?.setField("candidateCacheStores", overlay.candidateCacheStoreCount);
  timing?.setField(
    "candidateCacheInvalidations",
    overlay.candidateCacheInvalidationCount,
  );

  return {
    meshState,
    plan,
  };
}

interface PayloadBatchWorkingFileSnapshot {
  verify(): Promise<void>;
}

async function createPayloadBatchWorkingFileSnapshot(
  options: {
    workspaceRoot: string;
    localPathPolicy: OperationalLocalPathPolicy;
    meshBase: string;
    requestedDesignatorPaths: readonly string[];
  },
): Promise<PayloadBatchWorkingFileSnapshot> {
  const entryByAbsolutePath = new Map<
    string,
    { displayPath: string; digest: string }
  >();

  for (const designatorPath of options.requestedDesignatorPaths) {
    const inventoryPath = join(
      options.workspaceRoot,
      `${toKnopPath(designatorPath)}/_inventory/inventory.ttl`,
    );
    let inventoryTurtle: string;
    try {
      inventoryTurtle = await Deno.readTextFile(inventoryPath);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        continue;
      }
      throw error;
    }

    const payloadArtifact = resolvePayloadArtifactInventoryState(
      options.meshBase,
      inventoryTurtle,
      designatorPath,
      {
        parseErrorMessage:
          `Could not parse the current Knop inventory while resolving the payload artifact for ${designatorPath}.`,
        missingWorkingFileMessage:
          `Could not resolve the working payload file for ${designatorPath}.`,
      },
    );
    if (payloadArtifact === undefined) {
      continue;
    }

    let absolutePath: string;
    try {
      absolutePath = payloadArtifact.repositorySourceFloatingLocator
        ? await resolveRepositorySourceFloatingLocalPath(
          options.localPathPolicy,
          payloadArtifact.repositorySourceFloatingLocator,
        )
        : resolveAllowedLocalPath(
          options.localPathPolicy,
          "workingLocalRelativePath",
          payloadArtifact.workingLocalRelativePath,
        );
    } catch (error) {
      if (error instanceof LocalPathAccessError) {
        throw new WeaveRuntimeError(
          `Working payload file for ${designatorPath} is outside the allowed local-path boundary: ${payloadArtifact.workingLocalRelativePath}`,
        );
      }
      throw error;
    }

    if (entryByAbsolutePath.has(absolutePath)) {
      continue;
    }

    const displayPath = formatSnapshotDisplayPath(
      options.localPathPolicy,
      absolutePath,
      payloadArtifact.workingLocalRelativePath,
    );
    entryByAbsolutePath.set(absolutePath, {
      displayPath,
      digest: await hashPayloadSnapshotFile(
        absolutePath,
        displayPath,
        designatorPath,
        payloadArtifact.workingLocalRelativePath,
        "initial",
      ),
    });
  }

  const entries = [...entryByAbsolutePath.entries()].map((
    [absolutePath, entry],
  ) => ({
    absolutePath,
    displayPath: entry.displayPath,
    digest: entry.digest,
  }));

  return {
    async verify() {
      for (const entry of entries) {
        const digest = await hashPayloadSnapshotFile(
          entry.absolutePath,
          entry.displayPath,
          undefined,
          undefined,
          "verify",
        );
        if (digest !== entry.digest) {
          throw new WeaveInputError(
            `Input file changed during multi-target payload capture: ${entry.displayPath}`,
          );
        }
      }
    },
  };
}

async function hashPayloadSnapshotFile(
  absolutePath: string,
  displayPath: string,
  designatorPath: string | undefined,
  workingLocalRelativePath: string | undefined,
  phase: "initial" | "verify",
): Promise<string> {
  let bytes: Uint8Array;
  try {
    bytes = await Deno.readFile(absolutePath);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      if (phase === "initial" && designatorPath && workingLocalRelativePath) {
        throw new WeaveRuntimeError(
          `Workspace is missing the working payload file for ${designatorPath}: ${workingLocalRelativePath}`,
        );
      }
      throw new WeaveInputError(
        `Input file changed during multi-target payload capture: ${displayPath}`,
      );
    }
    throw error;
  }

  const digestInput = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(digestInput).set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", digestInput);
  return [...new Uint8Array(digest)].map((byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function formatSnapshotDisplayPath(
  localPathPolicy: OperationalLocalPathPolicy,
  absolutePath: string,
  fallbackPath: string,
): string {
  const workspaceRelativePath = relative(
    localPathPolicy.workspaceRoot,
    absolutePath,
  ).replaceAll("\\", "/");
  if (
    workspaceRelativePath.length > 0 &&
    workspaceRelativePath !== ".." &&
    !workspaceRelativePath.startsWith("../") &&
    !workspaceRelativePath.startsWith("/")
  ) {
    return workspaceRelativePath;
  }
  return fallbackPath;
}

function shouldAttemptExplicitPayloadBatch(
  targets: readonly NormalizedVersionTargetSpec[],
  overwriteExistingState: boolean,
): boolean {
  return !overwriteExistingState && targets.length > 1 &&
    targets.every((target) => !target.recursive);
}

function isExplicitPayloadBatch(
  meshBase: string,
  candidates: readonly WeaveableKnopCandidate[],
  targetByDesignatorPath: ReadonlyMap<
    string,
    NormalizedVersionTargetSpec | undefined
  >,
): boolean {
  return candidates.length > 0 && candidates.every((candidate) => {
    const slice = detectPendingWeaveSlice(
      meshBase,
      candidate.designatorPath,
      candidate.currentKnopInventoryTurtle,
      targetByDesignatorPath.get(candidate.designatorPath),
    );
    return slice === "firstPayloadWeave" || slice === "laterPayloadWeave" ||
      (slice === undefined &&
        targetByDesignatorPath.get(candidate.designatorPath) !== undefined &&
        candidate.payloadArtifact?.currentArtifactHistoryPath !== undefined);
  });
}

async function planExplicitPayloadBatchVersion(
  meshState: MeshState,
  candidates: readonly WeaveableKnopCandidate[],
  targetByDesignatorPath: ReadonlyMap<
    string,
    NormalizedVersionTargetSpec | undefined
  >,
  meshEffectiveConfig: EffectiveConfig,
  effectiveConfigProvider: EffectiveConfigProvider,
  overwriteExistingState: boolean,
  timing?: RuntimeTiming,
): Promise<VersionPlan> {
  const orderedCandidates = [...candidates].sort((left, right) =>
    left.designatorPath.localeCompare(right.designatorPath)
  );
  const policies = await resolvePayloadBatchPolicies(
    orderedCandidates,
    meshEffectiveConfig,
    effectiveConfigProvider,
  );
  return timeOptionalSync(
    timing,
    "prepare.planPayloadBatch.planVersion",
    () =>
      planVersion({
        request: {
          targets: orderedCandidates.flatMap((candidate) => {
            const target = targetByDesignatorPath.get(candidate.designatorPath);
            return target === undefined ? [] : [{ ...target.source }];
          }),
          ...(overwriteExistingState ? { overwriteExistingState } : {}),
        },
        meshBase: meshState.meshBase,
        currentMeshInventoryTurtle: meshState.currentMeshInventoryTurtle,
        currentMeshMetadataTurtle: meshState.currentMeshMetadataTurtle,
        weaveableKnops: orderedCandidates,
        supportHistoryPolicies: policies.supportHistoryPolicies,
        namingPolicies: policies.namingPolicies,
        resourcePageGenerationConfig: policies.resourcePageGenerationConfig,
        resourcePageGenerationPolicies: policies.resourcePageGenerationPolicies,
      }),
  );
}

async function resolvePayloadBatchPolicies(
  orderedCandidates: readonly WeaveableKnopCandidate[],
  meshEffectiveConfig: EffectiveConfig,
  effectiveConfigProvider: EffectiveConfigProvider,
): Promise<{
  supportHistoryPolicies: ReturnType<
    typeof supportHistoryPoliciesFromScopedEffectiveConfigs
  >;
  namingPolicies: ReturnType<typeof namingPoliciesFromEffectiveConfig>;
  resourcePageGenerationConfig: ReturnType<
    typeof resourcePageGenerationConfigFromScopedEffectiveConfigs
  >;
  resourcePageGenerationPolicies: ReturnType<
    typeof resourcePageGenerationPoliciesFromScopedEffectiveConfigs
  >;
}> {
  let first:
    | {
      designatorPath: string;
      supportHistoryPolicies: ReturnType<
        typeof supportHistoryPoliciesFromScopedEffectiveConfigs
      >;
      namingPolicies: ReturnType<typeof namingPoliciesFromEffectiveConfig>;
      resourcePageGenerationConfig: ReturnType<
        typeof resourcePageGenerationConfigFromScopedEffectiveConfigs
      >;
      resourcePageGenerationPolicies: ReturnType<
        typeof resourcePageGenerationPoliciesFromScopedEffectiveConfigs
      >;
      comparisonKey: string;
    }
    | undefined;

  for (const candidate of orderedCandidates) {
    const targetEffectiveConfig = await effectiveConfigProvider
      .configForTarget(candidate.designatorPath);
    const supportHistoryPolicies =
      supportHistoryPoliciesFromScopedEffectiveConfigs(
        meshEffectiveConfig,
        targetEffectiveConfig,
      );
    const namingPolicies = namingPoliciesFromEffectiveConfig(
      targetEffectiveConfig,
    );
    const resourcePageGenerationConfig =
      resourcePageGenerationConfigFromScopedEffectiveConfigs(
        meshEffectiveConfig,
        targetEffectiveConfig,
      );
    const resourcePageGenerationPolicies =
      resourcePageGenerationPoliciesFromScopedEffectiveConfigs(
        meshEffectiveConfig,
        targetEffectiveConfig,
      );
    const comparisonKey = JSON.stringify({
      supportHistoryPolicies,
      namingPolicies,
      resourcePageGenerationPolicies,
    });

    if (first === undefined) {
      first = {
        designatorPath: candidate.designatorPath,
        supportHistoryPolicies,
        namingPolicies,
        resourcePageGenerationConfig,
        resourcePageGenerationPolicies,
        comparisonKey,
      };
      continue;
    }
    if (comparisonKey !== first.comparisonKey) {
      throw new WeaveInputError(
        `Multi-target payload weave requires consistent target-scoped planning policies; ${candidate.designatorPath} differs from ${first.designatorPath}.`,
      );
    }
  }

  if (first === undefined) {
    throw new WeaveInputError(
      "Multi-target payload weave requires at least one payload target.",
    );
  }

  return {
    supportHistoryPolicies: first.supportHistoryPolicies,
    namingPolicies: first.namingPolicies,
    resourcePageGenerationConfig: first.resourcePageGenerationConfig,
    resourcePageGenerationPolicies: first.resourcePageGenerationPolicies,
  };
}

export async function writePreparedVersion(
  meshRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  prepared: PreparedVersionExecution,
  options: {
    validateRdf: boolean;
    timing?: RuntimeTiming;
    phasePrefix?: string;
  },
): Promise<PreparedVersionWriteResult> {
  const phasePrefix = options.phasePrefix ?? "write";
  const timing = options.timing;
  timeOptionalSync(
    timing,
    `${phasePrefix}.assertUpdatedTargetsExist`,
    () => assertUpdatedTargetsExist(meshRoot, prepared.plan.updatedFiles),
  );
  await timeOptional(
    timing,
    `${phasePrefix}.assertCreateTargetsDoNotExist`,
    () =>
      assertCreateTargetsDoNotExist(
        meshRoot,
        [
          ...prepared.plan.createdFiles,
          ...(prepared.plan.createdBinaryFiles ?? []),
        ],
      ),
  );
  if (options.validateRdf) {
    timeOptionalSync(
      timing,
      `${phasePrefix}.validateRdf`,
      () => validateVersionPlanRdf(prepared.plan),
    );
  }
  await timeOptional(
    timing,
    `${phasePrefix}.createdFiles`,
    () => writeFiles(meshRoot, prepared.plan.createdFiles, true),
  );
  await timeOptional(
    timing,
    `${phasePrefix}.createdBinaryFiles`,
    () => writeBinaryFiles(meshRoot, prepared.plan.createdBinaryFiles ?? []),
  );
  await timeOptional(
    timing,
    `${phasePrefix}.updatedFiles`,
    () => writeFiles(meshRoot, prepared.plan.updatedFiles, false),
  );

  return {
    meshBase: prepared.meshState.meshBase,
    versionedDesignatorPaths: prepared.plan.versionedDesignatorPaths,
    createdPaths: prepared.plan.createdFiles.map((file) =>
      toWorkspaceRelativePath(localPathPolicy, file.path)
    ).concat(
      (prepared.plan.createdBinaryFiles ?? []).map((file) =>
        toWorkspaceRelativePath(localPathPolicy, file.path)
      ),
    ),
    updatedPaths: prepared.plan.updatedFiles.map((file) =>
      toWorkspaceRelativePath(localPathPolicy, file.path)
    ),
  };
}

export function validateVersionPlanRdf(plan: VersionPlan): void {
  validateRdfFiles([
    ...plan.createdFiles,
    ...plan.updatedFiles,
  ]);
}

function assertUpdatedTargetsExist(
  workspaceRoot: string,
  files: readonly PlannedFile[],
): void {
  for (const file of files) {
    const absolutePath = join(workspaceRoot, file.path);
    try {
      Deno.statSync(absolutePath);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        throw new WeaveRuntimeError(
          `weave target does not exist: ${file.path}`,
        );
      }
      throw error;
    }
  }
}

async function assertCreateTargetsDoNotExist(
  workspaceRoot: string,
  files: readonly { path: string }[],
): Promise<void> {
  for (const file of files) {
    try {
      await Deno.stat(join(workspaceRoot, file.path));
      throw new WeaveRuntimeError(`weave target already exists: ${file.path}`);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        continue;
      }
      throw error;
    }
  }
}

function validateRdfFiles(files: readonly PlannedFile[]): void {
  const parser = new Parser();

  for (const file of files) {
    if (!file.path.endsWith(".ttl")) {
      continue;
    }
    try {
      parser.parse(file.contents);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new WeaveRuntimeError(
        `Generated RDF did not parse for ${file.path}: ${message}`,
      );
    }
  }
}

async function writeFiles(
  workspaceRoot: string,
  files: readonly PlannedFile[],
  createNew: boolean,
): Promise<void> {
  for (const file of files) {
    const absolutePath = join(workspaceRoot, file.path);
    await Deno.mkdir(dirname(absolutePath), { recursive: true });
    await Deno.writeTextFile(
      absolutePath,
      file.contents,
      createNew ? { createNew: true } : undefined,
    );
  }
}

async function writeBinaryFiles(
  workspaceRoot: string,
  files: readonly PlannedBinaryFile[],
): Promise<void> {
  for (const file of files) {
    const absolutePath = join(workspaceRoot, file.path);
    await Deno.mkdir(dirname(absolutePath), { recursive: true });
    await Deno.writeFile(absolutePath, file.contents, { createNew: true });
  }
}
