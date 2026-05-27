import { join, resolve } from "@std/path";
import * as pathPosix from "@std/path/posix";
import {
  RDFS_NAMESPACE,
  turtlePrefixDeclaration,
  WEAVE_TURTLE_PREFIX_DECLARATION,
  XSD_NAMESPACE,
} from "../../core/rdf/namespaces.ts";

const WEAVE_SETTINGS_ENV_VAR = "WEAVE_SETTINGS";
const WEAVE_LOG_DIR_ENV_VAR = "WEAVE_LOG_DIR";
const XDG_CONFIG_HOME_ENV_VAR = "XDG_CONFIG_HOME";
const XDG_STATE_HOME_ENV_VAR = "XDG_STATE_HOME";
const XDG_CACHE_HOME_ENV_VAR = "XDG_CACHE_HOME";
const HOME_ENV_VAR = "HOME";
const USERPROFILE_ENV_VAR = "USERPROFILE";
const MESH_IDENTIFIER_HASH_LENGTH = 12;

export interface UserSettingsEnvironment {
  readonly [name: string]: string | undefined;
}

export interface UserSettingsResolverOptions {
  env?: UserSettingsEnvironment;
}

export interface MeshSettingsIdentity {
  canonicalMeshBase: string;
  displaySlug: string;
  meshIdentifier: string;
}

export interface MeshSettingsGroupPaths extends MeshSettingsIdentity {
  directoryPath: string;
  profilePath: string;
  accessProfilePath: string;
  preferencesProfilePath: string;
}

export interface UserSettingsPaths {
  settingsRoot: string;
  settingsPath: string;
  globalProfilePath: string;
  globalAccessProfilePath: string;
  globalPreferencesProfilePath: string;
  meshSettings: MeshSettingsGroupPaths;
  logDir: string;
  cacheDir: string;
}

export class UserSettingsResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserSettingsResolutionError";
  }
}

export async function resolveUserSettingsPaths(
  meshBase: string,
  options: UserSettingsResolverOptions = {},
): Promise<UserSettingsPaths> {
  const identity = await deriveMeshSettingsIdentity(meshBase);
  const settingsRoot = resolveUserSettingsRoot(options);
  const meshSettingsDirectory = join(
    settingsRoot,
    "meshes",
    identity.meshIdentifier,
  );

  return {
    settingsRoot,
    settingsPath: join(settingsRoot, "settings.ttl"),
    globalProfilePath: join(settingsRoot, "global-profile.ttl"),
    globalAccessProfilePath: join(settingsRoot, "global-access.ttl"),
    globalPreferencesProfilePath: join(
      settingsRoot,
      "global-preferences.ttl",
    ),
    meshSettings: {
      ...identity,
      directoryPath: meshSettingsDirectory,
      profilePath: join(meshSettingsDirectory, "profile.ttl"),
      accessProfilePath: join(meshSettingsDirectory, "access.ttl"),
      preferencesProfilePath: join(meshSettingsDirectory, "preferences.ttl"),
    },
    logDir: resolveMeshLogDir(identity, options),
    cacheDir: resolveMeshCacheDir(identity, options),
  };
}

export async function deriveMeshSettingsIdentity(
  meshBase: string,
): Promise<MeshSettingsIdentity> {
  const canonicalMeshBase = canonicalizeMeshBase(meshBase);
  const displaySlug = deriveDisplaySlug(canonicalMeshBase);
  const meshBaseHash = (await sha256Hex(canonicalMeshBase)).slice(
    0,
    MESH_IDENTIFIER_HASH_LENGTH,
  );

  return {
    canonicalMeshBase,
    displaySlug,
    meshIdentifier: `${displaySlug}-${meshBaseHash}`,
  };
}

export function renderUserSettingsTurtle(paths: UserSettingsPaths): string {
  const meshRelativeDirectory = `meshes/${paths.meshSettings.meshIdentifier}/`;

  return `${WEAVE_TURTLE_PREFIX_DECLARATION}
${turtlePrefixDeclaration("rdfs", RDFS_NAMESPACE)}
${turtlePrefixDeclaration("xsd", XSD_NAMESPACE)}

<> a weave:UserSettings ;
  weave:hasProfile <global-profile.ttl> ;
  weave:hasAccessProfile <global-access.ttl> ;
  weave:hasPreferencesProfile <global-preferences.ttl> ;
  weave:hasMeshSettings <${meshRelativeDirectory}> .

<${meshRelativeDirectory}> a weave:MeshSettingsGroup ;
  rdfs:label ${JSON.stringify(paths.meshSettings.displaySlug)} ;
  weave:forMeshBase ${
    JSON.stringify(paths.meshSettings.canonicalMeshBase)
  }^^xsd:anyURI ;
  weave:meshIdentifier ${JSON.stringify(paths.meshSettings.meshIdentifier)} ;
  weave:hasProfile <${meshRelativeDirectory}profile.ttl> ;
  weave:hasAccessProfile <${meshRelativeDirectory}access.ttl> ;
  weave:hasPreferencesProfile <${meshRelativeDirectory}preferences.ttl> .
`;
}

export function renderHostLocalAccessProfileTurtle(
  allowedAbsolutePathBases: readonly string[],
): string {
  const statements: string[] = [
    "a weave:HostLocalAccessProfile",
    "  weave:forMeshSettings <./>",
  ];
  for (const pathBase of allowedAbsolutePathBases) {
    statements.push(`  weave:hasLocalPathGrant [
    a weave:LocalPathGrant ;
    weave:allowsLocalPathBase ${JSON.stringify(pathBase)}
  ]`);
  }

  return `${WEAVE_TURTLE_PREFIX_DECLARATION}

<> ${statements.join(" ;\n")} .
`;
}

function canonicalizeMeshBase(meshBase: string): string {
  const trimmed = meshBase.trim();
  if (trimmed.length === 0) {
    throw new UserSettingsResolutionError("meshBase is required");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new UserSettingsResolutionError("meshBase must be an absolute URL");
  }

  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  if (
    (url.protocol === "https:" && url.port === "443") ||
    (url.protocol === "http:" && url.port === "80")
  ) {
    url.port = "";
  }
  url.search = "";
  url.hash = "";
  url.pathname = normalizeMeshBasePath(url.pathname);

  return url.href;
}

function normalizeMeshBasePath(pathname: string): string {
  const normalized = pathPosix.normalize(pathname.length > 0 ? pathname : "/");
  const absolute = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return absolute === "/" || absolute.endsWith("/") ? absolute : `${absolute}/`;
}

function deriveDisplaySlug(canonicalMeshBase: string): string {
  const url = new URL(canonicalMeshBase);
  const pathSegments = url.pathname.split("/").filter((segment) =>
    segment.length > 0
  );
  const labelSource = pathSegments.at(-1) ?? url.hostname;
  return slugify(safeDecodeURIComponent(labelSource));
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 48)
    .replace(/-+$/g, "");

  return slug.length > 0 ? slug : "mesh";
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function resolveUserSettingsRoot(options: UserSettingsResolverOptions): string {
  const explicitRoot = readNonEmptyEnv(WEAVE_SETTINGS_ENV_VAR, options);
  if (explicitRoot) {
    return resolve(explicitRoot);
  }

  const xdgConfigHome = readNonEmptyEnv(XDG_CONFIG_HOME_ENV_VAR, options);
  if (xdgConfigHome) {
    return join(resolve(xdgConfigHome), "weave");
  }

  return join(resolveHomeDirectory(options), ".config", "weave");
}

function resolveMeshLogDir(
  identity: MeshSettingsIdentity,
  options: UserSettingsResolverOptions,
): string {
  const explicitLogDir = readNonEmptyEnv(WEAVE_LOG_DIR_ENV_VAR, options);
  if (explicitLogDir) {
    return resolve(explicitLogDir);
  }

  const xdgStateHome = readNonEmptyEnv(XDG_STATE_HOME_ENV_VAR, options);
  const stateRoot = xdgStateHome
    ? resolve(xdgStateHome)
    : join(resolveHomeDirectory(options), ".local", "state");
  return join(stateRoot, "weave", "meshes", identity.meshIdentifier, "logs");
}

function resolveMeshCacheDir(
  identity: MeshSettingsIdentity,
  options: UserSettingsResolverOptions,
): string {
  const xdgCacheHome = readNonEmptyEnv(XDG_CACHE_HOME_ENV_VAR, options);
  const cacheRoot = xdgCacheHome
    ? resolve(xdgCacheHome)
    : join(resolveHomeDirectory(options), ".cache");
  return join(cacheRoot, "weave", "meshes", identity.meshIdentifier, "cache");
}

function resolveHomeDirectory(options: UserSettingsResolverOptions): string {
  const homeDirectory = readNonEmptyEnv(HOME_ENV_VAR, options) ??
    readNonEmptyEnv(USERPROFILE_ENV_VAR, options);
  if (!homeDirectory) {
    throw new UserSettingsResolutionError(
      "Cannot resolve Weave user settings without WEAVE_SETTINGS, XDG home variables, HOME, or USERPROFILE",
    );
  }
  return resolve(homeDirectory);
}

function readNonEmptyEnv(
  name: string,
  options: UserSettingsResolverOptions,
): string | undefined {
  const value = options.env ? options.env[name] : readProcessEnv(name);
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function readProcessEnv(name: string): string | undefined {
  try {
    return Deno.env.get(name);
  } catch {
    return undefined;
  }
}
