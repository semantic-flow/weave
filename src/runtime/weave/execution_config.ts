import { join } from "@std/path";
import { toKnopPath } from "../../core/designator_segments.ts";
import type {
  EffectiveConfig,
  HistoryTrackingPolicy,
} from "../config/effective_config.ts";
import { loadWeaveEffectiveConfig } from "../config/effective_config.ts";
import type { KnopConfigScopeInput } from "../config/config_sources.ts";
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
    knopConfigScopePath?: readonly KnopConfigScopeInput[];
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
    knopConfigScopePath: options.knopConfigScopePath,
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

export async function loadKnopConfigScopePathForTarget(
  options: {
    workspaceRoot: string;
    designatorPath: string;
    targetMetadataTurtle?: string;
  },
): Promise<readonly KnopConfigScopeInput[] | undefined> {
  const scopePath: KnopConfigScopeInput[] = [];
  for (
    const scopeKey of ancestorScopeKeysForDesignatorPath(
      options.designatorPath,
    )
  ) {
    const source = `${toKnopPath(scopeKey)}/_meta/meta.ttl`;
    const turtle = scopeKey === options.designatorPath &&
        options.targetMetadataTurtle !== undefined
      ? options.targetMetadataTurtle
      : await readOptionalTextFile(join(options.workspaceRoot, source));
    if (turtle === undefined) {
      continue;
    }
    scopePath.push({ scopeKey, turtle, source });
  }

  return scopePath.length > 0 ? scopePath : undefined;
}

function ancestorScopeKeysForDesignatorPath(
  designatorPath: string,
): readonly string[] {
  if (designatorPath === "") {
    return [""];
  }

  const segments = designatorPath.split("/");
  const scopeKeys = [""];
  for (let index = 0; index < segments.length; index += 1) {
    scopeKeys.push(segments.slice(0, index + 1).join("/"));
  }
  return scopeKeys;
}

async function readOptionalTextFile(path: string): Promise<string | undefined> {
  try {
    return await Deno.readTextFile(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return undefined;
    }
    throw error;
  }
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
