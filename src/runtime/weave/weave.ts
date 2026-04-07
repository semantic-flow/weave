import { dirname, join } from "@std/path";
import { Parser } from "n3";
import type { PlannedFile } from "../../core/planned_file.ts";
import {
  detectPendingWeaveSlice,
  type PayloadWorkingArtifact,
  planWeave,
  type ReferenceCatalogWorkingArtifact,
  type WeaveableKnopCandidate,
  WeaveInputError,
  type WeavePlan,
  type WeaveRequest,
  type WeaveSlice,
} from "../../core/weave/weave.ts";
import {
  listKnopDesignatorPaths,
  resolvePayloadArtifactInventoryState,
  resolveReferenceCatalogInventoryState,
  resolveReferenceTargetDesignatorPath,
} from "../mesh/inventory.ts";
import {
  MeshMetadataResolutionError,
  resolveMeshBaseFromMetadataTurtle,
} from "../mesh/metadata.ts";
import { resolveRuntimeLoggers } from "../logging/factory.ts";
import type { AuditLogger } from "../logging/audit_logger.ts";
import type { StructuredLogger } from "../logging/logger.ts";
import { renderResourcePages } from "./pages.ts";

export interface ExecuteWeaveOptions {
  workspaceRoot: string;
  request?: WeaveRequest;
  operationalLogger?: StructuredLogger;
  auditLogger?: AuditLogger;
}

export interface WeaveResult {
  meshBase: string;
  wovenDesignatorPaths: readonly string[];
  createdPaths: readonly string[];
  updatedPaths: readonly string[];
}

export class WeaveRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WeaveRuntimeError";
  }
}

export async function executeWeave(
  options: ExecuteWeaveOptions,
): Promise<WeaveResult> {
  const { operationalLogger, auditLogger } = resolveLoggers(options);
  const workspaceRoot = options.workspaceRoot;
  let plan: WeavePlan | undefined;
  let createdOutputFiles: readonly PlannedFile[] = [];

  await operationalLogger.info("weave.started", "Starting local weave", {
    workspaceRoot,
    designatorPaths: options.request?.designatorPaths ?? [],
  });
  await auditLogger.record("weave.started", "Local weave started", {
    workspaceRoot,
    designatorPaths: options.request?.designatorPaths ?? [],
  });

  try {
    await ensureWorkspaceRootExists(workspaceRoot);
    const meshState = await loadMeshState(workspaceRoot);
    const weaveableKnops = await loadWeaveableKnopCandidates(
      workspaceRoot,
      meshState.meshBase,
      meshState.currentMeshInventoryTurtle,
      options.request?.designatorPaths ?? [],
    );
    plan = planWeave({
      request: options.request ?? {},
      meshBase: meshState.meshBase,
      currentMeshInventoryTurtle: meshState.currentMeshInventoryTurtle,
      weaveableKnops,
    });
    createdOutputFiles = [
      ...plan.createdFiles,
      ...renderResourcePages(plan.meshBase, plan.createdPages),
    ];
    assertUpdatedTargetsExist(workspaceRoot, plan.updatedFiles);
    await assertCreateTargetsDoNotExist(workspaceRoot, createdOutputFiles);
    validateRdfFiles([...plan.createdFiles, ...plan.updatedFiles]);
    await writeFiles(workspaceRoot, createdOutputFiles, true);
    await writeFiles(workspaceRoot, plan.updatedFiles, false);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await operationalLogger.error("weave.failed", "Local weave failed", {
      workspaceRoot,
      wovenDesignatorPaths: plan?.wovenDesignatorPaths,
      error: message,
    });
    await auditLogger.record("weave.failed", "Local weave failed", {
      workspaceRoot,
      wovenDesignatorPaths: plan?.wovenDesignatorPaths,
      error: message,
    });

    if (
      error instanceof WeaveInputError || error instanceof WeaveRuntimeError
    ) {
      throw error;
    }
    throw new WeaveRuntimeError(message);
  }

  const result: WeaveResult = {
    meshBase: plan.meshBase,
    wovenDesignatorPaths: plan.wovenDesignatorPaths,
    createdPaths: createdOutputFiles.map((file) => file.path),
    updatedPaths: plan.updatedFiles.map((file) => file.path),
  };

  await operationalLogger.info("weave.succeeded", "Local weave succeeded", {
    workspaceRoot,
    wovenDesignatorPaths: result.wovenDesignatorPaths,
    createdPaths: result.createdPaths,
    updatedPaths: result.updatedPaths,
  });
  await auditLogger.record("weave.succeeded", "Local weave succeeded", {
    workspaceRoot,
    wovenDesignatorPaths: result.wovenDesignatorPaths,
    createdPaths: result.createdPaths,
    updatedPaths: result.updatedPaths,
  });

  return result;
}

export function describeWeaveResult(result: WeaveResult): string {
  return `Wove ${result.wovenDesignatorPaths.length} designator path and created ${result.createdPaths.length} files while updating ${result.updatedPaths.length} working artifacts.`;
}

function resolveLoggers(
  options: ExecuteWeaveOptions,
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
      throw new WeaveRuntimeError(
        `Workspace root does not exist: ${workspaceRoot}`,
      );
    }
    throw error;
  }

  if (!stat.isDirectory) {
    throw new WeaveRuntimeError(
      `Workspace root is not a directory: ${workspaceRoot}`,
    );
  }
}

async function loadMeshState(
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
      throw new WeaveRuntimeError(
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
      throw new WeaveRuntimeError(error.message);
    }
    if (error instanceof Error) {
      throw new WeaveRuntimeError(
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

async function loadWeaveableKnopCandidates(
  workspaceRoot: string,
  meshBase: string,
  currentMeshInventoryTurtle: string,
  requestedDesignatorPaths: readonly string[],
): Promise<readonly WeaveableKnopCandidate[]> {
  const designatorPaths = listKnopDesignatorPaths(
    meshBase,
    currentMeshInventoryTurtle,
    "Could not parse the current MeshInventory while resolving weaveable Knop candidates.",
  );
  const requested = normalizeRequestedDesignatorPaths(requestedDesignatorPaths);

  const candidates: WeaveableKnopCandidate[] = [];
  for (const designatorPath of designatorPaths) {
    if (requested && !requested.has(designatorPath)) {
      continue;
    }

    const knopPath = `${designatorPath}/_knop`;
    const metadataPath = join(workspaceRoot, `${knopPath}/_meta/meta.ttl`);
    const inventoryPath = join(
      workspaceRoot,
      `${knopPath}/_inventory/inventory.ttl`,
    );
    let currentKnopMetadataTurtle: string;
    let currentKnopInventoryTurtle: string;

    try {
      [currentKnopMetadataTurtle, currentKnopInventoryTurtle] = await Promise
        .all([
          Deno.readTextFile(metadataPath),
          Deno.readTextFile(inventoryPath),
        ]);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        continue;
      }
      throw error;
    }

    const candidate: WeaveableKnopCandidate = {
      designatorPath,
      currentKnopMetadataTurtle,
      currentKnopInventoryTurtle,
    };
    const slice = detectPendingWeaveSlice(
      meshBase,
      designatorPath,
      currentKnopInventoryTurtle,
    );

    if (!slice) {
      continue;
    }

    if (
      slice === "firstPayloadWeave" || slice === "secondPayloadWeave" ||
      slice === "firstExtractedKnopWeave"
    ) {
      candidate.payloadArtifact = await loadPayloadWorkingArtifact(
        workspaceRoot,
        meshBase,
        designatorPath,
        currentKnopInventoryTurtle,
      );
    }

    if (
      slice === "firstReferenceCatalogWeave" ||
      slice === "firstExtractedKnopWeave"
    ) {
      candidate.referenceCatalogArtifact =
        await loadReferenceCatalogWorkingArtifact(
          workspaceRoot,
          meshBase,
          designatorPath,
          currentKnopInventoryTurtle,
        );
    }

    if (slice === "firstExtractedKnopWeave") {
      candidate.referenceTargetSourcePayloadArtifact =
        await loadReferenceTargetSourcePayloadArtifact(
          workspaceRoot,
          meshBase,
          designatorPath,
          candidate.referenceCatalogArtifact,
        );
    }

    if (!isWeaveableKnopCandidate(candidate, slice)) {
      continue;
    }

    candidates.push(candidate);
  }

  return candidates.sort((left, right) =>
    left.designatorPath.localeCompare(right.designatorPath)
  );
}

async function loadPayloadWorkingArtifact(
  workspaceRoot: string,
  meshBase: string,
  designatorPath: string,
  currentKnopInventoryTurtle: string,
): Promise<PayloadWorkingArtifact | undefined> {
  const payloadArtifact = resolvePayloadArtifactInventoryState(
    meshBase,
    currentKnopInventoryTurtle,
    designatorPath,
    {
      parseErrorMessage:
        `Could not parse the current Knop inventory while resolving the payload artifact for ${designatorPath}.`,
      missingWorkingFileMessage:
        `Could not resolve the working payload file for ${designatorPath}.`,
    },
  );
  if (!payloadArtifact) {
    return undefined;
  }
  const workingFilePath = payloadArtifact.workingFilePath;
  const latestHistoricalStatePath = payloadArtifact.currentArtifactHistoryExists
    ? payloadArtifact.latestHistoricalStatePath
    : undefined;
  const latestHistoricalSnapshotPath = latestHistoricalStatePath
    ? join(
      workspaceRoot,
      toPayloadHistoricalSnapshotPath(
        designatorPath,
        workingFilePath,
        latestHistoricalStatePath.slice(
          latestHistoricalStatePath.lastIndexOf("/") + 1,
        ),
      ),
    )
    : undefined;

  let currentPayloadTurtle: string;
  let latestHistoricalSnapshotTurtle: string | undefined;
  try {
    currentPayloadTurtle = await Deno.readTextFile(
      join(workspaceRoot, workingFilePath),
    );
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new WeaveRuntimeError(
        `Workspace is missing the working payload file for ${designatorPath}: ${workingFilePath}`,
      );
    }
    throw error;
  }

  if (latestHistoricalSnapshotPath) {
    try {
      latestHistoricalSnapshotTurtle = await Deno.readTextFile(
        latestHistoricalSnapshotPath,
      );
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        throw new WeaveRuntimeError(
          `Workspace is missing the latest payload historical snapshot for ${designatorPath}: ${
            toPayloadHistoricalSnapshotPath(
              designatorPath,
              workingFilePath,
              "_s0001",
            )
          }`,
        );
      }
      throw error;
    }
  }

  return {
    workingFilePath,
    currentPayloadTurtle,
    latestHistoricalSnapshotTurtle,
    latestHistoricalStatePath,
  };
}

async function loadReferenceTargetSourcePayloadArtifact(
  workspaceRoot: string,
  meshBase: string,
  designatorPath: string,
  referenceCatalogArtifact: ReferenceCatalogWorkingArtifact | undefined,
): Promise<WeaveableKnopCandidate["referenceTargetSourcePayloadArtifact"]> {
  if (!referenceCatalogArtifact) {
    return undefined;
  }

  const sourceDesignatorPath = resolveReferenceTargetDesignatorPath(
    meshBase,
    referenceCatalogArtifact.currentReferenceCatalogTurtle,
    designatorPath,
    {
      parseErrorMessage:
        `Could not parse the current ReferenceCatalog while resolving the extracted weave source for ${designatorPath}.`,
      missingReferenceLinkMessage:
        `Could not resolve the current extracted ReferenceCatalog link for ${designatorPath}.`,
      missingReferenceTargetMessage:
        `Could not resolve the current extracted ReferenceCatalog target for ${designatorPath}.`,
    },
  );
  const sourceKnopInventoryPath = join(
    workspaceRoot,
    `${sourceDesignatorPath}/_knop/_inventory/inventory.ttl`,
  );
  let sourceKnopInventoryTurtle: string;

  try {
    sourceKnopInventoryTurtle = await Deno.readTextFile(
      sourceKnopInventoryPath,
    );
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new WeaveRuntimeError(
        `Workspace is missing the woven source payload inventory for ${designatorPath}: ${sourceDesignatorPath}/_knop/_inventory/inventory.ttl`,
      );
    }
    throw error;
  }

  const sourcePayloadArtifact = await loadPayloadWorkingArtifact(
    workspaceRoot,
    meshBase,
    sourceDesignatorPath,
    sourceKnopInventoryTurtle,
  );
  if (!sourcePayloadArtifact?.latestHistoricalStatePath) {
    throw new WeaveRuntimeError(
      `Extracted weave source for ${designatorPath} is missing a woven current payload history: ${sourceDesignatorPath}`,
    );
  }

  return {
    designatorPath: sourceDesignatorPath,
    workingFilePath: sourcePayloadArtifact.workingFilePath,
    currentPayloadTurtle: sourcePayloadArtifact.currentPayloadTurtle,
    latestHistoricalStatePath: sourcePayloadArtifact.latestHistoricalStatePath,
  };
}

async function loadReferenceCatalogWorkingArtifact(
  workspaceRoot: string,
  meshBase: string,
  designatorPath: string,
  currentKnopInventoryTurtle: string,
): Promise<ReferenceCatalogWorkingArtifact | undefined> {
  const referenceCatalog = resolveReferenceCatalogInventoryState(
    meshBase,
    currentKnopInventoryTurtle,
    designatorPath,
    {
      parseErrorMessage:
        `Could not parse the current Knop inventory while resolving the ReferenceCatalog for ${designatorPath}.`,
      missingWorkingFileMessage:
        `Could not resolve the working ReferenceCatalog file for ${designatorPath}.`,
    },
  );
  if (!referenceCatalog) {
    return undefined;
  }
  const workingFilePath = referenceCatalog.workingFilePath;
  try {
    return {
      workingFilePath,
      currentReferenceCatalogTurtle: await Deno.readTextFile(
        join(workspaceRoot, workingFilePath),
      ),
    };
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new WeaveRuntimeError(
        `Workspace is missing the working ReferenceCatalog file for ${designatorPath}: ${workingFilePath}`,
      );
    }
    throw error;
  }
}

function isWeaveableKnopCandidate(
  candidate: WeaveableKnopCandidate,
  slice: WeaveSlice,
): boolean {
  if (slice === "firstExtractedKnopWeave") {
    return candidate.referenceCatalogArtifact !== undefined &&
      candidate.referenceTargetSourcePayloadArtifact !== undefined;
  }

  if (slice === "firstReferenceCatalogWeave") {
    return candidate.referenceCatalogArtifact !== undefined;
  }

  if (slice === "firstPayloadWeave") {
    return candidate.payloadArtifact !== undefined;
  }

  if (slice === "secondPayloadWeave") {
    return candidate.payloadArtifact !== undefined &&
      candidate.payloadArtifact.latestHistoricalSnapshotTurtle !== undefined &&
      candidate.payloadArtifact.currentPayloadTurtle !==
        candidate.payloadArtifact.latestHistoricalSnapshotTurtle;
  }

  return slice === "firstKnopWeave";
}

function normalizeRequestedDesignatorPaths(
  requestedDesignatorPaths: readonly string[],
): ReadonlySet<string> | undefined {
  const normalized = requestedDesignatorPaths
    .map((path) => path.trim())
    .filter((path) => path.length > 0);

  return normalized.length === 0 ? undefined : new Set(normalized);
}

function assertUpdatedTargetsExist(
  workspaceRoot: string,
  files: readonly PlannedFile[],
): void {
  for (const file of files) {
    const absolutePath = join(workspaceRoot, file.path);
    try {
      Deno.statSync(absolutePath);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        throw new WeaveRuntimeError(
          `weave target does not exist: ${file.path}`,
        );
      }
      throw error;
    }
  }
}

async function assertCreateTargetsDoNotExist(
  workspaceRoot: string,
  files: readonly PlannedFile[],
): Promise<void> {
  for (const file of files) {
    try {
      await Deno.stat(join(workspaceRoot, file.path));
      throw new WeaveRuntimeError(`weave target already exists: ${file.path}`);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        continue;
      }
      throw error;
    }
  }
}

function validateRdfFiles(files: readonly PlannedFile[]): void {
  const parser = new Parser();

  for (const file of files) {
    if (!file.path.endsWith(".ttl")) {
      continue;
    }
    try {
      parser.parse(file.contents);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new WeaveRuntimeError(
        `Generated RDF did not parse for ${file.path}: ${message}`,
      );
    }
  }
}

function toPayloadHistoricalSnapshotPath(
  designatorPath: string,
  workingFilePath: string,
  stateSegment: string,
): string {
  const fileName = toFileName(workingFilePath);
  const manifestationSegment = fileName.replaceAll(".", "-");
  return `${designatorPath}/_history001/${stateSegment}/${manifestationSegment}/${fileName}`;
}

function toFileName(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1]!;
}

async function writeFiles(
  workspaceRoot: string,
  files: readonly PlannedFile[],
  createNew: boolean,
): Promise<void> {
  for (const file of files) {
    const absolutePath = join(workspaceRoot, file.path);
    await Deno.mkdir(dirname(absolutePath), { recursive: true });
    await Deno.writeTextFile(
      absolutePath,
      file.contents,
      createNew ? { createNew: true } : undefined,
    );
  }
}
