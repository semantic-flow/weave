// types.ts

export interface CommandOptions {
  debug?: string;
  config?: string;
  dest?: string;
  repoDir?: string;
}

// Config-related types

// Define inclusion types using string literals
export type InclusionType = "git+ssh" | "git+https" | "http" | "local";

// Define common properties across different inclusion options
export interface CommonOptions {
  exclude?: string[];
  excludeByDefault: boolean;
}

// Define specific options for Git inclusions
export interface GitOptions extends CommonOptions {
  include?: string[];
  autoPullBeforeBuild?: boolean;
  autoPushBeforeBuild?: boolean;
}

// Define options for HTTP inclusions
export interface HttpOptions {
  excludeByDefault: boolean;
}

// Define options for Local inclusions
export interface LocalOptions extends CommonOptions { }

// Define the Inclusion type using discriminated unions to enforce constraints
export type Inclusion =
  | { type: "git+ssh" | "git+https"; url: string; options: GitOptions }
  | { type: "http"; url: string; options: HttpOptions }
  | { type: "local"; url: string; options: LocalOptions };

// Define the main configuration interface
export interface WeaveConfig {
  inclusions: Inclusion[];
}