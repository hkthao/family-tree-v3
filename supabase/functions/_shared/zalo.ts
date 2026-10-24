/**
 * Xác nhận mã truy cập của Zalo Mini App — dùng chung cho `zalo-auth` (đăng
 * nhập) và `zalo-link` (liên kết tài khoản sẵn có).
 *
 * Vì sao KHÔNG nhận thẳng ID Zalo từ client: ID là thứ ai cũng gõ được. Chỉ
 * token do chính Zalo cấp, được Zalo xác nhận lại ở phía máy chủ, mới chứng
 * minh người gọi là chủ ID đó.
 *
 * Vì sao phải có `appsecret_proof` (HMAC token bằng App Secret): không có nó
 * thì token cấp cho MỘT MINI APP KHÁC cũng hỏi Graph ra được ID, và kẻ dựng
 * Mini App lừa người dùng bấm vào sẽ cầm token đó sang đây đăng nhập. Proof
 * chỉ khớp khi token thuộc đúng app giữ secret này.
 */

export const ZALO_APP_SECRET = Deno.env.get("ZALO_APP_SECRET") ?? "";

// Để ở mail.ts (không đụng Deno.env) cho test chạy được trên Node.
export { ZALO_SYNTHETIC_EMAIL_DOMAIN } from "./mail.ts";

export async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(message));
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface ZaloProfile {
  id: string;
  name: string | null;
  picture: string | null;
}

/**
 * Zalo Graph CHỈ trả thông tin người dùng cho máy chủ có IP trong Việt Nam
 * (lỗi -501 "IP address not inside Vietnam" — kể cả khi chỉ xin ID). Máy
 * Supabase đặt ở nước ngoài, nên khi có cấu hình thì gọi vòng qua máy chủ
 * web (ở VN): nginx bên đó chuyển tiếp đúng một đường /me và đòi khoá chung.
 * Tên header đổi sang dạng X-… vì nginx bỏ header có dấu gạch dưới.
 */
const GRAPH_PROXY_URL = Deno.env.get("ZALO_GRAPH_PROXY_URL") ?? "";
const GRAPH_PROXY_KEY = Deno.env.get("ZALO_GRAPH_PROXY_KEY") ?? "";

async function callGraph(accessToken: string, fields: string) {
  const proof = await hmacSha256Hex(ZALO_APP_SECRET, accessToken);
  const res = GRAPH_PROXY_URL
    ? await fetch(`${GRAPH_PROXY_URL}?fields=${fields}`, {
        headers: {
          "X-Zalo-Proxy-Key": GRAPH_PROXY_KEY,
          "X-Zalo-Access-Token": accessToken,
          "X-Zalo-Appsecret-Proof": proof,
        },
      })
    : await fetch(`https://graph.zalo.me/v2.0/me?fields=${fields}`, {
        headers: { access_token: accessToken, appsecret_proof: proof },
      });
  const body = await res.json().catch(() => null);
  return { res, body };
}

export async function fetchZaloProfile(accessToken: string): Promise<ZaloProfile | null> {
  const { res, body } = await callGraph(accessToken, "id,name,picture");
  // Zalo trả 200 kèm { error: <mã khác 0> } khi token sai/hết hạn.
  if (!res.ok || !body || (body.error && body.error !== 0) || !body.id) {
    // Ghi mã lỗi của Zalo (KHÔNG ghi token) — không có dòng này thì mọi
    // nguyên nhân (sai secret, thiếu quyền, token hết hạn) trông y hệt nhau.
    console.error(
      "zalo-auth: Graph từ chối:",
      res.status,
      JSON.stringify({ error: body?.error, message: body?.message, keys: body ? Object.keys(body) : null }),
    );
    return null;
  }
  return {
    id: String(body.id),
    name: typeof body.name === "string" ? body.name : null,
    picture: body.picture?.data?.url ?? null,
  };
}
