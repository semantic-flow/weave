import { dirname, join } from "@std/path";
import {
  type MeshCreatePlan,
  type MeshCreateRequest,
  planMeshCreate,
} from "../../core/mesh/create.ts";
import { resolveRuntimeLoggers } from "../logging/factory.ts";
import type { AuditLogger } from "../logging/audit_logger.ts";
import type { StructuredLogger } from "../logging/logger.ts";

export interface ExecuteMeshCreateOptions {
  workspaceRoot: string;
  request: MeshCreateRequest;
  operationalLogger?: StructuredLogger;
  auditLogger?: AuditLogger;
}

export interface MeshCreateResult {
  meshBase: string;
  meshIri: string;
  createdPaths: readonly string[];
}

export class MeshCreateRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MeshCreateRuntimeError";
  }
}

export async function executeMeshCreate(
  options: ExecuteMeshCreateOptions,
): Promise<MeshCreateResult> {
  const plan = planMeshCreate(options.request);
  const { operationalLogger, auditLogger } = resolveLoggers(options);
  const workspaceRoot = options.workspaceRoot;

  await operationalLogger.info(
    "mesh.create.started",
    "Starting local mesh create",
    {
      workspaceRoot,
      meshBase: plan.meshBase,
      meshIri: plan.meshIri,
    },
  );
  await auditLogger.record(
    "mesh.create.started",
    "Local mesh create started",
    {
      workspaceRoot,
      meshBase: plan.meshBase,
    },
  );

  try {
    await ensureWorkspaceRootExists(workspaceRoot);
    await assertTargetsDoNotExist(workspaceRoot, plan);
    await writePlannedFiles(workspaceRoot, plan);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await operationalLogger.error(
      "mesh.create.failed",
      "Local mesh create failed",
      {
        workspaceRoot,
        meshBase: plan.meshBase,
        error: message,
      },
    );
    await auditLogger.record(
      "mesh.create.failed",
      "Local mesh create failed",
      {
        workspaceRoot,
        meshBase: plan.meshBase,
        error: message,
      },
    );

    if (error instanceof MeshCreateRuntimeError) {
      throw error;
    }
    throw new MeshCreateRuntimeError(message);
  }

  const result: MeshCreateResult = {
    meshBase: plan.meshBase,
    meshIri: plan.meshIri,
    createdPaths: plan.files.map((file) => file.path),
  };

  await operationalLogger.info(
    "mesh.create.succeeded",
    "Local mesh create succeeded",
    {
      workspaceRoot,
      meshBase: result.meshBase,
      meshIri: result.meshIri,
      createdPaths: result.createdPaths,
    },
  );
  await auditLogger.record(
    "mesh.create.succeeded",
    "Local mesh create succeeded",
    {
      workspaceRoot,
      meshBase: result.meshBase,
      createdPaths: result.createdPaths,
    },
  );

  return result;
}

export function describeMeshCreateResult(result: MeshCreateResult): string {
  return `Created ${result.createdPaths.length} mesh support artifacts for ${result.meshIri}.`;
}

function resolveLoggers(
  options: ExecuteMeshCreateOptions,
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
      throw new MeshCreateRuntimeError(
        `Workspace root does not exist: ${workspaceRoot}`,
      );
    }
    throw error;
  }

  if (!stat.isDirectory) {
    throw new MeshCreateRuntimeError(
      `Workspace root is not a directory: ${workspaceRoot}`,
    );
  }
}

async function assertTargetsDoNotExist(
  workspaceRoot: string,
  plan: MeshCreatePlan,
): Promise<void> {
  for (const file of plan.files) {
    try {
      await Deno.stat(join(workspaceRoot, file.path));
      throw new MeshCreateRuntimeError(
        `mesh create target already exists: ${file.path}`,
      );
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        continue;
      }
      throw error;
    }
  }
}

async function writePlannedFiles(
  workspaceRoot: string,
  plan: MeshCreatePlan,
): Promise<void> {
  for (const file of plan.files) {
    const absolutePath = join(workspaceRoot, file.path);
    await Deno.mkdir(dirname(absolutePath), { recursive: true });
    await Deno.writeTextFile(absolutePath, file.contents, { createNew: true });
  }
}
