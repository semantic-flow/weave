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

interface TestTmpScope {
  readonly paths: string[];
}

interface IsolatedTestEnv {
  restore(): void;
}

let activeScope: TestTmpScope | undefined;
let activeIsolatedEnv: IsolatedTestEnv | undefined;
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

  Deno.test.beforeEach(async () => {
    const scope: TestTmpScope = { paths: [] };
    activeScope = scope;
    activeIsolatedEnv = await installIsolatedTestEnv();
  });

  Deno.test.afterEach(async () => {
    const scope = activeScope;
    const isolatedEnv = activeIsolatedEnv;
    activeScope = undefined;
    activeIsolatedEnv = undefined;

    let restoreError: unknown;
    try {
      isolatedEnv?.restore();
    } catch (error) {
      restoreError = error;
    }

    let cleanupError: unknown;
    if (!shouldKeepTestTmp()) {
      try {
        await cleanupTestTmpPaths(scope?.paths ?? []);
      } catch (error) {
        cleanupError = error;
      }
    }

    if (restoreError !== undefined && cleanupError !== undefined) {
      throw new AggregateError(
        [restoreError, cleanupError],
        "Test environment restore and temporary directory cleanup both failed.",
      );
    }
    if (restoreError !== undefined) {
      throw restoreError;
    }
    if (cleanupError !== undefined) {
      throw cleanupError;
    }
  });
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

// Install on import so direct `deno test <file>` and IDE test runners clean up
// tests that use `createTestTmpDir`, even when they bypass the task preload.
installTestTmpCleanup();
