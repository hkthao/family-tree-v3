import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import { makeShareToken } from "@/lib/cards/publishCard";

type Client = SupabaseClient<Database>;

export type InviteRole = "viewer" | "editor";

export interface ClanInvite {
  id: string;
  clan_id: string;
  token: string;
  role: InviteRole;
  expires_at: string;
  is_revoked: boolean;
  use_count: number;
  created_at: string;
}

const INVITE_TTL_DAYS = 30;

/** Admin tạo link mời (chọn quyền). Token sinh client (crypto-random). */
export async function createClanInvite(
  clanId: string,
  role: InviteRole,
  client: Client = defaultClient,
): Promise<ClanInvite> {
  const { data: auth } = await client.auth.getUser();
  const uid = auth.user?.id;
  const expires = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000).toISOString();
  const { data, error } = await client
    .from("clan_invites")
    .insert({
      clan_id: clanId,
      token: makeShareToken(),
      role,
      created_by: uid,
      expires_at: expires,
    })
    .select("id, clan_id, token, role, expires_at, is_revoked, use_count, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data as ClanInvite;
}

/** Danh sách link còn hiệu lực (admin). */
export async function listClanInvites(
  clanId: string,
  client: Client = defaultClient,
): Promise<ClanInvite[]> {
  const { data, error } = await client
    .from("clan_invites")
    .select("id, clan_id, token, role, expires_at, is_revoked, use_count, created_at")
    .eq("clan_id", clanId)
    .eq("is_revoked", false)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ClanInvite[];
}

export async function revokeClanInvite(
  id: string,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client
    .from("clan_invites")
    .update({ is_revoked: true })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export interface InvitePeek {
  valid: boolean;
  clan_id?: string;
  clan_name?: string;
  role?: InviteRole;
}

/** Xem trước (tên dòng họ + quyền) — gọi được khi chưa đăng nhập. */
export async function peekClanInvite(
  token: string,
  client: Client = defaultClient,
): Promise<InvitePeek> {
  const { data, error } = await client.rpc("peek_clan_invite", { p_token: token });
  if (error) throw new Error(error.message);
  return (data as unknown as InvitePeek) ?? { valid: false };
}

/** Tham gia dòng họ bằng link (phải đã đăng nhập). Trả clan_id. */
export async function redeemClanInvite(
  token: string,
  client: Client = defaultClient,
): Promise<string> {
  const { data, error } = await client.rpc("redeem_clan_invite", { p_token: token });
  if (error) throw new Error(error.message);
  return data as string;
}
