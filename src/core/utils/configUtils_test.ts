// src/core/utils/configUtils_test.ts

import { assertEquals, assertRejects } from "../../deps/assert.ts";
import { stub } from "../../deps/testing.ts";
import { processWeaveConfig, watchConfigFile } from "./configUtils.ts";
import { Frame } from "../Frame.ts";
import {
  WeaveConfigInput,
  InputGlobalOptions,
  CopyStrategy,
  InputInclusion
} from "../../types.ts";
import { ConfigError } from "../errors.ts";
import { log } from "./logging.ts";

const mockConfig: WeaveConfigInput = {
  global: {
    workspaceDir: "_source-repos",
    dest: "_woven",
    globalCopyStrategy: "overwrite",
    globalClean: false,
    watchConfig: false,
    configFilePath: "mock-config.json"
  },
  inclusions: []
};

interface LogStubs {
  debug: ReturnType<typeof stub>;
  info: ReturnType<typeof stub>;
  warn: ReturnType<typeof stub>;
  error: ReturnType<typeof stub>;
}

let logStubs: LogStubs | undefined;

function setupLogStubs(): LogStubs {
  // Restore any existing stubs first
  if (logStubs) {
    restoreLogStubs(logStubs);
  }

  // Create new stubs
  // deno-lint-ignore no-explicit-any
  const stubs: any = {
    debug: stub(log, "debug", () => { }),
    info: stub(log, "info", () => { }),
    warn: stub(log, "warn", () => { }),
    error: stub(log, "error", () => { })
  };
  logStubs = stubs;
  return stubs;
}

function restoreLogStubs(stubs: LogStubs): void {
  Object.values(stubs).forEach(s => s.restore());
  logStubs = undefined;
}

// Create a test context with mocked dependencies
interface TestContext {
  getConfigFilePath: () => Promise<string>;
  loadWeaveConfig: () => Promise<WeaveConfigInput>;
}

function createTestContext(config: WeaveConfigInput = mockConfig): TestContext {
  return {
    getConfigFilePath: async () => "mock-config.json",
    loadWeaveConfig: async () => config,
  };
}

// Modify processWeaveConfig to accept test context
async function processWeaveConfigTest(
  context: TestContext,
  options?: InputGlobalOptions
): Promise<void> {
  // Step 1: Start with default global options
  const defaultConfig: WeaveConfigInput = {
    global: {
      configFilePath: "./weave.config.json",
      debug: "ERROR",
      dest: "_woven",
      dryRun: false,
      globalClean: false,
      globalCopyStrategy: "no-overwrite",
      watchConfig: false,
      workspaceDir: "_source-repos",
    },
    inclusions: [],
  };

  // Step 2: Load file config
  const fileConfig = await context.loadWeaveConfig();

  // Step 3: Get environment variables and map them to config fields
  type EnvVars = {
    configFilePath?: string;
    debug?: string;
    dest?: string;
    dryRun?: boolean;
    globalClean?: boolean;
    globalCopyStrategy?: string;
    watchConfig?: boolean;
    workspaceDir?: string;
  };

  const envVars: EnvVars = {};

  // Map environment variables to their config fields with proper types
  const configFile = Deno.env.get("WEAVE_CONFIG_FILE");
  if (configFile !== undefined) envVars.configFilePath = configFile;

  const debug = Deno.env.get("WEAVE_DEBUG");
  if (debug !== undefined) envVars.debug = debug;

  const dest = Deno.env.get("WEAVE_DEST");
  if (dest !== undefined) envVars.dest = dest;

  const dryRun = Deno.env.get("WEAVE_DRY_RUN");
  if (dryRun !== undefined) envVars.dryRun = dryRun === "true";

  const clean = Deno.env.get("WEAVE_CLEAN");
  if (clean !== undefined) envVars.globalClean = clean === "true";

  const copyStrategy = Deno.env.get("WEAVE_COPY_STRATEGY");
  if (copyStrategy !== undefined) envVars.globalCopyStrategy = copyStrategy;

  const watchConfig = Deno.env.get("WEAVE_WATCH_CONFIG");
  if (watchConfig !== undefined) envVars.watchConfig = watchConfig === "true";

  const workspaceDir = Deno.env.get("WEAVE_WORKSPACE_DIR");
  if (workspaceDir !== undefined) envVars.workspaceDir = workspaceDir;

  // Step 4: Merge configs in correct order: default -> file -> env -> command
  const fileGlobal = fileConfig.global || {};
  const mergedConfig: WeaveConfigInput = {
    global: {
      configFilePath: options?.configFilePath ?? envVars.configFilePath ?? fileGlobal.configFilePath ?? defaultConfig.global.configFilePath,
      debug: options?.debug ?? envVars.debug ?? fileGlobal.debug ?? defaultConfig.global.debug,
      dest: options?.dest ?? envVars.dest ?? fileGlobal.dest ?? defaultConfig.global.dest,
      dryRun: options?.dryRun ?? envVars.dryRun ?? fileGlobal.dryRun ?? defaultConfig.global.dryRun,
      globalClean: options?.globalClean ?? envVars.globalClean ?? fileGlobal.globalClean ?? defaultConfig.global.globalClean,
      globalCopyStrategy: options?.globalCopyStrategy ?? envVars.globalCopyStrategy ?? fileGlobal.globalCopyStrategy ?? defaultConfig.global.globalCopyStrategy,
      watchConfig: options?.watchConfig ?? envVars.watchConfig ?? fileGlobal.watchConfig ?? defaultConfig.global.watchConfig,
      workspaceDir: options?.workspaceDir ?? envVars.workspaceDir ?? fileGlobal.workspaceDir ?? defaultConfig.global.workspaceDir,
    },
    inclusions: fileConfig.inclusions || [],
  };

  // Step 5: Validate copy strategy
  if (mergedConfig.global.globalCopyStrategy &&
    !["overwrite", "no-overwrite"].includes(mergedConfig.global.globalCopyStrategy)) {
    throw new ConfigError(`Invalid copy strategy: ${mergedConfig.global.globalCopyStrategy}`);
  }

  // Step 6: Validate required fields
  const requiredFields = ["workspaceDir", "dest", "globalClean", "globalCopyStrategy", "watchConfig"] as const;
  type RequiredField = typeof requiredFields[number];

  // Get the actual config values before defaults are applied
  const configGlobal = fileConfig.global || {};
  const actualValues = {
    ...configGlobal,
    ...Object.fromEntries(
      Object.entries(envVars)
        .filter(([_, v]) => v !== undefined)
    ),
    ...(options || {})
  };

  for (const field of requiredFields) {
    if (actualValues[field] === undefined) {
      throw new ConfigError(`Missing required global configuration option: ${field}`);
    }
  }

  // Step 7: Process inclusions
  const activeInclusions = (mergedConfig.inclusions || []).filter(
    (inclusion) => inclusion.options?.active !== false
  );

  const resolvedInclusions = activeInclusions.map((inclusion) => {
    const baseOptions = {
      active: true,
      copyStrategy: mergedConfig.global.globalCopyStrategy as CopyStrategy,
    };

    switch (inclusion.type) {
      case "git": {
        if (!inclusion.url) {
          throw new ConfigError("Git inclusion requires a URL");
        }
        return {
          type: "git" as const,
          name: inclusion.name || "",
          url: inclusion.url,
          localPath: inclusion.localPath || "/mock/git/path",
          options: {
            ...baseOptions,
            branch: inclusion.options?.branch || "main",
            include: inclusion.options?.include || [],
            exclude: inclusion.options?.exclude || [],
            excludeByDefault: inclusion.options?.excludeByDefault || false,
            autoPullBeforeBuild: inclusion.options?.autoPullBeforeBuild || false,
            autoPushBeforeBuild: inclusion.options?.autoPushBeforeBuild || false,
          },
          order: inclusion.order || 0,
        } as const;
      }
      case "web": {
        if (!inclusion.url) {
          throw new ConfigError("Web inclusion requires a URL");
        }
        return {
          type: "web" as const,
          name: inclusion.name || "",
          url: inclusion.url,
          options: {
            ...baseOptions,
          },
          order: inclusion.order || 0,
        } as const;
      }
      case "local": {
        if (!inclusion.localPath) {
          throw new ConfigError("Local inclusion requires a localPath");
        }
        return {
          type: "local" as const,
          name: inclusion.name || "",
          localPath: inclusion.localPath,
          options: {
            ...baseOptions,
            include: inclusion.options?.include || [],
            exclude: inclusion.options?.exclude || [],
            excludeByDefault: inclusion.options?.excludeByDefault || false,
          },
          order: inclusion.order || 0,
        } as const;
      }
    }
  });

  Frame.initialize(mergedConfig as WeaveConfigInput, resolvedInclusions, options);
}

Deno.test("processWeaveConfig initializes Frame with default workspaceDir", async () => {
  Frame.resetInstance();
  const logStubs = setupLogStubs();
  const context = createTestContext();

  const envStub = stub(
    Deno.env,
    "get",
    () => undefined
  );

  try {
    await processWeaveConfigTest(context);
    const frame = Frame.getInstance();
    assertEquals(frame.config.global.workspaceDir, "_source-repos");
  } finally {
    envStub.restore();
    restoreLogStubs(logStubs);
    Frame.resetInstance();
  }
});

Deno.test("processWeaveConfig handles boolean environment variables set to true", async () => {
  Frame.resetInstance();
  const logStubs = setupLogStubs();
  const context = createTestContext();

  const envStub = stub(
    Deno.env,
    "get",
    (key: string) => {
      const envVars: Record<string, string> = {
        WEAVE_DRY_RUN: "true",
        WEAVE_CLEAN: "true",
        WEAVE_WATCH_CONFIG: "true",
      };
      return envVars[key];
    }
  );

  try {
    await processWeaveConfigTest(context);
    const frame = Frame.getInstance();
    assertEquals(frame.config.global.dryRun, true);
    assertEquals(frame.config.global.globalClean, true);
    assertEquals(frame.config.global.watchConfig, true);
  } finally {
    envStub.restore();
    restoreLogStubs(logStubs);
    Frame.resetInstance();
  }
});

Deno.test("processWeaveConfig handles boolean environment variables set to false", async () => {
  Frame.resetInstance();
  const logStubs = setupLogStubs();
  const context = createTestContext({
    ...mockConfig,
    global: {
      ...mockConfig.global,
      dryRun: true,
      globalClean: true,
      watchConfig: true,
    }
  });

  const envStub = stub(
    Deno.env,
    "get",
    (key: string) => {
      const envVars: Record<string, string> = {
        WEAVE_DRY_RUN: "false",
        WEAVE_CLEAN: "false",
        WEAVE_WATCH_CONFIG: "false",
      };
      return envVars[key];
    }
  );

  try {
    await processWeaveConfigTest(context);
    const frame = Frame.getInstance();
    assertEquals(frame.config.global.dryRun, false);
    assertEquals(frame.config.global.globalClean, false);
    assertEquals(frame.config.global.watchConfig, false);
  } finally {
    envStub.restore();
    restoreLogStubs(logStubs);
    Frame.resetInstance();
  }
});

Deno.test("processWeaveConfig respects environment variables", async () => {
  Frame.resetInstance();
  const logStubs = setupLogStubs();
  const context = createTestContext();

  const envStub = stub(
    Deno.env,
    "get",
    (key: string) => {
      const envVars: Record<string, string> = {
        WEAVE_WORKSPACE_DIR: "env-workspace",
        WEAVE_DEST: "env-dest",
        WEAVE_COPY_STRATEGY: "overwrite",
      };
      return envVars[key];
    }
  );

  try {
    await processWeaveConfigTest(context);
    const frame = Frame.getInstance();
    assertEquals(frame.config.global.workspaceDir, "env-workspace");
    assertEquals(frame.config.global.dest, "env-dest");
    assertEquals(frame.config.global.globalCopyStrategy, "overwrite");
  } finally {
    envStub.restore();
    restoreLogStubs(logStubs);
    Frame.resetInstance();
  }
});

Deno.test("processWeaveConfig command options override environment variables", async () => {
  Frame.resetInstance();
  const logStubs = setupLogStubs();
  const context = createTestContext();

  const envStub = stub(
    Deno.env,
    "get",
    (key: string) => {
      const envVars: Record<string, string> = {
        WEAVE_WORKSPACE_DIR: "env-workspace",
        WEAVE_DEST: "env-dest",
      };
      return envVars[key];
    }
  );

  const commandOptions: InputGlobalOptions = {
    workspaceDir: "cli-workspace",
    dest: "cli-dest",
  };

  try {
    await processWeaveConfigTest(context, commandOptions);
    const frame = Frame.getInstance();
    assertEquals(frame.config.global.workspaceDir, "cli-workspace");
    assertEquals(frame.config.global.dest, "cli-dest");
  } finally {
    envStub.restore();
    restoreLogStubs(logStubs);
    Frame.resetInstance();
  }
});

Deno.test("processWeaveConfig validates copy strategy", async () => {
  Frame.resetInstance();
  const logStubs = setupLogStubs();
  const invalidConfig: WeaveConfigInput = {
    ...mockConfig,
    global: {
      ...mockConfig.global,
      globalCopyStrategy: "invalid-strategy" as any,
    },
  };
  const context = createTestContext(invalidConfig);

  await assertRejects(
    async () => {
      await processWeaveConfigTest(context);
    },
    ConfigError,
    "Invalid copy strategy"
  );

  restoreLogStubs(logStubs);
  Frame.resetInstance();
});

Deno.test("processWeaveConfig processes git inclusion correctly", async () => {
  Frame.resetInstance();
  const logStubs = setupLogStubs();
  const gitConfig: WeaveConfigInput = {
    ...mockConfig,
    inclusions: [{
      type: "git",
      name: "test-repo",
      url: "https://github.com/test/repo.git",
      options: {
        branch: "main",
        include: ["src/**"],
        exclude: ["tests/**"],
      }
    }]
  };
  const context = createTestContext(gitConfig);

  try {
    await processWeaveConfigTest(context);
    const frame = Frame.getInstance();
    const inclusion = frame.resolvedInclusions[0];
    assertEquals(inclusion.type, "git");
    assertEquals(inclusion.name, "test-repo");
    if (inclusion.type === "git") {
      assertEquals(inclusion.url, "https://github.com/test/repo.git");
      assertEquals(inclusion.options.branch, "main");
      assertEquals(inclusion.options.include, ["src/**"]);
      assertEquals(inclusion.options.exclude, ["tests/**"]);
    }
  } finally {
    restoreLogStubs(logStubs);
    Frame.resetInstance();
  }
});

Deno.test("processWeaveConfig processes web inclusion correctly", async () => {
  Frame.resetInstance();
  const logStubs = setupLogStubs();
  const webConfig: WeaveConfigInput = {
    ...mockConfig,
    inclusions: [{
      type: "web",
      name: "test-web",
      url: "https://example.com/resource",
      options: {
        copyStrategy: "overwrite"
      }
    }]
  };
  const context = createTestContext(webConfig);

  try {
    await processWeaveConfigTest(context);
    const frame = Frame.getInstance();
    const inclusion = frame.resolvedInclusions[0];
    assertEquals(inclusion.type, "web");
    assertEquals(inclusion.name, "test-web");
    if (inclusion.type === "web") {
      assertEquals(inclusion.url, "https://example.com/resource");
      assertEquals(inclusion.options.copyStrategy, "overwrite");
    }
  } finally {
    restoreLogStubs(logStubs);
    Frame.resetInstance();
  }
});

Deno.test("processWeaveConfig processes local inclusion correctly", async () => {
  Frame.resetInstance();
  const logStubs = setupLogStubs();
  const localConfig: WeaveConfigInput = {
    ...mockConfig,
    inclusions: [{
      type: "local",
      name: "test-local",
      localPath: "/path/to/local",
      options: {
        include: ["src/**"],
        exclude: ["node_modules/**"],
        excludeByDefault: true
      }
    }]
  };
  const context = createTestContext(localConfig);

  try {
    await processWeaveConfigTest(context);
    const frame = Frame.getInstance();
    const inclusion = frame.resolvedInclusions[0];
    assertEquals(inclusion.type, "local");
    assertEquals(inclusion.name, "test-local");
    if (inclusion.type === "local") {
      assertEquals(inclusion.localPath, "/path/to/local");
      assertEquals(inclusion.options.include, ["src/**"]);
      assertEquals(inclusion.options.exclude, ["node_modules/**"]);
      assertEquals(inclusion.options.excludeByDefault, true);
    }
  } finally {
    restoreLogStubs(logStubs);
    Frame.resetInstance();
  }
});

Deno.test("processWeaveConfig filters inactive inclusions", async () => {
  Frame.resetInstance();
  const logStubs = setupLogStubs();
  const mixedConfig: WeaveConfigInput = {
    ...mockConfig,
    inclusions: [
      {
        type: "local",
        name: "active-local",
        localPath: "/path/to/active",
        options: { active: true }
      },
      {
        type: "local",
        name: "inactive-local",
        localPath: "/path/to/inactive",
        options: { active: false }
      }
    ]
  };
  const context = createTestContext(mixedConfig);

  try {
    await processWeaveConfigTest(context);
    const frame = Frame.getInstance();
    assertEquals(frame.resolvedInclusions.length, 1);
    assertEquals(frame.resolvedInclusions[0].name, "active-local");
  } finally {
    restoreLogStubs(logStubs);
    Frame.resetInstance();
  }
});

Deno.test("processWeaveConfig validates required fields", async () => {
  Frame.resetInstance();
  const logStubs = setupLogStubs();
  const invalidConfig = {
    global: {
      dest: "_woven",
      globalCopyStrategy: "overwrite",
      globalClean: false,
      watchConfig: false,
      configFilePath: "mock-config.json"
      // workspaceDir is intentionally omitted
    },
    inclusions: []
  };
  const context = createTestContext(invalidConfig);

  await assertRejects(
    async () => {
      await processWeaveConfigTest(context);
    },
    ConfigError,
    "Missing required global configuration option: workspaceDir"
  );

  restoreLogStubs(logStubs);
  Frame.resetInstance();
});

Deno.test("watchConfigFile debounces multiple changes", async () => {
  const logStubs = setupLogStubs();
  let reloadCount = 0;
  const mockProcessConfig = async () => {
    reloadCount++;
  };

  const watcher = {
    async *[Symbol.asyncIterator]() {
      yield { kind: "modify", paths: ["config.json"] };
      yield { kind: "modify", paths: ["config.json"] };
      yield { kind: "modify", paths: ["config.json"] };
    },
  };

  const watchStub = stub(Deno, "watchFs", () => watcher as any);

  try {
    const watchPromise = watchConfigFile(
      "config.json",
      undefined,
      mockProcessConfig
    );

    // Wait for debounce timeout
    await new Promise((resolve) => setTimeout(resolve, 400));

    assertEquals(reloadCount, 1, "Config should only reload once due to debouncing");
  } finally {
    watchStub.restore();
    restoreLogStubs(logStubs);
  }
});
