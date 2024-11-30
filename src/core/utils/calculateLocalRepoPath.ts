import { join } from "../../deps/path.ts";

export async function calculateLocalRepoPath(repoDir: string, url: string, branch: string): Promise<string> {
  const urlForParsing = url.startsWith("git@")
    ? new URL(`https://${url.replace("git@", "").replace(":", "/")}`)
    : new URL(url);

  const hostname = urlForParsing.hostname;
  const parent = urlForParsing.pathname.split("/")[1];
  const repoName = urlForParsing.pathname.split("/")[2].replace(".git", "");

  return join(repoDir, `${hostname}/${parent}/${repoName}.${branch}`);
}