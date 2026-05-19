import { dirname, isAbsolute, join, relative, resolve } from "@std/path";
import * as pathPosix from "@std/path/posix";
import { Parser } from "n3";
import {
  normalizeSafeDesignatorPath,
  toKnopPath,
} from "../../core/designator_segments.ts";
import { SFLO_TURTLE_PREFIX_DECLARATION } from "../../core/rdf/namespaces.ts";
import {
  normalizeVersionTargetSpecs,
  type VersionTargetSpec,
} from "../../core/targeting.ts";
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
  historySegment?: string;
  stateSegment?: string;
  manifestationSegment?: string;
  sourceRepositoryUrl: string;
  sourceRepositoryRef: string;
  sourceRepositoryCommit?: string;
}

export interface ExecuteGHPagesDeployBootstrapOptions {
  sourceRoot: string;
  publishRoot: string;
  request: GHPagesDeployBootstrapRequest;
  allowDirtyPublicationRoot?: boolean;
  commit?: GHPagesDeployCommitRequest;
  operationalLogger?: StructuredLogger;
  auditLogger?: AuditLogger;
}

export interface PlanGHPagesDeployBootstrapOptions {
  sourceRoot: string;
  publishRoot: string;
  request: GHPagesDeployBootstrapRequest;
  allowDirtyPublicationRoot?: boolean;
  commit?: GHPagesDeployCommitRequest;
}

export interface GHPagesDeployCommitRequest {
  message?: string;
}

export interface GHPagesDeployBootstrapResult {
  sourceRoot: string;
  publishRoot: string;
  meshBase: string;
  meshIri: string;
  createdPaths: readonly string[];
  updatedPaths: readonly string[];
  materializedSource?: GHPagesDeployMaterializedSourceResult;
  localCommit?: GHPagesDeployLocalCommitResult;
}

export interface GHPagesDeployBootstrapPlan {
  sourceRoot: string;
  publishRoot: string;
  meshBase: string;
  meshIri: string;
  createdPaths: readonly string[];
  updatedPaths: readonly string[];
  preservedPaths: readonly string[];
  validationChecks: readonly string[];
  gitOperations: readonly string[];
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

export type GHPagesDeployLocalCommitResult =
  | {
    status: "created";
    commit: string;
    message: string;
    pushReminder: string;
  }
  | {
    status: "skipped";
    message: string;
    reason: string;
  };

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

export async function planGHPagesDeployBootstrap(
  options: PlanGHPagesDeployBootstrapOptions,
): Promise<GHPagesDeployBootstrapPlan> {
  const sourceRoot = resolveRequiredRootPath(
    options.sourceRoot,
    "sourceRoot",
  );
  const publishRoot = resolveRequiredRootPath(
    options.publishRoot,
    "publishRoot",
  );

  await assertDirectoryRoot(sourceRoot, "Source root");
  await assertDirectoryRoot(publishRoot, "Publication root");
  assertDistinctWorktreeRoots(sourceRoot, publishRoot);
  if (options.commit !== undefined) {
    await assertLocalCommitRequestIsSafe({
      publishRoot,
      allowDirtyPublicationRoot: options.allowDirtyPublicationRoot === true,
      request: options.commit,
    });
  }
  if (options.allowDirtyPublicationRoot !== true) {
    await assertCleanPublicationWorktree(publishRoot);
  }
  await assertNoStalePublicationOutput(publishRoot);
  await validateGeneratedPublicationOutput({ sourceRoot, publishRoot });

  const temporaryPublishRoot = await Deno.makeTempDir({
    prefix: "weave-gh-pages-dry-run-",
  });
  try {
    await copyPublicationTreeForDryRun(publishRoot, temporaryPublishRoot);
    const beforeSnapshot = await readPublicationFileSnapshot(
      temporaryPublishRoot,
    );
    const simulatedResult = await executeGHPagesDeployBootstrap({
      sourceRoot,
      publishRoot: temporaryPublishRoot,
      request: options.request,
      allowDirtyPublicationRoot: true,
    });
    const afterSnapshot = await readPublicationFileSnapshot(
      temporaryPublishRoot,
    );
    const diff = diffPublicationSnapshots(beforeSnapshot, afterSnapshot);

    return {
      sourceRoot,
      publishRoot,
      meshBase: simulatedResult.meshBase,
      meshIri: simulatedResult.meshIri,
      createdPaths: diff.createdPaths,
      updatedPaths: diff.updatedPaths,
      preservedPaths: diff.preservedPaths,
      validationChecks: describePlanValidationChecks(
        options.allowDirtyPublicationRoot === true,
      ),
      gitOperations: await describePlanGitOperations(
        publishRoot,
        options.allowDirtyPublicationRoot === true,
        options.commit,
      ),
      ...(simulatedResult.materializedSource
        ? { materializedSource: simulatedResult.materializedSource }
        : {}),
    };
  } finally {
    await removeTemporaryPublicationRoot(temporaryPublishRoot);
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
    "prepare.ghPages.bootstrap.started",
    "Starting branch-published GitHub Pages preparation",
    {
      sourceRoot,
      publishRoot,
      meshBase: options.request.meshBase,
    },
  );
  await auditLogger.record(
    "prepare.ghPages.bootstrap.started",
    "Branch-published GitHub Pages preparation started",
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
    if (options.commit !== undefined) {
      await assertLocalCommitRequestIsSafe({
        publishRoot,
        allowDirtyPublicationRoot: options.allowDirtyPublicationRoot === true,
        request: options.commit,
      });
    }
    if (options.allowDirtyPublicationRoot !== true) {
      await assertCleanPublicationWorktree(publishRoot);
    }
    await assertNoStalePublicationOutput(publishRoot);

    const meshCreateResult = await ensurePublicationMeshBootstrap({
      publishRoot,
      request: options.request,
      operationalLogger,
      auditLogger,
    });
    const publicationControlsResult = await ensurePublicationControls({
      publishRoot,
      request: options.request,
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
      createdPaths: uniqueSortedPaths([
        ...meshCreateResult.createdPaths,
        ...publicationControlsResult.createdPaths,
      ]),
      updatedPaths: uniqueSortedPaths([
        ...publicationControlsResult.updatedPaths,
        ...(materializedSource?.updatedPaths ?? []),
      ]),
      ...(materializedSource ? { materializedSource } : {}),
    };
    await validateGeneratedPublicationOutput({
      sourceRoot,
      publishRoot,
    });
    const localCommit = options.commit === undefined
      ? undefined
      : await createLocalPublicationCommit({
        publishRoot,
        request: options.commit,
      });
    if (localCommit !== undefined) {
      result.localCommit = localCommit;
    }

    await operationalLogger.info(
      "prepare.ghPages.bootstrap.succeeded",
      "Branch-published GitHub Pages preparation succeeded",
      {
        sourceRoot,
        publishRoot,
        meshBase: result.meshBase,
        meshIri: result.meshIri,
        createdPaths: result.createdPaths,
        updatedPaths: result.updatedPaths,
        materializedSource,
        localCommit,
      },
    );
    await auditLogger.record(
      "prepare.ghPages.bootstrap.succeeded",
      "Branch-published GitHub Pages preparation succeeded",
      {
        sourceRoot,
        publishRoot,
        meshBase: result.meshBase,
        createdPaths: result.createdPaths,
        updatedPaths: result.updatedPaths,
        materializedSource,
        localCommit,
      },
    );

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await operationalLogger.error(
      "prepare.ghPages.bootstrap.failed",
      "Branch-published GitHub Pages preparation failed",
      {
        sourceRoot,
        publishRoot,
        meshBase: options.request.meshBase,
        error: message,
      },
    );
    await auditLogger.record(
      "prepare.ghPages.bootstrap.failed",
      "Branch-published GitHub Pages preparation failed",
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
  const localCommit = result.localCommit === undefined
    ? ""
    : ` ${describeGHPagesDeployLocalCommitResult(result.localCommit)}`;
  const materializedCreatedPathCount =
    result.materializedSource?.createdPaths.length ?? 0;
  const materializedUpdatedPathCount =
    result.materializedSource?.updatedPaths.length ?? 0;

  if (
    result.createdPaths.length === 0 && result.updatedPaths.length === 0 &&
    materializedCreatedPathCount === 0 && materializedUpdatedPathCount === 0
  ) {
    return `Branch-published GitHub Pages mesh already prepared for ${result.meshIri}.${localCommit}`;
  }

  return `${
    describeMeshCreateResult(result)
  } Branch-published GitHub Pages mesh prepared in publication root.${materialized}${localCommit}`;
}

export function describeGHPagesDeployLocalCommitResult(
  result: GHPagesDeployLocalCommitResult,
): string {
  if (result.status === "skipped") {
    return `No local publication commit created: ${result.reason}.`;
  }

  const shortCommit = result.commit.slice(0, 12);
  return `Created local publication commit ${shortCommit}. ${result.pushReminder}`;
}

export function describeGHPagesDeployBootstrapPlan(
  plan: GHPagesDeployBootstrapPlan,
): string {
  const lines = [
    "Dry run: branch-published GitHub Pages preparation",
    `Source root: ${plan.sourceRoot}`,
    `Publication root: ${plan.publishRoot}`,
    `Mesh base: ${plan.meshBase}`,
    `Mesh IRI: ${plan.meshIri}`,
  ];
  if (plan.createdPaths.length === 0 && plan.updatedPaths.length === 0) {
    lines.push("No publication file changes would be made.");
  }

  appendPlanSection(lines, "Created paths", plan.createdPaths);
  appendPlanSection(lines, "Updated paths", plan.updatedPaths);
  appendPlanSection(lines, "Preserved paths", plan.preservedPaths);

  if (plan.materializedSource) {
    lines.push("Materialized source:");
    lines.push(`- source path: ${plan.materializedSource.sourcePath}`);
    lines.push(`- target path: ${plan.materializedSource.targetPath}`);
    lines.push(
      `- designator path: ${plan.materializedSource.designatorPath}`,
    );
    lines.push(`- digest: ${plan.materializedSource.digest}`);
  }

  appendPlanSection(lines, "Validation checks", plan.validationChecks);
  appendPlanSection(lines, "Git operations", plan.gitOperations);
  return lines.join("\n");
}

function appendPlanSection(
  lines: string[],
  title: string,
  values: readonly string[],
): void {
  lines.push(`${title}:`);
  if (values.length === 0) {
    lines.push("- (none)");
    return;
  }
  for (const value of values) {
    lines.push(`- ${value}`);
  }
}

const PUBLICATION_MESH_REQUIRED_BOOTSTRAP_PATHS = [
  "_mesh/_meta/meta.ttl",
  "_mesh/_inventory/inventory.ttl",
] as const;
const PUBLICATION_MESH_OPTIONAL_BOOTSTRAP_PATHS = [
  "_mesh/_config/config.ttl",
] as const;
const DEFAULT_PUBLICATION_COMMIT_MESSAGE = "Publish branch-published mesh";
const PUBLICATION_PUSH_REMINDER =
  "Push the publication branch for GitHub Pages to update.";

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
  const requiredEntries = await Promise.all(
    PUBLICATION_MESH_REQUIRED_BOOTSTRAP_PATHS.map(async (path) => ({
      path,
      exists: await pathExists(join(publishRoot, path)),
    })),
  );
  const optionalEntries = await Promise.all(
    PUBLICATION_MESH_OPTIONAL_BOOTSTRAP_PATHS.map(async (path) => ({
      path,
      exists: await pathExists(join(publishRoot, path)),
    })),
  );
  if (requiredEntries.every((entry) => !entry.exists)) {
    if (optionalEntries.some((entry) => entry.exists)) {
      const missingPaths = requiredEntries
        .filter((entry) => !entry.exists)
        .map((entry) => entry.path);
      throw new GHPagesDeployRuntimeError(
        `Publication root contains a partial branch-published mesh bootstrap; missing ${
          missingPaths.join(", ")
        }`,
      );
    }
    return undefined;
  }
  if (requiredEntries.some((entry) => !entry.exists)) {
    const missingPaths = requiredEntries
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

async function ensurePublicationControls(
  options: {
    publishRoot: string;
    request: GHPagesDeployBootstrapRequest;
  },
): Promise<
  { createdPaths: readonly string[]; updatedPaths: readonly string[] }
> {
  const createdPaths: string[] = [];
  const updatedPaths: string[] = [];

  if (options.request.includeNoJekyll !== false) {
    const noJekyllResult = await ensureTextFile({
      publishRoot: options.publishRoot,
      path: ".nojekyll",
      contents: "",
    });
    appendFileWriteResult(noJekyllResult, createdPaths, updatedPaths);
  }

  return {
    createdPaths: uniqueSortedPaths(createdPaths),
    updatedPaths: uniqueSortedPaths(updatedPaths),
  };
}

function appendFileWriteResult(
  result: FileWriteResult,
  createdPaths: string[],
  updatedPaths: string[],
): void {
  if (result.kind === "created") {
    createdPaths.push(result.path);
  } else if (result.kind === "updated") {
    updatedPaths.push(result.path);
  }
}

type FileWriteResult =
  | { kind: "created"; path: string }
  | { kind: "updated"; path: string }
  | { kind: "unchanged"; path: string };

async function ensureTextFile(
  options: {
    publishRoot: string;
    path: string;
    contents: string;
  },
): Promise<FileWriteResult> {
  const absolutePath = join(options.publishRoot, options.path);
  try {
    const currentContents = await Deno.readTextFile(absolutePath);
    if (currentContents === options.contents) {
      return { kind: "unchanged", path: options.path };
    }
    await Deno.writeTextFile(absolutePath, options.contents);
    return { kind: "updated", path: options.path };
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }

  await Deno.mkdir(dirname(absolutePath), { recursive: true });
  await Deno.writeTextFile(absolutePath, options.contents, { createNew: true });
  return { kind: "created", path: options.path };
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
  const versionTarget = resolveMaterializedSourceVersionTarget({
    designatorPath,
    request: options.request,
  });
  const absoluteSourcePath = join(options.sourceRoot, sourcePath);
  const absoluteTargetPath = join(options.publishRoot, targetPath);
  const sourceBytes = await readSourceFile(absoluteSourcePath, sourcePath);
  const digest = await toSha256Digest(sourceBytes);
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

  if (payloadNeedsWeave) {
    const weaveResult = await executeWeave({
      meshRoot: options.publishRoot,
      request: {
        targets: [versionTarget],
      },
      operationalLogger: options.operationalLogger,
      auditLogger: options.auditLogger,
    });
    createdPaths.push(...weaveResult.createdPaths);
    updatedPaths.push(...weaveResult.updatedPaths);
    wovenPaths.push(...weaveResult.wovenDesignatorPaths);
  }

  const sourceRegistryResult = await upsertKnopSourceRegistry({
    publishRoot: options.publishRoot,
    sourcePath,
    targetPath,
    designatorPath,
    sourceRepositoryUrl,
    sourceRepositoryRef,
    sourceRepositoryCommit,
    digest,
  });
  appendFileWriteResult(
    sourceRegistryResult.inventory,
    createdPaths,
    updatedPaths,
  );
  appendFileWriteResult(
    sourceRegistryResult.sources,
    createdPaths,
    updatedPaths,
  );

  if (
    await removeLegacyRepositorySourceLocatorBlock({
      publishRoot: options.publishRoot,
      designatorPath,
    })
  ) {
    updatedPaths.push("_mesh/_config/config.ttl");
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

function resolveMaterializedSourceVersionTarget(
  options: {
    designatorPath: string;
    request: GHPagesDeploySourceBindingRequest;
  },
): VersionTargetSpec {
  const targets = normalizeVersionTargetSpecs(
    [{
      designatorPath: options.designatorPath,
      ...(options.request.historySegment !== undefined
        ? { historySegment: options.request.historySegment }
        : {}),
      ...(options.request.stateSegment !== undefined
        ? { stateSegment: options.request.stateSegment }
        : {}),
      ...(options.request.manifestationSegment !== undefined
        ? { manifestationSegment: options.request.manifestationSegment }
        : {}),
    }],
    "prepare gh-pages source target",
    (message) => new GHPagesDeployInputError(message),
  );
  return targets[0]!.source;
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

async function copyPublicationTreeForDryRun(
  fromRoot: string,
  toRoot: string,
): Promise<void> {
  let entries: Deno.DirEntry[];
  try {
    entries = [];
    for await (const entry of Deno.readDir(fromRoot)) {
      entries.push(entry);
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return;
    }
    throw error;
  }

  for (const entry of entries) {
    if (entry.name === ".git") {
      continue;
    }

    const fromPath = join(fromRoot, entry.name);
    const toPath = join(toRoot, entry.name);
    if (entry.isDirectory) {
      await Deno.mkdir(toPath, { recursive: true });
      await copyPublicationTreeForDryRun(fromPath, toPath);
      continue;
    }
    if (entry.isFile || entry.isSymlink) {
      await Deno.mkdir(dirname(toPath), { recursive: true });
      await Deno.copyFile(fromPath, toPath);
    }
  }
}

async function removeTemporaryPublicationRoot(path: string): Promise<void> {
  try {
    await Deno.remove(path, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }
}

async function readPublicationFileSnapshot(
  root: string,
): Promise<Map<string, Uint8Array>> {
  const snapshot = new Map<string, Uint8Array>();
  for await (const absolutePath of walkPublicationFiles(root)) {
    const relativePath = relative(root, absolutePath).replaceAll("\\", "/");
    snapshot.set(relativePath, await Deno.readFile(absolutePath));
  }
  return snapshot;
}

function diffPublicationSnapshots(
  before: ReadonlyMap<string, Uint8Array>,
  after: ReadonlyMap<string, Uint8Array>,
): {
  createdPaths: readonly string[];
  updatedPaths: readonly string[];
  preservedPaths: readonly string[];
} {
  const createdPaths: string[] = [];
  const updatedPaths: string[] = [];
  const preservedPaths: string[] = [];

  for (const [path, nextBytes] of after) {
    const previousBytes = before.get(path);
    if (previousBytes === undefined) {
      createdPaths.push(path);
    } else if (bytesEqual(previousBytes, nextBytes)) {
      preservedPaths.push(path);
    } else {
      updatedPaths.push(path);
    }
  }

  return {
    createdPaths: uniqueSortedPaths(createdPaths),
    updatedPaths: uniqueSortedPaths(updatedPaths),
    preservedPaths: uniqueSortedPaths(preservedPaths),
  };
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

async function upsertKnopSourceRegistry(
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
): Promise<{ inventory: FileWriteResult; sources: FileWriteResult }> {
  const knopPath = toKnopPath(options.designatorPath);
  const sourceRegistryPath = `${knopPath}/_sources`;
  const sourcesFilePath = `${sourceRegistryPath}/sources.ttl`;
  const inventoryPath = `${knopPath}/_inventory/inventory.ttl`;
  const bindingKey = sourceBindingKey(options.designatorPath);
  const meshBase = resolveMeshBaseFromMetadataTurtle(
    await Deno.readTextFile(join(options.publishRoot, "_mesh/_meta/meta.ttl")),
  );
  const sources = await ensureTextFile({
    publishRoot: options.publishRoot,
    path: sourcesFilePath,
    contents: renderKnopSourceRegistryTurtle({
      ...options,
      meshBase,
      sourceRegistryPath,
      sourcesFilePath,
      bindingKey,
    }),
  });
  const inventory = await upsertKnopSourceRegistryInventory({
    publishRoot: options.publishRoot,
    path: inventoryPath,
    knopPath,
    sourceRegistryPath,
    sourcesFilePath,
  });

  return { inventory, sources };
}

async function upsertKnopSourceRegistryInventory(
  options: {
    publishRoot: string;
    path: string;
    knopPath: string;
    sourceRegistryPath: string;
    sourcesFilePath: string;
  },
): Promise<FileWriteResult> {
  const absolutePath = join(options.publishRoot, options.path);
  const currentInventory = await Deno.readTextFile(absolutePath);
  const nextInventory = renderKnopInventoryWithSourceRegistry(
    currentInventory,
    options,
  );

  if (nextInventory === currentInventory) {
    return { kind: "unchanged", path: options.path };
  }

  validateTurtle(options.path, nextInventory);
  await Deno.writeTextFile(absolutePath, nextInventory);
  return { kind: "updated", path: options.path };
}

function renderKnopInventoryWithSourceRegistry(
  inventory: string,
  options: {
    knopPath: string;
    sourceRegistryPath: string;
    sourcesFilePath: string;
  },
): string {
  const inventoryWithPrefix = ensureSfloPrefix(inventory);
  const blocks = splitTurtleBlocks(inventoryWithPrefix);
  const nextBlocks = blocks
    .map((block) =>
      getSubjectPathFromTurtleBlock(block) === options.knopPath
        ? renderKnopBlockWithSourceRegistry(block, options.sourceRegistryPath)
        : block
    )
    .filter((block) => {
      const subjectPath = getSubjectPathFromTurtleBlock(block);
      return subjectPath !== options.sourceRegistryPath &&
        subjectPath !== options.sourcesFilePath;
    });
  const inventorySubject = `${options.knopPath}/_inventory`;
  const insertIndex = nextBlocks.findIndex((block) =>
    getSubjectPathFromTurtleBlock(block) === inventorySubject
  );
  if (insertIndex < 0) {
    throw new GHPagesDeployRuntimeError(
      `Could not find KnopInventory block <${inventorySubject}> while updating source registry`,
    );
  }

  nextBlocks.splice(
    insertIndex + 1,
    0,
    renderKnopSourceRegistryInventoryBlock(options),
  );
  return `${nextBlocks.join("\n\n").trimEnd()}\n`;
}

function renderKnopBlockWithSourceRegistry(
  block: string,
  sourceRegistryPath: string,
): string {
  const sourceRegistryLine =
    `  sflo:hasKnopSourceRegistry <${sourceRegistryPath}> ;`;
  if (block.includes(sourceRegistryLine)) {
    return block;
  }
  const workingInventoryLine = "  sflo:hasWorkingKnopInventoryFile ";
  if (!block.includes(workingInventoryLine)) {
    throw new GHPagesDeployRuntimeError(
      "Could not find hasWorkingKnopInventoryFile while updating source registry",
    );
  }
  return block.replace(
    workingInventoryLine,
    `${sourceRegistryLine}\n${workingInventoryLine}`,
  );
}

function renderKnopSourceRegistryInventoryBlock(
  options: {
    sourceRegistryPath: string;
    sourcesFilePath: string;
  },
): string {
  return `<${options.sourceRegistryPath}> a sflo:KnopSourceRegistry, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${options.sourcesFilePath}> .

<${options.sourcesFilePath}> a sflo:LocatedFile, sflo:RdfDocument .`;
}

function renderKnopSourceRegistryTurtle(
  options: {
    sourcePath: string;
    targetPath: string;
    designatorPath: string;
    meshBase: string;
    sourceRegistryPath: string;
    sourcesFilePath: string;
    bindingKey: string;
    sourceRepositoryUrl: string;
    sourceRepositoryRef: string;
    sourceRepositoryCommit?: string;
    digest: string;
  },
): string {
  const bindingPath = `${options.sourceRegistryPath}#${options.bindingKey}`;
  const targetArtifactIri = new URL(options.designatorPath, options.meshBase)
    .href;
  const commitFact = options.sourceRepositoryCommit === undefined
    ? ""
    : `    sflo:sourceRepositoryCommit ${
      JSON.stringify(options.sourceRepositoryCommit)
    } ;\n`;
  return `@base <${options.meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}

<${options.sourceRegistryPath}> a sflo:KnopSourceRegistry, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${options.sourcesFilePath}> ;
  sflo:hasSourceBinding <${bindingPath}> .

<${bindingPath}> a sflo:ArtifactResolutionTarget ;
  sflo:hasTargetArtifact <${targetArtifactIri}> ;
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

<${options.sourcesFilePath}> a sflo:LocatedFile, sflo:RdfDocument .
`;
}

async function removeLegacyRepositorySourceLocatorBlock(
  options: { publishRoot: string; designatorPath: string },
): Promise<boolean> {
  const configPath = join(options.publishRoot, "_mesh/_config/config.ttl");
  let currentConfig: string;
  try {
    currentConfig = await Deno.readTextFile(configPath);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }
    throw error;
  }

  const bindingKey = sourceBindingKey(options.designatorPath);
  const blockPattern = new RegExp(
    `\\n?# weave:branch-source-binding ${
      escapeRegExp(bindingKey)
    }\\n[\\s\\S]*?\\n# weave:end-branch-source-binding ${
      escapeRegExp(bindingKey)
    }\\n?`,
  );
  const nextConfig = `${currentConfig.replace(blockPattern, "\n").trimEnd()}\n`;

  if (nextConfig === currentConfig) {
    return false;
  }

  validateTurtle(configPath, nextConfig);
  await Deno.writeTextFile(configPath, nextConfig);
  return true;
}

function sourceBindingKey(designatorPath: string): string {
  const raw = designatorPath.length === 0 ? "root" : designatorPath;
  return `branch-source-${raw.replaceAll(/[^A-Za-z0-9_-]+/g, "-")}`;
}

function ensureSfloPrefix(turtle: string): string {
  if (turtle.includes(SFLO_TURTLE_PREFIX_DECLARATION)) {
    return turtle;
  }

  const lines = turtle.split("\n");
  const prefixInsertIndex = lines.findLastIndex((line) =>
    line.trimStart().startsWith("@prefix ")
  );
  if (prefixInsertIndex < 0) {
    return `${SFLO_TURTLE_PREFIX_DECLARATION}\n${turtle}`;
  }

  lines.splice(prefixInsertIndex + 1, 0, SFLO_TURTLE_PREFIX_DECLARATION);
  return lines.join("\n");
}

function splitTurtleBlocks(turtle: string): string[] {
  return turtle.trimEnd().split(/\n{2,}/);
}

function getSubjectPathFromTurtleBlock(block: string): string | undefined {
  const match = block.match(/^<([^>]*)>/);
  return match?.[1];
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

async function assertCleanPublicationWorktree(
  publishRoot: string,
): Promise<void> {
  const isWorktreeRoot = await isGitWorktreeRoot(publishRoot);
  if (!isWorktreeRoot) {
    return;
  }

  const status = await runGitInspection(publishRoot, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ]);
  if (!status.success) {
    throw new GHPagesDeployRuntimeError(
      `Could not inspect publication root git status: ${status.stderr.trim()}`,
    );
  }
  if (status.stdout.trim().length === 0) {
    return;
  }

  throw new GHPagesDeployInputError(
    `publication root has uncommitted or untracked changes; commit, stash, or clean the publication worktree before preparing, or explicitly allow a dirty publication root`,
  );
}

async function assertLocalCommitRequestIsSafe(
  options: {
    publishRoot: string;
    allowDirtyPublicationRoot: boolean;
    request: GHPagesDeployCommitRequest;
  },
): Promise<void> {
  normalizePublicationCommitMessage(options.request);
  if (options.allowDirtyPublicationRoot) {
    throw new GHPagesDeployInputError(
      "local publication commits require the default clean publication worktree check; --commit cannot be combined with --allow-dirty-publish-root",
    );
  }
  if (!(await isGitWorktreeRoot(options.publishRoot))) {
    throw new GHPagesDeployInputError(
      "local publication commits require publishRoot to be a git worktree root",
    );
  }
}

async function createLocalPublicationCommit(
  options: {
    publishRoot: string;
    request: GHPagesDeployCommitRequest;
  },
): Promise<GHPagesDeployLocalCommitResult> {
  const message = normalizePublicationCommitMessage(options.request);
  const status = await runGitMutation(options.publishRoot, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ]);
  if (status.trim().length === 0) {
    return {
      status: "skipped",
      message,
      reason: "publication worktree has no changes",
    };
  }

  await runGitMutation(options.publishRoot, ["add", "-A", "--", "."]);
  await runGitMutation(options.publishRoot, [
    "commit",
    "-m",
    message,
  ]);
  const commitSha = await runGitMutation(options.publishRoot, [
    "rev-parse",
    "HEAD",
  ]);

  return {
    status: "created",
    commit: commitSha.trim(),
    message,
    pushReminder: PUBLICATION_PUSH_REMINDER,
  };
}

function normalizePublicationCommitMessage(
  request: GHPagesDeployCommitRequest,
): string {
  const message = request.message?.trim() ?? DEFAULT_PUBLICATION_COMMIT_MESSAGE;
  if (message.length === 0) {
    throw new GHPagesDeployInputError("commit message must not be empty");
  }
  return message;
}

const STALE_PUBLICATION_OUTPUT_PATHS = [
  ".weave",
  ".sf-local-access.ttl",
  "docs/_mesh",
] as const;

async function assertNoStalePublicationOutput(
  publishRoot: string,
): Promise<void> {
  for (const path of STALE_PUBLICATION_OUTPUT_PATHS) {
    if (await pathExists(join(publishRoot, path))) {
      throw new GHPagesDeployRuntimeError(
        `Publication root contains stale branch-published output or local operational state at ${path}; remove it or use an explicit rebuild flow before preparing.`,
      );
    }
  }
}

async function validateGeneratedPublicationOutput(
  options: {
    sourceRoot: string;
    publishRoot: string;
  },
): Promise<void> {
  const forbiddenNeedles = [
    { label: "source root", value: options.sourceRoot },
    { label: "publication root", value: options.publishRoot },
  ];

  for await (const absolutePath of walkPublicationFiles(options.publishRoot)) {
    const relativePath = relative(options.publishRoot, absolutePath)
      .replaceAll("\\", "/");
    if (!shouldValidateGeneratedRdfPath(relativePath)) {
      continue;
    }

    const contents = await Deno.readTextFile(absolutePath);
    for (const needle of forbiddenNeedles) {
      if (contents.includes(needle.value)) {
        throw new GHPagesDeployRuntimeError(
          `Generated publication RDF ${relativePath} contains a local ${needle.label} path.`,
        );
      }
    }
    if (contents.includes("../")) {
      throw new GHPagesDeployRuntimeError(
        `Generated publication RDF ${relativePath} contains parent-directory traversal.`,
      );
    }
  }
}

function describePlanValidationChecks(
  allowDirtyPublicationRoot: boolean,
): readonly string[] {
  return [
    "source root exists and is a directory",
    "publication root exists and is a directory",
    "source and publication roots are distinct",
    allowDirtyPublicationRoot
      ? "dirty publication worktree enforcement is explicitly skipped"
      : "publication git worktree is clean before generation",
    "known stale branch-published output paths are absent",
    "existing generated RDF contains no local source/publication root paths or parent-directory traversal",
    "planned writes were simulated in an isolated temporary publication root",
  ];
}

async function describePlanGitOperations(
  publishRoot: string,
  allowDirtyPublicationRoot: boolean,
  commit?: GHPagesDeployCommitRequest,
): Promise<readonly string[]> {
  const commitMessage = commit === undefined
    ? undefined
    : normalizePublicationCommitMessage(commit);
  if (!(await isGitWorktreeRoot(publishRoot))) {
    return commitMessage === undefined
      ? [
        "no git worktree detected at the publication root; prepare will not commit or push",
      ]
      : [
        "no git worktree detected at the publication root; requested local commit would fail",
        "prepare will not push",
      ];
  }

  const operations = [
    allowDirtyPublicationRoot
      ? "skip dirty publication worktree enforcement because dirty roots were explicitly allowed"
      : "inspect publication worktree status before writing",
  ];
  if (commitMessage === undefined) {
    operations.push(
      "write publication files only; prepare will not commit or push until explicit commit flags are used",
    );
  } else {
    operations.push(
      `write publication files and create a local commit when the publication diff is non-empty: ${commitMessage}`,
      "prepare will not push; push the publication branch for GitHub Pages to update",
    );
  }
  return operations;
}

function shouldValidateGeneratedRdfPath(path: string): boolean {
  if (!path.endsWith(".ttl")) {
    return false;
  }
  return path.startsWith("_mesh/") || path.includes("/_knop/");
}

async function* walkPublicationFiles(root: string): AsyncGenerator<string> {
  let entries: Deno.DirEntry[];
  try {
    entries = [];
    for await (const entry of Deno.readDir(root)) {
      entries.push(entry);
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return;
    }
    throw error;
  }

  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    if (entry.name === ".git") {
      continue;
    }

    const path = join(root, entry.name);
    if (entry.isDirectory) {
      yield* walkPublicationFiles(path);
      continue;
    }
    if (entry.isFile) {
      yield path;
    }
  }
}

async function isGitWorktreeRoot(root: string): Promise<boolean> {
  const result = await runGitInspection(root, [
    "rev-parse",
    "--show-toplevel",
  ]);
  if (!result.success) {
    return false;
  }
  return resolve(result.stdout.trim()) === resolve(root);
}

async function runGitInspection(
  cwd: string,
  args: readonly string[],
): Promise<{ success: boolean; stdout: string; stderr: string }> {
  try {
    const output = await new Deno.Command("git", {
      cwd,
      args: [...args],
    }).output();
    return {
      success: output.success,
      stdout: new TextDecoder().decode(output.stdout),
      stderr: new TextDecoder().decode(output.stderr),
    };
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return {
        success: false,
        stdout: "",
        stderr: "git executable was not found",
      };
    }
    throw error;
  }
}

async function runGitMutation(
  cwd: string,
  args: readonly string[],
): Promise<string> {
  const result = await runGitInspection(cwd, args);
  if (!result.success) {
    const stderr = result.stderr.trim();
    throw new GHPagesDeployRuntimeError(
      `git ${args.join(" ")} failed${stderr.length > 0 ? `: ${stderr}` : ""}`,
    );
  }
  return result.stdout;
}

function assertDistinctWorktreeRoots(
  sourceRoot: string,
  publishRoot: string,
): void {
  if (sourceRoot === publishRoot) {
    throw new GHPagesDeployInputError(
      "source root and publication root must be different for branch-published preparation",
    );
  }
  if (isWithinRoot(publishRoot, sourceRoot)) {
    throw new GHPagesDeployInputError(
      "publication root must not be inside the source root for branch-published preparation",
    );
  }
  if (isWithinRoot(sourceRoot, publishRoot)) {
    throw new GHPagesDeployInputError(
      "source root must not be inside the publication root for branch-published preparation",
    );
  }
}

function isWithinRoot(candidatePath: string, rootPath: string): boolean {
  const relation = relative(rootPath, candidatePath).replaceAll("\\", "/");
  return relation.length > 0 && !relation.startsWith("../") &&
    relation !== "..";
}
