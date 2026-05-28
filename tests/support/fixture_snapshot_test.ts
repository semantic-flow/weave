import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { FixtureSnapshotCache } from "./fixture_snapshot.ts";
import { createTestTmpDir } from "./test_tmp.ts";

Deno.test("FixtureSnapshotCache materializes a resolved Git ref once and reuses the snapshot", async () => {
  const repoRoot = await createTestTmpDir("weave-fixture-snapshot-repo-");
  await git(repoRoot, "init", "--initial-branch=main");
  await Deno.mkdir(join(repoRoot, "nested"), { recursive: true });
  await Deno.writeTextFile(join(repoRoot, "alpha.txt"), "alpha\n");
  await Deno.writeTextFile(join(repoRoot, "nested/beta.txt"), "beta\n");
  await git(repoRoot, "add", ".");
  await git(
    repoRoot,
    "-c",
    "user.name=Weave Test",
    "-c",
    "user.email=weave@example.test",
    "commit",
    "-m",
    "fixture",
  );

  const cache = new FixtureSnapshotCache({
    label: `fixture-snapshot-test-${crypto.randomUUID()}`,
    repoPath: repoRoot,
    candidatesForRef: (ref) => [ref],
  });

  const firstTarget = await createTestTmpDir("weave-fixture-snapshot-first-");
  assertEquals(await cache.materialize("main", firstTarget), [
    "alpha.txt",
    "nested/beta.txt",
  ]);
  assertEquals(
    await Deno.readTextFile(join(firstTarget, "alpha.txt")),
    "alpha\n",
  );
  assertEquals(
    await cache.readTextFile("main", "nested/beta.txt"),
    "beta\n",
  );

  await Deno.remove(repoRoot, { recursive: true });

  const secondTarget = await createTestTmpDir("weave-fixture-snapshot-second-");
  assertEquals(await cache.materialize("main", secondTarget), [
    "alpha.txt",
    "nested/beta.txt",
  ]);
  assertEquals(
    await Deno.readTextFile(join(secondTarget, "nested/beta.txt")),
    "beta\n",
  );
});

Deno.test("FixtureSnapshotCache reads cached refs from the resolved commit", async () => {
  const repoRoot = await createTestTmpDir("weave-fixture-snapshot-ref-move-");
  await git(repoRoot, "init", "--initial-branch=main");
  await Deno.writeTextFile(join(repoRoot, "alpha.txt"), "alpha\n");
  await git(repoRoot, "add", ".");
  await git(
    repoRoot,
    "-c",
    "user.name=Weave Test",
    "-c",
    "user.email=weave@example.test",
    "commit",
    "-m",
    "first fixture",
  );

  const cache = new FixtureSnapshotCache({
    label: `fixture-snapshot-ref-move-${crypto.randomUUID()}`,
    repoPath: repoRoot,
    candidatesForRef: (ref) => [ref],
  });
  await cache.resolveCommit("main");

  await Deno.writeTextFile(join(repoRoot, "alpha.txt"), "beta\n");
  await git(repoRoot, "add", ".");
  await git(
    repoRoot,
    "-c",
    "user.name=Weave Test",
    "-c",
    "user.email=weave@example.test",
    "commit",
    "-m",
    "second fixture",
  );

  const target = await createTestTmpDir("weave-fixture-snapshot-ref-target-");
  await cache.materialize("main", target);
  assertEquals(await Deno.readTextFile(join(target, "alpha.txt")), "alpha\n");
});

async function git(cwd: string, ...args: string[]): Promise<void> {
  const output = await new Deno.Command("git", {
    args,
    cwd,
    stdout: "piped",
    stderr: "piped",
  }).output();

  if (!output.success) {
    throw new Error(
      [
        `git ${args.join(" ")} failed`,
        new TextDecoder().decode(output.stdout).trim(),
        new TextDecoder().decode(output.stderr).trim(),
      ].filter(Boolean).join("\n"),
    );
  }
}
