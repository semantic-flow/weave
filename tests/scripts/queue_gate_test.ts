// Hermetic by constraint, not by habit: every test builds a temp-dir fixture
// tree (its own dendron.yml, fixture vaults in both layouts, a fixture queue
// file) and calls the exported library functions with that root. No test reads
// the repo's real dendron.yml, dependencies/, or wd.queues.md — CI runs these
// tests in a checkout where most of the real vaults do not exist.

import {
  assert,
  assertEquals,
  assertMatch,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import { fromFileUrl, join } from "@std/path";
import { createTestTmpDir } from "../support/test_tmp.ts";
import {
  addEntry,
  checkQueue,
  GateRefusal,
  GateUsage,
  GROOM_DUTIES,
  groomed,
  initQueue,
  MAX_COMMENT_LENGTH,
  POP_OBLIGATIONS,
  popEntry,
  QUEUE_NOTE_PATH,
  SECTION_HEADINGS,
  sectionsPresent,
  STATE_FILE_NAME,
  vaultNoteDirs,
  wake,
} from "../../scripts/queue-gate.ts";

const KIM_HEADING = SECTION_HEADINGS[0];
const JIMBO_HEADING = SECTION_HEADINGS[1];

const FIXTURE_DENDRON_YML = `version: 5
workspace:
    vaults:
        - fsPath: dependencies/fixture/archive
          name: archive
          selfContained: true
        - fsPath: dependencies/fixture/rootnotes
          name: rootnotes
        - fsPath: documentation
          selfContained: true
          name: weave
`;

async function makeFixtureRepo(): Promise<string> {
  const root = await createTestTmpDir("queue-gate-fixture-");
  await Deno.writeTextFile(join(root, "dendron.yml"), FIXTURE_DENDRON_YML);
  const archiveNotes = join(root, "dependencies/fixture/archive/notes");
  const rootNotes = join(root, "dependencies/fixture/rootnotes");
  const docNotes = join(root, "documentation/notes");
  for (const dir of [archiveNotes, rootNotes, docNotes]) {
    await Deno.mkdir(dir, { recursive: true });
  }
  // selfContained vault layout (notes/ subdir):
  await Deno.writeTextFile(
    join(archiveNotes, "wa.task.2026.2026-01-01-alpha.md"),
    "fixture note alpha\n",
  );
  await Deno.writeTextFile(
    join(archiveNotes, "wa.task.2026.2026-01-01-beta.md"),
    "fixture note beta\n",
  );
  // renamed sibling: the wa.task.* name does not exist, only wa.completed.*:
  await Deno.writeTextFile(
    join(archiveNotes, "wa.completed.2026.2026-01-02-gamma.md"),
    "fixture note gamma, renamed by Dave\n",
  );
  // root-layout vault (notes at the vault fsPath itself):
  await Deno.writeTextFile(
    join(rootNotes, "ont.task.2026-01-03-delta.md"),
    "fixture root-layout task note\n",
  );
  return root;
}

async function makeInitializedRepo(): Promise<string> {
  const root = await makeFixtureRepo();
  initQueue(root, {
    now: new Date("2026-01-05T12:00:00Z"),
    id: "testfixtureid0000000000",
  });
  return root;
}

function queuePath(root: string): string {
  return join(root, QUEUE_NOTE_PATH);
}

Deno.test("vaultNoteDirs resolves both vault layouts from dendron.yml", async () => {
  const root = await makeFixtureRepo();
  const dirs = vaultNoteDirs(root);
  assertEquals(dirs, [
    join(root, "dependencies/fixture/archive", "notes"),
    join(root, "dependencies/fixture/rootnotes"),
    join(root, "documentation", "notes"),
  ]);
});

Deno.test("init mints the skeleton with both headings and check passes", async () => {
  const root = await makeFixtureRepo();
  initQueue(root);
  const text = await Deno.readTextFile(queuePath(root));
  assertEquals(sectionsPresent(text), [...SECTION_HEADINGS]);
  assertStringIncludes(text, "SURFACES, not seats");
  const result = checkQueue(root);
  assertEquals(result.entryCount, 0);
  assertEquals(result.reports, []);
});

Deno.test("init refuses when the queue file already exists", async () => {
  const root = await makeInitializedRepo();
  const error = assertThrows(() => initQueue(root), GateRefusal);
  assertStringIncludes(error.message, "already exists");
});

Deno.test("a missing queue file refuses naming init, never an ENOENT crash", async () => {
  const root = await makeFixtureRepo();
  for (
    const op of [
      () =>
        addEntry(root, "wa.task.2026.2026-01-01-alpha", "kim", "first slice"),
      () => popEntry(root, "wa.task.2026.2026-01-01-alpha"),
      () => checkQueue(root),
      () => wake(root),
      () => groomed(root, "queues"),
    ]
  ) {
    const error = assertThrows(op, GateRefusal);
    assertStringIncludes(error.message, "init");
  }
});

Deno.test("a re-punctuated heading is a refusal, not a smaller scan", async () => {
  const root = await makeInitializedRepo();
  const text = await Deno.readTextFile(queuePath(root));
  // Em-dash heading degraded to a hyphen — the classic re-punctuation.
  await Deno.writeTextFile(
    queuePath(root),
    text.replace(KIM_HEADING, "## Kim - implementation"),
  );
  const error = assertThrows(() => checkQueue(root), GateRefusal);
  assertStringIncludes(error.message, "## Kim - implementation");
});

Deno.test("both sections renamed is a refusal", async () => {
  const root = await makeInitializedRepo();
  const text = await Deno.readTextFile(queuePath(root));
  await Deno.writeTextFile(
    queuePath(root),
    text
      .replace(KIM_HEADING, "## Implementation")
      .replace(JIMBO_HEADING, "## Planning"),
  );
  assertThrows(() => checkQueue(root), GateRefusal);
});

Deno.test("the vacuous pass is real: an entry under an unrecognised heading is never scanned, so the heading itself refuses", async () => {
  const root = await makeInitializedRepo();
  const text = await Deno.readTextFile(queuePath(root));
  // A contract-violating entry hidden under an unrecognised heading would be
  // invisible to a heading-tolerant scanner; the gate refuses the heading.
  await Deno.writeTextFile(
    queuePath(root),
    `${text}\n## Dave\n\n1. [[wa.task.2026.2026-01-01-alpha]] — landed at 100% in deadbee1\n`,
  );
  const error = assertThrows(() => checkQueue(root), GateRefusal);
  assertStringIncludes(error.message, '"## Dave"');
  assertStringIncludes(error.message, "never be scanned");
});

Deno.test("add refuses a SHA, with the reason in the refusal", async () => {
  const root = await makeInitializedRepo();
  const error = assertThrows(
    () =>
      addEntry(
        root,
        "wa.task.2026.2026-01-01-alpha",
        "kim",
        "fixed in deadbee1",
      ),
    GateRefusal,
  );
  assertStringIncludes(error.message, "SHA-like");
});

Deno.test("add refuses status words, exercising completed specifically", async () => {
  const root = await makeInitializedRepo();
  for (const comment of ["first slice completed", "landed yesterday"]) {
    const error = assertThrows(
      () => addEntry(root, "wa.task.2026.2026-01-01-alpha", "kim", comment),
      GateRefusal,
    );
    assertStringIncludes(error.message, "status word");
  }
  // Word-boundary sanity: "incomplete" is not a completion claim.
  addEntry(
    root,
    "wa.task.2026.2026-01-01-alpha",
    "kim",
    "incomplete extractor coverage",
  );
});

Deno.test("add refuses a percentage", async () => {
  const root = await makeInitializedRepo();
  const error = assertThrows(
    () =>
      addEntry(root, "wa.task.2026.2026-01-01-alpha", "kim", "about 80% done"),
    GateRefusal,
  );
  assertStringIncludes(error.message, "percentage");
});

Deno.test("add refuses an over-length comment", async () => {
  const root = await makeInitializedRepo();
  const long = "why-next ".repeat(20);
  assert(long.length > MAX_COMMENT_LENGTH);
  const error = assertThrows(
    () => addEntry(root, "wa.task.2026.2026-01-01-alpha", "kim", long),
    GateRefusal,
  );
  assertStringIncludes(error.message, String(MAX_COMMENT_LENGTH));
});

Deno.test("add refuses a pointer to a nonexistent note", async () => {
  const root = await makeInitializedRepo();
  const error = assertThrows(
    () => addEntry(root, "wa.task.2026.2026-09-09-ghost", "kim", "first slice"),
    GateRefusal,
  );
  assertStringIncludes(error.message, "does not resolve");
});

Deno.test("add refuses a task that resolves only as its completed sibling", async () => {
  const root = await makeInitializedRepo();
  const error = assertThrows(
    () => addEntry(root, "wa.task.2026.2026-01-02-gamma", "kim", "next slice"),
    GateRefusal,
  );
  assertStringIncludes(error.message, "wa.completed.2026.2026-01-02-gamma");
});

Deno.test("add resolves notes in both vault layouts", async () => {
  const root = await makeInitializedRepo();
  addEntry(root, "wa.task.2026.2026-01-01-alpha", "kim", "selfContained vault");
  addEntry(root, "ont.task.2026-01-03-delta", "jimbo", "root-layout vault");
  const result = checkQueue(root);
  assertEquals(result.entryCount, 2);
});

Deno.test("add refuses path-shaped and non-task note names", async () => {
  const root = await makeInitializedRepo();
  // A path-shaped name must never be joined onto a vault directory.
  await Deno.writeTextFile(join(root, "README.md"), "repo readme\n");
  const escape = assertThrows(
    () => addEntry(root, "../../README", "kim", "path escape attempt"),
    GateRefusal,
  );
  assertStringIncludes(escape.message, "not a plain dendron note name");
  // A resolvable note that is not a task note stays out of the queue.
  const nonTask = assertThrows(
    () => addEntry(root, "wd.queues", "jimbo", "self-referential grooming"),
    GateRefusal,
  );
  assertStringIncludes(nonTask.message, "not a task note");
});

Deno.test("add refuses empty and multiline comments before writing", async () => {
  const root = await makeInitializedRepo();
  const empty = assertThrows(
    () => addEntry(root, "wa.task.2026.2026-01-01-alpha", "kim", "   "),
    GateRefusal,
  );
  assertStringIncludes(empty.message, "empty comment");
  const multiline = assertThrows(
    () =>
      addEntry(root, "wa.task.2026.2026-01-01-alpha", "kim", "first\nsecond"),
    GateRefusal,
  );
  assertStringIncludes(multiline.message, "line break");
  // The gate never wrote a malformed line: the queue still checks green.
  assertEquals(checkQueue(root).entryCount, 0);
});

Deno.test("SHA scan: all-letter long hex and full-length hashes refused, hex-alphabet words admitted", async () => {
  const root = await makeInitializedRepo();
  for (
    const comment of [
      "vanity hash deadbeef",
      `pinned to ${"0123456789abcdef".repeat(4)}`,
      "roughly 80 percent remains",
    ]
  ) {
    assertThrows(
      () => addEntry(root, "wa.task.2026.2026-01-01-alpha", "kim", comment),
      GateRefusal,
    );
  }
  addEntry(
    root,
    "wa.task.2026.2026-01-01-alpha",
    "kim",
    "defaced fixture pages need regeneration",
  );
});

Deno.test("cross-section duplicates are allowed, same-section duplicates refused", async () => {
  const root = await makeInitializedRepo();
  addEntry(root, "wa.task.2026.2026-01-01-alpha", "kim", "fireable Kim slice");
  addEntry(root, "wa.task.2026.2026-01-01-alpha", "jimbo", "grooming slice");
  assertEquals(checkQueue(root).entryCount, 2);
  const error = assertThrows(
    () => addEntry(root, "wa.task.2026.2026-01-01-alpha", "kim", "again"),
    GateRefusal,
  );
  assertStringIncludes(error.message, "already in");
});

Deno.test("check reports, not refuses, a target renamed to wa.completed.*", async () => {
  const root = await makeInitializedRepo();
  addEntry(root, "wa.task.2026.2026-01-01-alpha", "kim", "first slice");
  // Dave renames asynchronously: the admitted target disappears, the
  // completed sibling appears.
  const text = await Deno.readTextFile(queuePath(root));
  await Deno.writeTextFile(
    queuePath(root),
    text.replace(
      "wa.task.2026.2026-01-01-alpha",
      "wa.task.2026.2026-01-02-gamma",
    ),
  );
  const result = checkQueue(root);
  assertEquals(result.reports.length, 1);
  assertMatch(
    result.reports[0],
    /renamed to \[\[wa\.completed\.2026\.2026-01-02-gamma\]\]/,
  );
});

Deno.test("check refuses a target with no resolution and no renamed sibling", async () => {
  const root = await makeInitializedRepo();
  addEntry(root, "wa.task.2026.2026-01-01-alpha", "kim", "first slice");
  const text = await Deno.readTextFile(queuePath(root));
  await Deno.writeTextFile(
    queuePath(root),
    text.replace(
      "wa.task.2026.2026-01-01-alpha",
      "wa.task.2026.2026-09-09-ghost",
    ),
  );
  assertThrows(() => checkQueue(root), GateRefusal);
});

Deno.test("blocker lines are reported on every check, not refused", async () => {
  const root = await makeInitializedRepo();
  addEntry(
    root,
    "wa.task.2026.2026-01-01-alpha",
    "jimbo",
    "waits on Dave ruling",
  );
  const result = checkQueue(root);
  assertEquals(result.entryCount, 1);
  assertEquals(result.reports.length, 1);
  assertStringIncludes(result.reports[0], "is it still true");
});

Deno.test("check validates contiguous numbering after a hand reorder", async () => {
  const root = await makeInitializedRepo();
  addEntry(root, "wa.task.2026.2026-01-01-alpha", "kim", "first");
  addEntry(root, "wa.task.2026.2026-01-01-beta", "kim", "second");
  const text = await Deno.readTextFile(queuePath(root));
  await Deno.writeTextFile(
    queuePath(root),
    text.replace(
      "2. [[wa.task.2026.2026-01-01-beta]]",
      "3. [[wa.task.2026.2026-01-01-beta]]",
    ),
  );
  const error = assertThrows(() => checkQueue(root), GateRefusal);
  assertStringIncludes(error.message, "not contiguous");
});

Deno.test("a malformed entry line is a refusal pointing at the task note", async () => {
  const root = await makeInitializedRepo();
  const text = await Deno.readTextFile(queuePath(root));
  await Deno.writeTextFile(
    queuePath(root),
    text.replace(KIM_HEADING, `${KIM_HEADING}\n\nfree prose about progress`),
  );
  const error = assertThrows(() => checkQueue(root), GateRefusal);
  assertStringIncludes(error.message, "belongs in the task note");
});

Deno.test("pop refuses an item that is not present", async () => {
  const root = await makeInitializedRepo();
  const error = assertThrows(
    () => popEntry(root, "wa.task.2026.2026-01-01-alpha"),
    GateRefusal,
  );
  assertStringIncludes(error.message, "nothing to pop");
});

Deno.test("pop prints the owed obligations and renumbers the section", async () => {
  const root = await makeInitializedRepo();
  addEntry(root, "wa.task.2026.2026-01-01-alpha", "kim", "first");
  addEntry(root, "wa.task.2026.2026-01-01-beta", "kim", "second");
  const owed = popEntry(root, "wa.task.2026.2026-01-01-alpha");
  assertEquals(owed, POP_OBLIGATIONS);
  assertStringIncludes(owed, "flip the [[wd.todo]] checkbox");
  assertStringIncludes(owed, "wrong command");
  const text = await Deno.readTextFile(queuePath(root));
  assertStringIncludes(text, "1. [[wa.task.2026.2026-01-01-beta]] — second");
  assertEquals(checkQueue(root).entryCount, 1);
});

Deno.test("pop with the note in both sections refuses without a section, pops the named slice with one", async () => {
  const root = await makeInitializedRepo();
  addEntry(root, "wa.task.2026.2026-01-01-alpha", "kim", "fireable Kim slice");
  addEntry(root, "wa.task.2026.2026-01-01-alpha", "jimbo", "grooming slice");
  const error = assertThrows(
    () => popEntry(root, "wa.task.2026.2026-01-01-alpha"),
    GateRefusal,
  );
  assertStringIncludes(error.message, "pop the slice, not the task");
  popEntry(root, "wa.task.2026.2026-01-01-alpha", "kim");
  const text = await Deno.readTextFile(queuePath(root));
  assertStringIncludes(text, "grooming slice");
  assert(!text.includes("fireable Kim slice"));
});

Deno.test("wake prints the prior stamp and unmet floors, then rotates", async () => {
  const root = await makeInitializedRepo();
  const first = wake(root, new Date("2026-01-05T08:00:00Z"));
  assertEquals(first.previousWake, null);
  assertEquals(first.unmetDuties, [...GROOM_DUTIES]);
  const second = wake(root, new Date("2026-01-05T09:00:00Z"));
  assertEquals(second.previousWake, "2026-01-05T08:00:00.000Z");
});

Deno.test("groomed stamps a duty so the floor is met for the day, and unmet again the next day", async () => {
  const root = await makeInitializedRepo();
  const day1 = new Date("2026-01-05T10:00:00Z");
  groomed(root, "queues", day1);
  const sameDay = wake(root, new Date("2026-01-05T11:00:00Z"));
  assert(!sameDay.unmetDuties.includes("queues"));
  assert(sameDay.unmetDuties.includes("court"));
  const nextDay = wake(root, new Date("2026-01-06T08:00:00Z"));
  assert(nextDay.unmetDuties.includes("queues"));
});

Deno.test("groomed refuses an unknown duty as usage, naming the duties", async () => {
  const root = await makeInitializedRepo();
  const error = assertThrows(() => groomed(root, "vibes"), GateUsage);
  assertStringIncludes(error.message, GROOM_DUTIES.join(", "));
});

Deno.test("a corrupt state file is a refusal, not silent amnesia", async () => {
  const root = await makeInitializedRepo();
  await Deno.writeTextFile(join(root, STATE_FILE_NAME), "{not json");
  const error = assertThrows(() => wake(root), GateRefusal);
  assertStringIncludes(error.message, STATE_FILE_NAME);
});

Deno.test("importing the module has no side effects (import.meta.main guard)", async () => {
  const root = await createTestTmpDir("queue-gate-import-");
  const gatePath = new URL("../../scripts/queue-gate.ts", import.meta.url);
  const configPath = new URL("../../deno.json", import.meta.url);
  const probe = join(root, "probe.ts");
  await Deno.writeTextFile(
    probe,
    `import "${gatePath.href}";\nconsole.log("imported-ok");\n`,
  );
  // No --allow-write: any import-time filesystem write would fail loudly.
  const command = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--quiet",
      "--no-lock",
      `--config=${fromFileUrl(configPath)}`,
      "--allow-read",
      probe,
    ],
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);
  assertEquals(output.code, 0, `import probe failed: ${stderr}`);
  assertStringIncludes(stdout, "imported-ok");
});
