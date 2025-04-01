// src/core/Frame.ts

import { ResolvedInclusion, WeaveConfig, WeaveConfigInput } from "../types.ts";
import { InputGlobalOptions } from "../types.ts";
import { ValidationError } from "./errors.ts";

/**
 * Represents a file mapping from source to destination.
 */
export interface FileMapping {
  sourcePath: string;
  inclusion: ResolvedInclusion;
}

export class Frame {
  private static instance: Frame | null = null;
  public config: WeaveConfig;
  public resolvedInclusions: ResolvedInclusion[] = [];
  public commandOptions?: InputGlobalOptions;
  
  // Map of destination paths to their source mappings
  private destinationPaths: Map<string, FileMapping[]> = new Map();

  // Private constructor to prevent direct instantiation
  private constructor(config: WeaveConfigInput, resolvedInclusions: ResolvedInclusion[], commandOptions?: InputGlobalOptions) {
    this.config = config as WeaveConfig; // assumes all necessary validation is completed externally beforehand, specifically in processWeaveConfig
    this.commandOptions = commandOptions;
    this.resolvedInclusions = resolvedInclusions;
  }
  
  /**
   * Registers a file mapping from source to destination.
   * @param sourcePath The source file path
   * @param destPath The destination file path
   * @param inclusion The inclusion that contains this file
   */
  public registerFileMapping(
    sourcePath: string,
    destPath: string,
    inclusion: ResolvedInclusion
  ): void {
    if (!this.destinationPaths.has(destPath)) {
      this.destinationPaths.set(destPath, []);
    }
    
    this.destinationPaths.get(destPath)!.push({
      sourcePath,
      inclusion,
    });
  }
  
  /**
   * Gets all file mappings.
   * @returns A map of destination paths to their source mappings
   */
  public getFileMappings(): Map<string, FileMapping[]> {
    return this.destinationPaths;
  }
  
  /**
   * Gets all collisions (destination paths with multiple sources).
   * @returns A map of destination paths to their source mappings, where each destination has multiple sources
   */
  public getCollisions(): Map<string, FileMapping[]> {
    const collisions = new Map<string, FileMapping[]>();
    
    for (const [destPath, mappings] of this.destinationPaths.entries()) {
      if (mappings.length > 1) {
        collisions.set(destPath, mappings);
      }
    }
    
    return collisions;
  }
  
  /**
   * Clears all file mappings.
   */
  public clearFileMappings(): void {
    this.destinationPaths.clear();
  }


  public static initialize(config: WeaveConfigInput, resolvedInclusions: ResolvedInclusion[], commandOptions?: InputGlobalOptions): void {
    if (Frame.instance) {
      throw new ValidationError("Frame has already been initialized");
    }
    Frame.instance = new Frame(config, resolvedInclusions, commandOptions);
  }

  /**
   * Retrieves the singleton instance of Frame.
   * If it doesn't exist, it initializes it with the provided config and commandOptions.
   * @param config Optional WeaveConfig to initialize Frame if it hasn't been initialized yet.
   * @param commandOptions Optional InputGlobalOptions to pass command-line arguments.
   * @returns The singleton Frame instance.
   */
  public static getInstance(): Frame {
    if (!Frame.instance) {
      throw new ValidationError("Frame has not been initialized yet");
    }
    return Frame.instance;
  } 

  /**
   * Resets the Frame singleton instance.
   * Useful for reinitializing with a new configuration.
   */
  public static resetInstance(): void {
    Frame.instance = null;
  }

  /**
   * Checks if the Frame singleton has been initialized.
   * @returns `true` if initialized, `false` otherwise.
   */
  public static isInitialized(): boolean {
    return Frame.instance !== null;
  }

  // Add other methods as needed
}
