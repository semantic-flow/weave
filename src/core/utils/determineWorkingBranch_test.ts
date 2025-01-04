// src/core/utils/determineWorkingBranch_test.ts

import {
  assertEquals,
  assertRejects,
} from "../../deps/assert.ts";
import { stub } from "../../deps/testing.ts";
import { determineWorkingBranch } from "./determineWorkingBranch.ts";
import { GitError } from "../errors.ts";

// Mock data
const MOCK_WORKING_DIR = "/test/repo";

function createMockOutput(output: string, success = true): Promise<Deno.CommandOutput> {
  return Promise.resolve({
    code: success ? 0 : 1,
    success,
    stdout: new TextEncoder().encode(output),
    stderr: new Uint8Array(),
    signal: null,
  });
}

Deno.test("determineWorkingBranch correctly identifies 'main' branch", async () => {
  const commandStub = stub(Deno, "Command", () => ({
    output: () => createMockOutput("main"),
  }) as unknown as Deno.Command);

  try {
    const branch = await determineWorkingBranch(MOCK_WORKING_DIR);
    assertEquals(branch, "main");
  } finally {
    commandStub.restore();
  }
});

Deno.test("determineWorkingBranch correctly identifies 'master' branch", async () => {
  const commandStub = stub(Deno, "Command", () => ({
    output: () => createMockOutput("master"),
  }) as unknown as Deno.Command);

  try {
    const branch = await determineWorkingBranch(MOCK_WORKING_DIR);
    assertEquals(branch, "master");
  } finally {
    commandStub.restore();
  }
});

Deno.test("determineWorkingBranch correctly identifies feature branches", async () => {
  const commandStub = stub(Deno, "Command", () => ({
    output: () => createMockOutput("feature/new-feature"),
  }) as unknown as Deno.Command);

  try {
    const branch = await determineWorkingBranch(MOCK_WORKING_DIR);
    assertEquals(branch, "feature/new-feature");
  } finally {
    commandStub.restore();
  }
});

Deno.test("determineWorkingBranch trims whitespace from branch names", async () => {
  const commandStub = stub(Deno, "Command", () => ({
    output: () => createMockOutput("main  \n"),
  }) as unknown as Deno.Command);

  try {
    const branch = await determineWorkingBranch(MOCK_WORKING_DIR);
    assertEquals(branch, "main");
  } finally {
    commandStub.restore();
  }
});

Deno.test("determineWorkingBranch handles empty git command output", async () => {
  const commandStub = stub(Deno, "Command", () => ({
    output: () => createMockOutput(""),
  }) as unknown as Deno.Command);

  try {
    await assertRejects(
      async () => {
        await determineWorkingBranch(MOCK_WORKING_DIR);
      },
      GitError,
      "No branch name returned"
    );
  } finally {
    commandStub.restore();
  }
});

Deno.test("determineWorkingBranch handles git command failures", async () => {
  const commandStub = stub(Deno, "Command", () => ({
    output: () => createMockOutput("", false),
  }) as unknown as Deno.Command);

  try {
    await assertRejects(
      async () => {
        await determineWorkingBranch(MOCK_WORKING_DIR);
      },
      GitError,
      "Git command failed with exit code 1"
    );
  } finally {
    commandStub.restore();
  }
});

Deno.test("determineWorkingBranch handles general errors", async () => {
  const commandStub = stub(Deno, "Command", () => {
    throw new Error("Unexpected error");
  });

  try {
    await assertRejects(
      async () => {
        await determineWorkingBranch(MOCK_WORKING_DIR);
      },
      GitError,
      "Unable to determine working branch: Unexpected error"
    );
  } finally {
    commandStub.restore();
  }
});

Deno.test("determineWorkingBranch handles detached HEAD state", async () => {
  const commandStub = stub(Deno, "Command", () => ({
    output: () => createMockOutput("HEAD"),
  }) as unknown as Deno.Command);

  try {
    const branch = await determineWorkingBranch(MOCK_WORKING_DIR);
    assertEquals(branch, "HEAD");
  } finally {
    commandStub.restore();
  }
});
