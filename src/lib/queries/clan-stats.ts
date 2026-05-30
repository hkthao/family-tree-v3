import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export interface ClanStats {
  total_persons: number;
  males: number;
  females: number;
  living: number;
  deceased: number;
  max_generation: number | null;
  branches: number;
}

/**
 * One round-trip aggregate from the get_clan_stats() RPC. RLS applies
 * (SECURITY INVOKER) so a caller who can't see the clan gets zeros, which
 * the dashboard renders as the empty-clan state.
 */
export async function getClanStats(
  clanId: string,
  client: Client = defaultClient,
): Promise<ClanStats> {
  const { data, error } = await client.rpc("get_clan_stats", {
    target_clan: clanId,
  });
  if (error) throw new Error(error.message);

  const row = data?.[0];
  return {
    total_persons: row?.total_persons ?? 0,
    males: row?.males ?? 0,
    females: row?.females ?? 0,
    living: row?.living ?? 0,
    deceased: row?.deceased ?? 0,
    max_generation: row?.max_generation ?? null,
    branches: row?.branches ?? 0,
  };
}
