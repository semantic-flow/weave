import { dirname, join } from "@std/path";
import { Parser, type Quad } from "n3";
import { normalizeSafeDesignatorPath } from "../../core/designator_segments.ts";
import {
  ExtractInputError,
  type ExtractPlan,
  planExtract,
} from "../../core/extract/extract.ts";
import type { PlannedFile } from "../../core/planned_file.ts";
import { resolveMeshBaseFromMetadataTurtle } from "../mesh/metadata.ts";
import { resolveRuntimeLoggers } from "../logging/factory.ts";
import type { AuditLogger } from "../logging/audit_logger.ts";
import type { StructuredLogger } from "../logging/logger.ts";

export interface LocalExtractRequest {
  designatorPath: string;
}

export interface ExecuteExtractOptions {
  workspaceRoot: string;
  request: LocalExtractRequest;
  operationalLogger?: StructuredLogger;
  auditLogger?: AuditLogger;
}

export interface ExtractResult {
  meshBase: string;
  designatorPath: string;
  referenceCatalogIri: string;
  referenceLinkIri: string;
  referenceRoleIri: string;
  referenceTargetIri: string;
  referenceTargetDesignatorPath: string;
  referenceTargetStateIri: string;
  createdPaths: readonly string[];
  updatedPaths: readonly string[];
}

export class ExtractRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractRuntimeError";
  }
}

interface ExtractSourcePayload {
  designatorPath: string;
  workingFilePath: string;
  latestHistoricalStatePath: string;
  currentPayloadTurtle: string;
}

interface StagedFileMutation {
  absolutePath: string;
  tempPath: string;
  backupPath?: string;
}

interface StagedPlanMutation {
  createdFiles: StagedFileMutation[];
  updatedFiles: StagedFileMutation[];
  createdDirectories: string[];
}

interface PlannedMutation {
  createdFiles: readonly PlannedFile[];
  updatedFiles: readonly PlannedFile[];
}

export async function executeExtract(
  options: ExecuteExtractOptions,
): Promise<ExtractResult> {
  const { operationalLogger, auditLogger } = resolveLoggers(options);
  const workspaceRoot = options.workspaceRoot;
  const designatorPath = options.request.designatorPath;
  let plan: ExtractPlan | undefined;

  await operationalLogger.info("extract.started", "Starting local extract", {
    workspaceRoot,
    designatorPath,
  });
  await auditLogger.record("extract.started", "Local extract started", {
    workspaceRoot,
    designatorPath,
  });

  try {
    await ensureWorkspaceRootExists(workspaceRoot);
    const normalizedDesignatorPath = normalizeLocalDesignatorPath(
      designatorPath,
      "designatorPath",
    );
    const meshState = await loadMeshState(workspaceRoot);
    const sourcePayload = await resolveExtractSourcePayload(
      workspaceRoot,
      meshState.currentMeshInventoryTurtle,
      meshState.meshBase,
      normalizedDesignatorPath,
    );
    plan = planExtract({
      meshBase: meshState.meshBase,
      currentMeshInventoryTurtle: meshState.currentMeshInventoryTurtle,
      designatorPath: normalizedDesignatorPath,
      referenceTargetDesignatorPath: sourcePayload.designatorPath,
      referenceTargetStatePath: sourcePayload.latestHistoricalStatePath,
      referenceTargetWorkingFilePath: sourcePayload.workingFilePath,
    });
    await assertUpdatedTargetsExist(workspaceRoot, plan);
    await assertCreateTargetsDoNotExist(workspaceRoot, plan);
    validateRdfFiles([...plan.createdFiles, ...plan.updatedFiles]);
    await applyPlanAtomically(workspaceRoot, plan);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const originalError = (
        error instanceof ExtractInputError ||
        error instanceof ExtractRuntimeError
      )
      ? error
      : new ExtractRuntimeError(message);

    await logExtractFailedBestEffort(
      operationalLogger,
      auditLogger,
      workspaceRoot,
      designatorPath,
      plan,
      message,
    );

    throw originalError;
  }

  const result: ExtractResult = {
    meshBase: plan.meshBase,
    designatorPath: plan.designatorPath,
    referenceCatalogIri: plan.referenceCatalogIri,
    referenceLinkIri: plan.referenceLinkIri,
    referenceRoleIri: plan.referenceRoleIri,
    referenceTargetIri: plan.referenceTargetIri,
    referenceTargetDesignatorPath: plan.referenceTargetDesignatorPath,
    referenceTargetStateIri: plan.referenceTargetStateIri,
    createdPaths: plan.createdFiles.map((file) => file.path),
    updatedPaths: plan.updatedFiles.map((file) => file.path),
  };

  await logExtractSucceededBestEffort(
    operationalLogger,
    auditLogger,
    workspaceRoot,
    result,
  );

  return result;
}

export function describeExtractResult(result: ExtractResult): string {
  return `Extracted ${result.designatorPath} into ${result.referenceCatalogIri}, created ${result.createdPaths.length} knop support artifacts, and updated ${result.updatedPaths.length} mesh support artifact.`;
}

function resolveLoggers(
  options: ExecuteExtractOptions,
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
      throw new ExtractRuntimeError(
        `Workspace root does not exist: ${workspaceRoot}`,
      );
    }
    throw error;
  }

  if (!stat.isDirectory) {
    throw new ExtractRuntimeError(
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
      throw new ExtractRuntimeError(
        "Workspace does not contain an existing mesh support surface",
      );
    }
    throw error;
  }

  return {
    meshBase: resolveMeshBaseFromMetadataTurtle(meshMetadataTurtle),
    currentMeshInventoryTurtle,
  };
}

async function resolveExtractSourcePayload(
  workspaceRoot: string,
  currentMeshInventoryTurtle: string,
  meshBase: string,
  targetDesignatorPath: string,
): Promise<ExtractSourcePayload> {
  const candidates = await loadExtractSourcePayloadCandidates(
    workspaceRoot,
    currentMeshInventoryTurtle,
  );
  const matchingCandidates = candidates.filter((candidate) =>
    payloadMentionsTarget(
      candidate.currentPayloadTurtle,
      meshBase,
      targetDesignatorPath,
    )
  );

  if (matchingCandidates.length === 0) {
    throw new ExtractRuntimeError(
      `No woven payload artifact currently mentions ${targetDesignatorPath}`,
    );
  }
  if (matchingCandidates.length !== 1) {
    throw new ExtractRuntimeError(
      `Ambiguous extract source for ${targetDesignatorPath}; found ${matchingCandidates.length} woven payload artifacts`,
    );
  }

  return matchingCandidates[0]!;
}

async function loadExtractSourcePayloadCandidates(
  workspaceRoot: string,
  currentMeshInventoryTurtle: string,
): Promise<readonly ExtractSourcePayload[]> {
  const knobMatches = [
    ...currentMeshInventoryTurtle.matchAll(/<([^>]+\/_knop)> a sflo:Knop ;/g),
  ];
  const designatorPaths = knobMatches.map((match) =>
    match[1]!.slice(0, -"/_knop".length)
  );
  const candidates: ExtractSourcePayload[] = [];

  for (const designatorPath of designatorPaths) {
    const currentKnopInventoryPath = join(
      workspaceRoot,
      `${designatorPath}/_knop/_inventory/inventory.ttl`,
    );
    let currentKnopInventoryTurtle: string;

    try {
      currentKnopInventoryTurtle = await Deno.readTextFile(
        currentKnopInventoryPath,
      );
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        continue;
      }
      throw error;
    }

    const candidate = await loadExtractSourcePayloadCandidate(
      workspaceRoot,
      designatorPath,
      currentKnopInventoryTurtle,
    );
    if (candidate) {
      candidates.push(candidate);
    }
  }

  return candidates.sort((left, right) =>
    left.designatorPath.localeCompare(right.designatorPath)
  );
}

async function loadExtractSourcePayloadCandidate(
  workspaceRoot: string,
  designatorPath: string,
  currentKnopInventoryTurtle: string,
): Promise<ExtractSourcePayload | undefined> {
  if (
    !currentKnopInventoryTurtle.includes(
      `sflo:hasPayloadArtifact <${designatorPath}>`,
    )
  ) {
    return undefined;
  }

  const payloadBlock = currentKnopInventoryTurtle
    .split("\n\n")
    .find((block) =>
      block.startsWith(
        `<${designatorPath}> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;`,
      )
    );
  if (!payloadBlock) {
    throw new ExtractRuntimeError(
      `Could not resolve the current payload artifact block for ${designatorPath}.`,
    );
  }

  const workingFilePathMatch = payloadBlock.match(
    /sflo:hasWorkingLocatedFile <([^>]+)>/,
  );
  if (!workingFilePathMatch) {
    throw new ExtractRuntimeError(
      `Could not resolve the working payload file for ${designatorPath}.`,
    );
  }

  const currentArtifactHistoryMatch = payloadBlock.match(
    /sflo:currentArtifactHistory <([^>]+)>/,
  );
  if (!currentArtifactHistoryMatch) {
    return undefined;
  }

  const currentArtifactHistoryPath = currentArtifactHistoryMatch[1]!;
  const historyBlock = currentKnopInventoryTurtle
    .split("\n\n")
    .find((block) =>
      block.startsWith(
        `<${currentArtifactHistoryPath}> a sflo:ArtifactHistory ;`,
      )
    );
  if (!historyBlock) {
    throw new ExtractRuntimeError(
      `Could not resolve the current payload history block for ${designatorPath}.`,
    );
  }

  const latestHistoricalStateMatch = historyBlock.match(
    /sflo:latestHistoricalState <([^>]+)>/,
  );
  if (!latestHistoricalStateMatch) {
    throw new ExtractRuntimeError(
      `Could not resolve the latest payload historical state for ${designatorPath}.`,
    );
  }

  const currentPayloadTurtle = await readPayloadWorkingFile(
    workspaceRoot,
    designatorPath,
    workingFilePathMatch[1]!,
  );

  return {
    designatorPath,
    workingFilePath: workingFilePathMatch[1]!,
    latestHistoricalStatePath: latestHistoricalStateMatch[1]!,
    currentPayloadTurtle,
  };
}

async function readPayloadWorkingFile(
  workspaceRoot: string,
  designatorPath: string,
  workingFilePath: string,
): Promise<string> {
  const absoluteWorkingFilePath = join(workspaceRoot, workingFilePath);

  try {
    return await Deno.readTextFile(absoluteWorkingFilePath);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new ExtractRuntimeError(
        `Working payload file for ${designatorPath} does not exist: ${workingFilePath}`,
      );
    }
    throw error;
  }
}

function payloadMentionsTarget(
  currentPayloadTurtle: string,
  meshBase: string,
  targetDesignatorPath: string,
): boolean {
  const targetIri = new URL(targetDesignatorPath, meshBase).href;
  let quads: Quad[];

  try {
    quads = new Parser({ baseIRI: meshBase }).parse(currentPayloadTurtle);
  } catch {
    throw new ExtractRuntimeError(
      `Could not parse working payload RDF while resolving extraction source for ${targetDesignatorPath}`,
    );
  }

  return quads.some((quad) =>
    quad.subject.value === targetIri ||
    quad.predicate.value === targetIri ||
    (quad.object.termType === "NamedNode" && quad.object.value === targetIri)
  );
}

async function assertUpdatedTargetsExist(
  workspaceRoot: string,
  plan: ExtractPlan,
): Promise<void> {
  for (const file of plan.updatedFiles) {
    let stat: Deno.FileInfo;
    try {
      stat = await Deno.stat(join(workspaceRoot, file.path));
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        throw new ExtractRuntimeError(
          `extract update target does not exist: ${file.path}`,
        );
      }
      throw error;
    }

    if (!stat.isFile) {
      throw new ExtractRuntimeError(
        `extract update target is not a file: ${file.path}`,
      );
    }
  }
}

async function assertCreateTargetsDoNotExist(
  workspaceRoot: string,
  plan: ExtractPlan,
): Promise<void> {
  for (const file of plan.createdFiles) {
    try {
      await Deno.stat(join(workspaceRoot, file.path));
      throw new ExtractRuntimeError(
        `extract target already exists: ${file.path}`,
      );
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        continue;
      }
      throw error;
    }
  }
}

function validateRdfFiles(files: readonly PlannedFile[]): void {
  for (const file of files) {
    if (!file.path.endsWith(".ttl")) {
      continue;
    }

    try {
      new Parser().parse(file.contents);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ExtractRuntimeError(
        `Planned extract RDF failed to parse for ${file.path}: ${message}`,
      );
    }
  }
}

function normalizeLocalDesignatorPath(
  designatorPath: string,
  fieldName: string,
): string {
  return normalizeSafeDesignatorPath(
    designatorPath,
    fieldName,
    (message) => new ExtractRuntimeError(message),
  );
}

async function applyPlanAtomically(
  workspaceRoot: string,
  plan: ExtractPlan,
): Promise<void> {
  const stagedPlanMutation = await stagePlanMutation(workspaceRoot, plan);

  try {
    await commitStagedPlanMutation(stagedPlanMutation);
  } catch (error) {
    try {
      await rollbackStagedPlanMutation(stagedPlanMutation);
    } catch (rollbackError) {
      const message = error instanceof Error ? error.message : String(error);
      const rollbackMessage = rollbackError instanceof Error
        ? rollbackError.message
        : String(rollbackError);
      throw new ExtractRuntimeError(
        `Atomic extract commit failed: ${message}; rollback also failed: ${rollbackMessage}`,
      );
    }

    throw error;
  }

  await cleanupCommittedStagedPlanMutationBestEffort(stagedPlanMutation);
}

async function stagePlanMutation(
  workspaceRoot: string,
  plan: PlannedMutation,
): Promise<StagedPlanMutation> {
  const stagedPlanMutation: StagedPlanMutation = {
    createdFiles: [],
    updatedFiles: [],
    createdDirectories: [],
  };
  const trackedDirectories = new Set<string>();

  try {
    for (const file of plan.createdFiles) {
      const absolutePath = join(workspaceRoot, file.path);
      const directoryPath = dirname(absolutePath);
      await ensureDirectoryExists(
        directoryPath,
        stagedPlanMutation.createdDirectories,
        trackedDirectories,
      );
      stagedPlanMutation.createdFiles.push({
        absolutePath,
        tempPath: await writeStagedFile(directoryPath, file.contents),
      });
    }

    for (const file of plan.updatedFiles) {
      const absolutePath = join(workspaceRoot, file.path);
      const directoryPath = dirname(absolutePath);
      await ensureDirectoryExists(
        directoryPath,
        stagedPlanMutation.createdDirectories,
        trackedDirectories,
      );
      stagedPlanMutation.updatedFiles.push({
        absolutePath,
        tempPath: await writeStagedFile(directoryPath, file.contents),
        backupPath: join(
          directoryPath,
          `.weave-backup-${crypto.randomUUID()}.ttl`,
        ),
      });
    }
  } catch (error) {
    await rollbackStagedPlanMutation(stagedPlanMutation);
    throw error;
  }

  return stagedPlanMutation;
}

async function ensureDirectoryExists(
  directoryPath: string,
  createdDirectories: string[],
  trackedDirectories: Set<string>,
): Promise<void> {
  const missingDirectories: string[] = [];
  let currentPath = directoryPath;

  while (true) {
    try {
      const stat = await Deno.stat(currentPath);
      if (!stat.isDirectory) {
        throw new ExtractRuntimeError(
          `Workspace path is not a directory: ${currentPath}`,
        );
      }
      break;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        missingDirectories.push(currentPath);
        const parentPath = dirname(currentPath);
        if (parentPath === currentPath) {
          break;
        }
        currentPath = parentPath;
        continue;
      }
      throw error;
    }
  }

  if (missingDirectories.length === 0) {
    return;
  }

  await Deno.mkdir(directoryPath, { recursive: true });
  for (const createdDirectory of missingDirectories.reverse()) {
    if (trackedDirectories.has(createdDirectory)) {
      continue;
    }
    trackedDirectories.add(createdDirectory);
    createdDirectories.push(createdDirectory);
  }
}

async function writeStagedFile(
  directoryPath: string,
  contents: string,
): Promise<string> {
  const tempPath = join(
    directoryPath,
    `.weave-staged-${crypto.randomUUID()}.tmp`,
  );
  await Deno.writeTextFile(tempPath, contents, { createNew: true });
  return tempPath;
}

async function commitStagedPlanMutation(
  stagedPlanMutation: StagedPlanMutation,
): Promise<void> {
  for (const file of stagedPlanMutation.createdFiles) {
    await Deno.rename(file.tempPath, file.absolutePath);
  }

  for (const file of stagedPlanMutation.updatedFiles) {
    await Deno.copyFile(file.absolutePath, file.backupPath!);
    await Deno.rename(file.tempPath, file.absolutePath);
  }
}

async function rollbackStagedPlanMutation(
  stagedPlanMutation: StagedPlanMutation,
): Promise<void> {
  let firstRollbackError: unknown;

  for (const file of [...stagedPlanMutation.updatedFiles].reverse()) {
    try {
      await removePathIfExists(file.tempPath);
      if (!(await pathExists(file.backupPath!))) {
        continue;
      }
      await removePathIfExists(file.absolutePath);
      await Deno.rename(file.backupPath!, file.absolutePath);
    } catch (error) {
      firstRollbackError ??= error;
    }
  }

  for (const file of [...stagedPlanMutation.createdFiles].reverse()) {
    try {
      await removePathIfExists(file.tempPath);
      await removePathIfExists(file.absolutePath);
    } catch (error) {
      firstRollbackError ??= error;
    }
  }

  await removeEmptyDirectoriesBestEffort(stagedPlanMutation.createdDirectories);

  if (firstRollbackError) {
    throw firstRollbackError;
  }
}

async function cleanupCommittedStagedPlanMutationBestEffort(
  stagedPlanMutation: StagedPlanMutation,
): Promise<void> {
  for (const file of stagedPlanMutation.updatedFiles) {
    if (!file.backupPath) {
      continue;
    }
    try {
      await removePathIfExists(file.backupPath);
    } catch {
      // best-effort cleanup
    }
  }
}

async function removeEmptyDirectoriesBestEffort(
  directories: readonly string[],
): Promise<void> {
  for (const directoryPath of [...directories].reverse()) {
    try {
      await Deno.remove(directoryPath);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        continue;
      }
      console.warn(
        `Best-effort extract cleanup could not remove directory ${directoryPath}:`,
        error,
      );
    }
  }
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

async function removePathIfExists(path: string): Promise<void> {
  try {
    await Deno.remove(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return;
    }
    throw error;
  }
}

async function logExtractFailedBestEffort(
  operationalLogger: StructuredLogger,
  auditLogger: AuditLogger,
  workspaceRoot: string,
  designatorPath: string,
  plan: ExtractPlan | undefined,
  message: string,
): Promise<void> {
  try {
    await operationalLogger.error("extract.failed", "Local extract failed", {
      workspaceRoot,
      designatorPath,
      referenceTargetDesignatorPath: plan?.referenceTargetDesignatorPath,
      referenceTargetStateIri: plan?.referenceTargetStateIri,
      error: message,
    });
  } catch {
    // best-effort logging
  }

  try {
    await auditLogger.record("extract.failed", "Local extract failed", {
      workspaceRoot,
      designatorPath,
      referenceTargetDesignatorPath: plan?.referenceTargetDesignatorPath,
      referenceTargetStateIri: plan?.referenceTargetStateIri,
      error: message,
    });
  } catch {
    // best-effort logging
  }
}

async function logExtractSucceededBestEffort(
  operationalLogger: StructuredLogger,
  auditLogger: AuditLogger,
  workspaceRoot: string,
  result: ExtractResult,
): Promise<void> {
  try {
    await operationalLogger.info(
      "extract.succeeded",
      "Local extract succeeded",
      {
        workspaceRoot,
        designatorPath: result.designatorPath,
        referenceTargetDesignatorPath: result.referenceTargetDesignatorPath,
        referenceTargetStateIri: result.referenceTargetStateIri,
        createdPaths: result.createdPaths,
        updatedPaths: result.updatedPaths,
      },
    );
  } catch {
    // best-effort logging
  }

  try {
    await auditLogger.record("extract.succeeded", "Local extract succeeded", {
      workspaceRoot,
      designatorPath: result.designatorPath,
      referenceTargetDesignatorPath: result.referenceTargetDesignatorPath,
      referenceTargetStateIri: result.referenceTargetStateIri,
      createdPaths: result.createdPaths,
      updatedPaths: result.updatedPaths,
    });
  } catch {
    // best-effort logging
  }
}
