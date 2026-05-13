import { Parser, type Quad } from "n3";
import {
  RDF_NAMESPACE,
  SFCFG_NAMESPACE,
  SFLO_NAMESPACE,
} from "../../core/rdf/namespaces.ts";
import type {
  ArtifactRole,
  ResourcePageGenerationPolicy,
} from "../config/effective_config.ts";

const RDF_TYPE_IRI = `${RDF_NAMESPACE}type`;
const SFCFG_CONFIG_ARTIFACT_IRI = `${SFCFG_NAMESPACE}ConfigArtifact`;
const SFLO_CURRENT_ARTIFACT_HISTORY_IRI =
  `${SFLO_NAMESPACE}currentArtifactHistory`;
const SFLO_HAS_ARTIFACT_HISTORY_IRI = `${SFLO_NAMESPACE}hasArtifactHistory`;
const SFLO_HAS_HISTORICAL_STATE_IRI = `${SFLO_NAMESPACE}hasHistoricalState`;
const SFLO_LATEST_HISTORICAL_STATE_IRI =
  `${SFLO_NAMESPACE}latestHistoricalState`;
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

export interface ResourcePageGenerationConfig {
  resourcePageGenerationPolicyForArtifactRole(
    artifactRole: ArtifactRole,
  ): ResourcePageGenerationPolicy;
}

export interface ListGeneratedResourcePagePathsInput {
  meshBase: string;
  inventoryTurtle: string;
  parseErrorMessage: string;
  config: ResourcePageGenerationConfig;
  explicitRequest?: boolean;
}

export class ResourcePagePolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResourcePagePolicyError";
  }
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
        input.config,
        input.explicitRequest ?? false,
      )
    ) {
      paths.add(pagePath);
    }
  }

  return [...paths].sort((left, right) => left.localeCompare(right));
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
): ReadonlyMap<string, ArtifactRole> {
  const roles = new Map<string, ArtifactRole>();

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
  artifactRoles: ReadonlyMap<string, ArtifactRole>,
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
  artifactRoles: ReadonlyMap<string, ArtifactRole>,
  ownerArtifacts: ReadonlyMap<string, string>,
  config: ResourcePageGenerationConfig,
  explicitRequest: boolean,
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

  return shouldGenerateForPolicy(
    config.resourcePageGenerationPolicyForArtifactRole(role),
    explicitRequest,
  );
}

function shouldGenerateForPolicy(
  policy: ResourcePageGenerationPolicy,
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

function artifactRoleForType(typeIri: string): ArtifactRole | undefined {
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
  return predicateIri === SFLO_HAS_ARTIFACT_HISTORY_IRI ||
    predicateIri === SFLO_CURRENT_ARTIFACT_HISTORY_IRI;
}

function isHistoricalStatePredicate(predicateIri: string): boolean {
  return predicateIri === SFLO_HAS_HISTORICAL_STATE_IRI ||
    predicateIri === SFLO_LATEST_HISTORICAL_STATE_IRI;
}

function isResourcePagePath(path: string): boolean {
  return path === "index.html" || path.endsWith("/index.html");
}

function tryToMeshPath(meshBase: string, iri: string): string | undefined {
  if (!iri.startsWith(meshBase)) {
    return undefined;
  }

  const suffix = iri.slice(meshBase.length);
  return suffix.length === 0 ? undefined : suffix;
}
