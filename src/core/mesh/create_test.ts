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

Deno.test("planMeshCreate applies an explicit GitHub Pages publication profile", () => {
  const plan = planMeshCreate({
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    publicationProfile: "githubPages",
  });

  assertEquals(
    plan.files.map((file) => file.path),
    [
      "_mesh/_meta/meta.ttl",
      "_mesh/_inventory/inventory.ttl",
      "_mesh/_config/config.ttl",
      ".nojekyll",
    ],
  );
  assertEquals(plan.publicationProfile, "githubPages");
  assertStringIncludes(
    plan.files.find((file) => file.path === "_mesh/_config/config.ttl")
      ?.contents ?? "",
    "sfcfg:hasPublicationProfile sfcfg:publicationProfile_githubPages",
  );
});

Deno.test("planMeshCreate resolves auto publication profile from GitHub Pages mesh base", () => {
  const plan = planMeshCreate({
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    publicationProfile: "auto",
  });

  assertEquals(plan.publicationProfile, "githubPages");
  assertEquals(
    plan.files.map((file) => file.path),
    [
      "_mesh/_meta/meta.ttl",
      "_mesh/_inventory/inventory.ttl",
      "_mesh/_config/config.ttl",
      ".nojekyll",
    ],
  );
});

Deno.test("planMeshCreate resolves auto publication profile to none for ordinary hosts", () => {
  const plan = planMeshCreate({
    meshBase: "https://example.org/",
    publicationProfile: "auto",
  });

  assertEquals(plan.publicationProfile, "none");
  assertEquals(
    plan.files.map((file) => file.path),
    [
      "_mesh/_meta/meta.ttl",
      "_mesh/_inventory/inventory.ttl",
      "_mesh/_config/config.ttl",
    ],
  );
  assertStringIncludes(
    plan.files.find((file) => file.path === "_mesh/_config/config.ttl")
      ?.contents ?? "",
    "sfcfg:hasPublicationProfile sfcfg:publicationProfile_none",
  );
});

Deno.test("planMeshCreate can still create a legacy explicit .nojekyll file", () => {
  const plan = planMeshCreate({
    meshBase: "https://semantic-flow.github.io/mesh-alice-bio/",
    includeNoJekyll: true,
  });

  assertEquals(
    plan.files.map((file) => file.path),
    [
      "_mesh/_meta/meta.ttl",
      "_mesh/_inventory/inventory.ttl",
      ".nojekyll",
    ],
  );
});

Deno.test("planMeshCreate renders sidecar mesh config when requested", () => {
  const plan = planMeshCreate({
    meshBase: "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
    workspaceRootRelativeToMeshRoot: "../",
  });

  assertEquals(
    plan.files.map((file) => file.path),
    [
      "_mesh/_meta/meta.ttl",
      "_mesh/_inventory/inventory.ttl",
      "_mesh/_config/config.ttl",
    ],
  );
  const config =
    plan.files.find((file) => file.path === "_mesh/_config/config.ttl")
      ?.contents ?? "";
  assertStringIncludes(config, "<> a sfcfg:MeshConfig ;");
  assertStringIncludes(
    config,
    'sfcfg:workspaceRootRelativeToMeshRoot "../" .',
  );
  assertStringIncludes(
    plan.files[1]?.contents ?? "",
    "<_mesh/_config> a sfcfg:MeshConfig, sflo:DigitalArtifact, sflo:RdfDocument ;",
  );
});

Deno.test("planMeshCreate renders an empty mesh config when requested", () => {
  const plan = planMeshCreate({
    meshBase: "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
    includeMeshConfig: true,
  });

  assertEquals(
    plan.files.map((file) => file.path),
    [
      "_mesh/_meta/meta.ttl",
      "_mesh/_inventory/inventory.ttl",
      "_mesh/_config/config.ttl",
    ],
  );
  assertEquals(
    plan.files.find((file) => file.path === "_mesh/_config/config.ttl")
      ?.contents,
    `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:MeshConfig .
`,
  );
  assertStringIncludes(
    plan.files[1]?.contents ?? "",
    "<_mesh/_config> a sfcfg:MeshConfig, sflo:DigitalArtifact, sflo:RdfDocument ;",
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
