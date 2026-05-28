import { dirname, join } from "@std/path";
import {
  toDesignatorResourcePagePath,
  toKnopPath,
} from "../../core/designator_segments.ts";
import type {
  ResourcePageHistoryGroupModel,
  ResourcePageModel,
  ResourcePageRawSourcePanelModel,
} from "../../core/weave/resource_page_models.ts";
import {
  findHistoryForState,
  findHistoryStateForManifestation,
  isHistoryComponentResource,
} from "../../core/weave/resource_page_history_groups.ts";
import type { OperationalLocalPathPolicy } from "../operational/local_path_policy.ts";
import type { RuntimeTiming } from "../timing.ts";
import type { EffectiveConfigProvider } from "./execution_config.ts";
import type { MeshState } from "./mesh_state.ts";
import {
  collectChildIdentifiersByResourcePath,
  collectDesignatorRdfTypesByResourcePath,
  collectHistoryGroupsByResourcePath,
  extractResourceTitle,
  findHistoryGroupsForResource,
  findOwnerRawSourcePanelsForArtifactHistory,
  findOwnerRawSourcePanelsForArtifactHistoryInContext,
  isChildIdentifierResourcePath,
  listRuntimeGeneratedResourcePagePaths,
  loadBestEffortGenerateDesignatorContexts,
  loadGenerateDesignatorContexts,
  resolveKnopOwnerTitle,
  toKnopChildIdentifiers,
  toLastPathSegment,
  toParentResourcePath,
} from "./page_contexts.ts";
import {
  collectMeshSupportRawSourcePanels,
  findRawSourcePanelsForPage,
} from "./raw_source_panels.ts";
import { timeOptional, timeOptionalSync } from "./timing_helpers.ts";

export interface CollectResourcePageModelsInput {
  workspaceRoot: string;
  localPathPolicy: OperationalLocalPathPolicy;
  meshState: MeshState;
  selectedDesignatorPaths: readonly string[];
  includeAllMeshPages: boolean;
  hasExplicitGenerateTargets: boolean;
  effectiveConfigProvider: EffectiveConfigProvider;
  timing?: RuntimeTiming;
  phasePrefix?: string;
}

export async function collectResourcePageModels(
  input: CollectResourcePageModelsInput,
): Promise<readonly ResourcePageModel[]> {
  const {
    workspaceRoot,
    localPathPolicy,
    meshState,
    selectedDesignatorPaths,
    includeAllMeshPages,
    hasExplicitGenerateTargets,
    effectiveConfigProvider,
    timing,
    phasePrefix = "collectResourcePageModels",
  } = input;
  const phase = (name: string) => `${phasePrefix}.${name}`;
  const pageModels: ResourcePageModel[] = [];
  const pagePaths = new Set<string>();
  const selectedSet = new Set(selectedDesignatorPaths);
  const designatorContexts = await timeOptional(
    timing,
    phase("loadDesignatorContexts"),
    () =>
      loadGenerateDesignatorContexts(
        workspaceRoot,
        localPathPolicy,
        meshState,
        selectedDesignatorPaths,
        (designatorPath) =>
          effectiveConfigProvider.configForTarget(designatorPath),
        hasExplicitGenerateTargets,
        timing,
        phase("loadDesignatorContexts"),
      ),
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
  const meshRawSourcePanels = await timeOptional(
    timing,
    phase("collectMeshSupportRawSourcePanels"),
    () => collectMeshSupportRawSourcePanels(workspaceRoot, meshState),
  );
  const meshHistoryGroups = timeOptionalSync(
    timing,
    phase("collectMeshHistoryGroups"),
    () =>
      collectHistoryGroupsByResourcePath(
        meshState.meshBase,
        meshState.currentMeshInventoryTurtle,
        "Could not parse the current MeshInventory while collecting ResourcePage histories.",
      ),
  );
  const meshInventoryPagePaths = await timeOptional(
    timing,
    phase("listMeshInventoryResourcePagePaths"),
    async () =>
      listRuntimeGeneratedResourcePagePaths(
        {
          meshBase: meshState.meshBase,
          inventoryTurtle: meshState.currentMeshInventoryTurtle,
          parseErrorMessage:
            "Could not parse the current MeshInventory while collecting ResourcePages.",
          config: await effectiveConfigProvider.configForMeshScope(),
          explicitRequest: hasExplicitGenerateTargets,
        },
      ),
  );
  const ownerScopedPagePaths = designatorContexts.flatMap((context) =>
    context.pagePaths
  );
  const selectedPagePaths = [
    ...new Set([
      ...meshInventoryPagePaths,
      ...ownerScopedPagePaths,
    ]),
  ].sort((left, right) => left.localeCompare(right));
  const generatedResourcePaths = collectGeneratedResourcePaths(
    selectedPagePaths,
    includeAllMeshPages,
    selectedSet,
  );
  const displayedChildResourcePaths = collectDisplayedChildResourcePaths(
    selectedPagePaths,
    generatedResourcePaths,
  );
  const childTypeHintContexts = await timeOptional(
    timing,
    phase("loadChildTypeHintContexts"),
    () =>
      loadBestEffortGenerateDesignatorContexts(
        workspaceRoot,
        localPathPolicy,
        meshState,
        displayedChildResourcePaths.filter((resourcePath) =>
          !selectedSet.has(resourcePath)
        ),
        (designatorPath) =>
          effectiveConfigProvider.configForTarget(designatorPath),
        hasExplicitGenerateTargets,
        timing,
        phase("loadChildTypeHintContexts"),
      ),
  );
  const childRdfTypesByResourcePath = collectDesignatorRdfTypesByResourcePath(
    meshState.meshBase,
    [...designatorContexts, ...childTypeHintContexts],
  );
  const childIdentifiersByResourcePath = collectChildIdentifiersByResourcePath(
    selectedPagePaths,
    childRdfTypesByResourcePath,
  );

  for (const pagePath of selectedPagePaths) {
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
          presentationConfigIri: (await effectiveConfigProvider.configForTarget(
            publicContext.designatorPath,
          )).resourcePagePresentation.iri,
          generatedPanelSelectionIris:
            publicContext.customIdentifierPage.generatedPanelSelectionIris,
          stylesheetPaths: publicContext.customIdentifierPage.stylesheetPaths,
          regions: publicContext.customIdentifierPage.regions,
          workingLocalRelativePath:
            publicContext.payloadWorkingLocalRelativePath,
          extractionSource: publicContext.extractionSource,
          references: publicContext.references,
          childIdentifiers: childIdentifiersByResourcePath.get(
            resourcePath,
          ),
          historyGroups,
          rawSourcePanels: publicContext.rawSourcePanels.get(pagePath),
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

  return pageModels;
}

export async function resolveMeshFaviconPath(
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
    return `Artifact manifestation for the ${
      toLastPathSegment(manifestationState.path)
    } historical state`;
  }
  const stateHistory = findHistoryForState(resourcePath, historyGroups);
  if (stateHistory) {
    return `Historical state for the ${
      toLastPathSegment(stateHistory.path)
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
    return `Artifact history for ${
      ownerTitle ?? formatOwnerResourcePath(ownerResourcePath)
    }`;
  }
  if (resourcePath === "_mesh") {
    return "Semantic Mesh.";
  }
  if (resourcePath.endsWith("/_knop") || resourcePath === "_knop") {
    return `Semantic Flow bundle of supporting data for ${
      formatOwnerResourcePath(dirname(resourcePath))
    }.`;
  }
  if (resourcePath.endsWith("/_meta")) {
    if (resourcePath === "_mesh/_meta") {
      return "Metadata for this Semantic Mesh";
    }
    return `Knop metadata for ${
      formatOwnerResourcePath(dirname(dirname(resourcePath)))
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

function formatOwnerResourcePath(resourcePath: string): string {
  if (resourcePath === "." || resourcePath.length === 0) {
    return "/";
  }
  return resourcePath;
}

function toResourcePath(pagePath: string): string {
  if (pagePath === "index.html") {
    return "";
  }
  return pagePath.endsWith("/index.html")
    ? pagePath.slice(0, -"/index.html".length)
    : pagePath;
}
