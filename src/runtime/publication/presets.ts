import { join, relative, resolve, toFileUrl } from "@std/path";
import { Parser, type Quad } from "n3";
import { SFCFG_NAMESPACE } from "../../core/rdf/namespaces.ts";

const HAS_PUBLICATION_PROFILE_IRI = `${SFCFG_NAMESPACE}hasPublicationProfile`;
const PUBLICATION_PROFILE_NONE_IRI =
  `${SFCFG_NAMESPACE}publicationProfile_none`;
const PUBLICATION_PROFILE_GITHUB_PAGES_IRI =
  `${SFCFG_NAMESPACE}publicationProfile_githubPages`;
const MESH_CONFIG_PATH = "_mesh/_config/config.ttl";

export type PublicationPresetProfile = "none" | "githubPages";

export interface PublicationPresetFinding {
  severity: "error";
  message: string;
}

export interface PublicationPresetValidationResult {
  publicationProfile?: PublicationPresetProfile;
  findings: readonly PublicationPresetFinding[];
}

export async function validatePublicationPreset(options: {
  meshRoot: string;
  currentMeshConfigTurtle?: string;
}): Promise<PublicationPresetValidationResult> {
  const leakageFindings = await validateLocalPathLeakage(options.meshRoot);
  const profileResult = resolvePublicationProfile({
    meshRoot: options.meshRoot,
    currentMeshConfigTurtle: options.currentMeshConfigTurtle,
  });
  if (profileResult.findings.length > 0) {
    return {
      ...profileResult,
      findings: [...profileResult.findings, ...leakageFindings],
    };
  }

  if (profileResult.publicationProfile !== "githubPages") {
    return {
      ...profileResult,
      findings: [...profileResult.findings, ...leakageFindings],
    };
  }

  const noJekyllPath = join(options.meshRoot, ".nojekyll");
  try {
    const stat = await Deno.stat(noJekyllPath);
    if (!stat.isFile) {
      return {
        ...profileResult,
        findings: [{
          severity: "error",
          message:
            "GitHub Pages publication profile requires .nojekyll to be a file at the mesh root.",
        }, ...leakageFindings],
      };
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return {
        ...profileResult,
        findings: [{
          severity: "error",
          message:
            "GitHub Pages publication profile requires .nojekyll at the mesh root.",
        }, ...leakageFindings],
      };
    }
    throw error;
  }

  return {
    ...profileResult,
    findings: [...profileResult.findings, ...leakageFindings],
  };
}

async function validateLocalPathLeakage(
  meshRoot: string,
): Promise<PublicationPresetFinding[]> {
  const findings: PublicationPresetFinding[] = [];
  const pathEvidence = collectHostLocalPathEvidence(meshRoot);

  for await (const filePath of walkPublicTextFiles(meshRoot)) {
    const contents = await Deno.readTextFile(filePath);
    const publicationPath = relative(meshRoot, filePath).replaceAll("\\", "/");
    if (contents.includes("file://")) {
      findings.push({
        severity: "error",
        message:
          `Publication file ${publicationPath} contains a host-local file URL.`,
      });
      continue;
    }
    if (pathEvidence.some((evidence) => contents.includes(evidence))) {
      findings.push({
        severity: "error",
        message:
          `Publication file ${publicationPath} contains an absolute host-local path.`,
      });
    }
  }

  return findings;
}

function collectHostLocalPathEvidence(meshRoot: string): string[] {
  const values = new Set<string>();
  const homePath = tryGetHomePath();

  for (const path of [resolve(meshRoot), homePath]) {
    if (!path) {
      continue;
    }
    values.add(path);
    values.add(path.replaceAll("\\", "/"));
    values.add(toFileUrl(path).href);
  }

  return [...values].filter((value) => value.length > 1);
}

function tryGetHomePath(): string | undefined {
  try {
    return Deno.env.get("HOME");
  } catch {
    return undefined;
  }
}

async function* walkPublicTextFiles(root: string): AsyncGenerator<string> {
  let entries: Deno.DirEntry[];
  try {
    entries = [];
    for await (const entry of Deno.readDir(root)) {
      entries.push(entry);
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return;
    }
    throw error;
  }

  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === ".weave") {
      continue;
    }
    const path = join(root, entry.name);
    if (entry.isDirectory) {
      yield* walkPublicTextFiles(path);
      continue;
    }
    if (entry.isFile && isPublicTextFile(entry.name)) {
      yield path;
    }
  }
}

function isPublicTextFile(name: string): boolean {
  return name.endsWith(".ttl") || name.endsWith(".html");
}

function resolvePublicationProfile(options: {
  meshRoot: string;
  currentMeshConfigTurtle?: string;
}): PublicationPresetValidationResult {
  const turtle = options.currentMeshConfigTurtle;
  if (turtle === undefined) {
    return { findings: [] };
  }

  let quads: readonly Quad[];
  try {
    quads = new Parser({
      baseIRI: toFileUrl(join(options.meshRoot, MESH_CONFIG_PATH)).href,
    }).parse(turtle);
  } catch {
    return {
      findings: [{
        severity: "error",
        message: "Could not parse mesh config while validating publication.",
      }],
    };
  }

  const profiles = quads
    .filter((quad) => quad.predicate.value === HAS_PUBLICATION_PROFILE_IRI)
    .map((quad) => quad.object.value);
  const uniqueProfiles = [...new Set(profiles)];
  if (uniqueProfiles.length === 0) {
    return { findings: [] };
  }
  if (uniqueProfiles.length > 1) {
    return {
      findings: [{
        severity: "error",
        message: "Mesh config declares more than one publication profile.",
      }],
    };
  }

  const profileIri = uniqueProfiles[0]!;
  if (profileIri === PUBLICATION_PROFILE_NONE_IRI) {
    return { publicationProfile: "none", findings: [] };
  }
  if (profileIri === PUBLICATION_PROFILE_GITHUB_PAGES_IRI) {
    return { publicationProfile: "githubPages", findings: [] };
  }

  return {
    findings: [{
      severity: "error",
      message:
        `Mesh config declares unsupported publication profile: ${profileIri}`,
    }],
  };
}
