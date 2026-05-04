import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { join, resolve } from "@std/path";
import {
  loadOperationalLocalPathPolicy,
  LocalPathAccessError,
  OperationalConfigError,
  resolveAllowedLocalPath,
} from "./local_path_policy.ts";

Deno.test("loadOperationalLocalPathPolicy discovers mesh-owned config in a non-whole-repo mesh", async () => {
  const tempRoot = await Deno.makeTempDir({
    prefix: "weave-local-path-policy-",
  });
  const repoRoot = join(tempRoot, "repo");
  const meshRoot = join(repoRoot, "mesh");
  await Deno.mkdir(join(meshRoot, "_mesh/_config"), { recursive: true });
  await Deno.writeTextFile(
    join(meshRoot, "_mesh/_config/config.ttl"),
    `@prefix sfcfg: <https://semantic-flow.github.io/ontology/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:workspaceRootRelativeToMeshRoot "../" ;
  sfcfg:hasLocalPathAccessRule [
    a sfcfg:LocalPathAccessRule ;
    sfcfg:hasLocalPathBase <https://semantic-flow.github.io/ontology/config/meshRootPathBase> ;
    sfcfg:pathPrefix "../documentation/" ;
    sfcfg:hasLocalPathLocatorKind <https://semantic-flow.github.io/ontology/config/targetLocalRelativePathLocatorKind>
  ] .
`,
  );

  const policy = await loadOperationalLocalPathPolicy(meshRoot);

  assertEquals(
    policy.meshConfigPath,
    join(meshRoot, "_mesh/_config/config.ttl"),
  );
  assertEquals(
    resolveAllowedLocalPath(
      policy,
      "targetLocalRelativePath",
      "../documentation/sidebar.md",
    ),
    resolve(repoRoot, "documentation/sidebar.md"),
  );
});

Deno.test("resolveAllowedLocalPath denies extra-mesh paths when no config matches", async () => {
  const tempRoot = await Deno.makeTempDir({ prefix: "weave-local-path-deny-" });
  const meshRoot = join(tempRoot, "mesh");
  await Deno.mkdir(meshRoot, { recursive: true });

  const policy = await loadOperationalLocalPathPolicy(meshRoot);

  assertThrows(
    () =>
      resolveAllowedLocalPath(
        policy,
        "targetLocalRelativePath",
        "../documentation/sidebar.md",
      ),
    LocalPathAccessError,
    "outside the mesh root",
  );
});

Deno.test("loadOperationalLocalPathPolicy rejects mesh config that grants arbitrary host traversal", async () => {
  const tempRoot = await Deno.makeTempDir({
    prefix: "weave-local-path-policy-host-",
  });
  const meshRoot = join(tempRoot, "workspace/docs");
  await Deno.mkdir(join(meshRoot, "_mesh/_config"), { recursive: true });
  await Deno.writeTextFile(
    join(meshRoot, "_mesh/_config/config.ttl"),
    `@prefix sfcfg: <https://semantic-flow.github.io/ontology/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:hasLocalPathAccessRule [
    a sfcfg:LocalPathAccessRule ;
    sfcfg:hasLocalPathBase <https://semantic-flow.github.io/ontology/config/meshRootPathBase> ;
    sfcfg:pathPrefix "../../" ;
    sfcfg:hasLocalPathLocatorKind <https://semantic-flow.github.io/ontology/config/workingLocalRelativePathLocatorKind>
  ] .
`,
  );

  await assertRejects(
    () => loadOperationalLocalPathPolicy(meshRoot),
    OperationalConfigError,
    "arbitrary host traversal",
  );
});

Deno.test("loadOperationalLocalPathPolicy applies machine-local absolute path rules", async () => {
  const tempRoot = await Deno.makeTempDir({ prefix: "weave-local-path-home-" });
  const meshRoot = join(tempRoot, "mesh");
  const sharedRoot = join(tempRoot, "shared-notes");
  const homeRoot = join(tempRoot, "home");
  await Deno.mkdir(meshRoot, { recursive: true });
  await Deno.mkdir(sharedRoot, { recursive: true });
  await Deno.mkdir(homeRoot, { recursive: true });
  await Deno.writeTextFile(
    join(homeRoot, ".sf-local-access.ttl"),
    `@prefix sfcfg: <https://semantic-flow.github.io/ontology/config/> .

<> a sfcfg:LocalConfig ;
  sfcfg:hasLocalPathAccessRule [
    a sfcfg:LocalPathAccessRule ;
    sfcfg:hasLocalPathBase <https://semantic-flow.github.io/ontology/config/absolutePathBase> ;
    sfcfg:pathPrefix "${sharedRoot}/" ;
    sfcfg:hasLocalPathLocatorKind <https://semantic-flow.github.io/ontology/config/workingLocalRelativePathLocatorKind>
  ] .
`,
  );

  const previousHome = Deno.env.get("HOME");
  Deno.env.set("HOME", homeRoot);
  try {
    const policy = await loadOperationalLocalPathPolicy(meshRoot);
    assertEquals(
      policy.localConfigPath,
      join(homeRoot, ".sf-local-access.ttl"),
    );
    assertEquals(
      resolveAllowedLocalPath(
        policy,
        "workingLocalRelativePath",
        "../shared-notes/current.ttl",
      ),
      resolve(sharedRoot, "current.ttl"),
    );
  } finally {
    if (previousHome === undefined) {
      Deno.env.delete("HOME");
    } else {
      Deno.env.set("HOME", previousHome);
    }
  }
});
