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
  /** persons.id this member identifies as in the tree, or null. */
  self_person_id: string | null;
  /** Admin has confirmed the claim above is correct. */
  self_person_verified: boolean;
  /** Convenience: full_name of self_person_id, joined server-side. */
  self_person_full_name: string | null;
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

/**
 * Set (or clear, with personId=null) the current user's self_person_id
 * for this clan. Goes through the SECURITY DEFINER RPC because RLS on
 * clan_members only allows admins to UPDATE.
 *
 * The RPC also resets self_person_verified to false — admin must
 * re-approve after any change.
 */
export async function setMySelfPerson(
  clanId: string,
  personId: string | null,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client.rpc("set_my_self_person", {
    p_clan_id: clanId,
    // RPC accepts NULL to clear the claim; the generated types narrow
    // to `string` because Postgres function args aren't tagged
    // nullable in pg_proc. Safe to cast — the SQL function handles
    // NULL explicitly.
    p_person_id: personId as string,
  });
  if (error) throw new Error(error.message);
}

/**
 * Admin flips the verified flag on another member's self-link.
 * RLS already restricts clan_members UPDATE to clan admins.
 */
export async function setMemberSelfVerified(
  clanId: string,
  userId: string,
  verified: boolean,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client
    .from("clan_members")
    .update({ self_person_verified: verified })
    .eq("clan_id", clanId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}
