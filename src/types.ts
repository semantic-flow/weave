// src/types.ts

// =============================
// Copy Strategy Types
// =============================

/**
 * Defines the copy strategy using string literals.
 */
export type CopyStrategy = "no-overwrite" | "overwrite" | "skip" | "prompt";

export const validCopyStrategies: CopyStrategy[] = [
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
  workspaceDir?: string;
  dest?: string;
  globalCopyStrategy?: CopyStrategy;
  globalClean?: boolean;
  watchConfig?: boolean;
  configFilePath?: string;
  debug?: string;
}

/**
 * Represents global configuration options after processing.
 * Ensures all necessary properties are defined by applying defaults.
 */
export interface ResolvedGlobalOptions {
  workspaceDir: string;
  dest: string;
  globalCopyStrategy: CopyStrategy;
  globalClean: boolean;
  watchConfig: boolean;
  configFilePath: string; // mandatory since config file is required
  debug: string;
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
 * Represents an inclusion within the resolved configuration.
 * Ensures all necessary properties are defined, applying defaults where needed.
 */
export type ResolvedInclusion =
  | {
    type: "git";
    name?: string;
    url: string;
    options: GitOptions;
    order: number;
    localPath: string;
  }
  | {
    type: "web";
    name?: string;
    url: string;
    options: WebOptions;
    order: number;
  }
  | {
    type: "local";
    name?: string;
    options: LocalOptions;
    order: number;
    localPath: string;
  };

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
  global?: InputGlobalOptions;
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