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
): Promise<string[]> {
  const failed: string[] = [];
  for (const write of [...completed].reverse()) {
    const absolutePath = resolve(meshRoot, write.path);
    try {
      if (write.mode === "create") {
        await Deno.remove(absolutePath);
        await removeEmptyParents(meshRoot, dirname(absolutePath));
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

async function removeEmptyParents(meshRoot: string, start: string) {
  let current = start;
  while (current !== meshRoot && pathIsWithin(meshRoot, current)) {
    try {
      await Deno.remove(current);
    } catch {
      return;
    }
    current = dirname(current);
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
