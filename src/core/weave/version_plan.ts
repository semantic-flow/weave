import type { PlannedFile } from "../planned_file.ts";

export interface VersionPlan {
  meshBase: string;
  versionedDesignatorPaths: readonly string[];
  createdFiles: readonly PlannedFile[];
  updatedFiles: readonly PlannedFile[];
}
