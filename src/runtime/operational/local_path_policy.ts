import { isAbsolute, join, relative, resolve, toFileUrl } from "@std/path";
import * as pathPosix from "@std/path/posix";
import { Parser, type Quad, type Term } from "n3";

const CONFIG_NAMESPACE = "https://semantic-flow.github.io/ontology/config/";
const OPERATIONAL_CONFIG_IRI = `${CONFIG_NAMESPACE}OperationalConfig`;
const MESH_CONFIG_IRI = `${CONFIG_NAMESPACE}MeshConfig`;
const LOCAL_CONFIG_IRI = `${CONFIG_NAMESPACE}LocalConfig`;
const HAS_LOCAL_PATH_ACCESS_RULE_IRI =
  `${CONFIG_NAMESPACE}hasLocalPathAccessRule`;
const HAS_LOCAL_PATH_BASE_IRI = `${CONFIG_NAMESPACE}hasLocalPathBase`;
const HAS_LOCAL_PATH_LOCATOR_KIND_IRI =
  `${CONFIG_NAMESPACE}hasLocalPathLocatorKind`;
const PATH_PREFIX_IRI = `${CONFIG_NAMESPACE}pathPrefix`;
const LOCAL_PATH_BASE_MESH_ROOT_IRI = `${CONFIG_NAMESPACE}meshRootPathBase`;
const LOCAL_PATH_BASE_USER_HOME_IRI = `${CONFIG_NAMESPACE}userHomePathBase`;
const LOCAL_PATH_BASE_ABSOLUTE_PATH_IRI = `${CONFIG_NAMESPACE}absolutePathBase`;
const WORKING_LOCAL_RELATIVE_PATH_LOCATOR_KIND_IRI =
  `${CONFIG_NAMESPACE}workingLocalRelativePathLocatorKind`;
const TARGET_LOCAL_RELATIVE_PATH_LOCATOR_KIND_IRI =
  `${CONFIG_NAMESPACE}targetLocalRelativePathLocatorKind`;
const MESH_CONFIG_PATH = "_mesh/_config/config.ttl";
const LOCAL_ACCESS_FILE_NAME = ".sf-local-access.ttl";

export type LocalPathLocatorKind =
  | "workingLocalRelativePath"
  | "targetLocalRelativePath";

type LocalPathBase = "meshRoot" | "userHome" | "absolutePath";
type LocalPathRuleSource = "mesh" | "local";

interface LocalPathAccessRule {
  base: LocalPathBase;
  locatorKinds: readonly LocalPathLocatorKind[];
  pathPrefix: string;
  source: LocalPathRuleSource;
  sourcePath: string;
}

export interface OperationalLocalPathPolicy {
  meshRoot: string;
  meshConfigPath?: string;
  localConfigPath?: string;
  rules: readonly LocalPathAccessRule[];
}

export class OperationalConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OperationalConfigError";
  }
}

export class LocalPathAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocalPathAccessError";
  }
}

export async function loadOperationalLocalPathPolicy(
  meshRoot: string,
): Promise<OperationalLocalPathPolicy> {
  const meshConfigPath = await resolveMeshConfigPath(meshRoot);
  const localConfigPath = await resolveLocalAccessConfigPath();
  const rules: LocalPathAccessRule[] = [];

  if (meshConfigPath) {
    rules.push(...await loadLocalPathRules(meshConfigPath, "mesh"));
  }
  if (localConfigPath) {
    rules.push(...await loadLocalPathRules(localConfigPath, "local"));
  }

  return {
    meshRoot,
    meshConfigPath,
    localConfigPath,
    rules,
  };
}

export function resolveAllowedLocalPath(
  policy: OperationalLocalPathPolicy,
  locatorKind: LocalPathLocatorKind,
  relativePath: string,
): string {
  const candidateAbsolutePath = resolvePosixRelativePath(
    policy.meshRoot,
    relativePath,
  );

  if (isWithinRoot(candidateAbsolutePath, policy.meshRoot)) {
    return candidateAbsolutePath;
  }

  for (const rule of policy.rules) {
    if (!rule.locatorKinds.includes(locatorKind)) {
      continue;
    }

    const allowedRoot = resolveRuleRoot(policy, rule);
    if (!allowedRoot) {
      continue;
    }

    if (isWithinRoot(candidateAbsolutePath, allowedRoot)) {
      return candidateAbsolutePath;
    }
  }

  throw new LocalPathAccessError(
    `${locatorKind} resolves outside the mesh root and no operational allow rule matched: ${relativePath}`,
  );
}

async function loadLocalPathRules(
  configPath: string,
  source: LocalPathRuleSource,
): Promise<readonly LocalPathAccessRule[]> {
  const turtle = await Deno.readTextFile(configPath);
  const quads = parseConfigQuads(configPath, turtle);
  const configSubjects = collectOperationalConfigSubjects(quads);
  const rules: LocalPathAccessRule[] = [];

  for (const configSubject of configSubjects) {
    for (
      const ruleSubject of collectObjectTerms(
        quads,
        configSubject,
        HAS_LOCAL_PATH_ACCESS_RULE_IRI,
      )
    ) {
      rules.push(
        parseLocalPathRule(
          quads,
          ruleSubject,
          source,
          configPath,
        ),
      );
    }
  }

  return rules;
}

function parseConfigQuads(configPath: string, turtle: string): readonly Quad[] {
  try {
    return new Parser({ baseIRI: toFileUrl(configPath).href }).parse(turtle);
  } catch {
    throw new OperationalConfigError(
      `Could not parse operational config: ${configPath}`,
    );
  }
}

function collectOperationalConfigSubjects(
  quads: readonly Quad[],
): readonly string[] {
  const subjects = new Set<string>();

  for (const quad of quads) {
    if (
      quad.subject.termType !== "NamedNode" &&
      quad.subject.termType !== "BlankNode"
    ) {
      continue;
    }
    if (
      quad.predicate.value !==
        "http://www.w3.org/1999/02/22-rdf-syntax-ns#type" ||
      quad.object.termType !== "NamedNode"
    ) {
      continue;
    }
    if (
      quad.object.value !== OPERATIONAL_CONFIG_IRI &&
      quad.object.value !== MESH_CONFIG_IRI &&
      quad.object.value !== LOCAL_CONFIG_IRI
    ) {
      continue;
    }

    subjects.add(toTermKey(quad.subject));
  }

  return [...subjects];
}

function parseLocalPathRule(
  quads: readonly Quad[],
  ruleSubject: string,
  source: LocalPathRuleSource,
  sourcePath: string,
): LocalPathAccessRule {
  const base = parseLocalPathBase(
    requireSingleNamedNodeObject(
      quads,
      ruleSubject,
      HAS_LOCAL_PATH_BASE_IRI,
      sourcePath,
    ),
    sourcePath,
  );
  const locatorKinds = parseLocalPathLocatorKinds(
    requireNamedNodeObjects(
      quads,
      ruleSubject,
      HAS_LOCAL_PATH_LOCATOR_KIND_IRI,
      sourcePath,
    ),
    sourcePath,
  );
  const pathPrefix = normalizeRulePathPrefix(
    requireSingleLiteralObject(quads, ruleSubject, PATH_PREFIX_IRI, sourcePath),
    base,
    sourcePath,
  );
  assertMeshConfigDoesNotGrantArbitraryHostTraversal(
    source,
    base,
    pathPrefix,
    sourcePath,
  );

  return {
    base,
    locatorKinds,
    pathPrefix,
    source,
    sourcePath,
  };
}

function assertMeshConfigDoesNotGrantArbitraryHostTraversal(
  source: LocalPathRuleSource,
  base: LocalPathBase,
  pathPrefix: string,
  sourcePath: string,
): void {
  if (source !== "mesh" || base !== "meshRoot") {
    return;
  }

  if (pathPrefix === ".." || pathPrefix.startsWith("../../")) {
    throw new OperationalConfigError(
      `MeshConfig pathPrefix may not grant arbitrary host traversal: ${sourcePath}`,
    );
  }
}

function parseLocalPathBase(value: string, sourcePath: string): LocalPathBase {
  switch (value) {
    case LOCAL_PATH_BASE_MESH_ROOT_IRI:
      return "meshRoot";
    case LOCAL_PATH_BASE_USER_HOME_IRI:
      return "userHome";
    case LOCAL_PATH_BASE_ABSOLUTE_PATH_IRI:
      return "absolutePath";
    default:
      throw new OperationalConfigError(
        `Unsupported LocalPathBase in ${sourcePath}: ${value}`,
      );
  }
}

function parseLocalPathLocatorKinds(
  values: readonly string[],
  sourcePath: string,
): readonly LocalPathLocatorKind[] {
  if (values.length === 0) {
    throw new OperationalConfigError(
      `Expected at least one ${HAS_LOCAL_PATH_LOCATOR_KIND_IRI} object in ${sourcePath}`,
    );
  }

  return values.map((value) => parseLocalPathLocatorKind(value, sourcePath));
}

function parseLocalPathLocatorKind(
  value: string,
  sourcePath: string,
): LocalPathLocatorKind {
  switch (value) {
    case WORKING_LOCAL_RELATIVE_PATH_LOCATOR_KIND_IRI:
      return "workingLocalRelativePath";
    case TARGET_LOCAL_RELATIVE_PATH_LOCATOR_KIND_IRI:
      return "targetLocalRelativePath";
    default:
      throw new OperationalConfigError(
        `Unsupported LocalPathLocatorKind in ${sourcePath}: ${value}`,
      );
  }
}

function normalizeRulePathPrefix(
  value: string,
  base: LocalPathBase,
  sourcePath: string,
): string {
  const trimmed = value.trim();

  if (trimmed.includes("\\")) {
    throw new OperationalConfigError(
      `Operational config pathPrefix must use forward slashes: ${sourcePath}`,
    );
  }

  if (base === "absolutePath") {
    if (!isAbsolute(trimmed)) {
      throw new OperationalConfigError(
        `AbsolutePath rules must use absolute pathPrefix values: ${sourcePath}`,
      );
    }
    return resolve(trimmed);
  }

  if (trimmed.length === 0 || trimmed === ".") {
    return "";
  }
  if (trimmed.startsWith("/") || /^[A-Za-z]:/.test(trimmed)) {
    throw new OperationalConfigError(
      `Relative LocalPathBase rules must not use absolute pathPrefix values: ${sourcePath}`,
    );
  }

  const normalized = pathPosix.normalize(trimmed);
  if (normalized === "." || normalized === "..") {
    return normalized === "." ? "" : "..";
  }
  if (base !== "meshRoot" && normalized.startsWith("../")) {
    throw new OperationalConfigError(
      `Only MeshRoot rules may use ../ pathPrefix values: ${sourcePath}`,
    );
  }

  return normalized;
}

function requireNamedNodeObjects(
  quads: readonly Quad[],
  subjectKey: string,
  predicateIri: string,
  sourcePath: string,
): readonly string[] {
  const values = collectObjectTerms(quads, subjectKey, predicateIri).filter((
    value,
  ) => value.startsWith("NamedNode:")).map((value) =>
    value.slice("NamedNode:".length)
  );

  if (values.length === 0) {
    throw new OperationalConfigError(
      `Expected at least one ${predicateIri} object in ${sourcePath}`,
    );
  }

  return values;
}

function requireSingleNamedNodeObject(
  quads: readonly Quad[],
  subjectKey: string,
  predicateIri: string,
  sourcePath: string,
): string {
  const values = collectObjectTerms(quads, subjectKey, predicateIri).filter((
    value,
  ) => value.startsWith("NamedNode:")).map((value) =>
    value.slice("NamedNode:".length)
  );

  if (values.length !== 1) {
    throw new OperationalConfigError(
      `Expected exactly one ${predicateIri} object in ${sourcePath}`,
    );
  }

  return values[0]!;
}

function requireSingleLiteralObject(
  quads: readonly Quad[],
  subjectKey: string,
  predicateIri: string,
  sourcePath: string,
): string {
  const values: string[] = [];

  for (const quad of quads) {
    if (
      toTermKey(quad.subject) !== subjectKey ||
      quad.predicate.value !== predicateIri ||
      quad.object.termType !== "Literal"
    ) {
      continue;
    }

    values.push(quad.object.value);
  }

  if (values.length !== 1) {
    throw new OperationalConfigError(
      `Expected exactly one ${predicateIri} literal in ${sourcePath}`,
    );
  }

  return values[0]!;
}

function collectObjectTerms(
  quads: readonly Quad[],
  subjectKey: string,
  predicateIri: string,
): readonly string[] {
  const values = new Set<string>();

  for (const quad of quads) {
    if (
      toTermKey(quad.subject) !== subjectKey ||
      quad.predicate.value !== predicateIri
    ) {
      continue;
    }

    values.add(toTermKey(quad.object));
  }

  return [...values];
}

function toTermKey(term: Term): string {
  return `${term.termType}:${term.value}`;
}

function resolveRuleRoot(
  policy: OperationalLocalPathPolicy,
  rule: LocalPathAccessRule,
): string | undefined {
  switch (rule.base) {
    case "meshRoot":
      return resolvePosixRelativePath(policy.meshRoot, rule.pathPrefix);
    case "userHome": {
      const homeRoot = resolveHomeDirectory();
      return homeRoot
        ? resolvePosixRelativePath(homeRoot, rule.pathPrefix)
        : undefined;
    }
    case "absolutePath":
      return rule.pathPrefix;
  }
}

function resolvePosixRelativePath(
  basePath: string,
  relativePath: string,
): string {
  if (relativePath.length === 0) {
    return resolve(basePath);
  }
  return resolve(basePath, ...relativePath.split("/"));
}

function isWithinRoot(candidatePath: string, rootPath: string): boolean {
  const normalizedRoot = resolve(rootPath);
  const normalizedCandidate = resolve(candidatePath);
  const relation = relative(normalizedRoot, normalizedCandidate);
  return relation.length === 0 ||
    (!relation.startsWith("..") && !isAbsolute(relation));
}

async function resolveMeshConfigPath(
  meshRoot: string,
): Promise<string | undefined> {
  const candidate = join(meshRoot, MESH_CONFIG_PATH);
  return await fileExists(candidate) ? candidate : undefined;
}

async function resolveLocalAccessConfigPath(): Promise<string | undefined> {
  const homeDirectory = resolveHomeDirectory();
  if (!homeDirectory) {
    return undefined;
  }

  const candidate = join(homeDirectory, LOCAL_ACCESS_FILE_NAME);
  return await fileExists(candidate) ? candidate : undefined;
}

function resolveHomeDirectory(): string | undefined {
  return Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE") ?? undefined;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const stat = await Deno.stat(path);
    return stat.isFile;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }
    throw error;
  }
}
