import type {
  ResourcePageModel,
  ResourcePageRawSourcePanelModel,
} from "../../core/weave/weave.ts";
import { formatDesignatorPathForDisplay } from "../../core/designator_segments.ts";
import type { PlannedFile } from "../../core/planned_file.ts";
import {
  deriveMeshLabel,
  escapeHtml,
  toRelativeHref,
  toResourcePath,
} from "../../core/weave/html.ts";

interface ResourcePageRenderInput {
  meshLabel: string;
  meshRootHref: string;
  pagePath: string;
  resourcePath: string;
  displayResourcePath: string;
  canonical: string;
  title: string;
  summary: string;
  badges: readonly string[];
  primaryLinks: readonly ResourcePageLink[];
  sections: readonly ResourcePageSection[];
  rawSourcePanels: readonly ResourcePageRawSourcePanelModel[];
}

interface ResourcePageLink {
  label: string;
  href?: string;
  detail?: string;
}

interface ResourcePageSection {
  title: string;
  html: string;
}

interface ResourcePageTheme {
  render(input: ResourcePageRenderInput): string;
}

const defaultResourcePageTheme: ResourcePageTheme = {
  render: renderDefaultResourcePage,
};

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
  const displayResourcePath = formatDesignatorPathForDisplay(resourcePath);
  const canonical = new URL(resourcePath, meshBase).href;
  const meshLabel = deriveMeshLabel(meshBase);
  const meshRootHref = toMeshRootHref(meshBase);
  const escapedResourcePath = escapeHtml(displayResourcePath);
  const escapedCanonical = escapeHtml(canonical);
  const escapedMeshLabel = escapeHtml(meshLabel);

  if (page.kind !== "customIdentifier") {
    return defaultResourcePageTheme.render(
      toDefaultResourcePageRenderInput(
        page,
        meshLabel,
        meshRootHref,
        resourcePath,
        displayResourcePath,
        canonical,
      ),
    );
  }

  if (page.kind === "customIdentifier") {
    const stylesheetLinks = page.stylesheetPaths.map((stylesheetPath) =>
      `  <link rel="stylesheet" href="${
        escapeHtml(
          ensureRelativePageHref(toRelativeHref(page.path, stylesheetPath)),
        )
      }">`
    ).join("\n");
    const slug = toDesignatorSlug(page.designatorPath);
    const definitionHref = ensureRelativePageHref(
      toRelativeHref(page.path, page.definitionPath),
    );
    const mainRegion = page.regions.find((region) => region.key === "main");
    const sidebarRegion = page.regions.find((region) =>
      region.key === "sidebar"
    );
    const extraRegions = page.regions.filter((region) =>
      region.key !== "main" && region.key !== "sidebar"
    );

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapedMeshLabel} ${escapedResourcePath}</title>
  <link rel="canonical" href="${escapedCanonical}">
${stylesheetLinks ? `${stylesheetLinks}\n` : ""}</head>
<body class="${escapeHtml(`${slug}-custom-page`)}">
  <main class="${escapeHtml(`${slug}-layout`)}">
    <article class="${escapeHtml(`${slug}-main`)}">
${renderMarkdownRegion(mainRegion?.markdown ?? "")}
    </article>
    <aside class="${escapeHtml(`${slug}-sidebar`)}">
${renderMarkdownRegion(sidebarRegion?.markdown ?? "")}
    </aside>
${
      extraRegions.map((region) =>
        `    <section class="${escapeHtml(`${slug}-${region.key}`)}">\n${
          indentLines(renderMarkdownRegion(region.markdown), 6)
        }\n    </section>`
      ).join("\n")
    }
  </main>
  <footer>
    <small>The Semantic Flow identifier <a href="${escapedCanonical}">${escapedCanonical}</a> is currently rendered from the page-definition support artifact at <a href="${
      escapeHtml(definitionHref)
    }">${escapeHtml(definitionHref)}</a>.</small>
  </footer>
</body>
</html>
`;
  }

  return assertNeverResourcePage(page);
}

function toDefaultResourcePageRenderInput(
  page: Exclude<ResourcePageModel, { kind: "customIdentifier" }>,
  meshLabel: string,
  meshRootHref: string,
  resourcePath: string,
  displayResourcePath: string,
  canonical: string,
): ResourcePageRenderInput {
  if (page.kind === "identifier") {
    const workingFileHref = page.workingLocalRelativePath
      ? toPublicSourceHref(meshRootHref, page.workingLocalRelativePath)
      : undefined;

    return {
      meshLabel,
      meshRootHref,
      pagePath: page.path,
      resourcePath,
      displayResourcePath,
      canonical,
      title: formatDesignatorPathForDisplay(page.designatorPath),
      summary: "Semantic Flow identifier.",
      badges: ["Semantic Flow identifier"],
      primaryLinks: [
        { label: "Canonical IRI", href: canonical },
        {
          label: "Associated Knop",
          href: toMeshResourceHref(
            meshRootHref,
            toKnopResourcePath(resourcePath),
          ),
        },
        ...(page.workingLocalRelativePath
          ? [{
            label: "Working RDF file",
            href: workingFileHref,
            detail: workingFileHref
              ? "current working bytes"
              : `local source: ${page.workingLocalRelativePath}`,
          }]
          : []),
      ],
      sections: [],
      rawSourcePanels: page.rawSourcePanels ?? [],
    };
  }

  if (page.kind === "referenceCatalog") {
    const currentLinks = page.currentLinks.map((link) => {
      const targetHref = toMeshResourceHref(
        meshRootHref,
        link.referenceTargetPath,
      );
      const stateHref = link.referenceTargetStatePath
        ? toMeshResourceHref(meshRootHref, link.referenceTargetStatePath)
        : undefined;
      const escapedFragment = escapeHtml(link.fragment);
      const escapedRoleLabel = escapeHtml(link.referenceRoleLabel);
      const escapedTargetHref = escapeHtml(targetHref);
      const escapedStateHref = stateHref ? escapeHtml(stateHref) : undefined;
      const escapedTargetPath = escapeHtml(
        formatDesignatorPathForDisplay(link.referenceTargetPath),
      );

      return stateHref
        ? `        <li id="${escapedFragment}"><code>#${escapedFragment}</code>: ${escapedRoleLabel} reference target <a href="${escapedTargetHref}">${escapedTargetPath}</a>, pinned to <a href="${escapedStateHref}">${escapedStateHref}</a>.</li>`
        : `        <li id="${escapedFragment}"><code>#${escapedFragment}</code>: ${escapedRoleLabel} reference target <code>${escapedTargetPath}</code>.</li>`;
    }).join("\n");

    return {
      meshLabel,
      meshRootHref,
      pagePath: page.path,
      resourcePath,
      displayResourcePath,
      canonical,
      title: page.catalogPath,
      summary: `ReferenceCatalog artifact for ${
        formatDesignatorPathForDisplay(page.ownerDesignatorPath)
      }.`,
      badges: ["ReferenceCatalog", "RDF document"],
      primaryLinks: [{ label: "Canonical IRI", href: canonical }],
      sections: [{
        title: "Current Links",
        html: `      <ul>\n${currentLinks}\n      </ul>`,
      }],
      rawSourcePanels: page.rawSourcePanels ?? [],
    };
  }

  return {
    meshLabel,
    meshRootHref,
    pagePath: page.path,
    resourcePath,
    displayResourcePath,
    canonical,
    title: displayResourcePath,
    summary: page.description,
    badges: [classifyResourcePage(resourcePath)],
    primaryLinks: [{ label: "Canonical IRI", href: canonical }],
    sections: [],
    rawSourcePanels: page.rawSourcePanels ?? [],
  };
}

function renderDefaultResourcePage(input: ResourcePageRenderInput): string {
  const canonicalDisplay = escapeHtml(input.canonical);
  const rawSections = input.rawSourcePanels.length > 0
    ? `\n${renderRawSourcePanels(input)}`
    : "";
  const sections = input.sections.map((section) =>
    `    <section class="wf-section">
      <h2>${escapeHtml(section.title)}</h2>
${section.html}
    </section>`
  ).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(input.meshLabel)} ${
    escapeHtml(input.displayResourcePath)
  }</title>
  <link rel="canonical" href="${escapeHtml(input.canonical)}">
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f7f4; color: #20231f; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: linear-gradient(180deg, #f6f7f4 0%, #ebece7 100%); }
    a { color: #1f5f85; text-decoration-thickness: 0.08em; text-underline-offset: 0.18em; }
    main { width: min(1120px, calc(100% - 32px)); margin: 0 auto; padding: 32px 0 42px; }
    .wf-shell { display: grid; gap: 18px; }
    .wf-eyebrow { margin: 0 0 10px; color: #5e675d; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0; font-weight: 700; }
    .wf-hero { border-top: 5px solid #435247; padding: 26px 0 12px; }
    h1 { margin: 0; overflow-wrap: anywhere; font-size: clamp(2rem, 6vw, 4.8rem); line-height: 0.98; letter-spacing: 0; }
    .wf-summary { max-width: 820px; margin: 18px 0 0; color: #3f463f; font-size: 1.05rem; line-height: 1.6; }
    .wf-badges, .wf-links { display: flex; flex-wrap: wrap; gap: 8px; margin: 18px 0 0; padding: 0; list-style: none; }
    .wf-badges li { border: 1px solid #c9cec7; background: #ffffffb8; color: #394139; border-radius: 999px; padding: 5px 10px; font-size: 0.78rem; font-weight: 700; }
    .wf-links a { display: inline-flex; min-height: 34px; align-items: center; border: 1px solid #bfc8c1; border-radius: 6px; background: #fff; padding: 7px 10px; color: #173f59; font-weight: 650; text-decoration: none; }
    .wf-links small { display: block; margin-top: 4px; color: #667065; }
    .wf-section, .wf-source { margin-top: 24px; border-top: 1px solid #cdd2ca; padding-top: 18px; }
    h2 { margin: 0 0 12px; font-size: 1rem; line-height: 1.25; letter-spacing: 0; color: #2f382f; }
    ul { margin: 0; padding-left: 1.2rem; }
    li { margin: 0.45rem 0; line-height: 1.45; }
    code, pre { font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; }
    code { background: #e9ece6; border-radius: 4px; padding: 0.12rem 0.25rem; }
    details { border: 1px solid #c9cec7; border-radius: 8px; background: #fff; }
    details + details { margin-top: 12px; }
    summary { cursor: pointer; padding: 12px 14px; font-weight: 750; }
    .wf-source-meta { display: flex; flex-wrap: wrap; gap: 10px; padding: 0 14px 12px; color: #596259; font-size: 0.88rem; }
    pre { margin: 0; max-height: 64vh; overflow: auto; border-top: 1px solid #d7dcd4; background: #151a16; color: #e7ece4; padding: 16px; font-size: 0.86rem; line-height: 1.55; tab-size: 2; }
    pre code { display: block; background: transparent; color: inherit; border-radius: 0; padding: 0; white-space: pre; }
    footer { width: min(1120px, calc(100% - 32px)); margin: 0 auto; padding: 0 0 28px; color: #687167; }
  </style>
  <script>
    if (location.pathname.endsWith("/") && !location.search && !location.hash) {
      history.replaceState(null, "", location.pathname.slice(0, -1));
    }
  </script>
</head>
<body>
  <main>
    <article class="wf-shell">
      <header class="wf-hero">
        <p class="wf-eyebrow">${escapeHtml(input.meshLabel)}</p>
        <h1>${escapeHtml(input.title)}</h1>
        <p class="wf-summary">${escapeHtml(input.summary)}</p>
        <ul class="wf-badges">
${
    input.badges.map((badge) => `          <li>${escapeHtml(badge)}</li>`).join(
      "\n",
    )
  }
        </ul>
        <ul class="wf-links">
${input.primaryLinks.map((link) => renderPrimaryLink(link)).join("\n")}
        </ul>
      </header>
${sections ? `${sections}\n` : ""}${rawSections}
    </article>
  </main>
  <footer>
    <small>Canonical Semantic Flow resource: <a href="${
    escapeHtml(input.canonical)
  }">${canonicalDisplay}</a>.</small>
  </footer>
</body>
</html>
`;
}

function renderPrimaryLink(link: ResourcePageLink): string {
  const detail = link.detail ? `<small>${escapeHtml(link.detail)}</small>` : "";
  const label = link.href
    ? `<a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`
    : `<span>${escapeHtml(link.label)}</span>`;
  return `          <li>${label}${detail}</li>`;
}

function renderRawSourcePanels(input: ResourcePageRenderInput): string {
  return `    <section class="wf-source">
      <h2>Raw RDF Source</h2>
${
    input.rawSourcePanels.map((panel) => renderRawSourcePanel(input, panel))
      .join("\n")
  }
    </section>`;
}

function renderRawSourcePanel(
  input: ResourcePageRenderInput,
  panel: ResourcePageRawSourcePanelModel,
): string {
  const sourceHref = toPublicSourceHref(input.meshRootHref, panel.sourcePath);
  const body = panel.contents === undefined
    ? `        <p>This source is ${
      panel.omittedByteLength ?? 0
    } bytes, so Weave omitted the inline copy. Use the raw file link instead.</p>`
    : `        <pre><code>${escapeHtml(panel.contents)}</code></pre>`;

  return `      <details open>
        <summary>${escapeHtml(panel.label)}</summary>
        <div class="wf-source-meta">
          <span>${escapeHtml(panel.sourcePath)}</span>
          ${
    sourceHref
      ? `<a href="${escapeHtml(sourceHref)}">Raw file</a>`
      : `<span>Local source outside mesh root</span>`
  }
        </div>
${body}
      </details>`;
}

function toMeshRootHref(meshBase: string): string {
  const pathname = new URL(meshBase).pathname;
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}

function toMeshResourceHref(
  meshRootHref: string,
  resourcePath: string,
): string {
  return `${meshRootHref}${resourcePath}`;
}

function toPublicSourceHref(
  meshRootHref: string,
  sourcePath: string,
): string | undefined {
  if (sourcePath.startsWith("../")) {
    return undefined;
  }
  return toMeshResourceHref(meshRootHref, sourcePath);
}

function toKnopResourcePath(resourcePath: string): string {
  return resourcePath.length === 0 ? "_knop" : `${resourcePath}/_knop`;
}

function classifyResourcePage(resourcePath: string): string {
  if (resourcePath === "_mesh") return "SemanticMesh";
  if (resourcePath.endsWith("/_knop")) return "Knop";
  if (resourcePath.endsWith("/_meta")) return "Metadata artifact";
  if (resourcePath.endsWith("/_inventory")) return "Inventory artifact";
  if (resourcePath.endsWith("/_config")) return "Config artifact";
  if (resourcePath.includes("/_history")) {
    if (resourcePath.match(/\/_s[0-9]+\/[^/]+$/)) return "Manifestation";
    if (resourcePath.match(/\/_s[0-9]+$/)) return "Historical state";
    return "Artifact history";
  }
  return "Resource";
}

function assertNeverResourcePage(page: never): never {
  throw new Error(
    `Unsupported ResourcePageModel kind: ${JSON.stringify(page)}`,
  );
}

function toDesignatorSlug(designatorPath: string): string {
  if (designatorPath.length === 0) {
    return "root";
  }

  const segments = designatorPath.split("/").filter((segment) =>
    segment.length > 0
  );
  return segments[segments.length - 1] ?? "resource";
}

function renderMarkdownRegion(markdown: string): string {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const blocks: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]!;
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      index += 1;
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (headingMatch) {
      const level = headingMatch[1]!.length;
      blocks.push(
        `      <h${level}>${
          renderInlineMarkdown(headingMatch[2]!)
        }</h${level}>`,
      );
      index += 1;
      continue;
    }

    if (trimmed.startsWith("- ")) {
      const items: string[] = [];
      while (index < lines.length) {
        const candidate = lines[index]!.trim();
        if (!candidate.startsWith("- ")) {
          break;
        }
        items.push(
          `        <li>${renderInlineMarkdown(candidate.slice(2))}</li>`,
        );
        index += 1;
      }
      blocks.push(`      <ul>\n${items.join("\n")}\n      </ul>`);
      continue;
    }

    const paragraphLines = [trimmed];
    index += 1;
    while (index < lines.length) {
      const candidate = lines[index]!.trim();
      if (
        candidate.length === 0 ||
        /^(#{1,6})\s+/.test(candidate) ||
        candidate.startsWith("- ")
      ) {
        break;
      }
      paragraphLines.push(candidate);
      index += 1;
    }
    blocks.push(
      `      <p>${renderInlineMarkdown(paragraphLines.join(" "))}</p>`,
    );
  }

  return blocks.length > 0 ? blocks.join("\n") : "      <p></p>";
}

function renderInlineMarkdown(markdown: string): string {
  let html = escapeHtml(markdown).replaceAll("&#39;", "'");
  html = html.replaceAll(
    /`([^`]+)`/g,
    (_match, code) => `<code>${code}</code>`,
  );
  html = html.replaceAll(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, label, href) =>
      `<a href="${escapeHtml(href)}">${renderInlineMarkdown(label)}</a>`,
  );
  return html;
}

function ensureRelativePageHref(href: string): string {
  if (
    href.startsWith("./") || href.startsWith("../") || href.startsWith("/") ||
    href.startsWith("#")
  ) {
    return href;
  }
  return `./${href}`;
}

function indentLines(contents: string, spaces: number): string {
  const prefix = " ".repeat(spaces);
  return contents.split("\n").map((line) => `${prefix}${line.trimStart()}`)
    .join("\n");
}
