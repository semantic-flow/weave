import {
  formatDesignatorPathForDisplay,
  toDesignatorResourcePagePath,
} from "../designator_segments.ts";
import { WeaveInputError } from "./errors.ts";
import {
  deriveMeshLabel,
  escapeHtml,
  toRelativeHref,
  toResourcePath,
} from "./html.ts";
import { requireLiteralValue, requireNamedNodePath } from "./rdf_helpers.ts";

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

export function renderAliceIdentifierPageAfterFirstExtractedWeave(
  meshBase: string,
  currentPayloadTurtle: string,
  payloadHistoryPath: string,
): string {
  const meshLabel = deriveMeshLabel(meshBase);
  const canonical = new URL("alice", meshBase).href;
  const aliceName = requireLiteralValue(
    meshBase,
    currentPayloadTurtle,
    "alice",
    "http://xmlns.com/foaf/0.1/name",
    "alice foaf:name",
  );
  const aliceBirthDate = requireLiteralValue(
    meshBase,
    currentPayloadTurtle,
    "alice",
    "https://schema.org/birthDate",
    "alice schema:birthDate",
  );
  const knowsPath = requireNamedNodePath(
    meshBase,
    currentPayloadTurtle,
    "alice",
    "http://xmlns.com/foaf/0.1/knows",
    "alice foaf:knows",
  );
  const knowsHref = toRelativeHref("alice/index.html", knowsPath);
  const payloadHistoryHref = toRelativeHref(
    "alice/index.html",
    payloadHistoryPath,
  );

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(meshLabel)} alice</title>
  <link rel="canonical" href="${escapeHtml(canonical)}">
</head>
<body>
  <main>
    <h1><strong>alice</strong></h1>
    <p>Resource page for the Semantic Flow identifier <a href="${
    escapeHtml(canonical)
  }">${escapeHtml(canonical)}</a>.</p>
    <p>This Semantic Flow identifier denotes a <a href="https://schema.org/Person">schema:Person</a>.</p>
    <section>
      <h2>Supporting Semantic Flow Resources</h2>
      <ul>
        <li>Knop: <a href="./_knop">./_knop</a></li>
        <li>KnopMetadata: current file <a href="./_knop/_meta/meta.ttl">./_knop/_meta/meta.ttl</a>, history <a href="./_knop/_meta/_history001">./_knop/_meta/_history001</a></li>
        <li>KnopInventory: current file <a href="./_knop/_inventory/inventory.ttl">./_knop/_inventory/inventory.ttl</a>, history <a href="./_knop/_inventory/_history001">./_knop/_inventory/_history001</a></li>
        <li>ReferenceCatalog: current file <a href="./_knop/_references/references.ttl">./_knop/_references/references.ttl</a>, history <a href="./_knop/_references/_history001">./_knop/_references/_history001</a></li>
      </ul>
    </section>
    <section>
      <h2>Related Semantic Flow Resource</h2>
      <ul>
        <li><a href="./bio">./bio</a>: current payload file <a href="../alice-bio.ttl">../alice-bio.ttl</a>, current history <a href="${
    escapeHtml(payloadHistoryHref)
  }">${escapeHtml(payloadHistoryHref)}</a></li>
      </ul>
    </section>
    <section>
      <h2>Current Properties</h2>
      <table>
        <thead>
          <tr><th>Predicate</th><th>Value</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><a href="https://www.w3.org/1999/02/22-rdf-syntax-ns#type">rdf:type</a></td>
            <td><a href="https://schema.org/Person">schema:Person</a></td>
          </tr>
          <tr>
            <td><a href="http://xmlns.com/foaf/0.1/name">foaf:name</a></td>
            <td>${escapeHtml(aliceName)}</td>
          </tr>
          <tr>
            <td><a href="https://schema.org/birthDate">schema:birthDate</a></td>
            <td>${escapeHtml(aliceBirthDate)}</td>
          </tr>
          <tr>
            <td><a href="http://xmlns.com/foaf/0.1/knows">foaf:knows</a></td>
            <td><a href="${escapeHtml(knowsHref)}">${
    escapeHtml(knowsPath)
  }</a></td>
          </tr>
        </tbody>
      </table>
    </section>
  </main>
  <footer>
    <small>The Semantic Flow identifier <a href="${escapeHtml(canonical)}">${
    escapeHtml(canonical)
  }</a> has an associated Knop at <a href="./_knop">./_knop</a> and a related integrated bio resource at <a href="./bio">./bio</a>.</small>
  </footer>
</body>
</html>
`;
}

export function renderExtractedPersonIdentifierPage(
  meshBase: string,
  designatorPath: string,
  sourcePayloadDesignatorPath: string,
  sourcePayloadHistoryPath: string,
  sourceWorkingLocalRelativePath: string,
  currentPayloadTurtle: string,
): string {
  const meshLabel = deriveMeshLabel(meshBase);
  const designatorPagePath = toDesignatorResourcePagePath(designatorPath);
  const displayDesignatorPath = formatDesignatorPathForDisplay(designatorPath);
  const givenName = requireLiteralValue(
    meshBase,
    currentPayloadTurtle,
    designatorPath,
    "http://xmlns.com/foaf/0.1/givenName",
    `${designatorPath} foaf:givenName`,
  );
  const nick = requireLiteralValue(
    meshBase,
    currentPayloadTurtle,
    designatorPath,
    "http://xmlns.com/foaf/0.1/nick",
    `${designatorPath} foaf:nick`,
  );
  const sourceResourceHref = toRelativeHref(
    designatorPagePath,
    sourcePayloadDesignatorPath,
  );
  const sourceHistoryHref = toRelativeHref(
    designatorPagePath,
    sourcePayloadHistoryPath,
  );
  const sourceWorkingFileHref = toRelativeHref(
    designatorPagePath,
    sourceWorkingLocalRelativePath,
  );
  const canonical = new URL(designatorPath, meshBase).href;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(meshLabel)} ${escapeHtml(displayDesignatorPath)}</title>
  <link rel="canonical" href="${escapeHtml(canonical)}">
</head>
<body>
  <main>
    <h1><strong>${escapeHtml(displayDesignatorPath)}</strong></h1>
    <p>Resource page for the Semantic Flow identifier <a href="${
    escapeHtml(canonical)
  }">${escapeHtml(canonical)}</a>.</p>
    <p>This Semantic Flow identifier denotes a <a href="https://schema.org/Person">schema:Person</a>.</p>
    <section>
      <h2>Supporting Semantic Flow Resources</h2>
      <ul>
        <li>Knop: <a href="./_knop">./_knop</a></li>
        <li>KnopMetadata: current file <a href="./_knop/_meta/meta.ttl">./_knop/_meta/meta.ttl</a>, history <a href="./_knop/_meta/_history001">./_knop/_meta/_history001</a></li>
        <li>KnopInventory: current file <a href="./_knop/_inventory/inventory.ttl">./_knop/_inventory/inventory.ttl</a>, history <a href="./_knop/_inventory/_history001">./_knop/_inventory/_history001</a></li>
        <li>ReferenceCatalog: current file <a href="./_knop/_references/references.ttl">./_knop/_references/references.ttl</a>, history <a href="./_knop/_references/_history001">./_knop/_references/_history001</a></li>
      </ul>
    </section>
    <section>
      <h2>Related Semantic Flow Resource</h2>
      <ul>
        <li><a href="${escapeHtml(sourceResourceHref)}">${
    escapeHtml(sourceResourceHref)
  }</a>: current payload file <a href="${escapeHtml(sourceWorkingFileHref)}">${
    escapeHtml(sourceWorkingFileHref)
  }</a>, current history <a href="${escapeHtml(sourceHistoryHref)}">${
    escapeHtml(sourceHistoryHref)
  }</a></li>
      </ul>
    </section>
    <section>
      <h2>Current Properties</h2>
      <table>
        <thead>
          <tr><th>Predicate</th><th>Value</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><a href="https://www.w3.org/1999/02/22-rdf-syntax-ns#type">rdf:type</a></td>
            <td><a href="https://schema.org/Person">schema:Person</a></td>
          </tr>
          <tr>
            <td><a href="http://xmlns.com/foaf/0.1/givenName">foaf:givenName</a></td>
            <td>${escapeHtml(givenName)}</td>
          </tr>
          <tr>
            <td><a href="http://xmlns.com/foaf/0.1/nick">foaf:nick</a></td>
            <td>${escapeHtml(nick)}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </main>
  <footer>
    <small>The Semantic Flow identifier <a href="${escapeHtml(canonical)}">${
    escapeHtml(canonical)
  }</a> has an associated Knop at <a href="./_knop">./_knop</a> and is currently described in the related resource <a href="${
    escapeHtml(sourceResourceHref)
  }">${escapeHtml(sourceResourceHref)}</a>.</small>
  </footer>
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
