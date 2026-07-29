import { resolve } from "@std/path";
import * as pathPosix from "@std/path/posix";
import {
  collectRepositorySourceCandidateRoots,
  fileExists,
  isWithinRoot,
  LocalPathAccessError,
  type OperationalLocalPathPolicy,
  resolvePosixRelativePath,
} from "./local_path_policy.ts";

// Repository-source resolution shells out to git, so it lives apart from
// local_path_policy.ts: the library API graph imports the policy module and
// must stay subprocess-free (see src/api/fs_purity_test.ts).

export interface RepositorySourceFloatingLocatorResolution {
  repositoryUrl: string;
  repositoryPathFromRoot: string;
}

export async function resolveRepositorySourceFloatingLocalPath(
  policy: OperationalLocalPathPolicy,
  locator: RepositorySourceFloatingLocatorResolution,
): Promise<string> {
  const repositoryPathFromRoot = normalizeRepositoryPathFromRoot(
    locator.repositoryPathFromRoot,
  );
  const candidateRoots = collectRepositorySourceCandidateRoots(policy);

  for (const candidateRoot of candidateRoots) {
    const repositoryRoot = await tryResolveGitRepositoryRoot(candidateRoot);
    if (!repositoryRoot) {
      continue;
    }
    const remoteUrls = await listGitRemoteUrls(repositoryRoot);
    if (
      !remoteUrls.some((remoteUrl) =>
        repositoryUrlsMatch(remoteUrl, locator.repositoryUrl)
      )
    ) {
      continue;
    }

    const localPath = resolvePosixRelativePath(
      repositoryRoot,
      repositoryPathFromRoot,
    );
    if (!isWithinRoot(localPath, repositoryRoot)) {
      throw new LocalPathAccessError(
        `Repository source path escapes the repository root: ${repositoryPathFromRoot}`,
      );
    }
    if (!isWithinRoot(localPath, candidateRoot)) {
      continue;
    }
    if (!await fileExists(localPath)) {
      continue;
    }
    return localPath;
  }

  throw new LocalPathAccessError(
    `Repository source locator did not match an allowed local checkout: ${locator.repositoryUrl} ${repositoryPathFromRoot}`,
  );
}

function normalizeRepositoryPathFromRoot(pathFromRoot: string): string {
  const trimmed = pathFromRoot.trim();
  if (
    trimmed.length === 0 ||
    trimmed.startsWith("/") ||
    trimmed.endsWith("/") ||
    /^[A-Za-z]:/.test(trimmed) ||
    trimmed.includes("\\") ||
    trimmed.includes("?") ||
    trimmed.includes("#") ||
    /\s/.test(trimmed)
  ) {
    throw new LocalPathAccessError(
      `Invalid sourceRepositoryPathFromRoot: ${pathFromRoot}`,
    );
  }

  const normalized = pathPosix.normalize(trimmed);
  if (
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../")
  ) {
    throw new LocalPathAccessError(
      `Invalid sourceRepositoryPathFromRoot: ${pathFromRoot}`,
    );
  }

  return normalized;
}

async function tryResolveGitRepositoryRoot(
  candidateRoot: string,
): Promise<string | undefined> {
  const output = await tryRunGit([
    "-C",
    candidateRoot,
    "rev-parse",
    "--show-toplevel",
  ]);
  return output === undefined ? undefined : resolve(output);
}

async function listGitRemoteUrls(
  repositoryRoot: string,
): Promise<readonly string[]> {
  const remotesOutput = await tryRunGit(["-C", repositoryRoot, "remote"]);
  if (remotesOutput === undefined || remotesOutput.trim().length === 0) {
    return [];
  }

  const urls = new Set<string>();
  for (const remoteName of remotesOutput.split(/\r?\n/)) {
    const trimmedRemoteName = remoteName.trim();
    if (trimmedRemoteName.length === 0) {
      continue;
    }
    const urlsOutput = await tryRunGit([
      "-C",
      repositoryRoot,
      "remote",
      "get-url",
      "--all",
      trimmedRemoteName,
    ]);
    if (urlsOutput === undefined) {
      continue;
    }
    for (const url of urlsOutput.split(/\r?\n/)) {
      const trimmedUrl = url.trim();
      if (trimmedUrl.length > 0) {
        urls.add(trimmedUrl);
      }
    }
  }

  return [...urls];
}

// Resolved through globalThis so the npm build (dnt) neither type-checks nor
// links against a subprocess API its Deno shim does not provide. When git is
// effectively unavailable — no Deno.Command (Node), no git binary on PATH, or
// no run permission — git resolution degrades to "no repository checkout
// matched" instead of crashing.
type SubprocessCommandConstructor = new (
  command: string,
  options: {
    args: readonly string[];
    stdout: "piped";
    stderr: "piped";
  },
) => {
  output(): Promise<{ success: boolean; stdout: Uint8Array }>;
};

function subprocessCommandConstructor():
  | SubprocessCommandConstructor
  | undefined {
  return (globalThis as unknown as {
    Deno?: { Command?: SubprocessCommandConstructor };
  }).Deno?.Command;
}

async function tryRunGit(args: readonly string[]): Promise<string | undefined> {
  const SubprocessCommand = subprocessCommandConstructor();
  if (SubprocessCommand === undefined) {
    return undefined;
  }
  let output;
  try {
    const command = new SubprocessCommand("git", {
      args: [...args],
      stdout: "piped",
      stderr: "piped",
    });
    output = await command.output();
  } catch (error) {
    if (isGitUnavailableError(error)) {
      return undefined;
    }
    throw error;
  }
  if (!output.success) {
    return undefined;
  }
  return new TextDecoder().decode(output.stdout).trim();
}

// Matched by name rather than instanceof so the check works under both the
// Deno runtime and the dnt shim, whose error classes differ.
function isGitUnavailableError(error: unknown): boolean {
  return error instanceof Error &&
    (error.name === "NotFound" ||
      error.name === "NotCapable" ||
      error.name === "PermissionDenied");
}

function repositoryUrlsMatch(left: string, right: string): boolean {
  return left === right ||
    normalizeRepositoryUrlForComparison(left) ===
      normalizeRepositoryUrlForComparison(right);
}

function normalizeRepositoryUrlForComparison(url: string): string {
  let normalized = url.trim();
  if (!normalized.includes("://")) {
    const sshScpMatch = /^([^@]+@)?([^:]+):(.+)$/.exec(normalized);
    if (sshScpMatch) {
      normalized = `https://${sshScpMatch[2]}/${sshScpMatch[3]}`;
    }
  } else {
    try {
      const parsedUrl = new URL(normalized);
      if (
        parsedUrl.protocol === "ssh:" &&
        (parsedUrl.username === "git" || parsedUrl.username.length === 0)
      ) {
        normalized = `https://${parsedUrl.host}${parsedUrl.pathname}`;
      }
    } catch {
      // Fall through to lightweight string normalization below.
    }
  }
  while (normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  if (normalized.endsWith(".git")) {
    normalized = normalized.slice(0, -".git".length);
  }
  return normalized;
}
