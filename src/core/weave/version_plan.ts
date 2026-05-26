import type { PlannedBinaryFile, PlannedFile } from "../planned_file.ts";

export interface VersionPlan {
  meshBase: string;
  versionedDesignatorPaths: readonly string[];
  createdFiles: readonly PlannedFile[];
  createdBinaryFiles?: readonly PlannedBinaryFile[];
  updatedFiles: readonly PlannedFile[];
}
