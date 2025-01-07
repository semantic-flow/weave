// src/types.ts

import { LevelName } from "./deps/log.ts";

export type { LevelName };


// =============================
// Copy Strategy Types
// =============================

/**
 * Defines the copy strategy using string literals.
 */
export type CopyStrategy = "no-overwrite" | "overwrite" | "skip" | "prompt";


export const validCopyStrategies: string[] = [
  "no-overwrite",
  "overwrite",
  "skip",
  "prompt",
];

// =============================
// Global Configuration Types
// =============================

/**
 * Represents global configuration options as provided by the user.
 * All properties are optional to allow flexibility in user input.
 */
export interface InputGlobalOptions {
  configFilePath?: string;
  debug?: string;
  dryRun?: boolean;
  dest?: string;
  globalClean?: boolean;
  globalCopyStrategy?: CopyStrategy;
  watchConfig?: boolean;
  workspaceDir?: string;
}

/**
 * Represents global configuration options after processing.
 * Ensures all necessary properties are defined by applying defaults.
 */
export interface ResolvedGlobalOptions {
  configFilePath: string; // mandatory since config file is where inclusions are defined
  debug: LevelName;
  dest: string;
  dryRun: boolean;
  globalClean: boolean;
  globalCopyStrategy: CopyStrategy;
  watchConfig: boolean;
  workspaceDir: string;
}

// =============================
// Inclusion-Related Types
// =============================

/**
 * Defines common properties across different inclusion options.
 */
export interface CommonOptions {
  active?: boolean;
  copyStrategy?: CopyStrategy;
}

/**
 * Defines specific options for Git inclusions.
 */
export interface InputGitOptions extends CommonOptions {
  include?: string[];
  exclude?: string[];
  excludeByDefault?: boolean;
  autoPullBeforeBuild?: boolean;
  autoPushBeforeBuild?: boolean;
  branch?: string; // Optional branch property
}

/**
 * Defines specific options for Web inclusions.
 */
export interface InputWebOptions extends CommonOptions { }

/**
 * Defines specific options for Local inclusions.
 */
export interface InputLocalOptions extends CommonOptions {
  include?: string[];
  exclude?: string[];
  excludeByDefault?: boolean;
}

/**
 * Represents an inclusion as provided by the user.
 * Used for Input configurations where certain properties are optional.
 */
export type InputInclusion =
  | {
    type: "git";
    name?: string;
    url: string;
    options?: InputGitOptions;
    order?: number;
    localPath?: string;
  }
  | {
    type: "web";
    name?: string;
    url: string;
    options?: InputWebOptions;
    order?: number;
  }
  | {
    type: "local";
    name?: string;
    options?: InputLocalOptions;
    order?: number;
    localPath?: string;
  };

/**
 * Type alias for an array of input inclusions.
 */
export type InputInclusions = InputInclusion[];

/**
 * Defines specific options for Git inclusions within resolved configurations.
 */
export interface GitOptions extends Required<CommonOptions> {
  include: string[];
  exclude: string[];
  excludeByDefault: boolean;
  autoPullBeforeBuild: boolean;
  autoPushBeforeBuild: boolean;
  branch: string;
}

/**
 * Defines specific options for Web inclusions within resolved configurations.
 */
export interface WebOptions extends Required<CommonOptions> { }

/**
 * Defines specific options for Local inclusions within resolved configurations.
 */
export interface LocalOptions extends Required<CommonOptions> {
  include: string[];
  exclude: string[];
  excludeByDefault: boolean;
}

/**
 * Represents an inclusion within resolved configurations for Git.
 */
export interface GitInclusion {
  type: "git";
  name?: string;
  url: string;
  options: GitOptions;
  order: number;
  localPath: string; // aka workingDir
}

/**
 * Represents an inclusion within resolved configurations for Web.
 */
export interface WebInclusion {
  type: "web";
  name?: string;
  url: string;
  options: WebOptions;
  order: number;
}

/**
 * Represents an inclusion within resolved configurations for Local.
 */
export interface LocalInclusion {
  type: "local";
  name?: string;
  options: LocalOptions;
  order: number;
  localPath: string;
}

/**
 * Represents an inclusion within the resolved configuration.
 * Ensures all necessary properties are defined, applying defaults where needed.
 */
export type ResolvedInclusion = GitInclusion | WebInclusion | LocalInclusion;

/**
 * Type alias for an array of resolved inclusions.
 */
export type ResolvedInclusions = ResolvedInclusion[];

// =============================
// Main Configuration Interfaces
// =============================

/**
 * Represents the main configuration as provided by the user.
 * Some fields are optional to allow the user to override defaults.
 */
export interface WeaveConfigInput {
  global: InputGlobalOptions;
  inclusions?: InputInclusions;
}

/**
 * Represents the fully resolved main configuration used internally.
 * Guarantees that all necessary fields are defined, either through user input or defaults.
 */
export interface WeaveConfig {
  global: ResolvedGlobalOptions;
  inclusions: ResolvedInclusions;
}

// ============================
// Git Command Result
// ============================

export interface RepoGitResult {
  error?: Error;
  url?: string;
  localPath: string;
  message?: string;
  success: boolean;
}


// ============================
// Subcommand Options
// ============================

export interface CommitOptions {
  message?: string,
}

export interface InclusionListItem {
  order: number;
  name: string;
  active: boolean;
  present: boolean;
  syncStatus: SyncStatus;
  copyStrategy: CopyStrategy;
  include: string[],
  exclude: string[],
  excludeByDefault: boolean,
  autoPullBeforeBuild: boolean,
  autoPushBeforeBuild: boolean,
}

export type SyncStatus = 'current' | 'ahead' | 'behind' | 'conflicted' | 'dirty' | 'missing' | 'unknown';
