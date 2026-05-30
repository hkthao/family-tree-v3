import type { QueryClient } from "@tanstack/react-query";

/**
 * Invalidate every query keyed by this clan after a mutation succeeds.
 *
 * Covers: persons (paginated lists with arbitrary filters), tree-data,
 * person-relationships, individual person details. The clan detail row
 * itself bumps data_version via DB trigger but we don't refetch it here —
 * the RefreshButton handles that on demand.
 *
 * Use this from any mutation onSuccess instead of writing predicate logic
 * inline; keeping it centralized prevents the easy bug of forgetting to
 * invalidate the tree when a person changes.
 */
export async function invalidateClanData(
  qc: QueryClient,
  clanId: string,
): Promise<void> {
  await qc.invalidateQueries({
    predicate: (q) => {
      const key = q.queryKey;
      if (!Array.isArray(key)) return false;
      const [head, second] = key;
      if (head === "persons" && second === clanId) return true;
      if (head === "tree-data" && second === clanId) return true;
      if (head === "clan-stats" && second === clanId) return true;
      if (head === "branches" && second === clanId) return true;
      if (head === "audit" && second === clanId) return true;
      // person + person-relationships are keyed by personId, not clanId,
      // so we invalidate broadly. Cheap — these queries are small.
      if (head === "person" || head === "person-relationships") return true;
      return false;
    },
  });
}
