import { dirname, join, relative } from "@std/path";
import { Parser, type Quad } from "n3";
import {
  formatDesignatorPathForDisplay,
  normalizeSafeDesignatorPath,
  toKnopPath,
} from "../../core/designator_segments.ts";
import {
  ExtractInputError,
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

export interface LocalExtractRequest {
  designatorPath: string;
  sourceDesignatorPath?: string;
}

export interface LocalExtractAllTermsRequest {
  sourceDesignatorPath: string;
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
  sourceStateIri: string;
  createdPaths: readonly string[];
  updatedPaths: readonly string[];
}

export interface ExtractAllTermsResult {
  meshBase: string;
  sourceDesignatorPath: string;
  sourceArtifactIri: string;
  sourceStateIri: string;
  discoveredDesignatorPaths: readonly string[];
  extractedDesignatorPaths: readonly string[];
  skippedExistingDesignatorPaths: readonly string[];
  skippedSupportDesignatorPaths: readonly string[];
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
  workingLocalRelativePath: string;
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
  const meshRoot = options.meshRoot ?? options.workspaceRoot;
  if (!meshRoot) {
    throw new ExtractRuntimeError("meshRoot is required");
  }
  const localPathPolicy = await loadOperationalLocalPathPolicy(meshRoot);
  const workspaceRoot = localPathPolicy.workspaceRoot;
  const designatorPath = options.request.designatorPath;
  const sourceDesignatorPath = options.request.sourceDesignatorPath;
  let plan: ExtractPlan | undefined;

  await operationalLogger.info("extract.started", "Starting local extract", {
    meshRoot,
    workspaceRoot,
    designatorPath,
    sourceDesignatorPath,
  });
  await auditLogger.record("extract.started", "Local extract started", {
    meshRoot,
    workspaceRoot,
    designatorPath,
    sourceDesignatorPath,
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
    );
    plan = planExtract({
      meshBase: meshState.meshBase,
      currentMeshInventoryTurtle: meshState.currentMeshInventoryTurtle,
      designatorPath: normalizedDesignatorPath,
      sourceDesignatorPath: sourcePayload.designatorPath,
      sourceStatePath: sourcePayload.latestHistoricalStatePath,
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
  let plannedMutation: PlannedMutation | undefined;

  await operationalLogger.info(
    "extract.allTerms.started",
    "Starting local all-terms extract",
    {
      meshRoot,
      workspaceRoot,
      sourceDesignatorPath,
    },
  );
  await auditLogger.record(
    "extract.allTerms.started",
    "Local all-terms extract started",
    {
      meshRoot,
      workspaceRoot,
      sourceDesignatorPath,
    },
  );

  try {
    await ensureMeshRootExists(meshRoot);
    const normalizedSourceDesignatorPath = normalizeLocalDesignatorPath(
      sourceDesignatorPath,
      "sourceDesignatorPath",
    );
    const meshState = await loadMeshState(meshRoot);
    const sourcePayload = await resolveSelectedExtractSourcePayload(
      meshRoot,
      localPathPolicy,
      meshState.currentMeshInventoryTurtle,
      meshState.meshBase,
      normalizedSourceDesignatorPath,
    );
    const discovery = discoverAllTermDesignatorPaths({
      meshBase: meshState.meshBase,
      sourceDesignatorPath: normalizedSourceDesignatorPath,
      currentMeshInventoryTurtle: meshState.currentMeshInventoryTurtle,
      currentPayloadTurtle: sourcePayload.currentPayloadTurtle,
    });
    const plans: ExtractPlan[] = [];
    let currentMeshInventoryTurtle = meshState.currentMeshInventoryTurtle;

    for (const designatorPath of discovery.extractedDesignatorPaths) {
      const plan = planExtract({
        meshBase: meshState.meshBase,
        currentMeshInventoryTurtle,
        designatorPath,
        sourceDesignatorPath: sourcePayload.designatorPath,
        sourceStatePath: sourcePayload.latestHistoricalStatePath,
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
      sourceStateIri: new URL(
        sourcePayload.latestHistoricalStatePath,
        meshState.meshBase,
      ).href,
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
      sourceDesignatorPath,
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
  const normalizedSourceDesignatorPath = normalizeLocalDesignatorPath(
    options.request.sourceDesignatorPath,
    "sourceDesignatorPath",
  );
  const meshState = await loadMeshState(meshRoot);
  const sourcePayload = await resolveSelectedExtractSourcePayload(
    meshRoot,
    localPathPolicy,
    meshState.currentMeshInventoryTurtle,
    meshState.meshBase,
    normalizedSourceDesignatorPath,
  );
  const discovery = discoverAllTermDesignatorPaths({
    meshBase: meshState.meshBase,
    sourceDesignatorPath: normalizedSourceDesignatorPath,
    currentMeshInventoryTurtle: meshState.currentMeshInventoryTurtle,
    currentPayloadTurtle: sourcePayload.currentPayloadTurtle,
  });

  return {
    meshBase: meshState.meshBase,
    sourceDesignatorPath: sourcePayload.designatorPath,
    sourceArtifactIri: new URL(sourcePayload.designatorPath, meshState.meshBase)
      .href,
    sourceStateIri: new URL(
      sourcePayload.latestHistoricalStatePath,
      meshState.meshBase,
    ).href,
    discoveredDesignatorPaths: discovery.discoveredDesignatorPaths,
    extractedDesignatorPaths: discovery.extractedDesignatorPaths,
    skippedExistingDesignatorPaths: discovery.skippedExistingDesignatorPaths,
    skippedSupportDesignatorPaths: discovery.skippedSupportDesignatorPaths,
    createdPaths: [],
    updatedPaths: [],
  };
}

export function describeExtractResult(result: ExtractResult): string {
  return `Extracted ${
    formatDesignatorPathForDisplay(result.designatorPath)
  } with source ${result.extractionSourceIri}, created ${result.createdPaths.length} knop support artifacts, and updated ${result.updatedPaths.length} mesh support artifact.`;
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
): Promise<ExtractSourcePayload> {
  const candidates = await loadExtractSourcePayloadCandidates(
    meshRoot,
    localPathPolicy,
    meshBase,
    currentMeshInventoryTurtle,
  );

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
        selectedCandidate.currentPayloadTurtle,
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

async function resolveSelectedExtractSourcePayload(
  meshRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  currentMeshInventoryTurtle: string,
  meshBase: string,
  sourceDesignatorPath: string,
): Promise<ExtractSourcePayload> {
  const candidates = await loadExtractSourcePayloadCandidates(
    meshRoot,
    localPathPolicy,
    meshBase,
    currentMeshInventoryTurtle,
  );
  const selectedCandidate = candidates.find((candidate) =>
    candidate.designatorPath === sourceDesignatorPath
  );
  if (!selectedCandidate) {
    throw new ExtractRuntimeError(
      `Selected extract source is not an eligible woven payload artifact: ${sourceDesignatorPath}`,
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
  if (!payloadArtifact.currentArtifactHistoryPath) {
    return undefined;
  }
  if (!payloadArtifact.currentArtifactHistoryExists) {
    throw new ExtractRuntimeError(
      `Could not resolve the current payload history block for ${designatorPath}.`,
    );
  }
  if (!payloadArtifact.latestHistoricalStatePath) {
    throw new ExtractRuntimeError(
      `Could not resolve the latest payload historical state for ${designatorPath}.`,
    );
  }

  const currentPayloadTurtle = await readPayloadWorkingFile(
    localPathPolicy,
    designatorPath,
    payloadArtifact.workingLocalRelativePath,
  );

  return {
    designatorPath,
    workingLocalRelativePath: payloadArtifact.workingLocalRelativePath,
    latestHistoricalStatePath: payloadArtifact.latestHistoricalStatePath,
    currentPayloadTurtle,
  };
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
