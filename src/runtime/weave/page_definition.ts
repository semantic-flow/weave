import { join } from "@std/path";
import * as pathPosix from "@std/path/posix";
import { Parser, type Quad } from "n3";
import {
  formatDesignatorPathForDisplay,
  normalizeSafeDesignatorPath,
  toKnopPath,
} from "../../core/designator_segments.ts";
import type { ResourcePageDefinitionWorkingArtifact } from "../../core/weave/weave.ts";
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

const SFC_NAMESPACE = "https://semantic-flow.github.io/ontology/core/";
const SFC_HAS_PAGE_REGION_IRI = `${SFC_NAMESPACE}hasPageRegion`;
const SFC_HAS_RESOURCE_PAGE_SOURCE_IRI =
  `${SFC_NAMESPACE}hasResourcePageSource`;
const SFC_HAS_TARGET_ARTIFACT_IRI = `${SFC_NAMESPACE}hasTargetArtifact`;
const SFC_HAS_TARGET_DISTRIBUTION_IRI = `${SFC_NAMESPACE}hasTargetDistribution`;
const SFC_HAS_TARGET_LOCATED_FILE_IRI = `${SFC_NAMESPACE}hasTargetLocatedFile`;
const SFC_HAS_REQUESTED_TARGET_HISTORY_IRI =
  `${SFC_NAMESPACE}hasRequestedTargetHistory`;
const SFC_HAS_REQUESTED_TARGET_STATE_IRI =
  `${SFC_NAMESPACE}hasRequestedTargetState`;
const SFC_HAS_ARTIFACT_RESOLUTION_MODE_IRI =
  `${SFC_NAMESPACE}hasArtifactResolutionMode`;
const SFC_HAS_ARTIFACT_RESOLUTION_FALLBACK_POLICY_IRI =
  `${SFC_NAMESPACE}hasArtifactResolutionFallbackPolicy`;
const SFC_TARGET_MESH_PATH_IRI = `${SFC_NAMESPACE}targetLocalRelativePath`;
const SFC_TARGET_ACCESS_URL_IRI = `${SFC_NAMESPACE}targetAccessUrl`;
const SFC_REGION_KEY_IRI = `${SFC_NAMESPACE}regionKey`;
const SFC_ARTIFACT_RESOLUTION_MODE_CURRENT_IRI =
  `${SFC_NAMESPACE}ArtifactResolutionMode/Current`;
const PAGE_DEFINITION_ARTIFACT_SUFFIX = "/_knop/_page";
const ROOT_PAGE_DEFINITION_ARTIFACT_PATH = "_knop/_page";
const ROOT_REFERENCE_CATALOG_PATH = "_knop/_references";
const REFERENCE_CATALOG_SUFFIX = "/_knop/_references";

interface ArtifactSourceCurrentState {
  kind: "payload" | "referenceCatalog" | "resourcePageDefinition";
  designatorPath: string;
  artifactPath: string;
  workingLocalRelativePath: string;
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
    SFC_HAS_PAGE_REGION_IRI,
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
        SFC_REGION_KEY_IRI,
        `ResourcePageDefinition region ${regionSubject} is missing regionKey for ${
          formatDesignatorPathForDisplay(designatorPath)
        }.`,
      );
      const sourceSubject = requireUniqueNamedNode(
        quads,
        regionSubject,
        SFC_HAS_RESOURCE_PAGE_SOURCE_IRI,
        `ResourcePageDefinition region ${key} is missing its ResourcePageSource for ${
          formatDesignatorPathForDisplay(designatorPath)
        }.`,
      );
      const targetArtifact = collectNamedNodeObjects(
        quads,
        sourceSubject,
        SFC_HAS_TARGET_ARTIFACT_IRI,
      );
      const requestedTargetHistories = collectNamedNodeObjects(
        quads,
        sourceSubject,
        SFC_HAS_REQUESTED_TARGET_HISTORY_IRI,
      );
      const requestedTargetStates = collectNamedNodeObjects(
        quads,
        sourceSubject,
        SFC_HAS_REQUESTED_TARGET_STATE_IRI,
      );
      const artifactResolutionModes = collectNamedNodeObjects(
        quads,
        sourceSubject,
        SFC_HAS_ARTIFACT_RESOLUTION_MODE_IRI,
      );
      const artifactResolutionFallbackPolicies = collectNamedNodeObjects(
        quads,
        sourceSubject,
        SFC_HAS_ARTIFACT_RESOLUTION_FALLBACK_POLICY_IRI,
      );
      const targetDistribution = collectNamedNodeObjects(
        quads,
        sourceSubject,
        SFC_HAS_TARGET_DISTRIBUTION_IRI,
      );
      const targetLocatedFile = collectNamedNodeObjects(
        quads,
        sourceSubject,
        SFC_HAS_TARGET_LOCATED_FILE_IRI,
      );
      const targetLocalRelativePaths = collectLiteralObjects(
        quads,
        sourceSubject,
        SFC_TARGET_MESH_PATH_IRI,
      );
      const targetAccessUrls = collectLiteralObjects(
        quads,
        sourceSubject,
        SFC_TARGET_ACCESS_URL_IRI,
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

      if (
        requestedTargetHistories.length > 0 ||
        requestedTargetStates.length > 0 ||
        artifactResolutionFallbackPolicies.length > 0
      ) {
        throw new ResourcePageDefinitionResolutionError(
          `ResourcePageDefinition region ${key} for ${
            formatDesignatorPathForDisplay(designatorPath)
          } requests pinned/history/fallback artifact resolution that this first artifact-backed page-source slice does not support yet.`,
        );
      }
      if (
        resolutionMode !== undefined &&
        resolutionMode !== SFC_ARTIFACT_RESOLUTION_MODE_CURRENT_IRI
      ) {
        throw new ResourcePageDefinitionResolutionError(
          `ResourcePageDefinition region ${key} for ${
            formatDesignatorPathForDisplay(designatorPath)
          } requests a non-Current artifact resolution mode that this first artifact-backed page-source slice does not support yet.`,
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
  };
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
  return `${statePath}/page-ttl/page.ttl`;
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
  const currentState = await resolveArtifactSourceCurrentState(
    meshRoot,
    meshBase,
    ownerDesignatorPath,
    regionKey,
    targetArtifactIri,
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

async function resolveArtifactSourceCurrentState(
  meshRoot: string,
  meshBase: string,
  ownerDesignatorPath: string,
  regionKey: string,
  targetArtifactIri: string,
): Promise<ArtifactSourceCurrentState> {
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
): Omit<ArtifactSourceCurrentState, "workingLocalRelativePath"> {
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
