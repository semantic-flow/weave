import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import { MeshCreateInputError, planMeshCreate } from "./create.ts";

Deno.test("planMeshCreate renders first mesh support artifacts", () => {
  const plan = planMeshCreate({
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
  });

  assertEquals(
    plan.meshIri,
    "https://semantic-flow.github.io/mesh-alice-bio/_mesh",
  );
  assertEquals(
    plan.files.map((file) => file.path),
    [
      "_mesh/_meta/meta.ttl",
      "_mesh/_inventory/inventory.ttl",
      ".nojekyll",
    ],
  );
  assertStringIncludes(
    plan.files[0]?.contents ?? "",
    'sflo:meshBase "https://semantic-flow.github.io/mesh-alice-bio/"^^xsd:anyURI',
  );
  assertStringIncludes(
    plan.files[1]?.contents ?? "",
    "<_mesh/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .",
  );
});

Deno.test("planMeshCreate skips .nojekyll when explicitly disabled", () => {
  const plan = planMeshCreate({
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    includeNoJekyll: false,
  });

  assertEquals(
    plan.files.map((file) => file.path),
    [
      "_mesh/_meta/meta.ttl",
      "_mesh/_inventory/inventory.ttl",
    ],
  );
});

Deno.test("planMeshCreate does not add .nojekyll for non-GitHub Pages mesh bases", () => {
  const plan = planMeshCreate({
    meshBase: "https://example.org/",
  });

  assertEquals(
    plan.files.map((file) => file.path),
    [
      "_mesh/_meta/meta.ttl",
      "_mesh/_inventory/inventory.ttl",
    ],
  );
});

Deno.test("planMeshCreate rejects meshBase without trailing slash", () => {
  assertThrows(
    () =>
      planMeshCreate({
        meshBase: "https://semantic-flow.github.io/mesh-alice-bio",
      }),
    MeshCreateInputError,
    "meshBase must end with '/'",
  );
});
