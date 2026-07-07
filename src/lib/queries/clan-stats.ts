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

export interface ClanContentCounts {
  /** Số phòng ký ức (ảnh 3D). */
  memory_rooms: number;
  /** Số mộ phần & tro cốt. */
  resting_places: number;
  /** Số bài di sản văn hoá. */
  heritage_items: number;
}

/**
 * Đếm nhanh (head+count, không tải rows) số phòng ký ức / mộ phần / di sản của
 * dòng họ để hiển thị trên Tổng quan. RLS áp bình thường → người ngoài dòng họ
 * (clan công khai) có thể nhận 0; Dashboard chỉ gọi cho thành viên.
 */
export async function getClanContentCounts(
  clanId: string,
  client: Client = defaultClient,
): Promise<ClanContentCounts> {
  const [rooms, resting, heritage] = await Promise.all([
    client
      .from("memory_rooms")
      .select("id", { count: "exact", head: true })
      .eq("clan_id", clanId)
      .is("deleted_at", null),
    client
      .from("resting_places")
      .select("id", { count: "exact", head: true })
      .eq("clan_id", clanId)
      .is("deleted_at", null),
    client
      .from("heritage_items")
      .select("id", { count: "exact", head: true })
      .eq("clan_id", clanId)
      .is("deleted_at", null),
  ]);
  const err = rooms.error ?? resting.error ?? heritage.error;
  if (err) throw new Error(err.message);
  return {
    memory_rooms: rooms.count ?? 0,
    resting_places: resting.count ?? 0,
    heritage_items: heritage.count ?? 0,
  };
}
