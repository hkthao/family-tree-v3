import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export type AnnouncementLevel = "info" | "update" | "warning" | "critical";

export interface Announcement {
  id: string;
  title: string;
  body: string;
  level: AnnouncementLevel;
  published_at: string | null;
  expires_at: string | null;
  is_public: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const COLUMNS =
  "id, title, body, level, published_at, expires_at, is_public, created_by, created_at, updated_at";

/**
 * Đọc tin user thấy được (RLS lọc: published + chưa hết hạn). Admin
 * cũng dùng hàm này cho trang `/announcements` của họ; trang admin
 * riêng dùng `listAnnouncementsForAdmin` để thấy nháp/expired.
 */
export async function listAnnouncements(
  client: Client = defaultClient,
): Promise<Announcement[]> {
  const { data, error } = await client
    .from("announcements")
    .select(COLUMNS)
    .order("published_at", { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Announcement[];
}

/**
 * Admin xem toàn bộ — kể cả nháp, hết hạn, lên lịch tương lai. RLS
 * `announcements_admin_read` cho phép.
 */
export async function listAnnouncementsForAdmin(
  client: Client = defaultClient,
): Promise<Announcement[]> {
  const { data, error } = await client
    .from("announcements")
    .select(COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Announcement[];
}

/**
 * Public changelog feed — anon đọc được. Trang `/changelog` dùng cái
 * này. Lọc client-side cho rõ; RLS đã chặn nhưng dùng filter explicit
 * thì query plan tốt hơn.
 */
export async function listPublicAnnouncements(
  client: Client = defaultClient,
): Promise<Announcement[]> {
  const { data, error } = await client
    .from("announcements")
    .select(COLUMNS)
    .eq("is_public", true)
    .order("published_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Announcement[];
}

export async function announcementsUnreadCount(
  client: Client = defaultClient,
): Promise<number> {
  const { data, error } = await client.rpc("announcements_unread_count");
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

/**
 * Đánh dấu MỘT tin là đã đọc cho user hiện tại. Idempotent: gọi lại
 * (đã đọc rồi) bỏ qua lỗi trùng khoá. No-op nếu chưa đăng nhập.
 */
export async function markAnnouncementRead(
  id: string,
  client: Client = defaultClient,
): Promise<void> {
  const { data: authData } = await client.auth.getUser();
  const uid = authData.user?.id;
  if (!uid) return;
  const { error } = await client
    .from("announcement_reads")
    .insert({ user_id: uid, announcement_id: id });
  if (error && !/duplicate|unique/i.test(error.message)) {
    throw new Error(error.message);
  }
}

export async function announcementsMarkAllRead(
  client: Client = defaultClient,
): Promise<number> {
  const { data, error } = await client.rpc("announcements_mark_all_read");
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

/**
 * Lấy id các tin user đã đọc — UI dùng để gắn cờ "đã đọc" mỗi item
 * thay vì gọi đếm tổng.
 */
export async function listMyAnnouncementReads(
  client: Client = defaultClient,
): Promise<Set<string>> {
  const { data: authData } = await client.auth.getUser();
  if (!authData.user) return new Set();
  const { data, error } = await client
    .from("announcement_reads")
    .select("announcement_id");
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.announcement_id));
}

// ─── Admin CRUD ────────────────────────────────────────────────────

export interface AnnouncementDraft {
  title: string;
  body: string;
  level: AnnouncementLevel;
  is_public: boolean;
  published_at: string | null;
  expires_at: string | null;
}

export async function createAnnouncement(
  draft: AnnouncementDraft,
  client: Client = defaultClient,
): Promise<Announcement> {
  const { data: authData } = await client.auth.getUser();
  const createdBy = authData.user?.id;
  if (!createdBy) throw new Error("Not authenticated");
  const { data, error } = await client
    .from("announcements")
    .insert({ ...draft, created_by: createdBy })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as Announcement;
}

export async function updateAnnouncement(
  id: string,
  patch: Partial<AnnouncementDraft>,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client
    .from("announcements")
    .update(patch)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteAnnouncement(
  id: string,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client.from("announcements").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
