import {
  dirname,
  fromFileUrl,
  isAbsolute,
  join,
  relative,
  resolve,
} from "@std/path";
import { Parser } from "n3";
import {
  IntegrateInputError,
  type IntegratePlan,
  planIntegrate,
} from "../../core/integrate/integrate.ts";
import {
  MeshMetadataResolutionError,
  resolveMeshBaseFromMetadataTurtle,
} from "../mesh/metadata.ts";
import {
  loadOperationalLocalPathPolicy,
  LocalPathAccessError,
  type OperationalLocalPathPolicy,
  resolveAllowedLocalPath,
} from "../operational/local_path_policy.ts";
import { resolveRuntimeLoggers } from "../logging/factory.ts";
import type { AuditLogger } from "../logging/audit_logger.ts";
import type { StructuredLogger } from "../logging/logger.ts";

export interface LocalIntegrateRequest {
  designatorPath: string;
  source: string;
}

export interface ExecuteIntegrateOptions {
  workspaceRoot: string;
  request: LocalIntegrateRequest;
  operationalLogger?: StructuredLogger;
  auditLogger?: AuditLogger;
}

export interface IntegrateResult {
  meshBase: string;
  designatorPath: string;
  payloadArtifactIri: string;
  knopIri: string;
  workingFilePath: string;
  createdPaths: readonly string[];
  updatedPaths: readonly string[];
}

export class IntegrateRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntegrateRuntimeError";
  }
}

export async function executeIntegrate(
  options: ExecuteIntegrateOptions,
): Promise<IntegrateResult> {
  const { operationalLogger, auditLogger } = resolveLoggers(options);
  const workspaceRoot = options.workspaceRoot;
  const designatorPath = options.request.designatorPath;
  const source = options.request.source;
  let plan: IntegratePlan | undefined;
  let workingFilePath: string | undefined;

  await operationalLogger.info(
    "integrate.started",
    "Starting local integrate",
    {
      workspaceRoot,
      designatorPath,
      source,
    },
  );
  await auditLogger.record(
    "integrate.started",
    "Local integrate started",
    {
      workspaceRoot,
      designatorPath,
      source,
    },
  );

  try {
    await ensureWorkspaceRootExists(workspaceRoot);
    const localPathPolicy = await loadOperationalLocalPathPolicy(workspaceRoot);
    const resolvedSource = await resolveLocalSource(
      workspaceRoot,
      localPathPolicy,
      source,
    );
    workingFilePath = resolvedSource.workingFilePath;
    const meshState = await loadCurrentMeshState(workspaceRoot);
    plan = planIntegrate({
      meshBase: meshState.meshBase,
      currentMeshInventoryTurtle: meshState.currentMeshInventoryTurtle,
      designatorPath,
      workingFilePath,
    });
    assertUpdatedTargetsExist(workspaceRoot, plan);
    await assertCreateTargetsDoNotExist(workspaceRoot, plan);
    validateRdfPlan(plan);
    await writeCreatedFiles(workspaceRoot, plan);
    await writeUpdatedFiles(workspaceRoot, plan);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await operationalLogger.error(
      "integrate.failed",
      "Local integrate failed",
      {
        workspaceRoot,
        designatorPath,
        source,
        workingFilePath,
        payloadArtifactIri: plan?.payloadArtifactIri,
        knopIri: plan?.knopIri,
        error: message,
      },
    );
    await auditLogger.record(
      "integrate.failed",
      "Local integrate failed",
      {
        workspaceRoot,
        designatorPath,
        source,
        workingFilePath,
        payloadArtifactIri: plan?.payloadArtifactIri,
        knopIri: plan?.knopIri,
        error: message,
      },
    );

    if (
      error instanceof IntegrateInputError ||
      error instanceof IntegrateRuntimeError
    ) {
      throw error;
    }
    throw new IntegrateRuntimeError(message);
  }

  const result: IntegrateResult = {
    meshBase: plan.meshBase,
    designatorPath: plan.designatorPath,
    payloadArtifactIri: plan.payloadArtifactIri,
    knopIri: plan.knopIri,
    workingFilePath: plan.workingFilePath,
    createdPaths: plan.createdFiles.map((file) => file.path),
    updatedPaths: plan.updatedFiles.map((file) => file.path),
  };

  await operationalLogger.info(
    "integrate.succeeded",
    "Local integrate succeeded",
    {
      workspaceRoot,
      designatorPath: result.designatorPath,
      payloadArtifactIri: result.payloadArtifactIri,
      knopIri: result.knopIri,
      workingFilePath: result.workingFilePath,
      createdPaths: result.createdPaths,
      updatedPaths: result.updatedPaths,
    },
  );
  await auditLogger.record(
    "integrate.succeeded",
    "Local integrate succeeded",
    {
      workspaceRoot,
      designatorPath: result.designatorPath,
      payloadArtifactIri: result.payloadArtifactIri,
      knopIri: result.knopIri,
      workingFilePath: result.workingFilePath,
      createdPaths: result.createdPaths,
      updatedPaths: result.updatedPaths,
    },
  );

  return result;
}

export function describeIntegrateResult(result: IntegrateResult): string {
  return `Integrated ${result.workingFilePath} as ${result.payloadArtifactIri} and created ${result.createdPaths.length} support artifacts while updating ${result.updatedPaths.length} mesh artifact.`;
}

function resolveLoggers(
  options: ExecuteIntegrateOptions,
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
      throw new IntegrateRuntimeError(
        `Workspace root does not exist: ${workspaceRoot}`,
      );
    }
    throw error;
  }

  if (!stat.isDirectory) {
    throw new IntegrateRuntimeError(
      `Workspace root is not a directory: ${workspaceRoot}`,
    );
  }
}

async function resolveLocalSource(
  workspaceRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  source: string,
): Promise<{ absoluteSourcePath: string; workingFilePath: string }> {
  const trimmed = source.trim();
  if (trimmed.length === 0) {
    throw new IntegrateRuntimeError(
      "integrate requires a source path or file URL",
    );
  }

  const absoluteSourcePath = resolveSourcePath(workspaceRoot, trimmed);
  let stat: Deno.FileInfo;
  try {
    stat = await Deno.stat(absoluteSourcePath);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new IntegrateRuntimeError(
        `integrate source does not exist: ${trimmed}`,
      );
    }
    throw error;
  }

  if (!stat.isFile) {
    throw new IntegrateRuntimeError(
      `integrate source is not a file: ${trimmed}`,
    );
  }

  const workingFilePath = relative(workspaceRoot, absoluteSourcePath)
    .replaceAll("\\", "/");
  if (workingFilePath.length === 0 || workingFilePath === "..") {
    throw new IntegrateRuntimeError(
      `integrate source is not a file: ${trimmed}`,
    );
  }
  try {
    const allowedSourcePath = resolveAllowedLocalPath(
      localPathPolicy,
      "workingFilePath",
      workingFilePath,
    );
    if (resolve(allowedSourcePath) !== resolve(absoluteSourcePath)) {
      throw new IntegrateRuntimeError(
        `integrate source resolved inconsistently against operational path policy: ${trimmed}`,
      );
    }
  } catch (error) {
    if (error instanceof LocalPathAccessError) {
      throw new IntegrateRuntimeError(
        `integrate source is outside the allowed local-path boundary: ${trimmed}`,
      );
    }
    throw error;
  }

  return {
    absoluteSourcePath,
    workingFilePath,
  };
}

function resolveSourcePath(workspaceRoot: string, source: string): string {
  const parsedUrl = tryParseUrl(source);
  if (parsedUrl) {
    if (parsedUrl.protocol !== "file:") {
      throw new IntegrateRuntimeError(
        "The current local integrate slice only supports local filesystem sources.",
      );
    }
    return resolve(fromFileUrl(parsedUrl));
  }

  return isAbsolute(source) ? resolve(source) : resolve(workspaceRoot, source);
}

function tryParseUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
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
      throw new IntegrateRuntimeError(
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
      throw new IntegrateRuntimeError(error.message);
    }
    // resolveMeshBaseFromMetadataTurtle currently only throws MeshMetadataResolutionError.
    throw error;
  }

  return {
    meshBase,
    currentMeshInventoryTurtle,
  };
}

function assertUpdatedTargetsExist(
  workspaceRoot: string,
  plan: IntegratePlan,
): void {
  for (const file of plan.updatedFiles) {
    const absolutePath = join(workspaceRoot, file.path);
    try {
      Deno.statSync(absolutePath);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        throw new IntegrateRuntimeError(
          `integrate target does not exist: ${file.path}`,
        );
      }
      throw error;
    }
  }
}

async function assertCreateTargetsDoNotExist(
  workspaceRoot: string,
  plan: IntegratePlan,
): Promise<void> {
  for (const file of plan.createdFiles) {
    try {
      await Deno.stat(join(workspaceRoot, file.path));
      throw new IntegrateRuntimeError(
        `integrate target already exists: ${file.path}`,
      );
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        continue;
      }
      throw error;
    }
  }
}

function validateRdfPlan(plan: IntegratePlan): void {
  const parser = new Parser();

  for (const file of [...plan.createdFiles, ...plan.updatedFiles]) {
    if (!file.path.endsWith(".ttl")) {
      continue;
    }
    try {
      parser.parse(file.contents);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new IntegrateRuntimeError(
        `Generated RDF did not parse for ${file.path}: ${message}`,
      );
    }
  }
}

async function writeCreatedFiles(
  workspaceRoot: string,
  plan: IntegratePlan,
): Promise<void> {
  for (const file of plan.createdFiles) {
    const absolutePath = join(workspaceRoot, file.path);
    await Deno.mkdir(dirname(absolutePath), { recursive: true });
    await Deno.writeTextFile(absolutePath, file.contents, { createNew: true });
  }
}

async function writeUpdatedFiles(
  workspaceRoot: string,
  plan: IntegratePlan,
): Promise<void> {
  for (const file of plan.updatedFiles) {
    const absolutePath = join(workspaceRoot, file.path);
    await Deno.mkdir(dirname(absolutePath), { recursive: true });
    await Deno.writeTextFile(absolutePath, file.contents);
  }
}
