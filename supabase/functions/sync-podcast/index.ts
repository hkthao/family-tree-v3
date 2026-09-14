/**
 * sync-podcast: kéo danh sách tập podcast từ Trang Facebook về bảng
 * `podcast_episodes`.
 *
 * Vì sao phải đồng bộ chứ không gọi thẳng Facebook từ trình duyệt:
 *   1. Token Facebook phải nằm ở máy chủ. Đưa ra trình duyệt là cho không
 *      cả cái Trang.
 *   2. Mỗi lượt mở trang mà gọi Graph API là ăn giới hạn tần suất của Meta.
 *   3. Meta đổi API hay token chết thì app vẫn còn danh sách cũ, thay vì
 *      trắng trang — và kiểu hỏng này của Facebook là hỏng ÂM THẦM.
 *
 * Đọc qua `/{page-id}/videos`: đã đo trên Trang thật, reel nằm trong đây
 * với đủ id, mô tả, thời điểm đăng, link và ảnh bìa. (`/{page-id}/video_reels`
 * chỉ để ĐĂNG, Meta không cho đọc; `/feed` cũng ra nhưng lẫn cả bài chữ.)
 *
 * Trigger: cron POST kèm X-Cron-Token, hoặc admin bấm "Đồng bộ ngay" trong
 * trang quản trị (gửi kèm JWT của admin).
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

import { toEpisode, type FbVideo } from "./parse.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_TOKEN = Deno.env.get("CRON_TOKEN") ?? "";
const FB_PAGE_ID = Deno.env.get("FB_PAGE_ID") ?? "";
const FB_PAGE_TOKEN = Deno.env.get("FB_PAGE_TOKEN") ?? "";
const FB_API_VERSION = Deno.env.get("FB_API_VERSION") ?? "v21.0";
/** Số tập kéo mỗi lần. Tập cũ đã nằm trong bảng rồi, không cần kéo lại hết. */
const LIMIT = Number(Deno.env.get("FB_SYNC_LIMIT") ?? "25");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...CORS, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // Hai đường gọi: cron (token riêng) hoặc admin bấm tay (JWT).
  const byCron = CRON_TOKEN && req.headers.get("X-Cron-Token") === CRON_TOKEN;
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!byCron && !authHeader) {
    return json({ error: "Thiếu xác thực" }, { status: 401 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  if (!byCron) {
    // Gọi tay → phải là platform admin, đừng để ai cũng bắt máy chủ đi
    // gọi Facebook hộ.
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData } = await admin.auth.getUser(jwt);
    const uid = userData?.user?.id;
    if (!uid) return json({ error: "Phiên không hợp lệ" }, { status: 401 });
    const { data: profile } = await admin
      .from("profiles")
      .select("is_platform_admin")
      .eq("id", uid)
      .maybeSingle();
    if (!profile?.is_platform_admin) {
      return json({ error: "Chỉ quản trị nền tảng" }, { status: 403 });
    }
  }

  const noteError = async (message: string) => {
    await admin
      .from("platform_settings")
      .upsert(
        { key: "podcast.last_sync_error", value: JSON.stringify(message) },
        { onConflict: "key" },
      );
  };

  if (!FB_PAGE_ID || !FB_PAGE_TOKEN) {
    const msg = "Chưa cấu hình FB_PAGE_ID / FB_PAGE_TOKEN";
    await noteError(msg);
    return json({ error: msg }, { status: 500 });
  }

  const fields = "id,description,created_time,permalink_url,picture,length";
  const url =
    `https://graph.facebook.com/${FB_API_VERSION}/${FB_PAGE_ID}/videos` +
    `?fields=${fields}&limit=${LIMIT}&access_token=${encodeURIComponent(FB_PAGE_TOKEN)}`;

  let payload: { data?: FbVideo[]; error?: { message?: string; code?: number } };
  try {
    const res = await fetch(url);
    payload = await res.json();
  } catch (e) {
    const msg = `Không gọi được Facebook: ${(e as Error).message}`;
    await noteError(msg);
    return json({ error: msg }, { status: 502 });
  }

  if (payload.error) {
    // Token chết thường rơi vào đây (mã 190). Ghi lại để trang quản trị
    // bật đèn đỏ — nếu không thì app cứ im lặng không có tập mới, và vài
    // tháng sau mới có người để ý.
    const msg = `Facebook trả lỗi ${payload.error.code}: ${payload.error.message}`;
    await noteError(msg);
    return json({ error: msg }, { status: 502 });
  }

  const videos = payload.data ?? [];
  const rows = videos.map((v) => ({
    ...toEpisode(v),
    synced_at: new Date().toISOString(),
  }));

  let inserted = 0;
  let updated = 0;
  for (const row of rows) {
    const { data: existing } = await admin
      .from("podcast_episodes")
      .select("id, title_edited")
      .eq("fb_video_id", row.fb_video_id)
      .maybeSingle();

    if (!existing) {
      const { error } = await admin.from("podcast_episodes").insert(row);
      if (!error) inserted++;
      continue;
    }
    // Admin đã sửa tiêu đề thì giữ nguyên — đồng bộ không được xoá công
    // sức biên tập của người ta.
    const { title: _title, ...withoutTitle } = row;
    const { error } = await admin
      .from("podcast_episodes")
      .update(existing.title_edited ? withoutTitle : row)
      .eq("id", existing.id);
    if (!error) updated++;
  }

  const now = new Date().toISOString();
  await admin.from("platform_settings").upsert(
    [
      { key: "podcast.last_sync_at", value: JSON.stringify(now) },
      { key: "podcast.last_sync_error", value: JSON.stringify("") },
    ],
    { onConflict: "key" },
  );

  return json({ ok: true, fetched: videos.length, inserted, updated, at: now });
});
