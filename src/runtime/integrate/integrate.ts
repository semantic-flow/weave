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
  type IntegrateRepositorySource,
  type IntegrateSourceBinding,
  planIntegrate,
} from "../../core/integrate/integrate.ts";
import {
  MeshMetadataResolutionError,
  resolveMeshBaseFromMetadataTurtle,
} from "../mesh/metadata.ts";
import {
  ensureHostLocalWorkingDirectoryAccessRule,
  ensureMeshConfigWorkingDirectoryAccessRule,
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
  sourceBinding?: LocalIntegrateSourceBindingRequest;
}

export interface LocalIntegrateSourceBindingRequest {
  sourceRepositoryUrl?: string;
  sourceRepositoryRef?: string;
  sourceRepositoryCommit?: string;
  sourceRepositoryPath?: string;
  sourceDigest?: string;
}

export interface ExecuteIntegrateOptions {
  meshRoot: string;
  sourceBaseDirectory?: string;
  sourceAccessDirectory?: string;
  request: LocalIntegrateRequest;
  operationalLogger?: StructuredLogger;
  auditLogger?: AuditLogger;
}

export interface IntegrateResult {
  meshBase: string;
  designatorPath: string;
  payloadArtifactIri: string;
  knopIri: string;
  workingLocalRelativePath: string;
  sourceBindingIri?: string;
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
  const meshRoot = options.meshRoot;
  const designatorPath = options.request.designatorPath;
  const source = options.request.source;
  let plan: IntegratePlan | undefined;
  let workingLocalRelativePath: string | undefined;
  let sourceAccessConfigPath: string | undefined;
  let localPathPolicy = await loadOperationalLocalPathPolicy(meshRoot);
  const workspaceRoot = localPathPolicy.workspaceRoot;
  const sourceBaseDirectory = options.sourceBaseDirectory ?? meshRoot;

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
    await ensureMeshRootExists(meshRoot);
    if (options.sourceAccessDirectory !== undefined) {
      const grantResult = await grantSourceDirectoryAccess({
        sourceBaseDirectory,
        meshRoot,
        localPathPolicy,
        source,
        sourceAccessDirectory: options.sourceAccessDirectory,
      });
      sourceAccessConfigPath = grantResult.updated
        ? grantResult.configPath
        : undefined;
      localPathPolicy = await loadOperationalLocalPathPolicy(meshRoot);
    }
    const resolvedSource = await resolveLocalSource(
      sourceBaseDirectory,
      meshRoot,
      localPathPolicy,
      source,
    );
    workingLocalRelativePath = resolvedSource.workingLocalRelativePath;
    const requestedSourceBinding = await resolveSourceBinding(
      options.request.sourceBinding,
      resolvedSource.absoluteSourcePath,
    );
    const sourceBinding = requestedSourceBinding ??
      resolveImplicitWorkingSourceBinding(
        resolvedSource.workingLocalRelativePath,
      );
    const meshState = await loadCurrentMeshState(meshRoot);
    plan = planIntegrate({
      meshBase: meshState.meshBase,
      currentMeshInventoryTurtle: meshState.currentMeshInventoryTurtle,
      designatorPath,
      workingLocalRelativePath,
      ...(sourceBinding ? { sourceBinding } : {}),
    });
    assertUpdatedTargetsExist(meshRoot, plan);
    await assertCreateTargetsDoNotExist(meshRoot, plan);
    validateRdfPlan(plan);
    await writeCreatedFiles(meshRoot, plan);
    await writeUpdatedFiles(meshRoot, plan);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await operationalLogger.error(
      "integrate.failed",
      "Local integrate failed",
      {
        workspaceRoot,
        designatorPath,
        source,
        workingLocalRelativePath,
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
        workingLocalRelativePath,
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
    workingLocalRelativePath: plan.workingLocalRelativePath,
    ...(plan.sourceBindingIri
      ? { sourceBindingIri: plan.sourceBindingIri }
      : {}),
    createdPaths: plan.createdFiles.map((file) =>
      toWorkspaceRelativePath(localPathPolicy, file.path)
    ),
    updatedPaths: [
      ...plan.updatedFiles.map((file) =>
        toWorkspaceRelativePath(localPathPolicy, file.path)
      ),
      ...(sourceAccessConfigPath
        ? [toDisplayPath(localPathPolicy, sourceAccessConfigPath)]
        : []),
    ],
  };

  await operationalLogger.info(
    "integrate.succeeded",
    "Local integrate succeeded",
    {
      workspaceRoot,
      designatorPath: result.designatorPath,
      payloadArtifactIri: result.payloadArtifactIri,
      knopIri: result.knopIri,
      workingLocalRelativePath: result.workingLocalRelativePath,
      sourceBindingIri: result.sourceBindingIri,
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
      workingLocalRelativePath: result.workingLocalRelativePath,
      sourceBindingIri: result.sourceBindingIri,
      createdPaths: result.createdPaths,
      updatedPaths: result.updatedPaths,
    },
  );

  return result;
}

export function describeIntegrateResult(result: IntegrateResult): string {
  return `Integrated ${result.workingLocalRelativePath} as ${result.payloadArtifactIri} and created ${result.createdPaths.length} support artifacts while updating ${result.updatedPaths.length} mesh artifact.`;
}

function resolveLoggers(
  options: ExecuteIntegrateOptions,
): {
  operationalLogger: StructuredLogger;
  auditLogger: AuditLogger;
} {
  return resolveRuntimeLoggers(options);
}

async function ensureMeshRootExists(meshRoot: string): Promise<void> {
  let stat: Deno.FileInfo;
  try {
    stat = await Deno.stat(meshRoot);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new IntegrateRuntimeError(
        `Mesh root does not exist: ${meshRoot}`,
      );
    }
    throw error;
  }

  if (!stat.isDirectory) {
    throw new IntegrateRuntimeError(
      `Mesh root is not a directory: ${meshRoot}`,
    );
  }
}

async function resolveLocalSource(
  sourceBaseDirectory: string,
  meshRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  source: string,
): Promise<{ absoluteSourcePath: string; workingLocalRelativePath: string }> {
  const trimmed = source.trim();
  if (trimmed.length === 0) {
    throw new IntegrateRuntimeError(
      "integrate requires a source path or file URL",
    );
  }

  const absoluteSourcePath = resolveSourcePath(sourceBaseDirectory, trimmed);
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

  const workingLocalRelativePath = relative(meshRoot, absoluteSourcePath)
    .replaceAll("\\", "/");
  if (
    workingLocalRelativePath.length === 0 || workingLocalRelativePath === ".."
  ) {
    throw new IntegrateRuntimeError(
      `integrate source is not a file: ${trimmed}`,
    );
  }
  try {
    const allowedSourcePath = resolveAllowedLocalPath(
      localPathPolicy,
      "workingLocalRelativePath",
      workingLocalRelativePath,
    );
    if (resolve(allowedSourcePath) !== resolve(absoluteSourcePath)) {
      throw new IntegrateRuntimeError(
        `integrate source resolved inconsistently against operational path policy: ${trimmed}`,
      );
    }
  } catch (error) {
    if (error instanceof LocalPathAccessError) {
      throw new IntegrateRuntimeError(
        `integrate source is outside the allowed local-path boundary: ${trimmed}${
          renderLocalPathAccessSuggestion(
            sourceBaseDirectory,
            localPathPolicy,
            absoluteSourcePath,
          )
        }`,
      );
    }
    throw error;
  }

  return {
    absoluteSourcePath,
    workingLocalRelativePath,
  };
}

async function resolveSourceBinding(
  request: LocalIntegrateSourceBindingRequest | undefined,
  absoluteSourcePath: string,
): Promise<IntegrateSourceBinding | undefined> {
  if (request === undefined) {
    return undefined;
  }

  const hasRepositoryUrl = request.sourceRepositoryUrl !== undefined;
  const hasRepositoryRef = request.sourceRepositoryRef !== undefined;
  const hasRepositoryPath = request.sourceRepositoryPath !== undefined;
  const hasRepositoryMetadata = hasRepositoryUrl || hasRepositoryRef ||
    hasRepositoryPath || request.sourceRepositoryCommit !== undefined;
  const hasRepositoryLocator = hasRepositoryUrl && hasRepositoryRef &&
    hasRepositoryPath;
  if (
    hasRepositoryMetadata && !hasRepositoryLocator
  ) {
    throw new IntegrateRuntimeError(
      "repository-backed integrate source bindings require --source-repository-url, --source-repository-ref, and --source-repository-path",
    );
  }
  if (request.sourceDigest !== undefined && !hasRepositoryMetadata) {
    throw new IntegrateRuntimeError(
      "integrate source digest requires repository-backed source metadata",
    );
  }
  if (!hasRepositoryMetadata) {
    return {
      artifactResolutionMode: "working",
    };
  }

  const sourceDigest = await sha256FileDigest(absoluteSourcePath);
  if (
    request.sourceDigest !== undefined &&
    request.sourceDigest !== sourceDigest
  ) {
    throw new IntegrateRuntimeError(
      `integrate source digest mismatch: expected ${request.sourceDigest}, computed ${sourceDigest}`,
    );
  }
  const repositorySource: IntegrateRepositorySource = {
    repositoryUrl: request.sourceRepositoryUrl!,
    repositoryRef: request.sourceRepositoryRef!,
    ...(request.sourceRepositoryCommit
      ? { repositoryCommit: request.sourceRepositoryCommit }
      : {}),
    repositoryPath: request.sourceRepositoryPath!,
    contentDigest: sourceDigest,
  };

  return {
    repositorySource,
    expectedContentDigest: sourceDigest,
    artifactResolutionMode: "working",
  };
}

function resolveImplicitWorkingSourceBinding(
  workingLocalRelativePath: string,
): IntegrateSourceBinding | undefined {
  return workingLocalRelativePath.startsWith("../")
    ? { artifactResolutionMode: "working" }
    : undefined;
}

async function sha256FileDigest(absoluteSourcePath: string): Promise<string> {
  const bytes = await Deno.readFile(absoluteSourcePath);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
}

async function grantSourceDirectoryAccess(
  options: {
    sourceBaseDirectory: string;
    meshRoot: string;
    localPathPolicy: OperationalLocalPathPolicy;
    source: string;
    sourceAccessDirectory: string;
  },
): Promise<{ updated: boolean; configPath: string }> {
  const absoluteSourcePath = resolveSourcePath(
    options.sourceBaseDirectory,
    options.source.trim(),
  );
  const absoluteAccessDirectory = resolveSourcePath(
    options.sourceBaseDirectory,
    options.sourceAccessDirectory.trim(),
  );
  let stat: Deno.FileInfo;
  try {
    stat = await Deno.stat(absoluteAccessDirectory);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new IntegrateRuntimeError(
        `source access directory does not exist: ${options.sourceAccessDirectory}`,
      );
    }
    throw error;
  }
  if (!stat.isDirectory) {
    throw new IntegrateRuntimeError(
      `source access directory is not a directory: ${options.sourceAccessDirectory}`,
    );
  }
  if (!isWithinRoot(absoluteSourcePath, absoluteAccessDirectory)) {
    throw new IntegrateRuntimeError(
      `source access directory does not contain integrate source: ${options.sourceAccessDirectory}`,
    );
  }
  if (isWithinRoot(absoluteAccessDirectory, options.meshRoot)) {
    return {
      updated: false,
      configPath: join(options.meshRoot, "_mesh/_config/config.ttl"),
    };
  }

  const pathPrefix = relative(options.meshRoot, absoluteAccessDirectory)
    .replaceAll("\\", "/");
  if (
    isWithinRoot(
      absoluteAccessDirectory,
      options.localPathPolicy.workspaceRoot,
    ) &&
    resolve(absoluteAccessDirectory) !==
      resolve(options.localPathPolicy.workspaceRoot) &&
    pathPrefix !== ".."
  ) {
    const updated = await ensureMeshConfigWorkingDirectoryAccessRule(
      options.localPathPolicy,
      pathPrefix,
    );
    return {
      updated,
      configPath: join(options.meshRoot, "_mesh/_config/config.ttl"),
    };
  }

  const result = await ensureHostLocalWorkingDirectoryAccessRule(
    options.localPathPolicy,
    absoluteAccessDirectory,
  );
  return result;
}

function resolveSourcePath(
  sourceBaseDirectory: string,
  source: string,
): string {
  const parsedUrl = tryParseUrl(source);
  if (parsedUrl) {
    if (parsedUrl.protocol !== "file:") {
      throw new IntegrateRuntimeError(
        "The current local integrate slice only supports local filesystem sources.",
      );
    }
    return resolve(fromFileUrl(parsedUrl));
  }

  return isAbsolute(source)
    ? resolve(source)
    : resolve(sourceBaseDirectory, source);
}

function renderLocalPathAccessSuggestion(
  sourceBaseDirectory: string,
  localPathPolicy: OperationalLocalPathPolicy,
  absoluteSourcePath: string,
): string {
  const sourceDirectory = dirname(absoluteSourcePath);
  if (
    !isWithinRoot(sourceDirectory, localPathPolicy.meshRoot)
  ) {
    const relativeSourceDirectory = relative(
      sourceBaseDirectory,
      sourceDirectory,
    ).replaceAll("\\", "/");
    const suggestedDirectory = relativeSourceDirectory.length === 0
      ? "."
      : relativeSourceDirectory;
    return `; run again with --grant-source-directory ${suggestedDirectory} to add a constrained operational path grant for that source directory`;
  }

  return "; add an explicit local path access rule before integrating extra-workspace sources";
}

function toWorkspaceRelativePath(
  policy: OperationalLocalPathPolicy,
  meshRelativePath: string,
): string {
  const path = relative(
    policy.workspaceRoot,
    join(policy.meshRoot, meshRelativePath),
  ).replaceAll("\\", "/");
  return path.length === 0 ? "." : path;
}

function toDisplayPath(
  policy: OperationalLocalPathPolicy,
  absolutePath: string,
): string {
  const relativePath = relative(policy.workspaceRoot, absolutePath)
    .replaceAll("\\", "/");
  if (
    relativePath.length > 0 &&
    !relativePath.startsWith("../") &&
    relativePath !== ".."
  ) {
    return relativePath;
  }
  return absolutePath;
}

function isWithinRoot(candidatePath: string, rootPath: string): boolean {
  const relation = relative(resolve(rootPath), resolve(candidatePath));
  return relation.length === 0 ||
    (!relation.startsWith("..") && !isAbsolute(relation));
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
