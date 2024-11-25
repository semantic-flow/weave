// src/core/Frame.ts

import { WeaveConfig } from "../types.ts";

/**
 * The Frame class holds the application's configuration.
 * It can be implemented as a singleton to maintain a single configuration state.
 */
export class Frame {
  private static instance: Frame;
  public config: WeaveConfig;

  /**
   * Private constructor to prevent direct instantiation.
   * @param config The composed WeaveConfig object.
   */
  private constructor(config: WeaveConfig) {
    this.config = config;
  }

  /**
   * Retrieves the singleton instance of Frame.
   * @param config The composed WeaveConfig object (only used on first call).
   * @returns The Frame instance.
   */
  public static getInstance(config?: WeaveConfig): Frame {
    if (!Frame.instance) {
      if (!config) {
        throw new Error("Frame has not been initialized with a WeaveConfig.");
      }
      Frame.instance = new Frame(config);
    }
    return Frame.instance;
  }

  /**
   * Allows updating the configuration if needed.
   * This method ensures that Frame maintains a consistent state.
   * @param newConfig The new WeaveConfig to merge with the existing config.
   */
  public updateConfig(newConfig: WeaveConfig): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Retrieves the current configuration.
   * @returns The current WeaveConfig object.
   */
  public getConfig(): WeaveConfig {
    return this.config;
  }
}