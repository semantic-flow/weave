import { assertEquals } from "../../../../src/deps/assert.ts";
import { spy, assertSpyCalls } from "../../../../src/deps/testing.ts";
import { watchConfigFileWithDeps } from "../../../../src/core/utils/configUtils.ts";
import { ConfigError } from "../../../../src/core/errors.ts";

// Mock data
const mockDeps = {
  determineDefaultBranch: async () => "main",
  determineWorkingBranch: async () => "feature-branch",
  determineDefaultWorkingDirectory: () => "_source-repos/repo",
  directoryExists: async () => true,
  getConfigFilePath: async () => "weave.config.json",
  env: {
    get: () => undefined,
  },
};

Deno.test("watchConfigFile", async (t) => {
  await t.step("handles file modification events", async () => {
    const mockWatcher = {
      async *[Symbol.asyncIterator]() {
        yield { kind: "modify", paths: ["config.json"] };
      },
      return() {
        return Promise.resolve({ value: undefined, done: true });
      }
    };

    const processConfigSpy = spy(async () => {});
    const watcher = Deno.watchFs;

    try {
      // @ts-ignore: Mock Deno.watchFs
      Deno.watchFs = () => mockWatcher;

      const watchPromise = watchConfigFileWithDeps(
        "config.json",
        undefined,
        mockDeps,
        processConfigSpy
      );

      // Wait for events
      await new Promise((resolve) => setTimeout(resolve, 500));

      assertEquals(processConfigSpy.calls.length, 1);

      await mockWatcher.return();
    } finally {
      // @ts-ignore: Restore Deno.watchFs
      Deno.watchFs = watcher;
    }
  });

  await t.step("debounces multiple modifications", async () => {
    const mockWatcher = {
      async *[Symbol.asyncIterator]() {
        yield { kind: "modify", paths: ["config.json"] };
        yield { kind: "modify", paths: ["config.json"] };
        yield { kind: "modify", paths: ["config.json"] };
      },
      return() {
        return Promise.resolve({ value: undefined, done: true });
      }
    };

    const processConfigSpy = spy(async () => {});
    const watcher = Deno.watchFs;

    try {
      // @ts-ignore: Mock Deno.watchFs
      Deno.watchFs = () => mockWatcher;

      const watchPromise = watchConfigFileWithDeps(
        "config.json",
        undefined,
        mockDeps,
        processConfigSpy
      );

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 500));

      assertEquals(processConfigSpy.calls.length, 1);

      await mockWatcher.return();
    } finally {
      // @ts-ignore: Restore Deno.watchFs
      Deno.watchFs = watcher;
    }
  });

  await t.step("handles reload errors", async () => {
    const mockWatcher = {
      async *[Symbol.asyncIterator]() {
        yield { kind: "modify", paths: ["config.json"] };
      },
      return() {
        return Promise.resolve({ value: undefined, done: true });
      }
    };

    const processConfigSpy = spy(async () => {
      throw new ConfigError("Failed to reload config");
    });
    const watcher = Deno.watchFs;

    try {
      // @ts-ignore: Mock Deno.watchFs
      Deno.watchFs = () => mockWatcher;

      const watchPromise = watchConfigFileWithDeps(
        "config.json",
        undefined,
        mockDeps,
        processConfigSpy
      );

      // Wait for events
      await new Promise((resolve) => setTimeout(resolve, 500));

      assertEquals(processConfigSpy.calls.length, 1);

      await mockWatcher.return();
    } finally {
      // @ts-ignore: Restore Deno.watchFs
      Deno.watchFs = watcher;
    }
  });

  await t.step("skips reload when already reloading", async () => {
    const mockWatcher = {
      async *[Symbol.asyncIterator]() {
        yield { kind: "modify", paths: ["config.json"] };
        // Immediate second modification while first is still processing
        yield { kind: "modify", paths: ["config.json"] };
      },
      return() {
        return Promise.resolve({ value: undefined, done: true });
      }
    };

    let reloadCount = 0;
    const processConfigSpy = spy(async () => {
      reloadCount++;
      // First reload takes longer
      if (reloadCount === 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    });

    const watcher = Deno.watchFs;

    try {
      // @ts-ignore: Mock Deno.watchFs
      Deno.watchFs = () => mockWatcher;

      const watchPromise = watchConfigFileWithDeps(
        "config.json",
        undefined,
        mockDeps,
        processConfigSpy
      );

      // Wait for events and processing
      await new Promise((resolve) => setTimeout(resolve, 700));

      assertEquals(processConfigSpy.calls.length, 1);

      await mockWatcher.return();
    } finally {
      // @ts-ignore: Restore Deno.watchFs
      Deno.watchFs = watcher;
    }
  });

  await t.step("ignores non-modify events", async () => {
    const mockWatcher = {
      async *[Symbol.asyncIterator]() {
        yield { kind: "create", paths: ["config.json"] };
        yield { kind: "remove", paths: ["config.json"] };
      },
      return() {
        return Promise.resolve({ value: undefined, done: true });
      }
    };

    const processConfigSpy = spy(async () => {});
    const watcher = Deno.watchFs;

    try {
      // @ts-ignore: Mock Deno.watchFs
      Deno.watchFs = () => mockWatcher;

      const watchPromise = watchConfigFileWithDeps(
        "config.json",
        undefined,
        mockDeps,
        processConfigSpy
      );

      // Wait for events
      await new Promise((resolve) => setTimeout(resolve, 500));

      assertEquals(processConfigSpy.calls.length, 0);

      await mockWatcher.return();
    } finally {
      // @ts-ignore: Restore Deno.watchFs
      Deno.watchFs = watcher;
    }
  });
});
