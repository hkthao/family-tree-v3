/**
 * zalo-webhook: nhận sự kiện Zalo gửi cho Mini App — hiện chỉ xử lý
 * `user.revoke.consent` (người dùng rút lại sự đồng ý và yêu cầu xoá dữ
 * liệu sử dụng Mini App). Zalo bắt buộc khai webhook này khi gửi duyệt.
 *
 * Tài liệu: docs.zaloplatforms.com/docs/MA/openApis/open/webhook/
 *   eventRevokeAndRemoveUserData + verifysignature.
 *
 * Xác thực: header `X-ZEvent-Signature` = sha256(<giá trị các trường của
 * body, xếp theo TÊN TRƯỜNG a→z, nối liền; giá trị object thì
 * JSON.stringify> + API Key của Mini App), dạng hex. API Key lấy ở trang
 * quản lý Mini App, đặt vào biến `ZALO_MINIAPP_API_KEY` của edge function.
 * Sai chữ ký → 401, không làm gì.
 *
 * Gọi KHÔNG kèm JWT (Zalo không có phiên Supabase) — router `main` trên máy
 * self-host phải cho riêng function này đi qua (xem plan Zalo Mini App).
 *
 * Xoá những gì đến từ Zalo:
 *   • mối nối ID Zalo ↔ tài khoản (zalo_identities) và mã liên kết dở dang;
 *   • tài khoản Zalo tạm (email giả) nếu nó trống — không đứng tên dòng họ
 *     nào, không là thành viên họ nào;
 *   • còn đứng tên dữ liệu thì GIỮ tài khoản (xoá là mất cả dòng họ của
 *     người khác) nhưng gỡ tên và ảnh đại diện lấy từ Zalo.
 * Tài khoản email thật đã liên kết: chỉ gỡ mối nối, tài khoản web giữ nguyên
 * — người dùng rút đồng ý với Zalo, không phải xoá tài khoản web của mình.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

import { json } from "../_shared/cors.ts";
import { safeEqual, zaloSignature } from "../_shared/zaloSignature.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
/**
 * Khoá ký: API Key của Open APIs (mini.zalo.me/developers → Open APIs). Tài
 * liệu Zalo không nói rõ nó có trùng App Secret hay không, nên nhận chữ ký
 * khớp với BẤT KỲ khoá nào trong hai — cả hai đều là bí mật của riêng app.
 */
const SIGNING_KEYS = [Deno.env.get("ZALO_MINIAPP_API_KEY"), Deno.env.get("ZALO_APP_SECRET")].filter(
  (k): k is string => !!k,
);
/**
 * Có thì chỉ nhận sự kiện của các app này (phân tách bằng dấu phẩy) — Mini
 * App ID và ID Zalo App có thể khác nhau, khai cả hai.
 */
const APP_IDS = (Deno.env.get("ZALO_MINI_APP_ID") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, { status: 405 });
  if (SIGNING_KEYS.length === 0) {
    console.error("zalo-webhook: thiếu ZALO_MINIAPP_API_KEY / ZALO_APP_SECRET");
    return json({ error: "not configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "bad request" }, { status: 400 });
  }

  const got = (req.headers.get("x-zevent-signature") ?? "").trim().toLowerCase();
  let valid = false;
  for (const key of SIGNING_KEYS) {
    if (got && safeEqual(got, await zaloSignature(body as Record<string, unknown>, key))) valid = true;
  }
  if (!valid) {
    console.error("zalo-webhook: sai chữ ký");
    return json({ error: "invalid signature" }, { status: 401 });
  }

  const { event, appId, userId } = body as { event?: string; appId?: string; userId?: string };
  if (APP_IDS.length > 0 && !APP_IDS.includes(String(appId))) {
    console.error("zalo-webhook: sự kiện của Mini App khác:", appId);
    return json({ ok: true, ignored: "other-app" });
  }
  if (event !== "user.revoke.consent") return json({ ok: true, ignored: event ?? null });
  if (!userId) return json({ error: "missing userId" }, { status: 400 });

  const zaloId = String(userId);
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: link } = await sb
    .from("zalo_identities")
    .select("user_id")
    .eq("zalo_user_id", zaloId)
    .maybeSingle();

  const del1 = await sb.from("zalo_identities").delete().eq("zalo_user_id", zaloId);
  const del2 = await sb.from("zalo_link_codes").delete().eq("zalo_user_id", zaloId);
  if (del1.error || del2.error) {
    console.error("zalo-webhook: xoá mối nối:", del1.error?.message ?? del2.error?.message);
    // 500 để Zalo gửi lại.
    return json({ error: "server error" }, { status: 500 });
  }

  // Tài khoản Zalo tạm của ID này — kể cả khi nó không còn là tài khoản đang
  // nối (người dùng đã liên kết sang tài khoản email trước đó).
  const { data: purgeable } = await sb.rpc("zalo_purgeable_synthetic_user", { p_zalo_id: zaloId, p_keep: null });
  let action = "unlinked";
  if (purgeable) {
    const { error } = await sb.auth.admin.deleteUser(purgeable as string);
    if (error) {
      console.error("zalo-webhook: xoá tài khoản tạm:", error.message);
      return json({ error: "server error" }, { status: 500 });
    }
    action = "deleted-synthetic";
  } else {
    // Tài khoản tạm còn đứng tên dữ liệu: giữ, nhưng gỡ tên/ảnh lấy từ Zalo.
    const { data: uid } = await sb.rpc("zalo_synthetic_user_id", { p_zalo_id: zaloId });
    if (uid) {
      await sb.auth.admin.updateUserById(uid as string, {
        user_metadata: { display_name: "Người dùng đã rút đồng ý Zalo", avatar_url: null },
      });
      await sb.from("profiles").update({ display_name: "Người dùng đã rút đồng ý Zalo" }).eq("id", uid as string);
      action = "scrubbed-synthetic";
    }
  }

  console.log("zalo-webhook: revoke", zaloId, action, link ? "(was linked)" : "");
  return json({ ok: true, action });
});
