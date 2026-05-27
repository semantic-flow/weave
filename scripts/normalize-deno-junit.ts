import { dirname, resolve } from "@std/path";
import {
  coverageCodecovJunitPath,
  coverageJunitPath,
} from "./coverage-paths.ts";

export interface NormalizeDenoJunitOptions {
  inputPath: string;
  outputPath: string;
  timestamp?: string;
}

interface TestcaseRecord {
  attributes: Map<string, string>;
  body: string;
}

interface TestsuiteRecord {
  attributes: Map<string, string>;
  testcases: TestcaseRecord[];
}

if (import.meta.main) {
  await normalizeDenoJunitFile({
    inputPath: coverageJunitPath,
    outputPath: coverageCodecovJunitPath,
  });
}

export async function normalizeDenoJunitFile(
  options: NormalizeDenoJunitOptions,
): Promise<void> {
  const input = await Deno.readTextFile(options.inputPath);
  await Deno.mkdir(dirname(resolve(options.outputPath)), { recursive: true });
  await Deno.writeTextFile(
    options.outputPath,
    normalizeDenoJunitXml(input, { timestamp: options.timestamp }),
  );
}

export function normalizeDenoJunitXml(
  input: string,
  options: { timestamp?: string } = {},
): string {
  const rootAttributes = parseAttributes(
    /<testsuites\b([^>]*)>/.exec(input)?.[1] ?? "",
  );
  const suites = extractTestsuites(input);
  const testcases = suites.flatMap((suite) => suite.testcases);
  const tests = testcases.length;
  const failures = countTestcases(testcases, /<failure\b/);
  const errors = countTestcases(testcases, /<error\b/);
  const skipped = countTestcases(testcases, /<skipped\b/);
  const time = rootAttributes.get("time") ?? sumTestcaseTime(testcases);
  const timestamp = options.timestamp ?? new Date().toISOString();
  const outputRootAttributes = new Map(rootAttributes);
  outputRootAttributes.set("name", rootAttributes.get("name") ?? "deno test");
  outputRootAttributes.set("tests", String(tests));
  outputRootAttributes.set("failures", String(failures));
  outputRootAttributes.set("errors", String(errors));
  outputRootAttributes.set("skipped", String(skipped));
  outputRootAttributes.set("time", time);

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuites ${
      renderAttributes(outputRootAttributes, [
        "name",
        "tests",
        "failures",
        "errors",
        "skipped",
        "time",
      ])
    }>`,
  ];

  for (const suite of suites) {
    const suiteFailures = countTestcases(suite.testcases, /<failure\b/);
    const suiteErrors = countTestcases(suite.testcases, /<error\b/);
    const suiteSkipped = countTestcases(suite.testcases, /<skipped\b/);
    const suiteTime = suite.attributes.get("time") ??
      sumTestcaseTime(suite.testcases);
    const outputSuiteAttributes = new Map(suite.attributes);
    outputSuiteAttributes.delete("disabled");
    outputSuiteAttributes.set(
      "name",
      suite.attributes.get("name") ?? "deno",
    );
    outputSuiteAttributes.set("tests", String(suite.testcases.length));
    outputSuiteAttributes.set("failures", String(suiteFailures));
    outputSuiteAttributes.set("errors", String(suiteErrors));
    outputSuiteAttributes.set("skipped", String(suiteSkipped));
    outputSuiteAttributes.set(
      "timestamp",
      suite.attributes.get("timestamp") ?? timestamp,
    );
    outputSuiteAttributes.set("time", suiteTime);

    lines.push(
      `  <testsuite ${
        renderAttributes(outputSuiteAttributes, [
          "name",
          "tests",
          "failures",
          "errors",
          "skipped",
          "timestamp",
          "time",
        ])
      }>`,
    );

    for (const testcase of suite.testcases) {
      const outputTestcaseAttributes = new Map(testcase.attributes);
      outputTestcaseAttributes.set(
        "classname",
        testcase.attributes.get("classname") ?? suite.attributes.get("name") ??
          "deno",
      );
      outputTestcaseAttributes.set(
        "name",
        testcase.attributes.get("name") ?? "unnamed test",
      );
      outputTestcaseAttributes.set(
        "time",
        testcase.attributes.get("time") ?? "0",
      );

      lines.push(
        `    <testcase ${
          renderAttributes(outputTestcaseAttributes, [
            "classname",
            "name",
            "time",
          ])
        }>`,
      );
      const body = testcase.body.trim();
      if (body.length > 0) {
        lines.push(indent(body, "      "));
      }
      lines.push("    </testcase>");
    }

    lines.push("  </testsuite>");
  }

  lines.push("</testsuites>", "");
  return lines.join("\n");
}

function extractTestsuites(input: string): TestsuiteRecord[] {
  const suites: TestsuiteRecord[] = [];
  const testsuitePattern = /<testsuite\b([^>]*)>([\s\S]*?)<\/testsuite>/g;
  for (const match of input.matchAll(testsuitePattern)) {
    suites.push({
      attributes: parseAttributes(match[1]),
      testcases: extractTestcases(match[2]),
    });
  }

  if (suites.length > 0) {
    return suites;
  }

  return [{
    attributes: new Map([["name", "deno"]]),
    testcases: extractTestcases(input),
  }];
}

function extractTestcases(input: string): TestcaseRecord[] {
  const testcases: TestcaseRecord[] = [];
  const testcasePattern = /<testcase\b([^>]*)>([\s\S]*?)<\/testcase>/g;
  for (const match of input.matchAll(testcasePattern)) {
    testcases.push({
      attributes: parseAttributes(match[1]),
      body: match[2],
    });
  }
  return testcases;
}

function countTestcases(
  testcases: readonly TestcaseRecord[],
  pattern: RegExp,
): number {
  return testcases.filter((testcase) => pattern.test(testcase.body)).length;
}

function parseAttributes(input: string): Map<string, string> {
  const attributes = new Map<string, string>();
  const attributePattern = /([A-Za-z_:][A-Za-z0-9_.:-]*)="([^"]*)"/g;
  for (const match of input.matchAll(attributePattern)) {
    attributes.set(match[1], decodeAttribute(match[2]));
  }
  return attributes;
}

function sumTestcaseTime(testcases: readonly TestcaseRecord[]): string {
  const total = testcases.reduce((sum, testcase) => {
    const value = Number(testcase.attributes.get("time") ?? "0");
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
  return total.toFixed(3);
}

function renderAttributes(
  attributes: ReadonlyMap<string, string>,
  preferredOrder: readonly string[],
): string {
  const seen = new Set<string>();
  const orderedNames = [
    ...preferredOrder,
    ...[...attributes.keys()].filter((name) => !preferredOrder.includes(name)),
  ].filter((name) => {
    if (seen.has(name)) {
      return false;
    }
    seen.add(name);
    return attributes.has(name);
  });

  return orderedNames.map((name) =>
    `${name}="${escapeAttribute(attributes.get(name) ?? "")}"`
  ).join(" ");
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function decodeAttribute(value: string): string {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function indent(value: string, prefix: string): string {
  return value.split("\n").map((line) => `${prefix}${line}`).join("\n");
}
