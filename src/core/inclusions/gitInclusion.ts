import { log } from "../utils/logging.ts";
import { Frame } from "../Frame.ts";
import { GitInclusion } from "../../types.ts";
import { exists, ensureDir } from "../../deps/fs.ts";
import { BuildResult } from "../interfaces/build.ts";
import { copyFiles } from "../utils/file/fileUtils.ts";

/**
 * Processes a git inclusion by copying files from the repository to the destination directory.
 */
export async function processGitInclusion(inclusion: GitInclusion, destDir: string, result: BuildResult): Promise<void> {
  const { localPath, options, url, name } = inclusion;
  const frame = Frame.getInstance();
  const config = frame.config;

  log.info(`Processing git inclusion: ${name || url}`);
  log.info(`Local path: ${localPath}`);
  log.info(`Include patterns: ${options.include.join(', ') || 'none'}`);
  log.info(`Exclude patterns: ${options.exclude.join(', ') || 'none'}`);
  log.info(`Exclude by default: ${options.excludeByDefault}`);

  // List files in the repository directory
  try {
    log.info(`Listing files in ${localPath}:`);
    for await (const entry of Deno.readDir(localPath)) {
      log.info(`  ${entry.name} (${entry.isDirectory ? 'directory' : 'file'})`);
    }
  } catch (error) {
    log.error(`Error listing files in ${localPath}: ${error instanceof Error ? error.message : "Unknown error"}`);
  }

  // Create repository directory if it doesn't exist
  if (!await exists(localPath)) {
    log.info(`Repository directory does not exist: ${localPath}. Creating it...`);
    try {
      await ensureDir(localPath);
      log.info(`Created repository directory: ${localPath}`);
    } catch (error) {
      const errorMessage = `Failed to create repository directory ${localPath}: ${error instanceof Error ? error.message : "Unknown error"}`;
      result.errors.push(errorMessage);
      log.error(errorMessage);
      return;
    }
  }

  // Use inclusion's strategies or fall back to global
  const collisionStrategy = options.collisionStrategy || config.global.globalCollisionStrategy;
  const updateStrategy = options.updateStrategy || config.global.globalUpdateStrategy;

  // Copy files from repository to destination
  await copyFiles(
    localPath, 
    destDir, 
    options.include, 
    options.exclude, 
    options.excludeByDefault, 
    collisionStrategy,
    updateStrategy,
    options.ignoreMissingTimestamps || config.global.ignoreMissingTimestamps,
    inclusion, 
    result
  );
}
