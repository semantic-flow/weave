import { join, resolve, toFileUrl } from "@std/path";
import { Parser, type Quad, type Term } from "n3";
import {
  RDF_NAMESPACE,
  SFCFG_NAMESPACE,
  SFLO_NAMESPACE,
} from "../../core/rdf/namespaces.ts";

const RDF_TYPE_IRI = `${RDF_NAMESPACE}type`;
const APPLICATION_CONFIG_IRI = `${SFCFG_NAMESPACE}ApplicationConfig`;
const CONFIG_RESOLUTION_CONFIG_IRI = `${SFCFG_NAMESPACE}ConfigResolutionConfig`;
const HAS_DEFAULT_HISTORY_TRACKING_POLICY_IRI =
  `${SFCFG_NAMESPACE}hasDefaultHistoryTrackingPolicy`;
const HAS_HISTORY_TRACKING_DEFAULT_IRI =
  `${SFCFG_NAMESPACE}hasHistoryTrackingDefault`;
const HAS_ARTIFACT_ROLE_IRI = `${SFCFG_NAMESPACE}hasArtifactRole`;
const HAS_HISTORY_TRACKING_POLICY_IRI =
  `${SFCFG_NAMESPACE}hasHistoryTrackingPolicy`;
const HAS_DEFAULT_RESOURCE_PAGE_GENERATION_POLICY_IRI =
  `${SFCFG_NAMESPACE}hasDefaultResourcePageGenerationPolicy`;
const HAS_RESOURCE_PAGE_GENERATION_DEFAULT_IRI =
  `${SFCFG_NAMESPACE}hasResourcePageGenerationDefault`;
const HAS_RESOURCE_PAGE_GENERATION_POLICY_IRI =
  `${SFCFG_NAMESPACE}hasResourcePageGenerationPolicy`;
const HAS_RESOURCE_PAGE_REGENERATION_CONFIG_POLICY_IRI =
  `${SFCFG_NAMESPACE}hasResourcePageRegenerationConfigPolicy`;
const HAS_DEFAULT_RESOURCE_PAGE_PRESENTATION_CONFIG_IRI =
  `${SFCFG_NAMESPACE}hasDefaultResourcePagePresentationConfig`;
const HAS_INNER_RESOURCE_PAGE_TEMPLATE_IRI =
  `${SFCFG_NAMESPACE}hasInnerResourcePageTemplate`;
const HAS_OUTER_RESOURCE_PAGE_TEMPLATE_IRI =
  `${SFCFG_NAMESPACE}hasOuterResourcePageTemplate`;
const HAS_RESOURCE_PAGE_STYLESHEET_IRI =
  `${SFCFG_NAMESPACE}hasResourcePageStylesheet`;
const HAS_RESOURCE_PAGE_PANEL_SELECTION_IRI =
  `${SFCFG_NAMESPACE}hasResourcePagePanelSelection`;
const HAS_RESOURCE_PAGE_PANEL_IRI = `${SFCFG_NAMESPACE}hasResourcePagePanel`;
const PANEL_ORDER_IRI = `${SFCFG_NAMESPACE}panelOrder`;
const HAS_PANEL_INCLUSION_POLICY_IRI =
  `${SFCFG_NAMESPACE}hasPanelInclusionPolicy`;
const HAS_PANEL_TARGET_PAGE_KIND_IRI =
  `${SFCFG_NAMESPACE}hasPanelTargetPageKind`;
const HAS_PANEL_TARGET_CLASS_IRI = `${SFCFG_NAMESPACE}hasPanelTargetClass`;
const HAS_PANEL_TARGET_ARTIFACT_ROLE_IRI =
  `${SFCFG_NAMESPACE}hasPanelTargetArtifactRole`;
const HAS_PANEL_DATA_REQUIREMENT_IRI =
  `${SFCFG_NAMESPACE}hasPanelDataRequirement`;
const HAS_HISTORY_NAMING_POLICY_IRI =
  `${SFCFG_NAMESPACE}hasHistoryNamingPolicy`;
const HAS_STATE_NAMING_POLICY_IRI = `${SFCFG_NAMESPACE}hasStateNamingPolicy`;
const HAS_MANIFESTATION_NAMING_POLICY_IRI =
  `${SFCFG_NAMESPACE}hasManifestationNamingPolicy`;
const HAS_UNKNOWN_CONFIG_TERM_POLICY_IRI =
  `${SFCFG_NAMESPACE}hasUnknownConfigTermPolicy`;
const HAS_CONFIG_CYCLE_POLICY_IRI = `${SFCFG_NAMESPACE}hasConfigCyclePolicy`;
const HAS_CONFIG_REFERENCE_POLICY_IRI =
  `${SFCFG_NAMESPACE}hasConfigReferencePolicy`;
const HAS_OPERATION_REQUEST_OVERRIDE_POLICY_IRI =
  `${SFCFG_NAMESPACE}hasOperationRequestOverridePolicy`;
const HAS_RESOLVED_CONFIG_CACHE_POLICY_IRI =
  `${SFCFG_NAMESPACE}hasResolvedConfigCachePolicy`;
const HAS_PORTABLE_RESOLVER_HINT_POLICY_IRI =
  `${SFCFG_NAMESPACE}hasPortableResolverHintPolicy`;
const MAX_CONFIG_REFERENCE_DEPTH_IRI =
  `${SFCFG_NAMESPACE}maxConfigReferenceDepth`;
const HAS_CONFIG_LAYER_IRI = `${SFCFG_NAMESPACE}hasConfigLayer`;
const HAS_CONFIG_LAYER_ROLE_IRI = `${SFCFG_NAMESPACE}hasConfigLayerRole`;
const LAYER_ORDER_IRI = `${SFCFG_NAMESPACE}layerOrder`;
const XSD_NON_NEGATIVE_INTEGER_IRI =
  "http://www.w3.org/2001/XMLSchema#nonNegativeInteger";

const WEAVE_DEFAULTS_ROOT = new URL("../../../defaults/", import.meta.url);
const WEAVE_DEFAULTS_NAMESPACE =
  "https://semantic-flow.github.io/weave/defaults/";

const DEFAULT_RESOURCE_PAGE_PRESENTATION_IRI =
  `${WEAVE_DEFAULTS_NAMESPACE}resource-page-presentation/semantic-site-default`;
const DEFAULT_OUTER_RESOURCE_PAGE_TEMPLATE_IRI =
  `${WEAVE_DEFAULTS_NAMESPACE}resource-page-template/semantic-site/outer`;
const DEFAULT_INNER_RESOURCE_PAGE_TEMPLATE_IRI =
  `${WEAVE_DEFAULTS_NAMESPACE}resource-page-template/semantic-site/inner`;
const DEFAULT_RESOURCE_PAGE_STYLESHEET_IRI =
  `${WEAVE_DEFAULTS_NAMESPACE}default-stylesheet`;

const ARTIFACT_ROLE_VALUES = {
  [`${SFCFG_NAMESPACE}artifactRole_payload`]: "payload",
  [`${SFCFG_NAMESPACE}artifactRole_meshInventory`]: "meshInventory",
  [`${SFCFG_NAMESPACE}artifactRole_knopInventory`]: "knopInventory",
  [`${SFCFG_NAMESPACE}artifactRole_meshMetadata`]: "meshMetadata",
  [`${SFCFG_NAMESPACE}artifactRole_knopMetadata`]: "knopMetadata",
  [`${SFCFG_NAMESPACE}artifactRole_config`]: "config",
  [`${SFCFG_NAMESPACE}artifactRole_referenceCatalog`]: "referenceCatalog",
  [`${SFCFG_NAMESPACE}artifactRole_resourcePageDefinition`]:
    "resourcePageDefinition",
  [`${SFCFG_NAMESPACE}artifactRole_resourcePageTemplate`]:
    "resourcePageTemplate",
  [`${SFCFG_NAMESPACE}artifactRole_resourcePageStylesheet`]:
    "resourcePageStylesheet",
  [`${SFCFG_NAMESPACE}artifactRole_runtimeMeta`]: "runtimeMeta",
} as const;

const HISTORY_TRACKING_POLICY_VALUES = {
  [`${SFCFG_NAMESPACE}historyTrackingPolicy_versioned`]: "versioned",
  [`${SFCFG_NAMESPACE}historyTrackingPolicy_currentOnly`]: "currentOnly",
  [`${SFCFG_NAMESPACE}historyTrackingPolicy_required`]: "required",
  [`${SFCFG_NAMESPACE}historyTrackingPolicy_slimHistory`]: "slimHistory",
  [`${SFCFG_NAMESPACE}historyTrackingPolicy_checkpointOnly`]: "checkpointOnly",
  [`${SFCFG_NAMESPACE}historyTrackingPolicy_metadataOnly`]: "metadataOnly",
} as const;

const RESOURCE_PAGE_GENERATION_POLICY_VALUES = {
  [`${SFCFG_NAMESPACE}resourcePageGenerationPolicy_generate`]: "generate",
  [`${SFCFG_NAMESPACE}resourcePageGenerationPolicy_suppress`]: "suppress",
  [`${SFCFG_NAMESPACE}resourcePageGenerationPolicy_defer`]: "defer",
  [`${SFCFG_NAMESPACE}resourcePageGenerationPolicy_onRequest`]: "onRequest",
} as const;

const RESOURCE_PAGE_REGENERATION_CONFIG_POLICY_VALUES = {
  [`${SFCFG_NAMESPACE}resourcePageRegenerationConfigPolicy_configAtTheTime`]:
    "configAtTheTime",
  [`${SFCFG_NAMESPACE}resourcePageRegenerationConfigPolicy_currentPresentation`]:
    "currentPresentation",
  [`${SFCFG_NAMESPACE}resourcePageRegenerationConfigPolicy_currentFullConfig`]:
    "currentFullConfig",
  [`${SFCFG_NAMESPACE}resourcePageRegenerationConfigPolicy_historicalSemanticsCurrentPresentation`]:
    "historicalSemanticsCurrentPresentation",
} as const;

const HISTORY_NAMING_POLICY_VALUES = {
  [`${SFCFG_NAMESPACE}historyNamingPolicy_ordinal`]: "ordinal",
  [`${SFCFG_NAMESPACE}historyNamingPolicy_named`]: "named",
} as const;

const STATE_NAMING_POLICY_VALUES = {
  [`${SFCFG_NAMESPACE}stateNamingPolicy_ordinal`]: "ordinal",
  [`${SFCFG_NAMESPACE}stateNamingPolicy_semver`]: "semver",
  [`${SFCFG_NAMESPACE}stateNamingPolicy_date`]: "date",
} as const;

const MANIFESTATION_NAMING_POLICY_VALUES = {
  [`${SFCFG_NAMESPACE}manifestationNamingPolicy_filenameDerived`]:
    "filenameDerived",
  [`${SFCFG_NAMESPACE}manifestationNamingPolicy_contentKindDerived`]:
    "contentKindDerived",
  [`${SFCFG_NAMESPACE}manifestationNamingPolicy_ordinal`]: "ordinal",
} as const;

const UNKNOWN_CONFIG_TERM_POLICY_VALUES = {
  [`${SFCFG_NAMESPACE}unknownConfigTermPolicy_reject`]: "reject",
  [`${SFCFG_NAMESPACE}unknownConfigTermPolicy_ignore`]: "ignore",
  [`${SFCFG_NAMESPACE}unknownConfigTermPolicy_warn`]: "warn",
} as const;

const CONFIG_CYCLE_POLICY_VALUES = {
  [`${SFCFG_NAMESPACE}configCyclePolicy_reject`]: "reject",
  [`${SFCFG_NAMESPACE}configCyclePolicy_useFirstSeen`]: "useFirstSeen",
} as const;

const CONFIG_REFERENCE_POLICY_VALUES = {
  [`${SFCFG_NAMESPACE}configReferencePolicy_noExternalReferences`]:
    "noExternalReferences",
  [`${SFCFG_NAMESPACE}configReferencePolicy_pinnedOnly`]: "pinnedOnly",
  [`${SFCFG_NAMESPACE}configReferencePolicy_currentAllowedWithinTrustedBoundary`]:
    "currentAllowedWithinTrustedBoundary",
} as const;

const OPERATION_REQUEST_OVERRIDE_POLICY_VALUES = {
  [`${SFCFG_NAMESPACE}operationRequestOverridePolicy_warnAndApply`]:
    "warnAndApply",
  [`${SFCFG_NAMESPACE}operationRequestOverridePolicy_rejectConflict`]:
    "rejectConflict",
  [`${SFCFG_NAMESPACE}operationRequestOverridePolicy_requireExplicitAcknowledgement`]:
    "requireExplicitAcknowledgement",
} as const;

const RESOLVED_CONFIG_CACHE_POLICY_VALUES = {
  [`${SFCFG_NAMESPACE}resolvedConfigCachePolicy_noCache`]: "noCache",
  [`${SFCFG_NAMESPACE}resolvedConfigCachePolicy_cacheForProcess`]:
    "cacheForProcess",
  [`${SFCFG_NAMESPACE}resolvedConfigCachePolicy_persistDiagnosticCache`]:
    "persistDiagnosticCache",
} as const;

const PORTABLE_RESOLVER_HINT_POLICY_VALUES = {
  [`${SFCFG_NAMESPACE}portableResolverHintPolicy_ignore`]: "ignore",
  [`${SFCFG_NAMESPACE}portableResolverHintPolicy_honorWithinTrustedBoundary`]:
    "honorWithinTrustedBoundary",
} as const;

const CONFIG_LAYER_ROLE_VALUES = {
  [`${SFCFG_NAMESPACE}configLayerRole_builtInDefaults`]: "builtInDefaults",
  [`${SFCFG_NAMESPACE}configLayerRole_weaveDefaults`]: "weaveDefaults",
  [`${SFCFG_NAMESPACE}configLayerRole_commandOverride`]: "commandOverride",
  [`${SFCFG_NAMESPACE}configLayerRole_machineLocalOperational`]:
    "machineLocalOperational",
  [`${SFCFG_NAMESPACE}configLayerRole_workspaceOperational`]:
    "workspaceOperational",
  [`${SFCFG_NAMESPACE}configLayerRole_meshLocal`]: "meshLocal",
  [`${SFCFG_NAMESPACE}configLayerRole_meshInheritable`]: "meshInheritable",
  [`${SFCFG_NAMESPACE}configLayerRole_knopInherited`]: "knopInherited",
  [`${SFCFG_NAMESPACE}configLayerRole_knopLocal`]: "knopLocal",
  [`${SFCFG_NAMESPACE}configLayerRole_knopInheritable`]: "knopInheritable",
  [`${SFCFG_NAMESPACE}configLayerRole_reusableConfig`]: "reusableConfig",
  [`${SFCFG_NAMESPACE}configLayerRole_resolvedRuntime`]: "resolvedRuntime",
} as const;

const RESOURCE_PAGE_PRESENTATION_VALUES = {
  [DEFAULT_RESOURCE_PAGE_PRESENTATION_IRI]: "semanticSiteDefault",
} as const;

const OUTER_RESOURCE_PAGE_TEMPLATE_VALUES = {
  [DEFAULT_OUTER_RESOURCE_PAGE_TEMPLATE_IRI]: "semanticSiteOuter",
} as const;

const INNER_RESOURCE_PAGE_TEMPLATE_VALUES = {
  [DEFAULT_INNER_RESOURCE_PAGE_TEMPLATE_IRI]: "semanticSiteInner",
} as const;

const RESOURCE_PAGE_STYLESHEET_VALUES = {
  [DEFAULT_RESOURCE_PAGE_STYLESHEET_IRI]: "semanticSiteDefault",
} as const;

const RESOURCE_PAGE_PANEL_VALUES = {
  [`${WEAVE_DEFAULTS_NAMESPACE}resource-page-panel/children`]: "children",
  [`${WEAVE_DEFAULTS_NAMESPACE}resource-page-panel/properties`]: "properties",
  [`${WEAVE_DEFAULTS_NAMESPACE}resource-page-panel/blank-nodes`]: "blankNodes",
  [`${WEAVE_DEFAULTS_NAMESPACE}resource-page-panel/references`]: "references",
  [`${WEAVE_DEFAULTS_NAMESPACE}resource-page-panel/current-links`]:
    "currentLinks",
  [`${WEAVE_DEFAULTS_NAMESPACE}resource-page-panel/knop-artifacts`]:
    "knopArtifacts",
  [`${WEAVE_DEFAULTS_NAMESPACE}resource-page-panel/fact-sections`]:
    "factSections",
  [`${WEAVE_DEFAULTS_NAMESPACE}resource-page-panel/raw-source`]: "rawSource",
  [`${WEAVE_DEFAULTS_NAMESPACE}resource-page-panel/history`]: "history",
  [`${WEAVE_DEFAULTS_NAMESPACE}resource-page-panel/semantic-flow-metadata`]:
    "semanticFlowMetadata",
} as const;

const RESOURCE_PAGE_PANEL_INCLUSION_POLICY_VALUES = {
  [`${SFCFG_NAMESPACE}panelInclusionPolicy_auto`]: "auto",
} as const;

const RESOURCE_PAGE_KIND_VALUES = {
  [`${SFCFG_NAMESPACE}resourcePageKind_identifier`]: "identifier",
  [`${SFCFG_NAMESPACE}resourcePageKind_knop`]: "knop",
  [`${SFCFG_NAMESPACE}resourcePageKind_simple`]: "simple",
  [`${SFCFG_NAMESPACE}resourcePageKind_referenceCatalog`]: "referenceCatalog",
} as const;

const RESOURCE_PAGE_PANEL_DATA_REQUIREMENT_VALUES = {
  [`${SFCFG_NAMESPACE}panelDataRequirement_children`]: "children",
  [`${SFCFG_NAMESPACE}panelDataRequirement_rdfProperties`]: "rdfProperties",
  [`${SFCFG_NAMESPACE}panelDataRequirement_blankNodes`]: "blankNodes",
  [`${SFCFG_NAMESPACE}panelDataRequirement_references`]: "references",
  [`${SFCFG_NAMESPACE}panelDataRequirement_currentReferenceLinks`]:
    "currentReferenceLinks",
  [`${SFCFG_NAMESPACE}panelDataRequirement_knopArtifacts`]: "knopArtifacts",
  [`${SFCFG_NAMESPACE}panelDataRequirement_factSections`]: "factSections",
  [`${SFCFG_NAMESPACE}panelDataRequirement_rawSource`]: "rawSource",
  [`${SFCFG_NAMESPACE}panelDataRequirement_history`]: "history",
  [`${SFCFG_NAMESPACE}panelDataRequirement_semanticFlowMetadataOptIn`]:
    "semanticFlowMetadataOptIn",
} as const;

export type ArtifactRole = ValueOf<typeof ARTIFACT_ROLE_VALUES>;
export type HistoryTrackingPolicy = ValueOf<
  typeof HISTORY_TRACKING_POLICY_VALUES
>;
export type ResourcePageGenerationPolicy = ValueOf<
  typeof RESOURCE_PAGE_GENERATION_POLICY_VALUES
>;
export type ResourcePageRegenerationConfigPolicy = ValueOf<
  typeof RESOURCE_PAGE_REGENERATION_CONFIG_POLICY_VALUES
>;
type HistoryNamingPolicy = ValueOf<typeof HISTORY_NAMING_POLICY_VALUES>;
type StateNamingPolicy = ValueOf<typeof STATE_NAMING_POLICY_VALUES>;
type ManifestationNamingPolicy = ValueOf<
  typeof MANIFESTATION_NAMING_POLICY_VALUES
>;
export type UnknownConfigTermPolicy = ValueOf<
  typeof UNKNOWN_CONFIG_TERM_POLICY_VALUES
>;
export type ConfigCyclePolicy = ValueOf<typeof CONFIG_CYCLE_POLICY_VALUES>;
export type ConfigReferencePolicy = ValueOf<
  typeof CONFIG_REFERENCE_POLICY_VALUES
>;
export type OperationRequestOverridePolicy = ValueOf<
  typeof OPERATION_REQUEST_OVERRIDE_POLICY_VALUES
>;
export type ResolvedConfigCachePolicy = ValueOf<
  typeof RESOLVED_CONFIG_CACHE_POLICY_VALUES
>;
export type PortableResolverHintPolicy = ValueOf<
  typeof PORTABLE_RESOLVER_HINT_POLICY_VALUES
>;
export type ConfigLayerRole = ValueOf<typeof CONFIG_LAYER_ROLE_VALUES>;
export type ResourcePagePresentationIdentity = ValueOf<
  typeof RESOURCE_PAGE_PRESENTATION_VALUES
>;
export type ResourcePageTemplateIdentity =
  | ValueOf<
    typeof OUTER_RESOURCE_PAGE_TEMPLATE_VALUES
  >
  | ValueOf<typeof INNER_RESOURCE_PAGE_TEMPLATE_VALUES>;
export type ResourcePageStylesheetIdentity = ValueOf<
  typeof RESOURCE_PAGE_STYLESHEET_VALUES
>;
export type ResourcePagePanelIdentity = ValueOf<
  typeof RESOURCE_PAGE_PANEL_VALUES
>;
export type ResourcePagePanelInclusionPolicy = ValueOf<
  typeof RESOURCE_PAGE_PANEL_INCLUSION_POLICY_VALUES
>;
export type ResourcePageKindTarget = ValueOf<typeof RESOURCE_PAGE_KIND_VALUES>;
export type ResourcePagePanelDataRequirement = ValueOf<
  typeof RESOURCE_PAGE_PANEL_DATA_REQUIREMENT_VALUES
>;

type ValueOf<T> = T[keyof T];

export interface ArtifactRoleEffectivePolicy {
  historyTrackingPolicy: HistoryTrackingPolicy;
  resourcePageGenerationPolicy: ResourcePageGenerationPolicy;
}

export interface DefaultNamingPolicies {
  historyNamingPolicy: HistoryNamingPolicy;
  stateNamingPolicy: StateNamingPolicy;
  manifestationNamingPolicy: ManifestationNamingPolicy;
}

export interface ConfigLayerProfile {
  role: ConfigLayerRole;
  order: number;
}

export interface DefaultConfigResolutionProfile {
  unknownConfigTermPolicy: UnknownConfigTermPolicy;
  configCyclePolicy: ConfigCyclePolicy;
  configReferencePolicy: ConfigReferencePolicy;
  operationRequestOverridePolicy: OperationRequestOverridePolicy;
  resolvedConfigCachePolicy: ResolvedConfigCachePolicy;
  portableResolverHintPolicy: PortableResolverHintPolicy;
  maxConfigReferenceDepth: number;
  layers: readonly ConfigLayerProfile[];
}

export interface ResourcePageTemplateProfile {
  iri: string;
  identity: ResourcePageTemplateIdentity;
}

export interface ResourcePageStylesheetProfile {
  iri: string;
  identity: ResourcePageStylesheetIdentity;
}

export interface ResourcePagePanelSelectionProfile {
  iri: string;
  panelIri: string;
  panel: ResourcePagePanelIdentity;
  order: number;
  inclusionPolicy: ResourcePagePanelInclusionPolicy;
  targetPageKinds: readonly ResourcePageKindTarget[];
  targetClasses: readonly string[];
  targetArtifactRoles: readonly ArtifactRole[];
  dataRequirements: readonly ResourcePagePanelDataRequirement[];
}

export interface ResourcePagePresentationProfile {
  iri: string;
  identity: ResourcePagePresentationIdentity;
  outerTemplate: ResourcePageTemplateProfile;
  innerTemplate: ResourcePageTemplateProfile;
  stylesheets: readonly ResourcePageStylesheetProfile[];
  panelSelections: readonly ResourcePagePanelSelectionProfile[];
}

export const DEFAULT_RESOURCE_PAGE_PRESENTATION_PROFILE:
  ResourcePagePresentationProfile = {
    iri: DEFAULT_RESOURCE_PAGE_PRESENTATION_IRI,
    identity: "semanticSiteDefault",
    outerTemplate: {
      iri: DEFAULT_OUTER_RESOURCE_PAGE_TEMPLATE_IRI,
      identity: "semanticSiteOuter",
    },
    innerTemplate: {
      iri: DEFAULT_INNER_RESOURCE_PAGE_TEMPLATE_IRI,
      identity: "semanticSiteInner",
    },
    stylesheets: [{
      iri: DEFAULT_RESOURCE_PAGE_STYLESHEET_IRI,
      identity: "semanticSiteDefault",
    }],
    panelSelections: [
      {
        iri: `${DEFAULT_RESOURCE_PAGE_PRESENTATION_IRI}#children-panel`,
        panelIri: `${WEAVE_DEFAULTS_NAMESPACE}resource-page-panel/children`,
        panel: "children",
        order: 10,
        inclusionPolicy: "auto",
        targetPageKinds: ["identifier", "knop", "simple"],
        targetClasses: [],
        targetArtifactRoles: [],
        dataRequirements: ["children"],
      },
      {
        iri: `${DEFAULT_RESOURCE_PAGE_PRESENTATION_IRI}#properties-panel`,
        panelIri: `${WEAVE_DEFAULTS_NAMESPACE}resource-page-panel/properties`,
        panel: "properties",
        order: 20,
        inclusionPolicy: "auto",
        targetPageKinds: ["identifier", "referenceCatalog", "simple"],
        targetClasses: [],
        targetArtifactRoles: [],
        dataRequirements: ["rdfProperties"],
      },
      {
        iri: `${DEFAULT_RESOURCE_PAGE_PRESENTATION_IRI}#blank-nodes-panel`,
        panelIri: `${WEAVE_DEFAULTS_NAMESPACE}resource-page-panel/blank-nodes`,
        panel: "blankNodes",
        order: 30,
        inclusionPolicy: "auto",
        targetPageKinds: ["identifier", "referenceCatalog", "simple"],
        targetClasses: [],
        targetArtifactRoles: [],
        dataRequirements: ["blankNodes"],
      },
      {
        iri: `${DEFAULT_RESOURCE_PAGE_PRESENTATION_IRI}#references-panel`,
        panelIri: `${WEAVE_DEFAULTS_NAMESPACE}resource-page-panel/references`,
        panel: "references",
        order: 40,
        inclusionPolicy: "auto",
        targetPageKinds: ["identifier"],
        targetClasses: [],
        targetArtifactRoles: [],
        dataRequirements: ["references"],
      },
      {
        iri: `${DEFAULT_RESOURCE_PAGE_PRESENTATION_IRI}#current-links-panel`,
        panelIri:
          `${WEAVE_DEFAULTS_NAMESPACE}resource-page-panel/current-links`,
        panel: "currentLinks",
        order: 50,
        inclusionPolicy: "auto",
        targetPageKinds: ["referenceCatalog"],
        targetClasses: [],
        targetArtifactRoles: [],
        dataRequirements: ["currentReferenceLinks"],
      },
      {
        iri: `${DEFAULT_RESOURCE_PAGE_PRESENTATION_IRI}#knop-artifacts-panel`,
        panelIri:
          `${WEAVE_DEFAULTS_NAMESPACE}resource-page-panel/knop-artifacts`,
        panel: "knopArtifacts",
        order: 55,
        inclusionPolicy: "auto",
        targetPageKinds: ["knop"],
        targetClasses: [],
        targetArtifactRoles: [],
        dataRequirements: ["knopArtifacts"],
      },
      {
        iri: `${DEFAULT_RESOURCE_PAGE_PRESENTATION_IRI}#fact-sections-panel`,
        panelIri:
          `${WEAVE_DEFAULTS_NAMESPACE}resource-page-panel/fact-sections`,
        panel: "factSections",
        order: 57,
        inclusionPolicy: "auto",
        targetPageKinds: ["simple"],
        targetClasses: [],
        targetArtifactRoles: [],
        dataRequirements: ["factSections"],
      },
      {
        iri: `${DEFAULT_RESOURCE_PAGE_PRESENTATION_IRI}#raw-source-panel`,
        panelIri: `${WEAVE_DEFAULTS_NAMESPACE}resource-page-panel/raw-source`,
        panel: "rawSource",
        order: 60,
        inclusionPolicy: "auto",
        targetPageKinds: ["identifier", "referenceCatalog", "simple"],
        targetClasses: [`${SFLO_NAMESPACE}DigitalArtifact`],
        targetArtifactRoles: [
          "config",
          "knopInventory",
          "knopMetadata",
          "meshInventory",
          "meshMetadata",
          "payload",
          "referenceCatalog",
          "resourcePageDefinition",
          "resourcePageStylesheet",
          "resourcePageTemplate",
          "runtimeMeta",
        ],
        dataRequirements: ["rawSource"],
      },
      {
        iri: `${DEFAULT_RESOURCE_PAGE_PRESENTATION_IRI}#history-panel`,
        panelIri: `${WEAVE_DEFAULTS_NAMESPACE}resource-page-panel/history`,
        panel: "history",
        order: 70,
        inclusionPolicy: "auto",
        targetPageKinds: ["identifier", "referenceCatalog", "simple"],
        targetClasses: [],
        targetArtifactRoles: [],
        dataRequirements: ["history"],
      },
      {
        iri:
          `${DEFAULT_RESOURCE_PAGE_PRESENTATION_IRI}#semantic-flow-metadata-panel`,
        panelIri:
          `${WEAVE_DEFAULTS_NAMESPACE}resource-page-panel/semantic-flow-metadata`,
        panel: "semanticFlowMetadata",
        order: 80,
        inclusionPolicy: "auto",
        targetPageKinds: [
          "identifier",
          "knop",
          "referenceCatalog",
          "simple",
        ],
        targetClasses: [],
        targetArtifactRoles: [],
        dataRequirements: ["semanticFlowMetadataOptIn"],
      },
    ],
  };

export interface EffectiveConfigSources {
  applicationSource: string;
  configResolutionSource: string;
}

export interface LoadWeaveDefaultEffectiveConfigOptions {
  defaultsRoot?: string | URL;
}

export class EffectiveConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EffectiveConfigError";
  }
}

export class EffectiveConfig {
  readonly sources: EffectiveConfigSources;
  readonly configResolution: DefaultConfigResolutionProfile;
  readonly namingPolicies: DefaultNamingPolicies;
  readonly resourcePagePresentation: ResourcePagePresentationProfile;
  readonly resourcePageRegenerationConfigPolicy:
    ResourcePageRegenerationConfigPolicy;
  readonly #defaultHistoryTrackingPolicy: HistoryTrackingPolicy;
  readonly #historyTrackingByRole: ReadonlyMap<
    ArtifactRole,
    HistoryTrackingPolicy
  >;
  readonly #defaultResourcePageGenerationPolicy: ResourcePageGenerationPolicy;
  readonly #resourcePageGenerationByRole: ReadonlyMap<
    ArtifactRole,
    ResourcePageGenerationPolicy
  >;

  constructor(
    input: {
      sources: EffectiveConfigSources;
      defaultHistoryTrackingPolicy: HistoryTrackingPolicy;
      historyTrackingByRole: ReadonlyMap<ArtifactRole, HistoryTrackingPolicy>;
      defaultResourcePageGenerationPolicy: ResourcePageGenerationPolicy;
      resourcePageGenerationByRole: ReadonlyMap<
        ArtifactRole,
        ResourcePageGenerationPolicy
      >;
      resourcePageRegenerationConfigPolicy:
        ResourcePageRegenerationConfigPolicy;
      resourcePagePresentation: ResourcePagePresentationProfile;
      namingPolicies: DefaultNamingPolicies;
      configResolution: DefaultConfigResolutionProfile;
    },
  ) {
    this.sources = input.sources;
    this.#defaultHistoryTrackingPolicy = input.defaultHistoryTrackingPolicy;
    this.#historyTrackingByRole = input.historyTrackingByRole;
    this.#defaultResourcePageGenerationPolicy =
      input.defaultResourcePageGenerationPolicy;
    this.#resourcePageGenerationByRole = input.resourcePageGenerationByRole;
    this.resourcePageRegenerationConfigPolicy =
      input.resourcePageRegenerationConfigPolicy;
    this.resourcePagePresentation = input.resourcePagePresentation;
    this.namingPolicies = input.namingPolicies;
    this.configResolution = input.configResolution;
  }

  historyTrackingPolicyForArtifactRole(
    artifactRole: ArtifactRole,
  ): HistoryTrackingPolicy {
    return this.#historyTrackingByRole.get(artifactRole) ??
      this.#defaultHistoryTrackingPolicy;
  }

  resourcePageGenerationPolicyForArtifactRole(
    artifactRole: ArtifactRole,
  ): ResourcePageGenerationPolicy {
    return this.#resourcePageGenerationByRole.get(artifactRole) ??
      this.#defaultResourcePageGenerationPolicy;
  }

  artifactRolePolicy(
    artifactRole: ArtifactRole,
  ): ArtifactRoleEffectivePolicy {
    return {
      historyTrackingPolicy: this.historyTrackingPolicyForArtifactRole(
        artifactRole,
      ),
      resourcePageGenerationPolicy: this
        .resourcePageGenerationPolicyForArtifactRole(artifactRole),
    };
  }
}

export async function loadWeaveDefaultEffectiveConfig(
  options: LoadWeaveDefaultEffectiveConfigOptions = {},
): Promise<EffectiveConfig> {
  const applicationSource = resolveDefaultsFile(
    options.defaultsRoot,
    "application.ttl",
  );
  const configResolutionSource = resolveDefaultsFile(
    options.defaultsRoot,
    "config-resolution.ttl",
  );

  return parseWeaveDefaultEffectiveConfig(
    await Deno.readTextFile(applicationSource),
    await Deno.readTextFile(configResolutionSource),
    {
      applicationSource: formatSource(applicationSource),
      configResolutionSource: formatSource(configResolutionSource),
    },
  );
}

export function parseWeaveDefaultEffectiveConfig(
  applicationTurtle: string,
  configResolutionTurtle: string,
  sources: EffectiveConfigSources = {
    applicationSource: "application.ttl",
    configResolutionSource: "config-resolution.ttl",
  },
): EffectiveConfig {
  const applicationQuads = parseTurtle(
    applicationTurtle,
    sources.applicationSource,
  );
  const configResolutionQuads = parseTurtle(
    configResolutionTurtle,
    sources.configResolutionSource,
  );
  const applicationSubject = requireSingleTypedSubject(
    applicationQuads,
    APPLICATION_CONFIG_IRI,
    sources.applicationSource,
  );

  return new EffectiveConfig({
    sources,
    defaultHistoryTrackingPolicy: requireSingleNamedValue(
      applicationQuads,
      applicationSubject,
      HAS_DEFAULT_HISTORY_TRACKING_POLICY_IRI,
      HISTORY_TRACKING_POLICY_VALUES,
      sources.applicationSource,
    ),
    historyTrackingByRole: parseArtifactRolePolicies(
      applicationQuads,
      applicationSubject,
      HAS_HISTORY_TRACKING_DEFAULT_IRI,
      HAS_HISTORY_TRACKING_POLICY_IRI,
      HISTORY_TRACKING_POLICY_VALUES,
      sources.applicationSource,
    ),
    defaultResourcePageGenerationPolicy: requireSingleNamedValue(
      applicationQuads,
      applicationSubject,
      HAS_DEFAULT_RESOURCE_PAGE_GENERATION_POLICY_IRI,
      RESOURCE_PAGE_GENERATION_POLICY_VALUES,
      sources.applicationSource,
    ),
    resourcePageGenerationByRole: parseArtifactRolePolicies(
      applicationQuads,
      applicationSubject,
      HAS_RESOURCE_PAGE_GENERATION_DEFAULT_IRI,
      HAS_RESOURCE_PAGE_GENERATION_POLICY_IRI,
      RESOURCE_PAGE_GENERATION_POLICY_VALUES,
      sources.applicationSource,
    ),
    resourcePageRegenerationConfigPolicy: requireSingleNamedValue(
      applicationQuads,
      applicationSubject,
      HAS_RESOURCE_PAGE_REGENERATION_CONFIG_POLICY_IRI,
      RESOURCE_PAGE_REGENERATION_CONFIG_POLICY_VALUES,
      sources.applicationSource,
    ),
    resourcePagePresentation: parseResourcePagePresentationProfile(
      applicationQuads,
      applicationSubject,
      sources.applicationSource,
    ),
    namingPolicies: {
      historyNamingPolicy: requireSingleNamedValue(
        applicationQuads,
        applicationSubject,
        HAS_HISTORY_NAMING_POLICY_IRI,
        HISTORY_NAMING_POLICY_VALUES,
        sources.applicationSource,
      ),
      stateNamingPolicy: requireSingleNamedValue(
        applicationQuads,
        applicationSubject,
        HAS_STATE_NAMING_POLICY_IRI,
        STATE_NAMING_POLICY_VALUES,
        sources.applicationSource,
      ),
      manifestationNamingPolicy: requireSingleNamedValue(
        applicationQuads,
        applicationSubject,
        HAS_MANIFESTATION_NAMING_POLICY_IRI,
        MANIFESTATION_NAMING_POLICY_VALUES,
        sources.applicationSource,
      ),
    },
    configResolution: parseConfigResolutionProfile(
      configResolutionQuads,
      sources.configResolutionSource,
    ),
  });
}

function parseConfigResolutionProfile(
  quads: readonly Quad[],
  source: string,
): DefaultConfigResolutionProfile {
  const subject = requireSingleTypedSubject(
    quads,
    CONFIG_RESOLUTION_CONFIG_IRI,
    source,
  );

  return {
    unknownConfigTermPolicy: requireSingleNamedValue(
      quads,
      subject,
      HAS_UNKNOWN_CONFIG_TERM_POLICY_IRI,
      UNKNOWN_CONFIG_TERM_POLICY_VALUES,
      source,
    ),
    configCyclePolicy: requireSingleNamedValue(
      quads,
      subject,
      HAS_CONFIG_CYCLE_POLICY_IRI,
      CONFIG_CYCLE_POLICY_VALUES,
      source,
    ),
    configReferencePolicy: requireSingleNamedValue(
      quads,
      subject,
      HAS_CONFIG_REFERENCE_POLICY_IRI,
      CONFIG_REFERENCE_POLICY_VALUES,
      source,
    ),
    operationRequestOverridePolicy: requireSingleNamedValue(
      quads,
      subject,
      HAS_OPERATION_REQUEST_OVERRIDE_POLICY_IRI,
      OPERATION_REQUEST_OVERRIDE_POLICY_VALUES,
      source,
    ),
    resolvedConfigCachePolicy: requireSingleNamedValue(
      quads,
      subject,
      HAS_RESOLVED_CONFIG_CACHE_POLICY_IRI,
      RESOLVED_CONFIG_CACHE_POLICY_VALUES,
      source,
    ),
    portableResolverHintPolicy: requireSingleNamedValue(
      quads,
      subject,
      HAS_PORTABLE_RESOLVER_HINT_POLICY_IRI,
      PORTABLE_RESOLVER_HINT_POLICY_VALUES,
      source,
    ),
    maxConfigReferenceDepth: requireSingleNonNegativeInteger(
      quads,
      subject,
      MAX_CONFIG_REFERENCE_DEPTH_IRI,
      source,
    ),
    layers: parseConfigLayers(quads, subject, source),
  };
}

function parseConfigLayers(
  quads: readonly Quad[],
  subject: string,
  source: string,
): readonly ConfigLayerProfile[] {
  const layerSubjects = collectObjectTerms(
    quads,
    subject,
    HAS_CONFIG_LAYER_IRI,
  );
  if (layerSubjects.length === 0) {
    throw new EffectiveConfigError(
      `Expected at least one ${HAS_CONFIG_LAYER_IRI} value in ${source}`,
    );
  }

  const layers = layerSubjects.map((layerSubject) => ({
    role: requireSingleNamedValue(
      quads,
      layerSubject,
      HAS_CONFIG_LAYER_ROLE_IRI,
      CONFIG_LAYER_ROLE_VALUES,
      source,
    ),
    order: requireSingleNonNegativeInteger(
      quads,
      layerSubject,
      LAYER_ORDER_IRI,
      source,
    ),
  })).sort((left, right) => left.order - right.order);

  for (let index = 1; index < layers.length; index += 1) {
    if (layers[index]!.order === layers[index - 1]!.order) {
      throw new EffectiveConfigError(
        `Config layer order values must be unique in ${source}`,
      );
    }
  }

  return layers;
}

function parseArtifactRolePolicies<T extends string>(
  quads: readonly Quad[],
  subject: string,
  attachmentPredicateIri: string,
  policyPredicateIri: string,
  policyValues: Record<string, T>,
  source: string,
): ReadonlyMap<ArtifactRole, T> {
  const policies = new Map<ArtifactRole, T>();

  for (
    const policySubject of collectObjectTerms(
      quads,
      subject,
      attachmentPredicateIri,
    )
  ) {
    const role = requireSingleNamedValue(
      quads,
      policySubject,
      HAS_ARTIFACT_ROLE_IRI,
      ARTIFACT_ROLE_VALUES,
      source,
    );
    const policy = requireSingleNamedValue(
      quads,
      policySubject,
      policyPredicateIri,
      policyValues,
      source,
    );
    if (policies.has(role)) {
      throw new EffectiveConfigError(
        `Duplicate artifact-role policy for ${role} in ${source}`,
      );
    }

    policies.set(role, policy);
  }

  return policies;
}

function parseResourcePagePresentationProfile(
  quads: readonly Quad[],
  applicationSubject: string,
  source: string,
): ResourcePagePresentationProfile {
  const presentation = requireSingleKnownNamedNode(
    quads,
    applicationSubject,
    HAS_DEFAULT_RESOURCE_PAGE_PRESENTATION_CONFIG_IRI,
    RESOURCE_PAGE_PRESENTATION_VALUES,
    source,
  );
  const presentationSubject = `NamedNode:${presentation.iri}`;
  const stylesheets = [...collectKnownNamedNodes(
    quads,
    presentationSubject,
    HAS_RESOURCE_PAGE_STYLESHEET_IRI,
    RESOURCE_PAGE_STYLESHEET_VALUES,
    source,
  )].sort((left, right) => left.iri.localeCompare(right.iri));
  if (stylesheets.length === 0) {
    throw new EffectiveConfigError(
      `Expected at least one ${HAS_RESOURCE_PAGE_STYLESHEET_IRI} value in ${source}`,
    );
  }

  return {
    iri: presentation.iri,
    identity: presentation.identity,
    outerTemplate: requireSingleKnownNamedNode(
      quads,
      presentationSubject,
      HAS_OUTER_RESOURCE_PAGE_TEMPLATE_IRI,
      OUTER_RESOURCE_PAGE_TEMPLATE_VALUES,
      source,
    ),
    innerTemplate: requireSingleKnownNamedNode(
      quads,
      presentationSubject,
      HAS_INNER_RESOURCE_PAGE_TEMPLATE_IRI,
      INNER_RESOURCE_PAGE_TEMPLATE_VALUES,
      source,
    ),
    stylesheets,
    panelSelections: parseResourcePagePanelSelections(
      quads,
      presentationSubject,
      source,
    ),
  };
}

function parseResourcePagePanelSelections(
  quads: readonly Quad[],
  presentationSubject: string,
  source: string,
): readonly ResourcePagePanelSelectionProfile[] {
  const selectionTerms = collectObjectTerms(
    quads,
    presentationSubject,
    HAS_RESOURCE_PAGE_PANEL_SELECTION_IRI,
  );
  if (selectionTerms.length === 0) {
    throw new EffectiveConfigError(
      `Expected at least one ${HAS_RESOURCE_PAGE_PANEL_SELECTION_IRI} value in ${source}`,
    );
  }

  return selectionTerms.map((selectionTerm) =>
    parseResourcePagePanelSelection(quads, selectionTerm, source)
  ).sort((left, right) =>
    left.order === right.order
      ? left.iri.localeCompare(right.iri)
      : left.order - right.order
  );
}

function parseResourcePagePanelSelection(
  quads: readonly Quad[],
  selectionTerm: string,
  source: string,
): ResourcePagePanelSelectionProfile {
  const selectionIri = requireNamedNodeTermIri(
    selectionTerm,
    HAS_RESOURCE_PAGE_PANEL_SELECTION_IRI,
    source,
  );
  const panel = requireSingleKnownNamedNode(
    quads,
    selectionTerm,
    HAS_RESOURCE_PAGE_PANEL_IRI,
    RESOURCE_PAGE_PANEL_VALUES,
    source,
  );
  const dataRequirements = collectKnownNamedNodes(
    quads,
    selectionTerm,
    HAS_PANEL_DATA_REQUIREMENT_IRI,
    RESOURCE_PAGE_PANEL_DATA_REQUIREMENT_VALUES,
    source,
  ).map((value) => value.identity).sort();
  if (dataRequirements.length === 0) {
    throw new EffectiveConfigError(
      `Expected at least one ${HAS_PANEL_DATA_REQUIREMENT_IRI} value in ${source}`,
    );
  }

  return {
    iri: selectionIri,
    panelIri: panel.iri,
    panel: panel.identity,
    order: requireSingleNonNegativeInteger(
      quads,
      selectionTerm,
      PANEL_ORDER_IRI,
      source,
    ),
    inclusionPolicy: requireSingleKnownNamedNode(
      quads,
      selectionTerm,
      HAS_PANEL_INCLUSION_POLICY_IRI,
      RESOURCE_PAGE_PANEL_INCLUSION_POLICY_VALUES,
      source,
    ).identity,
    targetPageKinds: collectKnownNamedNodes(
      quads,
      selectionTerm,
      HAS_PANEL_TARGET_PAGE_KIND_IRI,
      RESOURCE_PAGE_KIND_VALUES,
      source,
    ).map((value) => value.identity).sort(),
    targetClasses: [...collectNamedNodeObjects(
      quads,
      selectionTerm,
      HAS_PANEL_TARGET_CLASS_IRI,
    )].sort(),
    targetArtifactRoles: collectKnownNamedNodes(
      quads,
      selectionTerm,
      HAS_PANEL_TARGET_ARTIFACT_ROLE_IRI,
      ARTIFACT_ROLE_VALUES,
      source,
    ).map((value) => value.identity).sort(),
    dataRequirements,
  };
}

function parseTurtle(turtle: string, source: string): readonly Quad[] {
  try {
    return new Parser({ baseIRI: toParserBaseIri(source) }).parse(turtle);
  } catch {
    throw new EffectiveConfigError(
      `Could not parse effective config: ${source}`,
    );
  }
}

function requireSingleTypedSubject(
  quads: readonly Quad[],
  typeIri: string,
  source: string,
): string {
  const subjects = new Set<string>();

  for (const quad of quads) {
    if (
      quad.predicate.value !== RDF_TYPE_IRI ||
      quad.object.termType !== "NamedNode" ||
      quad.object.value !== typeIri
    ) {
      continue;
    }
    if (
      quad.subject.termType !== "NamedNode" &&
      quad.subject.termType !== "BlankNode"
    ) {
      continue;
    }

    subjects.add(toTermKey(quad.subject));
  }

  if (subjects.size !== 1) {
    throw new EffectiveConfigError(
      `Expected exactly one ${typeIri} subject in ${source}`,
    );
  }

  return [...subjects][0]!;
}

function requireSingleNamedValue<T extends string>(
  quads: readonly Quad[],
  subject: string,
  predicateIri: string,
  values: Record<string, T>,
  source: string,
): T {
  const namedNodes = collectNamedNodeObjects(quads, subject, predicateIri);
  if (namedNodes.length !== 1) {
    throw new EffectiveConfigError(
      `Expected exactly one ${predicateIri} value in ${source}`,
    );
  }

  const value = values[namedNodes[0]!];
  if (value === undefined) {
    throw new EffectiveConfigError(
      `Unsupported ${predicateIri} value in ${source}: ${namedNodes[0]!}`,
    );
  }

  return value;
}

function requireSingleKnownNamedNode<T extends string>(
  quads: readonly Quad[],
  subject: string,
  predicateIri: string,
  values: Record<string, T>,
  source: string,
): { iri: string; identity: T } {
  const namedNodes = collectKnownNamedNodes(
    quads,
    subject,
    predicateIri,
    values,
    source,
  );
  if (namedNodes.length !== 1) {
    throw new EffectiveConfigError(
      `Expected exactly one ${predicateIri} value in ${source}`,
    );
  }

  return namedNodes[0]!;
}

function collectKnownNamedNodes<T extends string>(
  quads: readonly Quad[],
  subject: string,
  predicateIri: string,
  values: Record<string, T>,
  source: string,
): readonly { iri: string; identity: T }[] {
  return collectNamedNodeObjects(quads, subject, predicateIri).map((iri) => {
    const identity = values[iri];
    if (identity === undefined) {
      throw new EffectiveConfigError(
        `Unsupported ${predicateIri} value in ${source}: ${iri}`,
      );
    }

    return { iri, identity };
  });
}

function requireNamedNodeTermIri(
  termKey: string,
  predicateIri: string,
  source: string,
): string {
  if (!termKey.startsWith("NamedNode:")) {
    throw new EffectiveConfigError(
      `Expected ${predicateIri} values to be named nodes in ${source}`,
    );
  }

  return termKey.slice("NamedNode:".length);
}

function requireSingleNonNegativeInteger(
  quads: readonly Quad[],
  subject: string,
  predicateIri: string,
  source: string,
): number {
  const values = quads.filter((quad) =>
    toTermKey(quad.subject) === subject &&
    quad.predicate.value === predicateIri &&
    quad.object.termType === "Literal"
  );

  if (values.length !== 1) {
    throw new EffectiveConfigError(
      `Expected exactly one ${predicateIri} literal in ${source}`,
    );
  }

  const literal = values[0]!.object;
  if (
    literal.termType !== "Literal" ||
    literal.datatype.value !== XSD_NON_NEGATIVE_INTEGER_IRI ||
    !/^(0|[1-9]\d*)$/.test(literal.value)
  ) {
    throw new EffectiveConfigError(
      `Expected ${predicateIri} to be xsd:nonNegativeInteger in ${source}`,
    );
  }

  const value = Number(literal.value);
  if (!Number.isSafeInteger(value)) {
    throw new EffectiveConfigError(
      `Integer value for ${predicateIri} is too large in ${source}`,
    );
  }

  return value;
}

function collectNamedNodeObjects(
  quads: readonly Quad[],
  subject: string,
  predicateIri: string,
): readonly string[] {
  return collectObjectTerms(quads, subject, predicateIri).filter((value) =>
    value.startsWith("NamedNode:")
  ).map((value) => value.slice("NamedNode:".length));
}

function collectObjectTerms(
  quads: readonly Quad[],
  subject: string,
  predicateIri: string,
): readonly string[] {
  const values = new Set<string>();

  for (const quad of quads) {
    if (
      toTermKey(quad.subject) !== subject ||
      quad.predicate.value !== predicateIri
    ) {
      continue;
    }

    values.add(toTermKey(quad.object));
  }

  return [...values];
}

function toTermKey(term: Term): string {
  return `${term.termType}:${term.value}`;
}

function resolveDefaultsFile(
  defaultsRoot: string | URL | undefined,
  fileName: string,
): string | URL {
  if (defaultsRoot instanceof URL) {
    return new URL(fileName, ensureDirectoryUrl(defaultsRoot));
  }
  if (typeof defaultsRoot === "string") {
    return join(defaultsRoot, fileName);
  }

  return new URL(fileName, WEAVE_DEFAULTS_ROOT);
}

function ensureDirectoryUrl(url: URL): URL {
  return url.href.endsWith("/") ? url : new URL(`${url.href}/`);
}

function formatSource(source: string | URL): string {
  return source instanceof URL ? source.href : source;
}

function toParserBaseIri(source: string): string {
  try {
    return new URL(source).href;
  } catch {
    return toFileUrl(resolve(source)).href;
  }
}
