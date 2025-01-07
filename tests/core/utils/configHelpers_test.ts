// src/core/utils/configHelpers_test.ts

import { assertEquals, assertRejects, assertThrows } from "../../../src/deps/assert.ts";
import {
  mergeConfigs,
  getConfigFilePath,
  loadWeaveConfig,
  handleConfigAction,
  ConfigLoader,
  DefaultConfigLoader,
  setConfigLoader
} from "../../../src/core/utils/configHelpers.ts";
import { InputGlobalOptions, WeaveConfigInput, InputInclusion } from "../../../src/types.ts";
import { ConfigError } from "../../../src/core/errors.ts";
import { assertSpyCalls, spy } from "../../../src/deps/testing.ts";
import * as logger from "../../../src/deps/log.ts";

Deno.test("mergeConfigs", async (t) => {
  await t.step("merges basic configurations", () => {
    const base: WeaveConfigInput = {
      inclusions: [{ type: "git", url: "https://example.com/base.git" }],
      global: { debug: "INFO" }
    };
    const override: Partial<WeaveConfigInput> = {
      inclusions: [{ type: "git", url: "https://example.com/override.git" }],
      global: { debug: "DEBUG" }
    };
    const result = mergeConfigs(base, override);
    assertEquals(result.inclusions, [{ type: "git", url: "https://example.com/override.git" }]);
    assertEquals(result.global.debug, "DEBUG");
  });

  await t.step("keeps base values when override is undefined", () => {
    const base: WeaveConfigInput = {
      inclusions: [{ type: "git", url: "https://example.com/base.git" }],
      global: { debug: "INFO", dest: "./output" }
    };
    const override: Partial<WeaveConfigInput> = {
      global: { debug: undefined }
    };
    const result = mergeConfigs(base, override);
    assertEquals(result.inclusions, [{ type: "git", url: "https://example.com/base.git" }]);
    assertEquals(result.global.dest, "./output");
  });
});

Deno.test("getConfigFilePath", async (t) => {
  const originalRealPath = Deno.realPath;

  try {
    // Mock realPath to simulate file system
    Deno.realPath = async (path: string | URL) => {
      const pathStr = path.toString();
      if (pathStr.includes("existing.json") || pathStr.includes("weave.config.json")) {
        return `/test/${pathStr}`;
      }
      throw new Deno.errors.NotFound(`No such file or directory (os error 2): realpath '${pathStr}'`);
    };

    await t.step("finds specified local config file", async () => {
      const result = await getConfigFilePath("existing.json");
      assertEquals(result, "/test/existing.json");
    });

    await t.step("throws on non-existent specified path", async () => {
      await assertRejects(
        () => getConfigFilePath("nonexistent.json"),
        ConfigError,
        "Config file not found at specified path"
      );
    });

    await t.step("accepts remote JSON and JSONLD URLs", async () => {
      const jsonUrl = "https://example.com/config.json";
      const jsonldUrl = "https://example.com/config.jsonld";

      const jsonResult = await getConfigFilePath(jsonUrl);
      const jsonldResult = await getConfigFilePath(jsonldUrl);

      assertEquals(jsonResult, jsonUrl);
      assertEquals(jsonldResult, jsonldUrl);
    });

    await t.step("rejects non-JSON remote URL", async () => {
      await assertRejects(
        () => getConfigFilePath("https://example.com/config.ts"),
        ConfigError,
        "Remote config must be a JSON file"
      );
    });

    await t.step("searches through default paths", async () => {
      const result = await getConfigFilePath(undefined, ["weave.config.json"]);
      assertEquals(result, "/test/weave.config.json");
    });

    await t.step("throws when no config found in default paths", async () => {
      await assertRejects(
        () => getConfigFilePath(undefined, ["nonexistent.json"]),
        ConfigError,
        "No configuration file found"
      );
    });
  } finally {
    // Restore original realPath
    Deno.realPath = originalRealPath;
  }
});

Deno.test("loadWeaveConfig", async (t) => {
  // Store original functions
  const originalRealPath = Deno.realPath;
  const originalReadTextFile = Deno.readTextFile;

  try {
    // Mock file system operations
    Deno.realPath = async (path: string | URL) => `/test/${path}`;
    Deno.readTextFile = async (path: string | URL) => {
      const pathStr = path.toString();
      if (pathStr.includes("config.json")) {
        return JSON.stringify({
          inclusions: [{ type: "git", url: "https://example.com/test.git" } as InputInclusion],
          global: { debug: "INFO" }
        });
      } else if (pathStr.includes("invalid.json")) {
        return '{ invalid json }';
      } else if (pathStr.includes("missing-inclusions.json")) {
        return '{}';
      }
      throw new Deno.errors.NotFound(`No such file or directory (os error 2): open '${pathStr}'`);
    };

    await t.step("loads local JSON config file", async () => {
      const result = await loadWeaveConfig("config.json");
      const gitInclusion = result.inclusions?.[0] as { type: "git"; url: string };
      assertEquals(gitInclusion.url, "https://example.com/test.git");
      assertEquals(result.global.debug, "INFO");
    });

    await t.step("throws on invalid JSON config", async () => {
      await assertRejects(
        () => loadWeaveConfig("invalid.json"),
        Error,
        "Expected property name or '}' in JSON"
      );
    });

    await t.step("throws on missing inclusions", async () => {
      await assertRejects(
        () => loadWeaveConfig("missing-inclusions.json"),
        ConfigError,
        "'inclusions' must be an array"
      );
    });

    await t.step("throws on unsupported extension", async () => {
      await assertRejects(
        () => loadWeaveConfig("config.yaml"),
        ConfigError,
        "Unsupported config file extension"
      );
    });
  } finally {
    // Restore original functions
    Deno.realPath = originalRealPath;
    Deno.readTextFile = originalReadTextFile;
  }

  await t.step("loads JS/TS config files", async () => {
    // Mock config with valid InputInclusion type
    const mockConfig: WeaveConfigInput = {
      inclusions: [{ type: "git", url: "https://example.com/test.git" } as InputInclusion],
      global: { debug: "INFO" }
    };

    // Create test loader that overrides importModule
    class TestConfigLoader extends DefaultConfigLoader {
      protected override async importModule(filePath: string): Promise<unknown> {
        // Use memory:// protocol to avoid file system resolution
        if (filePath === "memory://valid.js" || filePath === "memory://valid.ts") {
          return { weaveConfig: mockConfig };
        } else if (filePath === "memory://invalid-export.ts") {
          return { someOtherConfig: {} };
        } else if (filePath === "memory://invalid-inclusions.js") {
          return { weaveConfig: { global: { debug: "INFO" } } };
        }
        throw new Error(`Unexpected import path: ${filePath}`);
      }
    }

    try {
      // Set test loader
      setConfigLoader(new TestConfigLoader());

      // Test JS config
      const jsResult = await loadWeaveConfig("memory://valid.js");
      const jsGitInclusion = jsResult.inclusions?.[0] as { type: "git"; url: string };
      assertEquals(jsGitInclusion.url, "https://example.com/test.git");
      assertEquals(jsResult.global.debug, "INFO");

      // Test TS config
      const tsResult = await loadWeaveConfig("memory://valid.ts");
      const tsGitInclusion = tsResult.inclusions?.[0] as { type: "git"; url: string };
      assertEquals(tsGitInclusion.url, "https://example.com/test.git");
      assertEquals(tsResult.global.debug, "INFO");

      // Test invalid export
      await assertRejects(
        () => loadWeaveConfig("memory://invalid-export.ts"),
        ConfigError,
        "Config file does not export 'weaveConfig'"
      );

      // Test invalid inclusions
      await assertRejects(
        () => loadWeaveConfig("memory://invalid-inclusions.js"),
        ConfigError,
        "'inclusions' must be an array"
      );
    } finally {
      // Restore default loader
      setConfigLoader(new DefaultConfigLoader());
    }
  });

});

Deno.test("loadWeaveConfig remote", async (t) => {
  const mockFetch = async (url: string | URL | Request) => {
    const validConfig: WeaveConfigInput = {
      inclusions: [{ type: "git", url: "https://example.com/test.git" } as InputInclusion],
      global: { debug: "INFO" }
    };

    if (url === "https://example.com/valid.json") {
      return new Response(JSON.stringify(validConfig), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } else if (url === "https://example.com/invalid-type.json") {
      return new Response("not json", {
        status: 200,
        headers: { "Content-Type": "text/plain" }
      });
    } else {
      return new Response(null, {
        status: 404,
        statusText: "Not Found"
      });
    }
  };

  // Replace global fetch with mock
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch as typeof fetch;

  await t.step("loads remote JSON config", async () => {
    const result = await loadWeaveConfig("https://example.com/valid.json");
    const gitInclusion = result.inclusions?.[0] as { type: "git"; url: string };
    assertEquals(gitInclusion.url, "https://example.com/test.git");
    assertEquals(result.global.debug, "INFO");
  });

  await t.step("throws on non-JSON content type", async () => {
    await assertRejects(
      () => loadWeaveConfig("https://example.com/invalid-type.json"),
      ConfigError,
      "Remote config must be in JSON format"
    );
  });

  await t.step("throws on failed fetch", async () => {
    await assertRejects(
      () => loadWeaveConfig("https://example.com/nonexistent.json"),
      ConfigError,
      "Failed to fetch config from URL"
    );
  });

  // Restore original fetch
  globalThis.fetch = originalFetch;
});

Deno.test("handleConfigAction", async (t) => {
  await t.step("handles processWeaveConfig errors", async () => {
    const mockProcessConfig = (_options: InputGlobalOptions): Promise<void> =>
      Promise.reject(new Error("Config error"));

    await assertRejects(
      () => handleConfigAction({}, mockProcessConfig),
      Error,
      "Config error"
    );
  });

  await t.step("sets log level from options", async () => {
    const options: InputGlobalOptions = {
      debug: "DEBUG"
    };

    const mockProcessConfig = spy(async (_options: InputGlobalOptions) => { });
    await handleConfigAction(options, mockProcessConfig);

    assertSpyCalls(mockProcessConfig, 1);
  });

  await t.step("handles non-Error objects", async () => {
    const mockProcessConfig = (_options: InputGlobalOptions): Promise<void> => 
      Promise.reject({ message: "string error" });

    await assertRejects(
      () => handleConfigAction({}, mockProcessConfig),
      Error,
      "An unknown error occurred during initialization"
    );
  });

  await t.step("uses default ERROR level when debug is undefined", async () => {
    const options: InputGlobalOptions = {};
    const mockProcessConfig = spy(async (_options: InputGlobalOptions) => { });

    await handleConfigAction(options, mockProcessConfig);
    assertSpyCalls(mockProcessConfig, 1);
  });

  await t.step("handles setLogLevel error", async () => {
    const originalSetLogLevel = logger.getLogger("").levelName;
    logger.getLogger("").levelName = "ERROR"; // Force error state for setLogLevel

    const options: InputGlobalOptions = { debug: "DEBUG" };
    const mockProcessConfig = spy(async (_options: InputGlobalOptions) => { });

    await handleConfigAction(options, mockProcessConfig);
    assertSpyCalls(mockProcessConfig, 1);

    // Restore original log level
    logger.getLogger("").levelName = originalSetLogLevel;
  });
});
