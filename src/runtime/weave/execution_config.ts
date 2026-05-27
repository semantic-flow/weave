import type {
  EffectiveConfig,
  HistoryTrackingPolicy,
} from "../config/effective_config.ts";
import { loadWeaveEffectiveConfig } from "../config/effective_config.ts";
import type { OperationalLocalPathPolicy } from "../operational/local_path_policy.ts";
import type {
  WeaveNamingPolicies,
  WeaveResourcePageGenerationPolicies,
  WeaveSupportHistoryPolicies,
} from "../../core/weave/weave.ts";

export async function loadEffectiveConfigForExecution(
  options: {
    meshConfigTurtle?: string;
    meshConfigSource?: string;
    meshRoot?: string;
    meshBase?: string;
    meshMetadataTurtle?: string;
    meshMetadataSource?: string;
    meshInventoryTurtle?: string;
    localPathPolicy?: OperationalLocalPathPolicy;
    governedArtifactIris?: readonly string[];
    historyTrackingPolicyOverride?: HistoryTrackingPolicy;
    includeSemanticFlowMetadata?: boolean;
  } = {},
): Promise<EffectiveConfig> {
  return await loadWeaveEffectiveConfig({
    meshConfigTurtle: options.meshConfigTurtle,
    meshConfigSource: options.meshConfigSource,
    meshRoot: options.meshRoot,
    meshBase: options.meshBase,
    meshMetadataTurtle: options.meshMetadataTurtle,
    meshMetadataSource: options.meshMetadataSource,
    meshInventoryTurtle: options.meshInventoryTurtle,
    localPathPolicy: options.localPathPolicy,
    governedArtifactIris: options.governedArtifactIris,
    commandOverrides: {
      ...(options.historyTrackingPolicyOverride
        ? { historyTrackingPolicy: options.historyTrackingPolicyOverride }
        : {}),
      ...(options.includeSemanticFlowMetadata
        ? { resourcePagePresentation: "semanticSiteAllPanels" }
        : {}),
    },
  });
}

export function supportHistoryPoliciesFromEffectiveConfig(
  effectiveConfig: EffectiveConfig,
): WeaveSupportHistoryPolicies {
  return {
    meshMetadata: effectiveConfig.historyTrackingPolicyForArtifactRole(
      "meshMetadata",
    ),
    meshInventory: effectiveConfig.historyTrackingPolicyForArtifactRole(
      "meshInventory",
    ),
    config: effectiveConfig.historyTrackingPolicyForArtifactRole("config"),
    knopMetadata: effectiveConfig.historyTrackingPolicyForArtifactRole(
      "knopMetadata",
    ),
    knopInventory: effectiveConfig.historyTrackingPolicyForArtifactRole(
      "knopInventory",
    ),
    referenceCatalog: effectiveConfig.historyTrackingPolicyForArtifactRole(
      "referenceCatalog",
    ),
    resourcePageDefinition: effectiveConfig
      .historyTrackingPolicyForArtifactRole(
        "resourcePageDefinition",
      ),
  };
}

export function namingPoliciesFromEffectiveConfig(
  effectiveConfig: EffectiveConfig,
): WeaveNamingPolicies {
  return {
    historyNamingPolicy: effectiveConfig.namingPolicies.historyNamingPolicy,
    stateNamingPolicy: effectiveConfig.namingPolicies.stateNamingPolicy,
    manifestationNamingPolicy: effectiveConfig.namingPolicies
      .manifestationNamingPolicy,
  };
}

export function resourcePageGenerationPoliciesFromEffectiveConfig(
  effectiveConfig: EffectiveConfig,
): WeaveResourcePageGenerationPolicies {
  return {
    payload: effectiveConfig.resourcePageGenerationPolicyForArtifactRole(
      "payload",
    ),
    meshInventory: effectiveConfig.resourcePageGenerationPolicyForArtifactRole(
      "meshInventory",
    ),
    knopInventory: effectiveConfig.resourcePageGenerationPolicyForArtifactRole(
      "knopInventory",
    ),
    meshMetadata: effectiveConfig.resourcePageGenerationPolicyForArtifactRole(
      "meshMetadata",
    ),
    knopMetadata: effectiveConfig.resourcePageGenerationPolicyForArtifactRole(
      "knopMetadata",
    ),
    config: effectiveConfig.resourcePageGenerationPolicyForArtifactRole(
      "config",
    ),
    referenceCatalog: effectiveConfig
      .resourcePageGenerationPolicyForArtifactRole(
        "referenceCatalog",
      ),
    resourcePageDefinition: effectiveConfig
      .resourcePageGenerationPolicyForArtifactRole(
        "resourcePageDefinition",
      ),
  };
}
