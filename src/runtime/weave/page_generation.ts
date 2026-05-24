import { dirname, join } from "@std/path";
import type { PlannedFile } from "../../core/planned_file.ts";
import {
  type NormalizedTargetSpec,
  resolveTargetSelections,
} from "../../core/targeting.ts";
import { WeaveInputError } from "../../core/weave/weave.ts";
import { listKnopDesignatorPaths } from "../mesh/inventory.ts";
import type { OperationalLocalPathPolicy } from "../operational/local_path_policy.ts";
import type { StructuredLogger } from "../logging/logger.ts";
import type { RuntimeTiming } from "../timing.ts";
import type { HistoryTrackingPolicy } from "../config/effective_config.ts";
import { loadEffectiveConfigForExecution } from "./execution_config.ts";
import { loadMeshState, type MeshState } from "./mesh_state.ts";
import {
  collectResourcePageModels,
  resolveMeshFaviconPath,
} from "./page_model_assembly.ts";
import { renderResourcePages } from "./pages.ts";
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
  timing?: RuntimeTiming;
  phasePrefix?: string;
}

export interface GeneratePreparedPagesResult {
  meshBase: string;
  generatedDesignatorPaths: readonly string[];
  createdPaths: readonly string[];
  updatedPaths: readonly string[];
  skippedTimestampOnlyPaths: readonly string[];
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
  const effectiveConfig = await timeOptional(
    options.timing,
    phase("loadEffectiveConfig"),
    () =>
      loadEffectiveConfigForExecution(
        options.historyTrackingPolicyOverride,
      ),
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
  const pageFiles = await timeOptional(
    options.timing,
    phase("collectGeneratedPageFiles"),
    () =>
      collectGeneratedPageFiles(
        options.meshRoot,
        options.localPathPolicy,
        meshState,
        selectedDesignatorPaths,
        options.targets.length === 0,
        options.targets.length > 0,
        effectiveConfig,
        resolveGeneratedAt(options.now),
        options.includeSemanticFlowMetadata,
        options.timing,
        phase("collectGeneratedPageFiles"),
      ),
  );
  const writeResult = await timeOptional(
    options.timing,
    phase("writePages"),
    () => writeGeneratedPagesUpsert(options.meshRoot, pageFiles),
  );

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

export async function collectGeneratedPageFiles(
  workspaceRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  meshState: MeshState,
  selectedDesignatorPaths: readonly string[],
  includeAllMeshPages: boolean,
  hasExplicitGenerateTargets: boolean,
  effectiveConfig: Awaited<ReturnType<typeof loadEffectiveConfigForExecution>>,
  generatedAt: Date,
  includeSemanticFlowMetadata: boolean,
  timing?: RuntimeTiming,
  phasePrefix = "collectGeneratedPageFiles",
): Promise<readonly PlannedFile[]> {
  const phase = (name: string) => `${phasePrefix}.${name}`;
  const pageModels = await collectResourcePageModels({
    workspaceRoot,
    localPathPolicy,
    meshState,
    selectedDesignatorPaths,
    includeAllMeshPages,
    hasExplicitGenerateTargets,
    effectiveConfig,
    timing,
    phasePrefix,
  });
  const meshFaviconPath = await resolveMeshFaviconPath(workspaceRoot);
  return await timeOptional(
    timing,
    phase("renderResourcePages"),
    () =>
      renderResourcePages(meshState.meshBase, pageModels, {
        generatedAt,
        includeSemanticFlowMetadata,
        meshFaviconPath,
        resourcePagePresentation: effectiveConfig.resourcePagePresentation,
      }),
  );
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
  if (now) {
    return now();
  }
  const generatedAt = Deno.env.get("WEAVE_GENERATED_AT");
  if (!generatedAt) {
    return new Date();
  }
  const date = new Date(generatedAt);
  if (Number.isNaN(date.getTime())) {
    throw new WeaveInputError(
      `Invalid WEAVE_GENERATED_AT value: ${generatedAt}`,
    );
  }
  return date;
}

const GENERATED_TIMESTAMP_FOOTER_PATTERN =
  /Generated on <span class="wf-term wf-date-tip" tabindex="0" title="[^"]*" data-tooltip="[^"]*">[^<]*<\/span> by/g;

function normalizeGeneratedTimestampFooters(contents: string): string {
  return contents.replace(
    GENERATED_TIMESTAMP_FOOTER_PATTERN,
    'Generated on <span class="wf-term wf-date-tip" tabindex="0" title="__WEAVE_GENERATED_AT__" data-tooltip="__WEAVE_GENERATED_AT__">__WEAVE_GENERATED_AT_DISPLAY__</span> by',
  );
}

async function writeGeneratedPagesUpsert(
  workspaceRoot: string,
  files: readonly PlannedFile[],
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
      skippedTimestampOnlyPaths.push(file.path);
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
    skippedTimestampOnlyPaths,
  };
}
