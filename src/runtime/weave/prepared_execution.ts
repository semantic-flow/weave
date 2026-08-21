import type { NormalizedWeaveRequest } from "./request_normalization.ts";
import type { OperationalLocalPathPolicy } from "../operational/local_path_policy.ts";
import type { HistoryTrackingPolicy } from "../config/effective_config.ts";
import type { RuntimeTiming } from "../timing.ts";
import type { WeaveProgressHandler } from "./progress.ts";
import {
  type InputSnapshotVerificationHooks,
  type PreparedVersionExecution,
  prepareVersionExecution,
} from "./version_execution.ts";
import type { RuntimeMemoryStats } from "./memory_stats.ts";

export interface PreparedWeaveExecution {
  request: NormalizedWeaveRequest;
  version: PreparedVersionExecution;
}

export async function prepareWeaveExecution(
  workspaceRoot: string,
  request: NormalizedWeaveRequest,
  localPathPolicy: OperationalLocalPathPolicy,
  historyTrackingPolicyOverride?: HistoryTrackingPolicy,
  onProgress?: WeaveProgressHandler,
  timing?: RuntimeTiming,
  inputSnapshotVerification?: InputSnapshotVerificationHooks,
  memoryStats?: RuntimeMemoryStats,
): Promise<PreparedWeaveExecution> {
  const version = await prepareVersionExecution(
    workspaceRoot,
    request.targetPreparation.versionTargets,
    localPathPolicy,
    request.overwriteExistingState,
    historyTrackingPolicyOverride,
    onProgress,
    timing,
    inputSnapshotVerification,
    undefined,
    undefined,
    memoryStats,
  );

  return {
    request,
    version,
  };
}
