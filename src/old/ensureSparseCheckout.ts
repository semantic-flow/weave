/**
 * Ensures the sparse-checkout configuration matches the desired include paths.
 * If there are differences, the configuration is updated.
 * 
 * @param {string} localRepoPath - The local repository path.
 * @param {string[]} includePaths - The desired sparse-checkout include paths.
 */
export async function ensureSparseCheckout(localRepoPath: string, includePaths: string[]) {
  console.log("Checking sparse-checkout configuration...");

  try {
    // Get the current sparse-checkout configuration
    const process = await new Deno.Command("/usr/bin/git", {
      args: ["sparse-checkout", "list"],
      cwd: localRepoPath,
    }).output();

    const currentSparseConfig = new TextDecoder().decode(process.stdout).trim().split("\n");

    // Compare with the desired include paths
    const missingPaths = includePaths.filter((path) => !currentSparseConfig.includes(path));
    const extraPaths = currentSparseConfig.filter((path) => !includePaths.includes(path));

    if (missingPaths.length > 0 || extraPaths.length > 0) {
      console.log("Sparse-checkout configuration has changed.");
      if (missingPaths.length > 0) {
        console.log(`Missing paths: ${missingPaths.join(", ")}`);
      }
      if (extraPaths.length > 0) {
        console.log(`Extra paths: ${extraPaths.join(", ")}`);
      }

      console.log("Updating sparse-checkout paths...");
      await new Deno.Command("/usr/bin/git", {
        args: ["sparse-checkout", "set", ...includePaths],
        cwd: localRepoPath,
      }).output();
      console.log("Sparse-checkout configuration updated.");
    } else {
      console.log("Sparse-checkout configuration is already up to date.");
    }
  } catch (err) {
    console.error("Failed to check or update sparse-checkout configuration:", err);
    throw err; // Propagate the error to the caller
  }
}
