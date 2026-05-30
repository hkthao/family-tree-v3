import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

/**
 * Fetch ONLY clans.data_version — a tiny row used to decide whether the
 * client's cached heavy queries (persons, tree, members) are stale.
 *
 * The trigger bump_data_version (statement-level on persons/families/branches)
 * keeps this number monotonically increasing per clan. Comparing the cached
 * number to the latest lets us skip the heavy fetch when nothing has changed.
 */
export async function getClanDataVersion(
  clanId: string,
  client: Client = defaultClient,
): Promise<number | null> {
  const { data, error } = await client
    .from("clans")
    .select("data_version")
    .eq("id", clanId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.data_version ?? null;
}
