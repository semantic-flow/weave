import { join } from "@std/path";
import { Parser } from "n3";
import type { Quad } from "n3";

const MESH_METADATA_RELATIVE_PATH = "_mesh/_meta/meta.ttl";
const SFLO_MESH_BASE_IRI =
  "https://semantic-flow.github.io/semantic-flow-ontology/meshBase";
const XSD_ANYURI_IRI = "http://www.w3.org/2001/XMLSchema#anyURI";
const MESH_BASE_ERROR_MESSAGE =
  "Could not resolve meshBase from _mesh/_meta/meta.ttl";

export class MeshMetadataResolutionError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "MeshMetadataResolutionError";
  }
}

export async function loadWorkspaceMeshBase(
  workspaceRoot: string,
): Promise<string> {
  return resolveMeshBaseFromMetadataTurtle(
    await Deno.readTextFile(join(workspaceRoot, MESH_METADATA_RELATIVE_PATH)),
  );
}

export function resolveMeshBaseFromMetadataTurtle(
  meshMetadataTurtle: string,
): string {
  let quads: Quad[];

  try {
    quads = new Parser().parse(meshMetadataTurtle);
  } catch (error) {
    throw new MeshMetadataResolutionError(MESH_BASE_ERROR_MESSAGE, {
      cause: error,
    });
  }

  const meshBaseValues = new Set<string>(
    quads
      .filter((quad) =>
        quad.predicate.value === SFLO_MESH_BASE_IRI &&
        quad.object.termType === "Literal" &&
        quad.object.datatype.value === XSD_ANYURI_IRI
      )
      .map((quad) => quad.object.value.trim())
      .filter((value) => value.length > 0),
  );

  if (meshBaseValues.size !== 1) {
    throw new MeshMetadataResolutionError(MESH_BASE_ERROR_MESSAGE);
  }

  return meshBaseValues.values().next().value!;
}
