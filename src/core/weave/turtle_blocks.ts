import { WeaveInputError } from "./errors.ts";

export function splitTurtleBlocks(turtle: string): string[] {
  return turtle.trimEnd().split("\n\n");
}

export function normalizeMeshInventoryHeader(blocks: string[]): string[] {
  if (blocks.length === 0) {
    return blocks;
  }

  const [header, ...rest] = blocks;
  return [
    header.replace(
      "@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .\n",
      "",
    ),
    ...rest,
  ];
}

export function replaceSubjectBlock(
  blocks: string[],
  subjectPath: string,
  replacementBlock: string,
): string[] {
  const index = findSubjectBlockIndex(blocks, subjectPath);
  if (index === -1) {
    throw new WeaveInputError(
      `Current mesh inventory did not contain subject block <${subjectPath}>.`,
    );
  }

  const nextBlocks = [...blocks];
  nextBlocks[index] = replacementBlock;
  return nextBlocks;
}

export function upsertSubjectBlockAfter(
  blocks: string[],
  anchorSubjectPath: string,
  subjectPath: string,
  block: string,
): string[] {
  const existingIndex = findSubjectBlockIndex(blocks, subjectPath);
  if (existingIndex !== -1) {
    const nextBlocks = [...blocks];
    nextBlocks[existingIndex] = block;
    return nextBlocks;
  }

  const anchorIndex = findSubjectBlockIndex(blocks, anchorSubjectPath);
  if (anchorIndex === -1) {
    throw new WeaveInputError(
      `Current mesh inventory did not contain anchor subject block <${anchorSubjectPath}>.`,
    );
  }

  const nextBlocks = [...blocks];
  nextBlocks.splice(anchorIndex + 1, 0, block);
  return nextBlocks;
}

export function findSubjectBlockIndex(
  blocks: readonly string[],
  subjectPath: string,
): number {
  return blocks.findIndex((block) =>
    getSubjectPathFromBlock(block) === subjectPath
  );
}

export function getSubjectPathFromBlock(block: string): string | undefined {
  const match = block.match(/^<([^>]*)>/);
  return match?.[1];
}

export function appendPredicateToSubjectBlock(
  block: string,
  predicateLine: string,
): string {
  if (block.includes(predicateLine)) {
    return block;
  }
  if (!block.endsWith(" .")) {
    throw new WeaveInputError(
      "Could not append predicate to Turtle subject block.",
    );
  }
  return `${block.slice(0, -2)} ;\n  ${predicateLine} .`;
}

export function collectSubjectSubtreeBlocks(
  blocks: readonly string[],
  rootSubjectPath: string,
): readonly string[] {
  return blocks.filter((block) => {
    const subjectPath = getSubjectPathFromBlock(block);
    return subjectPath === rootSubjectPath ||
      subjectPath?.startsWith(`${rootSubjectPath}/`);
  });
}

export function renderSubjectPredicateBlock(
  subjectPath: string,
  typeList: string,
  predicates: readonly string[],
): string {
  return `<${subjectPath}> a ${typeList} ;
  ${predicates.join(" ;\n  ")} .`;
}
