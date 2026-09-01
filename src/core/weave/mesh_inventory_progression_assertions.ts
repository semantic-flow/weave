import { SFLO_NAMESPACE } from "../rdf/namespaces.ts";
import { WeaveInputError } from "./errors.ts";
import type { PreparedCurrentInventory } from "./inventory_append_planner.ts";

const LEGACY_INVENTORY_PROGRESSION_PREDICATES = new Set([
  `${SFLO_NAMESPACE}currentArtifactHistory`,
  `${SFLO_NAMESPACE}nextHistoryOrdinal`,
  `${SFLO_NAMESPACE}latestHistoricalState`,
  `${SFLO_NAMESPACE}nextStateOrdinal`,
]);

export function assertNoLegacyMeshInventoryProgression(
  preparedCurrentInventory: PreparedCurrentInventory,
  operation: string,
): void {
  const carriedPredicates = [
    ...new Set(
      preparedCurrentInventory.quads
        .map((quad) => quad.predicate.value)
        .filter((predicate) =>
          LEGACY_INVENTORY_PROGRESSION_PREDICATES.has(predicate)
        ),
    ),
  ].sort((left, right) => left.localeCompare(right));
  if (carriedPredicates.length === 0) {
    return;
  }

  throw new WeaveInputError(
    `Could not ${operation} because the current MeshInventory contains legacy inventory-owned mutable progression predicates: ${
      carriedPredicates.map((predicate) => `<${predicate}>`).join(", ")
    }. Regenerate the fixture or use an explicit repair path before retrying weave.`,
  );
}
