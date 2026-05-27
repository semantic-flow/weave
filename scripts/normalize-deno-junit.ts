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
  classname: string;
  name: string;
  time: string;
  body: string;
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
  const testcases = extractTestcases(input);
  const tests = testcases.length;
  const failures =
    testcases.filter((testcase) => /<failure\b/.test(testcase.body)).length;
  const errors = testcases.filter((testcase) => /<error\b/.test(testcase.body))
    .length;
  const skipped =
    testcases.filter((testcase) => /<skipped\b/.test(testcase.body)).length;
  const time = rootAttributes.get("time") ?? sumTestcaseTime(testcases);
  const timestamp = options.timestamp ?? new Date().toISOString();

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuites name="deno test" tests="${tests}" failures="${failures}" errors="${errors}" skipped="${skipped}" time="${
      escapeAttribute(time)
    }">`,
    `  <testsuite name="deno" tests="${tests}" failures="${failures}" errors="${errors}" skipped="${skipped}" timestamp="${
      escapeAttribute(timestamp)
    }" time="${escapeAttribute(time)}">`,
  ];

  for (const testcase of testcases) {
    lines.push(
      `    <testcase classname="${escapeAttribute(testcase.classname)}" name="${
        escapeAttribute(testcase.name)
      }" time="${escapeAttribute(testcase.time)}">`,
    );
    const body = testcase.body.trim();
    if (body.length > 0) {
      lines.push(indent(body, "      "));
    }
    lines.push("    </testcase>");
  }

  lines.push("  </testsuite>", "</testsuites>", "");
  return lines.join("\n");
}

function extractTestcases(input: string): TestcaseRecord[] {
  const testcases: TestcaseRecord[] = [];
  const testcasePattern = /<testcase\b([^>]*)>([\s\S]*?)<\/testcase>/g;
  for (const match of input.matchAll(testcasePattern)) {
    const attributes = parseAttributes(match[1]);
    testcases.push({
      classname: attributes.get("classname") ?? "deno",
      name: attributes.get("name") ?? "unnamed test",
      time: attributes.get("time") ?? "0",
      body: match[2],
    });
  }
  return testcases;
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
    const value = Number(testcase.time);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
  return total.toFixed(3);
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
