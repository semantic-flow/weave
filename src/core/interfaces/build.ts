import { ResolvedInclusion, RepoGitResult } from "@/types.ts";
import { VerifyOptions as InclusionsVerifyOptions, VerifyResult as InclusionsVerifyResult } from "@/core/inclusionsVerify.ts";

// Re-export for use in other modules
export type { InclusionsVerifyOptions, InclusionsVerifyResult };

export interface BuildOptions extends InclusionsVerifyOptions {
  verify?: boolean;
  prepare?: boolean;
  pullStrategy?: string;
  pushStrategy?: string;
}

export interface BuildResult {
  verifyResult?: InclusionsVerifyResult;
  prepareResults?: RepoGitResult[];
  success: boolean;
  filesCopied: number;
  filesSkipped: number;
  filesOverwritten: number;
  filesUpdated: number;
  errors: string[];
  warnings: string[];
  collisions?: Map<string, { sourcePath: string; inclusion: ResolvedInclusion }[]>;
}

export interface FileCopyResult {
  source: string;
  destination: string;
  success: boolean;
  skipped: boolean;
  overwritten: boolean;
  error?: string;
}
