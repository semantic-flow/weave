import { assertEquals, assertRejects } from "../../../../src/deps/assert.ts";
import { spy, assertSpyCalls, stub } from "../../../../src/deps/testing.ts";
import { Frame } from "../../../../src/core/Frame.ts";
import { ConfigError } from "../../../../src/core/errors.ts";
import { processWeaveConfig, processWeaveConfigWithDeps, watchConfigFile } from "../../../../src/core/utils/configUtils.ts";
import { setConfigLoader } from "../../../../src/core/utils/configHelpers.ts";
import { WeaveConfigInput, CopyStrategy } from "../../../../src/types.ts";
import { log, setLogLevel } from "../../../../src/core/utils/logging.ts";

// Mock config for testing
const mockConfig: WeaveConfigInput = {
  inclusions: [],
  global: {
    configFilePath: "./weave.config.json",
    debug: "DEBUG", // Set to DEBUG to ensure logs are output
    dest: "_woven",
    dryRun: false,
    globalClean: false,
    globalCopyStrategy: "no-overwrite",
    watchConfig: false,
    workspaceDir: "_source-repos",
  },
};

class TestConfigLoader {
  async loadConfig(_filePath: string): Promise<WeaveConfigInput> {
    return mockConfig;
  }
}

Deno.test("processWeaveConfig integration", async (t) => {
  await t.step("reinitializes Frame when already initialized", async () => {
    const originalLevelName = log.levelName;
    let infoSpy;
    let debugSpy;
    try {
      // Set up spies and log level before any operations
      setLogLevel("DEBUG");
      infoSpy = spy(log, "info");
      debugSpy = spy(log, "debug");

      // Set up mock config loader
      setConfigLoader(new TestConfigLoader());

      // Create mock dependencies
      const mockDeps = {
        determineDefaultBranch: () => Promise.resolve("main"),
        determineWorkingBranch: () => Promise.resolve("main"),
        determineDefaultWorkingDirectory: () => "_source-repos/repo",
        directoryExists: () => Promise.resolve(true),
        getConfigFilePath: () => Promise.resolve("weave.config.json"),
        env: {
          get: () => undefined,
        },
      };

      // Create command options
      const commandOptions = {
        debug: "DEBUG",
        dest: "_woven",
        globalClean: false,
        globalCopyStrategy: "no-overwrite" as CopyStrategy,
        watchConfig: false,
        workspaceDir: "_source-repos",
      };

      // First initialization
      await processWeaveConfigWithDeps(mockDeps, commandOptions);
      assertEquals(Frame.isInitialized(), true);

      // Clear spy calls from initialization
      infoSpy.calls.length = 0;
      debugSpy.calls.length = 0;

      // Second call should reinitialize
      await processWeaveConfigWithDeps(mockDeps, commandOptions);

      // Should log about resetting Frame
      assertSpyCalls(infoSpy, 1);
      // Should log debug info about new Frame instance
      assertSpyCalls(debugSpy, 1);
      assertEquals(Frame.isInitialized(), true);
    } finally {
      if (infoSpy) infoSpy.restore();
      if (debugSpy) debugSpy.restore();
      Frame.resetInstance();
      // Restore original log level
      setLogLevel(originalLevelName);
    }
  });

  await t.step("handles errors during processing", async () => {
    class ErrorConfigLoader {
      async loadConfig(_filePath: string): Promise<WeaveConfigInput> {
        throw new Error("Failed to load config");
      }
    }

    setConfigLoader(new ErrorConfigLoader());
    await assertRejects(
      () => processWeaveConfig(),
      ConfigError,
      "Failed to load config"
    );
  });
});

Deno.test("watchConfigFile integration", async (t) => {
  await t.step("sets up watcher with real dependencies", async () => {
    const originalLevelName = log.levelName;
    let infoSpy;
    const originalWatcher = Deno.watchFs;

    try {
      // Set up spies and log level before any operations
      setLogLevel("DEBUG");
      infoSpy = spy(log, "info");

      const mockWatcher = {
        async *[Symbol.asyncIterator]() {
          yield { kind: "modify", paths: ["config.json"] };
        },
        return() {
          return Promise.resolve({ value: undefined, done: true });
        }
      };

      // @ts-ignore: Mock Deno.watchFs
      Deno.watchFs = () => mockWatcher;

      const watchPromise = watchConfigFile("config.json");

      // Wait for setup
      await new Promise((resolve) => setTimeout(resolve, 100));

      assertSpyCalls(infoSpy, 2); // Expect 2 info logs: watching start + file modified

      await mockWatcher.return();
    } finally {
      // @ts-ignore: Restore Deno.watchFs
      if (infoSpy) infoSpy.restore();
      // Restore original watcher and log level
      Deno.watchFs = originalWatcher;
      setLogLevel(originalLevelName);
    }
  });

  await t.step("handles errors during watching", async () => {
    const originalLevelName = log.levelName;
    let errorSpy;
    const originalWatcher = Deno.watchFs;

    try {
      // Set up spies and log level before any operations
      setLogLevel("DEBUG");
      errorSpy = spy(log, "error");

      const mockWatcher = {
        async *[Symbol.asyncIterator]() {
          yield { kind: "modify", paths: ["config.json"] };
        },
        return() {
          return Promise.resolve({ value: undefined, done: true });
        }
      };

      // @ts-ignore: Mock Deno.watchFs
      Deno.watchFs = () => mockWatcher;

      // Set up error-throwing config loader
      class ErrorConfigLoader {
        async loadConfig(_filePath: string): Promise<WeaveConfigInput> {
          throw new Error("Failed to load config");
        }
      }
      setConfigLoader(new ErrorConfigLoader());

      const watchPromise = watchConfigFile("config.json");

      // Wait for error handling
      await new Promise((resolve) => setTimeout(resolve, 500));

      assertSpyCalls(errorSpy, 6); // Expect 6 error logs: 2 sets of (error processing + process failure + reload failure)

      await mockWatcher.return();
    } finally {
      // @ts-ignore: Restore Deno.watchFs
      Deno.watchFs = originalWatcher;
      if (errorSpy) errorSpy.restore();
      // Restore original log level
      setLogLevel(originalLevelName);
    }
  });
});
