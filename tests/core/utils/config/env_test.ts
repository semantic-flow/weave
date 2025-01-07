import { assertEquals } from "../../../../src/deps/assert.ts";
import { getEnvConfig } from "../../../../src/core/utils/configUtils.ts";

Deno.test("getEnvConfig", async (t) => {
  await t.step("returns environment configuration", () => {
    const env = {
      get: (key: string) => {
        const envMap: Record<string, string> = {
          WEAVE_DEBUG: "DEBUG",
          WEAVE_DEST: "custom_dest",
          WEAVE_CLEAN: "true",
          WEAVE_CONFIG_FILE: "custom.config.json",
          WEAVE_COPY_STRATEGY: "overwrite",
          WEAVE_WATCH_CONFIG: "true",
          WEAVE_WORKSPACE_DIR: "custom_workspace",
        };
        return envMap[key];
      },
    };

    const envConfig = getEnvConfig(env);
    assertEquals(envConfig.global?.debug, "DEBUG");
    assertEquals(envConfig.global?.dest, "custom_dest");
    assertEquals(envConfig.global?.globalClean, true);
    assertEquals(envConfig.global?.configFilePath, "custom.config.json");
    assertEquals(envConfig.global?.globalCopyStrategy, "overwrite");
    assertEquals(envConfig.global?.watchConfig, true);
    assertEquals(envConfig.global?.workspaceDir, "custom_workspace");
  });

  await t.step("handles missing environment variables", () => {
    const env = { get: () => undefined };
    const envConfig = getEnvConfig(env);
    assertEquals(envConfig.global?.debug, undefined);
    assertEquals(envConfig.global?.dest, undefined);
    assertEquals(envConfig.global?.globalClean, undefined);
  });

  await t.step("handles boolean parsing", () => {
    const env = {
      get: (key: string) => {
        const envMap: Record<string, string> = {
          WEAVE_CLEAN: "false",
          WEAVE_WATCH_CONFIG: "false",
        };
        return envMap[key];
      },
    };
    const envConfig = getEnvConfig(env);
    assertEquals(envConfig.global?.globalClean, false);
    assertEquals(envConfig.global?.watchConfig, false);
  });
});
