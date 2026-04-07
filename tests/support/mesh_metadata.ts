import { join } from "@std/path";

export const MESH_ALICE_BIO_BASE =
  "https://semantic-flow.github.io/mesh-alice-bio/";

export async function writeEquivalentMeshMetadata(
  workspaceRoot: string,
  meshBase = MESH_ALICE_BIO_BASE,
): Promise<void> {
  await Deno.mkdir(join(workspaceRoot, "_mesh", "_meta"), { recursive: true });
  await Deno.writeTextFile(
    join(workspaceRoot, "_mesh/_meta/meta.ttl"),
    `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@base <${meshBase}> .

<_mesh> sflo:hasWorkingMeshInventoryFile <_mesh/_inventory/inventory.ttl> ;
  rdf:type sflo:SemanticMesh ;
  sflo:meshBase "${meshBase}"^^xsd:anyURI .
`,
  );
}
