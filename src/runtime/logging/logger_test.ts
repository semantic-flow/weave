import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { createRuntimeLoggers, resolveRuntimeLoggers } from "./factory.ts";
import { createTestTmpDir } from "../../../tests/support/test_tmp.ts";

Deno.test("createRuntimeLoggers writes operational and audit JSONL records", async () => {
  const logDir = await createTestTmpDir("weave-logs-");
  const now = () => new Date("2026-04-03T12:00:00.000Z");
  const { operationalLogger, auditLogger } = createRuntimeLoggers({
    logDir,
    now,
  });

  await operationalLogger.info(
    "mesh.create.started",
    "Starting local mesh create",
    { meshBase: "https://semantic-flow.github.io/mesh-alice-bio/" },
  );
  await auditLogger.command("mesh.create", { workspaceRoot: "/tmp/example" });

  const operationalRecord = JSON.parse(
    (await Deno.readTextFile(join(logDir, "operational.jsonl"))).trim(),
  ) as Record<string, unknown>;
  const auditRecord = JSON.parse(
    (await Deno.readTextFile(join(logDir, "security-audit.jsonl"))).trim(),
  ) as Record<string, unknown>;

  assertEquals(operationalRecord.timestamp, "2026-04-03T12:00:00.000Z");
  assertEquals(operationalRecord.channel, "operational");
  assertEquals(operationalRecord.event, "mesh.create.started");
  assertEquals(auditRecord.timestamp, "2026-04-03T12:00:00.000Z");
  assertEquals(auditRecord.channel, "security-audit");
  assertEquals(auditRecord.event, "cli.command");
});

Deno.test("resolveRuntimeLoggers preserves individually provided loggers", () => {
  const providedOperational = createRuntimeLoggers().operationalLogger;
  const providedAudit = createRuntimeLoggers().auditLogger;

  const withOperationalOnly = resolveRuntimeLoggers({
    operationalLogger: providedOperational,
  });
  assertEquals(
    withOperationalOnly.operationalLogger,
    providedOperational,
  );

  const withAuditOnly = resolveRuntimeLoggers({
    auditLogger: providedAudit,
  });
  assertEquals(withAuditOnly.auditLogger, providedAudit);

  const withBoth = resolveRuntimeLoggers({
    operationalLogger: providedOperational,
    auditLogger: providedAudit,
  });
  assertEquals(withBoth.operationalLogger, providedOperational);
  assertEquals(withBoth.auditLogger, providedAudit);
});
