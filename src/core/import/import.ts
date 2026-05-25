import { Parser, type Quad } from "n3";
import * as pathPosix from "@std/path/posix";
import {
  normalizeSafeDesignatorPath,
  RESERVED_DESIGNATOR_SEGMENTS,
  toKnopPath,
} from "../designator_segments.ts";
import type { PlannedFile } from "../planned_file.ts";
import {
  SFLO_NAMESPACE,
  SFLO_TURTLE_PREFIX_DECLARATION,
  XSD_NAMESPACE,
} from "../rdf/namespaces.ts";
import { escapeTurtleString } from "../rdf/turtle.ts";

const RDF_TYPE_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const XSD_ANY_URI_IRI = "http://www.w3.org/2001/XMLSchema#anyURI";
const SFLO_ARTIFACT_RESOLUTION_MODE_WORKING_IRI =
  `${SFLO_NAMESPACE}artifactResolutionMode_working`;
const SFLO_DIGITAL_ARTIFACT_IRI = `${SFLO_NAMESPACE}DigitalArtifact`;
const SFLO_HAS_KNOP_IRI = `${SFLO_NAMESPACE}hasKnop`;
const SFLO_HAS_KNOP_SOURCE_REGISTRY_IRI =
  `${SFLO_NAMESPACE}hasKnopSourceRegistry`;
const SFLO_HAS_MESH_INVENTORY_IRI = `${SFLO_NAMESPACE}hasMeshInventory`;
const SFLO_HAS_MESH_METADATA_IRI = `${SFLO_NAMESPACE}hasMeshMetadata`;
const SFLO_HAS_PAYLOAD_ARTIFACT_IRI = `${SFLO_NAMESPACE}hasPayloadArtifact`;
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

export interface ImportSourceBinding {
  bindingId?: string;
  targetAccessUrl?: string;
  targetLocalRelativePath?: string;
  expectedContentDigest?: string;
  observation: ImportSourceObservation;
  artifactResolutionMode?: "working";
}

export interface ImportSourceObservation {
  observedContentDigest: string;
  observedTargetLocalRelativePath?: string;
  observedAt?: string;
}

export interface ImportRequest {
  designatorPath: string;
  workingLocalRelativePath: string;
  importedBytes: Uint8Array;
  sourceBinding: ImportSourceBinding;
  payloadIsRdfDocument?: boolean;
  replaceWorking?: boolean;
}

export interface ResolvedImportRequest extends ImportRequest {
  meshBase: string;
  currentMeshInventoryTurtle: string;
  currentKnopInventoryTurtle?: string;
  currentSourceRegistryTurtle?: string;
}

export interface PlannedImportFile {
  path: string;
  contents: Uint8Array;
}

export interface ImportPlan {
  meshBase: string;
  designatorPath: string;
  payloadArtifactIri: string;
  knopIri: string;
  workingLocalRelativePath: string;
  observedContentDigest: string;
  sourceBindingIri: string;
  workingFile: PlannedImportFile;
  createdFiles: readonly PlannedFile[];
  updatedFiles: readonly PlannedFile[];
}

export class ImportInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportInputError";
  }
}

export function planImport(request: ResolvedImportRequest): ImportPlan {
  const meshBase = normalizeMeshBase(request.meshBase);
  const designatorPath = normalizeDesignatorPath(request.designatorPath);
  const workingLocalRelativePath = normalizeWorkingLocalRelativePath(
    request.workingLocalRelativePath,
  );
  const importedBytes = normalizeImportedBytes(request.importedBytes);
  const sourceBinding = normalizeSourceBinding(
    request.sourceBinding,
    workingLocalRelativePath,
  );
  const payloadIsRdfDocument = request.payloadIsRdfDocument === true;
  const replaceWorking = request.replaceWorking === true;
  const knopPath = toKnopPath(designatorPath);
  const existingPayload = request.currentKnopInventoryTurtle === undefined
    ? undefined
    : resolveExistingPayload(
      meshBase,
      designatorPath,
      workingLocalRelativePath,
      request.currentKnopInventoryTurtle,
    );

  if (existingPayload !== undefined && !replaceWorking) {
    throw new ImportInputError(
      `import target already exists: ${designatorPath}`,
    );
  }
  if (existingPayload === undefined) {
    assertCanImportIntoCurrentMeshInventory(
      meshBase,
      request.currentMeshInventoryTurtle,
      designatorPath,
      workingLocalRelativePath,
    );
  }

  const sourceRegistryPath = existingPayload?.sourceRegistryPath ??
    `${knopPath}/_sources`;
  const sourcesFilePath = `${sourceRegistryPath}/sources.ttl`;
  const sourceBindingPath = `${sourceRegistryPath}#${sourceBinding.bindingId}`;
  const sourceRegistryTurtle = renderKnopSourcesTurtle(
    meshBase,
    designatorPath,
    sourceRegistryPath,
    sourceBinding,
  );

  const createdFiles: PlannedFile[] = [];
  const updatedFiles: PlannedFile[] = [];
  if (existingPayload === undefined) {
    createdFiles.push(
      {
        path: `${knopPath}/_meta/meta.ttl`,
        contents: renderKnopMetadataTurtle(meshBase, designatorPath),
      },
      {
        path: `${knopPath}/_inventory/inventory.ttl`,
        contents: renderNewKnopInventoryTurtle(
          meshBase,
          designatorPath,
          workingLocalRelativePath,
          sourceRegistryPath,
          payloadIsRdfDocument,
        ),
      },
      {
        path: sourcesFilePath,
        contents: sourceRegistryTurtle,
      },
    );
    updatedFiles.push({
      path: "_mesh/_inventory/inventory.ttl",
      contents: renderImportedMeshInventoryTurtle(
        request.currentMeshInventoryTurtle,
        designatorPath,
        workingLocalRelativePath,
        payloadIsRdfDocument,
      ),
    });
  } else {
    if (!existingPayload.hasSourceRegistry) {
      updatedFiles.push({
        path: `${knopPath}/_inventory/inventory.ttl`,
        contents: renderKnopInventoryWithSourceRegistry(
          request.currentKnopInventoryTurtle!,
          meshBase,
          designatorPath,
          sourceRegistryPath,
        ),
      });
      createdFiles.push({
        path: sourcesFilePath,
        contents: sourceRegistryTurtle,
      });
    } else {
      updatedFiles.push({
        path: sourcesFilePath,
        contents: sourceRegistryTurtle,
      });
    }
  }

  return {
    meshBase,
    designatorPath,
    payloadArtifactIri: new URL(designatorPath, meshBase).href,
    knopIri: new URL(knopPath, meshBase).href,
    workingLocalRelativePath,
    observedContentDigest: sourceBinding.observation.observedContentDigest,
    sourceBindingIri: new URL(sourceBindingPath, meshBase).href,
    workingFile: {
      path: workingLocalRelativePath,
      contents: importedBytes,
    },
    createdFiles,
    updatedFiles,
  };
}

function normalizeMeshBase(meshBase: string): string {
  const trimmed = meshBase.trim();
  if (trimmed.length === 0) {
    throw new ImportInputError("meshBase is required");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new ImportInputError("meshBase must be an absolute IRI");
  }

  if (!url.pathname.endsWith("/")) {
    throw new ImportInputError("meshBase must end with '/'");
  }
  if (url.search.length > 0 || url.hash.length > 0) {
    throw new ImportInputError("meshBase must not include a query or fragment");
  }

  return url.href;
}

function normalizeDesignatorPath(designatorPath: string): string {
  return normalizeSafeDesignatorPath(
    designatorPath,
    "designatorPath",
    (message) => new ImportInputError(message),
    { allowRoot: true },
  );
}

function normalizeWorkingLocalRelativePath(
  workingLocalRelativePath: string,
): string {
  const trimmed = workingLocalRelativePath.trim();
  if (trimmed.length === 0) {
    throw new ImportInputError("workingLocalRelativePath is required");
  }
  if (
    trimmed.startsWith("/") || trimmed.endsWith("/") ||
    /^[A-Za-z]:/.test(trimmed)
  ) {
    throw new ImportInputError(
      "workingLocalRelativePath must be a mesh-relative file path",
    );
  }
  if (
    trimmed.includes("\\") || trimmed.includes("?") || trimmed.includes("#") ||
    /\s/.test(trimmed)
  ) {
    throw new ImportInputError(
      "workingLocalRelativePath contains unsupported path characters",
    );
  }

  const normalized = pathPosix.normalize(trimmed);
  if (
    normalized === "." || normalized === ".." || normalized.startsWith("../")
  ) {
    throw new ImportInputError(
      "workingLocalRelativePath must be a mesh-relative file path",
    );
  }

  const segments = normalized.split("/");
  if (segments.some((segment) => segment.length === 0)) {
    throw new ImportInputError(
      "workingLocalRelativePath must not contain empty path segments",
    );
  }
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new ImportInputError(
      "workingLocalRelativePath must be a mesh-relative file path",
    );
  }
  if (segments.some((segment) => RESERVED_DESIGNATOR_SEGMENTS.has(segment))) {
    throw new ImportInputError(
      "workingLocalRelativePath must not contain reserved support path segments",
    );
  }

  return normalized;
}

function normalizeImportedBytes(importedBytes: Uint8Array): Uint8Array {
  if (importedBytes.byteLength === 0) {
    throw new ImportInputError("imported bytes are required");
  }
  return importedBytes;
}

function normalizeSourceBinding(
  sourceBinding: ImportSourceBinding,
  workingLocalRelativePath: string,
): NormalizedImportSourceBinding {
  const bindingId = sourceBinding.bindingId === undefined
    ? "payload-source"
    : normalizeSourceBindingId(sourceBinding.bindingId);
  const targetAccessUrl = sourceBinding.targetAccessUrl === undefined
    ? undefined
    : normalizeAccessUrl(sourceBinding.targetAccessUrl);
  const targetLocalRelativePath = sourceBinding.targetLocalRelativePath ===
      undefined
    ? undefined
    : normalizeWorkingLocalRelativePath(sourceBinding.targetLocalRelativePath);
  const expectedContentDigest = sourceBinding.expectedContentDigest ===
      undefined
    ? undefined
    : normalizeNonEmptyLiteral(
      sourceBinding.expectedContentDigest,
      "sourceBinding.expectedContentDigest",
    );
  const observation = normalizeSourceObservation(
    sourceBinding.observation,
    workingLocalRelativePath,
  );
  const artifactResolutionMode = sourceBinding.artifactResolutionMode ??
    "working";
  if (artifactResolutionMode !== "working") {
    throw new ImportInputError(
      "sourceBinding.artifactResolutionMode must be working",
    );
  }
  if (targetAccessUrl !== undefined && targetLocalRelativePath !== undefined) {
    throw new ImportInputError(
      "sourceBinding.targetAccessUrl must not be used with sourceBinding.targetLocalRelativePath",
    );
  }

  return {
    bindingId,
    ...(targetAccessUrl ? { targetAccessUrl } : {}),
    ...(targetLocalRelativePath ? { targetLocalRelativePath } : {}),
    ...(expectedContentDigest ? { expectedContentDigest } : {}),
    observation,
    artifactResolutionMode,
  };
}

interface NormalizedImportSourceBinding {
  bindingId: string;
  targetAccessUrl?: string;
  targetLocalRelativePath?: string;
  expectedContentDigest?: string;
  observation: NormalizedImportSourceObservation;
  artifactResolutionMode: "working";
}

interface NormalizedImportSourceObservation {
  observedContentDigest: string;
  observedTargetLocalRelativePath: string;
  observedAt?: string;
}

function normalizeSourceBindingId(bindingId: string): string {
  const trimmed = bindingId.trim();
  if (trimmed.length === 0) {
    throw new ImportInputError("sourceBinding.bindingId must not be empty");
  }
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(trimmed)) {
    throw new ImportInputError(
      "sourceBinding.bindingId must start with a letter and contain only letters, numbers, underscores, or hyphens",
    );
  }
  return trimmed;
}

function normalizeAccessUrl(value: string): string {
  const trimmed = normalizeNonEmptyLiteral(
    value,
    "sourceBinding.targetAccessUrl",
  );
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new ImportInputError(
      "sourceBinding.targetAccessUrl must be an absolute URL",
    );
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ImportInputError(
      "sourceBinding.targetAccessUrl must use http or https",
    );
  }
  url.hash = "";
  return url.href;
}

function normalizeSourceObservation(
  observation: ImportSourceObservation,
  workingLocalRelativePath: string,
): NormalizedImportSourceObservation {
  const observedContentDigest = normalizeNonEmptyLiteral(
    observation.observedContentDigest,
    "sourceBinding.observation.observedContentDigest",
  );
  const observedTargetLocalRelativePath =
    observation.observedTargetLocalRelativePath === undefined
      ? workingLocalRelativePath
      : normalizeWorkingLocalRelativePath(
        observation.observedTargetLocalRelativePath,
      );
  const observedAt = observation.observedAt === undefined
    ? undefined
    : normalizeNonEmptyLiteral(
      observation.observedAt,
      "sourceBinding.observation.observedAt",
    );

  return {
    observedContentDigest,
    observedTargetLocalRelativePath,
    ...(observedAt ? { observedAt } : {}),
  };
}

function normalizeNonEmptyLiteral(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ImportInputError(`${fieldName} must not be empty`);
  }
  return trimmed;
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

function renderNewKnopInventoryTurtle(
  meshBase: string,
  designatorPath: string,
  workingLocalRelativePath: string,
  sourceRegistryPath: string,
  payloadIsRdfDocument: boolean,
): string {
  const knopPath = toKnopPath(designatorPath);
  const payloadTypes = renderPayloadArtifactTypes(payloadIsRdfDocument);
  const workingFileTypes = renderLocatedFileTypes(payloadIsRdfDocument);

  return `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}

<${knopPath}> a sflo:Knop ;
  sflo:hasKnopMetadata <${knopPath}/_meta> ;
  sflo:hasKnopInventory <${knopPath}/_inventory> ;
  sflo:hasKnopSourceRegistry <${sourceRegistryPath}> ;
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> ;
  sflo:hasPayloadArtifact <${designatorPath}> .

<${designatorPath}> a ${payloadTypes} ;
  sflo:hasWorkingLocatedFile <${workingLocalRelativePath}> .

<${knopPath}/_meta> a sflo:KnopMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${knopPath}/_meta/meta.ttl> .

<${knopPath}/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${knopPath}/_inventory/inventory.ttl> .

<${sourceRegistryPath}> a sflo:KnopSourceRegistry, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${sourceRegistryPath}/sources.ttl> .

<${knopPath}/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${sourceRegistryPath}/sources.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${workingLocalRelativePath}> a ${workingFileTypes} .
`;
}

function renderKnopSourcesTurtle(
  meshBase: string,
  designatorPath: string,
  sourceRegistryPath: string,
  sourceBinding: NormalizedImportSourceBinding,
): string {
  const sourcesFilePath = `${sourceRegistryPath}/sources.ttl`;
  const sourceBindingPath = `${sourceRegistryPath}#${sourceBinding.bindingId}`;
  const observationPath = `${sourceBindingPath}-observation-001`;
  const sourceBindingFacts = renderSourceBindingFacts(
    meshBase,
    designatorPath,
    sourceBinding,
    observationPath,
  );
  const observationBlock = renderSourceObservationBlock(
    observationPath,
    sourceBinding.observation,
  );

  return `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}

<${sourceRegistryPath}> a sflo:KnopSourceRegistry, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${sourcesFilePath}> ;
  sflo:hasSourceBinding <${sourceBindingPath}> .

<${sourceBindingPath}> a sflo:ImportSource ;
${sourceBindingFacts}

${observationBlock}

<${sourcesFilePath}> a sflo:LocatedFile, sflo:RdfDocument .
`;
}

function renderSourceBindingFacts(
  meshBase: string,
  designatorPath: string,
  sourceBinding: NormalizedImportSourceBinding,
  observationPath: string,
): string {
  const facts: [string, string][] = [
    ["sflo:hasTargetArtifact", `<${new URL(designatorPath, meshBase).href}>`],
  ];
  if (sourceBinding.targetAccessUrl !== undefined) {
    facts.push([
      "sflo:targetAccessUrl",
      `"${escapeTurtleString(sourceBinding.targetAccessUrl)}"`,
    ]);
  }
  if (sourceBinding.targetLocalRelativePath !== undefined) {
    facts.push([
      "sflo:targetLocalRelativePath",
      `"${escapeTurtleString(sourceBinding.targetLocalRelativePath)}"`,
    ]);
  }
  facts.push([
    "sflo:hasArtifactResolutionMode",
    `<${SFLO_ARTIFACT_RESOLUTION_MODE_WORKING_IRI}>`,
  ]);
  if (sourceBinding.expectedContentDigest !== undefined) {
    facts.push([
      "sflo:expectsContentDigest",
      `"${escapeTurtleString(sourceBinding.expectedContentDigest)}"`,
    ]);
  }
  facts.push([
    "sflo:hasResolutionObservation",
    `<${observationPath}>`,
  ]);

  return facts.map(([predicate, object], index) =>
    `  ${predicate} ${object}${index === facts.length - 1 ? " ." : " ;"}`
  ).join("\n");
}

function renderSourceObservationBlock(
  observationPath: string,
  observation: NormalizedImportSourceObservation,
): string {
  const facts: [string, string][] = [
    ["a", "sflo:ArtifactResolutionObservation"],
    [
      "sflo:observedContentDigest",
      `"${escapeTurtleString(observation.observedContentDigest)}"`,
    ],
    [
      "sflo:observedTargetLocalRelativePath",
      `"${escapeTurtleString(observation.observedTargetLocalRelativePath)}"`,
    ],
  ];
  if (observation.observedAt !== undefined) {
    facts.push([
      "sflo:observedAt",
      `"${
        escapeTurtleString(observation.observedAt)
      }"^^<${XSD_NAMESPACE}dateTime>`,
    ]);
  }

  const lines = facts.map(([predicate, object], index) =>
    `  ${predicate} ${object}${index === facts.length - 1 ? " ." : " ;"}`
  );
  return `<${observationPath}>
${lines.join("\n")}`;
}

function renderPayloadArtifactTypes(payloadIsRdfDocument: boolean): string {
  return payloadIsRdfDocument
    ? "sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument"
    : "sflo:PayloadArtifact, sflo:DigitalArtifact";
}

function renderLocatedFileTypes(payloadIsRdfDocument: boolean): string {
  return payloadIsRdfDocument
    ? "sflo:LocatedFile, sflo:RdfDocument"
    : "sflo:LocatedFile";
}

function renderImportedMeshInventoryTurtle(
  currentMeshInventoryTurtle: string,
  designatorPath: string,
  workingLocalRelativePath: string,
  payloadIsRdfDocument: boolean,
): string {
  const knopPath = toKnopPath(designatorPath);
  const knopInventoryPath = `${knopPath}/_inventory/inventory.ttl`;
  const payloadTypes = renderPayloadArtifactTypes(payloadIsRdfDocument);
  const workingFileTypes = renderLocatedFileTypes(payloadIsRdfDocument);

  return `${currentMeshInventoryTurtle.trimEnd()}

<_mesh> sflo:hasKnop <${knopPath}> .

<${designatorPath}> a ${payloadTypes} ;
  sflo:hasWorkingLocatedFile <${workingLocalRelativePath}> .

<${knopPath}> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <${knopInventoryPath}> .

<${knopInventoryPath}> a sflo:LocatedFile, sflo:RdfDocument .

<${workingLocalRelativePath}> a ${workingFileTypes} .
`;
}

function renderKnopInventoryWithSourceRegistry(
  currentKnopInventoryTurtle: string,
  meshBase: string,
  designatorPath: string,
  sourceRegistryPath: string,
): string {
  const current = currentKnopInventoryTurtle.trimEnd();
  const quads = parseQuads(
    meshBase,
    currentKnopInventoryTurtle,
    `current Knop inventory has an unsupported carried shape for import: ${designatorPath}`,
  );
  const knopIri = new URL(toKnopPath(designatorPath), meshBase).href;
  const sourceRegistryIri = new URL(sourceRegistryPath, meshBase).href;
  if (
    hasNamedNodeFact(
      quads,
      knopIri,
      SFLO_HAS_KNOP_SOURCE_REGISTRY_IRI,
      sourceRegistryIri,
    )
  ) {
    return currentKnopInventoryTurtle;
  }

  return `${current}

<${
    toKnopPath(designatorPath)
  }> sflo:hasKnopSourceRegistry <${sourceRegistryPath}> .

<${sourceRegistryPath}> a sflo:KnopSourceRegistry, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${sourceRegistryPath}/sources.ttl> .

<${sourceRegistryPath}/sources.ttl> a sflo:LocatedFile, sflo:RdfDocument .
`;
}

function resolveExistingPayload(
  meshBase: string,
  designatorPath: string,
  workingLocalRelativePath: string,
  currentKnopInventoryTurtle: string,
): ExistingPayloadState {
  const errorMessage =
    `current Knop inventory has an unsupported carried shape for import: ${designatorPath}`;
  const quads = parseQuads(meshBase, currentKnopInventoryTurtle, errorMessage);
  const knopPath = toKnopPath(designatorPath);
  const knopIri = new URL(knopPath, meshBase).href;
  const payloadArtifactIri = new URL(designatorPath, meshBase).href;

  assertHasNamedNodeFacts(quads, errorMessage, [
    [knopIri, RDF_TYPE_IRI, SFLO_KNOP_IRI],
    [knopIri, SFLO_HAS_PAYLOAD_ARTIFACT_IRI, payloadArtifactIri],
    [payloadArtifactIri, RDF_TYPE_IRI, SFLO_PAYLOAD_ARTIFACT_IRI],
    [payloadArtifactIri, RDF_TYPE_IRI, SFLO_DIGITAL_ARTIFACT_IRI],
  ]);

  const existingWorkingPath = resolveOptionalUniqueNamedNodePath(
    quads,
    meshBase,
    payloadArtifactIri,
    SFLO_HAS_WORKING_LOCATED_FILE_IRI,
    errorMessage,
  );
  const existingWorkingLiteral = resolveOptionalUniqueLiteral(
    quads,
    payloadArtifactIri,
    SFLO_WORKING_LOCAL_RELATIVE_PATH_IRI,
    errorMessage,
  );
  const existingWorkingLocalRelativePath = existingWorkingPath ??
    existingWorkingLiteral;
  if (existingWorkingLocalRelativePath === undefined) {
    throw new ImportInputError(
      `Could not resolve existing working file for import target: ${designatorPath}`,
    );
  }
  if (existingWorkingLocalRelativePath !== workingLocalRelativePath) {
    throw new ImportInputError(
      `import --replace-working must target the existing working file for ${designatorPath}: ${existingWorkingLocalRelativePath}`,
    );
  }

  const sourceRegistryPath = resolveOptionalUniqueNamedNodePath(
    quads,
    meshBase,
    knopIri,
    SFLO_HAS_KNOP_SOURCE_REGISTRY_IRI,
    errorMessage,
  );
  if (
    sourceRegistryPath !== undefined &&
    sourceRegistryPath !== `${knopPath}/_sources`
  ) {
    throw new ImportInputError(
      `import only supports the standard Knop source registry path for ${designatorPath}`,
    );
  }

  return {
    hasSourceRegistry: sourceRegistryPath !== undefined,
    sourceRegistryPath,
  };
}

interface ExistingPayloadState {
  hasSourceRegistry: boolean;
  sourceRegistryPath?: string;
}

function assertCanImportIntoCurrentMeshInventory(
  meshBase: string,
  currentMeshInventoryTurtle: string,
  designatorPath: string,
  workingLocalRelativePath: string,
): void {
  const knopPath = toKnopPath(designatorPath);
  const errorMessage =
    `current mesh inventory has an unsupported carried shape for import: ${designatorPath}`;
  const quads = parseQuads(meshBase, currentMeshInventoryTurtle, errorMessage);

  if (
    !hasRelativeNamedNodeFact(
      quads,
      meshBase,
      "_mesh",
      RDF_TYPE_IRI,
      SFLO_SEMANTIC_MESH_IRI,
    )
  ) {
    throw new ImportInputError(
      "current mesh inventory is missing the _mesh block",
    );
  }

  const payloadArtifactPaths = listTypedSubjectPaths(
    quads,
    meshBase,
    SFLO_PAYLOAD_ARTIFACT_IRI,
  );
  if (payloadArtifactPaths.includes(designatorPath)) {
    throw new ImportInputError(
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
    throw new ImportInputError(
      `mesh inventory already registers knop: ${knopPath}`,
    );
  }
  if (!haveSameMembers(meshKnopPaths, typedKnopPaths)) {
    throw new ImportInputError(errorMessage);
  }
  if (meshKnopPaths.some((path) => fromKnopPath(path) === undefined)) {
    throw new ImportInputError(errorMessage);
  }
  if (
    isWorkingFileAlreadyRegistered(quads, meshBase, workingLocalRelativePath)
  ) {
    throw new ImportInputError(
      `mesh inventory already registers working file: ${workingLocalRelativePath}`,
    );
  }

  assertHasRelativeNamedNodeFacts(quads, meshBase, errorMessage, [
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

function assertHasRelativeNamedNodeFacts(
  quads: readonly Quad[],
  meshBase: string,
  errorMessage: string,
  facts: readonly (readonly [string, string, string])[],
): void {
  for (const [subjectValue, predicateIri, objectValue] of facts) {
    if (
      !hasRelativeNamedNodeFact(
        quads,
        meshBase,
        subjectValue,
        predicateIri,
        objectValue,
      )
    ) {
      throw new ImportInputError(errorMessage);
    }
  }
}

function assertHasNamedNodeFacts(
  quads: readonly Quad[],
  errorMessage: string,
  facts: readonly (readonly [string, string, string])[],
): void {
  for (const [subjectIri, predicateIri, objectIri] of facts) {
    if (!hasNamedNodeFact(quads, subjectIri, predicateIri, objectIri)) {
      throw new ImportInputError(errorMessage);
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
      throw new ImportInputError(errorMessage);
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
  return hasRelativeNamedNodeFact(
    quads,
    meshBase,
    workingLocalRelativePath,
    RDF_TYPE_IRI,
    SFLO_LOCATED_FILE_IRI,
  ) ||
    quads.some((quad) =>
      quad.predicate.value === SFLO_WORKING_LOCAL_RELATIVE_PATH_IRI &&
      quad.object.termType === "Literal" &&
      quad.object.value === workingLocalRelativePath
    );
}

function hasRelativeNamedNodeFact(
  quads: readonly Quad[],
  meshBase: string,
  subjectValue: string,
  predicateIri: string,
  objectValue: string,
): boolean {
  return hasNamedNodeFact(
    quads,
    new URL(subjectValue, meshBase).href,
    predicateIri,
    new URL(objectValue, meshBase).href,
  );
}

function hasNamedNodeFact(
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

function resolveOptionalUniqueNamedNodePath(
  quads: readonly Quad[],
  meshBase: string,
  subjectIri: string,
  predicateIri: string,
  errorMessage: string,
): string | undefined {
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

    const path = toRelativeMeshPath(meshBase, quad.object.value);
    if (path === undefined) {
      throw new ImportInputError(errorMessage);
    }
    values.add(path);
  }

  if (values.size === 0) {
    return undefined;
  }
  if (values.size !== 1) {
    throw new ImportInputError(errorMessage);
  }

  return values.values().next().value!;
}

function resolveOptionalUniqueLiteral(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
  errorMessage: string,
): string | undefined {
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

  if (values.size === 0) {
    return undefined;
  }
  if (values.size !== 1) {
    throw new ImportInputError(errorMessage);
  }

  return values.values().next().value!;
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

function parseQuads(
  meshBase: string,
  turtle: string,
  errorMessage: string,
): Quad[] {
  try {
    return new Parser({ baseIRI: meshBase }).parse(turtle);
  } catch {
    throw new ImportInputError(errorMessage);
  }
}
