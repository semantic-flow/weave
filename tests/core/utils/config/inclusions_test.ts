import { assertEquals, assertRejects } from "../../../../src/deps/assert.ts";
import { ConfigError } from "../../../../src/core/errors.ts";
import {
  resolveGitInclusion,
  resolveWebInclusion,
  resolveLocalInclusion,
  ConfigDependencies,
} from "../../../../src/core/utils/configUtils.ts";
import {
  InputGitOptions,
  InputWebOptions,
  InputLocalOptions,
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

Deno.test("resolveWebInclusion", async (t) => {
  await t.step("resolves web inclusion with defaults", async () => {
    const inclusion = {
      type: "web" as const,
      url: "https://example.com/resource",
      options: {} as InputWebOptions,
    };

    const resolved = await resolveWebInclusion(inclusion);
    assertEquals(resolved.type, "web");
    assertEquals(resolved.options.active, true);
    assertEquals(resolved.options.copyStrategy, "no-overwrite");
  });

  await t.step("resolves web inclusion with custom options", async () => {
    const inclusion = {
      type: "web" as const,
      url: "https://example.com/resource",
      name: "test-web",
      order: 5,
      options: {
        active: true,
        copyStrategy: "skip" as CopyStrategy,
      } as InputWebOptions,
    };

    const resolved = await resolveWebInclusion(inclusion);
    assertEquals(resolved.type, "web");
    assertEquals(resolved.name, "test-web");
    assertEquals(resolved.order, 5);
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
  await t.step("resolves local inclusion with defaults", async () => {
    const inclusion = {
      type: "local" as const,
      localPath: "./local-dir",
      options: {} as InputLocalOptions,
    };

    const resolved = await resolveLocalInclusion(inclusion);
    assertEquals(resolved.type, "local");
    assertEquals(resolved.options.active, true);
    assertEquals(resolved.options.copyStrategy, "no-overwrite");
    const localOptions = resolved.options as InputLocalOptions;
    assertEquals(localOptions.include, []);
    assertEquals(localOptions.exclude, []);
    assertEquals(localOptions.excludeByDefault, false);
  });

  await t.step("resolves local inclusion with custom options", async () => {
    const inclusion = {
      type: "local" as const,
      localPath: "./local-dir",
      name: "test-local",
      order: 10,
      options: {
        active: true,
        copyStrategy: "prompt" as CopyStrategy,
        include: ["*.ts"],
        exclude: ["*.test.ts"],
        excludeByDefault: true,
      } as InputLocalOptions,
    };

    const resolved = await resolveLocalInclusion(inclusion);
    assertEquals(resolved.type, "local");
    assertEquals(resolved.name, "test-local");
    assertEquals(resolved.order, 10);
    assertEquals(resolved.options.copyStrategy, "prompt");
    const localOptions = resolved.options as InputLocalOptions;
    assertEquals(localOptions.include, ["*.ts"]);
    assertEquals(localOptions.exclude, ["*.test.ts"]);
    assertEquals(localOptions.excludeByDefault, true);
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

  await t.step("handles working branch determination error", async () => {
    const failingDeps = {
      ...mockDeps,
      determineWorkingBranch: async () => {
        throw new Error("Failed to determine working branch");
      },
    };

    const inclusion = {
      type: "git" as const,
      url: "https://example.com/repo.git",
      localPath: "existing-repo",
      options: {} as InputGitOptions,
    };

    const resolved = await resolveGitInclusion(inclusion, "_source-repos", failingDeps);
    assertEquals(resolved.type, "git");
    assertEquals((resolved.options as InputGitOptions).branch, "main"); // Falls back to default branch
  });

  await t.step("handles default branch determination error", async () => {
    const failingDeps = {
      ...mockDeps,
      determineDefaultBranch: async () => {
        throw new Error("Failed to determine default branch");
      },
      directoryExists: async () => false,
    };

    const inclusion = {
      type: "git" as const,
      url: "https://example.com/repo.git",
      options: {} as InputGitOptions,
    };

    await assertRejects(
      () => resolveGitInclusion(inclusion, "_source-repos", failingDeps),
      ConfigError,
      "No localPath provided and could not determine branch"
    );
  });

  await t.step("handles non-existent directories", async () => {
    const nonExistentDeps = {
      ...mockDeps,
      directoryExists: async () => false,
    };

    const inclusion = {
      type: "git" as const,
      url: "https://example.com/repo.git",
      localPath: "non-existent",
      options: {} as InputGitOptions,
    };

    const resolved = await resolveGitInclusion(inclusion, "_source-repos", nonExistentDeps);
    assertEquals(resolved.type, "git");
    assertEquals((resolved as { localPath: string }).localPath, "non-existent");
  });
});
