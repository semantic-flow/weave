import type { PlannedFile } from "../planned_file.ts";
import {
  SFCFG_TURTLE_PREFIX_DECLARATION,
  SFLO_TURTLE_PREFIX_DECLARATION,
} from "../rdf/namespaces.ts";

export interface MeshCreateRequest {
  meshBase: string;
  publicationProfile?: PublicationProfileRequest;
  includeNoJekyll?: boolean;
  includeMeshConfig?: boolean;
  workspaceRootRelativeToMeshRoot?: string;
}

export type PublicationProfile = "none" | "githubPages";
export type PublicationProfileRequest = PublicationProfile | "auto";

export interface MeshCreatePlan {
  meshBase: string;
  meshIri: string;
  publicationProfile?: PublicationProfile;
  files: readonly PlannedFile[];
}

export class MeshCreateInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MeshCreateInputError";
  }
}

export function planMeshCreate(request: MeshCreateRequest): MeshCreatePlan {
  const meshBase = normalizeMeshBase(request.meshBase);
  const meshIri = new URL("_mesh", meshBase).href;
  const publicationProfile = resolvePublicationProfile(
    meshBase,
    request.publicationProfile,
  );
  const includeNoJekyll = resolveIncludeNoJekyll(
    request.includeNoJekyll,
    publicationProfile,
  );
  const workspaceRootRelativeToMeshRoot =
    request.workspaceRootRelativeToMeshRoot;
  const includeMeshConfig = request.includeMeshConfig === true ||
    workspaceRootRelativeToMeshRoot !== undefined ||
    publicationProfile !== undefined;

  return {
    meshBase,
    meshIri,
    ...(publicationProfile === undefined ? {} : { publicationProfile }),
    files: [
      {
        path: "_mesh/_meta/meta.ttl",
        contents: renderMeshMetadataTurtle(meshBase),
      },
      {
        path: "_mesh/_inventory/inventory.ttl",
        contents: renderMeshInventoryTurtle(
          meshBase,
          includeMeshConfig,
        ),
      },
      ...(includeMeshConfig
        ? [{
          path: "_mesh/_config/config.ttl",
          contents: renderMeshConfigTurtle(
            workspaceRootRelativeToMeshRoot,
            publicationProfile,
          ),
        }]
        : []),
      ...(includeNoJekyll ? [{ path: ".nojekyll", contents: "" }] : []),
    ],
  };
}

function resolvePublicationProfile(
  meshBase: string,
  requestProfile: PublicationProfileRequest | undefined,
): PublicationProfile | undefined {
  if (requestProfile === undefined) {
    return undefined;
  }
  if (requestProfile === "auto") {
    return isGitHubPagesMeshBase(meshBase) ? "githubPages" : "none";
  }
  return requestProfile;
}

function resolveIncludeNoJekyll(
  includeNoJekyll: boolean | undefined,
  publicationProfile: PublicationProfile | undefined,
): boolean {
  if (includeNoJekyll !== undefined && publicationProfile !== undefined) {
    throw new MeshCreateInputError(
      "includeNoJekyll and publicationProfile must not both be provided",
    );
  }
  if (includeNoJekyll !== undefined) {
    return includeNoJekyll;
  }
  return publicationProfile === "githubPages";
}

function isGitHubPagesMeshBase(meshBase: string): boolean {
  const url = new URL(meshBase);
  return url.hostname === "github.io" || url.hostname.endsWith(".github.io");
}

function normalizeMeshBase(meshBase: string): string {
  const trimmed = meshBase.trim();
  if (trimmed.length === 0) {
    throw new MeshCreateInputError("meshBase is required");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new MeshCreateInputError("meshBase must be an absolute IRI");
  }

  if (!url.pathname.endsWith("/")) {
    throw new MeshCreateInputError("meshBase must end with '/'");
  }
  if (url.search.length > 0 || url.hash.length > 0) {
    throw new MeshCreateInputError(
      "meshBase must not include a query or fragment",
    );
  }

  return url.href;
}

function renderMeshMetadataTurtle(meshBase: string): string {
  return `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<_mesh> a sflo:SemanticMesh ;
  sflo:meshBase "${meshBase}"^^xsd:anyURI ;
  sflo:hasMeshInventory <_mesh/_inventory> .

<_mesh/_meta> a sflo:MeshMetadata, sflo:DigitalArtifact, sflo:RdfDocument .

<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument .
`;
}

function renderMeshInventoryTurtle(
  meshBase: string,
  hasMeshConfig: boolean,
): string {
  if (!hasMeshConfig) {
    return `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<_mesh> a sflo:SemanticMesh ;
  sflo:meshBase "${meshBase}"^^xsd:anyURI ;
  sflo:hasMeshMetadata <_mesh/_meta> ;
  sflo:hasMeshInventory <_mesh/_inventory> .

<_mesh/_meta> a sflo:MeshMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <_mesh/_meta/meta.ttl> .

<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <_mesh/_inventory/inventory.ttl> .

<_mesh/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .
`;
  }

  return `@base <${meshBase}> .
${SFLO_TURTLE_PREFIX_DECLARATION}
${SFCFG_TURTLE_PREFIX_DECLARATION}
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<_mesh> a sflo:SemanticMesh ;
  sflo:meshBase "${meshBase}"^^xsd:anyURI ;
  sflo:hasMeshMetadata <_mesh/_meta> ;
  sflo:hasMeshInventory <_mesh/_inventory> ;
  sfcfg:hasConfig <_mesh/_config> .

<_mesh/_meta> a sflo:MeshMetadata, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <_mesh/_meta/meta.ttl> .

<_mesh/_inventory> a sflo:MeshInventory, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <_mesh/_inventory/inventory.ttl> .

<_mesh/_config> a sfcfg:MeshConfig, sflo:DigitalArtifact, sflo:RdfDocument ;
  sflo:hasWorkingLocatedFile <_mesh/_config/config.ttl> .

<_mesh/_meta/meta.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_inventory/inventory.ttl> a sflo:LocatedFile, sflo:RdfDocument .

<_mesh/_config/config.ttl> a sflo:LocatedFile, sflo:RdfDocument .
`;
}

function renderMeshConfigTurtle(
  workspaceRootRelativeToMeshRoot: string | undefined,
  publicationProfile: PublicationProfile | undefined,
): string {
  const statements: string[] = ["a sfcfg:MeshConfig"];
  if (workspaceRootRelativeToMeshRoot !== undefined) {
    statements.push(
      `  sfcfg:workspaceRootRelativeToMeshRoot ${
        JSON.stringify(workspaceRootRelativeToMeshRoot)
      }`,
    );
  }
  if (publicationProfile !== undefined) {
    statements.push(
      `  sfcfg:hasPublicationProfile ${
        renderPublicationProfileTurtleTerm(publicationProfile)
      }`,
    );
  }

  return `${SFCFG_TURTLE_PREFIX_DECLARATION}

<> ${statements.join(" ;\n")} .
`;
}

function renderPublicationProfileTurtleTerm(
  publicationProfile: PublicationProfile,
): string {
  switch (publicationProfile) {
    case "none":
      return "sfcfg:publicationProfile_none";
    case "githubPages":
      return "sfcfg:publicationProfile_githubPages";
  }
}
