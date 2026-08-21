import { dirname, join } from "@std/path";
import type { PlannedFile } from "../../core/planned_file.ts";
import {
  type NormalizedTargetSpec,
  resolveTargetSelections,
} from "../../core/targeting.ts";
import type { ResourcePageModel } from "../../core/weave/resource_page_models.ts";
import { WeaveInputError } from "../../core/weave/weave.ts";
import { listKnopDesignatorPaths } from "../mesh/inventory.ts";
import type { OperationalLocalPathPolicy } from "../operational/local_path_policy.ts";
import type { StructuredLogger } from "../logging/logger.ts";
import type { RuntimeTiming } from "../timing.ts";
import type { HistoryTrackingPolicy } from "../config/effective_config.ts";
import type { RuntimeMemoryStats } from "./memory_stats.ts";
import {
  createEffectiveConfigProviderForExecution,
  type EffectiveConfigProvider,
} from "./execution_config.ts";
import { loadMeshState, type MeshState } from "./mesh_state.ts";
import {
  collectResourcePageModels,
  resolveMeshFaviconPath,
  visitResourcePageModels,
} from "./page_model_assembly.ts";
import {
  renderResourcePages,
  RESOURCE_PAGE_RENDER_CONCURRENCY,
} from "./pages.ts";
import { timeOptional, timeOptionalSync } from "./timing_helpers.ts";
import { toWorkspaceRelativePath } from "./workspace_paths.ts";

export interface GeneratePreparedPagesOptions {
  meshRoot: string;
  localPathPolicy: OperationalLocalPathPolicy;
  targets: readonly NormalizedTargetSpec[];
  operationalLogger: StructuredLogger;
  now?: () => Date;
  includeSemanticFlowMetadata: boolean;
  historyTrackingPolicyOverride?: HistoryTrackingPolicy;
  updateTimestampOnlyPages?: boolean;
  timing?: RuntimeTiming;
  memoryStats?: RuntimeMemoryStats;
  phasePrefix?: string;
}

export interface GeneratePreparedPagesResult {
  meshBase: string;
  generatedDesignatorPaths: readonly string[];
  createdPaths: readonly string[];
  updatedPaths: readonly string[];
  skippedTimestampOnlyPaths: readonly string[];
}

export interface RegeneratePreparedPagePathsOptions {
  meshRoot: string;
  localPathPolicy: OperationalLocalPathPolicy;
  pagePaths: readonly string[];
  historyTrackingPolicyOverride?: HistoryTrackingPolicy;
  timing?: RuntimeTiming;
  phasePrefix?: string;
}

export async function generatePreparedPages(
  options: GeneratePreparedPagesOptions,
): Promise<GeneratePreparedPagesResult> {
  const phase = (name: string) =>
    options.phasePrefix ? `${options.phasePrefix}.${name}` : name;
  const meshState = await timeOptional(
    options.timing,
    phase("loadMeshState"),
    () => loadMeshState(options.meshRoot),
  );
  const allDesignatorPaths = timeOptionalSync(
    options.timing,
    phase("listDesignatorPaths"),
    () =>
      listKnopDesignatorPaths(
        meshState.meshBase,
        meshState.currentMeshInventoryTurtle,
        "Could not parse the current MeshInventory while resolving generate targets.",
      ),
  );
  const selectedDesignatorPaths = timeOptionalSync(
    options.timing,
    phase("resolveTargets"),
    () =>
      resolveSelectedDesignatorPaths(
        allDesignatorPaths,
        options.targets,
      ),
  );
  const effectiveConfigProvider = createEffectiveConfigProviderForExecution({
    meshRoot: options.meshRoot,
    meshState,
    localPathPolicy: options.localPathPolicy,
    historyTrackingPolicyOverride: options.historyTrackingPolicyOverride,
    includeSemanticFlowMetadata: options.includeSemanticFlowMetadata,
    timing: options.timing,
    phasePrefix: phase("effectiveConfig"),
  });
  const writeResult = await generateAndWriteResourcePages({
    workspaceRoot: options.meshRoot,
    localPathPolicy: options.localPathPolicy,
    meshState,
    selectedDesignatorPaths,
    includeAllMeshPages: options.targets.length === 0,
    hasExplicitGenerateTargets: options.targets.length > 0,
    effectiveConfigProvider,
    generatedAt: resolveGeneratedAt(options.now),
    updateTimestampOnlyPages: options.updateTimestampOnlyPages === true,
    timing: options.timing,
    memoryStats: options.memoryStats,
    phasePrefix: phase("collectGeneratedPageFiles"),
    writePhase: phase("writePages"),
  });

  const result = {
    meshBase: meshState.meshBase,
    generatedDesignatorPaths: selectedDesignatorPaths,
    createdPaths: writeResult.createdPaths.map((path) =>
      toWorkspaceRelativePath(options.localPathPolicy, path)
    ),
    updatedPaths: writeResult.updatedPaths.map((path) =>
      toWorkspaceRelativePath(options.localPathPolicy, path)
    ),
    skippedTimestampOnlyPaths: writeResult.skippedTimestampOnlyPaths.map((
      path,
    ) => toWorkspaceRelativePath(options.localPathPolicy, path)),
  };
  if (result.skippedTimestampOnlyPaths.length > 0) {
    await options.operationalLogger.info(
      "generate.timestampOnlySkipped",
      "Skipped generated pages with timestamp-only differences",
      {
        skippedTimestampOnlyPaths: result.skippedTimestampOnlyPaths,
      },
    );
  }
  return result;
}

export async function regeneratePreparedPagePaths(
  options: RegeneratePreparedPagePathsOptions,
): Promise<GeneratePreparedPagesResult> {
  if (options.pagePaths.length === 0) {
    throw new WeaveInputError(
      "At least one generated ResourcePage path is required for regeneration.",
    );
  }
  const phase = (name: string) =>
    options.phasePrefix ? `${options.phasePrefix}.${name}` : name;
  const meshState = await timeOptional(
    options.timing,
    phase("loadMeshState"),
    () => loadMeshState(options.meshRoot),
  );
  const effectiveConfigProvider = createEffectiveConfigProviderForExecution({
    meshRoot: options.meshRoot,
    meshState,
    localPathPolicy: options.localPathPolicy,
    historyTrackingPolicyOverride: options.historyTrackingPolicyOverride,
    includeSemanticFlowMetadata: false,
    timing: options.timing,
    phasePrefix: phase("effectiveConfig"),
  });
  const pageModels = await timeOptional(
    options.timing,
    phase("collectResourcePageModels"),
    () =>
      collectResourcePageModels({
        workspaceRoot: options.meshRoot,
        localPathPolicy: options.localPathPolicy,
        meshState,
        selectedDesignatorPaths: [],
        includeAllMeshPages: false,
        hasExplicitGenerateTargets: false,
        effectiveConfigProvider,
        timing: options.timing,
        phasePrefix: phase("collectResourcePageModels"),
      }),
  );
  const requestedPaths = new Set(options.pagePaths);
  const selectedPageModels = pageModels.filter((page) =>
    requestedPaths.has(page.path)
  );
  const selectedPaths = new Set(selectedPageModels.map((page) => page.path));
  const missingPaths = options.pagePaths.filter((path) =>
    !selectedPaths.has(path)
  );
  if (missingPaths.length > 0) {
    throw new WeaveInputError(
      `Could not regenerate planned ResourcePage paths from the settled inventory: ${
        missingPaths.join(", ")
      }.`,
    );
  }

  const meshFaviconPath = await resolveMeshFaviconPath(options.meshRoot);
  const generatedAt = resolveGeneratedAt();
  const writeResult = emptyGeneratedPagesWriteResult();
  let renderDurationMs = 0;
  let writeDurationMs = 0;
  for (
    let start = 0;
    start < selectedPageModels.length;
    start += RESOURCE_PAGE_RENDER_CONCURRENCY
  ) {
    const batchResult = await renderAndWriteResourcePageBatch({
      workspaceRoot: options.meshRoot,
      meshBase: meshState.meshBase,
      pages: selectedPageModels.slice(
        start,
        start + RESOURCE_PAGE_RENDER_CONCURRENCY,
      ),
      generatedAt,
      meshFaviconPath,
      effectiveConfigProvider,
      updateTimestampOnlyPages: false,
    });
    appendGeneratedPagesWriteResult(writeResult, batchResult.writeResult);
    renderDurationMs += batchResult.renderDurationMs;
    writeDurationMs += batchResult.writeDurationMs;
  }
  options.timing?.record(phase("renderResourcePages"), renderDurationMs);
  options.timing?.record(phase("writePages"), writeDurationMs);

  return {
    meshBase: meshState.meshBase,
    generatedDesignatorPaths: [],
    createdPaths: writeResult.createdPaths.map((path) =>
      toWorkspaceRelativePath(options.localPathPolicy, path)
    ),
    updatedPaths: writeResult.updatedPaths.map((path) =>
      toWorkspaceRelativePath(options.localPathPolicy, path)
    ),
    skippedTimestampOnlyPaths: writeResult.skippedTimestampOnlyPaths.map(
      (path) => toWorkspaceRelativePath(options.localPathPolicy, path),
    ),
  };
}

interface GenerateAndWriteResourcePagesOptions {
  workspaceRoot: string;
  localPathPolicy: OperationalLocalPathPolicy;
  meshState: MeshState;
  selectedDesignatorPaths: readonly string[];
  includeAllMeshPages: boolean;
  hasExplicitGenerateTargets: boolean;
  effectiveConfigProvider: EffectiveConfigProvider;
  generatedAt: Date;
  updateTimestampOnlyPages: boolean;
  timing?: RuntimeTiming;
  memoryStats?: RuntimeMemoryStats;
  phasePrefix: string;
  writePhase: string;
}

interface GeneratedPagesWriteResult {
  createdPaths: string[];
  updatedPaths: string[];
  skippedTimestampOnlyPaths: string[];
}

async function generateAndWriteResourcePages(
  options: GenerateAndWriteResourcePagesOptions,
): Promise<GeneratedPagesWriteResult> {
  const startedAt = performance.now();
  let renderDurationMs = 0;
  let writeDurationMs = 0;
  let renderedAnyBatch = false;
  const writeResult = emptyGeneratedPagesWriteResult();
  const pageBatch: ResourcePageModel[] = [];
  const meshFaviconPath = await resolveMeshFaviconPath(options.workspaceRoot);
  options.memoryStats?.sampleRss();

  const flushBatch = async () => {
    if (pageBatch.length === 0) {
      return;
    }
    const pages = pageBatch.splice(0, pageBatch.length);
    const batchResult = await renderAndWriteResourcePageBatch({
      workspaceRoot: options.workspaceRoot,
      meshBase: options.meshState.meshBase,
      pages,
      generatedAt: options.generatedAt,
      meshFaviconPath,
      effectiveConfigProvider: options.effectiveConfigProvider,
      updateTimestampOnlyPages: options.updateTimestampOnlyPages,
      memoryStats: options.memoryStats,
    });
    renderedAnyBatch = true;
    renderDurationMs += batchResult.renderDurationMs;
    writeDurationMs += batchResult.writeDurationMs;
    appendGeneratedPagesWriteResult(writeResult, batchResult.writeResult);
  };

  try {
    await visitResourcePageModels({
      workspaceRoot: options.workspaceRoot,
      localPathPolicy: options.localPathPolicy,
      meshState: options.meshState,
      selectedDesignatorPaths: options.selectedDesignatorPaths,
      includeAllMeshPages: options.includeAllMeshPages,
      hasExplicitGenerateTargets: options.hasExplicitGenerateTargets,
      effectiveConfigProvider: options.effectiveConfigProvider,
      timing: options.timing,
      phasePrefix: options.phasePrefix,
    }, async (page) => {
      pageBatch.push(page);
      if (pageBatch.length === RESOURCE_PAGE_RENDER_CONCURRENCY) {
        await flushBatch();
      }
    });
    await flushBatch();
    return writeResult;
  } finally {
    const elapsedMs = performance.now() - startedAt;
    options.timing?.record(
      options.phasePrefix,
      Math.max(0, elapsedMs - writeDurationMs),
    );
    if (renderedAnyBatch) {
      options.timing?.record(
        `${options.phasePrefix}.renderResourcePages`,
        renderDurationMs,
      );
      options.timing?.record(options.writePhase, writeDurationMs);
    }
  }
}

async function renderAndWriteResourcePageBatch(options: {
  workspaceRoot: string;
  meshBase: string;
  pages: readonly ResourcePageModel[];
  generatedAt: Date;
  meshFaviconPath?: string;
  effectiveConfigProvider: EffectiveConfigProvider;
  updateTimestampOnlyPages: boolean;
  memoryStats?: RuntimeMemoryStats;
}): Promise<{
  writeResult: GeneratedPagesWriteResult;
  renderDurationMs: number;
  writeDurationMs: number;
}> {
  const renderStartedAt = performance.now();
  const pageFiles = await renderResourcePages(options.meshBase, options.pages, {
    generatedAt: options.generatedAt,
    includeSemanticFlowMetadata: false,
    meshFaviconPath: options.meshFaviconPath,
    resourcePagePresentationForPage: (page) =>
      resourcePagePresentationForGeneratedPage(
        options.effectiveConfigProvider,
        page,
      ),
  });
  const renderDurationMs = performance.now() - renderStartedAt;
  options.memoryStats?.samplePageRenderBatch(pageFiles);

  const writeStartedAt = performance.now();
  const writeResult = await writeGeneratedPagesUpsert(
    options.workspaceRoot,
    pageFiles,
    { updateTimestampOnlyPages: options.updateTimestampOnlyPages },
  );
  const writeDurationMs = performance.now() - writeStartedAt;
  options.memoryStats?.sampleRss();
  return { writeResult, renderDurationMs, writeDurationMs };
}

function emptyGeneratedPagesWriteResult(): GeneratedPagesWriteResult {
  return {
    createdPaths: [],
    updatedPaths: [],
    skippedTimestampOnlyPaths: [],
  };
}

function appendGeneratedPagesWriteResult(
  target: GeneratedPagesWriteResult,
  source: GeneratedPagesWriteResult,
): void {
  target.createdPaths.push(...source.createdPaths);
  target.updatedPaths.push(...source.updatedPaths);
  target.skippedTimestampOnlyPaths.push(...source.skippedTimestampOnlyPaths);
}

async function resourcePagePresentationForGeneratedPage(
  effectiveConfigProvider: EffectiveConfigProvider,
  page: ResourcePageModel,
) {
  const ownerDesignatorPath = ownerDesignatorPathForPage(page);
  return ownerDesignatorPath === undefined
    ? await effectiveConfigProvider.resourcePagePresentationForMeshScope()
    : await effectiveConfigProvider.resourcePagePresentationForTarget(
      ownerDesignatorPath,
    );
}

export function ownerDesignatorPathForPage(
  page: ResourcePageModel,
): string | undefined {
  if (page.path.startsWith("_mesh/")) {
    return undefined;
  }
  if (
    page.kind === "identifier" ||
    page.kind === "customIdentifier" ||
    page.kind === "knop"
  ) {
    return page.designatorPath;
  }
  if (page.kind === "referenceCatalog") {
    return page.ownerDesignatorPath;
  }
  if (page.ownerDesignatorPath !== undefined) {
    return page.ownerDesignatorPath;
  }

  const resourcePath = page.path === "index.html"
    ? ""
    : page.path.endsWith("/index.html")
    ? page.path.slice(0, -"/index.html".length)
    : page.path;
  const knopMarker = resourcePath === "_knop"
    ? 0
    : resourcePath.indexOf("/_knop");
  if (knopMarker === 0) {
    return "";
  }
  if (knopMarker > 0) {
    return resourcePath.slice(0, knopMarker);
  }
  const historyMarker = resourcePath.indexOf("/_history");
  if (historyMarker > 0) {
    return resourcePath.slice(0, historyMarker);
  }
  if (resourcePath.startsWith("_history")) {
    return "";
  }
  return resourcePath;
}

function resolveSelectedDesignatorPaths(
  allDesignatorPaths: readonly string[],
  targets: readonly NormalizedTargetSpec[],
): readonly string[] {
  return resolveTargetSelections(
    allDesignatorPaths,
    targets,
    (message) => new WeaveInputError(message),
  ).map((selection) => selection.designatorPath);
}

function resolveGeneratedAt(now?: () => Date): Date {
  return now ? now() : new Date();
}

const GENERATED_TIMESTAMP_FOOTER_PATTERN =
  /Generated on <span class="wf-term wf-date-tip" tabindex="0" title="[^"]*" data-tooltip="[^"]*">[^<]*<\/span> by/g;

function normalizeGeneratedTimestampFooters(contents: string): string {
  return contents.replace(
    GENERATED_TIMESTAMP_FOOTER_PATTERN,
    'Generated on <span class="wf-term wf-date-tip" tabindex="0" title="__GENERATED_AT__" data-tooltip="__GENERATED_AT__">__GENERATED_AT_DISPLAY__</span> by',
  );
}

async function writeGeneratedPagesUpsert(
  workspaceRoot: string,
  files: readonly PlannedFile[],
  options: { updateTimestampOnlyPages: boolean },
): Promise<{
  createdPaths: string[];
  updatedPaths: string[];
  skippedTimestampOnlyPaths: string[];
}> {
  const createdPaths: string[] = [];
  const updatedPaths: string[] = [];
  const skippedTimestampOnlyPaths: string[] = [];

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

    if (
      exists &&
      currentContents !== undefined &&
      normalizeGeneratedTimestampFooters(currentContents) ===
        normalizeGeneratedTimestampFooters(file.contents)
    ) {
      if (!options.updateTimestampOnlyPages) {
        skippedTimestampOnlyPaths.push(file.path);
        continue;
      }
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
    skippedTimestampOnlyPaths,
  };
}
