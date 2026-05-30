import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { getClanDataVersion } from "@/lib/queries/clan-version";
import { queryKeys } from "@/lib/queries/keys";

export type FreshnessOutcome = "fresh" | "updated";

export interface ClanFreshness {
  /** Last time we confirmed the client cache matches the server. */
  lastSyncedAt: Date | null;
  /** A refresh is currently in flight. */
  isChecking: boolean;
  /**
   * Cheap version check. If the server data_version differs from the cached
   * clan.data_version, invalidate heavy queries for this clan and return
   * "updated"; otherwise return "fresh" without invalidating anything.
   */
  refresh: () => Promise<FreshnessOutcome>;
}

/**
 * Sync key — per-clan localStorage key for the last-synced timestamp.
 * We use localStorage (small string) instead of the React Query cache so it
 * survives navigation between pages of the same clan.
 */
function lastSyncedKey(clanId: string): string {
  return `family-tree:last-synced:${clanId}`;
}

function readLastSynced(clanId: string): Date | null {
  try {
    const raw = localStorage.getItem(lastSyncedKey(clanId));
    if (!raw) return null;
    const t = Number(raw);
    return Number.isFinite(t) ? new Date(t) : null;
  } catch {
    return null;
  }
}

function writeLastSynced(clanId: string, when: Date): void {
  try {
    localStorage.setItem(lastSyncedKey(clanId), String(when.getTime()));
  } catch {
    // localStorage can throw in private mode — non-fatal.
  }
}

/**
 * Invalidate every heavy query bound to this clan. This is intentionally
 * broad: persons (paginated, any filter), tree data, members, individual
 * person details, and the clan row itself (so a stale data_version updates).
 */
function invalidateClanQueries(
  qc: ReturnType<typeof useQueryClient>,
  clanId: string,
): Promise<void> {
  return qc.invalidateQueries({
    predicate: (q) => {
      const key = q.queryKey;
      if (!Array.isArray(key)) return false;
      const [head, second] = key;
      if (head === "persons" && second === clanId) return true;
      if (head === "tree-data" && second === clanId) return true;
      if (head === "clan-members" && second === clanId) return true;
      if (head === "clan" && second === clanId) return true;
      // person + person-relationships are keyed by personId, not clanId.
      // We invalidate them broadly here because a clan-level refresh should
      // surface any updates to individual person detail screens too.
      if (head === "person" || head === "person-relationships") return true;
      return false;
    },
  });
}

export function useClanFreshness(
  clanId: string,
  cachedVersion: number | null,
): ClanFreshness {
  const qc = useQueryClient();
  const [isChecking, setIsChecking] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(() =>
    readLastSynced(clanId),
  );

  // If we navigate between clans, re-read the per-clan timestamp.
  useEffect(() => {
    setLastSyncedAt(readLastSynced(clanId));
  }, [clanId]);

  const refresh = useCallback(async (): Promise<FreshnessOutcome> => {
    setIsChecking(true);
    try {
      const latest = await qc.fetchQuery({
        queryKey: queryKeys.clanDataVersion(clanId),
        queryFn: () => getClanDataVersion(clanId),
        // Always fetch fresh — this IS the freshness check.
        staleTime: 0,
        gcTime: 0,
      });

      const now = new Date();
      writeLastSynced(clanId, now);
      setLastSyncedAt(now);

      if (latest !== null && cachedVersion !== null && latest === cachedVersion) {
        return "fresh";
      }
      await invalidateClanQueries(qc, clanId);
      return "updated";
    } finally {
      setIsChecking(false);
    }
  }, [qc, clanId, cachedVersion]);

  return { lastSyncedAt, isChecking, refresh };
}

// Exported for tests.
export const __internal = {
  readLastSynced,
  writeLastSynced,
  lastSyncedKey,
  invalidateClanQueries,
};
