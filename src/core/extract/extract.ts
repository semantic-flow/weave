import { normalizeSafeDesignatorPath } from "../designator_segments.ts";
import {
  KnopAddReferenceInputError,
  planKnopAddReference,
} from "../knop/add_reference.ts";
import { KnopCreateInputError, planKnopCreate } from "../knop/create.ts";
import type { PlannedFile } from "../planned_file.ts";

export interface ExtractRequest {
  designatorPath: string;
}

export interface ResolvedExtractRequest extends ExtractRequest {
  meshBase: string;
  currentMeshInventoryTurtle: string;
  referenceTargetDesignatorPath: string;
  referenceTargetStatePath: string;
  referenceTargetWorkingFilePath: string;
}

export interface ExtractPlan {
  meshBase: string;
  designatorPath: string;
  referenceCatalogIri: string;
  referenceLinkIri: string;
  referenceRoleIri: string;
  referenceTargetIri: string;
  referenceTargetDesignatorPath: string;
  referenceTargetStateIri: string;
  referenceTargetStatePath: string;
  createdFiles: readonly PlannedFile[];
  updatedFiles: readonly PlannedFile[];
}

export class ExtractInputError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ExtractInputError";
  }
}

export function planExtract(request: ResolvedExtractRequest): ExtractPlan {
  const meshBase = normalizeMeshBase(request.meshBase);
  const designatorPath = normalizeDesignatorPath(
    request.designatorPath,
    "designatorPath",
  );
  const referenceTargetDesignatorPath = normalizeDesignatorPath(
    request.referenceTargetDesignatorPath,
    "referenceTargetDesignatorPath",
  );
  const referenceTargetStatePath = normalizeRelativeIriPath(
    request.referenceTargetStatePath,
    "referenceTargetStatePath",
  );
  const referenceTargetWorkingFilePath = normalizeWorkingFilePath(
    request.referenceTargetWorkingFilePath,
  );

  try {
    const knopCreatePlan = planKnopCreate({
      meshBase,
      designatorPath,
      currentMeshInventoryTurtle: request.currentMeshInventoryTurtle,
    });
    const createdKnopInventoryFile = requirePlannedFile(
      knopCreatePlan.createdFiles,
      `${designatorPath}/_knop/_inventory/inventory.ttl`,
      "created knop inventory",
    );
    const createdKnopMetadataFile = requirePlannedFile(
      knopCreatePlan.createdFiles,
      `${designatorPath}/_knop/_meta/meta.ttl`,
      "created knop metadata",
    );
    const meshInventoryUpdate = requirePlannedFile(
      knopCreatePlan.updatedFiles,
      "_mesh/_inventory/inventory.ttl",
      "updated mesh inventory",
    );
    const knopAddReferencePlan = planKnopAddReference({
      meshBase,
      designatorPath,
      currentKnopInventoryTurtle: createdKnopInventoryFile.contents,
      referenceTargetDesignatorPath,
      referenceRole: "supplemental",
    });
    const updatedKnopInventoryFile = requirePlannedFile(
      knopAddReferencePlan.updatedFiles,
      `${designatorPath}/_knop/_inventory/inventory.ttl`,
      "updated knop inventory",
    );
    const createdReferencesFile = requirePlannedFile(
      knopAddReferencePlan.createdFiles,
      `${designatorPath}/_knop/_references/references.ttl`,
      "created references file",
    );

    return {
      meshBase,
      designatorPath,
      referenceCatalogIri: knopAddReferencePlan.referenceCatalogIri,
      referenceLinkIri: knopAddReferencePlan.referenceLinkIri,
      referenceRoleIri: knopAddReferencePlan.referenceRoleIri,
      referenceTargetIri: knopAddReferencePlan.referenceTargetIri,
      referenceTargetDesignatorPath,
      referenceTargetStateIri: new URL(referenceTargetStatePath, meshBase).href,
      referenceTargetStatePath,
      createdFiles: [
        createdKnopMetadataFile,
        {
          path: updatedKnopInventoryFile.path,
          contents: renderExtractKnopInventoryTurtle(
            meshBase,
            designatorPath,
          ),
        },
        {
          path: createdReferencesFile.path,
          contents: renderExtractReferenceCatalogTurtle(
            meshBase,
            designatorPath,
            referenceTargetDesignatorPath,
            knopAddReferencePlan.referenceRoleIri,
            referenceTargetStatePath,
          ),
        },
      ],
      updatedFiles: [{
        path: meshInventoryUpdate.path,
        contents: reorderMeshInventoryLocatedFiles(
          meshInventoryUpdate.contents,
          `${designatorPath}/_knop/_inventory/inventory.ttl`,
          referenceTargetWorkingFilePath,
        ),
      }],
    };
  } catch (error) {
    if (
      error instanceof KnopCreateInputError ||
      error instanceof KnopAddReferenceInputError
    ) {
      throw new ExtractInputError(error.message, { cause: error });
    }
    throw error;
  }
}

function normalizeMeshBase(meshBase: string): string {
  const trimmed = meshBase.trim();
  if (trimmed.length === 0) {
    throw new ExtractInputError("meshBase is required");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new ExtractInputError("meshBase must be an absolute IRI");
  }

  if (!url.pathname.endsWith("/")) {
    throw new ExtractInputError("meshBase must end with '/'");
  }
  if (url.search.length > 0 || url.hash.length > 0) {
    throw new ExtractInputError(
      "meshBase must not include a query or fragment",
    );
  }

  return url.href;
}

function normalizeDesignatorPath(
  designatorPath: string,
  fieldName: string,
): string {
  return normalizeSafeDesignatorPath(
    designatorPath,
    fieldName,
    (message) => new ExtractInputError(message),
  );
}

function normalizeWorkingFilePath(workingFilePath: string): string {
  return normalizeValidatedPath(workingFilePath, {
    fieldName: "referenceTargetWorkingFilePath",
    rejectWhitespace: true,
    slashMessage:
      "referenceTargetWorkingFilePath must be a mesh-relative file path",
    unsupportedCharactersMessage:
      "referenceTargetWorkingFilePath contains unsupported path characters",
    emptySegmentsMessage:
      "referenceTargetWorkingFilePath must not contain empty path segments",
    dotSegmentsMessage:
      "referenceTargetWorkingFilePath must be a mesh-relative file path",
  });
}

function normalizeRelativeIriPath(value: string, fieldName: string): string {
  return normalizeValidatedPath(value, {
    fieldName,
    rejectWhitespace: false,
    slashMessage: `${fieldName} must not start or end with '/'`,
    unsupportedCharactersMessage:
      `${fieldName} contains unsupported path characters`,
    emptySegmentsMessage: `${fieldName} must not contain empty path segments`,
    dotSegmentsMessage:
      `${fieldName} must not contain '.' or '..' path segments`,
  });
}

function normalizeValidatedPath(
  value: string,
  options: {
    fieldName: string;
    rejectWhitespace: boolean;
    slashMessage: string;
    unsupportedCharactersMessage: string;
    emptySegmentsMessage: string;
    dotSegmentsMessage: string;
  },
): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ExtractInputError(`${options.fieldName} is required`);
  }
  if (trimmed.startsWith("/") || trimmed.endsWith("/")) {
    throw new ExtractInputError(options.slashMessage);
  }
  if (
    trimmed.includes("\\") || trimmed.includes("?") || trimmed.includes("#") ||
    (options.rejectWhitespace && /\s/.test(trimmed))
  ) {
    throw new ExtractInputError(options.unsupportedCharactersMessage);
  }

  const segments = trimmed.split("/");
  if (segments.some((segment) => segment.length === 0)) {
    throw new ExtractInputError(options.emptySegmentsMessage);
  }
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new ExtractInputError(options.dotSegmentsMessage);
  }

  return trimmed;
}

function requirePlannedFile(
  files: readonly PlannedFile[],
  path: string,
  label: string,
): PlannedFile {
  const file = files.find((plannedFile) => plannedFile.path === path);
  if (!file) {
    throw new ExtractInputError(
      `Failed to resolve ${label} while planning extract: ${path}`,
    );
  }
  return file;
}

function renderExtractKnopInventoryTurtle(
  meshBase: string,
  designatorPath: string,
): string {
  const knopPath = toKnopPath(designatorPath);

  return `@base <${meshBase}> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .

<${knopPath}> a sflo:Knop ;
  sflo:hasKnopMetadata <${knopPath}/_meta> ;
  sflo:hasKnopInventory <${knopPath}/_inventory> ;
  sflo:hasReferenceCatalog <${knopPath}/_references> ;
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> .

<${knopPath}/_meta> a sflo:KnopMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${knopPath}/_meta/meta.ttl> .

<${knopPath}/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${knopPath}/_inventory/inventory.ttl> .

<${knopPath}/_references> a sflo:ReferenceCatalog, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${knopPath}/_references/references.ttl> .

<${knopPath}/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<${knopPath}/_references/references.ttl> a sflo:LocatedFile, sflo:RdfDocument .
`;
}

function renderExtractReferenceCatalogTurtle(
  meshBase: string,
  designatorPath: string,
  referenceTargetDesignatorPath: string,
  referenceRoleIri: string,
  referenceTargetStatePath: string,
): string {
  const referenceCatalogPath = `${toKnopPath(designatorPath)}/_references`;

  return `@base <${meshBase}> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .

<${designatorPath}> sflo:hasReferenceLink <${referenceCatalogPath}#reference001> .

<${referenceCatalogPath}#reference001> a sflo:ReferenceLink ;
  sflo:referenceLinkFor <${designatorPath}> ;
  sflo:hasReferenceRole <${referenceRoleIri}> ;
  sflo:referenceTarget <${referenceTargetDesignatorPath}> ;
  sflo:referenceTargetState <${referenceTargetStatePath}> .
`;
}

function reorderMeshInventoryLocatedFiles(
  meshInventoryTurtle: string,
  knopInventoryLocatedFilePath: string,
  sourceWorkingFilePath: string,
): string {
  // This is the remaining narrow extract-specific text seam. `planKnopCreate`
  // still emits the surrounding MeshInventory Turtle, and this helper only
  // reorders the newly inserted LocatedFile block to keep the settled extract
  // fixture ordering. Revisit this together with the broader extracted-weave
  // rewrite ladder rather than hiding a larger mesh-inventory serializer
  // change inside `core/extract`.
  const blocks = meshInventoryTurtle.split("\n\n");
  const knopInventoryBlockIndex = blocks.findIndex((block) =>
    block.startsWith(
      `<${knopInventoryLocatedFilePath}> a sflo:LocatedFile, sflo:RdfDocument .`,
    )
  );
  if (knopInventoryBlockIndex === -1) {
    throw new ExtractInputError(
      `Failed to resolve the planned mesh-inventory located-file block for ${knopInventoryLocatedFilePath}`,
    );
  }

  const sourceWorkingFileBlockIndex = blocks.findIndex((block) =>
    block.startsWith(
      `<${sourceWorkingFilePath}> a sflo:LocatedFile, sflo:RdfDocument .`,
    )
  );
  if (sourceWorkingFileBlockIndex === -1) {
    throw new ExtractInputError(
      `Failed to resolve the source payload located-file block for ${sourceWorkingFilePath}`,
    );
  }

  if (knopInventoryBlockIndex < sourceWorkingFileBlockIndex) {
    return meshInventoryTurtle;
  }

  const [knopInventoryBlock] = blocks.splice(knopInventoryBlockIndex, 1);
  const insertionIndex = blocks.findIndex((block) =>
    block.startsWith(
      `<${sourceWorkingFilePath}> a sflo:LocatedFile, sflo:RdfDocument .`,
    )
  );
  blocks.splice(insertionIndex, 0, knopInventoryBlock!);

  return blocks.join("\n\n");
}
function toKnopPath(designatorPath: string): string {
  return `${designatorPath}/_knop`;
}
