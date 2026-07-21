import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "@std/path";
import {
  formatDesignatorPathForDisplay,
  toKnopPath,
} from "../core/designator_segments.ts";
import type {
  NormalizedVersionTargetSpec,
  VersionTargetSpec,
} from "../core/targeting.ts";
import { normalizeVersionTargetSpecs } from "../core/targeting.ts";
import type { PlannedFile } from "../core/planned_file.ts";
import type { WeaveableKnopCandidate } from "../core/weave/candidates.ts";
import {
  listKnopDesignatorPaths,
  resolvePayloadArtifactInventoryState,
} from "../runtime/mesh/inventory.ts";
import type { HistoryTrackingPolicy } from "../runtime/config/effective_config.ts";
import {
  loadOperationalLocalPathPolicy,
  LocalPathAccessError,
  type OperationalLocalPathPolicy,
  resolveAllowedLocalPath,
} from "../runtime/operational/local_path_policy.ts";
import { loadMeshState, type MeshState } from "../runtime/weave/mesh_state.ts";
import { TextFileOverlay } from "../runtime/weave/planning_context.ts";
import {
  prepareCoherentPayloadBatchVersionExecution,
  type PreparedCoherentPayloadBatchVersionExecution,
  validateVersionPlanRdf,
} from "../runtime/weave/version_execution.ts";

export interface VersionPayloadsRequest {
  meshRoot: string;
  items: readonly VersionPayloadItem[];
  defaults?: PayloadVersionDefaults;
  historyTrackingPolicyOverride?: HistoryTrackingPolicy;
  overwriteExistingState?: boolean;
}

export interface VersionPayloadItem {
  designatorPath: string;
  bytes: Uint8Array;
  historySegment?: string;
  stateSegment?: string;
  manifestationSegment?: string;
}

export interface PayloadVersionDefaults {
  historySegment?: string;
  stateSegment?: string;
  manifestationSegment?: string;
}

export interface VersionPayloadsResult {
  meshBase: string;
  outcomes: readonly PayloadVersionOutcome[];
  createdPaths: readonly string[];
  updatedPaths: readonly string[];
}

export interface PayloadVersionOutcome {
  status: "applied" | "alreadyCurrent";
  designatorPath: string;
  payloadArtifactIri: string;
  historySegment: string;
  stateSegment: string;
  manifestationSegment: string;
  snapshotPath: string;
}

export type WeaveApiErrorStage = "admit" | "load" | "plan" | "write";

export type WeaveApiErrorCode =
  | "invalid-request"
  | "unknown-target"
  | "not-a-payload"
  | "malformed-mesh"
  | "inconsistent-policy"
  | "unsupported-source"
  | "unsupported-content"
  | "snapshot-conflict"
  | "plan-conflict"
  | "io-failure";

interface WeaveApiErrorDetails {
  code: WeaveApiErrorCode;
  stage: WeaveApiErrorStage;
  target?: { readonly index: number; readonly designatorPath: string };
  path?: string;
  completedPaths?: readonly string[];
  possiblyTouchedPaths?: readonly string[];
  cause?: unknown;
}

export class WeaveApiError extends Error {
  readonly code: WeaveApiErrorCode;
  readonly stage: WeaveApiErrorStage;
  readonly target?: { readonly index: number; readonly designatorPath: string };
  readonly path?: string;
  readonly completedPaths?: readonly string[];
  readonly possiblyTouchedPaths?: readonly string[];
  override readonly cause?: unknown;

  constructor(message: string, details: WeaveApiErrorDetails) {
    super(message, { cause: details.cause });
    this.name = "WeaveApiError";
    this.code = details.code;
    this.stage = details.stage;
    this.target = details.target;
    this.path = details.path;
    this.completedPaths = details.completedPaths;
    this.possiblyTouchedPaths = details.possiblyTouchedPaths;
    this.cause = details.cause;
  }
}

export interface AdmittedVersionPayloadItem {
  index: number;
  target: NormalizedVersionTargetSpec;
  bytes: Uint8Array;
  text: string;
}

export interface AdmittedVersionPayloadsRequest {
  meshRoot: string;
  items: readonly AdmittedVersionPayloadItem[];
  targets: readonly NormalizedVersionTargetSpec[];
  historyTrackingPolicyOverride?: HistoryTrackingPolicy;
  overwriteExistingState: boolean;
}

interface LoadedVersionPayloadItem extends AdmittedVersionPayloadItem {
  absoluteWorkingPath: string;
  workingPath: string;
  workingChanged: boolean;
}

type ApiWritePhase =
  | "working-update"
  | "text-create"
  | "binary-create"
  | "support-update";

export interface VersionPayloadsTestingHooks {
  beforeWrite?: (phase: ApiWritePhase, path: string) => Promise<void> | void;
  afterPlan?: () => Promise<void> | void;
}

const REQUEST_KEYS = new Set([
  "meshRoot",
  "items",
  "defaults",
  "historyTrackingPolicyOverride",
  "overwriteExistingState",
]);
const ITEM_KEYS = new Set([
  "designatorPath",
  "bytes",
  "historySegment",
  "stateSegment",
  "manifestationSegment",
]);
const DEFAULT_KEYS = new Set([
  "historySegment",
  "stateSegment",
  "manifestationSegment",
]);
const HISTORY_TRACKING_POLICIES = new Set<HistoryTrackingPolicy>([
  "versioned",
  "currentOnly",
  "required",
  "slimHistory",
  "checkpointOnly",
  "metadataOnly",
]);
const TEXT_PAYLOAD_PATH_PATTERN =
  /\.(css|csv|html|json|jsonld|md|nt|nq|owl|rdf|svg|text|trig|ttl|txt|xml)$/i;

export async function versionPayloads(
  request: VersionPayloadsRequest,
): Promise<VersionPayloadsResult> {
  return await executeVersionPayloads(request);
}

/** Test-only seam; intentionally omitted from src/api/mod.ts and src/mod.ts. */
export async function versionPayloadsForTesting(
  request: VersionPayloadsRequest,
  hooks: VersionPayloadsTestingHooks,
): Promise<VersionPayloadsResult> {
  return await executeVersionPayloads(request, hooks);
}

export function admitVersionPayloadsRequest(
  request: VersionPayloadsRequest,
): AdmittedVersionPayloadsRequest {
  try {
    assertRecordWithKeys(request, "request", REQUEST_KEYS);
    if (typeof request.meshRoot !== "string" || !isAbsolute(request.meshRoot)) {
      throw new Error("request.meshRoot must be an absolute path");
    }
    if (!Array.isArray(request.items) || request.items.length === 0) {
      throw new Error("request.items must be a non-empty array");
    }
    const defaults = normalizeDefaults(request.defaults);
    const overwriteExistingState = normalizeOptionalBoolean(
      request.overwriteExistingState,
      "request.overwriteExistingState",
    ) ?? false;
    const historyTrackingPolicyOverride =
      normalizeHistoryTrackingPolicyOverride(
        request.historyTrackingPolicyOverride,
      );
    if (overwriteExistingState && request.items.length !== 1) {
      throw new Error(
        "overwriteExistingState is supported for exactly one item",
      );
    }

    const copied = request.items.map((item, index) => {
      assertRecordWithKeys(item, `request.items[${index}]`, ITEM_KEYS);
      if (typeof item.designatorPath !== "string") {
        throw new Error(
          `request.items[${index}].designatorPath must be a string`,
        );
      }
      if (item.designatorPath.trim().length === 0) {
        throw new Error(
          `request.items[${index}].designatorPath must use '/' for the root target`,
        );
      }
      if (!(item.bytes instanceof Uint8Array)) {
        throw new Error(`request.items[${index}].bytes must be a Uint8Array`);
      }
      const bytes = new Uint8Array(item.bytes.byteLength);
      bytes.set(item.bytes);
      let text: string;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch (cause) {
        throw new WeaveApiError(
          `Payload bytes for ${item.designatorPath} are not valid UTF-8.`,
          {
            code: "unsupported-content",
            stage: "admit",
            target: { index, designatorPath: item.designatorPath },
            cause,
          },
        );
      }
      return { item, index, bytes, text };
    });
    const versionTargets: VersionTargetSpec[] = copied.map(({ item }) => ({
      designatorPath: item.designatorPath.trim() === "/"
        ? ""
        : item.designatorPath,
      historySegment: item.historySegment ?? defaults.historySegment,
      stateSegment: item.stateSegment ?? defaults.stateSegment,
      manifestationSegment: item.manifestationSegment ??
        defaults.manifestationSegment,
    }));
    const targets = normalizeVersionTargetSpecs(
      versionTargets,
      "request.items",
      (message) => new Error(message),
    );
    if (
      overwriteExistingState &&
      (targets[0]?.historySegment === undefined ||
        targets[0]?.stateSegment === undefined)
    ) {
      throw new Error(
        "overwriteExistingState requires explicit resolved historySegment and stateSegment",
      );
    }

    return {
      meshRoot: resolve(request.meshRoot),
      items: copied.map((item, index) => ({
        index: item.index,
        target: targets[index]!,
        bytes: item.bytes,
        text: item.text,
      })),
      targets,
      ...(historyTrackingPolicyOverride
        ? { historyTrackingPolicyOverride }
        : {}),
      overwriteExistingState,
    };
  } catch (error) {
    if (error instanceof WeaveApiError) {
      throw error;
    }
    throw new WeaveApiError(
      error instanceof Error ? error.message : "Invalid version request.",
      { code: "invalid-request", stage: "admit", cause: error },
    );
  }
}

async function executeVersionPayloads(
  request: VersionPayloadsRequest,
  hooks: VersionPayloadsTestingHooks = {},
): Promise<VersionPayloadsResult> {
  const admitted = admitVersionPayloadsRequest(request);
  const loaded = await loadVersionPayloadItems(admitted);
  const overlay = new TextFileOverlay();
  for (const item of loaded.items) {
    overlay.set(item.absoluteWorkingPath, item.text);
  }

  let prepared: PreparedCoherentPayloadBatchVersionExecution;
  try {
    prepared = await prepareCoherentPayloadBatchVersionExecution(
      admitted.meshRoot,
      admitted.targets,
      loaded.localPathPolicy,
      overlay,
      admitted.overwriteExistingState,
      admitted.historyTrackingPolicyOverride,
    );
  } catch (error) {
    throw mapPreparationError(error);
  }

  const workingFiles = loaded.items.flatMap((item) =>
    item.workingChanged ? [{ path: item.workingPath, contents: item.text }] : []
  );
  try {
    await preflightCombinedPlan(admitted.meshRoot, workingFiles, prepared);
  } catch (error) {
    throw new WeaveApiError(
      error instanceof Error
        ? error.message
        : "Payload version plan failed preflight.",
      { code: "plan-conflict", stage: "plan", cause: error },
    );
  }
  let outcomes: readonly PayloadVersionOutcome[];
  try {
    outcomes = deriveOutcomes(loaded.items, prepared);
  } catch (error) {
    if (error instanceof WeaveApiError) {
      throw error;
    }
    throw new WeaveApiError(
      error instanceof Error
        ? error.message
        : "Could not derive payload version outcomes.",
      { code: "plan-conflict", stage: "plan", cause: error },
    );
  }
  await hooks.afterPlan?.();
  const writes = await writeCombinedPlan(
    admitted.meshRoot,
    workingFiles,
    prepared,
    hooks,
  );

  return {
    meshBase: prepared.meshState.meshBase,
    outcomes,
    createdPaths: writes.createdPaths,
    updatedPaths: writes.updatedPaths,
  };
}

async function loadVersionPayloadItems(
  admitted: AdmittedVersionPayloadsRequest,
): Promise<{
  localPathPolicy: OperationalLocalPathPolicy;
  meshState: MeshState;
  items: readonly LoadedVersionPayloadItem[];
}> {
  try {
    const localPathPolicy = await loadOperationalLocalPathPolicy(
      admitted.meshRoot,
    );
    const meshState = await loadMeshState(admitted.meshRoot);
    const knownDesignators = new Set(listKnopDesignatorPaths(
      meshState.meshBase,
      meshState.currentMeshInventoryTurtle,
      "Could not parse the current MeshInventory while resolving programmatic payload targets.",
    ));
    const realMeshRoot = await Deno.realPath(admitted.meshRoot);
    const items: LoadedVersionPayloadItem[] = [];

    for (const item of admitted.items) {
      const publicDesignatorPath = formatDesignatorPathForDisplay(
        item.target.designatorPath,
      );
      const target = {
        index: item.index,
        designatorPath: publicDesignatorPath,
      };
      if (!knownDesignators.has(item.target.designatorPath)) {
        throw new WeaveApiError(
          `Unknown payload target: ${publicDesignatorPath}`,
          { code: "unknown-target", stage: "load", target },
        );
      }
      const inventoryPath = join(
        admitted.meshRoot,
        `${toKnopPath(item.target.designatorPath)}/_inventory/inventory.ttl`,
      );
      let inventoryTurtle: string;
      try {
        inventoryTurtle = await Deno.readTextFile(inventoryPath);
      } catch (cause) {
        throw new WeaveApiError(
          `Could not load the target inventory for ${publicDesignatorPath}.`,
          {
            code: "malformed-mesh",
            stage: "load",
            target,
            path: meshRelativePath(admitted.meshRoot, inventoryPath),
            cause,
          },
        );
      }
      let payload;
      try {
        payload = resolvePayloadArtifactInventoryState(
          meshState.meshBase,
          inventoryTurtle,
          item.target.designatorPath,
          {
            parseErrorMessage:
              `Could not parse the current KnopInventory for ${publicDesignatorPath}.`,
            missingWorkingFileMessage:
              `Could not resolve the working payload file for ${publicDesignatorPath}.`,
          },
        );
      } catch (cause) {
        throw new WeaveApiError(
          cause instanceof Error
            ? cause.message
            : `Malformed payload target ${publicDesignatorPath}.`,
          { code: "malformed-mesh", stage: "load", target, cause },
        );
      }
      if (payload === undefined) {
        throw new WeaveApiError(
          `Target ${publicDesignatorPath} is not a payload artifact.`,
          { code: "not-a-payload", stage: "load", target },
        );
      }
      if (payload.repositorySourceFloatingLocator !== undefined) {
        throw new WeaveApiError(
          `Target ${publicDesignatorPath} uses a repository/floating source.`,
          { code: "unsupported-source", stage: "load", target },
        );
      }
      if (
        !TEXT_PAYLOAD_PATH_PATTERN.test(payload.workingLocalRelativePath) ||
        item.text.trim().length === 0
      ) {
        throw new WeaveApiError(
          `Target ${publicDesignatorPath} is not an eligible non-empty UTF-8 text/RDF payload.`,
          { code: "unsupported-content", stage: "load", target },
        );
      }
      let absoluteWorkingPath: string;
      try {
        absoluteWorkingPath = resolveAllowedLocalPath(
          localPathPolicy,
          "workingLocalRelativePath",
          payload.workingLocalRelativePath,
        );
      } catch (cause) {
        if (!(cause instanceof LocalPathAccessError)) {
          throw cause;
        }
        throw new WeaveApiError(
          `Target ${publicDesignatorPath} does not use an eligible mesh-local working source.`,
          { code: "unsupported-source", stage: "load", target, cause },
        );
      }
      let stat: Deno.FileInfo;
      let realWorkingPath: string;
      try {
        [stat, realWorkingPath] = await Promise.all([
          Deno.stat(absoluteWorkingPath),
          Deno.realPath(absoluteWorkingPath),
        ]);
      } catch (cause) {
        throw new WeaveApiError(
          `Target ${publicDesignatorPath} is missing its mesh-local working file.`,
          {
            code: "unsupported-source",
            stage: "load",
            target,
            path: payload.workingLocalRelativePath,
            cause,
          },
        );
      }
      if (!stat.isFile || !pathIsWithin(realMeshRoot, realWorkingPath)) {
        throw new WeaveApiError(
          `Target ${publicDesignatorPath} does not use a regular mesh-local working file.`,
          {
            code: "unsupported-source",
            stage: "load",
            target,
            path: payload.workingLocalRelativePath,
          },
        );
      }
      const currentBytes = await Deno.readFile(absoluteWorkingPath);
      items.push({
        ...item,
        absoluteWorkingPath,
        workingPath: meshRelativePath(admitted.meshRoot, absoluteWorkingPath),
        workingChanged: !bytesEqual(item.bytes, currentBytes),
      });
    }

    return { localPathPolicy, meshState, items };
  } catch (error) {
    if (error instanceof WeaveApiError) {
      throw error;
    }
    throw new WeaveApiError(
      error instanceof Error
        ? error.message
        : "Could not load the target mesh.",
      { code: "malformed-mesh", stage: "load", cause: error },
    );
  }
}

async function preflightCombinedPlan(
  meshRoot: string,
  workingFiles: readonly PlannedFile[],
  prepared: PreparedCoherentPayloadBatchVersionExecution,
): Promise<void> {
  const createdFiles = [
    ...prepared.plan.createdFiles,
    ...(prepared.plan.createdBinaryFiles ?? []),
  ];
  const updatedFiles = [...workingFiles, ...prepared.plan.updatedFiles];
  const createdPaths = new Set<string>();
  const updatedPaths = new Set<string>();

  for (const file of createdFiles) {
    assertSafePlannedPath(meshRoot, file.path);
    if (createdPaths.has(file.path) || updatedPaths.has(file.path)) {
      throw new Error(
        `Combined payload plan has a conflicting create path: ${file.path}`,
      );
    }
    createdPaths.add(file.path);
    try {
      await Deno.stat(join(meshRoot, file.path));
      throw new Error(`weave target already exists: ${file.path}`);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        continue;
      }
      throw error;
    }
  }
  for (const file of updatedFiles) {
    assertSafePlannedPath(meshRoot, file.path);
    if (updatedPaths.has(file.path) || createdPaths.has(file.path)) {
      throw new Error(
        `Combined payload plan has a conflicting update path: ${file.path}`,
      );
    }
    updatedPaths.add(file.path);
    const stat = await Deno.stat(join(meshRoot, file.path));
    if (!stat.isFile) {
      throw new Error(`weave update target is not a file: ${file.path}`);
    }
  }
  validateVersionPlanRdf({
    ...prepared.plan,
    updatedFiles,
  });
}

async function writeCombinedPlan(
  meshRoot: string,
  workingFiles: readonly PlannedFile[],
  prepared: PreparedCoherentPayloadBatchVersionExecution,
  hooks: VersionPayloadsTestingHooks,
): Promise<
  { createdPaths: readonly string[]; updatedPaths: readonly string[] }
> {
  const completedPaths: string[] = [];
  const createdPaths: string[] = [];
  const updatedPaths: string[] = [];
  const writes: readonly {
    phase: ApiWritePhase;
    path: string;
    created: boolean;
    write: () => Promise<void>;
  }[] = [
    ...workingFiles.map((file) => ({
      phase: "working-update" as const,
      path: file.path,
      created: false,
      write: () => writeTextFile(meshRoot, file, false),
    })),
    ...prepared.plan.createdFiles.map((file) => ({
      phase: "text-create" as const,
      path: file.path,
      created: true,
      write: () => writeTextFile(meshRoot, file, true),
    })),
    ...(prepared.plan.createdBinaryFiles ?? []).map((file) => ({
      phase: "binary-create" as const,
      path: file.path,
      created: true,
      write: async () => {
        const absolutePath = join(meshRoot, file.path);
        await Deno.mkdir(dirname(absolutePath), { recursive: true });
        await Deno.writeFile(absolutePath, file.contents, { createNew: true });
      },
    })),
    ...prepared.plan.updatedFiles.map((file) => ({
      phase: "support-update" as const,
      path: file.path,
      created: false,
      write: () => writeTextFile(meshRoot, file, false),
    })),
  ];

  for (const write of writes) {
    try {
      await hooks.beforeWrite?.(write.phase, write.path);
      await write.write();
      completedPaths.push(write.path);
      (write.created ? createdPaths : updatedPaths).push(write.path);
    } catch (cause) {
      throw new WeaveApiError(
        `Payload version write failed during ${write.phase}: ${write.path}`,
        {
          code: "io-failure",
          stage: "write",
          path: write.path,
          completedPaths: [...completedPaths],
          possiblyTouchedPaths: [write.path],
          cause,
        },
      );
    }
  }
  return { createdPaths, updatedPaths };
}

/** Test-only writer seam; intentionally omitted from public barrels. */
export async function writeCombinedPlanForTesting(
  meshRoot: string,
  workingFiles: readonly PlannedFile[],
  prepared: PreparedCoherentPayloadBatchVersionExecution,
  hooks: VersionPayloadsTestingHooks,
): Promise<
  { createdPaths: readonly string[]; updatedPaths: readonly string[] }
> {
  return await writeCombinedPlan(meshRoot, workingFiles, prepared, hooks);
}

function deriveOutcomes(
  items: readonly LoadedVersionPayloadItem[],
  prepared: PreparedCoherentPayloadBatchVersionExecution,
): readonly PayloadVersionOutcome[] {
  const versioned = new Set(prepared.plan.versionedDesignatorPaths);
  const candidateByPath = new Map(
    prepared.candidates.map((
      candidate,
    ) => [candidate.designatorPath, candidate]),
  );
  return [...items].sort((left, right) =>
    left.target.designatorPath.localeCompare(right.target.designatorPath)
  ).map((item) => {
    const candidate = candidateByPath.get(item.target.designatorPath);
    if (candidate === undefined) {
      throw new WeaveApiError(
        `Planned payload target disappeared: ${
          formatDesignatorPathForDisplay(item.target.designatorPath)
        }`,
        { code: "plan-conflict", stage: "plan" },
      );
    }
    const snapshotPath = resolveOutcomeSnapshotPath(
      candidate,
      prepared,
    );
    const segments = snapshotIdentitySegments(
      item.target.designatorPath,
      snapshotPath,
    );
    return {
      status: versioned.has(item.target.designatorPath) || item.workingChanged
        ? "applied"
        : "alreadyCurrent",
      designatorPath: formatDesignatorPathForDisplay(
        item.target.designatorPath,
      ),
      payloadArtifactIri:
        new URL(item.target.designatorPath, prepared.meshState.meshBase).href,
      historySegment: segments.historySegment,
      stateSegment: segments.stateSegment,
      manifestationSegment: segments.manifestationSegment,
      snapshotPath,
    };
  });
}

function resolveOutcomeSnapshotPath(
  candidate: WeaveableKnopCandidate,
  prepared: PreparedCoherentPayloadBatchVersionExecution,
): string {
  const payload = candidate.payloadArtifact;
  if (payload === undefined) {
    throw new Error(
      `Missing planned payload artifact for ${candidate.designatorPath}.`,
    );
  }
  const fileName = basename(payload.workingLocalRelativePath);
  const designatorPrefix = candidate.designatorPath.length === 0
    ? ""
    : `${candidate.designatorPath}/`;
  const plannedPaths = [
    ...prepared.plan.createdFiles.map((file) => file.path),
    ...(prepared.plan.createdBinaryFiles ?? []).map((file) => file.path),
    ...prepared.plan.updatedFiles.map((file) => file.path),
  ];
  return plannedPaths.find((path) =>
    path.startsWith(designatorPrefix) &&
    !path.startsWith(`${designatorPrefix}_knop/`) &&
    basename(path) === fileName
  ) ?? payload.latestHistoricalSnapshotPath ?? (() => {
    throw new Error(
      `Could not resolve the payload snapshot for ${candidate.designatorPath}.`,
    );
  })();
}

function snapshotIdentitySegments(
  designatorPath: string,
  snapshotPath: string,
): {
  historySegment: string;
  stateSegment: string;
  manifestationSegment: string;
} {
  const designatorSegmentCount = designatorPath.length === 0
    ? 0
    : designatorPath.split("/").length;
  const segments = snapshotPath.split("/");
  const historySegment = segments[designatorSegmentCount];
  const stateSegment = segments[designatorSegmentCount + 1];
  const manifestationSegment = segments[designatorSegmentCount + 2];
  if (!historySegment || !stateSegment || !manifestationSegment) {
    throw new Error(`Invalid payload snapshot path: ${snapshotPath}`);
  }
  return { historySegment, stateSegment, manifestationSegment };
}

export function mapPreparationError(error: unknown): WeaveApiError {
  if (error instanceof WeaveApiError) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("consistent target-scoped planning policies")) {
    return new WeaveApiError(message, {
      code: "inconsistent-policy",
      stage: "load",
      cause: error,
    });
  }
  if (
    message.includes("Could not parse") ||
    message.includes(" is missing sflo:") ||
    message.includes("not currently weaveable")
  ) {
    return new WeaveApiError(message, {
      code: "malformed-mesh",
      stage: "load",
      cause: error,
    });
  }
  return new WeaveApiError(message, {
    code: "plan-conflict",
    stage: "plan",
    cause: error,
  });
}

function normalizeDefaults(
  defaults: PayloadVersionDefaults | undefined,
): PayloadVersionDefaults {
  if (defaults === undefined) {
    return {};
  }
  assertRecordWithKeys(defaults, "request.defaults", DEFAULT_KEYS);
  return defaults;
}

function normalizeHistoryTrackingPolicyOverride(
  value: HistoryTrackingPolicy | undefined,
): HistoryTrackingPolicy | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!HISTORY_TRACKING_POLICIES.has(value)) {
    throw new Error("request.historyTrackingPolicyOverride is not supported");
  }
  return value;
}

function normalizeOptionalBoolean(
  value: unknown,
  fieldName: string,
): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new Error(`${fieldName} must be a boolean`);
  }
  return value;
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

function assertSafePlannedPath(meshRoot: string, path: string): void {
  if (path.length === 0 || isAbsolute(path)) {
    throw new Error(`Planned path must be mesh-root-relative: ${path}`);
  }
  const absolutePath = resolve(meshRoot, path);
  if (!pathIsWithin(meshRoot, absolutePath)) {
    throw new Error(`Planned path escapes the mesh root: ${path}`);
  }
}

function meshRelativePath(meshRoot: string, absolutePath: string): string {
  const path = relative(meshRoot, absolutePath).replaceAll("\\", "/");
  if (path.length === 0 || path === ".." || path.startsWith("../")) {
    throw new Error(`Path is not a mesh-root-relative file: ${absolutePath}`);
  }
  return path;
}

function pathIsWithin(root: string, path: string): boolean {
  const pathFromRoot = relative(root, path);
  return pathFromRoot === "" ||
    (pathFromRoot !== ".." && !pathFromRoot.startsWith(`..${separator()}`) &&
      !isAbsolute(pathFromRoot));
}

function separator(): string {
  return Deno.build.os === "windows" ? "\\" : "/";
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) {
    return false;
  }
  return left.every((byte, index) => byte === right[index]);
}

async function writeTextFile(
  meshRoot: string,
  file: PlannedFile,
  createNew: boolean,
): Promise<void> {
  const absolutePath = join(meshRoot, file.path);
  await Deno.mkdir(dirname(absolutePath), { recursive: true });
  await Deno.writeTextFile(
    absolutePath,
    file.contents,
    createNew ? { createNew: true } : undefined,
  );
}
