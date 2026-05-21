import type { RuntimeTiming } from "../timing.ts";

export async function timeOptional<T>(
  timing: RuntimeTiming | undefined,
  phase: string,
  operation: () => Promise<T>,
): Promise<T> {
  return timing ? await timing.time(phase, operation) : await operation();
}

export function timeOptionalSync<T>(
  timing: RuntimeTiming | undefined,
  phase: string,
  operation: () => T,
): T {
  return timing ? timing.timeSync(phase, operation) : operation();
}
