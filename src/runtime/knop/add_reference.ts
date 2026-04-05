import { dirname, join } from "@std/path";
import {
  KnopAddReferenceInputError,
  type KnopAddReferencePlan,
  planKnopAddReference,
} from "../../core/knop/add_reference.ts";
import { resolveRuntimeLoggers } from "../logging/factory.ts";
import type { AuditLogger } from "../logging/audit_logger.ts";
import type { StructuredLogger } from "../logging/logger.ts";

const reservedDesignatorSegments = new Set(["_knop", "_mesh"]);
const safeDesignatorSegmentPattern = /^[A-Za-z0-9._-]+$/;

export interface LocalKnopAddReferenceRequest {
  designatorPath: string;
  referenceTargetDesignatorPath: string;
  referenceRole: string;
}

export interface ExecuteKnopAddReferenceOptions {
  workspaceRoot: string;
  request: LocalKnopAddReferenceRequest;
  operationalLogger?: StructuredLogger;
  auditLogger?: AuditLogger;
}

export interface KnopAddReferenceResult {
  meshBase: string;
  designatorPath: string;
  referenceTargetDesignatorPath: string;
  referenceCatalogIri: string;
  referenceLinkIri: string;
  referenceRoleIri: string;
  referenceTargetIri: string;
  createdPaths: readonly string[];
  updatedPaths: readonly string[];
}

export class KnopAddReferenceRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnopAddReferenceRuntimeError";
  }
}

interface StagedFileMutation {
  absolutePath: string;
  tempPath: string;
  backupPath?: string;
}

interface StagedPlanMutation {
  createdFiles: StagedFileMutation[];
  updatedFiles: StagedFileMutation[];
  createdDirectories: string[];
}

export async function executeKnopAddReference(
  options: ExecuteKnopAddReferenceOptions,
): Promise<KnopAddReferenceResult> {
  const { operationalLogger, auditLogger } = resolveLoggers(options);
  const workspaceRoot = options.workspaceRoot;
  const designatorPath = options.request.designatorPath;
  const referenceTargetDesignatorPath =
    options.request.referenceTargetDesignatorPath;
  const referenceRole = options.request.referenceRole;
  let plan: KnopAddReferencePlan | undefined;

  await operationalLogger.info(
    "knop.addReference.started",
    "Starting local knop add-reference",
    {
      workspaceRoot,
      designatorPath,
      referenceTargetDesignatorPath,
      referenceRole,
    },
  );
  await auditLogger.record(
    "knop.addReference.started",
    "Local knop add-reference started",
    {
      workspaceRoot,
      designatorPath,
      referenceTargetDesignatorPath,
      referenceRole,
    },
  );

  try {
    await ensureWorkspaceRootExists(workspaceRoot);
    const normalizedDesignatorPath = normalizeLocalDesignatorPath(
      designatorPath,
      "designatorPath",
    );
    const normalizedReferenceTargetDesignatorPath =
      normalizeLocalDesignatorPath(
        referenceTargetDesignatorPath,
        "referenceTargetDesignatorPath",
      );
    const meshBase = await loadMeshBase(workspaceRoot);
    const currentKnopInventoryTurtle = await loadCurrentKnopInventory(
      workspaceRoot,
      normalizedDesignatorPath,
    );

    plan = planKnopAddReference({
      meshBase,
      currentKnopInventoryTurtle,
      designatorPath: normalizedDesignatorPath,
      referenceTargetDesignatorPath: normalizedReferenceTargetDesignatorPath,
      referenceRole,
    });

    await assertReferenceTargetExists(
      workspaceRoot,
      normalizedReferenceTargetDesignatorPath,
    );
    await assertCreateTargetsDoNotExist(workspaceRoot, plan);
    await applyPlanAtomically(workspaceRoot, plan);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await operationalLogger.error(
      "knop.addReference.failed",
      "Local knop add-reference failed",
      {
        workspaceRoot,
        designatorPath,
        referenceTargetDesignatorPath,
        referenceRole,
        referenceCatalogIri: plan?.referenceCatalogIri,
        referenceLinkIri: plan?.referenceLinkIri,
        error: message,
      },
    );
    await auditLogger.record(
      "knop.addReference.failed",
      "Local knop add-reference failed",
      {
        workspaceRoot,
        designatorPath,
        referenceTargetDesignatorPath,
        referenceRole,
        referenceCatalogIri: plan?.referenceCatalogIri,
        referenceLinkIri: plan?.referenceLinkIri,
        error: message,
      },
    );

    if (
      error instanceof KnopAddReferenceInputError ||
      error instanceof KnopAddReferenceRuntimeError
    ) {
      throw error;
    }
    throw new KnopAddReferenceRuntimeError(message);
  }

  const result: KnopAddReferenceResult = {
    meshBase: plan.meshBase,
    designatorPath: plan.designatorPath,
    referenceTargetDesignatorPath: plan.referenceTargetDesignatorPath,
    referenceCatalogIri: plan.referenceCatalogIri,
    referenceLinkIri: plan.referenceLinkIri,
    referenceRoleIri: plan.referenceRoleIri,
    referenceTargetIri: plan.referenceTargetIri,
    createdPaths: plan.createdFiles.map((file) => file.path),
    updatedPaths: plan.updatedFiles.map((file) => file.path),
  };

  await logKnopAddReferenceSucceededBestEffort(
    operationalLogger,
    auditLogger,
    workspaceRoot,
    result,
  );

  return result;
}

export function describeKnopAddReferenceResult(
  result: KnopAddReferenceResult,
): string {
  return `Added reference link ${result.referenceLinkIri} targeting ${result.referenceTargetIri}, created ${result.createdPaths.length} reference-catalog artifact, and updated ${result.updatedPaths.length} knop support artifact.`;
}

function resolveLoggers(
  options: ExecuteKnopAddReferenceOptions,
): {
  operationalLogger: StructuredLogger;
  auditLogger: AuditLogger;
} {
  return resolveRuntimeLoggers(options);
}

async function ensureWorkspaceRootExists(workspaceRoot: string): Promise<void> {
  let stat: Deno.FileInfo;
  try {
    stat = await Deno.stat(workspaceRoot);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new KnopAddReferenceRuntimeError(
        `Workspace root does not exist: ${workspaceRoot}`,
      );
    }
    throw error;
  }

  if (!stat.isDirectory) {
    throw new KnopAddReferenceRuntimeError(
      `Workspace root is not a directory: ${workspaceRoot}`,
    );
  }
}

async function loadMeshBase(workspaceRoot: string): Promise<string> {
  const meshMetadataPath = join(workspaceRoot, "_mesh/_meta/meta.ttl");
  let meshMetadataTurtle: string;

  try {
    meshMetadataTurtle = await Deno.readTextFile(meshMetadataPath);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new KnopAddReferenceRuntimeError(
        "Workspace does not contain an existing mesh support surface",
      );
    }
    throw error;
  }

  const meshBaseMatch = meshMetadataTurtle.match(
    /sflo:meshBase "([^"]+)"\^\^xsd:anyURI/,
  );
  if (!meshBaseMatch) {
    throw new KnopAddReferenceRuntimeError(
      "Could not resolve meshBase from _mesh/_meta/meta.ttl",
    );
  }

  return meshBaseMatch[1]!;
}

async function loadCurrentKnopInventory(
  workspaceRoot: string,
  designatorPath: string,
): Promise<string> {
  const knobInventoryPath = join(
    workspaceRoot,
    `${designatorPath}/_knop/_inventory/inventory.ttl`,
  );

  try {
    return await Deno.readTextFile(knobInventoryPath);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new KnopAddReferenceRuntimeError(
        `Workspace does not contain an existing knop support surface for ${designatorPath}`,
      );
    }
    throw error;
  }
}

async function assertReferenceTargetExists(
  workspaceRoot: string,
  referenceTargetDesignatorPath: string,
): Promise<void> {
  const targetKnopInventoryPath = join(
    workspaceRoot,
    `${referenceTargetDesignatorPath}/_knop/_inventory/inventory.ttl`,
  );

  let stat: Deno.FileInfo;
  try {
    stat = await Deno.stat(targetKnopInventoryPath);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new KnopAddReferenceRuntimeError(
        `Referenced target does not exist in the workspace: ${referenceTargetDesignatorPath}`,
      );
    }
    throw error;
  }

  if (!stat.isFile) {
    throw new KnopAddReferenceRuntimeError(
      `Referenced target inventory is not a file: ${referenceTargetDesignatorPath}`,
    );
  }
}

async function assertCreateTargetsDoNotExist(
  workspaceRoot: string,
  plan: KnopAddReferencePlan,
): Promise<void> {
  for (const file of plan.createdFiles) {
    try {
      await Deno.stat(join(workspaceRoot, file.path));
      throw new KnopAddReferenceRuntimeError(
        `knop add-reference target already exists: ${file.path}`,
      );
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        continue;
      }
      throw error;
    }
  }
}

function normalizeLocalDesignatorPath(
  designatorPath: string,
  fieldName: string,
): string {
  const trimmed = designatorPath.trim();
  if (trimmed.length === 0) {
    throw new KnopAddReferenceRuntimeError(`${fieldName} is required`);
  }
  if (trimmed.startsWith("/") || trimmed.endsWith("/")) {
    throw new KnopAddReferenceRuntimeError(
      `${fieldName} must not start or end with '/'`,
    );
  }
  if (
    trimmed.includes("\\") || trimmed.includes("?") || trimmed.includes("#")
  ) {
    throw new KnopAddReferenceRuntimeError(
      `${fieldName} contains unsupported path characters`,
    );
  }

  const segments = trimmed.split("/");
  if (segments.some((segment) => segment.length === 0)) {
    throw new KnopAddReferenceRuntimeError(
      `${fieldName} must not contain empty path segments`,
    );
  }
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new KnopAddReferenceRuntimeError(
      `${fieldName} must not contain '.' or '..' path segments`,
    );
  }
  if (segments.some((segment) => reservedDesignatorSegments.has(segment))) {
    throw new KnopAddReferenceRuntimeError(
      `${fieldName} must not contain reserved path segments`,
    );
  }
  for (const segment of segments) {
    if (!safeDesignatorSegmentPattern.test(segment)) {
      throw new KnopAddReferenceRuntimeError(
        `normalizeDesignatorPath rejected segment "${segment}" in ${fieldName}: toKnopPath only accepts path segments matching [A-Za-z0-9._-]+`,
      );
    }
  }

  return trimmed;
}

async function applyPlanAtomically(
  workspaceRoot: string,
  plan: KnopAddReferencePlan,
): Promise<void> {
  const stagedPlanMutation = await stagePlanMutation(workspaceRoot, plan);

  try {
    await commitStagedPlanMutation(stagedPlanMutation);
  } catch (error) {
    try {
      await rollbackStagedPlanMutation(stagedPlanMutation);
    } catch (rollbackError) {
      const message = error instanceof Error ? error.message : String(error);
      const rollbackMessage = rollbackError instanceof Error
        ? rollbackError.message
        : String(rollbackError);
      throw new KnopAddReferenceRuntimeError(
        `Atomic knop add-reference commit failed: ${message}; rollback also failed: ${rollbackMessage}`,
      );
    }

    throw error;
  }

  await cleanupCommittedStagedPlanMutationBestEffort(stagedPlanMutation);
}

async function stagePlanMutation(
  workspaceRoot: string,
  plan: KnopAddReferencePlan,
): Promise<StagedPlanMutation> {
  const stagedPlanMutation: StagedPlanMutation = {
    createdFiles: [],
    updatedFiles: [],
    createdDirectories: [],
  };
  const trackedDirectories = new Set<string>();

  try {
    for (const file of plan.createdFiles) {
      const absolutePath = join(workspaceRoot, file.path);
      const directoryPath = dirname(absolutePath);
      await ensureDirectoryExists(
        directoryPath,
        stagedPlanMutation.createdDirectories,
        trackedDirectories,
      );
      stagedPlanMutation.createdFiles.push({
        absolutePath,
        tempPath: await writeStagedFile(directoryPath, file.contents),
      });
    }

    for (const file of plan.updatedFiles) {
      const absolutePath = join(workspaceRoot, file.path);
      const directoryPath = dirname(absolutePath);
      await ensureDirectoryExists(
        directoryPath,
        stagedPlanMutation.createdDirectories,
        trackedDirectories,
      );
      stagedPlanMutation.updatedFiles.push({
        absolutePath,
        tempPath: await writeStagedFile(directoryPath, file.contents),
        backupPath: join(
          directoryPath,
          `.weave-backup-${crypto.randomUUID()}.ttl`,
        ),
      });
    }
  } catch (error) {
    await rollbackStagedPlanMutation(stagedPlanMutation);
    throw error;
  }

  return stagedPlanMutation;
}

async function ensureDirectoryExists(
  directoryPath: string,
  createdDirectories: string[],
  trackedDirectories: Set<string>,
): Promise<void> {
  const missingDirectories: string[] = [];
  let currentPath = directoryPath;

  while (true) {
    try {
      const stat = await Deno.stat(currentPath);
      if (!stat.isDirectory) {
        throw new KnopAddReferenceRuntimeError(
          `Workspace path is not a directory: ${currentPath}`,
        );
      }
      break;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        missingDirectories.push(currentPath);
        const parentPath = dirname(currentPath);
        if (parentPath === currentPath) {
          break;
        }
        currentPath = parentPath;
        continue;
      }
      throw error;
    }
  }

  if (missingDirectories.length === 0) {
    return;
  }

  await Deno.mkdir(directoryPath, { recursive: true });
  for (const createdDirectory of missingDirectories.reverse()) {
    if (trackedDirectories.has(createdDirectory)) {
      continue;
    }
    trackedDirectories.add(createdDirectory);
    createdDirectories.push(createdDirectory);
  }
}

async function writeStagedFile(
  directoryPath: string,
  contents: string,
): Promise<string> {
  const tempPath = join(
    directoryPath,
    `.weave-staged-${crypto.randomUUID()}.tmp`,
  );
  await Deno.writeTextFile(tempPath, contents, { createNew: true });
  return tempPath;
}

async function commitStagedPlanMutation(
  stagedPlanMutation: StagedPlanMutation,
): Promise<void> {
  for (const file of stagedPlanMutation.createdFiles) {
    await Deno.rename(file.tempPath, file.absolutePath);
  }

  for (const file of stagedPlanMutation.updatedFiles) {
    await Deno.rename(file.absolutePath, file.backupPath!);
    await Deno.rename(file.tempPath, file.absolutePath);
  }
}

async function rollbackStagedPlanMutation(
  stagedPlanMutation: StagedPlanMutation,
): Promise<void> {
  let firstRollbackError: unknown;

  for (const file of [...stagedPlanMutation.updatedFiles].reverse()) {
    try {
      await removePathIfExists(file.tempPath);
      if (!(await pathExists(file.backupPath!))) {
        continue;
      }
      await removePathIfExists(file.absolutePath);
      await Deno.rename(file.backupPath!, file.absolutePath);
    } catch (error) {
      firstRollbackError ??= error;
    }
  }

  for (const file of [...stagedPlanMutation.createdFiles].reverse()) {
    try {
      await removePathIfExists(file.tempPath);
      await removePathIfExists(file.absolutePath);
    } catch (error) {
      firstRollbackError ??= error;
    }
  }

  await removeEmptyDirectoriesBestEffort(stagedPlanMutation.createdDirectories);

  if (firstRollbackError) {
    throw firstRollbackError;
  }
}

async function cleanupCommittedStagedPlanMutationBestEffort(
  stagedPlanMutation: StagedPlanMutation,
): Promise<void> {
  for (const file of stagedPlanMutation.createdFiles) {
    await removePathIfExistsBestEffort(file.tempPath);
  }

  for (const file of stagedPlanMutation.updatedFiles) {
    await removePathIfExistsBestEffort(file.tempPath);
    await removePathIfExistsBestEffort(file.backupPath!);
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }
    throw error;
  }
}

async function removePathIfExists(path: string): Promise<void> {
  try {
    await Deno.remove(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return;
    }
    throw error;
  }
}

async function removePathIfExistsBestEffort(path: string): Promise<void> {
  try {
    await removePathIfExists(path);
  } catch {
    // Best-effort cleanup should never fail the committed operation.
  }
}

async function removeEmptyDirectoriesBestEffort(
  createdDirectories: readonly string[],
): Promise<void> {
  for (const directoryPath of [...createdDirectories].reverse()) {
    try {
      await Deno.remove(directoryPath);
    } catch {
      // Rollback cleanup should not obscure the primary result.
    }
  }
}

async function logKnopAddReferenceSucceededBestEffort(
  operationalLogger: StructuredLogger,
  auditLogger: AuditLogger,
  workspaceRoot: string,
  result: KnopAddReferenceResult,
): Promise<void> {
  const attributes = {
    workspaceRoot,
    designatorPath: result.designatorPath,
    referenceTargetDesignatorPath: result.referenceTargetDesignatorPath,
    referenceCatalogIri: result.referenceCatalogIri,
    referenceLinkIri: result.referenceLinkIri,
    referenceRoleIri: result.referenceRoleIri,
    referenceTargetIri: result.referenceTargetIri,
    createdPaths: result.createdPaths,
    updatedPaths: result.updatedPaths,
  };

  try {
    await operationalLogger.info(
      "knop.addReference.succeeded",
      "Local knop add-reference succeeded",
      attributes,
    );
  } catch {
    // Success logging must not turn a committed workspace mutation into a failure.
  }

  try {
    await auditLogger.record(
      "knop.addReference.succeeded",
      "Local knop add-reference succeeded",
      attributes,
    );
  } catch {
    // Success logging must not turn a committed workspace mutation into a failure.
  }
}
