// src/core/monitor.ts

import { debounce } from "https://deno.land/std/async/mod.ts";
import { ensureDir } from "https://deno.land/std/fs/mod.ts";
import { info, error } from "./utils/logger.ts";
import { prepareInclusions } from "./prepareInclusions.ts";
import { synchronizeFiles } from "./utils/synchronizeFiles.ts";

interface MonitorOptions {
  config: any; // Replace with actual config type
  out: string;
  repoDir: string;
}

/**
 * Initiates file monitoring and synchronization.
 *
 * @param {MonitorOptions} options - Configuration options.
 */
export async function startMonitoring(options: MonitorOptions): Promise<void> {
  const { out: outputDir, repoDir, config } = options;

  await ensureDir(outputDir);
  await ensureDir(repoDir);

  // Prepare inclusions: clone repos, setup sparse checkouts, etc.
  await prepareInclusions(config);

  // Initial synchronization
  await synchronizeFiles(config, outputDir, repoDir);

  // Debounced synchronization function to prevent rapid, redundant syncs
  const debouncedSync = debounce(() => synchronizeFiles(config, outputDir, repoDir), 300);

  // Watch for changes in the filesystem
  const watcher = Deno.watchFs(".", { recursive: true });

  info("Monitoring for changes...");

  try {
    for await (const event of watcher) {
      info(`Change detected: ${event.kind} on ${event.paths.join(", ")}`);
      debouncedSync();
    }
  } catch (err: unknown) {
    if (err instanceof Error) {
      error(`Watcher error: ${err.message}`);
    } else {
      error(`Unknown watcher error: ${err}`);
    }
  } finally {
    watcher.close();
  }
}
