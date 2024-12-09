// src/core/utils/configUtils_test.ts

import {
  assertEquals,
  assertThrows,
} from "../../deps/assert.ts";
import { composeWeaveConfig, watchConfigFile } from "./configUtils.ts";
import { Frame } from "../Frame.ts";
import { WeaveConfigInput, InputGlobalOptions, WeaveConfig } from "../../types.ts";
import { log } from "../utils/logging.ts";

Deno.test("composeWeaveConfig uses default workspaceDir when not provided", async () => {
  const config = await composeWeaveConfig();
  console.log(`workspaceDir: ${config.global.workspaceDir}`);
  assertEquals(config.global.workspaceDir, "_source-repos");
});

Deno.test("composeWeaveConfig overrides workspaceDir", async () => {
  const config = await composeWeaveConfig({ workspaceDir: "custom_workspace" });
  assertEquals(config.global.workspaceDir, "custom_workspace");
});

// New Test: Preserving Command-Line Options after Config Reload
Deno.test({
  name: "composeWeaveConfig preserves command-line options after config reload",
  fn: async () => {
    // Step 1: Define initial configuration and commandOptions
    const initialConfig: WeaveConfigInput = {
      global: {
        workspaceDir: "_initial_workspace",
        dest: "_woven",
        globalCopyStrategy: "overwrite",
        globalClean: false,
        watchConfig: true,
        configFilePath: "./weave.config.json",
      },
      inclusions: [
        // Define any initial inclusions if necessary
      ],
    };

    const commandOptions: InputGlobalOptions = {
      workspaceDir: "cli_workspace",
      dest: "_cli_dest",
      globalCopyStrategy: "no-overwrite",
      globalClean: true,
      watchConfig: true,
      configFilePath: "./cli_weave.config.json",
      // Add other command-line options as needed
    };

    // Step 2: Initialize Frame with initialConfig and commandOptions
    Frame.resetInstance(); // Ensure Frame is reset before the test
    const frame = Frame.getInstance(initialConfig as unknown as WeaveConfig, commandOptions);

    // Step 3: Mock the `composeWeaveConfig` to return a modified config on reload
    const modifiedConfig: WeaveConfigInput = {
      global: {
        ...initialConfig.global,
        dest: "_new_woven", // Simulate a change in the configuration file
      },
      inclusions: [
        // Modify inclusions if necessary
      ],
    };

    const composeWeaveConfigMock = async (opts?: InputGlobalOptions): Promise<WeaveConfig> => {
      // Ensure that commandOptions are included in the merged configuration
      return {
        ...modifiedConfig,
        global: {
          ...modifiedConfig.global,
          // Correctly spread opts directly as it contains the global properties
          ...opts,
        },
        inclusions: modifiedConfig.inclusions,
      } as WeaveConfig;
    };

    // Step 4: Mock Deno.watchFs to simulate a config file modification
    const fakeWatcher = {
      [Symbol.asyncIterator]: function () {
        let called = false; // Flag to ensure only one event is emitted
        return {
          async next() {
            if (!called) {
              called = true;
              return {
                done: false,
                value: { kind: "modify", paths: ["./cli_weave.config.json"] },
              };
            } else {
              // After emitting once, signal completion
              return { done: true, value: undefined };
            }
          },
        };
      },
    };

    // Save the original Deno.watchFs
    const originalWatchFs = Deno.watchFs;

    // Override Deno.watchFs with the fake watcher
    // @ts-ignore: Overriding Deno.watchFs for testing purposes
    Deno.watchFs = () => fakeWatcher;

    // Step 5: Start watching the config file with the mocked composeWeaveConfig
    await watchConfigFile(frame.config.global.configFilePath, commandOptions, composeWeaveConfigMock);

    // Step 6: Allow some time for the watcher to process the mock event
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Step 7: Retrieve the updated Frame instance
    const updatedFrame = Frame.getInstance();

    // Step 8: Assert that the updated config includes CLI options and modified config
    assertEquals(updatedFrame.config.global.workspaceDir, "cli_workspace"); // From CLI
    assertEquals(updatedFrame.config.global.dest, "_cli_dest"); // Retain CLI option despite change to config file.
    assertEquals(updatedFrame.config.global.globalCopyStrategy, "no-overwrite"); // From CLI
    assertEquals(updatedFrame.config.global.globalClean, true); // From CLI
    assertEquals(updatedFrame.config.global.watchConfig, true); // From CLI

    // Step 9: Restore the original functions to avoid side effects
    Frame.resetInstance();
    // @ts-ignore: Restore original Deno.watchFs
    Deno.watchFs = originalWatchFs;
  },
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

