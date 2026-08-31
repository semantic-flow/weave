import {
  assert,
  assertEquals,
  assertFalse,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import { WeaveInputError } from "./errors.ts";
import {
  renderCurrentOnlyPageDefinitionWovenKnopInventoryTurtle,
  renderCurrentOnlyReferenceCatalogWovenKnopInventoryTurtle,
} from "./knop_inventory_renderers.ts";

const meshBase = "https://semantic-flow.github.io/mesh-alice-bio/";
const designatorPath = "alice";
const referencesFilePath = "alice/_knop/_references/references.ttl";
const otherReferencesFilePath = "alice/_knop/_references/other-references.ttl";
const pageDefinitionFilePath = "alice/_knop/_page/page.ttl";
const otherPageDefinitionFilePath = "alice/_knop/_page/other-page.ttl";

Deno.test("current-only ReferenceCatalog inventory append preserves the exact existing prefix", () => {
  const currentKnopInventoryTurtle = `@base <${meshBase}> .
@prefix ex: <https://example.org/weave-test/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

# Keep this hand-authored inventory context byte-for-byte.

<alice/_knop/_references> a sflo:ReferenceCatalog, sflo:DigitalArtifact, sflo:RdfDocument ;
  ex:curatedNote "unrelated fact" ;
  sflo:hasWorkingLocatedFile <${referencesFilePath}> .
`;

  const result = renderCurrentOnlyReferenceCatalogWovenKnopInventoryTurtle(
    meshBase,
    currentKnopInventoryTurtle,
    designatorPath,
    referencesFilePath,
  );

  assert(result.startsWith(currentKnopInventoryTurtle));
  const appendedSuffix = result.slice(currentKnopInventoryTurtle.length);
  assertStringIncludes(
    appendedSuffix,
    "<alice/_knop/_references> sflo:hasResourcePage <alice/_knop/_references/index.html> .",
  );
  assertStringIncludes(
    appendedSuffix,
    "<alice/_knop/_references/index.html> a sflo:ResourcePage, sflo:LocatedFile .",
  );
  assertEquals(
    appendedSuffix.includes(
      "<https://semantic-flow.github.io/sflo/ontology/hasResourcePage>",
    ),
    false,
  );
  assertFalse(result.endsWith("\n\n"));
});

Deno.test("current-only ReferenceCatalog inventory no-op preserves exact bytes", () => {
  const currentKnopInventoryTurtle = `@base <${meshBase}> .
@prefix ex: <https://example.org/weave-test/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

# Deliberately retain this formatting and trailing blank line.

<alice/_knop/_references> a sflo:RdfDocument, sflo:ReferenceCatalog, sflo:DigitalArtifact ;
  sflo:hasResourcePage <alice/_knop/_references/index.html> ;
  sflo:hasWorkingLocatedFile <${referencesFilePath}> ;
  ex:curatedNote "keep me" .

<alice/_knop/_references/index.html> a sflo:LocatedFile, sflo:ResourcePage .

`;

  const result = renderCurrentOnlyReferenceCatalogWovenKnopInventoryTurtle(
    meshBase,
    currentKnopInventoryTurtle,
    designatorPath,
    referencesFilePath,
  );

  assertEquals(result, currentKnopInventoryTurtle);
});

Deno.test("current-only ReferenceCatalog inventory conflict names requested and existing facts", () => {
  const currentKnopInventoryTurtle = `@base <${meshBase}> .
@prefix ex: <https://example.org/weave-test/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<alice/_knop/_references> a sflo:ReferenceCatalog, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${otherReferencesFilePath}> ;
  ex:expectedWorkingFile <${referencesFilePath}> .
`;

  const error = assertThrows(
    () =>
      renderCurrentOnlyReferenceCatalogWovenKnopInventoryTurtle(
        meshBase,
        currentKnopInventoryTurtle,
        designatorPath,
        referencesFilePath,
      ),
    WeaveInputError,
  );

  assertStringIncludes(error.message, "Requested settled inventory fact");
  assertStringIncludes(
    error.message,
    `<${meshBase}${referencesFilePath}>`,
  );
  assertStringIncludes(error.message, "conflicts with existing fact");
  assertStringIncludes(
    error.message,
    `<${meshBase}${otherReferencesFilePath}>`,
  );
});

Deno.test("current-only PageDefinition inventory append preserves the exact existing prefix", () => {
  const currentKnopInventoryTurtle = `@base <${meshBase}> .
@prefix ex: <https://example.org/weave-test/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<alice/_knop/_page> a sflo:ResourcePageDefinition, sflo:DigitalArtifact, sflo:RdfDocument ;
  ex:opaqueBlank [ ex:value "keep blank" ] ;
  sflo:hasWorkingLocatedFile <${pageDefinitionFilePath}> .
# Keep this PageDefinition note exactly.

<alice/_knop/_page> ex:curatedNote "keep repeated subject" .
`;

  const result = renderCurrentOnlyPageDefinitionWovenKnopInventoryTurtle(
    meshBase,
    currentKnopInventoryTurtle,
    designatorPath,
    pageDefinitionFilePath,
  );

  assert(result.startsWith(currentKnopInventoryTurtle));
  assertStringIncludes(
    result.slice(currentKnopInventoryTurtle.length),
    "<alice/_knop/_page> sflo:hasResourcePage <alice/_knop/_page/index.html> .",
  );
});

Deno.test("current-only PageDefinition inventory no-op preserves exact bytes", () => {
  const currentKnopInventoryTurtle = `@base <${meshBase}> .
@prefix ex: <https://example.org/weave-test/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<alice/_knop/_page> a sflo:ResourcePageDefinition, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${pageDefinitionFilePath}> ;
  sflo:hasResourcePage <alice/_knop/_page/index.html> .

<alice/_knop/_page/index.html> a sflo:LocatedFile, sflo:ResourcePage ;
  ex:curatedNote "keep page fact" .

`;

  assertEquals(
    renderCurrentOnlyPageDefinitionWovenKnopInventoryTurtle(
      meshBase,
      currentKnopInventoryTurtle,
      designatorPath,
      pageDefinitionFilePath,
    ),
    currentKnopInventoryTurtle,
  );
});

Deno.test("current-only PageDefinition inventory conflict rejects an unrelated expected-path substring", () => {
  const currentKnopInventoryTurtle = `@base <${meshBase}> .
@prefix ex: <https://example.org/weave-test/> .
@prefix sflo: <https://semantic-flow.github.io/sflo/ontology/> .

<alice/_knop/_page> a sflo:ResourcePageDefinition, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <${otherPageDefinitionFilePath}> ;
  ex:expectedWorkingFile <${pageDefinitionFilePath}> .
`;

  const error = assertThrows(
    () =>
      renderCurrentOnlyPageDefinitionWovenKnopInventoryTurtle(
        meshBase,
        currentKnopInventoryTurtle,
        designatorPath,
        pageDefinitionFilePath,
      ),
    WeaveInputError,
  );

  assertStringIncludes(error.message, "Requested settled inventory fact");
  assertStringIncludes(error.message, `<${meshBase}${pageDefinitionFilePath}>`);
  assertStringIncludes(error.message, "conflicts with existing fact");
  assertStringIncludes(
    error.message,
    `<${meshBase}${otherPageDefinitionFilePath}>`,
  );
});
