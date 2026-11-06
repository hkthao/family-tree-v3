import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export type MapLayer = "people" | "graves" | "heritage";

export const MAP_LAYER_LABEL: Record<MapLayer, string> = {
  people: "Người",
  graves: "Mộ phần",
  heritage: "Di sản",
};

/** Số đếm theo mã tỉnh cho từng lớp + số mục chưa có tỉnh. Không chứa tên / địa chỉ chi tiết. */
export interface MapStats {
  people: Record<string, number>;
  graves: Record<string, number>;
  heritage: Record<string, number>;
  total: Record<MapLayer, number>;
  missing: Record<MapLayer, number>;
}

export async function getClanMapStats(
  clanId: string,
  includeDeceased: boolean,
  client: Client = defaultClient,
): Promise<MapStats> {
  const { data, error } = await client.rpc("clan_map_stats", {
    p_clan: clanId,
    p_include_deceased: includeDeceased,
  });
  if (error) throw new Error(error.message);
  return data as unknown as MapStats;
}
