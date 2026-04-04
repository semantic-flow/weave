import * as posix from "@std/path/posix";
import type { ResourcePageModel } from "../../core/weave/weave.ts";
import type { PlannedFile } from "../../core/planned_file.ts";

export function renderResourcePages(
  meshBase: string,
  pages: readonly ResourcePageModel[],
): readonly PlannedFile[] {
  return pages.map((page) => ({
    path: page.path,
    contents: renderResourcePage(meshBase, page),
  }));
}

export function renderResourcePage(
  meshBase: string,
  page: ResourcePageModel,
): string {
  const resourcePath = toResourcePath(page.path);
  const canonical = new URL(resourcePath, meshBase).href;
  const meshLabel = deriveMeshLabel(meshBase);

  if (page.kind === "identifier") {
    const workingFileSentence = page.workingFilePath
      ? ` and currently uses the working RDF file <a href="${
        toRelativeHref(page.path, page.workingFilePath)
      }">${toRelativeHref(page.path, page.workingFilePath)}</a>`
      : "";

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${meshLabel} ${resourcePath}</title>
  <link rel="canonical" href="${canonical}">
</head>
<body>
  <main>
    <h1><strong>${page.designatorPath}</strong></h1>
    <p>Resource page for the Semantic Flow identifier <a href="${canonical}">${canonical}</a>.</p>
  </main>
  <footer>
    <small>The Semantic Flow identifier <a href="${canonical}">${canonical}</a> has an associated Knop at <a href="./_knop">./_knop</a>${workingFileSentence}.</small>
  </footer>
</body>
</html>
`;
  }

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${meshLabel} ${resourcePath}</title>
  <link rel="canonical" href="${canonical}">
</head>
<body>
  <main>
    <h1>${resourcePath}</h1>
    <p>${page.description}</p>
  </main>
</body>
</html>
`;
}

function toResourcePath(pagePath: string): string {
  if (!pagePath.endsWith("/index.html")) {
    throw new Error(`Unsupported resource page path: ${pagePath}`);
  }

  return pagePath.slice(0, -"/index.html".length);
}

function toRelativeHref(fromPagePath: string, targetPath: string): string {
  return posix.relative(posix.dirname(fromPagePath), targetPath);
}

function deriveMeshLabel(meshBase: string): string {
  const url = new URL(meshBase);
  const segments = url.pathname.split("/").filter((segment) =>
    segment.length > 0
  );
  return segments[segments.length - 1] ?? "_mesh";
}
