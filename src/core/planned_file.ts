export interface PlannedFile {
  path: string;
  contents: string;
}

export interface PlannedBinaryFile {
  path: string;
  contents: Uint8Array;
}
