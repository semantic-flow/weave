import { assert, assertEquals, assertRejects } from "@std/assert";
import { join, relative, toFileUrl } from "@std/path";
import { compareRdfContent } from "../../dependencies/github.com/spectacular-voyage/accord/src/checker/compare_rdf.ts";
import {
  getManifestFileExpectations,
  readSingleTransitionCase,
} from "../support/accord_manifest.ts";
import {
  listMeshAliceBioBranchFiles,
  materializeMeshAliceBioBranch,
  readMeshAliceBioBranchFile,
  resolveMeshAliceBioConformanceManifestPath,
} from "../support/mesh_alice_bio_fixture.ts";
import {
  ROOT_PAYLOAD_TURTLE,
  ROOT_WORKING_FILE_PATH,
} from "../support/root_designator.ts";
import { createTestTmpDir } from "../support/test_tmp.ts";

const repoRoot = new URL("../../", import.meta.url);
const cliPath = new URL("src/main.ts", repoRoot).pathname;

Deno.test("weave integrate matches the manifest-scoped alice-bio integrated fixture as a black-box CLI run", async () => {
  const manifestPath = resolveMeshAliceBioConformanceManifestPath(
    "06-alice-bio-integrated.jsonld",
  );
  const transitionCase = await readSingleTransitionCase(manifestPath);
  assertEquals(transitionCase.operationId, "integrate");
  assertEquals(transitionCase.fromRef, "05-alice-knop-created-woven");
  assertEquals(transitionCase.toRef, "06-alice-bio-integrated");

  const workspaceRoot = await createTestTmpDir("weave-e2e-integrate-");
  await materializeMeshAliceBioBranch(transitionCase.fromRef!, workspaceRoot);

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      cliPath,
      "integrate",
      "alice-bio.ttl",
      "--designator-path",
      "alice/bio",
    ],
    cwd: toFileUrl(`${workspaceRoot}/`),
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assert(stdout.includes("Integrated"), stdout);

  assertEquals(
    await listRelativeFiles(workspaceRoot, ".weave/"),
    await listMeshAliceBioBranchFiles(transitionCase.toRef!),
  );

  const fileExpectations = getManifestFileExpectations(transitionCase);
  for (const fileExpectation of fileExpectations) {
    const path = fileExpectation.path;
    if (!path) {
      continue;
    }

    if (fileExpectation.changeType === "absent") {
      await assertPathAbsent(join(workspaceRoot, path));
      continue;
    }

    const compareMode = fileExpectation.compareMode;

    if (compareMode === undefined) {
      await Deno.stat(join(workspaceRoot, path));
      continue;
    }

    const actualBytes = await Deno.readFile(join(workspaceRoot, path));
    const expectedBytes = new TextEncoder().encode(
      await readMeshAliceBioBranchFile(transitionCase.toRef!, path),
    );

    if (compareMode === "rdfCanonical") {
      assertEquals(
        await compareRdfContent({
          left: actualBytes,
          right: expectedBytes,
          path,
        }),
        true,
      );
      continue;
    }

    if (compareMode === "text") {
      assertEquals(
        new TextDecoder().decode(actualBytes),
        new TextDecoder().decode(expectedBytes),
      );
      continue;
    }

    if (compareMode === "bytes") {
      assertEquals(actualBytes, expectedBytes);
      continue;
    }

    throw new Error(`Unsupported compare mode ${compareMode} for ${path}`);
  }

  await Deno.stat(join(workspaceRoot, ".weave/logs/operational.jsonl"));
  await Deno.stat(join(workspaceRoot, ".weave/logs/security-audit.jsonl"));
});

Deno.test("weave integrate rejects conflicting designator paths before logging or execution", async () => {
  const workspaceRoot = await createTestTmpDir("weave-e2e-integrate-conflict-");
  await materializeMeshAliceBioBranch(
    "05-alice-knop-created-woven",
    workspaceRoot,
  );

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      cliPath,
      "integrate",
      "alice-bio.ttl",
      "alice/bio",
      "--designator-path",
      "bob/bio",
    ],
    cwd: toFileUrl(`${workspaceRoot}/`),
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const stderr = new TextDecoder().decode(output.stderr);

  assertEquals(output.success, false);
  assert(
    stderr.includes("integrate received conflicting designator paths"),
    stderr,
  );
  await assertRejects(
    () => Deno.stat(join(workspaceRoot, ".weave/logs/security-audit.jsonl")),
    Deno.errors.NotFound,
  );
  await assertPathAbsent(
    join(workspaceRoot, "alice/bio/_knop/_inventory/inventory.ttl"),
  );
});

Deno.test("weave integrate accepts the root designator path as a black-box CLI run", async () => {
  const workspaceRoot = await createTestTmpDir("weave-e2e-integrate-root-");
  await materializeMeshAliceBioBranch(
    "05-alice-knop-created-woven",
    workspaceRoot,
  );
  await Deno.writeTextFile(
    join(workspaceRoot, ROOT_WORKING_FILE_PATH),
    ROOT_PAYLOAD_TURTLE,
  );

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      cliPath,
      "integrate",
      ROOT_WORKING_FILE_PATH,
      "--designator-path",
      "/",
    ],
    cwd: toFileUrl(`${workspaceRoot}/`),
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assert(stdout.includes("Integrated"), stdout);
  await Deno.stat(join(workspaceRoot, "_knop/_meta/meta.ttl"));
  await Deno.stat(join(workspaceRoot, "_knop/_inventory/inventory.ttl"));
});

Deno.test("weave integrate allows repo-adjacent local sources when repo policy permits them as a black-box CLI run", async () => {
  const tempRepoRoot = await createTestTmpDir("weave-e2e-integrate-policy-");
  const workspaceRoot = join(tempRepoRoot, "mesh");
  await materializeMeshAliceBioBranch(
    "05-alice-knop-created-woven",
    workspaceRoot,
  );
  await Deno.mkdir(join(tempRepoRoot, "documentation"), { recursive: true });
  await Deno.mkdir(join(workspaceRoot, "_mesh/_config"), { recursive: true });
  await Deno.writeTextFile(
    join(workspaceRoot, "_mesh/_config/config.ttl"),
    `@prefix sfcfg: <https://semantic-flow.github.io/ontology/config/> .

<> a sfcfg:MeshConfig ;
  sfcfg:workspaceRootRelativeToMeshRoot "../" ;
  sfcfg:hasLocalPathAccessRule [
    a sfcfg:LocalPathAccessRule ;
    sfcfg:hasLocalPathBase <https://semantic-flow.github.io/ontology/config/meshRootPathBase> ;
    sfcfg:pathPrefix "../documentation/" ;
    sfcfg:hasLocalPathLocatorKind <https://semantic-flow.github.io/ontology/config/workingLocalRelativePathLocatorKind>
  ] .
`,
  );
  await Deno.writeTextFile(
    join(tempRepoRoot, "documentation/alice-bio.ttl"),
    await readMeshAliceBioBranchFile(
      "05-alice-knop-created-woven",
      "alice-bio.ttl",
    ),
  );

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      cliPath,
      "integrate",
      "documentation/alice-bio.ttl",
      "--designator-path",
      "alice/bio",
      "--mesh-root",
      "mesh",
    ],
    cwd: toFileUrl(`${tempRepoRoot}/`),
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  assert(output.success, stderr);
  assert(stdout.includes("Integrated"), stdout);
  const createdInventory = await Deno.readTextFile(
    join(workspaceRoot, "alice/bio/_knop/_inventory/inventory.ttl"),
  );
  assert(
    createdInventory.includes(
      'sflo:workingLocalRelativePath "../documentation/alice-bio.ttl" .',
    ),
    createdInventory,
  );
  assertEquals(
    createdInventory.includes(
      "sflo:hasWorkingLocatedFile <../documentation/alice-bio.ttl> .",
    ),
    false,
  );
});

Deno.test("weave integrate requires a designator path before logging or execution", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-e2e-integrate-missing-designator-",
  );
  await materializeMeshAliceBioBranch(
    "05-alice-knop-created-woven",
    workspaceRoot,
  );

  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      cliPath,
      "integrate",
      "alice-bio.ttl",
    ],
    cwd: toFileUrl(`${workspaceRoot}/`),
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const stderr = new TextDecoder().decode(output.stderr);

  assertEquals(output.success, false);
  assert(
    stderr.includes(
      "integrate requires a designator path as [designatorPath] or --designator-path",
    ),
    stderr,
  );
  await assertRejects(
    () => Deno.stat(join(workspaceRoot, ".weave/logs/security-audit.jsonl")),
    Deno.errors.NotFound,
  );
  await assertPathAbsent(
    join(workspaceRoot, "alice/bio/_knop/_inventory/inventory.ttl"),
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

async function assertPathAbsent(path: string): Promise<void> {
  await assertRejects(
    () => Deno.stat(path),
    Deno.errors.NotFound,
  );
}
