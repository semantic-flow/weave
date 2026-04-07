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
  const escapedResourcePath = escapeHtml(resourcePath);
  const escapedCanonical = escapeHtml(canonical);
  const escapedMeshLabel = escapeHtml(meshLabel);

  if (page.kind === "identifier") {
    const workingFileHref = page.workingFilePath
      ? toRelativeHref(page.path, page.workingFilePath)
      : undefined;
    const workingFileSentence = workingFileHref
      ? ` and currently uses the working RDF file <a href="${
        escapeHtml(workingFileHref)
      }">${escapeHtml(workingFileHref)}</a>`
      : "";

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapedMeshLabel} ${escapedResourcePath}</title>
  <link rel="canonical" href="${escapedCanonical}">
</head>
<body>
  <main>
    <h1><strong>${escapeHtml(page.designatorPath)}</strong></h1>
    <p>Resource page for the Semantic Flow identifier <a href="${escapedCanonical}">${escapedCanonical}</a>.</p>
  </main>
  <footer>
    <small>The Semantic Flow identifier <a href="${escapedCanonical}">${escapedCanonical}</a> has an associated Knop at <a href="./_knop">./_knop</a>${workingFileSentence}.</small>
  </footer>
</body>
</html>
`;
  }

  if (page.kind === "referenceCatalog") {
    const targetBasePath = resourcePath;
    const currentLinks = page.currentLinks.map((link) =>
      link.referenceTargetStatePath
        ? `        <li id="${escapeHtml(link.fragment)}"><code>#${
          escapeHtml(link.fragment)
        }</code>: ${
          escapeHtml(link.referenceRoleLabel)
        } reference target <a href="${
          escapeHtml(
            toRelativeResourceHref(targetBasePath, link.referenceTargetPath),
          )
        }">${
          escapeHtml(
            toRelativeResourceHref(targetBasePath, link.referenceTargetPath),
          )
        }</a>, pinned to <a href="${
          escapeHtml(
            toRelativeResourceHref(
              targetBasePath,
              link.referenceTargetStatePath,
            ),
          )
        }">${
          escapeHtml(
            toRelativeResourceHref(
              targetBasePath,
              link.referenceTargetStatePath,
            ),
          )
        }</a>.</li>`
        : `        <li id="${escapeHtml(link.fragment)}"><code>#${
          escapeHtml(link.fragment)
        }</code>: ${
          escapeHtml(link.referenceRoleLabel)
        } reference target <code>${
          escapeHtml(link.referenceTargetPath)
        }</code>.</li>`
    ).join("\n");

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapedMeshLabel} ${escapedResourcePath}</title>
  <link rel="canonical" href="${escapedCanonical}">
</head>
<body>
  <main>
    <h1>${escapeHtml(page.catalogPath)}</h1>
    <p>Resource page for the ${
      escapeHtml(page.ownerDesignatorPath)
    } ReferenceCatalog artifact.</p>
    <section>
      <h2>Current Links</h2>
      <ul>
${currentLinks}
      </ul>
    </section>
  </main>
</body>
</html>
`;
  }

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapedMeshLabel} ${escapedResourcePath}</title>
  <link rel="canonical" href="${escapedCanonical}">
</head>
<body>
  <main>
    <h1>${escapedResourcePath}</h1>
    <p>${escapeHtml(page.description)}</p>
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

function toRelativeResourceHref(
  fromResourcePath: string,
  targetPath: string,
): string {
  return posix.relative(posix.dirname(fromResourcePath), targetPath);
}

function deriveMeshLabel(meshBase: string): string {
  const url = new URL(meshBase);
  const segments = url.pathname.split("/").filter((segment) =>
    segment.length > 0
  );
  return segments[segments.length - 1] ?? "_mesh";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
