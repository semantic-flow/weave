import { join, resolve, toFileUrl } from "@std/path";
import * as pathPosix from "@std/path/posix";
import { Parser, type Quad, type Term } from "n3";
import {
  RDF_NAMESPACE,
  SFCFG_NAMESPACE,
  SFLO_NAMESPACE,
} from "../../core/rdf/namespaces.ts";
import {
  type ConfigSourceResolutionTraceEntry,
  discoverKnopConfigSources,
  discoverMeshLocalConfigSources,
  type KnopConfigScopeInput,
  type LayeredConfigInput,
  type MeshLocalConfigInput,
} from "./config_sources.ts";
import type { OperationalLocalPathPolicy } from "../operational/local_path_policy.ts";

const RDF_TYPE_IRI = `${RDF_NAMESPACE}type`;
const APPLICATION_CONFIG_IRI = `${SFCFG_NAMESPACE}ApplicationConfig`;
const MESH_CONFIG_IRI = `${SFCFG_NAMESPACE}MeshConfig`;
const CONFIG_RESOLUTION_CONFIG_IRI = `${SFCFG_NAMESPACE}ConfigResolutionConfig`;
const POLICY_BINDING_IRI = `${SFCFG_NAMESPACE}PolicyBinding`;
const POLICY_DEFINITION_IRI = `${SFCFG_NAMESPACE}PolicyDefinition`;
const ANY_GOVERNED_ARTIFACT_POLICY_TARGET_IRI =
  `${SFCFG_NAMESPACE}AnyGovernedArtifactPolicyTarget`;
const ARTIFACT_ROLE_POLICY_TARGET_IRI =
  `${SFCFG_NAMESPACE}ArtifactRolePolicyTarget`;
const EXACT_ARTIFACT_POLICY_TARGET_IRI =
  `${SFCFG_NAMESPACE}ExactArtifactPolicyTarget`;
const HAS_POLICY_BINDING_IRI = `${SFCFG_NAMESPACE}hasPolicyBinding`;
const HAS_CONFIG_RESOLUTION_CONFIG_IRI =
  `${SFCFG_NAMESPACE}hasConfigResolutionConfig`;
const BINDS_POLICY_IRI = `${SFCFG_NAMESPACE}bindsPolicy`;
const APPLIES_TO_POLICY_TARGET_IRI = `${SFCFG_NAMESPACE}appliesToPolicyTarget`;
const POLICY_PRIORITY_IRI = `${SFCFG_NAMESPACE}policyPriority`;
const HAS_ARTIFACT_ROLE_IRI = `${SFCFG_NAMESPACE}hasArtifactRole`;
const TARGETS_ARTIFACT_IRI = `${SFCFG_NAMESPACE}targetsArtifact`;
const HAS_HISTORY_TRACKING_POLICY_IRI =
  `${SFCFG_NAMESPACE}hasHistoryTrackingPolicy`;
const HAS_RESOURCE_PAGE_GENERATION_POLICY_IRI =
  `${SFCFG_NAMESPACE}hasResourcePageGenerationPolicy`;
const HAS_RESOURCE_PAGE_PRESENTATION_POLICY_IRI =
  `${SFCFG_NAMESPACE}hasResourcePagePresentationPolicy`;
const HAS_RESOURCE_PAGE_REGENERATION_CONFIG_POLICY_IRI =
  `${SFCFG_NAMESPACE}hasResourcePageRegenerationConfigPolicy`;
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
const HAS_PUBLICATION_PROFILE_IRI = `${SFCFG_NAMESPACE}hasPublicationProfile`;
const WORKSPACE_ROOT_RELATIVE_TO_MESH_ROOT_IRI =
  `${SFCFG_NAMESPACE}workspaceRootRelativeToMeshRoot`;
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
const XSD_INTEGER_IRI = "http://www.w3.org/2001/XMLSchema#integer";
const XSD_NON_NEGATIVE_INTEGER_IRI =
  "http://www.w3.org/2001/XMLSchema#nonNegativeInteger";
const XSD_STRING_IRI = "http://www.w3.org/2001/XMLSchema#string";
const SFLO_DIGITAL_ARTIFACT_IRI = `${SFLO_NAMESPACE}DigitalArtifact`;
const SFLO_PAYLOAD_ARTIFACT_IRI = `${SFLO_NAMESPACE}PayloadArtifact`;
const SFLO_MESH_INVENTORY_IRI = `${SFLO_NAMESPACE}MeshInventory`;
const SFLO_KNOP_INVENTORY_IRI = `${SFLO_NAMESPACE}KnopInventory`;
const SFLO_MESH_METADATA_IRI = `${SFLO_NAMESPACE}MeshMetadata`;
const SFLO_KNOP_METADATA_IRI = `${SFLO_NAMESPACE}KnopMetadata`;
const SFLO_REFERENCE_CATALOG_IRI = `${SFLO_NAMESPACE}ReferenceCatalog`;
const SFLO_KNOP_SOURCE_REGISTRY_IRI = `${SFLO_NAMESPACE}KnopSourceRegistry`;
const SFLO_RESOURCE_PAGE_DEFINITION_IRI =
  `${SFLO_NAMESPACE}ResourcePageDefinition`;
const SFCFG_CONFIG_ARTIFACT_IRI = `${SFCFG_NAMESPACE}ConfigArtifact`;
const SFCFG_RESOURCE_PAGE_TEMPLATE_IRI =
  `${SFCFG_NAMESPACE}ResourcePageTemplate`;
const SFCFG_RESOURCE_PAGE_STYLESHEET_IRI =
  `${SFCFG_NAMESPACE}ResourcePageStylesheet`;

const GOVERNED_ARTIFACT_TYPE_IRIS = new Set([
  SFLO_DIGITAL_ARTIFACT_IRI,
  SFLO_PAYLOAD_ARTIFACT_IRI,
  SFLO_MESH_INVENTORY_IRI,
  SFLO_KNOP_INVENTORY_IRI,
  SFLO_MESH_METADATA_IRI,
  SFLO_KNOP_METADATA_IRI,
  SFLO_REFERENCE_CATALOG_IRI,
  SFLO_KNOP_SOURCE_REGISTRY_IRI,
  SFLO_RESOURCE_PAGE_DEFINITION_IRI,
  SFCFG_CONFIG_ARTIFACT_IRI,
  MESH_CONFIG_IRI,
  SFCFG_RESOURCE_PAGE_TEMPLATE_IRI,
  SFCFG_RESOURCE_PAGE_STYLESHEET_IRI,
]);

const RETIRED_DIRECT_POLICY_PREDICATES = [
  `${SFCFG_NAMESPACE}hasDefaultHistoryTrackingPolicy`,
  `${SFCFG_NAMESPACE}hasHistoryTrackingDefault`,
  `${SFCFG_NAMESPACE}hasDefaultResourcePageGenerationPolicy`,
  `${SFCFG_NAMESPACE}hasResourcePageGenerationDefault`,
  `${SFCFG_NAMESPACE}hasDefaultResourcePagePresentationConfig`,
] as const;

const WEAVE_DEFAULTS_ROOT = new URL("../../../defaults/", import.meta.url);
export const WEAVE_DEFAULTS_NAMESPACE =
  "https://semantic-flow.github.io/weave/defaults/";

const DEFAULT_RESOURCE_PAGE_PRESENTATION_IRI =
  `${WEAVE_DEFAULTS_NAMESPACE}resource-page-presentation/semantic-site-default`;
const ALL_PANELS_RESOURCE_PAGE_PRESENTATION_IRI =
  `${WEAVE_DEFAULTS_NAMESPACE}resource-page-presentation/semantic-site-all-panels`;
const NO_PANELS_RESOURCE_PAGE_PRESENTATION_IRI =
  `${WEAVE_DEFAULTS_NAMESPACE}resource-page-presentation/semantic-site-no-panels`;
const DEFAULT_OUTER_RESOURCE_PAGE_TEMPLATE_IRI =
  `${WEAVE_DEFAULTS_NAMESPACE}resource-page-template/semantic-site/outer`;
const DEFAULT_INNER_RESOURCE_PAGE_TEMPLATE_IRI =
  `${WEAVE_DEFAULTS_NAMESPACE}resource-page-template/semantic-site/inner`;
const DEFAULT_RESOURCE_PAGE_STYLESHEET_IRI =
  `${WEAVE_DEFAULTS_NAMESPACE}stylesheet`;

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

const PUBLICATION_PROFILE_VALUES = {
  [`${SFCFG_NAMESPACE}publicationProfile_none`]: "none",
  [`${SFCFG_NAMESPACE}publicationProfile_githubPages`]: "githubPages",
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
  [`${SFCFG_NAMESPACE}configLayerRole_meshLocal`]: "meshLocal",
  [`${SFCFG_NAMESPACE}configLayerRole_knopInherited`]: "knopInherited",
  [`${SFCFG_NAMESPACE}configLayerRole_knopLocal`]: "knopLocal",
  [`${SFCFG_NAMESPACE}configLayerRole_knopInheritable`]: "knopInheritable",
  [`${SFCFG_NAMESPACE}configLayerRole_resolvedRuntime`]: "resolvedRuntime",
} as const;

const RESOURCE_PAGE_PRESENTATION_VALUES = {
  [DEFAULT_RESOURCE_PAGE_PRESENTATION_IRI]: "semanticSiteDefault",
  [ALL_PANELS_RESOURCE_PAGE_PRESENTATION_IRI]: "semanticSiteAllPanels",
  [NO_PANELS_RESOURCE_PAGE_PRESENTATION_IRI]: "semanticSiteNoPanels",
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
  [`${SFCFG_NAMESPACE}panelDataRequirement_semanticFlowMetadata`]:
    "semanticFlowMetadata",
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
export type ConfigPublicationProfile = ValueOf<
  typeof PUBLICATION_PROFILE_VALUES
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
  | ValueOf<typeof OUTER_RESOURCE_PAGE_TEMPLATE_VALUES>
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

export interface MeshScopedSettings {
  publicationProfile?: ConfigPublicationProfile;
  workspaceRootRelativeToMeshRoot?: string;
}

export interface EffectiveScopedSettings {
  mesh: MeshScopedSettings;
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

const DEFAULT_PANEL_SELECTIONS: readonly ResourcePagePanelSelectionProfile[] = [
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
    panelIri: `${WEAVE_DEFAULTS_NAMESPACE}resource-page-panel/current-links`,
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
    panelIri: `${WEAVE_DEFAULTS_NAMESPACE}resource-page-panel/knop-artifacts`,
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
    panelIri: `${WEAVE_DEFAULTS_NAMESPACE}resource-page-panel/fact-sections`,
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
];

const SEMANTIC_FLOW_METADATA_PANEL_SELECTION:
  ResourcePagePanelSelectionProfile = {
    iri:
      `${ALL_PANELS_RESOURCE_PAGE_PRESENTATION_IRI}#semantic-flow-metadata-panel`,
    panelIri:
      `${WEAVE_DEFAULTS_NAMESPACE}resource-page-panel/semantic-flow-metadata`,
    panel: "semanticFlowMetadata",
    order: 80,
    inclusionPolicy: "auto",
    targetPageKinds: ["identifier", "knop", "referenceCatalog", "simple"],
    targetClasses: [],
    targetArtifactRoles: [],
    dataRequirements: ["semanticFlowMetadata"],
  };

function builtinPresentationProfile(
  iri: string,
  identity: ResourcePagePresentationIdentity,
  panelSelections: readonly ResourcePagePanelSelectionProfile[],
): ResourcePagePresentationProfile {
  return {
    iri,
    identity,
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
    panelSelections,
  };
}

export const DEFAULT_RESOURCE_PAGE_PRESENTATION_PROFILE =
  builtinPresentationProfile(
    DEFAULT_RESOURCE_PAGE_PRESENTATION_IRI,
    "semanticSiteDefault",
    DEFAULT_PANEL_SELECTIONS,
  );

export const ALL_PANELS_RESOURCE_PAGE_PRESENTATION_PROFILE =
  builtinPresentationProfile(
    ALL_PANELS_RESOURCE_PAGE_PRESENTATION_IRI,
    "semanticSiteAllPanels",
    [...DEFAULT_PANEL_SELECTIONS, SEMANTIC_FLOW_METADATA_PANEL_SELECTION],
  );

export const NO_PANELS_RESOURCE_PAGE_PRESENTATION_PROFILE =
  builtinPresentationProfile(
    NO_PANELS_RESOURCE_PAGE_PRESENTATION_IRI,
    "semanticSiteNoPanels",
    [],
  );

export interface EffectiveConfigSources {
  applicationSource: string;
  configResolutionSource: string;
  meshConfigSource?: string;
  meshConfigSources?: readonly string[];
  knopConfigSources?: readonly string[];
  commandOverrideSource?: string;
}

export interface LoadWeaveDefaultEffectiveConfigOptions {
  defaultsRoot?: string | URL;
}

export interface CompileWeaveEffectiveConfigCommandOverrides {
  historyTrackingPolicy?: HistoryTrackingPolicy;
  resourcePagePresentation?: ResourcePagePresentationIdentity;
}

export interface CompileWeaveEffectiveConfigOptions {
  defaultsRoot?: string | URL;
  meshConfigTurtle?: string;
  meshConfigSource?: string;
  meshConfigInputs?: readonly MeshLocalConfigInput[];
  meshRoot?: string;
  meshMetadataTurtle?: string;
  meshMetadataSource?: string;
  meshBase?: string;
  meshInventoryTurtle?: string;
  localPathPolicy?: OperationalLocalPathPolicy;
  governedArtifactIris?: readonly string[];
  knopConfigScopePath?: readonly KnopConfigScopeInput[];
  commandOverrides?: CompileWeaveEffectiveConfigCommandOverrides;
}

type PolicySlot =
  | "historyTracking"
  | "resourcePageGeneration"
  | "resourcePagePresentation";

type PolicyValueBySlot = {
  historyTracking?: HistoryTrackingPolicy;
  resourcePageGeneration?: ResourcePageGenerationPolicy;
  resourcePagePresentation?: ResourcePagePresentationIdentity;
};

type PolicyTarget =
  | { kind: "anyGovernedArtifact" }
  | { kind: "artifactRole"; artifactRole: ArtifactRole }
  | { kind: "exactArtifact"; artifactIri: string };

interface PolicyTargetDescriptor {
  artifactIri?: string;
  artifactRoles: readonly ArtifactRole[];
}

export interface ArtifactPolicyTargetQuery {
  artifactIri: string;
  artifactRole: ArtifactRole;
}

interface PolicyTargetValidationContext {
  governedArtifactIris?: ReadonlySet<string>;
}

interface CompiledPolicyBinding {
  source: string;
  sourceOrder: number;
  layerRole: ConfigLayerRole;
  layerOrder: number;
  bindingTerm: string;
  target: PolicyTarget;
  priority: number;
  values: PolicyValueBySlot;
}

interface ScopedSettingLayer {
  quads: readonly Quad[];
  configSubject: string;
  source: string;
  sourceOrder: number;
  layerRole: ConfigLayerRole;
  layerOrder: number;
}

interface ParsedLayeredConfigInput {
  quads: readonly Quad[];
  configSubject?: string;
  source: string;
  sourceOrder: number;
  layerRole: Extract<
    ConfigLayerRole,
    "meshLocal" | "knopInherited" | "knopLocal"
  >;
}

export interface PolicyResolutionTraceEntry {
  slot: PolicySlot;
  artifactIri?: string;
  artifactRoles: readonly ArtifactRole[];
  selectedValue: string;
  selectedLayerRole: ConfigLayerRole;
  selectedSource: string;
  selectedSourceOrder: number;
  selectedTargetKind: PolicyTarget["kind"];
  candidateCount: number;
}

export type EffectiveConfigResolutionTraceEntry =
  | PolicyResolutionTraceEntry
  | ConfigSourceResolutionTraceEntry;

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
  readonly scopedSettings: EffectiveScopedSettings;
  readonly resolutionTrace: EffectiveConfigResolutionTraceEntry[];
  readonly #policyBindings: readonly CompiledPolicyBinding[];
  readonly #presentationProfiles: ReadonlyMap<
    ResourcePagePresentationIdentity,
    ResourcePagePresentationProfile
  >;

  constructor(
    input: {
      sources: EffectiveConfigSources;
      policyBindings: readonly CompiledPolicyBinding[];
      resourcePagePresentationProfiles: ReadonlyMap<
        ResourcePagePresentationIdentity,
        ResourcePagePresentationProfile
      >;
      resourcePageRegenerationConfigPolicy:
        ResourcePageRegenerationConfigPolicy;
      namingPolicies: DefaultNamingPolicies;
      scopedSettings: EffectiveScopedSettings;
      configResolution: DefaultConfigResolutionProfile;
      resolutionTrace?: readonly ConfigSourceResolutionTraceEntry[];
    },
  ) {
    this.sources = input.sources;
    this.#policyBindings = input.policyBindings;
    this.#presentationProfiles = input.resourcePagePresentationProfiles;
    this.resourcePageRegenerationConfigPolicy =
      input.resourcePageRegenerationConfigPolicy;
    this.namingPolicies = input.namingPolicies;
    this.scopedSettings = input.scopedSettings;
    this.configResolution = input.configResolution;
    this.resolutionTrace = [...(input.resolutionTrace ?? [])];
    this.resourcePagePresentation = this
      .resourcePagePresentationPolicyForTarget({ artifactRoles: [] });
  }

  historyTrackingPolicyForArtifactRole(
    artifactRole: ArtifactRole,
  ): HistoryTrackingPolicy {
    return this.resolvePolicyValue("historyTracking", {
      artifactRoles: [artifactRole],
    }) as HistoryTrackingPolicy;
  }

  historyTrackingPolicyForArtifactTarget(
    target: ArtifactPolicyTargetQuery,
  ): HistoryTrackingPolicy {
    return this.resolvePolicyValue("historyTracking", {
      artifactIri: target.artifactIri,
      artifactRoles: [target.artifactRole],
    }) as HistoryTrackingPolicy;
  }

  resourcePageGenerationPolicyForArtifactRole(
    artifactRole: ArtifactRole,
  ): ResourcePageGenerationPolicy {
    return this.resolvePolicyValue("resourcePageGeneration", {
      artifactRoles: [artifactRole],
    }) as ResourcePageGenerationPolicy;
  }

  resourcePageGenerationPolicyForArtifactTarget(
    target: ArtifactPolicyTargetQuery,
  ): ResourcePageGenerationPolicy {
    return this.resolvePolicyValue("resourcePageGeneration", {
      artifactIri: target.artifactIri,
      artifactRoles: [target.artifactRole],
    }) as ResourcePageGenerationPolicy;
  }

  resourcePagePresentationPolicyForArtifactRole(
    artifactRole: ArtifactRole,
  ): ResourcePagePresentationProfile {
    return this.resourcePagePresentationPolicyForTarget({
      artifactRoles: [artifactRole],
    });
  }

  resourcePagePresentationPolicyForArtifactTarget(
    target: ArtifactPolicyTargetQuery,
  ): ResourcePagePresentationProfile {
    return this.resourcePagePresentationPolicyForTarget({
      artifactIri: target.artifactIri,
      artifactRoles: [target.artifactRole],
    });
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

  artifactTargetPolicy(
    target: ArtifactPolicyTargetQuery,
  ): ArtifactRoleEffectivePolicy {
    return {
      historyTrackingPolicy: this.historyTrackingPolicyForArtifactTarget(
        target,
      ),
      resourcePageGenerationPolicy: this
        .resourcePageGenerationPolicyForArtifactTarget(target),
    };
  }

  private resourcePagePresentationPolicyForTarget(
    target: PolicyTargetDescriptor,
  ): ResourcePagePresentationProfile {
    const identity = this.resolvePolicyValue(
      "resourcePagePresentation",
      target,
    ) as ResourcePagePresentationIdentity;
    const profile = this.#presentationProfiles.get(identity);
    if (!profile) {
      throw new EffectiveConfigError(
        `Resolved ResourcePage presentation profile is unavailable: ${identity}`,
      );
    }
    return profile;
  }

  private resolvePolicyValue(
    slot: PolicySlot,
    target: PolicyTargetDescriptor,
  ): string {
    const candidates = this.#policyBindings
      .filter((binding) =>
        policyValueForSlot(binding.values, slot) !==
          undefined
      )
      .filter((binding) => policyTargetCovers(binding.target, target));

    if (candidates.length === 0) {
      throw new EffectiveConfigError(
        `No policy binding resolved for ${slot}`,
      );
    }

    const highestLayerOrder = Math.max(
      ...candidates.map((binding) => binding.layerOrder),
    );
    const layerWinners = candidates.filter((binding) =>
      binding.layerOrder === highestLayerOrder
    );
    const highestSpecificity = Math.max(
      ...layerWinners.map((binding) => policyTargetSpecificity(binding.target)),
    );
    const specificityWinners = layerWinners.filter((binding) =>
      policyTargetSpecificity(binding.target) === highestSpecificity
    );
    const highestPriority = Math.max(
      ...specificityWinners.map((binding) => binding.priority),
    );
    const priorityWinners = specificityWinners.filter((binding) =>
      binding.priority === highestPriority
    );
    const earliestSourceOrder = Math.min(
      ...priorityWinners.map((binding) => binding.sourceOrder),
    );
    const sourceOrderWinners = priorityWinners.filter((binding) =>
      binding.sourceOrder === earliestSourceOrder
    );
    const values = new Set(
      sourceOrderWinners.map((binding) =>
        policyValueForSlot(binding.values, slot)!
      ),
    );

    if (values.size !== 1) {
      const conflictingValues = [...values].sort();
      const conflictingBindings = sourceOrderWinners.map((binding) => ({
        source: binding.source,
        sourceOrder: binding.sourceOrder,
        layerRole: binding.layerRole,
        layerOrder: binding.layerOrder,
        bindingTerm: binding.bindingTerm,
        target: binding.target,
        priority: binding.priority,
        value: policyValueForSlot(binding.values, slot),
      }));
      throw new EffectiveConfigError(
        `Conflicting ${slot} policy bindings at the same layer, specificity, priority, and source order; values=${
          JSON.stringify(conflictingValues)
        }; bindings=${JSON.stringify(conflictingBindings)}`,
      );
    }

    const selected = sourceOrderWinners[0]!;
    const selectedValue = values.values().next().value!;
    this.resolutionTrace.push({
      slot,
      ...(target.artifactIri ? { artifactIri: target.artifactIri } : {}),
      artifactRoles: target.artifactRoles,
      selectedValue,
      selectedLayerRole: selected.layerRole,
      selectedSource: selected.source,
      selectedSourceOrder: selected.sourceOrder,
      selectedTargetKind: selected.target.kind,
      candidateCount: candidates.length,
    });
    return selectedValue;
  }
}

export async function loadWeaveDefaultEffectiveConfig(
  options: LoadWeaveDefaultEffectiveConfigOptions = {},
): Promise<EffectiveConfig> {
  return await loadWeaveEffectiveConfig({ defaultsRoot: options.defaultsRoot });
}

export async function loadWeaveEffectiveConfig(
  options: CompileWeaveEffectiveConfigOptions = {},
): Promise<EffectiveConfig> {
  const applicationSource = resolveDefaultsFile(
    options.defaultsRoot,
    "application.ttl",
  );
  const configResolutionSource = resolveDefaultsFile(
    options.defaultsRoot,
    "config-resolution.ttl",
  );
  const seedMeshConfigInputs = options.meshConfigInputs ??
    (options.meshConfigTurtle
      ? [{
        turtle: options.meshConfigTurtle,
        source: options.meshConfigSource ?? "mesh-config.ttl",
      }]
      : []);
  let resolvedMeshConfigInputs: readonly MeshLocalConfigInput[] = [];
  let resolvedKnopConfigInputs: readonly LayeredConfigInput[] = [];
  let configSourceResolutionTrace: readonly ConfigSourceResolutionTraceEntry[] =
    [];

  if (
    (seedMeshConfigInputs.length > 0 || options.meshMetadataTurtle) &&
    options.meshRoot &&
    options.meshBase &&
    options.localPathPolicy
  ) {
    try {
      const discovery = await discoverMeshLocalConfigSources({
        meshRoot: options.meshRoot,
        meshBase: options.meshBase,
        localPathPolicy: options.localPathPolicy,
        seedDocuments: [
          ...seedMeshConfigInputs,
          ...(options.meshMetadataTurtle
            ? [{
              turtle: options.meshMetadataTurtle,
              source: options.meshMetadataSource ?? "_mesh/_meta/meta.ttl",
            }]
            : []),
        ],
      });
      resolvedMeshConfigInputs = discovery.configInputs;
      configSourceResolutionTrace = discovery.resolutionTrace;
    } catch (error) {
      if (error instanceof EffectiveConfigError) {
        throw error;
      }
      throw new EffectiveConfigError(
        error instanceof Error
          ? error.message
          : `Could not discover mesh-local config sources: ${String(error)}`,
      );
    }
  }

  if (
    options.knopConfigScopePath &&
    options.knopConfigScopePath.length > 0 &&
    options.meshRoot &&
    options.meshBase &&
    options.localPathPolicy
  ) {
    try {
      const discovery = await discoverKnopConfigSources({
        meshRoot: options.meshRoot,
        meshBase: options.meshBase,
        localPathPolicy: options.localPathPolicy,
        knopScopePath: options.knopConfigScopePath,
      });
      resolvedKnopConfigInputs = discovery.configInputs;
      configSourceResolutionTrace = [
        ...configSourceResolutionTrace,
        ...discovery.resolutionTrace,
      ];
    } catch (error) {
      if (error instanceof EffectiveConfigError) {
        throw error;
      }
      throw new EffectiveConfigError(
        error instanceof Error
          ? error.message
          : `Could not discover Knop config sources: ${String(error)}`,
      );
    }
  }

  const meshConfigInputs = [
    ...seedMeshConfigInputs,
    ...resolvedMeshConfigInputs,
  ];
  const meshConfigSources = meshConfigInputs.map((input) => input.source);
  const firstMeshConfigSource = meshConfigSources[0];
  const knopConfigSources = resolvedKnopConfigInputs.map((input) =>
    input.source
  );

  return compileWeaveEffectiveConfig({
    applicationTurtle: await Deno.readTextFile(applicationSource),
    configResolutionTurtle: await Deno.readTextFile(configResolutionSource),
    meshConfigInputs,
    meshBase: options.meshBase,
    meshInventoryTurtle: options.meshInventoryTurtle,
    knopConfigInputs: resolvedKnopConfigInputs,
    governedArtifactIris: options.governedArtifactIris,
    commandOverrides: options.commandOverrides,
    sources: {
      applicationSource: formatSource(applicationSource),
      configResolutionSource: formatSource(configResolutionSource),
      ...(firstMeshConfigSource
        ? { meshConfigSource: firstMeshConfigSource }
        : {}),
      ...(meshConfigSources.length > 0 ? { meshConfigSources } : {}),
      ...(knopConfigSources.length > 0 ? { knopConfigSources } : {}),
    },
    configSourceResolutionTrace,
  });
}

export function parseWeaveDefaultEffectiveConfig(
  applicationTurtle: string,
  configResolutionTurtle: string,
  sources: EffectiveConfigSources = {
    applicationSource: "application.ttl",
    configResolutionSource: "config-resolution.ttl",
  },
): EffectiveConfig {
  return compileWeaveEffectiveConfig({
    applicationTurtle,
    configResolutionTurtle,
    sources,
  });
}

export function compileWeaveEffectiveConfig(input: {
  applicationTurtle: string;
  configResolutionTurtle: string;
  meshConfigTurtle?: string;
  meshConfigInputs?: readonly MeshLocalConfigInput[];
  knopConfigInputs?: readonly LayeredConfigInput[];
  meshBase?: string;
  meshInventoryTurtle?: string;
  governedArtifactIris?: readonly string[];
  commandOverrides?: CompileWeaveEffectiveConfigCommandOverrides;
  sources?: EffectiveConfigSources;
  configSourceResolutionTrace?: readonly ConfigSourceResolutionTraceEntry[];
}): EffectiveConfig {
  const meshConfigInputs = input.meshConfigInputs ??
    (input.meshConfigTurtle
      ? [{
        turtle: input.meshConfigTurtle,
        source: input.sources?.meshConfigSource ?? "mesh-config.ttl",
      }]
      : []);
  const knopConfigInputs = input.knopConfigInputs ?? [];
  const sources = input.sources ?? {
    applicationSource: "application.ttl",
    configResolutionSource: "config-resolution.ttl",
    ...(meshConfigInputs.length > 0
      ? { meshConfigSource: meshConfigInputs[0]!.source }
      : {}),
    ...(meshConfigInputs.length > 0
      ? {
        meshConfigSources: meshConfigInputs.map((document) => document.source),
      }
      : {}),
    ...(knopConfigInputs.length > 0
      ? {
        knopConfigSources: knopConfigInputs.map((document) => document.source),
      }
      : {}),
  };
  const applicationQuads = parseTurtle(
    input.applicationTurtle,
    sources.applicationSource,
  );
  const meshDocuments = meshConfigInputs.map((document, index) =>
    parseLayeredConfigInput({
      ...document,
      layerRole: "meshLocal",
      sourceOrder: index,
    })
  );
  const knopDocuments = knopConfigInputs.map(parseLayeredConfigInput);
  const configDocuments = [...meshDocuments, ...knopDocuments];
  const configQuads = configDocuments.flatMap((document) => document.quads);
  const configResolutionQuads = parseTurtle(
    input.configResolutionTurtle,
    sources.configResolutionSource,
  );
  const configResolution = parseConfigResolutionProfile(
    configResolutionQuads,
    sources.configResolutionSource,
  );
  const layerOrderByRole = new Map(
    configResolution.layers.map((layer) => [layer.role, layer.order]),
  );
  const applicationSubject = requireSingleTypedSubject(
    applicationQuads,
    APPLICATION_CONFIG_IRI,
    sources.applicationSource,
  );
  requireSingleNamedNodeObject(
    applicationQuads,
    applicationSubject,
    HAS_CONFIG_RESOLUTION_CONFIG_IRI,
    sources.applicationSource,
  );
  rejectRetiredDirectPolicyPredicates(
    applicationQuads,
    sources.applicationSource,
  );
  for (const document of configDocuments) {
    rejectPortableMeshResolverConfig(
      document.quads,
      document.configSubject,
      document.source,
    );
    rejectRetiredDirectPolicyPredicates(document.quads, document.source);
  }

  const allQuads = [...applicationQuads, ...configQuads];
  const scopedSettingLayers: ScopedSettingLayer[] = [{
    quads: applicationQuads,
    configSubject: applicationSubject,
    source: sources.applicationSource,
    sourceOrder: 0,
    layerRole: "weaveDefaults",
    layerOrder: requireLayerOrder(layerOrderByRole, "weaveDefaults"),
  }];
  for (const document of configDocuments) {
    if (!document.configSubject) {
      continue;
    }
    scopedSettingLayers.push({
      quads: document.quads,
      configSubject: document.configSubject,
      source: document.source,
      sourceOrder: document.sourceOrder,
      layerRole: document.layerRole,
      layerOrder: requireLayerOrder(layerOrderByRole, document.layerRole),
    });
  }
  const targetValidation = createPolicyTargetValidationContext({
    quads: allQuads,
    meshBase: input.meshBase,
    meshInventoryTurtle: input.meshInventoryTurtle,
    governedArtifactIris: input.governedArtifactIris,
  });
  const policyBindings = [
    ...parsePolicyBindings({
      quads: applicationQuads,
      configSubject: applicationSubject,
      source: sources.applicationSource,
      sourceOrder: 0,
      layerRole: "weaveDefaults",
      layerOrderByRole,
      targetValidation,
    }),
    ...configDocuments.flatMap((document) =>
      document.configSubject
        ? parsePolicyBindings({
          quads: document.quads,
          configSubject: document.configSubject,
          source: document.source,
          sourceOrder: document.sourceOrder,
          layerRole: document.layerRole,
          layerOrderByRole,
          targetValidation,
        })
        : []
    ),
    ...compileCommandOverrideBindings(
      input.commandOverrides,
      layerOrderByRole,
      sources.commandOverrideSource ?? "command override",
    ),
  ];

  return new EffectiveConfig({
    sources,
    policyBindings,
    resourcePagePresentationProfiles: parseResourcePagePresentationProfiles(
      allQuads,
      sources.applicationSource,
    ),
    resourcePageRegenerationConfigPolicy: resolveLayeredNamedScopedSetting(
      scopedSettingLayers,
      HAS_RESOURCE_PAGE_REGENERATION_CONFIG_POLICY_IRI,
      RESOURCE_PAGE_REGENERATION_CONFIG_POLICY_VALUES,
      "ResourcePage regeneration config policy",
    ),
    namingPolicies: {
      historyNamingPolicy: resolveLayeredNamedScopedSetting(
        scopedSettingLayers,
        HAS_HISTORY_NAMING_POLICY_IRI,
        HISTORY_NAMING_POLICY_VALUES,
        "history naming policy",
      ),
      stateNamingPolicy: resolveLayeredNamedScopedSetting(
        scopedSettingLayers,
        HAS_STATE_NAMING_POLICY_IRI,
        STATE_NAMING_POLICY_VALUES,
        "state naming policy",
      ),
      manifestationNamingPolicy: resolveLayeredNamedScopedSetting(
        scopedSettingLayers,
        HAS_MANIFESTATION_NAMING_POLICY_IRI,
        MANIFESTATION_NAMING_POLICY_VALUES,
        "manifestation naming policy",
      ),
    },
    scopedSettings: {
      mesh: resolveMeshScopedSettings(
        scopedSettingLayers.filter((layer) => layer.layerRole === "meshLocal"),
      ),
    },
    configResolution,
    resolutionTrace: input.configSourceResolutionTrace,
  });
}

function parseLayeredConfigInput(
  document: LayeredConfigInput,
): ParsedLayeredConfigInput {
  const quads = parseTurtle(document.turtle, document.source);
  return {
    quads,
    source: document.source,
    sourceOrder: document.sourceOrder,
    layerRole: document.layerRole,
    configSubject: resolveOptionalMeshConfigSubject(quads, document.source),
  };
}

function resolveOptionalMeshConfigSubject(
  meshQuads: readonly Quad[],
  source: string,
): string | undefined {
  if (meshQuads.length === 0) {
    return undefined;
  }
  const meshConfigSubjects = collectTypedSubjects(meshQuads, MESH_CONFIG_IRI);
  if (meshConfigSubjects.length !== 1) {
    throw new EffectiveConfigError(
      `Expected exactly one ${MESH_CONFIG_IRI} subject in ${source}`,
    );
  }

  return meshConfigSubjects[0]!;
}

function rejectPortableMeshResolverConfig(
  meshQuads: readonly Quad[],
  meshSubject: string | undefined,
  source: string,
): void {
  if (
    meshSubject &&
    collectObjectTerms(meshQuads, meshSubject, HAS_CONFIG_RESOLUTION_CONFIG_IRI)
        .length > 0
  ) {
    throw new EffectiveConfigError(
      `Portable mesh ${HAS_CONFIG_RESOLUTION_CONFIG_IRI} declarations are not supported in ${source}`,
    );
  }
  if (
    collectTypedSubjects(meshQuads, CONFIG_RESOLUTION_CONFIG_IRI).length > 0
  ) {
    throw new EffectiveConfigError(
      `Portable mesh ${CONFIG_RESOLUTION_CONFIG_IRI} declarations are not supported in ${source}`,
    );
  }
}

function resolveMeshScopedSettings(
  meshLayers: readonly ScopedSettingLayer[],
): MeshScopedSettings {
  const workspaceRootRelativeToMeshRoot =
    resolveOptionalLayeredStringScopedSetting(
      meshLayers,
      WORKSPACE_ROOT_RELATIVE_TO_MESH_ROOT_IRI,
      "workspace root relative to mesh root",
      validateWorkspaceRootRelativeToMeshRoot,
    );
  const publicationProfile = resolveOptionalLayeredNamedScopedSetting(
    meshLayers,
    HAS_PUBLICATION_PROFILE_IRI,
    PUBLICATION_PROFILE_VALUES,
    "mesh publication profile",
  );
  const settings: MeshScopedSettings = {};
  if (publicationProfile !== undefined) {
    settings.publicationProfile = publicationProfile;
  }
  if (workspaceRootRelativeToMeshRoot !== undefined) {
    settings.workspaceRootRelativeToMeshRoot = workspaceRootRelativeToMeshRoot;
  }
  return settings;
}

function validateWorkspaceRootRelativeToMeshRoot(
  value: string,
  source: string,
): string {
  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    trimmed.includes("\\") ||
    trimmed.includes("?") ||
    trimmed.includes("#") ||
    pathPosix.isAbsolute(trimmed) ||
    /^[A-Za-z]:/.test(trimmed)
  ) {
    throw new EffectiveConfigError(
      `Invalid ${WORKSPACE_ROOT_RELATIVE_TO_MESH_ROOT_IRI} value in ${source}: ${value}`,
    );
  }

  const normalized = pathPosix.normalize(trimmed).replace(/\/+$/, "");
  if (
    normalized === "" ||
    normalized === "." ||
    /^\.\.(\/\.\.)*$/.test(normalized)
  ) {
    return trimmed;
  }

  throw new EffectiveConfigError(
    `${WORKSPACE_ROOT_RELATIVE_TO_MESH_ROOT_IRI} must resolve from the mesh root to an ancestor workspace root in ${source}: ${value}`,
  );
}

function resolveLayeredNamedScopedSetting<T extends string>(
  layers: readonly ScopedSettingLayer[],
  predicateIri: string,
  values: Record<string, T>,
  settingName: string,
): T {
  const candidates = layers.flatMap((layer) => {
    const value = requireOptionalSingleNamedValue(
      layer.quads,
      layer.configSubject,
      predicateIri,
      values,
      layer.source,
    );
    return value === undefined ? [] : [{ ...layer, value }];
  });

  if (candidates.length === 0) {
    throw new EffectiveConfigError(
      `Expected one layered ${settingName} value for ${predicateIri}`,
    );
  }

  const highestLayerOrder = Math.max(
    ...candidates.map((candidate) => candidate.layerOrder),
  );
  const winners = candidates.filter((candidate) =>
    candidate.layerOrder === highestLayerOrder
  );
  const earliestSourceOrder = Math.min(
    ...winners.map((candidate) => candidate.sourceOrder),
  );
  const sourceOrderWinners = winners.filter((candidate) =>
    candidate.sourceOrder === earliestSourceOrder
  );
  const resolvedValues = new Set(
    sourceOrderWinners.map((candidate) => candidate.value),
  );
  if (resolvedValues.size !== 1) {
    throw new EffectiveConfigError(
      `Conflicting layered ${settingName} values for ${predicateIri}; values=${
        JSON.stringify([...resolvedValues].sort())
      }; bindings=${
        JSON.stringify(
          sourceOrderWinners.map((winner) => ({
            source: winner.source,
            sourceOrder: winner.sourceOrder,
            layerRole: winner.layerRole,
            layerOrder: winner.layerOrder,
            value: winner.value,
          })),
        )
      }`,
    );
  }

  return sourceOrderWinners[0]!.value;
}

function resolveOptionalLayeredNamedScopedSetting<T extends string>(
  layers: readonly ScopedSettingLayer[],
  predicateIri: string,
  values: Record<string, T>,
  settingName: string,
): T | undefined {
  return resolveOptionalLayeredScopedSetting(
    layers,
    predicateIri,
    settingName,
    (layer) =>
      requireOptionalSingleNamedValue(
        layer.quads,
        layer.configSubject,
        predicateIri,
        values,
        layer.source,
      ),
  );
}

function resolveOptionalLayeredStringScopedSetting(
  layers: readonly ScopedSettingLayer[],
  predicateIri: string,
  settingName: string,
  transform: (value: string, source: string) => string,
): string | undefined {
  return resolveOptionalLayeredScopedSetting(
    layers,
    predicateIri,
    settingName,
    (layer) => {
      const value = requireOptionalSingleStringLiteral(
        layer.quads,
        layer.configSubject,
        predicateIri,
        layer.source,
      );
      return value === undefined ? undefined : transform(value, layer.source);
    },
  );
}

function resolveOptionalLayeredScopedSetting<T extends string>(
  layers: readonly ScopedSettingLayer[],
  predicateIri: string,
  settingName: string,
  readValue: (layer: ScopedSettingLayer) => T | undefined,
): T | undefined {
  const candidates = layers.flatMap((layer) => {
    const value = readValue(layer);
    return value === undefined ? [] : [{ ...layer, value }];
  });

  if (candidates.length === 0) {
    return undefined;
  }

  const highestLayerOrder = Math.max(
    ...candidates.map((candidate) => candidate.layerOrder),
  );
  const winners = candidates.filter((candidate) =>
    candidate.layerOrder === highestLayerOrder
  );
  const earliestSourceOrder = Math.min(
    ...winners.map((candidate) => candidate.sourceOrder),
  );
  const sourceOrderWinners = winners.filter((candidate) =>
    candidate.sourceOrder === earliestSourceOrder
  );
  const resolvedValues = new Set(
    sourceOrderWinners.map((candidate) => candidate.value),
  );
  if (resolvedValues.size !== 1) {
    throw new EffectiveConfigError(
      `Conflicting layered ${settingName} values for ${predicateIri}; values=${
        JSON.stringify([...resolvedValues].sort())
      }; bindings=${
        JSON.stringify(
          sourceOrderWinners.map((winner) => ({
            source: winner.source,
            sourceOrder: winner.sourceOrder,
            layerRole: winner.layerRole,
            layerOrder: winner.layerOrder,
            value: winner.value,
          })),
        )
      }`,
    );
  }

  return sourceOrderWinners[0]!.value;
}

function compileCommandOverrideBindings(
  commandOverrides:
    | CompileWeaveEffectiveConfigCommandOverrides
    | undefined,
  layerOrderByRole: ReadonlyMap<ConfigLayerRole, number>,
  source: string,
): readonly CompiledPolicyBinding[] {
  if (!commandOverrides) {
    return [];
  }

  const layerOrder = requireLayerOrder(layerOrderByRole, "commandOverride");
  const bindings: CompiledPolicyBinding[] = [];
  if (commandOverrides.historyTrackingPolicy) {
    bindings.push({
      source,
      sourceOrder: 0,
      layerRole: "commandOverride",
      layerOrder,
      bindingTerm: "command:historyTrackingPolicy",
      target: { kind: "anyGovernedArtifact" },
      priority: 0,
      values: { historyTracking: commandOverrides.historyTrackingPolicy },
    });
  }
  if (commandOverrides.resourcePagePresentation) {
    bindings.push({
      source,
      sourceOrder: 0,
      layerRole: "commandOverride",
      layerOrder,
      bindingTerm: "command:resourcePagePresentation",
      target: { kind: "anyGovernedArtifact" },
      priority: 0,
      values: {
        resourcePagePresentation: commandOverrides.resourcePagePresentation,
      },
    });
  }

  return bindings;
}

function createPolicyTargetValidationContext(input: {
  quads: readonly Quad[];
  meshBase?: string;
  meshInventoryTurtle?: string;
  governedArtifactIris?: readonly string[];
}): PolicyTargetValidationContext {
  const hasExactTargets = collectTypedSubjects(
    input.quads,
    EXACT_ARTIFACT_POLICY_TARGET_IRI,
  ).length > 0;
  if (!hasExactTargets) {
    return {};
  }
  if (input.governedArtifactIris !== undefined) {
    return { governedArtifactIris: new Set(input.governedArtifactIris) };
  }
  if (
    input.meshBase !== undefined && input.meshInventoryTurtle !== undefined
  ) {
    return {
      governedArtifactIris: collectGovernedArtifactIrisFromInventory(
        input.meshBase,
        input.meshInventoryTurtle,
      ),
    };
  }
  return {};
}

function collectGovernedArtifactIrisFromInventory(
  meshBase: string,
  inventoryTurtle: string,
): ReadonlySet<string> {
  const quads = parseMeshInventoryForExactPolicyTargets(
    meshBase,
    inventoryTurtle,
  );
  const governedArtifactIris = new Set<string>();

  for (const quad of quads) {
    if (
      quad.subject.termType !== "NamedNode" ||
      quad.predicate.value !== RDF_TYPE_IRI ||
      quad.object.termType !== "NamedNode" ||
      !quad.subject.value.startsWith(meshBase) ||
      !GOVERNED_ARTIFACT_TYPE_IRIS.has(quad.object.value)
    ) {
      continue;
    }
    governedArtifactIris.add(quad.subject.value);
  }

  return governedArtifactIris;
}

function parseMeshInventoryForExactPolicyTargets(
  meshBase: string,
  inventoryTurtle: string,
): readonly Quad[] {
  try {
    return new Parser({ baseIRI: meshBase }).parse(inventoryTurtle);
  } catch {
    throw new EffectiveConfigError(
      "Could not parse the current MeshInventory while compiling exact artifact policy targets.",
    );
  }
}

function parsePolicyBindings(input: {
  quads: readonly Quad[];
  configSubject: string;
  source: string;
  sourceOrder: number;
  layerRole: ConfigLayerRole;
  layerOrderByRole: ReadonlyMap<ConfigLayerRole, number>;
  targetValidation: PolicyTargetValidationContext;
}): readonly CompiledPolicyBinding[] {
  const layerOrder = requireLayerOrder(input.layerOrderByRole, input.layerRole);
  return collectObjectTerms(
    input.quads,
    input.configSubject,
    HAS_POLICY_BINDING_IRI,
  ).map((bindingTerm) =>
    parsePolicyBinding(input.quads, bindingTerm, {
      source: input.source,
      sourceOrder: input.sourceOrder,
      layerRole: input.layerRole,
      layerOrder,
      targetValidation: input.targetValidation,
    })
  );
}

function parsePolicyBinding(
  quads: readonly Quad[],
  bindingTerm: string,
  sourceLayer: {
    source: string;
    sourceOrder: number;
    layerRole: ConfigLayerRole;
    layerOrder: number;
    targetValidation: PolicyTargetValidationContext;
  },
): CompiledPolicyBinding {
  requireTermHasType(
    quads,
    bindingTerm,
    POLICY_BINDING_IRI,
    sourceLayer.source,
  );
  const policyTerm = requireSingleObjectTerm(
    quads,
    bindingTerm,
    BINDS_POLICY_IRI,
    sourceLayer.source,
  );
  requireTermHasType(
    quads,
    policyTerm,
    POLICY_DEFINITION_IRI,
    sourceLayer.source,
  );
  const targetTerm = requireSingleObjectTerm(
    quads,
    bindingTerm,
    APPLIES_TO_POLICY_TARGET_IRI,
    sourceLayer.source,
  );
  const values = parsePolicyDefinitionValues(
    quads,
    policyTerm,
    sourceLayer.source,
  );
  const priority = requireOptionalSingleInteger(
    quads,
    bindingTerm,
    POLICY_PRIORITY_IRI,
    sourceLayer.source,
  ) ?? 0;

  return {
    source: sourceLayer.source,
    sourceOrder: sourceLayer.sourceOrder,
    layerRole: sourceLayer.layerRole,
    layerOrder: sourceLayer.layerOrder,
    bindingTerm,
    target: parsePolicyTarget(
      quads,
      targetTerm,
      sourceLayer.source,
      sourceLayer.targetValidation,
    ),
    priority,
    values,
  };
}

function parsePolicyDefinitionValues(
  quads: readonly Quad[],
  policyTerm: string,
  source: string,
): PolicyValueBySlot {
  const values: PolicyValueBySlot = {};
  const historyTracking = requireOptionalSingleNamedValue(
    quads,
    policyTerm,
    HAS_HISTORY_TRACKING_POLICY_IRI,
    HISTORY_TRACKING_POLICY_VALUES,
    source,
  );
  const resourcePageGeneration = requireOptionalSingleNamedValue(
    quads,
    policyTerm,
    HAS_RESOURCE_PAGE_GENERATION_POLICY_IRI,
    RESOURCE_PAGE_GENERATION_POLICY_VALUES,
    source,
  );
  const resourcePagePresentation = requireOptionalSingleNamedValue(
    quads,
    policyTerm,
    HAS_RESOURCE_PAGE_PRESENTATION_POLICY_IRI,
    RESOURCE_PAGE_PRESENTATION_VALUES,
    source,
  );
  if (historyTracking) {
    values.historyTracking = historyTracking;
  }
  if (resourcePageGeneration) {
    values.resourcePageGeneration = resourcePageGeneration;
  }
  if (resourcePagePresentation) {
    values.resourcePagePresentation = resourcePagePresentation;
  }
  if (Object.keys(values).length === 0) {
    throw new EffectiveConfigError(
      `PolicyDefinition in ${source} must declare at least one supported policy value`,
    );
  }

  return values;
}

function parsePolicyTarget(
  quads: readonly Quad[],
  targetTerm: string,
  source: string,
  validation: PolicyTargetValidationContext,
): PolicyTarget {
  const types = collectNamedNodeObjects(quads, targetTerm, RDF_TYPE_IRI);
  const supportedTypes = types.filter((typeIri) =>
    typeIri === ANY_GOVERNED_ARTIFACT_POLICY_TARGET_IRI ||
    typeIri === ARTIFACT_ROLE_POLICY_TARGET_IRI ||
    typeIri === EXACT_ARTIFACT_POLICY_TARGET_IRI
  );
  if (supportedTypes.length !== 1) {
    throw new EffectiveConfigError(
      `Policy target in ${source} must declare exactly one supported target type`,
    );
  }

  const targetType = supportedTypes[0]!;
  if (targetType === ANY_GOVERNED_ARTIFACT_POLICY_TARGET_IRI) {
    rejectPolicyTargetSelector(
      quads,
      targetTerm,
      HAS_ARTIFACT_ROLE_IRI,
      source,
      "AnyGovernedArtifactPolicyTarget",
    );
    rejectPolicyTargetSelector(
      quads,
      targetTerm,
      TARGETS_ARTIFACT_IRI,
      source,
      "AnyGovernedArtifactPolicyTarget",
    );
    return { kind: "anyGovernedArtifact" };
  }

  if (targetType === ARTIFACT_ROLE_POLICY_TARGET_IRI) {
    rejectPolicyTargetSelector(
      quads,
      targetTerm,
      TARGETS_ARTIFACT_IRI,
      source,
      "ArtifactRolePolicyTarget",
    );
    return {
      kind: "artifactRole",
      artifactRole: requireSingleNamedValue(
        quads,
        targetTerm,
        HAS_ARTIFACT_ROLE_IRI,
        ARTIFACT_ROLE_VALUES,
        source,
      ),
    };
  }

  rejectPolicyTargetSelector(
    quads,
    targetTerm,
    HAS_ARTIFACT_ROLE_IRI,
    source,
    "ExactArtifactPolicyTarget",
  );
  const artifactIri = requireSingleNamedNodeObject(
    quads,
    targetTerm,
    TARGETS_ARTIFACT_IRI,
    source,
  );
  if (validation.governedArtifactIris === undefined) {
    throw new EffectiveConfigError(
      `Exact artifact policy target in ${source} requires governed artifact context`,
    );
  }
  if (!validation.governedArtifactIris.has(artifactIri)) {
    throw new EffectiveConfigError(
      `Exact artifact policy target in ${source} is not governed by the active mesh scope: ${artifactIri}`,
    );
  }
  return { kind: "exactArtifact", artifactIri };
}

function rejectPolicyTargetSelector(
  quads: readonly Quad[],
  targetTerm: string,
  predicateIri: string,
  source: string,
  targetKind: string,
): void {
  if (collectObjectTerms(quads, targetTerm, predicateIri).length > 0) {
    throw new EffectiveConfigError(
      `${targetKind} in ${source} cannot also declare ${predicateIri}`,
    );
  }
}

function policyValueForSlot(
  values: PolicyValueBySlot,
  slot: PolicySlot,
): string | undefined {
  switch (slot) {
    case "historyTracking":
      return values.historyTracking;
    case "resourcePageGeneration":
      return values.resourcePageGeneration;
    case "resourcePagePresentation":
      return values.resourcePagePresentation;
  }
}

function policyTargetCovers(
  policyTarget: PolicyTarget,
  queryTarget: PolicyTargetDescriptor,
): boolean {
  switch (policyTarget.kind) {
    case "anyGovernedArtifact":
      return true;
    case "artifactRole":
      return queryTarget.artifactRoles.includes(policyTarget.artifactRole);
    case "exactArtifact":
      return queryTarget.artifactIri === policyTarget.artifactIri;
  }
}

function policyTargetSpecificity(policyTarget: PolicyTarget): number {
  switch (policyTarget.kind) {
    case "anyGovernedArtifact":
      return 0;
    case "artifactRole":
      return 1;
    case "exactArtifact":
      return 2;
  }
}

function requireLayerOrder(
  layerOrderByRole: ReadonlyMap<ConfigLayerRole, number>,
  role: ConfigLayerRole,
): number {
  const layerOrder = layerOrderByRole.get(role);
  if (layerOrder === undefined) {
    throw new EffectiveConfigError(
      `Config resolution profile does not define layer order for ${role}`,
    );
  }
  return layerOrder;
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

function parseResourcePagePresentationProfiles(
  quads: readonly Quad[],
  source: string,
): ReadonlyMap<
  ResourcePagePresentationIdentity,
  ResourcePagePresentationProfile
> {
  const profiles = new Map<
    ResourcePagePresentationIdentity,
    ResourcePagePresentationProfile
  >();
  for (
    const [iri, identity] of Object.entries(RESOURCE_PAGE_PRESENTATION_VALUES)
  ) {
    profiles.set(
      identity,
      parseResourcePagePresentationProfile(quads, iri, source),
    );
  }
  return profiles;
}

function parseResourcePagePresentationProfile(
  quads: readonly Quad[],
  presentationIri: string,
  source: string,
): ResourcePagePresentationProfile {
  const identity = RESOURCE_PAGE_PRESENTATION_VALUES[
    presentationIri as keyof typeof RESOURCE_PAGE_PRESENTATION_VALUES
  ];
  if (!identity) {
    throw new EffectiveConfigError(
      `Unsupported ResourcePage presentation profile in ${source}: ${presentationIri}`,
    );
  }
  const presentationSubject = `NamedNode:${presentationIri}`;
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
    iri: presentationIri,
    identity,
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

function rejectRetiredDirectPolicyPredicates(
  quads: readonly Quad[],
  source: string,
): void {
  const retiredPredicate = quads.find((quad) =>
    RETIRED_DIRECT_POLICY_PREDICATES.includes(
      quad.predicate.value as typeof RETIRED_DIRECT_POLICY_PREDICATES[number],
    )
  )?.predicate.value;
  if (retiredPredicate) {
    throw new EffectiveConfigError(
      `Retired direct policy predicate is not supported in ${source}: ${retiredPredicate}`,
    );
  }
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
  const subjects = collectTypedSubjects(quads, typeIri);

  if (subjects.length !== 1) {
    throw new EffectiveConfigError(
      `Expected exactly one ${typeIri} subject in ${source}`,
    );
  }

  return subjects[0]!;
}

function collectTypedSubjects(
  quads: readonly Quad[],
  typeIri: string,
): readonly string[] {
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

  return [...subjects];
}

function requireTermHasType(
  quads: readonly Quad[],
  termKey: string,
  typeIri: string,
  source: string,
): void {
  if (
    !collectNamedNodeObjects(quads, termKey, RDF_TYPE_IRI).includes(typeIri)
  ) {
    throw new EffectiveConfigError(
      `Expected ${termKey} to be typed ${typeIri} in ${source}`,
    );
  }
}

function requireSingleNamedValue<T extends string>(
  quads: readonly Quad[],
  subject: string,
  predicateIri: string,
  values: Record<string, T>,
  source: string,
): T {
  const value = requireOptionalSingleNamedValue(
    quads,
    subject,
    predicateIri,
    values,
    source,
  );
  if (value === undefined) {
    throw new EffectiveConfigError(
      `Expected exactly one ${predicateIri} value in ${source}`,
    );
  }

  return value;
}

function requireOptionalSingleNamedValue<T extends string>(
  quads: readonly Quad[],
  subject: string,
  predicateIri: string,
  values: Record<string, T>,
  source: string,
): T | undefined {
  const namedNodes = collectNamedNodeObjects(quads, subject, predicateIri);
  if (namedNodes.length === 0) {
    return undefined;
  }
  if (namedNodes.length !== 1) {
    throw new EffectiveConfigError(
      `Expected at most one ${predicateIri} value in ${source}`,
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

function requireSingleNamedNodeObject(
  quads: readonly Quad[],
  subject: string,
  predicateIri: string,
  source: string,
): string {
  const namedNodes = collectNamedNodeObjects(quads, subject, predicateIri);
  if (namedNodes.length !== 1) {
    throw new EffectiveConfigError(
      `Expected exactly one ${predicateIri} named node value in ${source}`,
    );
  }

  return namedNodes[0]!;
}

function requireSingleObjectTerm(
  quads: readonly Quad[],
  subject: string,
  predicateIri: string,
  source: string,
): string {
  const terms = collectObjectTerms(quads, subject, predicateIri);
  if (terms.length !== 1) {
    throw new EffectiveConfigError(
      `Expected exactly one ${predicateIri} value in ${source}`,
    );
  }

  return terms[0]!;
}

function requireSingleNonNegativeInteger(
  quads: readonly Quad[],
  subject: string,
  predicateIri: string,
  source: string,
): number {
  const value = requireOptionalIntegerLiteral(
    quads,
    subject,
    predicateIri,
    source,
    [XSD_NON_NEGATIVE_INTEGER_IRI],
  );
  if (value === undefined || value < 0) {
    throw new EffectiveConfigError(
      `Expected exactly one ${predicateIri} xsd:nonNegativeInteger literal in ${source}`,
    );
  }

  return value;
}

function requireOptionalSingleStringLiteral(
  quads: readonly Quad[],
  subject: string,
  predicateIri: string,
  source: string,
): string | undefined {
  const values = new Map<string, Term>();
  for (const quad of quads) {
    if (
      toTermKey(quad.subject) !== subject ||
      quad.predicate.value !== predicateIri
    ) {
      continue;
    }
    values.set(toLiteralSensitiveTermKey(quad.object), quad.object);
  }

  if (values.size === 0) {
    return undefined;
  }
  if (values.size !== 1) {
    throw new EffectiveConfigError(
      `Expected at most one ${predicateIri} literal in ${source}`,
    );
  }

  const value = [...values.values()][0]!;
  if (
    value.termType !== "Literal" ||
    value.datatype.value !== XSD_STRING_IRI
  ) {
    throw new EffectiveConfigError(
      `Expected ${predicateIri} to be an xsd:string literal in ${source}`,
    );
  }

  return value.value;
}

function requireOptionalSingleInteger(
  quads: readonly Quad[],
  subject: string,
  predicateIri: string,
  source: string,
): number | undefined {
  return requireOptionalIntegerLiteral(
    quads,
    subject,
    predicateIri,
    source,
    [XSD_INTEGER_IRI, XSD_NON_NEGATIVE_INTEGER_IRI],
  );
}

function requireOptionalIntegerLiteral(
  quads: readonly Quad[],
  subject: string,
  predicateIri: string,
  source: string,
  acceptedDatatypes: readonly string[],
): number | undefined {
  const values = quads.filter((quad) =>
    toTermKey(quad.subject) === subject &&
    quad.predicate.value === predicateIri &&
    quad.object.termType === "Literal"
  );

  if (values.length === 0) {
    return undefined;
  }
  if (values.length !== 1) {
    throw new EffectiveConfigError(
      `Expected at most one ${predicateIri} literal in ${source}`,
    );
  }

  const literal = values[0]!.object;
  if (
    literal.termType !== "Literal" ||
    !acceptedDatatypes.includes(literal.datatype.value) ||
    !/^-?(0|[1-9]\d*)$/.test(literal.value)
  ) {
    throw new EffectiveConfigError(
      `Expected ${predicateIri} to be an integer literal in ${source}`,
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

function toLiteralSensitiveTermKey(term: Term): string {
  if (term.termType !== "Literal") {
    return toTermKey(term);
  }
  return `${term.termType}:${term.value}:${term.datatype.value}:${term.language}`;
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
