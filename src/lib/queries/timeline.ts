import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { TimelineRow } from "@/lib/timeline/mergeTimeline";

/**
 * Bảng `clan_timeline_milestones` chưa nằm trong database.types.ts (file sinh tự động, chạy `npm run db:types`
 * khi đồng bộ với DB sạch) nên dùng client không gắn kiểu cho riêng bảng này.
 */
type Client = SupabaseClient;
const COLS = "id, clan_id, person_id, on_clan, era, year, sort_order, title, body, icon_key, photo_person_id, image_url, context_title, context_body, source_key";
const TABLE = "clan_timeline_milestones";

export interface MilestoneInput {
  /** Mốc nói về người nào (null = chung của dòng họ). */
  person_id?: string | null;
  /** Có hiện trên poster dòng họ không. */
  on_clan?: boolean;
  /** Can chi của năm (tự tính khi lưu). */
  era?: string | null;
  year: number;
  /** Số thứ tự trong cùng một năm (0–999). */
  sort_order?: number;
  title: string;
  body: string | null;
  icon_key: string | null;
  photo_person_id?: string | null;
  /** `lib:<id>` hoặc link https; null = không có hình riêng. */
  image_url?: string | null;
  /** Bối cảnh tự sửa (null/null = mặc định theo năm, ""/"" = ẩn). */
  context_title?: string | null;
  context_body?: string | null;
  /** Khoá gợi ý gia phả đã dùng (chỉ khi mốc được sao chép từ gợi ý). */
  source_key?: string | null;
}

/**
 * Đọc mốc. Mặc định = các mốc hiện trên poster DÒNG HỌ (`on_clan`). Truyền `personId` = toàn bộ mốc của người đó
 * (dòng thời gian trong Danh bạ), kể cả mốc không hiện trên poster dòng họ. `all` = mọi mốc của dòng họ (màn quản lý).
 */
export async function listTimelineRows(
  clanId: string,
  opts: { personId?: string | null; all?: boolean } = {},
  client: Client = defaultClient as unknown as Client,
): Promise<TimelineRow[]> {
  let q = client.from(TABLE).select(COLS).eq("clan_id", clanId);
  if (opts.personId) q = q.eq("person_id", opts.personId);
  else if (!opts.all) q = q.eq("on_clan", true);
  const { data, error } = await q
    .order("year", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as TimelineRow[];
}

export async function createMilestone(
  clanId: string,
  input: MilestoneInput,
  client: Client = defaultClient as unknown as Client,
): Promise<void> {
  const { error } = await client.from(TABLE).insert({ clan_id: clanId, ...input });
  if (error) throw new Error(error.message);
}

/** Thêm nhiều mốc một lần (vd. "Thêm các mốc nổi bật từ gia phả"). Bỏ qua mốc đã có cùng `source_key`. */
export async function createMilestones(
  clanId: string,
  inputs: MilestoneInput[],
  client: Client = defaultClient as unknown as Client,
): Promise<void> {
  if (inputs.length === 0) return;
  const { error } = await client
    .from(TABLE)
    .upsert(
      inputs.map((i) => ({ clan_id: clanId, ...i })),
      { onConflict: "clan_id,source_key", ignoreDuplicates: true },
    );
  if (error) throw new Error(error.message);
}

export async function updateMilestone(
  id: string,
  patch: Partial<MilestoneInput>,
  client: Client = defaultClient as unknown as Client,
): Promise<void> {
  const { error } = await client.from(TABLE).update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteMilestones(
  ids: string[],
  client: Client = defaultClient as unknown as Client,
): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await client.from(TABLE).delete().in("id", ids);
  if (error) throw new Error(error.message);
}

/** Di sản và mộ phần có năm xây — nguồn gợi ý mốc (cột nhẹ, không kèm ảnh/người). */
export async function listTimelineSources(
  clanId: string,
  client: Client = defaultClient as unknown as Client,
): Promise<{
  heritage: import("@/lib/timeline/suggestions").HeritageSource[];
  graves: (import("@/lib/timeline/suggestions").GraveSource & { kind: string })[];
}> {
  const [h, g] = await Promise.all([
    client
      .from("heritage_items")
      .select("id, title, summary, category, built_year")
      .eq("clan_id", clanId)
      .eq("status", "active")
      .is("deleted_at", null)
      .not("built_year", "is", null),
    client
      .from("resting_places")
      .select("id, name, location_name, kind, built_year, notes")
      .eq("clan_id", clanId)
      .is("deleted_at", null)
      .not("built_year", "is", null),
  ]);
  if (h.error) throw new Error(h.error.message);
  if (g.error) throw new Error(g.error.message);
  return { heritage: (h.data ?? []) as never, graves: (g.data ?? []) as never };
}

/**
 * Xoá DÒNG THỜI GIAN của một người. Mốc đã đưa lên poster dòng họ (`on_clan`) được GIỮ cho dòng họ (chỉ gỡ khỏi
 * người); các mốc còn lại (chỉ hiện ở trang người) bị xoá.
 */
export async function deletePersonTimeline(
  clanId: string,
  personId: string,
  client: Client = defaultClient as unknown as Client,
): Promise<void> {
  const keep = await client
    .from(TABLE)
    .update({ person_id: null })
    .eq("clan_id", clanId)
    .eq("person_id", personId)
    .eq("on_clan", true);
  if (keep.error) throw new Error(keep.error.message);
  const del = await client.from(TABLE).delete().eq("clan_id", clanId).eq("person_id", personId);
  if (del.error) throw new Error(del.error.message);
}
