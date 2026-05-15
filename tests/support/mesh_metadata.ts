import { join } from "@std/path";
export { MESH_ALICE_BIO_BASE } from "./mesh_alice_bio_fixture.ts";

import { MESH_ALICE_BIO_BASE } from "./mesh_alice_bio_fixture.ts";

export async function writeEquivalentMeshMetadata(
  workspaceRoot: string,
  meshBase = MESH_ALICE_BIO_BASE,
): Promise<void> {
  await Deno.mkdir(join(workspaceRoot, "_mesh", "_meta"), { recursive: true });
  await Deno.writeTextFile(
    join(workspaceRoot, "_mesh/_meta/meta.ttl"),
    `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@base <${meshBase}> .

<_mesh/_inventory> sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
  rdf:type sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:currentArtifactHistory <_mesh/_inventory/_history001> .

<_mesh> sflo:hasMeshInventory <_mesh/_inventory> ;
  sflo:meshBase "${meshBase}"^^xsd:anyURI ;
  rdf:type sflo:SemanticMesh .

<_mesh/_meta> rdf:type sflo:RdfDocument, sflo:DigitalArtifact, sflo:MeshMetadata .

<_mesh/_inventory/_history001> sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  rdf:type sflo:ArtifactHistory ;
  sflo:latestHistoricalState <_mesh/_inventory/_history001/_s0001> .
`,
  );
}
