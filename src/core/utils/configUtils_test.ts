import { assertEquals, assertRejects } from "../../deps/assert.ts";
import { Frame } from "../Frame.ts";
import { ConfigError } from "../errors.ts";
import {
  processWeaveConfigWithDeps,
  getEnvConfig,
  validateGlobalOptions,
  resolveGitInclusion,
  resolveWebInclusion,
  resolveLocalInclusion,
  ConfigDependencies,
  DEFAULT_GLOBAL,
} from "./configUtils.ts";
import {
  InputGlobalOptions,
  WeaveConfigInput,
  InputGitOptions,
  InputWebOptions,
  InputLocalOptions,
  ResolvedInclusion,
  CopyStrategy,
} from "../../types.ts";
import { setConfigLoader } from "./configHelpers.ts";

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

// Test helper for Frame operations
const withTestFrame = async <T>(
  fn: () => Promise<T>,
  config?: WeaveConfigInput,
  resolvedInclusions: ResolvedInclusion[] = [],
  commandOptions?: InputGlobalOptions
): Promise<T> => {
  if (config) {
    Frame.initialize(config, resolvedInclusions, commandOptions);
  }
  try {
    return await fn();
  } finally {
    Frame.resetInstance();
  }
};

// Mock dependencies
const mockDeps: ConfigDependencies = {
  determineDefaultBranch: async () => "main",
  determineWorkingBranch: async () => "feature-branch",
  determineDefaultWorkingDirectory: () => "_source-repos/repo",
  directoryExists: async () => true,
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

Deno.test("getEnvConfig", async (t) => {
  await t.step("returns environment configuration", () => {
    const envConfig = getEnvConfig(mockDeps.env);
    assertEquals(envConfig.global?.debug, "DEBUG");
    assertEquals(envConfig.global?.dest, "custom_dest");
    assertEquals(envConfig.global?.globalClean, true);
  });
});

Deno.test("validateGlobalOptions", async (t) => {
  await t.step("validates required options", async () => {
    const invalidConfig: WeaveConfigInput = {
      inclusions: [],
      global: {
        dest: "_woven",
        workspaceDir: "_source-repos",
        configFilePath: "config.json",
        globalClean: false,
        watchConfig: false,
      },
    };

    await assertRejects(
      async () => validateGlobalOptions(invalidConfig),
      ConfigError,
      "Missing required global configuration option"
    );
  });

  await t.step("validates copy strategy", async () => {
    const invalidConfig: WeaveConfigInput = {
      inclusions: [],
      global: {
        globalCopyStrategy: "invalid-strategy" as CopyStrategy,
        dest: "_woven",
        configFilePath: "config.json",
        globalClean: false,
        watchConfig: false,
        workspaceDir: "_source-repos",
      },
    };

    await assertRejects(
      async () => validateGlobalOptions(invalidConfig),
      ConfigError,
      "Invalid copy strategy"
    );
  });
});

Deno.test("resolveGitInclusion", async (t) => {
  await t.step("resolves git inclusion with provided branch", async () => {
    const inclusion = {
      type: "git" as const,
      url: "https://example.com/repo.git",
      options: {
        branch: "develop",
        active: true,
        copyStrategy: "overwrite" as CopyStrategy,
      } as InputGitOptions,
    };

    const resolved = await resolveGitInclusion(inclusion, "_source-repos", mockDeps);
    assertEquals(resolved.type, "git");
    assertEquals((resolved.options as InputGitOptions).branch, "develop");
    assertEquals(resolved.options.copyStrategy, "overwrite");
  });

  await t.step("requires URL", async () => {
    const invalidInclusion = {
      type: "git" as const,
      options: { active: true },
    };

    await assertRejects(
      () => resolveGitInclusion(invalidInclusion as any, "_source-repos", mockDeps),
      ConfigError,
      "Git inclusion requires a 'url'"
    );
  });
});

Deno.test("resolveWebInclusion", async (t) => {
  await t.step("resolves web inclusion", async () => {
    const inclusion = {
      type: "web" as const,
      url: "https://example.com/resource",
      options: {
        active: true,
        copyStrategy: "skip" as CopyStrategy,
      } as InputWebOptions,
    };

    const resolved = await resolveWebInclusion(inclusion);
    assertEquals(resolved.type, "web");
    assertEquals(resolved.options.copyStrategy, "skip");
  });

  await t.step("requires URL", async () => {
    const invalidInclusion = {
      type: "web" as const,
      options: { active: true },
    };

    await assertRejects(
      () => resolveWebInclusion(invalidInclusion as any),
      ConfigError,
      "Web inclusion requires a 'url'"
    );
  });
});

Deno.test("resolveLocalInclusion", async (t) => {
  await t.step("resolves local inclusion", async () => {
    const inclusion = {
      type: "local" as const,
      localPath: "./local-dir",
      options: {
        active: true,
        copyStrategy: "prompt" as CopyStrategy,
        include: ["*.ts"],
        exclude: ["*.test.ts"],
      } as InputLocalOptions,
    };

    const resolved = await resolveLocalInclusion(inclusion);
    assertEquals(resolved.type, "local");
    assertEquals(resolved.options.copyStrategy, "prompt");
    assertEquals((resolved.options as InputLocalOptions).include, ["*.ts"]);
    assertEquals((resolved.options as InputLocalOptions).exclude, ["*.test.ts"]);
  });

  await t.step("requires localPath", async () => {
    const invalidInclusion = {
      type: "local" as const,
      options: { active: true },
    };

    await assertRejects(
      () => resolveLocalInclusion(invalidInclusion as any),
      ConfigError,
      "Local inclusion requires a 'localPath'"
    );
  });
});

Deno.test("processWeaveConfigWithDeps", async (t) => {
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
    };

    setConfigLoader(new TestConfigLoader(mockConfig));
    const config = await processWeaveConfigWithDeps(mockDeps, commandOptions);
    assertEquals(config.global?.debug, "DEBUG");
    assertEquals(config.global?.dest, "cli_dest");
    assertEquals(config.global?.globalClean, true);
  });
});
