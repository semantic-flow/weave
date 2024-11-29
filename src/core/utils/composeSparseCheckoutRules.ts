import { log } from "./logging.ts";

export function composeSparseCheckoutRules(
  include: string[],
  exclude: string[],
  excludeByDefault: boolean,
): string[] {
  const sparseCheckoutRules: string[] = [];

  if (excludeByDefault === false) {
    sparseCheckoutRules.push("/*");
  }

  for (const rule of include) {
    sparseCheckoutRules.push(rule);
  }

  for (const rule of exclude) {
    sparseCheckoutRules.push(`!${rule}`);
  }

  log.debug(`Sparse checkout rules: ${sparseCheckoutRules.join(", ")}`);
  return sparseCheckoutRules;
}
