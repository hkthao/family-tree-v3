/**
 * Dòng thời gian của một người (bảng person_timeline): các mốc theo năm trong
 * đời, do người có quyền sửa dòng họ thêm / sửa / xoá bằng form.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export interface TimelineRow {
  year: number;
  /** Can chi của năm, vd "Nhâm Thìn". */
  era: string | null;
  body: string;
}

export async function getPersonTimeline(
  personId: string,
  client: Client = defaultClient,
): Promise<TimelineRow[]> {
  const { data, error } = await client
    .from("person_timeline")
    .select("year, era, body")
    .eq("person_id", personId)
    .order("year")
    .order("sort");
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Thay toàn bộ dòng thời gian của người. Chèn bản mới trước rồi mới xoá bản cũ,
 * để lỗi giữa chừng không làm mất mốc đã có.
 */
export async function replacePersonTimeline(
  personId: string,
  clanId: string,
  rows: TimelineRow[],
  client: Client = defaultClient,
): Promise<void> {
  const { data: old, error: e0 } = await client
    .from("person_timeline")
    .select("id")
    .eq("person_id", personId);
  if (e0) throw new Error(e0.message);
  if (rows.length > 0) {
    const { error } = await client.from("person_timeline").insert(
      rows.map((r, i) => ({
        clan_id: clanId,
        person_id: personId,
        year: r.year,
        era: r.era?.trim() || null,
        body: r.body.trim(),
        sort: i,
      })),
    );
    if (error) throw new Error(error.message);
  }
  const oldIds = (old ?? []).map((o) => o.id);
  if (oldIds.length > 0) {
    const { error } = await client.from("person_timeline").delete().in("id", oldIds);
    if (error) throw new Error(error.message);
  }
}
