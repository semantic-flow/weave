// Deterministic payload-mesh fixture shared by the versionPayloads
// integration tests and the npm-lib off-tree contract smoke
// (scripts/smoke-npm-lib.ts). Everything written here is wall-clock-free so
// two runs over identical inputs produce byte-identical workspace trees.
import { basename, dirname, join } from "@std/path";

export const PAYLOAD_MESH_BASE = "https://example.test/version-api/";

export interface PayloadTargetFixture {
  designatorPath: string;
  label: string;
  latestOrdinal: number;
  workingLocalRelativePath?: string;
}

export const coreTarget: PayloadTargetFixture = {
  designatorPath: "rules/core",
  label: "Core rules",
  latestOrdinal: 1,
};

export const shaclTarget: PayloadTargetFixture = {
  designatorPath: "rules/shacl",
  label: "SHACL rules",
  latestOrdinal: 2,
};

export async function materializePayloadMesh(
  meshRoot: string,
  targets: readonly PayloadTargetFixture[],
): Promise<void> {
  await writeText(
    join(meshRoot, "_mesh/_meta/meta.ttl"),
    `@base <${PAYLOAD_MESH_BASE}> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<_mesh> a sflo:SemanticMesh ;
  sflo:meshBase "${PAYLOAD_MESH_BASE}"^^xsd:anyURI ;
  sflo:hasMeshMetadata <_mesh/_meta> ;
  sflo:hasMeshInventory <_mesh/_inventory> .

<_mesh/_meta> a sflo:MeshMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <_mesh/_meta/meta.ttl> .

<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <_mesh/_inventory/inventory.ttl> .
`,
  );
  await writeText(
    join(meshRoot, "_mesh/_inventory/inventory.ttl"),
    `@base <${PAYLOAD_MESH_BASE}> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<_mesh> a sflo:SemanticMesh ;
  sflo:meshBase "${PAYLOAD_MESH_BASE}"^^xsd:anyURI ;
  sflo:hasMeshMetadata <_mesh/_meta> ;
  sflo:hasMeshInventory <_mesh/_inventory> ;
  ${
      targets.map((target) => `sflo:hasKnop <${knopPath(target)}>`)
        .join(" ;\n  ")
    } .

<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <_mesh/_inventory/inventory.ttl> .

<_mesh/_meta> a sflo:MeshMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <_mesh/_meta/meta.ttl> .

<_mesh/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

${
      targets.map((target) =>
        `<${knopPath(target)}> a sflo:Knop ;
  sflo:hasWorkingKnopInventoryFile <${
          knopPath(target)
        }/_inventory/inventory.ttl> .`
      ).join("\n\n")
    }
`,
  );

  for (const target of targets) {
    await materializePayloadTarget(meshRoot, target);
  }
}

async function materializePayloadTarget(
  meshRoot: string,
  target: PayloadTargetFixture,
): Promise<void> {
  const { designatorPath, latestOrdinal } = target;
  const targetKnopPath = knopPath(target);
  const workingPath = workingPayloadPath(target);
  await writeText(
    join(meshRoot, `${targetKnopPath}/_meta/meta.ttl`),
    `@base <${PAYLOAD_MESH_BASE}> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<${targetKnopPath}> a sflo:Knop ;
  sflo:designatorPath "${designatorPath}" ;
  sflo:hasWorkingKnopInventoryFile <${targetKnopPath}/_inventory/inventory.ttl> .
`,
  );
  await writeText(
    join(meshRoot, `${targetKnopPath}/_inventory/inventory.ttl`),
    payloadInventoryTurtle(target),
  );
  await writeText(
    join(meshRoot, workingPath),
    payloadText(target, latestOrdinal),
  );
  await writeText(
    join(meshRoot, `${targetKnopPath}/_sources/sources.ttl`),
    `@base <${PAYLOAD_MESH_BASE}> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<${targetKnopPath}/_sources> a sflo:KnopSourceRegistry .
`,
  );
  await writeText(
    join(meshRoot, `${targetKnopPath}/_references/references.ttl`),
    `@base <${PAYLOAD_MESH_BASE}> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<${targetKnopPath}/_references> a sflo:ReferenceCatalog .
`,
  );
  for (let ordinal = 1; ordinal <= latestOrdinal; ordinal += 1) {
    await writeText(
      join(meshRoot, snapshotPath(target, ordinal)),
      payloadText(target, ordinal),
    );
  }
}

function payloadInventoryTurtle(target: PayloadTargetFixture): string {
  const { designatorPath, latestOrdinal } = target;
  const targetKnopPath = knopPath(target);
  const historyPath = appendTargetPath(designatorPath, "_history001");
  const workingPath = workingPayloadPath(target);
  const fileName = basename(workingPath);
  const states = Array.from({ length: latestOrdinal }, (_, index) => {
    const ordinal = index + 1;
    const statePath = `${historyPath}/${stateSegment(ordinal)}`;
    const previous = ordinal === 1 ? "" : `
  sflo:previousHistoricalState <${historyPath}/${stateSegment(ordinal - 1)}> ;`;
    return `<${statePath}> a sflo:HistoricalState ;
  sflo:stateOrdinal "${ordinal}"^^xsd:nonNegativeInteger ;${previous}
  sflo:hasManifestation <${statePath}/ttl> ;
  sflo:locatedFileForState <${statePath}/ttl/${fileName}> .

<${statePath}/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${statePath}/ttl/${fileName}> .`;
  }).join("\n\n");
  const historyStates = Array.from(
    { length: latestOrdinal },
    (_, index) =>
      `  sflo:hasHistoricalState <${historyPath}/${stateSegment(index + 1)}> ;`,
  ).join("\n");

  return `@base <${PAYLOAD_MESH_BASE}> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<${targetKnopPath}> a sflo:Knop ;
  sflo:hasKnopMetadata <${targetKnopPath}/_meta> ;
  sflo:hasKnopInventory <${targetKnopPath}/_inventory> ;
  sflo:hasWorkingKnopInventoryFile <${targetKnopPath}/_inventory/inventory.ttl> ;
  sflo:hasPayloadArtifact <${designatorPath}> ;
  sflo:hasKnopSourceRegistry <${targetKnopPath}/_sources> ;
  sflo:hasReferenceCatalog <${targetKnopPath}/_references> ;
  sflo:hasResourcePage <${targetKnopPath}/index.html> .

<${designatorPath}> a sflo:PayloadArtifact, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasArtifactHistory <${historyPath}> ;
  sflo:currentArtifactHistory <${historyPath}> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasWorkingLocatedFile <${workingPath}> .

<${historyPath}> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
${historyStates}
  sflo:latestHistoricalState <${historyPath}/${stateSegment(latestOrdinal)}> ;
  sflo:nextStateOrdinal "${latestOrdinal + 1}"^^xsd:nonNegativeInteger .

${states}

<${targetKnopPath}/_meta> a sflo:KnopMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${targetKnopPath}/_meta/meta.ttl> .

<${targetKnopPath}/_inventory> a sflo:KnopInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${targetKnopPath}/_inventory/inventory.ttl> ;
  sflo:hasResourcePage <${targetKnopPath}/_inventory/index.html> .

<${targetKnopPath}/_sources> a sflo:KnopSourceRegistry, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${targetKnopPath}/_sources/sources.ttl> .

<${targetKnopPath}/_references> a sflo:ReferenceCatalog, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${targetKnopPath}/_references/references.ttl> ;
  sflo:hasResourcePage <${targetKnopPath}/_references/index.html> .

<${workingPath}> a sflo:LocatedFile, sflo:RdfDocument .
`;
}

export function payloadText(
  target: PayloadTargetFixture,
  ordinal: number,
): string {
  return `@base <${PAYLOAD_MESH_BASE}> .
@prefix dcterms: <http://purl.org/dc/terms/> .

<${target.designatorPath}> dcterms:title "${target.label} v${ordinal}" .
`;
}

export function payloadBytes(
  target: PayloadTargetFixture,
  ordinal: number,
): Uint8Array {
  return new TextEncoder().encode(payloadText(target, ordinal));
}

export function snapshotPath(
  target: PayloadTargetFixture,
  ordinal: number,
): string {
  const fileName = basename(workingPayloadPath(target));
  return `${appendTargetPath(target.designatorPath, "_history001")}/${
    stateSegment(ordinal)
  }/ttl/${fileName}`;
}

export function knopPath(target: PayloadTargetFixture): string {
  return appendTargetPath(target.designatorPath, "_knop");
}

export function workingPayloadPath(target: PayloadTargetFixture): string {
  return target.workingLocalRelativePath ?? `${target.designatorPath}.ttl`;
}

export function appendTargetPath(
  designatorPath: string,
  suffix: string,
): string {
  return designatorPath.length === 0 ? suffix : `${designatorPath}/${suffix}`;
}

export function stateSegment(ordinal: number): string {
  return `_s${String(ordinal).padStart(4, "0")}`;
}

export async function writeText(path: string, contents: string): Promise<void> {
  await Deno.mkdir(dirname(path), { recursive: true });
  await Deno.writeTextFile(path, contents);
}

export async function listWorkspaceFiles(
  root: string,
  prefix = "",
): Promise<string[]> {
  const files: string[] = [];
  for await (const entry of Deno.readDir(join(root, prefix))) {
    const path = prefix.length === 0 ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory) {
      files.push(...await listWorkspaceFiles(root, path));
    } else if (entry.isFile) {
      files.push(path);
    }
  }
  return files.sort();
}
