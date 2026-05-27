import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { dirname, join, resolve } from "@std/path";
import {
  renderHostLocalAccessProfileTurtle,
  renderUserSettingsTurtle,
  resolveUserSettingsPaths,
} from "../settings/user_settings.ts";
import {
  ensureHostLocalWorkingDirectoryAccessRule,
  ensureMeshConfigWorkingDirectoryAccessRule,
  loadOperationalLocalPathPolicy,
  LocalPathAccessError,
  OperationalConfigError,
  resolveAllowedLocalPath,
  resolveRepositorySourceFloatingLocalPath,
} from "./local_path_policy.ts";

const TEST_MESH_BASE = "https://example.org/mesh/";

Deno.test("loadOperationalLocalPathPolicy discovers mesh-owned config in a non-whole-repo mesh", async () => {
  const tempRoot = await Deno.makeTempDir({
    prefix: "weave-local-path-policy-",
  });
  const repoRoot = join(tempRoot, "repo");
  const meshRoot = join(repoRoot, "mesh");
  await Deno.mkdir(join(meshRoot, "_mesh/_config"), { recursive: true });
  await Deno.writeTextFile(
    join(meshRoot, "_mesh/_config/config.ttl"),
    `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:workspaceRootRelativeToMeshRoot "../" ;
  sfcfg:hasLocalPathAccessRule [
    a sfcfg:LocalPathAccessRule ;
    sfcfg:hasLocalPathBase <https://semantic-flow.github.io/sflo/config/localPathBase_meshRoot> ;
    sfcfg:pathPrefix "../documentation/" ;
    sfcfg:hasLocalPathLocatorKind <https://semantic-flow.github.io/sflo/config/localPathLocatorKind_targetLocalRelativePath>
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

Deno.test("ensureMeshConfigWorkingDirectoryAccessRule preserves publication profile", async () => {
  const tempRoot = await Deno.makeTempDir({
    prefix: "weave-local-path-policy-profile-",
  });
  const repoRoot = join(tempRoot, "repo");
  const meshRoot = join(repoRoot, "docs");
  const configPath = join(meshRoot, "_mesh/_config/config.ttl");
  await Deno.mkdir(join(meshRoot, "_mesh/_config"), { recursive: true });
  await Deno.writeTextFile(
    configPath,
    `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:workspaceRootRelativeToMeshRoot "../" ;
  sfcfg:hasPublicationProfile sfcfg:publicationProfile_githubPages .
`,
  );

  const policy = await loadOperationalLocalPathPolicy(meshRoot);
  await ensureMeshConfigWorkingDirectoryAccessRule(policy, "../ontology/");

  const config = await Deno.readTextFile(configPath);
  assertEquals(
    config.includes(
      "sfcfg:hasPublicationProfile <https://semantic-flow.github.io/sflo/config/publicationProfile_githubPages>",
    ),
    true,
  );
  assertEquals(config.includes("sfcfg:hasLocalPathAccessRule"), true);
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
    `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:hasLocalPathAccessRule [
    a sfcfg:LocalPathAccessRule ;
    sfcfg:hasLocalPathBase <https://semantic-flow.github.io/sflo/config/localPathBase_meshRoot> ;
    sfcfg:pathPrefix "../../" ;
    sfcfg:hasLocalPathLocatorKind <https://semantic-flow.github.io/sflo/config/localPathLocatorKind_workingLocalRelativePath>
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
  const settingsRoot = join(tempRoot, "settings");
  await Deno.mkdir(meshRoot, { recursive: true });
  await Deno.mkdir(sharedRoot, { recursive: true });
  await Deno.mkdir(homeRoot, { recursive: true });
  await writeMeshMetadata(meshRoot);
  await writeSettingsAccessGrant(settingsRoot, sharedRoot);

  await withEnv({ HOME: homeRoot, WEAVE_SETTINGS: settingsRoot }, async () => {
    const policy = await loadOperationalLocalPathPolicy(meshRoot);
    assertEquals(
      policy.localConfigPath,
      join(settingsRoot, "meshes/mesh-1190756e677d/access.ttl"),
    );
    assertEquals(
      resolveAllowedLocalPath(
        policy,
        "workingLocalRelativePath",
        "../shared-notes/current.ttl",
      ),
      resolve(sharedRoot, "current.ttl"),
    );
  });
});

Deno.test("loadOperationalLocalPathPolicy ignores the legacy home access file", async () => {
  const tempRoot = await Deno.makeTempDir({
    prefix: "weave-local-path-legacy-home-",
  });
  const meshRoot = join(tempRoot, "mesh");
  const sharedRoot = join(tempRoot, "shared-notes");
  const homeRoot = join(tempRoot, "home");
  await Deno.mkdir(meshRoot, { recursive: true });
  await Deno.mkdir(sharedRoot, { recursive: true });
  await Deno.mkdir(homeRoot, { recursive: true });
  await writeMeshMetadata(meshRoot);
  await Deno.writeTextFile(
    join(homeRoot, ".sf-local-access.ttl"),
    renderHostLocalAccessProfileTurtle([`${sharedRoot}/`]),
  );

  await withEnv({ HOME: homeRoot, WEAVE_SETTINGS: "" }, async () => {
    const policy = await loadOperationalLocalPathPolicy(meshRoot);
    assertThrows(
      () =>
        resolveAllowedLocalPath(
          policy,
          "workingLocalRelativePath",
          "../shared-notes/current.ttl",
        ),
      LocalPathAccessError,
      "outside the mesh root",
    );
  });
});

Deno.test("loadOperationalLocalPathPolicy does not load global access by default", async () => {
  const tempRoot = await Deno.makeTempDir({
    prefix: "weave-local-path-global-access-",
  });
  const meshRoot = join(tempRoot, "mesh");
  const sharedRoot = join(tempRoot, "shared-notes");
  const homeRoot = join(tempRoot, "home");
  const settingsRoot = join(tempRoot, "settings");
  await Deno.mkdir(meshRoot, { recursive: true });
  await Deno.mkdir(sharedRoot, { recursive: true });
  await Deno.mkdir(homeRoot, { recursive: true });
  await writeMeshMetadata(meshRoot);
  await Deno.mkdir(settingsRoot, { recursive: true });
  await Deno.writeTextFile(
    join(settingsRoot, "global-access.ttl"),
    renderHostLocalAccessProfileTurtle([`${sharedRoot}/`]),
  );

  await withEnv({ HOME: homeRoot, WEAVE_SETTINGS: settingsRoot }, async () => {
    const policy = await loadOperationalLocalPathPolicy(meshRoot);
    assertThrows(
      () =>
        resolveAllowedLocalPath(
          policy,
          "workingLocalRelativePath",
          "../shared-notes/current.ttl",
        ),
      LocalPathAccessError,
      "outside the mesh root",
    );
  });
});

Deno.test("resolveAllowedLocalPath requires a host-local grant for sibling worktree access", async () => {
  const tempRoot = await Deno.makeTempDir({
    prefix: "weave-local-path-sibling-",
  });
  const sourceRoot = join(tempRoot, "source");
  const publishRoot = join(tempRoot, "gh-pages");
  const homeRoot = join(tempRoot, "home");
  const settingsRoot = join(tempRoot, "settings");
  await Deno.mkdir(join(sourceRoot, "ontology"), { recursive: true });
  await Deno.mkdir(publishRoot, { recursive: true });
  await Deno.mkdir(homeRoot, { recursive: true });
  await writeMeshMetadata(publishRoot);
  await Deno.writeTextFile(
    join(sourceRoot, "ontology/fantasy-rules-ontology.ttl"),
    "# source branch file\n",
  );

  const relativeSourcePath = "../source/ontology/fantasy-rules-ontology.ttl";
  await withEnv({ HOME: homeRoot, WEAVE_SETTINGS: settingsRoot }, async () => {
    const deniedPolicy = await loadOperationalLocalPathPolicy(publishRoot);
    assertThrows(
      () =>
        resolveAllowedLocalPath(
          deniedPolicy,
          "workingLocalRelativePath",
          relativeSourcePath,
        ),
      LocalPathAccessError,
      "outside the mesh root",
    );

    await writeSettingsAccessGrant(settingsRoot, sourceRoot);

    const grantedPolicy = await loadOperationalLocalPathPolicy(publishRoot);
    assertEquals(
      resolveAllowedLocalPath(
        grantedPolicy,
        "workingLocalRelativePath",
        relativeSourcePath,
      ),
      join(sourceRoot, "ontology/fantasy-rules-ontology.ttl"),
    );
  });
});

Deno.test("resolveRepositorySourceFloatingLocalPath resolves allowed repository checkout paths", async () => {
  const tempRoot = await Deno.makeTempDir({
    prefix: "weave-repo-floating-policy-",
  });
  const sourceRoot = join(tempRoot, "source");
  const publishRoot = join(tempRoot, "gh-pages");
  const homeRoot = join(tempRoot, "home");
  const settingsRoot = join(tempRoot, "settings");
  await Deno.mkdir(sourceRoot, { recursive: true });
  await Deno.mkdir(publishRoot, { recursive: true });
  await Deno.mkdir(homeRoot, { recursive: true });
  await writeMeshMetadata(publishRoot);
  await runGit(sourceRoot, ["init"]);
  await runGit(sourceRoot, [
    "remote",
    "add",
    "origin",
    "git@github.com:semantic-flow/sflo.git",
  ]);
  await Deno.writeTextFile(
    join(sourceRoot, "semantic-flow-core-ontology.ttl"),
    "# source branch file\n",
  );
  await writeSettingsAccessGrant(settingsRoot, sourceRoot);

  await withEnv({ HOME: homeRoot, WEAVE_SETTINGS: settingsRoot }, async () => {
    const policy = await loadOperationalLocalPathPolicy(publishRoot);
    assertEquals(
      await resolveRepositorySourceFloatingLocalPath(policy, {
        repositoryUrl: "https://github.com/semantic-flow/sflo.git",
        repositoryPathFromRoot: "semantic-flow-core-ontology.ttl",
      }),
      join(sourceRoot, "semantic-flow-core-ontology.ttl"),
    );
  });
});

Deno.test("resolveRepositorySourceFloatingLocalPath ignores mesh-owned roots outside workspace", async () => {
  const tempRoot = await Deno.makeTempDir({
    prefix: "weave-repo-floating-policy-mesh-boundary-",
  });
  const sourceRoot = join(tempRoot, "source");
  const publishRoot = join(tempRoot, "gh-pages");
  const homeRoot = join(tempRoot, "home");
  await Deno.mkdir(sourceRoot, { recursive: true });
  await Deno.mkdir(join(publishRoot, "_mesh/_config"), { recursive: true });
  await Deno.mkdir(homeRoot, { recursive: true });
  await runGit(sourceRoot, ["init"]);
  await runGit(sourceRoot, [
    "remote",
    "add",
    "origin",
    "https://github.com/semantic-flow/sflo.git",
  ]);
  await Deno.writeTextFile(
    join(sourceRoot, "semantic-flow-core-ontology.ttl"),
    "# source branch file\n",
  );
  await Deno.writeTextFile(
    join(publishRoot, "_mesh/_config/config.ttl"),
    `@prefix sfcfg: <https://semantic-flow.github.io/sflo/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:hasLocalPathAccessRule [
    a sfcfg:LocalPathAccessRule ;
    sfcfg:hasLocalPathBase <https://semantic-flow.github.io/sflo/config/localPathBase_meshRoot> ;
    sfcfg:pathPrefix "../source/" ;
    sfcfg:hasLocalPathLocatorKind <https://semantic-flow.github.io/sflo/config/localPathLocatorKind_workingLocalRelativePath>
  ] .
`,
  );

  const previousHome = Deno.env.get("HOME");
  Deno.env.set("HOME", homeRoot);
  try {
    const policy = await loadOperationalLocalPathPolicy(publishRoot);
    await assertRejects(
      () =>
        resolveRepositorySourceFloatingLocalPath(policy, {
          repositoryUrl: "https://github.com/semantic-flow/sflo.git",
          repositoryPathFromRoot: "semantic-flow-core-ontology.ttl",
        }),
      LocalPathAccessError,
      "did not match an allowed local checkout",
    );
  } finally {
    if (previousHome === undefined) {
      Deno.env.delete("HOME");
    } else {
      Deno.env.set("HOME", previousHome);
    }
  }
});

Deno.test("resolveRepositorySourceFloatingLocalPath prefers granted source checkout over publication checkout", async () => {
  const tempRoot = await Deno.makeTempDir({
    prefix: "weave-repo-floating-policy-same-remote-",
  });
  const sourceRoot = join(tempRoot, "source");
  const publishRoot = join(tempRoot, "gh-pages");
  const homeRoot = join(tempRoot, "home");
  const settingsRoot = join(tempRoot, "settings");
  await Deno.mkdir(sourceRoot, { recursive: true });
  await Deno.mkdir(publishRoot, { recursive: true });
  await Deno.mkdir(homeRoot, { recursive: true });
  await writeMeshMetadata(publishRoot);
  for (const root of [sourceRoot, publishRoot]) {
    await runGit(root, ["init"]);
    await runGit(root, [
      "remote",
      "add",
      "origin",
      "https://github.com/semantic-flow/sflo.git",
    ]);
  }
  await Deno.writeTextFile(
    join(sourceRoot, "semantic-flow-core-ontology.ttl"),
    "# source branch file\n",
  );
  await writeSettingsAccessGrant(settingsRoot, sourceRoot);

  await withEnv({ HOME: homeRoot, WEAVE_SETTINGS: settingsRoot }, async () => {
    const policy = await loadOperationalLocalPathPolicy(publishRoot);
    assertEquals(
      await resolveRepositorySourceFloatingLocalPath(policy, {
        repositoryUrl: "https://github.com/semantic-flow/sflo.git",
        repositoryPathFromRoot: "semantic-flow-core-ontology.ttl",
      }),
      join(sourceRoot, "semantic-flow-core-ontology.ttl"),
    );
  });
});

Deno.test("ensureHostLocalWorkingDirectoryAccessRule creates a machine-local source grant", async () => {
  const tempRoot = await Deno.makeTempDir({
    prefix: "weave-local-path-host-grant-",
  });
  const sourceRoot = join(tempRoot, "source");
  const publishRoot = join(tempRoot, "publication");
  const homeRoot = join(tempRoot, "home");
  const settingsRoot = join(tempRoot, "settings");
  await Deno.mkdir(sourceRoot, { recursive: true });
  await Deno.mkdir(publishRoot, { recursive: true });
  await Deno.mkdir(homeRoot, { recursive: true });
  await writeMeshMetadata(publishRoot);

  await withEnv({ HOME: homeRoot, WEAVE_SETTINGS: settingsRoot }, async () => {
    const deniedPolicy = await loadOperationalLocalPathPolicy(publishRoot);
    const result = await ensureHostLocalWorkingDirectoryAccessRule(
      deniedPolicy,
      sourceRoot,
    );

    assertEquals(result.updated, true);
    assertEquals(
      result.configPath,
      join(settingsRoot, "meshes/mesh-1190756e677d/access.ttl"),
    );
    const config = await Deno.readTextFile(result.configPath);
    assertEquals(
      config.includes("weave:HostLocalAccessProfile"),
      true,
    );
    assertEquals(
      config.includes(`weave:allowsLocalPathBase "${sourceRoot}/"`),
      true,
    );
    const settings = await Deno.readTextFile(
      join(settingsRoot, "settings.ttl"),
    );
    assertEquals(settings.includes("weave:UserSettings"), true);

    const grantedPolicy = await loadOperationalLocalPathPolicy(publishRoot);
    assertEquals(
      resolveAllowedLocalPath(
        grantedPolicy,
        "workingLocalRelativePath",
        "../source/current.ttl",
      ),
      join(sourceRoot, "current.ttl"),
    );
  });
});

async function writeMeshMetadata(
  meshRoot: string,
  meshBase = TEST_MESH_BASE,
): Promise<void> {
  await Deno.mkdir(join(meshRoot, "_mesh/_meta"), { recursive: true });
  await Deno.writeTextFile(
    join(meshRoot, "_mesh/_meta/meta.ttl"),
    `@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<_mesh> sflo:meshBase "${meshBase}"^^xsd:anyURI .
`,
  );
}

async function writeSettingsAccessGrant(
  settingsRoot: string,
  allowedPathRoot: string,
): Promise<void> {
  const paths = await resolveUserSettingsPaths(TEST_MESH_BASE, {
    env: {
      WEAVE_SETTINGS: settingsRoot,
      HOME: "/tmp/weave-test-home",
    },
  });
  await Deno.mkdir(dirname(paths.meshSettings.accessProfilePath), {
    recursive: true,
  });
  await Deno.writeTextFile(paths.settingsPath, renderUserSettingsTurtle(paths));
  await Deno.writeTextFile(
    paths.meshSettings.accessProfilePath,
    renderHostLocalAccessProfileTurtle([`${allowedPathRoot}/`]),
  );
}

async function withEnv<T>(
  env: Record<string, string | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = new Map<string, string | undefined>();
  for (const name of Object.keys(env)) {
    previous.set(name, Deno.env.get(name));
    const value = env[name];
    if (value === undefined) {
      Deno.env.delete(name);
    } else {
      Deno.env.set(name, value);
    }
  }

  try {
    return await fn();
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) {
        Deno.env.delete(name);
      } else {
        Deno.env.set(name, value);
      }
    }
  }
}

async function runGit(cwd: string, args: readonly string[]): Promise<void> {
  const command = new Deno.Command("git", {
    args: [...args],
    cwd,
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  if (!output.success) {
    throw new Error(new TextDecoder().decode(output.stderr));
  }
}
