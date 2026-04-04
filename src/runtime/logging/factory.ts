import { join } from "@std/path";
import { AuditLogger } from "./audit_logger.ts";
import { JsonLineFileSink, NoopSink, StructuredLogger } from "./logger.ts";
import type { LogLevel } from "./log_record.ts";

export interface RuntimeLoggingConfig {
  operationalLevel?: LogLevel;
  auditLevel?: LogLevel;
}

export interface CreateRuntimeLoggersOptions {
  logDir?: string;
  logging?: RuntimeLoggingConfig;
  now?: () => Date;
}

export function createRuntimeLoggers(
  options: CreateRuntimeLoggersOptions = {},
): {
  operationalLogger: StructuredLogger;
  auditLogger: AuditLogger;
} {
  const sink = options.logDir
    ? new JsonLineFileSink(join(options.logDir, "operational.jsonl"))
    : new NoopSink();
  const auditSink = options.logDir
    ? new JsonLineFileSink(join(options.logDir, "security-audit.jsonl"))
    : new NoopSink();

  const operationalLogger = new StructuredLogger([sink], {
    channel: "operational",
    minLevel: options.logging?.operationalLevel ?? "info",
    now: options.now,
  });
  const auditLogger = new AuditLogger(
    new StructuredLogger([auditSink], {
      channel: "security-audit",
      minLevel: options.logging?.auditLevel ?? "info",
      now: options.now,
    }),
  );
  return {
    operationalLogger,
    auditLogger,
  };
}

export function resolveRuntimeLoggers(options: {
  operationalLogger?: StructuredLogger;
  auditLogger?: AuditLogger;
}): {
  operationalLogger: StructuredLogger;
  auditLogger: AuditLogger;
} {
  const defaults = createRuntimeLoggers();

  return {
    operationalLogger: options.operationalLogger ?? defaults.operationalLogger,
    auditLogger: options.auditLogger ?? defaults.auditLogger,
  };
}
