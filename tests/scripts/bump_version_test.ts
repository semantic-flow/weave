import {
  assertEquals,
  assertRejects,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import {
  bumpVersion,
  parseBumpVersionArgs,
} from "../../scripts/bump-version.ts";
import { join } from "@std/path";

Deno.test("parseBumpVersionArgs accepts explicit versions and root overrides", () => {
  assertEquals(
    parseBumpVersionArgs(["--", "--root", "/tmp/weave", "--version", "1.2.3"]),
    {
      root: "/tmp/weave",
      version: "1.2.3",
      increment: undefined,
    },
  );
});

Deno.test("parseBumpVersionArgs rejects missing or ambiguous bump modes", () => {
  assertThrows(
    () => parseBumpVersionArgs([]),
    Error,
    "requires exactly one",
  );
  assertThrows(
    () => parseBumpVersionArgs(["--patch", "--minor"]),
    Error,
    "only one increment",
  );
});

Deno.test("bumpVersion applies patch, minor, and major increments", async () => {
  const patchRoot = await createReleaseRoot("0.1.0");
  const patch = await bumpVersion({
    root: patchRoot,
    increment: "patch",
    releaseNoteId: "testpatch",
    timestamp: 1,
  });
  assertEquals(patch.nextVersion, "0.1.1");
  assertEquals(await readRootVersion(patchRoot), "0.1.1");

  const minorRoot = await createReleaseRoot("0.1.0");
  const minor = await bumpVersion({
    root: minorRoot,
    increment: "minor",
    releaseNoteId: "testminor",
    timestamp: 1,
  });
  assertEquals(minor.nextVersion, "0.2.0");
  assertEquals(await readRootVersion(minorRoot), "0.2.0");

  const majorRoot = await createReleaseRoot("0.1.0");
  const major = await bumpVersion({
    root: majorRoot,
    increment: "major",
    releaseNoteId: "testmajor",
    timestamp: 1,
  });
  assertEquals(major.nextVersion, "1.0.0");
  assertEquals(await readRootVersion(majorRoot), "1.0.0");
});

Deno.test("bumpVersion sets an explicit version and creates release notes", async () => {
  const root = await createReleaseRoot("0.1.0");

  const result = await bumpVersion({
    root,
    version: "0.2.0",
    releaseNoteId: "testrelease",
    timestamp: 123,
  });

  assertEquals(result.previousVersion, "0.1.0");
  assertEquals(result.nextVersion, "0.2.0");
  assertEquals(result.releaseNotesCreated, true);
  assertEquals(await readRootVersion(root), "0.2.0");

  const releaseNotes = await Deno.readTextFile(result.releaseNotesPath);
  assertStringIncludes(releaseNotes, "id: testrelease");
  assertStringIncludes(releaseNotes, "title: 'release notes v0.2.0'");
  assertStringIncludes(releaseNotes, "## Summary");
  assertStringIncludes(releaseNotes, "TODO: summarize v0.2.0.");
});

Deno.test("bumpVersion verifies existing non-empty release notes without overwriting them", async () => {
  const root = await createReleaseRoot("0.1.0");
  const notesPath = join(
    root,
    "documentation",
    "notes",
    "release-notes.v0.1.1.md",
  );
  await Deno.writeTextFile(
    notesPath,
    `---
id: existing
title: 'release notes v0.1.1'
desc: ''
---

## Summary

Human-written notes.
`,
  );

  const result = await bumpVersion({
    root,
    increment: "patch",
    releaseNoteId: "unused",
    timestamp: 1,
  });

  assertEquals(result.releaseNotesCreated, false);
  assertEquals(
    await Deno.readTextFile(notesPath),
    `---
id: existing
title: 'release notes v0.1.1'
desc: ''
---

## Summary

Human-written notes.
`,
  );
});

Deno.test("bumpVersion rejects existing empty release notes", async () => {
  const root = await createReleaseRoot("0.1.0");
  await Deno.writeTextFile(
    join(root, "documentation", "notes", "release-notes.v0.1.1.md"),
    `---
id: empty
title: 'release notes v0.1.1'
desc: ''
---
`,
  );

  await assertRejects(
    () => bumpVersion({ root, increment: "patch" }),
    Error,
    "Release notes body is empty",
  );
});

async function createReleaseRoot(version: string): Promise<string> {
  const root = await Deno.makeTempDir({ prefix: "weave-bump-version-" });
  await Deno.writeTextFile(
    join(root, "deno.json"),
    `${JSON.stringify({ version, tasks: {} }, null, 2)}\n`,
  );
  await Deno.mkdir(join(root, "documentation", "notes"), { recursive: true });
  return root;
}

async function readRootVersion(root: string): Promise<unknown> {
  const denoConfig = JSON.parse(
    await Deno.readTextFile(join(root, "deno.json")),
  ) as { version?: unknown };
  return denoConfig.version;
}
