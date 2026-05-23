export interface MeshInventoryProgression {
  historyPath: string;
  nextHistoryOrdinal?: number;
  latestStatePath: string;
  latestStateOrdinal: number;
  latestManifestationPath: string;
  nextStatePath: string;
  nextStateOrdinal: number;
}

export interface PageDefinitionWeaveProgression {
  historyPath: string;
  latestStatePath?: string;
  latestStateOrdinal: number;
  nextStatePath: string;
  nextStateOrdinal: number;
  nextManifestationPath: string;
  nextSnapshotPath: string;
}
