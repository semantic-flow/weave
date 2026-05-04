import { dirname, join, relative } from "@std/path";
import { Parser, type Quad } from "n3";
import {
  formatDesignatorPathForDisplay,
  toDesignatorResourcePagePath,
  toKnopPath,
} from "../../core/designator_segments.ts";
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
  planMeshSupportResourcePages,
  planVersion,
  type ReferenceCatalogWorkingArtifact,
  type ResourcePageDefinitionWorkingArtifact,
  type ResourcePageHistoryGroupModel,
  type ResourcePageModel,
  type ResourcePageRawSourcePanelModel,
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
  resolveResourcePageDefinitionInventoryState,
} from "../mesh/inventory.ts";
import {
  loadOperationalLocalPathPolicy,
  LocalPathAccessError,
  type OperationalLocalPathPolicy,
  resolveAllowedLocalPath,
} from "../operational/local_path_policy.ts";
import {
  MeshMetadataResolutionError,
  resolveMeshBaseFromMetadataTurtle,
} from "../mesh/metadata.ts";
import { resolveRuntimeLoggers } from "../logging/factory.ts";
import type { AuditLogger } from "../logging/audit_logger.ts";
import type { StructuredLogger } from "../logging/logger.ts";
import {
  type CustomIdentifierPageModelInput,
  describeResourcePageDefinitionArtifact,
  loadActiveCustomIdentifierPage,
  loadResourcePageDefinitionWorkingArtifact,
  ResourcePageDefinitionResolutionError,
} from "./page_definition.ts";
import { renderResourcePages } from "./pages.ts";

const SFLO_NAMESPACE =
  "https://semantic-flow.github.io/semantic-flow-ontology/";
const SFLO_HAS_RESOURCE_PAGE_IRI = `${SFLO_NAMESPACE}hasResourcePage`;
const SFLO_CURRENT_ARTIFACT_HISTORY_IRI =
  `${SFLO_NAMESPACE}currentArtifactHistory`;
const SFLO_HAS_HISTORICAL_STATE_IRI = `${SFLO_NAMESPACE}hasHistoricalState`;
const SFLO_HAS_MANIFESTATION_IRI = `${SFLO_NAMESPACE}hasManifestation`;
const SFLO_HAS_LOCATED_FILE_IRI = `${SFLO_NAMESPACE}hasLocatedFile`;
const SFLO_LOCATED_FILE_FOR_STATE_IRI = `${SFLO_NAMESPACE}locatedFileForState`;

export interface ExecuteValidateOptions {
  meshRoot: string;
  request?: ValidateRequest;
}

export interface ExecuteVersionOptions {
  meshRoot: string;
  request?: VersionRequest;
}

export interface ExecuteGenerateOptions {
  meshRoot: string;
  request?: GenerateRequest;
}

export interface ExecuteWeaveOptions {
  meshRoot: string;
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
  currentMeshMetadataTurtle: string;
  currentMeshInventoryTurtle: string;
  currentMeshConfigTurtle?: string;
}

interface PreparedVersionExecution {
  meshState: MeshState;
  plan: VersionPlan;
}

type TextFileOverlay = Map<string, string>;

interface GenerateDesignatorContext {
  designatorPath: string;
  payloadWorkingLocalRelativePath?: string;
  pagePaths: readonly string[];
  customIdentifierPage?: CustomIdentifierPageModelInput;
  historyGroupsByResourcePath: ReadonlyMap<
    string,
    readonly ResourcePageHistoryGroupModel[]
  >;
  pageDescriptions: ReadonlyMap<string, string>;
  rawSourcePanels: ReadonlyMap<
    string,
    readonly ResourcePageRawSourcePanelModel[]
  >;
}

const RAW_SOURCE_INLINE_BYTE_LIMIT = 1024 * 1024;

export async function executeValidate(
  options: ExecuteValidateOptions,
): Promise<ValidateResult> {
  try {
    const targets = normalizeValidateRequest(options.request);
    const meshRoot = resolveExecutionMeshRoot(options);
    const localPathPolicy = await loadOperationalLocalPathPolicy(
      meshRoot,
    );
    const prepared = await prepareVersionExecution(
      meshRoot,
      toNormalizedVersionTargets(targets),
      localPathPolicy,
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
  const meshRoot = resolveExecutionMeshRoot(options);
  const localPathPolicy = await loadOperationalLocalPathPolicy(
    meshRoot,
  );
  const prepared = await prepareVersionExecution(
    meshRoot,
    targets,
    localPathPolicy,
  );
  assertUpdatedTargetsExist(meshRoot, prepared.plan.updatedFiles);
  await assertCreateTargetsDoNotExist(
    meshRoot,
    prepared.plan.createdFiles,
  );
  validateRdfFiles([
    ...prepared.plan.createdFiles,
    ...prepared.plan.updatedFiles,
  ]);
  await writeFiles(meshRoot, prepared.plan.createdFiles, true);
  await writeFiles(meshRoot, prepared.plan.updatedFiles, false);

  return {
    meshBase: prepared.meshState.meshBase,
    versionedDesignatorPaths: prepared.plan.versionedDesignatorPaths,
    createdPaths: prepared.plan.createdFiles.map((file) =>
      toWorkspaceRelativePath(localPathPolicy, file.path)
    ),
    updatedPaths: prepared.plan.updatedFiles.map((file) =>
      toWorkspaceRelativePath(localPathPolicy, file.path)
    ),
  };
}

export async function executeGenerate(
  options: ExecuteGenerateOptions,
): Promise<GenerateResult> {
  const targets = normalizeGenerateRequest(options.request);
  const meshRoot = resolveExecutionMeshRoot(options);
  await ensureWorkspaceRootExists(meshRoot);
  const localPathPolicy = await loadOperationalLocalPathPolicy(
    meshRoot,
  );
  const meshState = await loadMeshState(meshRoot);
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
    meshRoot,
    localPathPolicy,
    meshState,
    selectedDesignatorPaths,
    targets.length === 0,
  );
  const writeResult = await writeFilesUpsert(meshRoot, pageFiles);

  return {
    meshBase: meshState.meshBase,
    generatedDesignatorPaths: selectedDesignatorPaths,
    createdPaths: writeResult.createdPaths.map((path) =>
      toWorkspaceRelativePath(localPathPolicy, path)
    ),
    updatedPaths: writeResult.updatedPaths.map((path) =>
      toWorkspaceRelativePath(localPathPolicy, path)
    ),
  };
}

export async function executeWeave(
  options: ExecuteWeaveOptions,
): Promise<WeaveResult> {
  const { operationalLogger, auditLogger } = resolveLoggers(options);
  const meshRoot = resolveExecutionMeshRoot(options);
  const initialPolicy = await loadOperationalLocalPathPolicy(meshRoot);
  const workspaceRoot = initialPolicy.workspaceRoot;
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
      meshRoot,
      request: toSharedTargetRequest(options.request),
    });
    if (validation.findings.length > 0) {
      throw new WeaveInputError(validation.findings[0]!.message);
    }

    const versionResult = await executeVersion({
      meshRoot,
      request: options.request,
    });
    wovenDesignatorPaths = versionResult.versionedDesignatorPaths;

    const generateResult = await executeGenerate({
      meshRoot,
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

export function describeValidateResult(result: ValidateResult): string {
  const validatedLabel = result.validatedDesignatorPaths.length === 1
    ? "designator path"
    : "designator paths";
  const findingLabel = result.findings.length === 1 ? "issue" : "issues";
  return `Validated ${result.validatedDesignatorPaths.length} ${validatedLabel} and found ${result.findings.length} ${findingLabel}.`;
}

export function describeVersionResult(result: VersionResult): string {
  const designatorLabel = result.versionedDesignatorPaths.length === 1
    ? "designator path"
    : "designator paths";
  return `Versioned ${result.versionedDesignatorPaths.length} ${designatorLabel} and created ${result.createdPaths.length} files while updating ${result.updatedPaths.length} working artifacts.`;
}

export function describeGenerateResult(result: GenerateResult): string {
  const designatorLabel = result.generatedDesignatorPaths.length === 1
    ? "designator path"
    : "designator paths";
  return `Generated ${result.generatedDesignatorPaths.length} ${designatorLabel} and created ${result.createdPaths.length} files while updating ${result.updatedPaths.length} existing pages.`;
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

  // executeWeave runs validate -> version -> generate as separate phases. Keep
  // this bridge normalized through the version-target parser first so shared
  // validate/generate targeting stays semantically aligned with version
  // targeting as the request shape evolves.
  assertSupportedRequestKeys(request, "request", new Set(["targets"]));
  const normalizedTargets = normalizeVersionTargetSpecs(
    request.targets,
    "request.targets",
    (message) => new WeaveInputError(message),
  );

  return {
    targets: normalizedTargets.map((target) => ({
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
  localPathPolicy: OperationalLocalPathPolicy,
): Promise<PreparedVersionExecution> {
  await ensureWorkspaceRootExists(workspaceRoot);
  const meshState = await loadMeshState(workspaceRoot);
  const allDesignatorPaths = listKnopDesignatorPaths(
    meshState.meshBase,
    meshState.currentMeshInventoryTurtle,
    "Could not parse the current MeshInventory while resolving weaveable Knop candidates.",
  );
  const resolvedTargets = targets.length === 0 ? [] : resolveTargetSelections(
    allDesignatorPaths,
    targets,
    (message) => new WeaveInputError(message),
  );
  const requestedDesignatorPaths = resolvedTargets.map((selection) =>
    selection.designatorPath
  );
  const targetByDesignatorPath = new Map(
    resolvedTargets.map((selection) => [
      selection.designatorPath,
      selection.target as NormalizedVersionTargetSpec | undefined,
    ]),
  );
  const overlay: TextFileOverlay = new Map();
  const initialWeaveableKnops = await loadWeaveableKnopCandidates(
    workspaceRoot,
    localPathPolicy,
    meshState.meshBase,
    meshState.currentMeshInventoryTurtle,
    requestedDesignatorPaths,
    overlay,
  );
  assertRequestedTargetsAreWeaveable(
    targets,
    initialWeaveableKnops,
  );

  if (initialWeaveableKnops.length === 0) {
    if (targets.length === 0) {
      return {
        meshState,
        plan: planMeshSupportResourcePages({
          meshBase: meshState.meshBase,
          currentMeshInventoryTurtle: meshState.currentMeshInventoryTurtle,
          currentMeshMetadataTurtle: meshState.currentMeshMetadataTurtle,
          currentMeshConfigTurtle: meshState.currentMeshConfigTurtle,
        }),
      };
    }
    throw new WeaveInputError(
      "Requested targets did not match any weave candidates.",
    );
  }

  const remainingDesignatorPaths = initialWeaveableKnops.map((candidate) =>
    candidate.designatorPath
  );
  const createdFiles: PlannedFile[] = [];
  const createdPaths = new Set<string>();
  const updatedFileByPath = new Map<string, PlannedFile>();
  const updatedPathOrder: string[] = [];
  const versionedDesignatorPaths: string[] = [];

  while (remainingDesignatorPaths.length > 0) {
    const stagedMeshState = await loadMeshState(workspaceRoot, overlay);
    const stagedWeaveableKnops = await loadWeaveableKnopCandidates(
      workspaceRoot,
      localPathPolicy,
      stagedMeshState.meshBase,
      stagedMeshState.currentMeshInventoryTurtle,
      remainingDesignatorPaths,
      overlay,
    );

    if (stagedWeaveableKnops.length === 0) {
      throw new WeaveInputError(
        `Recursive version planning could not continue cleanly for the remaining targets: ${
          remainingDesignatorPaths.join(", ")
        }.`,
      );
    }

    const nextCandidate = stagedWeaveableKnops[0]!;
    const nextDesignatorPath = nextCandidate.designatorPath;
    const target = targetByDesignatorPath.get(nextDesignatorPath);
    const nextPlan = planVersion({
      request: target ? { targets: [{ ...target.source }] } : {},
      meshBase: stagedMeshState.meshBase,
      currentMeshInventoryTurtle: stagedMeshState.currentMeshInventoryTurtle,
      weaveableKnops: [nextCandidate],
    });

    for (const file of nextPlan.createdFiles) {
      if (createdPaths.has(file.path) || updatedFileByPath.has(file.path)) {
        throw new WeaveInputError(
          `Recursive version planning produced a conflicting created file: ${file.path}`,
        );
      }
      createdFiles.push(file);
      createdPaths.add(file.path);
    }

    for (const file of nextPlan.updatedFiles) {
      if (createdPaths.has(file.path)) {
        throw new WeaveInputError(
          `Recursive version planning attempted to update a newly created file: ${file.path}`,
        );
      }
      if (!updatedFileByPath.has(file.path)) {
        updatedPathOrder.push(file.path);
      }
      updatedFileByPath.set(file.path, file);
    }

    versionedDesignatorPaths.push(...nextPlan.versionedDesignatorPaths);
    applyPlannedFilesToOverlay(workspaceRoot, overlay, nextPlan.createdFiles);
    applyPlannedFilesToOverlay(workspaceRoot, overlay, nextPlan.updatedFiles);

    const completedPath = nextPlan.versionedDesignatorPaths[0]!;
    const completedIndex = remainingDesignatorPaths.indexOf(completedPath);
    if (completedIndex < 0) {
      throw new WeaveInputError(
        `Recursive version planning lost track of ${completedPath}.`,
      );
    }
    remainingDesignatorPaths.splice(completedIndex, 1);
  }

  const plan: VersionPlan = {
    meshBase: meshState.meshBase,
    versionedDesignatorPaths,
    createdFiles,
    updatedFiles: updatedPathOrder.map((path) => updatedFileByPath.get(path)!),
  };

  return {
    meshState,
    plan,
  };
}

function assertRequestedTargetsAreWeaveable(
  targets: readonly NormalizedVersionTargetSpec[],
  weaveableKnops: readonly WeaveableKnopCandidate[],
): void {
  if (targets.length === 0) {
    return;
  }

  const weaveablePaths = new Set(
    weaveableKnops.map((candidate) => candidate.designatorPath),
  );
  // Exact and recursive targets intentionally differ here. An exact request is
  // asking for that designator itself to be versionable right now, while a
  // recursive request is allowed to succeed when any descendant in the
  // requested subtree is weaveable even if the subtree root is already settled.
  const missingTargets = targets.filter((target) =>
    target.recursive
      ? ![...weaveablePaths].some((designatorPath) =>
        target.designatorPath.length === 0 ||
        designatorPath === target.designatorPath ||
        designatorPath.startsWith(`${target.designatorPath}/`)
      )
      : !weaveablePaths.has(target.designatorPath)
  );
  if (missingTargets.length === 0) {
    return;
  }

  throw new WeaveInputError(
    `Requested targets are not currently weaveable: ${
      missingTargets.map((target) =>
        target.recursive
          ? `${
            formatDesignatorPathForDisplay(target.designatorPath)
          } (recursive)`
          : formatDesignatorPathForDisplay(target.designatorPath)
      ).join(", ")
    }.`,
  );
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

function resolveExecutionMeshRoot(
  options:
    | ExecuteValidateOptions
    | ExecuteVersionOptions
    | ExecuteGenerateOptions
    | ExecuteWeaveOptions,
): string {
  if (options.meshRoot.trim().length === 0) {
    throw new WeaveRuntimeError("mesh root is required");
  }
  return options.meshRoot;
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
  overlay?: ReadonlyMap<string, string>,
): Promise<MeshState> {
  const meshMetadataPath = join(workspaceRoot, "_mesh/_meta/meta.ttl");
  const meshInventoryPath = join(
    workspaceRoot,
    "_mesh/_inventory/inventory.ttl",
  );
  const meshConfigPath = join(workspaceRoot, "_mesh/_config/config.ttl");
  let meshMetadataTurtle: string;
  let currentMeshInventoryTurtle: string;
  let currentMeshConfigTurtle: string | undefined;

  try {
    [meshMetadataTurtle, currentMeshInventoryTurtle, currentMeshConfigTurtle] =
      await Promise.all([
        readTextFileWithOverlay(meshMetadataPath, overlay),
        readTextFileWithOverlay(meshInventoryPath, overlay),
        readOptionalTextFileWithOverlay(meshConfigPath, overlay),
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
    currentMeshMetadataTurtle: meshMetadataTurtle,
    currentMeshInventoryTurtle,
    ...(currentMeshConfigTurtle !== undefined
      ? { currentMeshConfigTurtle }
      : {}),
  };
}

async function loadWeaveableKnopCandidates(
  workspaceRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  meshBase: string,
  currentMeshInventoryTurtle: string,
  requestedDesignatorPaths: readonly string[],
  overlay?: ReadonlyMap<string, string>,
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

    const knopPath = toKnopPath(designatorPath);
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
          readTextFileWithOverlay(metadataPath, overlay),
          readTextFileWithOverlay(inventoryPath, overlay),
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
        localPathPolicy,
        meshBase,
        designatorPath,
        currentKnopInventoryTurtle,
        overlay,
      );
    }

    if (
      slice === "firstReferenceCatalogWeave" ||
      slice === "firstExtractedKnopWeave"
    ) {
      candidate.referenceCatalogArtifact =
        await loadReferenceCatalogWorkingArtifact(
          workspaceRoot,
          localPathPolicy,
          meshBase,
          designatorPath,
          currentKnopInventoryTurtle,
          overlay,
        );
    }

    if (slice === "pageDefinitionWeave") {
      candidate.resourcePageDefinitionArtifact =
        await loadResourcePageDefinitionArtifact(
          workspaceRoot,
          localPathPolicy,
          meshBase,
          designatorPath,
          currentKnopInventoryTurtle,
        );
    }

    if (slice === "firstExtractedKnopWeave") {
      candidate.referenceTargetSourcePayloadArtifact =
        await loadReferenceTargetSourcePayloadArtifact(
          workspaceRoot,
          localPathPolicy,
          meshBase,
          designatorPath,
          candidate.referenceCatalogArtifact,
          overlay,
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
  localPathPolicy: OperationalLocalPathPolicy,
  meshBase: string,
  designatorPath: string,
  currentKnopInventoryTurtle: string,
  overlay?: ReadonlyMap<string, string>,
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
  const workingLocalRelativePath = payloadArtifact.workingLocalRelativePath;
  const currentArtifactHistoryPath = payloadArtifact.currentArtifactHistoryPath;
  const latestHistoricalStatePath = payloadArtifact.currentArtifactHistoryExists
    ? payloadArtifact.latestHistoricalStatePath
    : undefined;
  const latestHistoricalSnapshotPath = latestHistoricalStatePath
    ? payloadArtifact.latestHistoricalSnapshotPath ??
      toPayloadHistoricalSnapshotPath(
        latestHistoricalStatePath,
        workingLocalRelativePath,
      )
    : undefined;
  const latestHistoricalSnapshotLocalPath = latestHistoricalSnapshotPath
    ? join(workspaceRoot, latestHistoricalSnapshotPath)
    : undefined;

  let currentPayloadTurtle: string;
  let latestHistoricalSnapshotTurtle: string | undefined;
  try {
    currentPayloadTurtle = await readTextFileWithOverlay(
      resolveAllowedLocalPath(
        localPathPolicy,
        "workingLocalRelativePath",
        workingLocalRelativePath,
      ),
      overlay,
    );
  } catch (error) {
    if (error instanceof LocalPathAccessError) {
      throw new WeaveRuntimeError(
        `Working payload file for ${designatorPath} is outside the allowed local-path boundary: ${workingLocalRelativePath}`,
      );
    }
    if (error instanceof Deno.errors.NotFound) {
      throw new WeaveRuntimeError(
        `Workspace is missing the working payload file for ${designatorPath}: ${workingLocalRelativePath}`,
      );
    }
    throw error;
  }

  if (latestHistoricalSnapshotLocalPath) {
    try {
      latestHistoricalSnapshotTurtle = await readTextFileWithOverlay(
        latestHistoricalSnapshotLocalPath,
        overlay,
      );
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        throw new WeaveRuntimeError(
          `Workspace is missing the latest payload historical snapshot for ${designatorPath}: ${latestHistoricalSnapshotPath}`,
        );
      }
      throw error;
    }
  }

  return {
    workingLocalRelativePath,
    currentPayloadTurtle,
    currentArtifactHistoryPath,
    ...(latestHistoricalSnapshotPath ? { latestHistoricalSnapshotPath } : {}),
    latestHistoricalSnapshotTurtle,
    latestHistoricalStatePath,
  };
}

async function loadReferenceTargetSourcePayloadArtifact(
  workspaceRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  meshBase: string,
  designatorPath: string,
  referenceCatalogArtifact: ReferenceCatalogWorkingArtifact | undefined,
  overlay?: ReadonlyMap<string, string>,
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
    `${toKnopPath(sourceDesignatorPath)}/_inventory/inventory.ttl`,
  );
  let sourceKnopInventoryTurtle: string;

  try {
    sourceKnopInventoryTurtle = await readTextFileWithOverlay(
      sourceKnopInventoryPath,
      overlay,
    );
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new WeaveRuntimeError(
        `Workspace is missing the woven source payload inventory for ${designatorPath}: ${
          toKnopPath(sourceDesignatorPath)
        }/_inventory/inventory.ttl`,
      );
    }
    throw error;
  }

  const sourcePayloadArtifact = await loadPayloadWorkingArtifact(
    workspaceRoot,
    localPathPolicy,
    meshBase,
    sourceDesignatorPath,
    sourceKnopInventoryTurtle,
    overlay,
  );
  if (!sourcePayloadArtifact?.latestHistoricalStatePath) {
    throw new WeaveRuntimeError(
      `Extracted weave source for ${designatorPath} is missing a woven current payload history: ${sourceDesignatorPath}`,
    );
  }

  return {
    designatorPath: sourceDesignatorPath,
    workingLocalRelativePath: sourcePayloadArtifact.workingLocalRelativePath,
    currentPayloadTurtle: sourcePayloadArtifact.currentPayloadTurtle,
    latestHistoricalStatePath: sourcePayloadArtifact.latestHistoricalStatePath,
  };
}

async function loadReferenceCatalogWorkingArtifact(
  _workspaceRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  meshBase: string,
  designatorPath: string,
  currentKnopInventoryTurtle: string,
  overlay?: ReadonlyMap<string, string>,
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
  const workingLocalRelativePath = referenceCatalog.workingLocalRelativePath;
  try {
    return {
      workingLocalRelativePath,
      currentReferenceCatalogTurtle: await readTextFileWithOverlay(
        resolveAllowedLocalPath(
          localPathPolicy,
          "workingLocalRelativePath",
          workingLocalRelativePath,
        ),
        overlay,
      ),
    };
  } catch (error) {
    if (error instanceof LocalPathAccessError) {
      throw new WeaveRuntimeError(
        `Working ReferenceCatalog file for ${designatorPath} is outside the allowed local-path boundary: ${workingLocalRelativePath}`,
      );
    }
    if (error instanceof Deno.errors.NotFound) {
      throw new WeaveRuntimeError(
        `Workspace is missing the working ReferenceCatalog file for ${designatorPath}: ${workingLocalRelativePath}`,
      );
    }
    throw error;
  }
}

async function loadResourcePageDefinitionArtifact(
  workspaceRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  meshBase: string,
  designatorPath: string,
  currentKnopInventoryTurtle: string,
): Promise<ResourcePageDefinitionWorkingArtifact | undefined> {
  const inventoryState = resolveResourcePageDefinitionInventoryState(
    meshBase,
    currentKnopInventoryTurtle,
    designatorPath,
    {
      parseErrorMessage:
        `Could not parse the current Knop inventory while resolving the ResourcePageDefinition for ${designatorPath}.`,
      missingWorkingFileMessage:
        `Could not resolve the working ResourcePageDefinition file for ${designatorPath}.`,
    },
  );

  try {
    return await loadResourcePageDefinitionWorkingArtifact(
      workspaceRoot,
      localPathPolicy,
      designatorPath,
      inventoryState,
    );
  } catch (error) {
    if (error instanceof ResourcePageDefinitionResolutionError) {
      throw new WeaveRuntimeError(error.message);
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

  if (slice === "pageDefinitionWeave") {
    return candidate.resourcePageDefinitionArtifact !== undefined &&
      (
        !candidate.resourcePageDefinitionArtifact
          .currentArtifactHistoryExists ||
        (
          candidate.resourcePageDefinitionArtifact
              .latestHistoricalSnapshotTurtle !==
            undefined &&
          candidate.resourcePageDefinitionArtifact
              .currentPageDefinitionTurtle !==
            candidate.resourcePageDefinitionArtifact
              .latestHistoricalSnapshotTurtle
        )
      );
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

function applyPlannedFilesToOverlay(
  workspaceRoot: string,
  overlay: TextFileOverlay,
  files: readonly PlannedFile[],
): void {
  for (const file of files) {
    overlay.set(join(workspaceRoot, file.path), file.contents);
  }
}

async function readTextFileWithOverlay(
  path: string,
  overlay?: ReadonlyMap<string, string>,
): Promise<string> {
  const stagedContents = overlay?.get(path);
  if (stagedContents !== undefined) {
    return stagedContents;
  }

  return await Deno.readTextFile(path);
}

async function readOptionalTextFileWithOverlay(
  path: string,
  overlay?: ReadonlyMap<string, string>,
): Promise<string | undefined> {
  try {
    return await readTextFileWithOverlay(path, overlay);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return undefined;
    }
    throw error;
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
  localPathPolicy: OperationalLocalPathPolicy,
  meshState: MeshState,
  selectedDesignatorPaths: readonly string[],
  includeAllMeshPages: boolean,
): Promise<readonly PlannedFile[]> {
  const pageModels: ResourcePageModel[] = [];
  const pagePaths = new Set<string>();
  const selectedSet = new Set(selectedDesignatorPaths);
  const designatorContexts = await loadGenerateDesignatorContexts(
    workspaceRoot,
    localPathPolicy,
    meshState,
    selectedDesignatorPaths,
  );
  const publicIdentifierPaths = new Map(
    designatorContexts.map((context) => [
      toDesignatorResourcePagePath(context.designatorPath),
      context,
    ]),
  );
  const meshRawSourcePanels = await collectMeshSupportRawSourcePanels(
    workspaceRoot,
    meshState,
  );
  const meshHistoryGroups = collectHistoryGroupsByResourcePath(
    meshState.meshBase,
    meshState.currentMeshInventoryTurtle,
    "Could not parse the current MeshInventory while collecting ResourcePage histories.",
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
    const resourcePath = toResourcePath(pagePath);
    if (publicContext) {
      if (publicContext.customIdentifierPage) {
        pageModels.push({
          kind: "customIdentifier",
          path: pagePath,
          designatorPath: publicContext.designatorPath,
          definitionPath: publicContext.customIdentifierPage.definitionPath,
          stylesheetPaths: publicContext.customIdentifierPage.stylesheetPaths,
          regions: publicContext.customIdentifierPage.regions,
        });
      } else {
        pageModels.push({
          kind: "identifier",
          path: pagePath,
          designatorPath: publicContext.designatorPath,
          workingLocalRelativePath:
            publicContext.payloadWorkingLocalRelativePath,
          historyGroups: publicContext.historyGroupsByResourcePath.get(
            resourcePath,
          ),
          rawSourcePanels: publicContext.rawSourcePanels.get(pagePath),
        });
      }
    } else {
      pageModels.push({
        kind: "simple",
        path: pagePath,
        description: `Generated resource page for ${toResourcePath(pagePath)}.`,
        historyGroups: meshHistoryGroups.get(resourcePath) ??
          findHistoryGroupsForResource(resourcePath, designatorContexts),
        rawSourcePanels: meshRawSourcePanels.get(pagePath) ??
          findRawSourcePanelsForPage(pagePath, designatorContexts),
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
        description: context.pageDescriptions.get(pagePath) ??
          `Generated resource page for ${toResourcePath(pagePath)}.`,
        historyGroups: context.historyGroupsByResourcePath.get(
          toResourcePath(pagePath),
        ),
        rawSourcePanels: context.rawSourcePanels.get(pagePath),
      });
      pagePaths.add(pagePath);
    }
  }

  return renderResourcePages(meshState.meshBase, pageModels);
}

async function loadGenerateDesignatorContexts(
  workspaceRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  meshState: MeshState,
  designatorPaths: readonly string[],
): Promise<readonly GenerateDesignatorContext[]> {
  const contexts: GenerateDesignatorContext[] = [];

  for (const designatorPath of designatorPaths) {
    const knopInventoryPath = join(
      workspaceRoot,
      `${toKnopPath(designatorPath)}/_inventory/inventory.ttl`,
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
    const pageDescriptions = new Map<string, string>();
    const rawSourcePanels = new Map<
      string,
      readonly ResourcePageRawSourcePanelModel[]
    >();
    const resourcePageDefinitionState =
      resolveResourcePageDefinitionInventoryState(
        meshState.meshBase,
        currentKnopInventoryTurtle,
        designatorPath,
        {
          parseErrorMessage:
            `Could not parse the current Knop inventory while resolving the ResourcePageDefinition for ${designatorPath}.`,
          missingWorkingFileMessage:
            `Could not resolve the working ResourcePageDefinition file for ${designatorPath}.`,
        },
      );
    let customIdentifierPage: CustomIdentifierPageModelInput | undefined;

    try {
      const resourcePageDefinitionArtifact =
        await loadResourcePageDefinitionWorkingArtifact(
          workspaceRoot,
          localPathPolicy,
          designatorPath,
          resourcePageDefinitionState,
        );
      customIdentifierPage = await loadActiveCustomIdentifierPage(
        workspaceRoot,
        localPathPolicy,
        meshState.meshBase,
        designatorPath,
        resourcePageDefinitionArtifact,
      );

      if (resourcePageDefinitionArtifact) {
        pageDescriptions.set(
          `${resourcePageDefinitionArtifact.artifactPath}/index.html`,
          describeResourcePageDefinitionArtifact(designatorPath),
        );
      }
    } catch (error) {
      if (error instanceof ResourcePageDefinitionResolutionError) {
        throw new WeaveRuntimeError(error.message);
      }
      throw error;
    }

    contexts.push({
      designatorPath,
      payloadWorkingLocalRelativePath: payloadArtifact
        ?.workingLocalRelativePath,
      customIdentifierPage,
      historyGroupsByResourcePath: collectHistoryGroupsByResourcePath(
        meshState.meshBase,
        currentKnopInventoryTurtle,
        `Could not parse the current Knop inventory while collecting ResourcePage histories for ${designatorPath}.`,
      ),
      pageDescriptions,
      rawSourcePanels,
      pagePaths: listResourcePagePaths(
        meshState.meshBase,
        currentKnopInventoryTurtle,
        `Could not parse the current Knop inventory while collecting ResourcePages for ${designatorPath}.`,
      ),
    });

    if (payloadArtifact) {
      await addPayloadRawSourcePanels(
        rawSourcePanels,
        workspaceRoot,
        localPathPolicy,
        designatorPath,
        payloadArtifact,
      );
    }
  }

  return contexts;
}

async function collectMeshSupportRawSourcePanels(
  workspaceRoot: string,
  meshState: MeshState,
): Promise<ReadonlyMap<string, readonly ResourcePageRawSourcePanelModel[]>> {
  const rawSourcePanels = new Map<
    string,
    readonly ResourcePageRawSourcePanelModel[]
  >();

  addRawSourcePanel(rawSourcePanels, "_mesh/_inventory/index.html", {
    label: "Current MeshInventory RDF bytes",
    sourcePath: "_mesh/_inventory/inventory.ttl",
    contents: meshState.currentMeshInventoryTurtle,
  });

  for (
    const support of [
      {
        pagePath: "_mesh/_meta/index.html",
        sourcePath: "_mesh/_meta/meta.ttl",
        label: "Current MeshMetadata RDF bytes",
      },
      {
        pagePath: "_mesh/_config/index.html",
        sourcePath: "_mesh/_config/config.ttl",
        label: "Current MeshConfig RDF bytes",
      },
    ]
  ) {
    try {
      addRawSourcePanel(
        rawSourcePanels,
        support.pagePath,
        await readRawSourcePanel(
          join(workspaceRoot, support.sourcePath),
          support.sourcePath,
          support.label,
        ),
      );
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        continue;
      }
      throw error;
    }
  }

  return rawSourcePanels;
}

function findRawSourcePanelsForPage(
  pagePath: string,
  contexts: readonly GenerateDesignatorContext[],
): readonly ResourcePageRawSourcePanelModel[] | undefined {
  for (const context of contexts) {
    const panels = context.rawSourcePanels.get(pagePath);
    if (panels) {
      return panels;
    }
  }
  return undefined;
}

function findHistoryGroupsForResource(
  resourcePath: string,
  contexts: readonly GenerateDesignatorContext[],
): readonly ResourcePageHistoryGroupModel[] | undefined {
  for (const context of contexts) {
    const historyGroups = context.historyGroupsByResourcePath.get(
      resourcePath,
    );
    if (historyGroups) {
      return historyGroups;
    }
  }
  return undefined;
}

async function addPayloadRawSourcePanels(
  rawSourcePanels: Map<string, readonly ResourcePageRawSourcePanelModel[]>,
  workspaceRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  designatorPath: string,
  payloadArtifact: {
    workingLocalRelativePath: string;
    latestHistoricalStatePath?: string;
    latestHistoricalSnapshotPath?: string;
  },
): Promise<void> {
  try {
    const currentPanel = await readRawSourcePanel(
      resolveAllowedLocalPath(
        localPathPolicy,
        "workingLocalRelativePath",
        payloadArtifact.workingLocalRelativePath,
      ),
      payloadArtifact.workingLocalRelativePath,
      "Current working RDF bytes",
    );
    addRawSourcePanel(
      rawSourcePanels,
      toDesignatorResourcePagePath(designatorPath),
      currentPanel,
    );
  } catch (error) {
    if (
      error instanceof Deno.errors.NotFound ||
      error instanceof LocalPathAccessError
    ) {
      return;
    }
    throw error;
  }

  if (!payloadArtifact.latestHistoricalStatePath) {
    return;
  }

  const snapshotPath = payloadArtifact.latestHistoricalSnapshotPath ??
    toPayloadHistoricalSnapshotPath(
      payloadArtifact.latestHistoricalStatePath,
      payloadArtifact.workingLocalRelativePath,
    );
  const snapshotAbsolutePath = join(workspaceRoot, snapshotPath);

  try {
    const historicalPanel = await readRawSourcePanel(
      snapshotAbsolutePath,
      snapshotPath,
      "Historical manifestation RDF bytes",
    );
    addRawSourcePanel(
      rawSourcePanels,
      `${dirname(snapshotPath)}/index.html`,
      historicalPanel,
    );
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return;
    }
    throw error;
  }
}

async function readRawSourcePanel(
  absolutePath: string,
  sourcePath: string,
  label: string,
): Promise<ResourcePageRawSourcePanelModel> {
  const info = await Deno.stat(absolutePath);
  if (info.size > RAW_SOURCE_INLINE_BYTE_LIMIT) {
    return {
      label,
      sourcePath,
      omittedByteLength: info.size,
    };
  }

  return {
    label,
    sourcePath,
    contents: await Deno.readTextFile(absolutePath),
  };
}

function addRawSourcePanel(
  rawSourcePanels: Map<string, readonly ResourcePageRawSourcePanelModel[]>,
  pagePath: string,
  panel: ResourcePageRawSourcePanelModel,
): void {
  rawSourcePanels.set(pagePath, [
    ...(rawSourcePanels.get(pagePath) ?? []),
    panel,
  ]);
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
    if (pagePath === undefined) {
      continue;
    }
    if (pagePath !== "index.html" && !pagePath.endsWith("/index.html")) {
      continue;
    }

    paths.add(pagePath);
  }

  return [...paths].sort((left, right) => left.localeCompare(right));
}

function collectHistoryGroupsByResourcePath(
  meshBase: string,
  inventoryTurtle: string,
  parseErrorMessage: string,
): ReadonlyMap<string, readonly ResourcePageHistoryGroupModel[]> {
  const quads = parseInventoryQuads(
    meshBase,
    inventoryTurtle,
    parseErrorMessage,
  );
  const groupsByResourcePath = new Map<
    string,
    ResourcePageHistoryGroupModel[]
  >();

  for (const quad of quads) {
    if (
      quad.subject.termType !== "NamedNode" ||
      quad.predicate.value !== SFLO_CURRENT_ARTIFACT_HISTORY_IRI ||
      quad.object.termType !== "NamedNode"
    ) {
      continue;
    }

    const artifactPath = toMeshPath(meshBase, quad.subject.value);
    const historyPath = toMeshPath(meshBase, quad.object.value);
    if (!artifactPath || !historyPath) {
      continue;
    }

    addHistoryGroup(
      groupsByResourcePath,
      artifactPath,
      resolveArtifactHistoryGroup(meshBase, quads, historyPath),
    );
  }

  for (const quad of quads) {
    if (
      quad.subject.termType !== "NamedNode" ||
      quad.predicate.value !== SFLO_HAS_HISTORICAL_STATE_IRI ||
      quad.object.termType !== "NamedNode"
    ) {
      continue;
    }

    const historyPath = toMeshPath(meshBase, quad.subject.value);
    if (!historyPath) {
      continue;
    }

    addHistoryGroup(
      groupsByResourcePath,
      historyPath,
      resolveArtifactHistoryGroup(meshBase, quads, historyPath),
    );
  }

  return groupsByResourcePath;
}

function addHistoryGroup(
  groupsByResourcePath: Map<string, ResourcePageHistoryGroupModel[]>,
  resourcePath: string,
  historyGroup: ResourcePageHistoryGroupModel,
): void {
  const existingGroups = groupsByResourcePath.get(resourcePath) ?? [];
  if (existingGroups.some((group) => group.path === historyGroup.path)) {
    return;
  }
  groupsByResourcePath.set(resourcePath, [...existingGroups, historyGroup]);
}

function resolveArtifactHistoryGroup(
  meshBase: string,
  quads: readonly Quad[],
  historyPath: string,
): ResourcePageHistoryGroupModel {
  const historyIri = new URL(historyPath, meshBase).href;
  const statePaths = new Set<string>();

  for (const quad of quads) {
    if (
      quad.subject.termType === "NamedNode" &&
      quad.subject.value === historyIri &&
      quad.predicate.value === SFLO_HAS_HISTORICAL_STATE_IRI &&
      quad.object.termType === "NamedNode"
    ) {
      const statePath = toMeshPath(meshBase, quad.object.value);
      if (statePath) {
        statePaths.add(statePath);
      }
    }
  }

  return {
    label: "Artifact history",
    path: historyPath,
    states: [...statePaths].sort((left, right) => left.localeCompare(right))
      .map((statePath) =>
        resolveHistoricalStateModel(meshBase, quads, statePath)
      ),
  };
}

function resolveHistoricalStateModel(
  meshBase: string,
  quads: readonly Quad[],
  statePath: string,
): {
  path: string;
  manifestationPath?: string;
  locatedFilePath?: string;
} {
  const stateIri = new URL(statePath, meshBase).href;
  const shortcutLocatedFilePath = resolveFirstMeshPathObject(
    meshBase,
    quads,
    stateIri,
    SFLO_LOCATED_FILE_FOR_STATE_IRI,
  );
  const manifestationPath = resolveFirstMeshPathObject(
    meshBase,
    quads,
    stateIri,
    SFLO_HAS_MANIFESTATION_IRI,
  );
  const manifestationLocatedFilePath = manifestationPath
    ? resolveFirstMeshPathObject(
      meshBase,
      quads,
      new URL(manifestationPath, meshBase).href,
      SFLO_HAS_LOCATED_FILE_IRI,
    )
    : undefined;

  return {
    path: statePath,
    ...(manifestationPath ? { manifestationPath } : {}),
    ...((shortcutLocatedFilePath ?? manifestationLocatedFilePath)
      ? {
        locatedFilePath: shortcutLocatedFilePath ??
          manifestationLocatedFilePath,
      }
      : {}),
  };
}

function resolveFirstMeshPathObject(
  meshBase: string,
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
): string | undefined {
  for (const quad of quads) {
    if (
      quad.subject.termType !== "NamedNode" ||
      quad.subject.value !== subjectIri ||
      quad.predicate.value !== predicateIri ||
      quad.object.termType !== "NamedNode"
    ) {
      continue;
    }

    const meshPath = toMeshPath(meshBase, quad.object.value);
    if (meshPath) {
      return meshPath;
    }
  }
  return undefined;
}

function toMeshPath(meshBase: string, iri: string): string | undefined {
  const meshUrl = new URL(meshBase);
  const iriUrl = new URL(iri);
  if (iriUrl.origin !== meshUrl.origin) {
    return undefined;
  }
  const basePath = meshUrl.pathname.endsWith("/")
    ? meshUrl.pathname
    : `${meshUrl.pathname}/`;
  if (!iriUrl.pathname.startsWith(basePath)) {
    return undefined;
  }
  return decodeURIComponent(iriUrl.pathname.slice(basePath.length));
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
  if (pagePath === "index.html") {
    return "";
  }
  return pagePath.endsWith("/index.html")
    ? pagePath.slice(0, -"/index.html".length)
    : pagePath;
}

function toPayloadHistoricalSnapshotPath(
  historyStatePath: string,
  workingLocalRelativePath: string,
): string {
  const fileName = toFileName(workingLocalRelativePath);
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
