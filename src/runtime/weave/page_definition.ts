import { join } from "@std/path";
import * as pathPosix from "@std/path/posix";
import { Parser, type Quad } from "n3";
import {
  formatDesignatorPathForDisplay,
  normalizeSafeDesignatorPath,
  toKnopPath,
} from "../../core/designator_segments.ts";
import type { ResourcePageDefinitionWorkingArtifact } from "../../core/weave/candidates.ts";
import {
  resolvePayloadArtifactInventoryState,
  resolveReferenceCatalogInventoryState,
  resolveResourcePageDefinitionInventoryState,
  type ResourcePageDefinitionInventoryState,
} from "../mesh/inventory.ts";
import {
  LocalPathAccessError,
  type OperationalLocalPathPolicy,
  resolveAllowedLocalPath,
} from "../operational/local_path_policy.ts";
import {
  DEFAULT_RESOURCE_PAGE_PRESENTATION_PROFILE,
  type ResourcePagePresentationProfile,
} from "../config/effective_config.ts";
import { SFCFG_NAMESPACE, SFLO_NAMESPACE } from "../../core/rdf/namespaces.ts";

const SFCFG_HAS_RESOURCE_PAGE_PRESENTATION_CONFIG_IRI =
  `${SFCFG_NAMESPACE}hasResourcePagePresentationConfig`;
const SFCFG_HAS_GENERATED_RESOURCE_PAGE_PANEL_SELECTION_IRI =
  `${SFCFG_NAMESPACE}hasGeneratedResourcePagePanelSelection`;
const SFLO_HAS_PAGE_REGION_IRI = `${SFLO_NAMESPACE}hasPageRegion`;
const SFLO_HAS_RESOURCE_PAGE_SOURCE_IRI =
  `${SFLO_NAMESPACE}hasResourcePageSource`;
const SFLO_HAS_TARGET_ARTIFACT_IRI = `${SFLO_NAMESPACE}hasTargetArtifact`;
const SFLO_HAS_TARGET_DISTRIBUTION_IRI =
  `${SFLO_NAMESPACE}hasTargetDistribution`;
const SFLO_HAS_TARGET_LOCATED_FILE_IRI =
  `${SFLO_NAMESPACE}hasTargetLocatedFile`;
const SFLO_HAS_REQUESTED_TARGET_HISTORY_IRI =
  `${SFLO_NAMESPACE}hasRequestedTargetHistory`;
const SFLO_HAS_REQUESTED_TARGET_STATE_IRI =
  `${SFLO_NAMESPACE}hasRequestedTargetState`;
const SFLO_HAS_ARTIFACT_RESOLUTION_MODE_IRI =
  `${SFLO_NAMESPACE}hasArtifactResolutionMode`;
const SFLO_HAS_ARTIFACT_RESOLUTION_FALLBACK_POLICY_IRI =
  `${SFLO_NAMESPACE}hasArtifactResolutionFallbackPolicy`;
const SFLO_TARGET_MESH_PATH_IRI = `${SFLO_NAMESPACE}targetLocalRelativePath`;
const SFLO_TARGET_ACCESS_URL_IRI = `${SFLO_NAMESPACE}targetAccessUrl`;
const SFLO_REGION_KEY_IRI = `${SFLO_NAMESPACE}regionKey`;
const SFLO_ARTIFACT_RESOLUTION_MODE_WORKING_IRI =
  `${SFLO_NAMESPACE}artifactResolutionMode_working`;
const SFLO_ARTIFACT_RESOLUTION_MODE_LATEST_STATE_IRI =
  `${SFLO_NAMESPACE}artifactResolutionMode_latestState`;
const RDF_TYPE_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const SFLO_ARTIFACT_HISTORY_IRI = `${SFLO_NAMESPACE}ArtifactHistory`;
const SFLO_CURRENT_ARTIFACT_HISTORY_IRI =
  `${SFLO_NAMESPACE}currentArtifactHistory`;
const SFLO_HAS_ARTIFACT_HISTORY_IRI = `${SFLO_NAMESPACE}hasArtifactHistory`;
const SFLO_HAS_PAYLOAD_ARTIFACT_IRI = `${SFLO_NAMESPACE}hasPayloadArtifact`;
const SFLO_LATEST_HISTORICAL_STATE_IRI =
  `${SFLO_NAMESPACE}latestHistoricalState`;
const SFLO_LOCATED_FILE_FOR_STATE_IRI = `${SFLO_NAMESPACE}locatedFileForState`;
const PAGE_DEFINITION_ARTIFACT_SUFFIX = "/_knop/_page";
const ROOT_PAGE_DEFINITION_ARTIFACT_PATH = "_knop/_page";
const ROOT_REFERENCE_CATALOG_PATH = "_knop/_references";
const REFERENCE_CATALOG_SUFFIX = "/_knop/_references";

interface ArtifactSourceTarget {
  kind: "payload" | "referenceCatalog" | "resourcePageDefinition";
  designatorPath: string;
  artifactPath: string;
}

interface ArtifactSourceCurrentState extends ArtifactSourceTarget {
  workingLocalRelativePath: string;
}

interface ArtifactSourceInventory {
  target: ArtifactSourceTarget;
  targetKnopInventoryTurtle: string;
}

interface ArtifactSourceLatestState {
  statePath: string;
  snapshotPath: string;
}

export interface CustomIdentifierRegionModel {
  key: string;
  markdown: string;
  sourcePath: string;
}

export interface CustomIdentifierPageModelInput {
  definitionPath: string;
  regions: readonly CustomIdentifierRegionModel[];
  stylesheetPaths: readonly string[];
  presentationConfigIri?: string;
  generatedPanelSelectionIris: readonly string[];
}

export class ResourcePageDefinitionResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResourcePageDefinitionResolutionError";
  }
}

export async function loadResourcePageDefinitionWorkingArtifact(
  meshRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  designatorPath: string,
  inventoryState: ResourcePageDefinitionInventoryState | undefined,
): Promise<ResourcePageDefinitionWorkingArtifact | undefined> {
  if (!inventoryState) {
    return undefined;
  }

  try {
    const latestHistoricalSnapshotTurtle =
      inventoryState.latestHistoricalStatePath
        ? await Deno.readTextFile(
          join(
            meshRoot,
            toPageDefinitionHistoricalSnapshotPath(
              inventoryState.latestHistoricalStatePath,
            ),
          ),
        )
        : undefined;

    return {
      ...inventoryState,
      currentPageDefinitionTurtle: await Deno.readTextFile(
        resolveAllowedLocalPath(
          localPathPolicy,
          "workingLocalRelativePath",
          inventoryState.workingLocalRelativePath,
        ),
      ),
      latestHistoricalSnapshotTurtle,
    };
  } catch (error) {
    if (error instanceof LocalPathAccessError) {
      throw new ResourcePageDefinitionResolutionError(
        `Working ResourcePageDefinition file for ${
          formatDesignatorPathForDisplay(designatorPath)
        } is outside the allowed local-path boundary: ${inventoryState.workingLocalRelativePath}`,
      );
    }
    if (error instanceof Deno.errors.NotFound) {
      if (inventoryState.latestHistoricalStatePath) {
        throw new ResourcePageDefinitionResolutionError(
          `Mesh root is missing the latest ResourcePageDefinition snapshot for ${
            formatDesignatorPathForDisplay(designatorPath)
          }: ${
            toPageDefinitionHistoricalSnapshotPath(
              inventoryState.latestHistoricalStatePath,
            )
          }`,
        );
      }
      throw new ResourcePageDefinitionResolutionError(
        `Mesh root is missing the working ResourcePageDefinition file for ${
          formatDesignatorPathForDisplay(designatorPath)
        }: ${inventoryState.workingLocalRelativePath}`,
      );
    }
    throw error;
  }
}

export async function loadActiveCustomIdentifierPage(
  meshRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  meshBase: string,
  designatorPath: string,
  artifact: ResourcePageDefinitionWorkingArtifact | undefined,
): Promise<CustomIdentifierPageModelInput | undefined> {
  if (!artifact || !artifact.currentArtifactHistoryExists) {
    return undefined;
  }

  const definitionIri = new URL(artifact.artifactPath, meshBase).href;
  const quads = parsePageDefinitionQuads(
    definitionIri,
    artifact.currentPageDefinitionTurtle,
    designatorPath,
  );
  const regionSubjects = collectNamedNodeObjects(
    quads,
    definitionIri,
    SFLO_HAS_PAGE_REGION_IRI,
  );
  const presentationConfig = parseResourcePagePresentationConfig(
    quads,
    definitionIri,
    designatorPath,
  );
  const generatedPanelSelectionIris = parseGeneratedResourcePagePanelSelections(
    quads,
    definitionIri,
    designatorPath,
    presentationConfig,
  );

  if (regionSubjects.length === 0) {
    throw new ResourcePageDefinitionResolutionError(
      `ResourcePageDefinition for ${
        formatDesignatorPathForDisplay(designatorPath)
      } does not declare any page regions.`,
    );
  }

  const regions = await Promise.all(
    regionSubjects.map(async (regionSubject) => {
      const key = requireUniqueLiteral(
        quads,
        regionSubject,
        SFLO_REGION_KEY_IRI,
        `ResourcePageDefinition region ${regionSubject} is missing regionKey for ${
          formatDesignatorPathForDisplay(designatorPath)
        }.`,
      );
      const sourceSubject = requireUniqueNamedNode(
        quads,
        regionSubject,
        SFLO_HAS_RESOURCE_PAGE_SOURCE_IRI,
        `ResourcePageDefinition region ${key} is missing its ResourcePageSource for ${
          formatDesignatorPathForDisplay(designatorPath)
        }.`,
      );
      const targetArtifact = collectNamedNodeObjects(
        quads,
        sourceSubject,
        SFLO_HAS_TARGET_ARTIFACT_IRI,
      );
      const requestedTargetHistories = collectNamedNodeObjects(
        quads,
        sourceSubject,
        SFLO_HAS_REQUESTED_TARGET_HISTORY_IRI,
      );
      const requestedTargetStates = collectNamedNodeObjects(
        quads,
        sourceSubject,
        SFLO_HAS_REQUESTED_TARGET_STATE_IRI,
      );
      const artifactResolutionModes = collectNamedNodeObjects(
        quads,
        sourceSubject,
        SFLO_HAS_ARTIFACT_RESOLUTION_MODE_IRI,
      );
      const artifactResolutionFallbackPolicies = collectNamedNodeObjects(
        quads,
        sourceSubject,
        SFLO_HAS_ARTIFACT_RESOLUTION_FALLBACK_POLICY_IRI,
      );
      const targetDistribution = collectNamedNodeObjects(
        quads,
        sourceSubject,
        SFLO_HAS_TARGET_DISTRIBUTION_IRI,
      );
      const targetLocatedFile = collectNamedNodeObjects(
        quads,
        sourceSubject,
        SFLO_HAS_TARGET_LOCATED_FILE_IRI,
      );
      const targetLocalRelativePaths = collectLiteralObjects(
        quads,
        sourceSubject,
        SFLO_TARGET_MESH_PATH_IRI,
      );
      const targetAccessUrls = collectLiteralObjects(
        quads,
        sourceSubject,
        SFLO_TARGET_ACCESS_URL_IRI,
      );

      if (
        countDeclaredTargetLocators([
          targetArtifact.length,
          targetDistribution.length,
          targetLocatedFile.length,
          targetLocalRelativePaths.length,
          targetAccessUrls.length,
        ]) > 1
      ) {
        throw new ResourcePageDefinitionResolutionError(
          `ResourcePageDefinition region ${key} for ${
            formatDesignatorPathForDisplay(designatorPath)
          } declares multiple target locators; this first implementation slice requires exactly one target locator per ResourcePageSource.`,
        );
      }

      if (targetLocalRelativePaths.length === 1) {
        if (
          requestedTargetHistories.length > 0 ||
          requestedTargetStates.length > 0 ||
          artifactResolutionModes.length > 0 ||
          artifactResolutionFallbackPolicies.length > 0
        ) {
          throw new ResourcePageDefinitionResolutionError(
            `ResourcePageDefinition region ${key} for ${
              formatDesignatorPathForDisplay(designatorPath)
            } applies artifact-resolution policy fields to a direct targetLocalRelativePath source, which this first implementation slice does not support.`,
          );
        }

        const sourcePath = normalizeTargetLocalRelativePath(
          targetLocalRelativePaths[0]!,
          designatorPath,
        );

        return {
          key,
          sourcePath,
          markdown: await readAllowedSourceText(
            localPathPolicy,
            "targetLocalRelativePath",
            sourcePath,
            `ResourcePageDefinition region ${key} for ${
              formatDesignatorPathForDisplay(designatorPath)
            } points outside the allowed local-path boundary: ${sourcePath}`,
            `ResourcePageDefinition region ${key} for ${
              formatDesignatorPathForDisplay(designatorPath)
            } points at a missing mesh-local file: ${sourcePath}`,
          ),
        };
      }

      if (targetAccessUrls.length > 0) {
        throw new ResourcePageDefinitionResolutionError(
          `ResourcePageDefinition region ${key} for ${
            formatDesignatorPathForDisplay(designatorPath)
          } uses targetAccessUrl, which page generation does not support in this implementation slice.`,
        );
      }

      if (
        targetDistribution.length > 0 ||
        targetLocatedFile.length > 0
      ) {
        throw new ResourcePageDefinitionResolutionError(
          `ResourcePageDefinition region ${key} for ${
            formatDesignatorPathForDisplay(designatorPath)
          } uses distribution/located-file targets that this first implementation slice does not support yet.`,
        );
      }

      const targetArtifactIri = requireSingleNamedNodeTarget(
        targetArtifact,
        `ResourcePageDefinition region ${key} for ${
          formatDesignatorPathForDisplay(designatorPath)
        } must declare exactly one target locator.`,
      );
      const resolutionMode = requireOptionalSingleNamedNodeTarget(
        artifactResolutionModes,
        `ResourcePageDefinition region ${key} for ${
          formatDesignatorPathForDisplay(designatorPath)
        } declares multiple artifact resolution modes.`,
      );
      const requestedTargetHistory = requireOptionalSingleNamedNodeTarget(
        requestedTargetHistories,
        `ResourcePageDefinition region ${key} for ${
          formatDesignatorPathForDisplay(designatorPath)
        } declares multiple requested target histories.`,
      );

      if (
        requestedTargetStates.length > 0 ||
        artifactResolutionFallbackPolicies.length > 0
      ) {
        throw new ResourcePageDefinitionResolutionError(
          `ResourcePageDefinition region ${key} for ${
            formatDesignatorPathForDisplay(designatorPath)
          } requests exact/fallback artifact resolution that this first artifact-backed page-source slice does not support yet.`,
        );
      }
      if (resolutionMode === SFLO_ARTIFACT_RESOLUTION_MODE_WORKING_IRI) {
        if (requestedTargetHistory !== undefined) {
          throw new ResourcePageDefinitionResolutionError(
            `ResourcePageDefinition region ${key} for ${
              formatDesignatorPathForDisplay(designatorPath)
            } requests Working artifact resolution with a requested target history, which is contradictory.`,
          );
        }
        return await loadCurrentArtifactSourceRegion(
          meshRoot,
          localPathPolicy,
          meshBase,
          designatorPath,
          key,
          targetArtifactIri,
        );
      }
      if (
        resolutionMode === SFLO_ARTIFACT_RESOLUTION_MODE_LATEST_STATE_IRI ||
        requestedTargetHistory !== undefined
      ) {
        return await loadLatestStateArtifactSourceRegion(
          meshRoot,
          meshBase,
          designatorPath,
          key,
          targetArtifactIri,
          requestedTargetHistory,
        );
      }
      if (resolutionMode !== undefined) {
        throw new ResourcePageDefinitionResolutionError(
          `ResourcePageDefinition region ${key} for ${
            formatDesignatorPathForDisplay(designatorPath)
          } requests an unsupported artifact resolution mode: ${resolutionMode}.`,
        );
      }

      return await loadCurrentArtifactSourceRegion(
        meshRoot,
        localPathPolicy,
        meshBase,
        designatorPath,
        key,
        targetArtifactIri,
      );
    }),
  );

  return {
    definitionPath: artifact.artifactPath,
    regions: sortRegions(regions),
    stylesheetPaths: artifact.assetBundlePath
      ? await listStylesheetPaths(
        meshRoot,
        artifact.assetBundlePath,
        designatorPath,
      )
      : [],
    presentationConfigIri: presentationConfig?.iri,
    generatedPanelSelectionIris,
  };
}

function parseResourcePagePresentationConfig(
  quads: readonly Quad[],
  definitionIri: string,
  designatorPath: string,
): ResourcePagePresentationProfile | undefined {
  const configIris = collectNamedNodeObjects(
    quads,
    definitionIri,
    SFCFG_HAS_RESOURCE_PAGE_PRESENTATION_CONFIG_IRI,
  );
  if (configIris.length === 0) {
    return undefined;
  }
  if (configIris.length !== 1) {
    throw new ResourcePageDefinitionResolutionError(
      `ResourcePageDefinition for ${
        formatDesignatorPathForDisplay(designatorPath)
      } declares multiple ResourcePage presentation configs.`,
    );
  }

  const configIri = configIris[0]!;
  if (configIri !== DEFAULT_RESOURCE_PAGE_PRESENTATION_PROFILE.iri) {
    throw new ResourcePageDefinitionResolutionError(
      `ResourcePageDefinition for ${
        formatDesignatorPathForDisplay(designatorPath)
      } requests unsupported ResourcePage presentation config: ${configIri}.`,
    );
  }

  return DEFAULT_RESOURCE_PAGE_PRESENTATION_PROFILE;
}

function parseGeneratedResourcePagePanelSelections(
  quads: readonly Quad[],
  definitionIri: string,
  designatorPath: string,
  presentationConfig: ResourcePagePresentationProfile | undefined,
): readonly string[] {
  const selectionIris = collectNamedNodeObjects(
    quads,
    definitionIri,
    SFCFG_HAS_GENERATED_RESOURCE_PAGE_PANEL_SELECTION_IRI,
  );
  if (selectionIris.length === 0) {
    return [];
  }
  if (!presentationConfig) {
    throw new ResourcePageDefinitionResolutionError(
      `ResourcePageDefinition for ${
        formatDesignatorPathForDisplay(designatorPath)
      } declares generated ResourcePage panel selections without a ResourcePage presentation config.`,
    );
  }

  const supportedSelectionIris = new Set(
    presentationConfig.panelSelections.map((selection) => selection.iri),
  );
  const unsupportedSelection = selectionIris.find((selectionIri) =>
    !supportedSelectionIris.has(selectionIri)
  );
  if (unsupportedSelection) {
    throw new ResourcePageDefinitionResolutionError(
      `ResourcePageDefinition for ${
        formatDesignatorPathForDisplay(designatorPath)
      } requests unsupported generated ResourcePage panel selection: ${unsupportedSelection}.`,
    );
  }

  const requestedSelectionIris = new Set(selectionIris);
  return presentationConfig.panelSelections.filter((selection) =>
    requestedSelectionIris.has(selection.iri)
  ).map((selection) => selection.iri);
}

export function describeResourcePageDefinitionArtifact(
  designatorPath: string,
): string {
  return `Resource page definition for ${
    formatDesignatorPathForDisplay(designatorPath)
  }`;
}

function parsePageDefinitionQuads(
  definitionIri: string,
  turtle: string,
  designatorPath: string,
): readonly Quad[] {
  try {
    return new Parser({ baseIRI: definitionIri }).parse(turtle);
  } catch {
    throw new ResourcePageDefinitionResolutionError(
      `Could not parse the working ResourcePageDefinition for ${
        formatDesignatorPathForDisplay(designatorPath)
      }.`,
    );
  }
}

function toPageDefinitionHistoricalSnapshotPath(statePath: string): string {
  return `${statePath}/ttl/page.ttl`;
}

function collectNamedNodeObjects(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
): readonly string[] {
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

    values.add(quad.object.value);
  }

  return [...values];
}

function collectLiteralObjects(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
): readonly string[] {
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

  return [...values];
}

function requireUniqueNamedNode(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
  errorMessage: string,
): string {
  const values = collectNamedNodeObjects(quads, subjectIri, predicateIri);
  if (values.length !== 1) {
    throw new ResourcePageDefinitionResolutionError(errorMessage);
  }
  return values[0]!;
}

function requireUniqueLiteral(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
  errorMessage: string,
): string {
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

  if (values.size !== 1) {
    throw new ResourcePageDefinitionResolutionError(errorMessage);
  }

  return values.values().next().value!;
}

function requireSingleNamedNodeTarget(
  values: readonly string[],
  errorMessage: string,
): string {
  if (values.length !== 1) {
    throw new ResourcePageDefinitionResolutionError(errorMessage);
  }

  return values[0]!;
}

function requireOptionalSingleNamedNodeTarget(
  values: readonly string[],
  errorMessage: string,
): string | undefined {
  if (values.length === 0) {
    return undefined;
  }
  if (values.length !== 1) {
    throw new ResourcePageDefinitionResolutionError(errorMessage);
  }

  return values[0]!;
}

function countDeclaredTargetLocators(lengths: readonly number[]): number {
  return lengths.filter((length) => length > 0).length;
}

function normalizeTargetLocalRelativePath(
  value: string,
  designatorPath: string,
): string {
  const trimmed = value.trim();
  const pathDisplay = formatDesignatorPathForDisplay(designatorPath);

  if (trimmed.length === 0) {
    throw new ResourcePageDefinitionResolutionError(
      `ResourcePageDefinition for ${pathDisplay} contains an empty targetLocalRelativePath.`,
    );
  }
  if (trimmed.includes("\\")) {
    throw new ResourcePageDefinitionResolutionError(
      `targetLocalRelativePath values must use forward slashes; found ${trimmed}.`,
    );
  }
  if (trimmed.startsWith("/") || /^[A-Za-z]:/.test(trimmed)) {
    throw new ResourcePageDefinitionResolutionError(
      `targetLocalRelativePath values must stay relative to the mesh root; found ${trimmed}.`,
    );
  }

  const normalized = pathPosix.normalize(trimmed);
  if (normalized === "." || normalized === "..") {
    throw new ResourcePageDefinitionResolutionError(
      `targetLocalRelativePath values must point at a file-like path; found ${trimmed}.`,
    );
  }

  return normalized;
}

async function loadCurrentArtifactSourceRegion(
  meshRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  meshBase: string,
  ownerDesignatorPath: string,
  regionKey: string,
  targetArtifactIri: string,
): Promise<CustomIdentifierRegionModel> {
  const { target, targetKnopInventoryTurtle } =
    await loadArtifactSourceInventory(
      meshRoot,
      meshBase,
      ownerDesignatorPath,
      regionKey,
      targetArtifactIri,
    );
  const currentState = resolveArtifactSourceCurrentState(
    meshBase,
    targetKnopInventoryTurtle,
    target,
    ownerDesignatorPath,
    regionKey,
  );

  return {
    key: regionKey,
    sourcePath: currentState.workingLocalRelativePath,
    markdown: await readAllowedSourceText(
      localPathPolicy,
      "workingLocalRelativePath",
      currentState.workingLocalRelativePath,
      `ResourcePageDefinition region ${regionKey} for ${
        formatDesignatorPathForDisplay(ownerDesignatorPath)
      } points at governed artifact ${currentState.artifactPath}, whose current working bytes are outside the allowed local-path boundary: ${currentState.workingLocalRelativePath}`,
      `ResourcePageDefinition region ${regionKey} for ${
        formatDesignatorPathForDisplay(ownerDesignatorPath)
      } points at governed artifact ${currentState.artifactPath}, whose current working file is missing: ${currentState.workingLocalRelativePath}`,
    ),
  };
}

async function loadLatestStateArtifactSourceRegion(
  meshRoot: string,
  meshBase: string,
  ownerDesignatorPath: string,
  regionKey: string,
  targetArtifactIri: string,
  requestedTargetHistoryIri: string | undefined,
): Promise<CustomIdentifierRegionModel> {
  const { target, targetKnopInventoryTurtle } =
    await loadArtifactSourceInventory(
      meshRoot,
      meshBase,
      ownerDesignatorPath,
      regionKey,
      targetArtifactIri,
    );
  const latestState = resolveArtifactSourceLatestState(
    meshBase,
    targetKnopInventoryTurtle,
    target,
    ownerDesignatorPath,
    regionKey,
    requestedTargetHistoryIri,
  );

  return {
    key: regionKey,
    sourcePath: latestState.snapshotPath,
    markdown: await readMeshSourceText(
      meshRoot,
      latestState.snapshotPath,
      `ResourcePageDefinition region ${regionKey} for ${
        formatDesignatorPathForDisplay(ownerDesignatorPath)
      } points at governed artifact ${target.artifactPath}, whose latest settled source file is missing: ${latestState.snapshotPath}`,
    ),
  };
}

async function loadArtifactSourceInventory(
  meshRoot: string,
  meshBase: string,
  ownerDesignatorPath: string,
  regionKey: string,
  targetArtifactIri: string,
): Promise<ArtifactSourceInventory> {
  const targetArtifactPath = requireMeshPathFromTargetArtifact(
    meshBase,
    targetArtifactIri,
    `ResourcePageDefinition region ${regionKey} for ${
      formatDesignatorPathForDisplay(ownerDesignatorPath)
    } must target an in-mesh governed artifact.`,
  );
  const targetKind = describeSupportedTargetArtifact(
    targetArtifactPath,
    `ResourcePageDefinition region ${regionKey} for ${
      formatDesignatorPathForDisplay(ownerDesignatorPath)
    } targets unsupported artifact ${targetArtifactPath}; this first slice supports payload artifacts, ReferenceCatalog artifacts, and ResourcePageDefinition artifacts only.`,
  );
  const targetKnopInventoryPath = join(
    meshRoot,
    `${toKnopPath(targetKind.designatorPath)}/_inventory/inventory.ttl`,
  );

  let targetKnopInventoryTurtle: string;
  try {
    targetKnopInventoryTurtle = await Deno.readTextFile(
      targetKnopInventoryPath,
    );
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new ResourcePageDefinitionResolutionError(
        `ResourcePageDefinition region ${regionKey} for ${
          formatDesignatorPathForDisplay(ownerDesignatorPath)
        } targets governed artifact ${targetArtifactPath}, but its owning Knop inventory is missing: ${
          pathPosix.join(
            toKnopPath(targetKind.designatorPath),
            "_inventory/inventory.ttl",
          )
        }`,
      );
    }
    throw error;
  }

  return {
    target: targetKind,
    targetKnopInventoryTurtle,
  };
}

function resolveArtifactSourceCurrentState(
  meshBase: string,
  targetKnopInventoryTurtle: string,
  targetKind: ArtifactSourceTarget,
  ownerDesignatorPath: string,
  regionKey: string,
): ArtifactSourceCurrentState {
  const workingLocalRelativePath =
    resolveArtifactSourceWorkingLocalRelativePath(
      meshBase,
      targetKnopInventoryTurtle,
      targetKind,
      ownerDesignatorPath,
      regionKey,
    );

  return {
    ...targetKind,
    workingLocalRelativePath,
  };
}

function resolveArtifactSourceLatestState(
  meshBase: string,
  targetKnopInventoryTurtle: string,
  target: ArtifactSourceTarget,
  ownerDesignatorPath: string,
  regionKey: string,
  requestedTargetHistoryIri: string | undefined,
): ArtifactSourceLatestState {
  if (target.kind !== "payload") {
    throw new ResourcePageDefinitionResolutionError(
      `ResourcePageDefinition region ${regionKey} for ${
        formatDesignatorPathForDisplay(ownerDesignatorPath)
      } requests latest-state resolution for ${target.artifactPath}, but this implementation slice supports latest-state page sources for payload artifacts only.`,
    );
  }

  const parseErrorMessage =
    `Could not parse the current Knop inventory while resolving latest-state page-source artifact ${target.artifactPath} for ${
      formatDesignatorPathForDisplay(ownerDesignatorPath)
    }.`;
  const quads = parseTargetKnopInventoryQuads(
    meshBase,
    targetKnopInventoryTurtle,
    parseErrorMessage,
  );
  const targetArtifactIri = new URL(target.artifactPath, meshBase).href;
  const targetKnopIri = new URL(toKnopPath(target.designatorPath), meshBase)
    .href;

  if (
    !hasNamedNodeObject(
      quads,
      targetKnopIri,
      SFLO_HAS_PAYLOAD_ARTIFACT_IRI,
      targetArtifactIri,
    )
  ) {
    throw new ResourcePageDefinitionResolutionError(
      `ResourcePageDefinition region ${regionKey} for ${
        formatDesignatorPathForDisplay(ownerDesignatorPath)
      } targets ${target.artifactPath}, but that payload artifact is not registered in its owning Knop inventory.`,
    );
  }

  const historyIri = requestedTargetHistoryIri ??
    resolveRequiredNamedNodeObject(
      quads,
      targetArtifactIri,
      SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
      `ResourcePageDefinition region ${regionKey} for ${
        formatDesignatorPathForDisplay(ownerDesignatorPath)
      } requests latest-state resolution for ${target.artifactPath}, but that artifact has no currentArtifactHistory.`,
    );
  const historyPath = requireMeshPathFromTargetArtifact(
    meshBase,
    historyIri,
    `ResourcePageDefinition region ${regionKey} for ${
      formatDesignatorPathForDisplay(ownerDesignatorPath)
    } requests latest-state resolution outside the mesh: ${historyIri}.`,
  );

  if (
    !hasNamedNodeObject(
      quads,
      targetArtifactIri,
      SFLO_HAS_ARTIFACT_HISTORY_IRI,
      historyIri,
    ) &&
    !hasNamedNodeObject(
      quads,
      targetArtifactIri,
      SFLO_CURRENT_ARTIFACT_HISTORY_IRI,
      historyIri,
    )
  ) {
    throw new ResourcePageDefinitionResolutionError(
      `ResourcePageDefinition region ${regionKey} for ${
        formatDesignatorPathForDisplay(ownerDesignatorPath)
      } requests latest-state resolution for ${target.artifactPath}, but ${historyPath} is not a history of that artifact.`,
    );
  }
  if (
    !hasNamedNodeObject(
      quads,
      historyIri,
      RDF_TYPE_IRI,
      SFLO_ARTIFACT_HISTORY_IRI,
    )
  ) {
    throw new ResourcePageDefinitionResolutionError(
      `ResourcePageDefinition region ${regionKey} for ${
        formatDesignatorPathForDisplay(ownerDesignatorPath)
      } requests latest-state resolution for ${target.artifactPath}, but ${historyPath} is not declared as an ArtifactHistory.`,
    );
  }

  const stateIri = resolveRequiredNamedNodeObject(
    quads,
    historyIri,
    SFLO_LATEST_HISTORICAL_STATE_IRI,
    `ResourcePageDefinition region ${regionKey} for ${
      formatDesignatorPathForDisplay(ownerDesignatorPath)
    } requests latest-state resolution for ${target.artifactPath}, but ${historyPath} has no latestHistoricalState.`,
  );
  const statePath = requireMeshPathFromTargetArtifact(
    meshBase,
    stateIri,
    `ResourcePageDefinition region ${regionKey} for ${
      formatDesignatorPathForDisplay(ownerDesignatorPath)
    } resolved latest-state source ${stateIri} outside the mesh.`,
  );
  if (!statePath.startsWith(`${historyPath}/`)) {
    throw new ResourcePageDefinitionResolutionError(
      `ResourcePageDefinition region ${regionKey} for ${
        formatDesignatorPathForDisplay(ownerDesignatorPath)
      } resolved latest state ${statePath} outside requested history ${historyPath}.`,
    );
  }

  const locatedFileIri = resolveOptionalNamedNodeObject(
    quads,
    stateIri,
    SFLO_LOCATED_FILE_FOR_STATE_IRI,
    parseErrorMessage,
  );
  const snapshotPath = locatedFileIri
    ? requireMeshPathFromTargetArtifact(
      meshBase,
      locatedFileIri,
      `ResourcePageDefinition region ${regionKey} for ${
        formatDesignatorPathForDisplay(ownerDesignatorPath)
      } resolved latest-state located file ${locatedFileIri} outside the mesh.`,
    )
    : resolveDefaultPayloadHistoricalSnapshotPath(
      meshBase,
      targetKnopInventoryTurtle,
      target,
      ownerDesignatorPath,
      regionKey,
      parseErrorMessage,
      statePath,
    );

  return { statePath, snapshotPath };
}

function resolveDefaultPayloadHistoricalSnapshotPath(
  meshBase: string,
  targetKnopInventoryTurtle: string,
  target: ArtifactSourceTarget,
  ownerDesignatorPath: string,
  regionKey: string,
  parseErrorMessage: string,
  statePath: string,
): string {
  const missingWorkingFileMessage =
    `Could not derive the default latest-state snapshot path because page-source artifact ${target.artifactPath} used by region ${regionKey} of ${
      formatDesignatorPathForDisplay(ownerDesignatorPath)
    } has no working file name. Add sflo:locatedFileForState to the resolved HistoricalState or declare the payload artifact working file.`;
  const inventoryState = resolvePayloadArtifactInventoryState(
    meshBase,
    targetKnopInventoryTurtle,
    target.designatorPath,
    {
      parseErrorMessage,
      missingWorkingFileMessage,
    },
  );
  if (!inventoryState) {
    throw new ResourcePageDefinitionResolutionError(
      `ResourcePageDefinition region ${regionKey} for ${
        formatDesignatorPathForDisplay(ownerDesignatorPath)
      } targets ${target.artifactPath}, but that payload artifact is not registered in its owning Knop inventory.`,
    );
  }

  return toPayloadHistoricalSnapshotPath(
    statePath,
    inventoryState.workingLocalRelativePath,
  );
}

function resolveArtifactSourceWorkingLocalRelativePath(
  meshBase: string,
  targetKnopInventoryTurtle: string,
  target: Omit<ArtifactSourceCurrentState, "workingLocalRelativePath">,
  ownerDesignatorPath: string,
  regionKey: string,
): string {
  const parseErrorMessage =
    `Could not parse the current Knop inventory while resolving page-source artifact ${target.artifactPath} for ${
      formatDesignatorPathForDisplay(ownerDesignatorPath)
    }.`;
  const missingWorkingFileMessage =
    `Could not resolve the current working file for page-source artifact ${target.artifactPath} used by region ${regionKey} of ${
      formatDesignatorPathForDisplay(ownerDesignatorPath)
    }.`;

  if (target.kind === "payload") {
    const inventoryState = resolvePayloadArtifactInventoryState(
      meshBase,
      targetKnopInventoryTurtle,
      target.designatorPath,
      {
        parseErrorMessage,
        missingWorkingFileMessage,
      },
    );
    if (!inventoryState) {
      throw new ResourcePageDefinitionResolutionError(
        `ResourcePageDefinition region ${regionKey} for ${
          formatDesignatorPathForDisplay(ownerDesignatorPath)
        } targets ${target.artifactPath}, but that payload artifact is not registered in its owning Knop inventory.`,
      );
    }
    return inventoryState.workingLocalRelativePath;
  }

  if (target.kind === "referenceCatalog") {
    const inventoryState = resolveReferenceCatalogInventoryState(
      meshBase,
      targetKnopInventoryTurtle,
      target.designatorPath,
      {
        parseErrorMessage,
        missingWorkingFileMessage,
      },
    );
    if (!inventoryState) {
      throw new ResourcePageDefinitionResolutionError(
        `ResourcePageDefinition region ${regionKey} for ${
          formatDesignatorPathForDisplay(ownerDesignatorPath)
        } targets ${target.artifactPath}, but that ReferenceCatalog artifact is not registered in its owning Knop inventory.`,
      );
    }
    return inventoryState.workingLocalRelativePath;
  }

  const inventoryState = resolveResourcePageDefinitionInventoryState(
    meshBase,
    targetKnopInventoryTurtle,
    target.designatorPath,
    {
      parseErrorMessage,
      missingWorkingFileMessage,
    },
  );
  if (!inventoryState || inventoryState.artifactPath !== target.artifactPath) {
    throw new ResourcePageDefinitionResolutionError(
      `ResourcePageDefinition region ${regionKey} for ${
        formatDesignatorPathForDisplay(ownerDesignatorPath)
      } targets ${target.artifactPath}, but that ResourcePageDefinition artifact is not registered in its owning Knop inventory.`,
    );
  }

  return inventoryState.workingLocalRelativePath;
}

function requireMeshPathFromTargetArtifact(
  meshBase: string,
  artifactIri: string,
  errorMessage: string,
): string {
  if (!artifactIri.startsWith(meshBase)) {
    throw new ResourcePageDefinitionResolutionError(errorMessage);
  }

  const meshPath = artifactIri.slice(meshBase.length);
  if (meshPath.includes("#") || meshPath.includes("?")) {
    throw new ResourcePageDefinitionResolutionError(errorMessage);
  }

  return meshPath;
}

function describeSupportedTargetArtifact(
  artifactPath: string,
  errorMessage: string,
): ArtifactSourceTarget {
  if (
    artifactPath === ROOT_REFERENCE_CATALOG_PATH ||
    artifactPath.endsWith(REFERENCE_CATALOG_SUFFIX)
  ) {
    return {
      kind: "referenceCatalog",
      designatorPath: artifactPath === ROOT_REFERENCE_CATALOG_PATH
        ? ""
        : artifactPath.slice(0, -REFERENCE_CATALOG_SUFFIX.length),
      artifactPath,
    };
  }

  if (
    artifactPath === ROOT_PAGE_DEFINITION_ARTIFACT_PATH ||
    artifactPath.endsWith(PAGE_DEFINITION_ARTIFACT_SUFFIX)
  ) {
    return {
      kind: "resourcePageDefinition",
      designatorPath: artifactPath === ROOT_PAGE_DEFINITION_ARTIFACT_PATH
        ? ""
        : artifactPath.slice(0, -PAGE_DEFINITION_ARTIFACT_SUFFIX.length),
      artifactPath,
    };
  }

  try {
    return {
      kind: "payload",
      designatorPath: normalizeSafeDesignatorPath(
        artifactPath,
        "target artifact path",
        (message) => new ResourcePageDefinitionResolutionError(message),
        { allowRoot: true },
      ),
      artifactPath,
    };
  } catch {
    throw new ResourcePageDefinitionResolutionError(errorMessage);
  }
}

async function readAllowedSourceText(
  localPathPolicy: OperationalLocalPathPolicy,
  locatorKind: "workingLocalRelativePath" | "targetLocalRelativePath",
  sourcePath: string,
  accessErrorMessage: string,
  missingErrorMessage: string,
): Promise<string> {
  try {
    return await Deno.readTextFile(
      resolveAllowedLocalPath(
        localPathPolicy,
        locatorKind,
        sourcePath,
      ),
    );
  } catch (error) {
    if (error instanceof LocalPathAccessError) {
      throw new ResourcePageDefinitionResolutionError(accessErrorMessage);
    }
    if (error instanceof Deno.errors.NotFound) {
      throw new ResourcePageDefinitionResolutionError(missingErrorMessage);
    }
    throw error;
  }
}

async function readMeshSourceText(
  meshRoot: string,
  sourcePath: string,
  missingErrorMessage: string,
): Promise<string> {
  try {
    return await Deno.readTextFile(join(meshRoot, sourcePath));
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new ResourcePageDefinitionResolutionError(missingErrorMessage);
    }
    throw error;
  }
}

function parseTargetKnopInventoryQuads(
  meshBase: string,
  turtle: string,
  errorMessage: string,
): readonly Quad[] {
  try {
    return new Parser({ baseIRI: meshBase }).parse(turtle);
  } catch {
    throw new ResourcePageDefinitionResolutionError(errorMessage);
  }
}

function resolveRequiredNamedNodeObject(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
  errorMessage: string,
): string {
  const value = resolveOptionalNamedNodeObject(
    quads,
    subjectIri,
    predicateIri,
    errorMessage,
  );
  if (value === undefined) {
    throw new ResourcePageDefinitionResolutionError(errorMessage);
  }
  return value;
}

function resolveOptionalNamedNodeObject(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
  errorMessage: string,
): string | undefined {
  const values = collectNamedNodeObjects(quads, subjectIri, predicateIri);
  if (values.length > 1) {
    throw new ResourcePageDefinitionResolutionError(errorMessage);
  }
  return values[0];
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

async function listStylesheetPaths(
  meshRoot: string,
  assetBundlePath: string,
  designatorPath: string,
): Promise<readonly string[]> {
  const stylesheetPaths: string[] = [];

  try {
    for await (
      const entry of Deno.readDir(join(meshRoot, assetBundlePath))
    ) {
      if (!entry.isFile || !entry.name.endsWith(".css")) {
        continue;
      }
      stylesheetPaths.push(pathPosix.join(assetBundlePath, entry.name));
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new ResourcePageDefinitionResolutionError(
        `ResourcePageDefinition for ${
          formatDesignatorPathForDisplay(designatorPath)
        } declares a Knop asset bundle that is missing under the mesh root: ${assetBundlePath}`,
      );
    }
    throw error;
  }

  return stylesheetPaths.sort((left, right) => left.localeCompare(right));
}

function sortRegions(
  regions: readonly CustomIdentifierRegionModel[],
): readonly CustomIdentifierRegionModel[] {
  const rank = (key: string): number => {
    if (key === "main") {
      return 0;
    }
    if (key === "sidebar") {
      return 1;
    }
    return 2;
  };

  return [...regions].sort((left, right) => {
    const rankDifference = rank(left.key) - rank(right.key);
    return rankDifference !== 0
      ? rankDifference
      : left.key.localeCompare(right.key);
  });
}
