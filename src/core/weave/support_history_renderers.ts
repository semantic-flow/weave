export function omitInitialKnopMetadataHistory(
  turtle: string,
  knopPath: string,
): string {
  return turtle
    .replace(
      `  sflo:hasArtifactHistory <${knopPath}/_meta/_history001> ;
  sflo:currentArtifactHistory <${knopPath}/_meta/_history001> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
`,
      "",
    )
    .replace(
      `<${knopPath}/_meta/_history001> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${knopPath}/_meta/_history001/_s0001> ;
  sflo:latestHistoricalState <${knopPath}/_meta/_history001/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/index.html> .

`,
      "",
    )
    .replace(
      `<${knopPath}/_meta/_history001/_s0001> a sflo:HistoricalState ;
  sflo:stateOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasManifestation <${knopPath}/_meta/_history001/_s0001/ttl> ;
  sflo:locatedFileForState <${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/_s0001/index.html> .

`,
      "",
    )
    .replace(
      `<${knopPath}/_meta/_history001/_s0001/ttl> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> ;
  sflo:hasResourcePage <${knopPath}/_meta/_history001/_s0001/ttl/index.html> .

`,
      "",
    )
    .replace(
      `<${knopPath}/_meta/_history001/_s0001/ttl/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

`,
      "",
    )
    .replace(
      `<${knopPath}/_meta/_history001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/index.html> a sflo:ResourcePage, sflo:LocatedFile .

<${knopPath}/_meta/_history001/_s0001/ttl/index.html> a sflo:ResourcePage, sflo:LocatedFile .

`,
      "",
    );
}

export function omitKnopInventoryHistory(
  turtle: string,
  knopPath: string,
): string {
  const historyPath = `${knopPath}/_inventory/_history001`;
  let output = turtle.replace(
    `  sflo:hasArtifactHistory <${historyPath}> ;
  sflo:currentArtifactHistory <${historyPath}> ;
  sflo:nextHistoryOrdinal "2"^^xsd:nonNegativeInteger ;
`,
    "",
  );

  output = output
    .replace(
      `<${historyPath}> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${historyPath}/_s0001> ;
  sflo:latestHistoricalState <${historyPath}/_s0001> ;
  sflo:nextStateOrdinal "2"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${historyPath}/index.html> .

`,
      "",
    )
    .replace(
      `<${historyPath}> a sflo:ArtifactHistory ;
  sflo:historyOrdinal "1"^^xsd:nonNegativeInteger ;
  sflo:hasHistoricalState <${historyPath}/_s0001> ;
  sflo:hasHistoricalState <${historyPath}/_s0002> ;
  sflo:latestHistoricalState <${historyPath}/_s0002> ;
  sflo:nextStateOrdinal "3"^^xsd:nonNegativeInteger ;
  sflo:hasResourcePage <${historyPath}/index.html> .

`,
      "",
    );

  for (const stateOrdinal of [1, 2]) {
    const stateSegment = toStateSegment(stateOrdinal);
    const statePath = `${historyPath}/${stateSegment}`;
    const manifestationPath = `${statePath}/ttl`;
    const locatedFilePath = `${manifestationPath}/inventory.ttl`;
    const previousStatePredicate = stateOrdinal === 1
      ? ""
      : `  sflo:previousHistoricalState <${historyPath}/_s0001> ;
`;
    output = output
      .replace(
        `<${statePath}> a sflo:HistoricalState ;
  sflo:stateOrdinal "${stateOrdinal}"^^xsd:nonNegativeInteger ;
${previousStatePredicate}  sflo:hasManifestation <${manifestationPath}> ;
  sflo:locatedFileForState <${locatedFilePath}> ;
  sflo:hasResourcePage <${statePath}/index.html> .

`,
        "",
      )
      .replace(
        `<${manifestationPath}> a sflo:ArtifactManifestation, sflo:RdfDocument ;
  sflo:locatedFileForManifestation <${locatedFilePath}> ;
  sflo:hasResourcePage <${manifestationPath}/index.html> .

`,
        "",
      )
      .replace(
        `<${locatedFilePath}> a sflo:LocatedFile, sflo:RdfDocument .

`,
        "",
      )
      .replace(
        `<${statePath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

`,
        "",
      )
      .replace(
        `<${statePath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`,
        "",
      )
      .replace(
        `<${manifestationPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

`,
        "",
      )
      .replace(
        `<${manifestationPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`,
        "",
      );
  }

  return output
    .replace(
      `<${historyPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .

`,
      "",
    )
    .replace(
      `<${historyPath}/index.html> a sflo:ResourcePage, sflo:LocatedFile .
`,
      "",
    );
}

function toStateSegment(stateOrdinal: number): string {
  return `_s${String(stateOrdinal).padStart(4, "0")}`;
}
