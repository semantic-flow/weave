// src/core/utils/configUtils_test.ts

import {
  assertEquals,
  assertThrows,
} from "../../deps/assert.ts";
import { composeWeaveConfig } from "./configUtils.ts";

Deno.test("composeWeaveConfig uses default workspaceDir when not provided", async () => {
  const config = await composeWeaveConfig();
  console.log(`workspaceDir: ${config.global.workspaceDir}`);
  assertEquals(config.global.workspaceDir, "_source-repos");
});

Deno.test("composeWeaveConfig overrides workspaceDir with CLI option", async () => {
  const config = await composeWeaveConfig({ workspaceDir: "custom_workspace" });
  assertEquals(config.global.workspaceDir, "custom_workspace");
});

/*
Deno.test("composeWeaveConfig throws error when config file is missing inclusions", async () => {
  // Mock a config file without inclusions
  // This requires mocking the loadWeaveConfig functions or setting up test fixtures
  await assertThrows(
    async () => {
      // Setup code to load a faulty config
      // ...
      await composeWeaveConfig();
    },
    Error,
    "'inclusions' must be an array in the configuration file.",
  );
  
});
*/
