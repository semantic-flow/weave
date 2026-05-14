import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
import { join, relative } from "@std/path";
import {
  describeGHPagesDeployBootstrapPlan,
  executeGHPagesDeployBootstrap,
  GHPagesDeployInputError,
  GHPagesDeployRuntimeError,
  planGHPagesDeployBootstrap,
} from "../../src/runtime/deploy/gh_pages.ts";
import {
  loadOperationalLocalPathPolicy,
  LocalPathAccessError,
  resolveAllowedLocalPath,
} from "../../src/runtime/operational/local_path_policy.ts";
import { createTestTmpDir } from "../support/test_tmp.ts";

Deno.test("executeGHPagesDeployBootstrap keeps source clean and bootstraps publication root", async () => {
  const tempRoot = await createTestTmpDir("weave-deploy-gh-pages-");
  const sourceRoot = join(tempRoot, "source");
  const publishRoot = join(tempRoot, "gh-pages");
  await Deno.mkdir(join(sourceRoot, "ontology"), { recursive: true });
  await Deno.mkdir(join(sourceRoot, "shacl"), { recursive: true });
  await Deno.mkdir(publishRoot, { recursive: true });
  await Deno.writeTextFile(
    join(sourceRoot, "ontology/fantasy-rules-ontology.ttl"),
    "# source ontology stays on the source branch\n",
  );
  await Deno.writeTextFile(
    join(sourceRoot, "shacl/fantasy-rules-shacl.ttl"),
    "# source shapes stay on the source branch\n",
  );

  const firstResult = await executeGHPagesDeployBootstrap({
    sourceRoot,
    publishRoot,
    request: {
      meshBase: "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
    },
  });
  const secondResult = await executeGHPagesDeployBootstrap({
    sourceRoot,
    publishRoot,
    request: {
      meshBase: "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
    },
  });

  assertEquals(
    await listRelativeFiles(sourceRoot, ".weave/"),
    [
      "ontology/fantasy-rules-ontology.ttl",
      "shacl/fantasy-rules-shacl.ttl",
    ],
  );
  assertEquals(
    [...firstResult.createdPaths].sort(),
    [
      ".nojekyll",
      "_mesh/_config/config.ttl",
      "_mesh/_inventory/inventory.ttl",
      "_mesh/_meta/meta.ttl",
    ],
  );
  assertEquals(secondResult.createdPaths, []);
  assertEquals(
    await listRelativeFiles(publishRoot, ".weave/"),
    [
      ".nojekyll",
      "_mesh/_config/config.ttl",
      "_mesh/_inventory/inventory.ttl",
      "_mesh/_meta/meta.ttl",
    ],
  );

  const config = await Deno.readTextFile(
    join(publishRoot, "_mesh/_config/config.ttl"),
  );
  assert(config.includes("<> a sfcfg:MeshConfig ."), config);
  assert(!config.includes("workspaceRootRelativeToMeshRoot"), config);
  assert(!config.includes(sourceRoot), config);
  assert(!config.includes(publishRoot), config);
  assert(!config.includes("../"), config);
});

Deno.test("executeGHPagesDeployBootstrap preserves publication controls", async () => {
  const tempRoot = await createTestTmpDir(
    "weave-deploy-gh-pages-controls-",
  );
  const sourceRoot = join(tempRoot, "source");
  const publishRoot = join(tempRoot, "gh-pages");
  await Deno.mkdir(sourceRoot, { recursive: true });
  await Deno.mkdir(publishRoot, { recursive: true });
  await Deno.writeTextFile(join(publishRoot, "CNAME"), "rules.example.test\n");

  const firstResult = await executeGHPagesDeployBootstrap({
    sourceRoot,
    publishRoot,
    request: {
      meshBase: "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
    },
  });
  assert(firstResult.createdPaths.includes(".nojekyll"));
  assert(!firstResult.createdPaths.includes("CNAME"));
  assertEquals(
    await Deno.readTextFile(join(publishRoot, "CNAME")),
    "rules.example.test\n",
  );

  await Deno.remove(join(publishRoot, ".nojekyll"));
  const secondResult = await executeGHPagesDeployBootstrap({
    sourceRoot,
    publishRoot,
    request: {
      meshBase: "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
      cname: "rules.example.test",
    },
  });
  assertEquals(secondResult.createdPaths, [".nojekyll"]);
  assertEquals(secondResult.updatedPaths, []);

  const thirdResult = await executeGHPagesDeployBootstrap({
    sourceRoot,
    publishRoot,
    request: {
      meshBase: "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
      cname: "docs.example.test",
    },
  });
  assertEquals(thirdResult.createdPaths, []);
  assertEquals(thirdResult.updatedPaths, ["CNAME"]);
  assertEquals(
    await Deno.readTextFile(join(publishRoot, "CNAME")),
    "docs.example.test\n",
  );
});

Deno.test("planGHPagesDeployBootstrap reports dry-run changes without writing", async () => {
  const tempRoot = await createTestTmpDir("weave-deploy-gh-pages-plan-");
  const sourceRoot = join(tempRoot, "source");
  const publishRoot = join(tempRoot, "gh-pages");
  const sourcePath = "ontology/fantasy-rules-ontology.ttl";
  const source = `@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix fantasy: <https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/ontology/> .

<> a owl:Ontology .
fantasy:Rule a owl:Class .
`;

  await Deno.mkdir(join(sourceRoot, "ontology"), { recursive: true });
  await Deno.mkdir(publishRoot, { recursive: true });
  await Deno.writeTextFile(join(sourceRoot, sourcePath), source);
  await Deno.writeTextFile(join(publishRoot, "CNAME"), "rules.example.test\n");
  await Deno.writeTextFile(join(publishRoot, "manual.txt"), "keep me\n");

  const plan = await planGHPagesDeployBootstrap({
    sourceRoot,
    publishRoot,
    request: {
      meshBase: "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
      source: {
        sourcePath,
        designatorPath: "ontology",
        sourceRepositoryUrl:
          "https://github.com/semantic-flow/mesh-sidecar-fantasy-rules.git",
        sourceRepositoryRef: "main",
        sourceRepositoryCommit: "abc123",
      },
    },
  });

  assert(plan.createdPaths.includes(".nojekyll"));
  assert(plan.createdPaths.includes("_mesh/_config/config.ttl"));
  assert(plan.createdPaths.includes(sourcePath));
  assert(plan.createdPaths.includes("ontology/index.html"));
  assert(plan.preservedPaths.includes("CNAME"));
  assert(plan.preservedPaths.includes("manual.txt"));
  assert(plan.materializedSource);
  assertEquals(plan.materializedSource.digest, await sha256Digest(source));
  assertEquals(
    await listRelativeFiles(publishRoot, ".weave/"),
    ["CNAME", "manual.txt"],
  );

  const description = describeGHPagesDeployBootstrapPlan(plan);
  assert(description.includes("Dry run: branch-published GitHub Pages deploy"));
  assert(description.includes("Created paths:"));
  assert(description.includes("Preserved paths:"));
  assert(description.includes("Git operations:"));
  assert(description.includes("will not commit or push"), description);
});

Deno.test("executeGHPagesDeployBootstrap materializes repository source without local path leakage", async () => {
  const tempRoot = await createTestTmpDir("weave-deploy-gh-pages-source-");
  const sourceRoot = join(tempRoot, "source");
  const publishRoot = join(tempRoot, "gh-pages");
  const sourcePath = "ontology/fantasy-rules-ontology.ttl";
  const sourceV1 = `@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix fantasy: <https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/ontology/> .

<> a owl:Ontology .
fantasy:Rule a owl:Class .
`;
  const sourceV2 = `@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix fantasy: <https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/ontology/> .

<> a owl:Ontology .
fantasy:RuleSystem a owl:Class .
`;
  await Deno.mkdir(join(sourceRoot, "ontology"), { recursive: true });
  await Deno.mkdir(publishRoot, { recursive: true });
  await Deno.writeTextFile(join(sourceRoot, sourcePath), sourceV1);

  const firstResult = await executeGHPagesDeployBootstrap({
    sourceRoot,
    publishRoot,
    request: {
      meshBase: "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
      source: {
        sourcePath,
        designatorPath: "ontology",
        sourceRepositoryUrl:
          "https://github.com/semantic-flow/mesh-sidecar-fantasy-rules.git",
        sourceRepositoryRef: "main",
        sourceRepositoryCommit: "abc123",
      },
    },
  });
  const firstMaterialized = firstResult.materializedSource;
  assert(firstMaterialized);
  assert(firstMaterialized.createdPaths.includes(sourcePath));
  assert(firstMaterialized.createdPaths.includes("ontology/index.html"));
  assertEquals(
    await Deno.readTextFile(join(publishRoot, sourcePath)),
    sourceV1,
  );

  const firstDigest = await sha256Digest(sourceV1);
  const firstConfig = await Deno.readTextFile(
    join(publishRoot, "_mesh/_config/config.ttl"),
  );
  const firstInventory = await Deno.readTextFile(
    join(publishRoot, "ontology/_knop/_inventory/inventory.ttl"),
  );
  assert(firstConfig.includes("sflo:RepositorySourceLocator"), firstConfig);
  assert(firstConfig.includes("sflo:hasTargetRepositorySource"), firstConfig);
  assert(firstConfig.includes('sflo:sourceRepositoryRef "main"'), firstConfig);
  assert(
    firstConfig.includes('sflo:sourceRepositoryCommit "abc123"'),
    firstConfig,
  );
  assert(
    firstConfig.includes(`sflo:sourceRepositoryPath "${sourcePath}"`),
    firstConfig,
  );
  assert(firstConfig.includes(`sflo:hasContentDigest "${firstDigest}"`));
  assert(
    firstInventory.includes(`sflo:hasWorkingLocatedFile <${sourcePath}>`),
    firstInventory,
  );
  assert(
    !firstInventory.includes("_mesh/_inventory/_history001"),
    firstInventory,
  );
  assert(
    !firstInventory.includes("ontology/_knop/_meta/_history001"),
    firstInventory,
  );
  assert(
    !firstInventory.includes("ontology/_knop/_inventory/_history001"),
    firstInventory,
  );
  await assertRejects(
    () => Deno.stat(join(publishRoot, "_mesh/_inventory/_history001")),
    Deno.errors.NotFound,
  );
  await assertRejects(
    () => Deno.stat(join(publishRoot, "ontology/_knop/_meta/_history001")),
    Deno.errors.NotFound,
  );
  await assertRejects(
    () => Deno.stat(join(publishRoot, "ontology/_knop/_inventory/_history001")),
    Deno.errors.NotFound,
  );
  assertNoLocalPathLeak(firstConfig, sourceRoot, publishRoot);
  assertNoLocalPathLeak(firstInventory, sourceRoot, publishRoot);
  assert(!firstConfig.includes("workingLocalRelativePath"), firstConfig);
  assert(!firstInventory.includes("workingLocalRelativePath"), firstInventory);
  assertEquals(await listRelativeFiles(sourceRoot, ".weave/"), [sourcePath]);

  const secondResult = await executeGHPagesDeployBootstrap({
    sourceRoot,
    publishRoot,
    request: {
      meshBase: "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
      source: {
        sourcePath,
        designatorPath: "ontology",
        sourceRepositoryUrl:
          "https://github.com/semantic-flow/mesh-sidecar-fantasy-rules.git",
        sourceRepositoryRef: "main",
        sourceRepositoryCommit: "abc123",
      },
    },
  });
  assert(secondResult.materializedSource);
  assertEquals(secondResult.materializedSource.createdPaths, []);
  assertEquals(secondResult.materializedSource.updatedPaths, []);
  assertEquals(secondResult.updatedPaths, []);

  await Deno.writeTextFile(join(sourceRoot, sourcePath), sourceV2);
  const thirdResult = await executeGHPagesDeployBootstrap({
    sourceRoot,
    publishRoot,
    request: {
      meshBase: "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
      source: {
        sourcePath,
        designatorPath: "ontology",
        sourceRepositoryUrl:
          "https://github.com/semantic-flow/mesh-sidecar-fantasy-rules.git",
        sourceRepositoryRef: "main",
        sourceRepositoryCommit: "def456",
      },
    },
  });
  const thirdMaterialized = thirdResult.materializedSource;
  assert(thirdMaterialized);
  assert(thirdMaterialized.updatedPaths.includes(sourcePath));
  assert(thirdMaterialized.updatedPaths.includes("_mesh/_config/config.ttl"));
  assertEquals(
    await Deno.readTextFile(join(publishRoot, sourcePath)),
    sourceV2,
  );

  const secondDigest = await sha256Digest(sourceV2);
  const updatedConfig = await Deno.readTextFile(
    join(publishRoot, "_mesh/_config/config.ttl"),
  );
  const updatedInventory = await Deno.readTextFile(
    join(publishRoot, "ontology/_knop/_inventory/inventory.ttl"),
  );
  assert(
    updatedConfig.includes('sflo:sourceRepositoryCommit "def456"'),
    updatedConfig,
  );
  assert(updatedConfig.includes(`sflo:hasContentDigest "${secondDigest}"`));
  assert(!updatedConfig.includes(firstDigest), updatedConfig);
  assert(
    !updatedInventory.includes("_mesh/_inventory/_history001"),
    updatedInventory,
  );
  assert(
    !updatedInventory.includes("ontology/_knop/_meta/_history001"),
    updatedInventory,
  );
  assert(
    !updatedInventory.includes("ontology/_knop/_inventory/_history001"),
    updatedInventory,
  );
  await assertRejects(
    () => Deno.stat(join(publishRoot, "_mesh/_inventory/_history001")),
    Deno.errors.NotFound,
  );
  await assertRejects(
    () => Deno.stat(join(publishRoot, "ontology/_knop/_meta/_history001")),
    Deno.errors.NotFound,
  );
  await assertRejects(
    () => Deno.stat(join(publishRoot, "ontology/_knop/_inventory/_history001")),
    Deno.errors.NotFound,
  );
  assertNoLocalPathLeak(updatedConfig, sourceRoot, publishRoot);
  assertNoLocalPathLeak(updatedInventory, sourceRoot, publishRoot);
  assertEquals(await listRelativeFiles(sourceRoot, ".weave/"), [sourcePath]);
});

Deno.test("executeGHPagesDeployBootstrap updates publication roots incrementally by default", async () => {
  const tempRoot = await createTestTmpDir(
    "weave-deploy-gh-pages-incremental-",
  );
  const sourceRoot = join(tempRoot, "source");
  const publishRoot = join(tempRoot, "gh-pages");
  const sourcePath = "ontology/fantasy-rules-ontology.ttl";
  const sourceV1 = `@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix fantasy: <https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/ontology/> .

<> a owl:Ontology .
fantasy:Rule a owl:Class .
`;
  const sourceV2 = `@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix fantasy: <https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/ontology/> .

<> a owl:Ontology .
fantasy:RuleSystem a owl:Class .
`;

  await Deno.mkdir(join(sourceRoot, "ontology"), { recursive: true });
  await Deno.mkdir(publishRoot, { recursive: true });
  await Deno.writeTextFile(join(sourceRoot, sourcePath), sourceV1);
  await Deno.writeTextFile(join(publishRoot, "manual.txt"), "keep me\n");
  await Deno.writeTextFile(join(publishRoot, "CNAME"), "rules.example.test\n");
  await runGit(publishRoot, ["init"]);
  await runGit(publishRoot, ["config", "user.email", "weave@example.invalid"]);
  await runGit(publishRoot, ["config", "user.name", "Weave Test"]);
  await runGit(publishRoot, ["add", "-A"]);
  await runGit(publishRoot, ["commit", "-m", "initial publication controls"]);

  await executeGHPagesDeployBootstrap({
    sourceRoot,
    publishRoot,
    request: {
      meshBase: "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
      source: {
        sourcePath,
        designatorPath: "ontology",
        sourceRepositoryUrl:
          "https://github.com/semantic-flow/mesh-sidecar-fantasy-rules.git",
        sourceRepositoryRef: "main",
        sourceRepositoryCommit: "source-v1",
      },
    },
  });
  const firstFiles = await listRelativeFiles(publishRoot, ".git/");
  const firstMeshMetadata = await Deno.readTextFile(
    join(publishRoot, "_mesh/_meta/meta.ttl"),
  );
  const firstDigest = await sha256Digest(sourceV1);

  await runGit(publishRoot, ["add", "-A"]);
  await runGit(publishRoot, ["commit", "-m", "publish v1"]);
  await Deno.writeTextFile(join(sourceRoot, sourcePath), sourceV2);

  const secondResult = await executeGHPagesDeployBootstrap({
    sourceRoot,
    publishRoot,
    request: {
      meshBase: "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
      source: {
        sourcePath,
        designatorPath: "ontology",
        sourceRepositoryUrl:
          "https://github.com/semantic-flow/mesh-sidecar-fantasy-rules.git",
        sourceRepositoryRef: "main",
        sourceRepositoryCommit: "source-v2",
      },
    },
  });
  const secondMaterialized = secondResult.materializedSource;
  assert(secondMaterialized);

  assertEquals(secondResult.createdPaths, []);
  assert(
    secondMaterialized.createdPaths.every((path) =>
      path.startsWith("ontology/_history001/_s0002/")
    ),
    secondMaterialized.createdPaths.join("\n"),
  );
  assert(secondMaterialized.updatedPaths.includes(sourcePath));
  assert(secondMaterialized.updatedPaths.includes("_mesh/_config/config.ttl"));
  const secondFiles = await listRelativeFiles(publishRoot, ".git/");
  for (const path of firstFiles) {
    assert(secondFiles.includes(path), `missing preserved path: ${path}`);
  }
  assertEquals(
    await Deno.readTextFile(join(publishRoot, "manual.txt")),
    "keep me\n",
  );
  assertEquals(
    await Deno.readTextFile(join(publishRoot, "CNAME")),
    "rules.example.test\n",
  );
  assertEquals(
    await Deno.readTextFile(join(publishRoot, "_mesh/_meta/meta.ttl")),
    firstMeshMetadata,
  );

  const updatedConfig = await Deno.readTextFile(
    join(publishRoot, "_mesh/_config/config.ttl"),
  );
  const updatedDigest = await sha256Digest(sourceV2);
  assert(updatedConfig.includes('sflo:sourceRepositoryCommit "source-v2"'));
  assert(updatedConfig.includes(`sflo:hasContentDigest "${updatedDigest}"`));
  assert(!updatedConfig.includes(firstDigest), updatedConfig);

  const status = await gitOutput(publishRoot, ["status", "--short"]);
  const statusLines = status.split("\n").filter((line) => line.length > 0);
  assert(
    statusLines.every((line) =>
      !line.startsWith(" D") && !line.startsWith("D ")
    ),
    status,
  );
  assertEquals(
    statusLines.filter((line) => line.startsWith("??")),
    ["?? ontology/_history001/_s0002/"],
  );
});

Deno.test("executeGHPagesDeployBootstrap keeps cross-worktree source access command-scoped", async () => {
  const tempRoot = await createTestTmpDir("weave-deploy-gh-pages-policy-");
  const sourceRoot = join(tempRoot, "source");
  const publishRoot = join(tempRoot, "gh-pages");
  const sourcePath = "ontology/fantasy-rules-ontology.ttl";
  const source = `@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix fantasy: <https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/ontology/> .

<> a owl:Ontology .
fantasy:Rule a owl:Class .
`;

  await Deno.mkdir(join(sourceRoot, "ontology"), { recursive: true });
  await Deno.mkdir(publishRoot, { recursive: true });
  await Deno.writeTextFile(join(sourceRoot, sourcePath), source);

  await executeGHPagesDeployBootstrap({
    sourceRoot,
    publishRoot,
    request: {
      meshBase: "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
      source: {
        sourcePath,
        designatorPath: "ontology",
        sourceRepositoryUrl:
          "https://github.com/semantic-flow/mesh-sidecar-fantasy-rules.git",
        sourceRepositoryRef: "main",
      },
    },
  });

  const policy = await loadOperationalLocalPathPolicy(publishRoot);
  const relativeSourcePath = relative(
    publishRoot,
    join(sourceRoot, sourcePath),
  ).replaceAll("\\", "/");
  const config = await Deno.readTextFile(
    join(publishRoot, "_mesh/_config/config.ttl"),
  );

  assertEquals(policy.workspaceRoot, publishRoot);
  assertEquals(policy.rules.length, 0);
  assert(!config.includes("workspaceRootRelativeToMeshRoot"), config);
  assert(!config.includes("hasLocalPathAccessRule"), config);
  assert(!config.includes("workingLocalRelativePath"), config);
  assertThrows(
    () =>
      resolveAllowedLocalPath(
        policy,
        "workingLocalRelativePath",
        relativeSourcePath,
      ),
    LocalPathAccessError,
    "outside the mesh root",
  );
});

Deno.test("executeGHPagesDeployBootstrap rejects source paths that escape the source root", async () => {
  const tempRoot = await createTestTmpDir("weave-deploy-gh-pages-path-escape-");
  const sourceRoot = join(tempRoot, "source");
  const publishRoot = join(tempRoot, "gh-pages");
  await Deno.mkdir(sourceRoot, { recursive: true });
  await Deno.mkdir(publishRoot, { recursive: true });

  await assertRejects(
    () =>
      executeGHPagesDeployBootstrap({
        sourceRoot,
        publishRoot,
        request: {
          meshBase:
            "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
          source: {
            sourcePath: "../outside.ttl",
            designatorPath: "ontology",
            sourceRepositoryUrl:
              "https://github.com/semantic-flow/mesh-sidecar-fantasy-rules.git",
            sourceRepositoryRef: "main",
          },
        },
      }),
    GHPagesDeployInputError,
    "sourcePath must stay inside the repository root",
  );
});

Deno.test("executeGHPagesDeployBootstrap materializes from a source branch into a gh-pages worktree", async () => {
  const tempRoot = await createTestTmpDir("weave-deploy-gh-pages-git-");
  const sourceRoot = join(tempRoot, "fantasy-rules");
  const publishRoot = join(tempRoot, "fantasy-rules-gh-pages");
  const sourcePath = "ontology/fantasy-rules-ontology.ttl";
  const sourceV1 = `@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix fantasy: <https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/ontology/> .

<> a owl:Ontology .
fantasy:Rule a owl:Class .
`;
  const sourceV2 = `@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix fantasy: <https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/ontology/> .

<> a owl:Ontology .
fantasy:RuleSystem a owl:Class .
`;

  await Deno.mkdir(join(sourceRoot, "ontology"), { recursive: true });
  await runGit(sourceRoot, ["init"]);
  await runGit(sourceRoot, ["checkout", "-b", "main"]);
  await runGit(sourceRoot, ["config", "user.email", "weave@example.invalid"]);
  await runGit(sourceRoot, ["config", "user.name", "Weave Test"]);
  await Deno.writeTextFile(join(sourceRoot, sourcePath), sourceV1);
  await runGit(sourceRoot, ["add", sourcePath]);
  await runGit(sourceRoot, ["commit", "-m", "source v1"]);
  const sourceCommitV1 = await gitOutput(sourceRoot, ["rev-parse", "HEAD"]);

  await runGit(sourceRoot, [
    "worktree",
    "add",
    "--detach",
    publishRoot,
    "HEAD",
  ]);
  await runGit(publishRoot, ["checkout", "--orphan", "gh-pages"]);
  await runGit(publishRoot, ["rm", "-rf", "."]);
  await runGit(publishRoot, [
    "config",
    "user.email",
    "weave@example.invalid",
  ]);
  await runGit(publishRoot, ["config", "user.name", "Weave Test"]);

  await executeGHPagesDeployBootstrap({
    sourceRoot,
    publishRoot,
    request: {
      meshBase: "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
      source: {
        sourcePath,
        designatorPath: "ontology",
        sourceRepositoryUrl:
          "https://github.com/semantic-flow/mesh-sidecar-fantasy-rules.git",
        sourceRepositoryRef: "main",
        sourceRepositoryCommit: sourceCommitV1,
      },
    },
  });

  assertEquals(await gitOutput(sourceRoot, ["status", "--short"]), "");
  await assertPathMissing(join(sourceRoot, "_mesh"));
  await assertPathMissing(join(sourceRoot, ".weave"));
  await assertPathMissing(join(sourceRoot, "docs"));
  const initialPublishStatus = await gitOutput(publishRoot, [
    "status",
    "--short",
  ]);
  assert(initialPublishStatus.includes("?? _mesh/"), initialPublishStatus);
  assert(initialPublishStatus.includes("?? ontology/"), initialPublishStatus);

  await runGit(publishRoot, ["add", "-A"]);
  await runGit(publishRoot, ["commit", "-m", "publish v1"]);
  assertEquals(await gitOutput(publishRoot, ["status", "--short"]), "");

  await Deno.writeTextFile(join(sourceRoot, sourcePath), sourceV2);
  await runGit(sourceRoot, ["add", sourcePath]);
  await runGit(sourceRoot, ["commit", "-m", "source v2"]);
  const sourceCommitV2 = await gitOutput(sourceRoot, ["rev-parse", "HEAD"]);

  await executeGHPagesDeployBootstrap({
    sourceRoot,
    publishRoot,
    request: {
      meshBase: "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
      source: {
        sourcePath,
        designatorPath: "ontology",
        sourceRepositoryUrl:
          "https://github.com/semantic-flow/mesh-sidecar-fantasy-rules.git",
        sourceRepositoryRef: "main",
        sourceRepositoryCommit: sourceCommitV2,
      },
    },
  });

  assertEquals(await gitOutput(sourceRoot, ["status", "--short"]), "");
  const updatedPublishStatus = await gitOutput(publishRoot, [
    "status",
    "--short",
  ]);
  assert(
    updatedPublishStatus.includes("_mesh/_config/config.ttl"),
    updatedPublishStatus,
  );
  assert(
    updatedPublishStatus.includes(sourcePath),
    updatedPublishStatus,
  );

  const updatedConfig = await Deno.readTextFile(
    join(publishRoot, "_mesh/_config/config.ttl"),
  );
  const updatedInventory = await Deno.readTextFile(
    join(publishRoot, "ontology/_knop/_inventory/inventory.ttl"),
  );
  assert(
    updatedConfig.includes(`sflo:sourceRepositoryCommit "${sourceCommitV2}"`),
    updatedConfig,
  );
  assertNoLocalPathLeak(updatedConfig, sourceRoot, publishRoot);
  assertNoLocalPathLeak(updatedInventory, sourceRoot, publishRoot);
  assert(
    !updatedInventory.includes("ontology/_knop/_inventory/_history001"),
    updatedInventory,
  );
  await assertPathMissing(
    join(publishRoot, "ontology/_knop/_inventory/_history001"),
  );
});

Deno.test("executeGHPagesDeployBootstrap creates explicit local publication commits", async () => {
  const tempRoot = await createTestTmpDir("weave-deploy-gh-pages-commit-");
  const sourceRoot = join(tempRoot, "source");
  const publishRoot = join(tempRoot, "gh-pages");
  await Deno.mkdir(sourceRoot, { recursive: true });
  await Deno.mkdir(publishRoot, { recursive: true });
  await runGit(publishRoot, ["init"]);
  await runGit(publishRoot, ["config", "user.email", "weave@example.invalid"]);
  await runGit(publishRoot, ["config", "user.name", "Weave Test"]);
  await runGit(publishRoot, ["commit", "--allow-empty", "-m", "initial"]);

  const firstResult = await executeGHPagesDeployBootstrap({
    sourceRoot,
    publishRoot,
    request: {
      meshBase: "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
    },
    commit: {
      message: "publish mesh",
    },
  });

  assert(firstResult.localCommit?.status === "created");
  assertEquals(firstResult.localCommit.message, "publish mesh");
  assert(
    firstResult.localCommit.pushReminder.includes(
      "Push the publication branch",
    ),
    firstResult.localCommit.pushReminder,
  );
  assertEquals(await gitOutput(publishRoot, ["status", "--short"]), "");
  assertEquals(
    await gitOutput(publishRoot, ["log", "-1", "--pretty=%s"]),
    "publish mesh",
  );
  const committedHead = await gitOutput(publishRoot, ["rev-parse", "HEAD"]);

  const secondResult = await executeGHPagesDeployBootstrap({
    sourceRoot,
    publishRoot,
    request: {
      meshBase: "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
    },
    commit: {
      message: "publish mesh again",
    },
  });

  assert(secondResult.localCommit?.status === "skipped");
  assertEquals(
    secondResult.localCommit.reason,
    "publication worktree has no changes",
  );
  assertEquals(await gitOutput(publishRoot, ["status", "--short"]), "");
  assertEquals(
    await gitOutput(publishRoot, ["rev-parse", "HEAD"]),
    committedHead,
  );
});

Deno.test("executeGHPagesDeployBootstrap rejects local commits with dirty-root mode", async () => {
  const tempRoot = await createTestTmpDir(
    "weave-deploy-gh-pages-commit-dirty-",
  );
  const sourceRoot = join(tempRoot, "source");
  const publishRoot = join(tempRoot, "gh-pages");
  await Deno.mkdir(sourceRoot, { recursive: true });
  await Deno.mkdir(publishRoot, { recursive: true });
  await runGit(publishRoot, ["init"]);
  await runGit(publishRoot, ["config", "user.email", "weave@example.invalid"]);
  await runGit(publishRoot, ["config", "user.name", "Weave Test"]);
  await runGit(publishRoot, ["commit", "--allow-empty", "-m", "initial"]);

  await assertRejects(
    () =>
      executeGHPagesDeployBootstrap({
        sourceRoot,
        publishRoot,
        allowDirtyPublicationRoot: true,
        request: {
          meshBase:
            "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
        },
        commit: {},
      }),
    GHPagesDeployInputError,
    "--commit cannot be combined with --allow-dirty-publish-root",
  );
});

Deno.test("executeGHPagesDeployBootstrap rejects dirty publication worktrees by default", async () => {
  const tempRoot = await createTestTmpDir("weave-deploy-gh-pages-dirty-");
  const sourceRoot = join(tempRoot, "source");
  const publishRoot = join(tempRoot, "gh-pages");
  await Deno.mkdir(sourceRoot, { recursive: true });
  await Deno.mkdir(publishRoot, { recursive: true });
  await runGit(publishRoot, ["init"]);
  await runGit(publishRoot, ["config", "user.email", "weave@example.invalid"]);
  await runGit(publishRoot, ["config", "user.name", "Weave Test"]);
  await runGit(publishRoot, ["commit", "--allow-empty", "-m", "initial"]);
  await Deno.writeTextFile(join(publishRoot, "manual.txt"), "keep me\n");

  await assertRejects(
    () =>
      executeGHPagesDeployBootstrap({
        sourceRoot,
        publishRoot,
        request: {
          meshBase:
            "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
        },
      }),
    GHPagesDeployInputError,
    "publication root has uncommitted or untracked changes",
  );

  const result = await executeGHPagesDeployBootstrap({
    sourceRoot,
    publishRoot,
    allowDirtyPublicationRoot: true,
    request: {
      meshBase: "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
    },
  });

  assert(result.createdPaths.includes("_mesh/_config/config.ttl"));
  assertEquals(
    await Deno.readTextFile(join(publishRoot, "manual.txt")),
    "keep me\n",
  );
});

Deno.test("executeGHPagesDeployBootstrap rejects stale publication clutter", async () => {
  const stalePaths = [".weave/logs/operational.jsonl", "docs/_mesh/index.html"];

  for (const stalePath of stalePaths) {
    const tempRoot = await createTestTmpDir("weave-deploy-gh-pages-stale-");
    const sourceRoot = join(tempRoot, "source");
    const publishRoot = join(tempRoot, "gh-pages");
    await Deno.mkdir(sourceRoot, { recursive: true });
    await Deno.mkdir(join(publishRoot, relativeDirname(stalePath)), {
      recursive: true,
    });
    await Deno.writeTextFile(join(publishRoot, stalePath), "stale\n");

    await assertRejects(
      () =>
        executeGHPagesDeployBootstrap({
          sourceRoot,
          publishRoot,
          request: {
            meshBase:
              "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
          },
        }),
      GHPagesDeployRuntimeError,
      "stale branch-published output or local operational state",
    );
  }
});

Deno.test("executeGHPagesDeployBootstrap rejects local path leakage in generated RDF", async () => {
  const tempRoot = await createTestTmpDir("weave-deploy-gh-pages-leak-");
  const sourceRoot = join(tempRoot, "source");
  const publishRoot = join(tempRoot, "gh-pages");
  await Deno.mkdir(sourceRoot, { recursive: true });
  await Deno.mkdir(publishRoot, { recursive: true });

  await executeGHPagesDeployBootstrap({
    sourceRoot,
    publishRoot,
    request: {
      meshBase: "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
    },
  });
  const configPath = join(publishRoot, "_mesh/_config/config.ttl");
  await Deno.writeTextFile(
    configPath,
    `${await Deno.readTextFile(configPath)}
<#leak> <https://semantic-flow.github.io/sflo/ontology/sourceRepositoryPath> "${
      sourceRoot.replaceAll("\\", "\\\\")
    }/ontology/source.ttl" .
`,
  );

  await assertRejects(
    () =>
      executeGHPagesDeployBootstrap({
        sourceRoot,
        publishRoot,
        request: {
          meshBase:
            "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
        },
      }),
    GHPagesDeployRuntimeError,
    "contains a local source root path",
  );
});

Deno.test("executeGHPagesDeployBootstrap rejects overlapping roots", async () => {
  const tempRoot = await createTestTmpDir("weave-deploy-gh-pages-overlap-");
  const sourceRoot = join(tempRoot, "source");
  await Deno.mkdir(sourceRoot, { recursive: true });

  await assertRejects(
    () =>
      executeGHPagesDeployBootstrap({
        sourceRoot,
        publishRoot: sourceRoot,
        request: {
          meshBase:
            "https://semantic-flow.github.io/mesh-sidecar-fantasy-rules/",
        },
      }),
    GHPagesDeployInputError,
    "source root and publication root must be different",
  );
});

function assertNoLocalPathLeak(
  contents: string,
  sourceRoot: string,
  publishRoot: string,
): void {
  assert(!contents.includes(sourceRoot), contents);
  assert(!contents.includes(publishRoot), contents);
  assert(!contents.includes("../"), contents);
}

async function sha256Digest(contents: string): Promise<string> {
  const bytes = new TextEncoder().encode(contents);
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
}

async function assertPathMissing(path: string): Promise<void> {
  await assertRejects(
    () => Deno.stat(path),
    Deno.errors.NotFound,
  );
}

function relativeDirname(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? "." : path.slice(0, index);
}

async function runGit(cwd: string, args: readonly string[]): Promise<void> {
  const output = await new Deno.Command("git", {
    cwd,
    args: [...args],
  }).output();
  if (!output.success) {
    throw new Error(
      `git ${args.join(" ")} failed:\n${
        new TextDecoder().decode(output.stderr)
      }`,
    );
  }
}

async function gitOutput(
  cwd: string,
  args: readonly string[],
): Promise<string> {
  const output = await new Deno.Command("git", {
    cwd,
    args: [...args],
  }).output();
  if (!output.success) {
    throw new Error(
      `git ${args.join(" ")} failed:\n${
        new TextDecoder().decode(output.stderr)
      }`,
    );
  }
  return new TextDecoder().decode(output.stdout).trim();
}

async function listRelativeFiles(
  root: string,
  excludedPrefix: string,
): Promise<string[]> {
  const paths: string[] = [];

  for await (const entry of walkFiles(root)) {
    const rel = relative(root, entry).replaceAll("\\", "/");
    if (rel.startsWith(excludedPrefix)) {
      continue;
    }
    paths.push(rel);
  }

  return paths.sort();
}

async function* walkFiles(root: string): AsyncGenerator<string> {
  for await (const entry of Deno.readDir(root)) {
    const path = join(root, entry.name);
    if (entry.isDirectory) {
      yield* walkFiles(path);
      continue;
    }
    if (entry.isFile) {
      yield path;
    }
  }
}
