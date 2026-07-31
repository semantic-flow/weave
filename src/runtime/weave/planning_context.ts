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

interface RetainedTextIdentity {
  contents: string;
}

export interface CandidateLiveSetRetainedMemoryStats {
  entries: number;
  sourceTextReferences: number;
  distinctSourceTextIdentities: number;
  approximateRetainedSourceTextBytes: number;
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
  #readCache = new Map<string, RetainedTextIdentity>();
  #stagedTextIdentities = new Map<string, RetainedTextIdentity>();
  #candidateCache = new Map<string, CandidateCacheEntry>();
  #activeCandidateCapture: CandidateDependencyCapture | undefined;
  readCount = 0;
  cacheHitCount = 0;
  stagedHitCount = 0;
  candidateCacheHitCount = 0;
  candidateCacheStoreCount = 0;
  candidateCacheInvalidationCount = 0;

  async readTextFile(
    path: string,
    contentsIfUncached?: string,
  ): Promise<string> {
    this.#activeCandidateCapture?.dependencyPaths.add(path);
    const stagedContents = this.get(path);
    if (stagedContents !== undefined) {
      this.stagedHitCount += 1;
      return stagedContents;
    }

    const cachedIdentity = this.#readCache.get(path);
    if (cachedIdentity !== undefined) {
      this.cacheHitCount += 1;
      return cachedIdentity.contents;
    }

    const contents = contentsIfUncached ?? await Deno.readTextFile(path);
    this.#readCache.set(path, { contents });
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
      this.#stagedTextIdentities.set(absolutePath, {
        contents: file.contents,
      });
    }
    this.#invalidateCandidates(stagedPaths);
  }

  retainedMemoryStats(): TextFileOverlayRetainedMemoryStats {
    return {
      stagedEntries: this.size,
      stagedBytes: sumTextBytes(this.values()),
      readCacheEntries: this.#readCache.size,
      readCacheBytes: sumTextBytes(
        [...this.#readCache.values()].map((entry) => entry.contents),
      ),
      readCacheHits: this.cacheHitCount,
      candidateCacheEntries: this.#candidateCache.size,
      candidateCacheApproxRetainedBytes: [...this.#candidateCache.values()]
        .reduce(
          (total, entry) =>
            total + approximateCandidateRetainedBytes(entry.candidate),
          0,
        ),
      candidateCacheStores: this.candidateCacheStoreCount,
      candidateCacheInvalidations: this.candidateCacheInvalidationCount,
    };
  }

  retainedCandidateLiveSetMemoryStats(
    workspaceRoot: string,
    candidates: readonly WeaveableKnopCandidate[],
  ): CandidateLiveSetRetainedMemoryStats {
    const retainedIdentities = new Set<RetainedTextIdentity>();
    let sourceTextReferences = 0;
    let distinctSourceTextIdentities = 0;
    let approximateRetainedSourceTextBytes = 0;

    for (const candidate of candidates) {
      for (const sourceText of candidateSourceTexts(candidate)) {
        sourceTextReferences += 1;
        const absolutePath = join(workspaceRoot, sourceText.path);
        const identity = this.#retainedTextIdentity(
          absolutePath,
          sourceText.contents,
        );
        if (identity !== undefined) {
          if (retainedIdentities.has(identity)) {
            continue;
          }
          retainedIdentities.add(identity);
        }
        distinctSourceTextIdentities += 1;
        approximateRetainedSourceTextBytes += textBytes(sourceText.contents);
      }
    }

    return {
      entries: candidates.length,
      sourceTextReferences,
      distinctSourceTextIdentities,
      approximateRetainedSourceTextBytes,
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

  #retainedTextIdentity(
    path: string,
    contents: string,
  ): RetainedTextIdentity | undefined {
    const stagedIdentity = this.#stagedTextIdentities.get(path);
    if (stagedIdentity?.contents === contents) {
      return stagedIdentity;
    }
    const cachedIdentity = this.#readCache.get(path);
    return cachedIdentity?.contents === contents ? cachedIdentity : undefined;
  }
}

// A shared value instead of a TextEncoder-typed parameter: dnt's Node type
// checking has no global TextEncoder type, only the shimmed value.
const RETAINED_BYTES_ENCODER = new TextEncoder();

function sumTextBytes(values: Iterable<string>): number {
  let total = 0;
  for (const value of values) {
    total += RETAINED_BYTES_ENCODER.encode(value).byteLength;
  }
  return total;
}

function textBytes(value: string): number {
  return RETAINED_BYTES_ENCODER.encode(value).byteLength;
}

function candidateSourceTexts(
  candidate: WeaveableKnopCandidate,
): readonly { path: string; contents: string }[] {
  const sourceTexts: { path: string; contents: string }[] = [];
  const payload = candidate.payloadArtifact;
  if (payload !== undefined) {
    sourceTexts.push({
      path: payload.workingLocalRelativePath,
      contents: payload.currentPayloadTurtle,
    });
    if (
      payload.latestHistoricalSnapshotPath !== undefined &&
      payload.latestHistoricalSnapshotTurtle !== undefined
    ) {
      sourceTexts.push({
        path: payload.latestHistoricalSnapshotPath,
        contents: payload.latestHistoricalSnapshotTurtle,
      });
    }
  }

  const referenceSource = candidate.referenceTargetSourcePayloadArtifact;
  if (referenceSource !== undefined) {
    sourceTexts.push({
      path: referenceSource.workingLocalRelativePath,
      contents: referenceSource.currentPayloadTurtle,
    });
    if (
      referenceSource.latestHistoricalSnapshotPath !== undefined &&
      referenceSource.latestHistoricalSnapshotTurtle !== undefined
    ) {
      sourceTexts.push({
        path: referenceSource.latestHistoricalSnapshotPath,
        contents: referenceSource.latestHistoricalSnapshotTurtle,
      });
    }
  }
  return sourceTexts;
}

function approximateCandidateRetainedBytes(
  candidate: WeaveableKnopCandidate | undefined,
): number {
  if (candidate === undefined) {
    return 0;
  }

  let total = 0;
  const visited = new Set<object>();
  const visit = (value: unknown, fieldName = ""): void => {
    if (typeof value === "string") {
      if (/(?:turtle|text)$/i.test(fieldName)) {
        total += RETAINED_BYTES_ENCODER.encode(value).byteLength;
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
  contentsIfUncached?: string,
): Promise<string> {
  if (overlay instanceof TextFileOverlay) {
    return await overlay.readTextFile(path, contentsIfUncached);
  }

  const stagedContents = overlay?.get(path);
  if (stagedContents !== undefined) {
    return stagedContents;
  }

  return contentsIfUncached ?? await Deno.readTextFile(path);
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
