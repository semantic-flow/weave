import { dirname, isAbsolute, join, normalize } from "@std/path";
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
  meshRoot?: string;
  request: MeshCreateRequest;
  existingFilePolicy?: MeshCreateExistingFilePolicy;
  operationalLogger?: StructuredLogger;
  auditLogger?: AuditLogger;
}

export type MeshCreateExistingFilePolicy = "reject" | "reuseMatching";

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
  const { operationalLogger, auditLogger } = resolveLoggers(options);
  const workspaceRoot = options.workspaceRoot;
  const meshRoot = normalizeMeshRoot(options.meshRoot);
  const planRequest = meshRoot === "." ? options.request : {
    ...options.request,
    workspaceRootRelativeToMeshRoot: workspaceRootRelativeToMeshRoot(meshRoot),
  };
  const plan = planMeshCreate(planRequest);
  const meshRootAbsolutePath = join(workspaceRoot, meshRoot);
  const existingFilePolicy = options.existingFilePolicy ?? "reject";

  await operationalLogger.info(
    "mesh.create.started",
    "Starting local mesh create",
    {
      workspaceRoot,
      meshRoot,
      meshBase: plan.meshBase,
      meshIri: plan.meshIri,
    },
  );
  await auditLogger.record(
    "mesh.create.started",
    "Local mesh create started",
    {
      workspaceRoot,
      meshRoot,
      meshBase: plan.meshBase,
    },
  );

  try {
    await ensureWorkspaceRootExists(workspaceRoot);
    const existingPaths = await classifyExistingTargets(
      meshRootAbsolutePath,
      plan,
      existingFilePolicy,
    );
    const createdFiles = await writePlannedFiles(
      meshRootAbsolutePath,
      plan,
      existingPaths,
    );
    const result: MeshCreateResult = {
      meshBase: plan.meshBase,
      meshIri: plan.meshIri,
      createdPaths: createdFiles.map((file) =>
        toWorkspaceRelativePath(meshRoot, file.path)
      ),
    };

    await operationalLogger.info(
      "mesh.create.succeeded",
      "Local mesh create succeeded",
      {
        workspaceRoot,
        meshRoot,
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
        meshRoot,
        meshBase: result.meshBase,
        createdPaths: result.createdPaths,
      },
    );

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await operationalLogger.error(
      "mesh.create.failed",
      "Local mesh create failed",
      {
        workspaceRoot,
        meshRoot,
        meshBase: plan.meshBase,
        error: message,
      },
    );
    await auditLogger.record(
      "mesh.create.failed",
      "Local mesh create failed",
      {
        workspaceRoot,
        meshRoot,
        meshBase: plan.meshBase,
        error: message,
      },
    );

    if (error instanceof MeshCreateRuntimeError) {
      throw error;
    }
    throw new MeshCreateRuntimeError(message);
  }
}

function normalizeMeshRoot(meshRoot: string | undefined): string {
  const raw = meshRoot ?? ".";
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new MeshCreateRuntimeError("meshRoot must not be empty");
  }
  if (trimmed.includes("\\")) {
    throw new MeshCreateRuntimeError("meshRoot must use forward slashes");
  }
  if (isAbsolute(trimmed)) {
    throw new MeshCreateRuntimeError(
      "meshRoot must be relative to the workspace root",
    );
  }

  const normalized = normalize(trimmed).replaceAll("\\", "/");
  if (normalized === ".." || normalized.startsWith("../")) {
    throw new MeshCreateRuntimeError(
      "meshRoot must stay within the workspace root",
    );
  }

  return normalized === "" ? "." : normalized;
}

function toWorkspaceRelativePath(meshRoot: string, path: string): string {
  return meshRoot === "." ? path : `${meshRoot}/${path}`;
}

function workspaceRootRelativeToMeshRoot(meshRoot: string): string {
  const segmentCount =
    meshRoot.split("/").filter((segment) =>
      segment.length > 0 && segment !== "."
    ).length;
  return "../".repeat(segmentCount);
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

async function classifyExistingTargets(
  meshRootAbsolutePath: string,
  plan: MeshCreatePlan,
  existingFilePolicy: MeshCreateExistingFilePolicy,
): Promise<ReadonlySet<string>> {
  const existingPaths = new Set<string>();

  for (const file of plan.files) {
    try {
      const existingContents = await Deno.readTextFile(
        join(meshRootAbsolutePath, file.path),
      );
      if (existingFilePolicy === "reject") {
        throw new MeshCreateRuntimeError(
          `mesh create target already exists: ${file.path}`,
        );
      }
      if (existingContents !== file.contents) {
        throw new MeshCreateRuntimeError(
          `mesh create target already exists with different contents: ${file.path}`,
        );
      }
      existingPaths.add(file.path);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        continue;
      }
      throw error;
    }
  }

  return existingPaths;
}

async function writePlannedFiles(
  meshRootAbsolutePath: string,
  plan: MeshCreatePlan,
  existingPaths: ReadonlySet<string>,
): Promise<readonly MeshCreatePlan["files"][number][]> {
  const createdFiles: MeshCreatePlan["files"][number][] = [];

  for (const file of plan.files) {
    if (existingPaths.has(file.path)) {
      continue;
    }
    const absolutePath = join(meshRootAbsolutePath, file.path);
    await Deno.mkdir(dirname(absolutePath), { recursive: true });
    await Deno.writeTextFile(absolutePath, file.contents, { createNew: true });
    createdFiles.push(file);
  }

  return createdFiles;
}
