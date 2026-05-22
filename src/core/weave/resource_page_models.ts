export interface RepositorySourceFloatingLocator {
  repositoryUrl: string;
  repositoryPathFromRoot: string;
}

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

export type ResourcePageModel =
  | IdentifierResourcePageModel
  | KnopResourcePageModel
  | SimpleResourcePageModel
  | ReferenceCatalogResourcePageModel
  | CustomIdentifierResourcePageModel;
