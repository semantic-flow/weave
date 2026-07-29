import { assert, assertEquals, assertRejects } from "@std/assert";
import { fromFileUrl, join } from "@std/path";
import {
  parseBuildBinariesArgs,
  withStampedBuildInfo,
} from "../../scripts/build-binaries.ts";

const REPO_ROOT = fromFileUrl(new URL("../../", import.meta.url));
const BUILD_INFO_PATH = join(REPO_ROOT, "src", "generated", "build_info.ts");
const VALID_SHA = "0123456789abcdef0123456789abcdef01234567";

Deno.test("parseBuildBinariesArgs accepts --commit and --built in both forms", () => {
  const spaced = parseBuildBinariesArgs([
    "--commit",
    VALID_SHA,
    "--built",
    "2026-07-28T00:00:00Z",
  ]);
  assertEquals(spaced.commit, VALID_SHA);
  assertEquals(spaced.built, "2026-07-28T00:00:00Z");

  const equals = parseBuildBinariesArgs([
    `--commit=${VALID_SHA}`,
    "--built=2026-07-28T00:00:00Z",
  ]);
  assertEquals(equals.commit, VALID_SHA);
  assertEquals(equals.built, "2026-07-28T00:00:00Z");

  const unstamped = parseBuildBinariesArgs([]);
  assertEquals(unstamped.commit, undefined);
  assertEquals(unstamped.built, undefined);
});

Deno.test("withStampedBuildInfo stamps during the build and always restores", async () => {
  const original = await Deno.readTextFile(BUILD_INFO_PATH);
  assert(
    original.includes("commit: null,"),
    "checked-in build info must be null",
  );

  let stampedDuringBuild = "";
  await withStampedBuildInfo(
    REPO_ROOT,
    { commit: VALID_SHA, built: "2026-07-28T00:00:00Z" },
    async () => {
      stampedDuringBuild = await Deno.readTextFile(BUILD_INFO_PATH);
    },
  );
  assert(stampedDuringBuild.includes(`commit: "${VALID_SHA}",`));
  assert(stampedDuringBuild.includes(`built: "2026-07-28T00:00:00Z",`));
  assertEquals(await Deno.readTextFile(BUILD_INFO_PATH), original);

  await assertRejects(
    () =>
      withStampedBuildInfo(
        REPO_ROOT,
        { commit: VALID_SHA },
        () => Promise.reject(new Error("compile failed")),
      ),
    Error,
    "compile failed",
  );
  assertEquals(await Deno.readTextFile(BUILD_INFO_PATH), original);
});

Deno.test("withStampedBuildInfo validates its inputs and skips when unstamped", async () => {
  const original = await Deno.readTextFile(BUILD_INFO_PATH);

  await assertRejects(
    () =>
      withStampedBuildInfo(
        REPO_ROOT,
        { commit: "abc123" },
        () => Promise.resolve(),
      ),
    Error,
    "full 40-hex git SHA",
  );
  await assertRejects(
    () =>
      withStampedBuildInfo(
        REPO_ROOT,
        { commit: VALID_SHA, built: "yesterday" },
        () => Promise.resolve(),
      ),
    Error,
    "ISO-8601",
  );

  let ran = false;
  await withStampedBuildInfo(REPO_ROOT, {}, () => {
    ran = true;
    return Promise.resolve();
  });
  assert(ran);
  assertEquals(await Deno.readTextFile(BUILD_INFO_PATH), original);
});
