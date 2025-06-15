import { handleCaughtError } from "@/core/utils/handleCaughtError.ts";
import { FileSystemError } from "@/core/errors.ts";

/**
 * Checks if the directory exists.
 *
 * @param {string} path - The directory path to check.
 * @returns {Promise<boolean>} - Returns true if the directory exists, false otherwise.
 */
export async function directoryExists(path: string): Promise<boolean> {
  try {
    const stat = await Deno.stat(path);
    return stat.isDirectory;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    } else {
      handleCaughtError(error, `Error occurred while checking ${path}:`);
      throw new FileSystemError(`Failed to check directory existence: ${error instanceof Error ? error.message : 'Unknown error'}`, path);
    }
  }
}
