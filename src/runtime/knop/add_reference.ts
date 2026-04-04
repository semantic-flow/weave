import { dirname, join } from "@std/path";
import {
  KnopAddReferenceInputError,
  type KnopAddReferencePlan,
  planKnopAddReference,
} from "../../core/knop/add_reference.ts";
import { resolveRuntimeLoggers } from "../logging/factory.ts";
import type { AuditLogger } from "../logging/audit_logger.ts";
import type { StructuredLogger } from "../logging/logger.ts";

const reservedDesignatorSegments = new Set(["_knop", "_mesh"]);

export interface LocalKnopAddReferenceRequest {
  designatorPath: string;
  referenceTargetDesignatorPath: string;
  referenceRole: string;
}

export interface ExecuteKnopAddReferenceOptions {
  workspaceRoot: string;
  request: LocalKnopAddReferenceRequest;
  operationalLogger?: StructuredLogger;
  auditLogger?: AuditLogger;
}

export interface KnopAddReferenceResult {
  meshBase: string;
  designatorPath: string;
  referenceTargetDesignatorPath: string;
  referenceCatalogIri: string;
  referenceLinkIri: string;
  referenceRoleIri: string;
  referenceTargetIri: string;
  createdPaths: readonly string[];
  updatedPaths: readonly string[];
}

export class KnopAddReferenceRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnopAddReferenceRuntimeError";
  }
}

export async function executeKnopAddReference(
  options: ExecuteKnopAddReferenceOptions,
): Promise<KnopAddReferenceResult> {
  const { operationalLogger, auditLogger } = resolveLoggers(options);
  const workspaceRoot = options.workspaceRoot;
  const designatorPath = options.request.designatorPath;
  const referenceTargetDesignatorPath =
    options.request.referenceTargetDesignatorPath;
  const referenceRole = options.request.referenceRole;
  let plan: KnopAddReferencePlan | undefined;

  await operationalLogger.info(
    "knop.addReference.started",
    "Starting local knop add-reference",
    {
      workspaceRoot,
      designatorPath,
      referenceTargetDesignatorPath,
      referenceRole,
    },
  );
  await auditLogger.record(
    "knop.addReference.started",
    "Local knop add-reference started",
    {
      workspaceRoot,
      designatorPath,
      referenceTargetDesignatorPath,
      referenceRole,
    },
  );

  try {
    await ensureWorkspaceRootExists(workspaceRoot);
    const normalizedDesignatorPath = normalizeLocalDesignatorPath(
      designatorPath,
      "designatorPath",
    );
    const normalizedReferenceTargetDesignatorPath =
      normalizeLocalDesignatorPath(
        referenceTargetDesignatorPath,
        "referenceTargetDesignatorPath",
      );
    const meshBase = await loadMeshBase(workspaceRoot);
    const currentKnopInventoryTurtle = await loadCurrentKnopInventory(
      workspaceRoot,
      normalizedDesignatorPath,
    );

    plan = planKnopAddReference({
      meshBase,
      currentKnopInventoryTurtle,
      designatorPath,
      referenceTargetDesignatorPath,
      referenceRole,
    });

    await assertReferenceTargetExists(
      workspaceRoot,
      normalizedReferenceTargetDesignatorPath,
    );
    await assertCreateTargetsDoNotExist(workspaceRoot, plan);
    await writeCreatedFiles(workspaceRoot, plan);
    await writeUpdatedFiles(workspaceRoot, plan);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await operationalLogger.error(
      "knop.addReference.failed",
      "Local knop add-reference failed",
      {
        workspaceRoot,
        designatorPath,
        referenceTargetDesignatorPath,
        referenceRole,
        referenceCatalogIri: plan?.referenceCatalogIri,
        referenceLinkIri: plan?.referenceLinkIri,
        error: message,
      },
    );
    await auditLogger.record(
      "knop.addReference.failed",
      "Local knop add-reference failed",
      {
        workspaceRoot,
        designatorPath,
        referenceTargetDesignatorPath,
        referenceRole,
        referenceCatalogIri: plan?.referenceCatalogIri,
        referenceLinkIri: plan?.referenceLinkIri,
        error: message,
      },
    );

    if (
      error instanceof KnopAddReferenceInputError ||
      error instanceof KnopAddReferenceRuntimeError
    ) {
      throw error;
    }
    throw new KnopAddReferenceRuntimeError(message);
  }

  const result: KnopAddReferenceResult = {
    meshBase: plan.meshBase,
    designatorPath: plan.designatorPath,
    referenceTargetDesignatorPath: plan.referenceTargetDesignatorPath,
    referenceCatalogIri: plan.referenceCatalogIri,
    referenceLinkIri: plan.referenceLinkIri,
    referenceRoleIri: plan.referenceRoleIri,
    referenceTargetIri: plan.referenceTargetIri,
    createdPaths: plan.createdFiles.map((file) => file.path),
    updatedPaths: plan.updatedFiles.map((file) => file.path),
  };

  await operationalLogger.info(
    "knop.addReference.succeeded",
    "Local knop add-reference succeeded",
    {
      workspaceRoot,
      designatorPath: result.designatorPath,
      referenceTargetDesignatorPath: result.referenceTargetDesignatorPath,
      referenceCatalogIri: result.referenceCatalogIri,
      referenceLinkIri: result.referenceLinkIri,
      referenceRoleIri: result.referenceRoleIri,
      referenceTargetIri: result.referenceTargetIri,
      createdPaths: result.createdPaths,
      updatedPaths: result.updatedPaths,
    },
  );
  await auditLogger.record(
    "knop.addReference.succeeded",
    "Local knop add-reference succeeded",
    {
      workspaceRoot,
      designatorPath: result.designatorPath,
      referenceTargetDesignatorPath: result.referenceTargetDesignatorPath,
      referenceCatalogIri: result.referenceCatalogIri,
      referenceLinkIri: result.referenceLinkIri,
      referenceRoleIri: result.referenceRoleIri,
      referenceTargetIri: result.referenceTargetIri,
      createdPaths: result.createdPaths,
      updatedPaths: result.updatedPaths,
    },
  );

  return result;
}

export function describeKnopAddReferenceResult(
  result: KnopAddReferenceResult,
): string {
  return `Added reference link ${result.referenceLinkIri} targeting ${result.referenceTargetIri}, created ${result.createdPaths.length} reference-catalog artifact, and updated ${result.updatedPaths.length} knop support artifact.`;
}

function resolveLoggers(
  options: ExecuteKnopAddReferenceOptions,
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
      throw new KnopAddReferenceRuntimeError(
        `Workspace root does not exist: ${workspaceRoot}`,
      );
    }
    throw error;
  }

  if (!stat.isDirectory) {
    throw new KnopAddReferenceRuntimeError(
      `Workspace root is not a directory: ${workspaceRoot}`,
    );
  }
}

async function loadMeshBase(workspaceRoot: string): Promise<string> {
  const meshMetadataPath = join(workspaceRoot, "_mesh/_meta/meta.ttl");
  let meshMetadataTurtle: string;

  try {
    meshMetadataTurtle = await Deno.readTextFile(meshMetadataPath);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new KnopAddReferenceRuntimeError(
        "Workspace does not contain an existing mesh support surface",
      );
    }
    throw error;
  }

  const meshBaseMatch = meshMetadataTurtle.match(
    /sflo:meshBase "([^"]+)"\^\^xsd:anyURI/,
  );
  if (!meshBaseMatch) {
    throw new KnopAddReferenceRuntimeError(
      "Could not resolve meshBase from _mesh/_meta/meta.ttl",
    );
  }

  return meshBaseMatch[1]!;
}

async function loadCurrentKnopInventory(
  workspaceRoot: string,
  designatorPath: string,
): Promise<string> {
  const knobInventoryPath = join(
    workspaceRoot,
    `${designatorPath}/_knop/_inventory/inventory.ttl`,
  );

  try {
    return await Deno.readTextFile(knobInventoryPath);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new KnopAddReferenceRuntimeError(
        `Workspace does not contain an existing knop support surface for ${designatorPath}`,
      );
    }
    throw error;
  }
}

async function assertReferenceTargetExists(
  workspaceRoot: string,
  referenceTargetDesignatorPath: string,
): Promise<void> {
  const targetKnopInventoryPath = join(
    workspaceRoot,
    `${referenceTargetDesignatorPath}/_knop/_inventory/inventory.ttl`,
  );

  let stat: Deno.FileInfo;
  try {
    stat = await Deno.stat(targetKnopInventoryPath);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new KnopAddReferenceRuntimeError(
        `Referenced target does not exist in the workspace: ${referenceTargetDesignatorPath}`,
      );
    }
    throw error;
  }

  if (!stat.isFile) {
    throw new KnopAddReferenceRuntimeError(
      `Referenced target inventory is not a file: ${referenceTargetDesignatorPath}`,
    );
  }
}

async function assertCreateTargetsDoNotExist(
  workspaceRoot: string,
  plan: KnopAddReferencePlan,
): Promise<void> {
  for (const file of plan.createdFiles) {
    try {
      await Deno.stat(join(workspaceRoot, file.path));
      throw new KnopAddReferenceRuntimeError(
        `knop add-reference target already exists: ${file.path}`,
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
  plan: KnopAddReferencePlan,
): Promise<void> {
  for (const file of plan.createdFiles) {
    const absolutePath = join(workspaceRoot, file.path);
    await Deno.mkdir(dirname(absolutePath), { recursive: true });
    await Deno.writeTextFile(absolutePath, file.contents, { createNew: true });
  }
}

async function writeUpdatedFiles(
  workspaceRoot: string,
  plan: KnopAddReferencePlan,
): Promise<void> {
  for (const file of plan.updatedFiles) {
    const absolutePath = join(workspaceRoot, file.path);
    await Deno.mkdir(dirname(absolutePath), { recursive: true });
    await Deno.writeTextFile(absolutePath, file.contents);
  }
}

function normalizeLocalDesignatorPath(
  designatorPath: string,
  fieldName: string,
): string {
  const trimmed = designatorPath.trim();
  if (trimmed.length === 0) {
    throw new KnopAddReferenceRuntimeError(`${fieldName} is required`);
  }
  if (trimmed.startsWith("/") || trimmed.endsWith("/")) {
    throw new KnopAddReferenceRuntimeError(
      `${fieldName} must not start or end with '/'`,
    );
  }
  if (
    trimmed.includes("\\") || trimmed.includes("?") || trimmed.includes("#")
  ) {
    throw new KnopAddReferenceRuntimeError(
      `${fieldName} contains unsupported path characters`,
    );
  }

  const segments = trimmed.split("/");
  if (segments.some((segment) => segment.length === 0)) {
    throw new KnopAddReferenceRuntimeError(
      `${fieldName} must not contain empty path segments`,
    );
  }
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new KnopAddReferenceRuntimeError(
      `${fieldName} must not contain '.' or '..' path segments`,
    );
  }
  if (segments.some((segment) => reservedDesignatorSegments.has(segment))) {
    throw new KnopAddReferenceRuntimeError(
      `${fieldName} must not contain reserved path segments`,
    );
  }

  return trimmed;
}
