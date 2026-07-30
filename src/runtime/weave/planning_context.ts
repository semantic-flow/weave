import { join } from "@std/path";
import type { PlannedFile } from "../../core/planned_file.ts";
import type { WeaveableKnopCandidate } from "../../core/weave/candidates.ts";

interface CandidateDependencyCapture {
  dependencyPaths: Set<string>;
}

interface CandidateCacheEntry {
  candidate: WeaveableKnopCandidate | undefined;
  dependencyPaths: ReadonlySet<string>;
}

export interface TextFileOverlayRetainedMemoryStats {
  stagedEntries: number;
  stagedBytes: number;
  readCacheEntries: number;
  readCacheBytes: number;
  readCacheHits: number;
  candidateCacheEntries: number;
  candidateCacheApproxRetainedBytes: number;
  candidateCacheStores: number;
  candidateCacheInvalidations: number;
}

export class TextFileOverlay extends Map<string, string> {
  #readCache = new Map<string, string>();
  #candidateCache = new Map<string, CandidateCacheEntry>();
  #activeCandidateCapture: CandidateDependencyCapture | undefined;
  readCount = 0;
  cacheHitCount = 0;
  stagedHitCount = 0;
  candidateCacheHitCount = 0;
  candidateCacheStoreCount = 0;
  candidateCacheInvalidationCount = 0;

  async readTextFile(path: string): Promise<string> {
    this.#activeCandidateCapture?.dependencyPaths.add(path);
    const stagedContents = this.get(path);
    if (stagedContents !== undefined) {
      this.stagedHitCount += 1;
      return stagedContents;
    }

    const cachedContents = this.#readCache.get(path);
    if (cachedContents !== undefined) {
      this.cacheHitCount += 1;
      return cachedContents;
    }

    const contents = await Deno.readTextFile(path);
    this.#readCache.set(path, contents);
    this.readCount += 1;
    return contents;
  }

  async loadCandidate(
    designatorPath: string,
    loader: () => Promise<WeaveableKnopCandidate | undefined>,
  ): Promise<WeaveableKnopCandidate | undefined> {
    const cached = this.#candidateCache.get(designatorPath);
    if (cached !== undefined) {
      this.candidateCacheHitCount += 1;
      return cached.candidate;
    }

    const previousCapture = this.#activeCandidateCapture;
    const capture: CandidateDependencyCapture = {
      dependencyPaths: new Set(),
    };
    this.#activeCandidateCapture = capture;
    try {
      const candidate = await loader();
      this.#candidateCache.set(designatorPath, {
        candidate,
        dependencyPaths: capture.dependencyPaths,
      });
      this.candidateCacheStoreCount += 1;
      return candidate;
    } finally {
      this.#activeCandidateCapture = previousCapture;
    }
  }

  stagePlannedFiles(
    workspaceRoot: string,
    files: readonly PlannedFile[],
  ): void {
    const stagedPaths = files.map((file) => join(workspaceRoot, file.path));
    for (
      const [file, absolutePath] of files.map((file, index) =>
        [file, stagedPaths[index]!] as const
      )
    ) {
      this.set(absolutePath, file.contents);
    }
    this.#invalidateCandidates(stagedPaths);
  }

  retainedMemoryStats(): TextFileOverlayRetainedMemoryStats {
    const encoder = new TextEncoder();
    return {
      stagedEntries: this.size,
      stagedBytes: sumTextBytes(this.values(), encoder),
      readCacheEntries: this.#readCache.size,
      readCacheBytes: sumTextBytes(this.#readCache.values(), encoder),
      readCacheHits: this.cacheHitCount,
      candidateCacheEntries: this.#candidateCache.size,
      candidateCacheApproxRetainedBytes: [...this.#candidateCache.values()]
        .reduce(
          (total, entry) =>
            total + approximateCandidateRetainedBytes(
              entry.candidate,
              encoder,
            ),
          0,
        ),
      candidateCacheStores: this.candidateCacheStoreCount,
      candidateCacheInvalidations: this.candidateCacheInvalidationCount,
    };
  }

  #invalidateCandidates(stagedPaths: readonly string[]): void {
    if (stagedPaths.length === 0 || this.#candidateCache.size === 0) {
      return;
    }

    for (const [designatorPath, entry] of this.#candidateCache) {
      if (
        stagedPaths.some((stagedPath) => entry.dependencyPaths.has(stagedPath))
      ) {
        this.#candidateCache.delete(designatorPath);
        this.candidateCacheInvalidationCount += 1;
      }
    }
  }
}

function sumTextBytes(
  values: Iterable<string>,
  encoder: TextEncoder,
): number {
  let total = 0;
  for (const value of values) {
    total += encoder.encode(value).byteLength;
  }
  return total;
}

function approximateCandidateRetainedBytes(
  candidate: WeaveableKnopCandidate | undefined,
  encoder: TextEncoder,
): number {
  if (candidate === undefined) {
    return 0;
  }

  let total = 0;
  const visited = new Set<object>();
  const visit = (value: unknown, fieldName = ""): void => {
    if (typeof value === "string") {
      if (/(?:turtle|text)$/i.test(fieldName)) {
        total += encoder.encode(value).byteLength;
      }
      return;
    }
    if (value instanceof Uint8Array) {
      if (/bytes$/i.test(fieldName)) {
        total += value.byteLength;
      }
      return;
    }
    if (value === null || typeof value !== "object" || visited.has(value)) {
      return;
    }
    visited.add(value);
    for (const [key, nestedValue] of Object.entries(value)) {
      visit(nestedValue, key);
    }
  };
  visit(candidate);
  return total;
}

export function applyPlannedFilesToOverlay(
  workspaceRoot: string,
  overlay: TextFileOverlay,
  files: readonly PlannedFile[],
): void {
  overlay.stagePlannedFiles(workspaceRoot, files);
}

export async function readTextFileWithOverlay(
  path: string,
  overlay?: ReadonlyMap<string, string>,
): Promise<string> {
  if (overlay instanceof TextFileOverlay) {
    return await overlay.readTextFile(path);
  }

  const stagedContents = overlay?.get(path);
  if (stagedContents !== undefined) {
    return stagedContents;
  }

  return await Deno.readTextFile(path);
}

export async function readOptionalTextFileWithOverlay(
  path: string,
  overlay?: ReadonlyMap<string, string>,
): Promise<string | undefined> {
  try {
    return await readTextFileWithOverlay(path, overlay);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return undefined;
    }
    throw error;
  }
}
