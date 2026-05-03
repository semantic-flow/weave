import { dirname, fromFileUrl, isAbsolute, join, resolve } from "@std/path";
import { Parser } from "n3";
import {
  normalizeSafeDesignatorPath,
  toKnopPath,
} from "../../core/designator_segments.ts";
import {
  PayloadUpdateInputError,
  type PayloadUpdatePlan,
  planPayloadUpdate,
} from "../../core/payload/update.ts";
import { resolvePayloadArtifactInventoryState } from "../mesh/inventory.ts";
import {
  MeshMetadataResolutionError,
  resolveMeshBaseFromMetadataTurtle,
} from "../mesh/metadata.ts";
import { resolveRuntimeLoggers } from "../logging/factory.ts";
import type { AuditLogger } from "../logging/audit_logger.ts";
import type { StructuredLogger } from "../logging/logger.ts";

export interface LocalPayloadUpdateRequest {
  designatorPath: string;
  source: string;
}

export interface ExecutePayloadUpdateOptions {
  workspaceRoot: string;
  request: LocalPayloadUpdateRequest;
  operationalLogger?: StructuredLogger;
  auditLogger?: AuditLogger;
}

export interface PayloadUpdateResult {
  meshBase: string;
  designatorPath: string;
  payloadArtifactIri: string;
  workingLocalRelativePath: string;
  updatedPaths: readonly string[];
}

export class PayloadUpdateRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayloadUpdateRuntimeError";
  }
}

interface StagedPayloadUpdate {
  absolutePath: string;
  tempPath: string;
  backupPath: string;
}

export async function executePayloadUpdate(
  options: ExecutePayloadUpdateOptions,
): Promise<PayloadUpdateResult> {
  const { operationalLogger, auditLogger } = resolveLoggers(options);
  const workspaceRoot = options.workspaceRoot;
  const source = options.request.source;
  const designatorPath = options.request.designatorPath;
  let plan: PayloadUpdatePlan | undefined;

  await operationalLogger.info(
    "payload.update.started",
    "Starting local payload update",
    {
      workspaceRoot,
      designatorPath,
      source,
    },
  );
  await auditLogger.record(
    "payload.update.started",
    "Local payload update started",
    {
      workspaceRoot,
      designatorPath,
      source,
    },
  );

  try {
    await ensureWorkspaceRootExists(workspaceRoot);
    const normalizedDesignatorPath = normalizeLocalDesignatorPath(
      designatorPath,
      "designatorPath",
    );
    const resolvedSource = await resolveReplacementSource(
      workspaceRoot,
      source,
    );
    const payloadState = await loadCurrentPayloadState(
      workspaceRoot,
      normalizedDesignatorPath,
    );
    plan = planPayloadUpdate({
      meshBase: payloadState.meshBase,
      currentKnopInventoryTurtle: payloadState.currentKnopInventoryTurtle,
      designatorPath: normalizedDesignatorPath,
      workingLocalRelativePath: payloadState.workingLocalRelativePath,
      replacementPayloadTurtle: resolvedSource.replacementPayloadTurtle,
    });
    await assertUpdatedTargetsExist(workspaceRoot, plan);
    validateRdfPlan(plan);
    await applyPayloadUpdateAtomically(workspaceRoot, plan);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await operationalLogger.error(
      "payload.update.failed",
      "Local payload update failed",
      {
        workspaceRoot,
        designatorPath,
        source,
        payloadArtifactIri: plan?.payloadArtifactIri,
        workingLocalRelativePath: plan?.workingLocalRelativePath,
        error: message,
      },
    );
    await auditLogger.record(
      "payload.update.failed",
      "Local payload update failed",
      {
        workspaceRoot,
        designatorPath,
        source,
        payloadArtifactIri: plan?.payloadArtifactIri,
        workingLocalRelativePath: plan?.workingLocalRelativePath,
        error: message,
      },
    );

    if (
      error instanceof PayloadUpdateInputError ||
      error instanceof PayloadUpdateRuntimeError
    ) {
      throw error;
    }
    throw new PayloadUpdateRuntimeError(message);
  }

  const result: PayloadUpdateResult = {
    meshBase: plan.meshBase,
    designatorPath: plan.designatorPath,
    payloadArtifactIri: plan.payloadArtifactIri,
    workingLocalRelativePath: plan.workingLocalRelativePath,
    updatedPaths: plan.updatedFiles.map((file) => file.path),
  };

  await operationalLogger.info(
    "payload.update.succeeded",
    "Local payload update succeeded",
    {
      workspaceRoot,
      designatorPath: result.designatorPath,
      payloadArtifactIri: result.payloadArtifactIri,
      workingLocalRelativePath: result.workingLocalRelativePath,
      updatedPaths: result.updatedPaths,
    },
  );
  await auditLogger.record(
    "payload.update.succeeded",
    "Local payload update succeeded",
    {
      workspaceRoot,
      designatorPath: result.designatorPath,
      payloadArtifactIri: result.payloadArtifactIri,
      workingLocalRelativePath: result.workingLocalRelativePath,
      updatedPaths: result.updatedPaths,
    },
  );

  return result;
}

export function describePayloadUpdateResult(
  result: PayloadUpdateResult,
): string {
  const updatedFileCount = result.updatedPaths.length;
  const updatedFileLabel = updatedFileCount === 1 ? "file" : "files";

  return `Updated payload ${result.payloadArtifactIri} by replacing working file ${result.workingLocalRelativePath} (updated ${updatedFileCount} ${updatedFileLabel}).`;
}

function resolveLoggers(
  options: ExecutePayloadUpdateOptions,
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
      throw new PayloadUpdateRuntimeError(
        `Workspace root does not exist: ${workspaceRoot}`,
      );
    }
    throw error;
  }

  if (!stat.isDirectory) {
    throw new PayloadUpdateRuntimeError(
      `Workspace root is not a directory: ${workspaceRoot}`,
    );
  }
}

function normalizeLocalDesignatorPath(
  designatorPath: string,
  fieldName: string,
): string {
  return normalizeSafeDesignatorPath(
    designatorPath,
    fieldName,
    (message) => new PayloadUpdateRuntimeError(message),
    { allowRoot: true },
  );
}

async function resolveReplacementSource(
  workspaceRoot: string,
  source: string,
): Promise<{ absoluteSourcePath: string; replacementPayloadTurtle: string }> {
  const trimmed = source.trim();
  if (trimmed.length === 0) {
    throw new PayloadUpdateRuntimeError(
      "payload update requires a source path or file URL",
    );
  }

  const absoluteSourcePath = resolveSourcePath(workspaceRoot, trimmed);
  let stat: Deno.FileInfo;
  try {
    stat = await Deno.stat(absoluteSourcePath);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new PayloadUpdateRuntimeError(
        `payload update source does not exist: ${trimmed}`,
      );
    }
    throw error;
  }

  if (!stat.isFile) {
    throw new PayloadUpdateRuntimeError(
      `payload update source is not a file: ${trimmed}`,
    );
  }

  return {
    absoluteSourcePath,
    replacementPayloadTurtle: await Deno.readTextFile(absoluteSourcePath),
  };
}

function resolveSourcePath(workspaceRoot: string, source: string): string {
  if (source.startsWith("file:")) {
    let fileUrl: URL;
    try {
      fileUrl = new URL(source);
    } catch {
      throw new PayloadUpdateRuntimeError(
        `payload update source is not a valid file URL: ${source}`,
      );
    }

    return resolve(fromFileUrl(fileUrl));
  }

  if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(source)) {
    throw new PayloadUpdateRuntimeError(
      "The current local payload update slice only supports local filesystem sources.",
    );
  }

  return isAbsolute(source) ? resolve(source) : resolve(workspaceRoot, source);
}

async function loadCurrentPayloadState(
  workspaceRoot: string,
  designatorPath: string,
): Promise<{
  meshBase: string;
  currentKnopInventoryTurtle: string;
  workingLocalRelativePath: string;
}> {
  const meshMetadataPath = join(workspaceRoot, "_mesh/_meta/meta.ttl");
  const knopInventoryPath = join(
    workspaceRoot,
    `${toKnopPath(designatorPath)}/_inventory/inventory.ttl`,
  );
  let meshMetadataTurtle: string;
  let currentKnopInventoryTurtle: string;

  try {
    [meshMetadataTurtle, currentKnopInventoryTurtle] = await Promise.all([
      Deno.readTextFile(meshMetadataPath),
      Deno.readTextFile(knopInventoryPath),
    ]);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new PayloadUpdateRuntimeError(
        `Workspace does not contain an existing woven payload surface for ${designatorPath}`,
      );
    }
    throw error;
  }

  let meshBase: string;
  try {
    meshBase = resolveMeshBaseFromMetadataTurtle(meshMetadataTurtle);
  } catch (error) {
    if (error instanceof MeshMetadataResolutionError) {
      throw new PayloadUpdateRuntimeError(error.message);
    }
    if (error instanceof Error) {
      throw new PayloadUpdateRuntimeError(
        `Could not resolve mesh base from metadata: ${error.message}`,
      );
    }
    throw error;
  }

  const payloadArtifact = resolvePayloadArtifactInventoryState(
    meshBase,
    currentKnopInventoryTurtle,
    designatorPath,
    {
      parseErrorMessage:
        `Could not parse the current Knop inventory while resolving the payload artifact for ${designatorPath}.`,
      missingWorkingFileMessage:
        `Could not resolve the working payload file for ${designatorPath}.`,
    },
  );
  if (!payloadArtifact) {
    throw new PayloadUpdateRuntimeError(
      `Could not resolve the payload artifact block for ${designatorPath}.`,
    );
  }
  const workingLocalRelativePath = payloadArtifact.workingLocalRelativePath;
  try {
    const stat = await Deno.stat(join(workspaceRoot, workingLocalRelativePath));
    if (!stat.isFile) {
      throw new PayloadUpdateRuntimeError(
        `Resolved working payload path is not a file for ${designatorPath}: ${workingLocalRelativePath}`,
      );
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new PayloadUpdateRuntimeError(
        `Workspace is missing the working payload file for ${designatorPath}: ${workingLocalRelativePath}`,
      );
    }
    throw error;
  }

  return {
    meshBase,
    currentKnopInventoryTurtle,
    workingLocalRelativePath,
  };
}

async function assertUpdatedTargetsExist(
  workspaceRoot: string,
  plan: PayloadUpdatePlan,
): Promise<void> {
  for (const file of plan.updatedFiles) {
    const absolutePath = join(workspaceRoot, file.path);
    try {
      await Deno.stat(absolutePath);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        throw new PayloadUpdateRuntimeError(
          `payload update target does not exist: ${file.path}`,
        );
      }
      throw error;
    }
  }
}

function validateRdfPlan(plan: PayloadUpdatePlan): void {
  const parser = new Parser();

  for (const file of plan.updatedFiles) {
    if (!file.path.endsWith(".ttl")) {
      continue;
    }
    try {
      parser.parse(file.contents);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new PayloadUpdateRuntimeError(
        `Generated RDF did not parse for ${file.path}: ${message}`,
      );
    }
  }
}

async function applyPayloadUpdateAtomically(
  workspaceRoot: string,
  plan: PayloadUpdatePlan,
): Promise<void> {
  if (plan.updatedFiles.length !== 1) {
    throw new PayloadUpdateRuntimeError(
      `The current local payload update slice expected exactly one updated working file, found ${plan.updatedFiles.length}.`,
    );
  }

  const file = plan.updatedFiles[0]!;
  const absolutePath = join(workspaceRoot, file.path);
  const directoryPath = dirname(absolutePath);
  const stagedPayloadUpdate: StagedPayloadUpdate = {
    absolutePath,
    tempPath: join(
      directoryPath,
      `.weave-staged-${crypto.randomUUID()}.tmp`,
    ),
    backupPath: join(
      directoryPath,
      `.weave-backup-${crypto.randomUUID()}.ttl`,
    ),
  };

  await Deno.writeTextFile(stagedPayloadUpdate.tempPath, file.contents, {
    createNew: true,
  });

  try {
    await Deno.copyFile(absolutePath, stagedPayloadUpdate.backupPath);
    await Deno.rename(stagedPayloadUpdate.tempPath, absolutePath);
  } catch (error) {
    try {
      await removePathIfExists(stagedPayloadUpdate.tempPath);
      if (await pathExists(stagedPayloadUpdate.backupPath)) {
        await removePathIfExists(absolutePath);
        await Deno.rename(stagedPayloadUpdate.backupPath, absolutePath);
      }
    } catch (rollbackError) {
      const message = error instanceof Error ? error.message : String(error);
      const rollbackMessage = rollbackError instanceof Error
        ? rollbackError.message
        : String(rollbackError);
      throw new PayloadUpdateRuntimeError(
        `Atomic payload update failed: ${message}; rollback also failed: ${rollbackMessage}`,
      );
    }

    throw error;
  }

  await removePathIfExists(stagedPayloadUpdate.backupPath);
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
