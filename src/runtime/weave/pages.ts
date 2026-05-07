import type {
  ResourcePageChildIdentifierModel,
  ResourcePageExtractionSourceModel,
  ResourcePageHistoryGroupModel,
  ResourcePageModel,
  ResourcePageRawSourcePanelModel,
} from "../../core/weave/weave.ts";
import { Parser, type Quad } from "n3";
import { codeToHtml } from "shiki";
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
  meshBase: string;
  meshRootHref: string;
  pagePath: string;
  resourcePath: string;
  displayResourcePath: string;
  canonical: string;
  generatedAtIso: string;
  generatedAtDisplay: string;
  meshFaviconHref?: string;
  title: string;
  breadcrumbs: readonly ResourcePageBreadcrumb[];
  summary?: string;
  rdfClasses: readonly ResourcePageRdfClass[];
  metadataRows: readonly ResourcePageMetadataRow[];
  includeSemanticFlowMetadata: boolean;
  semanticFlowMetadataRows: readonly ResourcePageMetadataRow[];
  historyGroups: readonly ResourcePageHistoryGroupModel[];
  sections: readonly ResourcePageSection[];
  rawSourcePanels: readonly ResourcePageRawSourcePanelModel[];
}

interface ResourcePageMetadataRow {
  label: string;
  href?: string;
  value: string;
  html?: string;
  tooltip?: string;
}

interface ResourcePageBreadcrumb {
  label: string;
  href?: string;
}

interface ResourcePageSection {
  id?: string;
  title: string;
  html: string;
}

interface ResourcePageRdfFacts {
  title?: string;
  description?: string;
  note?: string;
  broader: readonly ResourcePageRdfIriLink[];
  narrower: readonly ResourcePageRdfIriLink[];
  classes: readonly ResourcePageRdfClass[];
}

interface ResourcePageRdfIriLink {
  label: string;
  href: string;
}

interface ResourcePageRdfClass {
  label: string;
  iri: string;
}

interface ResourcePageTheme {
  render(input: ResourcePageRenderInput): Promise<string>;
}

const RDF_TYPE_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const RDF_PROPERTY_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#Property";
const DCTERMS_DESCRIPTION_IRI = "http://purl.org/dc/terms/description";
const DCTERMS_TITLE_IRI = "http://purl.org/dc/terms/title";
const FOAF_NAME_IRI = "http://xmlns.com/foaf/0.1/name";
const OWL_ANNOTATION_PROPERTY_IRI =
  "http://www.w3.org/2002/07/owl#AnnotationProperty";
const OWL_CLASS_IRI = "http://www.w3.org/2002/07/owl#Class";
const OWL_DATATYPE_PROPERTY_IRI =
  "http://www.w3.org/2002/07/owl#DatatypeProperty";
const OWL_OBJECT_PROPERTY_IRI = "http://www.w3.org/2002/07/owl#ObjectProperty";
const RDFS_COMMENT_IRI = "http://www.w3.org/2000/01/rdf-schema#comment";
const RDFS_DATATYPE_IRI = "http://www.w3.org/2000/01/rdf-schema#Datatype";
const RDFS_LABEL_IRI = "http://www.w3.org/2000/01/rdf-schema#label";
const SKOS_BROADER_IRI = "http://www.w3.org/2004/02/skos/core#broader";
const SKOS_DEFINITION_IRI = "http://www.w3.org/2004/02/skos/core#definition";
const SKOS_NARROWER_IRI = "http://www.w3.org/2004/02/skos/core#narrower";
const SKOS_NOTE_IRI = "http://www.w3.org/2004/02/skos/core#note";
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
const HISTORY_TRUNCATION_THRESHOLD = 10;
const HISTORY_TRUNCATION_HEAD_COUNT = 2;
const HISTORY_TRUNCATION_TAIL_COUNT = 7;
const SFLO_EXTRACTION_SOURCE_IRI =
  "https://semantic-flow.github.io/sflo/ontology/ExtractionSource";
const SFLO_HAS_ARTIFACT_RESOLUTION_MODE_IRI =
  "https://semantic-flow.github.io/sflo/ontology/hasArtifactResolutionMode";
const SFLO_HAS_REQUESTED_TARGET_STATE_IRI =
  "https://semantic-flow.github.io/sflo/ontology/hasRequestedTargetState";

type TruncatedHistoryItem<T> =
  | { kind: "item"; value: T }
  | { kind: "gap"; omittedCount: number };
const SFLO_HAS_TARGET_ARTIFACT_IRI =
  "https://semantic-flow.github.io/sflo/ontology/hasTargetArtifact";
const WEAVE_REPOSITORY_URL = "https://github.com/semantic-flow/weave/";
const SOURCE_THEME = "github-dark-default";
const SEMANTIC_FLOW_NAMESPACE =
  "https://semantic-flow.github.io/sflo/ontology/";
const SEMANTIC_FLOW_CONFIG_NAMESPACE =
  "https://semantic-flow.github.io/ontology/config/";
const COMMON_RDF_PREFIXES: readonly [namespace: string, prefix: string][] = [
  ["http://www.w3.org/2002/07/owl#", "owl"],
  ["http://www.w3.org/ns/shacl#", "sh"],
  ["http://www.w3.org/2000/01/rdf-schema#", "rdfs"],
  ["http://www.w3.org/1999/02/22-rdf-syntax-ns#", "rdf"],
  [SEMANTIC_FLOW_NAMESPACE, "sflo"],
  [SEMANTIC_FLOW_CONFIG_NAMESPACE, "sfcfg"],
];

const defaultResourcePageTheme: ResourcePageTheme = {
  render: renderDefaultResourcePage,
};

export interface ResourcePageRenderOptions {
  generatedAt?: Date;
  includeSemanticFlowMetadata?: boolean;
  meshFaviconPath?: string;
}

export async function renderResourcePages(
  meshBase: string,
  pages: readonly ResourcePageModel[],
  options: ResourcePageRenderOptions = {},
): Promise<readonly PlannedFile[]> {
  return await Promise.all(
    pages.map(async (page) => ({
      path: page.path,
      contents: await renderResourcePage(meshBase, page, options),
    })),
  );
}

export async function renderResourcePage(
  meshBase: string,
  page: ResourcePageModel,
  options: ResourcePageRenderOptions = {},
): Promise<string> {
  const resourcePath = toResourcePath(page.path);
  const canonical = toCanonicalResourceIri(meshBase, resourcePath);
  const meshLabel = deriveMeshLabel(meshBase);
  const displayResourcePath = toDisplayDesignatorPath(resourcePath, meshLabel);
  const meshRootHref = toMeshRootHref(meshBase);
  const meshFaviconHref = options.meshFaviconPath
    ? toMeshResourceHref(meshRootHref, options.meshFaviconPath)
    : undefined;
  const escapedCanonical = escapeHtml(canonical);

  if (page.kind !== "customIdentifier") {
    return await defaultResourcePageTheme.render(
      toDefaultResourcePageRenderInput(
        page,
        meshLabel,
        meshBase,
        meshRootHref,
        resourcePath,
        displayResourcePath,
        canonical,
        options.generatedAt ?? new Date(),
        options.includeSemanticFlowMetadata ?? false,
        meshFaviconHref,
      ),
    );
  }

  if (page.kind === "customIdentifier") {
    const displayTitle = toDefaultResourcePageTitle(
      resourcePath,
      meshLabel,
    );
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
  <title>${escapeHtml(toHtmlDocumentTitle(meshLabel, displayTitle))}</title>
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
  meshBase: string,
  meshRootHref: string,
  resourcePath: string,
  displayResourcePath: string,
  canonical: string,
  generatedAt: Date,
  includeSemanticFlowMetadata: boolean,
  meshFaviconHref: string | undefined,
): ResourcePageRenderInput {
  const generatedAtIso = generatedAt.toISOString();
  const generatedAtDisplay = formatGeneratedAtDisplay(generatedAt);
  if (page.kind === "identifier") {
    const sourcePanelsForFacts = page.rawSourcePanels ?? [];
    const rawSourcePanelsForDisplay = page.workingLocalRelativePath
      ? sourcePanelsForFacts
      : [];
    const rdfFacts = extractRdfFacts(canonical, sourcePanelsForFacts);
    const workingFileHref = page.workingLocalRelativePath
      ? toPublicSourceHref(meshRootHref, page.workingLocalRelativePath)
      : undefined;

    return {
      meshLabel,
      meshBase,
      meshRootHref,
      pagePath: page.path,
      resourcePath,
      displayResourcePath,
      canonical,
      generatedAtIso,
      generatedAtDisplay,
      meshFaviconHref,
      title: rdfFacts.title ??
        toDefaultResourcePageTitle(
          page.designatorPath,
          meshLabel,
        ),
      breadcrumbs: toResourcePageBreadcrumbs(
        meshLabel,
        meshRootHref,
        resourcePath,
      ),
      summary: rdfFacts.description,
      rdfClasses: rdfFacts.classes,
      metadataRows: [
        { label: "Canonical IRI", value: canonical },
        ...(rdfFacts.note ? [{ label: "Note", value: rdfFacts.note }] : []),
        ...toRdfIriLinkMetadataRows("Broader", rdfFacts.broader),
        ...toRdfIriLinkMetadataRows("Narrower", rdfFacts.narrower),
        ...toChildIdentifierMetadataRows(
          meshBase,
          meshRootHref,
          canonical,
          page.childIdentifiers ?? [],
          sourcePanelsForFacts,
        ),
      ],
      includeSemanticFlowMetadata,
      semanticFlowMetadataRows: [
        toKnopMetadataRow(meshRootHref, meshLabel, resourcePath),
        ...(page.workingLocalRelativePath
          ? [{
            label: "Working File",
            href: workingFileHref,
            value: page.workingLocalRelativePath,
          }]
          : []),
        ...toExtractionSourceMetadataRows(
          meshRootHref,
          meshLabel,
          page.extractionSource,
        ),
      ],
      historyGroups: page.historyGroups ?? [],
      sections: [],
      rawSourcePanels: rawSourcePanelsForDisplay,
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
        toDisplayDesignatorPath(link.referenceTargetPath, meshLabel),
      );

      return stateHref
        ? `        <li id="${escapedFragment}"><code>#${escapedFragment}</code>: ${escapedRoleLabel} reference target <a href="${escapedTargetHref}">${escapedTargetPath}</a>, pinned to <a href="${escapedStateHref}">${escapedStateHref}</a>.</li>`
        : `        <li id="${escapedFragment}"><code>#${escapedFragment}</code>: ${escapedRoleLabel} reference target <code>${escapedTargetPath}</code>.</li>`;
    }).join("\n");

    return {
      meshLabel,
      meshBase,
      meshRootHref,
      pagePath: page.path,
      resourcePath,
      displayResourcePath,
      canonical,
      generatedAtIso,
      generatedAtDisplay,
      meshFaviconHref,
      title: rdfFacts.title ?? toLastPathSegment(page.catalogPath),
      breadcrumbs: toResourcePageBreadcrumbs(
        meshLabel,
        meshRootHref,
        resourcePath,
      ),
      summary: `Reference catalog for ${
        toDisplayDesignatorPath(page.ownerDesignatorPath, meshLabel)
      }`,
      rdfClasses: [
        rdfClass(
          "sflo:ReferenceCatalog",
          "https://semantic-flow.github.io/sflo/ontology/ReferenceCatalog",
        ),
        rdfClass(
          "sflo:RdfDocument",
          "https://semantic-flow.github.io/sflo/ontology/RdfDocument",
        ),
      ],
      metadataRows: [{ label: "Canonical IRI", value: canonical }],
      includeSemanticFlowMetadata,
      semanticFlowMetadataRows: [],
      historyGroups: page.historyGroups ?? [],
      sections: [{
        title: "Current Links",
        html: `      <ul>\n${currentLinks}\n      </ul>`,
      }],
      rawSourcePanels: page.rawSourcePanels ?? [],
    };
  }

  if (page.kind === "knop") {
    const artifactSections = [
      ...(page.governedArtifacts.length > 0
        ? [{
          title: "Governed Artifacts",
          html: renderKnopArtifactLinks(
            meshRootHref,
            meshLabel,
            page.governedArtifacts,
          ),
        }]
        : []),
      ...(page.supportingArtifacts.length > 0
        ? [{
          title: "Supporting Artifacts",
          html: renderKnopArtifactLinks(
            meshRootHref,
            meshLabel,
            page.supportingArtifacts,
          ),
        }]
        : []),
    ];

    return {
      meshLabel,
      meshBase,
      meshRootHref,
      pagePath: page.path,
      resourcePath,
      displayResourcePath,
      canonical,
      generatedAtIso,
      generatedAtDisplay,
      meshFaviconHref,
      title: toLastPathSegment(toKnopResourcePath(page.designatorPath)),
      breadcrumbs: toResourcePageBreadcrumbs(
        meshLabel,
        meshRootHref,
        resourcePath,
      ),
      summary: `Semantic Flow bundle of supporting data for ${
        page.ownerTitle ??
          toDisplayDesignatorPath(page.designatorPath, meshLabel)
      }.`,
      rdfClasses: [
        rdfClass(
          "sflo:Knop",
          "https://semantic-flow.github.io/sflo/ontology/Knop",
        ),
      ],
      metadataRows: [
        { label: "Canonical IRI", value: canonical },
        ...toChildIdentifierMetadataRows(
          meshBase,
          meshRootHref,
          canonical,
          page.childIdentifiers ?? [],
          [],
        ),
      ],
      includeSemanticFlowMetadata,
      semanticFlowMetadataRows: [],
      historyGroups: [],
      sections: artifactSections,
      rawSourcePanels: [],
    };
  }

  const rdfFacts = extractRdfFacts(canonical, page.rawSourcePanels ?? []);

  return {
    meshLabel,
    meshBase,
    meshRootHref,
    pagePath: page.path,
    resourcePath,
    displayResourcePath,
    canonical,
    generatedAtIso,
    generatedAtDisplay,
    meshFaviconHref,
    title: rdfFacts.title ??
      toDefaultResourcePageTitle(resourcePath, meshLabel),
    breadcrumbs: toResourcePageBreadcrumbs(
      meshLabel,
      meshRootHref,
      resourcePath,
    ),
    summary: page.description,
    rdfClasses: rdfFacts.classes.length > 0
      ? rdfFacts.classes
      : [classifyResourcePage(resourcePath, page.historyGroups ?? [])],
    metadataRows: [
      { label: "Canonical IRI", value: canonical },
      ...toChildIdentifierMetadataRows(
        meshBase,
        meshRootHref,
        canonical,
        page.childIdentifiers ?? [],
        page.rawSourcePanels ?? [],
      ),
    ],
    includeSemanticFlowMetadata,
    semanticFlowMetadataRows: [],
    historyGroups: page.historyGroups ?? [],
    sections: extractFragmentSections(
      canonical,
      page.rawSourcePanels ?? [],
      meshRootHref,
      meshLabel,
    ),
    rawSourcePanels: page.rawSourcePanels ?? [],
  };
}

function renderKnopArtifactLinks(
  meshRootHref: string,
  meshLabel: string,
  artifacts: readonly { label: string; path: string }[],
): string {
  return `      <ul>
${
    artifacts.map((artifact) => {
      const href = toMeshResourceHref(meshRootHref, artifact.path);
      const displayPath = toDisplayDesignatorPath(artifact.path, meshLabel);
      return `        <li>${escapeHtml(artifact.label)}: <a href="${
        escapeHtml(href)
      }">${escapeHtml(displayPath)}</a></li>`;
    }).join("\n")
  }
      </ul>`;
}

async function renderDefaultResourcePage(
  input: ResourcePageRenderInput,
): Promise<string> {
  const rawSections = input.rawSourcePanels.length > 0
    ? `\n${await renderRawSourcePanels(input)}`
    : "";
  const faviconLink = input.meshFaviconHref
    ? `  <link rel="icon" href="${escapeHtml(input.meshFaviconHref)}">\n`
    : "";
  const summary = input.summary
    ? `        <p class="wf-summary">${escapeHtml(input.summary)}</p>\n`
    : "";
  const classes = input.rdfClasses.length > 0
    ? `        <p class="wf-classes">a ${
      input.rdfClasses.map((className) => renderRdfClassLink(className)).join(
        ", ",
      )
    }</p>\n`
    : "";
  const metadata = renderMetadataTable(input.metadataRows, 8);
  const semanticFlowMetadataSection = input.includeSemanticFlowMetadata
    ? renderSemanticFlowMetadataSection(input.semanticFlowMetadataRows)
    : "";
  const historySection = renderHistorySection(input);
  const sections = input.sections.map((section) => {
    const idAttribute = section.id ? ` id="${escapeHtml(section.id)}"` : "";
    return `    <section class="wf-section"${idAttribute}>
      <h2>${escapeHtml(section.title)}</h2>
${section.html}
    </section>`;
  }).join("\n");
  const breadcrumbs = renderBreadcrumbs(input);
  const meshFavicon = renderMeshFavicon(input);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${
    escapeHtml(toHtmlDocumentTitle(input.meshLabel, input.title))
  }</title>
  <link rel="canonical" href="${escapeHtml(input.canonical)}">
${faviconLink}  <style>
    :root { min-height: 100%; color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f7f4; color: #20231f; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; background: linear-gradient(180deg, #f6f7f4 0%, #ebece7 100%); }
    a { color: #1f5f85; text-decoration-thickness: 0.08em; text-underline-offset: 0.18em; }
    main { width: min(1120px, calc(100% - 32px)); margin: 0 auto; padding: 24px 0 42px; flex: 1 0 auto; }
    .wf-shell { display: grid; gap: 18px; min-width: 0; }
    .wf-shell > * { min-width: 0; }
    .wf-masthead { min-width: 0; }
    .wf-page-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 4px; min-width: 0; }
    .wf-eyebrow { margin: 0; color: #5e675d; font-size: 0.82rem; line-height: 1.2; letter-spacing: 0; font-weight: 700; }
    .wf-breadcrumbs { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; }
    .wf-breadcrumbs a { color: inherit; text-decoration-color: rgba(94, 103, 93, 0.45); }
    .wf-mesh-favicon { flex: 0 0 auto; width: 32px; height: 32px; object-fit: contain; }
    .wf-hero { border-top: 5px solid #435247; padding: 26px 0 12px; }
    h1 { margin: 0; overflow-wrap: anywhere; font-size: clamp(1.7rem, 4vw, 2.7rem); line-height: 1.04; letter-spacing: 0; }
    .wf-classes { margin: 8px 0 0; color: #687167; font-style: italic; }
    .wf-classes a { color: inherit; text-decoration: underline; text-decoration-color: rgba(104, 113, 103, 0.34); text-decoration-thickness: 0.06em; text-underline-offset: 0.18em; }
    .wf-summary { max-width: 820px; margin: 14px 0 0; color: #3f463f; font-size: 1.05rem; line-height: 1.6; }
    .wf-metadata { width: 100%; margin-top: 24px; border-collapse: collapse; border-top: 1px solid #cdd2ca; border-bottom: 1px solid #cdd2ca; }
    .wf-metadata th, .wf-metadata td { padding: 10px 12px; border-top: 1px solid #e0e4dd; text-align: left; vertical-align: top; }
    .wf-metadata tr:first-child th, .wf-metadata tr:first-child td { border-top: 0; }
    .wf-metadata th { width: 180px; color: #4f594f; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0; }
    .wf-metadata td { overflow-wrap: anywhere; }
    .wf-child-identifiers { display: flex; flex-wrap: wrap; gap: 5px; align-items: baseline; }
    .wf-child-identifier { display: inline-block; padding: 0.08rem 0.36rem; border: 1px solid #cdd8cf; border-radius: 2px; background: #eef3ef; text-decoration: none; white-space: nowrap; }
    .wf-child-identifier:hover, .wf-child-identifier:focus { background: #e0ebe4; border-color: #b8c8bc; }
    .wf-child-identifiers-more { display: contents; }
    .wf-child-identifiers-more > summary { display: inline-block; padding: 0.08rem 0.36rem; border: 1px solid #cdd8cf; border-radius: 2px; background: #eef3ef; color: #1f5f85; cursor: pointer; line-height: inherit; }
    .wf-child-identifiers-more > summary::-webkit-details-marker { display: none; }
    .wf-child-identifiers-more > summary::marker { content: ""; }
    .wf-term { cursor: help; border-bottom: 1px dotted currentColor; }
    .wf-date-tip { position: relative; display: inline-block; }
    .wf-date-tip::after { content: attr(data-tooltip); position: absolute; left: 50%; bottom: calc(100% + 8px); transform: translateX(-50%); opacity: 0; pointer-events: none; background: rgba(27, 32, 27, 0.94); color: #fff; border-radius: 5px; padding: 5px 7px; font-size: 0.78rem; white-space: nowrap; transition: opacity 120ms ease; }
    .wf-date-tip:hover::after, .wf-date-tip:focus::after { opacity: 1; }
    .wf-section, .wf-source { margin-top: 24px; min-width: 0; }
    h2 { margin: 0 0 12px; font-size: 1rem; line-height: 1.25; letter-spacing: 0; color: #2f382f; }
    ul { margin: 0; padding-left: 1.2rem; }
    li { margin: 0.45rem 0; line-height: 1.45; }
    code, pre { font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; }
    code { background: #e9ece6; border-radius: 4px; padding: 0.12rem 0.25rem; }
    details { border: 1px solid #c9cec7; border-radius: 8px; background: #fff; min-width: 0; }
    details + details { margin-top: 12px; }
    summary { cursor: pointer; padding: 12px 14px; font-weight: 750; }
    .wf-history { padding-bottom: 12px; }
    .wf-history-tree { display: grid; gap: 10px; padding: 0 14px 4px; }
    .wf-history-node { border: 1px solid #d5dbd3; border-radius: 8px; padding: 10px; }
    .wf-history-node + .wf-history-node, .wf-history-node .wf-history-node { margin-top: 8px; }
    .wf-history-node--history { background: #f8faf7; }
    .wf-history-node--state { background: #eef3ef; }
    .wf-history-node--manifestation { background: #e7eee9; }
    .wf-history-node--file { background: #dfe8e2; }
    .wf-history-node-header { display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; }
    .wf-history-node > summary.wf-history-node-header { display: list-item; padding: 0; }
    .wf-history-class { color: #687167; font-style: italic; font-size: 0.85rem; }
    .wf-history-file-iri { font-size: 0.82rem; overflow-wrap: anywhere; }
    .wf-history-gap { display: flex; align-items: center; justify-content: center; min-height: 28px; color: #687167; font-size: 1.15rem; line-height: 1; }
    .wf-source-meta { display: flex; flex-wrap: wrap; gap: 10px; padding: 0 14px 12px; color: #596259; font-size: 0.88rem; }
    pre { margin: 0; width: 100%; max-width: 100%; max-height: 64vh; overflow: auto; border-top: 1px solid #d7dcd4; background: #0d1117; color: #e6edf3; padding: 16px; font-size: 0.86rem; line-height: 1.55; tab-size: 2; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
    pre code { display: block; min-width: 0; background: transparent; color: inherit; border-radius: 0; padding: 0; white-space: inherit; overflow-wrap: inherit; word-break: inherit; }
    pre code span { overflow-wrap: inherit; word-break: inherit; }
    .wf-generated { width: min(1120px, calc(100% - 32px)); margin: 0 auto; padding: 8px 0 32px; text-align: center; color: rgba(49, 57, 49, 0.42); font-size: 0.78rem; flex: 0 0 auto; }
    .wf-generated a { color: inherit; font-weight: 700; }
  </style>
  <script>
    const canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink && location.pathname.endsWith("/") && !location.search && !location.hash) {
      const canonicalUrl = new URL(canonicalLink.href);
      if (canonicalUrl.origin === location.origin && canonicalUrl.pathname === location.pathname.slice(0, -1)) {
        history.replaceState(null, "", canonicalUrl.pathname);
      }
    }
  </script>
</head>
<body>
  <main>
    <article class="wf-shell">
      <header class="wf-masthead">
        <div class="wf-page-header">
${breadcrumbs}
${meshFavicon}
        </div>
        <div class="wf-hero">
        <h1>${escapeHtml(input.title)}</h1>
${classes}${summary}${metadata}
        </div>
      </header>
${historySection}${
    sections ? `${sections}\n` : ""
  }${rawSections}${semanticFlowMetadataSection}
    </article>
  </main>
  <footer class="wf-generated">
    Generated on <span class="wf-term wf-date-tip" tabindex="0" title="${
    escapeHtml(input.generatedAtIso)
  }" data-tooltip="${escapeHtml(input.generatedAtIso)}">${
    escapeHtml(input.generatedAtDisplay)
  }</span> by <a href="${WEAVE_REPOSITORY_URL}">Weave</a>
  </footer>
</body>
</html>
`;
}

function renderBreadcrumbs(input: ResourcePageRenderInput): string {
  if (input.breadcrumbs.length === 0) {
    return `          <p class="wf-eyebrow">${escapeHtml(input.meshLabel)}</p>`;
  }

  return `          <nav class="wf-eyebrow wf-breadcrumbs" aria-label="Breadcrumb">
${
    input.breadcrumbs.map((breadcrumb, index) => {
      const separator = index === 0
        ? ""
        : ` <span aria-hidden="true">/</span> `;
      const label = escapeHtml(breadcrumb.label);
      return breadcrumb.href
        ? `${separator}<a href="${escapeHtml(breadcrumb.href)}">${label}</a>`
        : `${separator}<span aria-current="page">${label}</span>`;
    }).join("")
  }
          </nav>`;
}

function renderMeshFavicon(input: ResourcePageRenderInput): string {
  if (!input.meshFaviconHref) {
    return "";
  }

  return `          <img class="wf-mesh-favicon" src="${
    escapeHtml(input.meshFaviconHref)
  }" alt="">`;
}

function renderMetadataTable(
  rows: readonly ResourcePageMetadataRow[],
  indentSize: number,
): string {
  if (rows.length === 0) {
    return "";
  }

  const indent = " ".repeat(indentSize);
  const bodyIndent = `${indent}  `;
  return `${indent}<table class="wf-metadata">
${bodyIndent}<tbody>
${rows.map((row) => renderMetadataRow(row, bodyIndent)).join("\n")}
${bodyIndent}</tbody>
${indent}</table>
`;
}

function renderSemanticFlowMetadataSection(
  rows: readonly ResourcePageMetadataRow[],
): string {
  if (rows.length === 0) {
    return "";
  }

  return `      <details class="wf-semantic-flow-metadata">
        <summary>Semantic Flow metadata</summary>
${renderMetadataTable(rows, 8)}      </details>
`;
}

function renderMetadataRow(
  row: ResourcePageMetadataRow,
  indent: string,
): string {
  const label = row.tooltip
    ? renderTooltipLabel(row.label, row.tooltip)
    : escapeHtml(row.label);
  const value = row.html
    ? row.html
    : row.href
    ? `<a href="${escapeHtml(row.href)}">${escapeHtml(row.value)}</a>`
    : `<span>${escapeHtml(row.value)}</span>`;
  return `${indent}<tr><th scope="row">${label}</th><td>${value}</td></tr>`;
}

function toKnopMetadataRow(
  meshRootHref: string,
  meshLabel: string,
  resourcePath: string,
): ResourcePageMetadataRow {
  const knopResourcePath = toKnopResourcePath(resourcePath);
  return {
    label: "Knop",
    href: toMeshResourceHref(meshRootHref, knopResourcePath),
    value: toDisplayDesignatorPath(knopResourcePath, meshLabel),
  };
}

function toExtractionSourceMetadataRows(
  meshRootHref: string,
  meshLabel: string,
  extractionSource?: ResourcePageExtractionSourceModel,
): readonly ResourcePageMetadataRow[] {
  if (!extractionSource) {
    return [];
  }

  const rows: ResourcePageMetadataRow[] = [{
    label: "Extraction Source",
    href: toMeshResourceHref(meshRootHref, extractionSource.sourceArtifactPath),
    value: toDisplayDesignatorPath(
      extractionSource.sourceArtifactPath,
      meshLabel,
    ),
  }];

  if (extractionSource.requestedTargetStatePath) {
    rows.push({
      label: "Extraction Source State",
      href: toMeshResourceHref(
        meshRootHref,
        extractionSource.requestedTargetStatePath,
      ),
      value: toDisplayDesignatorPath(
        extractionSource.requestedTargetStatePath,
        meshLabel,
      ),
    });
  }

  rows.push({
    label: "Extraction Source Mode",
    href: extractionSource.artifactResolutionModeIri,
    value: compactRdfIri(
      extractionSource.artifactResolutionModeIri,
      new Map(COMMON_RDF_PREFIXES),
    ),
  });

  return rows;
}

function toChildIdentifierMetadataRows(
  meshBase: string,
  meshRootHref: string,
  canonical: string,
  childIdentifiers: readonly ResourcePageChildIdentifierModel[],
  rawSourcePanels: readonly ResourcePageRawSourcePanelModel[],
): readonly ResourcePageMetadataRow[] {
  if (childIdentifiers.length === 0) {
    return [];
  }
  const typesByChildIri = collectChildIdentifierTypes(
    canonical,
    meshBase,
    childIdentifiers,
    rawSourcePanels,
  );
  const categories: {
    label: string;
    identifiers: ResourcePageChildIdentifierModel[];
  }[] = [
    { label: "Child Classes", identifiers: [] },
    { label: "Child Object Properties", identifiers: [] },
    { label: "Child Datatype Properties", identifiers: [] },
    { label: "Child Annotation Properties", identifiers: [] },
    { label: "Child Properties", identifiers: [] },
    { label: "Child Datatypes", identifiers: [] },
    { label: "Child Individuals", identifiers: [] },
  ];

  for (const identifier of childIdentifiers) {
    const childIri = toCanonicalResourceIri(meshBase, identifier.path);
    const types = typesByChildIri.get(childIri) ?? new Set<string>();
    const categoryIndex = toChildIdentifierCategoryIndex(types);
    categories[categoryIndex]?.identifiers.push(identifier);
  }

  return categories.flatMap((category) =>
    category.identifiers.length > 0
      ? [toChildIdentifierMetadataRow(
        meshRootHref,
        category.label,
        category.identifiers,
      )]
      : []
  );
}

function collectChildIdentifierTypes(
  canonical: string,
  meshBase: string,
  childIdentifiers: readonly ResourcePageChildIdentifierModel[],
  rawSourcePanels: readonly ResourcePageRawSourcePanelModel[],
): ReadonlyMap<string, ReadonlySet<string>> {
  const childIris = new Set(
    childIdentifiers.map((identifier) =>
      toCanonicalResourceIri(meshBase, identifier.path)
    ),
  );
  const typesByChildIri = new Map<string, Set<string>>();
  const quads = rawSourcePanels.flatMap((panel) =>
    panel.contents ? parseRdfPanel(canonical, panel.contents) : []
  );

  for (const quad of quads) {
    if (
      quad.subject.termType !== "NamedNode" ||
      quad.predicate.value !== RDF_TYPE_IRI ||
      quad.object.termType !== "NamedNode" ||
      !childIris.has(quad.subject.value)
    ) {
      continue;
    }

    const types = typesByChildIri.get(quad.subject.value) ?? new Set<string>();
    types.add(quad.object.value);
    typesByChildIri.set(quad.subject.value, types);
  }

  return typesByChildIri;
}

function toChildIdentifierCategoryIndex(types: ReadonlySet<string>): number {
  if (types.has(OWL_CLASS_IRI)) {
    return 0;
  }
  if (types.has(OWL_OBJECT_PROPERTY_IRI)) {
    return 1;
  }
  if (types.has(OWL_DATATYPE_PROPERTY_IRI)) {
    return 2;
  }
  if (types.has(OWL_ANNOTATION_PROPERTY_IRI)) {
    return 3;
  }
  if (types.has(RDF_PROPERTY_IRI)) {
    return 4;
  }
  if (types.has(RDFS_DATATYPE_IRI)) {
    return 5;
  }
  return 6;
}

function toChildIdentifierMetadataRow(
  meshRootHref: string,
  label: string,
  childIdentifiers: readonly ResourcePageChildIdentifierModel[],
): ResourcePageMetadataRow {
  const visibleIdentifiers = childIdentifiers.slice(0, 20);
  const hiddenIdentifiers = childIdentifiers.slice(20);
  const renderIdentifier = (identifier: ResourcePageChildIdentifierModel) =>
    `<nobr><a class="wf-child-identifier" href="${
      escapeHtml(toMeshResourceHref(meshRootHref, identifier.path))
    }">${escapeHtml(identifier.label)}</a></nobr>`;
  const hiddenIdentifiersHtml = hiddenIdentifiers.length > 0
    ? `<details class="wf-child-identifiers-more"><summary title="Show ${hiddenIdentifiers.length} more child identifiers">...</summary>${
      hiddenIdentifiers.map(renderIdentifier).join("")
    }</details>`
    : "";

  return {
    label,
    value: childIdentifiers.map((identifier) => identifier.label).join(", "),
    html: `<div class="wf-child-identifiers">${
      visibleIdentifiers.map(renderIdentifier).join("")
    }${hiddenIdentifiersHtml}</div>`,
  };
}

function toRdfIriLinkMetadataRows(
  label: string,
  links: readonly ResourcePageRdfIriLink[],
): readonly ResourcePageMetadataRow[] {
  if (links.length === 0) {
    return [];
  }

  return [{
    label,
    value: links.map((link) => link.label).join(", "),
    html: links.map((link) =>
      `<a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`
    ).join(", "),
  }];
}

function renderRdfClassLink(className: ResourcePageRdfClass): string {
  return `<a href="${escapeHtml(className.iri)}">${
    escapeHtml(className.label)
  }</a>`;
}

function renderHistorySection(input: ResourcePageRenderInput): string {
  if (input.historyGroups.length === 0) {
    return "";
  }
  const title = toHistorySectionTitle(input);
  return `    <section class="wf-section">
      <details class="wf-history">
        <summary>${escapeHtml(title)}</summary>
${renderHistoryGroups(input)}
      </details>
    </section>
`;
}

function truncateHistoryItems<T>(
  items: readonly T[],
): readonly TruncatedHistoryItem<T>[] {
  if (items.length <= HISTORY_TRUNCATION_THRESHOLD) {
    return items.map((value) => ({ kind: "item", value }));
  }

  const tailStart = items.length - HISTORY_TRUNCATION_TAIL_COUNT;
  return [
    ...items.slice(0, HISTORY_TRUNCATION_HEAD_COUNT).map((value) => ({
      kind: "item" as const,
      value,
    })),
    {
      kind: "gap" as const,
      omittedCount: tailStart - HISTORY_TRUNCATION_HEAD_COUNT,
    },
    ...items.slice(tailStart).map((value) => ({
      kind: "item" as const,
      value,
    })),
  ];
}

function renderHistoryGap(omittedCount: number, indent: number): string {
  const spaces = " ".repeat(indent);
  const label = omittedCount === 1
    ? "1 history item omitted"
    : `${omittedCount} history items omitted`;
  return `${spaces}<div class="wf-history-gap" role="separator" aria-label="${
    escapeHtml(label)
  }">⋮</div>`;
}

function toHistorySectionTitle(input: ResourcePageRenderInput): string {
  if (isArtifactHistoryResource(input)) {
    return "Historical States";
  }
  if (isHistoricalStateResource(input)) {
    return "Manifestations";
  }
  if (isArtifactManifestationResource(input)) {
    return "Located Files";
  }
  return "History";
}

function isArtifactHistoryResource(input: ResourcePageRenderInput): boolean {
  return input.historyGroups.some((group) =>
    group.path === input.resourcePath
  ) ||
    isArtifactHistoryResourcePath(input.resourcePath);
}

function isHistoricalStateResource(input: ResourcePageRenderInput): boolean {
  return input.historyGroups.some((group) =>
    group.states.some((state) => state.path === input.resourcePath)
  ) || isHistoricalStateResourcePath(input.resourcePath);
}

function isArtifactManifestationResource(
  input: ResourcePageRenderInput,
): boolean {
  return input.historyGroups.some((group) =>
    group.states.some((state) => state.manifestationPath === input.resourcePath)
  ) || isArtifactManifestationResourcePath(input.resourcePath);
}

function renderHistoryGroups(input: ResourcePageRenderInput): string {
  return truncateHistoryItems(input.historyGroups).map((item) => {
    if (item.kind === "gap") {
      return renderHistoryGap(item.omittedCount, 8);
    }
    const group = item.value;
    if (input.resourcePath === group.path) {
      return renderHistoricalStates(input, group);
    }
    const matchingState = group.states.find((state) =>
      state.path === input.resourcePath
    );
    if (matchingState) {
      return renderManifestations(input, matchingState);
    }
    const matchingManifestation = group.states.find((state) =>
      state.manifestationPath === input.resourcePath
    );
    if (matchingManifestation?.locatedFilePath) {
      return renderLocatedFiles(input, matchingManifestation.locatedFilePath);
    }
    const historyHref = toMeshResourceHref(input.meshRootHref, group.path);
    const states = group.states.length > 0
      ? renderHistoryStateList(input, group.states)
      : "          <p>No historical states are listed yet.</p>";

    return `        <div class="wf-history-tree">
          <details class="wf-history-node wf-history-node--history" open>
            <summary class="wf-history-node-header"><a href="${
      escapeHtml(historyHref)
    }">${escapeHtml(group.path)}</a>${
      renderHistoryClassAnnotation(input, "sflo:ArtifactHistory")
    }</summary>
${states}
          </details>
        </div>`;
  }).join("\n");
}

function renderHistoricalStates(
  input: ResourcePageRenderInput,
  group: ResourcePageHistoryGroupModel,
): string {
  const states = group.states.length > 0
    ? renderHistoryStateList(input, group.states)
    : "          <p>No historical states are listed yet.</p>";

  return `        <div class="wf-history-tree">
${states}
        </div>`;
}

function renderHistoryStateList(
  input: ResourcePageRenderInput,
  states: ResourcePageHistoryGroupModel["states"],
): string {
  return truncateHistoryItems(states).map((item) =>
    item.kind === "gap"
      ? renderHistoryGap(item.omittedCount, 12)
      : renderHistoryState(input, item.value)
  ).join("\n");
}

function renderManifestations(
  input: ResourcePageRenderInput,
  state: ResourcePageHistoryGroupModel["states"][number],
): string {
  const manifestation = state.manifestationPath
    ? renderHistoryManifestation(input, state.manifestationPath, state)
    : "          <p>No manifestations are listed yet.</p>";

  return `        <div class="wf-history-tree">
${manifestation}
        </div>`;
}

function renderLocatedFiles(
  input: ResourcePageRenderInput,
  locatedFilePath: string,
): string {
  return `        <div class="wf-history-tree">
${renderHistoryLocatedFile(input, locatedFilePath, 10)}
        </div>`;
}

function renderHistoryState(
  input: ResourcePageRenderInput,
  state: ResourcePageHistoryGroupModel["states"][number],
): string {
  const stateHref = toMeshResourceHref(input.meshRootHref, state.path);
  const child = state.manifestationPath
    ? renderHistoryManifestation(input, state.manifestationPath, state)
    : state.locatedFilePath
    ? renderHistoryLocatedFile(input, state.locatedFilePath, 14)
    : "";

  return `            <details class="wf-history-node wf-history-node--state" open>
              <summary class="wf-history-node-header"><a href="${
    escapeHtml(stateHref)
  }">${escapeHtml(toLastPathSegment(state.path))}</a>${
    renderHistoryClassAnnotation(input, "sflo:HistoricalState")
  }</summary>
${child}
            </details>`;
}

function renderHistoryManifestation(
  input: ResourcePageRenderInput,
  manifestationPath: string,
  state: ResourcePageHistoryGroupModel["states"][number],
): string {
  const manifestationHref = toMeshResourceHref(
    input.meshRootHref,
    manifestationPath,
  );
  const locatedFile = state.locatedFilePath
    ? renderHistoryLocatedFile(input, state.locatedFilePath, 16)
    : "";

  return `              <details class="wf-history-node wf-history-node--manifestation" open>
                <summary class="wf-history-node-header"><a href="${
    escapeHtml(manifestationHref)
  }">${escapeHtml(toLastPathSegment(manifestationPath))}</a>${
    renderHistoryClassAnnotation(input, "sflo:ArtifactManifestation")
  }</summary>
${locatedFile}
              </details>`;
}

function renderHistoryLocatedFile(
  input: ResourcePageRenderInput,
  locatedFilePath: string,
  indent: number,
): string {
  const locatedFileHref = toMeshResourceHref(
    input.meshRootHref,
    locatedFilePath,
  );
  const locatedFileIri = new URL(locatedFilePath, input.meshBase).href;
  const spaces = " ".repeat(indent);
  return `${spaces}<div class="wf-history-node wf-history-node--file">
${spaces}  <div class="wf-history-node-header"><a href="${
    escapeHtml(locatedFileHref)
  }" class="wf-history-file-iri">${escapeHtml(locatedFileIri)}</a>${
    renderHistoryClassAnnotation(input, "sflo:LocatedFile")
  }</div>
${spaces}</div>`;
}

function renderHistoryClassAnnotation(
  input: ResourcePageRenderInput,
  className: string,
): string {
  return input.includeSemanticFlowMetadata
    ? ` <span class="wf-history-class">${escapeHtml(className)}</span>`
    : "";
}

function renderTooltipLabel(label: string, tooltip: string): string {
  return `<span class="wf-term" title="${escapeHtml(tooltip)}">${
    escapeHtml(label)
  }</span>`;
}

function toLastPathSegment(path: string): string {
  const segments = path.split("/").filter((segment) => segment.length > 0);
  return segments[segments.length - 1] ?? "/";
}

function toDefaultResourcePageTitle(
  resourcePath: string,
  meshLabel: string,
): string {
  return resourcePath.length > 0 ? toLastPathSegment(resourcePath) : meshLabel;
}

function toDisplayDesignatorPath(
  designatorPath: string,
  meshLabel: string,
): string {
  return designatorPath.length === 0
    ? meshLabel
    : formatDesignatorPathForDisplay(designatorPath);
}

function toHtmlDocumentTitle(meshLabel: string, pageTitle: string): string {
  return pageTitle === meshLabel ? meshLabel : `${meshLabel} ${pageTitle}`;
}

function toResourcePageBreadcrumbs(
  meshLabel: string,
  meshRootHref: string,
  resourcePath: string,
): readonly ResourcePageBreadcrumb[] {
  const breadcrumbs: ResourcePageBreadcrumb[] = [{
    label: meshLabel,
    href: toMeshResourceHref(meshRootHref, ""),
  }];
  const segments = resourcePath === "." || resourcePath.length === 0
    ? []
    : resourcePath.split("/").filter((segment) => segment.length > 0);

  for (let index = 0; index < segments.length; index += 1) {
    const path = segments.slice(0, index + 1).join("/");
    breadcrumbs.push({
      label: segments[index],
      ...(index === segments.length - 1
        ? {}
        : { href: toMeshResourceHref(meshRootHref, path) }),
    });
  }

  return breadcrumbs;
}

function formatGeneratedAtDisplay(generatedAt: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(generatedAt);
}

async function renderRawSourcePanels(
  input: ResourcePageRenderInput,
): Promise<string> {
  const panels = await Promise.all(
    input.rawSourcePanels.map((panel) => renderRawSourcePanel(input, panel)),
  );
  return `    <section class="wf-source">
${panels.join("\n")}
    </section>`;
}

async function renderRawSourcePanel(
  input: ResourcePageRenderInput,
  panel: ResourcePageRawSourcePanelModel,
): Promise<string> {
  const sourceHref = toPublicSourceHref(input.meshRootHref, panel.sourcePath);
  const body = panel.contents === undefined
    ? `        <p>This source is ${
      panel.omittedByteLength ?? 0
    } bytes, so Weave omitted the inline copy. Use the raw file link instead.</p>`
    : await renderHighlightedSource(panel.sourcePath, panel.contents);

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

async function renderHighlightedSource(
  sourcePath: string,
  contents: string,
): Promise<string> {
  const language = inferSourceLanguage(sourcePath);
  try {
    return await codeToHtml(contents, {
      lang: language,
      theme: SOURCE_THEME,
    });
  } catch {
    return await codeToHtml(contents, {
      lang: "text",
      theme: SOURCE_THEME,
    });
  }
}

function inferSourceLanguage(sourcePath: string): string {
  const normalizedPath = sourcePath.toLowerCase();
  if (normalizedPath.endsWith(".md") || normalizedPath.endsWith(".markdown")) {
    return "markdown";
  }
  if (
    normalizedPath.endsWith(".ttl") ||
    normalizedPath.endsWith(".trig") ||
    normalizedPath.endsWith(".nt") ||
    normalizedPath.endsWith(".nq")
  ) {
    return "turtle";
  }
  if (normalizedPath.endsWith(".rq") || normalizedPath.endsWith(".sparql")) {
    return "sparql";
  }
  if (normalizedPath.endsWith(".json") || normalizedPath.endsWith(".jsonld")) {
    return "json";
  }
  if (
    normalizedPath.endsWith(".rdf") ||
    normalizedPath.endsWith(".owl") ||
    normalizedPath.endsWith(".xml")
  ) {
    return "xml";
  }
  return "text";
}

function toMeshRootHref(meshBase: string): string {
  const pathname = new URL(meshBase).pathname;
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}

function toCanonicalResourceIri(
  meshBase: string,
  resourcePath: string,
): string {
  const canonical = new URL(resourcePath, meshBase);
  if (
    resourcePath.length === 0 &&
    canonical.pathname !== "/" &&
    canonical.pathname.endsWith("/")
  ) {
    canonical.pathname = canonical.pathname.slice(0, -1);
  }
  return canonical.href;
}

function toMeshResourceHref(
  meshRootHref: string,
  resourcePath: string,
): string {
  if (resourcePath.length === 0 && meshRootHref !== "/") {
    return meshRootHref.slice(0, -1);
  }
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
  const prefixMap = collectPrefixMap(rawSourcePanels);
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
  const note = findFirstLiteralObject(quads, canonical, SKOS_NOTE_IRI);
  const broader = findNamedNodeObjects(quads, canonical, SKOS_BROADER_IRI)
    .map((iri) => toRdfIriLink(iri, prefixMap))
    .sort((left, right) => left.label.localeCompare(right.label));
  const narrower = findNamedNodeObjects(quads, canonical, SKOS_NARROWER_IRI)
    .map((iri) => toRdfIriLink(iri, prefixMap))
    .sort((left, right) => left.label.localeCompare(right.label));
  const classes = new Map<string, ResourcePageRdfClass>();

  for (const quad of quads) {
    if (
      quad.subject.termType === "NamedNode" &&
      quad.subject.value === canonical &&
      quad.predicate.value === RDF_TYPE_IRI &&
      quad.object.termType === "NamedNode"
    ) {
      classes.set(quad.object.value, {
        label: compactRdfIri(quad.object.value, prefixMap),
        iri: quad.object.value,
      });
    }
  }

  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(note ? { note } : {}),
    broader,
    narrower,
    classes: [...classes.values()].sort((left, right) =>
      left.label.localeCompare(right.label)
    ),
  };
}

function extractFragmentSections(
  canonical: string,
  rawSourcePanels: readonly ResourcePageRawSourcePanelModel[],
  meshRootHref: string,
  meshLabel: string,
): readonly ResourcePageSection[] {
  const prefixMap = collectPrefixMap(rawSourcePanels);
  const quads = rawSourcePanels.flatMap((panel) =>
    panel.contents ? parseRdfPanel(canonical, panel.contents) : []
  );
  const sections: ResourcePageSection[] = [];
  const subjects = new Set<string>();

  for (const quad of quads) {
    if (
      quad.subject.termType === "NamedNode" &&
      quad.subject.value.startsWith(`${canonical}#`) &&
      quad.predicate.value === RDF_TYPE_IRI &&
      quad.object.termType === "NamedNode" &&
      quad.object.value === SFLO_EXTRACTION_SOURCE_IRI
    ) {
      subjects.add(quad.subject.value);
    }
  }

  for (const subjectIri of [...subjects].sort()) {
    const fragment = subjectIri.slice(canonical.length + 1);
    const targetArtifactIri = findFirstNamedNodeObject(
      quads,
      subjectIri,
      SFLO_HAS_TARGET_ARTIFACT_IRI,
    );
    const requestedTargetStateIri = findFirstNamedNodeObject(
      quads,
      subjectIri,
      SFLO_HAS_REQUESTED_TARGET_STATE_IRI,
    );
    const artifactResolutionModeIri = findFirstNamedNodeObject(
      quads,
      subjectIri,
      SFLO_HAS_ARTIFACT_RESOLUTION_MODE_IRI,
    );
    const rows = [
      targetArtifactIri
        ? renderFragmentIriRow(
          "Target Artifact",
          targetArtifactIri,
          meshRootHref,
          meshLabel,
          prefixMap,
        )
        : undefined,
      requestedTargetStateIri
        ? renderFragmentIriRow(
          "Requested Target State",
          requestedTargetStateIri,
          meshRootHref,
          meshLabel,
          prefixMap,
        )
        : undefined,
      artifactResolutionModeIri
        ? renderFragmentIriRow(
          "Resolution Mode",
          artifactResolutionModeIri,
          meshRootHref,
          meshLabel,
          prefixMap,
        )
        : undefined,
    ].filter((row): row is string => row !== undefined).join("\n");

    sections.push({
      id: fragment,
      title: "Extraction Source",
      html: `      <table class="wf-metadata">
        <tbody>
${rows}
        </tbody>
      </table>`,
    });
  }

  return sections;
}

function renderFragmentIriRow(
  label: string,
  iri: string,
  meshRootHref: string,
  meshLabel: string,
  prefixMap: ReadonlyMap<string, string>,
): string {
  const meshPath = toMeshPath(meshRootHref, iri);
  const value = meshPath !== undefined
    ? toDisplayDesignatorPath(meshPath, meshLabel)
    : iri;
  const href = meshPath !== undefined
    ? toMeshResourceHref(meshRootHref, meshPath)
    : iri;

  return `          <tr><th scope="row">${escapeHtml(label)}</th><td><a href="${
    escapeHtml(href)
  }">${
    escapeHtml(meshPath !== undefined ? value : compactRdfIri(value, prefixMap))
  }</a></td></tr>`;
}

function collectPrefixMap(
  rawSourcePanels: readonly ResourcePageRawSourcePanelModel[],
): ReadonlyMap<string, string> {
  const prefixByNamespace = new Map<string, string>();

  for (const [namespace, prefix] of COMMON_RDF_PREFIXES) {
    prefixByNamespace.set(namespace, prefix);
  }

  for (const panel of rawSourcePanels) {
    if (!panel.contents) {
      continue;
    }
    for (const [namespace, prefix] of parseDeclaredPrefixes(panel.contents)) {
      prefixByNamespace.set(namespace, canonicalRdfPrefix(namespace, prefix));
    }
  }

  return prefixByNamespace;
}

function canonicalRdfPrefix(namespace: string, declaredPrefix: string): string {
  if (namespace === SEMANTIC_FLOW_NAMESPACE) {
    return "sflo";
  }
  if (namespace === SEMANTIC_FLOW_CONFIG_NAMESPACE) {
    return "sfcfg";
  }
  return declaredPrefix;
}

function parseDeclaredPrefixes(turtle: string): readonly [string, string][] {
  const prefixes: [string, string][] = [];
  const prefixPattern = /(?:@prefix|PREFIX)\s+([A-Za-z][\w-]*):\s*<([^>]+)>/gi;

  for (const match of turtle.matchAll(prefixPattern)) {
    const prefix = match[1];
    const namespace = match[2];
    if (prefix && namespace) {
      prefixes.push([namespace, prefix]);
    }
  }

  return prefixes;
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

function findFirstNamedNodeObject(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
): string | undefined {
  for (const quad of quads) {
    if (
      quad.subject.termType === "NamedNode" &&
      quad.subject.value === subjectIri &&
      quad.predicate.value === predicateIri &&
      quad.object.termType === "NamedNode"
    ) {
      return quad.object.value;
    }
  }
  return undefined;
}

function findNamedNodeObjects(
  quads: readonly Quad[],
  subjectIri: string,
  predicateIri: string,
): readonly string[] {
  const values = new Set<string>();
  for (const quad of quads) {
    if (
      quad.subject.termType === "NamedNode" &&
      quad.subject.value === subjectIri &&
      quad.predicate.value === predicateIri &&
      quad.object.termType === "NamedNode"
    ) {
      values.add(quad.object.value);
    }
  }
  return [...values];
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

function toMeshPath(meshRootHref: string, iri: string): string | undefined {
  let url: URL;
  try {
    url = new URL(iri);
  } catch {
    return undefined;
  }

  if (url.search) {
    return undefined;
  }

  const rootPathname = meshRootHref === "/" ? "/" : meshRootHref.slice(0, -1);
  if (url.pathname === rootPathname) {
    return url.hash ? url.hash : "";
  }
  if (!url.pathname.startsWith(meshRootHref)) {
    return undefined;
  }
  const path = url.pathname.slice(meshRootHref.length);
  return url.hash ? `${path}${url.hash}` : path;
}

function toRdfIriLink(
  iri: string,
  prefixMap: ReadonlyMap<string, string>,
): ResourcePageRdfIriLink {
  return {
    label: compactRdfIri(iri, prefixMap),
    href: iri,
  };
}

function compactRdfIri(
  iri: string,
  prefixByNamespace: ReadonlyMap<string, string>,
): string {
  const namespaces = [...prefixByNamespace.keys()].sort((left, right) =>
    right.length - left.length
  );
  for (const namespace of namespaces) {
    if (iri.startsWith(namespace)) {
      const prefix = prefixByNamespace.get(namespace)!;
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

function rdfClass(label: string, iri: string): ResourcePageRdfClass {
  return { label, iri };
}

function classifyResourcePage(
  resourcePath: string,
  historyGroups: readonly ResourcePageHistoryGroupModel[] = [],
): ResourcePageRdfClass {
  if (resourcePath === "_mesh") {
    return rdfClass(
      "sflo:SemanticMesh",
      "https://semantic-flow.github.io/sflo/ontology/SemanticMesh",
    );
  }
  if (resourcePath.endsWith("/_knop")) {
    return rdfClass(
      "sflo:Knop",
      "https://semantic-flow.github.io/sflo/ontology/Knop",
    );
  }
  if (resourcePath.endsWith("/_meta")) {
    return rdfClass(
      "sflo:RdfDocument",
      "https://semantic-flow.github.io/sflo/ontology/RdfDocument",
    );
  }
  if (resourcePath.endsWith("/_inventory")) {
    return rdfClass(
      "sflo:RdfDocument",
      "https://semantic-flow.github.io/sflo/ontology/RdfDocument",
    );
  }
  if (resourcePath.endsWith("/_config")) {
    return rdfClass(
      "sfcfg:MeshConfig",
      "https://semantic-flow.github.io/ontology/config/MeshConfig",
    );
  }
  if (
    historyGroups.some((group) =>
      group.states.some((state) => state.manifestationPath === resourcePath)
    ) || isArtifactManifestationResourcePath(resourcePath)
  ) {
    return rdfClass(
      "sflo:ArtifactManifestation",
      "https://semantic-flow.github.io/sflo/ontology/ArtifactManifestation",
    );
  }
  if (
    historyGroups.some((group) =>
      group.states.some((state) => state.path === resourcePath)
    ) || isHistoricalStateResourcePath(resourcePath)
  ) {
    return rdfClass(
      "sflo:HistoricalState",
      "https://semantic-flow.github.io/sflo/ontology/HistoricalState",
    );
  }
  if (
    historyGroups.some((group) => group.path === resourcePath) ||
    isArtifactHistoryResourcePath(resourcePath)
  ) {
    return rdfClass(
      "sflo:ArtifactHistory",
      "https://semantic-flow.github.io/sflo/ontology/ArtifactHistory",
    );
  }
  return rdfClass(
    "sflo:DigitalArtifact",
    "https://semantic-flow.github.io/sflo/ontology/DigitalArtifact",
  );
}

function isArtifactHistoryResourcePath(resourcePath: string): boolean {
  return /(^|\/)_history[0-9]+/.test(resourcePath) &&
    !isHistoricalStateResourcePath(resourcePath) &&
    !isArtifactManifestationResourcePath(resourcePath);
}

function isHistoricalStateResourcePath(resourcePath: string): boolean {
  return /(^|\/)_history[0-9]+\/_s[0-9]+$/.test(resourcePath);
}

function isArtifactManifestationResourcePath(resourcePath: string): boolean {
  return /(^|\/)_history[0-9]+\/_s[0-9]+\/[^/]+$/.test(resourcePath);
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
