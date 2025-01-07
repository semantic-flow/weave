// src/core/utils/env_test.ts

import { assertEquals } from "../../../src/deps/assert.ts";
import { stub } from "../../../src/deps/testing.ts";
import { env, setEnv } from "../../../src/core/utils/env.ts";

Deno.test("env - handles string values", () => {
  const getStub = stub(Deno.env, "get", () => "test-value");
  try {
    assertEquals(env<string>("TEST_VAR"), "test-value");
  } finally {
    getStub.restore();
  }
});

Deno.test("env - handles undefined values", () => {
  const getStub = stub(Deno.env, "get", () => undefined);
  try {
    assertEquals(env<string>("TEST_VAR"), undefined);
  } finally {
    getStub.restore();
  }
});

Deno.test("env - handles boolean true values", () => {
  const values = ["true", "TRUE", "on", "ON", "1"];
  for (const value of values) {
    const getStub = stub(Deno.env, "get", () => value);
    try {
      assertEquals(env<boolean>("TEST_VAR"), true);
    } finally {
      getStub.restore();
    }
  }
});

Deno.test("env - handles boolean false values", () => {
  const values = ["false", "FALSE", "off", "OFF", "0"];
  for (const value of values) {
    const getStub = stub(Deno.env, "get", () => value);
    try {
      assertEquals(env<boolean>("TEST_VAR"), false);
    } finally {
      getStub.restore();
    }
  }
});

Deno.test("env - handles non-boolean strings", () => {
  const getStub = stub(Deno.env, "get", () => "hello");
  try {
    assertEquals(env<string>("TEST_VAR"), "hello");
  } finally {
    getStub.restore();
  }
});

Deno.test("setEnv - sets environment variable", () => {
  const setStub = stub(Deno.env, "set", () => {});
  try {
    setEnv("TEST_VAR", "test-value");
    assertEquals(setStub.calls.length, 1);
    assertEquals(setStub.calls[0].args, ["TEST_VAR", "test-value"]);
  } finally {
    setStub.restore();
  }
});
