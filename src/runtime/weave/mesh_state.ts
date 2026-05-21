import { join } from "@std/path";
import {
  MeshMetadataResolutionError,
  resolveMeshBaseFromMetadataTurtle,
} from "../mesh/metadata.ts";
import { WeaveRuntimeError } from "./errors.ts";
import {
  readOptionalTextFileWithOverlay,
  readTextFileWithOverlay,
} from "./planning_context.ts";

export interface MeshState {
  meshBase: string;
  currentMeshMetadataTurtle: string;
  currentMeshInventoryTurtle: string;
  currentMeshConfigTurtle?: string;
}

export async function ensureWorkspaceRootExists(
  workspaceRoot: string,
): Promise<void> {
  let stat: Deno.FileInfo;
  try {
    stat = await Deno.stat(workspaceRoot);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new WeaveRuntimeError(
        `Workspace root does not exist: ${workspaceRoot}`,
      );
    }
    throw error;
  }

  if (!stat.isDirectory) {
    throw new WeaveRuntimeError(
      `Workspace root is not a directory: ${workspaceRoot}`,
    );
  }
}

export async function loadMeshState(
  workspaceRoot: string,
  overlay?: ReadonlyMap<string, string>,
): Promise<MeshState> {
  const meshMetadataPath = join(workspaceRoot, "_mesh/_meta/meta.ttl");
  const meshInventoryPath = join(
    workspaceRoot,
    "_mesh/_inventory/inventory.ttl",
  );
  const meshConfigPath = join(workspaceRoot, "_mesh/_config/config.ttl");
  let meshMetadataTurtle: string;
  let currentMeshInventoryTurtle: string;
  let currentMeshConfigTurtle: string | undefined;

  try {
    [meshMetadataTurtle, currentMeshInventoryTurtle, currentMeshConfigTurtle] =
      await Promise.all([
        readTextFileWithOverlay(meshMetadataPath, overlay),
        readTextFileWithOverlay(meshInventoryPath, overlay),
        readOptionalTextFileWithOverlay(meshConfigPath, overlay),
      ]);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new WeaveRuntimeError(
        "Workspace does not contain an existing mesh support surface",
      );
    }
    throw error;
  }

  let meshBase: string;
  try {
    meshBase = resolveMeshBaseFromMetadataTurtle(meshMetadataTurtle);
  } catch (error) {
    if (error instanceof MeshMetadataResolutionError) {
      throw new WeaveRuntimeError(error.message);
    }
    if (error instanceof Error) {
      throw new WeaveRuntimeError(
        `Could not resolve mesh base from metadata: ${error.message}`,
      );
    }
    throw error;
  }

  return {
    meshBase,
    currentMeshMetadataTurtle: meshMetadataTurtle,
    currentMeshInventoryTurtle,
    ...(currentMeshConfigTurtle !== undefined
      ? { currentMeshConfigTurtle }
      : {}),
  };
}
