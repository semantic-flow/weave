import { coverageDir } from "./coverage-paths.ts";

if (import.meta.main) {
  await prepareCoverageDir();
}

export async function prepareCoverageDir(): Promise<void> {
  await Deno.mkdir(coverageDir, { recursive: true });
}
