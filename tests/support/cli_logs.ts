import { assertRejects } from "@std/assert";
import { join } from "@std/path";
import { resolveUserSettingsPaths } from "../../src/runtime/settings/user_settings.ts";

export type CliLogFileName = "operational.jsonl" | "security-audit.jsonl";

export async function assertDefaultCliLogFilesExist(
  meshBase: string,
): Promise<void> {
  await assertDefaultCliLogFileExists(meshBase, "operational.jsonl");
  await assertDefaultCliLogFileExists(meshBase, "security-audit.jsonl");
}

export async function assertDefaultCliLogFileExists(
  meshBase: string,
  fileName: CliLogFileName,
): Promise<void> {
  await Deno.stat(join(await resolveDefaultCliLogDir(meshBase), fileName));
}

export async function assertDefaultCliLogFileAbsent(
  meshBase: string,
  fileName: CliLogFileName,
): Promise<void> {
  await assertRejects(
    async () =>
      await Deno.stat(join(await resolveDefaultCliLogDir(meshBase), fileName)),
    Deno.errors.NotFound,
  );
}

export async function resolveDefaultCliLogDir(
  meshBase: string,
): Promise<string> {
  return (await resolveUserSettingsPaths(meshBase)).logDir;
}
