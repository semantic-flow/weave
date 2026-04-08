import { dirname, join } from "@std/path";
import { Parser, type Quad } from "n3";
import type { PlannedFile } from "../../core/planned_file.ts";
import {
  type NormalizedTargetSpec,
  type NormalizedVersionTargetSpec,
  normalizeTargetSpecs,
  normalizeVersionTargetSpecs,
  resolveTargetSelections,
} from "../../core/targeting.ts";
import {
  detectPendingWeaveSlice,
  type GenerateRequest,
  type PayloadWorkingArtifact,
  planVersion,
  type ReferenceCatalogWorkingArtifact,
  type ValidateRequest,
  type VersionPlan,
  type VersionRequest,
  type WeaveableKnopCandidate,
  WeaveInputError,
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

const SFLO_NAMESPACE =
  "https://semantic-flow.github.io/semantic-flow-ontology/";
const SFLO_HAS_RESOURCE_PAGE_IRI = `${SFLO_NAMESPACE}hasResourcePage`;

export interface ExecuteValidateOptions {
  workspaceRoot: string;
  request?: ValidateRequest;
}

export interface ExecuteVersionOptions {
  workspaceRoot: string;
  request?: VersionRequest;
}

export interface ExecuteGenerateOptions {
  workspaceRoot: string;
  request?: GenerateRequest;
}

export interface ExecuteWeaveOptions {
  workspaceRoot: string;
  request?: WeaveRequest;
  operationalLogger?: StructuredLogger;
  auditLogger?: AuditLogger;
}

export interface ValidateFinding {
  severity: "error";
  message: string;
}

export interface ValidateResult {
  meshBase?: string;
  validatedDesignatorPaths: readonly string[];
  findings: readonly ValidateFinding[];
}

export interface VersionResult {
  meshBase: string;
  versionedDesignatorPaths: readonly string[];
  createdPaths: readonly string[];
  updatedPaths: readonly string[];
}

export interface GenerateResult {
  meshBase: string;
  generatedDesignatorPaths: readonly string[];
  createdPaths: readonly string[];
  updatedPaths: readonly string[];
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

interface MeshState {
  meshBase: string;
  currentMeshInventoryTurtle: string;
}

interface PreparedVersionExecution {
  meshState: MeshState;
  plan: VersionPlan;
}

interface GenerateDesignatorContext {
  designatorPath: string;
  payloadWorkingFilePath?: string;
  pagePaths: readonly string[];
}

export async function executeValidate(
  options: ExecuteValidateOptions,
): Promise<ValidateResult> {
  try {
    const targets = normalizeValidateRequest(options.request);
    const prepared = await prepareVersionExecution(
      options.workspaceRoot,
      toNormalizedVersionTargets(targets),
    );
    validateRdfFiles([
      ...prepared.plan.createdFiles,
      ...prepared.plan.updatedFiles,
    ]);

    return {
      meshBase: prepared.meshState.meshBase,
      validatedDesignatorPaths: prepared.plan.versionedDesignatorPaths,
      findings: [],
    };
  } catch (error) {
    if (
      error instanceof WeaveInputError || error instanceof WeaveRuntimeError
    ) {
      return {
        validatedDesignatorPaths: [],
        findings: [{
          severity: "error",
          message: error.message,
        }],
      };
    }
    throw error;
  }
}

export async function executeVersion(
  options: ExecuteVersionOptions,
): Promise<VersionResult> {
  const targets = normalizeVersionRequest(options.request);
  const prepared = await prepareVersionExecution(
    options.workspaceRoot,
    targets,
  );
  assertUpdatedTargetsExist(options.workspaceRoot, prepared.plan.updatedFiles);
  await assertCreateTargetsDoNotExist(
    options.workspaceRoot,
    prepared.plan.createdFiles,
  );
  validateRdfFiles([
    ...prepared.plan.createdFiles,
    ...prepared.plan.updatedFiles,
  ]);
  await writeFiles(options.workspaceRoot, prepared.plan.createdFiles, true);
  await writeFiles(options.workspaceRoot, prepared.plan.updatedFiles, false);

  return {
    meshBase: prepared.meshState.meshBase,
    versionedDesignatorPaths: prepared.plan.versionedDesignatorPaths,
    createdPaths: prepared.plan.createdFiles.map((file) => file.path),
    updatedPaths: prepared.plan.updatedFiles.map((file) => file.path),
  };
}

export async function executeGenerate(
  options: ExecuteGenerateOptions,
): Promise<GenerateResult> {
  const targets = normalizeGenerateRequest(options.request);
  await ensureWorkspaceRootExists(options.workspaceRoot);
  const meshState = await loadMeshState(options.workspaceRoot);
  const allDesignatorPaths = listKnopDesignatorPaths(
    meshState.meshBase,
    meshState.currentMeshInventoryTurtle,
    "Could not parse the current MeshInventory while resolving generate targets.",
  );
  const selectedDesignatorPaths = resolveSelectedDesignatorPaths(
    allDesignatorPaths,
    targets,
  );
  const pageFiles = await collectGeneratedPageFiles(
    options.workspaceRoot,
    meshState,
    selectedDesignatorPaths,
    targets.length === 0,
  );
  const writeResult = await writeFilesUpsert(options.workspaceRoot, pageFiles);

  return {
    meshBase: meshState.meshBase,
    generatedDesignatorPaths: selectedDesignatorPaths,
    createdPaths: writeResult.createdPaths,
    updatedPaths: writeResult.updatedPaths,
  };
}

export async function executeWeave(
  options: ExecuteWeaveOptions,
): Promise<WeaveResult> {
  const { operationalLogger, auditLogger } = resolveLoggers(options);
  const workspaceRoot = options.workspaceRoot;
  let wovenDesignatorPaths: readonly string[] = [];

  await operationalLogger.info("weave.started", "Starting local weave", {
    workspaceRoot,
    targets: options.request?.targets ?? [],
  });
  await auditLogger.record("weave.started", "Local weave started", {
    workspaceRoot,
    targets: options.request?.targets ?? [],
  });

  try {
    const validation = await executeValidate({
      workspaceRoot,
      request: toSharedTargetRequest(options.request),
    });
    if (validation.findings.length > 0) {
      throw new WeaveInputError(validation.findings[0]!.message);
    }

    const versionResult = await executeVersion({
      workspaceRoot,
      request: options.request,
    });
    wovenDesignatorPaths = versionResult.versionedDesignatorPaths;

    const generateResult = await executeGenerate({
      workspaceRoot,
      request: toSharedTargetRequest(options.request),
    });

    const result: WeaveResult = {
      meshBase: versionResult.meshBase,
      wovenDesignatorPaths,
      createdPaths: [
        ...versionResult.createdPaths,
        ...generateResult.createdPaths,
      ],
      updatedPaths: [
        ...versionResult.updatedPaths,
        ...generateResult.updatedPaths,
      ],
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await operationalLogger.error("weave.failed", "Local weave failed", {
      workspaceRoot,
      wovenDesignatorPaths,
      error: message,
    });
    await auditLogger.record("weave.failed", "Local weave failed", {
      workspaceRoot,
      wovenDesignatorPaths,
      error: message,
    });

    if (
      error instanceof WeaveInputError || error instanceof WeaveRuntimeError
    ) {
      throw error;
    }
    throw new WeaveRuntimeError(message);
  }
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

function normalizeValidateRequest(
  request: ValidateRequest | undefined,
): readonly NormalizedTargetSpec[] {
  assertSupportedRequestKeys(request, "request", new Set(["targets"]));
  return normalizeTargetSpecs(
    request?.targets,
    "request.targets",
    (message) => new WeaveInputError(message),
  );
}

function normalizeGenerateRequest(
  request: GenerateRequest | undefined,
): readonly NormalizedTargetSpec[] {
  assertSupportedRequestKeys(request, "request", new Set(["targets"]));
  return normalizeTargetSpecs(
    request?.targets,
    "request.targets",
    (message) => new WeaveInputError(message),
  );
}

function normalizeVersionRequest(
  request: VersionRequest | undefined,
): readonly NormalizedVersionTargetSpec[] {
  assertSupportedRequestKeys(request, "request", new Set(["targets"]));
  return normalizeVersionTargetSpecs(
    request?.targets,
    "request.targets",
    (message) => new WeaveInputError(message),
  );
}

function toSharedTargetRequest(
  request: WeaveRequest | undefined,
): ValidateRequest | undefined {
  if (!request) {
    return undefined;
  }

  return {
    targets: request.targets?.map((target) => ({
      designatorPath: target.designatorPath,
      ...(target.recursive ? { recursive: true } : {}),
    })),
  };
}

function assertSupportedRequestKeys(
  request: unknown,
  fieldName: string,
  allowedKeys: ReadonlySet<string>,
): void {
  if (request === undefined) {
    return;
  }
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new WeaveInputError(`${fieldName} must be an object`);
  }

  for (const key of Object.keys(request)) {
    if (!allowedKeys.has(key)) {
      throw new WeaveInputError(`${fieldName}.${key} is not supported`);
    }
  }
}

async function prepareVersionExecution(
  workspaceRoot: string,
  targets: readonly NormalizedVersionTargetSpec[],
): Promise<PreparedVersionExecution> {
  await ensureWorkspaceRootExists(workspaceRoot);
  const meshState = await loadMeshState(workspaceRoot);
  const selectedDesignatorPaths = resolveSelectedDesignatorPaths(
    listKnopDesignatorPaths(
      meshState.meshBase,
      meshState.currentMeshInventoryTurtle,
      "Could not parse the current MeshInventory while resolving weaveable Knop candidates.",
    ),
    targets,
  );
  const weaveableKnops = await loadWeaveableKnopCandidates(
    workspaceRoot,
    meshState.meshBase,
    meshState.currentMeshInventoryTurtle,
    selectedDesignatorPaths,
  );
  const plan = planVersion({
    request: {
      targets: targets.map((target) => ({ ...target.source })),
    },
    meshBase: meshState.meshBase,
    currentMeshInventoryTurtle: meshState.currentMeshInventoryTurtle,
    weaveableKnops,
  });

  return {
    meshState,
    plan,
  };
}

function toNormalizedVersionTargets(
  targets: readonly NormalizedTargetSpec[],
): readonly NormalizedVersionTargetSpec[] {
  return targets.map((target) => ({
    source: { ...target.source },
    designatorPath: target.designatorPath,
    recursive: target.recursive,
  }));
}

function resolveSelectedDesignatorPaths(
  allDesignatorPaths: readonly string[],
  targets:
    | readonly NormalizedTargetSpec[]
    | readonly NormalizedVersionTargetSpec[],
): readonly string[] {
  return resolveTargetSelections(
    allDesignatorPaths,
    targets,
    (message) => new WeaveInputError(message),
  ).map((selection) => selection.designatorPath);
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
): Promise<MeshState> {
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
  const requested = new Set(requestedDesignatorPaths);

  const candidates: WeaveableKnopCandidate[] = [];
  for (const designatorPath of designatorPaths) {
    if (requested.size > 0 && !requested.has(designatorPath)) {
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
  const currentArtifactHistoryPath = payloadArtifact.currentArtifactHistoryPath;
  const latestHistoricalStatePath = payloadArtifact.currentArtifactHistoryExists
    ? payloadArtifact.latestHistoricalStatePath
    : undefined;
  const latestHistoricalSnapshotPath = latestHistoricalStatePath
    ? join(
      workspaceRoot,
      toPayloadHistoricalSnapshotPath(
        latestHistoricalStatePath,
        workingFilePath,
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
              latestHistoricalStatePath!,
              workingFilePath,
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
    currentArtifactHistoryPath,
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

async function collectGeneratedPageFiles(
  workspaceRoot: string,
  meshState: MeshState,
  selectedDesignatorPaths: readonly string[],
  includeAllMeshPages: boolean,
): Promise<readonly PlannedFile[]> {
  const pageModels: {
    kind: "identifier" | "simple";
    path: string;
    designatorPath?: string;
    workingFilePath?: string;
    description?: string;
  }[] = [];
  const pagePaths = new Set<string>();
  const selectedSet = new Set(selectedDesignatorPaths);
  const designatorContexts = await loadGenerateDesignatorContexts(
    workspaceRoot,
    meshState,
    selectedDesignatorPaths,
  );
  const publicIdentifierPaths = new Map(
    designatorContexts.map((context) => [
      `${context.designatorPath}/index.html`,
      context,
    ]),
  );

  for (
    const pagePath of listResourcePagePaths(
      meshState.meshBase,
      meshState.currentMeshInventoryTurtle,
      "Could not parse the current MeshInventory while collecting ResourcePages.",
    )
  ) {
    if (
      !includeAllMeshPages &&
      !pagePath.startsWith("_mesh/") &&
      !selectedSet.has(pagePath.slice(0, -"/index.html".length))
    ) {
      continue;
    }
    if (pagePaths.has(pagePath)) {
      continue;
    }

    const publicContext = publicIdentifierPaths.get(pagePath);
    if (publicContext) {
      pageModels.push({
        kind: "identifier",
        path: pagePath,
        designatorPath: publicContext.designatorPath,
        workingFilePath: publicContext.payloadWorkingFilePath,
      });
    } else {
      pageModels.push({
        kind: "simple",
        path: pagePath,
        description: `Generated resource page for ${toResourcePath(pagePath)}.`,
      });
    }
    pagePaths.add(pagePath);
  }

  for (const context of designatorContexts) {
    for (const pagePath of context.pagePaths) {
      if (pagePaths.has(pagePath)) {
        continue;
      }

      pageModels.push({
        kind: "simple",
        path: pagePath,
        description: `Generated resource page for ${toResourcePath(pagePath)}.`,
      });
      pagePaths.add(pagePath);
    }
  }

  return renderResourcePages(
    meshState.meshBase,
    pageModels.map((model) =>
      model.kind === "identifier"
        ? {
          kind: "identifier" as const,
          path: model.path,
          designatorPath: model.designatorPath!,
          workingFilePath: model.workingFilePath,
        }
        : {
          kind: "simple" as const,
          path: model.path,
          description: model.description!,
        }
    ),
  );
}

async function loadGenerateDesignatorContexts(
  workspaceRoot: string,
  meshState: MeshState,
  designatorPaths: readonly string[],
): Promise<readonly GenerateDesignatorContext[]> {
  const contexts: GenerateDesignatorContext[] = [];

  for (const designatorPath of designatorPaths) {
    const knopInventoryPath = join(
      workspaceRoot,
      `${designatorPath}/_knop/_inventory/inventory.ttl`,
    );
    let currentKnopInventoryTurtle: string;

    try {
      currentKnopInventoryTurtle = await Deno.readTextFile(knopInventoryPath);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        continue;
      }
      throw error;
    }

    const payloadArtifact = resolvePayloadArtifactInventoryState(
      meshState.meshBase,
      currentKnopInventoryTurtle,
      designatorPath,
      {
        parseErrorMessage:
          `Could not parse the current Knop inventory while collecting pages for ${designatorPath}.`,
        missingWorkingFileMessage:
          `Could not resolve the working payload file for ${designatorPath}.`,
      },
    );

    contexts.push({
      designatorPath,
      payloadWorkingFilePath: payloadArtifact?.workingFilePath,
      pagePaths: listResourcePagePaths(
        meshState.meshBase,
        currentKnopInventoryTurtle,
        `Could not parse the current Knop inventory while collecting ResourcePages for ${designatorPath}.`,
      ),
    });
  }

  return contexts;
}

function listResourcePagePaths(
  meshBase: string,
  inventoryTurtle: string,
  parseErrorMessage: string,
): readonly string[] {
  const quads = parseInventoryQuads(
    meshBase,
    inventoryTurtle,
    parseErrorMessage,
  );
  const paths = new Set<string>();

  for (const quad of quads) {
    if (
      quad.predicate.value !== SFLO_HAS_RESOURCE_PAGE_IRI ||
      quad.object.termType !== "NamedNode"
    ) {
      continue;
    }

    const pagePath = tryToMeshPath(meshBase, quad.object.value);
    if (!pagePath?.endsWith("/index.html")) {
      continue;
    }

    paths.add(pagePath);
  }

  return [...paths].sort((left, right) => left.localeCompare(right));
}

function parseInventoryQuads(
  meshBase: string,
  inventoryTurtle: string,
  parseErrorMessage: string,
): readonly Quad[] {
  try {
    return new Parser({ baseIRI: meshBase }).parse(inventoryTurtle);
  } catch {
    throw new WeaveRuntimeError(parseErrorMessage);
  }
}

function tryToMeshPath(meshBase: string, iri: string): string | undefined {
  if (!iri.startsWith(meshBase)) {
    return undefined;
  }

  const suffix = iri.slice(meshBase.length);
  return suffix.length === 0 ? undefined : suffix;
}

function toResourcePath(pagePath: string): string {
  return pagePath.endsWith("/index.html")
    ? pagePath.slice(0, -"/index.html".length)
    : pagePath;
}

function toPayloadHistoricalSnapshotPath(
  historyStatePath: string,
  workingFilePath: string,
): string {
  const fileName = toFileName(workingFilePath);
  const manifestationSegment = fileName.replaceAll(".", "-");
  return `${historyStatePath}/${manifestationSegment}/${fileName}`;
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

async function writeFilesUpsert(
  workspaceRoot: string,
  files: readonly PlannedFile[],
): Promise<{ createdPaths: string[]; updatedPaths: string[] }> {
  const createdPaths: string[] = [];
  const updatedPaths: string[] = [];

  for (const file of files) {
    const absolutePath = join(workspaceRoot, file.path);
    let exists = false;
    let currentContents: string | undefined;

    try {
      currentContents = await Deno.readTextFile(absolutePath);
      exists = true;
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }

    if (exists && currentContents === file.contents) {
      continue;
    }

    await Deno.mkdir(dirname(absolutePath), { recursive: true });
    await Deno.writeTextFile(absolutePath, file.contents);

    if (exists) {
      updatedPaths.push(file.path);
    } else {
      createdPaths.push(file.path);
    }
  }

  return {
    createdPaths,
    updatedPaths,
  };
}
