// src/types.ts

// Command-related options
export interface CommandOptions {
  debug?: string;
  config?: string;
  dest?: string;
  workspaceDir?: string;
  globalClean?: boolean;
  globalCopyStrategy?: CopyStrategy;
  watchConfig?: boolean;
}

// Config-related types

// Define copy strategy using string literals
export type CopyStrategy = "no-overwrite" | "overwrite" | "skip" | "prompt";

export const validCopyStrategies: CopyStrategy[] = ["no-overwrite", "overwrite", "skip", "prompt"];


// Define common properties across different inclusion options
export interface CommonOptions {
  active?: boolean;
  copyStrategy?: CopyStrategy,
  order?: number;
}

// Define specific options for Git inclusions
export interface GitOptions extends CommonOptions {
  include?: string[];
  exclude?: string[];
  excludeByDefault?: boolean;
  autoPullBeforeBuild?: boolean;
  autoPushBeforeBuild?: boolean;
  branch?: string; // Optional branch property added within GitOptions
}

// Define options for HTTP inclusions
export interface HttpOptions extends CommonOptions { }

// Define options for Local inclusions
export interface LocalOptions extends CommonOptions {
  include?: string[];
  exclude?: string[];
  excludeByDefault?: boolean;
}

// Define the Inclusion type using discriminated unions to enforce constraints
export type Inclusion =
  | {
    type: "git";
    name?: string;
    url: string;
    options?: GitOptions;
    order?: number;
    localPath?: string;
  }
  | {
    type: "web";
    name?: string;
    url: string;
    options?: HttpOptions;
    order?: number;
  }
  | {
    type: "local";
    name?: string;
    url: string;
    options?: LocalOptions;
    order?: number;
    localPath?: string;
  };

// Define the Global options interface
export interface GlobalOptions {
  workspaceDir?: string;
  dest?: string;
  globalCopyStrategy?: CopyStrategy;
  globalClean?: boolean;
  configFilePath?: string;
  watchConfig?: boolean;
}

// Define the main configuration interface
export interface WeaveConfig {
  global: GlobalOptions;
  inclusions: Inclusion[];
}