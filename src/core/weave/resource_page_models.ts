import type { RepositorySourceFloatingLocator } from "./source_models.ts";

export type { RepositorySourceFloatingLocator } from "./source_models.ts";

export interface IdentifierResourcePageModel {
  kind: "identifier";
  path: string;
  designatorPath: string;
  workingLocalRelativePath?: string;
  workingAccessUrl?: string;
  repositorySourceFloatingLocator?: RepositorySourceFloatingLocator;
  extractionSource?: ResourcePageExtractionSourceModel;
  references?: readonly ResourcePageReferenceLinkModel[];
  childIdentifiers?: readonly ResourcePageChildIdentifierModel[];
  historyGroups?: readonly ResourcePageHistoryGroupModel[];
  rawSourcePanels?: readonly ResourcePageRawSourcePanelModel[];
}

export interface SimpleResourcePageModel {
  kind: "simple";
  path: string;
  description: string;
  childIdentifiers?: readonly ResourcePageChildIdentifierModel[];
  historyGroups?: readonly ResourcePageHistoryGroupModel[];
  rawSourcePanels?: readonly ResourcePageRawSourcePanelModel[];
}

export interface ReferenceCatalogCurrentLinkModel {
  fragment: string;
  referenceRoleLabel: string;
  referenceTargetPath: string;
  referenceTargetStatePath?: string;
}

export interface ReferenceCatalogResourcePageModel {
  kind: "referenceCatalog";
  path: string;
  catalogPath: string;
  ownerDesignatorPath: string;
  currentLinks: readonly ReferenceCatalogCurrentLinkModel[];
  historyGroups?: readonly ResourcePageHistoryGroupModel[];
  rawSourcePanels?: readonly ResourcePageRawSourcePanelModel[];
}

export interface KnopArtifactLinkModel {
  label: string;
  path: string;
}

export interface KnopResourcePageModel {
  kind: "knop";
  path: string;
  designatorPath: string;
  ownerTitle?: string;
  governedArtifacts: readonly KnopArtifactLinkModel[];
  supportingArtifacts: readonly KnopArtifactLinkModel[];
  childIdentifiers?: readonly ResourcePageChildIdentifierModel[];
}

export interface CustomIdentifierRegionResourcePageModel {
  key: string;
  markdown: string;
  sourcePath: string;
}

export interface CustomIdentifierResourcePageModel {
  kind: "customIdentifier";
  path: string;
  designatorPath: string;
  definitionPath: string;
  presentationConfigIri?: string;
  stylesheetPaths: readonly string[];
  regions: readonly CustomIdentifierRegionResourcePageModel[];
}

export interface ResourcePageRawSourcePanelModel {
  label: string;
  sourcePath: string;
  contents?: string;
  omittedByteLength?: number;
}

export interface ResourcePageExtractionSourceModel {
  sourceArtifactPath: string;
  requestedTargetStatePath?: string;
  artifactResolutionModeIri?: string;
}

export interface ResourcePageChildIdentifierModel {
  label: string;
  path: string;
  rdfTypes?: readonly string[];
}

export interface ResourcePageReferenceTargetModel {
  href: string;
  label: string;
}

export interface ResourcePageReferenceLinkModel {
  roleLabel: string;
  targets: readonly ResourcePageReferenceTargetModel[];
}

export interface ResourcePageHistoryStateModel {
  path: string;
  manifestationPath?: string;
  locatedFilePath?: string;
}

export interface ResourcePageHistoryGroupModel {
  label: string;
  path: string;
  states: readonly ResourcePageHistoryStateModel[];
}

export type ResourcePageDocumentKind =
  | "identifier"
  | "knop"
  | "simple"
  | "referenceCatalog"
  | "customIdentifier";

export interface ResourcePageDocumentModel {
  kind: ResourcePageDocumentKind;
  meshLabel: string;
  meshBase: string;
  meshRootHref: string;
  pagePath: string;
  resourcePath: string;
  displayResourcePath: string;
  canonical: string;
  generatedAtIso: string;
  generatedAtDisplay: string;
  meshFaviconHref?: string;
  stylesheetHrefs?: readonly string[];
  title: string;
  summary?: string;
  rdfClasses: readonly ResourcePageRdfClassModel[];
  breadcrumbs: readonly ResourcePageBreadcrumbModel[];
  metadata: readonly ResourcePageMetadataModel[];
  panels: readonly ResourcePagePanelModel[];
}

export interface ResourcePageBreadcrumbModel {
  label: string;
  href?: string;
}

export interface ResourcePageRdfClassModel {
  label: string;
  iri: string;
}

export interface ResourcePageLinkListMetadataModel {
  kind: "links";
  label: string;
  links: readonly ResourcePageReferenceTargetLinkModel[];
}

export interface ResourcePageRepositorySourceMetadataModel {
  kind: "repositorySource";
  label: string;
  repositorySource: RepositorySourceFloatingLocator;
}

export interface ResourcePageExtractionSourceSummaryMetadataModel {
  kind: "extractionSourceSummary";
  label: string;
  sourceArtifactPath: string;
  requestedTargetStatePath?: string;
}

export type ResourcePageMetadataModel =
  | ResourcePageTextMetadataModel
  | ResourcePageLinkListMetadataModel
  | ResourcePageRepositorySourceMetadataModel
  | ResourcePageExtractionSourceSummaryMetadataModel;

export interface ResourcePageTextMetadataModel {
  kind?: "text";
  label: string;
  labelHref?: string;
  href?: string;
  value: string;
  tooltip?: string;
}

export interface ResourcePagePropertyModel {
  predicateLabel: string;
  predicateHref: string;
  value: string;
  valueHref?: string;
}

export interface ResourcePageBlankNodeModel {
  predicateLabel: string;
  predicateHref: string;
  code: string;
}

export interface ResourcePageReferenceGroupModel {
  label: string;
  links: readonly ResourcePageReferenceTargetLinkModel[];
}

export interface ResourcePageReferenceTargetLinkModel {
  href: string;
  label: string;
}

export interface ResourcePageSectionModel {
  id?: string;
  title: string;
  rows: readonly ResourcePageMetadataModel[];
}

export interface ResourcePageChildIdentifierGroupModel {
  label: string;
  identifiers: readonly ResourcePageChildIdentifierModel[];
}

export type ResourcePagePanelModel =
  | ResourcePageChildrenPanelModel
  | ResourcePagePropertiesPanelModel
  | ResourcePageBlankNodesPanelModel
  | ResourcePageReferencesPanelModel
  | ResourcePageHistoryPanelModel
  | ResourcePageCurrentLinksPanelModel
  | ResourcePageFactSectionsPanelModel
  | ResourcePageKnopArtifactsPanelModel
  | ResourcePageAuthoredContentPanelModel
  | ResourcePageRawSourcePanelGroupModel
  | ResourcePageSemanticFlowMetadataPanelModel;

export interface ResourcePageChildrenPanelModel {
  kind: "children";
  groups: readonly ResourcePageChildIdentifierGroupModel[];
}

export interface ResourcePagePropertiesPanelModel {
  kind: "properties";
  rows: readonly ResourcePagePropertyModel[];
}

export interface ResourcePageBlankNodesPanelModel {
  kind: "blankNodes";
  rows: readonly ResourcePageBlankNodeModel[];
}

export interface ResourcePageReferencesPanelModel {
  kind: "references";
  groups: readonly ResourcePageReferenceGroupModel[];
}

export interface ResourcePageHistoryPanelModel {
  kind: "history";
  groups: readonly ResourcePageHistoryGroupModel[];
}

export interface ResourcePageCurrentLinksPanelModel {
  kind: "currentLinks";
  links: readonly ReferenceCatalogCurrentLinkModel[];
}

export interface ResourcePageFactSectionsPanelModel {
  kind: "factSections";
  sections: readonly ResourcePageSectionModel[];
}

export interface ResourcePageKnopArtifactsPanelModel {
  kind: "knopArtifacts";
  governedArtifacts: readonly KnopArtifactLinkModel[];
  supportingArtifacts: readonly KnopArtifactLinkModel[];
}

export interface ResourcePageAuthoredContentPanelModel {
  kind: "authoredContent";
  regions: readonly CustomIdentifierRegionResourcePageModel[];
}

export interface ResourcePageRawSourcePanelGroupModel {
  kind: "rawSource";
  panels: readonly ResourcePageRawSourcePanelModel[];
}

export interface ResourcePageSemanticFlowMetadataPanelModel {
  kind: "semanticFlowMetadata";
  rows: readonly ResourcePageMetadataModel[];
}

export type ResourcePageModel =
  | IdentifierResourcePageModel
  | KnopResourcePageModel
  | SimpleResourcePageModel
  | ReferenceCatalogResourcePageModel
  | CustomIdentifierResourcePageModel;
