import { join } from "@std/path";
import * as pathPosix from "@std/path/posix";
import { Parser, type Quad } from "n3";
import { formatDesignatorPathForDisplay } from "../../core/designator_segments.ts";
import type { ResourcePageDefinitionWorkingArtifact } from "../../core/weave/candidates.ts";
import type { ResourcePageDefinitionInventoryState } from "../mesh/inventory.ts";
import {
  ArtifactResolutionError,
  resolveArtifactResolutionSpecQuads,
} from "../artifact_resolution/resolver.ts";
import {
  LocalPathAccessError,
  type OperationalLocalPathPolicy,
  resolveAllowedLocalPath,
} from "../operational/local_path_policy.ts";
import { SFCFG_NAMESPACE, SFLO_NAMESPACE } from "../../core/rdf/namespaces.ts";

const SFCFG_HAS_GENERATED_RESOURCE_PAGE_PANEL_SELECTION_IRI =
  `${SFCFG_NAMESPACE}hasGeneratedResourcePagePanelSelection`;
const SFLO_HAS_PAGE_REGION_IRI = `${SFLO_NAMESPACE}hasPageRegion`;
const SFLO_HAS_RESOURCE_PAGE_SOURCE_IRI =
  `${SFLO_NAMESPACE}hasResourcePageSource`;
const SFLO_HAS_TARGET_ARTIFACT_IRI = `${SFLO_NAMESPACE}targetArtifact`;
const SFLO_HAS_TARGET_DISTRIBUTION_IRI = `${SFLO_NAMESPACE}targetManifestation`;
const SFLO_HAS_TARGET_LOCATED_FILE_IRI = `${SFLO_NAMESPACE}targetLocatedFile`;
const SFLO_HAS_REQUESTED_TARGET_HISTORY_IRI =
  `${SFLO_NAMESPACE}targetArtifactHistory`;
const SFLO_HAS_REQUESTED_TARGET_STATE_IRI =
  `${SFLO_NAMESPACE}targetHistoricalState`;
const SFLO_HAS_ARTIFACT_RESOLUTION_MODE_IRI =
  `${SFLO_NAMESPACE}hasArtifactResolutionMode`;
const SFLO_HAS_ARTIFACT_RESOLUTION_FALLBACK_POLICY_IRI =
  `${SFLO_NAMESPACE}hasFallbackArtifactResolutionSpec`;
const SFLO_TARGET_MESH_PATH_IRI = `${SFLO_NAMESPACE}targetLocalRelativePath`;
const SFLO_TARGET_ACCESS_URL_IRI = `${SFLO_NAMESPACE}targetAccessUrl`;
const SFLO_REGION_KEY_IRI = `${SFLO_NAMESPACE}regionKey`;

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
  const generatedPanelSelectionIris = parseGeneratedResourcePagePanelSelections(
    quads,
    definitionIri,
    designatorPath,
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
      const artifactResolutionFallbackSpecs = collectResourceObjects(
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
          artifactResolutionFallbackSpecs.length > 0
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

      return await loadArtifactSourceRegionFromSpec(
        meshRoot,
        localPathPolicy,
        meshBase,
        designatorPath,
        key,
        quads,
        sourceSubject,
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
    generatedPanelSelectionIris,
  };
}

function parseGeneratedResourcePagePanelSelections(
  quads: readonly Quad[],
  definitionIri: string,
  designatorPath: string,
): readonly string[] {
  const selectionIris = collectNamedNodeObjects(
    quads,
    definitionIri,
    SFCFG_HAS_GENERATED_RESOURCE_PAGE_PANEL_SELECTION_IRI,
  );
  if (
    selectionIris.some((selectionIri) =>
      selectionIri.trim().length === 0 || selectionIri.includes(" ")
    )
  ) {
    throw new ResourcePageDefinitionResolutionError(
      `ResourcePageDefinition for ${
        formatDesignatorPathForDisplay(designatorPath)
      } declares an invalid generated ResourcePage panel selection IRI.`,
    );
  }

  return [...selectionIris].sort();
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

function collectResourceObjects(
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
      (quad.object.termType !== "NamedNode" &&
        quad.object.termType !== "BlankNode")
    ) {
      continue;
    }

    values.add(`${quad.object.termType}:${quad.object.value}`);
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

async function loadArtifactSourceRegionFromSpec(
  meshRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  meshBase: string,
  ownerDesignatorPath: string,
  regionKey: string,
  quads: readonly Quad[],
  sourceSubject: string,
  targetArtifactIri: string,
): Promise<CustomIdentifierRegionModel> {
  const sourceDescription = `ResourcePageDefinition region ${regionKey} for ${
    formatDesignatorPathForDisplay(ownerDesignatorPath)
  } page source targeting ${targetArtifactIri}`;

  try {
    const result = await resolveArtifactResolutionSpecQuads(
      { meshRoot, meshBase, localPathPolicy },
      quads,
      sourceSubject,
      { sourceDescription, contentMode: "text" },
    );

    if (
      result.observed.localRelativePath === undefined ||
      result.content?.text === undefined
    ) {
      throw new ResourcePageDefinitionResolutionError(
        `${sourceDescription} did not resolve to text content.`,
      );
    }

    return {
      key: regionKey,
      sourcePath: result.observed.localRelativePath,
      markdown: result.content.text,
    };
  } catch (error) {
    if (error instanceof ArtifactResolutionError) {
      throw new ResourcePageDefinitionResolutionError(error.message);
    }
    throw error;
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
