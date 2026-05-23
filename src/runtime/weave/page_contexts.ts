import { dirname, join } from "@std/path";
import { Parser, type Quad } from "n3";
import {
  toDesignatorResourcePagePath,
  toKnopPath,
} from "../../core/designator_segments.ts";
import { SFLO_NAMESPACE } from "../../core/rdf/namespaces.ts";
import type { RepositorySourceFloatingLocator } from "../../core/weave/source_models.ts";
import type {
  KnopArtifactLinkModel,
  ResourcePageChildIdentifierModel,
  ResourcePageExtractionSourceModel,
  ResourcePageHistoryGroupModel,
  ResourcePageRawSourcePanelModel,
  ResourcePageReferenceLinkModel,
} from "../../core/weave/resource_page_models.ts";
import {
  collectHistoryGroupsByResourcePath
    as collectResourcePageHistoryGroupsByResourcePath,
  mergeHistoryGroupsByResourcePath,
} from "../../core/weave/resource_page_history_groups.ts";
import { extractResourceReferenceLinks } from "../../core/weave/resource_page_reference_links.ts";
import type { EffectiveConfig } from "../config/effective_config.ts";
import {
  resolveExtractionSourceInventoryState,
  resolvePayloadArtifactInventoryState,
  resolveResourcePageDefinitionInventoryState,
} from "../mesh/inventory.ts";
import {
  LocalPathAccessError,
  type OperationalLocalPathPolicy,
} from "../operational/local_path_policy.ts";
import type { RuntimeTiming } from "../timing.ts";
import {
  loadKnopSourceRegistryArtifact,
  loadReferenceCatalogWorkingArtifact,
} from "./artifact_loaders.ts";
import { WeaveRuntimeError } from "./errors.ts";
import type { MeshState } from "./mesh_state.ts";
import {
  type CustomIdentifierPageModelInput,
  describeResourcePageDefinitionArtifact,
  loadActiveCustomIdentifierPage,
  loadResourcePageDefinitionWorkingArtifact,
  ResourcePageDefinitionResolutionError,
} from "./page_definition.ts";
import {
  addCurrentKnopInventoryRawSourcePanel,
  addExtractionSourceRawSourcePanels,
  addPayloadRawSourcePanels,
  addReferenceTargetSourceRawSourcePanels,
  addSupportArtifactRawSourcePanels,
  findRawSourcePanelsForPage,
} from "./raw_source_panels.ts";
import {
  listGeneratedResourcePagePaths,
  type ListGeneratedResourcePagePathsInput,
  ResourcePagePolicyError,
} from "./resource_page_policy.ts";
import { timeOptional, timeOptionalSync } from "./timing_helpers.ts";

const SFLO_HAS_KNOP_METADATA_IRI = `${SFLO_NAMESPACE}hasKnopMetadata`;
const SFLO_HAS_KNOP_INVENTORY_IRI = `${SFLO_NAMESPACE}hasKnopInventory`;
const SFLO_HAS_PAYLOAD_ARTIFACT_IRI = `${SFLO_NAMESPACE}hasPayloadArtifact`;
const SFLO_HAS_REFERENCE_CATALOG_IRI = `${SFLO_NAMESPACE}hasReferenceCatalog`;
const SFLO_HAS_RESOURCE_PAGE_DEFINITION_IRI =
  `${SFLO_NAMESPACE}hasResourcePageDefinition`;
const SFLO_HAS_KNOP_ASSET_BUNDLE_IRI = `${SFLO_NAMESPACE}hasKnopAssetBundle`;
const RDF_TYPE_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const DCTERMS_TITLE_IRI = "http://purl.org/dc/terms/title";

export interface GenerateDesignatorContext {
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

export async function loadBestEffortGenerateDesignatorContexts(
  workspaceRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  meshState: MeshState,
  designatorPaths: readonly string[],
  effectiveConfig: EffectiveConfig,
  hasExplicitGenerateTargets: boolean,
  timing?: RuntimeTiming,
  phasePrefix = "loadBestEffortGenerateDesignatorContexts",
): Promise<readonly GenerateDesignatorContext[]> {
  const phase = (name: string) => `${phasePrefix}.${name}`;
  const contexts: GenerateDesignatorContext[] = [];
  const seen = new Set<string>();

  for (const designatorPath of designatorPaths) {
    if (seen.has(designatorPath)) {
      continue;
    }
    seen.add(designatorPath);

    try {
      contexts.push(
        ...await timeOptional(
          timing,
          phase("designator"),
          () =>
            loadGenerateDesignatorContexts(
              workspaceRoot,
              localPathPolicy,
              meshState,
              [designatorPath],
              effectiveConfig,
              hasExplicitGenerateTargets,
              timing,
              phase("designator"),
            ),
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

export async function loadGenerateDesignatorContexts(
  workspaceRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  meshState: MeshState,
  designatorPaths: readonly string[],
  effectiveConfig: EffectiveConfig,
  hasExplicitGenerateTargets: boolean,
  timing?: RuntimeTiming,
  phasePrefix = "loadGenerateDesignatorContexts",
): Promise<readonly GenerateDesignatorContext[]> {
  const phase = (name: string) => `${phasePrefix}.${name}`;
  const contexts: GenerateDesignatorContext[] = [];

  for (const designatorPath of designatorPaths) {
    const knopInventoryPath = join(
      workspaceRoot,
      `${toKnopPath(designatorPath)}/_inventory/inventory.ttl`,
    );
    let currentKnopInventoryTurtle: string;

    try {
      currentKnopInventoryTurtle = await timeOptional(
        timing,
        phase("readKnopInventory"),
        () => Deno.readTextFile(knopInventoryPath),
      );
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
    await addCurrentKnopInventoryRawSourcePanel(
      rawSourcePanels,
      workspaceRoot,
      meshState.meshBase,
      currentKnopInventoryQuads,
      designatorPath,
      currentKnopInventoryTurtle,
    );
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
    const referenceCatalogArtifact = await timeOptional(
      timing,
      phase("loadReferenceCatalogArtifact"),
      () =>
        loadReferenceCatalogWorkingArtifact(
          workspaceRoot,
          localPathPolicy,
          meshState.meshBase,
          designatorPath,
          currentKnopInventoryTurtle,
        ),
    );
    const referenceLinks = referenceCatalogArtifact
      ? extractResourceReferenceLinks(
        meshState.meshBase,
        designatorPath,
        referenceCatalogArtifact.currentReferenceCatalogTurtle,
        (message) => new WeaveRuntimeError(message),
      )
      : [];
    const sourceRegistryArtifact = await timeOptional(
      timing,
      phase("loadSourceRegistryArtifact"),
      () =>
        loadKnopSourceRegistryArtifact(
          localPathPolicy,
          meshState.meshBase,
          designatorPath,
          currentKnopInventoryTurtle,
        ),
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
    const ownHistoryGroupsByResourcePath = timeOptionalSync(
      timing,
      phase("collectOwnHistoryGroups"),
      () =>
        collectHistoryGroupsByResourcePath(
          meshState.meshBase,
          currentKnopInventoryTurtle,
          `Could not parse the current Knop inventory while collecting ResourcePage histories for ${designatorPath}.`,
        ),
    );
    const ancestorHistoryGroupsByResourcePath = await timeOptional(
      timing,
      phase("collectAncestorHistoryGroups"),
      () =>
        collectAncestorHistoryGroupsByResourcePath(
          workspaceRoot,
          meshState.meshBase,
          designatorPath,
        ),
    );
    const sourceHistoryGroupsByResourcePath = extractionSource
      ? await timeOptional(
        timing,
        phase("collectExtractionSourceHistoryGroups"),
        () =>
          collectExtractionSourceHistoryGroupsByResourcePath(
            workspaceRoot,
            meshState.meshBase,
            designatorPath,
            extractionSource.sourceArtifactPath,
          ),
      )
      : new Map<string, readonly ResourcePageHistoryGroupModel[]>();
    let customIdentifierPage: CustomIdentifierPageModelInput | undefined;
    const pagePaths = timeOptionalSync(
      timing,
      phase("listResourcePagePaths"),
      () =>
        listRuntimeGeneratedResourcePagePaths({
          meshBase: meshState.meshBase,
          inventoryTurtle: currentKnopInventoryTurtle,
          parseErrorMessage:
            `Could not parse the current Knop inventory while collecting ResourcePages for ${designatorPath}.`,
          config: effectiveConfig,
          explicitRequest: hasExplicitGenerateTargets,
        }),
    );

    try {
      const resourcePageDefinitionArtifact = await timeOptional(
        timing,
        phase("loadResourcePageDefinitionArtifact"),
        () =>
          loadResourcePageDefinitionWorkingArtifact(
            workspaceRoot,
            localPathPolicy,
            designatorPath,
            resourcePageDefinitionState,
          ),
      );
      customIdentifierPage = await timeOptional(
        timing,
        phase("loadActiveCustomIdentifierPage"),
        () =>
          loadActiveCustomIdentifierPage(
            workspaceRoot,
            localPathPolicy,
            meshState.meshBase,
            designatorPath,
            resourcePageDefinitionArtifact,
          ),
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
      await timeOptional(
        timing,
        phase("addPayloadRawSourcePanels"),
        () =>
          addPayloadRawSourcePanels(
            rawSourcePanels,
            workspaceRoot,
            meshState.meshBase,
            currentKnopInventoryQuads,
            designatorPath,
            payloadArtifact,
          ),
      );
    } else if (extractionSource) {
      await timeOptional(
        timing,
        phase("addExtractionSourceRawSourcePanels"),
        () =>
          addExtractionSourceRawSourcePanels(
            rawSourcePanels,
            workspaceRoot,
            localPathPolicy,
            meshState.meshBase,
            designatorPath,
            extractionSource.sourceArtifactPath,
            extractionSource.requestedTargetStatePath,
            extractionSource.artifactResolutionModeIri,
          ),
      );
    } else if (referenceCatalogArtifact) {
      await timeOptional(
        timing,
        phase("addReferenceTargetSourceRawSourcePanels"),
        () =>
          addReferenceTargetSourceRawSourcePanels(
            rawSourcePanels,
            workspaceRoot,
            localPathPolicy,
            meshState.meshBase,
            designatorPath,
            referenceLinks,
          ),
      );
    }
    await timeOptional(
      timing,
      phase("addSupportArtifactRawSourcePanels"),
      () =>
        addSupportArtifactRawSourcePanels(
          rawSourcePanels,
          workspaceRoot,
          localPathPolicy,
          meshState.meshBase,
          currentKnopInventoryQuads,
          artifactLinks.supportingArtifacts,
        ),
    );
  }

  return contexts;
}

export function listRuntimeGeneratedResourcePagePaths(
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

export function collectChildIdentifiersByResourcePath(
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

export function collectDesignatorRdfTypesByResourcePath(
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

export function toKnopChildIdentifiers(
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

export function resolveKnopOwnerTitle(
  meshBase: string,
  context: GenerateDesignatorContext,
): string | undefined {
  const ownerPagePath = toDesignatorResourcePagePath(context.designatorPath);
  const rawSourcePanels = context.rawSourcePanels.get(ownerPagePath);
  return rawSourcePanels
    ? extractResourceTitle(meshBase, context.designatorPath, rawSourcePanels)
    : undefined;
}

export function isChildIdentifierResourcePath(resourcePath: string): boolean {
  if (resourcePath.length === 0) {
    return false;
  }
  const parentPath = toParentResourcePath(resourcePath);
  if (parentPath === "_knop" || parentPath.endsWith("/_knop")) {
    return true;
  }

  return !resourcePath.split("/").some((segment) => segment.startsWith("_"));
}

export function toParentResourcePath(resourcePath: string): string {
  const lastSlash = resourcePath.lastIndexOf("/");
  return lastSlash === -1 ? "" : resourcePath.slice(0, lastSlash);
}

export function findHistoryGroupsForResource(
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

export function findOwnerRawSourcePanelsForArtifactHistory(
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

export function findOwnerRawSourcePanelsForArtifactHistoryInContext(
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

export function extractResourceTitle(
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

export function toLastPathSegment(path: string): string {
  const segments = path.split("/").filter((segment) => segment.length > 0);
  return segments[segments.length - 1] ?? "/";
}

export function collectHistoryGroupsByResourcePath(
  meshBase: string,
  inventoryTurtle: string,
  parseErrorMessage: string,
): ReadonlyMap<string, readonly ResourcePageHistoryGroupModel[]> {
  return collectResourcePageHistoryGroupsByResourcePath(
    meshBase,
    inventoryTurtle,
    parseErrorMessage,
    (message) => new WeaveRuntimeError(message),
  );
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
        `Workspace is missing the page source payload inventory for ${designatorPath}: ${
          toKnopPath(sourceArtifactPath)
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

function toResourcePath(pagePath: string): string {
  if (pagePath === "index.html") {
    return "";
  }
  return pagePath.endsWith("/index.html")
    ? pagePath.slice(0, -"/index.html".length)
    : pagePath;
}
