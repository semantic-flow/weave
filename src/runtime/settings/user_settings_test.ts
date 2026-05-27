import { assertEquals, assertStringIncludes } from "@std/assert";
import { join, resolve } from "@std/path";
import {
  deriveMeshSettingsIdentity,
  renderHostLocalAccessProfileTurtle,
  renderUserSettingsTurtle,
  resolveUserSettingsPaths,
} from "./user_settings.ts";

Deno.test("deriveMeshSettingsIdentity canonicalizes mesh base and builds slug-plus-hash identifier", async () => {
  const identity = await deriveMeshSettingsIdentity(
    "HTTPS://Semantic-Flow.GitHub.io:443/mesh-alice-bio?utm=1#section",
  );

  assertEquals(
    identity.canonicalMeshBase,
    "https://semantic-flow.github.io/mesh-alice-bio/",
  );
  assertEquals(identity.displaySlug, "mesh-alice-bio");
  assertEquals(identity.meshIdentifier, "mesh-alice-bio-c1ae9fd58757");
});

Deno.test("deriveMeshSettingsIdentity uses sanitized host fallback for host-root mesh bases", async () => {
  const identity = await deriveMeshSettingsIdentity("https://example.org/");

  assertEquals(identity.displaySlug, "example-org");
  assertEquals(identity.meshIdentifier, "example-org-8198d1bac40a");
});

Deno.test("deriveMeshSettingsIdentity normalizes default ports, trailing slashes, and encoded path labels", async () => {
  const withDefaultPort = await deriveMeshSettingsIdentity(
    "https://EXAMPLE.org:443/Data%20Mesh",
  );
  const withoutDefaultPort = await deriveMeshSettingsIdentity(
    "https://example.org/Data%20Mesh/",
  );

  assertEquals(
    withDefaultPort.canonicalMeshBase,
    "https://example.org/Data%20Mesh/",
  );
  assertEquals(withDefaultPort.displaySlug, "data-mesh");
  assertEquals(withDefaultPort, withoutDefaultPort);
});

Deno.test("resolveUserSettingsPaths honors WEAVE_SETTINGS and resolves mesh-scoped settings, logs, and cache paths", async () => {
  const settingsRoot = "/tmp/weave-settings";
  const stateRoot = "/tmp/weave-state";
  const cacheRoot = "/tmp/weave-cache";
  const paths = await resolveUserSettingsPaths("https://example.org/mesh/", {
    env: {
      WEAVE_SETTINGS: settingsRoot,
      XDG_STATE_HOME: stateRoot,
      XDG_CACHE_HOME: cacheRoot,
      HOME: "/home/alice",
    },
  });

  assertEquals(paths.settingsRoot, resolve(settingsRoot));
  assertEquals(paths.settingsPath, join(resolve(settingsRoot), "settings.ttl"));
  assertEquals(paths.meshSettings.meshIdentifier, "mesh-1190756e677d");
  assertEquals(
    paths.meshSettings.accessProfilePath,
    join(resolve(settingsRoot), "meshes/mesh-1190756e677d/access.ttl"),
  );
  assertEquals(
    paths.logDir,
    join(resolve(stateRoot), "weave/meshes/mesh-1190756e677d/logs"),
  );
  assertEquals(
    paths.cacheDir,
    join(resolve(cacheRoot), "weave/meshes/mesh-1190756e677d/cache"),
  );
});

Deno.test("resolveUserSettingsPaths falls back through XDG config and home directories", async () => {
  const xdgPaths = await resolveUserSettingsPaths("https://example.org/mesh/", {
    env: {
      XDG_CONFIG_HOME: "/tmp/xdg-config",
      HOME: "/home/alice",
    },
  });
  assertEquals(xdgPaths.settingsRoot, "/tmp/xdg-config/weave");
  assertEquals(
    xdgPaths.logDir,
    "/home/alice/.local/state/weave/meshes/mesh-1190756e677d/logs",
  );
  assertEquals(
    xdgPaths.cacheDir,
    "/home/alice/.cache/weave/meshes/mesh-1190756e677d/cache",
  );

  const homeFallbackPaths = await resolveUserSettingsPaths(
    "https://example.org/mesh/",
    {
      env: {
        HOME: "/home/alice",
      },
    },
  );
  assertEquals(homeFallbackPaths.settingsRoot, "/home/alice/.config/weave");
});

Deno.test("resolveUserSettingsPaths keeps WEAVE_LOG_DIR as an explicit log override", async () => {
  const paths = await resolveUserSettingsPaths("https://example.org/mesh/", {
    env: {
      WEAVE_LOG_DIR: "/tmp/weave-command-logs",
      HOME: "/home/alice",
    },
  });

  assertEquals(paths.logDir, "/tmp/weave-command-logs");
});

Deno.test("renderUserSettingsTurtle records the selected mesh settings group", async () => {
  const paths = await resolveUserSettingsPaths("https://example.org/mesh/", {
    env: {
      WEAVE_SETTINGS: "/tmp/weave-settings",
      HOME: "/home/alice",
    },
  });
  const turtle = renderUserSettingsTurtle(paths);

  assertStringIncludes(turtle, "weave:UserSettings");
  assertStringIncludes(
    turtle,
    "weave:hasMeshSettings <meshes/mesh-1190756e677d/>",
  );
  assertStringIncludes(turtle, 'rdfs:label "mesh"');
  assertStringIncludes(
    turtle,
    'weave:forMeshBase "https://example.org/mesh/"^^xsd:anyURI',
  );
});

Deno.test("renderHostLocalAccessProfileTurtle records Weave-local path grants", () => {
  const turtle = renderHostLocalAccessProfileTurtle([
    "/home/alice/source/",
  ]);

  assertStringIncludes(turtle, "weave:HostLocalAccessProfile");
  assertStringIncludes(turtle, "weave:LocalPathGrant");
  assertStringIncludes(
    turtle,
    'weave:allowsLocalPathBase "/home/alice/source/"',
  );
});
