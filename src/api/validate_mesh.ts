import { isAbsolute, join, resolve } from "@std/path";
import { formatDesignatorPathForDisplay } from "../core/designator_segments.ts";
import type { MeshValidationFindingCode } from "../core/weave/errors.ts";
import {
  type NormalizedTargetSpec,
  normalizeTargetSpecs,
} from "../core/targeting.ts";
import { UserSettingsResolutionError } from "../runtime/settings/user_settings.ts";
import {
  loadMeshState,
  MeshSupportSurfaceNotFoundError,
  WorkspaceRootResolutionError,
} from "../runtime/weave/mesh_state.ts";
import { RepositorySourceCapabilityError } from "../runtime/weave/artifact_loaders.ts";
import {
  executeValidate,
  UnknownValidateTargetError,
} from "../runtime/weave/weave.ts";
import { WeaveApiError } from "./version_payloads.ts";

export interface ValidateMeshRequest {
  meshRoot: string;
  targets?: readonly ValidateTarget[];
}

export interface ValidateTarget {
  designatorPath: string;
  recursive?: boolean;
}

export interface ValidateMeshResult {
  meshBase?: string;
  findings: readonly MeshValidationFinding[];
  coverage: {
    readonly knownDesignatorPathCount: number;
    readonly plannedDesignatorPathCount: number;
  };
}

export interface MeshValidationFinding {
  severity: "error" | "warning";
  code: MeshValidationFindingCode;
  message: string;
  path?: string;
  designatorPath?: string;
}

export type { MeshValidationFindingCode };

interface AdmittedValidateMeshRequest {
  meshRoot: string;
  targets: readonly NormalizedTargetSpec[];
}

const REQUEST_KEYS = new Set(["meshRoot", "targets"]);

export async function validateMesh(
  request: ValidateMeshRequest,
): Promise<ValidateMeshResult> {
  const admitted = admitValidateMeshRequest(request);
  const preflightFinding = await inspectMeshRoot(admitted.meshRoot);
  if (preflightFinding !== undefined) {
    return {
      findings: [preflightFinding],
      coverage: {
        knownDesignatorPathCount: 0,
        plannedDesignatorPathCount: 0,
      },
    };
  }

  try {
    const runtimeResult = await executeValidate({
      meshRoot: admitted.meshRoot,
      request: admitted.targets.length === 0 ? undefined : {
        targets: admitted.targets.map((target) => ({
          designatorPath: target.designatorPath,
          ...(target.recursive ? { recursive: true } : {}),
        })),
      },
      scope: "mesh",
      sourceCapability: "mesh-local-only",
      strictClassifiedFindings: true,
    });

    let meshBase = runtimeResult.meshBase;
    if (
      meshBase === undefined &&
      runtimeResult.findings.every((finding) =>
        finding.code !== "malformed-mesh-metadata"
      )
    ) {
      meshBase = (await loadMeshStateForResult(admitted.meshRoot)).meshBase;
    }

    return {
      ...(meshBase === undefined ? {} : { meshBase }),
      findings: runtimeResult.findings.map((finding) => ({
        ...finding,
        ...(finding.designatorPath === undefined ? {} : {
          designatorPath: formatDesignatorPathForDisplay(
            finding.designatorPath,
          ),
        }),
      })),
      coverage: {
        knownDesignatorPathCount: runtimeResult.knownDesignatorPathCount,
        plannedDesignatorPathCount:
          runtimeResult.validatedDesignatorPaths.length,
      },
    };
  } catch (error) {
    throw mapCannotValidateError(error);
  }
}

export function admitValidateMeshRequest(
  request: ValidateMeshRequest,
): AdmittedValidateMeshRequest {
  try {
    assertRecordWithKeys(request, "request", REQUEST_KEYS);
    if (
      typeof request.meshRoot !== "string" ||
      request.meshRoot.length === 0 ||
      !isAbsolute(request.meshRoot)
    ) {
      throw new Error("request.meshRoot must be a non-empty absolute path");
    }
    if (request.targets !== undefined && !Array.isArray(request.targets)) {
      throw new Error("request.targets must be an array");
    }
    const normalizedRootAliases = request.targets?.map((target, index) => {
      if (!target || typeof target !== "object" || Array.isArray(target)) {
        return target;
      }
      const record = target as unknown as Record<string, unknown>;
      if (
        typeof record.designatorPath === "string" &&
        record.designatorPath.trim().length === 0
      ) {
        throw new Error(
          `request.targets[${index}].designatorPath must use '/' for the root target`,
        );
      }
      return typeof record.designatorPath === "string" &&
          record.designatorPath.trim() === "/"
        ? { ...record, designatorPath: "" }
        : target;
    });
    const targets = normalizeTargetSpecs(
      normalizedRootAliases,
      "request.targets",
      (message) => new Error(message),
    );
    return {
      meshRoot: resolve(request.meshRoot),
      targets,
    };
  } catch (error) {
    throw new WeaveApiError(
      error instanceof Error ? error.message : "Invalid validation request.",
      { code: "invalid-request", stage: "admit", cause: error },
    );
  }
}

async function inspectMeshRoot(
  meshRoot: string,
): Promise<MeshValidationFinding | undefined> {
  let rootStat: Deno.FileInfo;
  try {
    rootStat = await Deno.stat(meshRoot);
  } catch (cause) {
    throw new WeaveApiError(
      `Could not read mesh root: ${meshRoot}`,
      { code: "read-failure", stage: "load", path: meshRoot, cause },
    );
  }
  if (!rootStat.isDirectory) {
    throw new WeaveApiError(
      `Mesh root is not a directory: ${meshRoot}`,
      { code: "read-failure", stage: "load", path: meshRoot },
    );
  }

  const supportRoot = join(meshRoot, "_mesh");
  try {
    const stat = await Deno.stat(supportRoot);
    if (!stat.isDirectory) {
      throw new WeaveApiError(
        "Mesh root does not contain a mesh support surface.",
        {
          code: "malformed-mesh",
          stage: "load",
          path: "_mesh",
        },
      );
    }
  } catch (cause) {
    if (cause instanceof WeaveApiError) {
      throw cause;
    }
    if (cause instanceof Deno.errors.NotFound) {
      throw new WeaveApiError(
        "Mesh root does not contain a mesh support surface.",
        {
          code: "malformed-mesh",
          stage: "load",
          path: "_mesh",
          cause,
        },
      );
    }
    throw new WeaveApiError(
      "Could not read the mesh support surface.",
      {
        code: "read-failure",
        stage: "load",
        path: "_mesh",
        cause,
      },
    );
  }

  const metadataPath = join(meshRoot, "_mesh/_meta/meta.ttl");
  try {
    const stat = await Deno.stat(metadataPath);
    if (!stat.isFile) {
      return {
        severity: "error",
        code: "malformed-mesh-metadata",
        message: "Mesh metadata path is not a file: _mesh/_meta/meta.ttl",
        path: "_mesh/_meta/meta.ttl",
      };
    }
  } catch (cause) {
    if (cause instanceof Deno.errors.NotFound) {
      return {
        severity: "error",
        code: "malformed-mesh-metadata",
        message: "Mesh metadata is missing: _mesh/_meta/meta.ttl",
        path: "_mesh/_meta/meta.ttl",
      };
    }
    throw new WeaveApiError(
      "Could not read mesh metadata.",
      {
        code: "read-failure",
        stage: "load",
        path: "_mesh/_meta/meta.ttl",
        cause,
      },
    );
  }

  return undefined;
}

async function loadMeshStateForResult(meshRoot: string) {
  try {
    return await loadMeshState(meshRoot);
  } catch (error) {
    throw mapCannotValidateError(error);
  }
}

function mapCannotValidateError(error: unknown): unknown {
  if (error instanceof WeaveApiError) {
    return error;
  }
  if (error instanceof UnknownValidateTargetError) {
    return new WeaveApiError(error.message, {
      code: "unknown-target",
      stage: "load",
      target: {
        index: error.index,
        designatorPath: formatDesignatorPathForDisplay(error.designatorPath),
      },
      cause: error,
    });
  }
  if (error instanceof RepositorySourceCapabilityError) {
    return new WeaveApiError(error.message, {
      code: "unsupported-source",
      stage: "load",
      cause: error,
    });
  }
  if (
    error instanceof WorkspaceRootResolutionError ||
    error instanceof MeshSupportSurfaceNotFoundError ||
    error instanceof UserSettingsResolutionError ||
    isDenoReadError(error)
  ) {
    return new WeaveApiError(
      error instanceof Error ? error.message : "Could not read the mesh.",
      { code: "read-failure", stage: "load", cause: error },
    );
  }
  return error;
}

function isDenoReadError(error: unknown): boolean {
  if (
    error instanceof Deno.errors.NotFound ||
    error instanceof Deno.errors.PermissionDenied ||
    error instanceof Deno.errors.BadResource ||
    error instanceof Deno.errors.Busy
  ) {
    return true;
  }
  // NotADirectory/IsADirectory are absent from the dnt Node shim's errors type.
  const optionalClasses = Deno.errors as Partial<
    Record<"NotADirectory" | "IsADirectory", new (...args: never[]) => Error>
  >;
  return (optionalClasses.NotADirectory !== undefined &&
    error instanceof optionalClasses.NotADirectory) ||
    (optionalClasses.IsADirectory !== undefined &&
      error instanceof optionalClasses.IsADirectory);
}

function assertRecordWithKeys(
  value: unknown,
  fieldName: string,
  keys: ReadonlySet<string>,
): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object`);
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new Error(`${fieldName}.${key} is not supported`);
    }
  }
}
