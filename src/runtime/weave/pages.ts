import type {
  ResourcePageHistoryGroupModel,
  ResourcePageModel,
  ResourcePageRawSourcePanelModel,
} from "../../core/weave/weave.ts";
import { Parser, type Quad } from "n3";
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
  summary?: string;
  rdfClasses: readonly string[];
  metadataRows: readonly ResourcePageMetadataRow[];
  historyGroups: readonly ResourcePageHistoryGroupModel[];
  sections: readonly ResourcePageSection[];
  rawSourcePanels: readonly ResourcePageRawSourcePanelModel[];
}

interface ResourcePageMetadataRow {
  label: string;
  href?: string;
  value: string;
  tooltip?: string;
}

interface ResourcePageSection {
  title: string;
  html: string;
}

interface ResourcePageRdfFacts {
  title?: string;
  description?: string;
  classes: readonly string[];
}

interface ResourcePageTheme {
  render(input: ResourcePageRenderInput): string;
}

const RDF_TYPE_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const DCTERMS_DESCRIPTION_IRI = "http://purl.org/dc/terms/description";
const DCTERMS_TITLE_IRI = "http://purl.org/dc/terms/title";
const FOAF_NAME_IRI = "http://xmlns.com/foaf/0.1/name";
const RDFS_COMMENT_IRI = "http://www.w3.org/2000/01/rdf-schema#comment";
const RDFS_LABEL_IRI = "http://www.w3.org/2000/01/rdf-schema#label";
const SKOS_DEFINITION_IRI = "http://www.w3.org/2004/02/skos/core#definition";
const SKOS_PREF_LABEL_IRI = "http://www.w3.org/2004/02/skos/core#prefLabel";
const SCHEMA_CHARACTER_NAME_IRIS = [
  "https://schema.org/characterName",
  "http://schema.org/characterName",
] as const;
const SCHEMA_NAME_IRIS = [
  "https://schema.org/name",
  "http://schema.org/name",
  "https://schema.org/Name",
  "http://schema.org/Name",
] as const;

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
    const rdfFacts = extractRdfFacts(canonical, page.rawSourcePanels ?? []);
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
      title: rdfFacts.title ??
        formatDesignatorPathForDisplay(page.designatorPath),
      summary: rdfFacts.description,
      rdfClasses: rdfFacts.classes,
      metadataRows: [
        { label: "Canonical IRI", value: canonical },
        {
          label: "Associated Knop",
          href: toMeshResourceHref(
            meshRootHref,
            toKnopResourcePath(resourcePath),
          ),
          value: formatDesignatorPathForDisplay(
            toKnopResourcePath(resourcePath),
          ),
          tooltip:
            "A Knop is the Semantic Flow control surface for this identifier: metadata, inventory, references, and page definitions live there.",
        },
        ...(page.workingLocalRelativePath
          ? [{
            label: "Working File",
            href: workingFileHref,
            value: page.workingLocalRelativePath,
          }]
          : []),
      ],
      historyGroups: page.historyGroups ?? [],
      sections: [],
      rawSourcePanels: page.rawSourcePanels ?? [],
    };
  }

  if (page.kind === "referenceCatalog") {
    const rdfFacts = extractRdfFacts(canonical, page.rawSourcePanels ?? []);
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
      title: rdfFacts.title ?? page.catalogPath,
      summary: `ReferenceCatalog artifact for ${
        formatDesignatorPathForDisplay(page.ownerDesignatorPath)
      }.`,
      rdfClasses: ["ReferenceCatalog", "RDF document"],
      metadataRows: [{ label: "Canonical IRI", value: canonical }],
      historyGroups: page.historyGroups ?? [],
      sections: [{
        title: "Current Links",
        html: `      <ul>\n${currentLinks}\n      </ul>`,
      }],
      rawSourcePanels: page.rawSourcePanels ?? [],
    };
  }

  const rdfFacts = extractRdfFacts(canonical, page.rawSourcePanels ?? []);

  return {
    meshLabel,
    meshRootHref,
    pagePath: page.path,
    resourcePath,
    displayResourcePath,
    canonical,
    title: rdfFacts.title ?? displayResourcePath,
    summary: page.description,
    rdfClasses: [classifyResourcePage(resourcePath)],
    metadataRows: [{ label: "Canonical IRI", value: canonical }],
    historyGroups: page.historyGroups ?? [],
    sections: [],
    rawSourcePanels: page.rawSourcePanels ?? [],
  };
}

function renderDefaultResourcePage(input: ResourcePageRenderInput): string {
  const rawSections = input.rawSourcePanels.length > 0
    ? `\n${renderRawSourcePanels(input)}`
    : "";
  const summary = input.summary
    ? `        <p class="wf-summary">${escapeHtml(input.summary)}</p>\n`
    : "";
  const classes = input.rdfClasses.length > 0
    ? `        <p class="wf-classes">${
      input.rdfClasses.map((className) => escapeHtml(className)).join(", ")
    }</p>\n`
    : "";
  const metadata = input.metadataRows.length > 0
    ? `        <table class="wf-metadata">
          <tbody>
${input.metadataRows.map((row) => renderMetadataRow(row)).join("\n")}
          </tbody>
        </table>
`
    : "";
  const histories = input.historyGroups.length > 0
    ? `    <section class="wf-section">
      <details class="wf-history">
        <summary>Histories</summary>
${renderHistoryGroups(input)}
      </details>
    </section>
`
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
    .wf-classes { margin: 10px 0 0; color: #687167; font-style: italic; }
    .wf-metadata { width: 100%; margin-top: 24px; border-collapse: collapse; border-top: 1px solid #cdd2ca; border-bottom: 1px solid #cdd2ca; }
    .wf-metadata th, .wf-metadata td { padding: 10px 12px; border-top: 1px solid #e0e4dd; text-align: left; vertical-align: top; }
    .wf-metadata tr:first-child th, .wf-metadata tr:first-child td { border-top: 0; }
    .wf-metadata th { width: 180px; color: #4f594f; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0; }
    .wf-metadata td { overflow-wrap: anywhere; }
    .wf-section, .wf-source { margin-top: 24px; border-top: 1px solid #cdd2ca; padding-top: 18px; }
    h2 { margin: 0 0 12px; font-size: 1rem; line-height: 1.25; letter-spacing: 0; color: #2f382f; }
    ul { margin: 0; padding-left: 1.2rem; }
    li { margin: 0.45rem 0; line-height: 1.45; }
    code, pre { font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; }
    code { background: #e9ece6; border-radius: 4px; padding: 0.12rem 0.25rem; }
    details { border: 1px solid #c9cec7; border-radius: 8px; background: #fff; }
    details + details { margin-top: 12px; }
    summary { cursor: pointer; padding: 12px 14px; font-weight: 750; }
    .wf-history { padding-bottom: 10px; }
    .wf-history-group { padding: 0 14px 8px; }
    .wf-history-group h3 { margin: 8px 0; font-size: 0.95rem; }
    .wf-history-group ul { margin-top: 8px; }
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
${summary}${classes}${metadata}
      </header>
${histories}${sections ? `${sections}\n` : ""}${rawSections}
    </article>
  </main>
</body>
</html>
`;
}

function renderMetadataRow(row: ResourcePageMetadataRow): string {
  const label = row.tooltip
    ? `<span title="${escapeHtml(row.tooltip)}">${escapeHtml(row.label)}</span>`
    : escapeHtml(row.label);
  const value = row.href
    ? `<a href="${escapeHtml(row.href)}">${escapeHtml(row.value)}</a>`
    : `<span>${escapeHtml(row.value)}</span>`;
  return `            <tr><th scope="row">${label}</th><td>${value}</td></tr>`;
}

function renderHistoryGroups(input: ResourcePageRenderInput): string {
  return input.historyGroups.map((group) => {
    const historyHref = toMeshResourceHref(input.meshRootHref, group.path);
    const states = group.states.length > 0
      ? `          <ul>
${
        group.states.map((state) => {
          const stateHref = toMeshResourceHref(input.meshRootHref, state.path);
          const locatedFile = state.locatedFilePath
            ? ` <small>RDF: <a href="${
              escapeHtml(
                toMeshResourceHref(input.meshRootHref, state.locatedFilePath),
              )
            }">${escapeHtml(state.locatedFilePath)}</a></small>`
            : "";
          return `            <li><a href="${escapeHtml(stateHref)}">${
            escapeHtml(state.path)
          }</a>${locatedFile}</li>`;
        }).join("\n")
      }
          </ul>`
      : "          <p>No historical states are listed yet.</p>";

    return `        <div class="wf-history-group">
          <h3>${escapeHtml(group.label)}</h3>
          <p><a href="${escapeHtml(historyHref)}">${
      escapeHtml(group.path)
    }</a></p>
${states}
        </div>`;
  }).join("\n");
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

function extractRdfFacts(
  canonical: string,
  rawSourcePanels: readonly ResourcePageRawSourcePanelModel[],
): ResourcePageRdfFacts {
  const quads = rawSourcePanels.flatMap((panel) =>
    panel.contents ? parseRdfPanel(canonical, panel.contents) : []
  );
  const title = findFirstLiteralObject(quads, canonical, DCTERMS_TITLE_IRI) ??
    findFirstLiteralObjectFromPredicates(
      quads,
      canonical,
      SCHEMA_CHARACTER_NAME_IRIS,
    ) ??
    findFirstLiteralObjectFromPredicates(quads, canonical, SCHEMA_NAME_IRIS) ??
    findFirstLiteralObject(quads, canonical, RDFS_LABEL_IRI) ??
    findFirstLiteralObject(quads, canonical, SKOS_PREF_LABEL_IRI) ??
    findFirstLiteralObject(quads, canonical, FOAF_NAME_IRI);
  const description = findFirstLiteralObject(
    quads,
    canonical,
    DCTERMS_DESCRIPTION_IRI,
  ) ?? findFirstLiteralObject(quads, canonical, RDFS_COMMENT_IRI) ??
    findFirstLiteralObject(quads, canonical, SKOS_DEFINITION_IRI);
  const classes = new Set<string>();

  for (const quad of quads) {
    if (
      quad.subject.termType === "NamedNode" &&
      quad.subject.value === canonical &&
      quad.predicate.value === RDF_TYPE_IRI &&
      quad.object.termType === "NamedNode"
    ) {
      classes.add(compactRdfIri(quad.object.value));
    }
  }

  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    classes: [...classes].sort((left, right) => left.localeCompare(right)),
  };
}

function parseRdfPanel(
  canonical: string,
  turtle: string,
): readonly Quad[] {
  try {
    return new Parser({ baseIRI: canonical }).parse(turtle);
  } catch {
    return [];
  }
}

function findFirstLiteralObject(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
): string | undefined {
  for (const quad of quads) {
    if (
      quad.subject.termType === "NamedNode" &&
      quad.subject.value === subjectIri &&
      quad.predicate.value === predicateIri &&
      quad.object.termType === "Literal"
    ) {
      return quad.object.value;
    }
  }
  return undefined;
}

function findFirstLiteralObjectFromPredicates(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIris: readonly string[],
): string | undefined {
  for (const predicateIri of predicateIris) {
    const value = findFirstLiteralObject(quads, subjectIri, predicateIri);
    if (value) {
      return value;
    }
  }
  return undefined;
}

function compactRdfIri(iri: string): string {
  for (
    const [namespace, prefix] of [
      ["http://www.w3.org/2002/07/owl#", "owl"],
      ["http://www.w3.org/2000/01/rdf-schema#", "rdfs"],
      ["http://www.w3.org/1999/02/22-rdf-syntax-ns#", "rdf"],
      ["https://semantic-flow.github.io/semantic-flow-ontology/", "sflo"],
      ["https://semantic-flow.github.io/ontology/core/", "sfc"],
    ] as const
  ) {
    if (iri.startsWith(namespace)) {
      return `${prefix}:${iri.slice(namespace.length)}`;
    }
  }

  const hashIndex = iri.lastIndexOf("#");
  if (hashIndex !== -1 && hashIndex < iri.length - 1) {
    return iri.slice(hashIndex + 1);
  }
  const slashIndex = iri.lastIndexOf("/");
  return slashIndex !== -1 && slashIndex < iri.length - 1
    ? iri.slice(slashIndex + 1)
    : iri;
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
