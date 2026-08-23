import { dirname, isAbsolute, relative, resolve } from "@std/path";

export type AtomicPlannedWrite = {
  path: string;
  mode: "create" | "update";
  phase: string;
  contents: string | Uint8Array;
};

export interface AtomicFilePlanHooks {
  beforeWrite?: (write: AtomicPlannedWrite) => Promise<void> | void;
}

export interface AtomicFilePlanResult {
  createdPaths: readonly string[];
  updatedPaths: readonly string[];
}

export class AtomicFilePlanError extends Error {
  readonly path: string;
  readonly phase: string;
  readonly rollbackFailedPaths: readonly string[];
  override readonly cause?: unknown;

  constructor(options: {
    path: string;
    phase: string;
    rollbackFailedPaths: readonly string[];
    cause: unknown;
  }) {
    super(
      options.rollbackFailedPaths.length === 0
        ? `Atomic file plan failed during ${options.phase}: ${options.path}`
        : `Atomic file plan failed during ${options.phase} and rollback failed for: ${
          options.rollbackFailedPaths.join(", ")
        }`,
      { cause: options.cause },
    );
    this.name = "AtomicFilePlanError";
    this.path = options.path;
    this.phase = options.phase;
    this.rollbackFailedPaths = options.rollbackFailedPaths;
    this.cause = options.cause;
  }
}

export async function executeAtomicFilePlan(
  meshRoot: string,
  writes: readonly AtomicPlannedWrite[],
  hooks: AtomicFilePlanHooks = {},
): Promise<AtomicFilePlanResult> {
  const absoluteMeshRoot = resolve(meshRoot);
  const seen = new Set<string>();
  const priorBytes = new Map<string, Uint8Array>();
  const createdDirectories = new Set<string>();

  for (const write of writes) {
    assertSafeRelativePath(absoluteMeshRoot, write.path);
    if (seen.has(write.path)) {
      throw new Error(`Atomic file plan repeats path: ${write.path}`);
    }
    seen.add(write.path);
    const absolutePath = resolve(absoluteMeshRoot, write.path);
    if (write.mode === "create") {
      try {
        await Deno.stat(absolutePath);
        throw new Error(`Atomic create target already exists: ${write.path}`);
      } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
          for (
            const directory of await listMissingParentDirectories(
              absoluteMeshRoot,
              dirname(absolutePath),
            )
          ) {
            createdDirectories.add(directory);
          }
          continue;
        }
        throw error;
      }
    }

    const stat = await Deno.stat(absolutePath);
    if (!stat.isFile) {
      throw new Error(`Atomic update target is not a file: ${write.path}`);
    }
    priorBytes.set(write.path, await Deno.readFile(absolutePath));
  }

  const completed: AtomicPlannedWrite[] = [];
  for (const write of writes) {
    try {
      await hooks.beforeWrite?.(write);
      const absolutePath = resolve(absoluteMeshRoot, write.path);
      const bytes = typeof write.contents === "string"
        ? new TextEncoder().encode(write.contents)
        : write.contents;
      if (write.mode === "create") {
        await Deno.mkdir(dirname(absolutePath), { recursive: true });
        await Deno.writeFile(absolutePath, bytes, { createNew: true });
      } else {
        await writeFileAtomically(absolutePath, bytes);
      }
      completed.push(write);
    } catch (cause) {
      const rollbackFailedPaths = await rollbackWrites(
        absoluteMeshRoot,
        completed,
        priorBytes,
        createdDirectories,
      );
      throw new AtomicFilePlanError({
        path: write.path,
        phase: write.phase,
        rollbackFailedPaths,
        cause,
      });
    }
  }

  return {
    createdPaths: writes.filter((write) => write.mode === "create").map((
      write,
    ) => write.path),
    updatedPaths: writes.filter((write) => write.mode === "update").map((
      write,
    ) => write.path),
  };
}

async function rollbackWrites(
  meshRoot: string,
  completed: readonly AtomicPlannedWrite[],
  priorBytes: ReadonlyMap<string, Uint8Array>,
  createdDirectories: ReadonlySet<string>,
): Promise<string[]> {
  const failed: string[] = [];
  for (const write of [...completed].reverse()) {
    const absolutePath = resolve(meshRoot, write.path);
    try {
      if (write.mode === "create") {
        await Deno.remove(absolutePath);
      } else {
        const bytes = priorBytes.get(write.path);
        if (bytes === undefined) {
          throw new Error("missing rollback bytes");
        }
        await writeFileAtomically(absolutePath, bytes);
      }
    } catch {
      failed.push(write.path);
    }
  }
  await removeCreatedDirectories(createdDirectories);
  return failed;
}

async function writeFileAtomically(
  absolutePath: string,
  bytes: Uint8Array,
): Promise<void> {
  await Deno.mkdir(dirname(absolutePath), { recursive: true });
  const temporaryPath = `${absolutePath}.weave-tmp-${crypto.randomUUID()}`;
  try {
    await Deno.writeFile(temporaryPath, bytes, { createNew: true });
    await Deno.rename(temporaryPath, absolutePath);
  } finally {
    try {
      await Deno.remove(temporaryPath);
    } catch {
      // The target rename is the operation result; best-effort temp cleanup
      // must not hide its success or replace its failure.
    }
  }
}

async function listMissingParentDirectories(
  meshRoot: string,
  start: string,
): Promise<string[]> {
  const missing: string[] = [];
  let current = start;
  while (current !== meshRoot && pathIsWithin(meshRoot, current)) {
    try {
      const stat = await Deno.stat(current);
      if (!stat.isDirectory) {
        throw new Error(`Atomic create parent is not a directory: ${current}`);
      }
      break;
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
      missing.push(current);
    }
    current = dirname(current);
  }
  return missing;
}

async function removeCreatedDirectories(
  createdDirectories: ReadonlySet<string>,
): Promise<void> {
  const deepestFirst = [...createdDirectories].sort((left, right) =>
    right.length - left.length
  );
  for (const directory of deepestFirst) {
    try {
      await Deno.remove(directory);
    } catch {
      // Remove only directories created by this plan, and only when they are
      // still empty. Concurrent or external contents are left untouched.
    }
  }
}

function assertSafeRelativePath(meshRoot: string, path: string): void {
  if (path.length === 0 || isAbsolute(path)) {
    throw new Error(
      `Atomic file plan path must be mesh-root-relative: ${path}`,
    );
  }
  if (!pathIsWithin(meshRoot, resolve(meshRoot, path))) {
    throw new Error(`Atomic file plan path escapes the mesh root: ${path}`);
  }
}

function pathIsWithin(root: string, path: string): boolean {
  const fromRoot = relative(root, path);
  return fromRoot === "" ||
    (fromRoot !== ".." && !fromRoot.startsWith(`..${separator()}`) &&
      !isAbsolute(fromRoot));
}

function separator(): string {
  return Deno.build.os === "windows" ? "\\" : "/";
}
