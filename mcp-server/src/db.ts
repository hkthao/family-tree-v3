import { createClient } from "@supabase/supabase-js";

/** Service role: CHỈ để tra token, vai trò, hồ sơ và bảng OAuth. Không đụng dữ liệu gia phả. */
export const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Chuỗi ngẫu nhiên 32 byte, base64url, có tiền tố (gat_ access, grt_ refresh, gcd_ code). */
export function randomSecret(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return prefix + btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
