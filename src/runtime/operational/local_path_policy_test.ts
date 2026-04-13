import { assertEquals, assertThrows } from "@std/assert";
import { join, resolve } from "@std/path";
import {
  loadOperationalLocalPathPolicy,
  LocalPathAccessError,
  resolveAllowedLocalPath,
} from "./local_path_policy.ts";

Deno.test("loadOperationalLocalPathPolicy discovers repo access config above a non-whole-repo mesh", async () => {
  const tempRoot = await Deno.makeTempDir({
    prefix: "weave-local-path-policy-",
  });
  const repoRoot = join(tempRoot, "repo");
  const meshRoot = join(repoRoot, "mesh");
  await Deno.mkdir(meshRoot, { recursive: true });
  await Deno.writeTextFile(
    join(repoRoot, ".sf-repo-access.ttl"),
    `@prefix sfcfg: <https://semantic-flow.github.io/ontology/config/> .

<> a sfcfg:RepoOperationalConfig ;
  sfcfg:hasLocalPathAccessRule [
    a sfcfg:LocalPathAccessRule ;
    sfcfg:hasLocalPathBase <https://semantic-flow.github.io/ontology/config/LocalPathBase/MeshRoot> ;
    sfcfg:pathPrefix "../documentation/" ;
    sfcfg:hasLocalPathLocatorKind <https://semantic-flow.github.io/ontology/config/LocalPathLocatorKind/Any>
  ] .
`,
  );

  const policy = await loadOperationalLocalPathPolicy(meshRoot);

  assertEquals(policy.repoConfigPath, join(repoRoot, ".sf-repo-access.ttl"));
  assertEquals(
    resolveAllowedLocalPath(
      policy,
      "targetMeshPath",
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
        "targetMeshPath",
        "../documentation/sidebar.md",
      ),
    LocalPathAccessError,
    "outside the mesh root",
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

<> a sfcfg:LocalOperationalConfig ;
  sfcfg:hasLocalPathAccessRule [
    a sfcfg:LocalPathAccessRule ;
    sfcfg:hasLocalPathBase <https://semantic-flow.github.io/ontology/config/LocalPathBase/AbsolutePath> ;
    sfcfg:pathPrefix "${sharedRoot}/" ;
    sfcfg:hasLocalPathLocatorKind <https://semantic-flow.github.io/ontology/config/LocalPathLocatorKind/WorkingFilePath>
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
        "workingFilePath",
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
