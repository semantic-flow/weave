import type { RepositorySourceFloatingLocator } from "./source_models.ts";

export interface PayloadWorkingArtifact {
  workingLocalRelativePath: string;
  workingAccessUrl?: string;
  currentPayloadTurtle: string;
  repositorySourceFloatingLocator?: RepositorySourceFloatingLocator;
  currentArtifactHistoryPath?: string;
  latestHistoricalSnapshotPath?: string;
  latestHistoricalSnapshotTurtle?: string;
  latestHistoricalStatePath?: string;
}

export interface ReferenceCatalogWorkingArtifact {
  workingLocalRelativePath: string;
  currentReferenceCatalogTurtle: string;
}

export interface ReferenceTargetSourcePayloadArtifact {
  designatorPath: string;
  workingLocalRelativePath: string;
  currentPayloadTurtle: string;
  repositorySourceFloatingLocator?: RepositorySourceFloatingLocator;
  sourceRegistryWorkingLocalRelativePath?: string;
  currentSourceRegistryTurtle?: string;
  latestHistoricalSnapshotPath?: string;
  latestHistoricalSnapshotTurtle?: string;
  latestHistoricalStatePath: string;
  sourceEvidence?: ExtractionSourceEvidenceModel;
}

export interface ExtractionSourceEvidenceModel {
  sourceStatePath?: string;
  sourceManifestationPath?: string;
  sourceLocatedFilePath?: string;
  sourceLocalRelativePath?: string;
  sourceDigest?: string;
  observedAt?: string;
}

export interface ResourcePageDefinitionWorkingArtifact {
  artifactPath: string;
  workingLocalRelativePath: string;
  currentPageDefinitionTurtle: string;
  currentArtifactHistoryPath?: string;
  currentArtifactHistoryExists: boolean;
  latestHistoricalStatePath?: string;
  latestHistoricalSnapshotTurtle?: string;
  assetBundlePath?: string;
}

export interface WeaveableKnopCandidate {
  designatorPath: string;
  currentKnopMetadataTurtle: string;
  currentKnopInventoryTurtle: string;
  payloadArtifact?: PayloadWorkingArtifact;
  referenceCatalogArtifact?: ReferenceCatalogWorkingArtifact;
  referenceTargetSourcePayloadArtifact?: ReferenceTargetSourcePayloadArtifact;
  resourcePageDefinitionArtifact?: ResourcePageDefinitionWorkingArtifact;
}
