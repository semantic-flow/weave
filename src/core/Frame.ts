// src/core/Frame.ts

import { ResolvedInclusion, WeaveConfig, WeaveConfigInput } from "../types.ts";
import { InputGlobalOptions } from "../types.ts";
import { ValidationError } from "./errors.ts";


export class Frame {
  private static instance: Frame | null = null;
  public config: WeaveConfig;
  public resolvedInclusions: ResolvedInclusion[] = [];
  public commandOptions?: InputGlobalOptions;

  // Private constructor to prevent direct instantiation
  private constructor(config: WeaveConfigInput, resolvedInclusions: ResolvedInclusion[], commandOptions?: InputGlobalOptions) {
    this.config = config as WeaveConfig; // assumes all necessary validation is completed externally beforehand, specifically in processWeaveConfig
    this.commandOptions = commandOptions;
    this.resolvedInclusions = resolvedInclusions;
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
