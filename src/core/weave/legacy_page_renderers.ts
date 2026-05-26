import { formatDesignatorPathForDisplay } from "../designator_segments.ts";
import { WeaveInputError } from "./errors.ts";
import {
  deriveMeshLabel,
  escapeHtml,
  toRelativeHref,
  toResourcePath,
} from "./html.ts";

export function renderArtifactHistoryIndexPage(
  meshBase: string,
  options: {
    pagePath: string;
    description: string;
    artifactLabel: string;
    workingLocalRelativePath: string;
    states: readonly { segment: string; latest: boolean }[];
  },
): string {
  const resourcePath = toResourcePath(
    options.pagePath,
    (message) => new WeaveInputError(message),
  );
  const canonical = new URL(resourcePath, meshBase).href;
  const meshLabel = deriveMeshLabel(meshBase);
  const states = options.states.map((state) =>
    `        <li><a href="./${escapeHtml(state.segment)}">${
      escapeHtml(state.segment)
    }</a>${state.latest ? " (latest)" : ""}</li>`
  ).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(meshLabel)} ${escapeHtml(resourcePath)}</title>
  <link rel="canonical" href="${escapeHtml(canonical)}">
</head>
<body>
  <main>
    <h1>${escapeHtml(resourcePath)}</h1>
    <p>${escapeHtml(options.description)}</p>
    <section>
      <h2>History Links</h2>
      <ul>
        <li>${escapeHtml(options.artifactLabel)}: <a href="../">../</a></li>
        <li>Current working file: <a href="${
    escapeHtml(
      toRelativeHref(options.pagePath, options.workingLocalRelativePath),
    )
  }">${
    escapeHtml(
      toRelativeHref(options.pagePath, options.workingLocalRelativePath),
    )
  }</a></li>
      </ul>
    </section>
    <section>
      <h2>States</h2>
      <ol>
${states}
      </ol>
    </section>
  </main>
</body>
</html>
`;
}

export function renderGenericExtractedIdentifierPage(
  meshBase: string,
  designatorPath: string,
): string {
  const canonical = new URL(designatorPath, meshBase).href;
  const displayDesignatorPath = formatDesignatorPathForDisplay(designatorPath);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(displayDesignatorPath)}</title>
  <link rel="canonical" href="${escapeHtml(canonical)}">
</head>
<body>
  <main>
    <h1>${escapeHtml(displayDesignatorPath)}</h1>
    <p>Resource page for the Semantic Flow identifier <a href="${
    escapeHtml(canonical)
  }">${escapeHtml(canonical)}</a>.</p>
  </main>
</body>
</html>
`;
}
