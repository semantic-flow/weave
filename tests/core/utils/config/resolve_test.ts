import { assertEquals, assertRejects } from "../../../../src/deps/assert.ts";
import { spy, assertSpyCalls } from "../../../../src/deps/testing.ts";
import { ConfigError } from "../../../../src/core/errors.ts";
import {
  resolveGitInclusion,
  resolveWebInclusion,
  resolveLocalInclusion,
  getEnvConfig,
  ConfigDependencies,
} from "../../../../src/core/utils/configUtils.ts";
import {
  InputInclusion,
  GitOptions,
  WebOptions,
  LocalOptions,
  WebInclusion,
  LocalInclusion,
} from "../../../../src/types.ts";
import * as log from "../../../../src/deps/log.ts";

// Base mock dependencies
const mockDeps: ConfigDependencies = {
  determineDefaultBranch: async () => "main",
  determineWorkingBranch: async () => "feature-branch",
  determineDefaultWorkingDirectory: () => "_source-repos/repo",
  directoryExists: async () => true,
  getConfigFilePath: async () => "weave.config.json",
  env: {
    get: () => undefined,
  },
};

Deno.test("getEnvConfig", async (t) => {
  await t.step("parses all environment variables", () => {
    const env = {
      get: (key: string) => {
        const vars: Record<string, string> = {
          WEAVE_CONFIG_FILE: "custom.config.json",
          WEAVE_DEBUG: "DEBUG",
          WEAVE_DEST: "custom_dest",
          WEAVE_CLEAN: "true",
          WEAVE_COPY_STRATEGY: "overwrite",
          WEAVE_WATCH_CONFIG: "true",
          WEAVE_WORKSPACE_DIR: "custom_workspace",
        };
        return vars[key];
      },
    };

    const config = getEnvConfig(env);
    assertEquals(config.global?.configFilePath, "custom.config.json");
    assertEquals(config.global?.debug, "DEBUG");
    assertEquals(config.global?.dest, "custom_dest");
    assertEquals(config.global?.globalClean, true);
    assertEquals(config.global?.globalCopyStrategy, "overwrite");
    assertEquals(config.global?.watchConfig, true);
    assertEquals(config.global?.workspaceDir, "custom_workspace");
  });

  await t.step("handles boolean conversions", () => {
    const env = {
      get: (key: string) => {
        const vars: Record<string, string> = {
          WEAVE_CLEAN: "false",
          WEAVE_WATCH_CONFIG: "0",
        };
        return vars[key];
      },
    };

    const config = getEnvConfig(env);
    assertEquals(config.global?.globalClean, false);
    assertEquals(config.global?.watchConfig, false);
  });

  await t.step("handles missing environment variables", () => {
    const env = {
      get: () => undefined,
    };

    const config = getEnvConfig(env);
    assertEquals(config.global?.configFilePath, undefined);
    assertEquals(config.global?.debug, undefined);
    assertEquals(config.global?.dest, undefined);
    assertEquals(config.global?.globalClean, undefined);
    assertEquals(config.global?.globalCopyStrategy, undefined);
    assertEquals(config.global?.watchConfig, undefined);
    assertEquals(config.global?.workspaceDir, undefined);
  });
});

Deno.test("resolveGitInclusion", async (t) => {
  await t.step("determines branch from working directory", async () => {
    const deps = {
      ...mockDeps,
      directoryExists: async (path: string) => path.endsWith(".git"),
      determineWorkingBranch: async () => "local-branch",
    };

    const inclusion: InputInclusion & { type: "git" } = {
      type: "git",
      url: "https://example.com/repo.git",
      localPath: "/local/path",
    };

    const resolved = await resolveGitInclusion(inclusion, "_source-repos", deps);
    assertEquals((resolved.options as GitOptions).branch, "local-branch");
  });

  await t.step("falls back to default branch", async () => {
    const deps = {
      ...mockDeps,
      directoryExists: async () => false,
      determineDefaultBranch: async () => "default-branch",
    };

    const inclusion: InputInclusion & { type: "git" } = {
      type: "git",
      url: "https://example.com/repo.git",
    };

    const resolved = await resolveGitInclusion(inclusion, "_source-repos", deps);
    assertEquals((resolved.options as GitOptions).branch, "default-branch");
  });

  await t.step("handles working branch determination error", async () => {
    const deps = {
      ...mockDeps,
      directoryExists: async (path: string) => path.endsWith(".git"),
      determineWorkingBranch: async () => {
        throw new Error("Failed to determine working branch");
      },
      determineDefaultBranch: async () => "fallback-branch",
    };

    const warnSpy = spy(log.getLogger("weave"), "warn");

    const inclusion: InputInclusion & { type: "git" } = {
      type: "git",
      url: "https://example.com/repo.git",
      localPath: "/local/path",
    };

    const resolved = await resolveGitInclusion(inclusion, "_source-repos", deps);
    assertEquals((resolved.options as GitOptions).branch, "fallback-branch");
    assertSpyCalls(warnSpy, 1); // Verify warning was logged

    warnSpy.restore();
  });

  await t.step("handles default branch determination error", async () => {
    const deps = {
      ...mockDeps,
      directoryExists: async () => false,
      determineDefaultBranch: async () => {
        throw new Error("Failed to determine default branch");
      },
    };

    const warnSpy = spy(log.getLogger("weave"), "warn");

    const inclusion: InputInclusion & { type: "git" } = {
      type: "git",
      url: "https://example.com/repo.git",
    };

    const resolved = await resolveGitInclusion(inclusion, "_source-repos", deps);
    assertEquals((resolved.options as GitOptions).branch, "main"); // Falls back to "main"
    assertSpyCalls(warnSpy, 1); // Verify warning was logged

    warnSpy.restore();
  });

  await t.step("warns on missing working directory", async () => {
    const deps = {
      ...mockDeps,
      directoryExists: async () => false,
    };

    const warnSpy = spy(log.getLogger("weave"), "warn");

    const inclusion: InputInclusion & { type: "git" } = {
      type: "git",
      url: "https://example.com/repo.git",
      localPath: "/missing/path",
    };

    await resolveGitInclusion(inclusion, "_source-repos", deps);
    assertSpyCalls(warnSpy, 1);

    warnSpy.restore();
  });
});

Deno.test("resolveWebInclusion", async (t) => {
  await t.step("resolves web inclusion with minimal options", async () => {
    const inclusion: InputInclusion & { type: "web" } = {
      type: "web",
      url: "https://example.com/resource",
    };

    const resolved = await resolveWebInclusion(inclusion);
    assertEquals(resolved.type, "web");
    assertEquals((resolved as WebInclusion).url, "https://example.com/resource");
    assertEquals(resolved.options.active, true);
    assertEquals(resolved.options.copyStrategy, "no-overwrite");
  });

  await t.step("handles missing url", async () => {
    const inclusion = {
      type: "web",
    } as InputInclusion & { type: "web" };

    await assertRejects(
      () => resolveWebInclusion(inclusion),
      ConfigError,
      "Web inclusion requires a 'url'"
    );
  });
});

Deno.test("resolveLocalInclusion", async (t) => {
  await t.step("resolves local inclusion with minimal options", async () => {
    const inclusion: InputInclusion & { type: "local" } = {
      type: "local",
      localPath: "./local-dir",
    };

    const resolved = await resolveLocalInclusion(inclusion);
    assertEquals(resolved.type, "local");
    assertEquals((resolved as LocalInclusion).localPath, "./local-dir");
    assertEquals(resolved.options.active, true);
    assertEquals(resolved.options.copyStrategy, "no-overwrite");
    assertEquals((resolved.options as LocalOptions).include, []);
    assertEquals((resolved.options as LocalOptions).exclude, []);
    assertEquals((resolved.options as LocalOptions).excludeByDefault, false);
  });

  await t.step("handles missing localPath", async () => {
    const inclusion = {
      type: "local",
    } as InputInclusion & { type: "local" };

    await assertRejects(
      () => resolveLocalInclusion(inclusion),
      ConfigError,
      "Local inclusion requires a 'localPath'"
    );
  });
});
