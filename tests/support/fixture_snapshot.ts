import { dirname, join } from "@std/path";

const snapshotCacheRoot = "/tmp/semantic-flow-fixture-snapshots";
const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

export interface ResolvedFixtureRef {
  readonly requestedRef: string;
  readonly gitRef: string;
  readonly commit: string;
}

export interface FixtureSnapshotCacheOptions {
  readonly label: string;
  readonly repoPath: string;
  readonly candidatesForRef: (ref: string) => readonly string[];
}

interface FixtureSnapshot {
  readonly root: string;
  readonly paths: readonly string[];
}

export class FixtureSnapshotCache {
  readonly #label: string;
  readonly #repoPath: string;
  readonly #candidatesForRef: (ref: string) => readonly string[];
  readonly #resolvedRefs = new Map<string, Promise<ResolvedFixtureRef>>();
  readonly #snapshots = new Map<string, Promise<FixtureSnapshot>>();

  constructor(options: FixtureSnapshotCacheOptions) {
    this.#label = options.label;
    this.#repoPath = options.repoPath;
    this.#candidatesForRef = options.candidatesForRef;
  }

  async resolveRef(ref: string): Promise<ResolvedFixtureRef> {
    const cached = this.#resolvedRefs.get(ref);
    if (cached) {
      return await cached;
    }

    const pending = this.#resolveRefUncached(ref);
    this.#resolvedRefs.set(ref, pending);

    try {
      return await pending;
    } catch (error) {
      this.#resolvedRefs.delete(ref);
      throw error;
    }
  }

  async resolveCommit(ref: string): Promise<string> {
    return (await this.resolveRef(ref)).commit;
  }

  async readTextFile(ref: string, path: string): Promise<string> {
    const snapshot = await this.#snapshotForRef(ref);
    return await Deno.readTextFile(join(snapshot.root, path));
  }

  async listFiles(ref: string): Promise<string[]> {
    return [...(await this.#snapshotForRef(ref)).paths];
  }

  async materialize(ref: string, targetDir: string): Promise<string[]> {
    const snapshot = await this.#snapshotForRef(ref);

    for (const path of snapshot.paths) {
      const sourcePath = join(snapshot.root, path);
      const targetPath = join(targetDir, path);
      await Deno.mkdir(dirname(targetPath), { recursive: true });
      await Deno.copyFile(sourcePath, targetPath);
    }

    return [...snapshot.paths];
  }

  async #resolveRefUncached(ref: string): Promise<ResolvedFixtureRef> {
    const candidates = this.#candidatesForRef(ref);
    for (const candidate of candidates) {
      const output = await new Deno.Command("git", {
        args: [
          "-C",
          this.#repoPath,
          "rev-parse",
          "--verify",
          "--quiet",
          `${candidate}^{commit}`,
        ],
        stdout: "piped",
        stderr: "null",
      }).output();

      if (output.success) {
        return {
          requestedRef: ref,
          gitRef: candidate,
          commit: textDecoder.decode(output.stdout).trim(),
        };
      }
    }

    throw new Error(
      `Failed to resolve fixture ref ${ref} in ${this.#repoPath}; checked ${
        candidates.join(", ")
      }.`,
    );
  }

  async #snapshotForRef(ref: string): Promise<FixtureSnapshot> {
    const resolved = await this.resolveRef(ref);
    const cached = this.#snapshots.get(resolved.commit);
    if (cached) {
      return await cached;
    }

    const pending = this.#buildSnapshot(resolved);
    this.#snapshots.set(resolved.commit, pending);

    try {
      return await pending;
    } catch (error) {
      this.#snapshots.delete(resolved.commit);
      throw error;
    }
  }

  async #buildSnapshot(
    resolved: ResolvedFixtureRef,
  ): Promise<FixtureSnapshot> {
    const root = join(
      snapshotCacheRoot,
      safePathSegment(this.#label),
      resolved.commit,
    );
    const pathsFile = join(root, ".fixture-snapshot-paths.json");
    const completeFile = join(root, ".fixture-snapshot-complete");

    if (await isFile(completeFile) && await isFile(pathsFile)) {
      return {
        root,
        paths: JSON.parse(await Deno.readTextFile(pathsFile)) as string[],
      };
    }

    await Deno.remove(root, { recursive: true }).catch((error) => {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    });

    await Deno.mkdir(dirname(root), { recursive: true });
    const buildRoot = await Deno.makeTempDir({
      dir: dirname(root),
      prefix: `${resolved.commit}.build-`,
    });

    try {
      const paths = await this.#listGitTree(resolved);
      for (const path of paths) {
        const targetPath = join(buildRoot, path);
        await Deno.mkdir(dirname(targetPath), { recursive: true });
        await Deno.writeFile(
          targetPath,
          await this.#readGitBlob(resolved, path),
        );
      }

      await Deno.writeTextFile(
        join(buildRoot, ".fixture-snapshot-paths.json"),
        `${JSON.stringify(paths, null, 2)}\n`,
      );
      await Deno.writeFile(
        join(buildRoot, ".fixture-snapshot-complete"),
        textEncoder.encode("complete\n"),
      );

      try {
        await Deno.rename(buildRoot, root);
      } catch (error) {
        if (!(error instanceof Deno.errors.AlreadyExists)) {
          throw error;
        }
        await Deno.remove(buildRoot, { recursive: true });
      }

      return {
        root,
        paths: JSON.parse(await Deno.readTextFile(pathsFile)) as string[],
      };
    } catch (error) {
      await Deno.remove(buildRoot, { recursive: true }).catch(
        (removeError) => {
          if (!(removeError instanceof Deno.errors.NotFound)) {
            throw removeError;
          }
        },
      );
      throw error;
    }
  }

  async #listGitTree(resolved: ResolvedFixtureRef): Promise<string[]> {
    const output = await new Deno.Command("git", {
      args: [
        "-C",
        this.#repoPath,
        "ls-tree",
        "-r",
        "--name-only",
        resolved.gitRef,
      ],
      stdout: "piped",
      stderr: "piped",
    }).output();

    if (!output.success) {
      const message = textDecoder.decode(output.stderr).trim();
      throw new Error(
        `Failed to list fixture files for ${resolved.requestedRef}: ${message}`,
      );
    }

    return textDecoder.decode(output.stdout).split("\n").filter((path) =>
      path.length > 0
    );
  }

  async #readGitBlob(
    resolved: ResolvedFixtureRef,
    path: string,
  ): Promise<Uint8Array> {
    const output = await new Deno.Command("git", {
      args: ["-C", this.#repoPath, "show", `${resolved.gitRef}:${path}`],
      stdout: "piped",
      stderr: "piped",
    }).output();

    if (!output.success) {
      const message = textDecoder.decode(output.stderr).trim();
      throw new Error(
        `Failed to read fixture file ${resolved.requestedRef}:${path}: ${message}`,
      );
    }

    return output.stdout;
  }
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await Deno.stat(path)).isFile;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }
    throw error;
  }
}

function safePathSegment(value: string): string {
  return value.replaceAll(/[^A-Za-z0-9._-]/g, "-");
}
