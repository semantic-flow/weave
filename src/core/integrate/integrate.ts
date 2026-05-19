import { Parser } from "n3";
import type { Quad } from "n3";
import * as pathPosix from "@std/path/posix";
import type { PlannedFile } from "../planned_file.ts";
import {
  normalizeSafeDesignatorPath,
  toKnopPath,
} from "../designator_segments.ts";
import {
  SFLO_NAMESPACE,
  SFLO_TURTLE_PREFIX_DECLARATION,
} from "../rdf/namespaces.ts";
import { escapeTurtleString } from "../rdf/turtle.ts";

const RDF_TYPE_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const XSD_ANY_URI_IRI = "http://www.w3.org/2001/XMLSchema#anyURI";
const SFLO_ARTIFACT_RESOLUTION_MODE_WORKING_IRI =
  `${SFLO_NAMESPACE}artifactResolutionMode_working`;
const SFLO_DIGITAL_ARTIFACT_IRI = `${SFLO_NAMESPACE}DigitalArtifact`;
const SFLO_HAS_KNOP_IRI = `${SFLO_NAMESPACE}hasKnop`;
const SFLO_HAS_MESH_INVENTORY_IRI = `${SFLO_NAMESPACE}hasMeshInventory`;
const SFLO_HAS_MESH_METADATA_IRI = `${SFLO_NAMESPACE}hasMeshMetadata`;
const SFLO_HAS_WORKING_LOCATED_FILE_IRI =
  `${SFLO_NAMESPACE}hasWorkingLocatedFile`;
const SFLO_KNOP_IRI = `${SFLO_NAMESPACE}Knop`;
const SFLO_LOCATED_FILE_IRI = `${SFLO_NAMESPACE}LocatedFile`;
const SFLO_MESH_BASE_IRI = `${SFLO_NAMESPACE}meshBase`;
const SFLO_MESH_INVENTORY_IRI = `${SFLO_NAMESPACE}MeshInventory`;
const SFLO_MESH_METADATA_IRI = `${SFLO_NAMESPACE}MeshMetadata`;
const SFLO_PAYLOAD_ARTIFACT_IRI = `${SFLO_NAMESPACE}PayloadArtifact`;
const SFLO_RDF_DOCUMENT_IRI = `${SFLO_NAMESPACE}RdfDocument`;
const SFLO_SEMANTIC_MESH_IRI = `${SFLO_NAMESPACE}SemanticMesh`;
const SFLO_WORKING_LOCAL_RELATIVE_PATH_IRI =
  `${SFLO_NAMESPACE}workingLocalRelativePath`;

export interface IntegrateRepositorySource {
  repositoryUrl: string;
  repositoryRef: string;
  repositoryCommit?: string;
  repositoryPath: string;
  contentDigest?: string;
}

export interface IntegrateSourceBinding {
  bindingId?: string;
  targetLocalRelativePath?: string;
  repositorySource?: IntegrateRepositorySource;
  expectedContentDigest?: string;
  artifactResolutionMode?: "working";
}

export interface IntegrateRequest {
  designatorPath: string;
  workingLocalRelativePath: string;
  sourceBinding?: IntegrateSourceBinding;
}

export interface ResolvedIntegrateRequest extends IntegrateRequest {
  meshBase: string;
  currentMeshInventoryTurtle: string;
}

export interface IntegratePlan {
  meshBase: string;
  designatorPath: string;
  payloadArtifactIri: string;
  knopIri: string;
  workingLocalRelativePath: string;
  sourceBindingIri?: string;
  createdFiles: readonly PlannedFile[];
  updatedFiles: readonly PlannedFile[];
}

export class IntegrateInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntegrateInputError";
  }
}

export function planIntegrate(
  request: ResolvedIntegrateRequest,
): IntegratePlan {
  const meshBase = normalizeMeshBase(request.meshBase);
  const designatorPath = normalizeDesignatorPath(request.designatorPath);
  const workingLocalRelativePath = normalizeWorkingLocalRelativePath(
    request.workingLocalRelativePath,
  );
  const sourceBinding = normalizeSourceBinding(
    request.sourceBinding,
    workingLocalRelativePath,
  );
  const knopPath = toKnopPath(designatorPath);
  const knopInventoryPath = `${knopPath}/_inventory/inventory.ttl`;
  const updatedMeshInventoryTurtle = renderUpdatedMeshInventoryTurtle(
    meshBase,
    request.currentMeshInventoryTurtle,
    designatorPath,
    workingLocalRelativePath,
  );

  return {
    meshBase,
    designatorPath,
    payloadArtifactIri: new URL(designatorPath, meshBase).href,
    knopIri: new URL(knopPath, meshBase).href,
    workingLocalRelativePath,
    ...(sourceBinding
      ? {
        sourceBindingIri: new URL(
          `${knopPath}/_sources#${sourceBinding.bindingId}`,
          meshBase,
        ).href,
      }
      : {}),
    createdFiles: [
      {
        path: `${knopPath}/_meta/meta.ttl`,
        contents: renderKnopMetadataTurtle(meshBase, designatorPath),
      },
      {
        path: knopInventoryPath,
        contents: renderKnopInventoryTurtle(
          meshBase,
          designatorPath,
          workingLocalRelativePath,
          sourceBinding,
        ),
      },
      ...(sourceBinding
        ? [{
          path: `${knopPath}/_sources/sources.ttl`,
          contents: renderKnopSourcesTurtle(
            meshBase,
            designatorPath,
            sourceBinding,
          ),
        }]
        : []),
    ],
    updatedFiles: [
      {
        path: "_mesh/_inventory/inventory.ttl",
        contents: updatedMeshInventoryTurtle,
      },
    ],
  };
}

function normalizeMeshBase(meshBase: string): string {
  const trimmed = meshBase.trim();
  if (trimmed.length === 0) {
    throw new IntegrateInputError("meshBase is required");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new IntegrateInputError("meshBase must be an absolute IRI");
  }

  if (!url.pathname.endsWith("/")) {
    throw new IntegrateInputError("meshBase must end with '/'");
  }
  if (url.search.length > 0 || url.hash.length > 0) {
    throw new IntegrateInputError(
      "meshBase must not include a query or fragment",
    );
  }

  return url.href;
}

function normalizeDesignatorPath(designatorPath: string): string {
  return normalizeSafeDesignatorPath(
    designatorPath,
    "designatorPath",
    (message) => new IntegrateInputError(message),
    { allowRoot: true },
  );
}

function normalizeWorkingLocalRelativePath(
  workingLocalRelativePath: string,
): string {
  const trimmed = workingLocalRelativePath.trim();
  if (trimmed.length === 0) {
    throw new IntegrateInputError("workingLocalRelativePath is required");
  }
  if (
    trimmed.startsWith("/") || trimmed.endsWith("/") ||
    /^[A-Za-z]:/.test(trimmed)
  ) {
    throw new IntegrateInputError(
      "workingLocalRelativePath must be a relative file path",
    );
  }
  if (
    trimmed.includes("\\") || trimmed.includes("?") || trimmed.includes("#") ||
    /\s/.test(trimmed)
  ) {
    throw new IntegrateInputError(
      "workingLocalRelativePath contains unsupported path characters",
    );
  }

  const normalized = pathPosix.normalize(trimmed);
  if (normalized === "." || normalized === "..") {
    throw new IntegrateInputError(
      "workingLocalRelativePath must be a relative file path",
    );
  }

  const segments = normalized.split("/");
  if (segments.some((segment) => segment.length === 0)) {
    throw new IntegrateInputError(
      "workingLocalRelativePath must not contain empty path segments",
    );
  }

  return normalized;
}

function normalizeSourceBinding(
  sourceBinding: IntegrateSourceBinding | undefined,
  workingLocalRelativePath: string,
): NormalizedIntegrateSourceBinding | undefined {
  if (sourceBinding === undefined) {
    return undefined;
  }

  const bindingId = sourceBinding.bindingId === undefined
    ? "payload-source"
    : normalizeSourceBindingId(sourceBinding.bindingId);
  const targetLocalRelativePath = sourceBinding.targetLocalRelativePath ===
      undefined
    ? workingLocalRelativePath
    : normalizeWorkingLocalRelativePath(sourceBinding.targetLocalRelativePath);
  const repositorySource = sourceBinding.repositorySource === undefined
    ? undefined
    : normalizeRepositorySource(sourceBinding.repositorySource);
  const expectedContentDigest = sourceBinding.expectedContentDigest ===
      undefined
    ? repositorySource?.contentDigest
    : normalizeNonEmptyLiteral(
      sourceBinding.expectedContentDigest,
      "sourceBinding.expectedContentDigest",
    );
  const artifactResolutionMode = sourceBinding.artifactResolutionMode ??
    "working";
  if (artifactResolutionMode !== "working") {
    throw new IntegrateInputError(
      "sourceBinding.artifactResolutionMode must be working",
    );
  }

  return {
    bindingId,
    targetLocalRelativePath,
    ...(repositorySource ? { repositorySource } : {}),
    ...(expectedContentDigest ? { expectedContentDigest } : {}),
    artifactResolutionMode,
  };
}

interface NormalizedIntegrateSourceBinding {
  bindingId: string;
  targetLocalRelativePath: string;
  repositorySource?: NormalizedIntegrateRepositorySource;
  expectedContentDigest?: string;
  artifactResolutionMode: "working";
}

interface NormalizedIntegrateRepositorySource {
  repositoryUrl: string;
  repositoryRef: string;
  repositoryCommit?: string;
  repositoryPath: string;
  contentDigest?: string;
}

function normalizeSourceBindingId(bindingId: string): string {
  const trimmed = bindingId.trim();
  if (trimmed.length === 0) {
    throw new IntegrateInputError("sourceBinding.bindingId must not be empty");
  }
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(trimmed)) {
    throw new IntegrateInputError(
      "sourceBinding.bindingId must start with a letter and contain only letters, numbers, underscores, or hyphens",
    );
  }
  return trimmed;
}

function normalizeRepositorySource(
  repositorySource: IntegrateRepositorySource,
): NormalizedIntegrateRepositorySource {
  const repositoryUrl = normalizeNonEmptyLiteral(
    repositorySource.repositoryUrl,
    "sourceBinding.repositorySource.repositoryUrl",
  );
  const repositoryRef = normalizeNonEmptyLiteral(
    repositorySource.repositoryRef,
    "sourceBinding.repositorySource.repositoryRef",
  );
  const repositoryPath = normalizeRepositoryPath(
    repositorySource.repositoryPath,
  );
  const repositoryCommit = repositorySource.repositoryCommit === undefined
    ? undefined
    : normalizeNonEmptyLiteral(
      repositorySource.repositoryCommit,
      "sourceBinding.repositorySource.repositoryCommit",
    );
  const contentDigest = repositorySource.contentDigest === undefined
    ? undefined
    : normalizeNonEmptyLiteral(
      repositorySource.contentDigest,
      "sourceBinding.repositorySource.contentDigest",
    );

  return {
    repositoryUrl,
    repositoryRef,
    ...(repositoryCommit ? { repositoryCommit } : {}),
    repositoryPath,
    ...(contentDigest ? { contentDigest } : {}),
  };
}

function normalizeRepositoryPath(repositoryPath: string): string {
  const normalized = normalizeWorkingLocalRelativePath(repositoryPath);
  if (normalized.startsWith("../")) {
    throw new IntegrateInputError(
      "sourceBinding.repositorySource.repositoryPath must be relative to the repository root",
    );
  }
  return normalized;
}

function normalizeNonEmptyLiteral(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new IntegrateInputError(`${fieldName} must not be empty`);
  }
  return trimmed;
}

function usesMeshLocalWorkingLocatedFile(
  workingLocalRelativePath: string,
): boolean {
  return !normalizeWorkingLocalRelativePath(workingLocalRelativePath)
    .startsWith("../");
}

function renderCurrentWorkingFileLocator(
  workingLocalRelativePath: string,
): string {
  return usesMeshLocalWorkingLocatedFile(workingLocalRelativePath)
    ? `sflo:hasWorkingLocatedFile <${workingLocalRelativePath}> .`
    : `sflo:workingLocalRelativePath ${
      JSON.stringify(workingLocalRelativePath)
    } .`;
}

function renderCurrentWorkingFileDeclaration(
  workingLocalRelativePath: string,
): string {
  return usesMeshLocalWorkingLocatedFile(workingLocalRelativePath)
    ? `<${workingLocalRelativePath}> a sflo:LocatedFile, sflo:RdfDocument .`
    : "";
}

function renderKnopMetadataTurtle(
  meshBase: string,
  designatorPath: string,
): string {
  const knopPath = toKnopPath(designatorPath);
  return `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}

<${knopPath}> a sflo:Knop ;
  sflo:designatorPath "${designatorPath}" ;
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> .
`;
}

function renderKnopInventoryTurtle(
  meshBase: string,
  designatorPath: string,
  workingLocalRelativePath: string,
  sourceBinding: NormalizedIntegrateSourceBinding | undefined,
): string {
  const knopPath = toKnopPath(designatorPath);
  const sourceRegistryPath = `${knopPath}/_sources`;
  const currentWorkingFileLocator = renderCurrentWorkingFileLocator(
    workingLocalRelativePath,
  );
  const currentWorkingFileDeclaration = renderCurrentWorkingFileDeclaration(
    workingLocalRelativePath,
  );
  const sourceRegistryKnopLine = sourceBinding
    ? `  sflo:hasKnopSourceRegistry <${sourceRegistryPath}> ;\n`
    : "";
  const sourceRegistryDeclarations = sourceBinding
    ? `
<${sourceRegistryPath}> a sflo:KnopSourceRegistry, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${sourceRegistryPath}/sources.ttl> .

<${sourceRegistryPath}/sources.ttl> a sflo:LocatedFile, sflo:RdfDocument .

`
    : "";
  return `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}

<${knopPath}> a sflo:Knop ;
  sflo:hasKnopMetadata <${knopPath}/_meta> ;
  sflo:hasKnopInventory <${knopPath}/_inventory> ;
${sourceRegistryKnopLine}  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> ;
  sflo:hasPayloadArtifact <${designatorPath}> .

<${designatorPath}> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  ${currentWorkingFileLocator}

<${knopPath}/_meta> a sflo:KnopMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${knopPath}/_meta/meta.ttl> .

<${knopPath}/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${knopPath}/_inventory/inventory.ttl> .

${sourceRegistryDeclarations}<${knopPath}/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

${currentWorkingFileDeclaration}
`;
}

function renderKnopSourcesTurtle(
  meshBase: string,
  designatorPath: string,
  sourceBinding: NormalizedIntegrateSourceBinding,
): string {
  const knopPath = toKnopPath(designatorPath);
  const sourceRegistryPath = `${knopPath}/_sources`;
  const sourcesFilePath = `${sourceRegistryPath}/sources.ttl`;
  const sourceBindingPath = `${sourceRegistryPath}#${sourceBinding.bindingId}`;
  const sourceBindingFacts = renderSourceBindingFacts(
    meshBase,
    designatorPath,
    sourceBinding,
  );

  return `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}

<${sourceRegistryPath}> a sflo:KnopSourceRegistry, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${sourcesFilePath}> ;
  sflo:hasSourceBinding <${sourceBindingPath}> .

<${sourceBindingPath}> a sflo:ArtifactResolutionTarget ;
${sourceBindingFacts}

<${sourcesFilePath}> a sflo:LocatedFile, sflo:RdfDocument .
`;
}

function renderSourceBindingFacts(
  meshBase: string,
  designatorPath: string,
  sourceBinding: NormalizedIntegrateSourceBinding,
): string {
  const facts: [string, string][] = [
    ["sflo:hasTargetArtifact", `<${new URL(designatorPath, meshBase).href}>`],
    [
      "sflo:targetLocalRelativePath",
      `"${escapeTurtleString(sourceBinding.targetLocalRelativePath)}"`,
    ],
    [
      "sflo:hasArtifactResolutionMode",
      `<${SFLO_ARTIFACT_RESOLUTION_MODE_WORKING_IRI}>`,
    ],
  ];
  if (sourceBinding.expectedContentDigest !== undefined) {
    facts.push([
      "sflo:expectsContentDigest",
      `"${escapeTurtleString(sourceBinding.expectedContentDigest)}"`,
    ]);
  }
  if (sourceBinding.repositorySource !== undefined) {
    facts.push([
      "sflo:hasTargetRepositorySource",
      renderRepositorySourceBlankNode(sourceBinding.repositorySource),
    ]);
  }

  return facts.map(([predicate, object], index) =>
    `  ${predicate} ${object}${index === facts.length - 1 ? " ." : " ;"}`
  ).join("\n");
}

function renderRepositorySourceBlankNode(
  repositorySource: NormalizedIntegrateRepositorySource,
): string {
  const facts: [string, string][] = [
    ["a", "sflo:RepositorySourceLocator"],
    [
      "sflo:sourceRepositoryUrl",
      `"${escapeTurtleString(repositorySource.repositoryUrl)}"`,
    ],
    [
      "sflo:sourceRepositoryRef",
      `"${escapeTurtleString(repositorySource.repositoryRef)}"`,
    ],
  ];
  if (repositorySource.repositoryCommit !== undefined) {
    facts.push([
      "sflo:sourceRepositoryCommit",
      `"${escapeTurtleString(repositorySource.repositoryCommit)}"`,
    ]);
  }
  facts.push([
    "sflo:sourceRepositoryPath",
    `"${escapeTurtleString(repositorySource.repositoryPath)}"`,
  ]);
  if (repositorySource.contentDigest !== undefined) {
    facts.push([
      "sflo:hasContentDigest",
      `"${escapeTurtleString(repositorySource.contentDigest)}"`,
    ]);
  }

  const lines = facts.map(([predicate, object], index) =>
    `    ${predicate} ${object}${index === facts.length - 1 ? "" : " ;"}`
  );
  return `[
${lines.join("\n")}
  ]`;
}

function renderUpdatedMeshInventoryTurtle(
  meshBase: string,
  currentMeshInventoryTurtle: string,
  designatorPath: string,
  workingLocalRelativePath: string,
): string {
  assertCanIntegrateIntoCurrentMeshInventory(
    meshBase,
    currentMeshInventoryTurtle,
    designatorPath,
    workingLocalRelativePath,
  );

  return renderIntegratedMeshInventoryTurtle(
    currentMeshInventoryTurtle,
    designatorPath,
    workingLocalRelativePath,
  );
}

function assertCanIntegrateIntoCurrentMeshInventory(
  meshBase: string,
  currentMeshInventoryTurtle: string,
  designatorPath: string,
  workingLocalRelativePath: string,
): void {
  const knopPath = toKnopPath(designatorPath);
  const errorMessage =
    `current mesh inventory has an unsupported carried shape for integrate: ${designatorPath}`;
  const quads = parseMeshInventoryQuads(
    meshBase,
    currentMeshInventoryTurtle,
    errorMessage,
  );

  if (
    !hasNamedNodeFact(
      quads,
      meshBase,
      "_mesh",
      RDF_TYPE_IRI,
      SFLO_SEMANTIC_MESH_IRI,
    )
  ) {
    throw new IntegrateInputError(
      "current mesh inventory is missing the _mesh block",
    );
  }

  const payloadArtifactPaths = listTypedSubjectPaths(
    quads,
    meshBase,
    SFLO_PAYLOAD_ARTIFACT_IRI,
  );
  if (payloadArtifactPaths.includes(designatorPath)) {
    throw new IntegrateInputError(
      `mesh inventory already registers payload artifact: ${designatorPath}`,
    );
  }

  const meshKnopPaths = listNamedNodeObjectPaths(
    quads,
    meshBase,
    "_mesh",
    SFLO_HAS_KNOP_IRI,
  );
  const typedKnopPaths = listTypedSubjectPaths(quads, meshBase, SFLO_KNOP_IRI);
  if (meshKnopPaths.includes(knopPath) || typedKnopPaths.includes(knopPath)) {
    throw new IntegrateInputError(
      `mesh inventory already registers knop: ${knopPath}`,
    );
  }
  if (!haveSameMembers(meshKnopPaths, typedKnopPaths)) {
    throw new IntegrateInputError(errorMessage);
  }

  if (meshKnopPaths.some((path) => fromKnopPath(path) === undefined)) {
    throw new IntegrateInputError(errorMessage);
  }

  if (
    isWorkingFileAlreadyRegistered(quads, meshBase, workingLocalRelativePath)
  ) {
    throw new IntegrateInputError(
      `mesh inventory already registers working file: ${workingLocalRelativePath}`,
    );
  }

  assertHasNamedNodeFacts(quads, meshBase, errorMessage, [
    ["_mesh", RDF_TYPE_IRI, SFLO_SEMANTIC_MESH_IRI],
    ["_mesh", SFLO_HAS_MESH_METADATA_IRI, "_mesh/_meta"],
    ["_mesh", SFLO_HAS_MESH_INVENTORY_IRI, "_mesh/_inventory"],
    ["_mesh/_meta", RDF_TYPE_IRI, SFLO_MESH_METADATA_IRI],
    ["_mesh/_meta", RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    ["_mesh/_meta", RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    ["_mesh/_meta", SFLO_HAS_WORKING_LOCATED_FILE_IRI, "_mesh/_meta/meta.ttl"],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_MESH_INVENTORY_IRI],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
    ["_mesh/_inventory", RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    [
      "_mesh/_inventory",
      SFLO_HAS_WORKING_LOCATED_FILE_IRI,
      "_mesh/_inventory/inventory.ttl",
    ],
    ["_mesh/_meta/meta.ttl", RDF_TYPE_IRI, SFLO_LOCATED_FILE_IRI],
    ["_mesh/_meta/meta.ttl", RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
    ["_mesh/_inventory/inventory.ttl", RDF_TYPE_IRI, SFLO_LOCATED_FILE_IRI],
    ["_mesh/_inventory/inventory.ttl", RDF_TYPE_IRI, SFLO_RDF_DOCUMENT_IRI],
  ]);
  assertHasLiteralFacts(quads, meshBase, errorMessage, [
    ["_mesh", SFLO_MESH_BASE_IRI, meshBase, XSD_ANY_URI_IRI],
  ]);
}

function renderIntegratedMeshInventoryTurtle(
  currentMeshInventoryTurtle: string,
  designatorPath: string,
  workingLocalRelativePath: string,
): string {
  const knopPath = toKnopPath(designatorPath);
  const knopInventoryPath = `${knopPath}/_inventory/inventory.ttl`;
  const currentWorkingFileLocator = renderCurrentWorkingFileLocator(
    workingLocalRelativePath,
  );
  const currentWorkingFileDeclaration = renderCurrentWorkingFileDeclaration(
    workingLocalRelativePath,
  );
  const currentWorkingFileDeclarationBlock =
    currentWorkingFileDeclaration.length > 0
      ? `\n${currentWorkingFileDeclaration}\n`
      : "\n";

  return `${currentMeshInventoryTurtle.trimEnd()}

<_mesh> sflo:hasKnop <${knopPath}> .

<${designatorPath}> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  ${currentWorkingFileLocator}

<${knopPath}> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <${knopInventoryPath}> .

<${knopInventoryPath}> a sflo:LocatedFile, sflo:RdfDocument .
${currentWorkingFileDeclarationBlock}`;
}

function assertHasNamedNodeFacts(
  quads: readonly Quad[],
  meshBase: string,
  errorMessage: string,
  facts: readonly (readonly [string, string, string])[],
): void {
  for (const [subjectValue, predicateIri, objectValue] of facts) {
    if (
      !hasNamedNodeFact(
        quads,
        meshBase,
        subjectValue,
        predicateIri,
        objectValue,
      )
    ) {
      throw new IntegrateInputError(errorMessage);
    }
  }
}

function assertHasLiteralFacts(
  quads: readonly Quad[],
  meshBase: string,
  errorMessage: string,
  facts: readonly (readonly [string, string, string, string])[],
): void {
  for (const [subjectValue, predicateIri, literalValue, datatypeIri] of facts) {
    if (
      !hasLiteralFact(
        quads,
        meshBase,
        subjectValue,
        predicateIri,
        literalValue,
        datatypeIri,
      )
    ) {
      throw new IntegrateInputError(errorMessage);
    }
  }
}

function haveSameMembers(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return left.length === right.length &&
    left.every((value) => right.includes(value));
}

function isWorkingFileAlreadyRegistered(
  quads: readonly Quad[],
  meshBase: string,
  workingLocalRelativePath: string,
): boolean {
  if (usesMeshLocalWorkingLocatedFile(workingLocalRelativePath)) {
    return hasNamedNodeFact(
      quads,
      meshBase,
      workingLocalRelativePath,
      RDF_TYPE_IRI,
      SFLO_LOCATED_FILE_IRI,
    );
  }

  return quads.some((quad) =>
    quad.predicate.value === SFLO_WORKING_LOCAL_RELATIVE_PATH_IRI &&
    quad.object.termType === "Literal" &&
    quad.object.value === workingLocalRelativePath
  );
}

function hasNamedNodeFact(
  quads: readonly Quad[],
  meshBase: string,
  subjectValue: string,
  predicateIri: string,
  objectValue: string,
): boolean {
  const subjectIri = new URL(subjectValue, meshBase).href;
  const objectIri = new URL(objectValue, meshBase).href;

  return quads.some((quad) =>
    quad.subject.termType === "NamedNode" &&
    quad.subject.value === subjectIri &&
    quad.predicate.value === predicateIri &&
    quad.object.termType === "NamedNode" &&
    quad.object.value === objectIri
  );
}

function hasLiteralFact(
  quads: readonly Quad[],
  meshBase: string,
  subjectValue: string,
  predicateIri: string,
  literalValue: string,
  datatypeIri: string,
): boolean {
  const subjectIri = new URL(subjectValue, meshBase).href;

  return quads.some((quad) =>
    quad.subject.termType === "NamedNode" &&
    quad.subject.value === subjectIri &&
    quad.predicate.value === predicateIri &&
    quad.object.termType === "Literal" &&
    quad.object.value === literalValue &&
    quad.object.datatype.value === datatypeIri
  );
}

function listNamedNodeObjectPaths(
  quads: readonly Quad[],
  meshBase: string,
  subjectValue: string,
  predicateIri: string,
): string[] {
  const subjectIri = new URL(subjectValue, meshBase).href;
  const paths = new Set<string>();

  for (const quad of quads) {
    if (
      quad.subject.termType !== "NamedNode" ||
      quad.subject.value !== subjectIri ||
      quad.predicate.value !== predicateIri ||
      quad.object.termType !== "NamedNode"
    ) {
      continue;
    }

    const path = toRelativeMeshPath(meshBase, quad.object.value);
    if (path !== undefined) {
      paths.add(path);
    }
  }

  return [...paths];
}

function listTypedSubjectPaths(
  quads: readonly Quad[],
  meshBase: string,
  typeIri: string,
): string[] {
  const paths = new Set<string>();

  for (const quad of quads) {
    if (
      quad.subject.termType !== "NamedNode" ||
      quad.predicate.value !== RDF_TYPE_IRI ||
      quad.object.termType !== "NamedNode" ||
      quad.object.value !== typeIri
    ) {
      continue;
    }

    const path = toRelativeMeshPath(meshBase, quad.subject.value);
    if (path !== undefined) {
      paths.add(path);
    }
  }

  return [...paths];
}

function toRelativeMeshPath(
  meshBase: string,
  absoluteIri: string,
): string | undefined {
  return absoluteIri.startsWith(meshBase)
    ? absoluteIri.slice(meshBase.length)
    : undefined;
}

function fromKnopPath(knopPath: string): string | undefined {
  if (knopPath === "_knop") {
    return "";
  }
  return knopPath.endsWith("/_knop")
    ? knopPath.slice(0, -"/_knop".length)
    : undefined;
}

function parseMeshInventoryQuads(
  meshBase: string,
  turtle: string,
  errorMessage: string,
): Quad[] {
  try {
    return new Parser({ baseIRI: meshBase }).parse(turtle);
  } catch {
    throw new IntegrateInputError(errorMessage);
  }
}
