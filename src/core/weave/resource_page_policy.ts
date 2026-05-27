import { Parser, type Quad } from "n3";
import type { PlannedFile } from "../planned_file.ts";
import {
  RDF_NAMESPACE,
  SFCFG_NAMESPACE,
  SFLO_NAMESPACE,
} from "../rdf/namespaces.ts";

const RDF_TYPE_IRI = `${RDF_NAMESPACE}type`;
const SFCFG_APPLICATION_CONFIG_IRI = `${SFCFG_NAMESPACE}ApplicationConfig`;
const SFCFG_CONFIG_ARTIFACT_IRI = `${SFCFG_NAMESPACE}ConfigArtifact`;
const SFCFG_MESH_CONFIG_IRI = `${SFCFG_NAMESPACE}MeshConfig`;
const SFLO_HAS_ARTIFACT_HISTORY_IRI = `${SFLO_NAMESPACE}hasArtifactHistory`;
const SFLO_HAS_HISTORICAL_STATE_IRI = `${SFLO_NAMESPACE}hasHistoricalState`;
const SFLO_HAS_MANIFESTATION_IRI = `${SFLO_NAMESPACE}hasManifestation`;
const SFLO_HAS_RESOURCE_PAGE_IRI = `${SFLO_NAMESPACE}hasResourcePage`;
const SFLO_KNOP_INVENTORY_IRI = `${SFLO_NAMESPACE}KnopInventory`;
const SFLO_KNOP_METADATA_IRI = `${SFLO_NAMESPACE}KnopMetadata`;
const SFLO_MESH_INVENTORY_IRI = `${SFLO_NAMESPACE}MeshInventory`;
const SFLO_MESH_METADATA_IRI = `${SFLO_NAMESPACE}MeshMetadata`;
const SFLO_PAYLOAD_ARTIFACT_IRI = `${SFLO_NAMESPACE}PayloadArtifact`;
const SFLO_REFERENCE_CATALOG_IRI = `${SFLO_NAMESPACE}ReferenceCatalog`;
const SFLO_RESOURCE_PAGE_DEFINITION_IRI =
  `${SFLO_NAMESPACE}ResourcePageDefinition`;

export type WeaveArtifactRole =
  | "payload"
  | "meshInventory"
  | "knopInventory"
  | "meshMetadata"
  | "knopMetadata"
  | "config"
  | "referenceCatalog"
  | "resourcePageDefinition"
  | "resourcePageTemplate"
  | "resourcePageStylesheet"
  | "runtimeMeta";

export type WeaveResourcePageGenerationPolicy =
  | "generate"
  | "suppress"
  | "defer"
  | "onRequest";

export type WeaveResourcePageGenerationPolicies = Partial<
  Record<WeaveArtifactRole, WeaveResourcePageGenerationPolicy>
>;

export interface ResourcePageGenerationConfig {
  resourcePageGenerationPolicyForArtifactRole(
    artifactRole: WeaveArtifactRole,
  ): WeaveResourcePageGenerationPolicy;
  resourcePageGenerationPolicyForArtifactTarget?(target: {
    artifactIri: string;
    artifactRole: WeaveArtifactRole;
  }): WeaveResourcePageGenerationPolicy;
}

export interface ListGeneratedResourcePagePathsInput {
  meshBase: string;
  inventoryTurtle: string;
  parseErrorMessage: string;
  config?: ResourcePageGenerationConfig;
  policies?: WeaveResourcePageGenerationPolicies;
  explicitRequest?: boolean;
}

export interface FilterResourcePageFactsInput {
  meshBase: string;
  inventoryTurtle: string;
  parseErrorMessage: string;
  config?: ResourcePageGenerationConfig;
  policies?: WeaveResourcePageGenerationPolicies;
  explicitRequest?: boolean;
}

export class ResourcePagePolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResourcePagePolicyError";
  }
}

export function hasResourcePageGenerationPolicyOverrides(
  policies?: WeaveResourcePageGenerationPolicies,
): boolean {
  return policies !== undefined &&
    Object.values(policies).some((policy) =>
      policy !== undefined && policy !== "generate"
    );
}

export function listGeneratedResourcePagePaths(
  input: ListGeneratedResourcePagePathsInput,
): readonly string[] {
  const quads = parseInventoryQuads(
    input.meshBase,
    input.inventoryTurtle,
    input.parseErrorMessage,
  );
  const artifactRoles = collectArtifactRoles(input.meshBase, quads);
  const ownerArtifacts = collectOwnerArtifacts(
    input.meshBase,
    quads,
    artifactRoles,
  );
  const paths = new Set<string>();

  for (const quad of quads) {
    if (
      quad.predicate.value !== SFLO_HAS_RESOURCE_PAGE_IRI ||
      quad.object.termType !== "NamedNode"
    ) {
      continue;
    }

    const subjectPath = tryToMeshPath(input.meshBase, quad.subject.value);
    const pagePath = tryToMeshPath(input.meshBase, quad.object.value);
    if (
      subjectPath === undefined ||
      pagePath === undefined ||
      !isResourcePagePath(pagePath)
    ) {
      continue;
    }
    if (
      shouldGenerateResourcePageForSubject(
        subjectPath,
        artifactRoles,
        ownerArtifacts,
        input,
      )
    ) {
      paths.add(pagePath);
    }
  }

  return [...paths].sort((left, right) => left.localeCompare(right));
}

export function filterResourcePageFactsFromInventoryTurtle(
  input: FilterResourcePageFactsInput,
): string {
  if (
    input.config === undefined &&
    !hasResourcePageGenerationPolicyOverrides(input.policies)
  ) {
    return input.inventoryTurtle;
  }

  const quads = parseInventoryQuads(
    input.meshBase,
    input.inventoryTurtle,
    input.parseErrorMessage,
  );
  const artifactRoles = collectArtifactRoles(input.meshBase, quads);
  const ownerArtifacts = collectOwnerArtifacts(
    input.meshBase,
    quads,
    artifactRoles,
  );
  const disallowedPagePaths = new Set<string>();

  for (const quad of quads) {
    if (
      quad.predicate.value !== SFLO_HAS_RESOURCE_PAGE_IRI ||
      quad.object.termType !== "NamedNode"
    ) {
      continue;
    }

    const subjectPath = tryToMeshPath(input.meshBase, quad.subject.value);
    const pagePath = tryToMeshPath(input.meshBase, quad.object.value);
    if (
      subjectPath === undefined ||
      pagePath === undefined ||
      !isResourcePagePath(pagePath)
    ) {
      continue;
    }
    if (
      !shouldGenerateResourcePageForSubject(
        subjectPath,
        artifactRoles,
        ownerArtifacts,
        input,
      )
    ) {
      disallowedPagePaths.add(pagePath);
    }
  }

  if (disallowedPagePaths.size === 0) {
    return input.inventoryTurtle;
  }

  return removeResourcePagePaths(input.inventoryTurtle, disallowedPagePaths);
}

export function filterResourcePageFactsFromPlannedFiles(
  meshBase: string,
  files: readonly PlannedFile[],
  policies?: WeaveResourcePageGenerationPolicies,
  explicitRequest = false,
  config?: ResourcePageGenerationConfig,
): readonly PlannedFile[] {
  if (
    config === undefined && !hasResourcePageGenerationPolicyOverrides(policies)
  ) {
    return files;
  }

  return files.map((file) => {
    if (!isInventoryTurtlePath(file.path)) {
      return file;
    }
    return {
      ...file,
      contents: filterResourcePageFactsFromInventoryTurtle({
        meshBase,
        inventoryTurtle: file.contents,
        parseErrorMessage:
          `Could not parse ${file.path} while applying ResourcePage generation policy.`,
        config,
        policies,
        explicitRequest,
      }),
    };
  });
}

function parseInventoryQuads(
  meshBase: string,
  inventoryTurtle: string,
  parseErrorMessage: string,
): readonly Quad[] {
  try {
    return new Parser({ baseIRI: meshBase }).parse(inventoryTurtle);
  } catch {
    throw new ResourcePagePolicyError(parseErrorMessage);
  }
}

function collectArtifactRoles(
  meshBase: string,
  quads: readonly Quad[],
): ReadonlyMap<string, WeaveArtifactRole> {
  const roles = new Map<string, WeaveArtifactRole>();

  for (const quad of quads) {
    if (
      quad.predicate.value !== RDF_TYPE_IRI ||
      quad.object.termType !== "NamedNode"
    ) {
      continue;
    }
    const subjectPath = tryToMeshPath(meshBase, quad.subject.value);
    const role = artifactRoleForType(quad.object.value);
    if (subjectPath !== undefined && role !== undefined) {
      roles.set(subjectPath, role);
    }
  }

  return roles;
}

function collectOwnerArtifacts(
  meshBase: string,
  quads: readonly Quad[],
  artifactRoles: ReadonlyMap<string, WeaveArtifactRole>,
): ReadonlyMap<string, string> {
  const ownerByHistoryPath = new Map<string, string>();
  const ownerByStatePath = new Map<string, string>();
  const ownerByManifestationPath = new Map<string, string>();

  for (const quad of quads) {
    if (
      quad.object.termType !== "NamedNode" ||
      !isArtifactHistoryPredicate(quad.predicate.value)
    ) {
      continue;
    }
    const artifactPath = tryToMeshPath(meshBase, quad.subject.value);
    const historyPath = tryToMeshPath(meshBase, quad.object.value);
    if (
      artifactPath !== undefined &&
      historyPath !== undefined &&
      artifactRoles.has(artifactPath)
    ) {
      ownerByHistoryPath.set(historyPath, artifactPath);
    }
  }

  for (const quad of quads) {
    if (
      quad.object.termType !== "NamedNode" ||
      !isHistoricalStatePredicate(quad.predicate.value)
    ) {
      continue;
    }
    const historyPath = tryToMeshPath(meshBase, quad.subject.value);
    const statePath = tryToMeshPath(meshBase, quad.object.value);
    const artifactPath = historyPath === undefined
      ? undefined
      : ownerByHistoryPath.get(historyPath);
    if (artifactPath !== undefined && statePath !== undefined) {
      ownerByStatePath.set(statePath, artifactPath);
    }
  }

  for (const quad of quads) {
    if (
      quad.object.termType !== "NamedNode" ||
      quad.predicate.value !== SFLO_HAS_MANIFESTATION_IRI
    ) {
      continue;
    }
    const statePath = tryToMeshPath(meshBase, quad.subject.value);
    const manifestationPath = tryToMeshPath(meshBase, quad.object.value);
    const artifactPath = statePath === undefined
      ? undefined
      : ownerByStatePath.get(statePath);
    if (artifactPath !== undefined && manifestationPath !== undefined) {
      ownerByManifestationPath.set(manifestationPath, artifactPath);
    }
  }

  return new Map([
    ...ownerByHistoryPath,
    ...ownerByStatePath,
    ...ownerByManifestationPath,
  ]);
}

function shouldGenerateResourcePageForSubject(
  subjectPath: string,
  artifactRoles: ReadonlyMap<string, WeaveArtifactRole>,
  ownerArtifacts: ReadonlyMap<string, string>,
  input: {
    meshBase: string;
    config?: ResourcePageGenerationConfig;
    policies?: WeaveResourcePageGenerationPolicies;
    explicitRequest?: boolean;
  },
): boolean {
  const ownerArtifactPath = artifactRoles.has(subjectPath)
    ? subjectPath
    : ownerArtifacts.get(subjectPath);
  if (ownerArtifactPath === undefined) {
    return true;
  }

  const role = artifactRoles.get(ownerArtifactPath);
  if (role === undefined) {
    return true;
  }

  const artifactIri = new URL(ownerArtifactPath, input.meshBase).href;
  return shouldGenerateForPolicy(
    input.config?.resourcePageGenerationPolicyForArtifactTarget?.({
      artifactIri,
      artifactRole: role,
    }) ??
      input.config?.resourcePageGenerationPolicyForArtifactRole(role) ??
      input.policies?.[role] ??
      "generate",
    input.explicitRequest ?? false,
  );
}

function shouldGenerateForPolicy(
  policy: WeaveResourcePageGenerationPolicy,
  explicitRequest: boolean,
): boolean {
  switch (policy) {
    case "generate":
      return true;
    case "onRequest":
      return explicitRequest;
    case "defer":
    case "suppress":
      return false;
  }
}

function artifactRoleForType(typeIri: string): WeaveArtifactRole | undefined {
  switch (typeIri) {
    case SFLO_PAYLOAD_ARTIFACT_IRI:
      return "payload";
    case SFLO_MESH_INVENTORY_IRI:
      return "meshInventory";
    case SFLO_KNOP_INVENTORY_IRI:
      return "knopInventory";
    case SFLO_MESH_METADATA_IRI:
      return "meshMetadata";
    case SFLO_KNOP_METADATA_IRI:
      return "knopMetadata";
    case SFCFG_CONFIG_ARTIFACT_IRI:
    case SFCFG_APPLICATION_CONFIG_IRI:
    case SFCFG_MESH_CONFIG_IRI:
      return "config";
    case SFLO_REFERENCE_CATALOG_IRI:
      return "referenceCatalog";
    case SFLO_RESOURCE_PAGE_DEFINITION_IRI:
      return "resourcePageDefinition";
    default:
      return undefined;
  }
}

function isArtifactHistoryPredicate(predicateIri: string): boolean {
  return predicateIri === SFLO_HAS_ARTIFACT_HISTORY_IRI;
}

function isHistoricalStatePredicate(predicateIri: string): boolean {
  return predicateIri === SFLO_HAS_HISTORICAL_STATE_IRI;
}

function isResourcePagePath(path: string): boolean {
  return path === "index.html" || path.endsWith("/index.html");
}

function isInventoryTurtlePath(path: string): boolean {
  return path === "_mesh/_inventory/inventory.ttl" ||
    path.endsWith("/_inventory/inventory.ttl") ||
    path.endsWith("/ttl/inventory.ttl");
}

function removeResourcePagePaths(
  turtle: string,
  pagePaths: ReadonlySet<string>,
): string {
  const blocks = turtle.trimEnd().split("\n\n");
  const filteredBlocks = blocks.flatMap((block) => {
    const subject = parseSubjectPath(block);
    if (subject !== undefined && pagePaths.has(subject)) {
      return [];
    }

    const lines = block.split("\n");
    const filteredLines = lines.filter((line) =>
      !isDisallowedResourcePageFact(line, pagePaths)
    );
    if (filteredLines.length === lines.length) {
      return [block];
    }

    const normalizedBlock = normalizeTrailingPredicate(filteredLines);
    return normalizedBlock === undefined ? [] : [normalizedBlock];
  });

  return `${filteredBlocks.join("\n\n")}\n`;
}

function parseSubjectPath(block: string): string | undefined {
  const firstLine = block.split("\n", 1)[0]?.trim();
  const match = firstLine?.match(/^<([^>]+)>/);
  return match?.[1];
}

function isDisallowedResourcePageFact(
  line: string,
  pagePaths: ReadonlySet<string>,
): boolean {
  const match = line.match(/\bsflo:hasResourcePage <([^>]+)> [.;]$/);
  return match !== null && pagePaths.has(match[1]!);
}

function normalizeTrailingPredicate(
  lines: readonly string[],
): string | undefined {
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
  const lastPredicateIndex = findLastIndex(
    nonEmptyLines,
    (line) => line.trimEnd().endsWith(";"),
  );
  if (lastPredicateIndex !== -1) {
    nonEmptyLines[lastPredicateIndex] = nonEmptyLines[lastPredicateIndex]!
      .replace(/;\s*$/, ".");
  }

  return nonEmptyLines.some((line) => line.trimEnd().endsWith("."))
    ? nonEmptyLines.join("\n")
    : undefined;
}

function findLastIndex<T>(
  values: readonly T[],
  predicate: (value: T) => boolean,
): number {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (predicate(values[index]!)) {
      return index;
    }
  }
  return -1;
}

function tryToMeshPath(meshBase: string, iri: string): string | undefined {
  if (!iri.startsWith(meshBase)) {
    return undefined;
  }

  return iri.slice(meshBase.length);
}
