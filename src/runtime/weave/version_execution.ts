import { dirname, join } from "@std/path";
import { Parser } from "n3";
import type {
  PlannedBinaryFile,
  PlannedFile,
} from "../../core/planned_file.ts";
import {
  type NormalizedVersionTargetSpec,
  resolveTargetSelections,
} from "../../core/targeting.ts";
import {
  planMeshSupportResourcePages,
  planVersion,
  type VersionPlan,
  WeaveInputError,
} from "../../core/weave/weave.ts";
import { listKnopDesignatorPaths } from "../mesh/inventory.ts";
import type { HistoryTrackingPolicy } from "../config/effective_config.ts";
import type { OperationalLocalPathPolicy } from "../operational/local_path_policy.ts";
import type { RuntimeTiming } from "../timing.ts";
import {
  assertRequestedTargetsAreWeaveable,
  loadWeaveableKnopCandidates,
} from "./candidate_loader.ts";
import {
  loadEffectiveConfigForExecution,
  namingPoliciesFromEffectiveConfig,
  resourcePageGenerationPoliciesFromEffectiveConfig,
  supportHistoryPoliciesFromEffectiveConfig,
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
  const effectiveConfig = await timeOptional(
    timing,
    "prepare.loadEffectiveConfig",
    () =>
      loadEffectiveConfigForExecution({
        meshConfigTurtle: meshState.currentMeshConfigTurtle,
        meshConfigSource: meshState.currentMeshConfigTurtle
          ? "_mesh/_config/config.ttl"
          : undefined,
        historyTrackingPolicyOverride,
      }),
  );
  const supportHistoryPolicies = supportHistoryPoliciesFromEffectiveConfig(
    effectiveConfig,
  );
  const namingPolicies = namingPoliciesFromEffectiveConfig(effectiveConfig);
  const resourcePageGenerationPolicies =
    resourcePageGenerationPoliciesFromEffectiveConfig(effectiveConfig);
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
  assertRequestedTargetsAreWeaveable(
    targets,
    initialWeaveableKnops,
  );

  if (initialWeaveableKnops.length === 0) {
    if (targets.length === 0) {
      return {
        meshState,
        plan: planMeshSupportResourcePages({
          meshBase: meshState.meshBase,
          currentMeshInventoryTurtle: meshState.currentMeshInventoryTurtle,
          currentMeshMetadataTurtle: meshState.currentMeshMetadataTurtle,
          currentMeshConfigTurtle: meshState.currentMeshConfigTurtle,
          supportHistoryPolicies,
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
