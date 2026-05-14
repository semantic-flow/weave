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
