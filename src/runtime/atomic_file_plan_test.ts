import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import {
  AtomicFilePlanError,
  executeAtomicFilePlan,
} from "./atomic_file_plan.ts";

Deno.test("executeAtomicFilePlan rolls back created and updated files after an injected failure", async () => {
  const root = await Deno.makeTempDir();
  try {
    await Deno.mkdir(join(root, "existing"), { recursive: true });
    await Deno.writeTextFile(join(root, "existing/one.txt"), "before one");
    await Deno.writeTextFile(join(root, "existing/two.txt"), "before two");
    const error = await assertRejects(
      () =>
        executeAtomicFilePlan(
          root,
          [
            {
              path: "created/new.bin",
              mode: "create",
              phase: "create",
              contents: new Uint8Array([1, 2, 3]),
            },
            {
              path: "existing/one.txt",
              mode: "update",
              phase: "update-one",
              contents: "after one",
            },
            {
              path: "existing/two.txt",
              mode: "update",
              phase: "update-two",
              contents: "after two",
            },
          ],
          {
            beforeWrite(write) {
              if (write.phase === "update-two") throw new Error("injected");
            },
          },
        ),
      AtomicFilePlanError,
    );

    assertEquals(error.rollbackFailedPaths, []);
    assertEquals(
      await Deno.readTextFile(join(root, "existing/one.txt")),
      "before one",
    );
    assertEquals(
      await Deno.readTextFile(join(root, "existing/two.txt")),
      "before two",
    );
    await assertRejects(
      () => Deno.stat(join(root, "created/new.bin")),
      Deno.errors.NotFound,
    );
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});
