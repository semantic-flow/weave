import { assertEquals, assertThrows } from "@std/assert";
import {
  DEFAULT_RESOURCE_PAGE_PRESENTATION_PROFILE,
  EffectiveConfigError,
  loadWeaveDefaultEffectiveConfig,
  parseWeaveDefaultEffectiveConfig,
} from "./effective_config.ts";

const WEAVE_DEFAULTS_NAMESPACE =
  "https://semantic-flow.github.io/weave/defaults/";

Deno.test("loadWeaveDefaultEffectiveConfig resolves default artifact-role policies", async () => {
  const config = await loadWeaveDefaultEffectiveConfig();

  assertEquals(
    config.artifactRolePolicy("payload"),
    {
      historyTrackingPolicy: "versioned",
      resourcePageGenerationPolicy: "generate",
    },
  );
  assertEquals(
    config.artifactRolePolicy("config"),
    {
      historyTrackingPolicy: "versioned",
      resourcePageGenerationPolicy: "generate",
    },
  );
  assertEquals(
    config.artifactRolePolicy("meshInventory"),
    {
      historyTrackingPolicy: "currentOnly",
      resourcePageGenerationPolicy: "generate",
    },
  );
  assertEquals(
    config.artifactRolePolicy("knopInventory"),
    {
      historyTrackingPolicy: "currentOnly",
      resourcePageGenerationPolicy: "generate",
    },
  );
  assertEquals(
    config.artifactRolePolicy("meshMetadata"),
    {
      historyTrackingPolicy: "currentOnly",
      resourcePageGenerationPolicy: "generate",
    },
  );
  assertEquals(
    config.artifactRolePolicy("runtimeMeta"),
    {
      historyTrackingPolicy: "currentOnly",
      resourcePageGenerationPolicy: "generate",
    },
  );
  assertEquals(
    config.artifactRolePolicy("referenceCatalog"),
    {
      historyTrackingPolicy: "currentOnly",
      resourcePageGenerationPolicy: "generate",
    },
  );
});

Deno.test("loadWeaveDefaultEffectiveConfig parses config-resolution defaults", async () => {
  const config = await loadWeaveDefaultEffectiveConfig();

  assertEquals(config.configResolution.unknownConfigTermPolicy, "reject");
  assertEquals(config.configResolution.configCyclePolicy, "reject");
  assertEquals(config.configResolution.configReferencePolicy, "pinnedOnly");
  assertEquals(
    config.configResolution.operationRequestOverridePolicy,
    "warnAndApply",
  );
  assertEquals(
    config.configResolution.resolvedConfigCachePolicy,
    "cacheForProcess",
  );
  assertEquals(
    config.configResolution.portableResolverHintPolicy,
    "honorWithinTrustedBoundary",
  );
  assertEquals(config.configResolution.maxConfigReferenceDepth, 8);
  assertEquals(
    config.configResolution.layers.map((layer) => layer.role),
    [
      "builtInDefaults",
      "weaveDefaults",
      "machineLocalOperational",
      "workspaceOperational",
      "meshLocal",
      "meshInheritable",
      "knopInherited",
      "reusableConfig",
      "knopLocal",
      "knopInheritable",
      "commandOverride",
    ],
  );
});

Deno.test("loadWeaveDefaultEffectiveConfig parses ResourcePage presentation defaults", async () => {
  const config = await loadWeaveDefaultEffectiveConfig();

  assertEquals(
    config.resourcePagePresentation,
    DEFAULT_RESOURCE_PAGE_PRESENTATION_PROFILE,
  );
  assertEquals(
    config.resourcePagePresentation.panelSelections.map((selection) => [
      selection.panel,
      selection.order,
    ]),
    [
      ["children", 10],
      ["properties", 20],
      ["blankNodes", 30],
      ["references", 40],
      ["currentLinks", 50],
      ["knopArtifacts", 55],
      ["factSections", 57],
      ["rawSource", 60],
      ["history", 70],
      ["semanticFlowMetadata", 80],
    ],
  );
});

Deno.test("loadWeaveDefaultEffectiveConfig parses naming defaults", async () => {
  const config = await loadWeaveDefaultEffectiveConfig();

  assertEquals(config.namingPolicies, {
    historyNamingPolicy: "ordinal",
    stateNamingPolicy: "ordinal",
    manifestationNamingPolicy: "filenameDerived",
  });
});

Deno.test("loadWeaveDefaultEffectiveConfig parses ResourcePage regeneration policy", async () => {
  const config = await loadWeaveDefaultEffectiveConfig();

  assertEquals(
    config.resourcePageRegenerationConfigPolicy,
    "configAtTheTime",
  );
});

Deno.test("parseWeaveDefaultEffectiveConfig rejects unknown policy values", () => {
  assertThrows(
    () =>
      parseWeaveDefaultEffectiveConfig(
        withValidResourcePagePresentation(
          `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:ApplicationConfig ;
  sfcfg:hasDefaultHistoryTrackingPolicy sfcfg:historyTrackingPolicy_surprise ;
  sfcfg:hasDefaultResourcePageGenerationPolicy sfcfg:resourcePageGenerationPolicy_generate .
`,
        ),
        VALID_CONFIG_RESOLUTION_TURTLE,
      ),
    EffectiveConfigError,
    "Unsupported",
  );
});

Deno.test("parseWeaveDefaultEffectiveConfig rejects unknown naming policy values", () => {
  assertThrows(
    () =>
      parseWeaveDefaultEffectiveConfig(
        withValidResourcePagePresentation(
          `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:ApplicationConfig ;
  sfcfg:hasDefaultHistoryTrackingPolicy sfcfg:historyTrackingPolicy_currentOnly ;
  sfcfg:hasDefaultResourcePageGenerationPolicy sfcfg:resourcePageGenerationPolicy_generate ;
  sfcfg:hasResourcePageRegenerationConfigPolicy sfcfg:resourcePageRegenerationConfigPolicy_configAtTheTime ;
  sfcfg:hasHistoryNamingPolicy sfcfg:historyNamingPolicy_ordinal ;
  sfcfg:hasStateNamingPolicy sfcfg:stateNamingPolicy_surprise ;
  sfcfg:hasManifestationNamingPolicy sfcfg:manifestationNamingPolicy_filenameDerived .
`,
        ),
        VALID_CONFIG_RESOLUTION_TURTLE,
      ),
    EffectiveConfigError,
    "Unsupported",
  );
});

Deno.test("parseWeaveDefaultEffectiveConfig rejects unknown ResourcePage regeneration policy values", () => {
  assertThrows(
    () =>
      parseWeaveDefaultEffectiveConfig(
        withValidResourcePagePresentation(
          `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:ApplicationConfig ;
  sfcfg:hasDefaultHistoryTrackingPolicy sfcfg:historyTrackingPolicy_currentOnly ;
  sfcfg:hasDefaultResourcePageGenerationPolicy sfcfg:resourcePageGenerationPolicy_generate ;
  sfcfg:hasResourcePageRegenerationConfigPolicy sfcfg:resourcePageRegenerationConfigPolicy_surprise ;
  sfcfg:hasHistoryNamingPolicy sfcfg:historyNamingPolicy_ordinal ;
  sfcfg:hasStateNamingPolicy sfcfg:stateNamingPolicy_ordinal ;
  sfcfg:hasManifestationNamingPolicy sfcfg:manifestationNamingPolicy_filenameDerived .
`,
        ),
        VALID_CONFIG_RESOLUTION_TURTLE,
      ),
    EffectiveConfigError,
    "Unsupported",
  );
});

Deno.test("parseWeaveDefaultEffectiveConfig rejects duplicate role policies", () => {
  assertThrows(
    () =>
      parseWeaveDefaultEffectiveConfig(
        withValidResourcePagePresentation(
          `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:ApplicationConfig ;
  sfcfg:hasDefaultHistoryTrackingPolicy sfcfg:historyTrackingPolicy_currentOnly ;
  sfcfg:hasDefaultResourcePageGenerationPolicy sfcfg:resourcePageGenerationPolicy_generate ;
  sfcfg:hasHistoryTrackingDefault [
    a sfcfg:ArtifactRolePolicy ;
    sfcfg:hasArtifactRole sfcfg:artifactRole_payload ;
    sfcfg:hasHistoryTrackingPolicy sfcfg:historyTrackingPolicy_versioned
  ], [
    a sfcfg:ArtifactRolePolicy ;
    sfcfg:hasArtifactRole sfcfg:artifactRole_payload ;
    sfcfg:hasHistoryTrackingPolicy sfcfg:historyTrackingPolicy_currentOnly
  ] .
`,
        ),
        VALID_CONFIG_RESOLUTION_TURTLE,
      ),
    EffectiveConfigError,
    "Duplicate artifact-role policy",
  );
});

Deno.test("parseWeaveDefaultEffectiveConfig rejects unknown ResourcePage panel identities", () => {
  const unknownPanelTurtle = withValidResourcePagePresentation(
    VALID_APPLICATION_TURTLE,
  ).replace(
    `${WEAVE_DEFAULTS_NAMESPACE}resource-page-panel/children`,
    `${WEAVE_DEFAULTS_NAMESPACE}resource-page-panel/missing-panel`,
  );

  assertThrows(
    () =>
      parseWeaveDefaultEffectiveConfig(
        unknownPanelTurtle,
        VALID_CONFIG_RESOLUTION_TURTLE,
      ),
    EffectiveConfigError,
    "Unsupported",
  );
});

const VALID_APPLICATION_TURTLE =
  `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:ApplicationConfig ;
  sfcfg:hasDefaultHistoryTrackingPolicy sfcfg:historyTrackingPolicy_currentOnly ;
  sfcfg:hasDefaultResourcePageGenerationPolicy sfcfg:resourcePageGenerationPolicy_generate ;
  sfcfg:hasResourcePageRegenerationConfigPolicy sfcfg:resourcePageRegenerationConfigPolicy_configAtTheTime ;
  sfcfg:hasHistoryNamingPolicy sfcfg:historyNamingPolicy_ordinal ;
  sfcfg:hasStateNamingPolicy sfcfg:stateNamingPolicy_ordinal ;
  sfcfg:hasManifestationNamingPolicy sfcfg:manifestationNamingPolicy_filenameDerived .
`;

function withValidResourcePagePresentation(applicationTurtle: string): string {
  return `${applicationTurtle.trimEnd()}

<> sfcfg:hasDefaultResourcePagePresentationConfig <${WEAVE_DEFAULTS_NAMESPACE}resource-page-presentation/semantic-site-default> .

<${WEAVE_DEFAULTS_NAMESPACE}resource-page-presentation/semantic-site-default> a sfcfg:ResourcePagePresentationConfig ;
  sfcfg:hasOuterResourcePageTemplate <${WEAVE_DEFAULTS_NAMESPACE}resource-page-template/semantic-site/outer> ;
  sfcfg:hasInnerResourcePageTemplate <${WEAVE_DEFAULTS_NAMESPACE}resource-page-template/semantic-site/inner> ;
  sfcfg:hasResourcePageStylesheet <${WEAVE_DEFAULTS_NAMESPACE}default-stylesheet> ;
  sfcfg:hasResourcePagePanelSelection <${WEAVE_DEFAULTS_NAMESPACE}resource-page-presentation/semantic-site-default#children-panel> .

<${WEAVE_DEFAULTS_NAMESPACE}resource-page-presentation/semantic-site-default#children-panel> a sfcfg:ResourcePagePanelSelection ;
  sfcfg:hasResourcePagePanel <${WEAVE_DEFAULTS_NAMESPACE}resource-page-panel/children> ;
  sfcfg:panelOrder "10"^^<http://www.w3.org/2001/XMLSchema#nonNegativeInteger> ;
  sfcfg:hasPanelInclusionPolicy sfcfg:panelInclusionPolicy_auto ;
  sfcfg:hasPanelTargetPageKind sfcfg:resourcePageKind_identifier ;
  sfcfg:hasPanelDataRequirement sfcfg:panelDataRequirement_children .
`;
}

const VALID_CONFIG_RESOLUTION_TURTLE =
  `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<> a sfcfg:ConfigResolutionConfig ;
  sfcfg:hasUnknownConfigTermPolicy sfcfg:unknownConfigTermPolicy_reject ;
  sfcfg:hasConfigCyclePolicy sfcfg:configCyclePolicy_reject ;
  sfcfg:hasConfigReferencePolicy sfcfg:configReferencePolicy_pinnedOnly ;
  sfcfg:hasOperationRequestOverridePolicy sfcfg:operationRequestOverridePolicy_warnAndApply ;
  sfcfg:hasResolvedConfigCachePolicy sfcfg:resolvedConfigCachePolicy_cacheForProcess ;
  sfcfg:hasPortableResolverHintPolicy sfcfg:portableResolverHintPolicy_honorWithinTrustedBoundary ;
  sfcfg:maxConfigReferenceDepth "8"^^xsd:nonNegativeInteger ;
  sfcfg:hasConfigLayer [
    a sfcfg:ConfigLayer ;
    sfcfg:hasConfigLayerRole sfcfg:configLayerRole_builtInDefaults ;
    sfcfg:layerOrder "10"^^xsd:nonNegativeInteger
  ] .
`;
