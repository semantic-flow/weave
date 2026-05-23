import type { NormalizedWeaveRequest } from "./request_normalization.ts";
import type { OperationalLocalPathPolicy } from "../operational/local_path_policy.ts";
import type { HistoryTrackingPolicy } from "../config/effective_config.ts";
import type { RuntimeTiming } from "../timing.ts";
import type { WeaveProgressHandler } from "./progress.ts";
import {
  type PreparedVersionExecution,
  prepareVersionExecution,
} from "./version_execution.ts";

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
): Promise<PreparedWeaveExecution> {
  const version = await prepareVersionExecution(
    workspaceRoot,
    request.targetPreparation.versionTargets,
    localPathPolicy,
    request.overwriteExistingState,
    historyTrackingPolicyOverride,
    onProgress,
    timing,
  );

  return {
    request,
    version,
  };
}
