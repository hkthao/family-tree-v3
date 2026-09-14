import { supabase as defaultClient } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

/**
 * Podcast — các tập lấy từ Trang Facebook của nền tảng.
 *
 * Đọc thẳng từ bảng đã đồng bộ, KHÔNG gọi Facebook từ trình duyệt: token
 * nằm ở máy chủ, và Meta tính giới hạn tần suất theo app chứ không theo
 * người dùng — mỗi lượt mở trang mà gọi thẳng thì đông người là chết.
 */

export interface PodcastEpisode {
  id: string;
  fb_video_id: string;
  title: string;
  description: string | null;
  permalink_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  published_at: string;
  is_visible: boolean;
  title_edited: boolean;
  synced_at: string;
}

const COLS =
  "id, fb_video_id, title, description, permalink_url, thumbnail_url, duration_seconds, published_at, is_visible, title_edited, synced_at";

/** Danh sách cho người xem: chỉ tập đang hiện, mới nhất trước. */
export async function listPodcastEpisodes(
  limit = 50,
  client: Client = defaultClient,
): Promise<PodcastEpisode[]> {
  const { data, error } = await client
    .from("podcast_episodes")
    .select(COLS)
    .eq("is_visible", true)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as PodcastEpisode[];
}

/** Danh sách cho quản trị: gồm cả tập đã ẩn. */
export async function listAllPodcastEpisodes(
  client: Client = defaultClient,
): Promise<PodcastEpisode[]> {
  const { data, error } = await client
    .from("podcast_episodes")
    .select(COLS)
    .order("published_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as PodcastEpisode[];
}

/**
 * Sửa tập. Đổi tiêu đề thì đánh dấu `title_edited` để lần đồng bộ sau
 * không ghi đè — biên tập lại tiêu đề mà bị máy xoá thì không ai buồn sửa
 * lần thứ hai.
 */
export async function updatePodcastEpisode(
  id: string,
  patch: { title?: string; is_visible?: boolean },
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client
    .from("podcast_episodes")
    .update({
      ...patch,
      ...(patch.title !== undefined ? { title_edited: true } : {}),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export interface PodcastSyncResult {
  fetched: number;
  inserted: number;
  updated: number;
  at: string;
}

/** Bấm "Đồng bộ ngay" — gọi edge function bằng JWT của admin. */
export async function syncPodcastNow(
  client: Client = defaultClient,
): Promise<PodcastSyncResult> {
  const { data, error } = await client.functions.invoke("sync-podcast", {
    body: {},
  });
  if (error) throw new Error(error.message);
  const res = data as PodcastSyncResult & { error?: string };
  if (res.error) throw new Error(res.error);
  return res;
}

/** Mốc đồng bộ gần nhất + lỗi gần nhất, để trang quản trị bật đèn đỏ. */
export async function getPodcastSyncStatus(
  client: Client = defaultClient,
): Promise<{ lastSyncAt: string | null; lastError: string | null }> {
  const { data, error } = await client
    .from("platform_settings")
    .select("key, value")
    .in("key", ["podcast.last_sync_at", "podcast.last_sync_error"]);
  if (error) throw new Error(error.message);
  const read = (key: string): string | null => {
    const raw = (data ?? []).find((r) => r.key === key)?.value ?? null;
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as string;
      return parsed || null;
    } catch {
      return raw || null;
    }
  };
  return {
    lastSyncAt: read("podcast.last_sync_at"),
    lastError: read("podcast.last_sync_error"),
  };
}

/**
 * Link nhúng chính thức của Facebook.
 *
 * Chỉ tạo khi người dùng BẤM XEM, không nhúng sẵn khi mở trang: iframe này
 * kéo theo mã theo dõi của Meta, mà người vào app đọc gia phả thì không
 * ngờ mình đang bị Facebook ghi nhận.
 */
export function facebookEmbedUrl(permalinkUrl: string): string {
  const href = encodeURIComponent(permalinkUrl);
  return `https://www.facebook.com/plugins/video.php?href=${href}&show_text=false&t=0`;
}

/** "14:07" — để người nghe biết tập dài bao lâu trước khi bấm. */
export function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}


// ───────── Kết nối Facebook (chỉ quản trị) ──────────────────────────

export interface FbCredentialStatus {
  page_id: string;
  page_name: string | null;
  hint: string;
  token_expires_at: string | null;
  is_active: boolean;
  updated_at: string;
  last_check_at: string | null;
  last_check_ok: boolean | null;
  last_check_error: string | null;
}

/**
 * Trạng thái Trang đã nối.
 *
 * Trả về METADATA, không bao giờ trả token: bảng token không có RLS policy
 * nào nên PostgREST không đọc nổi, còn hàm này (security definer) chỉ lấy
 * đúng phần admin cần để biết "đã nối chưa, còn sống không".
 */
export async function getFbCredentialStatus(
  client: Client = defaultClient,
): Promise<FbCredentialStatus[]> {
  const { data, error } = await client.rpc("fb_page_credentials_status");
  if (error) throw new Error(error.message);
  return (data ?? []) as FbCredentialStatus[];
}

export interface ConnectResult {
  ok?: boolean;
  needPage?: boolean;
  pages?: { id: string; name: string }[];
  pageId?: string;
  pageName?: string;
  expiresAt?: string | null;
}

/**
 * Nối Trang: gửi App ID + App Secret + token ngắn cho edge function, nó đổi
 * sang token dài rồi lưu bản mã.
 *
 * App Secret chỉ đi qua một lần và KHÔNG được lưu lại ở đâu cả — nó chỉ cần
 * cho đúng lần đổi token này.
 *
 * Không truyền `pageId` thì hàm trả về danh sách Trang để chọn.
 */
export async function connectFacebookPage(
  input: {
    appId: string;
    appSecret: string;
    userToken: string;
    pageId?: string;
  },
  client: Client = defaultClient,
): Promise<ConnectResult> {
  const { data, error } = await client.functions.invoke("sync-podcast", {
    body: { action: "connect", ...input },
  });
  if (error) throw new Error(error.message);
  const res = data as ConnectResult & { error?: string };
  if (res.error) throw new Error(res.error);
  return res;
}

/** Gọi Facebook một phát để xem token còn dùng được không. */
export async function checkFacebookConnection(
  client: Client = defaultClient,
): Promise<{ pageName: string }> {
  const { data, error } = await client.functions.invoke("sync-podcast", {
    body: { action: "check" },
  });
  if (error) throw new Error(error.message);
  const res = data as { ok?: boolean; pageName?: string; error?: string };
  if (res.error || !res.ok) throw new Error(res.error ?? "Token không dùng được");
  return { pageName: res.pageName ?? "" };
}
