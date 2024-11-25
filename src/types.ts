// src/types.ts

// Command-related options
export interface CommandOptions {
  debug?: string;
  config?: string;
  dest?: string;
  repoDir?: string;
  clean?: boolean;
  copyStrategy?: CopyStrategy;
}

// Config-related types

// Define inclusion types using string literals
export type InclusionType = "git+ssh" | "git+https" | "http" | "local";

// Define copy strategy using string literals
export type CopyStrategy = "no-overwrite" | "overwrite" | "skip" | "prompt";

// Define common properties across different inclusion options
export interface CommonOptions {
  active?: boolean;
  copyStrategy?: CopyStrategy,
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
    type: "git+ssh" | "git+https";
    name?: string;
    url: string;
    options?: GitOptions; // Made optional
  }
  | {
    type: "http";
    name?: string;
    url: string;
    options?: HttpOptions; // Made optional
  }
  | {
    type: "local";
    name?: string;
    url: string;
    options?: LocalOptions; // Made optional
  };

// Define the Global options interface
export interface GlobalOptions {
  repoDir?: string;
  dest?: string;
  copyStrategy?: CopyStrategy;
  clean?: boolean;
}

// Define the main configuration interface
export interface WeaveConfig {
  global?: GlobalOptions;
  inclusions: Inclusion[];
}