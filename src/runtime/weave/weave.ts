import { dirname, join, relative } from "@std/path";
import { Parser, type Quad } from "n3";
import {
  formatDesignatorPathForDisplay,
  toDesignatorResourcePagePath,
  toKnopPath,
  toReferenceCatalogPath,
} from "../../core/designator_segments.ts";
import type { PlannedFile } from "../../core/planned_file.ts";
import {
  type NormalizedTargetSpec,
  type NormalizedVersionTargetSpec,
  normalizeTargetSpecs,
  normalizeVersionTargetSpecs,
  resolveTargetSelections,
  type TargetSpec,
} from "../../core/targeting.ts";
import {
  detectPendingWeaveSlice,
  type GenerateRequest,
  type KnopArtifactLinkModel,
  type PayloadWorkingArtifact,
  planMeshSupportResourcePages,
  planVersion,
  type ReferenceCatalogWorkingArtifact,
  type RepositorySourceFloatingLocator,
  type ResourcePageChildIdentifierModel,
  type ResourcePageDefinitionWorkingArtifact,
  type ResourcePageExtractionSourceModel,
  type ResourcePageHistoryGroupModel,
  type ResourcePageModel,
  type ResourcePageRawSourcePanelModel,
  type ResourcePageReferenceLinkModel,
  type ResourcePageReferenceTargetModel,
  type ValidateRequest,
  type VersionPlan,
  type VersionRequest,
  type WeaveableKnopCandidate,
  WeaveInputError,
  type WeaveNamingPolicies,
  type WeaveRequest,
  type WeaveResourcePageGenerationPolicies,
  type WeaveSlice,
  type WeaveSupportHistoryPolicies,
} from "../../core/weave/weave.ts";
import {
  listKnopDesignatorPaths,
  resolveExtractionSourceInventoryState,
  resolveHistoricalStateLocatedFilePath,
  resolveKnopSourceRegistryInventoryState,
  resolvePayloadArtifactInventoryState,
  resolveReferenceCatalogInventoryState,
  resolveResourcePageDefinitionInventoryState,
} from "../mesh/inventory.ts";
import {
  loadOperationalLocalPathPolicy,
  LocalPathAccessError,
  type OperationalLocalPathPolicy,
  resolveAllowedLocalPath,
  resolveRepositorySourceFloatingLocalPath,
} from "../operational/local_path_policy.ts";
import { createRuntimeTiming, type RuntimeTiming } from "../timing.ts";
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
import { SFLO_NAMESPACE } from "../../core/rdf/namespaces.ts";
import {
  type ArtifactRole,
  type EffectiveConfig,
  EffectiveConfig as EffectiveConfigValue,
  type HistoryTrackingPolicy,
  loadWeaveDefaultEffectiveConfig,
} from "../config/effective_config.ts";
import {
  listGeneratedResourcePagePaths,
  type ListGeneratedResourcePagePathsInput,
  ResourcePagePolicyError,
} from "./resource_page_policy.ts";
import { validatePublicationPreset } from "../publication/presets.ts";

const SFLO_HAS_ARTIFACT_HISTORY_IRI = `${SFLO_NAMESPACE}hasArtifactHistory`;
const SFLO_ARTIFACT_HISTORY_IRI = `${SFLO_NAMESPACE}ArtifactHistory`;
const SFLO_CURRENT_ARTIFACT_HISTORY_IRI =
  `${SFLO_NAMESPACE}currentArtifactHistory`;
const SFLO_HAS_HISTORICAL_STATE_IRI = `${SFLO_NAMESPACE}hasHistoricalState`;
const SFLO_LATEST_HISTORICAL_STATE_IRI =
  `${SFLO_NAMESPACE}latestHistoricalState`;
const SFLO_HAS_MANIFESTATION_IRI = `${SFLO_NAMESPACE}hasManifestation`;
const SFLO_LOCATED_FILE_FOR_MANIFESTATION_IRI =
  `${SFLO_NAMESPACE}locatedFileForManifestation`;
const SFLO_LOCATED_FILE_FOR_STATE_IRI = `${SFLO_NAMESPACE}locatedFileForState`;
const SFLO_HISTORY_ORDINAL_IRI = `${SFLO_NAMESPACE}historyOrdinal`;
const SFLO_STATE_ORDINAL_IRI = `${SFLO_NAMESPACE}stateOrdinal`;
const SFLO_HAS_KNOP_METADATA_IRI = `${SFLO_NAMESPACE}hasKnopMetadata`;
const SFLO_HAS_KNOP_INVENTORY_IRI = `${SFLO_NAMESPACE}hasKnopInventory`;
const SFLO_HAS_PAYLOAD_ARTIFACT_IRI = `${SFLO_NAMESPACE}hasPayloadArtifact`;
const SFLO_HAS_REFERENCE_CATALOG_IRI = `${SFLO_NAMESPACE}hasReferenceCatalog`;
const SFLO_HAS_REFERENCE_LINK_IRI = `${SFLO_NAMESPACE}hasReferenceLink`;
const SFLO_HAS_REFERENCE_ROLE_IRI = `${SFLO_NAMESPACE}hasReferenceRole`;
const SFLO_HAS_EXTRACTION_SOURCE_IRI = `${SFLO_NAMESPACE}hasExtractionSource`;
const SFLO_HAS_WORKING_LOCATED_FILE_IRI =
  `${SFLO_NAMESPACE}hasWorkingLocatedFile`;
const SFLO_WORKING_FILE_PATH_IRI = `${SFLO_NAMESPACE}workingLocalRelativePath`;
const SFLO_REFERENCE_LINK_FOR_IRI = `${SFLO_NAMESPACE}referenceLinkFor`;
const SFLO_REFERENCE_LINK_IRI = `${SFLO_NAMESPACE}ReferenceLink`;
const SFLO_REFERENCE_ROLE_CANONICAL_IRI =
  `${SFLO_NAMESPACE}referenceRole_canonical`;
const SFLO_REFERENCE_TARGET_IRI = `${SFLO_NAMESPACE}referenceTarget`;
const SFLO_REFERENCE_TARGET_STATE_IRI = `${SFLO_NAMESPACE}referenceTargetState`;
const SFLO_REFERENCE_URI_LITERAL_IRI = `${SFLO_NAMESPACE}referenceUriLiteral`;
const SFLO_HAS_RESOURCE_PAGE_DEFINITION_IRI =
  `${SFLO_NAMESPACE}hasResourcePageDefinition`;
const SFLO_HAS_KNOP_ASSET_BUNDLE_IRI = `${SFLO_NAMESPACE}hasKnopAssetBundle`;
const SFLO_ARTIFACT_RESOLUTION_MODE_WORKING_IRI =
  `${SFLO_NAMESPACE}artifactResolutionMode_working`;
const SFLO_ARTIFACT_RESOLUTION_MODE_LATEST_STATE_IRI =
  `${SFLO_NAMESPACE}artifactResolutionMode_latestState`;
const RDF_TYPE_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const DCTERMS_TITLE_IRI = "http://purl.org/dc/terms/title";

export interface ExecuteValidateOptions {
  meshRoot: string;
  request?: ValidateRequest;
  scope?: ValidateScope;
}

export interface ExecuteVersionOptions {
  meshRoot: string;
  request?: VersionRequest;
  historyTrackingPolicyOverride?: HistoryTrackingPolicy;
  onProgress?: WeaveProgressHandler;
}

export interface ExecuteGenerateOptions {
  meshRoot: string;
  request?: GenerateRequest;
  now?: () => Date;
  includeSemanticFlowMetadata?: boolean;
  historyTrackingPolicyOverride?: HistoryTrackingPolicy;
}

export interface ExecuteWeaveOptions {
  meshRoot: string;
  request?: WeaveRequest;
  operationalLogger?: StructuredLogger;
  auditLogger?: AuditLogger;
  now?: () => Date;
  historyTrackingPolicyOverride?: HistoryTrackingPolicy;
  onProgress?: WeaveProgressHandler;
  validateBefore?: boolean;
  validateAfter?: boolean;
}

export interface WeaveProgressEvent {
  designatorPath: string;
  completed: number;
  total: number;
  percent: number;
}

export type WeaveProgressHandler = (event: WeaveProgressEvent) => void;
export type ValidateScope = "mesh" | "publication";

export interface ValidateFinding {
  severity: "error";
  message: string;
}

export interface ValidateResult {
  scope: ValidateScope;
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

class TextFileOverlay extends Map<string, string> {
  #readCache = new Map<string, string>();
  #candidateCache = new Map<string, CandidateCacheEntry>();
  #activeCandidateCapture: CandidateDependencyCapture | undefined;
  readCount = 0;
  cacheHitCount = 0;
  stagedHitCount = 0;
  candidateCacheHitCount = 0;
  candidateCacheStoreCount = 0;
  candidateCacheInvalidationCount = 0;

  async readTextFile(path: string): Promise<string> {
    this.#activeCandidateCapture?.dependencyPaths.add(path);
    const stagedContents = this.get(path);
    if (stagedContents !== undefined) {
      this.stagedHitCount += 1;
      return stagedContents;
    }

    const cachedContents = this.#readCache.get(path);
    if (cachedContents !== undefined) {
      this.cacheHitCount += 1;
      return cachedContents;
    }

    const contents = await Deno.readTextFile(path);
    this.#readCache.set(path, contents);
    this.readCount += 1;
    return contents;
  }

  async loadCandidate(
    designatorPath: string,
    loader: () => Promise<WeaveableKnopCandidate | undefined>,
  ): Promise<WeaveableKnopCandidate | undefined> {
    const cached = this.#candidateCache.get(designatorPath);
    if (cached !== undefined) {
      this.candidateCacheHitCount += 1;
      return cached.candidate;
    }

    const previousCapture = this.#activeCandidateCapture;
    const capture: CandidateDependencyCapture = {
      dependencyPaths: new Set(),
    };
    this.#activeCandidateCapture = capture;
    try {
      const candidate = await loader();
      this.#candidateCache.set(designatorPath, {
        candidate,
        dependencyPaths: capture.dependencyPaths,
      });
      this.candidateCacheStoreCount += 1;
      return candidate;
    } finally {
      this.#activeCandidateCapture = previousCapture;
    }
  }

  stagePlannedFiles(
    workspaceRoot: string,
    files: readonly PlannedFile[],
  ): void {
    const stagedPaths = files.map((file) => join(workspaceRoot, file.path));
    for (
      const [file, absolutePath] of files.map((file, index) =>
        [file, stagedPaths[index]!] as const
      )
    ) {
      this.set(absolutePath, file.contents);
    }
    this.#invalidateCandidates(stagedPaths);
  }

  #invalidateCandidates(stagedPaths: readonly string[]): void {
    if (stagedPaths.length === 0 || this.#candidateCache.size === 0) {
      return;
    }

    for (const [designatorPath, entry] of this.#candidateCache) {
      if (
        stagedPaths.some((stagedPath) => entry.dependencyPaths.has(stagedPath))
      ) {
        this.#candidateCache.delete(designatorPath);
        this.candidateCacheInvalidationCount += 1;
      }
    }
  }
}

interface CandidateDependencyCapture {
  dependencyPaths: Set<string>;
}

interface CandidateCacheEntry {
  candidate: WeaveableKnopCandidate | undefined;
  dependencyPaths: ReadonlySet<string>;
}

interface GenerateDesignatorContext {
  designatorPath: string;
  payloadWorkingLocalRelativePath?: string;
  payloadWorkingAccessUrl?: string;
  payloadRepositorySourceFloatingLocator?: RepositorySourceFloatingLocator;
  extractionSource?: ResourcePageExtractionSourceModel;
  references: readonly ResourcePageReferenceLinkModel[];
  governedArtifacts: readonly KnopArtifactLinkModel[];
  supportingArtifacts: readonly KnopArtifactLinkModel[];
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

interface ParsedResourceReferenceLink {
  roleIris: readonly string[];
  model: ResourcePageReferenceLinkModel;
  referenceTargetPaths: readonly string[];
  referenceTargetStatePaths: readonly string[];
}

const RAW_SOURCE_INLINE_BYTE_LIMIT = 1024 * 1024;
const ALL_ARTIFACT_ROLES: readonly ArtifactRole[] = [
  "payload",
  "meshInventory",
  "knopInventory",
  "meshMetadata",
  "knopMetadata",
  "config",
  "referenceCatalog",
  "resourcePageDefinition",
  "resourcePageTemplate",
  "resourcePageStylesheet",
  "runtimeMeta",
];

export async function executeValidate(
  options: ExecuteValidateOptions,
): Promise<ValidateResult> {
  const scope = options.scope ?? "mesh";
  const timing = createRuntimeTiming(`validate.${scope}`);
  let status = "succeeded";
  try {
    if (scope === "publication") {
      const meshRoot = resolveExecutionMeshRoot(options);
      await timing.time(
        "ensureWorkspaceRoot",
        () => ensureWorkspaceRootExists(meshRoot),
      );
      const meshState = await timing.time(
        "loadMeshState",
        () => loadMeshState(meshRoot),
      );
      const publicationValidation = await timing.time(
        "validatePublicationPreset",
        () =>
          validatePublicationPreset({
            meshRoot,
            currentMeshConfigTurtle: meshState.currentMeshConfigTurtle,
          }),
      );
      status = publicationValidation.findings.length > 0
        ? "findings"
        : "succeeded";
      timing.setField("findings", publicationValidation.findings.length);

      return {
        scope,
        meshBase: meshState.meshBase,
        validatedDesignatorPaths: [],
        findings: publicationValidation.findings,
      };
    }

    const targets = normalizeValidateRequest(options.request);
    const meshRoot = resolveExecutionMeshRoot(options);
    const localPathPolicy = await timing.time(
      "loadOperationalLocalPathPolicy",
      () => loadOperationalLocalPathPolicy(meshRoot),
    );
    const prepared = await prepareVersionExecution(
      meshRoot,
      toNormalizedVersionTargets(targets),
      localPathPolicy,
      undefined,
      undefined,
      timing,
    );
    timing.timeSync("validateRdf", () =>
      validateRdfFiles([
        ...prepared.plan.createdFiles,
        ...prepared.plan.updatedFiles,
      ]));
    const publicationValidation = await timing.time(
      "validatePublicationPreset",
      () =>
        validatePublicationPreset({
          meshRoot,
          currentMeshConfigTurtle: prepared.meshState.currentMeshConfigTurtle,
        }),
    );
    status = publicationValidation.findings.length > 0
      ? "findings"
      : "succeeded";
    timing.setField(
      "validatedDesignatorPaths",
      prepared.plan.versionedDesignatorPaths.length,
    );
    timing.setField("createdFiles", prepared.plan.createdFiles.length);
    timing.setField("updatedFiles", prepared.plan.updatedFiles.length);
    timing.setField("findings", publicationValidation.findings.length);

    return {
      scope,
      meshBase: prepared.meshState.meshBase,
      validatedDesignatorPaths: prepared.plan.versionedDesignatorPaths,
      findings: publicationValidation.findings,
    };
  } catch (error) {
    if (
      error instanceof WeaveInputError || error instanceof WeaveRuntimeError
    ) {
      status = "failed";
      timing.setField("findings", 1);
      return {
        scope,
        validatedDesignatorPaths: [],
        findings: [{
          severity: "error",
          message: error.message,
        }],
      };
    }
    throw error;
  } finally {
    timing.finish({ status });
  }
}

export async function executeVersion(
  options: ExecuteVersionOptions,
): Promise<VersionResult> {
  const timing = createRuntimeTiming("version");
  let status = "succeeded";
  try {
    const targets = timing.timeSync(
      "normalizeRequest",
      () => normalizeVersionRequest(options.request),
    );
    const meshRoot = resolveExecutionMeshRoot(options);
    const localPathPolicy = await timing.time(
      "loadOperationalLocalPathPolicy",
      () => loadOperationalLocalPathPolicy(meshRoot),
    );
    const prepared = await prepareVersionExecution(
      meshRoot,
      targets,
      localPathPolicy,
      options.historyTrackingPolicyOverride,
      options.onProgress,
      timing,
    );
    const result = await writePreparedVersion(
      meshRoot,
      localPathPolicy,
      prepared,
      {
        validateRdf: true,
        timing,
        phasePrefix: "write",
      },
    );
    timing.setField(
      "versionedDesignatorPaths",
      result.versionedDesignatorPaths.length,
    );
    timing.setField("createdFiles", result.createdPaths.length);
    timing.setField("updatedFiles", result.updatedPaths.length);
    return result;
  } catch (error) {
    status = "failed";
    throw error;
  } finally {
    timing.finish({ status });
  }
}

async function writePreparedVersion(
  meshRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  prepared: PreparedVersionExecution,
  options: {
    validateRdf: boolean;
    timing?: RuntimeTiming;
    phasePrefix?: string;
  },
): Promise<VersionResult> {
  const phasePrefix = options.phasePrefix ?? "write";
  const timing = options.timing;
  timeOptionalSync(
    timing,
    `${phasePrefix}.assertUpdatedTargetsExist`,
    () => assertUpdatedTargetsExist(meshRoot, prepared.plan.updatedFiles),
  );
  await timeOptional(
    timing,
    `${phasePrefix}.assertCreateTargetsDoNotExist`,
    () =>
      assertCreateTargetsDoNotExist(
        meshRoot,
        prepared.plan.createdFiles,
      ),
  );
  if (options.validateRdf) {
    timeOptionalSync(
      timing,
      `${phasePrefix}.validateRdf`,
      () => validateVersionPlanRdf(prepared.plan),
    );
  }
  await timeOptional(
    timing,
    `${phasePrefix}.createdFiles`,
    () => writeFiles(meshRoot, prepared.plan.createdFiles, true),
  );
  await timeOptional(
    timing,
    `${phasePrefix}.updatedFiles`,
    () => writeFiles(meshRoot, prepared.plan.updatedFiles, false),
  );

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

function validateVersionPlanRdf(plan: VersionPlan): void {
  validateRdfFiles([
    ...plan.createdFiles,
    ...plan.updatedFiles,
  ]);
}

export async function executeGenerate(
  options: ExecuteGenerateOptions,
): Promise<GenerateResult> {
  const timing = createRuntimeTiming("generate");
  let status = "succeeded";
  try {
    const targets = timing.timeSync(
      "normalizeRequest",
      () => normalizeGenerateRequest(options.request),
    );
    const meshRoot = resolveExecutionMeshRoot(options);
    await timing.time(
      "ensureWorkspaceRoot",
      () => ensureWorkspaceRootExists(meshRoot),
    );
    const localPathPolicy = await timing.time(
      "loadOperationalLocalPathPolicy",
      () => loadOperationalLocalPathPolicy(meshRoot),
    );
    const meshState = await timing.time(
      "loadMeshState",
      () => loadMeshState(meshRoot),
    );
    const effectiveConfig = await timing.time(
      "loadEffectiveConfig",
      () =>
        loadEffectiveConfigForExecution(
          options.historyTrackingPolicyOverride,
        ),
    );
    const allDesignatorPaths = timing.timeSync(
      "listDesignatorPaths",
      () =>
        listKnopDesignatorPaths(
          meshState.meshBase,
          meshState.currentMeshInventoryTurtle,
          "Could not parse the current MeshInventory while resolving generate targets.",
        ),
    );
    const selectedDesignatorPaths = timing.timeSync(
      "resolveTargets",
      () =>
        resolveSelectedDesignatorPaths(
          allDesignatorPaths,
          targets,
        ),
    );
    const pageFiles = await timing.time(
      "collectGeneratedPageFiles",
      () =>
        collectGeneratedPageFiles(
          meshRoot,
          localPathPolicy,
          meshState,
          selectedDesignatorPaths,
          targets.length === 0,
          targets.length > 0,
          effectiveConfig,
          resolveGeneratedAt(options.now),
          options.includeSemanticFlowMetadata ?? false,
        ),
    );
    const writeResult = await timing.time(
      "writePages",
      () => writeFilesUpsert(meshRoot, pageFiles),
    );

    const result = {
      meshBase: meshState.meshBase,
      generatedDesignatorPaths: selectedDesignatorPaths,
      createdPaths: writeResult.createdPaths.map((path) =>
        toWorkspaceRelativePath(localPathPolicy, path)
      ),
      updatedPaths: writeResult.updatedPaths.map((path) =>
        toWorkspaceRelativePath(localPathPolicy, path)
      ),
    };
    timing.setField(
      "generatedDesignatorPaths",
      result.generatedDesignatorPaths.length,
    );
    timing.setField("createdFiles", result.createdPaths.length);
    timing.setField("updatedFiles", result.updatedPaths.length);
    return result;
  } catch (error) {
    status = "failed";
    throw error;
  } finally {
    timing.finish({ status });
  }
}

export async function executeWeave(
  options: ExecuteWeaveOptions,
): Promise<WeaveResult> {
  const timing = createRuntimeTiming("weave");
  let status = "succeeded";
  const { operationalLogger, auditLogger } = resolveLoggers(options);
  const meshRoot = resolveExecutionMeshRoot(options);
  const initialPolicy = await timing.time(
    "loadOperationalLocalPathPolicy",
    () => loadOperationalLocalPathPolicy(meshRoot),
  );
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
    if (options.validateBefore) {
      const validation = await timing.time(
        "validateBefore",
        () =>
          executeValidate({
            meshRoot,
            scope: "mesh",
          }),
      );
      assertValidationPassed(validation, "before weaving");
    }

    const targets = normalizeVersionRequest(options.request);
    let preparedVersion: PreparedVersionExecution;
    try {
      preparedVersion = await prepareVersionExecution(
        meshRoot,
        targets,
        initialPolicy,
        options.historyTrackingPolicyOverride,
        options.onProgress,
        timing,
      );
      timing.timeSync(
        "version.validateRdf",
        () => validateVersionPlanRdf(preparedVersion.plan),
      );
    } catch (error) {
      if (error instanceof WeaveRuntimeError) {
        throw new WeaveInputError(error.message);
      }
      throw error;
    }

    const versionResult = await writePreparedVersion(
      meshRoot,
      initialPolicy,
      preparedVersion,
      { validateRdf: false, timing, phasePrefix: "version.write" },
    );
    wovenDesignatorPaths = versionResult.versionedDesignatorPaths;

    const generateResult = await timing.time("generate", () =>
      executeGenerate({
        meshRoot,
        request: toSharedTargetRequest(options.request),
        now: options.now,
        historyTrackingPolicyOverride: options.historyTrackingPolicyOverride,
      }));

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

    if (options.validateAfter) {
      const validation = await timing.time(
        "validateAfter",
        () =>
          executeValidate({
            meshRoot,
            scope: "mesh",
          }),
      );
      assertValidationPassed(validation, "after weaving");
    }

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

    timing.setField(
      "wovenDesignatorPaths",
      result.wovenDesignatorPaths.length,
    );
    timing.setField("createdFiles", result.createdPaths.length);
    timing.setField("updatedFiles", result.updatedPaths.length);
    return result;
  } catch (error) {
    status = "failed";
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
  } finally {
    timing.finish({ status });
  }
}

export function describeWeaveResult(result: WeaveResult): string {
  return `Wove ${result.wovenDesignatorPaths.length} designator path and created ${result.createdPaths.length} files while updating ${result.updatedPaths.length} working artifacts.`;
}

export function describeValidateResult(result: ValidateResult): string {
  if (result.scope === "publication") {
    const findingLabel = result.findings.length === 1 ? "issue" : "issues";
    return `Validated publication surface and found ${result.findings.length} ${findingLabel}.`;
  }

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

function assertValidationPassed(
  result: ValidateResult,
  phaseLabel: string,
): void {
  if (result.findings.length === 0) {
    return;
  }

  throw new WeaveInputError(
    `Whole-mesh validation ${phaseLabel} failed:\n${result.findings.map((finding) =>
      `${finding.severity}: ${finding.message}`
    ).join("\n")
    }`,
  );
}

async function loadEffectiveConfigForExecution(
  historyTrackingPolicyOverride?: HistoryTrackingPolicy,
): Promise<EffectiveConfig> {
  const effectiveConfig = await loadWeaveDefaultEffectiveConfig();
  if (historyTrackingPolicyOverride === undefined) {
    return effectiveConfig;
  }

  return new EffectiveConfigValue({
    sources: effectiveConfig.sources,
    configResolution: effectiveConfig.configResolution,
    namingPolicies: effectiveConfig.namingPolicies,
    resourcePageRegenerationConfigPolicy: effectiveConfig
      .resourcePageRegenerationConfigPolicy,
    defaultHistoryTrackingPolicy: historyTrackingPolicyOverride,
    historyTrackingByRole: new Map(
      ALL_ARTIFACT_ROLES.map((role) => [
        role,
        historyTrackingPolicyOverride,
      ]),
    ),
    defaultResourcePageGenerationPolicy: "generate",
    resourcePageGenerationByRole: new Map(
      ALL_ARTIFACT_ROLES.map((role) => [
        role,
        effectiveConfig.resourcePageGenerationPolicyForArtifactRole(role),
      ]),
    ),
  });
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
    targets: uniqueGenerateTargets(normalizedTargets.flatMap((target) => [
      ...toAncestorGenerateTargets(target.designatorPath),
      {
        designatorPath: target.designatorPath,
        ...(target.recursive ? { recursive: true } : {}),
      },
    ])),
  };
}

function toAncestorGenerateTargets(
  designatorPath: string,
): readonly TargetSpec[] {
  if (designatorPath.length === 0) {
    return [];
  }

  const segments = designatorPath.split("/");
  const ancestors: TargetSpec[] = [{ designatorPath: "" }];
  for (let index = 1; index < segments.length; index += 1) {
    ancestors.push({ designatorPath: segments.slice(0, index).join("/") });
  }
  return ancestors;
}

function uniqueGenerateTargets(
  targets: readonly TargetSpec[],
): readonly TargetSpec[] {
  const targetByPath = new Map<string, TargetSpec>();
  for (const target of targets) {
    const existing = targetByPath.get(target.designatorPath);
    targetByPath.set(target.designatorPath, {
      designatorPath: target.designatorPath,
      ...((existing?.recursive || target.recursive) ? { recursive: true } : {}),
    });
  }
  return [...targetByPath.values()];
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

async function timeOptional<T>(
  timing: RuntimeTiming | undefined,
  phase: string,
  operation: () => Promise<T>,
): Promise<T> {
  return timing ? await timing.time(phase, operation) : await operation();
}

function timeOptionalSync<T>(
  timing: RuntimeTiming | undefined,
  phase: string,
  operation: () => T,
): T {
  return timing ? timing.timeSync(phase, operation) : operation();
}

async function prepareVersionExecution(
  workspaceRoot: string,
  targets: readonly NormalizedVersionTargetSpec[],
  localPathPolicy: OperationalLocalPathPolicy,
  historyTrackingPolicyOverride?: HistoryTrackingPolicy,
  onProgress?: WeaveProgressHandler,
  timing?: RuntimeTiming,
): Promise<PreparedVersionExecution> {
  await timeOptional(
    timing,
    "prepare.ensureWorkspaceRoot",
    () => ensureWorkspaceRootExists(workspaceRoot),
  );
  const meshState = await timeOptional(
    timing,
    "prepare.loadMeshState",
    () => loadMeshState(workspaceRoot),
  );
  const effectiveConfig = await timeOptional(
    timing,
    "prepare.loadEffectiveConfig",
    () => loadEffectiveConfigForExecution(historyTrackingPolicyOverride),
  );
  const supportHistoryPolicies = supportHistoryPoliciesFromEffectiveConfig(
    effectiveConfig,
  );
  const namingPolicies = namingPoliciesFromEffectiveConfig(effectiveConfig);
  const resourcePageGenerationPolicies =
    resourcePageGenerationPoliciesFromEffectiveConfig(effectiveConfig);
  const allDesignatorPaths = timeOptionalSync(
    timing,
    "prepare.listDesignatorPaths",
    () =>
      listKnopDesignatorPaths(
        meshState.meshBase,
        meshState.currentMeshInventoryTurtle,
        "Could not parse the current MeshInventory while resolving weaveable Knop candidates.",
      ),
  );
  const resolvedTargets = timeOptionalSync(
    timing,
    "prepare.resolveTargets",
    () =>
      targets.length === 0 ? [] : resolveTargetSelections(
        allDesignatorPaths,
        targets,
        (message) => new WeaveInputError(message),
      ),
  );
  timing?.setField("knownDesignatorPaths", allDesignatorPaths.length);
  timing?.setField("requestedTargets", targets.length);
  timing?.setField("resolvedTargets", resolvedTargets.length);
  const requestedDesignatorPaths = resolvedTargets.map((selection) =>
    selection.designatorPath
  );
  const targetByDesignatorPath = new Map(
    resolvedTargets.map((selection) => [
      selection.designatorPath,
      selection.target as NormalizedVersionTargetSpec | undefined,
    ]),
  );
  const overlay = new TextFileOverlay();
  const initialWeaveableKnops = await timeOptional(
    timing,
    "prepare.loadInitialCandidates",
    () =>
      loadWeaveableKnopCandidates(
        workspaceRoot,
        localPathPolicy,
        meshState.meshBase,
        meshState.currentMeshInventoryTurtle,
        requestedDesignatorPaths,
        targetByDesignatorPath,
        overlay,
      ),
  );
  timing?.setField("initialWeaveableKnops", initialWeaveableKnops.length);
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
          supportHistoryPolicies,
          resourcePageGenerationPolicies,
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
    const stagedMeshState = await timeOptional(
      timing,
      "prepare.loop.loadMeshState",
      () => loadMeshState(workspaceRoot, overlay),
    );
    const stagedWeaveableKnops = await timeOptional(
      timing,
      "prepare.loop.loadCandidates",
      () =>
        loadWeaveableKnopCandidates(
          workspaceRoot,
          localPathPolicy,
          stagedMeshState.meshBase,
          stagedMeshState.currentMeshInventoryTurtle,
          remainingDesignatorPaths,
          targetByDesignatorPath,
          overlay,
        ),
    );

    if (stagedWeaveableKnops.length === 0) {
      throw new WeaveInputError(
        `Recursive version planning could not continue cleanly for the remaining targets: ${remainingDesignatorPaths.join(", ")
        }.`,
      );
    }

    const nextCandidate = stagedWeaveableKnops[0]!;
    const nextDesignatorPath = nextCandidate.designatorPath;
    const target = targetByDesignatorPath.get(nextDesignatorPath);
    const nextPlan = timeOptionalSync(
      timing,
      "prepare.loop.planVersion",
      () =>
        planVersion({
          request: target ? { targets: [{ ...target.source }] } : {},
          meshBase: stagedMeshState.meshBase,
          currentMeshInventoryTurtle:
            stagedMeshState.currentMeshInventoryTurtle,
          currentMeshMetadataTurtle: stagedMeshState.currentMeshMetadataTurtle,
          weaveableKnops: [nextCandidate],
          supportHistoryPolicies,
          namingPolicies,
          resourcePageGenerationPolicies,
        }),
    );

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

    const completed = versionedDesignatorPaths.length;
    onProgress?.({
      designatorPath: completedPath,
      completed,
      total: initialWeaveableKnops.length,
      percent: Math.round((completed / initialWeaveableKnops.length) * 100),
    });
  }

  const plan: VersionPlan = {
    meshBase: meshState.meshBase,
    versionedDesignatorPaths,
    createdFiles,
    updatedFiles: updatedPathOrder.map((path) => updatedFileByPath.get(path)!),
  };

  timing?.setField("cachedReadFiles", overlay.readCount);
  timing?.setField("readCacheHits", overlay.cacheHitCount);
  timing?.setField("stagedReadHits", overlay.stagedHitCount);
  timing?.setField("candidateCacheHits", overlay.candidateCacheHitCount);
  timing?.setField("candidateCacheStores", overlay.candidateCacheStoreCount);
  timing?.setField(
    "candidateCacheInvalidations",
    overlay.candidateCacheInvalidationCount,
  );

  return {
    meshState,
    plan,
  };
}

function supportHistoryPoliciesFromEffectiveConfig(
  effectiveConfig: EffectiveConfig,
): WeaveSupportHistoryPolicies {
  return {
    meshMetadata: effectiveConfig.historyTrackingPolicyForArtifactRole(
      "meshMetadata",
    ),
    meshInventory: effectiveConfig.historyTrackingPolicyForArtifactRole(
      "meshInventory",
    ),
    config: effectiveConfig.historyTrackingPolicyForArtifactRole("config"),
    knopMetadata: effectiveConfig.historyTrackingPolicyForArtifactRole(
      "knopMetadata",
    ),
    knopInventory: effectiveConfig.historyTrackingPolicyForArtifactRole(
      "knopInventory",
    ),
    referenceCatalog: effectiveConfig.historyTrackingPolicyForArtifactRole(
      "referenceCatalog",
    ),
    resourcePageDefinition: effectiveConfig
      .historyTrackingPolicyForArtifactRole(
        "resourcePageDefinition",
      ),
  };
}

function namingPoliciesFromEffectiveConfig(
  effectiveConfig: EffectiveConfig,
): WeaveNamingPolicies {
  return {
    historyNamingPolicy: effectiveConfig.namingPolicies.historyNamingPolicy,
    stateNamingPolicy: effectiveConfig.namingPolicies.stateNamingPolicy,
    manifestationNamingPolicy: effectiveConfig.namingPolicies
      .manifestationNamingPolicy,
  };
}

function resourcePageGenerationPoliciesFromEffectiveConfig(
  effectiveConfig: EffectiveConfig,
): WeaveResourcePageGenerationPolicies {
  return {
    payload: effectiveConfig.resourcePageGenerationPolicyForArtifactRole(
      "payload",
    ),
    meshInventory: effectiveConfig.resourcePageGenerationPolicyForArtifactRole(
      "meshInventory",
    ),
    knopInventory: effectiveConfig.resourcePageGenerationPolicyForArtifactRole(
      "knopInventory",
    ),
    meshMetadata: effectiveConfig.resourcePageGenerationPolicyForArtifactRole(
      "meshMetadata",
    ),
    knopMetadata: effectiveConfig.resourcePageGenerationPolicyForArtifactRole(
      "knopMetadata",
    ),
    config: effectiveConfig.resourcePageGenerationPolicyForArtifactRole(
      "config",
    ),
    referenceCatalog: effectiveConfig
      .resourcePageGenerationPolicyForArtifactRole(
        "referenceCatalog",
      ),
    resourcePageDefinition: effectiveConfig
      .resourcePageGenerationPolicyForArtifactRole(
        "resourcePageDefinition",
      ),
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
    `Requested targets are not currently weaveable: ${missingTargets.map((target) =>
      target.recursive
        ? `${formatDesignatorPathForDisplay(target.designatorPath)
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
  targetByDesignatorPath: ReadonlyMap<
    string,
    NormalizedVersionTargetSpec | undefined
  >,
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

    const candidate = overlay instanceof TextFileOverlay
      ? await overlay.loadCandidate(
        designatorPath,
        () =>
          loadWeaveableKnopCandidate(
            workspaceRoot,
            localPathPolicy,
            meshBase,
            designatorPath,
            targetByDesignatorPath.get(designatorPath),
            overlay,
          ),
      )
      : await loadWeaveableKnopCandidate(
        workspaceRoot,
        localPathPolicy,
        meshBase,
        designatorPath,
        targetByDesignatorPath.get(designatorPath),
        overlay,
      );
    if (candidate === undefined) {
      continue;
    }

    candidates.push(candidate);
  }

  return candidates.sort((left, right) =>
    left.designatorPath.localeCompare(right.designatorPath)
  );
}

async function loadWeaveableKnopCandidate(
  workspaceRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  meshBase: string,
  designatorPath: string,
  target: NormalizedVersionTargetSpec | undefined,
  overlay?: ReadonlyMap<string, string>,
): Promise<WeaveableKnopCandidate | undefined> {
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
      return undefined;
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
    target,
  );

  if (!slice) {
    return undefined;
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

  if (slice === "firstReferenceCatalogWeave") {
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
        currentKnopInventoryTurtle,
        overlay,
      );
  }

  return isWeaveableKnopCandidate(candidate, slice, target)
    ? candidate
    : undefined;
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
    const absoluteCurrentPayloadPath =
      payloadArtifact.repositorySourceFloatingLocator
        ? await resolveRepositorySourceFloatingLocalPath(
          localPathPolicy,
          payloadArtifact.repositorySourceFloatingLocator,
        )
        : resolveAllowedLocalPath(
          localPathPolicy,
          "workingLocalRelativePath",
          workingLocalRelativePath,
        );
    currentPayloadTurtle = await readTextFileWithOverlay(
      absoluteCurrentPayloadPath,
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
    ...(payloadArtifact.workingAccessUrl
      ? { workingAccessUrl: payloadArtifact.workingAccessUrl }
      : {}),
    currentPayloadTurtle,
    ...(payloadArtifact.repositorySourceFloatingLocator
      ? {
        repositorySourceFloatingLocator:
          payloadArtifact.repositorySourceFloatingLocator,
      }
      : {}),
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
  currentKnopInventoryTurtle: string,
  overlay?: ReadonlyMap<string, string>,
): Promise<WeaveableKnopCandidate["referenceTargetSourcePayloadArtifact"]> {
  const sourceRegistryArtifact = await loadKnopSourceRegistryArtifact(
    localPathPolicy,
    meshBase,
    designatorPath,
    currentKnopInventoryTurtle,
    overlay,
  );
  const extractionSource = resolveExtractionSourceInventoryState(
    meshBase,
    currentKnopInventoryTurtle,
    designatorPath,
    {
      parseErrorMessage:
        `Could not parse the current Knop inventory while resolving the extracted weave source for ${designatorPath}.`,
      missingExtractionSourceMessage:
        `Could not resolve the current extracted source binding for ${designatorPath}.`,
      missingTargetArtifactMessage:
        `Could not resolve the current extracted source target for ${designatorPath}.`,
      missingRequestedTargetStateMessage:
        `Could not resolve the current extracted source target state for ${designatorPath}.`,
      unsupportedResolutionModeMessage:
        `Unsupported ExtractionSource resolution mode for ${designatorPath}.`,
    },
    sourceRegistryArtifact?.turtle,
  );
  if (!extractionSource) {
    return undefined;
  }

  const sourceDesignatorPath = extractionSource.sourceArtifactPath;
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
        `Workspace is missing the woven source payload inventory for ${designatorPath}: ${toKnopPath(sourceDesignatorPath)
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
  const selectedHistoricalStatePath =
    extractionSource.requestedTargetStatePath ??
    sourcePayloadArtifact.latestHistoricalStatePath;
  if (!selectedHistoricalStatePath) {
    throw new WeaveRuntimeError(
      `Extracted weave source for ${designatorPath} is missing an exact or latest source state.`,
    );
  }
  const selectedHistoricalSnapshotPath = resolveHistoricalStateLocatedFilePath(
    meshBase,
    sourceKnopInventoryTurtle,
    selectedHistoricalStatePath,
    `Could not parse the source Knop inventory while resolving the extracted source payload snapshot for ${designatorPath}.`,
  ) ?? (sourcePayloadArtifact.latestHistoricalStatePath ===
    selectedHistoricalStatePath &&
    sourcePayloadArtifact.latestHistoricalSnapshotPath
    ? sourcePayloadArtifact.latestHistoricalSnapshotPath
    : toPayloadHistoricalSnapshotPath(
      selectedHistoricalStatePath,
      sourcePayloadArtifact.workingLocalRelativePath,
    ));
  let selectedHistoricalSnapshotTurtle: string | undefined;
  try {
    selectedHistoricalSnapshotTurtle = await readTextFileWithOverlay(
      join(workspaceRoot, selectedHistoricalSnapshotPath),
      overlay,
    );
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new WeaveRuntimeError(
        `Workspace is missing the extracted source payload snapshot for ${designatorPath}: ${selectedHistoricalSnapshotPath}`,
      );
    }
    throw error;
  }

  return {
    designatorPath: sourceDesignatorPath,
    workingLocalRelativePath: sourcePayloadArtifact.workingLocalRelativePath,
    currentPayloadTurtle: sourcePayloadArtifact.currentPayloadTurtle,
    ...(sourcePayloadArtifact.repositorySourceFloatingLocator
      ? {
        repositorySourceFloatingLocator:
          sourcePayloadArtifact.repositorySourceFloatingLocator,
      }
      : {}),
    ...(sourceRegistryArtifact
      ? {
        sourceRegistryWorkingLocalRelativePath:
          sourceRegistryArtifact.workingLocalRelativePath,
        currentSourceRegistryTurtle: sourceRegistryArtifact.turtle,
      }
      : {}),
    latestHistoricalSnapshotPath: selectedHistoricalSnapshotPath,
    latestHistoricalSnapshotTurtle: selectedHistoricalSnapshotTurtle,
    latestHistoricalStatePath: selectedHistoricalStatePath,
    sourceEvidence: {
      sourceStatePath: selectedHistoricalStatePath,
      sourceManifestationPath: dirname(selectedHistoricalSnapshotPath)
        .replaceAll(
          "\\",
          "/",
        ),
      sourceLocatedFilePath: selectedHistoricalSnapshotPath,
      sourceDigest: await sha256Digest(selectedHistoricalSnapshotTurtle),
    },
  };
}

async function loadKnopSourceRegistryArtifact(
  localPathPolicy: OperationalLocalPathPolicy,
  meshBase: string,
  designatorPath: string,
  currentKnopInventoryTurtle: string,
  overlay?: ReadonlyMap<string, string>,
): Promise<
  { workingLocalRelativePath: string; turtle: string } | undefined
> {
  const sourceRegistryState = resolveKnopSourceRegistryInventoryState(
    meshBase,
    currentKnopInventoryTurtle,
    designatorPath,
    {
      parseErrorMessage:
        `Could not parse the current Knop inventory while resolving source registry facts for ${designatorPath}.`,
      missingSourceRegistryMessage:
        `Could not resolve the current Knop source registry for ${designatorPath}.`,
      missingWorkingFileMessage:
        `Could not resolve the current Knop source registry working file for ${designatorPath}.`,
    },
  );
  if (sourceRegistryState === undefined) {
    return undefined;
  }

  let sourceRegistryPath: string;
  try {
    sourceRegistryPath = resolveAllowedLocalPath(
      localPathPolicy,
      "workingLocalRelativePath",
      sourceRegistryState.workingLocalRelativePath,
    );
  } catch (error) {
    if (error instanceof LocalPathAccessError) {
      throw new WeaveRuntimeError(
        `Working Knop source registry file for ${designatorPath} is outside the allowed local-path boundary: ${sourceRegistryState.workingLocalRelativePath}`,
      );
    }
    throw error;
  }
  try {
    return {
      workingLocalRelativePath: sourceRegistryState.workingLocalRelativePath,
      turtle: await readTextFileWithOverlay(sourceRegistryPath, overlay),
    };
  } catch (error) {
    if (
      error instanceof Deno.errors.NotFound &&
      !currentKnopInventoryTurtle.includes("hasExtractionSource") &&
      !currentKnopInventoryTurtle.includes(SFLO_HAS_EXTRACTION_SOURCE_IRI)
    ) {
      return undefined;
    }
    if (error instanceof Deno.errors.NotFound) {
      throw new WeaveRuntimeError(
        `Workspace is missing the Knop source registry for ${designatorPath}: ${sourceRegistryState.workingLocalRelativePath}`,
      );
    }
    throw error;
  }
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
  target?: NormalizedVersionTargetSpec,
): boolean {
  if (slice === "firstExtractedKnopWeave") {
    return candidate.referenceTargetSourcePayloadArtifact !== undefined;
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
      (hasPayloadVersionNamingTarget(target) ||
        (candidate.payloadArtifact.latestHistoricalSnapshotTurtle !==
          undefined &&
          candidate.payloadArtifact.currentPayloadTurtle !==
          candidate.payloadArtifact.latestHistoricalSnapshotTurtle));
  }

  return slice === "firstKnopWeave";
}

function hasPayloadVersionNamingTarget(
  target?: NormalizedVersionTargetSpec,
): boolean {
  return target !== undefined &&
    (target.historySegment !== undefined ||
      target.stateSegment !== undefined ||
      target.manifestationSegment !== undefined);
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
  overlay.stagePlannedFiles(workspaceRoot, files);
}

async function readTextFileWithOverlay(
  path: string,
  overlay?: ReadonlyMap<string, string>,
): Promise<string> {
  if (overlay instanceof TextFileOverlay) {
    return await overlay.readTextFile(path);
  }

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
  hasExplicitGenerateTargets: boolean,
  effectiveConfig: EffectiveConfig,
  generatedAt: Date,
  includeSemanticFlowMetadata: boolean,
): Promise<readonly PlannedFile[]> {
  const pageModels: ResourcePageModel[] = [];
  const pagePaths = new Set<string>();
  const selectedSet = new Set(selectedDesignatorPaths);
  const designatorContexts = await loadGenerateDesignatorContexts(
    workspaceRoot,
    localPathPolicy,
    meshState,
    selectedDesignatorPaths,
    effectiveConfig,
    hasExplicitGenerateTargets,
  );
  const publicIdentifierPaths = new Map(
    designatorContexts.map((context) => [
      toDesignatorResourcePagePath(context.designatorPath),
      context,
    ]),
  );
  const knopResourcePaths = new Map(
    designatorContexts.map((context) => [
      toKnopPath(context.designatorPath),
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
  const allPagePaths = listRuntimeGeneratedResourcePagePaths(
    {
      meshBase: meshState.meshBase,
      inventoryTurtle: meshState.currentMeshInventoryTurtle,
      parseErrorMessage:
        "Could not parse the current MeshInventory while collecting ResourcePages.",
      config: effectiveConfig,
      explicitRequest: hasExplicitGenerateTargets,
    },
  );
  const generatedResourcePaths = collectGeneratedResourcePaths(
    allPagePaths,
    includeAllMeshPages,
    selectedSet,
  );
  const displayedChildResourcePaths = collectDisplayedChildResourcePaths(
    allPagePaths,
    generatedResourcePaths,
  );
  const childTypeHintContexts = await loadBestEffortGenerateDesignatorContexts(
    workspaceRoot,
    localPathPolicy,
    meshState,
    displayedChildResourcePaths.filter((resourcePath) =>
      !selectedSet.has(resourcePath)
    ),
    effectiveConfig,
    hasExplicitGenerateTargets,
  );
  const childRdfTypesByResourcePath = collectDesignatorRdfTypesByResourcePath(
    meshState.meshBase,
    [...designatorContexts, ...childTypeHintContexts],
  );
  const childIdentifiersByResourcePath = collectChildIdentifiersByResourcePath(
    allPagePaths,
    childRdfTypesByResourcePath,
  );

  for (const pagePath of allPagePaths) {
    if (
      !shouldGenerateRuntimePagePath(
        pagePath,
        includeAllMeshPages,
        selectedSet,
      )
    ) {
      continue;
    }
    if (pagePaths.has(pagePath)) {
      continue;
    }

    const publicContext = publicIdentifierPaths.get(pagePath);
    const resourcePath = toResourcePath(pagePath);
    if (publicContext) {
      const historyGroups = publicContext.historyGroupsByResourcePath.get(
        resourcePath,
      ) ?? findHistoryGroupsForResource(resourcePath, designatorContexts);
      if (isHistoryComponentResource(resourcePath, historyGroups ?? [])) {
        pageModels.push({
          kind: "simple",
          path: pagePath,
          description: describeSemanticFlowResource(
            meshState.meshBase,
            resourcePath,
            historyGroups ?? [],
          ),
          childIdentifiers: childIdentifiersByResourcePath.get(
            resourcePath,
          ),
          historyGroups,
        });
      } else if (publicContext.customIdentifierPage) {
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
          workingAccessUrl: publicContext.payloadWorkingAccessUrl,
          repositorySourceFloatingLocator:
            publicContext.payloadRepositorySourceFloatingLocator,
          extractionSource: publicContext.extractionSource,
          references: publicContext.references,
          childIdentifiers: childIdentifiersByResourcePath.get(
            resourcePath,
          ),
          historyGroups,
          rawSourcePanels: publicContext.rawSourcePanels.get(pagePath),
        });
      }
    } else if (knopResourcePaths.has(resourcePath)) {
      const knopContext = knopResourcePaths.get(resourcePath)!;
      pageModels.push({
        kind: "knop",
        path: pagePath,
        designatorPath: knopContext.designatorPath,
        ownerTitle: resolveKnopOwnerTitle(meshState.meshBase, knopContext),
        governedArtifacts: knopContext.governedArtifacts,
        supportingArtifacts: knopContext.supportingArtifacts,
        childIdentifiers: toKnopChildIdentifiers(
          knopContext.supportingArtifacts,
          childIdentifiersByResourcePath.get(resourcePath),
        ),
      });
    } else {
      const rawSourcePanels = meshRawSourcePanels.get(pagePath) ??
        findRawSourcePanelsForPage(pagePath, designatorContexts);
      const historyGroups = meshHistoryGroups.get(resourcePath) ??
        findHistoryGroupsForResource(resourcePath, designatorContexts);
      pageModels.push({
        kind: "simple",
        path: pagePath,
        description: describeSemanticFlowResource(
          meshState.meshBase,
          resourcePath,
          historyGroups ?? [],
          rawSourcePanels ??
          findOwnerRawSourcePanelsForArtifactHistory(
            resourcePath,
            historyGroups ?? [],
            meshRawSourcePanels,
            designatorContexts,
          ),
        ),
        childIdentifiers: childIdentifiersByResourcePath.get(
          resourcePath,
        ),
        historyGroups,
        rawSourcePanels,
      });
    }
    pagePaths.add(pagePath);
  }

  for (const context of designatorContexts) {
    for (const pagePath of context.pagePaths) {
      if (pagePaths.has(pagePath)) {
        continue;
      }

      const resourcePath = toResourcePath(pagePath);
      const rawSourcePanels = context.rawSourcePanels.get(pagePath);
      const historyGroups = context.historyGroupsByResourcePath.get(
        resourcePath,
      );
      pageModels.push({
        ...(resourcePath === toKnopPath(context.designatorPath)
          ? {
            kind: "knop" as const,
            path: pagePath,
            designatorPath: context.designatorPath,
            ownerTitle: resolveKnopOwnerTitle(meshState.meshBase, context),
            governedArtifacts: context.governedArtifacts,
            supportingArtifacts: context.supportingArtifacts,
            childIdentifiers: toKnopChildIdentifiers(
              context.supportingArtifacts,
              childIdentifiersByResourcePath.get(resourcePath),
            ),
          }
          : {
            kind: "simple" as const,
            path: pagePath,
            description: context.pageDescriptions.get(pagePath) ??
              describeSemanticFlowResource(
                meshState.meshBase,
                resourcePath,
                historyGroups ?? [],
                rawSourcePanels ??
                findOwnerRawSourcePanelsForArtifactHistoryInContext(
                  resourcePath,
                  historyGroups ?? [],
                  context,
                ),
              ),
            childIdentifiers: childIdentifiersByResourcePath.get(
              resourcePath,
            ),
            historyGroups,
            rawSourcePanels,
          }),
      });
      pagePaths.add(pagePath);
    }
  }

  const meshFaviconPath = await resolveMeshFaviconPath(workspaceRoot);
  return await renderResourcePages(meshState.meshBase, pageModels, {
    generatedAt,
    includeSemanticFlowMetadata,
    meshFaviconPath,
  });
}

function listRuntimeGeneratedResourcePagePaths(
  input: ListGeneratedResourcePagePathsInput,
): readonly string[] {
  try {
    return listGeneratedResourcePagePaths(input);
  } catch (error) {
    if (error instanceof ResourcePagePolicyError) {
      throw new WeaveRuntimeError(error.message);
    }
    throw error;
  }
}

function collectGeneratedResourcePaths(
  pagePaths: readonly string[],
  includeAllMeshPages: boolean,
  selectedSet: ReadonlySet<string>,
): readonly string[] {
  const resourcePaths = new Set<string>();

  for (const pagePath of pagePaths) {
    if (
      shouldGenerateRuntimePagePath(pagePath, includeAllMeshPages, selectedSet)
    ) {
      resourcePaths.add(toResourcePath(pagePath));
    }
  }

  return [...resourcePaths].sort((left, right) => left.localeCompare(right));
}

function shouldGenerateRuntimePagePath(
  pagePath: string,
  includeAllMeshPages: boolean,
  selectedSet: ReadonlySet<string>,
): boolean {
  return includeAllMeshPages ||
    pagePath.startsWith("_mesh/") ||
    selectedSet.has(toResourcePath(pagePath));
}

function collectDisplayedChildResourcePaths(
  pagePaths: readonly string[],
  parentResourcePaths: readonly string[],
): readonly string[] {
  const parentSet = new Set(parentResourcePaths);
  const childPaths = new Set<string>();

  for (const pagePath of pagePaths) {
    const childPath = toResourcePath(pagePath);
    if (
      isChildIdentifierResourcePath(childPath) &&
      parentSet.has(toParentResourcePath(childPath))
    ) {
      childPaths.add(childPath);
    }
  }

  return [...childPaths].sort((left, right) => left.localeCompare(right));
}

async function resolveMeshFaviconPath(
  meshRoot: string,
): Promise<string | undefined> {
  try {
    const stat = await Deno.stat(join(meshRoot, "favicon.ico"));
    return stat.isFile ? "favicon.ico" : undefined;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return undefined;
    }
    throw error;
  }
}

function collectChildIdentifiersByResourcePath(
  pagePaths: readonly string[],
  rdfTypesByResourcePath: ReadonlyMap<string, readonly string[]> = new Map(),
): ReadonlyMap<string, readonly ResourcePageChildIdentifierModel[]> {
  const resourcePaths = pagePaths.map((pagePath) => toResourcePath(pagePath));
  const childIdentifiersByResourcePath = new Map<
    string,
    ResourcePageChildIdentifierModel[]
  >();

  for (const childPath of resourcePaths) {
    if (!isChildIdentifierResourcePath(childPath)) {
      continue;
    }
    const parentPath = toParentResourcePath(childPath);
    const childIdentifiers = childIdentifiersByResourcePath.get(parentPath) ??
      [];
    const rdfTypes = rdfTypesByResourcePath.get(childPath);
    childIdentifiers.push({
      label: toLastPathSegment(childPath),
      path: childPath,
      ...(rdfTypes && rdfTypes.length > 0 ? { rdfTypes } : {}),
    });
    childIdentifiersByResourcePath.set(parentPath, childIdentifiers);
  }

  for (const childIdentifiers of childIdentifiersByResourcePath.values()) {
    childIdentifiers.sort((left, right) =>
      left.label.localeCompare(right.label, "en", { sensitivity: "base" })
    );
  }

  return childIdentifiersByResourcePath;
}

function collectDesignatorRdfTypesByResourcePath(
  meshBase: string,
  contexts: readonly GenerateDesignatorContext[],
): ReadonlyMap<string, readonly string[]> {
  const typesByResourcePath = new Map<string, readonly string[]>();

  for (const context of contexts) {
    const pagePath = toDesignatorResourcePagePath(context.designatorPath);
    const panels = context.rawSourcePanels.get(pagePath);
    if (!panels) {
      continue;
    }
    const types = extractResourceRdfTypes(
      meshBase,
      context.designatorPath,
      panels,
    );
    if (types.length > 0) {
      typesByResourcePath.set(context.designatorPath, types);
    }
  }

  return typesByResourcePath;
}

function toKnopChildIdentifiers(
  supportingArtifacts: readonly KnopArtifactLinkModel[],
  discoveredChildren: readonly ResourcePageChildIdentifierModel[] = [],
): readonly ResourcePageChildIdentifierModel[] {
  const childByPath = new Map<string, ResourcePageChildIdentifierModel>();
  for (const child of discoveredChildren) {
    childByPath.set(child.path, child);
  }
  for (const artifact of supportingArtifacts) {
    childByPath.set(artifact.path, {
      label: toLastPathSegment(artifact.path),
      path: artifact.path,
    });
  }

  return Array.from(childByPath.values()).sort((left, right) =>
    left.label.localeCompare(right.label, "en", { sensitivity: "base" })
  );
}

function resolveKnopOwnerTitle(
  meshBase: string,
  context: GenerateDesignatorContext,
): string | undefined {
  const ownerPagePath = toDesignatorResourcePagePath(context.designatorPath);
  const rawSourcePanels = context.rawSourcePanels.get(ownerPagePath);
  return rawSourcePanels
    ? extractResourceTitle(meshBase, context.designatorPath, rawSourcePanels)
    : undefined;
}

function isChildIdentifierResourcePath(resourcePath: string): boolean {
  if (resourcePath.length === 0) {
    return false;
  }
  const parentPath = toParentResourcePath(resourcePath);
  if (parentPath === "_knop" || parentPath.endsWith("/_knop")) {
    return true;
  }

  return !resourcePath.split("/").some((segment) => segment.startsWith("_"));
}

function toParentResourcePath(resourcePath: string): string {
  const lastSlash = resourcePath.lastIndexOf("/");
  return lastSlash === -1 ? "" : resourcePath.slice(0, lastSlash);
}

function resolveGeneratedAt(now?: () => Date): Date {
  if (now) {
    return now();
  }
  const generatedAt = Deno.env.get("WEAVE_GENERATED_AT");
  return generatedAt ? new Date(generatedAt) : new Date();
}

async function loadBestEffortGenerateDesignatorContexts(
  workspaceRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  meshState: MeshState,
  designatorPaths: readonly string[],
  effectiveConfig: EffectiveConfig,
  hasExplicitGenerateTargets: boolean,
): Promise<readonly GenerateDesignatorContext[]> {
  const contexts: GenerateDesignatorContext[] = [];
  const seen = new Set<string>();

  for (const designatorPath of designatorPaths) {
    if (seen.has(designatorPath)) {
      continue;
    }
    seen.add(designatorPath);

    try {
      contexts.push(
        ...await loadGenerateDesignatorContexts(
          workspaceRoot,
          localPathPolicy,
          meshState,
          [designatorPath],
          effectiveConfig,
          hasExplicitGenerateTargets,
        ),
      );
    } catch (error) {
      if (
        error instanceof Deno.errors.NotFound ||
        error instanceof LocalPathAccessError ||
        error instanceof WeaveRuntimeError
      ) {
        continue;
      }
      throw error;
    }
  }

  return contexts;
}

async function loadGenerateDesignatorContexts(
  workspaceRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  meshState: MeshState,
  designatorPaths: readonly string[],
  effectiveConfig: EffectiveConfig,
  hasExplicitGenerateTargets: boolean,
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
    const artifactLinks = collectKnopArtifactLinks(
      meshState.meshBase,
      currentKnopInventoryTurtle,
      designatorPath,
    );
    const currentKnopInventoryQuads = parseInventoryQuads(
      meshState.meshBase,
      currentKnopInventoryTurtle,
      `Could not parse the current Knop inventory while collecting current KnopInventory source panel for ${designatorPath}.`,
    );
    const currentKnopInventoryPagePath = `${toKnopPath(designatorPath)
      }/_inventory/index.html`;
    const currentKnopInventoryWorkingPath = `${toKnopPath(designatorPath)
      }/_inventory/inventory.ttl`;
    if (
      !(await addLatestHistoricalRawSourcePanelForCurrentArtifact(
        rawSourcePanels,
        workspaceRoot,
        meshState.meshBase,
        currentKnopInventoryQuads,
        `${toKnopPath(designatorPath)}/_inventory`,
        currentKnopInventoryWorkingPath,
        currentKnopInventoryPagePath,
      ))
    ) {
      addRawSourcePanel(
        rawSourcePanels,
        currentKnopInventoryPagePath,
        {
          label: "Current KnopInventory file",
          sourcePath: currentKnopInventoryWorkingPath,
          contents: currentKnopInventoryTurtle,
        },
      );
    }
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
    const referenceCatalogArtifact = await loadReferenceCatalogWorkingArtifact(
      workspaceRoot,
      localPathPolicy,
      meshState.meshBase,
      designatorPath,
      currentKnopInventoryTurtle,
    );
    const referenceLinks = referenceCatalogArtifact
      ? extractResourceReferenceLinks(
        meshState.meshBase,
        designatorPath,
        referenceCatalogArtifact.currentReferenceCatalogTurtle,
      )
      : [];
    const sourceRegistryArtifact = await loadKnopSourceRegistryArtifact(
      localPathPolicy,
      meshState.meshBase,
      designatorPath,
      currentKnopInventoryTurtle,
    );
    const extractionSource = resolveExtractionSourceInventoryState(
      meshState.meshBase,
      currentKnopInventoryTurtle,
      designatorPath,
      {
        parseErrorMessage:
          `Could not parse the current Knop inventory while resolving page source facts for ${designatorPath}.`,
        missingExtractionSourceMessage:
          `Could not resolve the current extracted source binding for ${designatorPath}.`,
        missingTargetArtifactMessage:
          `Could not resolve the current extracted source target for ${designatorPath}.`,
        missingRequestedTargetStateMessage:
          `Could not resolve the current extracted source target state for ${designatorPath}.`,
        unsupportedResolutionModeMessage:
          `Unsupported ExtractionSource resolution mode for ${designatorPath}.`,
      },
      sourceRegistryArtifact?.turtle,
    );
    const ownHistoryGroupsByResourcePath = collectHistoryGroupsByResourcePath(
      meshState.meshBase,
      currentKnopInventoryTurtle,
      `Could not parse the current Knop inventory while collecting ResourcePage histories for ${designatorPath}.`,
    );
    const ancestorHistoryGroupsByResourcePath =
      await collectAncestorHistoryGroupsByResourcePath(
        workspaceRoot,
        meshState.meshBase,
        designatorPath,
      );
    const sourceHistoryGroupsByResourcePath = extractionSource
      ? await collectExtractionSourceHistoryGroupsByResourcePath(
        workspaceRoot,
        meshState.meshBase,
        designatorPath,
        extractionSource.sourceArtifactPath,
      )
      : new Map<string, readonly ResourcePageHistoryGroupModel[]>();
    let customIdentifierPage: CustomIdentifierPageModelInput | undefined;
    const pagePaths = listRuntimeGeneratedResourcePagePaths({
      meshBase: meshState.meshBase,
      inventoryTurtle: currentKnopInventoryTurtle,
      parseErrorMessage:
        `Could not parse the current Knop inventory while collecting ResourcePages for ${designatorPath}.`,
      config: effectiveConfig,
      explicitRequest: hasExplicitGenerateTargets,
    });

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
      payloadWorkingAccessUrl: payloadArtifact?.workingAccessUrl,
      ...(payloadArtifact?.repositorySourceFloatingLocator
        ? {
          payloadRepositorySourceFloatingLocator:
            payloadArtifact.repositorySourceFloatingLocator,
        }
        : {}),
      ...(extractionSource
        ? {
          extractionSource: {
            sourceArtifactPath: extractionSource.sourceArtifactPath,
            ...(extractionSource.requestedTargetStatePath
              ? {
                requestedTargetStatePath:
                  extractionSource.requestedTargetStatePath,
              }
              : {}),
            ...(extractionSource.artifactResolutionModeIri
              ? {
                artifactResolutionModeIri:
                  extractionSource.artifactResolutionModeIri,
              }
              : {}),
          },
        }
        : {}),
      references: referenceLinks.map((link) => link.model),
      ...artifactLinks,
      customIdentifierPage,
      historyGroupsByResourcePath: mergeHistoryGroupsByResourcePath(
        ownHistoryGroupsByResourcePath,
        ancestorHistoryGroupsByResourcePath,
        sourceHistoryGroupsByResourcePath,
      ),
      pageDescriptions,
      rawSourcePanels,
      pagePaths,
    });

    if (payloadArtifact) {
      await addPayloadRawSourcePanels(
        rawSourcePanels,
        workspaceRoot,
        meshState.meshBase,
        currentKnopInventoryQuads,
        designatorPath,
        payloadArtifact,
      );
    } else if (extractionSource) {
      await addExtractionSourceRawSourcePanels(
        rawSourcePanels,
        workspaceRoot,
        localPathPolicy,
        meshState.meshBase,
        designatorPath,
        extractionSource.sourceArtifactPath,
        extractionSource.requestedTargetStatePath,
        extractionSource.artifactResolutionModeIri,
      );
    } else if (referenceCatalogArtifact) {
      await addReferenceTargetSourceRawSourcePanels(
        rawSourcePanels,
        workspaceRoot,
        localPathPolicy,
        meshState.meshBase,
        designatorPath,
        referenceLinks,
      );
    }
    await addSupportArtifactRawSourcePanels(
      rawSourcePanels,
      workspaceRoot,
      localPathPolicy,
      meshState.meshBase,
      currentKnopInventoryQuads,
      artifactLinks.supportingArtifacts,
    );
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
  const quads = parseInventoryQuads(
    meshState.meshBase,
    meshState.currentMeshInventoryTurtle,
    "Could not parse the current MeshInventory while collecting mesh support source panels.",
  );

  if (
    !(await addLatestHistoricalRawSourcePanelForCurrentArtifact(
      rawSourcePanels,
      workspaceRoot,
      meshState.meshBase,
      quads,
      "_mesh/_inventory",
      "_mesh/_inventory/inventory.ttl",
      "_mesh/_inventory/index.html",
    ))
  ) {
    addRawSourcePanel(rawSourcePanels, "_mesh/_inventory/index.html", {
      label: "Current MeshInventory file",
      sourcePath: "_mesh/_inventory/inventory.ttl",
      contents: meshState.currentMeshInventoryTurtle,
    });
  }

  for (
    const support of [
      {
        artifactPath: "_mesh/_meta",
        pagePath: "_mesh/_meta/index.html",
        sourcePath: "_mesh/_meta/meta.ttl",
        label: "Current MeshMetadata file",
      },
      {
        artifactPath: "_mesh/_config",
        pagePath: "_mesh/_config/index.html",
        sourcePath: "_mesh/_config/config.ttl",
        label: "Current MeshConfig file",
      },
    ]
  ) {
    if (
      await addLatestHistoricalRawSourcePanelForCurrentArtifact(
        rawSourcePanels,
        workspaceRoot,
        meshState.meshBase,
        quads,
        support.artifactPath,
        support.sourcePath,
        support.pagePath,
      )
    ) {
      continue;
    }

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

function collectKnopArtifactLinks(
  meshBase: string,
  currentKnopInventoryTurtle: string,
  designatorPath: string,
): {
  governedArtifacts: readonly KnopArtifactLinkModel[];
  supportingArtifacts: readonly KnopArtifactLinkModel[];
} {
  const quads = parseInventoryQuads(
    meshBase,
    currentKnopInventoryTurtle,
    `Could not parse the current Knop inventory while collecting Knop artifacts for ${designatorPath}.`,
  );
  const knopIri = new URL(toKnopPath(designatorPath), meshBase).href;

  return {
    governedArtifacts: collectKnopArtifactLinksForPredicates(
      meshBase,
      quads,
      knopIri,
      [[SFLO_HAS_PAYLOAD_ARTIFACT_IRI, "PayloadArtifact"]],
    ),
    supportingArtifacts: collectKnopArtifactLinksForPredicates(
      meshBase,
      quads,
      knopIri,
      [
        [SFLO_HAS_KNOP_METADATA_IRI, "KnopMetadata"],
        [SFLO_HAS_KNOP_INVENTORY_IRI, "KnopInventory"],
        [SFLO_HAS_REFERENCE_CATALOG_IRI, "ReferenceCatalog"],
        [SFLO_HAS_RESOURCE_PAGE_DEFINITION_IRI, "ResourcePageDefinition"],
        [SFLO_HAS_KNOP_ASSET_BUNDLE_IRI, "KnopAssetBundle"],
      ],
    ),
  };
}

async function collectExtractionSourceHistoryGroupsByResourcePath(
  workspaceRoot: string,
  meshBase: string,
  designatorPath: string,
  sourceArtifactPath: string,
): Promise<
  ReadonlyMap<string, readonly ResourcePageHistoryGroupModel[]>
> {
  const sourceKnopInventoryPath = join(
    workspaceRoot,
    `${toKnopPath(sourceArtifactPath)}/_inventory/inventory.ttl`,
  );

  try {
    return collectHistoryGroupsByResourcePath(
      meshBase,
      await Deno.readTextFile(sourceKnopInventoryPath),
      `Could not parse the source Knop inventory while collecting ResourcePage histories for ${designatorPath}.`,
    );
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new WeaveRuntimeError(
        `Workspace is missing the page source payload inventory for ${designatorPath}: ${toKnopPath(sourceArtifactPath)
        }/_inventory/inventory.ttl`,
      );
    }
    throw error;
  }
}

async function collectAncestorHistoryGroupsByResourcePath(
  workspaceRoot: string,
  meshBase: string,
  designatorPath: string,
): Promise<
  ReadonlyMap<string, readonly ResourcePageHistoryGroupModel[]>
> {
  const maps: ReadonlyMap<
    string,
    readonly ResourcePageHistoryGroupModel[]
  >[] = [];

  for (const ancestorPath of listAncestorDesignatorPaths(designatorPath)) {
    const ancestorKnopInventoryPath = join(
      workspaceRoot,
      `${toKnopPath(ancestorPath)}/_inventory/inventory.ttl`,
    );

    try {
      const historyGroupsByResourcePath = collectHistoryGroupsByResourcePath(
        meshBase,
        await Deno.readTextFile(ancestorKnopInventoryPath),
        `Could not parse the ancestor Knop inventory while collecting ResourcePage histories for ${designatorPath}.`,
      );
      if (historyGroupsByResourcePath.has(designatorPath)) {
        maps.push(historyGroupsByResourcePath);
      }
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        continue;
      }
      throw error;
    }
  }

  return mergeHistoryGroupsByResourcePath(...maps);
}

function listAncestorDesignatorPaths(
  designatorPath: string,
): readonly string[] {
  const segments = designatorPath.split("/").filter((segment) =>
    segment.length > 0
  );
  const ancestors: string[] = [];

  for (let index = segments.length - 1; index > 0; index -= 1) {
    ancestors.push(segments.slice(0, index).join("/"));
  }

  return ancestors;
}

function mergeHistoryGroupsByResourcePath(
  ...maps: readonly ReadonlyMap<
    string,
    readonly ResourcePageHistoryGroupModel[]
  >[]
): ReadonlyMap<string, readonly ResourcePageHistoryGroupModel[]> {
  const merged = new Map<string, ResourcePageHistoryGroupModel[]>();

  for (const map of maps) {
    for (const [resourcePath, groups] of map) {
      const existing = merged.get(resourcePath) ?? [];
      const existingPaths = new Set(existing.map((group) => group.path));
      for (const group of groups) {
        if (!existingPaths.has(group.path)) {
          existing.push(group);
          existingPaths.add(group.path);
        }
      }
      merged.set(resourcePath, existing);
    }
  }

  return merged;
}

function extractResourceReferenceLinks(
  meshBase: string,
  designatorPath: string,
  referenceCatalogTurtle: string,
): readonly ParsedResourceReferenceLink[] {
  const quads = parseInventoryQuads(
    meshBase,
    referenceCatalogTurtle,
    `Could not parse the current ReferenceCatalog while collecting references for ${designatorPath}.`,
  );
  const referenceCatalogIri = new URL(
    toReferenceCatalogPath(designatorPath),
    meshBase,
  ).href;
  const linkSubjectPrefix = `${referenceCatalogIri}#`;
  const designatorIri = new URL(designatorPath, meshBase).href;
  const linkSubjects = new Set<string>();

  for (const quad of quads) {
    if (
      quad.subject.termType !== "NamedNode" ||
      !quad.subject.value.startsWith(linkSubjectPrefix)
    ) {
      continue;
    }

    const subjectIri = quad.subject.value;
    if (
      hasNamedNodeObject(
        quads,
        subjectIri,
        RDF_TYPE_IRI,
        SFLO_REFERENCE_LINK_IRI,
      ) &&
      hasNamedNodeObject(
        quads,
        subjectIri,
        SFLO_REFERENCE_LINK_FOR_IRI,
        designatorIri,
      ) &&
      hasNamedNodeObject(
        quads,
        designatorIri,
        SFLO_HAS_REFERENCE_LINK_IRI,
        subjectIri,
      )
    ) {
      linkSubjects.add(subjectIri);
    }
  }

  const links: ParsedResourceReferenceLink[] = [];
  for (const subjectIri of [...linkSubjects].sort()) {
    const roleIris = findNamedNodeObjects(
      quads,
      subjectIri,
      SFLO_HAS_REFERENCE_ROLE_IRI,
    );
    const referenceTargetIris = findNamedNodeObjects(
      quads,
      subjectIri,
      SFLO_REFERENCE_TARGET_IRI,
    );
    const referenceTargetStateIris = findNamedNodeObjects(
      quads,
      subjectIri,
      SFLO_REFERENCE_TARGET_STATE_IRI,
    );
    const uriLiteralTargets = findLiteralObjects(
      quads,
      subjectIri,
      SFLO_REFERENCE_URI_LITERAL_IRI,
    );
    const targets = toResourcePageReferenceTargets([
      ...referenceTargetIris,
      ...referenceTargetStateIris,
      ...uriLiteralTargets,
    ]);

    if (roleIris.length === 0 || targets.length === 0) {
      continue;
    }

    const referenceTargetPaths = referenceTargetIris.flatMap((iri) => {
      const meshPath = toMeshPath(meshBase, iri);
      return meshPath === undefined ? [] : [meshPath];
    });
    const referenceTargetStatePaths = referenceTargetStateIris.flatMap(
      (iri) => {
        const meshPath = toMeshPath(meshBase, iri);
        return meshPath === undefined ? [] : [meshPath];
      },
    );

    for (const roleIri of roleIris) {
      links.push({
        roleIris: [roleIri],
        model: {
          roleLabel: toReferenceRoleLabel(roleIri),
          targets,
        },
        referenceTargetPaths,
        referenceTargetStatePaths,
      });
    }
  }

  return links;
}

function toResourcePageReferenceTargets(
  values: readonly string[],
): readonly ResourcePageReferenceTargetModel[] {
  const targets = new Map<string, ResourcePageReferenceTargetModel>();

  for (const value of values) {
    targets.set(value, {
      href: value,
      label: value,
    });
  }

  return [...targets.values()].sort((left, right) =>
    left.label.localeCompare(right.label)
  );
}

function hasNamedNodeObject(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
  objectIri: string,
): boolean {
  return quads.some((quad) =>
    quad.subject.termType === "NamedNode" &&
    quad.subject.value === subjectIri &&
    quad.predicate.value === predicateIri &&
    quad.object.termType === "NamedNode" &&
    quad.object.value === objectIri
  );
}

function findNamedNodeObjects(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
): readonly string[] {
  const values = new Set<string>();

  for (const quad of quads) {
    if (
      quad.subject.termType === "NamedNode" &&
      quad.subject.value === subjectIri &&
      quad.predicate.value === predicateIri &&
      quad.object.termType === "NamedNode"
    ) {
      values.add(quad.object.value);
    }
  }

  return [...values].sort();
}

function findLiteralObjects(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
): readonly string[] {
  const values = new Set<string>();

  for (const quad of quads) {
    if (
      quad.subject.termType === "NamedNode" &&
      quad.subject.value === subjectIri &&
      quad.predicate.value === predicateIri &&
      quad.object.termType === "Literal"
    ) {
      values.add(quad.object.value);
    }
  }

  return [...values].sort();
}

function toReferenceRoleLabel(referenceRoleIri: string): string {
  const localName = toLastIriSegment(referenceRoleIri);
  const referenceRolePrefix = "referenceRole_";
  return localName.startsWith(referenceRolePrefix)
    ? localName.slice(referenceRolePrefix.length)
    : localName;
}

function toLastIriSegment(iri: string): string {
  const hashIndex = iri.lastIndexOf("#");
  const slashIndex = iri.lastIndexOf("/");
  const index = Math.max(hashIndex, slashIndex);
  return index === -1 ? iri : iri.slice(index + 1);
}

function collectKnopArtifactLinksForPredicates(
  meshBase: string,
  quads: readonly Quad[],
  knopIri: string,
  predicates: readonly (readonly [predicateIri: string, label: string])[],
): readonly KnopArtifactLinkModel[] {
  const links: KnopArtifactLinkModel[] = [];
  const seen = new Set<string>();

  for (const [predicateIri, label] of predicates) {
    for (const quad of quads) {
      if (
        quad.subject.termType !== "NamedNode" ||
        quad.subject.value !== knopIri ||
        quad.predicate.value !== predicateIri ||
        quad.object.termType !== "NamedNode"
      ) {
        continue;
      }

      const path = toMeshPath(meshBase, quad.object.value);
      if (!path || seen.has(path)) {
        continue;
      }

      links.push({ label, path });
      seen.add(path);
    }
  }

  return links;
}

async function addSupportArtifactRawSourcePanels(
  rawSourcePanels: Map<string, readonly ResourcePageRawSourcePanelModel[]>,
  workspaceRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  meshBase: string,
  quads: readonly Quad[],
  supportArtifacts: readonly KnopArtifactLinkModel[],
): Promise<void> {
  for (const artifact of supportArtifacts) {
    const pagePath = toDesignatorResourcePagePath(artifact.path);
    if (rawSourcePanels.has(pagePath)) {
      continue;
    }

    const workingLocalRelativePath = resolveArtifactWorkingLocalRelativePath(
      quads,
      meshBase,
      artifact.path,
    );
    if (!workingLocalRelativePath) {
      continue;
    }

    if (
      await addLatestHistoricalRawSourcePanelForCurrentArtifact(
        rawSourcePanels,
        workspaceRoot,
        meshBase,
        quads,
        artifact.path,
        workingLocalRelativePath,
        pagePath,
      )
    ) {
      continue;
    }

    try {
      addRawSourcePanel(
        rawSourcePanels,
        pagePath,
        await readRawSourcePanel(
          resolveAllowedLocalPath(
            localPathPolicy,
            "workingLocalRelativePath",
            workingLocalRelativePath,
          ),
          workingLocalRelativePath,
          `Current ${artifact.label} file`,
        ),
      );
    } catch (error) {
      if (
        error instanceof Deno.errors.NotFound ||
        error instanceof LocalPathAccessError
      ) {
        continue;
      }
      throw error;
    }
  }
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
  meshBase: string,
  quads: readonly Quad[],
  designatorPath: string,
  payloadArtifact: {
    workingLocalRelativePath: string;
    latestHistoricalStatePath?: string;
    latestHistoricalSnapshotPath?: string;
    latestHistoricalSnapshotTurtle?: string;
  },
): Promise<void> {
  const currentPagePath = toDesignatorResourcePagePath(designatorPath);
  await addLatestHistoricalRawSourcePanelForCurrentArtifact(
    rawSourcePanels,
    workspaceRoot,
    meshBase,
    quads,
    designatorPath,
    payloadArtifact.workingLocalRelativePath,
    currentPagePath,
    payloadArtifact.latestHistoricalSnapshotPath,
    payloadArtifact.latestHistoricalSnapshotTurtle,
  );
}

async function addLatestHistoricalRawSourcePanelForCurrentArtifact(
  rawSourcePanels: Map<string, readonly ResourcePageRawSourcePanelModel[]>,
  workspaceRoot: string,
  meshBase: string,
  quads: readonly Quad[],
  artifactPath: string,
  workingLocalRelativePath: string,
  currentPagePath: string,
  preloadedSnapshotPath?: string,
  preloadedSnapshotTurtle?: string,
): Promise<boolean> {
  const snapshotPath = resolvePreferredLatestHistoricalLocatedFilePath(
    quads,
    meshBase,
    artifactPath,
    workingLocalRelativePath,
  );
  if (!snapshotPath) {
    return false;
  }

  const latestHistoricalPanel = preloadedSnapshotPath === snapshotPath &&
    preloadedSnapshotTurtle !== undefined
    ? rawSourcePanelFromContents(
      snapshotPath,
      "Historical manifestation file",
      preloadedSnapshotTurtle,
    )
    : await readHistoricalRawSourcePanel(workspaceRoot, snapshotPath);
  if (!latestHistoricalPanel) {
    return false;
  }

  addRawSourcePanel(
    rawSourcePanels,
    currentPagePath,
    {
      ...latestHistoricalPanel,
      label: "Latest historical manifestation file",
    },
  );
  addRawSourcePanel(
    rawSourcePanels,
    `${dirname(latestHistoricalPanel.sourcePath)}/index.html`,
    latestHistoricalPanel,
  );
  return true;
}

async function readHistoricalRawSourcePanel(
  workspaceRoot: string,
  snapshotPath: string,
): Promise<ResourcePageRawSourcePanelModel | undefined> {
  try {
    return await readRawSourcePanel(
      join(workspaceRoot, snapshotPath),
      snapshotPath,
      "Historical manifestation file",
    );
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return undefined;
    }
    throw error;
  }
}

function resolvePreferredLatestHistoricalLocatedFilePath(
  quads: readonly Quad[],
  meshBase: string,
  artifactPath: string,
  workingLocalRelativePath: string,
): string | undefined {
  const artifactIri = new URL(artifactPath, meshBase).href;
  const currentHistoryPath = resolveOptionalUniqueNamedNodeMeshPath(
    quads,
    meshBase,
    artifactIri,
    SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
  );
  if (!currentHistoryPath) {
    return undefined;
  }

  const currentHistoryIri = new URL(currentHistoryPath, meshBase).href;
  if (
    !hasNamedNodeObject(
      quads,
      currentHistoryIri,
      RDF_TYPE_IRI,
      SFLO_ARTIFACT_HISTORY_IRI,
    )
  ) {
    return undefined;
  }

  const latestHistoricalStatePath = resolveOptionalUniqueNamedNodeMeshPath(
    quads,
    meshBase,
    currentHistoryIri,
    SFLO_LATEST_HISTORICAL_STATE_IRI,
  );
  if (!latestHistoricalStatePath) {
    return undefined;
  }

  return resolvePreferredHistoricalStateLocatedFilePath(
    quads,
    meshBase,
    latestHistoricalStatePath,
    workingLocalRelativePath,
  );
}

function resolvePreferredHistoricalStateLocatedFilePath(
  quads: readonly Quad[],
  meshBase: string,
  historicalStatePath: string,
  workingLocalRelativePath: string,
): string | undefined {
  const historicalStateIri = new URL(historicalStatePath, meshBase).href;
  const locatedFilePaths = new Set<string>();
  const shortcutLocatedFilePath = resolveOptionalUniqueNamedNodeMeshPath(
    quads,
    meshBase,
    historicalStateIri,
    SFLO_LOCATED_FILE_FOR_STATE_IRI,
  );
  if (shortcutLocatedFilePath) {
    locatedFilePaths.add(shortcutLocatedFilePath);
  }

  for (
    const manifestationIri of findNamedNodeObjects(
      quads,
      historicalStateIri,
      SFLO_HAS_MANIFESTATION_IRI,
    )
  ) {
    const manifestationLocatedFilePath = resolveOptionalUniqueNamedNodeMeshPath(
      quads,
      meshBase,
      manifestationIri,
      SFLO_LOCATED_FILE_FOR_MANIFESTATION_IRI,
    );
    if (manifestationLocatedFilePath) {
      locatedFilePaths.add(manifestationLocatedFilePath);
    }
  }

  return selectPreferredLocatedFilePath(
    [...locatedFilePaths],
    workingLocalRelativePath,
  );
}

function selectPreferredLocatedFilePath(
  locatedFilePaths: readonly string[],
  workingLocalRelativePath: string,
): string | undefined {
  const sortedPaths = [...locatedFilePaths].sort((left, right) =>
    left.localeCompare(right)
  );
  const preferredExtension = toPathExtension(workingLocalRelativePath);
  if (preferredExtension) {
    const extensionMatchedPath = sortedPaths.find((path) =>
      toPathExtension(path) === preferredExtension
    );
    if (extensionMatchedPath) {
      return extensionMatchedPath;
    }
  }

  return sortedPaths[0];
}

function toPathExtension(path: string): string | undefined {
  const fileName = toFileName(path);
  const extensionIndex = fileName.lastIndexOf(".");
  if (extensionIndex <= 0 || extensionIndex === fileName.length - 1) {
    return undefined;
  }

  return fileName.slice(extensionIndex + 1).toLowerCase();
}

function rawSourcePanelFromContents(
  sourcePath: string,
  label: string,
  contents: string,
): ResourcePageRawSourcePanelModel {
  const byteLength = new TextEncoder().encode(contents).byteLength;
  if (byteLength > RAW_SOURCE_INLINE_BYTE_LIMIT) {
    return {
      label,
      sourcePath,
      omittedByteLength: byteLength,
    };
  }

  return {
    label,
    sourcePath,
    contents,
  };
}

async function addReferenceTargetSourceRawSourcePanels(
  rawSourcePanels: Map<string, readonly ResourcePageRawSourcePanelModel[]>,
  workspaceRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  meshBase: string,
  designatorPath: string,
  referenceLinks: readonly ParsedResourceReferenceLink[],
): Promise<void> {
  const seen = new Set<string>();

  for (const link of referenceLinks) {
    if (!link.roleIris.includes(SFLO_REFERENCE_ROLE_CANONICAL_IRI)) {
      continue;
    }

    for (const referenceTargetPath of link.referenceTargetPaths) {
      const key = `${referenceTargetPath}\u0000${link.referenceTargetStatePaths.join("\u0000")
        }`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      await addCanonicalReferenceSourceRawSourcePanel(
        rawSourcePanels,
        workspaceRoot,
        localPathPolicy,
        meshBase,
        designatorPath,
        referenceTargetPath,
        link.referenceTargetStatePaths[0],
      );
    }
  }
}

async function addCanonicalReferenceSourceRawSourcePanel(
  rawSourcePanels: Map<string, readonly ResourcePageRawSourcePanelModel[]>,
  workspaceRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  meshBase: string,
  designatorPath: string,
  referenceTargetPath: string,
  referenceTargetStatePath: string | undefined,
): Promise<void> {
  const sourceKnopInventoryPath = join(
    workspaceRoot,
    `${toKnopPath(referenceTargetPath)}/_inventory/inventory.ttl`,
  );
  let sourceKnopInventoryTurtle: string;

  try {
    sourceKnopInventoryTurtle = await Deno.readTextFile(
      sourceKnopInventoryPath,
    );
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return;
    }
    throw error;
  }

  const sourcePayloadArtifact = resolvePayloadArtifactInventoryState(
    meshBase,
    sourceKnopInventoryTurtle,
    referenceTargetPath,
    {
      parseErrorMessage:
        `Could not parse the canonical reference target Knop inventory while resolving page source facts for ${designatorPath}.`,
      missingWorkingFileMessage:
        `Could not resolve the canonical reference target working payload file for ${designatorPath}.`,
    },
  );
  if (!sourcePayloadArtifact) {
    return;
  }

  if (!referenceTargetStatePath) {
    try {
      addRawSourcePanel(
        rawSourcePanels,
        toDesignatorResourcePagePath(designatorPath),
        await readRawSourcePanel(
          await resolvePayloadWorkingSourcePath(
            localPathPolicy,
            sourcePayloadArtifact,
          ),
          sourcePayloadArtifact.workingLocalRelativePath,
          "Current canonical reference source file",
        ),
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
    return;
  }

  const snapshotPath = sourcePayloadArtifact.latestHistoricalStatePath ===
    referenceTargetStatePath &&
    sourcePayloadArtifact.latestHistoricalSnapshotPath
    ? sourcePayloadArtifact.latestHistoricalSnapshotPath
    : toPayloadHistoricalSnapshotPath(
      referenceTargetStatePath,
      sourcePayloadArtifact.workingLocalRelativePath,
    );

  try {
    addRawSourcePanel(
      rawSourcePanels,
      toDesignatorResourcePagePath(designatorPath),
      await readRawSourcePanel(
        join(workspaceRoot, snapshotPath),
        snapshotPath,
        "Exact canonical reference source file",
      ),
    );
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return;
    }
    throw error;
  }
}

async function addExtractionSourceRawSourcePanels(
  rawSourcePanels: Map<string, readonly ResourcePageRawSourcePanelModel[]>,
  workspaceRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  meshBase: string,
  designatorPath: string,
  sourceArtifactPath: string,
  requestedTargetStatePath: string | undefined,
  artifactResolutionModeIri: string | undefined,
): Promise<void> {
  const sourceKnopInventoryPath = join(
    workspaceRoot,
    `${toKnopPath(sourceArtifactPath)}/_inventory/inventory.ttl`,
  );
  let sourceKnopInventoryTurtle: string;

  try {
    sourceKnopInventoryTurtle = await Deno.readTextFile(
      sourceKnopInventoryPath,
    );
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new WeaveRuntimeError(
        `Workspace is missing the page source payload inventory for ${designatorPath}: ${toKnopPath(sourceArtifactPath)
        }/_inventory/inventory.ttl`,
      );
    }
    throw error;
  }

  const sourcePayloadArtifact = resolvePayloadArtifactInventoryState(
    meshBase,
    sourceKnopInventoryTurtle,
    sourceArtifactPath,
    {
      parseErrorMessage:
        `Could not parse the source Knop inventory while resolving page source facts for ${designatorPath}.`,
      missingWorkingFileMessage:
        `Could not resolve the source working payload file for ${designatorPath}.`,
    },
  );
  if (!sourcePayloadArtifact) {
    return;
  }

  if (artifactResolutionModeIri === SFLO_ARTIFACT_RESOLUTION_MODE_WORKING_IRI) {
    try {
      addRawSourcePanel(
        rawSourcePanels,
        toDesignatorResourcePagePath(designatorPath),
        await readRawSourcePanel(
          await resolvePayloadWorkingSourcePath(
            localPathPolicy,
            sourcePayloadArtifact,
          ),
          sourcePayloadArtifact.workingLocalRelativePath,
          "Working source file",
        ),
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
    return;
  }

  if (
    artifactResolutionModeIri === SFLO_ARTIFACT_RESOLUTION_MODE_LATEST_STATE_IRI
  ) {
    requestedTargetStatePath = sourcePayloadArtifact.latestHistoricalStatePath;
  }
  if (!requestedTargetStatePath) {
    throw new WeaveRuntimeError(
      `Extracted page source for ${designatorPath} is missing an exact target state.`,
    );
  }

  const snapshotPath = sourcePayloadArtifact.latestHistoricalStatePath ===
    requestedTargetStatePath &&
    sourcePayloadArtifact.latestHistoricalSnapshotPath
    ? sourcePayloadArtifact.latestHistoricalSnapshotPath
    : toPayloadHistoricalSnapshotPath(
      requestedTargetStatePath,
      sourcePayloadArtifact.workingLocalRelativePath,
    );

  try {
    addRawSourcePanel(
      rawSourcePanels,
      toDesignatorResourcePagePath(designatorPath),
      await readRawSourcePanel(
        join(workspaceRoot, snapshotPath),
        snapshotPath,
        "Exact source file",
      ),
    );
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new WeaveRuntimeError(
        `Workspace is missing the exact page source file for ${designatorPath}: ${snapshotPath}`,
      );
    }
    throw error;
  }
}

async function resolvePayloadWorkingSourcePath(
  localPathPolicy: OperationalLocalPathPolicy,
  payloadArtifact: {
    workingLocalRelativePath: string;
    repositorySourceFloatingLocator?: RepositorySourceFloatingLocator;
  },
): Promise<string> {
  return payloadArtifact.repositorySourceFloatingLocator
    ? await resolveRepositorySourceFloatingLocalPath(
      localPathPolicy,
      payloadArtifact.repositorySourceFloatingLocator,
    )
    : resolveAllowedLocalPath(
      localPathPolicy,
      "workingLocalRelativePath",
      payloadArtifact.workingLocalRelativePath,
    );
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

function describeSemanticFlowResource(
  meshBase: string,
  resourcePath: string,
  historyGroups: readonly ResourcePageHistoryGroupModel[],
  ownerRawSourcePanels?: readonly ResourcePageRawSourcePanelModel[],
): string {
  const displayPath = resourcePath.length === 0 ? "/" : resourcePath;
  const manifestationState = findHistoryStateForManifestation(
    resourcePath,
    historyGroups,
  );
  if (manifestationState) {
    return `Artifact manifestation for the ${toLastPathSegment(manifestationState.path)
      } historical state`;
  }
  const stateHistory = findHistoryForState(resourcePath, historyGroups);
  if (stateHistory) {
    return `Historical state for the ${toLastPathSegment(stateHistory.path)
      } artifact history`;
  }
  if (historyGroups.some((group) => group.path === resourcePath)) {
    const ownerResourcePath = dirname(resourcePath);
    const ownerTitle = ownerRawSourcePanels
      ? extractResourceTitle(
        meshBase,
        ownerResourcePath,
        ownerRawSourcePanels,
      )
      : undefined;
    return `Artifact history for ${ownerTitle ?? formatOwnerResourcePath(ownerResourcePath)
      }`;
  }
  if (resourcePath === "_mesh") {
    return "Semantic Mesh.";
  }
  if (resourcePath.endsWith("/_knop") || resourcePath === "_knop") {
    return `Semantic Flow bundle of supporting data for ${formatOwnerResourcePath(dirname(resourcePath))
      }.`;
  }
  if (resourcePath.endsWith("/_meta")) {
    if (resourcePath === "_mesh/_meta") {
      return "Metadata for this Semantic Mesh";
    }
    return `Knop metadata for ${formatOwnerResourcePath(dirname(dirname(resourcePath)))
      }`;
  }
  if (resourcePath.endsWith("/_inventory")) {
    if (resourcePath === "_mesh/_inventory") {
      return "Inventory for this Semantic Mesh";
    }
    return `Inventory for ${formatOwnerResourcePath(dirname(resourcePath))}`;
  }
  if (resourcePath.endsWith("/_config")) {
    return "Configuration for this Semantic Mesh";
  }
  return `Semantic Flow resource ${displayPath}`;
}

function findHistoryStateForManifestation(
  resourcePath: string,
  historyGroups: readonly ResourcePageHistoryGroupModel[],
): ResourcePageHistoryGroupModel["states"][number] | undefined {
  for (const group of historyGroups) {
    const state = group.states.find((candidate) =>
      candidate.manifestationPath === resourcePath
    );
    if (state) {
      return state;
    }
  }
  return undefined;
}

function findHistoryForState(
  resourcePath: string,
  historyGroups: readonly ResourcePageHistoryGroupModel[],
): ResourcePageHistoryGroupModel | undefined {
  return historyGroups.find((group) =>
    group.states.some((state) => state.path === resourcePath)
  );
}

function isHistoryComponentResource(
  resourcePath: string,
  historyGroups: readonly ResourcePageHistoryGroupModel[],
): boolean {
  return historyGroups.some((group) =>
    group.path === resourcePath ||
    group.states.some((state) =>
      state.path === resourcePath ||
      state.manifestationPath === resourcePath ||
      state.locatedFilePath === resourcePath
    )
  );
}

function findOwnerRawSourcePanelsForArtifactHistory(
  resourcePath: string,
  historyGroups: readonly ResourcePageHistoryGroupModel[],
  meshRawSourcePanels: ReadonlyMap<
    string,
    readonly ResourcePageRawSourcePanelModel[]
  >,
  designatorContexts: readonly GenerateDesignatorContext[],
): readonly ResourcePageRawSourcePanelModel[] | undefined {
  if (!historyGroups.some((group) => group.path === resourcePath)) {
    return undefined;
  }
  const ownerPagePath = toDesignatorResourcePagePath(dirname(resourcePath));
  return meshRawSourcePanels.get(ownerPagePath) ??
    findRawSourcePanelsForPage(ownerPagePath, designatorContexts);
}

function findOwnerRawSourcePanelsForArtifactHistoryInContext(
  resourcePath: string,
  historyGroups: readonly ResourcePageHistoryGroupModel[],
  context: GenerateDesignatorContext,
): readonly ResourcePageRawSourcePanelModel[] | undefined {
  if (!historyGroups.some((group) => group.path === resourcePath)) {
    return undefined;
  }
  return context.rawSourcePanels.get(
    toDesignatorResourcePagePath(dirname(resourcePath)),
  );
}

function extractResourceTitle(
  meshBase: string,
  resourcePath: string,
  rawSourcePanels: readonly ResourcePageRawSourcePanelModel[],
): string | undefined {
  const canonical = new URL(resourcePath, meshBase).href;
  const quads = rawSourcePanels.flatMap((panel) =>
    panel.contents ? parseRawSourcePanel(canonical, panel.contents) : []
  );

  return findFirstLiteralObject(quads, canonical, DCTERMS_TITLE_IRI);
}

function extractResourceRdfTypes(
  meshBase: string,
  resourcePath: string,
  rawSourcePanels: readonly ResourcePageRawSourcePanelModel[],
): readonly string[] {
  const canonical = new URL(resourcePath, meshBase).href;
  const quads = rawSourcePanels.flatMap((panel) =>
    panel.contents ? parseRawSourcePanel(canonical, panel.contents) : []
  );
  const types = new Set<string>();

  for (const quad of quads) {
    if (
      quad.subject.termType === "NamedNode" &&
      quad.subject.value === canonical &&
      quad.predicate.value === RDF_TYPE_IRI &&
      quad.object.termType === "NamedNode"
    ) {
      types.add(quad.object.value);
    }
  }

  return [...types].sort();
}

function parseRawSourcePanel(
  canonical: string,
  turtle: string,
): readonly Quad[] {
  try {
    return new Parser({ baseIRI: canonical }).parse(turtle);
  } catch {
    return [];
  }
}

function findFirstLiteralObject(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
): string | undefined {
  for (const quad of quads) {
    if (
      quad.subject.termType === "NamedNode" &&
      quad.subject.value === subjectIri &&
      quad.predicate.value === predicateIri &&
      quad.object.termType === "Literal"
    ) {
      return quad.object.value;
    }
  }
  return undefined;
}

function formatOwnerResourcePath(resourcePath: string): string {
  if (resourcePath === "." || resourcePath.length === 0) {
    return "/";
  }
  return resourcePath;
}

function toLastPathSegment(path: string): string {
  const segments = path.split("/").filter((segment) => segment.length > 0);
  return segments[segments.length - 1] ?? "/";
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
    ResolvedResourcePageHistoryGroupModel[]
  >();
  const historyGroupByPath = new Map<
    string,
    ResolvedResourcePageHistoryGroupModel
  >();
  const currentHistoryByArtifactPath = new Map<string, string>();
  const resolveHistoryGroup = (historyPath: string) => {
    const cached = historyGroupByPath.get(historyPath);
    if (cached) {
      return cached;
    }
    const historyGroup = resolveArtifactHistoryGroup(
      meshBase,
      quads,
      historyPath,
    );
    historyGroupByPath.set(historyPath, historyGroup);
    return historyGroup;
  };

  for (const quad of quads) {
    if (
      quad.subject.termType !== "NamedNode" ||
      (quad.predicate.value !== SFLO_HAS_ARTIFACT_HISTORY_IRI &&
        quad.predicate.value !== SFLO_CURRENT_ARTIFACT_HISTORY_IRI) ||
      quad.object.termType !== "NamedNode"
    ) {
      continue;
    }

    const artifactPath = toMeshPath(meshBase, quad.subject.value);
    const historyPath = toMeshPath(meshBase, quad.object.value);
    if (artifactPath === undefined || historyPath === undefined) {
      continue;
    }

    if (quad.predicate.value === SFLO_CURRENT_ARTIFACT_HISTORY_IRI) {
      currentHistoryByArtifactPath.set(artifactPath, historyPath);
    }
    addHistoryGroup(
      groupsByResourcePath,
      artifactPath,
      resolveHistoryGroup(historyPath),
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
    if (historyPath === undefined) {
      continue;
    }

    addHistoryGroup(
      groupsByResourcePath,
      historyPath,
      resolveHistoryGroup(historyPath),
    );
  }

  for (const historyGroups of [...groupsByResourcePath.values()]) {
    for (const historyGroup of historyGroups) {
      for (const state of historyGroup.states) {
        addHistoryGroup(groupsByResourcePath, state.path, historyGroup);
        if (state.manifestationPath) {
          addHistoryGroup(
            groupsByResourcePath,
            state.manifestationPath,
            historyGroup,
          );
        }
      }
    }
  }

  for (const [resourcePath, historyGroups] of groupsByResourcePath) {
    groupsByResourcePath.set(
      resourcePath,
      sortHistoryGroupsByRecency(
        historyGroups,
        currentHistoryByArtifactPath.get(resourcePath),
      ),
    );
  }

  return groupsByResourcePath;
}

interface ResolvedResourcePageHistoryGroupModel
  extends ResourcePageHistoryGroupModel {
  historyOrdinal?: number;
  latestStatePath?: string;
  latestStateOrdinal?: number;
}

function addHistoryGroup(
  groupsByResourcePath: Map<string, ResolvedResourcePageHistoryGroupModel[]>,
  resourcePath: string,
  historyGroup: ResolvedResourcePageHistoryGroupModel,
): void {
  const existingGroups = groupsByResourcePath.get(resourcePath) ?? [];
  if (existingGroups.some((group) => group.path === historyGroup.path)) {
    return;
  }
  groupsByResourcePath.set(resourcePath, [...existingGroups, historyGroup]);
}

function sortHistoryGroupsByRecency(
  historyGroups: readonly ResolvedResourcePageHistoryGroupModel[],
  currentHistoryPath?: string,
): ResolvedResourcePageHistoryGroupModel[] {
  return [...historyGroups].sort((left, right) =>
    compareHistoryGroupRecency(left, right, currentHistoryPath)
  );
}

function compareHistoryGroupRecency(
  left: ResolvedResourcePageHistoryGroupModel,
  right: ResolvedResourcePageHistoryGroupModel,
  currentHistoryPath?: string,
): number {
  if (left.path === currentHistoryPath && right.path !== currentHistoryPath) {
    return -1;
  }
  if (right.path === currentHistoryPath && left.path !== currentHistoryPath) {
    return 1;
  }
  if (
    left.historyOrdinal !== undefined &&
    right.historyOrdinal !== undefined &&
    left.historyOrdinal !== right.historyOrdinal
  ) {
    return right.historyOrdinal - left.historyOrdinal;
  }
  if (
    left.latestStateOrdinal !== undefined &&
    right.latestStateOrdinal !== undefined &&
    left.latestStateOrdinal !== right.latestStateOrdinal
  ) {
    return right.latestStateOrdinal - left.latestStateOrdinal;
  }
  return 0;
}

function resolveArtifactHistoryGroup(
  meshBase: string,
  quads: readonly Quad[],
  historyPath: string,
): ResolvedResourcePageHistoryGroupModel {
  const historyIri = new URL(historyPath, meshBase).href;
  const statePaths = new Set<string>();
  const historyOrdinal = resolveOptionalNonNegativeIntegerLiteral(
    quads,
    historyIri,
    SFLO_HISTORY_ORDINAL_IRI,
  );
  const assertedLatestStatePath = resolveFirstMeshPathObject(
    meshBase,
    quads,
    historyIri,
    SFLO_LATEST_HISTORICAL_STATE_IRI,
  );

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

  const sortedStatePaths = [...statePaths].sort((left, right) =>
    left.localeCompare(right)
  );
  const latestStatePath = assertedLatestStatePath ??
    sortedStatePaths[sortedStatePaths.length - 1];
  const latestStateOrdinal = latestStatePath
    ? resolveOptionalNonNegativeIntegerLiteral(
      quads,
      new URL(latestStatePath, meshBase).href,
      SFLO_STATE_ORDINAL_IRI,
    )
    : undefined;

  return {
    label: "Artifact history",
    path: historyPath,
    ...(historyOrdinal === undefined ? {} : { historyOrdinal }),
    ...(latestStatePath === undefined ? {} : { latestStatePath }),
    ...(latestStateOrdinal === undefined ? {} : { latestStateOrdinal }),
    states: sortedStatePaths.map((statePath) =>
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
      SFLO_LOCATED_FILE_FOR_MANIFESTATION_IRI,
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

function resolveOptionalNonNegativeIntegerLiteral(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
): number | undefined {
  for (const quad of quads) {
    if (
      quad.subject.termType !== "NamedNode" ||
      quad.subject.value !== subjectIri ||
      quad.predicate.value !== predicateIri ||
      quad.object.termType !== "Literal"
    ) {
      continue;
    }

    const value = quad.object.value;
    if (/^[0-9]+$/.test(value)) {
      return Number(value);
    }
  }
  return undefined;
}

function resolveArtifactWorkingLocalRelativePath(
  quads: readonly Quad[],
  meshBase: string,
  artifactPath: string,
): string | undefined {
  const artifactIri = new URL(artifactPath, meshBase).href;
  const literalValue = resolveOptionalUniqueLiteralObject(
    quads,
    artifactIri,
    SFLO_WORKING_FILE_PATH_IRI,
  );
  const locatedFileValue = resolveOptionalUniqueNamedNodeMeshPath(
    quads,
    meshBase,
    artifactIri,
    SFLO_HAS_WORKING_LOCATED_FILE_IRI,
  );

  if (
    literalValue !== undefined &&
    locatedFileValue !== undefined &&
    literalValue !== locatedFileValue
  ) {
    return undefined;
  }

  return literalValue ?? locatedFileValue;
}

function resolveOptionalUniqueLiteralObject(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
): string | undefined {
  const values = new Set<string>();
  for (const quad of quads) {
    if (
      quad.subject.termType !== "NamedNode" ||
      quad.subject.value !== subjectIri ||
      quad.predicate.value !== predicateIri ||
      quad.object.termType !== "Literal"
    ) {
      continue;
    }

    values.add(quad.object.value);
  }

  return values.size === 1 ? values.values().next().value! : undefined;
}

function resolveOptionalUniqueNamedNodeMeshPath(
  quads: readonly Quad[],
  meshBase: string,
  subjectIri: string,
  predicateIri: string,
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

    const meshPath = toMeshPath(meshBase, quad.object.value);
    if (meshPath !== undefined) {
      values.add(meshPath);
    }
  }

  return values.size === 1 ? values.values().next().value! : undefined;
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
  const manifestationSegment = toDefaultManifestationSegment(fileName);
  return `${historyStatePath}/${manifestationSegment}/${fileName}`;
}

function toFileName(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1]!;
}

function toDefaultManifestationSegment(fileName: string): string {
  const extensionIndex = fileName.lastIndexOf(".");
  return extensionIndex > 0 && extensionIndex < fileName.length - 1
    ? fileName.slice(extensionIndex + 1)
    : fileName.replaceAll(".", "-");
}

async function sha256Digest(contents: string): Promise<string> {
  const bytes = new TextEncoder().encode(contents);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
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
