// src/core/utils/determineDefaultWorkingDirectory_test.ts

import { assertEquals } from "../../../src/deps/assert.ts";
import { determineDefaultWorkingDirectory } from "../../../src/core/utils/determineDefaultWorkingDirectory.ts";
import { join } from "../../../src/deps/path.ts";

const WORKSPACE_DIR = "_source-repos";

Deno.test("determineDefaultWorkingDirectory handles HTTPS URLs", () => {
  const url = "https://github.com/user/repo.git";
  const branch = "main";
  const expected = join(WORKSPACE_DIR, "github.com/user/repo.main");
  const result = determineDefaultWorkingDirectory(WORKSPACE_DIR, url, branch);
  assertEquals(result, expected);
});

Deno.test("determineDefaultWorkingDirectory handles SSH URLs", () => {
  const url = "git@github.com:user/repo.git";
  const branch = "main";
  const expected = join(WORKSPACE_DIR, "github.com/user/repo.main");
  const result = determineDefaultWorkingDirectory(WORKSPACE_DIR, url, branch);
  assertEquals(result, expected);
});

Deno.test("determineDefaultWorkingDirectory handles URLs without .git suffix", () => {
  const url = "https://github.com/user/repo";
  const branch = "main";
  const expected = join(WORKSPACE_DIR, "github.com/user/repo.main");
  const result = determineDefaultWorkingDirectory(WORKSPACE_DIR, url, branch);
  assertEquals(result, expected);
});

Deno.test("determineDefaultWorkingDirectory handles different branch names", () => {
  const url = "https://github.com/user/repo.git";
  const branch = "feature/new-feature";
  const expected = join(WORKSPACE_DIR, "github.com/user/repo.feature/new-feature");
  const result = determineDefaultWorkingDirectory(WORKSPACE_DIR, url, branch);
  assertEquals(result, expected);
});

Deno.test("determineDefaultWorkingDirectory handles different workspace directories", () => {
  const workspaceDir = "/custom/workspace";
  const url = "https://github.com/user/repo.git";
  const branch = "main";
  const expected = join(workspaceDir, "github.com/user/repo.main");
  const result = determineDefaultWorkingDirectory(workspaceDir, url, branch);
  assertEquals(result, expected);
});

Deno.test("determineDefaultWorkingDirectory handles GitLab URLs", () => {
  const url = "https://gitlab.com/group/project.git";
  const branch = "main";
  const expected = join(WORKSPACE_DIR, "gitlab.com/group/project.main");
  const result = determineDefaultWorkingDirectory(WORKSPACE_DIR, url, branch);
  assertEquals(result, expected);
});

Deno.test("determineDefaultWorkingDirectory handles Bitbucket URLs", () => {
  const url = "https://bitbucket.org/team/repo.git";
  const branch = "main";
  const expected = join(WORKSPACE_DIR, "bitbucket.org/team/repo.main");
  const result = determineDefaultWorkingDirectory(WORKSPACE_DIR, url, branch);
  assertEquals(result, expected);
});

Deno.test("determineDefaultWorkingDirectory handles self-hosted Git URLs", () => {
  const url = "https://git.company.com/department/project.git";
  const branch = "main";
  const expected = join(WORKSPACE_DIR, "git.company.com/department/project.main");
  const result = determineDefaultWorkingDirectory(WORKSPACE_DIR, url, branch);
  assertEquals(result, expected);
});
