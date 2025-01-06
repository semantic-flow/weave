// src/core/utils/directoryExists_test.ts

import { assertEquals, assertRejects } from "../../deps/assert.ts";
import { stub } from "../../deps/testing.ts";
import { directoryExists } from "./directoryExists.ts";
import { FileSystemError } from "../errors.ts";

// Helper to create a mock FileInfo object
function createMockFileInfo(isDir: boolean): Deno.FileInfo {
  return {
    isFile: !isDir,
    isDirectory: isDir,
    isSymlink: false,
    size: 0,
    mtime: new Date(),
    atime: new Date(),
    birthtime: new Date(),
    ctime: new Date(),
    dev: 0,
    ino: 0,
    mode: 0,
    nlink: 0,
    uid: 0,
    gid: 0,
    rdev: 0,
    blksize: 0,
    blocks: 0,
    isBlockDevice: false,
    isCharDevice: false,
    isFifo: false,
    isSocket: false,
  };
}

Deno.test("directoryExists returns true for existing directory", async () => {
  const statStub = stub(
    Deno,
    "stat",
    () => Promise.resolve(createMockFileInfo(true))
  );

  try {
    const exists = await directoryExists("/test/dir");
    assertEquals(exists, true);
  } finally {
    statStub.restore();
  }
});

Deno.test("directoryExists returns false for existing file", async () => {
  const statStub = stub(
    Deno,
    "stat",
    () => Promise.resolve(createMockFileInfo(false))
  );

  try {
    const exists = await directoryExists("/test/file.txt");
    assertEquals(exists, false);
  } finally {
    statStub.restore();
  }
});

Deno.test("directoryExists returns false for non-existent path", async () => {
  const statStub = stub(
    Deno,
    "stat",
    () => Promise.reject(new Deno.errors.NotFound())
  );

  try {
    const exists = await directoryExists("/test/nonexistent");
    assertEquals(exists, false);
  } finally {
    statStub.restore();
  }
});

Deno.test("directoryExists handles permission errors", async () => {
  const statStub = stub(
    Deno,
    "stat",
    () => Promise.reject(new Deno.errors.PermissionDenied("Access denied"))
  );

  try {
    await assertRejects(
      () => directoryExists("/test/no-permission"),
      FileSystemError,
      "Failed to check directory existence: Access denied"
    );
  } finally {
    statStub.restore();
  }
});

Deno.test("directoryExists handles unknown errors", async () => {
  const statStub = stub(
    Deno,
    "stat",
    () => Promise.reject(new Error("Unknown error"))
  );

  try {
    await assertRejects(
      () => directoryExists("/test/error"),
      FileSystemError,
      "Failed to check directory existence: Unknown error"
    );
  } finally {
    statStub.restore();
  }
});

Deno.test("directoryExists handles non-Error objects", async () => {
  const statStub = stub(
    Deno,
    "stat",
    // deno-lint-ignore no-explicit-any
    () => Promise.reject("string error" as any)
  );

  try {
    await assertRejects(
      () => directoryExists("/test/error"),
      FileSystemError,
      "Failed to check directory existence: Unknown error"
    );
  } finally {
    statStub.restore();
  }
});
