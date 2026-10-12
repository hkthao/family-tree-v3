/**
 * zalo-link: gắn ID Zalo vào một tài khoản SẴN CÓ (đăng ký bằng email).
 *
 * Hai bước, mỗi bước đều phải kèm access token Zalo còn hiệu lực:
 *   { action: "request", accessToken, email } → gửi mã 6 số tới email đó.
 *   { action: "confirm", accessToken, code }  → đúng mã thì trỏ ID Zalo sang
 *                                               tài khoản kia, trả token_hash
 *                                               để Mini App đổi phiên.
 *
 * Phải chứng minh CẢ HAI: là chủ ID Zalo (token) và đọc được hộp thư của
 * tài khoản đích (mã). Thiếu một trong hai là chiếm được tài khoản người
 * khác chỉ bằng cách biết email của họ.
 *
 * "request" luôn trả ok dù email có tài khoản hay không — nếu trả khác nhau
 * thì hàm này thành công cụ dò xem ai đã đăng ký.
 *
 * Tài khoản Zalo tạm (email giả) được xoá ngay sau khi liên kết NẾU nó
 * trống (không sở hữu / không tham gia dòng họ nào); có dữ liệu đứng tên
 * thì giữ lại, vì xoá là mất theo. Hành động "forget" dọn nốt phần còn sót
 * sau khi người dùng tự xoá tài khoản.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

import { err, json, preflight } from "../_shared/cors.ts";
import { encodeSubject } from "../_shared/mail.ts";
import { fetchZaloProfile, hmacSha256Hex, ZALO_APP_SECRET } from "../_shared/zalo.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SMTP_HOST = Deno.env.get("SMTP_HOST") ?? "";
const SMTP_PORT = Number(Deno.env.get("SMTP_PORT") ?? "465");
const SMTP_USER = Deno.env.get("SMTP_USER") ?? "";
const SMTP_PASS = Deno.env.get("SMTP_PASS") ?? "";
const MAIL_FROM =
  Deno.env.get("SMTP_SENDER_NAME") && Deno.env.get("SMTP_ADMIN_EMAIL")
    ? `${Deno.env.get("SMTP_SENDER_NAME")} <${Deno.env.get("SMTP_ADMIN_EMAIL")}>`
    : "Dòng Họ Việt <noreply@giapha.local>";

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_WAIT_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

/** Băm mã kèm ID Zalo, có "tiêu" là App Secret: lộ bảng cũng không dò ra mã. */
const hashCode = (zaloId: string, code: string) =>
  hmacSha256Hex(ZALO_APP_SECRET, `link:${zaloId}:${code}`);

function sixDigits(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, "0");
}

/**
 * Xoá tài khoản Zalo tạm còn sót của một ID Zalo, nếu được phép (xem hàm SQL
 * `zalo_purgeable_synthetic_user`: đúng do zalo-auth tạo, không đứng tên dữ
 * liệu nào, không phải tài khoản đang giữ). Hỏng thì chỉ ghi log — đây là
 * việc dọn dẹp, không được làm hỏng thao tác chính của người dùng.
 */
// deno-lint-ignore no-explicit-any
async function purgeSynthetic(sb: any, zaloId: string, keep: string | null): Promise<boolean> {
  const { data: id, error } = await sb.rpc("zalo_purgeable_synthetic_user", {
    p_zalo_id: zaloId,
    p_keep: keep,
  });
  if (error) {
    console.error("zalo-link: tra tài khoản tạm:", error.message);
    return false;
  }
  if (!id) return false;
  const { error: delErr } = await sb.auth.admin.deleteUser(id);
  if (delErr) {
    console.error("zalo-link: xoá tài khoản tạm:", delErr.message);
    return false;
  }
  return true;
}

async function sendCode(to: string, code: string): Promise<boolean> {
  if (!SMTP_HOST || !SMTP_PASS) {
    console.error("zalo-link: thiếu cấu hình SMTP");
    return false;
  }
  const client = new SMTPClient({
    connection: {
      hostname: SMTP_HOST,
      port: SMTP_PORT,
      tls: SMTP_PORT === 465,
      auth: { username: SMTP_USER, password: SMTP_PASS },
    },
  });
  try {
    await client.send({
      from: MAIL_FROM,
      to,
      subject: encodeSubject(`${code} là mã liên kết Zalo của bạn`),
      content: "auto",
      html:
        `<p>Mã liên kết tài khoản Dòng Họ Việt với Zalo của bạn:</p>` +
        `<p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p>` +
        `<p>Mã có hiệu lực trong 10 phút. Nếu bạn không yêu cầu, hãy bỏ qua thư này — ` +
        `không ai vào được tài khoản của bạn nếu không có mã.</p>`,
    });
    return true;
  } catch (e) {
    console.error("zalo-link: gửi mail lỗi:", (e as Error).message);
    return false;
  } finally {
    try {
      await client.close();
    } catch { /* kết nối đã đóng */ }
  }
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return err("Method not allowed", 405);
  if (!ZALO_APP_SECRET) return err("Đăng nhập Zalo chưa được cấu hình.", 503);

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

  // ─── Bước 1: xin mã ───────────────────────────────────────────────
  if (body.action === "request") {
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return err("Email không hợp lệ.", 400);
    }

    const { data: pending } = await sb
      .from("zalo_link_codes")
      .select("created_at")
      .eq("zalo_user_id", profile.id)
      .maybeSingle();
    if (pending && Date.now() - new Date(pending.created_at).getTime() < RESEND_WAIT_MS) {
      return err("Vừa gửi mã xong. Đợi một phút rồi thử lại.", 429);
    }

    const { data: userId, error: findErr } = await sb.rpc("zalo_find_user_id_by_email", {
      p_email: email,
    });
    if (findErr) {
      console.error("zalo-link: tra email:", findErr.message);
      return err("Lỗi máy chủ. Thử lại sau.", 500);
    }

    if (userId) {
      // Tài khoản đích đã gắn một Zalo KHÁC thì không gửi mã (vẫn trả ok).
      const { data: taken } = await sb
        .from("zalo_identities")
        .select("zalo_user_id")
        .eq("user_id", userId)
        .neq("zalo_user_id", profile.id)
        .maybeSingle();
      if (!taken) {
        const code = sixDigits();
        const { error: upErr } = await sb.from("zalo_link_codes").upsert(
          {
            zalo_user_id: profile.id,
            user_id: userId,
            code_hash: await hashCode(profile.id, code),
            attempts: 0,
            expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
            created_at: new Date().toISOString(),
          },
          { onConflict: "zalo_user_id" },
        );
        if (upErr) {
          console.error("zalo-link: lưu mã:", upErr.message);
          return err("Lỗi máy chủ. Thử lại sau.", 500);
        }
        await sendCode(email, code);
      }
    }
    return json({ ok: true });
  }

  // ─── Bước 2: xác nhận mã ──────────────────────────────────────────
  if (body.action === "confirm") {
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!/^\d{6}$/.test(code)) return err("Mã gồm 6 chữ số.", 400);

    const { data: row } = await sb
      .from("zalo_link_codes")
      .select("user_id, code_hash, attempts, expires_at")
      .eq("zalo_user_id", profile.id)
      .maybeSingle();
    const bad = () => err("Mã không đúng hoặc đã hết hạn.", 400);
    if (!row || new Date(row.expires_at).getTime() < Date.now()) return bad();
    if (row.attempts >= MAX_ATTEMPTS) {
      await sb.from("zalo_link_codes").delete().eq("zalo_user_id", profile.id);
      return err("Nhập sai quá nhiều lần. Hãy xin mã mới.", 429);
    }
    if ((await hashCode(profile.id, code)) !== row.code_hash) {
      await sb
        .from("zalo_link_codes")
        .update({ attempts: row.attempts + 1 })
        .eq("zalo_user_id", profile.id);
      return bad();
    }

    const { data: target, error: userErr } = await sb.auth.admin.getUserById(row.user_id);
    if (userErr || !target.user?.email) return err("Tài khoản không còn tồn tại.", 409);

    const { error: linkErr } = await sb.from("zalo_identities").upsert(
      {
        zalo_user_id: profile.id,
        user_id: row.user_id,
        last_login_at: new Date().toISOString(),
      },
      { onConflict: "zalo_user_id" },
    );
    if (linkErr) {
      // unique(user_id): tài khoản đích vừa được gắn một Zalo khác.
      console.error("zalo-link: gắn tài khoản:", linkErr.message);
      return err("Tài khoản này đã liên kết với một Zalo khác.", 409);
    }
    await sb.from("zalo_link_codes").delete().eq("zalo_user_id", profile.id);
    // Tài khoản tạm giờ không còn đường đăng nhập: xoá luôn nếu nó trống.
    await purgeSynthetic(sb, profile.id, row.user_id);

    const { data: gen, error: genErr } = await sb.auth.admin.generateLink({
      type: "magiclink",
      email: target.user.email,
    });
    const tokenHash = gen?.properties?.hashed_token;
    if (genErr || !tokenHash) {
      console.error("zalo-link: generateLink:", genErr?.message ?? "thiếu token");
      return err("Đã liên kết, nhưng chưa đăng nhập được. Hãy mở lại Mini App.", 500);
    }
    return json({ tokenHash });
  }

  // ─── Dọn sau khi XOÁ TÀI KHOẢN ────────────────────────────────────
  // Mini App gọi ngay sau khi người dùng tự xoá tài khoản. Chỉ dọn khi ID
  // Zalo này KHÔNG còn nối với tài khoản nào — tức việc xoá đã thật sự xảy
  // ra; nếu còn nối thì từ chối, kẻo ai cầm token cũng gọi được để xoá.
  if (body.action === "forget") {
    const { data: still } = await sb
      .from("zalo_identities")
      .select("user_id")
      .eq("zalo_user_id", profile.id)
      .maybeSingle();
    if (still) return err("Tài khoản vẫn còn. Hãy xoá tài khoản trước.", 409);
    return json({ purged: await purgeSynthetic(sb, profile.id, null) });
  }

  return err("Yêu cầu không hợp lệ.", 400);
});
