// src/core/utils/configHelpers_test.ts

import { assertRejects } from "../../deps/assert.ts";
import { handleConfigAction } from "./configHelpers.ts";
import { InputGlobalOptions } from "../../types.ts";

Deno.test("handleConfigAction - handles processWeaveConfig errors", async () => {
  const mockProcessConfig = (_options: InputGlobalOptions): Promise<void> => 
    Promise.reject(new Error("Config error"));

  await assertRejects(
    () => handleConfigAction({}, mockProcessConfig),
    Error,
    "Config error"
  );
});
