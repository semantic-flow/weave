import type { PlannedFile } from "../../core/planned_file.ts";
import type { WeaveableKnopCandidate } from "../../core/weave/candidates.ts";
import type {
  CandidateLiveSetRetainedMemoryStats,
  TextFileOverlay,
  TextFileOverlayRetainedMemoryStats,
} from "./planning_context.ts";

const MEMORY_STATS_ENV_VAR = "WEAVE_MEMORY_STATS";

export type CreatedFilePathClassification =
  | "meshInventoryHistorySnapshots"
  | "knopInventoriesAndMetadata"
  | "payloadSnapshots"
  | "other";

export interface RetainedFileStats {
  count: number;
  bytes: number;
}

export interface VersionExecutionRetainedMemoryStats {
  createdFiles: RetainedFileStats & {
    byPathClassification: Record<
      CreatedFilePathClassification,
      RetainedFileStats
    >;
  };
  updatedFileByPath: RetainedFileStats;
  overlayStaged: {
    entries: number;
    bytes: number;
  };
  readCache: {
    entries: number;
    bytes: number;
    hits: number;
  };
  candidateCache: {
    entries: number;
    approximateRetainedBytes: number;
    stores: number;
    invalidations: number;
  };
  candidateLiveSet: CandidateLiveSetRetainedMemoryStats;
  pageGeneration: {
    renderedPages: number;
    batches: number;
    maxBatchFiles: number;
    maxBatchBytes: number;
  };
  planningLoopIterations: number;
  maxRssBytes: number;
}

export interface RuntimeMemoryStatsReport
  extends VersionExecutionRetainedMemoryStats {
  command: string;
  v8Heap: {
    usedHeapSize: number;
    postGcUsedHeapSize: number | null;
    heapSizeLimit: number;
  };
}

export interface RuntimeMemoryStats {
  sampleRss(): void;
  samplePageRenderBatch(files: readonly PlannedFile[]): void;
  sampleCandidateLiveSet(
    workspaceRoot: string,
    candidates: readonly WeaveableKnopCandidate[],
    overlay: TextFileOverlay,
  ): void;
  samplePlanningLoopIteration(): void;
  captureVersionExecutionRetainedState(
    createdFiles: readonly PlannedFile[],
    updatedFiles: ReadonlyMap<string, PlannedFile>,
    overlay: TextFileOverlay,
  ): void;
  finish(): Promise<void>;
}

class EnabledRuntimeMemoryStats implements RuntimeMemoryStats {
  readonly #command: string;
  #finished = false;
  #planningLoopIterations = 0;
  #maxRssBytes = 0;
  #retainedState = emptyRetainedState();

  constructor(command: string) {
    this.#command = command;
  }

  sampleRss(): void {
    this.#sampleRss();
  }

  samplePageRenderBatch(files: readonly PlannedFile[]): void {
    this.#sampleRss();
    const encoder = new TextEncoder();
    const batchBytes = files.reduce(
      (total, file) => total + encoder.encode(file.contents).byteLength,
      0,
    );
    this.#retainedState.pageGeneration.renderedPages += files.length;
    this.#retainedState.pageGeneration.batches += 1;
    this.#retainedState.pageGeneration.maxBatchFiles = Math.max(
      this.#retainedState.pageGeneration.maxBatchFiles,
      files.length,
    );
    this.#retainedState.pageGeneration.maxBatchBytes = Math.max(
      this.#retainedState.pageGeneration.maxBatchBytes,
      batchBytes,
    );
  }

  sampleCandidateLiveSet(
    workspaceRoot: string,
    candidates: readonly WeaveableKnopCandidate[],
    overlay: TextFileOverlay,
  ): void {
    this.#sampleRss();
    const sampled = overlay.retainedCandidateLiveSetMemoryStats(
      workspaceRoot,
      candidates,
    );
    if (
      sampled.approximateRetainedSourceTextBytes >
        this.#retainedState.candidateLiveSet
          .approximateRetainedSourceTextBytes ||
      (sampled.approximateRetainedSourceTextBytes ===
          this.#retainedState.candidateLiveSet
            .approximateRetainedSourceTextBytes &&
        sampled.entries > this.#retainedState.candidateLiveSet.entries)
    ) {
      this.#retainedState.candidateLiveSet = sampled;
    }
  }

  samplePlanningLoopIteration(): void {
    this.#planningLoopIterations += 1;
    this.#sampleRss();
  }

  #sampleRss(): void {
    if (typeof Deno.memoryUsage === "function") {
      this.#maxRssBytes = Math.max(
        this.#maxRssBytes,
        Deno.memoryUsage().rss,
      );
    }
  }

  captureVersionExecutionRetainedState(
    createdFiles: readonly PlannedFile[],
    updatedFiles: ReadonlyMap<string, PlannedFile>,
    overlay: TextFileOverlay,
  ): void {
    this.#sampleRss();
    const encoder = new TextEncoder();
    const createdStats = emptyCreatedFileStats();
    for (const file of createdFiles) {
      const bytes = encoder.encode(file.contents).byteLength;
      createdStats.count += 1;
      createdStats.bytes += bytes;
      const classification = classifyCreatedFilePath(file.path);
      createdStats.byPathClassification[classification].count += 1;
      createdStats.byPathClassification[classification].bytes += bytes;
    }

    const updatedStats: RetainedFileStats = { count: 0, bytes: 0 };
    for (const file of updatedFiles.values()) {
      updatedStats.count += 1;
      updatedStats.bytes += encoder.encode(file.contents).byteLength;
    }

    const overlayStats = overlay.retainedMemoryStats();
    this.#retainedState = {
      createdFiles: createdStats,
      updatedFileByPath: updatedStats,
      ...toReportedOverlayStats(overlayStats),
      candidateLiveSet: this.#retainedState.candidateLiveSet,
      pageGeneration: this.#retainedState.pageGeneration,
      planningLoopIterations: this.#planningLoopIterations,
      maxRssBytes: this.#maxRssBytes,
    };
  }

  async finish(): Promise<void> {
    if (this.#finished) {
      return;
    }
    this.#finished = true;
    const { getHeapStatistics } = await import("node:v8");
    const preGcHeap = getHeapStatistics();
    const gc = (
      globalThis as typeof globalThis & { gc?: () => void }
    ).gc;
    let postGcUsedHeapSize: number | null = null;
    if (typeof gc === "function") {
      gc();
      postGcUsedHeapSize = getHeapStatistics().used_heap_size;
    }
    const report: RuntimeMemoryStatsReport = {
      command: this.#command,
      ...this.#retainedState,
      planningLoopIterations: this.#planningLoopIterations,
      maxRssBytes: this.#maxRssBytes,
      v8Heap: {
        usedHeapSize: preGcHeap.used_heap_size,
        postGcUsedHeapSize,
        heapSizeLimit: preGcHeap.heap_size_limit,
      },
    };
    console.error(`[memory-stats] ${JSON.stringify(report)}`);
  }
}

export function createRuntimeMemoryStats(
  command: string,
): RuntimeMemoryStats | undefined {
  return isRuntimeMemoryStatsEnabled()
    ? new EnabledRuntimeMemoryStats(command)
    : undefined;
}

export function classifyCreatedFilePath(
  path: string,
): CreatedFilePathClassification {
  const normalized = path.replaceAll("\\", "/");
  if (
    /^_mesh\/_inventory\/_history[^/]+\/_s[^/]+\//.test(normalized)
  ) {
    return "meshInventoryHistorySnapshots";
  }
  if (/(?:^|\/)_knop\/_(?:inventory|meta)(?:\/|$)/.test(normalized)) {
    return "knopInventoriesAndMetadata";
  }
  if (/(?:^|\/)_history[^/]+\/_s[^/]+\//.test(normalized)) {
    return "payloadSnapshots";
  }
  return "other";
}

function isRuntimeMemoryStatsEnabled(): boolean {
  let value: string | undefined;
  try {
    value = Deno.env.get(MEMORY_STATS_ENV_VAR);
  } catch {
    return false;
  }

  const normalized = value?.trim().toLowerCase();
  return normalized !== undefined &&
    normalized.length > 0 &&
    !["0", "false", "no", "off"].includes(normalized);
}

function emptyRetainedState(): VersionExecutionRetainedMemoryStats {
  return {
    createdFiles: emptyCreatedFileStats(),
    updatedFileByPath: { count: 0, bytes: 0 },
    overlayStaged: { entries: 0, bytes: 0 },
    readCache: { entries: 0, bytes: 0, hits: 0 },
    candidateCache: {
      entries: 0,
      approximateRetainedBytes: 0,
      stores: 0,
      invalidations: 0,
    },
    candidateLiveSet: {
      entries: 0,
      sourceTextReferences: 0,
      distinctSourceTextIdentities: 0,
      approximateRetainedSourceTextBytes: 0,
    },
    pageGeneration: {
      renderedPages: 0,
      batches: 0,
      maxBatchFiles: 0,
      maxBatchBytes: 0,
    },
    planningLoopIterations: 0,
    maxRssBytes: 0,
  };
}

function emptyCreatedFileStats(): VersionExecutionRetainedMemoryStats[
  "createdFiles"
] {
  return {
    count: 0,
    bytes: 0,
    byPathClassification: {
      meshInventoryHistorySnapshots: { count: 0, bytes: 0 },
      knopInventoriesAndMetadata: { count: 0, bytes: 0 },
      payloadSnapshots: { count: 0, bytes: 0 },
      other: { count: 0, bytes: 0 },
    },
  };
}

function toReportedOverlayStats(
  stats: TextFileOverlayRetainedMemoryStats,
): Pick<
  VersionExecutionRetainedMemoryStats,
  "overlayStaged" | "readCache" | "candidateCache"
> {
  return {
    overlayStaged: {
      entries: stats.stagedEntries,
      bytes: stats.stagedBytes,
    },
    readCache: {
      entries: stats.readCacheEntries,
      bytes: stats.readCacheBytes,
      hits: stats.readCacheHits,
    },
    candidateCache: {
      entries: stats.candidateCacheEntries,
      approximateRetainedBytes: stats.candidateCacheApproxRetainedBytes,
      stores: stats.candidateCacheStores,
      invalidations: stats.candidateCacheInvalidations,
    },
  };
}
