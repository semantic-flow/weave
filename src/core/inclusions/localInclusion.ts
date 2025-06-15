import { LocalInclusion } from "../../types.ts";
import { Frame } from "../Frame.ts";
import { exists } from "../../deps/fs.ts";
import { BuildResult } from "../interfaces/build.ts";
import { copyFiles } from "../utils/file/fileUtils.ts";

/**
 * Processes a local inclusion by copying files from the local directory to the destination directory.
 */
export async function processLocalInclusion(inclusion: LocalInclusion, destDir: string, result: BuildResult): Promise<void> {
  const { localPath, options } = inclusion;
  const frame = Frame.getInstance();
  const config = frame.config;

  // Skip if directory doesn't exist
  if (!await exists(localPath)) {
    result.errors.push(`Local directory does not exist: ${localPath}`);
    return;
  }

  // Use inclusion's strategies or fall back to global
  const collisionStrategy = options.collisionStrategy || config.global.globalCollisionStrategy;
  const updateStrategy = options.updateStrategy || config.global.globalUpdateStrategy;

  // Copy files from local directory to destination
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
