import type { SupabaseClient } from "@supabase/supabase-js";

import { listClanMembers } from "@/lib/queries/members";
import { supabase as defaultClient } from "@/lib/supabase";

/**
 * Token API cho AI bên ngoài (Claude, ChatGPT…) — xem supabase/migrations/…_api_tokens.sql.
 * Bảng chưa nằm trong database.types.ts nên dùng client không gắn kiểu.
 */
type Client = SupabaseClient;

export type ApiTokenScope = "read" | "propose" | "write" | "admin";

export interface ApiToken {
  id: string;
  /** null = token admin hệ thống, không gắn dòng họ. */
  clan_id: string | null;
  name: string;
  token_prefix: string;
  scope: ApiTokenScope;
  expires_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

const COLS =
  "id, clan_id, name, token_prefix, scope, expires_at, last_used_at, revoked_at, created_at";

/** Token dạng `gpt_` + 32 byte ngẫu nhiên base64url. Bản rõ chỉ tồn tại ở trình duyệt. */
export function makeApiToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return (
    "gpt_" +
    btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")
  );
}

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Địa chỉ máy chủ MCP để dán vào Claude / ChatGPT. Mặc định là `/mcp` cùng tên miền với app
 * (nginx proxy sang container MCP); ghi đè bằng VITE_MCP_URL khi chạy dev hoặc tách tên miền.
 */
export function mcpUrl(
  override: string | undefined = import.meta.env.VITE_MCP_URL,
  origin: string = typeof window === "undefined" ? "" : window.location.origin,
): string {
  return override?.trim() ? override.trim() : `${origin}/mcp`;
}

export async function listMyApiTokens(
  clanId: string,
  userId: string,
  client: Client = defaultClient,
): Promise<ApiToken[]> {
  const { data, error } = await client
    .from("api_tokens")
    .select(COLS)
    .eq("clan_id", clanId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ApiToken[];
}

export interface ClanApiToken extends ApiToken {
  user_id: string;
  user_name: string;
}

/** Mọi token của MỘT dòng họ (RLS: admin dòng họ đó hoặc admin hệ thống), kèm tên chủ token. */
export async function listClanApiTokens(
  clanId: string,
  client: Client = defaultClient,
): Promise<ClanApiToken[]> {
  const { data, error } = await client
    .from("api_tokens")
    .select(`${COLS}, user_id`)
    .eq("clan_id", clanId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Array<ApiToken & { user_id: string }>;
  // Tên lấy từ danh sách thành viên của họ (profiles bị RLS chặn với admin dòng họ).
  const members = await listClanMembers(clanId).catch(() => []);
  const names = new Map(members.map((m) => [m.user_id, m.display_name]));
  return rows.map((r) => ({ ...r, user_name: names.get(r.user_id) || "—" }));
}

/** Tạo token; trả về BẢN RÕ để hiện một lần — không lưu và không lấy lại được. */
export async function createApiToken(
  input: { clanId: string | null; userId: string; name: string; scope: ApiTokenScope; days: number },
  client: Client = defaultClient,
): Promise<string> {
  const token = makeApiToken();
  const { error } = await client.from("api_tokens").insert({
    clan_id: input.scope === "admin" ? null : input.clanId,
    user_id: input.userId,
    name: input.name.trim(),
    scope: input.scope,
    token_hash: await sha256Hex(token),
    token_prefix: token.slice(0, 8),
    expires_at: new Date(Date.now() + input.days * 86_400_000).toISOString(),
  });
  if (error) throw new Error(error.message);
  return token;
}

export async function revokeApiToken(id: string, client: Client = defaultClient): Promise<void> {
  const { error } = await client
    .from("api_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
