import { join } from "@std/path";
import * as pathPosix from "@std/path/posix";
import { Parser, type Quad } from "n3";
import { formatDesignatorPathForDisplay } from "../../core/designator_segments.ts";
import type { ResourcePageDefinitionWorkingArtifact } from "../../core/weave/weave.ts";
import { type ResourcePageDefinitionInventoryState } from "../mesh/inventory.ts";
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
const SFC_TARGET_MESH_PATH_IRI = `${SFC_NAMESPACE}targetMeshPath`;
const SFC_REGION_KEY_IRI = `${SFC_NAMESPACE}regionKey`;

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
  _meshRoot: string,
  localPathPolicy: OperationalLocalPathPolicy,
  designatorPath: string,
  inventoryState: ResourcePageDefinitionInventoryState | undefined,
): Promise<ResourcePageDefinitionWorkingArtifact | undefined> {
  if (!inventoryState) {
    return undefined;
  }

  try {
    return {
      ...inventoryState,
      currentPageDefinitionTurtle: await Deno.readTextFile(
        resolveAllowedLocalPath(
          localPathPolicy,
          "workingFilePath",
          inventoryState.workingFilePath,
        ),
      ),
    };
  } catch (error) {
    if (error instanceof LocalPathAccessError) {
      throw new ResourcePageDefinitionResolutionError(
        `Working ResourcePageDefinition file for ${
          formatDesignatorPathForDisplay(designatorPath)
        } is outside the allowed local-path boundary: ${inventoryState.workingFilePath}`,
      );
    }
    if (error instanceof Deno.errors.NotFound) {
      throw new ResourcePageDefinitionResolutionError(
        `Mesh root is missing the working ResourcePageDefinition file for ${
          formatDesignatorPathForDisplay(designatorPath)
        }: ${inventoryState.workingFilePath}`,
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

      if (
        targetArtifact.length > 0 ||
        targetDistribution.length > 0 ||
        targetLocatedFile.length > 0
      ) {
        throw new ResourcePageDefinitionResolutionError(
          `ResourcePageDefinition region ${key} for ${
            formatDesignatorPathForDisplay(designatorPath)
          } uses artifact/distribution/located-file targets that this first implementation slice does not support yet.`,
        );
      }

      const sourcePath = normalizeTargetMeshPath(
        requireUniqueLiteral(
          quads,
          sourceSubject,
          SFC_TARGET_MESH_PATH_IRI,
          `ResourcePageDefinition region ${key} is missing targetMeshPath for ${
            formatDesignatorPathForDisplay(designatorPath)
          }.`,
        ),
        designatorPath,
      );

      try {
        return {
          key,
          sourcePath,
          markdown: await Deno.readTextFile(
            resolveAllowedLocalPath(
              localPathPolicy,
              "targetMeshPath",
              sourcePath,
            ),
          ),
        };
      } catch (error) {
        if (error instanceof LocalPathAccessError) {
          throw new ResourcePageDefinitionResolutionError(
            `ResourcePageDefinition region ${key} for ${
              formatDesignatorPathForDisplay(designatorPath)
            } points outside the allowed local-path boundary: ${sourcePath}`,
          );
        }
        if (error instanceof Deno.errors.NotFound) {
          throw new ResourcePageDefinitionResolutionError(
            `ResourcePageDefinition region ${key} for ${
              formatDesignatorPathForDisplay(designatorPath)
            } points at a missing mesh-local file: ${sourcePath}`,
          );
        }
        throw error;
      }
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
  return `Resource page for the ${
    formatDesignatorPathForDisplay(designatorPath)
  } ResourcePageDefinition artifact.`;
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

function normalizeTargetMeshPath(
  value: string,
  designatorPath: string,
): string {
  const trimmed = value.trim();
  const pathDisplay = formatDesignatorPathForDisplay(designatorPath);

  if (trimmed.length === 0) {
    throw new ResourcePageDefinitionResolutionError(
      `ResourcePageDefinition for ${pathDisplay} contains an empty targetMeshPath.`,
    );
  }
  if (trimmed.includes("\\")) {
    throw new ResourcePageDefinitionResolutionError(
      `targetMeshPath values must use forward slashes; found ${trimmed}.`,
    );
  }
  if (trimmed.startsWith("/") || /^[A-Za-z]:/.test(trimmed)) {
    throw new ResourcePageDefinitionResolutionError(
      `targetMeshPath values must stay relative to the mesh root; found ${trimmed}.`,
    );
  }

  const normalized = pathPosix.normalize(trimmed);
  if (normalized === "." || normalized === "..") {
    throw new ResourcePageDefinitionResolutionError(
      `targetMeshPath values must point at a file-like path; found ${trimmed}.`,
    );
  }

  return normalized;
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
