import type { PlannedFile } from "../planned_file.ts";
import type { WeaveNamingPolicies } from "./naming_policy.ts";
import type { WeaveResourcePageGenerationPolicies } from "./resource_page_policy.ts";
import type { ResourcePageModel } from "./resource_page_models.ts";
import type { WeaveSupportHistoryPolicies } from "./support_history_policy.ts";
import type { WeaveableKnopCandidate } from "./candidates.ts";
import type { VersionRequest } from "./requests.ts";

export interface PlanWeaveInput {
  request: VersionRequest;
  meshBase: string;
  currentMeshInventoryTurtle: string;
  currentMeshMetadataTurtle?: string;
  weaveableKnops: readonly WeaveableKnopCandidate[];
  supportHistoryPolicies?: WeaveSupportHistoryPolicies;
  namingPolicies?: WeaveNamingPolicies;
  resourcePageGenerationPolicies?: WeaveResourcePageGenerationPolicies;
}

export interface WeavePlan {
  meshBase: string;
  wovenDesignatorPaths: readonly string[];
  createdFiles: readonly PlannedFile[];
  updatedFiles: readonly PlannedFile[];
  createdPages: readonly ResourcePageModel[];
}
