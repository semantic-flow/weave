import type {
  ArtifactRole,
  EffectiveConfig,
  HistoryTrackingPolicy,
} from "../config/effective_config.ts";
import {
  EffectiveConfig as EffectiveConfigValue,
  loadWeaveDefaultEffectiveConfig,
} from "../config/effective_config.ts";
import type {
  WeaveNamingPolicies,
  WeaveResourcePageGenerationPolicies,
  WeaveSupportHistoryPolicies,
} from "../../core/weave/weave.ts";

const ALL_ARTIFACT_ROLES: readonly ArtifactRole[] = [
  "payload",
  "meshInventory",
  "knopInventory",
  "meshMetadata",
  "knopMetadata",
  "config",
  "referenceCatalog",
  "resourcePageDefinition",
  "resourcePageTemplate",
  "resourcePageStylesheet",
  "runtimeMeta",
];

export async function loadEffectiveConfigForExecution(
  historyTrackingPolicyOverride?: HistoryTrackingPolicy,
): Promise<EffectiveConfig> {
  const effectiveConfig = await loadWeaveDefaultEffectiveConfig();
  if (historyTrackingPolicyOverride === undefined) {
    return effectiveConfig;
  }

  return new EffectiveConfigValue({
    sources: effectiveConfig.sources,
    configResolution: effectiveConfig.configResolution,
    namingPolicies: effectiveConfig.namingPolicies,
    resourcePagePresentation: effectiveConfig.resourcePagePresentation,
    resourcePageRegenerationConfigPolicy: effectiveConfig
      .resourcePageRegenerationConfigPolicy,
    defaultHistoryTrackingPolicy: historyTrackingPolicyOverride,
    historyTrackingByRole: new Map(
      ALL_ARTIFACT_ROLES.map((role) => [
        role,
        historyTrackingPolicyOverride,
      ]),
    ),
    defaultResourcePageGenerationPolicy: "generate",
    resourcePageGenerationByRole: new Map(
      ALL_ARTIFACT_ROLES.map((role) => [
        role,
        effectiveConfig.resourcePageGenerationPolicyForArtifactRole(role),
      ]),
    ),
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
