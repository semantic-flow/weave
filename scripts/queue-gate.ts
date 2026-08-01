// Queue gate for the planning-loop READY slice (documentation/notes/wd.queues.md).
//
// The queue contract is a tool, not prose: the pointers-only rule "was written
// in prose and violated twelve times by its own author within the hour, so it
// is a tool now" (ported from stagecraft-lab tools/queue-gate.mjs). Adds, pops,
// and checks refuse instead of drifting. See
// wa.task.2026.2026-07-31_1014-planning-loop-infrastructure in the
// weave-dev-archive vault for the governing contract, and wd.read-in.jimbo for
// the loop that runs it.
//
// Library-first: exported functions take a rootDir so tests run against
// temp-dir fixture trees (CI checkouts are missing most vaults). The thin CLI
// under `import.meta.main` resolves the repo root from `import.meta.url`;
// `deno task queue` is the supported entry point because `deno task` pins cwd
// to the repo root, keeping the task's relative --allow-* paths valid.

import { parse as parseYaml } from "@std/yaml";
import { dirname, fromFileUrl, join } from "@std/path";

export const QUEUE_NOTE_PATH = "documentation/notes/wd.queues.md";
export const STATE_FILE_NAME = ".jimbo-state.json";
export const MAX_COMMENT_LENGTH = 140;

// Exact heading identities (D1, D7). A re-punctuated or renamed heading is a
// refusal, not a smaller scan: `check` only validates lines inside recognised
// sections, so with no recognised heading it would validate nothing and print
// clean — the vacuous pass Stagecraft audited as "rank 9 of thirteen checks
// that pass on an empty population."
export const SECTION_HEADINGS = [
  "## Kim — implementation",
  "## Jimbo — planning",
] as const;

export type SectionKey = "kim" | "jimbo";

const SECTION_BY_KEY: Record<SectionKey, string> = {
  kim: SECTION_HEADINGS[0],
  jimbo: SECTION_HEADINGS[1],
};

// Groom duties with a once-per-day floor (D8). Hardcoded to pin the list
// mechanically, like the headings; if the duties churn, move the list to the
// state file or the read-in (task-note Open Issue).
export const GROOM_DUTIES = [
  "read-in",
  "queues",
  "court",
  "todo",
  "closure",
  "decision-log",
] as const;

export type GroomDuty = (typeof GROOM_DUTIES)[number];

// Violation of the queue contract: exit 1.
export class GateRefusal extends Error {}

// Caller mistake (bad subcommand/arguments): exit 2.
export class GateUsage extends Error {}

interface QueueEntry {
  readonly num: number;
  readonly note: string;
  readonly comment: string;
}

interface QueueSection {
  readonly heading: string;
  readonly entries: QueueEntry[];
}

interface ParsedQueue {
  readonly sections: QueueSection[];
}

export interface CheckResult {
  readonly reports: string[];
  readonly entryCount: number;
}

export interface WakeResult {
  readonly previousWake: string | null;
  readonly unmetDuties: string[];
}

interface JimboState {
  lastWake?: string;
  groomed?: Record<string, string>;
}

// --- note resolution across the vaults registered in dendron.yml ------------

interface DendronVault {
  fsPath?: string;
  selfContained?: boolean;
}

// A selfContained vault keeps notes in `<fsPath>/notes`; a plain vault keeps
// them at `<fsPath>` itself (sflo-dendron-notes). Checking one vault "made
// every legitimate cross-vault link a refusal, which is how a guard teaches
// people to bypass it" — the queue points across vaults, so this generality
// is load-bearing.
export function vaultNoteDirs(rootDir: string): string[] {
  const yamlPath = join(rootDir, "dendron.yml");
  let raw: string;
  try {
    raw = Deno.readTextFileSync(yamlPath);
  } catch {
    throw new GateRefusal(
      `cannot read ${yamlPath} — the gate resolves notes via workspace.vaults and refuses without it`,
    );
  }
  const parsed = parseYaml(raw) as {
    workspace?: { vaults?: DendronVault[] };
  } | null;
  const vaults = parsed?.workspace?.vaults ?? [];
  if (vaults.length === 0) {
    throw new GateRefusal(
      "dendron.yml declares no workspace.vaults — cannot resolve note targets",
    );
  }
  return vaults
    .filter((vault): vault is DendronVault & { fsPath: string } =>
      typeof vault.fsPath === "string"
    )
    .map((vault) =>
      vault.selfContained === true
        ? join(rootDir, vault.fsPath, "notes")
        : join(rootDir, vault.fsPath)
    );
}

function noteFileExists(noteDirs: readonly string[], note: string): boolean {
  for (const dir of noteDirs) {
    try {
      if (Deno.statSync(join(dir, `${note}.md`)).isFile) {
        return true;
      }
    } catch {
      // Missing vault directories are expected in CI checkouts.
    }
  }
  return false;
}

// Renames are Dave's asynchronous act; a valid-when-admitted entry must not
// flip the gate red when its target moves to wa.completed.* / wa.cancelled.*.
function renamedSibling(
  noteDirs: readonly string[],
  note: string,
): string | undefined {
  if (!note.startsWith("wa.task.")) {
    return undefined;
  }
  for (const prefix of ["wa.completed.", "wa.cancelled."]) {
    const sibling = prefix + note.slice("wa.task.".length);
    if (noteFileExists(noteDirs, sibling)) {
      return sibling;
    }
  }
  return undefined;
}

// --- queue file parsing -----------------------------------------------------

const ENTRY_PATTERN = /^(\d+)\. \[\[([^\[\]]+)\]\] — (.+)$/;

function readQueueText(rootDir: string): string {
  const path = join(rootDir, QUEUE_NOTE_PATH);
  try {
    return Deno.readTextFileSync(path);
  } catch {
    throw new GateRefusal(
      `${QUEUE_NOTE_PATH} does not exist — run \`deno task queue init\` to mint it`,
    );
  }
}

// Every subcommand except init refuses when the queue is missing (spec:
// "an explicit refusal naming init, never an ENOENT crash"). wake/groomed
// only need existence — full validation stays with check, so a drifted queue
// cannot also block the wake that would surface it.
function requireQueueExists(rootDir: string): void {
  try {
    Deno.statSync(join(rootDir, QUEUE_NOTE_PATH));
  } catch {
    throw new GateRefusal(
      `${QUEUE_NOTE_PATH} does not exist — run \`deno task queue init\` to mint it`,
    );
  }
}

function stripFrontmatter(lines: readonly string[]): number {
  if (lines[0] !== "---") {
    return 0;
  }
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "---") {
      return i + 1;
    }
  }
  return 0;
}

// Structural violations (missing/unknown headings, malformed lines, broken
// numbering, same-section duplicates, comment-contract breaches) throw; every
// subcommand that touches the queue validates the whole file first, so drift
// is caught at the next touch, not at some later audit.
function parseQueue(text: string): ParsedQueue {
  const lines = text.split("\n");
  const bodyStart = stripFrontmatter(lines);
  const recognised = new Set<string>(SECTION_HEADINGS);
  const sections: QueueSection[] = [];
  let current: { heading: string; entries: QueueEntry[] } | null = null;

  for (let i = bodyStart; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("## ")) {
      if (!recognised.has(line)) {
        throw new GateRefusal(
          `unrecognised section heading ${
            JSON.stringify(line)
          } — the gate pins ${
            SECTION_HEADINGS.map((h) => JSON.stringify(h)).join(" and ")
          } by exact identity; entries under any other heading would never be scanned`,
        );
      }
      if (sections.some((section) => section.heading === line)) {
        throw new GateRefusal(
          `duplicate section heading ${JSON.stringify(line)}`,
        );
      }
      current = { heading: line, entries: [] };
      sections.push(current);
      continue;
    }
    if (current === null || line.trim() === "") {
      continue;
    }
    const match = line.match(ENTRY_PATTERN);
    if (!match) {
      throw new GateRefusal(
        `malformed line in ${JSON.stringify(current.heading)}: ${
          JSON.stringify(line)
        } — one line per item: \`N. [[note]] — <one clause>\`; if it needs more, it belongs in the task note`,
      );
    }
    current.entries.push({
      num: Number(match[1]),
      note: match[2],
      comment: match[3],
    });
  }

  for (const heading of SECTION_HEADINGS) {
    if (!sections.some((section) => section.heading === heading)) {
      throw new GateRefusal(
        `missing section heading ${
          JSON.stringify(heading)
        } — a missing identity is a refusal, never a silently smaller scan`,
      );
    }
  }

  for (const section of sections) {
    const seen = new Set<string>();
    section.entries.forEach((entry, index) => {
      if (entry.num !== index + 1) {
        throw new GateRefusal(
          `${section.heading}: numbering is not contiguous — expected ${
            index + 1
          }, found ${entry.num} at [[${entry.note}]]; renumber by hand, then re-run check`,
        );
      }
      if (seen.has(entry.note)) {
        throw new GateRefusal(
          `${section.heading}: [[${entry.note}]] appears more than once in this section`,
        );
      }
      seen.add(entry.note);
    });
  }

  return { sections };
}

// --- the admission test, mechanised -----------------------------------------

const STATUS_WORD_PATTERN =
  /(?<![a-z])(landed|closed|complete|completed|delivered|shipped|merged)(?![a-z])/i;
const PERCENT_PATTERN = /\d+(?:\.\d+)?\s*(?:%|percent(?![a-z]))/i;
const HEX_TOKEN_PATTERN = /(?<![0-9a-z])[0-9a-f]{7,}(?![0-9a-z])/gi;
const BLOCKER_PATTERN = /\b(waits on|blocked on|pending|awaiting|until)\b/i;

// A line may appear only if its truth can change only by editing this file.
// The scan is lexical: it catches the named drift markers (SHAs, status
// words, percentages), not every possible external-truth phrasing — the
// residue stays the writer's judgment (r1 F8/C5).
function admissionViolation(comment: string): string | undefined {
  if (comment.trim() === "") {
    return "empty comment — say why-next or blocked-on in one clause";
  }
  if (/[\r\n]/.test(comment)) {
    return "comment contains a line break — one line per item";
  }
  if (comment.length > MAX_COMMENT_LENGTH) {
    return `comment is ${comment.length} chars (max ${MAX_COMMENT_LENGTH}) — if it needs more, it belongs in the task note`;
  }
  const status = comment.match(STATUS_WORD_PATTERN);
  if (status) {
    return `status word ${
      JSON.stringify(status[1])
    } — delivery truth lives in wd.todo, not the queue`;
  }
  const percent = comment.match(PERCENT_PATTERN);
  if (percent) {
    return `percentage ${JSON.stringify(percent[0])} — progress claims drift`;
  }
  for (const token of comment.matchAll(HEX_TOKEN_PATTERN)) {
    // 7-char all-letter tokens are English hex-alphabet words ("defaced"),
    // not SHAs; anything longer, or digit-bearing, is refused.
    if (/\d/.test(token[0]) || token[0].length >= 8) {
      return `SHA-like token ${
        JSON.stringify(token[0])
      } — its truth changes outside this file`;
    }
  }
  return undefined;
}

// Entries point at task notes by name, never by path: a dendron note name in
// the `<vault-prefix>.task.…` family, safe to join onto a vault directory
// (r1 F8/C3 — an unsanitized name could otherwise escape the vault roots).
const NOTE_NAME_PATTERN = /^[a-z][a-z0-9-]*(\.[A-Za-z0-9_-]+)+$/;
const TASK_NOTE_PATTERN = /^[a-z][a-z0-9-]*\.task\./;

function noteNameViolation(note: string): string | undefined {
  if (!NOTE_NAME_PATTERN.test(note)) {
    return `[[${note}]] is not a plain dendron note name`;
  }
  if (!TASK_NOTE_PATTERN.test(note)) {
    return `[[${note}]] is not a task note — queue entries point at \`<vault>.task.…\` notes only`;
  }
  return undefined;
}

function validateComments(parsed: ParsedQueue): void {
  for (const section of parsed.sections) {
    for (const entry of section.entries) {
      const nameViolation = noteNameViolation(entry.note);
      if (nameViolation) {
        throw new GateRefusal(`${section.heading}: ${nameViolation}`);
      }
      const violation = admissionViolation(entry.comment);
      if (violation) {
        throw new GateRefusal(
          `${section.heading}: [[${entry.note}]] — ${violation}`,
        );
      }
    }
  }
}

// --- exported surface --------------------------------------------------------

// Which recognised headings are present, by exact identity. Exported so the
// anti-vacuous-pass property is directly testable.
export function sectionsPresent(text: string): string[] {
  const lines = new Set(text.split("\n"));
  return SECTION_HEADINGS.filter((heading) => lines.has(heading));
}

export interface InitOptions {
  now?: Date;
  id?: string;
}

export function initQueue(rootDir: string, options: InitOptions = {}): string {
  const path = join(rootDir, QUEUE_NOTE_PATH);
  try {
    Deno.statSync(path);
    throw new GateRefusal(
      `${QUEUE_NOTE_PATH} already exists — init refuses to overwrite the queue`,
    );
  } catch (error) {
    if (error instanceof GateRefusal) {
      throw error;
    }
    // Missing file is the init-able state.
  }
  const now = options.now ?? new Date();
  const id = options.id ?? randomNoteId();
  const ms = now.getTime();
  const skeleton = `---
id: ${id}
title: Queues
desc: 'The READY slice, in order — gated by scripts/queue-gate.ts; the backlog stays in wd.todo'
updated: ${ms}
created: ${ms}
---

This note is the READY slice, in order: a task enters when it is fireable and leaves at delivery; the backlog stays in [[wd.todo]], and open decisions for Dave live in [[wa.dave-court]] (archive vault, ungated). The sections below are SURFACES, not seats: the heading names who disposes of the item, not who is sitting somewhere waiting for it. One line per item: \`N. [[wa.task…]] — <at most one clause>\`, ≤${MAX_COMMENT_LENGTH} chars, no SHAs, status words, or percentages — if a line's truth can change without editing this file, it does not belong here. Writes go through \`deno task queue\` (add/pop/check/wake/groomed); reordering is a hand edit followed by \`deno task queue check\`.

${SECTION_HEADINGS[0]}

${SECTION_HEADINGS[1]}
`;
  Deno.writeTextFileSync(path, skeleton);
  return path;
}

export function addEntry(
  rootDir: string,
  note: string,
  sectionKey: SectionKey,
  comment: string,
): number {
  const heading = SECTION_BY_KEY[sectionKey];
  if (heading === undefined) {
    throw new GateUsage(
      `unknown section ${JSON.stringify(sectionKey)} — use "kim" or "jimbo"`,
    );
  }
  const text = readQueueText(rootDir);
  const parsed = parseQueue(text);
  validateComments(parsed);

  const nameViolation = noteNameViolation(note);
  if (nameViolation) {
    throw new GateRefusal(`refused: ${nameViolation}`);
  }
  const violation = admissionViolation(comment);
  if (violation) {
    throw new GateRefusal(`refused: ${violation}`);
  }

  const noteDirs = vaultNoteDirs(rootDir);
  if (!noteFileExists(noteDirs, note)) {
    const renamed = renamedSibling(noteDirs, note);
    if (renamed) {
      throw new GateRefusal(
        `[[${note}]] resolves only as [[${renamed}]] — a closed task does not enter the queue`,
      );
    }
    throw new GateRefusal(
      `[[${note}]] does not resolve in any vault — a backlog item without a task note stays in wd.todo until one is cut; the refusal is law, not a bug`,
    );
  }

  const section = parsed.sections.find((s) => s.heading === heading);
  if (section === undefined) {
    throw new GateRefusal(`missing section heading ${JSON.stringify(heading)}`);
  }
  if (section.entries.some((entry) => entry.note === note)) {
    throw new GateRefusal(
      `[[${note}]] is already in ${
        JSON.stringify(heading)
      } — one entry per section (a second slice belongs in the other section or in the task note)`,
    );
  }

  const num = section.entries.length + 1;
  const lines = text.split("\n");
  const headingIdx = lines.indexOf(heading);
  // Insert after the last entry of this section (or right after the heading).
  let insertAt = headingIdx + 1;
  for (let i = headingIdx + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) {
      break;
    }
    if (lines[i].trim() !== "") {
      insertAt = i + 1;
    }
  }
  lines.splice(insertAt, 0, `${num}. [[${note}]] — ${comment}`);
  Deno.writeTextFileSync(join(rootDir, QUEUE_NOTE_PATH), lines.join("\n"));
  return num;
}

export const POP_OBLIGATIONS = `owed on pop:
- flip the [[wd.todo]] checkbox for this delivery
- add a [[wd.decision-log]] entry if the delivery ratified a decision
- if this closed the task, renames are now link-safe (wa.task.* → wa.completed.* stays Dave's act)
reminder: popping a task with only one slice landed is the wrong command — a partially-delivered task keeps its entry until every slice closes`;

export function popEntry(
  rootDir: string,
  note: string,
  sectionKey?: SectionKey,
): string {
  const text = readQueueText(rootDir);
  const parsed = parseQueue(text);
  validateComments(parsed);

  const holding = parsed.sections.filter((section) =>
    section.entries.some((entry) => entry.note === note)
  );
  if (holding.length === 0) {
    throw new GateRefusal(`[[${note}]] is not in the queue — nothing to pop`);
  }
  let heading: string;
  if (sectionKey !== undefined) {
    heading = SECTION_BY_KEY[sectionKey];
    if (!holding.some((section) => section.heading === heading)) {
      throw new GateRefusal(
        `[[${note}]] is not in ${JSON.stringify(heading)} — it is in ${
          holding.map((s) => JSON.stringify(s.heading)).join(" and ")
        }`,
      );
    }
  } else if (holding.length > 1) {
    throw new GateRefusal(
      `[[${note}]] holds entries in ${
        holding.map((s) => JSON.stringify(s.heading)).join(" and ")
      } — pop the slice, not the task: name the section (kim|jimbo)`,
    );
  } else {
    heading = holding[0].heading;
  }

  const lines = text.split("\n");
  const headingIdx = lines.indexOf(heading);
  const sectionEnd = (() => {
    for (let i = headingIdx + 1; i < lines.length; i++) {
      if (lines[i].startsWith("## ")) {
        return i;
      }
    }
    return lines.length;
  })();

  const kept: string[] = [];
  let renumber = 1;
  for (let i = headingIdx + 1; i < sectionEnd; i++) {
    const match = lines[i].match(ENTRY_PATTERN);
    if (match && match[2] === note) {
      continue;
    }
    if (match) {
      kept.push(`${renumber}. [[${match[2]}]] — ${match[3]}`);
      renumber++;
    } else {
      kept.push(lines[i]);
    }
  }
  lines.splice(headingIdx + 1, sectionEnd - headingIdx - 1, ...kept);
  Deno.writeTextFileSync(join(rootDir, QUEUE_NOTE_PATH), lines.join("\n"));
  return POP_OBLIGATIONS;
}

export function checkQueue(rootDir: string): CheckResult {
  const text = readQueueText(rootDir);
  const parsed = parseQueue(text);
  validateComments(parsed);

  const noteDirs = vaultNoteDirs(rootDir);
  const reports: string[] = [];
  let entryCount = 0;
  for (const section of parsed.sections) {
    for (const entry of section.entries) {
      entryCount++;
      if (!noteFileExists(noteDirs, entry.note)) {
        const renamed = renamedSibling(noteDirs, entry.note);
        if (renamed) {
          reports.push(
            `${section.heading}: [[${entry.note}]] renamed to [[${renamed}]] — update or pop the entry`,
          );
        } else {
          throw new GateRefusal(
            `${section.heading}: [[${entry.note}]] does not resolve in any vault and has no completed/cancelled sibling`,
          );
        }
      }
      const blocker = entry.comment.match(BLOCKER_PATTERN);
      if (blocker) {
        // Reported on every check, never refused: a blocker that quietly
        // cleared looks exactly like a blocked lane — re-verify "is it still
        // true, and is it still that section's?"
        reports.push(
          `${section.heading}: [[${entry.note}]] carries blocker ${
            JSON.stringify(blocker[1])
          } — is it still true, and is it still that section's?`,
        );
      }
    }
  }
  return { reports, entryCount };
}

// --- wake / groom stamps (D8) ------------------------------------------------

function statePath(rootDir: string): string {
  return join(rootDir, STATE_FILE_NAME);
}

function readState(rootDir: string): JimboState {
  let raw: string;
  try {
    raw = Deno.readTextFileSync(statePath(rootDir));
  } catch {
    return {};
  }
  try {
    return JSON.parse(raw) as JimboState;
  } catch {
    throw new GateRefusal(
      `${STATE_FILE_NAME} is not valid JSON — fix or delete it before waking`,
    );
  }
}

function writeState(rootDir: string, state: JimboState): void {
  Deno.writeTextFileSync(
    statePath(rootDir),
    JSON.stringify(state, null, 2) + "\n",
  );
}

function localDate(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Prints-then-rotates: "since your last wake" and "has the floor fired today"
// are file reads, not memory — post-compaction the alternative bound is
// recall, which the loop prompt itself forbids trusting.
export function wake(rootDir: string, now: Date = new Date()): WakeResult {
  requireQueueExists(rootDir);
  const state = readState(rootDir);
  const today = localDate(now);
  const unmetDuties = GROOM_DUTIES.filter(
    (duty) => state.groomed?.[duty] !== today,
  );
  const previousWake = state.lastWake ?? null;
  writeState(rootDir, { ...state, lastWake: now.toISOString() });
  return { previousWake, unmetDuties };
}

export function groomed(
  rootDir: string,
  duty: string,
  now: Date = new Date(),
): string {
  if (!(GROOM_DUTIES as readonly string[]).includes(duty)) {
    throw new GateUsage(
      `unknown groom duty ${JSON.stringify(duty)} — duties: ${
        GROOM_DUTIES.join(", ")
      }`,
    );
  }
  requireQueueExists(rootDir);
  const state = readState(rootDir);
  const today = localDate(now);
  writeState(rootDir, {
    ...state,
    groomed: { ...state.groomed, [duty]: today },
  });
  return today;
}

function randomNoteId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(23);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

// --- thin CLI ----------------------------------------------------------------

const USAGE = `usage: deno task queue <subcommand>
  init                                mint ${QUEUE_NOTE_PATH} (refuses if it exists)
  add <note> <kim|jimbo> "<comment>"  admit an entry (the admission test refuses drift)
  pop <note> [kim|jimbo]              remove an entry and print what is owed
  check                               validate the whole queue; report blockers/renames
  wake                                print last wake + unmet groom floors, rotate the stamp
  groomed <duty>                      stamp a groom duty (${
  GROOM_DUTIES.join(", ")
})`;

function parseSectionKey(value: string): SectionKey {
  if (value === "kim" || value === "jimbo") {
    return value;
  }
  throw new GateUsage(
    `unknown section ${JSON.stringify(value)} — use "kim" or "jimbo"`,
  );
}

function runCli(rootDir: string, args: readonly string[]): void {
  const [subcommand, ...rest] = args;
  switch (subcommand) {
    case "init": {
      const path = initQueue(rootDir);
      console.log(`minted ${path} — seed it with \`deno task queue add\``);
      return;
    }
    case "add": {
      if (rest.length !== 3) {
        throw new GateUsage(`add needs <note> <kim|jimbo> "<comment>"`);
      }
      const [note, sectionValue, comment] = rest;
      const num = addEntry(
        rootDir,
        note,
        parseSectionKey(sectionValue),
        comment,
      );
      console.log(
        `added #${num} [[${note}]] under ${
          JSON.stringify(SECTION_BY_KEY[parseSectionKey(sectionValue)])
        }`,
      );
      return;
    }
    case "pop": {
      if (rest.length < 1 || rest.length > 2) {
        throw new GateUsage("pop needs <note> [kim|jimbo]");
      }
      const [note, sectionValue] = rest;
      const owed = popEntry(
        rootDir,
        note,
        sectionValue === undefined ? undefined : parseSectionKey(sectionValue),
      );
      console.log(`popped [[${note}]]`);
      console.log(owed);
      return;
    }
    case "check": {
      if (rest.length !== 0) {
        throw new GateUsage("check takes no arguments");
      }
      const result = checkQueue(rootDir);
      for (const report of result.reports) {
        console.log(`REPORT: ${report}`);
      }
      console.log(
        `queue check: OK (${result.entryCount} entries, ${result.reports.length} reports)`,
      );
      return;
    }
    case "wake": {
      if (rest.length !== 0) {
        throw new GateUsage("wake takes no arguments");
      }
      const result = wake(rootDir);
      console.log(
        result.previousWake === null
          ? "last wake: none — stamp seeded; this wake is the bound for the next one"
          : `last wake: ${result.previousWake}`,
      );
      console.log(
        result.unmetDuties.length === 0
          ? "groom floors: all met today"
          : `groom floors unmet today: ${result.unmetDuties.join(", ")}`,
      );
      return;
    }
    case "groomed": {
      if (rest.length !== 1) {
        throw new GateUsage(
          `groomed needs exactly one duty (${GROOM_DUTIES.join(", ")})`,
        );
      }
      const date = groomed(rootDir, rest[0]);
      console.log(`groomed: ${rest[0]} @ ${date}`);
      return;
    }
    default:
      throw new GateUsage(USAGE);
  }
}

if (import.meta.main) {
  const rootDir = dirname(dirname(fromFileUrl(import.meta.url)));
  try {
    runCli(rootDir, Deno.args);
  } catch (error) {
    if (error instanceof GateUsage) {
      console.error(error.message);
      Deno.exit(2);
    }
    if (error instanceof GateRefusal) {
      console.error(`REFUSED: ${error.message}`);
      Deno.exit(1);
    }
    throw error;
  }
}
