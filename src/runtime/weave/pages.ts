import type { ResourcePageModel } from "../../core/weave/weave.ts";
import type { PlannedFile } from "../../core/planned_file.ts";
import {
  deriveMeshLabel,
  escapeHtml,
  toRelativeHref,
  toResourcePath,
} from "../../core/weave/html.ts";

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
    const currentLinks = page.currentLinks.map((link) => {
      const targetHref = toRelativeHref(
        targetBasePath,
        link.referenceTargetPath,
      );
      const stateHref = link.referenceTargetStatePath
        ? toRelativeHref(targetBasePath, link.referenceTargetStatePath)
        : undefined;
      const escapedFragment = escapeHtml(link.fragment);
      const escapedRoleLabel = escapeHtml(link.referenceRoleLabel);
      const escapedTargetHref = escapeHtml(targetHref);
      const escapedStateHref = stateHref ? escapeHtml(stateHref) : undefined;
      const escapedTargetPath = escapeHtml(link.referenceTargetPath);

      return stateHref
        ? `        <li id="${escapedFragment}"><code>#${escapedFragment}</code>: ${escapedRoleLabel} reference target <a href="${escapedTargetHref}">${escapedTargetHref}</a>, pinned to <a href="${escapedStateHref}">${escapedStateHref}</a>.</li>`
        : `        <li id="${escapedFragment}"><code>#${escapedFragment}</code>: ${escapedRoleLabel} reference target <code>${escapedTargetPath}</code>.</li>`;
    }).join("\n");

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
