import { join } from "@std/path";

export type VersionIncrement = "major" | "minor" | "patch";

export interface BumpVersionOptions {
  root: string;
  increment?: VersionIncrement;
  version?: string;
  releaseNoteId?: string;
  timestamp?: number;
}

export interface BumpVersionResult {
  previousVersion: string;
  nextVersion: string;
  denoConfigPath: string;
  releaseNotesPath: string;
  releaseNotesCreated: boolean;
}

interface DenoConfigWithVersion {
  version?: unknown;
  [key: string]: unknown;
}

if (import.meta.main) {
  try {
    const result = await bumpVersion(parseBumpVersionArgs(Deno.args));
    console.log(
      `Updated version ${result.previousVersion} -> ${result.nextVersion}`,
    );
    console.log(
      result.releaseNotesCreated
        ? `Created ${result.releaseNotesPath}`
        : `Verified ${result.releaseNotesPath}`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}

export function parseBumpVersionArgs(
  args: readonly string[],
): BumpVersionOptions {
  let root = Deno.cwd();
  let increment: VersionIncrement | undefined;
  let version: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    switch (arg) {
      case "--":
        break;
      case "--root":
        index += 1;
        root = requireArgumentValue(args[index], "--root");
        break;
      case "--major":
      case "--minor":
      case "--patch":
        increment = setSingleIncrement(increment, arg.slice(2));
        break;
      case "--version":
        index += 1;
        version = requireArgumentValue(args[index], "--version");
        break;
      default:
        if (arg.startsWith("--root=")) {
          root = requireArgumentValue(arg.slice("--root=".length), "--root");
          break;
        }
        if (arg.startsWith("--version=")) {
          version = requireArgumentValue(
            arg.slice("--version=".length),
            "--version",
          );
          break;
        }
        throw new Error(`Unsupported bump:version argument: ${arg}`);
    }
  }

  if ((increment === undefined) === (version === undefined)) {
    throw new Error(
      "bump:version requires exactly one of --major, --minor, --patch, or --version <version>",
    );
  }

  return { root, increment, version };
}

export async function bumpVersion(
  options: BumpVersionOptions,
): Promise<BumpVersionResult> {
  if ((options.increment === undefined) === (options.version === undefined)) {
    throw new Error(
      "Either version or increment must be provided, but not both",
    );
  }

  const denoConfigPath = join(options.root, "deno.json");
  const denoConfig = JSON.parse(
    await Deno.readTextFile(denoConfigPath),
  ) as DenoConfigWithVersion;
  const previousVersion = requireVersionString(denoConfig.version);
  const nextVersion = options.version ??
    incrementVersion(previousVersion, options.increment!);

  if (!isSupportedVersion(nextVersion)) {
    throw new Error(`Unsupported version: ${nextVersion}`);
  }

  if (denoConfig.version !== nextVersion) {
    denoConfig.version = nextVersion;
    await Deno.writeTextFile(
      denoConfigPath,
      `${JSON.stringify(denoConfig, null, 2)}\n`,
    );
  }

  const releaseNotesResult = await ensureReleaseNotes({
    root: options.root,
    version: nextVersion,
    id: options.releaseNoteId ?? crypto.randomUUID().replaceAll("-", ""),
    timestamp: options.timestamp ?? Date.now(),
  });

  return {
    previousVersion,
    nextVersion,
    denoConfigPath,
    releaseNotesPath: releaseNotesResult.path,
    releaseNotesCreated: releaseNotesResult.created,
  };
}

function requireArgumentValue(value: string | undefined, name: string): string {
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function setSingleIncrement(
  current: VersionIncrement | undefined,
  next: string,
): VersionIncrement {
  if (current !== undefined) {
    throw new Error("bump:version accepts only one increment flag");
  }
  if (next !== "major" && next !== "minor" && next !== "patch") {
    throw new Error(`Unsupported version increment: ${next}`);
  }
  return next;
}

function requireVersionString(value: unknown): string {
  if (typeof value !== "string" || !isSupportedVersion(value)) {
    throw new Error(
      "root deno.json must declare a semver-compatible string version",
    );
  }
  return value;
}

function incrementVersion(
  currentVersion: string,
  increment: VersionIncrement,
): string {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(currentVersion);
  if (!match) {
    throw new Error(`Cannot increment unsupported version: ${currentVersion}`);
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);

  switch (increment) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
  }
}

function isSupportedVersion(value: string): boolean {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(
    value,
  );
}

async function ensureReleaseNotes(options: {
  root: string;
  version: string;
  id: string;
  timestamp: number;
}): Promise<{ path: string; created: boolean }> {
  const notesDir = join(options.root, "documentation", "notes");
  const path = join(notesDir, `release-notes.v${options.version}.md`);

  try {
    const existing = await Deno.readTextFile(path);
    if (stripDendronFrontmatter(existing).trim().length === 0) {
      throw new Error(
        `Release notes body is empty after Dendron frontmatter: ${path}`,
      );
    }
    return { path, created: false };
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }

  await Deno.mkdir(notesDir, { recursive: true });
  await Deno.writeTextFile(path, renderReleaseNotesStub(options));
  return { path, created: true };
}

function stripDendronFrontmatter(contents: string): string {
  return contents.replace(/^---\n[\s\S]*?\n---\n?/, "");
}

function renderReleaseNotesStub(options: {
  version: string;
  id: string;
  timestamp: number;
}): string {
  return `---
id: ${options.id}
title: 'release notes v${options.version}'
desc: ''
updated: ${options.timestamp}
created: ${options.timestamp}
---

## Summary

TODO: summarize v${options.version}.

## Highlights

- TODO

## Breaking Or Changed Behavior

- TODO

## Artifacts

- TODO

## Validation

- TODO

## Known Limitations

- TODO

## Next

- TODO
`;
}
