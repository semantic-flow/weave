import {
  dirname,
  fromFileUrl,
  isAbsolute,
  join,
  relative,
  resolve,
} from "@std/path";
import { Parser } from "n3";
import {
  ImportInputError,
  type ImportPlan,
  planImport,
} from "../../core/import/import.ts";
import {
  normalizeSafeDesignatorPath,
  toKnopPath,
} from "../../core/designator_segments.ts";
import {
  MeshMetadataResolutionError,
  resolveMeshBaseFromMetadataTurtle,
} from "../mesh/metadata.ts";
import { resolveRuntimeLoggers } from "../logging/factory.ts";
import type { AuditLogger } from "../logging/audit_logger.ts";
import type { StructuredLogger } from "../logging/logger.ts";
import { loadOperationalLocalPathPolicy } from "../operational/local_path_policy.ts";

const DEFAULT_HTTP_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_HTTP_BYTES = 10 * 1024 * 1024;

export interface LocalImportRequest {
  source: string;
  designatorPath: string;
  workingFile: string;
  expectedDigest?: string;
  replaceWorking?: boolean;
}

export interface ExecuteImportOptions {
  meshRoot: string;
  sourceBaseDirectory?: string;
  request: LocalImportRequest;
  operationalLogger?: StructuredLogger;
  auditLogger?: AuditLogger;
  now?: () => Date;
  sourceFetch?: typeof fetch;
  httpTimeoutMs?: number;
  maxHttpBytes?: number;
}

export interface ImportResult {
  meshBase: string;
  designatorPath: string;
  payloadArtifactIri: string;
  knopIri: string;
  workingLocalRelativePath: string;
  sourceBindingIri: string;
  observedContentDigest: string;
  createdPaths: readonly string[];
  updatedPaths: readonly string[];
}

export class ImportRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportRuntimeError";
  }
}

export async function executeImport(
  options: ExecuteImportOptions,
): Promise<ImportResult> {
  const { operationalLogger, auditLogger } = resolveLoggers(options);
  const meshRoot = options.meshRoot;
  const source = options.request.source;
  const designatorPath = options.request.designatorPath;
  const workingFile = options.request.workingFile;
  const replaceWorking = options.request.replaceWorking === true;
  const localPathPolicy = await loadOperationalLocalPathPolicy(meshRoot);
  const workspaceRoot = localPathPolicy.workspaceRoot;
  const sourceBaseDirectory = options.sourceBaseDirectory ?? meshRoot;
  let plan: ImportPlan | undefined;
  let workingFileExisted = false;

  await operationalLogger.info(
    "import.started",
    "Starting import",
    {
      workspaceRoot,
      meshRoot,
      designatorPath,
      source,
      workingFile,
      replaceWorking,
    },
  );
  await auditLogger.record(
    "import.started",
    "Import started",
    {
      workspaceRoot,
      meshRoot,
      designatorPath,
      source,
      workingFile,
      replaceWorking,
    },
  );

  try {
    await ensureMeshRootExists(meshRoot);
    const normalizedDesignatorPath = normalizeLocalDesignatorPath(
      designatorPath,
      "designatorPath",
    );
    const acquiredSource = await acquireImportSource(
      sourceBaseDirectory,
      meshRoot,
      source,
      {
        sourceFetch: options.sourceFetch ?? fetch,
        httpTimeoutMs: options.httpTimeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS,
        maxHttpBytes: options.maxHttpBytes ?? DEFAULT_MAX_HTTP_BYTES,
      },
    );
    const observedContentDigest = await sha256Digest(acquiredSource.bytes);
    if (
      options.request.expectedDigest !== undefined &&
      options.request.expectedDigest !== observedContentDigest
    ) {
      throw new ImportRuntimeError(
        `import source digest mismatch: expected ${options.request.expectedDigest}, computed ${observedContentDigest}`,
      );
    }

    const meshState = await loadCurrentImportState(
      meshRoot,
      normalizedDesignatorPath,
    );
    const observedAt = (options.now ?? (() => new Date()))().toISOString();
    plan = planImport({
      meshBase: meshState.meshBase,
      currentMeshInventoryTurtle: meshState.currentMeshInventoryTurtle,
      ...(meshState.currentKnopInventoryTurtle
        ? { currentKnopInventoryTurtle: meshState.currentKnopInventoryTurtle }
        : {}),
      designatorPath: normalizedDesignatorPath,
      workingLocalRelativePath: workingFile,
      importedBytes: acquiredSource.bytes,
      payloadIsRdfDocument: isRdfLikeImport(
        workingFile,
        acquiredSource.sourcePathForContentKind,
        acquiredSource.contentType,
      ),
      replaceWorking,
      sourceBinding: {
        ...(acquiredSource.targetAccessUrl
          ? { targetAccessUrl: acquiredSource.targetAccessUrl }
          : {}),
        ...(acquiredSource.targetLocalRelativePath
          ? { targetLocalRelativePath: acquiredSource.targetLocalRelativePath }
          : {}),
        ...(options.request.expectedDigest
          ? { expectedContentDigest: options.request.expectedDigest }
          : {}),
        observation: {
          observedContentDigest,
          observedTargetLocalRelativePath: workingFile,
          observedAt,
        },
        artifactResolutionMode: "working",
      },
    });
    validateRdfPlan(plan);
    workingFileExisted = await assertWorkingFileWriteAllowed(
      meshRoot,
      plan,
      replaceWorking,
    );
    await assertCreateTargetsDoNotExist(meshRoot, plan);
    await assertUpdatedTargetsExist(meshRoot, plan);
    await writeWorkingFile(meshRoot, plan, workingFileExisted);
    await writeCreatedFiles(meshRoot, plan);
    await writeUpdatedFiles(meshRoot, plan);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await operationalLogger.error(
      "import.failed",
      "Import failed",
      {
        workspaceRoot,
        meshRoot,
        designatorPath,
        source,
        workingFile,
        payloadArtifactIri: plan?.payloadArtifactIri,
        knopIri: plan?.knopIri,
        error: message,
      },
    );
    await auditLogger.record(
      "import.failed",
      "Import failed",
      {
        workspaceRoot,
        meshRoot,
        designatorPath,
        source,
        workingFile,
        payloadArtifactIri: plan?.payloadArtifactIri,
        knopIri: plan?.knopIri,
        error: message,
      },
    );

    if (
      error instanceof ImportInputError ||
      error instanceof ImportRuntimeError
    ) {
      throw error;
    }
    throw new ImportRuntimeError(message);
  }

  const result: ImportResult = {
    meshBase: plan.meshBase,
    designatorPath: plan.designatorPath,
    payloadArtifactIri: plan.payloadArtifactIri,
    knopIri: plan.knopIri,
    workingLocalRelativePath: plan.workingLocalRelativePath,
    sourceBindingIri: plan.sourceBindingIri,
    observedContentDigest: plan.observedContentDigest,
    createdPaths: [
      ...(!workingFileExisted
        ? [toWorkspaceRelativePath(localPathPolicy, plan.workingFile.path)]
        : []),
      ...plan.createdFiles.map((file) =>
        toWorkspaceRelativePath(localPathPolicy, file.path)
      ),
    ],
    updatedPaths: [
      ...(workingFileExisted
        ? [toWorkspaceRelativePath(localPathPolicy, plan.workingFile.path)]
        : []),
      ...plan.updatedFiles.map((file) =>
        toWorkspaceRelativePath(localPathPolicy, file.path)
      ),
    ],
  };

  await operationalLogger.info(
    "import.succeeded",
    "Import succeeded",
    {
      workspaceRoot,
      meshRoot,
      designatorPath: result.designatorPath,
      payloadArtifactIri: result.payloadArtifactIri,
      knopIri: result.knopIri,
      workingLocalRelativePath: result.workingLocalRelativePath,
      sourceBindingIri: result.sourceBindingIri,
      observedContentDigest: result.observedContentDigest,
      createdPaths: result.createdPaths,
      updatedPaths: result.updatedPaths,
    },
  );
  await auditLogger.record(
    "import.succeeded",
    "Import succeeded",
    {
      workspaceRoot,
      meshRoot,
      designatorPath: result.designatorPath,
      payloadArtifactIri: result.payloadArtifactIri,
      knopIri: result.knopIri,
      workingLocalRelativePath: result.workingLocalRelativePath,
      sourceBindingIri: result.sourceBindingIri,
      observedContentDigest: result.observedContentDigest,
      createdPaths: result.createdPaths,
      updatedPaths: result.updatedPaths,
    },
  );

  return result;
}

export function describeImportResult(result: ImportResult): string {
  const createdFileCount = result.createdPaths.length;
  const updatedFileCount = result.updatedPaths.length;
  return `Imported ${result.workingLocalRelativePath} as ${result.payloadArtifactIri} with observed digest ${result.observedContentDigest} (created ${createdFileCount} paths, updated ${updatedFileCount} paths).`;
}

function resolveLoggers(
  options: ExecuteImportOptions,
): {
  operationalLogger: StructuredLogger;
  auditLogger: AuditLogger;
} {
  return resolveRuntimeLoggers(options);
}

async function ensureMeshRootExists(meshRoot: string): Promise<void> {
  let stat: Deno.FileInfo;
  try {
    stat = await Deno.stat(meshRoot);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new ImportRuntimeError(`Mesh root does not exist: ${meshRoot}`);
    }
    throw error;
  }

  if (!stat.isDirectory) {
    throw new ImportRuntimeError(`Mesh root is not a directory: ${meshRoot}`);
  }
}

function normalizeLocalDesignatorPath(
  designatorPath: string,
  fieldName: string,
): string {
  return normalizeSafeDesignatorPath(
    designatorPath,
    fieldName,
    (message) => new ImportRuntimeError(message),
    { allowRoot: true },
  );
}

interface AcquiredImportSource {
  bytes: Uint8Array;
  targetAccessUrl?: string;
  targetLocalRelativePath?: string;
  sourcePathForContentKind?: string;
  contentType?: string;
}

async function acquireImportSource(
  sourceBaseDirectory: string,
  meshRoot: string,
  source: string,
  options: {
    sourceFetch: typeof fetch;
    httpTimeoutMs: number;
    maxHttpBytes: number;
  },
): Promise<AcquiredImportSource> {
  const trimmed = source.trim();
  if (trimmed.length === 0) {
    throw new ImportRuntimeError("import requires a source path or URL");
  }

  const parsedUrl = tryParseUrl(trimmed);
  if (parsedUrl?.protocol === "http:" || parsedUrl?.protocol === "https:") {
    const fetched = await fetchImportSource(parsedUrl, options);
    return {
      bytes: fetched.bytes,
      targetAccessUrl: parsedUrl.href,
      sourcePathForContentKind: parsedUrl.pathname,
      ...(fetched.contentType ? { contentType: fetched.contentType } : {}),
    };
  }
  if (parsedUrl && parsedUrl.protocol !== "file:") {
    throw new ImportRuntimeError(
      "import source URL must use file, http, or https",
    );
  }

  const absoluteSourcePath = parsedUrl
    ? resolve(fromFileUrl(parsedUrl))
    : isAbsolute(trimmed)
    ? resolve(trimmed)
    : resolve(sourceBaseDirectory, trimmed);
  let stat: Deno.FileInfo;
  try {
    stat = await Deno.stat(absoluteSourcePath);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new ImportRuntimeError(`import source does not exist: ${trimmed}`);
    }
    throw error;
  }
  if (!stat.isFile) {
    throw new ImportRuntimeError(`import source is not a file: ${trimmed}`);
  }

  const targetLocalRelativePath = resolvePortableSourcePath(
    meshRoot,
    absoluteSourcePath,
  );
  return {
    bytes: await Deno.readFile(absoluteSourcePath),
    ...(targetLocalRelativePath ? { targetLocalRelativePath } : {}),
    sourcePathForContentKind: absoluteSourcePath,
  };
}

async function fetchImportSource(
  url: URL,
  options: {
    sourceFetch: typeof fetch;
    httpTimeoutMs: number;
    maxHttpBytes: number;
  },
): Promise<{ bytes: Uint8Array; contentType?: string }> {
  const abortController = new AbortController();
  const timeoutId = setTimeout(
    () => abortController.abort(),
    options.httpTimeoutMs,
  );

  let response: Response;
  try {
    response = await options.sourceFetch(url, {
      redirect: "follow",
      signal: abortController.signal,
    });
  } catch (error) {
    if (abortController.signal.aborted) {
      throw new ImportRuntimeError(
        `import HTTP source timed out after ${options.httpTimeoutMs}ms: ${url.href}`,
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new ImportRuntimeError(
      `import HTTP source fetch failed for ${url.href}: ${message}`,
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new ImportRuntimeError(
      `import HTTP source returned ${response.status} ${response.statusText}: ${url.href}`,
    );
  }

  const contentLength = response.headers.get("content-length");
  if (
    contentLength !== null &&
    Number.isFinite(Number(contentLength)) &&
    Number(contentLength) > options.maxHttpBytes
  ) {
    throw new ImportRuntimeError(
      `import HTTP source exceeds maximum size of ${options.maxHttpBytes} bytes: ${url.href}`,
    );
  }

  return {
    bytes: await readBoundedResponseBytes(
      response,
      options.maxHttpBytes,
      url.href,
    ),
    ...(response.headers.get("content-type")
      ? { contentType: response.headers.get("content-type")! }
      : {}),
  };
}

async function readBoundedResponseBytes(
  response: Response,
  maxBytes: number,
  sourceUrl: string,
): Promise<Uint8Array> {
  if (response.body === null) {
    return new Uint8Array();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (value === undefined) {
      continue;
    }
    totalLength += value.byteLength;
    if (totalLength > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        // Ignore cancellation errors while reporting the size violation.
      }
      throw new ImportRuntimeError(
        `import HTTP source exceeds maximum size of ${maxBytes} bytes: ${sourceUrl}`,
      );
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function resolvePortableSourcePath(
  meshRoot: string,
  absoluteSourcePath: string,
): string | undefined {
  const relativePath = relative(meshRoot, absoluteSourcePath).replaceAll(
    "\\",
    "/",
  );
  if (
    relativePath.length === 0 ||
    relativePath === ".." ||
    relativePath.startsWith("../") ||
    isAbsolute(relativePath)
  ) {
    return undefined;
  }
  return relativePath;
}

async function loadCurrentImportState(
  meshRoot: string,
  designatorPath: string,
): Promise<{
  meshBase: string;
  currentMeshInventoryTurtle: string;
  currentKnopInventoryTurtle?: string;
}> {
  const meshMetadataPath = join(meshRoot, "_mesh/_meta/meta.ttl");
  const meshInventoryPath = join(meshRoot, "_mesh/_inventory/inventory.ttl");
  let meshMetadataTurtle: string;
  let currentMeshInventoryTurtle: string;

  try {
    [meshMetadataTurtle, currentMeshInventoryTurtle] = await Promise.all([
      Deno.readTextFile(meshMetadataPath),
      Deno.readTextFile(meshInventoryPath),
    ]);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new ImportRuntimeError(
        "Workspace does not contain an existing mesh support surface",
      );
    }
    throw error;
  }

  let meshBase: string;
  try {
    meshBase = resolveMeshBaseFromMetadataTurtle(meshMetadataTurtle);
  } catch (error) {
    if (error instanceof MeshMetadataResolutionError) {
      throw new ImportRuntimeError(error.message);
    }
    throw error;
  }

  const knopInventoryPath = join(
    meshRoot,
    `${toKnopPath(designatorPath)}/_inventory/inventory.ttl`,
  );
  let currentKnopInventoryTurtle: string | undefined;
  try {
    currentKnopInventoryTurtle = await Deno.readTextFile(knopInventoryPath);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }

  return {
    meshBase,
    currentMeshInventoryTurtle,
    ...(currentKnopInventoryTurtle ? { currentKnopInventoryTurtle } : {}),
  };
}

function isRdfLikeImport(
  workingFilePath: string,
  sourcePath: string | undefined,
  contentType: string | undefined,
): boolean {
  const mediaType = contentType?.split(";")[0]?.trim().toLowerCase();
  if (
    mediaType === "text/turtle" ||
    mediaType === "application/ld+json" ||
    mediaType === "application/rdf+xml" ||
    mediaType === "application/n-triples" ||
    mediaType === "application/n-quads" ||
    mediaType === "application/trig"
  ) {
    return true;
  }

  return [workingFilePath, sourcePath ?? ""].some((value) =>
    /\.(ttl|jsonld|rdf|owl|nt|nq|trig)$/i.test(value)
  );
}

async function sha256Digest(bytes: Uint8Array): Promise<string> {
  const digestInput = new Uint8Array(bytes);
  const digest = await crypto.subtle.digest("SHA-256", digestInput);
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
}

function validateRdfPlan(plan: ImportPlan): void {
  const parser = new Parser();

  for (const file of [...plan.createdFiles, ...plan.updatedFiles]) {
    if (!file.path.endsWith(".ttl")) {
      continue;
    }
    try {
      parser.parse(file.contents);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ImportRuntimeError(
        `Generated RDF did not parse for ${file.path}: ${message}`,
      );
    }
  }
}

async function assertWorkingFileWriteAllowed(
  meshRoot: string,
  plan: ImportPlan,
  replaceWorking: boolean,
): Promise<boolean> {
  const absolutePath = join(meshRoot, plan.workingFile.path);
  let stat: Deno.FileInfo | undefined;
  try {
    stat = await Deno.stat(absolutePath);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }

  if (stat === undefined) {
    return false;
  }
  if (!stat.isFile) {
    throw new ImportRuntimeError(
      `import working target is not a file: ${plan.workingFile.path}`,
    );
  }
  if (!replaceWorking) {
    throw new ImportRuntimeError(
      `import working target already exists: ${plan.workingFile.path}; use --replace-working to overwrite it`,
    );
  }
  return true;
}

async function assertCreateTargetsDoNotExist(
  meshRoot: string,
  plan: ImportPlan,
): Promise<void> {
  for (const file of plan.createdFiles) {
    try {
      await Deno.stat(join(meshRoot, file.path));
      throw new ImportRuntimeError(
        `import target already exists: ${file.path}`,
      );
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        continue;
      }
      throw error;
    }
  }
}

async function assertUpdatedTargetsExist(
  meshRoot: string,
  plan: ImportPlan,
): Promise<void> {
  for (const file of plan.updatedFiles) {
    try {
      await Deno.stat(join(meshRoot, file.path));
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        throw new ImportRuntimeError(
          `import target does not exist: ${file.path}`,
        );
      }
      throw error;
    }
  }
}

async function writeWorkingFile(
  meshRoot: string,
  plan: ImportPlan,
  targetExisted: boolean,
): Promise<void> {
  const absolutePath = join(meshRoot, plan.workingFile.path);
  await Deno.mkdir(dirname(absolutePath), { recursive: true });
  if (!targetExisted) {
    await Deno.writeFile(absolutePath, plan.workingFile.contents, {
      createNew: true,
    });
    return;
  }

  const directoryPath = dirname(absolutePath);
  const tempPath = join(
    directoryPath,
    `.weave-staged-${crypto.randomUUID()}.tmp`,
  );
  const backupPath = join(
    directoryPath,
    `.weave-backup-${crypto.randomUUID()}.bak`,
  );

  await Deno.writeFile(tempPath, plan.workingFile.contents, {
    createNew: true,
  });
  try {
    await Deno.copyFile(absolutePath, backupPath);
    await Deno.rename(tempPath, absolutePath);
  } catch (error) {
    try {
      await removePathIfExists(tempPath);
      if (await pathExists(backupPath)) {
        await removePathIfExists(absolutePath);
        await Deno.rename(backupPath, absolutePath);
      }
    } catch (rollbackError) {
      const message = error instanceof Error ? error.message : String(error);
      const rollbackMessage = rollbackError instanceof Error
        ? rollbackError.message
        : String(rollbackError);
      throw new ImportRuntimeError(
        `Atomic import write failed: ${message}; rollback also failed: ${rollbackMessage}`,
      );
    }

    throw error;
  }

  await removePathIfExists(backupPath);
}

async function writeCreatedFiles(
  meshRoot: string,
  plan: ImportPlan,
): Promise<void> {
  for (const file of plan.createdFiles) {
    const absolutePath = join(meshRoot, file.path);
    await Deno.mkdir(dirname(absolutePath), { recursive: true });
    await Deno.writeTextFile(absolutePath, file.contents, { createNew: true });
  }
}

async function writeUpdatedFiles(
  meshRoot: string,
  plan: ImportPlan,
): Promise<void> {
  for (const file of plan.updatedFiles) {
    const absolutePath = join(meshRoot, file.path);
    await Deno.mkdir(dirname(absolutePath), { recursive: true });
    await Deno.writeTextFile(absolutePath, file.contents);
  }
}

function toWorkspaceRelativePath(
  policy: { workspaceRoot: string; meshRoot: string },
  meshRelativePath: string,
): string {
  const path = relative(
    policy.workspaceRoot,
    join(policy.meshRoot, meshRelativePath),
  ).replaceAll("\\", "/");
  return path.length === 0 ? "." : path;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }
    throw error;
  }
}

async function removePathIfExists(path: string): Promise<void> {
  try {
    await Deno.remove(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return;
    }
    throw error;
  }
}

function tryParseUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}
