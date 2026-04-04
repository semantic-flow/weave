import { runWeaveCli } from "./cli/mod.ts";

if (import.meta.main) {
  const exitCode = await runWeaveCli(Deno.args);
  Deno.exit(exitCode);
}
