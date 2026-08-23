import { assertEquals, assertStringIncludes } from "@std/assert";
import { Parser } from "n3";
import { planKnopCreate } from "./create.ts";
import { planFoundingReferentDataVersion } from "./version_founding_referent_data.ts";
import { readMeshAliceBioBranchFile } from "../../../tests/support/mesh_alice_bio_fixture.ts";

const meshBase = "https://semantic-flow.github.io/mesh-alice-bio/";
const encode = (text: string) => new TextEncoder().encode(text);

Deno.test("planFoundingReferentDataVersion creates exact initial and corrected snapshots", async () => {
  const meshInventory = await readMeshAliceBioBranchFile(
    "03-mesh-created-woven",
    "_mesh/_inventory/inventory.ttl",
  );
  const firstBytes = encode(
    `\uFEFF<${meshBase}founding-demo> <https://stagecraft.example/vocab/incarnationOf> <https://original.example/items/42> .\r\n`,
  );
  const create = planKnopCreate({
    meshBase,
    designatorPath: "founding-demo",
    currentMeshInventoryTurtle: meshInventory,
    foundingData: firstBytes,
  });
  const initial = await planFoundingReferentDataVersion({
    meshBase,
    designatorPath: "founding-demo",
    currentKnopInventoryTurtle: create.createdFiles[1]!.contents,
    bytes: firstBytes,
  });

  assertEquals(
    initial.snapshotPath,
    "founding-demo/_knop/_founding/_history001/_s0001/ttl/data.ttl",
  );
  assertEquals(initial.createdBinaryFiles[0]!.contents, firstBytes);
  assertStringIncludes(initial.contentDigest, "sha256:");
  const initialInventory = initial.updatedFiles[0]!.contents;
  assertStringIncludes(
    initialInventory,
    "sflo:defaultArtifactHistory <founding-demo/_knop/_founding/_history001>",
  );
  assertStringIncludes(
    initialInventory,
    `sflo:hasContentDigest "${initial.contentDigest}"`,
  );
  assertEquals(initialInventory.includes("sflo:hasResourcePage"), false);

  const correctedBytes = encode(
    `<${meshBase}founding-demo> <https://stagecraft.example/vocab/incarnationOf> <https://original.example/items/43> .\n`,
  );
  const corrected = await planFoundingReferentDataVersion({
    meshBase,
    designatorPath: "founding-demo",
    currentKnopInventoryTurtle: initialInventory,
    bytes: correctedBytes,
  });
  const correctedInventory = corrected.updatedFiles[0]!.contents;

  assertEquals(
    corrected.snapshotPath,
    "founding-demo/_knop/_founding/_history001/_s0002/ttl/data.ttl",
  );
  assertEquals(corrected.createdBinaryFiles[0]!.contents, correctedBytes);
  assertStringIncludes(
    correctedInventory,
    "sflo:latestHistoricalState <founding-demo/_knop/_founding/_history001/_s0002>",
  );
  assertStringIncludes(
    correctedInventory,
    "sflo:hasHistoricalState <founding-demo/_knop/_founding/_history001/_s0001>",
  );
  assertStringIncludes(
    correctedInventory,
    "sflo:hasHistoricalState <founding-demo/_knop/_founding/_history001/_s0002>",
  );
  assertStringIncludes(
    correctedInventory,
    "sflo:previousHistoricalState <founding-demo/_knop/_founding/_history001/_s0001>",
  );
  assertStringIncludes(correctedInventory, initial.contentDigest);
  assertStringIncludes(correctedInventory, corrected.contentDigest);
  assertEquals(
    new Parser({ baseIRI: meshBase }).parse(correctedInventory).length > 0,
    true,
  );
});
