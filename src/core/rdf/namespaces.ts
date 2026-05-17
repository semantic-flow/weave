export type RdfPrefix = readonly [namespace: string, prefix: string];

export const RDF_PREFIX = "rdf";
export const RDF_NAMESPACE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
export const RDFS_PREFIX = "rdfs";
export const RDFS_NAMESPACE = "http://www.w3.org/2000/01/rdf-schema#";
export const OWL_PREFIX = "owl";
export const OWL_NAMESPACE = "http://www.w3.org/2002/07/owl#";
export const SHACL_PREFIX = "sh";
export const SHACL_NAMESPACE = "http://www.w3.org/ns/shacl#";
export const XSD_PREFIX = "xsd";
export const XSD_NAMESPACE = "http://www.w3.org/2001/XMLSchema#";

export const SFLO_PREFIX = "sflo";
export const SFLO_NAMESPACE = "https://semantic-flow.github.io/sflo/ontology/";
export const SFCFG_PREFIX = "sfcfg";
export const SFCFG_NAMESPACE = "https://semantic-flow.github.io/sflo/config/";

export const SFLO_TURTLE_PREFIX_DECLARATION = turtlePrefixDeclaration(
  SFLO_PREFIX,
  SFLO_NAMESPACE,
);
export const SFCFG_TURTLE_PREFIX_DECLARATION = turtlePrefixDeclaration(
  SFCFG_PREFIX,
  SFCFG_NAMESPACE,
);

export const COMMON_RDF_PREFIXES: readonly RdfPrefix[] = [
  [OWL_NAMESPACE, OWL_PREFIX],
  [SHACL_NAMESPACE, SHACL_PREFIX],
  [RDFS_NAMESPACE, RDFS_PREFIX],
  [RDF_NAMESPACE, RDF_PREFIX],
  [SFLO_NAMESPACE, SFLO_PREFIX],
  [SFCFG_NAMESPACE, SFCFG_PREFIX],
];

export function turtlePrefixDeclaration(
  prefix: string,
  namespace: string,
): string {
  return `@prefix ${prefix}: <${namespace}> .`;
}
