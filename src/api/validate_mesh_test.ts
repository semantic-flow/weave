import { assertEquals, assertThrows } from "@std/assert";
import type {
  MeshValidationFinding,
  ValidateMeshRequest,
  ValidateMeshResult,
} from "./validate_mesh.ts";
import { admitValidateMeshRequest } from "./validate_mesh.ts";
import { WeaveApiError } from "./version_payloads.ts";

const meshRoot = Deno.build.os === "windows" ? "C:\\mesh" : "/mesh";

function assertAdmissionError(request: ValidateMeshRequest): WeaveApiError {
  const error = assertThrows(
    () => admitValidateMeshRequest(request),
    WeaveApiError,
  );
  assertEquals([error.code, error.stage], ["invalid-request", "admit"]);
  return error;
}

Deno.test("validateMesh admission requires an absolute non-empty meshRoot", () => {
  assertAdmissionError({ meshRoot: "" });
  assertAdmissionError({ meshRoot: "." });
});

Deno.test("validateMesh admission accepts absent and empty targets as whole mesh", () => {
  assertEquals(
    admitValidateMeshRequest({ meshRoot }).targets,
    [],
  );
  assertEquals(
    admitValidateMeshRequest({ meshRoot, targets: [] }).targets,
    [],
  );
});

Deno.test("validateMesh admission normalizes the public root alias and recursive default", () => {
  const admitted = admitValidateMeshRequest({
    meshRoot,
    targets: [
      { designatorPath: "/" },
      { designatorPath: " rules/core ", recursive: true },
    ],
  });

  assertEquals(
    admitted.targets.map((target) => ({
      designatorPath: target.designatorPath,
      recursive: target.recursive,
    })),
    [
      { designatorPath: "", recursive: false },
      { designatorPath: "rules/core", recursive: true },
    ],
  );
});

Deno.test("validateMesh admission refuses malformed targets and normalized duplicates", () => {
  assertAdmissionError({
    meshRoot,
    targets: [
      { designatorPath: "rules/core" },
      { designatorPath: " rules/core " },
    ],
  });
  assertAdmissionError({
    meshRoot,
    targets: [{ designatorPath: "rules/core", recursive: "yes" }],
  } as unknown as ValidateMeshRequest);
  assertAdmissionError({
    meshRoot,
    targets: [{ designatorPath: "rules/core", extra: true }],
  } as unknown as ValidateMeshRequest);
});

Deno.test("validateMesh public contracts accept readonly request and result values", () => {
  const request = {
    meshRoot,
    targets: [{ designatorPath: "/", recursive: true }],
  } as const satisfies ValidateMeshRequest;
  const finding = {
    severity: "error",
    code: "missing-artifact",
    message: "missing",
    path: "rules.ttl",
    designatorPath: "/",
  } as const satisfies MeshValidationFinding;
  const result = {
    meshBase: "https://example.test/",
    findings: [finding],
    coverage: {
      knownDesignatorPathCount: 1,
      plannedDesignatorPathCount: 0,
    },
  } as const satisfies ValidateMeshResult;

  assertEquals(request.targets[0].designatorPath, "/");
  assertEquals(result.findings[0].code, "missing-artifact");
});
