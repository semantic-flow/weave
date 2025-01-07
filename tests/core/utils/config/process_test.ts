import { assertEquals, assertRejects } from "../../../../src/deps/assert.ts";
import { ConfigError } from "../../../../src/core/errors.ts";
import {
  processWeaveConfigWithDeps,
  DEFAULT_GLOBAL,
  ConfigDependencies,
} from "../../../../src/core/utils/configUtils.ts";
import { setConfigLoader, ConfigLoader } from "../../../../src/core/utils/configHelpers.ts";
import {
  WeaveConfigInput,
  InputGlobalOptions,
  InputGitOptions,
  CopyStrategy,
} from "../../../../src/types.ts";

// Base mock dependencies
const mockDeps: ConfigDependencies = {
  determineDefaultBranch: async () => "main",
  determineWorkingBranch: async () => "feature-branch",
  determineDefaultWorkingDirectory: () => "_source-repos/repo",
  directoryExists: async () => true,
  getConfigFilePath: async () => "weave.config.json",
  env: {
    get: (key: string) => {
      const envMap: Record<string, string> = {
        WEAVE_DEBUG: "DEBUG",
        WEAVE_DEST: "custom_dest",
        WEAVE_CLEAN: "true",
      };
      return envMap[key];
    },
  },
};

// Mock classes for testing
class TestConfigLoader {
  private mockConfig: WeaveConfigInput;

  constructor(mockConfig: WeaveConfigInput) {
    this.mockConfig = mockConfig;
  }

  async loadConfig(_filePath: string): Promise<WeaveConfigInput> {
    return this.mockConfig;
  }
}

Deno.test("processWeaveConfigWithDeps", async (t) => {
  await t.step("handles missing config file", async () => {
    const failingDeps = {
      ...mockDeps,
      getConfigFilePath: async () => null,
      env: {
        get: () => undefined,
      },
    };

    await assertRejects(
      () => processWeaveConfigWithDeps(failingDeps),
      ConfigError,
      "No configuration file detected"
    );
  });

  await t.step("handles config file loading errors", async () => {
    class ErrorConfigLoader {
      async loadConfig(_filePath: string): Promise<WeaveConfigInput> {
        throw new Error("Failed to load config");
      }
    }

    setConfigLoader(new ErrorConfigLoader());
    await assertRejects(
      () => processWeaveConfigWithDeps(mockDeps),
      ConfigError,
      "Failed to load config"
    );
  });

  const mockConfig: WeaveConfigInput = {
    inclusions: [
      {
        type: "git",
        url: "https://example.com/repo.git",
        options: {
          active: true,
          branch: "main",
          copyStrategy: "no-overwrite" as CopyStrategy,
        } as InputGitOptions,
      },
    ],
    global: {
      ...DEFAULT_GLOBAL,
      debug: "INFO",
      dest: "_woven",
      globalCopyStrategy: "no-overwrite" as CopyStrategy,
    },
  };

  await t.step("processes config with defaults", async () => {
    setConfigLoader(new TestConfigLoader(mockConfig));
    const config = await processWeaveConfigWithDeps(mockDeps);
    assertEquals(config.global?.dest, "_woven");
    assertEquals(config.global?.globalCopyStrategy, "no-overwrite");
    assertEquals(config.resolvedInclusions?.length, 1);
  });

  await t.step("merges command line options", async () => {
    const commandOptions: InputGlobalOptions = {
      debug: "DEBUG",
      dest: "cli_dest",
      globalClean: true,
      globalCopyStrategy: "overwrite" as CopyStrategy,
      watchConfig: true,
      workspaceDir: "cli_workspace",
    };

    setConfigLoader(new TestConfigLoader(mockConfig));
    const config = await processWeaveConfigWithDeps(mockDeps, commandOptions);
    assertEquals(config.global?.debug, "DEBUG");
    assertEquals(config.global?.dest, "cli_dest");
    assertEquals(config.global?.globalClean, true);
    assertEquals(config.global?.globalCopyStrategy, "overwrite");
    assertEquals(config.global?.watchConfig, true);
    assertEquals(config.global?.workspaceDir, "cli_workspace");
  });

  await t.step("filters inactive inclusions", async () => {
    const configWithInactive: WeaveConfigInput = {
      ...mockConfig,
      inclusions: [
        ...(mockConfig.inclusions || []),
        {
          type: "git",
          url: "https://example.com/inactive.git",
          options: {
            active: false,
            copyStrategy: "no-overwrite" as CopyStrategy,
          } as InputGitOptions,
        },
      ],
    };

    setConfigLoader(new TestConfigLoader(configWithInactive));
    const config = await processWeaveConfigWithDeps(mockDeps);
    assertEquals(config.resolvedInclusions?.length, 1);
  });

  await t.step("processes web inclusions", async () => {
    const webConfig: WeaveConfigInput = {
      inclusions: [
        {
          type: "web",
          url: "https://example.com/resource",
          options: {
            active: true,
            copyStrategy: "no-overwrite" as CopyStrategy,
          },
        },
      ],
      global: { ...DEFAULT_GLOBAL },
    };

    setConfigLoader(new TestConfigLoader(webConfig));
    const config = await processWeaveConfigWithDeps(mockDeps);
    assertEquals(config.resolvedInclusions?.length, 1);
    const inclusion = config.resolvedInclusions![0];
    assertEquals(inclusion.type, "web");
    assertEquals((inclusion as any).url, "https://example.com/resource");
  });

  await t.step("processes local inclusions", async () => {
    const localConfig: WeaveConfigInput = {
      inclusions: [
        {
          type: "local",
          localPath: "./local-dir",
          options: {
            active: true,
            copyStrategy: "no-overwrite" as CopyStrategy,
            include: ["*.ts"],
            exclude: ["*.test.ts"],
          },
        },
      ],
      global: { ...DEFAULT_GLOBAL },
    };

    setConfigLoader(new TestConfigLoader(localConfig));
    const config = await processWeaveConfigWithDeps(mockDeps);
    assertEquals(config.resolvedInclusions?.length, 1);
    const inclusion = config.resolvedInclusions![0];
    assertEquals(inclusion.type, "local");
    assertEquals((inclusion as any).localPath, "./local-dir");
  });


  await t.step("handles git inclusion resolution errors", async () => {
    const invalidGitConfig: WeaveConfigInput = {
      inclusions: [
        {
          type: "git",
          url: undefined as unknown as string, // Force undefined url to test error case
          options: {
            active: true,
            copyStrategy: "no-overwrite" as CopyStrategy,
          } as InputGitOptions,
        },
      ],
      global: { ...DEFAULT_GLOBAL },
    };

    setConfigLoader(new TestConfigLoader(invalidGitConfig));
    await assertRejects(
      () => processWeaveConfigWithDeps(mockDeps),
      ConfigError,
      "Git inclusion requires a 'url'"
    );
  });
});
