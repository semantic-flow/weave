import { assertEquals, assertGreater, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import {
  KNOP_CREATE_SCALE_PROBE_HELP,
  parseKnopCreateScaleProbeArgs,
  runKnopCreateScaleProbe,
} from "../../scripts/probe-knop-create-scale.ts";
import { createTestTmpDir } from "../support/test_tmp.ts";

Deno.test("knop create scale probe exercises repeated real creates", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-knop-create-scale-test-",
  );

  try {
    const result = await runKnopCreateScaleProbe({
      count: 3,
      preserveWorkspace: true,
      workspaceRoot,
    });
    assertEquals(result.requestedCreateCount, 3);
    assertEquals(result.successfulCreateCount, 3);
    assertEquals(result.createdFileCount, 6);
    assertEquals(result.updatedFileCount, 3);
    assertGreater(result.finalMeshInventoryBytes, 0);
    assertGreater(result.meshInventoryBytesRead, 0);
    assertGreater(result.meshInventoryBytesWritten, 0);
    assertEquals(result.workspacePreserved, true);
    await Deno.stat(join(
      workspaceRoot,
      "stagecraft/iri-0003/_knop/_inventory/inventory.ttl",
    ));
  } finally {
    await removeIfPresent(workspaceRoot);
  }
});

Deno.test("knop create scale probe exposes help without starting a workload", () => {
  assertEquals(parseKnopCreateScaleProbeArgs(["--help"]), {
    count: 3,
    preserveWorkspace: false,
    founding: false,
    help: true,
  });
  assertEquals(parseKnopCreateScaleProbeArgs(["-h"]).help, true);
  assertStringIncludes(KNOP_CREATE_SCALE_PROBE_HELP, "--count");
  assertStringIncludes(KNOP_CREATE_SCALE_PROBE_HELP, "--preserve");
  assertStringIncludes(KNOP_CREATE_SCALE_PROBE_HELP, "--founding");
});

Deno.test("knop create scale probe initializes and settles representative founding data", async () => {
  const workspaceRoot = await createTestTmpDir(
    "weave-knop-create-founding-scale-test-",
  );
  try {
    const result = await runKnopCreateScaleProbe({
      count: 3,
      founding: true,
      preserveWorkspace: true,
      workspaceRoot,
    });
    assertEquals(result.workload, "knop.create-founding-scale");
    assertEquals(result.successfulCreateCount, 3);
    assertEquals(result.createdFileCount, 12);
    assertEquals(result.updatedFileCount, 6);
    assertEquals(result.verifiedSnapshotDigestCount, 3);
    assertEquals(result.foundingPageCount, 0);
    assertGreater(result.settlementElapsedMs ?? 0, 0);
  } finally {
    await removeIfPresent(workspaceRoot);
  }
});

async function removeIfPresent(path: string): Promise<void> {
  try {
    await Deno.remove(path, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }
}
