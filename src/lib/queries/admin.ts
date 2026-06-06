import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export interface AdminProfileRow {
  id: string;
  display_name: string | null;
  is_platform_admin: boolean;
  is_suspended: boolean;
  max_clans: number;
  created_at: string;
  email: string | null; // resolved separately via get_profile_emails
}

export interface AdminClanRow {
  id: string;
  name: string;
  description: string | null;
  visibility: "private" | "public";
  max_persons: number;
  max_users: number;
  owner_id: string | null;
  data_version: number;
  created_at: string;
}

/**
 * RLS already allows `is_platform_admin()` to SELECT every profile row.
 * Email is fetched via the get_profile_emails RPC and merged in.
 */
export async function listAllProfiles(
  client: Client = defaultClient,
): Promise<AdminProfileRow[]> {
  const { data, error } = await client
    .from("profiles")
    .select("id, display_name, is_platform_admin, is_suspended, max_clans, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const profiles = (data ?? []) as Omit<AdminProfileRow, "email">[];
  if (profiles.length === 0) return [];

  const ids = profiles.map((p) => p.id);
  const { data: emails, error: emailErr } = await client.rpc("get_profile_emails", {
    user_ids: ids,
  });
  if (emailErr) throw new Error(emailErr.message);
  const byId = new Map(
    (emails as { id: string; email: string }[] | null)?.map((e) => [e.id, e.email]) ?? [],
  );
  return profiles.map((p) => ({ ...p, email: byId.get(p.id) ?? null }));
}

export async function listAllClans(
  client: Client = defaultClient,
): Promise<AdminClanRow[]> {
  const { data, error } = await client
    .from("clans")
    .select(
      "id, name, description, visibility, max_persons, max_users, owner_id, data_version, created_at",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminClanRow[];
}

/** List clan_members for a single user — used to show "what clans is X in". */
export async function listClansForUser(
  userId: string,
  client: Client = defaultClient,
): Promise<Array<{ clan_id: string; clan_name: string; role: string }>> {
  const { data, error } = await client
    .from("clan_members")
    .select("clan_id, role, clan:clans(name)")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map(
    (r: { clan_id: string; role: string; clan: { name: string } | null }) => ({
      clan_id: r.clan_id,
      clan_name: r.clan?.name ?? "(?)",
      role: r.role,
    }),
  );
}

export async function updateProfileMaxClans(
  userId: string,
  maxClans: number,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client
    .from("profiles")
    .update({ max_clans: maxClans })
    .eq("id", userId);
  if (error) throw new Error(error.message);
}

export async function updateClanLimits(
  clanId: string,
  limits: { max_persons?: number; max_users?: number },
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client
    .from("clans")
    .update(limits)
    .eq("id", clanId);
  if (error) throw new Error(error.message);
}

/**
 * Call the admin-action Edge Function. Caller's JWT travels via Supabase's
 * auth header automatically when we go through `client.functions.invoke`.
 *
 * functions.invoke wraps non-2xx responses into a generic FunctionsHttpError
 * that hides the response body's `error` field — we re-read the body so
 * users see the precise reason (e.g. "Cannot perform this action on
 * yourself") instead of the opaque wrapper text.
 */
// ─── Platform-wide DB stats (Health tab) ────────────────────────────

export interface CronJobStatus {
  jobname: string;
  schedule: string;
  active: boolean;
  last_run: {
    status: string;
    start_time: string;
    end_time: string | null;
    return_message: string | null;
  } | null;
}

export interface PlatformDbStats {
  rows: Record<string, number>;
  sizes_bytes: Record<string, number>;
  rates: {
    persons_24h?: number;
    persons_7d?: number;
    persons_30d?: number;
    clans_7d?: number;
    clans_30d?: number;
    users_7d?: number;
    users_30d?: number;
  };
  states: {
    contributions_pending: number;
    person_links_pending: number;
    share_links_active: number;
    notifications_failed_total: number;
    users_total: number;
    users_suspended: number;
  };
  cron: CronJobStatus[];
  generated_at: string;
}

export async function getPlatformDbStats(
  client: Client = defaultClient,
): Promise<PlatformDbStats> {
  const { data, error } = await client.rpc("get_platform_db_stats");
  if (error) throw new Error(error.message);
  return data as unknown as PlatformDbStats;
}

export async function adminAction(
  body: {
    action: "suspend" | "unsuspend" | "signout" | "grant_platform_admin" | "delete";
    target_user_id: string;
    grant?: boolean;
  },
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client.functions.invoke("admin-action", { body });
  if (!error) return;

  const ctx = (error as { context?: Response }).context;
  if (ctx instanceof Response) {
    try {
      const parsed = await ctx.json();
      if (parsed && typeof parsed.error === "string") {
        throw new Error(parsed.error);
      }
    } catch (e) {
      if (e instanceof Error && e.message) throw e;
    }
  }
  throw new Error(error.message);
}
