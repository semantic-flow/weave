import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
import { dirname, join } from "@std/path";
import { toKnopPath } from "../../core/designator_segments.ts";
import type { OperationalLocalPathPolicy } from "../operational/local_path_policy.ts";
import {
  ALL_PANELS_RESOURCE_PAGE_PRESENTATION_PROFILE,
  compileWeaveEffectiveConfig,
  DEFAULT_RESOURCE_PAGE_PRESENTATION_PROFILE,
  EffectiveConfigError,
  loadWeaveDefaultEffectiveConfig,
  loadWeaveEffectiveConfig,
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

Deno.test("compileWeaveEffectiveConfig parses mesh scoped settings", () => {
  const config = compileWeaveEffectiveConfig({
    applicationTurtle: VALID_APPLICATION_WITH_PRESENTATION_TURTLE,
    configResolutionTurtle: VALID_CONFIG_RESOLUTION_TURTLE,
    meshConfigTurtle:
      `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:workspaceRootRelativeToMeshRoot "../" ;
  sfcfg:hasPublicationProfile sfcfg:publicationProfile_githubPages .
`,
  });

  assertEquals(config.scopedSettings.mesh, {
    publicationProfile: "githubPages",
    workspaceRootRelativeToMeshRoot: "../",
  });
});

Deno.test("compileWeaveEffectiveConfig lets mesh-local scoped settings override application defaults", () => {
  const config = compileWeaveEffectiveConfig({
    applicationTurtle: VALID_APPLICATION_WITH_PRESENTATION_TURTLE,
    configResolutionTurtle: VALID_CONFIG_RESOLUTION_TURTLE,
    meshConfigTurtle:
      `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:hasResourcePageRegenerationConfigPolicy sfcfg:resourcePageRegenerationConfigPolicy_currentFullConfig ;
  sfcfg:hasHistoryNamingPolicy sfcfg:historyNamingPolicy_named ;
  sfcfg:hasStateNamingPolicy sfcfg:stateNamingPolicy_semver ;
  sfcfg:hasManifestationNamingPolicy sfcfg:manifestationNamingPolicy_ordinal .
`,
  });

  assertEquals(config.namingPolicies, {
    historyNamingPolicy: "named",
    stateNamingPolicy: "semver",
    manifestationNamingPolicy: "ordinal",
  });
  assertEquals(
    config.resourcePageRegenerationConfigPolicy,
    "currentFullConfig",
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

Deno.test("loadWeaveEffectiveConfig resolves mesh-local config sources as mesh-local policy", async () => {
  const { meshRoot, localPathPolicy } = await createConfigSourceTestContext();
  await writeMeshConfigSource(
    meshRoot,
    "_mesh/_config/source.ttl",
    currentOnlyPayloadPolicyConfigTurtle(),
  );

  const config = await loadWeaveEffectiveConfig({
    meshRoot,
    meshBase: MESH_BASE,
    localPathPolicy,
    meshConfigTurtle: meshConfigAttachingLocalSource(
      "_mesh/_config/source.ttl",
    ),
    meshConfigSource: "_mesh/_config/config.ttl",
    commandOverrides: {
      resourcePagePresentation: "semanticSiteAllPanels",
    },
  });

  assertEquals(
    config.historyTrackingPolicyForArtifactRole("payload"),
    "currentOnly",
  );
  assertEquals(
    config.resourcePagePresentation.identity,
    "semanticSiteAllPanels",
  );
  assertEquals(config.sources.meshConfigSources?.length, 2);
  const sourceTrace = config.resolutionTrace.find((entry) =>
    "kind" in entry && entry.kind === "configSource"
  );
  assert(sourceTrace && "status" in sourceTrace);
  assertEquals(sourceTrace.status, "accepted");
  assertEquals(
    sourceTrace.resolvedLocalRelativePath,
    "_mesh/_config/source.ttl",
  );
});

Deno.test("loadWeaveEffectiveConfig chains mesh-local config sources", async () => {
  const { meshRoot, localPathPolicy } = await createConfigSourceTestContext();
  await writeMeshConfigSource(
    meshRoot,
    "_mesh/_config/source-a.ttl",
    `@base <${MESH_BASE}> .
@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<> a sfcfg:MeshConfig ;
  sfcfg:hasPublicationProfile sfcfg:publicationProfile_githubPages .

<_mesh> a sflo:SemanticMesh ;
  sfcfg:hasConfigSource [
    a sfcfg:ConfigSource ;
    sflo:targetLocalRelativePath "_mesh/_config/source-b.ttl"
  ] .
`,
  );
  await writeMeshConfigSource(
    meshRoot,
    "_mesh/_config/source-b.ttl",
    `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:hasPublicationProfile sfcfg:publicationProfile_none .
`,
  );

  const config = await loadWeaveEffectiveConfig({
    meshRoot,
    meshBase: MESH_BASE,
    localPathPolicy,
    meshConfigTurtle: meshConfigAttachingLocalSource(
      "_mesh/_config/source-a.ttl",
    ),
    meshConfigSource: "_mesh/_config/config.ttl",
  });

  assertEquals(
    config.scopedSettings.mesh.publicationProfile,
    "githubPages",
  );
  assertEquals(config.sources.meshConfigSources?.length, 3);
});

Deno.test("loadWeaveEffectiveConfig lets earlier chained policy sources beat later sources", async () => {
  const { meshRoot, localPathPolicy } = await createConfigSourceTestContext();
  await writeMeshConfigSource(
    meshRoot,
    "_mesh/_config/source-a.ttl",
    `@base <${MESH_BASE}> .
@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

${currentOnlyPayloadPolicyConfigTurtle().trimEnd()}

<_mesh> a sflo:SemanticMesh ;
  sfcfg:hasConfigSource [
    a sfcfg:ConfigSource ;
    sflo:targetLocalRelativePath "_mesh/_config/source-b.ttl"
  ] .
`,
  );
  await writeMeshConfigSource(
    meshRoot,
    "_mesh/_config/source-b.ttl",
    `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:hasPolicyBinding <#payload-versioned> .

<#payload-versioned> a sfcfg:PolicyBinding ;
  sfcfg:bindsPolicy <#versioned> ;
  sfcfg:appliesToPolicyTarget <#payload> .

<#versioned> a sfcfg:PolicyDefinition ;
  sfcfg:hasHistoryTrackingPolicy sfcfg:historyTrackingPolicy_versioned .

<#payload> a sfcfg:ArtifactRolePolicyTarget ;
  sfcfg:hasArtifactRole sfcfg:artifactRole_payload .
`,
  );

  const config = await loadWeaveEffectiveConfig({
    meshRoot,
    meshBase: MESH_BASE,
    localPathPolicy,
    meshConfigTurtle: meshConfigAttachingLocalSource(
      "_mesh/_config/source-a.ttl",
    ),
    meshConfigSource: "_mesh/_config/config.ttl",
  });

  assertEquals(
    config.historyTrackingPolicyForArtifactRole("payload"),
    "currentOnly",
  );
});

Deno.test("loadWeaveEffectiveConfig discovers mesh-local config sources from mesh metadata", async () => {
  const { meshRoot, localPathPolicy } = await createConfigSourceTestContext();
  await writeMeshConfigSource(
    meshRoot,
    "_mesh/_config/source.ttl",
    `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:hasPublicationProfile sfcfg:publicationProfile_githubPages .
`,
  );

  const config = await loadWeaveEffectiveConfig({
    meshRoot,
    meshBase: MESH_BASE,
    localPathPolicy,
    meshMetadataTurtle: meshMetadataAttachingLocalSource(
      "_mesh/_config/source.ttl",
    ),
    meshMetadataSource: "_mesh/_meta/meta.ttl",
  });

  assertEquals(
    config.scopedSettings.mesh.publicationProfile,
    "githubPages",
  );
  assertEquals(config.sources.meshConfigSources?.length, 1);
});

Deno.test("loadWeaveEffectiveConfig rejects unsupported config-source attachment subjects", async () => {
  const { meshRoot, localPathPolicy } = await createConfigSourceTestContext();

  await assertRejects(
    () =>
      loadWeaveEffectiveConfig({
        meshRoot,
        meshBase: MESH_BASE,
        localPathPolicy,
        meshConfigTurtle: `@base <${MESH_BASE}> .
@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<> a sfcfg:MeshConfig .

<#stray> sfcfg:hasConfigSource [
  a sfcfg:ConfigSource ;
  sflo:targetLocalRelativePath "_mesh/_config/source.ttl"
] .
`,
      }),
    EffectiveConfigError,
    "supported only on the active SemanticMesh",
  );

  await assertRejects(
    () =>
      loadWeaveEffectiveConfig({
        meshRoot,
        meshBase: MESH_BASE,
        localPathPolicy,
        meshConfigTurtle: `@base <${MESH_BASE}> .
@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<> a sfcfg:MeshConfig .

<alice/_knop> a sflo:Knop ;
  sfcfg:hasConfigSource [
    a sfcfg:ConfigSource ;
    sflo:targetLocalRelativePath "_mesh/_config/source.ttl"
  ] .
`,
      }),
    EffectiveConfigError,
    "supported only by Knop metadata discovery",
  );
});

Deno.test("loadWeaveEffectiveConfig rejects unsupported inheritable config sources", async () => {
  const { meshRoot, localPathPolicy } = await createConfigSourceTestContext();

  await assertRejects(
    () =>
      loadWeaveEffectiveConfig({
        meshRoot,
        meshBase: MESH_BASE,
        localPathPolicy,
        meshConfigTurtle: `@base <${MESH_BASE}> .
@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<> a sfcfg:MeshConfig .

<_mesh> a sflo:SemanticMesh ;
  sfcfg:hasInheritableConfigSource [
    a sfcfg:ConfigSource ;
    sflo:targetLocalRelativePath "_mesh/_config/source.ttl"
  ] .
`,
      }),
    EffectiveConfigError,
    "hasInheritableConfigSource",
  );
});

Deno.test("loadWeaveEffectiveConfig rejects cyclic mesh-local config sources", async () => {
  const { meshRoot, localPathPolicy } = await createConfigSourceTestContext();
  await writeMeshConfigSource(
    meshRoot,
    "_mesh/_config/source-a.ttl",
    configSourceForwarderTurtle("_mesh/_config/source-b.ttl"),
  );
  await writeMeshConfigSource(
    meshRoot,
    "_mesh/_config/source-b.ttl",
    configSourceForwarderTurtle("_mesh/_config/source-a.ttl"),
  );

  await assertRejects(
    () =>
      loadWeaveEffectiveConfig({
        meshRoot,
        meshBase: MESH_BASE,
        localPathPolicy,
        meshConfigTurtle: meshConfigAttachingLocalSource(
          "_mesh/_config/source-a.ttl",
        ),
      }),
    EffectiveConfigError,
    "Cyclic mesh-local config-source reference",
  );
});

Deno.test("loadWeaveEffectiveConfig rejects unsafe config-source coordinates", async () => {
  const { meshRoot, localPathPolicy } = await createConfigSourceTestContext();
  await writeMeshConfigSource(
    meshRoot,
    "_mesh/_config/source.ttl",
    currentOnlyPayloadPolicyConfigTurtle(),
  );

  await assertRejects(
    () =>
      loadWeaveEffectiveConfig({
        meshRoot,
        meshBase: MESH_BASE,
        localPathPolicy,
        meshConfigTurtle: meshConfigAttachingLocalSource(
          "_mesh/_config/source.ttl",
          'sflo:expectsContentDigest "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"',
        ),
      }),
    EffectiveConfigError,
    "digest mismatch",
  );

  await assertRejects(
    () =>
      loadWeaveEffectiveConfig({
        meshRoot,
        meshBase: MESH_BASE,
        localPathPolicy,
        meshConfigTurtle: meshConfigAttachingSourceSpec(
          'sflo:targetAccessUrl "https://example.invalid/config.ttl"',
        ),
      }),
    EffectiveConfigError,
    "does not fetch",
  );

  await assertRejects(
    () =>
      loadWeaveEffectiveConfig({
        meshRoot,
        meshBase: MESH_BASE,
        localPathPolicy,
        meshConfigTurtle: meshConfigAttachingLocalSource("../source.ttl"),
      }),
    EffectiveConfigError,
    "outside the allowed local-path boundary",
  );
});

Deno.test("loadWeaveEffectiveConfig resolves target Knop-local config sources", async () => {
  const { meshRoot, localPathPolicy } = await createConfigSourceTestContext();
  await writeMeshConfigSource(
    meshRoot,
    "alice/_knop/_config/local.ttl",
    payloadHistoryPolicyConfigTurtle("historyTrackingPolicy_currentOnly"),
  );

  const config = await loadWeaveEffectiveConfig({
    meshRoot,
    meshBase: MESH_BASE,
    localPathPolicy,
    knopConfigScopePath: [{
      scopeKey: "alice",
      turtle: knopMetadataAttachingLocalSource(
        "alice",
        "hasConfigSource",
        "alice/_knop/_config/local.ttl",
      ),
    }],
  });

  assertEquals(
    config.historyTrackingPolicyForArtifactRole("payload"),
    "currentOnly",
  );
  assertEquals(config.sources.knopConfigSources?.length, 1);
  const sourceTrace = config.resolutionTrace.find((entry) =>
    "kind" in entry && entry.kind === "configSource" &&
    entry.layerRole === "knopLocal"
  );
  assert(sourceTrace && "status" in sourceTrace);
  assertEquals(sourceTrace.status, "accepted");
  assertEquals(sourceTrace.authoredScopeKey, "alice");
  assertEquals(
    sourceTrace.resolvedLocalRelativePath,
    "alice/_knop/_config/local.ttl",
  );
});

Deno.test("loadWeaveEffectiveConfig projects ancestor inheritable Knop config sources", async () => {
  const { meshRoot, localPathPolicy } = await createConfigSourceTestContext();
  await writeMeshConfigSource(
    meshRoot,
    "alice/_knop/_config/inherited.ttl",
    payloadHistoryPolicyConfigTurtle("historyTrackingPolicy_currentOnly"),
  );

  const config = await loadWeaveEffectiveConfig({
    meshRoot,
    meshBase: MESH_BASE,
    localPathPolicy,
    knopConfigScopePath: [
      {
        scopeKey: "alice",
        turtle: knopMetadataAttachingLocalSource(
          "alice",
          "hasInheritableConfigSource",
          "alice/_knop/_config/inherited.ttl",
        ),
      },
      {
        scopeKey: "alice/data",
        turtle: bareKnopMetadata("alice/data"),
      },
    ],
  });

  assertEquals(
    config.historyTrackingPolicyForArtifactRole("payload"),
    "currentOnly",
  );
  const sourceTrace = config.resolutionTrace.find((entry) =>
    "kind" in entry && entry.kind === "configSource" &&
    entry.layerRole === "knopInherited"
  );
  assert(sourceTrace && "status" in sourceTrace);
  assertEquals(sourceTrace.offeredByScopeKey, "alice");
  assertEquals(sourceTrace.projectedToScopeKey, "alice/data");
  assertEquals(sourceTrace.projection, "ancestorInherited");
});

Deno.test("loadWeaveEffectiveConfig keeps descendant-only inherited Knop config off the authoring Knop", async () => {
  const { meshRoot, localPathPolicy } = await createConfigSourceTestContext();
  await writeMeshConfigSource(
    meshRoot,
    "alice/_knop/_config/inherited.ttl",
    payloadHistoryPolicyConfigTurtle("historyTrackingPolicy_currentOnly"),
  );

  const config = await loadWeaveEffectiveConfig({
    meshRoot,
    meshBase: MESH_BASE,
    localPathPolicy,
    knopConfigScopePath: [{
      scopeKey: "alice",
      turtle: knopMetadataAttachingLocalSource(
        "alice",
        "hasInheritableConfigSource",
        "alice/_knop/_config/inherited.ttl",
      ),
    }],
  });

  assertEquals(
    config.historyTrackingPolicyForArtifactRole("payload"),
    "versioned",
  );
  assertEquals(config.sources.knopConfigSources, undefined);
});

Deno.test("loadWeaveEffectiveConfig lets nearer inherited Knop config beat farther inherited config", async () => {
  const { meshRoot, localPathPolicy } = await createConfigSourceTestContext();
  await writeMeshConfigSource(
    meshRoot,
    "alice/_knop/_config/far.ttl",
    payloadHistoryPolicyConfigTurtle("historyTrackingPolicy_currentOnly"),
  );
  await writeMeshConfigSource(
    meshRoot,
    "alice/data/_knop/_config/near.ttl",
    payloadHistoryPolicyConfigTurtle("historyTrackingPolicy_required"),
  );

  const config = await loadWeaveEffectiveConfig({
    meshRoot,
    meshBase: MESH_BASE,
    localPathPolicy,
    knopConfigScopePath: [
      {
        scopeKey: "alice",
        turtle: knopMetadataAttachingLocalSource(
          "alice",
          "hasInheritableConfigSource",
          "alice/_knop/_config/far.ttl",
        ),
      },
      {
        scopeKey: "alice/data",
        turtle: knopMetadataAttachingLocalSource(
          "alice/data",
          "hasInheritableConfigSource",
          "alice/data/_knop/_config/near.ttl",
        ),
      },
      {
        scopeKey: "alice/data/summary",
        turtle: bareKnopMetadata("alice/data/summary"),
      },
    ],
  });

  assertEquals(
    config.historyTrackingPolicyForArtifactRole("payload"),
    "required",
  );
});

Deno.test("loadWeaveEffectiveConfig lets target Knop-local config beat inherited Knop config", async () => {
  const { meshRoot, localPathPolicy } = await createConfigSourceTestContext();
  await writeMeshConfigSource(
    meshRoot,
    "alice/_knop/_config/inherited.ttl",
    payloadHistoryPolicyConfigTurtle("historyTrackingPolicy_currentOnly"),
  );
  await writeMeshConfigSource(
    meshRoot,
    "alice/data/_knop/_config/local.ttl",
    payloadHistoryPolicyConfigTurtle("historyTrackingPolicy_required"),
  );

  const config = await loadWeaveEffectiveConfig({
    meshRoot,
    meshBase: MESH_BASE,
    localPathPolicy,
    knopConfigScopePath: [
      {
        scopeKey: "alice",
        turtle: knopMetadataAttachingLocalSource(
          "alice",
          "hasInheritableConfigSource",
          "alice/_knop/_config/inherited.ttl",
        ),
      },
      {
        scopeKey: "alice/data",
        turtle: knopMetadataAttachingLocalSource(
          "alice/data",
          "hasConfigSource",
          "alice/data/_knop/_config/local.ttl",
        ),
      },
    ],
  });

  assertEquals(
    config.historyTrackingPolicyForArtifactRole("payload"),
    "required",
  );
});

Deno.test("loadWeaveEffectiveConfig lets command overrides beat Knop-local config", async () => {
  const { meshRoot, localPathPolicy } = await createConfigSourceTestContext();
  await writeMeshConfigSource(
    meshRoot,
    "alice/_knop/_config/local.ttl",
    payloadHistoryPolicyConfigTurtle("historyTrackingPolicy_currentOnly"),
  );

  const config = await loadWeaveEffectiveConfig({
    meshRoot,
    meshBase: MESH_BASE,
    localPathPolicy,
    knopConfigScopePath: [{
      scopeKey: "alice",
      turtle: knopMetadataAttachingLocalSource(
        "alice",
        "hasConfigSource",
        "alice/_knop/_config/local.ttl",
      ),
    }],
    commandOverrides: {
      historyTrackingPolicy: "versioned",
    },
  });

  assertEquals(
    config.historyTrackingPolicyForArtifactRole("payload"),
    "versioned",
  );
});

Deno.test("loadWeaveEffectiveConfig rejects unsafe Knop config-source coordinates", async () => {
  const { meshRoot, localPathPolicy } = await createConfigSourceTestContext();
  await writeMeshConfigSource(
    meshRoot,
    "alice/_knop/_config/local.ttl",
    currentOnlyPayloadPolicyConfigTurtle(),
  );

  await assertRejects(
    () =>
      loadWeaveEffectiveConfig({
        meshRoot,
        meshBase: MESH_BASE,
        localPathPolicy,
        knopConfigScopePath: [{
          scopeKey: "alice",
          turtle: knopMetadataAttachingSourceSpec(
            "alice",
            "hasConfigSource",
            'sflo:targetAccessUrl "https://example.invalid/config.ttl"',
          ),
        }],
      }),
    EffectiveConfigError,
    "does not fetch",
  );

  await assertRejects(
    () =>
      loadWeaveEffectiveConfig({
        meshRoot,
        meshBase: MESH_BASE,
        localPathPolicy,
        knopConfigScopePath: [{
          scopeKey: "alice",
          turtle: knopMetadataAttachingLocalSource(
            "alice",
            "hasConfigSource",
            "../config.ttl",
          ),
        }],
      }),
    EffectiveConfigError,
    "outside the allowed local-path boundary",
  );

  await assertRejects(
    () =>
      loadWeaveEffectiveConfig({
        meshRoot,
        meshBase: MESH_BASE,
        localPathPolicy,
        knopConfigScopePath: [{
          scopeKey: "alice",
          turtle: knopMetadataAttachingSourceSpec(
            "alice",
            "hasConfigSource",
            [
              'sflo:targetLocalRelativePath "alice/_knop/_config/local.ttl"',
              'sflo:expectsContentDigest "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"',
            ].join(" ;\n    "),
          ),
        }],
      }),
    EffectiveConfigError,
    "digest mismatch",
  );

  await assertRejects(
    () =>
      loadWeaveEffectiveConfig({
        meshRoot,
        meshBase: MESH_BASE,
        localPathPolicy,
        knopConfigScopePath: [{
          scopeKey: "alice",
          turtle: `@base <${MESH_BASE}> .
@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<bob/_knop> a sflo:Knop ;
  sfcfg:hasConfigSource [
    a sfcfg:ConfigSource ;
    sflo:targetLocalRelativePath "alice/_knop/_config/local.ttl"
  ] .
`,
        }],
      }),
    EffectiveConfigError,
    "active Knop",
  );

  await assertRejects(
    () =>
      loadWeaveEffectiveConfig({
        meshRoot,
        meshBase: MESH_BASE,
        localPathPolicy,
        knopConfigScopePath: [{
          scopeKey: "alice",
          turtle: `@base <${MESH_BASE}> .
@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<alice/_knop> a sflo:Knop ;
  sfcfg:hasConfigSource [
    sflo:targetLocalRelativePath "alice/_knop/_config/local.ttl"
  ] .
`,
        }],
      }),
    EffectiveConfigError,
    "ConfigSource",
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

Deno.test("compileWeaveEffectiveConfig lets exact artifact specificity beat role and broad targets", () => {
  const config = compileWeaveEffectiveConfig({
    applicationTurtle: VALID_APPLICATION_WITH_PRESENTATION_TURTLE,
    configResolutionTurtle: VALID_CONFIG_RESOLUTION_TURTLE,
    meshBase: MESH_BASE,
    meshInventoryTurtle: GOVERNED_ARTIFACTS_INVENTORY_TURTLE,
    meshConfigTurtle: `@base <${MESH_BASE}> .
@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:hasPolicyBinding <#any-current-only>, <#payload-generate>, <#alice-exact> .

<#any-current-only> a sfcfg:PolicyBinding ;
  sfcfg:bindsPolicy <#current-only> ;
  sfcfg:appliesToPolicyTarget <#any> .

<#payload-generate> a sfcfg:PolicyBinding ;
  sfcfg:bindsPolicy <#generate> ;
  sfcfg:appliesToPolicyTarget <#payload> .

<#alice-exact> a sfcfg:PolicyBinding ;
  sfcfg:bindsPolicy <#alice-policy> ;
  sfcfg:appliesToPolicyTarget <#alice-target> .

<#current-only> a sfcfg:PolicyDefinition ;
  sfcfg:hasHistoryTrackingPolicy sfcfg:historyTrackingPolicy_currentOnly .

<#generate> a sfcfg:PolicyDefinition ;
  sfcfg:hasResourcePageGenerationPolicy sfcfg:resourcePageGenerationPolicy_generate .

<#alice-policy> a sfcfg:PolicyDefinition ;
  sfcfg:hasHistoryTrackingPolicy sfcfg:historyTrackingPolicy_versioned ;
  sfcfg:hasResourcePageGenerationPolicy sfcfg:resourcePageGenerationPolicy_suppress .

<#any> a sfcfg:AnyGovernedArtifactPolicyTarget .

<#payload> a sfcfg:ArtifactRolePolicyTarget ;
  sfcfg:hasArtifactRole sfcfg:artifactRole_payload .

<#alice-target> a sfcfg:ExactArtifactPolicyTarget ;
  sfcfg:targetsArtifact <alice/data> .
`,
  });

  assertEquals(
    config.artifactTargetPolicy({
      artifactIri: `${MESH_BASE}alice/data`,
      artifactRole: "payload",
    }),
    {
      historyTrackingPolicy: "versioned",
      resourcePageGenerationPolicy: "suppress",
    },
  );
  assertEquals(
    config.artifactTargetPolicy({
      artifactIri: `${MESH_BASE}bob/data`,
      artifactRole: "payload",
    }),
    {
      historyTrackingPolicy: "currentOnly",
      resourcePageGenerationPolicy: "generate",
    },
  );
  assertEquals(
    config.resourcePageGenerationPolicyForArtifactRole("payload"),
    "generate",
  );
});

Deno.test("compileWeaveEffectiveConfig rejects exact artifact targets without governance context", () => {
  assertThrows(
    () =>
      compileWeaveEffectiveConfig({
        applicationTurtle: VALID_APPLICATION_WITH_PRESENTATION_TURTLE,
        configResolutionTurtle: VALID_CONFIG_RESOLUTION_TURTLE,
        meshConfigTurtle: exactTargetMeshConfigTurtle("<alice/data>"),
      }),
    EffectiveConfigError,
    "requires governed artifact context",
  );
});

Deno.test("compileWeaveEffectiveConfig rejects exact artifact targets outside the governed mesh scope", () => {
  assertThrows(
    () =>
      compileWeaveEffectiveConfig({
        applicationTurtle: VALID_APPLICATION_WITH_PRESENTATION_TURTLE,
        configResolutionTurtle: VALID_CONFIG_RESOLUTION_TURTLE,
        meshBase: MESH_BASE,
        meshInventoryTurtle: GOVERNED_ARTIFACTS_INVENTORY_TURTLE,
        meshConfigTurtle: exactTargetMeshConfigTurtle(
          "<https://example.invalid/external>",
        ),
      }),
    EffectiveConfigError,
    "not governed by the active mesh scope",
  );
});

Deno.test("compileWeaveEffectiveConfig rejects malformed exact artifact targets", () => {
  assertThrows(
    () =>
      compileWeaveEffectiveConfig({
        applicationTurtle: VALID_APPLICATION_WITH_PRESENTATION_TURTLE,
        configResolutionTurtle: VALID_CONFIG_RESOLUTION_TURTLE,
        meshBase: MESH_BASE,
        meshInventoryTurtle: GOVERNED_ARTIFACTS_INVENTORY_TURTLE,
        meshConfigTurtle: `@base <${MESH_BASE}> .
@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:hasPolicyBinding <#binding> .

<#binding> a sfcfg:PolicyBinding ;
  sfcfg:bindsPolicy <#policy> ;
  sfcfg:appliesToPolicyTarget <#target> .

<#policy> a sfcfg:PolicyDefinition ;
  sfcfg:hasHistoryTrackingPolicy sfcfg:historyTrackingPolicy_versioned .

<#target> a sfcfg:ExactArtifactPolicyTarget .
`,
      }),
    EffectiveConfigError,
    "targetsArtifact",
  );
});

Deno.test("compileWeaveEffectiveConfig rejects malformed inventory when exact targets need governance", () => {
  assertThrows(
    () =>
      compileWeaveEffectiveConfig({
        applicationTurtle: VALID_APPLICATION_WITH_PRESENTATION_TURTLE,
        configResolutionTurtle: VALID_CONFIG_RESOLUTION_TURTLE,
        meshBase: MESH_BASE,
        meshInventoryTurtle: "not turtle",
        meshConfigTurtle: exactTargetMeshConfigTurtle("<alice/data>"),
      }),
    EffectiveConfigError,
    "Could not parse the current MeshInventory",
  );
});

Deno.test("compileWeaveEffectiveConfig rejects duplicate mesh publication profiles", () => {
  assertThrows(
    () =>
      compileWeaveEffectiveConfig({
        applicationTurtle: VALID_APPLICATION_WITH_PRESENTATION_TURTLE,
        configResolutionTurtle: VALID_CONFIG_RESOLUTION_TURTLE,
        meshConfigTurtle:
          `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:hasPublicationProfile sfcfg:publicationProfile_none, sfcfg:publicationProfile_githubPages .
`,
      }),
    EffectiveConfigError,
    "hasPublicationProfile",
  );
});

Deno.test("compileWeaveEffectiveConfig rejects unsupported mesh publication profiles", () => {
  assertThrows(
    () =>
      compileWeaveEffectiveConfig({
        applicationTurtle: VALID_APPLICATION_WITH_PRESENTATION_TURTLE,
        configResolutionTurtle: VALID_CONFIG_RESOLUTION_TURTLE,
        meshConfigTurtle:
          `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:hasPublicationProfile sfcfg:publicationProfile_auto .
`,
      }),
    EffectiveConfigError,
    "Unsupported",
  );
});

Deno.test("compileWeaveEffectiveConfig rejects unsafe workspace-root relationships", () => {
  for (const value of ["/tmp", "../workspace", "", "C:/workspace"]) {
    assertThrows(
      () =>
        compileWeaveEffectiveConfig({
          applicationTurtle: VALID_APPLICATION_WITH_PRESENTATION_TURTLE,
          configResolutionTurtle: VALID_CONFIG_RESOLUTION_TURTLE,
          meshConfigTurtle:
            `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:workspaceRootRelativeToMeshRoot ${JSON.stringify(value)} .
`,
        }),
      EffectiveConfigError,
      "workspaceRootRelativeToMeshRoot",
    );
  }
});

Deno.test("compileWeaveEffectiveConfig rejects mesh-carried resolver config", () => {
  assertThrows(
    () =>
      compileWeaveEffectiveConfig({
        applicationTurtle: VALID_APPLICATION_WITH_PRESENTATION_TURTLE,
        configResolutionTurtle: VALID_CONFIG_RESOLUTION_TURTLE,
        meshConfigTurtle:
          `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:hasConfigResolutionConfig <#resolver> .
`,
      }),
    EffectiveConfigError,
    "hasConfigResolutionConfig",
  );

  assertThrows(
    () =>
      compileWeaveEffectiveConfig({
        applicationTurtle: VALID_APPLICATION_WITH_PRESENTATION_TURTLE,
        configResolutionTurtle: VALID_CONFIG_RESOLUTION_TURTLE,
        meshConfigTurtle:
          `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:MeshConfig .

<#resolver> a sfcfg:ConfigResolutionConfig .
`,
      }),
    EffectiveConfigError,
    "ConfigResolutionConfig",
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
    'values=["currentOnly","versioned"]',
  );
});

Deno.test("parseWeaveDefaultEffectiveConfig rejects retired direct policy predicates", () => {
  assertThrows(
    () =>
      parseWeaveDefaultEffectiveConfig(
        withValidResourcePagePresentation(
          `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:ApplicationConfig ;
  sfcfg:hasConfigResolutionConfig <config-resolution> ;
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
  sfcfg:hasConfigResolutionConfig <config-resolution> ;
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
  sfcfg:hasConfigResolutionConfig <config-resolution> ;
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

const MESH_BASE = "https://semantic-flow.github.io/mesh-test/";

const GOVERNED_ARTIFACTS_INVENTORY_TURTLE = `@base <${MESH_BASE}> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<alice/data> a sflo:PayloadArtifact, sflo:DigitalArtifact .
<bob/data> a sflo:PayloadArtifact, sflo:DigitalArtifact .
`;

function withValidResourcePagePresentation(applicationTurtle: string): string {
  return `${applicationTurtle.trimEnd()}

<${WEAVE_DEFAULTS_NAMESPACE}resource-page-presentation/semantic-site-default> a sfcfg:ResourcePagePresentationPolicy ;
  sfcfg:hasOuterResourcePageTemplate <${WEAVE_DEFAULTS_NAMESPACE}resource-page-template/semantic-site/outer> ;
  sfcfg:hasInnerResourcePageTemplate <${WEAVE_DEFAULTS_NAMESPACE}resource-page-template/semantic-site/inner> ;
  sfcfg:hasResourcePageStylesheet <${WEAVE_DEFAULTS_NAMESPACE}stylesheet> ;
  sfcfg:hasResourcePagePanelSelection <${WEAVE_DEFAULTS_NAMESPACE}resource-page-presentation/semantic-site-default#children-panel> .

<${WEAVE_DEFAULTS_NAMESPACE}resource-page-presentation/semantic-site-all-panels> a sfcfg:ResourcePagePresentationPolicy ;
  sfcfg:hasOuterResourcePageTemplate <${WEAVE_DEFAULTS_NAMESPACE}resource-page-template/semantic-site/outer> ;
  sfcfg:hasInnerResourcePageTemplate <${WEAVE_DEFAULTS_NAMESPACE}resource-page-template/semantic-site/inner> ;
  sfcfg:hasResourcePageStylesheet <${WEAVE_DEFAULTS_NAMESPACE}stylesheet> ;
  sfcfg:hasResourcePagePanelSelection <${WEAVE_DEFAULTS_NAMESPACE}resource-page-presentation/semantic-site-default#children-panel>, <${WEAVE_DEFAULTS_NAMESPACE}resource-page-presentation/semantic-site-all-panels#semantic-flow-metadata-panel> .

<${WEAVE_DEFAULTS_NAMESPACE}resource-page-presentation/semantic-site-no-panels> a sfcfg:ResourcePagePresentationPolicy ;
  sfcfg:hasOuterResourcePageTemplate <${WEAVE_DEFAULTS_NAMESPACE}resource-page-template/semantic-site/outer> ;
  sfcfg:hasInnerResourcePageTemplate <${WEAVE_DEFAULTS_NAMESPACE}resource-page-template/semantic-site/inner> ;
  sfcfg:hasResourcePageStylesheet <${WEAVE_DEFAULTS_NAMESPACE}stylesheet> .

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

function exactTargetMeshConfigTurtle(artifactObject: string): string {
  return `@base <${MESH_BASE}> .
@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:hasPolicyBinding <#binding> .

<#binding> a sfcfg:PolicyBinding ;
  sfcfg:bindsPolicy <#policy> ;
  sfcfg:appliesToPolicyTarget <#target> .

<#policy> a sfcfg:PolicyDefinition ;
  sfcfg:hasHistoryTrackingPolicy sfcfg:historyTrackingPolicy_versioned .

<#target> a sfcfg:ExactArtifactPolicyTarget ;
  sfcfg:targetsArtifact ${artifactObject} .
`;
}

async function createConfigSourceTestContext(): Promise<{
  meshRoot: string;
  localPathPolicy: OperationalLocalPathPolicy;
}> {
  const meshRoot = await Deno.makeTempDir({
    prefix: "weave-config-source-",
  });
  return {
    meshRoot,
    localPathPolicy: {
      meshRoot,
      workspaceRoot: meshRoot,
      rules: [],
    },
  };
}

async function writeMeshConfigSource(
  meshRoot: string,
  relativePath: string,
  turtle: string,
): Promise<void> {
  const path = join(meshRoot, relativePath);
  await Deno.mkdir(dirname(path), { recursive: true });
  await Deno.writeTextFile(path, turtle);
}

function meshConfigAttachingLocalSource(
  relativePath: string,
  extraSpec = "",
): string {
  return meshConfigAttachingSourceSpec(
    [
      `sflo:targetLocalRelativePath ${JSON.stringify(relativePath)}`,
      extraSpec,
    ].filter((line) => line.length > 0).join(" ;\n    "),
  );
}

function meshMetadataAttachingLocalSource(relativePath: string): string {
  return `@base <${MESH_BASE}> .
@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<_mesh> a sflo:SemanticMesh ;
  sfcfg:hasConfigSource [
    a sfcfg:ConfigSource ;
    sflo:targetLocalRelativePath ${JSON.stringify(relativePath)}
  ] .
`;
}

function meshConfigAttachingSourceSpec(sourceSpec: string): string {
  return `@base <${MESH_BASE}> .
@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<> a sfcfg:MeshConfig .

<_mesh> a sflo:SemanticMesh ;
  sfcfg:hasConfigSource [
    a sfcfg:ConfigSource ;
    ${sourceSpec}
  ] .
`;
}

function configSourceForwarderTurtle(relativePath: string): string {
  return `@base <${MESH_BASE}> .
@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<> a sfcfg:MeshConfig .

<_mesh> a sflo:SemanticMesh ;
  sfcfg:hasConfigSource [
    a sfcfg:ConfigSource ;
    sflo:targetLocalRelativePath ${JSON.stringify(relativePath)}
  ] .
`;
}

function currentOnlyPayloadPolicyConfigTurtle(): string {
  return payloadHistoryPolicyConfigTurtle("historyTrackingPolicy_currentOnly");
}

function payloadHistoryPolicyConfigTurtle(policyLocalName: string): string {
  return `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:hasPolicyBinding <#payload-current-only> .

<#payload-current-only> a sfcfg:PolicyBinding ;
  sfcfg:bindsPolicy <#payload-history-policy> ;
  sfcfg:appliesToPolicyTarget <#payload> .

<#payload-history-policy> a sfcfg:PolicyDefinition ;
  sfcfg:hasHistoryTrackingPolicy sfcfg:${policyLocalName} .

<#payload> a sfcfg:ArtifactRolePolicyTarget ;
  sfcfg:hasArtifactRole sfcfg:artifactRole_payload .
`;
}

function bareKnopMetadata(scopeKey: string): string {
  return `@base <${MESH_BASE}> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<${toKnopPath(scopeKey)}> a sflo:Knop .
`;
}

function knopMetadataAttachingLocalSource(
  scopeKey: string,
  predicateLocalName: "hasConfigSource" | "hasInheritableConfigSource",
  relativePath: string,
): string {
  return knopMetadataAttachingSourceSpec(
    scopeKey,
    predicateLocalName,
    `sflo:targetLocalRelativePath ${JSON.stringify(relativePath)}`,
  );
}

function knopMetadataAttachingSourceSpec(
  scopeKey: string,
  predicateLocalName: "hasConfigSource" | "hasInheritableConfigSource",
  sourceSpec: string,
): string {
  return `@base <${MESH_BASE}> .
@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<${toKnopPath(scopeKey)}> a sflo:Knop ;
  sfcfg:${predicateLocalName} [
    a sfcfg:ConfigSource ;
    ${sourceSpec}
  ] .
`;
}
