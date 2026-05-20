const TIMING_ENV_VAR = "WEAVE_TIMING";

export type RuntimeTimingField = string | number | boolean | undefined;

export interface RuntimeTiming {
  readonly enabled: boolean;
  setField(key: string, value: RuntimeTimingField): void;
  time<T>(phase: string, operation: () => Promise<T>): Promise<T>;
  timeSync<T>(phase: string, operation: () => T): T;
  finish(fields?: Record<string, RuntimeTimingField>): void;
}

interface TimingEntry {
  totalMs: number;
  count: number;
}

class DisabledRuntimeTiming implements RuntimeTiming {
  readonly enabled = false;

  setField(_key: string, _value: RuntimeTimingField): void {
  }

  async time<T>(_phase: string, operation: () => Promise<T>): Promise<T> {
    return await operation();
  }

  timeSync<T>(_phase: string, operation: () => T): T {
    return operation();
  }

  finish(_fields?: Record<string, RuntimeTimingField>): void {
  }
}

class EnabledRuntimeTiming implements RuntimeTiming {
  readonly enabled = true;
  #finished = false;
  readonly #startedAt = performance.now();
  readonly #command: string;
  readonly #entries = new Map<string, TimingEntry>();
  readonly #fields = new Map<string, RuntimeTimingField>();

  constructor(command: string) {
    this.#command = command;
  }

  setField(key: string, value: RuntimeTimingField): void {
    if (value !== undefined) {
      this.#fields.set(key, value);
    }
  }

  async time<T>(phase: string, operation: () => Promise<T>): Promise<T> {
    const startedAt = performance.now();
    try {
      return await operation();
    } finally {
      this.#record(phase, performance.now() - startedAt);
    }
  }

  timeSync<T>(phase: string, operation: () => T): T {
    const startedAt = performance.now();
    try {
      return operation();
    } finally {
      this.#record(phase, performance.now() - startedAt);
    }
  }

  finish(fields: Record<string, RuntimeTimingField> = {}): void {
    if (this.#finished) {
      return;
    }
    this.#finished = true;
    for (const [key, value] of Object.entries(fields)) {
      this.setField(key, value);
    }

    for (const [phase, entry] of this.#entries) {
      const countSuffix = entry.count > 1
        ? ` count=${entry.count} avg=${
          formatDurationMs(entry.totalMs / entry.count)
        }`
        : "";
      console.error(
        `[timing] ${this.#command}.${phase} ${
          formatDurationMs(entry.totalMs)
        }${countSuffix}`,
      );
    }

    console.error(
      `[timing] ${this.#command}.total ${
        formatDurationMs(performance.now() - this.#startedAt)
      }${formatFields(this.#fields)}`,
    );
  }

  #record(phase: string, elapsedMs: number): void {
    const existing = this.#entries.get(phase);
    if (existing) {
      existing.totalMs += elapsedMs;
      existing.count += 1;
      return;
    }
    this.#entries.set(phase, { totalMs: elapsedMs, count: 1 });
  }
}

export function createRuntimeTiming(command: string): RuntimeTiming {
  return isRuntimeTimingEnabled()
    ? new EnabledRuntimeTiming(command)
    : new DisabledRuntimeTiming();
}

function isRuntimeTimingEnabled(): boolean {
  let value: string | undefined;
  try {
    value = Deno.env.get(TIMING_ENV_VAR);
  } catch {
    return false;
  }

  const normalized = value?.trim().toLowerCase();
  return normalized !== undefined &&
    normalized.length > 0 &&
    !["0", "false", "no", "off"].includes(normalized);
}

function formatDurationMs(durationMs: number): string {
  if (durationMs >= 1000) {
    return `${(durationMs / 1000).toFixed(3)}s`;
  }
  return `${durationMs.toFixed(1)}ms`;
}

function formatFields(
  fields: ReadonlyMap<string, RuntimeTimingField>,
): string {
  const renderedFields = [...fields].flatMap(([key, value]) =>
    value === undefined ? [] : [`${key}=${JSON.stringify(value)}`]
  );
  return renderedFields.length === 0 ? "" : ` ${renderedFields.join(" ")}`;
}
