import { assert, assertEquals, assertRejects } from "@std/assert";
import { join, relative } from "@std/path";
import {
  executeGHPagesDeployBootstrap,
  GHPagesDeployInputError,
} from "../../src/runtime/deploy/gh_pages.ts";
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
