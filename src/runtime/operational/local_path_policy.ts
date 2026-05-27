import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  toFileUrl,
} from "@std/path";
import * as pathPosix from "@std/path/posix";
import { Parser, type Quad, type Term } from "n3";
import {
  SFCFG_NAMESPACE,
  SFCFG_TURTLE_PREFIX_DECLARATION,
  WEAVE_NAMESPACE,
} from "../../core/rdf/namespaces.ts";
import {
  MeshMetadataResolutionError,
  resolveMeshBaseFromMetadataTurtle,
} from "../mesh/metadata.ts";
import {
  renderHostLocalAccessProfileTurtle,
  renderUserSettingsTurtle,
  resolveUserSettingsPaths,
  type UserSettingsPaths,
} from "../settings/user_settings.ts";

const MESH_CONFIG_IRI = `${SFCFG_NAMESPACE}MeshConfig`;
const HAS_LOCAL_PATH_ACCESS_RULE_IRI =
  `${SFCFG_NAMESPACE}hasLocalPathAccessRule`;
const HOST_LOCAL_ACCESS_PROFILE_IRI =
  `${WEAVE_NAMESPACE}HostLocalAccessProfile`;
const HAS_LOCAL_PATH_GRANT_IRI = `${WEAVE_NAMESPACE}hasLocalPathGrant`;
const HAS_PUBLICATION_PROFILE_IRI = `${SFCFG_NAMESPACE}hasPublicationProfile`;
const HAS_LOCAL_PATH_BASE_IRI = `${SFCFG_NAMESPACE}hasLocalPathBase`;
const HAS_LOCAL_PATH_LOCATOR_KIND_IRI =
  `${SFCFG_NAMESPACE}hasLocalPathLocatorKind`;
const ALLOWS_LOCAL_PATH_BASE_IRI = `${WEAVE_NAMESPACE}allowsLocalPathBase`;
const PATH_PREFIX_IRI = `${SFCFG_NAMESPACE}pathPrefix`;
const LOCAL_PATH_BASE_MESH_ROOT_IRI =
  `${SFCFG_NAMESPACE}localPathBase_meshRoot`;
const LOCAL_PATH_BASE_USER_HOME_IRI =
  `${SFCFG_NAMESPACE}localPathBase_userHome`;
const LOCAL_PATH_BASE_ABSOLUTE_PATH_IRI =
  `${SFCFG_NAMESPACE}localPathBase_absolutePath`;
const WORKING_LOCAL_RELATIVE_PATH_LOCATOR_KIND_IRI =
  `${SFCFG_NAMESPACE}localPathLocatorKind_workingLocalRelativePath`;
const TARGET_LOCAL_RELATIVE_PATH_LOCATOR_KIND_IRI =
  `${SFCFG_NAMESPACE}localPathLocatorKind_targetLocalRelativePath`;
const WORKSPACE_ROOT_RELATIVE_TO_MESH_ROOT_IRI =
  `${SFCFG_NAMESPACE}workspaceRootRelativeToMeshRoot`;
const MESH_CONFIG_PATH = "_mesh/_config/config.ttl";
const MESH_METADATA_PATH = "_mesh/_meta/meta.ttl";

export type LocalPathLocatorKind =
  | "workingLocalRelativePath"
  | "targetLocalRelativePath";

type LocalPathBase = "meshRoot" | "userHome" | "absolutePath";
type LocalPathRuleSource = "mesh" | "hostLocal";

interface LocalPathAccessRule {
  base: LocalPathBase;
  locatorKinds: readonly LocalPathLocatorKind[];
  pathPrefix: string;
  source: LocalPathRuleSource;
  sourcePath: string;
}

export interface OperationalLocalPathPolicy {
  meshRoot: string;
  meshBase?: string;
  workspaceRoot: string;
  meshConfigPath?: string;
  hostLocalAccessProfilePath?: string;
  userSettings?: UserSettingsPaths;
  rules: readonly LocalPathAccessRule[];
}

export interface RepositorySourceFloatingLocatorResolution {
  repositoryUrl: string;
  repositoryPathFromRoot: string;
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

export async function ensureMeshConfigWorkingDirectoryAccessRule(
  policy: OperationalLocalPathPolicy,
  pathPrefix: string,
): Promise<boolean> {
  if (!policy.meshConfigPath) {
    throw new OperationalConfigError(
      "Cannot add a mesh-carried local path access rule without _mesh/_config/config.ttl",
    );
  }

  const normalizedPathPrefix = normalizeRulePathPrefix(
    pathPrefix,
    "meshRoot",
    policy.meshConfigPath,
  );
  assertMeshConfigDoesNotGrantArbitraryHostTraversal(
    "mesh",
    "meshRoot",
    normalizedPathPrefix,
    policy.meshConfigPath,
  );

  if (
    policy.rules.some((rule) =>
      rule.source === "mesh" &&
      rule.base === "meshRoot" &&
      rule.pathPrefix === normalizedPathPrefix &&
      rule.locatorKinds.includes("workingLocalRelativePath")
    )
  ) {
    return false;
  }

  const turtle = await Deno.readTextFile(policy.meshConfigPath);
  const quads = parseConfigQuads(policy.meshConfigPath, turtle);
  const workspaceRootRelativeToMeshRoot = collectWorkspaceRootValues(
    quads,
    policy.meshConfigPath,
  )[0];
  const publicationProfileIri = collectPublicationProfileValues(
    quads,
    policy.meshConfigPath,
  )[0];
  const meshRules: LocalPathAccessRule[] = policy.rules
    .filter((rule) => rule.source === "mesh")
    .map((rule) => ({ ...rule }));
  meshRules.push({
    base: "meshRoot",
    locatorKinds: ["workingLocalRelativePath"],
    pathPrefix: normalizedPathPrefix,
    source: "mesh",
    sourcePath: policy.meshConfigPath,
  });

  await Deno.writeTextFile(
    policy.meshConfigPath,
    renderMeshConfigTurtle(
      workspaceRootRelativeToMeshRoot,
      publicationProfileIri,
      meshRules,
    ),
  );
  return true;
}

export interface HostLocalWorkingDirectoryAccessRuleResult {
  updated: boolean;
  accessProfilePath: string;
}

export async function ensureHostLocalWorkingDirectoryAccessRule(
  policy: OperationalLocalPathPolicy,
  absolutePathPrefix: string,
): Promise<HostLocalWorkingDirectoryAccessRuleResult> {
  if (!policy.userSettings) {
    throw new OperationalConfigError(
      "Cannot add a host-local access rule before the mesh base can be resolved",
    );
  }

  const accessProfilePath = policy.hostLocalAccessProfilePath ??
    policy.userSettings.meshSettings.accessProfilePath;
  const normalizedPathPrefix = normalizeRulePathPrefix(
    absolutePathPrefix,
    "absolutePath",
    accessProfilePath,
  );

  if (
    policy.rules.some((rule) =>
      rule.source === "hostLocal" &&
      rule.base === "absolutePath" &&
      rule.pathPrefix === normalizedPathPrefix &&
      rule.locatorKinds.includes("workingLocalRelativePath")
    )
  ) {
    return { updated: false, accessProfilePath };
  }

  const hostLocalRules: LocalPathAccessRule[] = policy.rules
    .filter((rule) => rule.source === "hostLocal")
    .map((rule) => ({ ...rule }));
  hostLocalRules.push({
    base: "absolutePath",
    locatorKinds: ["workingLocalRelativePath"],
    pathPrefix: normalizedPathPrefix,
    source: "hostLocal",
    sourcePath: accessProfilePath,
  });

  await Deno.mkdir(dirname(accessProfilePath), { recursive: true });
  await Deno.writeTextFile(
    policy.userSettings.settingsPath,
    renderUserSettingsTurtle(policy.userSettings),
  );
  await Deno.writeTextFile(
    accessProfilePath,
    renderHostLocalAccessProfileTurtle(
      hostLocalRules.map((rule) => renderPathPrefix(rule.pathPrefix)),
    ),
  );
  return { updated: true, accessProfilePath };
}

export async function loadOperationalLocalPathPolicy(
  meshRoot: string,
): Promise<OperationalLocalPathPolicy> {
  const meshConfigPath = await resolveMeshConfigPath(meshRoot);
  const workspaceRoot = meshConfigPath
    ? await resolveWorkspaceRootFromMeshConfig(meshRoot, meshConfigPath)
    : meshRoot;
  const meshBase = await resolveMeshBaseFromMeshRoot(meshRoot);
  const userSettings = meshBase
    ? await resolveUserSettingsPaths(meshBase)
    : undefined;
  const hostLocalAccessProfilePath = userSettings?.meshSettings
    .accessProfilePath;
  const rules: LocalPathAccessRule[] = [];

  if (meshConfigPath) {
    rules.push(...await loadLocalPathRules(meshConfigPath, "mesh"));
  }
  if (
    hostLocalAccessProfilePath &&
    await fileExists(hostLocalAccessProfilePath)
  ) {
    rules.push(
      ...await loadLocalPathRules(
        hostLocalAccessProfilePath,
        "hostLocal",
      ),
    );
  }

  return {
    meshRoot,
    ...(meshBase ? { meshBase } : {}),
    workspaceRoot,
    meshConfigPath,
    ...(hostLocalAccessProfilePath &&
        await fileExists(hostLocalAccessProfilePath)
      ? { hostLocalAccessProfilePath }
      : {}),
    ...(userSettings ? { userSettings } : {}),
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
    if (
      rule.source === "mesh" &&
      !isWithinRoot(candidateAbsolutePath, policy.workspaceRoot)
    ) {
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

function collectRepositorySourceCandidateRoots(
  policy: OperationalLocalPathPolicy,
): readonly string[] {
  const roots = new Set<string>();

  for (const rule of policy.rules) {
    if (!rule.locatorKinds.includes("workingLocalRelativePath")) {
      continue;
    }
    const root = resolveRuleRoot(policy, rule);
    if (
      root &&
      (rule.source !== "mesh" || isWithinRoot(root, policy.workspaceRoot))
    ) {
      roots.add(resolve(root));
    }
  }
  roots.add(resolve(policy.meshRoot));

  return [...roots];
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

async function tryRunGit(args: readonly string[]): Promise<string | undefined> {
  const command = new Deno.Command("git", {
    args: [...args],
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  if (!output.success) {
    return undefined;
  }
  return new TextDecoder().decode(output.stdout).trim();
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

async function resolveWorkspaceRootFromMeshConfig(
  meshRoot: string,
  meshConfigPath: string,
): Promise<string> {
  const turtle = await Deno.readTextFile(meshConfigPath);
  const quads = parseConfigQuads(meshConfigPath, turtle);
  const values = collectWorkspaceRootValues(quads, meshConfigPath);

  if (values.length === 0) {
    return meshRoot;
  }
  if (values.length !== 1) {
    throw new OperationalConfigError(
      `Expected exactly one ${WORKSPACE_ROOT_RELATIVE_TO_MESH_ROOT_IRI} value in ${meshConfigPath}`,
    );
  }

  const relativeWorkspaceRoot = values[0]!;
  if (
    relativeWorkspaceRoot.length === 0 ||
    relativeWorkspaceRoot.includes("\\") ||
    isAbsolute(relativeWorkspaceRoot)
  ) {
    throw new OperationalConfigError(
      `Invalid workspaceRootRelativeToMeshRoot in ${meshConfigPath}: ${relativeWorkspaceRoot}`,
    );
  }

  const workspaceRoot = resolvePosixRelativePath(
    meshRoot,
    relativeWorkspaceRoot,
  );
  if (!isWithinRoot(meshRoot, workspaceRoot)) {
    throw new OperationalConfigError(
      `workspaceRootRelativeToMeshRoot must resolve to a workspace root containing the mesh root: ${meshConfigPath}`,
    );
  }

  return workspaceRoot;
}

function collectWorkspaceRootValues(
  quads: readonly Quad[],
  meshConfigPath: string,
): readonly string[] {
  const configSubjects = new Set(collectMeshConfigSubjects(quads));
  const values = quads
    .filter((quad) =>
      configSubjects.has(toTermKey(quad.subject)) &&
      quad.predicate.value === WORKSPACE_ROOT_RELATIVE_TO_MESH_ROOT_IRI &&
      quad.object.termType === "Literal"
    )
    .map((quad) => quad.object.value.trim());

  if (values.length > 1) {
    throw new OperationalConfigError(
      `Expected exactly one ${WORKSPACE_ROOT_RELATIVE_TO_MESH_ROOT_IRI} value in ${meshConfigPath}`,
    );
  }

  return values;
}

function collectPublicationProfileValues(
  quads: readonly Quad[],
  meshConfigPath: string,
): readonly string[] {
  const configSubjects = new Set(collectMeshConfigSubjects(quads));
  const values = quads
    .filter((quad) =>
      configSubjects.has(toTermKey(quad.subject)) &&
      quad.predicate.value === HAS_PUBLICATION_PROFILE_IRI &&
      quad.object.termType === "NamedNode"
    )
    .map((quad) => quad.object.value.trim());

  if (values.length > 1) {
    throw new OperationalConfigError(
      `Expected at most one ${HAS_PUBLICATION_PROFILE_IRI} value in ${meshConfigPath}`,
    );
  }

  return values;
}

async function loadLocalPathRules(
  configPath: string,
  source: LocalPathRuleSource,
): Promise<readonly LocalPathAccessRule[]> {
  const turtle = await Deno.readTextFile(configPath);
  const quads = parseConfigQuads(configPath, turtle);
  if (source === "hostLocal") {
    return parseHostLocalAccessProfileRules(quads, configPath);
  }

  const configSubjects = collectMeshConfigSubjects(quads);
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

function renderMeshConfigTurtle(
  workspaceRootRelativeToMeshRoot: string | undefined,
  publicationProfileIri: string | undefined,
  rules: readonly LocalPathAccessRule[],
): string {
  const statements: string[] = ["a sfcfg:MeshConfig"];
  if (workspaceRootRelativeToMeshRoot !== undefined) {
    statements.push(
      `  sfcfg:workspaceRootRelativeToMeshRoot ${
        JSON.stringify(workspaceRootRelativeToMeshRoot)
      }`,
    );
  }
  if (publicationProfileIri !== undefined) {
    statements.push(
      `  sfcfg:hasPublicationProfile <${publicationProfileIri}>`,
    );
  }
  for (const rule of rules) {
    statements.push(`  sfcfg:hasLocalPathAccessRule [
    a sfcfg:LocalPathAccessRule ;
    sfcfg:hasLocalPathBase <${renderLocalPathBaseIri(rule.base)}> ;
    sfcfg:pathPrefix ${JSON.stringify(renderPathPrefix(rule.pathPrefix))} ;
    ${
      rule.locatorKinds.map((kind) =>
        `sfcfg:hasLocalPathLocatorKind <${renderLocalPathLocatorKindIri(kind)}>`
      ).join(" ;\n    ")
    }
  ]`);
  }

  return `${SFCFG_TURTLE_PREFIX_DECLARATION}

<> ${statements.join(" ;\n")} .
`;
}

function renderLocalPathBaseIri(base: LocalPathBase): string {
  switch (base) {
    case "meshRoot":
      return LOCAL_PATH_BASE_MESH_ROOT_IRI;
    case "userHome":
      return LOCAL_PATH_BASE_USER_HOME_IRI;
    case "absolutePath":
      return LOCAL_PATH_BASE_ABSOLUTE_PATH_IRI;
  }
}

function renderLocalPathLocatorKindIri(kind: LocalPathLocatorKind): string {
  switch (kind) {
    case "workingLocalRelativePath":
      return WORKING_LOCAL_RELATIVE_PATH_LOCATOR_KIND_IRI;
    case "targetLocalRelativePath":
      return TARGET_LOCAL_RELATIVE_PATH_LOCATOR_KIND_IRI;
  }
}

function renderPathPrefix(pathPrefix: string): string {
  if (pathPrefix.length === 0 || pathPrefix.endsWith("/")) {
    return pathPrefix;
  }
  return `${pathPrefix}/`;
}

function parseConfigQuads(configPath: string, turtle: string): readonly Quad[] {
  try {
    return new Parser({ baseIRI: toFileUrl(configPath).href }).parse(turtle);
  } catch {
    throw new OperationalConfigError(
      `Could not parse local path policy document: ${configPath}`,
    );
  }
}

function collectMeshConfigSubjects(
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
      quad.object.value !== MESH_CONFIG_IRI
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

function parseHostLocalAccessProfileRules(
  quads: readonly Quad[],
  sourcePath: string,
): readonly LocalPathAccessRule[] {
  const profileSubjects = collectHostLocalAccessProfileSubjects(quads);
  const rules: LocalPathAccessRule[] = [];

  for (const profileSubject of profileSubjects) {
    for (
      const grantSubject of collectObjectTerms(
        quads,
        profileSubject,
        HAS_LOCAL_PATH_GRANT_IRI,
      )
    ) {
      rules.push(parseHostLocalPathGrant(quads, grantSubject, sourcePath));
    }
  }

  return rules;
}

function collectHostLocalAccessProfileSubjects(
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
      quad.object.termType !== "NamedNode" ||
      quad.object.value !== HOST_LOCAL_ACCESS_PROFILE_IRI
    ) {
      continue;
    }

    subjects.add(toTermKey(quad.subject));
  }

  return [...subjects];
}

function parseHostLocalPathGrant(
  quads: readonly Quad[],
  grantSubject: string,
  sourcePath: string,
): LocalPathAccessRule {
  const pathPrefix = normalizeRulePathPrefix(
    requireSingleLiteralObject(
      quads,
      grantSubject,
      ALLOWS_LOCAL_PATH_BASE_IRI,
      sourcePath,
    ),
    "absolutePath",
    sourcePath,
  );

  return {
    base: "absolutePath",
    locatorKinds: ["workingLocalRelativePath"],
    pathPrefix,
    source: "hostLocal",
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
      `Local path policy pathPrefix must use forward slashes: ${sourcePath}`,
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

async function resolveMeshBaseFromMeshRoot(
  meshRoot: string,
): Promise<string | undefined> {
  const meshMetadataPath = join(meshRoot, MESH_METADATA_PATH);
  if (!await fileExists(meshMetadataPath)) {
    return undefined;
  }

  try {
    return resolveMeshBaseFromMetadataTurtle(
      await Deno.readTextFile(meshMetadataPath),
    );
  } catch (error) {
    if (error instanceof MeshMetadataResolutionError) {
      return undefined;
    }
    throw error;
  }
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
