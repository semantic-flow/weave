const keepTestTmpEnvVar = "WEAVE_KEEP_TEST_TMP";
const isolatedEnvVars = [
  "HOME",
  "USERPROFILE",
  "WEAVE_SETTINGS",
  "WEAVE_LOG_DIR",
  "XDG_CONFIG_HOME",
  "XDG_STATE_HOME",
  "XDG_CACHE_HOME",
] as const;

type TestFn = (t: Deno.TestContext) => void | Promise<void>;

interface TestTmpScope {
  readonly paths: string[];
}

interface IsolatedTestEnv {
  restore(): void;
}

interface DenoTestDefinitionLike {
  readonly fn: TestFn;
  readonly [key: string]: unknown;
}

interface MutableDenoTest {
  test: typeof Deno.test;
}

let activeScope: TestTmpScope | undefined;
let cleanupInstalled = false;

export async function createTestTmpDir(prefix: string): Promise<string> {
  const path = await Deno.makeTempDir({ prefix });
  activeScope?.paths.push(path);
  return path;
}

export function installTestTmpCleanup(): void {
  if (cleanupInstalled) {
    return;
  }
  cleanupInstalled = true;

  const originalTest = Deno.test;
  const callOriginalTest = originalTest as unknown as (
    ...args: unknown[]
  ) => void;

  const mutableDeno = Deno as unknown as MutableDenoTest;
  mutableDeno.test = ((...args: unknown[]) => {
    if (isTestFn(args[0])) {
      callOriginalTest(wrapTestFn(args[0]));
      return;
    }
    if (typeof args[0] === "string" && isTestFn(args[1])) {
      callOriginalTest(args[0], wrapTestFn(args[1]));
      return;
    }
    if (typeof args[0] === "string" && isTestFn(args[2])) {
      callOriginalTest(args[0], args[1], wrapTestFn(args[2]));
      return;
    }
    if (isDenoTestDefinitionLike(args[0])) {
      callOriginalTest({
        ...args[0],
        fn: wrapTestFn(args[0].fn),
      });
      return;
    }

    callOriginalTest(...args);
  }) as typeof Deno.test;
}

function wrapTestFn(fn: TestFn): TestFn {
  return async (t) => {
    const previousScope = activeScope;
    const scope: TestTmpScope = { paths: [] };
    activeScope = scope;

    let isolatedEnv: IsolatedTestEnv | undefined;
    let testError: unknown;
    try {
      isolatedEnv = await installIsolatedTestEnv();
      await fn(t);
    } catch (error) {
      testError = error;
    } finally {
      try {
        isolatedEnv?.restore();
      } catch (error) {
        testError ??= error;
      }
      activeScope = previousScope;
    }

    let cleanupError: unknown;
    if (!shouldKeepTestTmp()) {
      try {
        await cleanupTestTmpPaths(scope.paths);
      } catch (error) {
        cleanupError = error;
      }
    }

    if (testError !== undefined && cleanupError !== undefined) {
      throw new AggregateError(
        [testError, cleanupError],
        "Test failed and temporary directory cleanup also failed.",
      );
    }
    if (testError !== undefined) {
      throw testError;
    }
    if (cleanupError !== undefined) {
      throw cleanupError;
    }
  };
}

async function installIsolatedTestEnv(): Promise<IsolatedTestEnv | undefined> {
  if (!canMutateEnv()) {
    return undefined;
  }

  const previous = new Map<string, string | undefined>();
  for (const name of isolatedEnvVars) {
    previous.set(name, Deno.env.get(name));
  }

  const root = await createTestTmpDir("weave-test-env-");
  await Deno.mkdir(`${root}/home`, { recursive: true });
  Deno.env.set("HOME", `${root}/home`);
  Deno.env.delete("USERPROFILE");
  Deno.env.set("WEAVE_SETTINGS", `${root}/settings`);
  Deno.env.delete("WEAVE_LOG_DIR");
  Deno.env.set("XDG_CONFIG_HOME", `${root}/config`);
  Deno.env.set("XDG_STATE_HOME", `${root}/state`);
  Deno.env.set("XDG_CACHE_HOME", `${root}/cache`);

  return {
    restore() {
      for (const [name, value] of previous) {
        if (value === undefined) {
          Deno.env.delete(name);
        } else {
          Deno.env.set(name, value);
        }
      }
    },
  };
}

function canMutateEnv(): boolean {
  try {
    return Deno.permissions.querySync({ name: "env" }).state === "granted";
  } catch {
    return false;
  }
}

async function cleanupTestTmpPaths(paths: readonly string[]): Promise<void> {
  for (const path of [...paths].reverse()) {
    try {
      await Deno.remove(path, { recursive: true });
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }
  }
}

function shouldKeepTestTmp(): boolean {
  const envPermission = Deno.permissions.querySync({
    name: "env",
    variable: keepTestTmpEnvVar,
  });
  if (envPermission.state !== "granted") {
    return false;
  }

  const value = Deno.env.get(keepTestTmpEnvVar)?.toLowerCase();
  return value === "1" || value === "true";
}

function isDenoTestDefinitionLike(
  value: unknown,
): value is DenoTestDefinitionLike {
  return value !== null &&
    typeof value === "object" &&
    typeof (value as { readonly fn?: unknown }).fn === "function";
}

function isTestFn(value: unknown): value is TestFn {
  return typeof value === "function";
}

// Install on import so direct `deno test <file>` and IDE test runners clean up
// tests that use `createTestTmpDir`, even when they bypass the task preload.
installTestTmpCleanup();
