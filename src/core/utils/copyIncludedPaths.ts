import { join, dirname } from "https://deno.land/std/path/mod.ts";
import { ensureDir, copy } from "https://deno.land/std/fs/mod.ts";

/**
 * Copies the specified paths (files and directories) from the source directory to the target directory.
 * Supports inclusion and exclusion of specific paths.
 * 
 * @param {string} sourceDir - The base directory of the repository.
 * @param {string} targetDir - The combined directory to copy contents into.
 * @param {object} options - Options containing include paths, exclude paths, and excludeByDefault flag.
 */
export async function copyIncludedPaths(
  sourceDir: string,
  targetDir: string,
  options: { include?: string[]; exclude?: string[]; excludeByDefault?: boolean } = {}
) {
  const { include, exclude = [], excludeByDefault = false } = options;

  // Helper to get all entries in a directory as an array
  const getDirEntries = async (path: string): Promise<string[]> => {
    const entries: string[] = [];
    for await (const entry of Deno.readDir(path)) {
      entries.push(entry.name);
    }
    return entries;
  };

  // Determine the paths to copy based on the logic summary
  let pathsToCopy: string[];
  if (include) {
    pathsToCopy = include.filter((item) => !exclude.includes(item));
  } else if (excludeByDefault) {
    pathsToCopy = [];
  } else {
    // Include everything by default if not explicitly excluded
    pathsToCopy = (await getDirEntries(sourceDir)).filter((item) => !exclude.includes(item));
  }

  console.log(`Paths to copy: ${pathsToCopy.join(", ")}`);

  for (const path of pathsToCopy) {
    const sourcePath = join(sourceDir, path);

    try {
      const entries = await getDirEntries(sourcePath);
      for (const entry of entries) {
        const sourceEntryPath = join(sourcePath, entry);
        const targetEntryPath = join(targetDir, entry);

        console.log(`Copying ${sourceEntryPath} to ${targetEntryPath}`);
        await ensureDir(dirname(targetEntryPath)); // Ensure the target directory exists
        await copy(sourceEntryPath, targetEntryPath, { overwrite: true });
      }
    } catch (err) {
      console.error(`Failed to copy contents of ${path}:`, err);
    }
  }
}
