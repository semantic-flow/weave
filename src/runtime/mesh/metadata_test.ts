import { assertEquals, assertThrows } from "@std/assert";
import {
  loadWorkspaceMeshBase,
  MeshMetadataResolutionError,
  resolveMeshBaseFromMetadataTurtle,
} from "./metadata.ts";

Deno.test("resolveMeshBaseFromMetadataTurtle accepts semantically equivalent mesh metadata turtle", () => {
  assertEquals(
    resolveMeshBaseFromMetadataTurtle(
      `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@base <https://semantic-flow.github.io/mesh-alice-bio/> .

<_mesh> sflo:hasWorkingMeshInventoryFile <_mesh/_inventory/inventory.ttl> ;
  rdf:type sflo:SemanticMesh ;
  sflo:meshBase "https://semantic-flow.github.io/mesh-alice-bio/"^^xsd:anyURI .
`,
    ),
    "https://semantic-flow.github.io/mesh-alice-bio/",
  );
});

Deno.test("resolveMeshBaseFromMetadataTurtle rejects mesh metadata without exactly one anyURI meshBase literal", () => {
  assertThrows(
    () =>
      resolveMeshBaseFromMetadataTurtle(
        `@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .

<_mesh> sflo:meshBase "https://example.org/" .
`,
      ),
    MeshMetadataResolutionError,
    "Could not resolve meshBase from _mesh/_meta/meta.ttl",
  );

  assertThrows(
    () =>
      resolveMeshBaseFromMetadataTurtle(
        `@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<_mesh> sflo:meshBase "https://example.org/a/"^^xsd:anyURI, "https://example.org/b/"^^xsd:anyURI .
`,
      ),
    MeshMetadataResolutionError,
    "Could not resolve meshBase from _mesh/_meta/meta.ttl",
  );
});

Deno.test("loadWorkspaceMeshBase reads mesh metadata from the workspace surface", async () => {
  const workspaceRoot = await Deno.makeTempDir({
    prefix: "weave-runtime-mesh-metadata-",
  });

  try {
    await Deno.mkdir(`${workspaceRoot}/_mesh/_meta`, { recursive: true });
    await Deno.writeTextFile(
      `${workspaceRoot}/_mesh/_meta/meta.ttl`,
      `@prefix sflo: <https://semantic-flow.github.io/semantic-flow-ontology/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<_mesh> sflo:meshBase "https://semantic-flow.github.io/mesh-alice-bio/"^^xsd:anyURI .
`,
    );

    assertEquals(
      await loadWorkspaceMeshBase(workspaceRoot),
      "https://semantic-flow.github.io/mesh-alice-bio/",
    );
  } finally {
    await Deno.remove(workspaceRoot, { recursive: true });
  }
});
