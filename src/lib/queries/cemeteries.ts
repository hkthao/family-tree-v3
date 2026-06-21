import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export interface Cemetery {
  id: string;
  clan_id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
}
export interface CemeteryListItem extends Cemetery {
  place_count: number;
}

const COLS = "id, clan_id, name, address, latitude, longitude, notes";

export async function listCemeteries(
  clanId: string,
  client: Client = defaultClient,
): Promise<CemeteryListItem[]> {
  const { data, error } = await client
    .from("cemeteries")
    .select(`${COLS}, resting_places(id)`)
    .eq("clan_id", clanId)
    .is("deleted_at", null)
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => {
    const { resting_places, ...rest } = c;
    return {
      ...(rest as Cemetery),
      // only count non-deleted places (embed already excludes via FK? no — count all linked)
      place_count: (resting_places ?? []).length,
    };
  });
}

export type CemeteryInput = Omit<Cemetery, "id" | "clan_id">;

export async function createCemetery(
  clanId: string,
  input: CemeteryInput,
  client: Client = defaultClient,
): Promise<{ id: string }> {
  const { data, error } = await client
    .from("cemeteries")
    .insert({ clan_id: clanId, ...input })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

export async function updateCemetery(
  id: string,
  patch: Partial<CemeteryInput>,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client.from("cemeteries").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Hard-delete the cemetery. Linked resting places keep their row — the
 * FK `on delete set null` detaches them (cemetery_id → null). Hard
 * delete is needed for that FK to fire (a soft delete wouldn't).
 */
export async function deleteCemetery(
  id: string,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client.from("cemeteries").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
