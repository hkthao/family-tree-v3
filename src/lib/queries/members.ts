import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export type ClanRole = "admin" | "editor" | "viewer";

export interface ClanMember {
  user_id: string;
  role: ClanRole;
  display_name: string | null;
  invited_by: string | null;
  created_at: string;
}

export async function listClanMembers(
  clanId: string,
  client: Client = defaultClient,
): Promise<ClanMember[]> {
  const { data, error } = await client.rpc("get_clan_members_info", {
    target_clan: clanId,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ClanMember[]).map((m) => ({
    ...m,
    role: m.role as ClanRole,
  }));
}

export type InviteResult =
  | { ok: true; user_id: string; role: ClanRole }
  | { ok: false; error: "user_not_found" | "already_member" };

export async function inviteMemberByEmail(
  clanId: string,
  email: string,
  role: ClanRole,
  client: Client = defaultClient,
): Promise<InviteResult> {
  const { data, error } = await client.rpc("invite_member_by_email", {
    target_clan: clanId,
    target_email: email,
    member_role: role,
  });
  if (error) throw new Error(error.message);
  return data as unknown as InviteResult;
}

export async function changeMemberRole(
  clanId: string,
  userId: string,
  newRole: ClanRole,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client
    .from("clan_members")
    .update({ role: newRole })
    .eq("clan_id", clanId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function removeMember(
  clanId: string,
  userId: string,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client
    .from("clan_members")
    .delete()
    .eq("clan_id", clanId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}
