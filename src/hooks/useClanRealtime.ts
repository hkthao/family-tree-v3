import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { invalidateClanData } from "@/lib/cache";
import { supabase } from "@/lib/supabase";

/**
 * Live-update bridge for an open clan.
 *
 * Subscribes to UPDATE events on the clans row for `clanId` over
 * Supabase Realtime. Every structural mutation in the clan bumps
 * clans.data_version via statement-level triggers; when our local
 * cached version falls behind the just-broadcast one, we run the same
 * cache invalidation that the manual "Làm mới" button performs.
 *
 * The hook lives at the ClanLayout level so a single subscription
 * covers every page inside a clan. It is a no-op when clanId is
 * empty (e.g. while the route is resolving) and tears the channel
 * down on unmount or clan switch.
 *
 * Note: we deliberately compare versions instead of invalidating on
 * every broadcast — the user who just made the edit will see their
 * own mutation's invalidate first, then the Realtime echo would
 * cause a second round-trip. Comparing collapses that duplicate.
 */
export function useClanRealtime(
  clanId: string | undefined,
  currentVersion: number | undefined,
): void {
  const qc = useQueryClient();

  // Keep the latest cached version in a ref so the subscription
  // callback (created once per clanId) always reads the freshest
  // value without re-subscribing on every bump.
  const versionRef = useRef(currentVersion);
  useEffect(() => {
    versionRef.current = currentVersion;
  }, [currentVersion]);

  useEffect(() => {
    if (!clanId) return;

    const channel = supabase
      .channel(`clan-realtime:${clanId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "clans",
          filter: `id=eq.${clanId}`,
        },
        (payload) => {
          const next = (payload.new as { data_version?: number } | null)
            ?.data_version;
          if (typeof next !== "number") return;
          const seen = versionRef.current;
          if (typeof seen === "number" && next <= seen) return;
          versionRef.current = next;
          void invalidateClanData(qc, clanId);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [clanId, qc]);
}
