import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export interface ClanDetail {
  id: string;
  name: string;
  description: string | null;
  visibility: "private" | "public";
  hide_living_for_nonmembers: boolean;
  max_persons: number;
  max_users: number;
  data_version: number;
  owner_id: string | null;
  /** Caller's role in this clan, derived from clan_members. */
  myRole: "admin" | "editor" | "viewer" | null;
}

/**
 * Fetch one clan + caller's role. Returns null if the caller has no access
 * (RLS hides the row, so the query simply returns empty).
 */
export async function getClanDetail(
  clanId: string,
  userId: string,
  client: Client = defaultClient,
): Promise<ClanDetail | null> {
  const [{ data: clan, error: clanErr }, { data: membership }] = await Promise.all([
    client
      .from("clans")
      .select(
        "id, name, description, visibility, hide_living_for_nonmembers, max_persons, max_users, data_version, owner_id",
      )
      .eq("id", clanId)
      .maybeSingle(),
    client
      .from("clan_members")
      .select("role")
      .eq("clan_id", clanId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (clanErr) throw new Error(clanErr.message);
  if (!clan) return null;

  return {
    ...clan,
    visibility: clan.visibility as ClanDetail["visibility"],
    myRole: (membership?.role as ClanDetail["myRole"]) ?? null,
  };
}
