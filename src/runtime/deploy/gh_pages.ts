import { dirname, isAbsolute, join, relative, resolve } from "@std/path";
import * as pathPosix from "@std/path/posix";
import { Parser } from "n3";
import {
  normalizeSafeDesignatorPath,
  toKnopPath,
} from "../../core/designator_segments.ts";
import { SFLO_TURTLE_PREFIX_DECLARATION } from "../../core/rdf/namespaces.ts";
import type { AuditLogger } from "../logging/audit_logger.ts";
import type { StructuredLogger } from "../logging/logger.ts";
import { resolveRuntimeLoggers } from "../logging/factory.ts";
import {
  describeMeshCreateResult,
  executeMeshCreate,
  type MeshCreateResult,
} from "../mesh/create.ts";
import { resolveMeshBaseFromMetadataTurtle } from "../mesh/metadata.ts";
import { executeIntegrate } from "../integrate/integrate.ts";
import { executePayloadUpdate } from "../payload/update.ts";
import { executeWeave } from "../weave/weave.ts";

export interface GHPagesDeployBootstrapRequest {
  meshBase: string;
  includeNoJekyll?: boolean;
  source?: GHPagesDeploySourceBindingRequest;
}

export interface GHPagesDeploySourceBindingRequest {
  sourcePath: string;
  designatorPath: string;
  targetPath?: string;
  sourceRepositoryUrl: string;
  sourceRepositoryRef: string;
  sourceRepositoryCommit?: string;
}

export interface ExecuteGHPagesDeployBootstrapOptions {
  sourceRoot: string;
  publishRoot: string;
  request: GHPagesDeployBootstrapRequest;
  operationalLogger?: StructuredLogger;
  auditLogger?: AuditLogger;
}

export interface GHPagesDeployBootstrapResult {
  sourceRoot: string;
  publishRoot: string;
  meshBase: string;
  meshIri: string;
  createdPaths: readonly string[];
  updatedPaths: readonly string[];
  materializedSource?: GHPagesDeployMaterializedSourceResult;
}

export interface GHPagesDeployMaterializedSourceResult {
  sourcePath: string;
  targetPath: string;
  designatorPath: string;
  digest: string;
  createdPaths: readonly string[];
  updatedPaths: readonly string[];
  wovenPaths: readonly string[];
}

export class GHPagesDeployInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GHPagesDeployInputError";
  }
}

export class GHPagesDeployRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GHPagesDeployRuntimeError";
  }
}

export async function executeGHPagesDeployBootstrap(
  options: ExecuteGHPagesDeployBootstrapOptions,
): Promise<GHPagesDeployBootstrapResult> {
  const { operationalLogger, auditLogger } = resolveRuntimeLoggers(options);
  const sourceRoot = resolveRequiredRootPath(
    options.sourceRoot,
    "sourceRoot",
  );
  const publishRoot = resolveRequiredRootPath(
    options.publishRoot,
    "publishRoot",
  );

  await operationalLogger.info(
    "deploy.ghPages.bootstrap.started",
    "Starting branch-published GitHub Pages bootstrap",
    {
      sourceRoot,
      publishRoot,
      meshBase: options.request.meshBase,
    },
  );
  await auditLogger.record(
    "deploy.ghPages.bootstrap.started",
    "Branch-published GitHub Pages bootstrap started",
    {
      sourceRoot,
      publishRoot,
      meshBase: options.request.meshBase,
    },
  );

  try {
    await assertDirectoryRoot(sourceRoot, "Source root");
    await assertDirectoryRoot(publishRoot, "Publication root");
    assertDistinctWorktreeRoots(sourceRoot, publishRoot);

    const meshCreateResult = await ensurePublicationMeshBootstrap({
      publishRoot,
      request: options.request,
      operationalLogger,
      auditLogger,
    });
    const materializedSource = options.request.source === undefined
      ? undefined
      : await materializeSourceBinding({
        sourceRoot,
        publishRoot,
        request: options.request.source,
        operationalLogger,
        auditLogger,
      });

    const result: GHPagesDeployBootstrapResult = {
      sourceRoot,
      publishRoot,
      meshBase: meshCreateResult.meshBase,
      meshIri: meshCreateResult.meshIri,
      createdPaths: meshCreateResult.createdPaths,
      updatedPaths: materializedSource?.updatedPaths ?? [],
      ...(materializedSource ? { materializedSource } : {}),
    };

    await operationalLogger.info(
      "deploy.ghPages.bootstrap.succeeded",
      "Branch-published GitHub Pages bootstrap succeeded",
      {
        sourceRoot,
        publishRoot,
        meshBase: result.meshBase,
        meshIri: result.meshIri,
        createdPaths: result.createdPaths,
        updatedPaths: result.updatedPaths,
        materializedSource,
      },
    );
    await auditLogger.record(
      "deploy.ghPages.bootstrap.succeeded",
      "Branch-published GitHub Pages bootstrap succeeded",
      {
        sourceRoot,
        publishRoot,
        meshBase: result.meshBase,
        createdPaths: result.createdPaths,
        updatedPaths: result.updatedPaths,
        materializedSource,
      },
    );

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await operationalLogger.error(
      "deploy.ghPages.bootstrap.failed",
      "Branch-published GitHub Pages bootstrap failed",
      {
        sourceRoot,
        publishRoot,
        meshBase: options.request.meshBase,
        error: message,
      },
    );
    await auditLogger.record(
      "deploy.ghPages.bootstrap.failed",
      "Branch-published GitHub Pages bootstrap failed",
      {
        sourceRoot,
        publishRoot,
        meshBase: options.request.meshBase,
        error: message,
      },
    );

    if (
      error instanceof GHPagesDeployInputError ||
      error instanceof GHPagesDeployRuntimeError
    ) {
      throw error;
    }
    throw new GHPagesDeployRuntimeError(message);
  }
}

export function describeGHPagesDeployBootstrapResult(
  result: GHPagesDeployBootstrapResult,
): string {
  const materialized = result.materializedSource === undefined
    ? ""
    : ` Materialized ${result.materializedSource.sourcePath} as ${result.materializedSource.designatorPath}.`;
  const materializedCreatedPathCount =
    result.materializedSource?.createdPaths.length ?? 0;
  const materializedUpdatedPathCount =
    result.materializedSource?.updatedPaths.length ?? 0;

  if (
    result.createdPaths.length === 0 && result.updatedPaths.length === 0 &&
    materializedCreatedPathCount === 0 && materializedUpdatedPathCount === 0
  ) {
    return `Branch-published GitHub Pages mesh already bootstrapped for ${result.meshIri}.`;
  }

  return `${
    describeMeshCreateResult(result)
  } Branch-published GitHub Pages mesh bootstrapped in publication root.${materialized}`;
}

const PUBLICATION_MESH_BOOTSTRAP_PATHS = [
  "_mesh/_meta/meta.ttl",
  "_mesh/_inventory/inventory.ttl",
  "_mesh/_config/config.ttl",
] as const;

async function ensurePublicationMeshBootstrap(
  options: {
    publishRoot: string;
    request: GHPagesDeployBootstrapRequest;
    operationalLogger: StructuredLogger;
    auditLogger: AuditLogger;
  },
): Promise<MeshCreateResult> {
  const existingMeshCreateResult = await tryResolveExistingPublicationMesh(
    options.publishRoot,
    options.request.meshBase,
  );
  if (existingMeshCreateResult) {
    return existingMeshCreateResult;
  }

  return await executeMeshCreate({
    workspaceRoot: options.publishRoot,
    request: {
      meshBase: options.request.meshBase,
      includeMeshConfig: true,
      includeNoJekyll: options.request.includeNoJekyll,
    },
    existingFilePolicy: "reuseMatching",
    operationalLogger: options.operationalLogger,
    auditLogger: options.auditLogger,
  });
}

async function tryResolveExistingPublicationMesh(
  publishRoot: string,
  requestedMeshBase: string,
): Promise<MeshCreateResult | undefined> {
  const existingEntries = await Promise.all(
    PUBLICATION_MESH_BOOTSTRAP_PATHS.map(async (path) => ({
      path,
      exists: await pathExists(join(publishRoot, path)),
    })),
  );
  if (existingEntries.every((entry) => !entry.exists)) {
    return undefined;
  }
  if (existingEntries.some((entry) => !entry.exists)) {
    const missingPaths = existingEntries
      .filter((entry) => !entry.exists)
      .map((entry) => entry.path);
    throw new GHPagesDeployRuntimeError(
      `Publication root contains a partial branch-published mesh bootstrap; missing ${
        missingPaths.join(", ")
      }`,
    );
  }

  const meshBase = resolveMeshBaseFromMetadataTurtle(
    await Deno.readTextFile(join(publishRoot, "_mesh/_meta/meta.ttl")),
  );
  const normalizedRequestedMeshBase = normalizeMeshBase(requestedMeshBase);
  if (meshBase !== normalizedRequestedMeshBase) {
    throw new GHPagesDeployInputError(
      `publication mesh base ${meshBase} does not match requested mesh base ${normalizedRequestedMeshBase}`,
    );
  }

  return {
    meshBase,
    meshIri: new URL("_mesh", meshBase).href,
    createdPaths: [],
  };
}

function normalizeMeshBase(meshBase: string): string {
  const trimmed = meshBase.trim();
  if (trimmed.length === 0) {
    throw new GHPagesDeployInputError("meshBase must not be empty");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new GHPagesDeployInputError("meshBase must be an absolute IRI");
  }

  if (!url.pathname.endsWith("/")) {
    throw new GHPagesDeployInputError("meshBase must end with '/'");
  }
  if (url.search.length > 0 || url.hash.length > 0) {
    throw new GHPagesDeployInputError(
      "meshBase must not include a query or fragment",
    );
  }

  return url.href;
}

async function materializeSourceBinding(
  options: {
    sourceRoot: string;
    publishRoot: string;
    request: GHPagesDeploySourceBindingRequest;
    operationalLogger: StructuredLogger;
    auditLogger: AuditLogger;
  },
): Promise<GHPagesDeployMaterializedSourceResult> {
  const sourcePath = normalizeRepositoryRelativePath(
    options.request.sourcePath,
    "sourcePath",
  );
  const targetPath = normalizeRepositoryRelativePath(
    options.request.targetPath ?? sourcePath,
    "targetPath",
  );
  const designatorPath = normalizeSafeDesignatorPath(
    options.request.designatorPath,
    "designatorPath",
    (message) => new GHPagesDeployInputError(message),
    { allowRoot: true },
  );
  const sourceRepositoryUrl = resolveRequiredText(
    options.request.sourceRepositoryUrl,
    "sourceRepositoryUrl",
  );
  const sourceRepositoryRef = resolveRequiredText(
    options.request.sourceRepositoryRef,
    "sourceRepositoryRef",
  );
  const sourceRepositoryCommit = options.request.sourceRepositoryCommit
    ?.trim() || undefined;
  const absoluteSourcePath = join(options.sourceRoot, sourcePath);
  const absoluteTargetPath = join(options.publishRoot, targetPath);
  const sourceBytes = await readSourceFile(absoluteSourcePath, sourcePath);
  const digest = await toSha256Digest(sourceBytes);
  const configUpdated = await upsertRepositorySourceLocator({
    publishRoot: options.publishRoot,
    sourcePath,
    targetPath,
    designatorPath,
    sourceRepositoryUrl,
    sourceRepositoryRef,
    sourceRepositoryCommit,
    digest,
  });
  const createdPaths: string[] = [];
  const updatedPaths: string[] = [];
  const wovenPaths: string[] = [];
  const meshSupportPagesExist = await pathExists(
    join(options.publishRoot, "_mesh/index.html"),
  );

  if (!meshSupportPagesExist) {
    const supportWeaveResult = await executeWeave({
      meshRoot: options.publishRoot,
      request: {},
      operationalLogger: options.operationalLogger,
      auditLogger: options.auditLogger,
    });
    createdPaths.push(...supportWeaveResult.createdPaths);
    updatedPaths.push(...supportWeaveResult.updatedPaths);
    wovenPaths.push(...supportWeaveResult.wovenDesignatorPaths);
  }

  const alreadyIntegrated = await pathExists(
    join(
      options.publishRoot,
      `${toKnopPath(designatorPath)}/_inventory/inventory.ttl`,
    ),
  );
  let payloadNeedsWeave = false;

  if (!alreadyIntegrated) {
    await writeNewMaterializedSourceFile({
      absoluteTargetPath,
      targetPath,
      sourceBytes,
    });
    createdPaths.push(targetPath);

    const integrateResult = await executeIntegrate({
      meshRoot: options.publishRoot,
      sourceBaseDirectory: options.publishRoot,
      request: {
        designatorPath,
        source: targetPath,
      },
      operationalLogger: options.operationalLogger,
      auditLogger: options.auditLogger,
    });
    createdPaths.push(...integrateResult.createdPaths);
    updatedPaths.push(...integrateResult.updatedPaths);
    payloadNeedsWeave = true;
  } else if (await fileBytesDiffer(absoluteTargetPath, sourceBytes)) {
    const payloadUpdateResult = await executePayloadUpdate({
      workspaceRoot: options.publishRoot,
      request: {
        designatorPath,
        source: absoluteSourcePath,
      },
      operationalLogger: options.operationalLogger,
      auditLogger: options.auditLogger,
    });
    updatedPaths.push(...payloadUpdateResult.updatedPaths);
    payloadNeedsWeave = true;
  }

  if (configUpdated) {
    updatedPaths.push("_mesh/_config/config.ttl");
  }

  if (payloadNeedsWeave) {
    const weaveResult = await executeWeave({
      meshRoot: options.publishRoot,
      request: {
        targets: [{ designatorPath }],
      },
      operationalLogger: options.operationalLogger,
      auditLogger: options.auditLogger,
    });
    createdPaths.push(...weaveResult.createdPaths);
    updatedPaths.push(...weaveResult.updatedPaths);
    wovenPaths.push(...weaveResult.wovenDesignatorPaths);
  }

  return {
    sourcePath,
    targetPath,
    designatorPath,
    digest,
    createdPaths: uniqueSortedPaths(createdPaths),
    updatedPaths: uniqueSortedPaths(updatedPaths),
    wovenPaths: uniqueSortedPaths(wovenPaths),
  };
}

function resolveRequiredRootPath(value: string, name: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new GHPagesDeployInputError(`${name} must not be empty`);
  }
  return resolve(trimmed);
}

function resolveRequiredText(value: string, name: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new GHPagesDeployInputError(`${name} must not be empty`);
  }
  return trimmed;
}

function normalizeRepositoryRelativePath(
  value: string,
  fieldName: string,
): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new GHPagesDeployInputError(`${fieldName} must not be empty`);
  }
  if (
    trimmed.includes("\\") || trimmed.includes("?") || trimmed.includes("#") ||
    isAbsolute(trimmed) || /^[A-Za-z]:/.test(trimmed)
  ) {
    throw new GHPagesDeployInputError(
      `${fieldName} must be a repository-relative path`,
    );
  }

  const normalized = pathPosix.normalize(trimmed);
  if (
    normalized === "." || normalized === ".." || normalized.startsWith("../")
  ) {
    throw new GHPagesDeployInputError(
      `${fieldName} must stay inside the repository root`,
    );
  }
  if (normalized.split("/").some((segment) => segment.length === 0)) {
    throw new GHPagesDeployInputError(
      `${fieldName} must not contain empty path segments`,
    );
  }

  return normalized;
}

async function readSourceFile(
  absoluteSourcePath: string,
  sourcePath: string,
): Promise<Uint8Array> {
  let stat: Deno.FileInfo;
  try {
    stat = await Deno.stat(absoluteSourcePath);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new GHPagesDeployRuntimeError(
        `branch-published source does not exist: ${sourcePath}`,
      );
    }
    throw error;
  }

  if (!stat.isFile) {
    throw new GHPagesDeployRuntimeError(
      `branch-published source is not a file: ${sourcePath}`,
    );
  }

  return await Deno.readFile(absoluteSourcePath);
}

async function writeNewMaterializedSourceFile(
  options: {
    absoluteTargetPath: string;
    targetPath: string;
    sourceBytes: Uint8Array;
  },
): Promise<void> {
  try {
    const currentBytes = await Deno.readFile(options.absoluteTargetPath);
    if (bytesEqual(currentBytes, options.sourceBytes)) {
      return;
    }
    throw new GHPagesDeployRuntimeError(
      `publication target already exists with different contents: ${options.targetPath}`,
    );
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }

  await Deno.mkdir(dirname(options.absoluteTargetPath), { recursive: true });
  await Deno.writeFile(options.absoluteTargetPath, options.sourceBytes, {
    createNew: true,
  });
}

async function fileBytesDiffer(
  absolutePath: string,
  expectedBytes: Uint8Array,
): Promise<boolean> {
  try {
    const currentBytes = await Deno.readFile(absolutePath);
    return !bytesEqual(currentBytes, expectedBytes);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return true;
    }
    throw error;
  }
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
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

async function toSha256Digest(bytes: Uint8Array): Promise<string> {
  const digestBuffer = await crypto.subtle.digest(
    "SHA-256",
    new Uint8Array(bytes),
  );
  const hex = [...new Uint8Array(digestBuffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
}

async function upsertRepositorySourceLocator(
  options: {
    publishRoot: string;
    sourcePath: string;
    targetPath: string;
    designatorPath: string;
    sourceRepositoryUrl: string;
    sourceRepositoryRef: string;
    sourceRepositoryCommit?: string;
    digest: string;
  },
): Promise<boolean> {
  const configPath = join(options.publishRoot, "_mesh/_config/config.ttl");
  const currentConfig = await Deno.readTextFile(configPath);
  const sourceBindingBlock = renderRepositorySourceLocatorBlock(options);
  const bindingKey = sourceBindingKey(options.designatorPath);
  const blockPattern = new RegExp(
    `\\n?# weave:branch-source-binding ${
      escapeRegExp(bindingKey)
    }\\n[\\s\\S]*?\\n# weave:end-branch-source-binding ${
      escapeRegExp(bindingKey)
    }\\n?`,
  );
  const configWithPrefixes = ensureSourceLocatorPrefixes(currentConfig);
  const nextConfig = blockPattern.test(configWithPrefixes)
    ? configWithPrefixes.replace(blockPattern, `\n${sourceBindingBlock}\n`)
    : `${configWithPrefixes.trimEnd()}\n\n${sourceBindingBlock}\n`;

  if (nextConfig === currentConfig) {
    return false;
  }

  validateTurtle(configPath, nextConfig);
  await Deno.writeTextFile(configPath, nextConfig);
  return true;
}

function renderRepositorySourceLocatorBlock(
  options: {
    sourcePath: string;
    targetPath: string;
    designatorPath: string;
    sourceRepositoryUrl: string;
    sourceRepositoryRef: string;
    sourceRepositoryCommit?: string;
    digest: string;
  },
): string {
  const bindingKey = sourceBindingKey(options.designatorPath);
  const commitFact = options.sourceRepositoryCommit === undefined
    ? ""
    : `    sflo:sourceRepositoryCommit ${
      JSON.stringify(options.sourceRepositoryCommit)
    } ;\n`;
  return `# weave:branch-source-binding ${bindingKey}
<#${bindingKey}> a sflo:ArtifactResolutionTarget ;
  sflo:hasTargetArtifact <${options.designatorPath}> ;
  sflo:targetLocalRelativePath ${JSON.stringify(options.targetPath)} ;
  sflo:expectsContentDigest ${JSON.stringify(options.digest)} ;
  sflo:hasTargetRepositorySource [
    a sflo:RepositorySourceLocator ;
    sflo:sourceRepositoryUrl ${JSON.stringify(options.sourceRepositoryUrl)} ;
    sflo:sourceRepositoryRef ${JSON.stringify(options.sourceRepositoryRef)} ;
${commitFact}    sflo:sourceRepositoryPath ${
    JSON.stringify(options.sourcePath)
  } ;
    sflo:hasContentDigest ${JSON.stringify(options.digest)}
  ] .
# weave:end-branch-source-binding ${bindingKey}`;
}

function sourceBindingKey(designatorPath: string): string {
  const raw = designatorPath.length === 0 ? "root" : designatorPath;
  return `branch-source-${raw.replaceAll(/[^A-Za-z0-9_-]+/g, "-")}`;
}

function ensureSourceLocatorPrefixes(config: string): string {
  if (config.includes(SFLO_TURTLE_PREFIX_DECLARATION)) {
    return config;
  }

  const lines = config.split("\n");
  const prefixInsertIndex = lines.findLastIndex((line) =>
    line.trimStart().startsWith("@prefix ")
  );
  if (prefixInsertIndex < 0) {
    return `${SFLO_TURTLE_PREFIX_DECLARATION}\n${config}`;
  }

  lines.splice(prefixInsertIndex + 1, 0, SFLO_TURTLE_PREFIX_DECLARATION);
  return lines.join("\n");
}

function validateTurtle(path: string, turtle: string): void {
  try {
    new Parser().parse(turtle);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new GHPagesDeployRuntimeError(
      `Generated RDF did not parse for ${path}: ${message}`,
    );
  }
}

function uniqueSortedPaths(paths: readonly string[]): string[] {
  return [...new Set(paths)].sort((left, right) => left.localeCompare(right));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function assertDirectoryRoot(
  root: string,
  label: string,
): Promise<void> {
  let stat: Deno.FileInfo;
  try {
    stat = await Deno.stat(root);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new GHPagesDeployRuntimeError(`${label} does not exist: ${root}`);
    }
    throw error;
  }

  if (!stat.isDirectory) {
    throw new GHPagesDeployRuntimeError(
      `${label} is not a directory: ${root}`,
    );
  }
}

function assertDistinctWorktreeRoots(
  sourceRoot: string,
  publishRoot: string,
): void {
  if (sourceRoot === publishRoot) {
    throw new GHPagesDeployInputError(
      "source root and publication root must be different for branch-published deployment",
    );
  }
  if (isWithinRoot(publishRoot, sourceRoot)) {
    throw new GHPagesDeployInputError(
      "publication root must not be inside the source root for branch-published deployment",
    );
  }
  if (isWithinRoot(sourceRoot, publishRoot)) {
    throw new GHPagesDeployInputError(
      "source root must not be inside the publication root for branch-published deployment",
    );
  }
}

function isWithinRoot(candidatePath: string, rootPath: string): boolean {
  const relation = relative(rootPath, candidatePath).replaceAll("\\", "/");
  return relation.length > 0 && !relation.startsWith("../") &&
    relation !== "..";
}
