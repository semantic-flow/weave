// src/core/Frame.ts

import { WeaveConfig } from "../types.ts";

export class Frame {
  private static instance: Frame | null = null;
  public config: WeaveConfig;
  public activeInclusions: string[] = [];

  // Private constructor to prevent direct instantiation
  private constructor(config: WeaveConfig) {
    this.config = config;

    // Load active inclusions
    
  }

  /**
   * Retrieves the singleton instance of Frame.
   * If it doesn't exist, it initializes it with the provided config.
   * @param config Optional WeaveConfig to initialize Frame if it hasn't been initialized yet.
   * @returns The singleton Frame instance.
   */
  public static getInstance(config?: WeaveConfig): Frame {
    if (!Frame.instance) {
      if (!config) {
        throw new Error("Frame has not been initialized yet. Provide a WeaveConfig.");
      }
      Frame.instance = new Frame(config);
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