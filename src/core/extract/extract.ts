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
  constructor(message: string) {
    super(message);
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
          contents: normalizeExtractKnopInventoryTurtle(
            updatedKnopInventoryFile.contents,
            designatorPath,
          ),
        },
        {
          path: createdReferencesFile.path,
          contents: injectReferenceTargetState(
            createdReferencesFile.contents,
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
      throw new ExtractInputError(error.message);
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
  const trimmed = workingFilePath.trim();
  if (trimmed.length === 0) {
    throw new ExtractInputError("referenceTargetWorkingFilePath is required");
  }
  if (trimmed.startsWith("/") || trimmed.endsWith("/")) {
    throw new ExtractInputError(
      "referenceTargetWorkingFilePath must be a mesh-relative file path",
    );
  }
  if (
    trimmed.includes("\\") || trimmed.includes("?") || trimmed.includes("#") ||
    /\s/.test(trimmed)
  ) {
    throw new ExtractInputError(
      "referenceTargetWorkingFilePath contains unsupported path characters",
    );
  }

  const segments = trimmed.split("/");
  if (segments.some((segment) => segment.length === 0)) {
    throw new ExtractInputError(
      "referenceTargetWorkingFilePath must not contain empty path segments",
    );
  }
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new ExtractInputError(
      "referenceTargetWorkingFilePath must be a mesh-relative file path",
    );
  }

  return trimmed;
}

function normalizeRelativeIriPath(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ExtractInputError(`${fieldName} is required`);
  }
  if (trimmed.startsWith("/") || trimmed.endsWith("/")) {
    throw new ExtractInputError(
      `${fieldName} must not start or end with '/'`,
    );
  }
  if (
    trimmed.includes("\\") || trimmed.includes("?") || trimmed.includes("#")
  ) {
    throw new ExtractInputError(
      `${fieldName} contains unsupported path characters`,
    );
  }

  const segments = trimmed.split("/");
  if (segments.some((segment) => segment.length === 0)) {
    throw new ExtractInputError(
      `${fieldName} must not contain empty path segments`,
    );
  }
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new ExtractInputError(
      `${fieldName} must not contain '.' or '..' path segments`,
    );
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

function injectReferenceTargetState(
  referencesTurtle: string,
  referenceTargetStatePath: string,
): string {
  // This first carried extract slice renders the referenceTarget line in a
  // tightly fixture-shaped form: two-space indent, one `sflo:referenceTarget`
  // predicate line, trailing ` .`, and a final newline. If that formatting
  // changes, this regex insertion can fail closed even when the RDF meaning is
  // still recoverable. TODO: replace this string surgery with RDF-aware
  // parse/serialize manipulation if the extract surface starts accepting more
  // varied Turtle shapes.
  const referenceTargetLinePattern =
    /(\n {2}sflo:referenceTarget <[^>]+>) \.\n?$/;
  const match = referencesTurtle.match(referenceTargetLinePattern);
  if (!match) {
    throw new ExtractInputError(
      "Failed to add referenceTargetState to the planned reference catalog Turtle",
    );
  }

  return referencesTurtle.replace(
    referenceTargetLinePattern,
    `$1 ;\n  sflo:referenceTargetState <${referenceTargetStatePath}> .\n`,
  );
}

function reorderMeshInventoryLocatedFiles(
  meshInventoryTurtle: string,
  knopInventoryLocatedFilePath: string,
  sourceWorkingFilePath: string,
): string {
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

function normalizeExtractKnopInventoryTurtle(
  knopInventoryTurtle: string,
  designatorPath: string,
): string {
  const knopPath = `${designatorPath}/_knop`;
  const blocks = knopInventoryTurtle.split("\n\n");
  const knopBlockIndex = blocks.findIndex((block) =>
    block.startsWith(`<${knopPath}> a sflo:Knop ;`)
  );
  if (knopBlockIndex === -1) {
    throw new ExtractInputError(
      `Failed to resolve the planned knop block for ${knopPath}`,
    );
  }

  blocks[knopBlockIndex] = `<${knopPath}> a sflo:Knop ;
  sflo:hasKnopMetadata <${knopPath}/_meta> ;
  sflo:hasKnopInventory <${knopPath}/_inventory> ;
  sflo:hasReferenceCatalog <${knopPath}/_references> ;
  sflo:hasWorkingKnopInventoryFile <${knopPath}/_inventory/inventory.ttl> .`;

  return blocks.join("\n\n");
}
