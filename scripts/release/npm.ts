import { join } from "@std/path";
import {
  type BinaryBundleMetadata,
  NPM_WRAPPER_PACKAGE_NAME,
  type ReleasePlatform,
} from "./metadata.ts";

export interface NpmPackageJson {
  name: string;
  version: string;
  description: string;
  license: "Apache-2.0";
  files: string[];
  bin?: Record<string, string>;
  os?: string[];
  cpu?: string[];
  optionalDependencies?: Record<string, string>;
  engines?: Record<string, string>;
}

export function npmPackagePath(outDir: string, packageName: string): string {
  const match = /^@([^/]+)\/([^/]+)$/.exec(packageName);
  if (match !== null) {
    return join(outDir, `@${match[1]}`, match[2]);
  }
  return join(outDir, packageName);
}

export function createWrapperPackageJson(
  version: string,
  platforms: readonly ReleasePlatform[],
): NpmPackageJson {
  const optionalDependencies = Object.fromEntries(
    platforms.map((platform) => [platform.npmPackageName, version]),
  );

  return {
    name: NPM_WRAPPER_PACKAGE_NAME,
    version,
    description: "Semantic Flow Weave CLI.",
    license: "Apache-2.0",
    bin: {
      weave: "bin/weave.js",
    },
    files: [
      "bin/",
      "README.md",
      "LICENSE",
    ],
    optionalDependencies,
    engines: {
      node: ">=18",
    },
  };
}

export function createPlatformPackageJson(
  metadata: BinaryBundleMetadata,
): NpmPackageJson {
  return {
    name: metadata.packageName,
    version: metadata.version,
    description: `Native Weave CLI binary for ${metadata.platform}.`,
    license: "Apache-2.0",
    os: [metadata.os],
    cpu: [metadata.cpu],
    files: [
      "bin/",
      "bundle-metadata.json",
      "README.md",
      "LICENSE",
    ],
  };
}

export function renderWrapperBinScript(
  platforms: readonly ReleasePlatform[],
): string {
  const entries = platforms.map((platform) => {
    const key = `${platform.os}-${platform.cpu}`;
    return `  ${JSON.stringify(key)}: ${
      JSON.stringify({
        packageName: platform.npmPackageName,
        executableName: platform.executableName,
        label: platform.label,
      })
    },`;
  }).join("\n");
  const supportedLabels = platforms.map((platform) => platform.label).join(
    ", ",
  );

  return `#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const platformPackages = {
${entries}
};

const currentPlatform = \`\${process.platform}-\${process.arch}\`;
const platformPackage = platformPackages[currentPlatform];

if (platformPackage === undefined) {
  console.error(
    \`Unsupported Weave platform: \${process.platform}/\${process.arch}. Supported package platforms: ${supportedLabels}.\`,
  );
  process.exit(1);
}

let packageJsonPath;
try {
  packageJsonPath = require.resolve(\`\${platformPackage.packageName}/package.json\`);
} catch (_error) {
  console.error(
    \`Missing Weave native package \${platformPackage.packageName}. Try reinstalling ${NPM_WRAPPER_PACKAGE_NAME}.\`,
  );
  process.exit(1);
}

const executablePath = path.join(
  path.dirname(packageJsonPath),
  "bin",
  platformPackage.executableName,
);
const result = spawnSync(executablePath, process.argv.slice(2), {
  stdio: "inherit",
});

if (result.error) {
  console.error(\`Failed to execute Weave binary: \${result.error.message}\`);
  process.exit(1);
}

if (result.signal) {
  console.error(\`Weave terminated by signal \${result.signal}.\`);
  process.exit(1);
}

process.exit(result.status ?? 1);
`;
}

export function renderWrapperReadme(version: string): string {
  return `# Weave ${version}

This package installs the Semantic Flow Weave CLI and dispatches to the native package for the current platform.
`;
}

export function renderPlatformReadme(metadata: BinaryBundleMetadata): string {
  return `# Weave ${metadata.version} ${metadata.platform}

This package contains the native Weave CLI binary for ${metadata.platform}.
`;
}
