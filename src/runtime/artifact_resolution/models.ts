import type { OperationalLocalPathPolicy } from "../operational/local_path_policy.ts";

export type ArtifactResolutionMode = "working" | "latestState";
export type ArtifactResolutionContentMode = "none" | "bytes" | "text";

export interface ArtifactResolutionRequest {
  sourceTerm?: string;
  sourceIri?: string;
  sourceDescription?: string;
  targetArtifactIri?: string;
  targetArtifactHistoryIri?: string;
  targetHistoricalStateIri?: string;
  targetManifestationIri?: string;
  targetLocatedFileIri?: string;
  targetLocalRelativePath?: string;
  targetAccessUrl?: string;
  targetRepositorySourceTerm?: string;
  repositorySourceFloatingLocatorTerm?: string;
  fallbackArtifactResolutionSpecTerm?: string;
  mode?: ArtifactResolutionMode;
  expectedContentDigest?: string;
}

export interface ArtifactResolutionObservedCoordinates {
  historicalStateIri?: string;
  manifestationIri?: string;
  locatedFileIri?: string;
  localRelativePath?: string;
  contentDigest?: string;
}

export interface ArtifactResolutionContent {
  bytes: Uint8Array;
  text?: string;
}

export interface ArtifactResolutionResult {
  requested: ArtifactResolutionRequest;
  observed: ArtifactResolutionObservedCoordinates;
  content?: ArtifactResolutionContent;
}

export interface ArtifactResolutionContext {
  meshRoot: string;
  meshBase: string;
  localPathPolicy: OperationalLocalPathPolicy;
  overlay?: ReadonlyMap<string, string>;
}

export interface ArtifactResolutionOptions {
  contentMode?: ArtifactResolutionContentMode;
}
