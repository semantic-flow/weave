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
    help: true,
  });
  assertEquals(parseKnopCreateScaleProbeArgs(["-h"]).help, true);
  assertStringIncludes(KNOP_CREATE_SCALE_PROBE_HELP, "--count");
  assertStringIncludes(KNOP_CREATE_SCALE_PROBE_HELP, "--preserve");
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
