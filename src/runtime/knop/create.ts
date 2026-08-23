import { join, relative, resolve } from "@std/path";
import {
  KnopCreateInputError,
  type KnopCreatePlan,
  type KnopCreateRequest,
  planKnopCreate,
} from "../../core/knop/create.ts";
import { toFoundingReferentDataPath } from "../../core/designator_segments.ts";
import { FoundingReferentDataInputError } from "../../core/knop/founding_referent_data.ts";
import {
  MeshMetadataResolutionError,
  resolveMeshBaseFromMetadataTurtle,
} from "../mesh/metadata.ts";
import { resolveRuntimeLoggers } from "../logging/factory.ts";
import type { AuditLogger } from "../logging/audit_logger.ts";
import type { StructuredLogger } from "../logging/logger.ts";
import {
  type AtomicFilePlanHooks,
  executeAtomicFilePlan,
} from "../atomic_file_plan.ts";
import {
  loadOperationalLocalPathPolicy,
  LocalPathAccessError,
  resolveAllowedLocalPath,
} from "../operational/local_path_policy.ts";

export interface ExecuteKnopCreateOptions {
  workspaceRoot: string;
  request: KnopCreateRequest;
  operationalLogger?: StructuredLogger;
  auditLogger?: AuditLogger;
}

export interface KnopCreateResult {
  meshBase: string;
  designatorPath: string;
  knopIri: string;
  createdPaths: readonly string[];
  updatedPaths: readonly string[];
  foundingReferentDataIri?: string;
  foundingWorkingLocatedFilePath?: string;
}

export class KnopCreateRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnopCreateRuntimeError";
  }
}

export async function executeKnopCreate(
  options: ExecuteKnopCreateOptions,
): Promise<KnopCreateResult> {
  return await executeKnopCreateInternal(options);
}

/** Test-only atomic-write seam; omitted from CLI and API surfaces. */
export async function executeKnopCreateForTesting(
  options: ExecuteKnopCreateOptions,
  hooks: AtomicFilePlanHooks,
): Promise<KnopCreateResult> {
  return await executeKnopCreateInternal(options, hooks);
}

async function executeKnopCreateInternal(
  options: ExecuteKnopCreateOptions,
  hooks: AtomicFilePlanHooks = {},
): Promise<KnopCreateResult> {
  const { operationalLogger, auditLogger } = resolveLoggers(options);
  const workspaceRoot = options.workspaceRoot;
  const designatorPath = options.request.designatorPath;
  let plan: KnopCreatePlan | undefined;

  await operationalLogger.info(
    "knop.create.started",
    "Starting local knop create",
    {
      workspaceRoot,
      designatorPath,
    },
  );
  await auditLogger.record(
    "knop.create.started",
    "Local knop create started",
    {
      workspaceRoot,
      designatorPath,
    },
  );

  try {
    await ensureWorkspaceRootExists(workspaceRoot);
    const meshState = await loadCurrentMeshState(workspaceRoot);
    plan = planKnopCreate({
      ...options.request,
      meshBase: meshState.meshBase,
      currentMeshInventoryTurtle: meshState.currentMeshInventoryTurtle,
    });
    await executeAtomicFilePlan(
      workspaceRoot,
      [
        ...plan.createdFiles.map((file) => ({
          path: file.path,
          mode: "create" as const,
          phase: "text-create",
          contents: file.contents,
        })),
        ...(plan.createdBinaryFiles ?? []).map((file) => ({
          path: file.path,
          mode: "create" as const,
          phase: "binary-create",
          contents: file.contents,
        })),
        ...plan.updatedFiles.map((file) => ({
          path: file.path,
          mode: "update" as const,
          phase: "inventory-update",
          contents: file.contents,
        })),
      ],
      hooks,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await operationalLogger.error(
      "knop.create.failed",
      "Local knop create failed",
      {
        workspaceRoot,
        designatorPath,
        meshBase: plan?.meshBase,
        knopIri: plan?.knopIri,
        error: message,
      },
    );
    await auditLogger.record(
      "knop.create.failed",
      "Local knop create failed",
      {
        workspaceRoot,
        designatorPath,
        meshBase: plan?.meshBase,
        knopIri: plan?.knopIri,
        error: message,
      },
    );

    if (
      error instanceof KnopCreateInputError ||
      error instanceof FoundingReferentDataInputError ||
      error instanceof KnopCreateRuntimeError
    ) {
      throw error;
    }
    throw new KnopCreateRuntimeError(message);
  }

  const result: KnopCreateResult = {
    meshBase: plan.meshBase,
    designatorPath: plan.designatorPath,
    knopIri: plan.knopIri,
    createdPaths: [
      ...plan.createdFiles.map((file) => file.path),
      ...(plan.createdBinaryFiles ?? []).map((file) => file.path),
    ],
    updatedPaths: plan.updatedFiles.map((file) => file.path),
    ...(plan.foundingReferentDataIri === undefined ? {} : {
      foundingReferentDataIri: plan.foundingReferentDataIri,
      foundingWorkingLocatedFilePath: plan.foundingWorkingLocatedFilePath,
    }),
  };

  await operationalLogger.info(
    "knop.create.succeeded",
    "Local knop create succeeded",
    {
      workspaceRoot,
      designatorPath: result.designatorPath,
      meshBase: result.meshBase,
      knopIri: result.knopIri,
      createdPaths: result.createdPaths,
      updatedPaths: result.updatedPaths,
    },
  );
  await auditLogger.record(
    "knop.create.succeeded",
    "Local knop create succeeded",
    {
      workspaceRoot,
      designatorPath: result.designatorPath,
      meshBase: result.meshBase,
      knopIri: result.knopIri,
      createdPaths: result.createdPaths,
      updatedPaths: result.updatedPaths,
    },
  );

  return result;
}

export async function readKnopCreateFoundingDataSource(options: {
  meshRoot: string;
  designatorPath: string;
  sourcePath: string;
  commandWorkingDirectory: string;
}): Promise<Uint8Array> {
  return await readFoundingDataSource({ ...options, operation: "knop create" });
}

export async function readFoundingDataVersionSource(options: {
  meshRoot: string;
  designatorPath: string;
  sourcePath: string;
  commandWorkingDirectory: string;
}): Promise<Uint8Array> {
  return await readFoundingDataSource({
    ...options,
    operation: "founding referent data version",
  });
}

async function readFoundingDataSource(options: {
  meshRoot: string;
  designatorPath: string;
  sourcePath: string;
  commandWorkingDirectory: string;
  operation: string;
}): Promise<Uint8Array> {
  const sourcePath = resolve(
    options.commandWorkingDirectory,
    options.sourcePath,
  );
  const targetPath = resolve(
    options.meshRoot,
    `${toFoundingReferentDataPath(options.designatorPath)}/data.ttl`,
  );
  if (sourcePath === targetPath) {
    throw new KnopCreateRuntimeError(
      `${options.operation} source must not be the conventional target`,
    );
  }

  const policy = await loadOperationalLocalPathPolicy(options.meshRoot);
  const relativeSourcePath = relative(options.meshRoot, sourcePath).replaceAll(
    "\\",
    "/",
  );
  try {
    const allowedPath = resolveAllowedLocalPath(
      policy,
      "workingLocalRelativePath",
      relativeSourcePath,
    );
    if (resolve(allowedPath) !== sourcePath) {
      throw new KnopCreateRuntimeError(
        `${options.operation} source resolved inconsistently`,
      );
    }
  } catch (error) {
    if (error instanceof LocalPathAccessError) {
      throw new KnopCreateRuntimeError(
        `${options.operation} source is outside the allowed local-path boundary: ${options.sourcePath}`,
      );
    }
    throw error;
  }

  let stat: Deno.FileInfo;
  try {
    stat = await Deno.stat(sourcePath);
  } catch {
    throw new KnopCreateRuntimeError(
      `${options.operation} source could not be read: ${options.sourcePath}`,
    );
  }
  if (!stat.isFile) {
    throw new KnopCreateRuntimeError(
      `${options.operation} source is not a file: ${options.sourcePath}`,
    );
  }
  return await Deno.readFile(sourcePath);
}

export function describeKnopCreateResult(result: KnopCreateResult): string {
  return `Created ${result.createdPaths.length} knop support artifacts for ${result.knopIri} and updated ${result.updatedPaths.length} mesh support artifact.`;
}

function resolveLoggers(
  options: ExecuteKnopCreateOptions,
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
      throw new KnopCreateRuntimeError(
        `Workspace root does not exist: ${workspaceRoot}`,
      );
    }
    throw error;
  }

  if (!stat.isDirectory) {
    throw new KnopCreateRuntimeError(
      `Workspace root is not a directory: ${workspaceRoot}`,
    );
  }
}

async function loadCurrentMeshState(
  workspaceRoot: string,
): Promise<{ meshBase: string; currentMeshInventoryTurtle: string }> {
  const meshMetadataPath = join(workspaceRoot, "_mesh/_meta/meta.ttl");
  const meshInventoryPath = join(
    workspaceRoot,
    "_mesh/_inventory/inventory.ttl",
  );
  let meshMetadataTurtle: string;
  let currentMeshInventoryTurtle: string;

  try {
    [meshMetadataTurtle, currentMeshInventoryTurtle] = await Promise.all([
      Deno.readTextFile(meshMetadataPath),
      Deno.readTextFile(meshInventoryPath),
    ]);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new KnopCreateRuntimeError(
        "Workspace does not contain an existing mesh support surface",
      );
    }
    throw error;
  }

  let meshBase: string;
  try {
    meshBase = resolveMeshBaseFromMetadataTurtle(meshMetadataTurtle);
  } catch (error) {
    if (error instanceof MeshMetadataResolutionError) {
      throw new KnopCreateRuntimeError(error.message);
    }
    if (error instanceof Error) {
      throw new KnopCreateRuntimeError(
        `Could not resolve mesh base from metadata: ${error.message}`,
      );
    }
    throw error;
  }

  return {
    meshBase,
    currentMeshInventoryTurtle,
  };
}
