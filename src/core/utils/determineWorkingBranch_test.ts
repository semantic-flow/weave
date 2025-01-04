// src/core/utils/determineWorkingBranch_test.ts

import {
  assertEquals,
  assertRejects,
} from "../../deps/assert.ts";
import { determineWorkingBranch } from "./determineWorkingBranch.ts";
import * as runGitCommandModule from "./runGitCommand.ts";
import { GitError } from "../errors.ts";

// Mock data
const MOCK_WORKING_DIR = "/test/repo";

// Helper to restore original runGitCommand
const withMockedGitCommand = async (
  mockImplementation: () => Promise<string>,
  testFn: () => Promise<void>
) => {
  const originalRunGitCommand = runGitCommandModule.runGitCommand;
  try {
    // deno-lint-ignore no-explicit-any
    (runGitCommandModule as any).runGitCommand = mockImplementation;
    await testFn();
  } finally {
    // deno-lint-ignore no-explicit-any
    (runGitCommandModule as any).runGitCommand = originalRunGitCommand;
  }
};

Deno.test("determineWorkingBranch correctly identifies 'main' branch", async () => {
  await withMockedGitCommand(
    async () => "main",
    async () => {
      const branch = await determineWorkingBranch(MOCK_WORKING_DIR);
      assertEquals(branch, "main");
    }
  );
});

Deno.test("determineWorkingBranch correctly identifies 'master' branch", async () => {
  await withMockedGitCommand(
    async () => "master",
    async () => {
      const branch = await determineWorkingBranch(MOCK_WORKING_DIR);
      assertEquals(branch, "master");
    }
  );
});

Deno.test("determineWorkingBranch correctly identifies feature branches", async () => {
  await withMockedGitCommand(
    async () => "feature/new-feature",
    async () => {
      const branch = await determineWorkingBranch(MOCK_WORKING_DIR);
      assertEquals(branch, "feature/new-feature");
    }
  );
});

Deno.test("determineWorkingBranch trims whitespace from branch names", async () => {
  await withMockedGitCommand(
    async () => "main  \n",
    async () => {
      const branch = await determineWorkingBranch(MOCK_WORKING_DIR);
      assertEquals(branch, "main");
    }
  );
});

Deno.test("determineWorkingBranch handles empty git command output", async () => {
  await withMockedGitCommand(
    async () => "",
    async () => {
      await assertRejects(
        async () => {
          await determineWorkingBranch(MOCK_WORKING_DIR);
        },
        GitError,
        "No branch name returned"
      );
    }
  );
});

Deno.test("determineWorkingBranch handles git command failures", async () => {
  await withMockedGitCommand(
    async () => {
      throw new GitError("Command failed", "git rev-parse --abbrev-ref HEAD");
    },
    async () => {
      await assertRejects(
        async () => {
          await determineWorkingBranch(MOCK_WORKING_DIR);
        },
        GitError,
        "Command failed"
      );
    }
  );
});

Deno.test("determineWorkingBranch handles general errors", async () => {
  await withMockedGitCommand(
    async () => {
      throw new Error("Unexpected error");
    },
    async () => {
      await assertRejects(
        async () => {
          await determineWorkingBranch(MOCK_WORKING_DIR);
        },
        GitError,
        "Unable to determine working branch: Unexpected error"
      );
    }
  );
});

Deno.test("determineWorkingBranch handles detached HEAD state", async () => {
  await withMockedGitCommand(
    async () => "HEAD",
    async () => {
      const branch = await determineWorkingBranch(MOCK_WORKING_DIR);
      assertEquals(branch, "HEAD");
    }
  );
});
