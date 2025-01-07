// src/core/Frame_test.ts

import {
  assertEquals,
  assertThrows,
} from "../../src/deps/assert.ts";
import { Frame } from "../../src/core/Frame.ts";
import { ValidationError } from "../../src/core/errors.ts";
import { WeaveConfigInput, InputGlobalOptions } from "../../src/types.ts";

const createMockConfig = (): WeaveConfigInput => ({
  global: {
    workspaceDir: "_test_workspace",
    dest: "_test_dest",
    globalCopyStrategy: "overwrite",
    globalClean: false,
    watchConfig: false,
    configFilePath: "test.config.json",
  },
  inclusions: [],
});

const createMockCommandOptions = (): InputGlobalOptions => ({
  workspaceDir: "cli_workspace",
  dest: "cli_dest",
  globalCopyStrategy: "no-overwrite",
  globalClean: true,
  watchConfig: true,
  configFilePath: "cli.config.json",
});

// Reset Frame before each test
const resetFrameBeforeTest = () => {
  Frame.resetInstance();
};

Deno.test("Frame initialization creates singleton instance", () => {
  resetFrameBeforeTest();
  
  const config = createMockConfig();
  Frame.initialize(config, []);
  
  const instance = Frame.getInstance();
  assertEquals(instance.config, config);
  assertEquals(instance.resolvedInclusions, []);
  assertEquals(instance.commandOptions, undefined);
});

Deno.test("Frame prevents multiple initializations", () => {
  resetFrameBeforeTest();
  
  const config = createMockConfig();
  Frame.initialize(config, []);
  
  assertThrows(
    () => Frame.initialize(config, []),
    ValidationError,
    "Frame has already been initialized"
  );
});

Deno.test("Frame.getInstance throws when accessing uninitialized instance", () => {
  resetFrameBeforeTest();
  
  assertThrows(
    () => Frame.getInstance(),
    ValidationError,
    "Frame has not been initialized yet"
  );
});

Deno.test("Frame.isInitialized returns correct state", () => {
  resetFrameBeforeTest();
  assertEquals(Frame.isInitialized(), false);
  
  const config = createMockConfig();
  Frame.initialize(config, []);
  assertEquals(Frame.isInitialized(), true);
  
  Frame.resetInstance();
  assertEquals(Frame.isInitialized(), false);
});

Deno.test("Frame properly stores command options", () => {
  resetFrameBeforeTest();
  
  const config = createMockConfig();
  const commandOptions = createMockCommandOptions();
  Frame.initialize(config, [], commandOptions);
  
  const instance = Frame.getInstance();
  assertEquals(instance.commandOptions, commandOptions);
});

Deno.test("Frame.resetInstance clears the singleton", () => {
  resetFrameBeforeTest();
  
  const config = createMockConfig();
  Frame.initialize(config, []);
  assertEquals(Frame.isInitialized(), true);
  
  Frame.resetInstance();
  assertEquals(Frame.isInitialized(), false);
  
  // Should be able to initialize again after reset
  Frame.initialize(config, []);
  assertEquals(Frame.isInitialized(), true);
});

Deno.test("Frame properly stores resolved inclusions", () => {
  resetFrameBeforeTest();
  
  const config = createMockConfig();
  const mockInclusions = [
    {
      type: "web" as const,
      name: "test-inclusion",
      url: "https://test.com/repo.git",
      options: {
        active: true,
        copyStrategy: "overwrite" as const,
      },
      order: 1,
    },
  ];
  
  Frame.initialize(config, mockInclusions);
  const instance = Frame.getInstance();
  assertEquals(instance.resolvedInclusions, mockInclusions);
});
