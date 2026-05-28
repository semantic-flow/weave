import { join } from "@std/path";
import { toKnopPath } from "../../core/designator_segments.ts";
import type { ResourcePageGenerationConfig } from "../../core/weave/resource_page_policy.ts";
import type {
  ArtifactRole,
  EffectiveConfig,
  HistoryTrackingPolicy,
  ResourcePagePresentationProfile,
} from "../config/effective_config.ts";
import { loadWeaveEffectiveConfig } from "../config/effective_config.ts";
import type { KnopConfigScopeInput } from "../config/config_sources.ts";
import type { OperationalLocalPathPolicy } from "../operational/local_path_policy.ts";
import type { RuntimeTiming } from "../timing.ts";
import type {
  WeaveNamingPolicies,
  WeaveResourcePageGenerationPolicies,
  WeaveSupportHistoryPolicies,
} from "../../core/weave/weave.ts";
import type { MeshState } from "./mesh_state.ts";

const ROOT_KNOP_PROVIDER_SCOPE_KEY = "/";
const MESH_CONFIG_PROVIDER_SCOPE_KEY = "MESH_CONFIG";

export interface EffectiveConfigProvider {
  configForMeshScope(): Promise<EffectiveConfig>;
  configForTarget(designatorPath: string): Promise<EffectiveConfig>;
  resourcePagePresentationForMeshScope(): Promise<
    ResourcePagePresentationProfile
  >;
  resourcePagePresentationForTarget(
    designatorPath: string,
  ): Promise<ResourcePagePresentationProfile>;
}

export function createEffectiveConfigProviderForExecution(
  options: {
    meshRoot: string;
    meshState: MeshState;
    localPathPolicy: OperationalLocalPathPolicy;
    targetMetadataTurtleByDesignatorPath?: ReadonlyMap<string, string>;
    historyTrackingPolicyOverride?: HistoryTrackingPolicy;
    includeSemanticFlowMetadata?: boolean;
    timing?: RuntimeTiming;
    phasePrefix?: string;
  },
): EffectiveConfigProvider {
  const targetConfigByScopeKey = new Map<string, Promise<EffectiveConfig>>();
  let meshConfig: Promise<EffectiveConfig> | undefined;
  let cacheHits = 0;
  let cacheMisses = 0;

  const phase = (name: string) =>
    options.phasePrefix ? `${options.phasePrefix}.${name}` : name;
  const setTimingFields = () => {
    options.timing?.setField("effectiveConfigCacheHits", cacheHits);
    options.timing?.setField("effectiveConfigCacheMisses", cacheMisses);
    options.timing?.setField(
      "effectiveConfigCacheEntries",
      targetConfigByScopeKey.size + (meshConfig ? 1 : 0),
    );
  };
  const loadConfig = async (
    phaseName: string,
    operation: () => Promise<EffectiveConfig>,
  ) =>
    options.timing
      ? await options.timing.time(phase(phaseName), operation)
      : await operation();

  async function configForMeshScope(): Promise<EffectiveConfig> {
    if (meshConfig) {
      cacheHits += 1;
      setTimingFields();
      return await meshConfig;
    }

    cacheMisses += 1;
    meshConfig = loadConfig(
      "loadEffectiveConfig.mesh",
      () =>
        loadEffectiveConfigForExecution({
          meshConfigTurtle: options.meshState.currentMeshConfigTurtle,
          meshConfigSource: options.meshState.currentMeshConfigTurtle
            ? "_mesh/_config/config.ttl"
            : undefined,
          meshRoot: options.meshRoot,
          meshBase: options.meshState.meshBase,
          meshMetadataTurtle: options.meshState.currentMeshMetadataTurtle,
          meshMetadataSource: "_mesh/_meta/meta.ttl",
          meshInventoryTurtle: options.meshState.currentMeshInventoryTurtle,
          localPathPolicy: options.localPathPolicy,
          historyTrackingPolicyOverride: options.historyTrackingPolicyOverride,
          includeSemanticFlowMetadata: options.includeSemanticFlowMetadata,
        }),
    );
    setTimingFields();
    return await meshConfig;
  }

  async function configForTarget(
    designatorPath: string,
  ): Promise<EffectiveConfig> {
    const scopeKey = toProviderScopeKey(designatorPath);
    const existing = targetConfigByScopeKey.get(scopeKey);
    if (existing) {
      cacheHits += 1;
      setTimingFields();
      return await existing;
    }

    cacheMisses += 1;
    const normalizedDesignatorPath = fromProviderScopeKey(scopeKey);
    const config = loadConfig("loadEffectiveConfig.target", async () => {
      const knopConfigScopePath = await loadKnopConfigScopePathForTarget({
        workspaceRoot: options.meshRoot,
        designatorPath: normalizedDesignatorPath,
        targetMetadataTurtle: options.targetMetadataTurtleByDesignatorPath
          ?.get(normalizedDesignatorPath),
      });
      return await loadEffectiveConfigForExecution({
        meshConfigTurtle: options.meshState.currentMeshConfigTurtle,
        meshConfigSource: options.meshState.currentMeshConfigTurtle
          ? "_mesh/_config/config.ttl"
          : undefined,
        meshRoot: options.meshRoot,
        meshBase: options.meshState.meshBase,
        meshMetadataTurtle: options.meshState.currentMeshMetadataTurtle,
        meshMetadataSource: "_mesh/_meta/meta.ttl",
        meshInventoryTurtle: options.meshState.currentMeshInventoryTurtle,
        localPathPolicy: options.localPathPolicy,
        knopConfigScopePath,
        historyTrackingPolicyOverride: options.historyTrackingPolicyOverride,
        includeSemanticFlowMetadata: options.includeSemanticFlowMetadata,
      });
    });
    targetConfigByScopeKey.set(scopeKey, config);
    setTimingFields();
    return await config;
  }

  return {
    configForMeshScope,
    configForTarget,
    async resourcePagePresentationForMeshScope() {
      return (await configForMeshScope()).resourcePagePresentation;
    },
    async resourcePagePresentationForTarget(designatorPath: string) {
      return (await configForTarget(designatorPath)).resourcePagePresentation;
    },
  };
}

function toProviderScopeKey(designatorPath: string): string {
  return designatorPath.length === 0
    ? ROOT_KNOP_PROVIDER_SCOPE_KEY
    : designatorPath;
}

function fromProviderScopeKey(scopeKey: string): string {
  return scopeKey === ROOT_KNOP_PROVIDER_SCOPE_KEY ? "" : scopeKey;
}

export function meshConfigProviderScopeKey(): string {
  return MESH_CONFIG_PROVIDER_SCOPE_KEY;
}

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

export function supportHistoryPoliciesFromScopedEffectiveConfigs(
  meshEffectiveConfig: EffectiveConfig,
  targetEffectiveConfig: EffectiveConfig,
): WeaveSupportHistoryPolicies {
  return {
    meshMetadata: meshEffectiveConfig.historyTrackingPolicyForArtifactRole(
      "meshMetadata",
    ),
    meshInventory: meshEffectiveConfig.historyTrackingPolicyForArtifactRole(
      "meshInventory",
    ),
    config: meshEffectiveConfig.historyTrackingPolicyForArtifactRole("config"),
    knopMetadata: targetEffectiveConfig.historyTrackingPolicyForArtifactRole(
      "knopMetadata",
    ),
    knopInventory: targetEffectiveConfig.historyTrackingPolicyForArtifactRole(
      "knopInventory",
    ),
    referenceCatalog: targetEffectiveConfig
      .historyTrackingPolicyForArtifactRole(
        "referenceCatalog",
      ),
    resourcePageDefinition: targetEffectiveConfig
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

export function resourcePageGenerationConfigFromScopedEffectiveConfigs(
  meshEffectiveConfig: EffectiveConfig,
  targetEffectiveConfig: EffectiveConfig,
): ResourcePageGenerationConfig {
  const configForRole = (artifactRole: ArtifactRole) =>
    meshOwnedArtifactRoles.has(artifactRole)
      ? meshEffectiveConfig
      : targetEffectiveConfig;

  return {
    resourcePageGenerationPolicyForArtifactRole(artifactRole) {
      return configForRole(artifactRole)
        .resourcePageGenerationPolicyForArtifactRole(artifactRole);
    },
    resourcePageGenerationPolicyForArtifactTarget(target) {
      return configForRole(target.artifactRole)
        .resourcePageGenerationPolicyForArtifactTarget(target);
    },
  };
}

export function resourcePageGenerationPoliciesFromScopedEffectiveConfigs(
  meshEffectiveConfig: EffectiveConfig,
  targetEffectiveConfig: EffectiveConfig,
): WeaveResourcePageGenerationPolicies {
  return {
    payload: targetEffectiveConfig.resourcePageGenerationPolicyForArtifactRole(
      "payload",
    ),
    meshInventory: meshEffectiveConfig
      .resourcePageGenerationPolicyForArtifactRole(
        "meshInventory",
      ),
    knopInventory: targetEffectiveConfig
      .resourcePageGenerationPolicyForArtifactRole(
        "knopInventory",
      ),
    meshMetadata: meshEffectiveConfig
      .resourcePageGenerationPolicyForArtifactRole(
        "meshMetadata",
      ),
    knopMetadata: targetEffectiveConfig
      .resourcePageGenerationPolicyForArtifactRole(
        "knopMetadata",
      ),
    config: meshEffectiveConfig.resourcePageGenerationPolicyForArtifactRole(
      "config",
    ),
    referenceCatalog: targetEffectiveConfig
      .resourcePageGenerationPolicyForArtifactRole(
        "referenceCatalog",
      ),
    resourcePageDefinition: targetEffectiveConfig
      .resourcePageGenerationPolicyForArtifactRole(
        "resourcePageDefinition",
      ),
  };
}

const meshOwnedArtifactRoles = new Set<ArtifactRole>([
  "meshInventory",
  "meshMetadata",
  "config",
]);
