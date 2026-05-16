export type SupportArtifactHistoryPolicy =
  | "versioned"
  | "currentOnly"
  | "required"
  | "slimHistory"
  | "checkpointOnly"
  | "metadataOnly";

export interface MeshSupportHistoryPolicies {
  meshMetadata?: SupportArtifactHistoryPolicy;
  meshInventory?: SupportArtifactHistoryPolicy;
  config?: SupportArtifactHistoryPolicy;
}

export interface WeaveSupportHistoryPolicies
  extends MeshSupportHistoryPolicies {
  knopMetadata?: SupportArtifactHistoryPolicy;
  knopInventory?: SupportArtifactHistoryPolicy;
  referenceCatalog?: SupportArtifactHistoryPolicy;
  resourcePageDefinition?: SupportArtifactHistoryPolicy;
}

export function shouldMaterializeSupportHistory(
  policy?: SupportArtifactHistoryPolicy,
): boolean {
  return policy !== undefined && policy !== "currentOnly";
}
