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

import {
  decryptSecret,
  encryptSecret,
  hintOf,
} from "../_shared/llm/crypto.ts";
import { toEpisode, type FbVideo } from "./parse.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_TOKEN = Deno.env.get("CRON_TOKEN") ?? "";
// Giữ lại đường env làm ĐƯỜNG LUI: nếu admin chưa cắm token trong app,
// hoặc KEK đổi làm bản mã thành rác, thì vẫn còn cách chạy được.
const ENV_PAGE_ID = Deno.env.get("FB_PAGE_ID") ?? "";
const ENV_PAGE_TOKEN = Deno.env.get("FB_PAGE_TOKEN") ?? "";
const FB_API_VERSION = Deno.env.get("FB_API_VERSION") ?? "v21.0";
/** Số tập xin trong MỖI TRANG kết quả của Facebook. */
const PAGE_SIZE = Number(Deno.env.get("FB_SYNC_LIMIT") ?? "50");
/** Trần tổng số tập kéo về một lần chạy — chặn vòng lặp chạy mãi. */
const MAX_TOTAL = Number(Deno.env.get("FB_SYNC_MAX") ?? "500");

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

  const body = await req.json().catch(() => ({}));
  const action = (body as { action?: string }).action ?? "sync";

  // ─── connect: đổi token ngắn sang token dài rồi lưu ───────────────
  //
  // Admin dán token ngắn từ Graph API Explorer (sống 1–2 giờ) cùng app id
  // + app secret. Ở đây đổi sang user token 60 ngày, rồi lấy Page token —
  // Page token sinh từ user token dài hạn thì gần như không hết hạn.
  //
  // App Secret KHÔNG được lưu lại: nó chỉ cần cho đúng lần đổi này.
  if (action === "connect") {
    const { appId, appSecret, userToken, pageId } = body as {
      appId?: string;
      appSecret?: string;
      userToken?: string;
      pageId?: string;
    };
    if (!appId || !appSecret || !userToken) {
      return json(
        { error: "Cần đủ App ID, App Secret và token người dùng" },
        { status: 400 },
      );
    }

    const exchangeUrl =
      `https://graph.facebook.com/${FB_API_VERSION}/oauth/access_token` +
      `?grant_type=fb_exchange_token&client_id=${encodeURIComponent(appId)}` +
      `&client_secret=${encodeURIComponent(appSecret)}` +
      `&fb_exchange_token=${encodeURIComponent(userToken)}`;
    const exRes = await fetch(exchangeUrl);
    const exJson = await exRes.json();
    if (exJson.error) {
      return json(
        { error: `Không đổi được token dài hạn: ${exJson.error.message}` },
        { status: 400 },
      );
    }
    const longUserToken = exJson.access_token as string;

    const pagesRes = await fetch(
      `https://graph.facebook.com/${FB_API_VERSION}/me/accounts` +
        `?fields=id,name,access_token&access_token=${encodeURIComponent(longUserToken)}`,
    );
    const pagesJson = await pagesRes.json();
    if (pagesJson.error) {
      return json(
        { error: `Không đọc được danh sách Trang: ${pagesJson.error.message}` },
        { status: 400 },
      );
    }
    const pages = (pagesJson.data ?? []) as {
      id: string;
      name: string;
      access_token: string;
    }[];

    // Chưa chọn Trang → trả danh sách cho admin chọn. KHÔNG trả token.
    if (!pageId) {
      return json({
        needPage: true,
        pages: pages.map((p) => ({ id: p.id, name: p.name })),
      });
    }

    const picked = pages.find((p) => p.id === pageId);
    if (!picked) {
      return json(
        { error: "Tài khoản này không quản lý Trang vừa chọn" },
        { status: 400 },
      );
    }

    // Hỏi Facebook xem token vừa lấy sống tới bao giờ, thay vì tin lời đồn.
    let expiresAt: string | null = null;
    try {
      const dbg = await fetch(
        `https://graph.facebook.com/${FB_API_VERSION}/debug_token` +
          `?input_token=${encodeURIComponent(picked.access_token)}` +
          `&access_token=${encodeURIComponent(longUserToken)}`,
      ).then((r) => r.json());
      const exp = dbg?.data?.expires_at as number | undefined;
      expiresAt = exp ? new Date(exp * 1000).toISOString() : null;
    } catch {
      // Không tra được thì thôi, coi như không biết hạn — không phải lý do
      // để chặn cả việc kết nối.
    }

    const uid = (await admin.auth.getUser(authHeader.replace("Bearer ", "")))
      .data.user?.id ?? null;

    const { error: upErr } = await admin.from("fb_page_credentials").upsert(
      {
        page_id: picked.id,
        page_name: picked.name,
        ciphertext: await encryptSecret(picked.access_token),
        hint: hintOf(picked.access_token),
        token_expires_at: expiresAt,
        is_active: true,
        updated_at: new Date().toISOString(),
        updated_by: uid,
        last_check_at: new Date().toISOString(),
        last_check_ok: true,
        last_check_error: null,
      },
      { onConflict: "page_id" },
    );
    if (upErr) return json({ error: upErr.message }, { status: 500 });

    // Mỗi lần chỉ một Trang đang dùng — tắt các Trang cũ.
    await admin
      .from("fb_page_credentials")
      .update({ is_active: false })
      .neq("page_id", picked.id);

    return json({
      ok: true,
      pageId: picked.id,
      pageName: picked.name,
      expiresAt,
    });
  }

  // ─── Lấy cấu hình đang dùng ──────────────────────────────────────
  const { data: cred } = await admin
    .from("fb_page_credentials")
    .select("page_id, page_name, ciphertext")
    .eq("is_active", true)
    .maybeSingle();

  let pageId = ENV_PAGE_ID;
  let pageToken = ENV_PAGE_TOKEN;
  if (cred) {
    try {
      pageToken = await decryptSecret(cred.ciphertext);
      pageId = cred.page_id;
    } catch (e) {
      const msg = `Không giải mã được token đã lưu: ${(e as Error).message}`;
      await noteError(msg);
      return json({ error: msg }, { status: 500 });
    }
  }

  if (!pageId || !pageToken) {
    const msg =
      "Chưa nối Trang Facebook. Vào Quản trị › Podcast để kết nối, hoặc đặt FB_PAGE_ID / FB_PAGE_TOKEN.";
    await noteError(msg);
    return json({ error: msg }, { status: 400 });
  }

  // ─── check: token còn sống không ─────────────────────────────────
  if (action === "check") {
    const res = await fetch(
      `https://graph.facebook.com/${FB_API_VERSION}/${pageId}` +
        `?fields=name&access_token=${encodeURIComponent(pageToken)}`,
    );
    const info = await res.json();
    const ok = !info.error;
    await admin
      .from("fb_page_credentials")
      .update({
        last_check_at: new Date().toISOString(),
        last_check_ok: ok,
        last_check_error: ok ? null : (info.error?.message ?? "Lỗi không rõ"),
        page_name: ok ? info.name : undefined,
      })
      .eq("page_id", pageId);
    return json(
      ok
        ? { ok: true, pageName: info.name }
        : { error: info.error?.message ?? "Token không dùng được" },
      { status: ok ? 200 : 400 },
    );
  }

  // ─── sync ────────────────────────────────────────────────────────
  const fields =
    "id,description,created_time,permalink_url,picture,length," +
    "thumbnails{uri,width,height,is_preferred}";

  /**
   * Facebook trả kết quả THEO TRANG, mỗi trang kèm con trỏ `paging.next`.
   * Lấy một trang rồi dừng là chỉ thấy vài tập mới nhất — Trang có hơn
   * trăm video thì mất gần hết. Đi hết con trỏ, chặn bằng trần để không
   * có chuyện chạy mãi nếu Facebook trả con trỏ vòng.
   */
  const videos: FbVideo[] = [];
  let next: string | null =
    `https://graph.facebook.com/${FB_API_VERSION}/${pageId}/videos` +
    `?fields=${encodeURIComponent(fields)}&limit=${PAGE_SIZE}` +
    `&access_token=${encodeURIComponent(pageToken)}`;
  let pages = 0;

  while (next && videos.length < MAX_TOTAL) {
    let payload: {
      data?: FbVideo[];
      paging?: { next?: string };
      error?: { message?: string; code?: number };
    };
    try {
      const res = await fetch(next);
      payload = await res.json();
    } catch (e) {
      const msg = `Không gọi được Facebook: ${(e as Error).message}`;
      await noteError(msg);
      return json({ error: msg }, { status: 502 });
    }

    if (payload.error) {
      // Token chết thường rơi vào đây (mã 190). Ghi lại để trang quản trị
      // bật đèn đỏ — nếu không thì app cứ im lặng không có tập mới, và
      // vài tháng sau mới có người để ý.
      const msg = `Facebook trả lỗi ${payload.error.code}: ${payload.error.message}`;
      await noteError(msg);
      await admin
        .from("fb_page_credentials")
        .update({
          last_check_at: new Date().toISOString(),
          last_check_ok: false,
          last_check_error: msg,
        })
        .eq("page_id", pageId);
      return json({ error: msg }, { status: 502 });
    }

    const batch = payload.data ?? [];
    videos.push(...batch);
    pages++;
    // Trang rỗng cũng là hết — đừng tin mỗi con trỏ.
    next = batch.length > 0 ? (payload.paging?.next ?? null) : null;
  }

  const syncedAt = new Date().toISOString();
  const rows = videos
    .slice(0, MAX_TOTAL)
    .map((v) => ({ ...toEpisode(v), synced_at: syncedAt }));

  // Đọc MỘT LẦN những gì đã có, thay vì mỗi tập một lượt hỏi đáp: hơn
  // trăm tập là hơn hai trăm lượt gọi cơ sở dữ liệu, đủ để hàm hết giờ
  // giữa chừng và bỏ dở công việc.
  const { data: existingRows } = await admin
    .from("podcast_episodes")
    .select("fb_video_id, title_edited");
  const existing = new Map(
    (existingRows ?? []).map((r) => [r.fb_video_id, r.title_edited]),
  );

  const fresh = rows.filter((r) => !existing.has(r.fb_video_id));
  // Admin đã sửa tiêu đề thì giữ nguyên — đồng bộ không được xoá công sức
  // biên tập của người ta. Những tập đó cập nhật mọi cột TRỪ tiêu đề.
  const keepTitle = rows.filter((r) => existing.get(r.fb_video_id) === true);
  const refresh = rows.filter((r) => existing.get(r.fb_video_id) === false);

  const problems: string[] = [];
  const write = async (
    batch: Record<string, unknown>[],
    label: string,
  ): Promise<void> => {
    if (batch.length === 0) return;
    const { error } = await admin
      .from("podcast_episodes")
      .upsert(batch, { onConflict: "fb_video_id" });
    if (error) problems.push(`${label}: ${error.message}`);
  };

  await write(fresh, "thêm mới");
  await write(refresh, "cập nhật");

  // Nhóm giữ tiêu đề phải UPDATE thật, không upsert được: upsert vẫn dựng
  // một dòng để chèn thử, mà dòng đó thiếu `title` nên vướng ràng buộc
  // NOT NULL — dù bản ghi đã tồn tại và ta chỉ định sửa vài cột.
  // Số này nhỏ (chỉ những tập admin đã sửa tay) nên chạy từng dòng không
  // đáng lo.
  for (const { title: _title, ...rest } of keepTitle) {
    const { error } = await admin
      .from("podcast_episodes")
      .update(rest)
      .eq("fb_video_id", rest.fb_video_id);
    if (error) problems.push(`giữ tiêu đề: ${error.message}`);
  }

  if (problems.length > 0) {
    const msg = problems.join(" | ");
    await noteError(msg);
    return json({ error: msg }, { status: 500 });
  }

  const now = syncedAt;
  await admin.from("platform_settings").upsert(
    [
      { key: "podcast.last_sync_at", value: JSON.stringify(now) },
      { key: "podcast.last_sync_error", value: JSON.stringify("") },
    ],
    { onConflict: "key" },
  );

  return json({
    ok: true,
    pages,
    fetched: videos.length,
    inserted: fresh.length,
    updated: refresh.length + keepTitle.length,
    at: now,
  });
});
