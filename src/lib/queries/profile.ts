import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export interface MyProfile {
  id: string;
  display_name: string | null;
  is_platform_admin: boolean;
  is_suspended: boolean;
  notify_monthly_lunar: boolean;
}

export async function getMyProfile(
  userId: string,
  client: Client = defaultClient,
): Promise<MyProfile | null> {
  const { data, error } = await client
    .from("profiles")
    .select(
      "id, display_name, is_platform_admin, is_suspended, notify_monthly_lunar",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as MyProfile | null;
}

export async function updateMyMonthlyLunarPref(
  userId: string,
  enabled: boolean,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client
    .from("profiles")
    .update({ notify_monthly_lunar: enabled })
    .eq("id", userId);
  if (error) throw new Error(error.message);
}

export async function updateMyDisplayName(
  userId: string,
  displayName: string,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", userId);
  if (error) throw new Error(error.message);
}

/**
 * Count clans owned by the caller that still have non-deleted persons.
 * The /account page uses this to disable the delete button — and surface
 * a clear message — before the user attempts the destructive action.
 */
export async function countMyBlockingClans(
  client: Client = defaultClient,
): Promise<number> {
  const { data, error } = await client.rpc("count_my_blocking_clans");
  if (error) throw new Error(error.message);
  return (data as number | null) ?? 0;
}

/**
 * Permanently delete the caller's account. The RPC raises if the caller
 * still owns clans with members (mirrored by countMyBlockingClans above
 * so the UI can pre-empt the call). On success, the auth.users row is
 * removed and FK cascades clean up profiles, clan_members, subscriptions.
 */
export async function deleteMyAccount(
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client.rpc("delete_my_account");
  if (error) throw new Error(error.message);
}
