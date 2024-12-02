import { join } from "../../deps/path.ts";

export function determineDefaultWorkingDirectory(workspaceDir: string, url: string, branch: string): string {
  const urlForParsing = url.startsWith("git@")
    ? new URL(`https://${url.replace("git@", "").replace(":", "/")}`)
    : new URL(url);

  const hostname = urlForParsing.hostname;
  const parent = urlForParsing.pathname.split("/")[1];
  const repoName = urlForParsing.pathname.split("/")[2].replace(".git", "");

  return join(workspaceDir, `${hostname}/${parent}/${repoName}.${branch}`);
}