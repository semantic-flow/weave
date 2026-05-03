import { join } from "@std/path";
import { executeIntegrate } from "../../src/runtime/integrate/integrate.ts";
import { executeWeave } from "../../src/runtime/weave/weave.ts";
import { MESH_ALICE_BIO_BASE } from "./mesh_metadata.ts";

export const ROOT_WORKING_FILE_PATH = "root.ttl";

export const ROOT_PAYLOAD_TURTLE = `@base <${MESH_ALICE_BIO_BASE}> .
@prefix schema: <https://schema.org/> .

<> a schema:Dataset ;
  schema:name "Mesh Root" .
`;

export const ROOT_PAYLOAD_TURTLE_V2 = `@base <${MESH_ALICE_BIO_BASE}> .
@prefix schema: <https://schema.org/> .

<> a schema:Dataset ;
  schema:name "Mesh Root v2" ;
  schema:description "Updated root payload." .
`;

export const ROOT_PERSON_SOURCE_TURTLE = `@base <${MESH_ALICE_BIO_BASE}> .
@prefix schema: <https://schema.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

<> a schema:Person ;
  foaf:givenName "Root" ;
  foaf:nick "mesh-root" .

<alice/bio> a schema:CreativeWork ;
  schema:name "Root Source Payload" .
`;

export async function writeRootPayloadFile(
  workspaceRoot: string,
  contents = ROOT_PAYLOAD_TURTLE,
  workingLocalRelativePath = ROOT_WORKING_FILE_PATH,
): Promise<string> {
  const absolutePath = join(workspaceRoot, workingLocalRelativePath);
  await Deno.writeTextFile(absolutePath, contents);
  return absolutePath;
}

export async function integrateRootPayload(
  workspaceRoot: string,
  options?: {
    contents?: string;
    workingLocalRelativePath?: string;
  },
) {
  const workingLocalRelativePath = options?.workingLocalRelativePath ??
    ROOT_WORKING_FILE_PATH;
  await writeRootPayloadFile(
    workspaceRoot,
    options?.contents ?? ROOT_PAYLOAD_TURTLE,
    workingLocalRelativePath,
  );

  return await executeIntegrate({
    workspaceRoot,
    request: {
      designatorPath: "",
      source: workingLocalRelativePath,
    },
  });
}

export async function weaveRootPayload(workspaceRoot: string) {
  return await executeWeave({
    workspaceRoot,
    request: {
      targets: [{ designatorPath: "" }],
    },
  });
}

export async function bootstrapRootWovenWorkspace(
  workspaceRoot: string,
  options?: {
    contents?: string;
    workingLocalRelativePath?: string;
  },
) {
  await integrateRootPayload(workspaceRoot, options);
  return await weaveRootPayload(workspaceRoot);
}
