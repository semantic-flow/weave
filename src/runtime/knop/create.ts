import { dirname, join } from "@std/path";
import {
  KnopCreateInputError,
  type KnopCreatePlan,
  type KnopCreateRequest,
  planKnopCreate,
} from "../../core/knop/create.ts";
import {
  MeshMetadataResolutionError,
  resolveMeshBaseFromMetadataTurtle,
} from "../mesh/metadata.ts";
import { resolveRuntimeLoggers } from "../logging/factory.ts";
import type { AuditLogger } from "../logging/audit_logger.ts";
import type { StructuredLogger } from "../logging/logger.ts";

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
    await assertCreateTargetsDoNotExist(workspaceRoot, plan);
    await writeCreatedFiles(workspaceRoot, plan);
    await writeUpdatedFiles(workspaceRoot, plan);
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
    createdPaths: plan.createdFiles.map((file) => file.path),
    updatedPaths: plan.updatedFiles.map((file) => file.path),
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

async function assertCreateTargetsDoNotExist(
  workspaceRoot: string,
  plan: KnopCreatePlan,
): Promise<void> {
  for (const file of plan.createdFiles) {
    try {
      await Deno.stat(join(workspaceRoot, file.path));
      throw new KnopCreateRuntimeError(
        `knop create target already exists: ${file.path}`,
      );
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        continue;
      }
      throw error;
    }
  }
}

async function writeCreatedFiles(
  workspaceRoot: string,
  plan: KnopCreatePlan,
): Promise<void> {
  for (const file of plan.createdFiles) {
    const absolutePath = join(workspaceRoot, file.path);
    await Deno.mkdir(dirname(absolutePath), { recursive: true });
    await Deno.writeTextFile(absolutePath, file.contents, { createNew: true });
  }
}

async function writeUpdatedFiles(
  workspaceRoot: string,
  plan: KnopCreatePlan,
): Promise<void> {
  for (const file of plan.updatedFiles) {
    const absolutePath = join(workspaceRoot, file.path);
    await Deno.mkdir(dirname(absolutePath), { recursive: true });
    await Deno.writeTextFile(absolutePath, file.contents);
  }
}
