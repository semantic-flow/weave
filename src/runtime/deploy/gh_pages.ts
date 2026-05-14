import { relative, resolve } from "@std/path";
import type { AuditLogger } from "../logging/audit_logger.ts";
import type { StructuredLogger } from "../logging/logger.ts";
import { resolveRuntimeLoggers } from "../logging/factory.ts";
import { describeMeshCreateResult, executeMeshCreate } from "../mesh/create.ts";

export interface GHPagesDeployBootstrapRequest {
  meshBase: string;
  includeNoJekyll?: boolean;
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

    const meshCreateResult = await executeMeshCreate({
      workspaceRoot: publishRoot,
      request: {
        meshBase: options.request.meshBase,
        includeMeshConfig: true,
        includeNoJekyll: options.request.includeNoJekyll,
      },
      existingFilePolicy: "reuseMatching",
      operationalLogger,
      auditLogger,
    });

    const result: GHPagesDeployBootstrapResult = {
      sourceRoot,
      publishRoot,
      meshBase: meshCreateResult.meshBase,
      meshIri: meshCreateResult.meshIri,
      createdPaths: meshCreateResult.createdPaths,
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
  if (result.createdPaths.length === 0) {
    return `Branch-published GitHub Pages mesh already bootstrapped for ${result.meshIri}.`;
  }

  return `${
    describeMeshCreateResult(result)
  } Branch-published GitHub Pages mesh bootstrapped in publication root.`;
}

function resolveRequiredRootPath(value: string, name: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new GHPagesDeployInputError(`${name} must not be empty`);
  }
  return resolve(trimmed);
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
