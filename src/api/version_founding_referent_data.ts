import { isAbsolute, join, resolve } from "@std/path";
import {
  formatDesignatorPathForDisplay,
  normalizeSafeDesignatorPath,
  toKnopPath,
} from "../core/designator_segments.ts";
import { FoundingReferentDataInputError } from "../core/knop/founding_referent_data.ts";
import {
  FoundingReferentDataVersionInputError,
  planFoundingReferentDataVersion,
} from "../core/knop/version_founding_referent_data.ts";
import { listKnopDesignatorPaths } from "../runtime/mesh/inventory.ts";
import {
  AtomicFilePlanError,
  type AtomicFilePlanHooks,
  executeAtomicFilePlan,
} from "../runtime/atomic_file_plan.ts";
import { loadMeshState } from "../runtime/weave/mesh_state.ts";
import { WeaveApiError } from "./version_payloads.ts";

export interface VersionFoundingReferentDataRequest {
  meshRoot: string;
  designatorPath: string;
  bytes?: Uint8Array;
}

export interface VersionFoundingReferentDataResult {
  status: "applied";
  meshBase: string;
  designatorPath: string;
  foundingReferentDataIri: string;
  historyIri: string;
  stateIri: string;
  manifestationIri: string;
  snapshotIri: string;
  snapshotPath: string;
  contentDigest: string;
  createdPaths: readonly string[];
  updatedPaths: readonly string[];
}

interface AdmittedRequest {
  meshRoot: string;
  designatorPath: string;
  bytes?: Uint8Array;
}

const REQUEST_KEYS = new Set(["meshRoot", "designatorPath", "bytes"]);

export async function versionFoundingReferentData(
  request: VersionFoundingReferentDataRequest,
): Promise<VersionFoundingReferentDataResult> {
  return await execute(request);
}

/** Test-only write seam; intentionally omitted from public barrels. */
export async function versionFoundingReferentDataForTesting(
  request: VersionFoundingReferentDataRequest,
  hooks: AtomicFilePlanHooks,
): Promise<VersionFoundingReferentDataResult> {
  return await execute(request, hooks);
}

export function admitVersionFoundingReferentDataRequest(
  request: VersionFoundingReferentDataRequest,
): AdmittedRequest {
  try {
    assertRecordWithKeys(request);
    if (typeof request.meshRoot !== "string" || !isAbsolute(request.meshRoot)) {
      throw new Error("request.meshRoot must be an absolute path");
    }
    if (typeof request.designatorPath !== "string") {
      throw new Error("request.designatorPath must be a string");
    }
    const designatorPath = normalizeSafeDesignatorPath(
      request.designatorPath,
      "request.designatorPath",
      (message) => new Error(message),
    );
    if (request.bytes !== undefined && !(request.bytes instanceof Uint8Array)) {
      throw new Error("request.bytes must be a Uint8Array");
    }
    const bytes = request.bytes === undefined
      ? undefined
      : new Uint8Array(request.bytes);
    return {
      meshRoot: resolve(request.meshRoot),
      designatorPath,
      ...(bytes === undefined ? {} : { bytes }),
    };
  } catch (cause) {
    throw new WeaveApiError(
      cause instanceof Error
        ? cause.message
        : "Invalid founding version request.",
      { code: "invalid-request", stage: "admit", cause },
    );
  }
}

async function execute(
  request: VersionFoundingReferentDataRequest,
  hooks: AtomicFilePlanHooks = {},
): Promise<VersionFoundingReferentDataResult> {
  const admitted = admitVersionFoundingReferentDataRequest(request);
  let meshState: Awaited<ReturnType<typeof loadMeshState>>;
  let currentKnopInventoryTurtle: string;
  let currentWorkingBytes: Uint8Array;
  const knopInventoryPath = `${
    toKnopPath(admitted.designatorPath)
  }/_inventory/inventory.ttl`;
  const workingPath = `${
    toKnopPath(admitted.designatorPath)
  }/_founding/data.ttl`;
  try {
    meshState = await loadMeshState(admitted.meshRoot);
    const known = new Set(listKnopDesignatorPaths(
      meshState.meshBase,
      meshState.currentMeshInventoryTurtle,
      "Could not parse MeshInventory while resolving founding referent data target.",
    ));
    if (!known.has(admitted.designatorPath)) {
      throw new WeaveApiError(
        `Unknown founding referent data target: ${
          formatDesignatorPathForDisplay(admitted.designatorPath)
        }`,
        { code: "unknown-target", stage: "load" },
      );
    }
    [currentKnopInventoryTurtle, currentWorkingBytes] = await Promise.all([
      Deno.readTextFile(join(admitted.meshRoot, knopInventoryPath)),
      Deno.readFile(join(admitted.meshRoot, workingPath)),
    ]);
  } catch (cause) {
    if (cause instanceof WeaveApiError) throw cause;
    throw new WeaveApiError(
      "Could not load the founding referent data target.",
      { code: "malformed-mesh", stage: "load", cause },
    );
  }

  const bytes = admitted.bytes ?? new Uint8Array(currentWorkingBytes);
  let plan: Awaited<ReturnType<typeof planFoundingReferentDataVersion>>;
  try {
    plan = await planFoundingReferentDataVersion({
      meshBase: meshState.meshBase,
      designatorPath: admitted.designatorPath,
      currentKnopInventoryTurtle,
      bytes,
    });
  } catch (cause) {
    if (cause instanceof FoundingReferentDataInputError) {
      throw new WeaveApiError(cause.message, {
        code: "unsupported-content",
        stage: "plan",
        cause,
      });
    }
    if (cause instanceof FoundingReferentDataVersionInputError) {
      throw new WeaveApiError(cause.message, {
        code: "malformed-mesh",
        stage: "load",
        cause,
      });
    }
    throw new WeaveApiError(
      "Could not plan the founding referent data version from the current mesh.",
      { code: "malformed-mesh", stage: "load", cause },
    );
  }

  const workingChanged = admitted.bytes !== undefined &&
    !bytesEqual(bytes, currentWorkingBytes);
  let writes;
  try {
    writes = await executeAtomicFilePlan(
      admitted.meshRoot,
      [
        ...(workingChanged
          ? [{
            path: workingPath,
            mode: "update" as const,
            phase: "founding-working-update",
            contents: bytes,
          }]
          : []),
        ...plan.createdBinaryFiles.map((file) => ({
          path: file.path,
          mode: "create" as const,
          phase: "founding-snapshot-create",
          contents: file.contents,
        })),
        ...plan.updatedFiles.map((file) => ({
          path: file.path,
          mode: "update" as const,
          phase: "founding-inventory-update",
          contents: file.contents,
        })),
      ],
      hooks,
    );
  } catch (cause) {
    if (cause instanceof AtomicFilePlanError) {
      throw new WeaveApiError(cause.message, {
        code: "io-failure",
        stage: "write",
        path: cause.path,
        cause,
      });
    }
    throw new WeaveApiError(
      cause instanceof Error
        ? cause.message
        : "Founding version preflight failed.",
      { code: "plan-conflict", stage: "plan", cause },
    );
  }

  return {
    status: "applied",
    meshBase: plan.meshBase,
    designatorPath: plan.designatorPath,
    foundingReferentDataIri: plan.foundingReferentDataIri,
    historyIri: plan.historyIri,
    stateIri: plan.stateIri,
    manifestationIri: plan.manifestationIri,
    snapshotIri: plan.snapshotIri,
    snapshotPath: plan.snapshotPath,
    contentDigest: plan.contentDigest,
    createdPaths: writes.createdPaths,
    updatedPaths: writes.updatedPaths,
  };
}

function assertRecordWithKeys(request: unknown): void {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new Error("request must be an object");
  }
  for (const key of Object.keys(request)) {
    if (!REQUEST_KEYS.has(key)) {
      throw new Error(`request.${key} is not supported`);
    }
  }
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength &&
    left.every((byte, index) => byte === right[index]);
}
