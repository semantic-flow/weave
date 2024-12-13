// src/core/Frame.ts

import { WeaveConfig } from "../types.ts";
import { InputGlobalOptions } from "../types.ts";


export class Frame {
  private static instance: Frame | null = null;
  public config: WeaveConfig;
  public activeInclusions: string[] = [];
  public commandOptions?: InputGlobalOptions;

  // Private constructor to prevent direct instantiation
  private constructor(config: WeaveConfig, commandOptions?: InputGlobalOptions) {
    this.config = config;
    this.commandOptions = commandOptions;
  }

  /**
   * Retrieves the singleton instance of Frame.
   * If it doesn't exist, it initializes it with the provided config and commandOptions.
   * @param config Optional WeaveConfig to initialize Frame if it hasn't been initialized yet.
   * @param commandOptions Optional InputGlobalOptions to pass command-line arguments.
   * @returns The singleton Frame instance.
   */
  public static getInstance(config?: WeaveConfig, commandOptions?: InputGlobalOptions): Frame {
    if (!Frame.instance) {
      if (!config) {
        throw new Error("Frame has not been initialized yet. Provide a WeaveConfig.");
      }
      Frame.instance = new Frame(config, commandOptions);
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