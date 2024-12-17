// src/core/utils/configUtils_test.ts

import {
  assertEquals,
  assertRejects,
} from "../../deps/assert.ts";
import { processWeaveConfig, watchConfigFile } from "./configUtils.ts";
import { Frame } from "../Frame.ts";
import { WeaveConfigInput, InputGlobalOptions } from "../../types.ts";

Deno.test("processWeaveConfig initializes Frame with default workspaceDir", async () => {
  // Ensure Frame is reset before the test
  Frame.resetInstance();

  await processWeaveConfig();

  const frame = Frame.getInstance();
  assertEquals(frame.config.global.workspaceDir, "_source-repos");
});

Deno.test("processWeaveConfig allows overriding workspaceDir", async () => {
  Frame.resetInstance();

  await processWeaveConfig({ workspaceDir: "custom_workspace" });

  const frame = Frame.getInstance();
  assertEquals(frame.config.global.workspaceDir, "custom_workspace");
});

// New Test: Preserving Command-Line Options after Config Reload
Deno.test({
  name: "processWeaveConfig preserves command-line options after config reload",
  fn: async () => {
    const initialConfig: WeaveConfigInput = {
      global: {
        workspaceDir: "_initial_workspace",
        dest: "_woven",
        globalCopyStrategy: "overwrite",
        globalClean: false,
        watchConfig: true,
        configFilePath: "./weave.config.json",
      },
      inclusions: [],
    };

    const commandOptions: InputGlobalOptions = {
      workspaceDir: "cli_workspace",
      dest: "_cli_dest",
      globalCopyStrategy: "no-overwrite",
      globalClean: true,
      watchConfig: true,
      configFilePath: "./cli_weave.config.json",
    };

    Frame.resetInstance();
    Frame.initialize(initialConfig, [], commandOptions);

    const modifiedConfig: WeaveConfigInput = {
      global: {
        ...initialConfig.global,
        dest: "_new_woven",
      },
      inclusions: [],
    };

    const processWeaveConfigMock = async (commandOpts?: InputGlobalOptions): Promise<void> => {
      await Promise.resolve(); // for consistency with the real function

      // Combine the current configuration with any command-line options provided
      const mergedConfig: WeaveConfigInput = {
        global: {
          ...modifiedConfig.global,
          ...commandOpts,
        },
        inclusions: modifiedConfig.inclusions,
      };

      // Create an updated Frame with the merged configuration

      Frame.resetInstance();
      Frame.initialize(mergedConfig, [], commandOpts);

    };

    const fakeWatcher = {
      [Symbol.asyncIterator]: function () {
        let called = false;
        return {
          async next() {
            await Promise.resolve(); // for consistency with the real function

            if (!called) {
              called = true;
              return {
                done: false,
                value: { kind: "modify", paths: ["./cli_weave.config.json"] },
              };
            } else {
              return { done: true, value: undefined };
            }
          },
        };
      },
    };

    const originalWatchFs = Deno.watchFs;
    Deno.watchFs = () => fakeWatcher as unknown as Deno.FsWatcher;

    try {
      await watchConfigFile(commandOptions.configFilePath!, commandOptions, processWeaveConfigMock);
      await new Promise((resolve) => setTimeout(resolve, 500));

      const updatedFrame = Frame.getInstance();

      assertEquals(updatedFrame.config.global.workspaceDir, "cli_workspace");
      assertEquals(updatedFrame.config.global.dest, "_cli_dest");
      assertEquals(updatedFrame.config.global.globalCopyStrategy, "no-overwrite");
      assertEquals(updatedFrame.config.global.globalClean, true);
      assertEquals(updatedFrame.config.global.watchConfig, true);
    } finally {
      Frame.resetInstance();
      Deno.watchFs = originalWatchFs;
    }
  },
});

Deno.test("loadWeaveConfig throws error on missing inclusions", async () => {
  const mockReadTextFile = async (filePath: string): Promise<string> => {
    await Promise.resolve(); // for consistency with the real function

    if (filePath === "faulty.json") {
      return JSON.stringify({
        global: {
          workspaceDir: "_faulty_workspace",
          dest: "_faulty_dest",
          globalCopyStrategy: "overwrite",
          globalClean: false,
        },
      });
    }
    throw new Error("Unexpected file path");
  };

  const originalReadTextFile = Deno.readTextFile;

  // deno-lint-ignore no-explicit-any
  (Deno as any).readTextFile = mockReadTextFile;

  try {
    const { loadWeaveConfig } = await import("./configHelpers.ts");

    await assertRejects(
      async () => {
        await loadWeaveConfig("faulty.json");
      },
      Error,
      "'inclusions' must be an array in the configuration file."
    );
  } finally {
    // deno-lint-ignore no-explicit-any
    (Deno as any).readTextFile = originalReadTextFile;
  }
});