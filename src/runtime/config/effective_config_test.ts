import { assertEquals, assertThrows } from "@std/assert";
import {
  ALL_PANELS_RESOURCE_PAGE_PRESENTATION_PROFILE,
  compileWeaveEffectiveConfig,
  DEFAULT_RESOURCE_PAGE_PRESENTATION_PROFILE,
  EffectiveConfigError,
  loadWeaveDefaultEffectiveConfig,
  NO_PANELS_RESOURCE_PAGE_PRESENTATION_PROFILE,
  parseWeaveDefaultEffectiveConfig,
  WEAVE_DEFAULTS_NAMESPACE,
} from "./effective_config.ts";

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
      "meshLocal",
      "meshInheritable",
      "knopInherited",
      "knopLocal",
      "knopInheritable",
      "commandOverride",
    ],
  );
});

Deno.test("loadWeaveDefaultEffectiveConfig parses built-in ResourcePage presentation policies", async () => {
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
    ],
  );
  assertEquals(
    ALL_PANELS_RESOURCE_PAGE_PRESENTATION_PROFILE.panelSelections.at(-1)
      ?.panel,
    "semanticFlowMetadata",
  );
  assertEquals(
    NO_PANELS_RESOURCE_PAGE_PRESENTATION_PROFILE.panelSelections,
    [],
  );
});

Deno.test("loadWeaveDefaultEffectiveConfig parses naming and regeneration defaults", async () => {
  const config = await loadWeaveDefaultEffectiveConfig();

  assertEquals(config.namingPolicies, {
    historyNamingPolicy: "ordinal",
    stateNamingPolicy: "ordinal",
    manifestationNamingPolicy: "filenameDerived",
  });
  assertEquals(
    config.resourcePageRegenerationConfigPolicy,
    "configAtTheTime",
  );
});

Deno.test("compileWeaveEffectiveConfig applies mesh-local any-governed-artifact overrides", () => {
  const config = compileWeaveEffectiveConfig({
    applicationTurtle: VALID_APPLICATION_WITH_PRESENTATION_TURTLE,
    configResolutionTurtle: VALID_CONFIG_RESOLUTION_TURTLE,
    meshConfigTurtle:
      `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:hasPolicyBinding <#history-current-only>, <#pages-suppress>, <#presentation-no-panels> .

<#history-current-only> a sfcfg:PolicyBinding ;
  sfcfg:bindsPolicy <#current-only> ;
  sfcfg:appliesToPolicyTarget <#any> .

<#current-only> a sfcfg:PolicyDefinition ;
  sfcfg:hasHistoryTrackingPolicy sfcfg:historyTrackingPolicy_currentOnly .

<#pages-suppress> a sfcfg:PolicyBinding ;
  sfcfg:bindsPolicy <#suppress> ;
  sfcfg:appliesToPolicyTarget <#any> .

<#suppress> a sfcfg:PolicyDefinition ;
  sfcfg:hasResourcePageGenerationPolicy sfcfg:resourcePageGenerationPolicy_suppress .

<#presentation-no-panels> a sfcfg:PolicyBinding ;
  sfcfg:bindsPolicy <#no-panels> ;
  sfcfg:appliesToPolicyTarget <#any> .

<#no-panels> a sfcfg:PolicyDefinition ;
  sfcfg:hasResourcePagePresentationPolicy <${WEAVE_DEFAULTS_NAMESPACE}resource-page-presentation/semantic-site-no-panels> .

<#any> a sfcfg:AnyGovernedArtifactPolicyTarget .
`,
  });

  assertEquals(
    config.historyTrackingPolicyForArtifactRole("payload"),
    "currentOnly",
  );
  assertEquals(
    config.resourcePageGenerationPolicyForArtifactRole("payload"),
    "suppress",
  );
  assertEquals(
    config.resourcePagePresentation.identity,
    "semanticSiteNoPanels",
  );
});

Deno.test("compileWeaveEffectiveConfig lets same-layer artifact-role specificity beat broad targets", () => {
  const config = compileWeaveEffectiveConfig({
    applicationTurtle: VALID_APPLICATION_WITH_PRESENTATION_TURTLE,
    configResolutionTurtle: VALID_CONFIG_RESOLUTION_TURTLE,
    meshConfigTurtle:
      `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:hasPolicyBinding <#any-current-only>, <#payload-versioned> .

<#any-current-only> a sfcfg:PolicyBinding ;
  sfcfg:bindsPolicy <#current-only> ;
  sfcfg:appliesToPolicyTarget <#any> .

<#payload-versioned> a sfcfg:PolicyBinding ;
  sfcfg:bindsPolicy <#versioned> ;
  sfcfg:appliesToPolicyTarget <#payload> .

<#current-only> a sfcfg:PolicyDefinition ;
  sfcfg:hasHistoryTrackingPolicy sfcfg:historyTrackingPolicy_currentOnly .

<#versioned> a sfcfg:PolicyDefinition ;
  sfcfg:hasHistoryTrackingPolicy sfcfg:historyTrackingPolicy_versioned .

<#any> a sfcfg:AnyGovernedArtifactPolicyTarget .

<#payload> a sfcfg:ArtifactRolePolicyTarget ;
  sfcfg:hasArtifactRole sfcfg:artifactRole_payload .
`,
  });

  assertEquals(
    config.historyTrackingPolicyForArtifactRole("payload"),
    "versioned",
  );
  assertEquals(
    config.historyTrackingPolicyForArtifactRole("config"),
    "currentOnly",
  );
});

Deno.test("compileWeaveEffectiveConfig applies command overrides above mesh config", () => {
  const config = compileWeaveEffectiveConfig({
    applicationTurtle: VALID_APPLICATION_WITH_PRESENTATION_TURTLE,
    configResolutionTurtle: VALID_CONFIG_RESOLUTION_TURTLE,
    meshConfigTurtle:
      `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:hasPolicyBinding <#payload-current-only> .

<#payload-current-only> a sfcfg:PolicyBinding ;
  sfcfg:bindsPolicy <#current-only> ;
  sfcfg:appliesToPolicyTarget <#payload> .

<#current-only> a sfcfg:PolicyDefinition ;
  sfcfg:hasHistoryTrackingPolicy sfcfg:historyTrackingPolicy_currentOnly .

<#payload> a sfcfg:ArtifactRolePolicyTarget ;
  sfcfg:hasArtifactRole sfcfg:artifactRole_payload .
`,
    commandOverrides: {
      historyTrackingPolicy: "versioned",
      resourcePagePresentation: "semanticSiteAllPanels",
    },
  });

  assertEquals(
    config.historyTrackingPolicyForArtifactRole("payload"),
    "versioned",
  );
  assertEquals(
    config.resourcePagePresentation.identity,
    "semanticSiteAllPanels",
  );
});

Deno.test("compileWeaveEffectiveConfig uses priority only for same-specificity conflicts", () => {
  const config = compileWeaveEffectiveConfig({
    applicationTurtle: VALID_APPLICATION_WITH_PRESENTATION_TURTLE,
    configResolutionTurtle: VALID_CONFIG_RESOLUTION_TURTLE,
    meshConfigTurtle:
      `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<> a sfcfg:MeshConfig ;
  sfcfg:hasPolicyBinding <#low>, <#high> .

<#low> a sfcfg:PolicyBinding ;
  sfcfg:bindsPolicy <#current-only> ;
  sfcfg:appliesToPolicyTarget <#payload> ;
  sfcfg:policyPriority "1"^^xsd:integer .

<#high> a sfcfg:PolicyBinding ;
  sfcfg:bindsPolicy <#versioned> ;
  sfcfg:appliesToPolicyTarget <#payload> ;
  sfcfg:policyPriority "2"^^xsd:integer .

<#current-only> a sfcfg:PolicyDefinition ;
  sfcfg:hasHistoryTrackingPolicy sfcfg:historyTrackingPolicy_currentOnly .

<#versioned> a sfcfg:PolicyDefinition ;
  sfcfg:hasHistoryTrackingPolicy sfcfg:historyTrackingPolicy_versioned .

<#payload> a sfcfg:ArtifactRolePolicyTarget ;
  sfcfg:hasArtifactRole sfcfg:artifactRole_payload .
`,
  });

  assertEquals(
    config.historyTrackingPolicyForArtifactRole("payload"),
    "versioned",
  );
});

Deno.test("compileWeaveEffectiveConfig fails closed on unresolved same-layer conflicts", () => {
  assertThrows(
    () =>
      compileWeaveEffectiveConfig({
        applicationTurtle: VALID_APPLICATION_WITH_PRESENTATION_TURTLE,
        configResolutionTurtle: VALID_CONFIG_RESOLUTION_TURTLE,
        meshConfigTurtle:
          `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:hasPolicyBinding <#left>, <#right> .

<#left> a sfcfg:PolicyBinding ;
  sfcfg:bindsPolicy <#current-only> ;
  sfcfg:appliesToPolicyTarget <#payload> .

<#right> a sfcfg:PolicyBinding ;
  sfcfg:bindsPolicy <#versioned> ;
  sfcfg:appliesToPolicyTarget <#payload> .

<#current-only> a sfcfg:PolicyDefinition ;
  sfcfg:hasHistoryTrackingPolicy sfcfg:historyTrackingPolicy_currentOnly .

<#versioned> a sfcfg:PolicyDefinition ;
  sfcfg:hasHistoryTrackingPolicy sfcfg:historyTrackingPolicy_versioned .

<#payload> a sfcfg:ArtifactRolePolicyTarget ;
  sfcfg:hasArtifactRole sfcfg:artifactRole_payload .
`,
      }).historyTrackingPolicyForArtifactRole("payload"),
    EffectiveConfigError,
    "Conflicting",
  );
});

Deno.test("parseWeaveDefaultEffectiveConfig rejects retired direct policy predicates", () => {
  assertThrows(
    () =>
      parseWeaveDefaultEffectiveConfig(
        withValidResourcePagePresentation(
          `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:ApplicationConfig ;
  sfcfg:hasDefaultHistoryTrackingPolicy sfcfg:historyTrackingPolicy_currentOnly ;
  sfcfg:hasResourcePageRegenerationConfigPolicy sfcfg:resourcePageRegenerationConfigPolicy_configAtTheTime ;
  sfcfg:hasHistoryNamingPolicy sfcfg:historyNamingPolicy_ordinal ;
  sfcfg:hasStateNamingPolicy sfcfg:stateNamingPolicy_ordinal ;
  sfcfg:hasManifestationNamingPolicy sfcfg:manifestationNamingPolicy_filenameDerived .
`,
        ),
        VALID_CONFIG_RESOLUTION_TURTLE,
      ),
    EffectiveConfigError,
    "Retired direct policy predicate",
  );
});

Deno.test("parseWeaveDefaultEffectiveConfig rejects unknown policy values", () => {
  assertThrows(
    () =>
      parseWeaveDefaultEffectiveConfig(
        withValidResourcePagePresentation(
          `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:ApplicationConfig ;
  sfcfg:hasPolicyBinding <#bad> ;
  sfcfg:hasResourcePageRegenerationConfigPolicy sfcfg:resourcePageRegenerationConfigPolicy_configAtTheTime ;
  sfcfg:hasHistoryNamingPolicy sfcfg:historyNamingPolicy_ordinal ;
  sfcfg:hasStateNamingPolicy sfcfg:stateNamingPolicy_ordinal ;
  sfcfg:hasManifestationNamingPolicy sfcfg:manifestationNamingPolicy_filenameDerived .

<#bad> a sfcfg:PolicyBinding ;
  sfcfg:bindsPolicy <#policy> ;
  sfcfg:appliesToPolicyTarget <#any> .

<#policy> a sfcfg:PolicyDefinition ;
  sfcfg:hasHistoryTrackingPolicy sfcfg:historyTrackingPolicy_surprise .

<#any> a sfcfg:AnyGovernedArtifactPolicyTarget .
`,
        ),
        VALID_CONFIG_RESOLUTION_TURTLE,
      ),
    EffectiveConfigError,
    "Unsupported",
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
  sfcfg:hasPolicyBinding <#history-current-only>, <#pages-generate>, <#presentation-default> ;
  sfcfg:hasResourcePageRegenerationConfigPolicy sfcfg:resourcePageRegenerationConfigPolicy_configAtTheTime ;
  sfcfg:hasHistoryNamingPolicy sfcfg:historyNamingPolicy_ordinal ;
  sfcfg:hasStateNamingPolicy sfcfg:stateNamingPolicy_ordinal ;
  sfcfg:hasManifestationNamingPolicy sfcfg:manifestationNamingPolicy_filenameDerived .

<#history-current-only> a sfcfg:PolicyBinding ;
  sfcfg:bindsPolicy <#current-only> ;
  sfcfg:appliesToPolicyTarget <#any> .

<#pages-generate> a sfcfg:PolicyBinding ;
  sfcfg:bindsPolicy <#generate> ;
  sfcfg:appliesToPolicyTarget <#any> .

<#presentation-default> a sfcfg:PolicyBinding ;
  sfcfg:bindsPolicy <#default-presentation> ;
  sfcfg:appliesToPolicyTarget <#any> .

<#current-only> a sfcfg:PolicyDefinition ;
  sfcfg:hasHistoryTrackingPolicy sfcfg:historyTrackingPolicy_currentOnly .

<#generate> a sfcfg:PolicyDefinition ;
  sfcfg:hasResourcePageGenerationPolicy sfcfg:resourcePageGenerationPolicy_generate .

<#default-presentation> a sfcfg:PolicyDefinition ;
  sfcfg:hasResourcePagePresentationPolicy <${WEAVE_DEFAULTS_NAMESPACE}resource-page-presentation/semantic-site-default> .

<#any> a sfcfg:AnyGovernedArtifactPolicyTarget .
`;

const VALID_APPLICATION_WITH_PRESENTATION_TURTLE =
  withValidResourcePagePresentation(VALID_APPLICATION_TURTLE);

function withValidResourcePagePresentation(applicationTurtle: string): string {
  return `${applicationTurtle.trimEnd()}

<${WEAVE_DEFAULTS_NAMESPACE}resource-page-presentation/semantic-site-default> a sfcfg:ResourcePagePresentationPolicy ;
  sfcfg:hasOuterResourcePageTemplate <${WEAVE_DEFAULTS_NAMESPACE}resource-page-template/semantic-site/outer> ;
  sfcfg:hasInnerResourcePageTemplate <${WEAVE_DEFAULTS_NAMESPACE}resource-page-template/semantic-site/inner> ;
  sfcfg:hasResourcePageStylesheet <${WEAVE_DEFAULTS_NAMESPACE}default-stylesheet> ;
  sfcfg:hasResourcePagePanelSelection <${WEAVE_DEFAULTS_NAMESPACE}resource-page-presentation/semantic-site-default#children-panel> .

<${WEAVE_DEFAULTS_NAMESPACE}resource-page-presentation/semantic-site-all-panels> a sfcfg:ResourcePagePresentationPolicy ;
  sfcfg:hasOuterResourcePageTemplate <${WEAVE_DEFAULTS_NAMESPACE}resource-page-template/semantic-site/outer> ;
  sfcfg:hasInnerResourcePageTemplate <${WEAVE_DEFAULTS_NAMESPACE}resource-page-template/semantic-site/inner> ;
  sfcfg:hasResourcePageStylesheet <${WEAVE_DEFAULTS_NAMESPACE}default-stylesheet> ;
  sfcfg:hasResourcePagePanelSelection <${WEAVE_DEFAULTS_NAMESPACE}resource-page-presentation/semantic-site-default#children-panel>, <${WEAVE_DEFAULTS_NAMESPACE}resource-page-presentation/semantic-site-all-panels#semantic-flow-metadata-panel> .

<${WEAVE_DEFAULTS_NAMESPACE}resource-page-presentation/semantic-site-no-panels> a sfcfg:ResourcePagePresentationPolicy ;
  sfcfg:hasOuterResourcePageTemplate <${WEAVE_DEFAULTS_NAMESPACE}resource-page-template/semantic-site/outer> ;
  sfcfg:hasInnerResourcePageTemplate <${WEAVE_DEFAULTS_NAMESPACE}resource-page-template/semantic-site/inner> ;
  sfcfg:hasResourcePageStylesheet <${WEAVE_DEFAULTS_NAMESPACE}default-stylesheet> .

<${WEAVE_DEFAULTS_NAMESPACE}resource-page-presentation/semantic-site-default#children-panel> a sfcfg:ResourcePagePanelSelection ;
  sfcfg:hasResourcePagePanel <${WEAVE_DEFAULTS_NAMESPACE}resource-page-panel/children> ;
  sfcfg:panelOrder "10"^^<http://www.w3.org/2001/XMLSchema#nonNegativeInteger> ;
  sfcfg:hasPanelInclusionPolicy sfcfg:panelInclusionPolicy_auto ;
  sfcfg:hasPanelTargetPageKind sfcfg:resourcePageKind_identifier ;
  sfcfg:hasPanelDataRequirement sfcfg:panelDataRequirement_children .

<${WEAVE_DEFAULTS_NAMESPACE}resource-page-presentation/semantic-site-all-panels#semantic-flow-metadata-panel> a sfcfg:ResourcePagePanelSelection ;
  sfcfg:hasResourcePagePanel <${WEAVE_DEFAULTS_NAMESPACE}resource-page-panel/semantic-flow-metadata> ;
  sfcfg:panelOrder "80"^^<http://www.w3.org/2001/XMLSchema#nonNegativeInteger> ;
  sfcfg:hasPanelInclusionPolicy sfcfg:panelInclusionPolicy_auto ;
  sfcfg:hasPanelTargetPageKind sfcfg:resourcePageKind_identifier ;
  sfcfg:hasPanelDataRequirement sfcfg:panelDataRequirement_semanticFlowMetadata .
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
    sfcfg:hasConfigLayerRole sfcfg:configLayerRole_weaveDefaults ;
    sfcfg:layerOrder "20"^^xsd:nonNegativeInteger
  ], [
    a sfcfg:ConfigLayer ;
    sfcfg:hasConfigLayerRole sfcfg:configLayerRole_meshLocal ;
    sfcfg:layerOrder "50"^^xsd:nonNegativeInteger
  ], [
    a sfcfg:ConfigLayer ;
    sfcfg:hasConfigLayerRole sfcfg:configLayerRole_commandOverride ;
    sfcfg:layerOrder "90"^^xsd:nonNegativeInteger
  ] .
`;
