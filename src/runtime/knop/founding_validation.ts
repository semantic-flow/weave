import { join } from "@std/path";
import { Parser, type Quad, type Term } from "n3";
import {
  toFoundingReferentDataPath,
  toKnopPath,
} from "../../core/designator_segments.ts";
import {
  isCanonicalContentDigest,
  sha256ContentDigest,
} from "../../core/rdf/content_digest.ts";
import { RDF_NAMESPACE, SFLO_NAMESPACE } from "../../core/rdf/namespaces.ts";
import type { MeshValidationFindingCode } from "../../core/weave/errors.ts";

const RDF_TYPE_IRI = `${RDF_NAMESPACE}type`;
const SFLO_ARTIFACT_MANIFESTATION_IRI =
  `${SFLO_NAMESPACE}ArtifactManifestation`;
const SFLO_DEFAULT_ARTIFACT_HISTORY_IRI =
  `${SFLO_NAMESPACE}defaultArtifactHistory`;
const SFLO_FOUNDING_REFERENT_DATA_IRI = `${SFLO_NAMESPACE}FoundingReferentData`;
const SFLO_HAS_ARTIFACT_HISTORY_IRI = `${SFLO_NAMESPACE}hasArtifactHistory`;
const SFLO_HAS_CONTENT_DIGEST_IRI = `${SFLO_NAMESPACE}hasContentDigest`;
const SFLO_HAS_FOUNDING_REFERENT_DATA_IRI =
  `${SFLO_NAMESPACE}hasFoundingReferentData`;
const SFLO_HAS_HISTORICAL_STATE_IRI = `${SFLO_NAMESPACE}hasHistoricalState`;
const SFLO_HAS_MANIFESTATION_IRI = `${SFLO_NAMESPACE}hasManifestation`;
const SFLO_HAS_WORKING_LOCATED_FILE_IRI =
  `${SFLO_NAMESPACE}hasWorkingLocatedFile`;
const SFLO_LATEST_HISTORICAL_STATE_IRI =
  `${SFLO_NAMESPACE}latestHistoricalState`;
const SFLO_LOCATED_FILE_FOR_MANIFESTATION_IRI =
  `${SFLO_NAMESPACE}locatedFileForManifestation`;

export interface FoundingValidationFinding {
  severity: "error";
  code: MeshValidationFindingCode;
  message: string;
  path?: string;
  designatorPath: string;
}

export async function inspectFoundingReferentData(options: {
  meshRoot: string;
  meshBase: string;
  designatorPaths: readonly string[];
  requireSettledWorking: boolean;
}): Promise<readonly FoundingValidationFinding[]> {
  const findings: FoundingValidationFinding[] = [];
  for (const designatorPath of options.designatorPaths) {
    findings.push(...await inspectOne({ ...options, designatorPath }));
  }
  return findings;
}

async function inspectOne(options: {
  meshRoot: string;
  meshBase: string;
  designatorPath: string;
  requireSettledWorking: boolean;
}): Promise<FoundingValidationFinding[]> {
  const knopPath = toKnopPath(options.designatorPath);
  const inventoryPath = `${knopPath}/_inventory/inventory.ttl`;
  let inventoryTurtle: string;
  try {
    inventoryTurtle = await Deno.readTextFile(
      join(options.meshRoot, inventoryPath),
    );
  } catch {
    return [finding(
      "missing-artifact",
      `Knop inventory is missing while validating founding referent data: ${inventoryPath}`,
      options.designatorPath,
      inventoryPath,
    )];
  }
  let quads: Quad[];
  try {
    quads = new Parser({ baseIRI: options.meshBase }).parse(
      inventoryTurtle,
    );
  } catch {
    return [finding(
      "malformed-inventory",
      "Could not parse Knop inventory while validating founding referent data.",
      options.designatorPath,
      inventoryPath,
    )];
  }
  const foundingObjects = objects(
    quads,
    new URL(knopPath, options.meshBase).href,
    SFLO_HAS_FOUNDING_REFERENT_DATA_IRI,
  );
  if (foundingObjects.length === 0) return [];
  const foundingPath = toFoundingReferentDataPath(options.designatorPath);
  const foundingIri = new URL(foundingPath, options.meshBase).href;
  const workingPath = `${foundingPath}/data.ttl`;
  const workingIri = new URL(workingPath, options.meshBase).href;
  if (
    foundingObjects.length !== 1 ||
    foundingObjects[0]!.termType !== "NamedNode" ||
    foundingObjects[0]!.value !== foundingIri ||
    !hasNamedFact(
      quads,
      foundingIri,
      RDF_TYPE_IRI,
      SFLO_FOUNDING_REFERENT_DATA_IRI,
    ) ||
    !hasSingleNamedFact(
      quads,
      foundingIri,
      SFLO_HAS_WORKING_LOCATED_FILE_IRI,
      workingIri,
    ) || objects(quads, workingIri, SFLO_HAS_CONTENT_DIGEST_IRI).length > 0
  ) {
    return [finding(
      "malformed-inventory",
      "Founding referent data inventory structure is malformed.",
      options.designatorPath,
      inventoryPath,
    )];
  }

  let workingBytes: Uint8Array;
  try {
    workingBytes = await Deno.readFile(join(options.meshRoot, workingPath));
  } catch {
    return [finding(
      "missing-artifact",
      `Founding referent data working file is missing: ${workingPath}`,
      options.designatorPath,
      workingPath,
    )];
  }

  const historyObjects = objects(
    quads,
    foundingIri,
    SFLO_HAS_ARTIFACT_HISTORY_IRI,
  );
  if (historyObjects.length === 0) {
    return options.requireSettledWorking
      ? [unsettled(options.designatorPath, workingPath)]
      : [];
  }
  if (
    historyObjects.length !== 1 || historyObjects[0]!.termType !== "NamedNode"
  ) {
    return [finding(
      "malformed-inventory",
      "Founding referent data history structure is malformed.",
      options.designatorPath,
      inventoryPath,
    )];
  }
  const historyIri = historyObjects[0]!.value;
  if (
    !hasSingleNamedFact(
      quads,
      foundingIri,
      SFLO_DEFAULT_ARTIFACT_HISTORY_IRI,
      historyIri,
    )
  ) {
    return [finding(
      "malformed-inventory",
      "Founding referent data default history is malformed.",
      options.designatorPath,
      inventoryPath,
    )];
  }

  const stateTerms = objects(quads, historyIri, SFLO_HAS_HISTORICAL_STATE_IRI);
  const latestTerms = objects(
    quads,
    historyIri,
    SFLO_LATEST_HISTORICAL_STATE_IRI,
  );
  const latestIri =
    latestTerms.length === 1 && latestTerms[0]!.termType === "NamedNode"
      ? latestTerms[0]!.value
      : undefined;
  let latestSnapshotBytes: Uint8Array | undefined;
  for (const state of stateTerms) {
    if (state.termType !== "NamedNode") {
      return [finding(
        "malformed-inventory",
        "Founding referent data state structure is malformed.",
        options.designatorPath,
        inventoryPath,
      )];
    }
    const resolved = resolveStateSnapshot(quads, options.meshBase, state.value);
    if (resolved === undefined) {
      return [finding(
        "malformed-inventory",
        "Founding referent data snapshot structure is malformed.",
        options.designatorPath,
        inventoryPath,
      )];
    }
    let snapshotBytes: Uint8Array;
    try {
      snapshotBytes = await Deno.readFile(
        join(options.meshRoot, resolved.path),
      );
    } catch {
      return [finding(
        "missing-artifact",
        `Founding referent data snapshot is missing: ${resolved.path}`,
        options.designatorPath,
        resolved.path,
      )];
    }
    const actualDigest = await sha256ContentDigest(snapshotBytes);
    if (
      resolved.manifestationDigest !== resolved.fileDigest ||
      actualDigest !== resolved.fileDigest
    ) {
      return [finding(
        "content-digest-mismatch",
        `Founding referent data snapshot digest mismatch: ${resolved.path}`,
        options.designatorPath,
        resolved.path,
      )];
    }
    if (state.value === latestIri) latestSnapshotBytes = snapshotBytes;
  }

  if (
    options.requireSettledWorking &&
    (latestSnapshotBytes === undefined ||
      !bytesEqual(workingBytes, latestSnapshotBytes))
  ) {
    return [unsettled(options.designatorPath, workingPath)];
  }
  return [];
}

function resolveStateSnapshot(
  quads: readonly Quad[],
  meshBase: string,
  stateIri: string,
):
  | { path: string; manifestationDigest: string; fileDigest: string }
  | undefined {
  const manifestations = objects(quads, stateIri, SFLO_HAS_MANIFESTATION_IRI);
  if (
    manifestations.length !== 1 || manifestations[0]!.termType !== "NamedNode"
  ) {
    return undefined;
  }
  const manifestationIri = manifestations[0]!.value;
  if (
    !hasNamedFact(
      quads,
      manifestationIri,
      RDF_TYPE_IRI,
      SFLO_ARTIFACT_MANIFESTATION_IRI,
    )
  ) {
    return undefined;
  }
  const files = objects(
    quads,
    manifestationIri,
    SFLO_LOCATED_FILE_FOR_MANIFESTATION_IRI,
  );
  const manifestationDigests = literalValues(
    objects(quads, manifestationIri, SFLO_HAS_CONTENT_DIGEST_IRI),
  );
  if (
    files.length !== 1 || files[0]!.termType !== "NamedNode" ||
    !files[0]!.value.startsWith(meshBase) ||
    manifestationDigests.length !== 1 ||
    !isCanonicalContentDigest(manifestationDigests[0]!)
  ) return undefined;
  const fileIri = files[0]!.value;
  const fileDigests = literalValues(
    objects(quads, fileIri, SFLO_HAS_CONTENT_DIGEST_IRI),
  );
  if (fileDigests.length !== 1 || !isCanonicalContentDigest(fileDigests[0]!)) {
    return undefined;
  }
  return {
    path: fileIri.slice(meshBase.length),
    manifestationDigest: manifestationDigests[0]!,
    fileDigest: fileDigests[0]!,
  };
}

function objects(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
): Term[] {
  return quads.filter((quad) =>
    quad.subject.termType === "NamedNode" &&
    quad.subject.value === subjectIri &&
    quad.predicate.value === predicateIri
  ).map((quad) => quad.object);
}

function hasNamedFact(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
  objectIri: string,
): boolean {
  return objects(quads, subjectIri, predicateIri).some((term) =>
    term.termType === "NamedNode" && term.value === objectIri
  );
}

function hasSingleNamedFact(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
  objectIri: string,
): boolean {
  const matches = objects(quads, subjectIri, predicateIri);
  return matches.length === 1 && matches[0]!.termType === "NamedNode" &&
    matches[0]!.value === objectIri;
}

function literalValues(terms: readonly Term[]): string[] {
  return terms.flatMap((term) =>
    term.termType === "Literal" ? [term.value] : []
  );
}

function finding(
  code: MeshValidationFindingCode,
  message: string,
  designatorPath: string,
  path: string,
): FoundingValidationFinding {
  return { severity: "error", code, message, path, designatorPath };
}

function unsettled(
  designatorPath: string,
  path: string,
): FoundingValidationFinding {
  return finding(
    "unsettled-founding-referent-data",
    `Founding referent data working bytes are not settled: ${path}`,
    designatorPath,
    path,
  );
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength &&
    left.every((byte, index) => byte === right[index]);
}
