/**
 * zalo-auth: đổi mã truy cập của Zalo Mini App lấy phiên đăng nhập Supabase.
 *
 * Luồng:
 *   1. Mini App gọi `getAccessToken()` của zmp-sdk rồi POST { accessToken }.
 *   2. Ta hỏi Zalo Graph "token này là của ai" — kèm `appsecret_proof`.
 *   3. Tra/tạo tài khoản ứng với ID Zalo đó (bảng zalo_identities).
 *   4. Sinh magic link KHÔNG gửi mail, trả về `token_hash`; Mini App gọi
 *      `auth.verifyOtp` để đổi lấy phiên.
 *
 * Vì sao KHÔNG nhận thẳng ID Zalo từ client: ID là thứ ai cũng gõ được.
 * Chỉ token do chính Zalo cấp, được Zalo xác nhận lại ở phía máy chủ, mới
 * chứng minh người gọi là chủ ID đó.
 *
 * Vì sao phải có `appsecret_proof` (HMAC token bằng App Secret): không có
 * nó thì token cấp cho MỘT MINI APP KHÁC cũng hỏi Graph ra được ID, và kẻ
 * dựng Mini App lừa người dùng bấm vào sẽ cầm token đó sang đây đăng nhập.
 * Proof chỉ khớp khi token thuộc đúng app giữ secret này.
 *
 * Bảo mật: `token_hash` mạnh ngang link đặt lại mật khẩu — không ghi log.
 * verify_jwt = false vì người gọi CHƯA có phiên; cổng vào là bước 2.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

import { err, json, preflight } from "../_shared/cors.ts";
import {
  fetchZaloProfile,
  ZALO_APP_SECRET,
  ZALO_SYNTHETIC_EMAIL_DOMAIN,
} from "../_shared/zalo.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Tài khoản tạo từ Zalo không có email thật, mà auth.users bắt buộc có.
 * Dùng địa chỉ giả dưới tên miền của mình (không ai nhận thư ở đó) thay vì
 * tên miền bịa: bịa ra thì có ngày trùng tên miền thật của người khác.
 */
const syntheticEmail = (zaloId: string) =>
  `zalo-${zaloId}@${ZALO_SYNTHETIC_EMAIL_DOMAIN}`;

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return err("Method not allowed", 405);
  if (!ZALO_APP_SECRET) {
    console.error("zalo-auth: thiếu ZALO_APP_SECRET");
    return err("Đăng nhập Zalo chưa được cấu hình.", 503);
  }

  const body = await req.json().catch(() => null);
  const accessToken = body?.accessToken;
  if (typeof accessToken !== "string" || accessToken.length < 20 || accessToken.length > 4096) {
    return err("Thiếu mã truy cập Zalo.", 400);
  }

  const profile = await fetchZaloProfile(accessToken);
  if (!profile) return err("Zalo không xác nhận được phiên này. Hãy mở lại Mini App.", 401);

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Tài khoản ứng với ID Zalo này: đã nối sẵn, hoặc tạo mới.
  let email: string | null = null;
  const { data: link, error: linkErr } = await sb
    .from("zalo_identities")
    .select("user_id")
    .eq("zalo_user_id", profile.id)
    .maybeSingle();
  if (linkErr) {
    console.error("zalo-auth: đọc zalo_identities:", linkErr.message);
    return err("Lỗi máy chủ. Thử lại sau.", 500);
  }

  let isNew = false;
  if (link) {
    const { data, error } = await sb.auth.admin.getUserById(link.user_id);
    if (error || !data.user?.email) {
      console.error("zalo-auth: tài khoản đã nối không còn:", error?.message);
      return err("Tài khoản không còn tồn tại.", 409);
    }
    email = data.user.email;
  } else {
    email = syntheticEmail(profile.id);
    const { error } = await sb.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        display_name: profile.name ?? "Người dùng Zalo",
        avatar_url: profile.picture,
      },
      // app_metadata chỉ service role ghi được (user_metadata thì người
      // dùng tự đặt được lúc đăng ký) — dùng làm dấu "tài khoản này do
      // zalo-auth tạo cho đúng ID Zalo này", xem chỗ kiểm bên dưới.
      app_metadata: { provider: "zalo", zalo_user_id: profile.id },
    });
    // "Đã tồn tại" là ca hai lần mở app gần như cùng lúc: lần kia tạo
    // trước. Không phải lỗi — cứ đi tiếp, bước sinh link sẽ lấy được user.
    if (error && !/already|exists|registered/i.test(error.message)) {
      console.error("zalo-auth: tạo tài khoản:", error.message);
      return err("Không tạo được tài khoản. Thử lại sau.", 500);
    }
    isNew = !error;
  }

  const { data: gen, error: genErr } = await sb.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = gen?.properties?.hashed_token;
  if (genErr || !tokenHash || !gen.user) {
    console.error("zalo-auth: generateLink:", genErr?.message ?? "thiếu token");
    return err("Không tạo được phiên đăng nhập. Thử lại sau.", 500);
  }

  // Chặn chiếm trước: địa chỉ giả đoán được từ ID Zalo, nên kẻ xấu có thể
  // tự ĐĂNG KÝ tài khoản mang đúng địa chỉ đó (kèm mật khẩu của hắn) trước
  // khi nạn nhân mở Mini App lần đầu. Nếu cứ thế nối vào thì nạn nhân dùng
  // chung tài khoản với kẻ đang giữ mật khẩu. Chỉ nối khi tài khoản mang
  // dấu app_metadata do chính hàm này đặt.
  if (!link && gen.user.app_metadata?.zalo_user_id !== profile.id) {
    console.error("zalo-auth: địa chỉ giả đã bị tài khoản khác chiếm:", gen.user.id);
    return err("Không đăng nhập được bằng Zalo. Vui lòng liên hệ hỗ trợ.", 409);
  }

  const { error: upErr } = await sb.from("zalo_identities").upsert(
    {
      zalo_user_id: profile.id,
      user_id: gen.user.id,
      last_login_at: new Date().toISOString(),
    },
    { onConflict: "zalo_user_id" },
  );
  if (upErr) {
    console.error("zalo-auth: ghi zalo_identities:", upErr.message);
    return err("Lỗi máy chủ. Thử lại sau.", 500);
  }

  return json({ tokenHash, isNew });
});
