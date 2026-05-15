import { dirname, join, relative } from "@std/path";
import { Parser, type Quad } from "n3";
import {
  formatDesignatorPathForDisplay,
  normalizeSafeDesignatorPath,
  toKnopPath,
} from "../../core/designator_segments.ts";
import {
  ExtractInputError,
  type ExtractionSourceEvidence,
  type ExtractPlan,
  planExtract,
} from "../../core/extract/extract.ts";
import type { PlannedFile } from "../../core/planned_file.ts";
import {
  listKnopDesignatorPaths,
  resolvePayloadArtifactInventoryState,
} from "../mesh/inventory.ts";
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
import { SFLO_NAMESPACE } from "../../core/rdf/namespaces.ts";

const SFLO_HAS_LOCATED_FILE_IRI = `${SFLO_NAMESPACE}hasLocatedFile`;
const SFLO_HAS_MANIFESTATION_IRI = `${SFLO_NAMESPACE}hasManifestation`;
const SFLO_LOCATED_FILE_FOR_STATE_IRI = `${SFLO_NAMESPACE}locatedFileForState`;
const SFLO_HAS_EXTRACTION_SOURCE_IRI = `${SFLO_NAMESPACE}hasExtractionSource`;
const SFLO_ARTIFACT_RESOLUTION_MODE_CURRENT_IRI =
  `${SFLO_NAMESPACE}artifactResolutionMode_current`;
const SFLO_ARTIFACT_RESOLUTION_MODE_PINNED_IRI =
  `${SFLO_NAMESPACE}artifactResolutionMode_pinned`;

export interface LocalExtractRequest {
  designatorPath: string;
  sourceDesignatorPath?: string;
  sourceStatePath?: string;
}

export interface LocalExtractAllTermsRequest {
  sourceDesignatorPath?: string;
  sourceStatePath?: string;
}

export interface LocalSetExtractionSourceRequest {
  designatorPath: string;
  sourceDesignatorPath?: string;
  sourceStatePath?: string;
}

export interface LocalSetExtractionSourceAllTermsRequest {
  sourceDesignatorPath?: string;
  sourceStatePath?: string;
}

export interface ExecuteExtractOptions {
  meshRoot?: string;
  workspaceRoot?: string;
  request: LocalExtractRequest;
  operationalLogger?: StructuredLogger;
  auditLogger?: AuditLogger;
}

export interface ExtractResult {
  meshBase: string;
  designatorPath: string;
  extractionSourceIri: string;
  sourceArtifactIri: string;
  sourceDesignatorPath: string;
  sourceStateIri?: string;
  sourceResolutionMode: "current" | "pinned";
  createdPaths: readonly string[];
  updatedPaths: readonly string[];
}

export interface ExtractAllTermsResult {
  meshBase: string;
  sourceDesignatorPath: string;
  sourceArtifactIri: string;
  sourceStateIri?: string;
  sourceResolutionMode: "current" | "pinned";
  discoveredDesignatorPaths: readonly string[];
  extractedDesignatorPaths: readonly string[];
  skippedExistingDesignatorPaths: readonly string[];
  skippedSupportDesignatorPaths: readonly string[];
  createdPaths: readonly string[];
  updatedPaths: readonly string[];
}

export interface SetExtractionSourceResult {
  meshBase: string;
  designatorPath: string;
  sourceDesignatorPath: string;
  sourceStateIri?: string;
  sourceResolutionMode: "current" | "pinned";
  updatedPaths: readonly string[];
}

export interface SetExtractionSourceAllTermsResult {
  meshBase: string;
  sourceDesignatorPath: string;
  sourceStateIri?: string;
  sourceResolutionMode: "current" | "pinned";
  discoveredDesignatorPaths: readonly string[];
  updatedDesignatorPaths: readonly string[];
  skippedDesignatorPaths: readonly string[];
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
  workingLocalRelativePath: string;
  sourceResolutionMode: "current" | "pinned";
  sourceStatePath?: string;
  sourceEvidence?: ExtractionSourceEvidence;
  sourcePayloadTurtle: string;
  currentKnopInventoryTurtle: string;
  latestHistoricalStatePath?: string;
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
  const meshRoot = options.meshRoot ?? options.workspaceRoot;
  if (!meshRoot) {
    throw new ExtractRuntimeError("meshRoot is required");
  }
  const localPathPolicy = await loadOperationalLocalPathPolicy(meshRoot);
  const workspaceRoot = localPathPolicy.workspaceRoot;
  const designatorPath = options.request.designatorPath;
  const sourceDesignatorPath = options.request.sourceDesignatorPath;
  const sourceStatePath = options.request.sourceStatePath;
  let plan: ExtractPlan | undefined;

  await operationalLogger.info("extract.started", "Starting local extract", {
    meshRoot,
    workspaceRoot,
    designatorPath,
    sourceDesignatorPath,
    sourceStatePath,
  });
  await auditLogger.record("extract.started", "Local extract started", {
    meshRoot,
    workspaceRoot,
    designatorPath,
    sourceDesignatorPath,
    sourceStatePath,
  });

  try {
    await ensureMeshRootExists(meshRoot);
    const normalizedDesignatorPath = normalizeLocalDesignatorPath(
      designatorPath,
      "designatorPath",
    );
    const normalizedSourceDesignatorPath = sourceDesignatorPath === undefined
      ? undefined
      : normalizeLocalDesignatorPath(
        sourceDesignatorPath,
        "sourceDesignatorPath",
      );
    const meshState = await loadMeshState(meshRoot);
    const sourcePayload = await resolveExtractSourcePayload(
      meshRoot,
      localPathPolicy,
      meshState.currentMeshInventoryTurtle,
      meshState.meshBase,
      normalizedDesignatorPath,
      normalizedSourceDesignatorPath,
      sourceStatePath,
    );
    plan = planExtract({
      meshBase: meshState.meshBase,
      currentMeshInventoryTurtle: meshState.currentMeshInventoryTurtle,
      designatorPath: normalizedDesignatorPath,
      sourceDesignatorPath: sourcePayload.designatorPath,
      sourceResolutionMode: sourcePayload.sourceResolutionMode,
      ...(sourcePayload.sourceEvidence
        ? { sourceEvidence: sourcePayload.sourceEvidence }
        : {}),
      ...(sourcePayload.sourceStatePath
        ? { sourceStatePath: sourcePayload.sourceStatePath }
        : {}),
      sourceWorkingLocalRelativePath: sourcePayload.workingLocalRelativePath,
    });
    await assertUpdatedTargetsExist(meshRoot, plan);
    await assertCreateTargetsDoNotExist(meshRoot, plan);
    validateRdfFiles([...plan.createdFiles, ...plan.updatedFiles]);
    await applyPlanAtomically(meshRoot, plan);
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
      meshRoot,
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
    extractionSourceIri: plan.extractionSourceIri,
    sourceArtifactIri: plan.sourceArtifactIri,
    sourceDesignatorPath: plan.sourceDesignatorPath,
    sourceStateIri: plan.sourceStateIri,
    sourceResolutionMode: plan.sourceResolutionMode,
    createdPaths: plan.createdFiles.map((file) =>
      toWorkspaceRelativePath(localPathPolicy, file.path)
    ),
    updatedPaths: plan.updatedFiles.map((file) =>
      toWorkspaceRelativePath(localPathPolicy, file.path)
    ),
  };

  await logExtractSucceededBestEffort(
    operationalLogger,
    auditLogger,
    meshRoot,
    workspaceRoot,
    result,
  );

  return result;
}

export async function executeExtractAllTerms(
  options: Omit<ExecuteExtractOptions, "request"> & {
    request: LocalExtractAllTermsRequest;
  },
): Promise<ExtractAllTermsResult> {
  const { operationalLogger, auditLogger } = resolveLoggers(options);
  const meshRoot = options.meshRoot ?? options.workspaceRoot;
  if (!meshRoot) {
    throw new ExtractRuntimeError("meshRoot is required");
  }
  const localPathPolicy = await loadOperationalLocalPathPolicy(meshRoot);
  const workspaceRoot = localPathPolicy.workspaceRoot;
  const sourceDesignatorPath = options.request.sourceDesignatorPath;
  const sourceStatePath = options.request.sourceStatePath;
  let plannedMutation: PlannedMutation | undefined;

  await operationalLogger.info(
    "extract.allTerms.started",
    "Starting local all-terms extract",
    {
      meshRoot,
      workspaceRoot,
      sourceSelector: sourceDesignatorPath ?? sourceStatePath,
      sourceStatePath,
    },
  );
  await auditLogger.record(
    "extract.allTerms.started",
    "Local all-terms extract started",
    {
      meshRoot,
      workspaceRoot,
      sourceDesignatorPath,
      sourceStatePath,
    },
  );

  try {
    await ensureMeshRootExists(meshRoot);
    const meshState = await loadMeshState(meshRoot);
    const sourcePayload = await resolveSelectedExtractSourcePayload(
      meshRoot,
      localPathPolicy,
      meshState.currentMeshInventoryTurtle,
      meshState.meshBase,
      sourceDesignatorPath,
      sourceStatePath,
    );
    const discovery = discoverAllTermDesignatorPaths({
      meshBase: meshState.meshBase,
      sourceDesignatorPath: sourcePayload.designatorPath,
      currentMeshInventoryTurtle: meshState.currentMeshInventoryTurtle,
      currentPayloadTurtle: sourcePayload.sourcePayloadTurtle,
    });
    const plans: ExtractPlan[] = [];
    let currentMeshInventoryTurtle = meshState.currentMeshInventoryTurtle;

    for (const designatorPath of discovery.extractedDesignatorPaths) {
      const plan = planExtract({
        meshBase: meshState.meshBase,
        currentMeshInventoryTurtle,
        designatorPath,
        sourceDesignatorPath: sourcePayload.designatorPath,
        sourceResolutionMode: sourcePayload.sourceResolutionMode,
        ...(sourcePayload.sourceEvidence
          ? { sourceEvidence: sourcePayload.sourceEvidence }
          : {}),
        ...(sourcePayload.sourceStatePath
          ? { sourceStatePath: sourcePayload.sourceStatePath }
          : {}),
        sourceWorkingLocalRelativePath: sourcePayload.workingLocalRelativePath,
      });
      plans.push(plan);
      currentMeshInventoryTurtle = plan.updatedFiles.find((file) =>
        file.path === "_mesh/_inventory/inventory.ttl"
      )?.contents ?? currentMeshInventoryTurtle;
    }

    plannedMutation = combineExtractPlans(plans);
    await assertUpdatedTargetsExist(meshRoot, plannedMutation);
    await assertCreateTargetsDoNotExist(meshRoot, plannedMutation);
    validateRdfFiles([
      ...plannedMutation.createdFiles,
      ...plannedMutation.updatedFiles,
    ]);
    await applyPlanAtomically(meshRoot, plannedMutation);

    const result: ExtractAllTermsResult = {
      meshBase: meshState.meshBase,
      sourceDesignatorPath: sourcePayload.designatorPath,
      sourceArtifactIri:
        new URL(sourcePayload.designatorPath, meshState.meshBase)
          .href,
      sourceStateIri: sourcePayload.sourceStatePath
        ? new URL(sourcePayload.sourceStatePath, meshState.meshBase).href
        : undefined,
      sourceResolutionMode: sourcePayload.sourceResolutionMode,
      discoveredDesignatorPaths: discovery.discoveredDesignatorPaths,
      extractedDesignatorPaths: discovery.extractedDesignatorPaths,
      skippedExistingDesignatorPaths: discovery.skippedExistingDesignatorPaths,
      skippedSupportDesignatorPaths: discovery.skippedSupportDesignatorPaths,
      createdPaths: plannedMutation.createdFiles.map((file) =>
        toWorkspaceRelativePath(localPathPolicy, file.path)
      ),
      updatedPaths: plannedMutation.updatedFiles.map((file) =>
        toWorkspaceRelativePath(localPathPolicy, file.path)
      ),
    };

    await logExtractAllTermsSucceededBestEffort(
      operationalLogger,
      auditLogger,
      meshRoot,
      workspaceRoot,
      result,
    );

    return result;
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
      meshRoot,
      workspaceRoot,
      sourceDesignatorPath ?? sourceStatePath ?? "unknown source",
      plannedMutation,
      message,
    );

    throw originalError;
  }
}

export async function previewExtractAllTerms(
  options: Omit<ExecuteExtractOptions, "request"> & {
    request: LocalExtractAllTermsRequest;
  },
): Promise<ExtractAllTermsResult> {
  const meshRoot = options.meshRoot ?? options.workspaceRoot;
  if (!meshRoot) {
    throw new ExtractRuntimeError("meshRoot is required");
  }
  const localPathPolicy = await loadOperationalLocalPathPolicy(meshRoot);
  await ensureMeshRootExists(meshRoot);
  const meshState = await loadMeshState(meshRoot);
  const sourcePayload = await resolveSelectedExtractSourcePayload(
    meshRoot,
    localPathPolicy,
    meshState.currentMeshInventoryTurtle,
    meshState.meshBase,
    options.request.sourceDesignatorPath,
    options.request.sourceStatePath,
  );
  const discovery = discoverAllTermDesignatorPaths({
    meshBase: meshState.meshBase,
    sourceDesignatorPath: sourcePayload.designatorPath,
    currentMeshInventoryTurtle: meshState.currentMeshInventoryTurtle,
    currentPayloadTurtle: sourcePayload.sourcePayloadTurtle,
  });

  return {
    meshBase: meshState.meshBase,
    sourceDesignatorPath: sourcePayload.designatorPath,
    sourceArtifactIri: new URL(sourcePayload.designatorPath, meshState.meshBase)
      .href,
    sourceStateIri: sourcePayload.sourceStatePath
      ? new URL(sourcePayload.sourceStatePath, meshState.meshBase).href
      : undefined,
    sourceResolutionMode: sourcePayload.sourceResolutionMode,
    discoveredDesignatorPaths: discovery.discoveredDesignatorPaths,
    extractedDesignatorPaths: discovery.extractedDesignatorPaths,
    skippedExistingDesignatorPaths: discovery.skippedExistingDesignatorPaths,
    skippedSupportDesignatorPaths: discovery.skippedSupportDesignatorPaths,
    createdPaths: [],
    updatedPaths: [],
  };
}

export async function executeSetExtractionSource(
  options: Omit<ExecuteExtractOptions, "request"> & {
    request: LocalSetExtractionSourceRequest;
  },
): Promise<SetExtractionSourceResult> {
  const meshRoot = options.meshRoot ?? options.workspaceRoot;
  if (!meshRoot) {
    throw new ExtractRuntimeError("meshRoot is required");
  }
  const localPathPolicy = await loadOperationalLocalPathPolicy(meshRoot);
  await ensureMeshRootExists(meshRoot);
  const designatorPath = normalizeLocalDesignatorPath(
    options.request.designatorPath,
    "designatorPath",
  );
  const meshState = await loadMeshState(meshRoot);
  const sourcePayload = await resolveExtractSourcePayload(
    meshRoot,
    localPathPolicy,
    meshState.currentMeshInventoryTurtle,
    meshState.meshBase,
    designatorPath,
    options.request.sourceDesignatorPath,
    options.request.sourceStatePath,
  );
  const inventoryPath = `${
    toKnopPath(designatorPath)
  }/_inventory/inventory.ttl`;
  const currentInventoryTurtle = await readExistingKnopInventory(
    meshRoot,
    inventoryPath,
    designatorPath,
  );
  const updatedInventoryTurtle = replaceExtractionSourceBinding(
    meshState.meshBase,
    currentInventoryTurtle,
    designatorPath,
    sourcePayload,
  );
  const mutation: PlannedMutation = {
    createdFiles: [],
    updatedFiles: [{
      path: inventoryPath,
      contents: updatedInventoryTurtle,
    }],
  };

  validateRdfFiles(mutation.updatedFiles);
  await applyPlanAtomically(meshRoot, mutation);

  return {
    meshBase: meshState.meshBase,
    designatorPath,
    sourceDesignatorPath: sourcePayload.designatorPath,
    sourceStateIri: sourcePayload.sourceStatePath
      ? new URL(sourcePayload.sourceStatePath, meshState.meshBase).href
      : undefined,
    sourceResolutionMode: sourcePayload.sourceResolutionMode,
    updatedPaths: mutation.updatedFiles.map((file) =>
      toWorkspaceRelativePath(localPathPolicy, file.path)
    ),
  };
}

export async function previewSetExtractionSourceAllTerms(
  options: Omit<ExecuteExtractOptions, "request"> & {
    request: LocalSetExtractionSourceAllTermsRequest;
  },
): Promise<SetExtractionSourceAllTermsResult> {
  return await planSetExtractionSourceAllTerms(options, false);
}

export async function executeSetExtractionSourceAllTerms(
  options: Omit<ExecuteExtractOptions, "request"> & {
    request: LocalSetExtractionSourceAllTermsRequest;
  },
): Promise<SetExtractionSourceAllTermsResult> {
  return await planSetExtractionSourceAllTerms(options, true);
}

async function planSetExtractionSourceAllTerms(
  options: Omit<ExecuteExtractOptions, "request"> & {
    request: LocalSetExtractionSourceAllTermsRequest;
  },
  write: boolean,
): Promise<SetExtractionSourceAllTermsResult> {
  const meshRoot = options.meshRoot ?? options.workspaceRoot;
  if (!meshRoot) {
    throw new ExtractRuntimeError("meshRoot is required");
  }
  const localPathPolicy = await loadOperationalLocalPathPolicy(meshRoot);
  await ensureMeshRootExists(meshRoot);
  const meshState = await loadMeshState(meshRoot);
  const sourcePayload = await resolveSelectedExtractSourcePayload(
    meshRoot,
    localPathPolicy,
    meshState.currentMeshInventoryTurtle,
    meshState.meshBase,
    options.request.sourceDesignatorPath,
    options.request.sourceStatePath,
  );
  const discovery = discoverAllTermDesignatorPaths({
    meshBase: meshState.meshBase,
    sourceDesignatorPath: sourcePayload.designatorPath,
    currentMeshInventoryTurtle: meshState.currentMeshInventoryTurtle,
    currentPayloadTurtle: sourcePayload.sourcePayloadTurtle,
  });
  const updatedFiles: PlannedFile[] = [];
  const updatedDesignatorPaths: string[] = [];
  const skippedDesignatorPaths: string[] = [];

  for (const designatorPath of discovery.skippedExistingDesignatorPaths) {
    const inventoryPath = `${
      toKnopPath(designatorPath)
    }/_inventory/inventory.ttl`;
    const currentInventoryTurtle = await readExistingKnopInventory(
      meshRoot,
      inventoryPath,
      designatorPath,
    );
    if (
      !hasExtractionSourceBinding(
        meshState.meshBase,
        currentInventoryTurtle,
        designatorPath,
      )
    ) {
      skippedDesignatorPaths.push(designatorPath);
      continue;
    }
    updatedFiles.push({
      path: inventoryPath,
      contents: replaceExtractionSourceBinding(
        meshState.meshBase,
        currentInventoryTurtle,
        designatorPath,
        sourcePayload,
      ),
    });
    updatedDesignatorPaths.push(designatorPath);
  }

  const mutation: PlannedMutation = { createdFiles: [], updatedFiles };
  validateRdfFiles(mutation.updatedFiles);
  if (write) {
    await applyPlanAtomically(meshRoot, mutation);
  }

  return {
    meshBase: meshState.meshBase,
    sourceDesignatorPath: sourcePayload.designatorPath,
    sourceStateIri: sourcePayload.sourceStatePath
      ? new URL(sourcePayload.sourceStatePath, meshState.meshBase).href
      : undefined,
    sourceResolutionMode: sourcePayload.sourceResolutionMode,
    discoveredDesignatorPaths: discovery.skippedExistingDesignatorPaths,
    updatedDesignatorPaths,
    skippedDesignatorPaths,
    updatedPaths: mutation.updatedFiles.map((file) =>
      toWorkspaceRelativePath(localPathPolicy, file.path)
    ),
  };
}

export function describeExtractResult(result: ExtractResult): string {
  return `Extracted ${
    formatDesignatorPathForDisplay(result.designatorPath)
  } with source ${result.extractionSourceIri}, created ${result.createdPaths.length} knop support artifacts, and updated ${result.updatedPaths.length} mesh support artifact.`;
}

export function describeSetExtractionSourceResult(
  result: SetExtractionSourceResult,
): string {
  return `Updated extraction source for ${
    formatDesignatorPathForDisplay(result.designatorPath)
  } to ${result.sourceResolutionMode} source ${
    formatDesignatorPathForDisplay(result.sourceDesignatorPath)
  }.`;
}

export function describeSetExtractionSourceAllTermsResult(
  result: SetExtractionSourceAllTermsResult,
): string {
  return `Updated ${result.updatedDesignatorPaths.length} extracted terms from ${
    formatDesignatorPathForDisplay(result.sourceDesignatorPath)
  }, skipped ${result.skippedDesignatorPaths.length} non-extracted existing terms.`;
}

export function describeExtractAllTermsResult(
  result: ExtractAllTermsResult,
): string {
  return `Extracted ${result.extractedDesignatorPaths.length} new terms from ${
    formatDesignatorPathForDisplay(result.sourceDesignatorPath)
  }, skipped ${result.skippedExistingDesignatorPaths.length} existing terms and ${result.skippedSupportDesignatorPaths.length} support artifacts.`;
}

function resolveLoggers(
  options: {
    operationalLogger?: StructuredLogger;
    auditLogger?: AuditLogger;
  },
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
      throw new ExtractRuntimeError(
        `Mesh root does not exist: ${meshRoot}`,
      );
    }
    throw error;
  }

  if (!stat.isDirectory) {
    throw new ExtractRuntimeError(
      `Mesh root is not a directory: ${meshRoot}`,
    );
  }
}

async function loadMeshState(
  meshRoot: string,
): Promise<{ meshBase: string; currentMeshInventoryTurtle: string }> {
  const meshMetadataPath = join(meshRoot, "_mesh/_meta/meta.ttl");
  const meshInventoryPath = join(
    meshRoot,
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

  let meshBase: string;
  try {
    meshBase = resolveMeshBaseFromMetadataTurtle(meshMetadataTurtle);
  } catch (error) {
    if (error instanceof MeshMetadataResolutionError) {
      throw new ExtractRuntimeError(error.message);
    }
    if (error instanceof Error) {
      throw new ExtractRuntimeError(
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

async function resolveExtractSourcePayload(
  meshRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  currentMeshInventoryTurtle: string,
  meshBase: string,
  targetDesignatorPath: string,
  sourceDesignatorPath?: string,
  sourceStatePath?: string,
): Promise<ExtractSourcePayload> {
  if (sourceDesignatorPath !== undefined && sourceStatePath !== undefined) {
    throw new ExtractRuntimeError(
      "extract requires either --source or --source-state, not both",
    );
  }
  const candidates = await loadExtractSourcePayloadCandidates(
    meshRoot,
    localPathPolicy,
    meshBase,
    currentMeshInventoryTurtle,
  );

  if (sourceStatePath !== undefined) {
    const selectedCandidate = await resolvePinnedExtractSourcePayloadByState(
      meshRoot,
      meshBase,
      candidates,
      sourceStatePath,
    );
    if (
      !payloadMentionsTarget(
        selectedCandidate.sourcePayloadTurtle,
        meshBase,
        targetDesignatorPath,
      )
    ) {
      throw new ExtractRuntimeError(
        `Selected extract source state ${sourceStatePath} does not mention ${targetDesignatorPath}`,
      );
    }
    return selectedCandidate;
  }

  if (sourceDesignatorPath !== undefined) {
    const selectedCandidate = candidates.find((candidate) =>
      candidate.designatorPath === sourceDesignatorPath
    );
    if (!selectedCandidate) {
      throw new ExtractRuntimeError(
        `Selected extract source is not an eligible woven payload artifact: ${sourceDesignatorPath}`,
      );
    }
    if (
      !payloadMentionsTarget(
        selectedCandidate.sourcePayloadTurtle,
        meshBase,
        targetDesignatorPath,
      )
    ) {
      throw new ExtractRuntimeError(
        `Selected extract source ${sourceDesignatorPath} does not mention ${targetDesignatorPath}`,
      );
    }
    return selectedCandidate;
  }

  const matchingCandidates = candidates.filter((candidate) =>
    payloadMentionsTarget(
      candidate.sourcePayloadTurtle,
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

async function resolveSelectedExtractSourcePayload(
  meshRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  currentMeshInventoryTurtle: string,
  meshBase: string,
  sourceDesignatorPath?: string,
  sourceStatePath?: string,
): Promise<ExtractSourcePayload> {
  if (sourceDesignatorPath !== undefined && sourceStatePath !== undefined) {
    throw new ExtractRuntimeError(
      "extract --all-terms requires either --source or --source-state, not both",
    );
  }
  if (sourceDesignatorPath === undefined && sourceStatePath === undefined) {
    throw new ExtractRuntimeError(
      "extract --all-terms requires --source or --source-state",
    );
  }
  const candidates = await loadExtractSourcePayloadCandidates(
    meshRoot,
    localPathPolicy,
    meshBase,
    currentMeshInventoryTurtle,
  );
  if (sourceStatePath !== undefined) {
    return await resolvePinnedExtractSourcePayloadByState(
      meshRoot,
      meshBase,
      candidates,
      sourceStatePath,
    );
  }
  const normalizedSourceDesignatorPath = normalizeLocalDesignatorPath(
    sourceDesignatorPath!,
    "sourceDesignatorPath",
  );
  const selectedCandidate = candidates.find((candidate) =>
    candidate.designatorPath === normalizedSourceDesignatorPath
  );
  if (!selectedCandidate) {
    throw new ExtractRuntimeError(
      `Selected extract source is not an eligible woven payload artifact: ${normalizedSourceDesignatorPath}`,
    );
  }
  return selectedCandidate;
}

async function loadExtractSourcePayloadCandidates(
  meshRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  meshBase: string,
  currentMeshInventoryTurtle: string,
): Promise<readonly ExtractSourcePayload[]> {
  const designatorPaths = listKnopDesignatorPaths(
    meshBase,
    currentMeshInventoryTurtle,
    "Could not parse the current MeshInventory while resolving extract source payload candidates.",
  );
  const candidates: ExtractSourcePayload[] = [];

  for (const designatorPath of designatorPaths) {
    const currentKnopInventoryPath = join(
      meshRoot,
      `${toKnopPath(designatorPath)}/_inventory/inventory.ttl`,
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
      localPathPolicy,
      meshBase,
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
  localPathPolicy: OperationalLocalPathPolicy,
  meshBase: string,
  designatorPath: string,
  currentKnopInventoryTurtle: string,
): Promise<ExtractSourcePayload | undefined> {
  const payloadArtifact = resolvePayloadArtifactInventoryState(
    meshBase,
    currentKnopInventoryTurtle,
    designatorPath,
    {
      parseErrorMessage:
        `Could not parse the current Knop inventory while resolving the extract source payload for ${designatorPath}.`,
      missingWorkingFileMessage:
        `Could not resolve the working payload file for ${designatorPath}.`,
    },
  );
  if (!payloadArtifact) {
    return undefined;
  }
  const currentPayloadTurtle = await readPayloadWorkingFile(
    localPathPolicy,
    designatorPath,
    payloadArtifact.workingLocalRelativePath,
  );

  return {
    designatorPath,
    workingLocalRelativePath: payloadArtifact.workingLocalRelativePath,
    sourceResolutionMode: "current",
    sourceStatePath: undefined,
    sourceEvidence: {
      sourceLocatedFilePath: payloadArtifact.workingLocalRelativePath,
      sourceDigest: await sha256Digest(currentPayloadTurtle),
    },
    sourcePayloadTurtle: currentPayloadTurtle,
    currentKnopInventoryTurtle,
    latestHistoricalStatePath: payloadArtifact.currentArtifactHistoryExists
      ? payloadArtifact.latestHistoricalStatePath
      : undefined,
  };
}

async function resolvePinnedExtractSourcePayloadByState(
  meshRoot: string,
  meshBase: string,
  candidates: readonly ExtractSourcePayload[],
  sourceStatePath: string,
): Promise<ExtractSourcePayload> {
  const normalizedSourceStatePath = normalizeLocalDesignatorPath(
    sourceStatePath,
    "sourceStatePath",
  );
  const matches = candidates
    .map((candidate) => {
      const historicalSnapshotPath = resolveHistoricalStateLocatedFilePath(
        meshBase,
        candidate.currentKnopInventoryTurtle,
        normalizedSourceStatePath,
        `Could not resolve the selected extract source state ${normalizedSourceStatePath}.`,
      );
      return historicalSnapshotPath === undefined
        ? undefined
        : { candidate, historicalSnapshotPath };
    })
    .filter((match): match is {
      candidate: ExtractSourcePayload;
      historicalSnapshotPath: string;
    } => match !== undefined);

  if (matches.length === 0) {
    throw new ExtractRuntimeError(
      `Selected extract source state is not an eligible woven payload state: ${normalizedSourceStatePath}`,
    );
  }
  if (matches.length !== 1) {
    throw new ExtractRuntimeError(
      `Ambiguous extract source state ${normalizedSourceStatePath}; found ${matches.length} source artifacts`,
    );
  }

  const { candidate, historicalSnapshotPath } = matches[0]!;
  let sourcePayloadTurtle: string;
  try {
    sourcePayloadTurtle = await Deno.readTextFile(
      join(meshRoot, historicalSnapshotPath),
    );
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new ExtractRuntimeError(
        `Workspace is missing the selected extract source state snapshot: ${historicalSnapshotPath}`,
      );
    }
    throw error;
  }

  return {
    ...candidate,
    sourceResolutionMode: "pinned",
    sourceStatePath: normalizedSourceStatePath,
    sourceEvidence: {
      sourceStatePath: normalizedSourceStatePath,
      sourceManifestationPath: dirname(historicalSnapshotPath).replaceAll(
        "\\",
        "/",
      ),
      sourceLocatedFilePath: historicalSnapshotPath,
      sourceDigest: await sha256Digest(sourcePayloadTurtle),
    },
    sourcePayloadTurtle,
  };
}

function resolveHistoricalStateLocatedFilePath(
  meshBase: string,
  inventoryTurtle: string,
  statePath: string,
  errorMessage: string,
): string | undefined {
  let quads: Quad[];
  try {
    quads = new Parser({ baseIRI: meshBase }).parse(inventoryTurtle);
  } catch {
    throw new ExtractRuntimeError(errorMessage);
  }

  const stateIri = new URL(statePath, meshBase).href;
  const shortcutLocatedFilePath = resolveUniqueNamedNodeMeshPath(
    meshBase,
    quads,
    stateIri,
    SFLO_LOCATED_FILE_FOR_STATE_IRI,
    errorMessage,
  );
  const manifestationPath = resolveUniqueNamedNodeMeshPath(
    meshBase,
    quads,
    stateIri,
    SFLO_HAS_MANIFESTATION_IRI,
    errorMessage,
  );
  const manifestationLocatedFilePath = manifestationPath
    ? resolveUniqueNamedNodeMeshPath(
      meshBase,
      quads,
      new URL(manifestationPath, meshBase).href,
      SFLO_HAS_LOCATED_FILE_IRI,
      errorMessage,
    )
    : undefined;

  if (
    shortcutLocatedFilePath !== undefined &&
    manifestationLocatedFilePath !== undefined &&
    shortcutLocatedFilePath !== manifestationLocatedFilePath
  ) {
    throw new ExtractRuntimeError(errorMessage);
  }

  return shortcutLocatedFilePath ?? manifestationLocatedFilePath;
}

function resolveUniqueNamedNodeMeshPath(
  meshBase: string,
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
  errorMessage: string,
): string | undefined {
  const values = new Set<string>();
  for (const quad of quads) {
    if (
      quad.subject.termType !== "NamedNode" ||
      quad.subject.value !== subjectIri ||
      quad.predicate.value !== predicateIri ||
      quad.object.termType !== "NamedNode"
    ) {
      continue;
    }
    const path = toMeshScopedRawDesignatorPath(meshBase, quad.object.value);
    if (path === undefined) {
      throw new ExtractRuntimeError(errorMessage);
    }
    values.add(path);
  }
  if (values.size === 0) {
    return undefined;
  }
  if (values.size !== 1) {
    throw new ExtractRuntimeError(errorMessage);
  }
  return values.values().next().value!;
}

async function readPayloadWorkingFile(
  localPathPolicy: OperationalLocalPathPolicy,
  designatorPath: string,
  workingLocalRelativePath: string,
): Promise<string> {
  let absoluteWorkingLocalRelativePath: string;
  try {
    absoluteWorkingLocalRelativePath = resolveAllowedLocalPath(
      localPathPolicy,
      "workingLocalRelativePath",
      workingLocalRelativePath,
    );
  } catch (error) {
    if (error instanceof LocalPathAccessError) {
      throw new ExtractRuntimeError(error.message);
    }
    throw error;
  }

  try {
    return await Deno.readTextFile(absoluteWorkingLocalRelativePath);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new ExtractRuntimeError(
        `Working payload file for ${designatorPath} does not exist: ${workingLocalRelativePath}`,
      );
    }
    throw error;
  }
}

async function sha256Digest(contents: string): Promise<string> {
  const bytes = new TextEncoder().encode(contents);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
}

function toWorkspaceRelativePath(
  policy: OperationalLocalPathPolicy,
  meshRelativePath: string,
): string {
  const absolutePath = join(policy.meshRoot, meshRelativePath);
  const relation = relative(policy.workspaceRoot, absolutePath).replaceAll(
    "\\",
    "/",
  );
  return relation.length === 0 ? "." : relation;
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

function discoverAllTermDesignatorPaths(
  options: {
    meshBase: string;
    sourceDesignatorPath: string;
    currentMeshInventoryTurtle: string;
    currentPayloadTurtle: string;
  },
): {
  discoveredDesignatorPaths: readonly string[];
  extractedDesignatorPaths: readonly string[];
  skippedExistingDesignatorPaths: readonly string[];
  skippedSupportDesignatorPaths: readonly string[];
} {
  const existingDesignatorPaths = new Set(
    listKnopDesignatorPaths(
      options.meshBase,
      options.currentMeshInventoryTurtle,
      "Could not parse the current MeshInventory while resolving existing extracted terms.",
    ),
  );
  const discovered = new Set<string>();
  const skippedExisting = new Set<string>();
  const skippedSupport = new Set<string>();
  let quads: Quad[];

  try {
    quads = new Parser({
      baseIRI: new URL(options.sourceDesignatorPath, options.meshBase).href,
    }).parse(options.currentPayloadTurtle);
  } catch {
    throw new ExtractRuntimeError(
      `Could not parse working payload RDF while discovering terms from ${options.sourceDesignatorPath}`,
    );
  }

  for (const quad of quads) {
    for (const iri of listQuadNamedNodeIris(quad)) {
      const rawDesignatorPath = toMeshScopedRawDesignatorPath(
        options.meshBase,
        iri,
      );
      if (rawDesignatorPath === undefined) {
        continue;
      }
      if (isSupportOrGeneratedArtifactPath(rawDesignatorPath)) {
        skippedSupport.add(rawDesignatorPath);
        continue;
      }
      const designatorPath = normalizeDiscoveredDesignatorPath(
        rawDesignatorPath,
        iri,
      );
      if (existingDesignatorPaths.has(designatorPath)) {
        skippedExisting.add(designatorPath);
        continue;
      }
      discovered.add(designatorPath);
    }
  }

  return {
    discoveredDesignatorPaths: [...discovered].sort((left, right) =>
      left.localeCompare(right)
    ),
    extractedDesignatorPaths: [...discovered].sort((left, right) =>
      left.localeCompare(right)
    ),
    skippedExistingDesignatorPaths: [...skippedExisting].sort((left, right) =>
      left.localeCompare(right)
    ),
    skippedSupportDesignatorPaths: [...skippedSupport].sort((left, right) =>
      left.localeCompare(right)
    ),
  };
}

function listQuadNamedNodeIris(quad: Quad): readonly string[] {
  const iris = [quad.subject.value, quad.predicate.value];
  if (quad.object.termType === "NamedNode") {
    iris.push(quad.object.value);
  }
  return iris;
}

function toMeshScopedRawDesignatorPath(
  meshBase: string,
  iri: string,
): string | undefined {
  if (!iri.startsWith(meshBase)) {
    return undefined;
  }

  return iri.slice(meshBase.length);
}

function normalizeDiscoveredDesignatorPath(
  rawDesignatorPath: string,
  iri: string,
): string {
  try {
    return normalizeLocalDesignatorPath(
      rawDesignatorPath,
      `discovered term IRI ${iri}`,
    );
  } catch (error) {
    if (error instanceof ExtractRuntimeError) {
      throw new ExtractRuntimeError(
        `Discovered mesh-scoped term IRI cannot be converted to a safe designator path: ${iri}`,
      );
    }
    throw error;
  }
}

function isSupportOrGeneratedArtifactPath(designatorPath: string): boolean {
  if (designatorPath.length === 0) {
    return false;
  }
  const segments = designatorPath.split("/");
  return segments.some((segment) => segment.startsWith("_")) ||
    designatorPath.endsWith("/index.html") ||
    designatorPath === "index.html" ||
    designatorPath.endsWith(".ttl");
}

function combineExtractPlans(plans: readonly ExtractPlan[]): PlannedMutation {
  if (plans.length === 0) {
    return {
      createdFiles: [],
      updatedFiles: [],
    };
  }

  const latestMeshInventory = plans.at(-1)!.updatedFiles.find((file) =>
    file.path === "_mesh/_inventory/inventory.ttl"
  );
  if (!latestMeshInventory) {
    throw new ExtractRuntimeError(
      "All-terms extract did not produce an updated mesh inventory.",
    );
  }

  return {
    createdFiles: plans.flatMap((plan) => [...plan.createdFiles]),
    updatedFiles: [latestMeshInventory],
  };
}

async function readExistingKnopInventory(
  meshRoot: string,
  inventoryPath: string,
  designatorPath: string,
): Promise<string> {
  try {
    return await Deno.readTextFile(join(meshRoot, inventoryPath));
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new ExtractRuntimeError(
        `Existing extracted Knop inventory does not exist for ${designatorPath}: ${inventoryPath}`,
      );
    }
    throw error;
  }
}

function hasExtractionSourceBinding(
  meshBase: string,
  inventoryTurtle: string,
  designatorPath: string,
): boolean {
  let quads: Quad[];
  try {
    quads = new Parser({ baseIRI: meshBase }).parse(inventoryTurtle);
  } catch {
    throw new ExtractRuntimeError(
      `Could not parse existing extracted Knop inventory for ${designatorPath}.`,
    );
  }
  const knopIri = new URL(toKnopPath(designatorPath), meshBase).href;
  const extractionSourceIri = new URL(
    `${toKnopPath(designatorPath)}/_inventory#extraction-source`,
    meshBase,
  ).href;
  return quads.some((quad) =>
    quad.subject.termType === "NamedNode" &&
    quad.subject.value === knopIri &&
    quad.predicate.value === SFLO_HAS_EXTRACTION_SOURCE_IRI &&
    quad.object.termType === "NamedNode" &&
    quad.object.value === extractionSourceIri
  );
}

function replaceExtractionSourceBinding(
  meshBase: string,
  inventoryTurtle: string,
  designatorPath: string,
  sourcePayload: ExtractSourcePayload,
): string {
  if (!hasExtractionSourceBinding(meshBase, inventoryTurtle, designatorPath)) {
    throw new ExtractRuntimeError(
      `Existing Knop is not an extracted Knop: ${designatorPath}`,
    );
  }
  const extractionSourcePath = `${
    toKnopPath(designatorPath)
  }/_inventory#extraction-source`;
  const escapedExtractionSourcePath = escapeRegExp(extractionSourcePath);
  const extractionSourceBlockPattern = new RegExp(
    `<${escapedExtractionSourcePath}> a sflo:ExtractionSource ;\\n` +
      `(?:  sflo:[^\\n]+(?: ;|\\.)\\n?)+`,
  );
  const replacement = renderExtractionSourceBlock(
    extractionSourcePath,
    sourcePayload,
  );
  if (!extractionSourceBlockPattern.test(inventoryTurtle)) {
    throw new ExtractRuntimeError(
      `Could not replace existing ExtractionSource block for ${designatorPath}.`,
    );
  }
  return inventoryTurtle.replace(extractionSourceBlockPattern, replacement);
}

function renderExtractionSourceBlock(
  extractionSourcePath: string,
  sourcePayload: ExtractSourcePayload,
): string {
  const facts: [string, string][] = [
    ["sflo:hasTargetArtifact", `<${sourcePayload.designatorPath}>`],
  ];
  if (sourcePayload.sourceResolutionMode === "pinned") {
    facts.push([
      "sflo:hasRequestedTargetState",
      `<${sourcePayload.sourceStatePath}>`,
    ]);
  }
  facts.push([
    "sflo:hasArtifactResolutionMode",
    `<${
      sourcePayload.sourceResolutionMode === "pinned"
        ? SFLO_ARTIFACT_RESOLUTION_MODE_PINNED_IRI
        : SFLO_ARTIFACT_RESOLUTION_MODE_CURRENT_IRI
    }>`,
  ]);
  facts.push(...toExtractionSourceEvidenceFacts(sourcePayload.sourceEvidence));

  return `<${extractionSourcePath}> a sflo:ExtractionSource ;
${
    facts.map(([predicate, object], index) =>
      `  ${predicate} ${object}${index === facts.length - 1 ? " ." : " ;"}`
    ).join("\n")
  }`;
}

function toExtractionSourceEvidenceFacts(
  sourceEvidence: ExtractionSourceEvidence | undefined,
): [string, string][] {
  if (!sourceEvidence) {
    return [];
  }

  const facts: [string, string][] = [];
  if (sourceEvidence.sourceStatePath !== undefined) {
    facts.push([
      "sflo:hasObservedSourceState",
      `<${sourceEvidence.sourceStatePath}>`,
    ]);
  }
  if (sourceEvidence.sourceManifestationPath !== undefined) {
    facts.push([
      "sflo:hasObservedSourceManifestation",
      `<${sourceEvidence.sourceManifestationPath}>`,
    ]);
  }
  if (sourceEvidence.sourceLocatedFilePath !== undefined) {
    facts.push([
      "sflo:hasObservedSourceLocatedFile",
      `<${sourceEvidence.sourceLocatedFilePath}>`,
    ]);
  }
  if (sourceEvidence.sourceDigest !== undefined) {
    facts.push([
      "sflo:observedSourceDigest",
      `"${escapeTurtleString(sourceEvidence.sourceDigest)}"`,
    ]);
  }
  if (sourceEvidence.observedAt !== undefined) {
    facts.push([
      "sflo:observedAt",
      `"${escapeTurtleString(sourceEvidence.observedAt)}"`,
    ]);
  }

  return facts;
}

function escapeTurtleString(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function assertUpdatedTargetsExist(
  workspaceRoot: string,
  plan: PlannedMutation,
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
  plan: PlannedMutation,
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
    { allowRoot: true },
  );
}

async function applyPlanAtomically(
  workspaceRoot: string,
  plan: PlannedMutation,
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
  meshRoot: string,
  workspaceRoot: string,
  designatorPath: string,
  plan: ExtractPlan | PlannedMutation | undefined,
  message: string,
): Promise<void> {
  const extractPlan = plan && "sourceDesignatorPath" in plan ? plan : undefined;
  try {
    await operationalLogger.error("extract.failed", "Local extract failed", {
      meshRoot,
      workspaceRoot,
      designatorPath,
      sourceDesignatorPath: extractPlan?.sourceDesignatorPath,
      sourceStateIri: extractPlan?.sourceStateIri,
      error: message,
    });
  } catch {
    // best-effort logging
  }

  try {
    await auditLogger.record("extract.failed", "Local extract failed", {
      meshRoot,
      workspaceRoot,
      designatorPath,
      sourceDesignatorPath: extractPlan?.sourceDesignatorPath,
      sourceStateIri: extractPlan?.sourceStateIri,
      error: message,
    });
  } catch {
    // best-effort logging
  }
}

async function logExtractAllTermsSucceededBestEffort(
  operationalLogger: StructuredLogger,
  auditLogger: AuditLogger,
  meshRoot: string,
  workspaceRoot: string,
  result: ExtractAllTermsResult,
): Promise<void> {
  try {
    await operationalLogger.info(
      "extract.allTerms.succeeded",
      "Local all-terms extract succeeded",
      {
        meshRoot,
        workspaceRoot,
        sourceDesignatorPath: result.sourceDesignatorPath,
        sourceStateIri: result.sourceStateIri,
        extractedDesignatorPaths: result.extractedDesignatorPaths,
        skippedExistingDesignatorPaths: result.skippedExistingDesignatorPaths,
        skippedSupportDesignatorPaths: result.skippedSupportDesignatorPaths,
        createdPaths: result.createdPaths,
        updatedPaths: result.updatedPaths,
      },
    );
  } catch {
    // best-effort logging
  }

  try {
    await auditLogger.record(
      "extract.allTerms.succeeded",
      "Local all-terms extract succeeded",
      {
        meshRoot,
        workspaceRoot,
        sourceDesignatorPath: result.sourceDesignatorPath,
        sourceStateIri: result.sourceStateIri,
        extractedDesignatorPaths: result.extractedDesignatorPaths,
        skippedExistingDesignatorPaths: result.skippedExistingDesignatorPaths,
        skippedSupportDesignatorPaths: result.skippedSupportDesignatorPaths,
        createdPaths: result.createdPaths,
        updatedPaths: result.updatedPaths,
      },
    );
  } catch {
    // best-effort logging
  }
}

async function logExtractSucceededBestEffort(
  operationalLogger: StructuredLogger,
  auditLogger: AuditLogger,
  meshRoot: string,
  workspaceRoot: string,
  result: ExtractResult,
): Promise<void> {
  try {
    await operationalLogger.info(
      "extract.succeeded",
      "Local extract succeeded",
      {
        meshRoot,
        workspaceRoot,
        designatorPath: result.designatorPath,
        sourceDesignatorPath: result.sourceDesignatorPath,
        sourceStateIri: result.sourceStateIri,
        createdPaths: result.createdPaths,
        updatedPaths: result.updatedPaths,
      },
    );
  } catch {
    // best-effort logging
  }

  try {
    await auditLogger.record("extract.succeeded", "Local extract succeeded", {
      meshRoot,
      workspaceRoot,
      designatorPath: result.designatorPath,
      sourceDesignatorPath: result.sourceDesignatorPath,
      sourceStateIri: result.sourceStateIri,
      createdPaths: result.createdPaths,
      updatedPaths: result.updatedPaths,
    });
  } catch {
    // best-effort logging
  }
}
